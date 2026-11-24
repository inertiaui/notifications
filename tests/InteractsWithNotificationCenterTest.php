<?php

use Illuminate\Support\Carbon;
use InertiaUI\Notifications\InboxMessage;
use InertiaUI\Notifications\NotificationPreferences;
use InertiaUI\Notifications\Testing\InteractsWithNotificationCenter;
use InertiaUI\Notifications\Tests\Fixtures\InvoicePaid;
use InertiaUI\Notifications\Tests\Fixtures\User;
use PHPUnit\Framework\ExpectationFailedException;

uses(InteractsWithNotificationCenter::class);

beforeEach(function (): void {
    config()->set('inertia-notifications.preferences.categories', [
        'billing' => ['label' => 'Billing'],
        'comments' => ['label' => 'Comments', 'channels' => ['inbox']],
        'security' => ['label' => 'Security', 'locked' => true],
        'product' => ['label' => 'Product updates', 'opt_in' => true],
    ]);

    $this->user = User::named('Pascal');
});

it('asserts the notifications of a notifiable model by their title or a callback', function (): void {
    $this->user->notify(new InvoicePaid);
    User::named('Sophie')->notify(new InvoicePaid);

    $this->user
        ->inbox()
        ->sole()
        ->archive();

    $this->assertInboxMessage($this->user);
    $this->assertInboxMessage($this->user, 'Invoice INV-7 paid');
    $this->assertInboxMessage($this->user, fn (array $message) => $message['category'] === 'billing', times: 1);
    $this->assertInboxMessageMissing($this->user, 'Payment failed');
    $this->assertNoInboxMessages(User::named('Maria'));
});

it('asserts the read and archived state of notifications', function (): void {
    $this->user->notify(new InvoicePaid);
    $this->user->notify(new InvoicePaid);

    $this->assertMarkedUnread($this->user, 'Invoice INV-7 paid');

    $this->user
        ->inbox()
        ->get()
        ->each
        ->markAsRead();

    $this->assertMarkedRead($this->user);
    $this->assertMarkedRead($this->user, fn (array $message) => $message['group'] === 'invoice:7');

    $archived = $this->user
        ->inbox()
        ->first();

    $archived->archive();

    $this->assertArchived($this->user, fn (array $message) => $message['id'] === $archived->id);

    expect(fn () => $this->assertArchived($this->user))
        ->toThrow(ExpectationFailedException::class, 'Expected every notification to be archived.');
});

it('explains a failed inbox assertion', function (): void {
    $this->user->notify(new InvoicePaid);

    $this->travel(1)->minute();

    $this->user->notify(new class extends InvoicePaid
    {
        /**
         * Get the inbox representation of the notification.
         */
        public function toInbox(object $notifiable): InboxMessage
        {
            return InboxMessage::make('Payment failed');
        }
    });

    expect(fn () => $this->assertInboxMessage($this->user, 'Invoice INV-8 paid'))
        ->toThrow(
            ExpectationFailedException::class,
            'titled [Invoice INV-8 paid] in the inbox. It has: [Invoice INV-7 paid], [Payment failed].',
        )
        ->and(fn () => $this->assertInboxMessage($this->user, 'Payment failed', times: 2))
        ->toThrow(ExpectationFailedException::class, 'in the inbox 2 times, but it is there 1 time.')
        ->and(fn () => $this->assertInboxMessageMissing($this->user, fn (array $message) => $message['url'] === null))
        ->toThrow(ExpectationFailedException::class, 'Expected no matching notification in the inbox.')
        ->and(fn () => $this->assertNoInboxMessages($this->user))
        ->toThrow(ExpectationFailedException::class, 'It has: [Invoice INV-7 paid], [Payment failed].')
        ->and(fn () => $this->assertMarkedRead($this->user, 'Payment failed'))
        ->toThrow(
            ExpectationFailedException::class,
            'Expected every notification titled [Payment failed] to be read. Not read: [Payment failed].',
        )
        ->and(fn () => $this->assertMarkedUnread(User::named('Sophie')))
        ->toThrow(ExpectationFailedException::class, 'Expected a notification in the inbox. It has: none.');
});

it('asserts the preferences of a notifiable model', function (): void {
    NotificationPreferences::update($this->user, ['billing' => ['mail' => false]]);

    $this->assertPreferenceSet($this->user, 'billing', 'mail', enabled: false);
    $this->assertPreferenceSet($this->user, 'billing', 'inbox', enabled: true);
    $this->assertPreferenceSet($this->user, 'security', 'mail', enabled: true);
    $this->assertPreferenceSet($this->user, 'product', 'mail', enabled: false);
});

it('asserts the switches of channels for every category', function (): void {
    NotificationPreferences::update($this->user, channels: ['mail' => false]);

    $this->assertChannelPreferenceSet($this->user, 'mail', enabled: false);
    $this->assertChannelPreferenceSet($this->user, 'inbox', enabled: true);
    $this->assertPreferenceSet($this->user, 'billing', 'mail', enabled: false);
    $this->assertPreferenceSet($this->user, 'security', 'mail', enabled: true);
});

