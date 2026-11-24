<?php

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use InertiaUI\Notifications\Models\PushSubscription;
use InertiaUI\Notifications\Tests\Fixtures\User;
use InertiaUI\Notifications\WebPush\KeyPair;

beforeEach(function (): void {
    enablePush();

    $this->user = User::named('Pascal');
});

afterEach(function (): void {
    File::delete(config_path('inertia-notifications.php'));
});

/**
 * Run the test-push command for the given user, and get its exit code and its output.
 *
 * @return array{0: int, 1: string}
 */
function testPushCommand(string $user): array
{
    $status = Artisan::call('inertia-notifications:test-push', ['user' => $user, '--model' => User::class]);

    return [$status, Artisan::output()];
}

it('sends a test push to every device of the user right away, and shows how each push service answered', function (): void {
    Http::fake(['*' => Http::response('', 201)]);

    $this->freezeTime();

    storePushSubscription($this->user, ['created_at' => now()->subDays(3)]);
    storePushSubscription($this->user, [
        'endpoint' => 'https://web.push.apple.com/QGcd1sn8',
        'created_at' => now()->subMinutes(5),
    ]);

    [$status, $output] = testPushCommand((string) $this->user->id);

    expect($status)
        ->toBe(0)
        ->and(Http::recorded())
        ->toHaveCount(2)
        ->and($output)
        ->toMatch('/Push service\s+\|\s+Subscribed\s+\|\s+Result/')
        ->toMatch('/fcm\.googleapis\.com\s+\|\s+3 days ago\s+\|\s+201 Accepted/')
        ->toMatch('/web\.push\.apple\.com\s+\|\s+5 minutes ago\s+\|\s+201 Accepted/')
        ->toContain('Every device accepted the test push.')
        ->not->toContain('#troubleshooting');
});

it('shows the answer of a push service that refused the push, and links to the troubleshooting docs', function (string $endpoint, int $status, mixed $body, string $result): void {
    Http::fake(['*' => Http::response($body, $status)]);

    storePushSubscription($this->user, ['endpoint' => $endpoint]);

    [$exitCode, $output] = testPushCommand((string) $this->user->id);

    expect($exitCode)
        ->toBe(1)
        ->and($output)
        ->toContain($result)
        ->toContain('0 of the 1 devices accepted the test push.')
        ->toContain('See the cause and fix of each failure: '
            .'https://inertiaui.com/inertia-notifications/docs/notification-center/web-push#troubleshooting');
})->with([
    'Apple refusing the token' => [
        'https://web.push.apple.com/QGcd1sn8', 403, ['reason' => 'BadJwtToken'], '403 BadJwtToken',
    ],
    'Google refusing the token' => [
        'https://fcm.googleapis.com/fcm/send/abc', 403, 'the key in the authorization header does not correspond',
        '403 the key in the authorization header does not correspond',
    ],
    'Google refusing the credentials' => [
        'https://fcm.googleapis.com/fcm/send/abc', 401, '', '401 Unauthorized',
    ],
    'a removed subscription' => [
        'https://updates.push.services.mozilla.com/wpush/v2/gAAA', 410, ['message' => 'Subscription has expired'],
        '410 Subscription has expired (removed)',
    ],
    'a push that is too large' => [
        'https://fcm.googleapis.com/fcm/send/abc', 413, '', '413 Request Entity Too Large',
    ],
]);

it('skips a device that subscribed with a previous VAPID key', function (): void {
    Http::fake();

    storePushSubscription($this->user, ['vapid_public_key' => KeyPair::generate()->publicKeyAsBase64Url()]);

    [$status, $output] = testPushCommand((string) $this->user->id);

    Http::assertNothingSent();

    expect($status)
        ->toBe(1)
        ->and($output)
        ->toContain('Not sent: The browser subscribed with another VAPID public key.');
});

it('removes a device whose subscription expired without sending', function (): void {
    Http::fake();

    storePushSubscription($this->user, ['expires_at' => now()->subMinute()]);

    [$status, $output] = testPushCommand((string) $this->user->id);

    Http::assertNothingSent();

    expect($status)
        ->toBe(1)
        ->and(PushSubscription::query()->count())
        ->toBe(0)
        ->and($output)
        ->toContain('Not sent: The subscription expired. (removed)');
});

