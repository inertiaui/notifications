<?php

use Carbon\CarbonImmutable;
use Illuminate\Notifications\Events\NotificationSent;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Route;
use InertiaUI\Notifications\Digest;
use InertiaUI\Notifications\DoNotDisturb;
use InertiaUI\Notifications\Events\InboxNotificationArrived;
use InertiaUI\Notifications\Events\NotificationPreferencesChanged;
use InertiaUI\Notifications\Models\NotificationPreference;
use InertiaUI\Notifications\NotificationHours;
use InertiaUI\Notifications\NotificationHoursChange;
use InertiaUI\Notifications\NotificationPreferences;
use InertiaUI\Notifications\Testing\InteractsWithNotificationCenter;
use InertiaUI\Notifications\Tests\Fixtures\InvoicePaid;
use InertiaUI\Notifications\Tests\Fixtures\IssueCommented;
use InertiaUI\Notifications\Tests\Fixtures\User;
use InertiaUI\Notifications\Toast;

uses(InteractsWithNotificationCenter::class);

beforeEach(function (): void {
    config()->set('inertia-notifications.notification_hours.enabled', true);
    config()->set('inertia-notifications.preferences.categories', [
        'comments' => ['label' => 'Comments', 'digest' => true],
        'billing' => ['label' => 'Billing'],
        'security' => ['label' => 'Security', 'locked' => true],
    ]);

    registerNotificationRoutes();

    // Monday, 10:00 in New York.
    $this->travelTo(Carbon::parse('2026-11-16 15:00', 'UTC'));

    $this->user = User::named('Pascal');
    $this->sent = [];
    $this->noHours = array_fill_keys(NotificationHours::DAYS, []);
    $this->savedHours = ['enabled' => true, 'days' => array_fill_keys(NotificationHours::DAYS, ['12:00-20:00'])];

    NotificationPreferences::update(
        $this->user,
        timezone: 'America/New_York',
        notificationHours: new NotificationHoursChange(enabled: true, days: $this->savedHours['days']),
    );

    Event::listen(NotificationSent::class, function (NotificationSent $event): void {
        $this->sent[] = $event->channel;
    });
});

it('stores the notification right away and holds its mail until the notification hours start', function (): void {
    $this->user->notify(new IssueCommented);

    expect($this->sent)->toBe(['inbox']);

    $this->assertInboxMessage($this->user, 'Sophie commented on issue #42');
    $this->assertHeldForDigest(
        $this->user,
        fn (array $message): bool => $message['sendAt'] === '2026-11-16T17:00:00+00:00',
    );

    Notification::fake();

    $this->travelTo(Carbon::parse('2026-11-16 16:59', 'UTC'));
    $this->artisan('inertia-notifications:send-digests');
    $this->assertNoDigestSent($this->user);

    $this->travelTo(Carbon::parse('2026-11-16 17:00', 'UTC'));
    $this->artisan('inertia-notifications:send-digests');
    $this->assertDigestSent($this->user, 'Sophie commented on issue #42');
});

it('holds the mail until the next day once the notification hours of the day ended', function (): void {
    // Monday, 21:00 in New York.
    $this->travelTo(Carbon::parse('2026-11-17 02:00', 'UTC'));
    $this->user->notify(new IssueCommented);

    $this->assertHeldForDigest(
        $this->user,
        fn (array $message): bool => $message['sendAt'] === '2026-11-17T17:00:00+00:00',
    );
});

it('finds the start of the next day while the application uses immutable dates', function (): void {
    Date::use(CarbonImmutable::class);

    try {
        // Monday, 21:00 in New York.
        $this->travelTo(Carbon::parse('2026-11-17 02:00', 'UTC'));

        expect(NotificationHours::next($this->user, now())->toIso8601String())->toBe('2026-11-17T17:00:00+00:00');
    } finally {
        Date::useDefault();
    }
});

