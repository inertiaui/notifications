<?php

namespace InertiaUI\Notifications;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Carbon;
use InertiaUI\Notifications\Jobs\SendPushNotification;
use InertiaUI\Notifications\Models\InboxNotification;
use InertiaUI\Notifications\Models\PushSubscription;
use InertiaUI\Notifications\Testing\PushFake;
use InertiaUI\Notifications\WebPush\KeyPair;
use InertiaUI\Notifications\WebPush\PushPayload;
use InertiaUI\Notifications\WebPush\PushSender;
use InertiaUI\Notifications\WebPush\Vapid;
use InertiaUI\Notifications\WebPush\VapidException;
use InvalidArgumentException;
use RuntimeException;
use Symfony\Component\HttpFoundation\Cookie;

/**
 * Reads the `push` config, pushes the stored notifications whose inbox message asks for it, and stores the browsers
 * that receive the pushes of each notifiable model. Each browser keeps the hash of its endpoint in a cookie, so the
 * application knows which subscription is the current browser's.
 */
class Push
{
    /**
     * The name of the cookie that holds the endpoint hash of the current browser's subscription.
     */
    public const string DEVICE_COOKIE = 'inertiaui_push_device';

    /**
     * The name of the route that serves the service worker.
     */
    public const string WORKER_ROUTE = 'inertia-notifications.push.worker';

    /**
     * The most subscriptions that a notifiable model keeps. Subscribing another browser removes the oldest.
     */
    protected const int MAX_SUBSCRIPTIONS = 20;

    /**
     * The VAPID keys that were checked, by a hash of their configured values.
     *
     * @var array<string, KeyPair>
     */
    protected static array $checkedKeys = [];

    /**
     * Flush the checked keys.
     *
     * The service provider calls this for each new application, so tests do not share them.
     */
    public static function flushState(): void
    {
        static::$checkedKeys = [];
    }

    /**
     * Determine if the application sends pushes.
     */
    public static function enabled(): bool
    {
        return (bool) config('inertia-notifications.push.enabled', false);
    }

    /**
     * Get the seconds that a push service keeps a push for a browser that is offline.
     */
    public static function ttl(): int
    {
        return (int) config('inertia-notifications.push.ttl', 60 * 60 * 24);
    }

    /**
     * Get the absolute URL of the image that a push shows when its actor has no avatar.
     */
    public static function icon(): ?string
    {
        return self::configString('icon');
    }

    /**
     * Get the queue connection that sends the pushes, or null for the default connection.
     */
    public static function connection(): ?string
    {
        return self::configString('connection');
    }

    /**
     * Get the queue that sends the pushes, or null for the connection's default queue.
     */
    public static function queue(): ?string
    {
        return self::configString('queue');
    }

    /**
     * Get the VAPID keys of the config, once they are checked to be one pair of P-256 keys.
     *
     * @throws VapidException
     */
    public static function keys(): KeyPair
    {
        $publicKey = self::configString('public_key');
        $privateKey = self::configString('private_key');

        if ($publicKey === null || $privateKey === null) {
            throw VapidException::missingKeys();
        }

        // Checking that the keys form one pair derives the public key from the private key, so we will
        // only check each pair once in a process that sends many pushes, such as a queue worker.
        $hash = hash('sha256', "{$publicKey}|{$privateKey}");

        return static::$checkedKeys[$hash] ??= self::verifiedKeyPair($publicKey, $privateKey);
    }

    /**
     * Get the VAPID identity of the application, which signs each push.
     *
     * @throws VapidException
     */
    public static function vapid(): Vapid
    {
        return new Vapid(self::keys(), self::subject());
    }

    /**
     * Get the VAPID subject of the config, once it is checked to be a mailto: or https:// URL.
     *
     * @throws VapidException
     */
    public static function subject(): string
    {
        $subject = self::configString('subject');

        if ($subject === null) {
            throw VapidException::missingSubject();
        }

        if (! Vapid::acceptsSubject($subject)) {
            throw VapidException::invalidSubject($subject);
        }

        return $subject;
    }

    /**
     * Dispatch the job that pushes the given stored notification to every device of the notifiable model.
     *
     * The `inbox` channel calls this once it stored the notification. A notification that collapsed into the
     * stored one keeps the ID of its row, and so the tag of its push, so the device replaces the notification
     * that it showed before.
     */
    public static function dispatchFor(
        Model $notifiable,
        Notification $notification,
        InboxNotification $stored,
        InboxMessage $message,
    ): void {
        if (! self::shouldPush($notifiable, $notification, $stored, $message)) {
            return;
        }

        $job = new SendPushNotification($notifiable, self::payloadOf($stored, $message));

        dispatch($job)
            ->onConnection(self::connection())
            ->onQueue(self::queue())
            ->delay(self::delayOf($message))
            ->afterCommit();
    }