it('shows that the server could not reach a push service', function (): void {
    Http::fake(['*' => Http::failedConnection('cURL error 6: Could not resolve host')]);

    storePushSubscription($this->user, ['endpoint' => 'https://web.push.apple.com/QGcd1sn8']);

    [$status, $output] = testPushCommand((string) $this->user->id);

    expect($status)
        ->toBe(1)
        ->and(PushSubscription::query()->count())
        ->toBe(1)
        ->and($output)
        ->toContain('Not sent: cURL error 6: Could not resolve host')
        ->not->toContain('(removed)');
});

it('removes the devices that their push service no longer knows', function (): void {
    Http::fake(['*' => Http::response('', 410)]);

    storePushSubscription($this->user);

    testPushCommand((string) $this->user->id);

    expect(PushSubscription::query()->count())->toBe(0);
});

it('explains how to subscribe a device when the user has none', function (): void {
    [$status, $output] = testPushCommand((string) $this->user->id);

    expect($status)
        ->toBe(1)
        ->and($output)
        ->toContain("The [User] with the key [{$this->user->id}] has no devices that receive pushes.")
        ->toContain('Turn push on in the notification preferences');
});

it('fails for a user that does not exist', function (): void {
    [$status, $output] = testPushCommand('99');

    expect($status)
        ->toBe(1)
        ->and($output)
        ->toContain('There is no ['.User::class.'] with the key [99].');
});

it('finds the user with the model of the user provider of the default guard without --model', function (): void {
    Http::fake(['*' => Http::response('', 201)]);

    // The default guard reads another provider than "users", so the command must not read the "users" model.
    config([
        'auth.defaults.guard' => 'admin',
        'auth.guards.admin' => ['driver' => 'session', 'provider' => 'admins'],
        'auth.providers.admins' => ['driver' => 'eloquent', 'model' => User::class],
        'auth.providers.users.model' => 'App\Models\User',
    ]);

    storePushSubscription($this->user);

    $status = Artisan::call('inertia-notifications:test-push', ['user' => (string) $this->user->id]);

    expect($status)
        ->toBe(0)
        ->and(Artisan::output())
        ->toContain('Every device accepted the test push.');
});

it('fails without --model while the user provider of the default guard has no model', function (): void {
    config(['auth.providers.users' => ['driver' => 'database', 'table' => 'users']]);

    $status = Artisan::call('inertia-notifications:test-push', ['user' => '1']);

    expect($status)
        ->toBe(1)
        ->and(Artisan::output())
        ->toContain('The user provider of the default guard has no model. Pass the notifiable model with --model.');
});

it('fails for a model class that does not exist, such as a user model of the auth config', function (): void {
    config(['auth.providers.users.model' => 'App\Models\User']);

    $status = Artisan::call('inertia-notifications:test-push', ['user' => '1']);

    expect($status)
        ->toBe(1)
        ->and(Artisan::output())
        ->toContain('The model [App\Models\User] does not exist. Pass the notifiable model with --model.');
});

it('fails while push is not enabled, with the way to publish the configuration', function (): void {
    config(['inertia-notifications.push.enabled' => false]);

    [$status, $output] = testPushCommand((string) $this->user->id);

    expect($status)
        ->toBe(1)
        ->and($output)
        ->toContain("Push is not enabled. Set ['enabled' => true] in the 'push' section of the configuration")
        ->toContain('[php artisan vendor:publish --tag=inertia-notifications-config]')
        ->not->toContain('config/inertia-notifications.php');
});

it('points at the published configuration file while push is not enabled', function (): void {
    File::put(config_path('inertia-notifications.php'), '<?php return [];');

    config(['inertia-notifications.push.enabled' => false]);

    [$status, $output] = testPushCommand((string) $this->user->id);

    expect($status)
        ->toBe(1)
        ->and($output)
        ->toContain("Push is not enabled. Set ['enabled' => true] in the 'push' section of "
            .'config/inertia-notifications.php.');
});

it('fails with the fix of VAPID keys that do not form one pair', function (): void {
    storePushSubscription($this->user);

    config(['inertia-notifications.push.public_key' => KeyPair::generate()->publicKeyAsBase64Url()]);

    [$status, $output] = testPushCommand((string) $this->user->id);

    expect($status)
        ->toBe(1)
        ->and($output)
        ->toContain('VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are not one pair.');
});
