<?php

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Illuminate\Testing\TestResponse;
use Inertia\Inertia;
use InertiaUI\Notifications\Models\PushSubscription;
use InertiaUI\Notifications\Push;
use InertiaUI\Notifications\Tests\Fixtures\User;
use InertiaUI\Notifications\WebPush\Base64Url;
use InertiaUI\Notifications\WebPush\KeyPair;
use InertiaUI\Notifications\WebPush\VapidException;

beforeEach(function (): void {
    Route::middleware('web')->group(function (): void {
        Route::inertiaNotifications();
        Route::get('/dashboard', fn () => Inertia::render('Dashboard'));
        Route::post('/login/{user}', function (User $user) {
            Auth::login($user);

            return response('Signed in');
        });
        Route::post('/logout', function () {
            Auth::logout();

            return response('Signed out');
        });
    });

    $this->keys = enablePush();
    $this->user = User::named('Pascal');
});

/**
 * Get what a browser posts to subscribe, which is `PushSubscription.toJSON()` and the content encoding.
 *
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function browserSubscription(array $overrides = []): array
{
    return array_replace_recursive([
        'endpoint' => 'https://fcm.googleapis.com/fcm/send/dXJ1:APA91bH',
        'expirationTime' => null,
        'keys' => [
            'p256dh' => KeyPair::generate()->publicKeyAsBase64Url(),
            'auth' => Base64Url::encode(random_bytes(16)),
        ],
    ], $overrides);
}

/**
 * Subscribe the browser of the test's user, as it posts what browserSubscription() gets with the given overrides.
 *
 * @param  array<string, mixed>  $overrides
 */
function subscribe(array $overrides = []): TestResponse
{
    return test()->actingAs(test()->user)
        ->postJson(route('inertia-notifications.push.subscribe'), browserSubscription($overrides));
}

it('stores the subscription of the browser and remembers it in a cookie', function (): void {
    $body = browserSubscription();

    $response = subscribe($body)
        ->assertOk()
        ->assertExactJson(['subscribed' => true]);

    $subscription = PushSubscription::query()->sole();

    $response->assertCookie(Push::DEVICE_COOKIE, $subscription->endpoint_hash);

    expect($subscription->belongsToNotifiable($this->user))
        ->toBeTrue()
        ->and($subscription->endpoint)
        ->toBe($body['endpoint'])
        ->and($subscription->endpoint_hash)
        ->toBe(hash('sha256', $body['endpoint']))
        ->and($subscription->p256dh)
        ->toBe($body['keys']['p256dh'])
        ->and($subscription->auth)
        ->toBe($body['keys']['auth'])
        ->and($subscription->vapid_public_key)
        ->toBe($this->keys->publicKeyAsBase64Url())
        ->and($subscription->expires_at)
        ->toBeNull();
});

it('stores when the browser says that the subscription expires', function (int $expirationTime, int $timestamp): void {
    subscribe(['expirationTime' => $expirationTime])->assertOk();

    expect(PushSubscription::query()->sole()->expires_at->getTimestamp())->toBe($timestamp);
})->with([
    'a time before 2038' => [1794996000000, 1794996000],
    'a time after 2038' => [4070937600000, 4070937600],
    'the last time a datetime column holds in every timezone' => [253402214399999, 253402214399],
]);

it('stores when the subscription expires as the same instant in another application timezone', function (): void {
    config(['app.timezone' => 'Europe/Amsterdam']);
    date_default_timezone_set('Europe/Amsterdam');
    $expiresAt = now()->addMinutes(30);

    subscribe(['expirationTime' => $expiresAt->getTimestampMs()])->assertOk();

    $subscription = PushSubscription::query()->sole();

    expect($subscription->expires_at->getTimestamp())
        ->toBe($expiresAt->getTimestamp())
        ->and($subscription->isExpired())
        ->toBeFalse();
});

it('refuses an expiration time after the last time a datetime column holds in every timezone', function (): void {
    subscribe(['expirationTime' => 253402214400000])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('expirationTime');

    expect(PushSubscription::query()->count())->toBe(0);
});