it('explains a failed channel assertion', function (): void {
    config()->set('inertia-notifications.preferences.channels.mail.global_switch', false);

    expect(fn () => $this->assertChannelPreferenceSet($this->user, 'inbox', enabled: false))
        ->toThrow(ExpectationFailedException::class, 'Expected the [inbox] channel to be off for every category.')
        ->and(fn () => $this->assertChannelPreferenceSet($this->user, 'slack', enabled: true))
        ->toThrow(ExpectationFailedException::class, 'The preferences config has no channel [slack].')
        ->and(fn () => $this->assertChannelPreferenceSet($this->user, 'mail', enabled: true))
        ->toThrow(ExpectationFailedException::class, 'The channel [mail] has no switch for every category.');
});

it('explains a failed preference assertion', function (): void {
    expect(fn () => $this->assertPreferenceSet($this->user, 'billing', 'mail', enabled: false))
        ->toThrow(ExpectationFailedException::class, 'the [billing] notifications on the [mail] channel to be off.')
        ->and(fn () => $this->assertPreferenceSet($this->user, 'invoices', 'mail', enabled: true))
        ->toThrow(ExpectationFailedException::class, 'The preferences config has no category [invoices].')
        ->and(fn () => $this->assertPreferenceSet($this->user, 'comments', 'mail', enabled: true))
        ->toThrow(ExpectationFailedException::class, 'The category [comments] does not offer the channel [mail].');
});

it('explains a failed digest assertion', function (): void {
    config()->set('inertia-notifications.preferences.categories.billing.digest', true);
    NotificationPreferences::update($this->user, frequencies: ['billing' => 'daily']);

    $this->user->notify(new InvoicePaid(['inbox', 'mail']));

    $this->assertHeldForDigest($this->user, 'Invoice INV-7 paid', times: 1);
    $this->assertNothingHeldForDigest(User::named('Sophie'));
    $this->assertDigestFrequency($this->user, 'billing', 'daily');

    expect(fn () => $this->assertHeldForDigest($this->user, 'Payment failed'))
        ->toThrow(
            ExpectationFailedException::class,
            'Expected a notification titled [Payment failed] to be held for a digest. Held: [Invoice INV-7 paid].',
        )
        ->and(fn () => $this->assertNothingHeldForDigest($this->user))
        ->toThrow(ExpectationFailedException::class, 'Expected nothing to be held for a digest. Held: [Invoice INV-7 paid].')
        ->and(fn () => $this->assertDigestFrequency($this->user, 'billing', 'weekly'))
        ->toThrow(ExpectationFailedException::class, 'Expected the [billing] notifications to be sent with the [weekly] frequency.')
        ->and(fn () => $this->assertDigestFrequency($this->user, 'invoices', 'daily'))
        ->toThrow(ExpectationFailedException::class, 'The preferences config has no category [invoices].');
});

it('explains a failed notification hours assertion', function (): void {
    expect(fn () => $this->assertWithinNotificationHours($this->user))
        ->toThrow(ExpectationFailedException::class, 'The application does not offer notification hours.')
        ->and(fn () => $this->assertOutsideNotificationHours($this->user))
        ->toThrow(ExpectationFailedException::class, 'The application does not offer notification hours.');

    setNotificationHours($this->user, '09:00-12:00');

    $this->travelTo(Carbon::parse('2026-11-16 15:00', 'UTC'));

    $this->assertOutsideNotificationHours($this->user);

    expect(fn () => $this->assertWithinNotificationHours($this->user))
        ->toThrow(
            ExpectationFailedException::class,
            'Expected the current time to fall within the notification hours.',
        );

    $this->travelTo(Carbon::parse('2026-11-16 10:00', 'UTC'));

    $this->assertWithinNotificationHours($this->user);

    expect(fn () => $this->assertOutsideNotificationHours($this->user))
        ->toThrow(
            ExpectationFailedException::class,
            'Expected the current time to fall outside the notification hours.',
        );
});

it('explains a failed pause assertion', function (): void {
    expect(fn () => $this->assertNotificationsPaused($this->user))
        ->toThrow(ExpectationFailedException::class, 'The application does not offer pausing.')
        ->and(fn () => $this->assertNotificationsNotPaused($this->user))
        ->toThrow(ExpectationFailedException::class, 'The application does not offer pausing.');

    config()->set('inertia-notifications.pause.enabled', true);
    $this->travelTo(Carbon::parse('2026-11-16 15:00', 'UTC'));

    $this->assertNotificationsNotPaused($this->user);

    expect(fn () => $this->assertNotificationsPaused($this->user))
        ->toThrow(ExpectationFailedException::class, 'Expected the notifications to be paused.');

    NotificationPreferences::pause($this->user, now()->addHour());

    $this->assertNotificationsPaused($this->user);
    $this->assertNotificationsPaused($this->user, Carbon::parse('2026-11-16 11:00', 'America/New_York'));

    expect(fn () => $this->assertNotificationsPaused($this->user, now()->addHours(2)))
        ->toThrow(
            ExpectationFailedException::class,
            'Expected the notifications to be paused until [2026-11-16T17:00:00+00:00], '
                .'but they are paused until [2026-11-16T16:00:00+00:00].',
        )
        ->and(fn () => $this->assertNotificationsNotPaused($this->user))
        ->toThrow(
            ExpectationFailedException::class,
            'Expected the notifications not to be paused, but they are paused until [2026-11-16T16:00:00+00:00].',
        );
});