    /**
     * Get the time that the push of the given message waits until, or null to push the notification right away.
     *
     * A message that waits with `unlessReadWithin(..., ['push'])` delays the job by its minutes. The job then
     * drops the push of a notification that the user read, archived, or deleted in the meantime.
     */
    protected static function delayOf(InboxMessage $message): ?CarbonInterface
    {
        $minutes = $message->getReadDelay('push');

        return $minutes === null ? null : now()->addMinutes($minutes);
    }

    /**
     * Determine if the given stored notification should be pushed to the devices of the notifiable model.
     *
     * The message should ask for a push while push is enabled, the notification should alert the user, and
     * the user should receive the pushes of its category on at least one device.
     */
    protected static function shouldPush(
        Model $notifiable,
        Notification $notification,
        InboxNotification $stored,
        InboxMessage $message,
    ): bool {
        if (! $message->shouldPush()) {
            return false;
        }

        if (! self::enabled()) {
            return false;
        }

        if (! self::wouldAlert($stored)) {
            return false;
        }

        if (! NotificationPreferences::allows($notifiable, $notification, 'push')) {
            return false;
        }

        return PushSubscription::of($notifiable)->exists();
    }

    /**
     * Determine if the browser of an open page would alert for the given stored notification.
     *
     * It does not alert for a notification that arrives quietly or over the throttle of its category, nor
     * for one that the user already read or archived, such as on another device. The job checks again
     * whether the user read or archived it, as the user may do so while the push waits in the queue.
     */
    protected static function wouldAlert(InboxNotification $stored): bool
    {
        if ($stored->isQuiet() || $stored->isThrottled()) {
            return false;
        }

        return ! $stored->isReadOrArchived();
    }

    /**
     * Make the push of the given stored notification, which opens the notification and has the context of its row.
     */
    protected static function payloadOf(InboxNotification $stored, InboxMessage $message): PushPayload
    {
        return new PushPayload(
            id: $stored->id,
            title: $stored->translatedTitle(),
            body: $message->getBody(),
            navigate: route('inertia-notifications.open', ['notification' => $stored->id]),
            tag: Inbox::toastId($stored->id),
            icon: self::iconOf($message),
            lang: str_replace('_', '-', app()->getLocale()),
            timestamp: $stored->created_at->getTimestampMs(),
            context: self::contextKeyOf($stored),
        );
    }

    /**
     * Get the absolute URL of the push's icon: the avatar of the message's actor, or else the `push.icon` config.
     */
    protected static function iconOf(InboxMessage $message): ?string
    {
        $avatar = $message->getActorDetails()['avatar'] ?? null;

        if ($avatar !== null && preg_match('#^https?://#i', $avatar) === 1) {
            return $avatar;
        }

        return self::icon();
    }

    /**
     * Get the opaque key of the context of the given stored notification, or null for a notification without one.
     */
    protected static function contextKeyOf(InboxNotification $stored): ?string
    {
        if ($stored->context_type === null) {
            return null;
        }

        return Inbox::contextKey($stored->context_type, $stored->context_id);
    }

    /**
     * Determine if the given endpoint is an https:// URL of a push service in the `push.hosts` config.
     *
     * Browsers choose their push service, so the application only sends requests to the known services
     * instead of to any URL that a browser posts.
     */
    public static function allowsEndpoint(string $endpoint): bool
    {
        $parts = parse_url($endpoint);

        if (! is_array($parts) || ($parts['scheme'] ?? null) !== 'https' || ! isset($parts['host'])) {
            return false;
        }

        if (isset($parts['user']) || isset($parts['pass'])) {
            return false;
        }

        return self::hostPatternOf($parts['host']) !== null;
    }

    /**
     * Get the host of the `push.hosts` config that the given host matches, such as `*.notify.windows.com`.
     */
    public static function hostPatternOf(string $host): ?string
    {
        foreach ((array) config('inertia-notifications.push.hosts', [
            'fcm.googleapis.com',
            '*.push.services.mozilla.com',
            '*.push.apple.com',
            '*.notify.windows.com',
        ]) as $pattern) {
            if (preg_match(self::hostPattern((string) $pattern), strtolower($host)) === 1) {
                return (string) $pattern;
            }
        }

        return null;
    }