it('tells whether the time falls within the notification hours in the timezone of the user', function (
    array $days,
    string $time,
    bool $within,
): void {
    NotificationPreferences::update(
        $this->user,
        notificationHours: new NotificationHoursChange(days: [...$this->noHours, ...$days]),
    );

    $this->travelTo(Carbon::parse($time, 'UTC'));

    expect(NotificationHours::within($this->user))->toBe($within);
})->with([
    'at the start of a range' => [['monday' => ['09:00-17:00']], '2026-11-16 14:00', true],
    'just before the start of a range' => [['monday' => ['09:00-17:00']], '2026-11-16 13:59', false],
    'just before the end of a range' => [['monday' => ['09:00-17:00']], '2026-11-16 21:59', true],
    'at the end of a range' => [['monday' => ['09:00-17:00']], '2026-11-16 22:00', false],
    'on a day without hours' => [['monday' => ['09:00-17:00']], '2026-11-17 15:00', false],
    'in the second range of a day' => [['monday' => ['08:00-10:00', '14:00-18:00']], '2026-11-16 20:00', true],
    'between two ranges of a day' => [['monday' => ['08:00-10:00', '14:00-18:00']], '2026-11-16 17:00', false],
    'late in a range past midnight' => [['monday' => ['22:00-02:00']], '2026-11-17 04:00', true],
    'early on the next day of a range past midnight' => [['monday' => ['22:00-02:00']], '2026-11-17 06:59', true],
    'at the end of a range past midnight' => [['monday' => ['22:00-02:00']], '2026-11-17 07:00', false],
    'early on the day of a range past midnight' => [['monday' => ['22:00-02:00']], '2026-11-16 06:00', false],
    'at the start of a whole day' => [['wednesday' => ['00:00-00:00']], '2026-11-18 05:00', true],
    'at the last minute of a whole day' => [['wednesday' => ['00:00-00:00']], '2026-11-19 04:59', true],
    'on the day after a whole day' => [['wednesday' => ['00:00-00:00']], '2026-11-19 05:00', false],
]);

it('finds the start of the next notification hours', function (array $days, string $time, string $next): void {
    NotificationPreferences::update(
        $this->user,
        notificationHours: new NotificationHoursChange(days: [...$this->noHours, ...$days]),
    );

    expect(NotificationHours::next($this->user, Carbon::parse($time, 'UTC'))->toIso8601String())->toBe($next);
})->with([
    'at the time itself within them' => [
        ['monday' => ['09:00-17:00']],
        '2026-11-16 15:00',
        '2026-11-16T15:00:00+00:00',
    ],
    'in the first range of the next week' => [
        ['monday' => ['09:00-17:00']],
        '2026-11-16 23:00',
        '2026-11-23T14:00:00+00:00',
    ],
    'in the earlier of two ranges' => [
        ['tuesday' => ['14:00-18:00', '08:00-10:00']],
        '2026-11-16 23:00',
        '2026-11-17T13:00:00+00:00',
    ],
    'in the later range of the same day' => [
        ['tuesday' => ['08:00-10:00', '14:00-18:00']],
        '2026-11-17 16:00',
        '2026-11-17T19:00:00+00:00',
    ],
    'at the start of a whole day' => [
        ['wednesday' => ['00:00-00:00']],
        '2026-11-17 16:00',
        '2026-11-18T05:00:00+00:00',
    ],
]);

it('gives a time within the notification hours as a copy in the timezone of the application', function (): void {
    NotificationPreferences::update(
        $this->user,
        notificationHours: new NotificationHoursChange(days: [...$this->noHours, 'monday' => ['09:00-17:00']]),
    );

    $time = Carbon::parse('2026-11-16 10:00', 'America/New_York');

    $next = NotificationHours::next($this->user, $time);

    expect($next->toIso8601String())
        ->toBe('2026-11-16T15:00:00+00:00')
        ->and($time->toIso8601String())
        ->toBe('2026-11-16T10:00:00-05:00');
});

