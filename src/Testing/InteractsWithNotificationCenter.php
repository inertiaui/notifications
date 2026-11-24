<?php

namespace InertiaUI\Notifications\Testing;

use Carbon\CarbonInterface;
use Closure;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use InertiaUI\Notifications\Digest;
use InertiaUI\Notifications\Inbox;
use InertiaUI\Notifications\Models\DigestItem;
use InertiaUI\Notifications\Models\InboxNotification;
use InertiaUI\Notifications\Models\PushSubscription;
use InertiaUI\Notifications\NotificationHours;
use InertiaUI\Notifications\NotificationPreferences;
use InertiaUI\Notifications\Notifications\NotificationDigest;
use InertiaUI\Notifications\Push;
use InertiaUI\Notifications\WebPush\Base64Url;
use InertiaUI\Notifications\WebPush\KeyPair;
use InertiaUI\Notifications\WebPush\PushSender;
use PHPUnit\Framework\Assert as PHPUnit;

/**
 * Add to the application's base test case to assert on the notification center, the preferences, and web push.
 *
 * The assertions read each notification as the frontend receives it, so a callback receives an array
 * with keys such as `title`, `category`, `data`, `readAt`, and `archivedAt`.
 */
trait InteractsWithNotificationCenter
{
    /**
     * Assert if the notifiable model has a notification based on its title or a truth-test callback.
     *
     * Archived and snoozed notifications count too.
     *
     * @param  (Closure(array<string, mixed>): bool)|string|null  $callback
     */
    public function assertInboxMessage(
        Model $notifiable,
        Closure|string|null $callback = null,
        ?int $times = null,
    ): void {
        $messages = $this->inboxMessages($notifiable);
        $count = count($this->filterInboxMessages($messages, $callback));
        $description = $this->describeInboxMessage($callback);

        if ($times === null) {
            PHPUnit::assertGreaterThan(
                0,
                $count,
                "Expected a {$description} in the inbox. It has: {$this->inboxTitles($messages)}.",
            );

            return;
        }

        $timesWord = Str::plural('time', $times);
        $countWord = Str::plural('time', $count);

        PHPUnit::assertSame(
            $times,
            $count,
            "Expected a {$description} in the inbox {$times} {$timesWord}, but it is there {$count} {$countWord}.",
        );
    }

    /**
     * Assert if the notifiable model has no notification based on its title or a truth-test callback.
     *
     * @param  (Closure(array<string, mixed>): bool)|string  $callback
     */
    public function assertInboxMessageMissing(Model $notifiable, Closure|string $callback): void
    {
        $matches = $this->filterInboxMessages($this->inboxMessages($notifiable), $callback);
        $description = $this->describeInboxMessage($callback);

        PHPUnit::assertCount(0, $matches, "Expected no {$description} in the inbox.");
    }

    /**
     * Assert that the notifiable model has no notifications.
     */
    public function assertNoInboxMessages(Model $notifiable): void
    {
        $messages = $this->inboxMessages($notifiable);

        PHPUnit::assertCount(0, $messages, "Expected the inbox to be empty. It has: {$this->inboxTitles($messages)}.");
    }

    /**
     * Assert that the notifications based on a title or truth-test callback are read.
     *
     * Without a title or callback, every notification of the notifiable model should be read.
     *
     * @param  (Closure(array<string, mixed>): bool)|string|null  $callback
     */
    public function assertMarkedRead(Model $notifiable, Closure|string|null $callback = null): void
    {
        $this->assertEveryInboxMessage(
            $notifiable,
            $callback,
            'read',
            fn (array $message): bool => $message['readAt'] !== null,
        );
    }

    /**
     * Assert that the notifications based on a title or truth-test callback are unread.
     *
     * Without a title or callback, every notification of the notifiable model should be unread.
     *
     * @param  (Closure(array<string, mixed>): bool)|string|null  $callback
     */
    public function assertMarkedUnread(Model $notifiable, Closure|string|null $callback = null): void
    {
        $this->assertEveryInboxMessage(
            $notifiable,
            $callback,
            'unread',
            fn (array $message): bool => $message['readAt'] === null,
        );
    }

