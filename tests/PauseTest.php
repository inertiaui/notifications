<?php

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Notifications\Events\NotificationSent;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use InertiaUI\Notifications\Announcement;
use InertiaUI\Notifications\Digest;
use InertiaUI\Notifications\DoNotDisturb;
use InertiaUI\Notifications\Events\InboxChanged;
use InertiaUI\Notifications\Events\NotificationsPaused;
use InertiaUI\Notifications\Events\NotificationsResumed;
use InertiaUI\Notifications\Models\InboxAnnouncement;
use InertiaUI\Notifications\Models\NotificationPreference;
use InertiaUI\Notifications\NotificationPreferences;
use InertiaUI\Notifications\Testing\InteractsWithNotificationCenter;
use InertiaUI\Notifications\Tests\Fixtures\InvoicePaid;
use InertiaUI\Notifications\Tests\Fixtures\IssueCommented;
use InertiaUI\Notifications\Tests\Fixtures\User;
use InertiaUI\Notifications\Toast;

uses(InteractsWithNotificationCenter::class);

beforeEach(function (): void {
    config()->set('inertia-notifications.pause.enabled', true);
    config()->set('inertia-notifications.preferences.categories', [
        'comments' => ['label' => 'Comments', 'digest' => true],
        'billing' => ['label' => 'Billing'],
        'security' => ['label' => 'Security', 'locked' => true],
    ]);

    Route::middleware('web')->group(function (): void {
        Route::inertiaNotifications();
        Route::get('/dashboard', fn () => Inertia::render('Dashboard'));
    });

    // Monday, 10:00 in New York.
    $this->travelTo(Carbon::parse('2026-11-16 15:00', 'UTC'));

    $this->user = User::named('Pascal');
    $this->sent = [];

    NotificationPreferences::update($this->user, timezone: 'America/New_York');

    Event::listen(NotificationSent::class, function (NotificationSent $event): void {
        $this->sent[] = $event->channel;
    });
});

/**
 * Get the inbox prop that the given user's pages share.
 *
 * @return array<string, mixed>
 */
function sharedInbox(User $user): array
{
    return test()->actingAs($user)
        ->get('/dashboard', ['X-Inertia' => 'true'])
        ->json('props.inertiauiInbox');
}

it('stores the notification right away and holds its mail until the pause ends', function (): void {
    NotificationPreferences::pause($this->user, now()->addHour());

    $this->user->notify(new IssueCommented);

    expect($this->sent)->toBe(['inbox']);

    $this->assertInboxMessage($this->user, 'Sophie commented on issue #42');
    $this->assertHeldForDigest(
        $this->user,
        fn (array $message): bool => $message['sendAt'] === '2026-11-16T16:00:00+00:00',
    );

    Notification::fake();

    $this->travelTo(Carbon::parse('2026-11-16 15:59', 'UTC'));
    $this->artisan('inertia-notifications:send-digests');
    $this->assertNoDigestSent($this->user);

    $this->travelTo(Carbon::parse('2026-11-16 16:00', 'UTC'));
    $this->artisan('inertia-notifications:send-digests');
    $this->assertDigestSent($this->user, 'Sophie commented on issue #42');
});

it('holds the mail until notifications reach the user again after the pause and the notification hours', function (
    string $range,
    string $pausedUntil,
    string $sendAt,
): void {
    setNotificationHours($this->user, $range);

    NotificationPreferences::pause($this->user, Carbon::parse($pausedUntil, 'UTC'));

    $this->user->notify(new IssueCommented);

    $this->assertHeldForDigest($this->user, fn (array $message): bool => $message['sendAt'] === $sendAt);

    Notification::fake();

    $this->travelTo(Carbon::parse($sendAt)->subMinute());
    $this->artisan('inertia-notifications:send-digests');
    $this->assertNoDigestSent($this->user);

    $this->travelTo(Carbon::parse($sendAt));
    $this->artisan('inertia-notifications:send-digests');
    $this->assertDigestSent($this->user, 'Sophie commented on issue #42');
})->with([
    // Until 11:00 in New York.
    'a pause that ends within the notification hours' => [
        '09:00-17:00',
        '2026-11-16 16:00',
        '2026-11-16T16:00:00+00:00',
    ],
    // Until 18:00 in New York, so the mail waits for 09:00 on Tuesday.
    'a pause that ends after the notification hours' => [
        '09:00-17:00',
        '2026-11-16 23:00',
        '2026-11-17T14:00:00+00:00',
    ],
    // Until 11:00 in New York, so the mail waits for 12:00.
    'a pause that ends before the notification hours' => [
        '12:00-20:00',
        '2026-11-16 16:00',
        '2026-11-16T17:00:00+00:00',
    ],
    // Until 13:00 in New York, after the notification hours started at 12:00.
    'a pause that outlasts the start of the hours' => [
        '12:00-20:00',
        '2026-11-16 18:00',
        '2026-11-16T18:00:00+00:00',
    ],
]);