it('finds the start of the next notification hours across a change of daylight saving time', function (
    string $timezone,
    string $time,
    string $next,
): void {
    NotificationPreferences::update(
        $this->user,
        timezone: $timezone,
        notificationHours: new NotificationHoursChange(days: array_fill_keys(NotificationHours::DAYS, ['09:00-17:00'])),
    );

    $this->travelTo(Carbon::parse($time, 'UTC'));

    expect(NotificationHours::next($this->user, now())->toIso8601String())->toBe($next);

    $this->travelTo(Carbon::parse($next)->addMinutes(30));

    $this->assertWithinNotificationHours($this->user);
})->with([
    'as Amsterdam moves its clocks forward' => ['Europe/Amsterdam', '2026-03-28 20:00', '2026-03-29T07:00:00+00:00'],
    'as New York moves its clocks back' => ['America/New_York', '2026-11-01 02:00', '2026-11-01T14:00:00+00:00'],
]);

it('silences the categories that are not locked outside the notification hours', function (): void {
    expect(DoNotDisturb::silences($this->user, 'comments'))
        ->toBeTrue()
        ->and(DoNotDisturb::silences($this->user, 'security'))
        ->toBeFalse()
        ->and(DoNotDisturb::silences($this->user, 'marketing'))
        ->toBeFalse()
        ->and(DoNotDisturb::silences($this->user, null))
        ->toBeFalse()
        ->and(DoNotDisturb::silences($this->user, 'comments', Carbon::parse('2026-11-16 17:00', 'UTC')))
        ->toBeFalse();
});

it('sends the mail of locked and unlisted categories outside the notification hours', function (): void {
    $this->user->notify(new IssueCommented(category: 'security'));
    $this->user->notify(new IssueCommented(category: 'marketing'));

    $this->travelTo(Carbon::parse('2026-11-16 17:00', 'UTC'));
    $this->user->notify(new IssueCommented);

    expect($this->sent)->toBe(['inbox', 'mail', 'inbox', 'mail', 'inbox', 'mail']);

    $this->assertNothingHeldForDigest($this->user);
});

it('always lets notifications through while the user turned the notification hours off', function (): void {
    NotificationPreferences::update($this->user, notificationHours: new NotificationHoursChange(enabled: false));

    $this->assertWithinNotificationHours($this->user);

    $this->user->notify(new IssueCommented);

    expect($this->sent)->toBe(['inbox', 'mail']);
});

it('flashes no toast outside the notification hours and marks the notification as quiet', function (): void {
    Toast::fake();
    Route::middleware('web')->post('/invoices/7/pay', function () {
        request()
            ->user()
            ->notify(new InvoicePaid(toast: true));

        return back();
    });
    $this->actingAs($this->user);

    $this->post('/invoices/7/pay');

    Toast::assertNothingFlashed();

    expect($this->user->inbox()->sole()->toInboxArray()['quiet'])->toBeTrue();

    $this->travelTo(Carbon::parse('2026-11-16 17:00', 'UTC'));
    $this->post('/invoices/7/pay');

    Toast::assertFlashed('Invoice INV-7 paid', 1);

    expect($this->user->inbox()->latest()->first()->toInboxArray())->not->toHaveKey('quiet');
});

it('still broadcasts the arrival of a quiet notification, so the bell stays current', function (): void {
    config()->set('inertia-notifications.inbox.broadcast_notifications', true);
    Event::fake([InboxNotificationArrived::class]);

    $this->user->notify(new InvoicePaid);

    $item = Event::dispatched(InboxNotificationArrived::class)->sole()[0]->item;

    expect($item['title'])
        ->toBe('Invoice INV-7 paid')
        ->and($item['quiet'])
        ->toBeTrue();
});

it('moves a digest whose time falls outside the notification hours to their start', function (): void {
    NotificationPreferences::update(
        $this->user,
        frequencies: ['comments' => 'daily'],
        notificationHours: new NotificationHoursChange(days: array_fill_keys(NotificationHours::DAYS, ['09:00-20:00'])),
    );

    $this->user->notify(new IssueCommented);

    // The digest of 08:00 in New York waits until 09:00.
    $this->assertHeldForDigest(
        $this->user,
        fn (array $message): bool => $message['sendAt'] === '2026-11-17T14:00:00+00:00',
    );
});