    /**
     * Get the push of the signed-in user as the shared prop holds it, or null while push is not enabled.
     *
     * The prop holds the VAPID public key that browsers subscribe with, the URL of the service worker with
     * the version of its file, and whether the current browser has a subscription of the user. While push
     * is enabled without valid VAPID keys and a subject, every page fails with the way to fix them.
     *
     * @return array{publicKey: string, worker: string, subscribed: bool}|null
     *
     * @throws VapidException
     */
    public static function sharedProp(Model $user): ?array
    {
        if (! self::enabled()) {
            return null;
        }

        // Like a missing application key, VAPID keys or a subject that push services refuse should stop
        // the page right away, with the command that fixes them, instead of hiding push from users.
        return [
            'publicKey' => self::vapid()->keys->publicKeyAsBase64Url(),
            'worker' => route(self::WORKER_ROUTE, ['v' => self::workerVersion()], absolute: false),
            'subscribed' => self::currentDeviceOf($user) instanceof PushSubscription,
        ];
    }

    /**
     * Get the path of the service worker's file.
     */
    public static function workerPath(): string
    {
        return __DIR__.'/../resources/push/worker.js';
    }

    /**
     * Get the version of the service worker's file, which changes with its content.
     *
     * Browsers update a service worker once its URL changes, so the URL carries this version.
     */
    protected static function workerVersion(): string
    {
        return (string) hash_file('xxh3', self::workerPath());
    }

    /**
     * Store the subscription of the current browser for the given notifiable model, and get it.
     *
     * A browser has one endpoint, so the subscription of an endpoint that another user subscribed moves to
     * the given notifiable model. The subscription that the browser had before, under another endpoint, is
     * removed, and so are the oldest subscriptions of the notifiable model past the most it keeps.
     *
     * @param  array{
     *     endpoint: string,
     *     p256dh: string,
     *     auth: string,
     *     expires_at: Carbon|null,
     *     user_agent: string|null,
     * }  $attributes
     *
     * @throws VapidException
     */
    public static function subscribe(
        Model $notifiable,
        array $attributes,
        ?string $previousEndpointHash,
    ): PushSubscription {
        $hash = PushSubscription::hash($attributes['endpoint']);

        $subscription = PushSubscription::query()->updateOrCreate(['endpoint_hash' => $hash], [
            ...$attributes,
            'notifiable_type' => $notifiable->getMorphClass(),
            'notifiable_id' => $notifiable->getKey(),
            'vapid_public_key' => self::keys()->publicKeyAsBase64Url(),
        ]);

        // A browser that subscribes again becomes the newest subscription of the notifiable model, so
        // the most it keeps leaves out the browsers that subscribed the longest ago instead of it.
        $subscription->touch();

        if ($previousEndpointHash !== null && $previousEndpointHash !== $hash) {
            PushSubscription::query()->where('endpoint_hash', $previousEndpointHash)->delete();
        }

        self::removeOldestSubscriptions($notifiable, $subscription);

        return $subscription;
    }

    /**
     * Remove the subscription of the given endpoint from the given notifiable model.
     */
    public static function unsubscribe(Model $notifiable, string $endpoint): void
    {
        PushSubscription::of($notifiable)
            ->where('endpoint_hash', PushSubscription::hash($endpoint))
            ->delete();
    }

    /**
     * Remove the push subscription of the given device from the given notifiable model.
     *
     * Removing a device that is already gone, or that belongs to another notifiable model, changes nothing.
     */
    public static function removeDevice(Model $notifiable, int|string $device): void
    {
        PushSubscription::of($notifiable)->whereKey($device)->delete();
    }

    /**
     * Get the endpoint hash that the current browser's cookie holds, or null for a browser without one.
     */
    public static function currentEndpointHash(): ?string
    {
        $endpointHash = request()->cookie(self::DEVICE_COOKIE);

        if (! is_string($endpointHash) || preg_match('/^[0-9a-f]{64}\z/', $endpointHash) !== 1) {
            return null;
        }

        return $endpointHash;
    }

    /**
     * Get the subscription of the given user that the current browser's cookie points to.
     *
     * A subscription made with a previous VAPID key counts too, so the page of a device that the user turned
     * push on for subscribes it again with the current key, instead of showing push as off on that device.
     */
    public static function currentDeviceOf(Model $user): ?PushSubscription
    {
        $endpointHash = self::currentEndpointHash();

        if ($endpointHash === null) {
            return null;
        }

        return PushSubscription::of($user)
            ->where('endpoint_hash', $endpointHash)
            ->first();
    }