it('sends the mail of a locked category during a pause, without marking it as quiet', function (): void {
    NotificationPreferences::pause($this->user, now()->addHour());

    $this->user->notify(new IssueCommented(category: 'security'));

    expect($this->sent)
        ->toBe(['inbox', 'mail'])
        ->and($this->user->inbox()->sole()->toInboxArray())
        ->not->toHaveKey('quiet');

    $this->assertNothingHeldForDigest($this->user);
});

it('flashes no toast during a pause and marks the notification as quiet', function (): void {
    Toast::fake();
    Route::middleware('web')->post('/invoices/7/pay', function () {
        request()
            ->user()
            ->notify(new InvoicePaid(toast: true));

        return back();
    });
    $this->actingAs($this->user);

    NotificationPreferences::pause($this->user, now()->addHour());

    $this->post('/invoices/7/pay');

    Toast::assertNothingFlashed();

    expect($this->user->inbox()->sole()->toInboxArray()['quiet'])->toBeTrue();

    NotificationPreferences::resume($this->user);

    $this->travel(1)->minute();
    $this->post('/invoices/7/pay');

    Toast::assertFlashed('Invoice INV-7 paid', 1);

    expect($this->user->inbox()->latest()->first()->toInboxArray())->not->toHaveKey('quiet');
});

it('tells the browser to stay quiet about an announcement during a pause', function (): void {
    $billing = Announcement::make('New invoice layout')->category('billing')->publish();
    $security = Announcement::make('New sign-in rules')->category('security')->publish();
    $quiet = fn (InboxAnnouncement $announcement): ?bool => $this->actingAs($this->user)
        ->getJson("/_inertia-notifications/{$announcement->id}")
        ->assertOk()
        ->json('item.quiet');

    expect($quiet($billing))->toBeNull();

    NotificationPreferences::pause($this->user, now()->addHour());

    expect($quiet($billing))
        ->toBeTrue()
        ->and($quiet($security))
        ->toBeNull();

    NotificationPreferences::resume($this->user);

    expect($quiet($billing))->toBeNull();
});

it('ignores a pause once its end has come', function (): void {
    NotificationPreferences::pause($this->user, now()->addMinutes(30));

    $this->travel(30)->minutes();

    $this->assertNotificationsNotPaused($this->user);

    $this->user->notify(new IssueCommented);

    expect($this->sent)
        ->toBe(['inbox', 'mail'])
        ->and($this->user->inbox()->sole()->toInboxArray())
        ->not->toHaveKey('quiet');
});

it('sends the held mail with the next run once the user resumes', function (): void {
    NotificationPreferences::pause($this->user, now()->addHours(2));

    $this->user->notify(new IssueCommented);

    NotificationPreferences::resume($this->user);
    Notification::fake();

    $this->artisan('inertia-notifications:send-digests');

    $this->assertNotificationsNotPaused($this->user);
    $this->assertDigestSent($this->user, 'Sophie commented on issue #42');
});

it('moves the mail that waits for the notification hours to the end of a pause, and back on resume', function (): void {
    // The notification hours start at 12:00 in New York, which is 17:00 in UTC.
    setNotificationHours($this->user, '12:00-20:00');

    $this->user->notify(new IssueCommented);

    $this->assertHeldForDigest(
        $this->user,
        fn (array $message): bool => $message['sendAt'] === '2026-11-16T17:00:00+00:00',
    );

    NotificationPreferences::pause($this->user, Carbon::parse('2026-11-16 18:00', 'UTC'));

    $this->assertHeldForDigest(
        $this->user,
        fn (array $message): bool => $message['sendAt'] === '2026-11-16T18:00:00+00:00',
    );

    NotificationPreferences::resume($this->user);

    $this->assertHeldForDigest(
        $this->user,
        fn (array $message): bool => $message['sendAt'] === '2026-11-16T17:00:00+00:00',
    );
});