it('holds an hourly digest until the notification hours start', function (string $time, string $sendAt): void {
    NotificationPreferences::update($this->user, frequencies: ['comments' => 'hourly']);

    $this->travelTo(Carbon::parse($time, 'UTC'));
    $this->user->notify(new IssueCommented);

    $this->assertHeldForDigest($this->user, fn (array $message): bool => $message['sendAt'] === $sendAt);
})->with([
    // Monday, 10:00 in New York, so the digest of 11:00 waits until 12:00.
    'before the notification hours' => ['2026-11-16 15:00', '2026-11-16T17:00:00+00:00'],
    // Monday, 13:15 in New York, so 14:00.
    'within the notification hours' => ['2026-11-16 18:15', '2026-11-16T19:00:00+00:00'],
    // Monday, 19:30 in New York, so the digest of 20:00 waits until 12:00 on Tuesday.
    'in the last hour of the notification hours' => ['2026-11-17 00:30', '2026-11-17T17:00:00+00:00'],
]);

it('postpones the held mail that is due outside the notification hours', function (): void {
    $this->user->notify(new IssueCommented);

    Digest::query($this->user)->update(['send_at' => now()]);
    Notification::fake();

    $this->artisan('inertia-notifications:send-digests');

    $this->assertNoDigestSent($this->user);
    $this->assertHeldForDigest(
        $this->user,
        fn (array $message): bool => $message['sendAt'] === '2026-11-16T17:00:00+00:00',
    );
});

it('sends the held mail with the next run once the user turns the notification hours off', function (): void {
    $this->user->notify(new IssueCommented);

    NotificationPreferences::update($this->user, notificationHours: new NotificationHoursChange(enabled: false));
    Notification::fake();

    $this->artisan('inertia-notifications:send-digests');

    $this->assertDigestSent($this->user, 'Sophie commented on issue #42');
});

it('sends a digest that came due outside the notification hours with the next run once they are off', function (): void {
    NotificationPreferences::update($this->user, frequencies: ['comments' => 'daily']);
    $this->user->notify(new IssueCommented);

    // Tuesday, 09:00 in New York, after the digest of 08:00, which waits until 12:00.
    $this->travelTo(Carbon::parse('2026-11-17 14:00', 'UTC'));
    NotificationPreferences::update($this->user, notificationHours: new NotificationHoursChange(enabled: false));

    $this->assertHeldForDigest(
        $this->user,
        fn (array $message): bool => $message['sendAt'] === '2026-11-17T14:00:00+00:00',
    );

    Notification::fake();

    $this->artisan('inertia-notifications:send-digests');

    $this->assertDigestSent($this->user, 'Sophie commented on issue #42');
});

it('lists the notification hours of the user, and none while the application does not offer them', function (): void {
    $this->actingAs(User::named('Maria'))
        ->getJson('/_inertia-notifications/preferences')
        ->assertOk()
        ->assertJsonPath('notificationHours', [
            'enabled' => false,
            'days' => [
                'monday' => ['07:00-22:00'],
                'tuesday' => ['07:00-22:00'],
                'wednesday' => ['07:00-22:00'],
                'thursday' => ['07:00-22:00'],
                'friday' => ['07:00-22:00'],
                'saturday' => ['07:00-22:00'],
                'sunday' => ['07:00-22:00'],
            ],
        ]);

    config()->set('inertia-notifications.notification_hours.enabled', false);

    $this->actingAs($this->user)
        ->getJson('/_inertia-notifications/preferences')
        ->assertOk()
        ->assertJsonPath('notificationHours', null);

    expect(NotificationPreferences::notificationHours($this->user)->toArray())
        ->toBe($this->savedHours)
        ->and(NotificationHours::within($this->user))
        ->toBeTrue();
});

it('falls back to the hours of the config for each day that the user did not save', function (): void {
    $maria = User::named('Maria');

    NotificationPreference::query()->create([
        'notifiable_type' => $maria->getMorphClass(),
        'notifiable_id' => $maria->getKey(),
        'category' => '*',
        'channel' => '*',
        'settings' => ['notification_hours' => [
            'enabled' => true,
            'days' => ['monday' => [], 'friday' => ['10:00-11:00']],
        ]],
    ]);

    expect(NotificationPreferences::notificationHours($maria)->toArray())->toBe([
        'enabled' => true,
        'days' => [
            'monday' => [],
            'tuesday' => ['07:00-22:00'],
            'wednesday' => ['07:00-22:00'],
            'thursday' => ['07:00-22:00'],
            'friday' => ['10:00-11:00'],
            'saturday' => ['07:00-22:00'],
            'sunday' => ['07:00-22:00'],
        ],
    ]);
});