    /**
     * Get the devices that receive the pushes of the given user, the most recently active first, for the device list.
     *
     * A device saves its subscription again on each page that it opens while push is on, so the time it was last
     * active is when its subscription was last updated.
     *
     * @return list<array{id: int, browser: string|null, platform: string|null, activeAt: string, current: bool}>
     */
    public static function devicesOf(Model $user): array
    {
        $endpointHash = self::currentEndpointHash();

        return PushSubscription::of($user)
            ->latest('updated_at')
            ->latest('id')
            ->get()
            ->map(fn (PushSubscription $subscription): array => [
                'id' => $subscription->id,
                'browser' => $subscription->browser(),
                'platform' => $subscription->platform(),
                'activeAt' => $subscription->updated_at->toIso8601String(),
                'current' => $subscription->endpoint_hash === $endpointHash,
            ])
            ->all();
    }

    /**
     * Make the cookie that tells the current browser's subscription apart.
     */
    public static function deviceCookie(PushSubscription $subscription): Cookie
    {
        return cookie()->forever(self::DEVICE_COOKIE, $subscription->endpoint_hash);
    }

    /**
     * Make the cookie that removes the current browser's cookie of its subscription.
     */
    public static function forgetDeviceCookie(): Cookie
    {
        return cookie()->forget(self::DEVICE_COOKIE);
    }

    /**
     * Replace the sender of the pushes with a fake that records them.
     *
     * Tests usually run without the VAPID keys and subject of the .env file, so the fake sets a new pair
     * and a subject when they are not set, which lets the shared prop and the endpoints work as well.
     * It also sends the pushes on the sync connection, since the fake records a push only once its job
     * runs, and a job on another connection would wait in its queue past the end of the test. A test
     * that fakes the queue still finds the jobs there.
     */
    public static function fake(): PushFake
    {
        config(['inertia-notifications.push.connection' => 'sync']);

        if (blank(config('inertia-notifications.push.public_key'))) {
            $keys = KeyPair::generate();

            config([
                'inertia-notifications.push.public_key' => $keys->publicKeyAsBase64Url(),
                'inertia-notifications.push.private_key' => $keys->privateKeyAsBase64Url(),
            ]);
        }

        if (blank(config('inertia-notifications.push.subject'))) {
            config(['inertia-notifications.push.subject' => 'mailto:tests@inertiaui.com']);
        }

        $fake = new PushFake;

        app()->instance(PushSender::class, $fake);

        return $fake;
    }

    /**
     * Get the value of the given key of the `push` config, or null when it is empty or not a string.
     */
    protected static function configString(string $key): ?string
    {
        $value = config("inertia-notifications.push.{$key}");

        return is_string($value) && $value !== '' ? $value : null;
    }

    /**
     * Get the given keys once they are checked to be one pair of P-256 keys.
     *
     * @throws VapidException
     */
    protected static function verifiedKeyPair(string $publicKey, string $privateKey): KeyPair
    {
        try {
            $keys = KeyPair::fromBase64Url($publicKey, $privateKey);
            $belongTogether = $keys->belongTogether();
        } catch (InvalidArgumentException|RuntimeException $exception) {
            throw VapidException::invalidKeys($exception->getMessage());
        }

        if (! $belongTogether) {
            throw VapidException::mismatchedKeys();
        }

        return $keys;
    }

    /**
     * Remove the oldest subscriptions of the notifiable model past the most that it keeps, but never the given one.
     *
     * Each browser posts its own subscription, so the limit keeps a client from filling the table. Timestamps
     * have no fractions of a second, so we will keep the subscription that was just stored by its key.
     */
    protected static function removeOldestSubscriptions(Model $notifiable, PushSubscription $kept): void
    {
        $newest = PushSubscription::of($notifiable)
            ->whereKeyNot($kept->getKey())
            ->latest('updated_at')
            ->latest('id')
            ->take(self::MAX_SUBSCRIPTIONS - 1)
            ->pluck('id');

        PushSubscription::of($notifiable)
            ->whereKeyNot([$kept->getKey(), ...$newest->all()])
            ->delete();
    }

    /**
     * Get the regular expression of the given host pattern, in which `*.` stands for any subdomain.
     */
    protected static function hostPattern(string $pattern): string
    {
        $pattern = strtolower($pattern);

        if (str_starts_with($pattern, '*.')) {
            return '/^(?:[a-z0-9-]+\.)+'.preg_quote(substr($pattern, 2), '/').'$/';
        }

        return '/^'.preg_quote($pattern, '/').'$/';
    }
}
