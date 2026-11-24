<?php

use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use InertiaUI\Notifications\WebPush\Base64Url;
use InertiaUI\Notifications\WebPush\KeyPair;
use InertiaUI\Notifications\WebPush\PayloadEncrypter;
use InertiaUI\Notifications\WebPush\Vapid;

it('encrypts the example of RFC 8291 to the same message', function (): void {
    $encrypter = new PayloadEncrypter(
        KeyPair::fromBase64Url(
            'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
            'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
        ),
        Base64Url::decode('DGv6ra1nlYgDCS1FRnbzlw'),
    );

    $message = $encrypter->encrypt(
        'When I grow up, I want to be a watermelon',
        Base64Url::decode('BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4'),
        Base64Url::decode('BTBZMqHH6r4Tts7J_aSIgg'),
    );

    expect(Base64Url::encode($message))->toBe(
        'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_'
        .'yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
    );
});

it('encrypts a message that the browser decrypts with its own key pair', function (): void {
    $browser = KeyPair::generate();
    $authSecret = random_bytes(16);
    $message = PayloadEncrypter::make()->encrypt('{"title":"Invoice paid"}', $browser->publicKey, $authSecret);

    $plaintext = decryptPush($message, $browser, $authSecret);

    expect(unpack('N', substr($message, 16, 4))[1])
        ->toBe(4096)
        ->and(ord($message[20]))
        ->toBe(65)
        ->and($plaintext)
        ->toBe("{\"title\":\"Invoice paid\"}\x02");
});

it('gives each message its own key pair and salt', function (): void {
    $browser = KeyPair::generate();
    $authSecret = random_bytes(16);

    $first = PayloadEncrypter::make()->encrypt('Hello', $browser->publicKey, $authSecret);
    $second = PayloadEncrypter::make()->encrypt('Hello', $browser->publicKey, $authSecret);

    expect(substr($first, 0, 86))->not->toBe(substr($second, 0, 86));
});

it('rejects a payload that push services do not accept, and invalid keys and secrets', function (Closure $encrypt, string $message): void {
    expect($encrypt)->toThrow(InvalidArgumentException::class, $message);
})->with([
    'a payload over 3993 bytes' => [
        fn () => PayloadEncrypter::make()->encrypt(str_repeat('a', 3994), KeyPair::generate()->publicKey, random_bytes(16)),
        'The push payload must be at most 3993 bytes, [3994] given.',
    ],
    'an auth secret of 15 bytes' => [
        fn () => PayloadEncrypter::make()->encrypt('Hello', KeyPair::generate()->publicKey, random_bytes(15)),
        'The auth secret must be 16 bytes, [15] given.',
    ],
    'a compressed public key' => [
        fn () => PayloadEncrypter::make()->encrypt('Hello', "\x03".random_bytes(32), random_bytes(16)),
        'The public key must be an uncompressed point of 65 bytes, [33] bytes given.',
    ],
    'an uncompressed public key with another first byte' => [
        fn () => PayloadEncrypter::make()->encrypt('Hello', "\x03".random_bytes(64), random_bytes(16)),
        'The public key must be an uncompressed point that starts with 0x04, [0x03] given.',
    ],
    'a public key that is not on the curve' => [
        fn () => PayloadEncrypter::make()->encrypt('Hello', "\x04".str_repeat("\x01", 64), random_bytes(16)),
        'The public key must be a point on the P-256 curve.',
    ],
]);

it('accepts a payload of exactly 3993 bytes, which fills one record of 4096 bytes', function (): void {
    $message = PayloadEncrypter::make()->encrypt(str_repeat('a', 3993), KeyPair::generate()->publicKey, random_bytes(16));

    expect(strlen($message))
        ->toBe(86 + 3993 + 1 + 16)
        ->and(strlen($message) - 86)
        ->toBeLessThanOrEqual(4096);
});

it('signs a VAPID token for the origin of the endpoint, which verifies with the public key', function (): void {
    $keys = KeyPair::generate();
    $expiresAt = Carbon::parse('2026-11-18 20:00:00', 'UTC');

    $authorization = (new Vapid($keys, 'mailto:support@acme.test'))
        ->authorization('https://updates.push.services.mozilla.com:8443/wpush/v2/gAAAAA?x=1', $expiresAt);

    [$header, , $signature] = explode('.', substr($authorization, 8, strpos($authorization, ',') - 8));

    expect(verifiedVapidClaims($authorization, $keys))
        ->toBe([
            'aud' => 'https://updates.push.services.mozilla.com:8443',
            'exp' => $expiresAt->getTimestamp(),
            'sub' => 'mailto:support@acme.test',
        ])
        ->and(json_decode(Base64Url::decode($header), true))
        ->toBe(['typ' => 'JWT', 'alg' => 'ES256'])
        ->and(strlen(Base64Url::decode($signature)))
        ->toBe(64);
});

it('pads the integers of a DER signature to 32 bytes and drops their sign bytes', function (): void {
    $r = "\x00\xFF".str_repeat("\x11", 31);
    $s = str_repeat("\x22", 30);
    $der = "\x30".chr(2 + 33 + 2 + 30)."\x02\x21".$r."\x02\x1E".$s;

    expect(Vapid::rawSignature($der))->toBe("\xFF".str_repeat("\x11", 31)."\x00\x00".$s);
});

it('rejects an endpoint that is not https', function (): void {
    $vapid = new Vapid(KeyPair::generate(), 'https://acme.test');

    expect(fn () => $vapid->authorization('http://push.example.net/1', now()))->toThrow(
        InvalidArgumentException::class,
        'The push endpoint [http://push.example.net/1] must be an https:// URL.',
    );
});

it('determines that the keys of the example of RFC 8291 form one pair', function (): void {
    $keys = KeyPair::fromBase64Url(
        'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
        'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
    );

    expect($keys->belongTogether())->toBeTrue();
});

it('determines that a public key of another pair or off the curve does not belong to the private key', function (string $publicKey): void {
    $keys = new KeyPair($publicKey, KeyPair::generate()->privateKey);

    expect($keys->belongTogether())->toBeFalse();
})->with([
    'another pair' => [KeyPair::generate()->publicKey],
    'not on the curve' => ["\x04".str_repeat("\x01", 64)],
]);

it('refuses a private key of zero, which has no public key', function (): void {
    $keys = new KeyPair(KeyPair::generate()->publicKey, str_repeat("\x00", 32));

    expect(fn () => $keys->belongTogether())
        ->toThrow(RuntimeException::class, 'The private key must be a valid scalar of the P-256 curve.');
});

it('keeps the leading zero bytes of generated keys, so every key has its full length', function (): void {
    // About one key in 85 has a coordinate or a scalar that starts with a zero byte, so we will generate
    // enough keys that this test reaches the padding in all but about one run in a thousand.
    Collection::times(600, function (): void {
        $keys = KeyPair::generate();

        expect(strlen($keys->publicKey))
            ->toBe(65)
            ->and(strlen($keys->privateKey))
            ->toBe(32)
            ->and(KeyPair::fromBase64Url($keys->publicKeyAsBase64Url(), $keys->privateKeyAsBase64Url()))
            ->toEqual($keys);
    });
});