it('saves the notification hours with the timezone of the browser, including a day without hours', function (): void {
    Event::fake(NotificationPreferencesChanged::class);

    $days = ['monday' => [], 'tuesday' => ['14:00-18:00', '08:00-10:00']];
    $expected = [
        'enabled' => false,
        'days' => [...$this->savedHours['days'], 'monday' => [], 'tuesday' => ['08:00-10:00', '14:00-18:00']],
    ];

    $this->actingAs($this->user)
        ->postJson('/_inertia-notifications/preferences', [
            'notificationHours' => ['enabled' => false, 'days' => $days],
            'timezone' => 'Europe/Amsterdam',
        ])
        ->assertOk()
        ->assertJsonPath('notificationHours', $expected);

    $this->postJson('/_inertia-notifications/preferences', ['notificationHours' => ['days' => $days]])->assertOk();

    expect(NotificationPreferences::timezone($this->user))
        ->toBe('Europe/Amsterdam')
        ->and(NotificationPreferences::notificationHours($this->user)->toArray())
        ->toBe($expected);

    Event::assertDispatchedTimes(NotificationPreferencesChanged::class, 1);
    Event::assertDispatched(
        NotificationPreferencesChanged::class,
        fn (NotificationPreferencesChanged $event): bool => $event->notificationHours instanceof NotificationHours
            && $event->notificationHours->toArray() === $expected,
    );
});

it('keeps the days that another request saved since the preferences were read', function (): void {
    Event::fake(NotificationPreferencesChanged::class);

    // The other request saves the hours of Tuesday right after this one read the preferences.
    $raced = runOnceAfterQuery(
        fn (string $sql): bool => str_starts_with($sql, 'select') && str_contains($sql, 'notification_preferences'),
        fn () => NotificationPreferences::update(
            $this->user,
            notificationHours: new NotificationHoursChange(days: ['tuesday' => ['10:00-11:00']]),
        ),
    );

    NotificationPreferences::update(
        $this->user,
        notificationHours: new NotificationHoursChange(days: ['monday' => ['09:00-17:00']]),
    );

    $expected = [
        'enabled' => true,
        'days' => [...$this->savedHours['days'], 'monday' => ['09:00-17:00'], 'tuesday' => ['10:00-11:00']],
    ];

    expect($raced())
        ->toBeTrue()
        ->and(NotificationPreferences::notificationHours($this->user)->toArray())
        ->toBe($expected);

    Event::assertDispatched(
        NotificationPreferencesChanged::class,
        fn (NotificationPreferencesChanged $event): bool => $event->notificationHours?->toArray() === $expected,
    );
});