    /**
     * Assert that the notifications based on a title or truth-test callback are archived.
     *
     * Without a title or callback, every notification of the notifiable model should be archived.
     *
     * @param  (Closure(array<string, mixed>): bool)|string|null  $callback
     */
    public function assertArchived(Model $notifiable, Closure|string|null $callback = null): void
    {
        $this->assertEveryInboxMessage(
            $notifiable,
            $callback,
            'archived',
            fn (array $message): bool => $message['archivedAt'] !== null,
        );
    }

    /**
     * Assert if the notifiable model receives the category on the given channel.
     *
     * The category and the channel are keys of the `preferences` config. Locked categories are always on,
     * opt-in categories are off until the user turns them on, and every other category is off while the
     * user turned off the channel for every category.
     */
    public function assertPreferenceSet(Model $notifiable, string $category, string $channel, bool $enabled): void
    {
        $categories = NotificationPreferences::categories();

        PHPUnit::assertArrayHasKey($category, $categories, "The preferences config has no category [{$category}].");
        PHPUnit::assertContains(
            $channel,
            $categories[$category]['channels'],
            "The category [{$category}] does not offer the channel [{$channel}].",
        );

        $state = $enabled ? 'on' : 'off';

        PHPUnit::assertSame(
            $enabled,
            NotificationPreferences::enabled($notifiable, $category, $channel),
            "Expected the [{$category}] notifications on the [{$channel}] channel to be {$state}.",
        );
    }

    /**
     * Assert if the notifiable model receives the given channel, by its switch for every category.
     *
     * The channel is a key of the `preferences` config, and should have a switch for every category.
     */
    public function assertChannelPreferenceSet(Model $notifiable, string $channel, bool $enabled): void
    {
        $channels = NotificationPreferences::channels();

        PHPUnit::assertArrayHasKey($channel, $channels, "The preferences config has no channel [{$channel}].");
        PHPUnit::assertTrue(
            $channels[$channel]['global_switch'],
            "The channel [{$channel}] has no switch for every category.",
        );

        $state = $enabled ? 'on' : 'off';

        PHPUnit::assertSame(
            $enabled,
            NotificationPreferences::channelEnabled($notifiable, $channel),
            "Expected the [{$channel}] channel to be {$state} for every category.",
        );
    }

    /**
     * Assert if the notifiable model receives the category with the given digest frequency.
     *
     * The category is a key of the `preferences` config, and the frequency is `instant`, `hourly`, `daily`, or
     * `weekly`.
     */
    public function assertDigestFrequency(Model $notifiable, string $category, string $frequency): void
    {
        PHPUnit::assertArrayHasKey(
            $category,
            NotificationPreferences::categories(),
            "The preferences config has no category [{$category}].",
        );

        PHPUnit::assertSame(
            $frequency,
            NotificationPreferences::frequency($notifiable, $category),
            "Expected the [{$category}] notifications to be sent with the [{$frequency}] frequency.",
        );
    }

    /**
     * Assert if the notifiable model has a notification held for a digest based on its title or a truth-test callback.
     *
     * The callback also receives the time that the digest is sent at under `sendAt`, and the channels that the
     * digest sends the notification through under `channels`.
     *
     * @param  (Closure(array<string, mixed>): bool)|string|null  $callback
     */
    public function assertHeldForDigest(
        Model $notifiable,
        Closure|string|null $callback = null,
        ?int $times = null,
    ): void {
        $messages = $this->heldMessages($notifiable);
        $count = count($this->filterInboxMessages($messages, $callback));
        $description = $this->describeInboxMessage($callback);

        if ($times === null) {
            PHPUnit::assertGreaterThan(
                0,
                $count,
                "Expected a {$description} to be held for a digest. Held: {$this->inboxTitles($messages)}.",
            );

            return;
        }

        $timesWord = Str::plural('time', $times);
        $countWord = Str::plural('time', $count);

        PHPUnit::assertSame(
            $times,
            $count,
            "Expected a {$description} to be held for a digest {$times} {$timesWord}, "
                ."but it is held {$count} {$countWord}.",
        );
    }