it('moves the held mail to the end of a pause after 2038', function (): void {
    NotificationPreferences::update($this->user, frequencies: ['comments' => 'daily']);

    $this->user->notify(new IssueCommented);

    NotificationPreferences::pause($this->user, Carbon::parse('2099-01-01 08:00', 'UTC'));

    $this->assertHeldForDigest(
        $this->user,
        fn (array $message): bool => $message['sendAt'] === '2099-01-01T08:00:00+00:00',
    );

    Notification::fake();

    $this->travelTo(Carbon::parse('2099-01-01 07:59', 'UTC'));
    $this->artisan('inertia-notifications:send-digests');
    $this->assertNoDigestSent($this->user);

    $this->travelTo(Carbon::parse('2099-01-01 08:00', 'UTC'));
    $this->artisan('inertia-notifications:send-digests');
    $this->assertDigestSent($this->user, 'Sophie commented on issue #42');
});

it('holds a digest whose time falls within a pause until the pause ends', function (): void {
    NotificationPreferences::update($this->user, frequencies: ['comments' => 'daily']);

    // Tuesday, 07:00 in New York, paused until 09:30.
    $this->travelTo(Carbon::parse('2026-11-17 12:00', 'UTC'));
    NotificationPreferences::pause($this->user, Carbon::parse('2026-11-17 14:30', 'UTC'));

    $this->user->notify(new IssueCommented);

    // The digest of 08:00 in New York waits until the pause ends.
    $this->assertHeldForDigest(
        $this->user,
        fn (array $message): bool => $message['sendAt'] === '2026-11-17T14:30:00+00:00',
    );

    Notification::fake();

    $this->travelTo(Carbon::parse('2026-11-17 13:00', 'UTC'));
    $this->artisan('inertia-notifications:send-digests');
    $this->assertNoDigestSent($this->user);

    $this->travelTo(Carbon::parse('2026-11-17 14:30', 'UTC'));
    $this->artisan('inertia-notifications:send-digests');
    $this->assertDigestSent($this->user, 'Sophie commented on issue #42');
});

it('sends a digest that came due during the pause with the next run once the user resumes', function (): void {
    NotificationPreferences::update($this->user, frequencies: ['comments' => 'daily']);
    $this->user->notify(new IssueCommented);

    // Tuesday, 07:00 in New York, an hour before the digest of 08:00, paused until 15:00.
    $this->travelTo(Carbon::parse('2026-11-17 12:00', 'UTC'));
    NotificationPreferences::pause($this->user, now()->addHours(8));

    $this->assertHeldForDigest(
        $this->user,
        fn (array $message): bool => $message['sendAt'] === '2026-11-17T20:00:00+00:00',
    );

    // Tuesday, 09:00 in New York, after the time of the digest.
    $this->travelTo(Carbon::parse('2026-11-17 14:00', 'UTC'));
    NotificationPreferences::resume($this->user);

    $this->assertHeldForDigest(
        $this->user,
        fn (array $message): bool => $message['sendAt'] === '2026-11-17T14:00:00+00:00',
    );

    Notification::fake();

    $this->artisan('inertia-notifications:send-digests');

    $this->assertDigestSent($this->user, 'Sophie commented on issue #42');
});

it('keeps the held mail in the next digest of its new frequency when the user pauses', function (): void {
    NotificationPreferences::update($this->user, frequencies: ['comments' => 'weekly']);
    $this->user->notify(new IssueCommented);

    // Wednesday, 10:00 in New York, so the mail moves to the daily digest of 08:00 on Thursday.
    $this->travelTo(Carbon::parse('2026-11-18 15:00', 'UTC'));
    NotificationPreferences::update($this->user, frequencies: ['comments' => 'daily']);
    NotificationPreferences::pause($this->user, now()->addMinutes(30));

    $this->assertHeldForDigest(
        $this->user,
        fn (array $message): bool => $message['sendAt'] === '2026-11-19T13:00:00+00:00',
    );
});

it('keeps the held mail in the next digest of the new timezone of the user when the user pauses', function (): void {
    NotificationPreferences::update($this->user, frequencies: ['comments' => 'daily']);
    $this->user->notify(new IssueCommented);

    // Monday, 19:00 in New York, which is Tuesday, 09:00 in Tokyo, so the mail moves from the digest of
    // 08:00 on Tuesday in New York to the digest of 08:00 on Wednesday in Tokyo.
    $this->travelTo(Carbon::parse('2026-11-17 00:00', 'UTC'));
    NotificationPreferences::update($this->user, timezone: 'Asia/Tokyo');
    NotificationPreferences::pause($this->user, now()->addMinutes(30));

    $this->assertHeldForDigest(
        $this->user,
        fn (array $message): bool => $message['sendAt'] === '2026-11-17T23:00:00+00:00',
    );
});

