<?php

use InertiaUI\Notifications\WebPush\Base64Url;
use InertiaUI\Notifications\WebPush\KeyPair;
use InertiaUI\Notifications\WebPush\PayloadEncrypter;
use InertiaUI\Notifications\WebPush\PushPayload;

/**
 * Make a push payload with the given title and body.
 */
function pushPayload(string $title, ?string $body, ?string $icon = null, ?string $context = null): PushPayload
{
    return new PushPayload(
        id: '9d3c1b6e-0b7a-4c1e-9a64-5f0d2a8e1c47',
        title: $title,
        body: $body,
        navigate: 'https://acme.test/_inertia-notifications/9d3c1b6e-0b7a-4c1e-9a64-5f0d2a8e1c47/open',
        tag: 'inertiaui-inbox-9d3c1b6e-0b7a-4c1e-9a64-5f0d2a8e1c47',
        icon: $icon,
        lang: 'en',
        timestamp: 1794938400000,
        context: $context,
    );
}

it('encodes the notification in the Declarative Web Push format', function (): void {
    $json = pushPayload(
        'Invoice INV-7 paid',
        'Paid by card.',
        icon: 'https://acme.test/avatars/sophie.png',
        context: '5e2800deb8d23927533bbbae89e7b58b',
    )->toJson();

    // The tests of the service worker read the same fixture. We will encode it again without the indentation
    // and compare the strings, so the order, the type, and the escaping of every value must match too.
    $fixture = jsonFixture('push.json');

    expect($json)->toBe(json_encode($fixture, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
});

it('leaves out the body, the icon, and the context that the notification does not have', function (): void {
    $notification = json_decode(pushPayload('Renew the domain', null)->toJson(), true)['notification'];

    expect($notification)
        ->not->toHaveKey('body')
        ->not->toHaveKey('icon')
        ->toHaveKey('title', 'Renew the domain')
        ->toHaveKey('data', ['id' => '9d3c1b6e-0b7a-4c1e-9a64-5f0d2a8e1c47']);
});

it('shortens the body until the payload fits in one push message', function (): void {
    $json = pushPayload('Invoice INV-7 paid', str_repeat('Paid by card. ', 400))->toJson();
    $notification = json_decode($json, true)['notification'];

    expect(strlen($json))
        ->toBeLessThanOrEqual(PayloadEncrypter::MAX_PAYLOAD_LENGTH)
        ->toBeGreaterThan(PayloadEncrypter::MAX_PAYLOAD_LENGTH - 20)
        ->and($notification['title'])
        ->toBe('Invoice INV-7 paid')
        ->and($notification['body'])
        ->toStartWith('Paid by card. Paid by card.')
        ->toEndWith('card.…');

    PayloadEncrypter::make()->encrypt($json, KeyPair::generate()->publicKey, random_bytes(16));
});

it('shortens the title once the body is gone', function (): void {
    $json = pushPayload(str_repeat('Invoice paid ', 400), 'Paid by card.')->toJson();
    $notification = json_decode($json, true)['notification'];

    expect(strlen($json))
        ->toBeLessThanOrEqual(PayloadEncrypter::MAX_PAYLOAD_LENGTH)
        ->and($notification)
        ->not->toHaveKey('body')
        ->and($notification['title'])
        ->toStartWith('Invoice paid Invoice paid')
        ->toEndWith('…');
});

it('keeps a payload that fits as it is', function (): void {
    $body = str_repeat('a', 3600);

    $notification = json_decode(pushPayload('Invoice INV-7 paid', $body)->toJson(), true)['notification'];

    expect($notification['body'])->toBe($body);
});

it('cuts a body of multibyte characters at a character boundary', function (): void {
    $json = pushPayload('Factuur betaald', str_repeat('€ü', 2000))->toJson();

    expect(strlen($json))
        ->toBeLessThanOrEqual(PayloadEncrypter::MAX_PAYLOAD_LENGTH)
        ->and(mb_check_encoding($json, 'UTF-8'))
        ->toBeTrue()
        ->and(json_decode($json, true)['notification']['body'])
        ->toEndWith('…');
});

it('counts the escaped characters of the JSON against the limit', function (): void {
    $json = pushPayload('Quotes', str_repeat('"', 3000))->toJson();

    expect(strlen($json))->toBeLessThanOrEqual(PayloadEncrypter::MAX_PAYLOAD_LENGTH);
});

it('gives each notification a topic of 22 URL-safe characters', function (): void {
    $topic = pushPayload('Invoice INV-7 paid', null)->topic();

    expect($topic)
        ->toBe(Base64Url::encode(md5('9d3c1b6e-0b7a-4c1e-9a64-5f0d2a8e1c47', true)))
        ->toMatch('/^[A-Za-z0-9_-]{22}$/');
});