it('refuses an endpoint that is not an https URL of a push service in the config', function (string $endpoint, string $error): void {
    subscribe(['endpoint' => $endpoint])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['endpoint' => $error]);

    expect(PushSubscription::query()->count())->toBe(0);
})->with([
    'another host' => ['https://attacker.test/collect', 'The push service [attacker.test] is not in the'],
    'a host that ends like an allowed one' => ['https://evil-fcm.googleapis.com.attacker.test/x', 'is not in the'],
    'an allowed host as a subdomain' => ['https://fcm.googleapis.com.attacker.test/x', 'is not in the'],
    'a wildcard host without a subdomain' => ['https://push.apple.com/3/device/abc', 'is not in the'],
    'a wildcard host followed by another domain' => ['https://web.push.apple.com.attacker.test/x', 'is not in the'],
    'credentials before the host' => ['https://fcm.googleapis.com@attacker.test/x', 'is not in the'],
    'credentials before an allowed host' => ['https://user:secret@fcm.googleapis.com/fcm/send/x', 'is not in the'],
    'plain http' => ['http://fcm.googleapis.com/fcm/send/x', 'must be an https:// URL'],
    'a local address' => ['https://127.0.0.1/fcm/send/x', 'is not in the'],
]);

it('accepts the push services of every browser by their wildcard hosts', function (string $endpoint): void {
    subscribe(['endpoint' => $endpoint])->assertOk();
})->with([
    'Chrome' => 'https://fcm.googleapis.com/fcm/send/dXJ1:APA91bH',
    'Firefox' => 'https://updates.push.services.mozilla.com/wpush/v2/gAAAAABn',
    'Safari' => 'https://web.push.apple.com/QGcd1sn8',
    'Edge' => 'https://wns2-par02p.notify.windows.com/w/?token=BQYAAAB',
]);

it('refuses keys that are not URL-safe base64 of the right length', function (array $keys, string $field): void {
    subscribe(['keys' => $keys])
        ->assertUnprocessable()
        ->assertJsonValidationErrors([$field]);
})->with([
    'a short p256dh key' => [['p256dh' => Base64Url::encode(random_bytes(33))], 'keys.p256dh'],
    'a p256dh key off the curve' => [['p256dh' => Base64Url::encode("\x04".str_repeat("\x01", 64))], 'keys.p256dh'],
    'a long auth secret' => [['auth' => Base64Url::encode(random_bytes(32))], 'keys.auth'],
    'an auth secret that is not base64' => [['auth' => 'not base64!'], 'keys.auth'],
    'a p256dh key in an array' => [['p256dh' => [KeyPair::generate()->publicKeyAsBase64Url()]], 'keys.p256dh'],
    'an auth secret in an array' => [['auth' => [Base64Url::encode(random_bytes(16))]], 'keys.auth'],
]);

it('stores the keys of the browser as URL-safe base64 without whitespace or padding', function (): void {
    $p256dh = KeyPair::generate()->publicKeyAsBase64Url();
    $auth = Base64Url::encode(random_bytes(16));

    subscribe([
        'keys' => [
            'p256dh' => implode(' ', str_split($p256dh, 8)),
            'auth' => implode("\n", str_split($auth, 8)).'==',
        ],
    ])->assertOk();

    $subscription = PushSubscription::query()->sole();

    expect($subscription->p256dh)
        ->toBe($p256dh)
        ->toHaveLength(87)
        ->and($subscription->auth)
        ->toBe($auth)
        ->toHaveLength(22);
});

it('updates the subscription of an endpoint that subscribes again', function (): void {
    subscribe()->assertOk();

    $again = browserSubscription();

    subscribe($again)->assertOk();

    expect(PushSubscription::query()->sole()->p256dh)->toBe($again['keys']['p256dh']);
});

it('moves the subscription of an endpoint to the user who subscribes with it', function (): void {
    $sophie = User::named('Sophie');

    storePushSubscription($sophie, ['endpoint' => browserSubscription()['endpoint']]);

    subscribe()->assertOk();

    expect(PushSubscription::query()->sole()->belongsToNotifiable($this->user))
        ->toBeTrue()
        ->and($sophie->pushDevices()->count())
        ->toBe(0);
});

it('removes the previous subscription of the browser when it subscribes with another endpoint', function (): void {
    $previous = storePushSubscription($this->user);
    $otherDevice = storePushSubscription($this->user);

    $this->withCredentials()
        ->withCookie(Push::DEVICE_COOKIE, $previous->endpoint_hash);

    subscribe()->assertOk();

    expect($this->user->pushDevices()->pluck('endpoint')->sort()->values()->all())
        ->toBe(collect([$otherDevice->endpoint, browserSubscription()['endpoint']])->sort()->values()->all());
});

it('keeps the newest subscriptions of a user and removes the oldest ones past twenty', function (): void {
    $devices = Collection::times(20, function (): PushSubscription {
        $this->travelTo(now()->addMinute());

        return storePushSubscription($this->user);
    });

    subscribe()->assertOk();

    expect($this->user->pushDevices()->count())
        ->toBe(20)
        ->and($this->user->pushDevices()->whereKey($devices->first()->id)->exists())
        ->toBeFalse()
        ->and($this->user->pushDevices()->where('endpoint', browserSubscription()['endpoint'])->exists())
        ->toBeTrue();
});

