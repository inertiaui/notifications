<?php

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use InertiaUI\Notifications\Inbox;
use InertiaUI\Notifications\Models\PushSubscription;
use InertiaUI\Notifications\Tests\Fixtures\InvoicePaid;
use InertiaUI\Notifications\Tests\Fixtures\User;
use InertiaUI\Notifications\WebPush\Base64Url;
use InertiaUI\Notifications\WebPush\KeyPair;
use InertiaUI\Notifications\WebPush\PushPayload;
use InertiaUI\Notifications\WebPush\PushSender;

beforeEach(function (): void {
    $this->travelTo(Carbon::parse('2026-11-18 10:00:00', 'UTC'));
    $this->keys = enablePush();
    $this->user = User::named('Pascal');
    $this->browser = KeyPair::generate();
    $this->authSecret = random_bytes(16);
});

/**
 * Store a subscription of the user whose browser holds the test's key pair and auth secret.
 *
 * @param  array<string, mixed>  $attributes
 */
function browserDevice(string $endpoint, array $attributes = []): PushSubscription
{
    return storePushSubscription(test()->user, [
        'endpoint' => $endpoint,
        'p256dh' => test()->browser->publicKeyAsBase64Url(),
        'auth' => Base64Url::encode(test()->authSecret),
        ...$attributes,
    ]);
}

/**
 * Make the push that the tests send.
 */
function testPush(): PushPayload
{
    return new PushPayload(
        id: '9d3c1b6e-0b7a-4c1e-9a64-5f0d2a8e1c47',
        title: 'Invoice INV-7 paid',
        body: 'Paid by card.',
        navigate: 'https://acme.test/invoices/7',
        tag: 'inertiaui-inbox-9d3c1b6e-0b7a-4c1e-9a64-5f0d2a8e1c47',
    );
}

it('sends the push encrypted for the browser, with the headers that push services require', function (): void {
    Http::fake(['*' => Http::response('', 201)]);

    $device = browserDevice('https://fcm.googleapis.com/fcm/send/dXJ1:APA91bH');

    $results = app(PushSender::class)->send([$device], testPush());

    [$request] = Http::recorded()->sole();

    expect($results)
        ->toHaveCount(1)
        ->and($results[0]->delivered())
        ->toBeTrue()
        ->and($results[0]->status)
        ->toBe(201)
        ->and($request->method())
        ->toBe('POST')
        ->and($request->url())
        ->toBe('https://fcm.googleapis.com/fcm/send/dXJ1:APA91bH')
        ->and($request->header('Content-Encoding'))
        ->toBe(['aes128gcm'])
        ->and($request->header('Content-Type'))
        ->toBe(['application/octet-stream'])
        ->and($request->header('TTL'))
        ->toBe(['86400'])
        ->and($request->header('Urgency'))
        ->toBe(['normal'])
        ->and($request->header('Topic'))
        ->toBe([testPush()->topic()])
        ->and(decryptPush($request->body(), $this->browser, $this->authSecret))
        ->toBe(testPush()->toJson()."\x02");
});

it('signs the VAPID token for the origin of each endpoint with the keys of the config', function (): void {
    Http::fake(['*' => Http::response('', 201)]);

    browserDevice('https://web.push.apple.com/QGcd1sn8');

    app(PushSender::class)->send(PushSubscription::query()->get(), testPush());

    [$request] = Http::recorded()->sole();

    expect(verifiedVapidClaims($request->header('Authorization')[0], $this->keys))->toBe([
        'aud' => 'https://web.push.apple.com',
        'exp' => now()->addHours(12)->getTimestamp(),
        'sub' => 'mailto:support@acme.test',
    ]);
});

it('sends to every device at once, each encrypted for its own browser', function (): void {
    Http::fake(['*' => Http::response('', 201)]);

    $chrome = browserDevice('https://fcm.googleapis.com/fcm/send/chrome');
    $firefox = storePushSubscription($this->user, ['endpoint' => 'https://updates.push.services.mozilla.com/wpush/v2/ff']);

    $results = app(PushSender::class)->send([$chrome, $firefox], testPush());

    $bodies = Http::recorded()->mapWithKeys(fn (array $pair): array => [$pair[0]->url() => $pair[0]->body()]);

    expect(collect($results)->map->delivered()->all())
        ->toBe([true, true])
        ->and($bodies->keys()->sort()->values()->all())
        ->toBe([$chrome->endpoint, $firefox->endpoint])
        ->and(decryptPush($bodies[$chrome->endpoint], $this->browser, $this->authSecret))
        ->not->toBeFalse()
        ->and(decryptPush($bodies[$firefox->endpoint], $this->browser, $this->authSecret))
        ->toBeFalse();
});

