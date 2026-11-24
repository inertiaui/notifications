<?php

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use InertiaUI\Notifications\Models\PushSubscription;
use InertiaUI\Notifications\NotificationHours;
use InertiaUI\Notifications\NotificationHoursChange;
use InertiaUI\Notifications\NotificationPreferences;
use InertiaUI\Notifications\Push;
use InertiaUI\Notifications\Tests\Fixtures\User;
use InertiaUI\Notifications\Tests\TestCase;
use InertiaUI\Notifications\WebPush\Base64Url;
use InertiaUI\Notifications\WebPush\KeyPair;

pest()
    ->extends(TestCase::class)
    ->in(__DIR__);

/**
 * Get the given raw ES256 signature as DER, as OpenSSL verifies it.
 */
function derSignature(string $raw): string
{
    $integer = function (string $value): string {
        $value = ltrim($value, "\0");

        if (ord($value[0]) > 0x7F) {
            $value = "\0".$value;
        }

        return "\x02".chr(strlen($value)).$value;
    };

    $sequence = $integer(substr($raw, 0, 32)).$integer(substr($raw, 32));

    return "\x30".chr(strlen($sequence)).$sequence;
}

/**
 * Get the claims of the VAPID token in the given Authorization header, once its signature verifies with the given key.
 *
 * @return array<string, mixed>
 */
function verifiedVapidClaims(string $authorization, KeyPair $keys): array
{
    expect($authorization)
        ->toStartWith('vapid t=')
        ->toEndWith(", k={$keys->publicKeyAsBase64Url()}");

    [$header, $claims, $signature] = explode('.', substr($authorization, 8, strpos($authorization, ',') - 8));

    $verified = openssl_verify(
        "{$header}.{$claims}",
        derSignature(Base64Url::decode($signature)),
        KeyPair::openSslPublicKey($keys->publicKey),
        OPENSSL_ALGO_SHA256,
    );

    expect($verified)->toBe(1);

    return json_decode(Base64Url::decode($claims), true);
}

/**
 * Decrypt the given aes128gcm push message as the browser with the given key pair and auth secret does.
 *
 * Returns the plaintext with its padding delimiter, or false when the message does not decrypt.
 */
function decryptPush(string $message, KeyPair $browser, string $authSecret): string|false
{
    $salt = substr($message, 0, 16);
    $serverKey = substr($message, 21, 65);
    $body = substr($message, 86);

    $info = "WebPush: info\0".$browser->publicKey.$serverKey;
    $inputKey = hash_hkdf('sha256', $browser->sharedSecret($serverKey), 32, $info, $authSecret);

    return openssl_decrypt(
        substr($body, 0, -16),
        'aes-128-gcm',
        hash_hkdf('sha256', $inputKey, 16, "Content-Encoding: aes128gcm\0", $salt),
        OPENSSL_RAW_DATA,
        hash_hkdf('sha256', $inputKey, 12, "Content-Encoding: nonce\0", $salt),
        substr($body, -16),
    );
}

/**
 * Enable web push with a new pair of VAPID keys, and get the keys.
 */
function enablePush(): KeyPair
{
    $keys = KeyPair::generate();

    config([
        'inertia-notifications.push.enabled' => true,
        'inertia-notifications.push.public_key' => $keys->publicKeyAsBase64Url(),
        'inertia-notifications.push.private_key' => $keys->privateKeyAsBase64Url(),
        'inertia-notifications.push.subject' => 'mailto:support@acme.test',
    ]);

    return $keys;
}

/**
 * Get the decoded JSON of the given file in the Fixtures directory.
 *
 * Objects decode as objects, so an empty JSON object and an empty array stay apart. Pest's own
 * fixture() function gives the path of the file.
 */
function jsonFixture(string $name): mixed
{
    return json_decode((string) file_get_contents(fixture($name)));
}

/**
 * Register the routes of the notification center, as the application does in routes/web.php.
 */
function registerNotificationRoutes(): void
{
    Route::middleware('web')->group(fn () => Route::inertiaNotifications());

    app('router')->getRoutes()->refreshNameLookups();
}

/**
 * Store a push subscription of the given notifiable model, made with the current VAPID public key.
 *
 * @param  array<string, mixed>  $attributes
 */
function storePushSubscription(Model $notifiable, array $attributes = []): PushSubscription
{
    $endpoint = $attributes['endpoint'] ?? 'https://fcm.googleapis.com/fcm/send/'.Str::random(32);

    return PushSubscription::query()->create([
        'notifiable_type' => $notifiable->getMorphClass(),
        'notifiable_id' => $notifiable->getKey(),
        'endpoint' => $endpoint,
        'endpoint_hash' => PushSubscription::hash($endpoint),
        'p256dh' => KeyPair::generate()->publicKeyAsBase64Url(),
        'auth' => Base64Url::encode(random_bytes(16)),
        'user_agent' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) '
            .'Chrome/142.0.0.0 Safari/537.36',
        'vapid_public_key' => Push::keys()->publicKeyAsBase64Url(),
        ...$attributes,
    ]);
}

/**
 * Run the given callback once, right after the first query whose SQL matches, as another request that
 * runs in the middle of this one does, and get a closure that tells whether the callback ran.
 *
 * @param  Closure(string): bool  $matches
 * @return Closure(): bool
 */
function runOnceAfterQuery(Closure $matches, Closure $callback): Closure
{
    $ran = false;

    DB::listen(function (QueryExecuted $query) use (&$ran, $matches, $callback): void {
        if ($ran || ! $matches($query->sql)) {
            return;
        }

        // The callback runs queries that call this listener again, so we will
        // mark it as run before we run it.
        $ran = true;

        $callback();
    });

    return function () use (&$ran): bool {
        return $ran;
    };
}

/**
 * Give the user the same notification hours on every day of the week, in the user's timezone.
 */
function setNotificationHours(User $user, string $range): void
{
    config()->set('inertia-notifications.notification_hours.enabled', true);

    NotificationPreferences::update($user, notificationHours: new NotificationHoursChange(
        enabled: true,
        days: array_fill_keys(NotificationHours::DAYS, [$range]),
    ));
}