it('keeps the subscriptions of other users when a user reaches the most it keeps', function (): void {
    $sophie = User::named('Sophie');
    $hers = storePushSubscription($sophie);

    Collection::times(21, fn (): PushSubscription => storePushSubscription($this->user));

    subscribe()->assertOk();

    expect($sophie->pushDevices()->sole()->is($hers))
        ->toBeTrue()
        ->and($this->user->pushDevices()->count())
        ->toBe(20);
});

it('removes the subscription of the endpoint and forgets the cookie when the browser unsubscribes', function (): void {
    $subscription = storePushSubscription($this->user);
    $other = storePushSubscription($this->user);

    $this->actingAs($this->user)
        ->withCredentials()
        ->withCookie(Push::DEVICE_COOKIE, $subscription->endpoint_hash)
        ->postJson(route('inertia-notifications.push.unsubscribe'), ['endpoint' => $subscription->endpoint])
        ->assertOk()
        ->assertExactJson(['subscribed' => false])
        ->assertCookieExpired(Push::DEVICE_COOKIE);

    expect($this->user->pushDevices()->sole()->is($other))->toBeTrue();
});

it('does not remove the subscription of another user', function (): void {
    $subscription = storePushSubscription(User::named('Sophie'));

    $this->actingAs($this->user)
        ->postJson(route('inertia-notifications.push.unsubscribe'), ['endpoint' => $subscription->endpoint])
        ->assertOk();

    expect(PushSubscription::query()->sole()->is($subscription))->toBeTrue();
});

it('lists the devices of the user, the most recently active first, with this browser marked as current', function (): void {
    $phone = storePushSubscription($this->user, [
        'user_agent' => 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) '
            .'Version/18.6 Mobile/15E148 Safari/604.1',
    ]);
    $this->travel(5)->minutes();
    $laptop = storePushSubscription($this->user);
    $this->travel(5)->minutes();
    $unknown = storePushSubscription($this->user, ['user_agent' => null]);
    storePushSubscription(User::named('Sophie'));

    $this->actingAs($this->user)
        ->withCredentials()
        ->withCookie(Push::DEVICE_COOKIE, $laptop->endpoint_hash)
        ->getJson(route('inertia-notifications.push.devices'))
        ->assertOk()
        ->assertExactJson(['devices' => [
            ['id' => $unknown->id, 'browser' => null, 'platform' => null, 'activeAt' => $unknown->updated_at->toIso8601String(), 'current' => false],
            ['id' => $laptop->id, 'browser' => 'Chrome', 'platform' => 'macOS', 'activeAt' => $laptop->updated_at->toIso8601String(), 'current' => true],
            ['id' => $phone->id, 'browser' => 'Safari', 'platform' => 'iOS', 'activeAt' => $phone->updated_at->toIso8601String(), 'current' => false],
        ]]);
});

it('lists a device that subscribes again as the most recently active one', function (): void {
    subscribe()->assertOk();
    $this->travel(5)->minutes();
    $other = storePushSubscription($this->user);
    $this->travel(5)->minutes();

    subscribe()->assertOk();

    expect($this->actingAs($this->user)->getJson(route('inertia-notifications.push.devices'))->json('devices.*.id'))
        ->toBe([PushSubscription::query()->where('endpoint', browserSubscription()['endpoint'])->sole()->id, $other->id]);
});

it('removes the push subscription of another device of the user', function (): void {
    $phone = storePushSubscription($this->user);
    $laptop = storePushSubscription($this->user);

    $this->actingAs($this->user)
        ->postJson(route('inertia-notifications.push.devices.delete', $phone))
        ->assertOk()
        ->assertExactJson(['removed' => true]);

    expect($this->user->pushDevices()->sole()->is($laptop))->toBeTrue();
});

it('does not bring back a removed device when its page saves the subscription on its own', function (): void {
    subscribe()->assertOk();
    $device = PushSubscription::query()->sole();
    $refresh = fn (): TestResponse => $this->withCredentials()
        ->withCookie(Push::DEVICE_COOKIE, $device->endpoint_hash)
        ->postJson(route('inertia-notifications.push.subscribe'), [...browserSubscription(), 'refresh' => true]);

    $refresh()->assertOk()->assertExactJson(['subscribed' => true]);

    $this->postJson(route('inertia-notifications.push.devices.delete', $device))->assertOk();

    $refresh()
        ->assertOk()
        ->assertExactJson(['subscribed' => false])
        ->assertCookieExpired(Push::DEVICE_COOKIE);

    expect(PushSubscription::query()->count())->toBe(0);

    // Turning push on again is the user's own choice, so it stores the device again.
    subscribe()->assertOk()->assertExactJson(['subscribed' => true]);

    expect(PushSubscription::query()->count())->toBe(1);
});