it('postpones the held mail that comes due during a pause until the pause ends', function (): void {
    NotificationPreferences::update($this->user, frequencies: ['comments' => 'daily']);
    $this->user->notify(new IssueCommented);
    NotificationPreferences::pause($this->user, now()->addHours(2));

    Digest::query($this->user)->update(['send_at' => now()]);
    Notification::fake();

    $this->artisan('inertia-notifications:send-digests');

    $this->assertNoDigestSent($this->user);
    $this->assertHeldForDigest(
        $this->user,
        fn (array $message): bool => $message['sendAt'] === '2026-11-16T17:00:00+00:00',
    );
});

it('throws for a pause that does not end in the future, and saves nothing', function (
    string $until,
    string $message,
): void {
    Event::fake([NotificationsPaused::class]);

    expect(fn () => NotificationPreferences::pause($this->user, Carbon::parse($until, 'UTC')))
        ->toThrow(InvalidArgumentException::class, $message);

    $this->assertNotificationsNotPaused($this->user);

    Event::assertNotDispatched(NotificationsPaused::class);
})->with([
    'now' => [
        '2026-11-16 15:00',
        'The time to pause the notifications until [2026-11-16T15:00:00+00:00] must be in the future.',
    ],
    'a minute ago' => [
        '2026-11-16 14:59',
        'The time to pause the notifications until [2026-11-16T14:59:00+00:00] must be in the future.',
    ],
]);

it('stores the end of the pause in UTC with the settings of the user', function (): void {
    $settings = fn (): array => NotificationPreference::query()
        ->where('category', '*')
        ->where('channel', '*')
        ->sole()
        ->settings;

    NotificationPreferences::pause($this->user, Carbon::parse('2026-11-16 11:00', 'America/New_York'));

    expect($settings())->toBe(['timezone' => 'America/New_York', 'paused_until' => '2026-11-16T16:00:00+00:00']);

    NotificationPreferences::resume($this->user);

    expect($settings())->toBe(['timezone' => 'America/New_York', 'paused_until' => null]);
});

it('keeps the settings that another request stored first for a user without settings', function (): void {
    $maria = User::named('Maria');

    // The other request stores the first settings of the user right after this one looked for them.
    $raced = runOnceAfterQuery(
        fn (string $sql): bool => str_starts_with($sql, 'select') && str_contains($sql, 'notification_preferences'),
        fn () => NotificationPreferences::update($maria, timezone: 'Europe/Amsterdam'),
    );

    NotificationPreferences::pause($maria, Carbon::parse('2026-11-16 16:00', 'UTC'));

    expect($raced())
        ->toBeTrue()
        ->and(NotificationPreferences::timezone($maria))
        ->toBe('Europe/Amsterdam');

    $this->assertNotificationsPaused($maria, Carbon::parse('2026-11-16 16:00', 'UTC'));
});

it('saves a pause while the application does not offer pausing, and ignores it until it does', function (): void {
    config()->set('inertia-notifications.pause.enabled', false);

    NotificationPreferences::pause($this->user, now()->addHour());

    $this->user->notify(new IssueCommented);

    expect($this->sent)
        ->toBe(['inbox', 'mail'])
        ->and(NotificationPreferences::pausedUntil($this->user))
        ->toBeNull();

    config()->set('inertia-notifications.pause.enabled', true);

    $this->assertNotificationsPaused($this->user, Carbon::parse('2026-11-16 16:00', 'UTC'));
});

it('dispatches an event when the user pauses and when the user resumes', function (): void {
    Event::fake([NotificationsPaused::class, NotificationsResumed::class]);
    $until = now()->addHour();

    NotificationPreferences::pause($this->user, $until);
    NotificationPreferences::resume($this->user);

    Event::assertDispatchedTimes(NotificationsPaused::class, 1);
    Event::assertDispatched(
        NotificationsPaused::class,
        fn (NotificationsPaused $event): bool => $event->notifiable->is($this->user) && $event->until->equalTo($until),
    );
    Event::assertDispatchedTimes(NotificationsResumed::class, 1);
    Event::assertDispatched(
        NotificationsResumed::class,
        fn (NotificationsResumed $event): bool => $event->notifiable->is($this->user),
    );
});

