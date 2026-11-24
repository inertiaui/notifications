<?php

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schema;
use InertiaUI\Notifications\Push;
use InertiaUI\Notifications\Tests\Fixtures\User;
use InertiaUI\Notifications\WebPush\Base64Url;
use InertiaUI\Notifications\WebPush\KeyPair;
use InertiaUI\Notifications\WebPush\VapidException;

/**
 * Run the check-push command, and get its exit code and its output, with each fix on one line.
 *
 * @return array{0: int, 1: string}
 */
function checkPush(): array
{
    $status = Artisan::call('inertia-notifications:check-push');

    // The fixes are wrapped to the width of the terminal, so we will join their lines again.
    return [$status, preg_replace('/\n {4}(?=\S)/', ' ', Artisan::output())];
}

it('passes every check of a complete setup', function (): void {
    $keys = enablePush();

    registerNotificationRoutes();
    config(['queue.default' => 'database']);

    [$status, $output] = checkPush();

    $publicKey = $keys->publicKeyAsBase64Url();

    expect($status)
        ->toBe(0)
        ->and($output)
        ->toMatch('/Push enabled \.+ OK/')
        ->toMatch('/VAPID keys \.+ '.preg_quote(substr($publicKey, 0, 8).'…'.substr($publicKey, -4), '/').' \(one P-256 pair\) OK/')
        ->toMatch('/VAPID subject \.+ mailto:support@acme\.test OK/')
        ->toMatch('/Application URL \.+ http:\/\/localhost \(browsers allow push on localhost\) OK/')
        ->toMatch('/Subscriptions table \.+ push_subscriptions OK/')
        ->toMatch('/Routes \.+ \/_inertia-notifications\/push\/worker\.js OK/')
        ->toMatch('/Queue \.+ the \[database\] connection, run by \[php artisan queue:work\] OK/')
        ->toContain('No browser has subscribed yet.')
        ->toContain('Web push is ready.')
        ->not->toContain('FAIL')
        ->not->toContain('WARN');
});

it('fails each check of a missing setup, with its fix', function (): void {
    config(['app.url' => 'http://acme.test']);

    Schema::drop('push_subscriptions');

    [$status, $output] = checkPush();

    expect($status)
        ->toBe(1)
        ->and($output)
        ->toMatch('/Push enabled \.+ FAIL/')
        ->toContain("Set ['enabled' => true] in the 'push' section of")
        ->toMatch('/VAPID keys \.+ FAIL/')
        ->toContain('VAPID_PRIVATE_KEY, which are not set. Run [php artisan inertia-notifications:vapid] to generate them.')
        ->toMatch('/VAPID subject \.+ FAIL/')
        ->toContain('Web push needs VAPID_SUBJECT, which is not set.')
        ->toMatch('/Application URL \.+ FAIL/')
        ->toContain('Browsers only offer push on https:// pages and on localhost')
        ->toMatch('/Subscriptions table \.+ FAIL/')
        ->toContain('[php artisan vendor:publish --tag=inertia-notifications-migrations]')
        ->toMatch('/Routes \.+ FAIL/')
        ->toContain('Register the routes with [Route::inertiaNotifications()] in routes/web.php.')
        ->toContain('Web push is not ready: 6 of the checks failed.')
        ->not->toContain('Subscriptions  ');
});