    /**
     * Assert that the notifiable model has no notifications held for a digest.
     */
    public function assertNothingHeldForDigest(Model $notifiable): void
    {
        $messages = $this->heldMessages($notifiable);

        PHPUnit::assertCount(
            0,
            $messages,
            "Expected nothing to be held for a digest. Held: {$this->inboxTitles($messages)}.",
        );
    }

    /**
     * Assert if the notifiable model was sent a digest with a notification based on its title or a truth-test callback.
     *
     * Call `Notification::fake()` before the digests are sent. Without a title or callback, any digest passes.
     *
     * @param  (Closure(array<string, mixed>): bool)|string|null  $callback
     */
    public function assertDigestSent(Model $notifiable, Closure|string|null $callback = null): void
    {
        Notification::assertSentTo(
            $notifiable,
            Digest::notification(),
            fn (NotificationDigest $digest): bool => $this->filterInboxMessages($digest->messages(), $callback) !== [],
        );
    }

    /**
     * Assert that no digest was sent to the notifiable model.
     *
     * Call `Notification::fake()` before the digests are sent.
     */
    public function assertNoDigestSent(Model $notifiable): void
    {
        Notification::assertNotSentTo($notifiable, Digest::notification());
    }

    /**
     * Assert that notifications reach the notifiable model now, inside its notification hours.
     *
     * The assertion also passes while the notifiable model turned its notification hours off. The application
     * should offer notification hours with the `notification_hours.enabled` config.
     */
    public function assertWithinNotificationHours(Model $notifiable): void
    {
        PHPUnit::assertTrue(NotificationHours::offered(), 'The application does not offer notification hours.');

        PHPUnit::assertTrue(
            NotificationHours::within($notifiable),
            'Expected the current time to fall within the notification hours.',
        );
    }

    /**
     * Assert that notifications arrive silently for the notifiable model now, outside its notification hours.
     *
     * The application should offer notification hours with the `notification_hours.enabled` config.
     */
    public function assertOutsideNotificationHours(Model $notifiable): void
    {
        PHPUnit::assertTrue(NotificationHours::offered(), 'The application does not offer notification hours.');

        PHPUnit::assertFalse(
            NotificationHours::within($notifiable),
            'Expected the current time to fall outside the notification hours.',
        );
    }

    /**
     * Assert that the notifiable model paused its notifications, until the given time when one is given.
     *
     * The time is compared to the second. The application should offer pausing with the `pause.enabled` config.
     */
    public function assertNotificationsPaused(Model $notifiable, ?CarbonInterface $until = null): void
    {
        PHPUnit::assertTrue(NotificationPreferences::offersPausing(), 'The application does not offer pausing.');

        $pausedUntil = NotificationPreferences::pausedUntil($notifiable);

        PHPUnit::assertNotNull($pausedUntil, 'Expected the notifications to be paused.');

        if (! $until instanceof CarbonInterface) {
            return;
        }

        $expected = $until->toIso8601String();
        $actual = $pausedUntil->toIso8601String();

        PHPUnit::assertSame(
            $until->getTimestamp(),
            $pausedUntil->getTimestamp(),
            "Expected the notifications to be paused until [{$expected}], but they are paused until [{$actual}].",
        );
    }

    /**
     * Assert that the notifiable model did not pause its notifications, or that its pause has passed.
     *
     * The application should offer pausing with the `pause.enabled` config.
     */
    public function assertNotificationsNotPaused(Model $notifiable): void
    {
        PHPUnit::assertTrue(NotificationPreferences::offersPausing(), 'The application does not offer pausing.');

        $pausedUntil = NotificationPreferences::pausedUntil($notifiable)?->toIso8601String();

        PHPUnit::assertNull(
            $pausedUntil,
            "Expected the notifications not to be paused, but they are paused until [{$pausedUntil}].",
        );
    }