it('dispatches no event when the user resumes without a pause', function (): void {
    Event::fake([NotificationsResumed::class]);

    NotificationPreferences::resume($this->user);

    NotificationPreferences::pause($this->user, now()->addHour());
    $this->travel(1)->hour();
    NotificationPreferences::resume($this->user);

    Event::assertNotDispatched(NotificationsResumed::class);
});

it('pauses and resumes the notifications of the signed-in user through the endpoints', function (): void {
    Event::fake([InboxChanged::class]);
    $this->actingAs($this->user);

    expect(route('inertia-notifications.pause', absolute: false))
        ->toBe('/_inertia-notifications/pause')
        ->and(route('inertia-notifications.resume', absolute: false))
        ->toBe('/_inertia-notifications/resume');

    $this->postJson('/_inertia-notifications/pause', ['until' => '2026-11-16T12:30:00-05:00'])
        ->assertOk()
        ->assertJsonStructure(['counts' => ['unread', 'unseen', 'categories', 'latest', 'latestIds', 'revision']])
        ->assertJsonPath('change', ['kind' => 'pause', 'until' => '2026-11-16T17:30:00+00:00']);

    $this->assertNotificationsPaused($this->user, Carbon::parse('2026-11-16 17:30', 'UTC'));

    $this->postJson('/_inertia-notifications/resume')
        ->assertOk()
        ->assertJsonStructure(['counts' => ['unread', 'unseen', 'categories', 'latest', 'latestIds', 'revision']])
        ->assertJsonPath('change', ['kind' => 'pause', 'until' => null]);

    $this->assertNotificationsNotPaused($this->user);

    Event::assertNotDispatched(InboxChanged::class);
});

it('rejects a pause time that is missing, not a date, or not in the future', function (array $data): void {
    $this->actingAs($this->user)
        ->postJson('/_inertia-notifications/pause', $data)
        ->assertUnprocessable()
        ->assertJsonValidationErrors('until');

    $this->assertNotificationsNotPaused($this->user);
})->with([
    'no time' => [[]],
    'a time that is not a date' => [['until' => 'later']],
    'the current time' => [['until' => '2026-11-16T15:00:00+00:00']],
    'a time in the past' => [['until' => '2026-11-16T14:59:00+00:00']],
]);

it('answers the pause endpoints with a 404 while the application does not offer pausing', function (): void {
    config()->set('inertia-notifications.pause.enabled', false);
    $this->actingAs($this->user);

    $this->postJson('/_inertia-notifications/pause', ['until' => '2026-11-16T16:00:00+00:00'])
        ->assertNotFound();
    $this->postJson('/_inertia-notifications/pause', ['until' => 'later'])
        ->assertNotFound();
    $this->postJson('/_inertia-notifications/resume')
        ->assertNotFound();

    config()->set('inertia-notifications.pause.enabled', true);

    $this->assertNotificationsNotPaused($this->user);
});

it('broadcasts the pause to the other sessions of the user', function (): void {
    Event::fake([InboxChanged::class]);
    config()->set('inertia-notifications.inbox.broadcast_changes', true);
    $this->actingAs($this->user);

    $this->postJson(
        '/_inertia-notifications/pause',
        ['until' => '2026-11-16T16:00:00+00:00'],
        ['X-Socket-ID' => '1234.5678'],
    )->assertOk();
    $this->postJson('/_inertia-notifications/resume')
        ->assertOk();

    $events = Event::dispatched(InboxChanged::class)->map(fn (array $args) => $args[0]);
    [$paused, $resumed] = $events->all();

    expect($events)
        ->toHaveCount(2)
        ->and($paused->broadcastOn())
        ->toEqual([new PrivateChannel("InertiaUI.Notifications.Tests.Fixtures.User.{$this->user->id}")])
        // The session that paused already shows it.
        ->and($paused->socket)
        ->toBe('1234.5678')
        ->and($paused->broadcastWith()['change'])
        ->toBe(['kind' => 'pause', 'until' => '2026-11-16T16:00:00+00:00'])
        ->and($resumed->socket)
        ->toBeNull()
        ->and($resumed->broadcastWith()['change'])
        ->toBe(['kind' => 'pause', 'until' => null]);
});