it('fails keys that do not decode or do not form one pair', function (array $keys, string $message): void {
    enablePush();
    registerNotificationRoutes();

    config($keys);

    [$status, $output] = checkPush();

    expect($status)
        ->toBe(1)
        ->and($output)
        ->toMatch('/VAPID keys \.+ FAIL/')
        ->toContain($message)
        ->toContain('Web push is not ready: 1 of the checks failed.');
})->with([
    'a private key of another pair' => [
        ['inertia-notifications.push.private_key' => KeyPair::generate()->privateKeyAsBase64Url()],
        'VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are not one pair.',
    ],
    'a public key that is not on the curve' => [
        ['inertia-notifications.push.public_key' => Base64Url::encode("\x04".str_repeat("\x01", 64))],
        'VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are not one pair.',
    ],
    'a private key of zero' => [
        ['inertia-notifications.push.private_key' => Base64Url::encode(str_repeat("\x00", 32))],
        'The VAPID keys are invalid: The private key must be a valid scalar of the P-256 curve.',
    ],
    'a private key of 31 bytes' => [
        ['inertia-notifications.push.private_key' => 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'],
        'The private key must be 32 bytes, [31] given.',
    ],
    'a private key that is not base64' => [
        ['inertia-notifications.push.private_key' => 'not a key!'],
        'must be URL-safe base64.',
    ],
]);

it('leaves a private key that does not decode out of its error', function (): void {
    enablePush();
    registerNotificationRoutes();

    // A malformed key is usually the real key with one bad character, so its error must not repeat the key.
    config(['inertia-notifications.push.private_key' => 'SyntheticMarker'.str_repeat('A', 27).'!']);

    expect(fn () => Push::keys())->toThrow(function (VapidException $exception): void {
        expect($exception->getMessage())
            ->toContain('must be URL-safe base64.')
            ->not->toContain('SyntheticMarker');
    });

    [$status, $output] = checkPush();

    expect($status)
        ->toBe(1)
        ->and($output)
        ->toMatch('/VAPID keys \.+ FAIL/')
        ->not->toContain('SyntheticMarker');
});

it('warns about a subject that Apple refuses, without failing', function (string $subject): void {
    enablePush();
    registerNotificationRoutes();

    config(['inertia-notifications.push.subject' => $subject]);

    [$status, $output] = checkPush();

    expect($status)
        ->toBe(0)
        ->and($output)
        ->toMatch('/VAPID subject \.+ '.preg_quote($subject, '/').' WARN/')
        ->toContain('Apple refuses the pushes of a subject on localhost or example.com');
})->with(['mailto:hello@example.com', 'https://localhost', 'mailto:push@mail.example.org']);

it('warns about a subject that is not a valid address or URL, without failing', function (string $subject): void {
    enablePush();
    registerNotificationRoutes();

    config(['inertia-notifications.push.subject' => $subject]);

    [$status, $output] = checkPush();

    expect($status)
        ->toBe(0)
        ->and($output)
        ->toMatch('/VAPID subject \.+ '.preg_quote($subject, '/').' WARN/')
        ->toContain('Set VAPID_SUBJECT to a valid address or URL')
        ->not->toContain('--force');
})->with(['mailto:support', 'https://']);

it('warns about a queue connection that sends the pushes during the request', function (): void {
    enablePush();
    registerNotificationRoutes();

    config(['queue.default' => 'sync']);

    [$status, $output] = checkPush();

    expect($status)
        ->toBe(0)
        ->and($output)
        ->toMatch('/Queue \.+ sync WARN/')
        ->toContain('The [sync] connection sends each push during the request');
});

it('checks the queue connection of the push config instead of the default connection', function (): void {
    enablePush();
    registerNotificationRoutes();

    config([
        'queue.default' => 'sync',
        'inertia-notifications.push.connection' => 'redis',
    ]);

    expect(checkPush()[1])->toMatch('/Queue \.+ the \[redis\] connection, run by/');
});

it('fails a queue connection that is not configured or that discards every job', function (array $config, string $fix): void {
    enablePush();
    registerNotificationRoutes();

    config($config);

    [$status, $output] = checkPush();

    expect($status)
        ->toBe(1)
        ->and($output)
        ->toMatch('/Queue \.+ FAIL/')
        ->toContain($fix)
        ->toContain('Web push is not ready: 1 of the checks failed.');
})->with([
    'a connection that is not configured' => [
        ['inertia-notifications.push.connection' => 'pushes'],
        'The [pushes] connection is not in config/queue.php',
    ],
    'a connection on the null driver' => [
        ['queue.connections.discard' => ['driver' => 'null'], 'queue.default' => 'discard'],
        'The [discard] connection uses the [null] driver, which discards every job',
    ],
]);

it('passes an https:// application URL', function (): void {
    enablePush();
    registerNotificationRoutes();

    config(['app.url' => 'https://acme.test']);

    expect(checkPush()[1])->toMatch('/Application URL \.+ https:\/\/acme\.test OK/');
});

it('counts the subscriptions of each push service by its host in the config, and those of another key', function (): void {
    enablePush();
    registerNotificationRoutes();

    $user = User::named('Pascal');

    storePushSubscription($user);
    storePushSubscription($user, ['vapid_public_key' => KeyPair::generate()->publicKeyAsBase64Url()]);
    storePushSubscription($user, ['endpoint' => 'https://web.push.apple.com/QGcd1sn8']);
    storePushSubscription($user, ['endpoint' => 'https://wns2-par02p.notify.windows.com/w/?token=BQYAAAB']);
    storePushSubscription($user, ['endpoint' => 'https://wns2-bl2p.notify.windows.com/w/?token=AgYAAAA']);

    [$status, $output] = checkPush();

    expect($status)
        ->toBe(0)
        ->and($output)
        ->toMatch('/fcm\.googleapis\.com \.+ 2/')
        ->toMatch('/\*\.push\.apple\.com \.+ 1/')
        ->toMatch('/\*\.notify\.windows\.com \.+ 2/')
        ->toContain('1 of them subscribed with another VAPID public key')
        ->not->toContain('No browser has subscribed yet.');
});