    /**
     * Replace the sender of web pushes with a fake that records each push instead of sending it.
     *
     * The pushes are sent by a queued job, so the fake sends them on the `sync` connection, which runs the job
     * right away, whatever the `push.connection` config names.
     */
    public function fakePush(): PushFake
    {
        return Push::fake();
    }

    /**
     * Store a device of the notifiable model that receives pushes, such as before sending it a notification.
     *
     * The device has the keys that a browser would have, and subscribed with the VAPID keys of the config,
     * which `fakePush()` sets when the config has none.
     */
    public function createPushSubscription(Model $notifiable): PushSubscription
    {
        return Push::subscribe($notifiable, [
            'endpoint' => 'https://fcm.googleapis.com/fcm/send/'.Str::random(40),
            'p256dh' => KeyPair::generate()->publicKeyAsBase64Url(),
            'auth' => Base64Url::encode(random_bytes(16)),
            'expires_at' => null,
            'user_agent' => null,
        ], previousEndpointHash: null);
    }

    /**
     * Assert if a push reached a device of the notifiable model based on its title or a truth-test callback.
     *
     * The callback receives the `notification` of the push's payload, with keys such as `title`, `body`,
     * `navigate`, and `tag`, and the ID of the device's subscription under `subscription`.
     *
     * @param  (Closure(array<string, mixed>): bool)|string  $callback
     */
    public function assertPushed(Model $notifiable, Closure|string $callback): void
    {
        $pushes = $this->pushFake()->pushed($notifiable);
        $expected = "{$this->describePush($callback)} to {$this->describeNotifiable($notifiable)}";

        if ($pushes === [] && ! PushSubscription::of($notifiable)->exists()) {
            PHPUnit::fail("Expected a {$expected}, which has no devices that receive pushes.");
        }

        PHPUnit::assertNotEmpty(
            $this->filterInboxMessages($pushes, $callback),
            "Expected a {$expected}. Pushed: {$this->pushTitles($pushes)}.",
        );
    }

    /**
     * Assert that no push reached a device of the notifiable model based on its title or a truth-test callback.
     *
     * @param  (Closure(array<string, mixed>): bool)|string  $callback
     */
    public function assertNotPushed(Model $notifiable, Closure|string $callback): void
    {
        $matches = $this->filterInboxMessages($this->pushFake()->pushed($notifiable), $callback);

        PHPUnit::assertCount(
            0,
            $matches,
            "Expected no {$this->describePush($callback)} to {$this->describeNotifiable($notifiable)}. Pushed: "
                ."{$this->pushTitles($matches)}.",
        );
    }

    /**
     * Assert that no push reached any device.
     */
    public function assertNothingPushed(): void
    {
        $pushes = $this->pushFake()->pushed();

        PHPUnit::assertCount(0, $pushes, "Expected nothing to be pushed. Pushed: {$this->pushTitles($pushes)}.");
    }

    /**
     * Assert that the matching notifications are in the given state, and that at least one matches.
     *
     * @param  (Closure(array<string, mixed>): bool)|string|null  $callback
     * @param  Closure(array<string, mixed>): bool  $passes
     */
    protected function assertEveryInboxMessage(
        Model $notifiable,
        Closure|string|null $callback,
        string $state,
        Closure $passes,
    ): void {
        $messages = $this->inboxMessages($notifiable);
        $matches = $this->filterInboxMessages($messages, $callback);
        $description = $this->describeInboxMessage($callback);

        PHPUnit::assertNotEmpty(
            $matches,
            "Expected a {$description} in the inbox. It has: {$this->inboxTitles($messages)}.",
        );

        $failing = array_filter($matches, fn (array $message): bool => ! $passes($message));

        PHPUnit::assertCount(
            0,
            $failing,
            "Expected every {$description} to be {$state}. Not {$state}: {$this->inboxTitles($failing)}.",
        );
    }