it('shares the pause of the user with every page while the application offers pausing', function (): void {
    $presets = [30, 60, 120, 'tomorrow'];

    expect(sharedInbox($this->user)['pause'])->toBe(['until' => null, 'presets' => $presets]);

    NotificationPreferences::pause($this->user, now()->addHour());

    expect(sharedInbox($this->user)['pause'])->toBe(['until' => '2026-11-16T16:00:00+00:00', 'presets' => $presets]);

    $this->travel(1)->hour();

    expect(sharedInbox($this->user)['pause'])->toBe(['until' => null, 'presets' => $presets]);
});

it('shares the times of the pause button from the config, without times that are not a positive number of minutes', function (): void {
    config(['inertia-notifications.pause.presets' => ['tomorrow', 45, '90', 0, -15, 'later', 1.5, 45, 'tomorrow']]);

    expect(sharedInbox($this->user)['pause']['presets'])->toBe(['tomorrow', 45, 90]);

    config(['inertia-notifications.pause.presets' => []]);

    expect(sharedInbox($this->user)['pause']['presets'])->toBe([]);
});

it('takes the revision of the shared prop before it reads the pause', function (): void {
    $pauseReadAt = null;

    // Each query takes a second, so the revision tells which queries ran before
    // it. The browser applies the shared pause with this revision, so it has to
    // be taken before the pause is read, as it is for the counts.
    DB::listen(function (QueryExecuted $query) use (&$pauseReadAt): void {
        if ($pauseReadAt === null && str_contains($query->sql, 'notification_preferences')) {
            $pauseReadAt = (int) now()->getPreciseTimestamp();
        }

        $this->travel(1)->second();
    });

    $revision = sharedInbox($this->user)['revision'];

    expect($pauseReadAt)
        ->toBeInt()
        ->and($revision)
        ->toBeLessThanOrEqual($pauseReadAt);
});

it('reads the preferences once to tell whether notifications do not disturb the user', function (): void {
    // The pause ends at 11:00 in New York, and the notification hours start at 12:00.
    setNotificationHours($this->user, '12:00-20:00');
    NotificationPreferences::pause($this->user, now()->addHour());

    DB::enableQueryLog();

    expect(DoNotDisturb::active($this->user))
        ->toBeTrue()
        ->and(DB::getQueryLog())
        ->toHaveCount(1);

    DB::flushQueryLog();

    expect(DoNotDisturb::endsAt($this->user, now())->toIso8601String())
        ->toBe('2026-11-16T17:00:00+00:00')
        ->and(DB::getQueryLog())
        ->toHaveCount(1);
});

it('reads no preferences to tell whether notifications do not disturb the user while neither is offered', function (): void {
    config()->set('inertia-notifications.pause.enabled', false);
    NotificationPreferences::pause($this->user, now()->addHour());

    DB::enableQueryLog();

    expect(DoNotDisturb::active($this->user))
        ->toBeFalse()
        ->and(DoNotDisturb::endsAt($this->user, now())->toIso8601String())
        ->toBe('2026-11-16T15:00:00+00:00')
        ->and(DB::getQueryLog())
        ->toBeEmpty();
});

it('resolves the timezone of the user only while the notification hours apply', function (): void {
    $resolved = 0;

    NotificationPreferences::resolveTimezoneUsing(function () use (&$resolved): string {
        $resolved++;

        return 'America/New_York';
    });
    NotificationPreferences::pause($this->user, now()->addHour());

    DoNotDisturb::active($this->user);

    expect($resolved)->toBe(0);

    setNotificationHours($this->user, '12:00-20:00');
    $resolved = 0;

    DoNotDisturb::active($this->user);

    expect($resolved)->toBe(1);
});

it('tells whether the pause covered a time once the pause has ended', function (): void {
    NotificationPreferences::pause($this->user, now()->addMinutes(30));

    $this->travel(1)->hour();

    expect(DoNotDisturb::active($this->user, Carbon::parse('2026-11-16 15:15', 'UTC')))
        ->toBeTrue()
        ->and(DoNotDisturb::active($this->user, Carbon::parse('2026-11-16 15:30', 'UTC')))
        ->toBeFalse();
});

it('shares no pause while the application does not offer pausing', function (): void {
    NotificationPreferences::pause($this->user, now()->addHour());

    config()->set('inertia-notifications.pause.enabled', false);

    expect(sharedInbox($this->user))
        ->toHaveKey('pause')
        ->and(sharedInbox($this->user)['pause'])
        ->toBeNull();
});