it('keeps the devices of other users and accepts a device that is already gone', function (): void {
    $hers = storePushSubscription(User::named('Sophie'));

    $this->actingAs($this->user)
        ->postJson(route('inertia-notifications.push.devices.delete', $hers))
        ->assertOk();

    $this->actingAs($this->user)
        ->postJson(route('inertia-notifications.push.devices.delete', $hers->id + 1))
        ->assertOk();

    expect(PushSubscription::query()->sole()->is($hers))->toBeTrue();
});

it('requires a signed-in user to list or remove devices', function (): void {
    $this->getJson(route('inertia-notifications.push.devices'))->assertUnauthorized();
    $this->postJson(route('inertia-notifications.push.devices.delete', 1))->assertUnauthorized();
});

it('serves the service worker without the middleware of the routes, so browsers update it', function (): void {
    $response = $this->get(route('inertia-notifications.push.worker'))
        ->assertOk()
        ->assertHeader('Content-Type', 'text/javascript; charset=utf-8')
        ->assertHeader('Cache-Control', 'no-cache, private');

    expect($response->getContent())->toBe(file_get_contents(__DIR__.'/../resources/push/worker.js'));
});

it('answers the push routes with not found while push is not enabled', function (string $method, string $route, array $parameters = []): void {
    config(['inertia-notifications.push.enabled' => false]);

    $this->actingAs($this->user)
        ->json($method, route($route, $parameters), browserSubscription())
        ->assertNotFound();
})->with([
    'subscribe' => ['POST', 'inertia-notifications.push.subscribe'],
    'unsubscribe' => ['POST', 'inertia-notifications.push.unsubscribe'],
    'devices' => ['GET', 'inertia-notifications.push.devices'],
    'remove a device' => ['POST', 'inertia-notifications.push.devices.delete', [1]],
    'worker' => ['GET', 'inertia-notifications.push.worker'],
]);

it('requires a signed-in user to subscribe', function (): void {
    $this->postJson(route('inertia-notifications.push.subscribe'), browserSubscription())
        ->assertUnauthorized();
});

it('shares nothing about push while it is not enabled', function (): void {
    config(['inertia-notifications.push.enabled' => false]);

    $this->actingAs($this->user)
        ->get('/dashboard', ['X-Inertia' => 'true'])
        ->assertJsonPath('props.inertiauiInbox.push', null);
});

it('shares the public key, the versioned worker, and whether this browser is subscribed', function (): void {
    $hash = hash_file('xxh3', __DIR__.'/../resources/push/worker.js');

    $this->actingAs($this->user)
        ->get('/dashboard', ['X-Inertia' => 'true'])
        ->assertJsonPath('props.inertiauiInbox.push', [
            'publicKey' => $this->keys->publicKeyAsBase64Url(),
            'worker' => "/_inertia-notifications/push/worker.js?v={$hash}",
            'subscribed' => false,
        ]);
});

it('shares that the browser is subscribed once its cookie points to a subscription of the user', function (): void {
    $subscription = storePushSubscription($this->user);

    $this->actingAs($this->user)
        ->withCookie(Push::DEVICE_COOKIE, $subscription->endpoint_hash)
        ->get('/dashboard', ['X-Inertia' => 'true'])
        ->assertJsonPath('props.inertiauiInbox.push.subscribed', true);
});

it('shares that the browser is not subscribed when its subscription belongs to another user', function (): void {
    $subscription = storePushSubscription(User::named('Sophie'));

    $this->actingAs($this->user)
        ->withCookie(Push::DEVICE_COOKIE, $subscription->endpoint_hash)
        ->get('/dashboard', ['X-Inertia' => 'true'])
        ->assertJsonPath('props.inertiauiInbox.push.subscribed', false);
});

it('shares that the browser is subscribed with a previous VAPID key, so its page subscribes it again', function (): void {
    $subscription = storePushSubscription($this->user, [
        'vapid_public_key' => KeyPair::generate()->publicKeyAsBase64Url(),
    ]);

    $this->actingAs($this->user)
        ->withCookie(Push::DEVICE_COOKIE, $subscription->endpoint_hash)
        ->get('/dashboard', ['X-Inertia' => 'true'])
        ->assertJsonPath('props.inertiauiInbox.push.subscribed', true);
});