it('removes the subscription that its push service no longer knows', function (int $status): void {
    Http::fake([
        'fcm.googleapis.com/*' => Http::response('push subscription has unsubscribed or expired.', $status),
        '*' => Http::response('', 201),
    ]);

    $gone = browserDevice('https://fcm.googleapis.com/fcm/send/gone');
    $kept = browserDevice('https://web.push.apple.com/QGcd1sn8');

    $results = app(PushSender::class)->send([$gone, $kept], testPush());

    expect(PushSubscription::query()->sole()->is($kept))
        ->toBeTrue()
        ->and($results[0]->removed)
        ->toBeTrue()
        ->and($results[0]->status)
        ->toBe($status)
        ->and($results[0]->reason)
        ->toBe('push subscription has unsubscribed or expired.')
        ->and($results[1]->removed)
        ->toBeFalse();
})->with([404, 410]);

it('keeps the subscription and logs the answer of a push service that refuses the push for another reason', function (): void {
    Log::spy();
    Http::fake(['*' => Http::response(['reason' => 'BadJwtToken'], 403)]);

    $device = browserDevice('https://web.push.apple.com/QGcd1sn8');

    $results = app(PushSender::class)->send([$device], testPush());

    expect($device->exists)
        ->toBeTrue()
        ->and(PushSubscription::query()->count())
        ->toBe(1)
        ->and($results[0]->status)
        ->toBe(403)
        ->and($results[0]->reason)
        ->toBe('BadJwtToken')
        ->and($results[0]->removed)
        ->toBeFalse();

    Log::shouldHaveReceived('warning')
        ->with(
            'The push service [web.push.apple.com] refused a push with status [403].',
            ['subscription' => $device->id, 'status' => 403, 'body' => '{"reason":"BadJwtToken"}'],
        )
        ->once();
});

it('logs a push service that could not be reached', function (): void {
    Log::spy();
    Http::fake(['*' => Http::failedConnection('cURL error 6: Could not resolve host')]);

    $device = browserDevice('https://fcm.googleapis.com/fcm/send/dXJ1');

    $results = app(PushSender::class)->send([$device], testPush());

    expect($results[0]->status)
        ->toBeNull()
        ->and($results[0]->delivered())
        ->toBeFalse()
        ->and($results[0]->reason)
        ->toContain('Could not resolve host')
        ->and(PushSubscription::query()->count())
        ->toBe(1);

    Log::shouldHaveReceived('warning')
        ->withArgs(fn (string $message): bool => $message === 'The push service [fcm.googleapis.com] could not be reached.')
        ->once();
});

it('removes an expired subscription without sending to it', function (): void {
    Http::fake();

    $device = browserDevice('https://fcm.googleapis.com/fcm/send/old', ['expires_at' => now()->subMinute()]);

    $results = app(PushSender::class)->send([$device], testPush());

    Http::assertNothingSent();

    expect(PushSubscription::query()->count())
        ->toBe(0)
        ->and($results[0]->reason)
        ->toBe('The subscription expired.')
        ->and($results[0]->removed)
        ->toBeTrue();
});

it('skips a subscription made with another VAPID key, which push services refuse, and keeps it', function (): void {
    Http::fake();

    $device = browserDevice('https://fcm.googleapis.com/fcm/send/old', [
        'vapid_public_key' => KeyPair::generate()->publicKeyAsBase64Url(),
    ]);

    $results = app(PushSender::class)->send([$device], testPush());

    Http::assertNothingSent();

    expect(PushSubscription::query()->count())
        ->toBe(1)
        ->and($results[0]->reason)
        ->toBe('The browser subscribed with another VAPID public key.');
});

it('skips a subscription whose push service left the hosts config, and keeps it', function (): void {
    Http::fake(['*' => Http::response('', 201)]);

    $unlisted = browserDevice('https://fcm.googleapis.com/fcm/send/old');
    $listed = browserDevice('https://web.push.apple.com/QGuQyavXutnMH');

    config(['inertia-notifications.push.hosts' => ['*.push.apple.com']]);

    $results = app(PushSender::class)->send([$unlisted, $listed], testPush());

    [$request] = Http::recorded()->sole();

    expect($request->url())
        ->toBe('https://web.push.apple.com/QGuQyavXutnMH')
        ->and(PushSubscription::query()->count())
        ->toBe(2)
        ->and($results[0]->reason)
        ->toBe('The push service [fcm.googleapis.com] is not in the [inertia-notifications.push.hosts] config.')
        ->and($results[1]->delivered())
        ->toBeTrue();
});

it('sends the push of the stored notification through the queued job', function (): void {
    registerNotificationRoutes();
    Http::fake(['*' => Http::response('', 201)]);

    browserDevice('https://fcm.googleapis.com/fcm/send/dXJ1');

    $this->user->notify(new InvoicePaid(push: true));

    $stored = Inbox::query($this->user)->sole();

    [$request] = Http::recorded()->sole();

    $payload = json_decode(substr((string) decryptPush($request->body(), $this->browser, $this->authSecret), 0, -1), true);

    expect($payload['notification'])->toMatchArray([
        'title' => 'Invoice INV-7 paid',
        'navigate' => "http://localhost/_inertia-notifications/{$stored->id}/open",
        'tag' => "inertiaui-inbox-{$stored->id}",
    ]);
});