it('rejects notification hours that the request cannot save, and saves nothing', function (
    array $notificationHours,
    string $error,
): void {
    $this->actingAs($this->user)
        ->postJson('/_inertia-notifications/preferences', [
            'notificationHours' => $notificationHours,
            'timezone' => 'Europe/Amsterdam',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors($error);

    expect(NotificationPreferences::notificationHours($this->user)->toArray())
        ->toBe($this->savedHours)
        ->and(NotificationPreferences::timezone($this->user))
        ->toBe('America/New_York');
})->with([
    'an unknown day' => [['days' => ['funday' => ['09:00-17:00']]], 'notificationHours.days'],
    'a range of words' => [['days' => ['monday' => ['7am-5pm']]], 'notificationHours.days.monday.0'],
    'a range of one time' => [['days' => ['monday' => ['09:00']]], 'notificationHours.days.monday.0'],
    'a range that ends at 24:00' => [['days' => ['monday' => ['09:00-24:00']]], 'notificationHours.days.monday.0'],
    'ranges that are not a list' => [['days' => ['monday' => '09:00-17:00']], 'notificationHours.days.monday'],
    'no range on any day' => [['days' => array_fill_keys(NotificationHours::DAYS, [])], 'notificationHours.days'],
    'a switch that is not true or false' => [['enabled' => 'maybe'], 'notificationHours.enabled'],
]);

it('throws for notification hours that it cannot save, and saves nothing', function (
    array $days,
    string $message,
): void {
    $update = fn () => NotificationPreferences::update(
        $this->user,
        notificationHours: new NotificationHoursChange(days: $days),
    );

    expect($update)
        ->toThrow(InvalidArgumentException::class, $message)
        ->and(NotificationPreferences::notificationHours($this->user)->toArray())
        ->toBe($this->savedHours);
})->with([
    'an unknown day' => [
        ['funday' => ['09:00-17:00']],
        'The notification hours day [funday] must be a day of the week, such as monday.',
    ],
    'a range of words' => [
        ['monday' => ['7am-5pm']],
        'The notification hours range [7am-5pm] must be two times of day, such as 09:00-17:00.',
    ],
    'a range without a leading zero' => [
        ['monday' => ['9:00-17:00']],
        'The notification hours range [9:00-17:00] must be two times of day, such as 09:00-17:00.',
    ],
    'a range with a trailing newline' => [
        ['monday' => ["09:00-17:00\n"]],
        "The notification hours range [09:00-17:00\n] must be two times of day, such as 09:00-17:00.",
    ],
    'no range on any day' => [
        array_fill_keys(NotificationHours::DAYS, []),
        'The notification hours must have a range on at least one day.',
    ],
]);

it('throws for notification hours of the config that it cannot read', function (array $days, string $message): void {
    config()->set('inertia-notifications.notification_hours.days', $days);

    expect(fn () => NotificationPreferences::notificationHours(User::named('Maria')))
        ->toThrow(InvalidArgumentException::class, $message);
})->with([
    'a range without a leading zero' => [
        ['monday' => ['9:00-17:00']],
        'The [inertia-notifications.notification_hours.days.monday] config is invalid: '
            .'The notification hours range [9:00-17:00] must be two times of day, such as 09:00-17:00.',
    ],
    'a day that is not a day of the week' => [
        ['Monday' => ['09:00-17:00']],
        'The [inertia-notifications.notification_hours.days.Monday] config is invalid: '
            .'The notification hours day [Monday] must be a day of the week, such as monday.',
    ],
    'ranges that are not a list' => [
        ['monday' => '09:00-17:00'],
        'The [inertia-notifications.notification_hours.days.monday] config must be a list of ranges, '
            ."such as ['09:00-17:00'].",
    ],
    'ranges written as pairs of times' => [
        ['monday' => [['09:00', '17:00']]],
        'The [inertia-notifications.notification_hours.days.monday] config must be a list of ranges, '
            ."such as ['09:00-17:00'].",
    ],
]);

it('saves no timezone with notification hours that it cannot save', function (): void {
    expect(fn () => NotificationPreferences::update(
        $this->user,
        timezone: 'Europe/Amsterdam',
        notificationHours: new NotificationHoursChange(days: ['monday' => ['7am-5pm']]),
    ))
        ->toThrow(InvalidArgumentException::class)
        ->and(NotificationPreferences::timezone($this->user))
        ->toBe('America/New_York');
});

it('leaves the notification hours unchanged while the application does not offer them', function (): void {
    config()->set('inertia-notifications.notification_hours.enabled', false);

    NotificationPreferences::update(
        $this->user,
        notificationHours: new NotificationHoursChange(days: ['monday' => ['01:00-02:00']]),
    );

    $this->actingAs($this->user)
        ->postJson('/_inertia-notifications/preferences', ['notificationHours' => ['days' => $this->noHours]])
        ->assertOk();

    expect(NotificationPreferences::notificationHours($this->user)->toArray())->toBe($this->savedHours);

    $this->user->notify(new IssueCommented);

    expect($this->sent)->toBe(['inbox', 'mail']);
});