it('renews the subscription of a previous VAPID key once the browser subscribes with the current one', function (): void {
    $previous = storePushSubscription($this->user, [
        'vapid_public_key' => KeyPair::generate()->publicKeyAsBase64Url(),
    ]);

    $this->withCredentials()
        ->withCookie(Push::DEVICE_COOKIE, $previous->endpoint_hash);

    subscribe()->assertOk();

    expect($this->user->pushDevices()->sole()->vapid_public_key)->toBe($this->keys->publicKeyAsBase64Url());
});

it('fails every page with the command that fixes the VAPID keys while push is enabled', function (array $config, string $message): void {
    config($config);

    $this->withoutExceptionHandling();

    expect(fn () => $this->actingAs($this->user)->get('/dashboard', ['X-Inertia' => 'true']))
        ->toThrow(VapidException::class, $message);
})->with([
    'without keys' => [
        ['inertia-notifications.push.public_key' => null],
        'Run [php artisan inertia-notifications:vapid] to generate them.',
    ],
    'with keys that do not decode' => [
        ['inertia-notifications.push.private_key' => 'not-a-key'],
        'Run [php artisan inertia-notifications:vapid --force] to generate a new pair.',
    ],
    'with keys of two pairs' => [
        ['inertia-notifications.push.private_key' => KeyPair::generate()->privateKeyAsBase64Url()],
        'VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are not one pair.',
    ],
    'with a public key that is not on the curve' => [
        ['inertia-notifications.push.public_key' => Base64Url::encode("\x04".str_repeat("\x01", 64))],
        'VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are not one pair.',
    ],
    'with a private key of zero' => [
        ['inertia-notifications.push.private_key' => Base64Url::encode(str_repeat("\x00", 32))],
        'The VAPID keys are invalid: The private key must be a valid scalar of the P-256 curve.',
    ],
    'without a subject' => [
        ['inertia-notifications.push.subject' => null],
        'Web push needs VAPID_SUBJECT, which is not set.',
    ],
    'with a subject that is no URL' => [
        ['inertia-notifications.push.subject' => 'support@acme.test'],
        'The VAPID subject [support@acme.test] must be a mailto: address or an https:// URL',
    ],
]);

it('adds a push channel to the preferences while push is enabled', function (): void {
    $this->actingAs($this->user)
        ->getJson(route('inertia-notifications.preferences'))
        ->assertJsonPath('channels.2', [
            'key' => 'push',
            'label' => 'Push',
            'globalSwitch' => true,
            'enabled' => true,
            'digest' => false,
            'inbox' => false,
            'push' => true,
        ]);
});

it('adds no push channel while push is not enabled', function (): void {
    config(['inertia-notifications.push.enabled' => false]);

    $this->actingAs($this->user)
        ->getJson(route('inertia-notifications.preferences'))
        ->assertJsonCount(2, 'channels');
});

it('adds no push channel when a channel of the config covers push', function (): void {
    config(['inertia-notifications.preferences.channels.inbox.via' => ['inbox', 'database', 'broadcast', 'push']]);

    $this->actingAs($this->user)
        ->getJson(route('inertia-notifications.preferences'))
        ->assertJsonCount(2, 'channels')
        ->assertJsonPath('channels.0.push', true)
        ->assertJsonPath('channels.1.push', false);
});

it('removes the subscription of the browser when its user signs out', function (): void {
    $subscription = storePushSubscription($this->user);
    $other = storePushSubscription($this->user);

    $this->actingAs($this->user)
        ->withCookie(Push::DEVICE_COOKIE, $subscription->endpoint_hash)
        ->post('/logout')
        ->assertOk()
        ->assertCookieExpired(Push::DEVICE_COOKIE);

    expect($this->user->pushDevices()->sole()->is($other))->toBeTrue();
});

it('removes the subscription of the browser when another user signs in on it', function (): void {
    $sophie = User::named('Sophie');
    $subscription = storePushSubscription($sophie);

    $this->withCookie(Push::DEVICE_COOKIE, $subscription->endpoint_hash)
        ->post("/login/{$this->user->id}")
        ->assertOk()
        ->assertCookieExpired(Push::DEVICE_COOKIE);

    expect($sophie->pushDevices()->exists())->toBeFalse();
});

it('keeps the subscription of the browser when its own user signs in again', function (): void {
    $subscription = storePushSubscription($this->user);

    $this->withCookie(Push::DEVICE_COOKIE, $subscription->endpoint_hash)
        ->post("/login/{$this->user->id}")
        ->assertOk()
        ->assertCookieMissing(Push::DEVICE_COOKIE);

    expect(PushSubscription::query()->sole()->is($subscription))->toBeTrue();
});