    /**
     * Get the notifications of the notifiable model as the frontend receives them, oldest first.
     *
     * @return list<array<string, mixed>>
     */
    protected function inboxMessages(Model $notifiable): array
    {
        return Inbox::query($notifiable)
            ->oldest()
            ->get()
            ->map(fn (InboxNotification $notification): array => $notification->toInboxArray())
            ->values()
            ->all();
    }

    /**
     * Get the notifications that are held for a digest of the notifiable model, oldest first.
     *
     * Each notification has the time its digest is sent at, and the channels that are held.
     *
     * @return list<array<string, mixed>>
     */
    protected function heldMessages(Model $notifiable): array
    {
        $items = Digest::query($notifiable)
            ->orderBy('created_at')
            ->orderBy('id')
            ->get()
            ->groupBy('notification_id');

        $class = Digest::notification();

        return $items->map(function ($held) use ($class): array {
            /** @var DigestItem $item */
            $item = $held->first();
            $message = (new $class([$item->toDigestArray()]))->messages()[0];

            return [
                ...$message,
                'sendAt' => $item->send_at->toIso8601String(),
                'channels' => $held->pluck('channel')->all(),
            ];
        })->values()->all();
    }

    /**
     * Get the notifications or the pushes that match a title or callback.
     *
     * @param  list<array<string, mixed>>  $messages
     * @param  (Closure(array<string, mixed>): bool)|string|null  $callback
     * @return list<array<string, mixed>>
     */
    protected function filterInboxMessages(array $messages, Closure|string|null $callback): array
    {
        if ($callback === null) {
            return $messages;
        }

        $matches = is_string($callback) ? fn (array $message): bool => $message['title'] === $callback : $callback;

        return collect($messages)
            ->filter(fn (array $message): bool => (bool) $matches($message))
            ->values()
            ->all();
    }

    /**
     * Get the description of the expected notification for the failure messages.
     */
    protected function describeInboxMessage(Closure|string|null $callback): string
    {
        return match (true) {
            is_string($callback) => "notification titled [{$callback}]",
            $callback instanceof Closure => 'matching notification',
            default => 'notification',
        };
    }

    /**
     * Get the fake that records the pushes, or fail when the pushes are not faked.
     */
    protected function pushFake(): PushFake
    {
        $sender = app(PushSender::class);

        if (! $sender instanceof PushFake) {
            PHPUnit::fail('The pushes are not faked. Call $this->fakePush() before the notifications are sent.');
        }

        return $sender;
    }

    /**
     * Get the description of the expected push for the failure messages.
     */
    protected function describePush(Closure|string $callback): string
    {
        return is_string($callback) ? "push titled [{$callback}]" : 'matching push';
    }

    /**
     * Get the description of the given notifiable model for the failure messages.
     */
    protected function describeNotifiable(Model $notifiable): string
    {
        return '['.$notifiable::class.'] ['.$notifiable->getKey().']';
    }

    /**
     * Get the titles of the given pushes for the failure messages, with the number of devices of each.
     *
     * @param  list<array<string, mixed>>  $pushes
     */
    protected function pushTitles(array $pushes): string
    {
        if ($pushes === []) {
            return 'none';
        }

        return collect($pushes)
            ->groupBy(fn (array $push): string => (string) $push['title'])
            ->map(fn (Collection $pushes): int => $pushes->pluck('subscription')->unique()->count())
            ->map(fn (int $devices, string $title): string => $devices === 1
                ? "[{$title}]"
                : "[{$title}] on {$devices} devices")
            ->implode(', ');
    }

    /**
     * Get the titles of the given notifications for the failure messages.
     *
     * @param  list<array<string, mixed>>  $messages
     */
    protected function inboxTitles(array $messages): string
    {
        if ($messages === []) {
            return 'none';
        }

        return collect($messages)
            ->map(fn (array $message): string => "[{$message['title']}]")
            ->implode(', ');
    }
}
