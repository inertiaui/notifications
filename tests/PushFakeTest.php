<?php

use InertiaUI\Notifications\Push;
use InertiaUI\Notifications\Testing\InteractsWithNotificationCenter;
use InertiaUI\Notifications\Tests\Fixtures\InvoicePaid;
use InertiaUI\Notifications\Tests\Fixtures\User;
use InertiaUI\Notifications\WebPush\PushSender;
use PHPUnit\Framework\AssertionFailedError;
use PHPUnit\Framework\ExpectationFailedException;

uses(InteractsWithNotificationCenter::class);

beforeEach(function (): void {
    registerNotificationRoutes();
    config(['inertia-notifications.push.enabled' => true]);

    $this->fakePush();
    $this->user = User::named('Pascal');
    $this->describedUser = '['.User::class."] [{$this->user->id}]";
});

it('sets VAPID keys and a subject for the test when the config has none', function (): void {
    expect(Push::vapid()->subject)
        ->toBe('mailto:tests@inertiaui.com')
        ->and(Push::keys()->belongTogether())
        ->toBeTrue();
});

it('keeps the VAPID keys of the config', function (): void {
    $keys = enablePush();

    Push::fake();

    expect(Push::keys()->publicKeyAsBase64Url())->toBe($keys->publicKeyAsBase64Url());
});

it('runs the push jobs on the sync connection, also when the config names a connection that queues them', function (): void {
    config(['inertia-notifications.push.connection' => 'database']);

    $this->fakePush();
    $this->createPushSubscription($this->user);

    $this->user->notify(new InvoicePaid(push: true));

    $this->assertPushed($this->user, 'Invoice INV-7 paid');
});

it('records the pushes of each device of a notifiable model by their title or a callback', function (): void {
    $this->createPushSubscription($this->user);
    $this->createPushSubscription($this->user);

    $this->user->notify(new InvoicePaid(push: true));

    $this->assertPushed($this->user, 'Invoice INV-7 paid');
    $this->assertPushed($this->user, fn (array $push): bool => str_ends_with($push['navigate'], '/open'));
    $this->assertNotPushed($this->user, 'Payment failed');
    $this->assertNotPushed(User::named('Sophie'), 'Invoice INV-7 paid');

    expect(app(PushSender::class)->pushed($this->user))->toHaveCount(2);
});

it('explains a push that did not reach a notifiable model without devices', function (): void {
    expect(fn () => $this->assertPushed($this->user, 'Invoice INV-7 paid'))->toThrow(
        AssertionFailedError::class,
        "Expected a push titled [Invoice INV-7 paid] to {$this->describedUser}, "
            .'which has no devices that receive pushes.',
    );
});

it('lists the pushes that reached the notifiable model when the expected one did not', function (): void {
    storePushSubscription($this->user);
    storePushSubscription($this->user);

    $this->user->notify(new InvoicePaid(push: true));

    expect(fn () => $this->assertPushed($this->user, 'Payment failed'))->toThrow(
        ExpectationFailedException::class,
        "Expected a push titled [Payment failed] to {$this->describedUser}. Pushed: [Invoice INV-7 paid] on 2 devices.",
    );

    expect(fn () => $this->assertPushed($this->user, fn (array $push): bool => $push['body'] === 'Refunded.'))->toThrow(
        ExpectationFailedException::class,
        "Expected a matching push to {$this->describedUser}. Pushed: [Invoice INV-7 paid] on 2 devices.",
    );
});

it('counts the devices of the pushes that reached one device more than once', function (): void {
    storePushSubscription($this->user);

    $this->user->notify(new InvoicePaid(push: true));
    $this->user->notify(new InvoicePaid(push: true));

    expect(fn () => $this->assertPushed($this->user, 'Payment failed'))->toThrow(
        ExpectationFailedException::class,
        "Expected a push titled [Payment failed] to {$this->describedUser}. Pushed: [Invoice INV-7 paid].",
    );

    expect(fn () => $this->assertNotPushed($this->user, 'Invoice INV-7 paid'))->toThrow(
        ExpectationFailedException::class,
        "Expected no push titled [Invoice INV-7 paid] to {$this->describedUser}. Pushed: [Invoice INV-7 paid].",
    );
});

it('explains a push that should not have reached the notifiable model', function (): void {
    storePushSubscription($this->user);

    $this->user->notify(new InvoicePaid(push: true));

    expect(fn () => $this->assertNotPushed($this->user, 'Invoice INV-7 paid'))->toThrow(
        ExpectationFailedException::class,
        "Expected no push titled [Invoice INV-7 paid] to {$this->describedUser}. Pushed: [Invoice INV-7 paid].",
    );
});

it('explains that something was pushed', function (): void {
    $this->assertNothingPushed();

    storePushSubscription($this->user);
    storePushSubscription(User::named('Sophie'));

    $this->user->notify(new InvoicePaid(push: true));

    expect(fn () => $this->assertNothingPushed())->toThrow(
        ExpectationFailedException::class,
        'Expected nothing to be pushed. Pushed: [Invoice INV-7 paid].',
    );
});

it('tells to fake the pushes before asserting on them', function (): void {
    app()->forgetInstance(PushSender::class);

    expect(fn () => $this->assertNothingPushed())->toThrow(
        AssertionFailedError::class,
        'The pushes are not faked. Call $this->fakePush() before the notifications are sent.',
    );
});
