<?php

use Carbon\CarbonImmutable;
use Illuminate\Notifications\Events\NotificationSent;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Exceptions;
use Illuminate\Support\Facades\Notification;
use InertiaUI\Notifications\Digest;
use InertiaUI\Notifications\Events\NotificationPreferencesChanged;
use InertiaUI\Notifications\Inbox;
use InertiaUI\Notifications\InboxMessage;
use InertiaUI\Notifications\NotificationPreferences;
use InertiaUI\Notifications\Notifications\NotificationDigest;
use InertiaUI\Notifications\Testing\InteractsWithNotificationCenter;
use InertiaUI\Notifications\Tests\Fixtures\ApplicationServiceProvider;
use InertiaUI\Notifications\Tests\Fixtures\CommentAdded;
use InertiaUI\Notifications\Tests\Fixtures\CommentPosted;
use InertiaUI\Notifications\Tests\Fixtures\IssueCommented;
use InertiaUI\Notifications\Tests\Fixtures\User;

uses(InteractsWithNotificationCenter::class);

beforeEach(function (): void {
    config()->set('inertia-notifications.preferences.categories', [
        'comments' => ['label' => 'Comments', 'digest' => true],
        'reports' => ['label' => 'Reports', 'digest' => true],
        'deployments' => ['label' => 'Deployments', 'channels' => ['inbox'], 'digest' => true],
        'billing' => ['label' => 'Billing'],
        'security' => ['label' => 'Security', 'locked' => true, 'digest' => true],
    ]);

    registerNotificationRoutes();

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
 * Send the digests whose time has come at the given time, in UTC.
 */
function sendDigestsAt(string $time): void
{
    test()->travelTo(Carbon::parse($time, 'UTC'));
    test()->artisan('inertia-notifications:send-digests')->assertSuccessful();
}

/**
 * Get the lines of the plain text version of the given digest mail, without the blank lines.
 *
 * @return list<string>
 */
function digestMailText(MailMessage $mail): array
{
    $text = view($mail->view['text'], $mail->data())->render();

    return array_values(array_filter(explode("\n", $text), fn (string $line): bool => trim($line) !== ''));
}

it('stores the notification right away and holds its mail for the digest', function (): void {
    NotificationPreferences::update($this->user, frequencies: ['comments' => 'daily']);

    $this->user->notify(new IssueCommented);

    expect($this->sent)->toBe(['inbox']);

    $this->assertInboxMessage($this->user, 'Sophie commented on issue #42');
    $this->assertHeldForDigest($this->user, fn (array $message): bool => $message['title'] === 'Sophie commented on issue #42'
        && $message['channels'] === ['mail']
        && $message['sendAt'] === '2026-11-17T13:00:00+00:00');
});

it('asks the listeners that the application registers while it boots about a channel before holding it', function (): void {
    NotificationPreferences::update($this->user, frequencies: ['comments' => 'daily']);

    $this->user->notify(new IssueCommented);

    expect(ApplicationServiceProvider::$sending)->toBe(['inbox', 'mail']);
    $this->assertHeldForDigest($this->user, 'Sophie commented on issue #42');
});

it('sends the mail right away while the user receives the category instantly', function (): void {
    $this->user->notify(new IssueCommented);
    $this->user->notify(new IssueCommented(category: 'billing'));

    expect($this->sent)->toBe(['inbox', 'mail', 'inbox', 'mail']);

    $this->assertNothingHeldForDigest($this->user);
});

it('sends one digest per user at the digest time in their timezone', function (): void {
    NotificationPreferences::update($this->user, frequencies: ['comments' => 'daily', 'reports' => 'daily']);
    $sophie = User::named('Sophie');
    NotificationPreferences::update($sophie, frequencies: ['comments' => 'daily'], timezone: 'Europe/Amsterdam');

    $this->user->notify(new IssueCommented(42));
    $this->user->notify(new IssueCommented(43, 'reports'));
    $sophie->notify(new IssueCommented(44));

    Notification::fake();

    sendDigestsAt('2026-11-17 06:59');
    $this->assertNoDigestSent($sophie);

    sendDigestsAt('2026-11-17 07:00');
    $this->assertDigestSent($sophie, 'Sophie commented on issue #44');
    $this->assertNoDigestSent($this->user);

    sendDigestsAt('2026-11-17 13:00');
    Notification::assertSentTimes(NotificationDigest::class, 2);
    Notification::assertSentTo($this->user, function (NotificationDigest $digest, array $channels): bool {
        return $channels === ['mail']
            && array_column($digest->messages('mail'), 'title') === [
                'Sophie commented on issue #42',
                'Sophie commented on issue #43',
            ];
    });

    $this->assertNothingHeldForDigest($this->user);
    $this->assertNothingHeldForDigest($sophie);
});

it('sends the digests of the other users when one fails, and sends the failed digest on the next run', function (): void {
    Exceptions::fake();
    $sophie = User::named('Sophie');
    NotificationPreferences::update($this->user, frequencies: ['comments' => 'daily']);
    NotificationPreferences::update($sophie, frequencies: ['comments' => 'daily'], timezone: 'America/New_York');

    $this->user->notify(new IssueCommented(42));
    $sophie->notify(new IssueCommented(43));

    // The users are read in no particular order, so the mail of whichever digest comes first fails.
    $mail = new class
    {
        public bool $failed = false;

        /** @var list<User> */
        public array $received = [];

        public function send(User $notifiable, NotificationDigest $digest): void
        {
            if (! $this->failed) {
                $this->failed = true;

                throw new RuntimeException('The mail server is down.');
            }

            $this->received[] = $notifiable;
        }
    };

    Notification::extend('mail', fn (): object => $mail);

    $this->travelTo(Carbon::parse('2026-11-17 13:00', 'UTC'));
    $this->artisan('inertia-notifications:send-digests')
        ->expectsOutputToContain('Sent 1 digests.')
        ->assertSuccessful();

    Exceptions::assertReported(fn (RuntimeException $exception): bool => $exception->getMessage() === 'The mail server is down.');

    expect($mail->received)->toHaveCount(1);

    $sent = $mail->received[0];
    $failed = $sent->is($this->user) ? $sophie : $this->user;

    $this->assertNothingHeldForDigest($sent);
    expect(Digest::query($failed)->due()->count())->toBe(1);

    sendDigestsAt('2026-11-17 13:01');

    expect($mail->received)
        ->toHaveCount(2)
        ->and($mail->received[1]->is($failed))
        ->toBeTrue();

    $this->assertNothingHeldForDigest($failed);
});

it('sends the digest of each channel once while the digest of another channel fails', function (): void {
    Exceptions::fake();
    config()->set('inertia-notifications.preferences.channels.sms', ['label' => 'Text messages', 'via' => ['sms']]);
    config()->set('inertia-notifications.digests.channels', ['mail', 'sms']);
    NotificationPreferences::update($this->user, frequencies: ['comments' => 'daily']);

    $mail = new class
    {
        public int $sent = 0;

        public function send(User $notifiable, NotificationDigest $digest): void
        {
            $this->sent++;
        }
    };

    Notification::extend('mail', fn (): object => $mail);
    Notification::extend('sms', fn (): object => new class
    {
        public function send(User $notifiable, NotificationDigest $digest): void
        {
            throw new RuntimeException('The text message gateway is down.');
        }
    });

    $this->user->notifyNow(new class extends IssueCommented
    {
        /**
         * Get the notification's delivery channels.
         *
         * @return list<string>
         */
        public function via(object $notifiable): array
        {
            return ['inbox', 'mail', 'sms'];
        }
    });

    sendDigestsAt('2026-11-17 13:00');
    sendDigestsAt('2026-11-17 13:01');

    Exceptions::assertReportedCount(2);
    expect($mail->sent)
        ->toBe(1)
        ->and(Digest::query($this->user)->pluck('channel')->all())
        ->toBe(['sms']);
});

it('sends the weekly digest on the weekday, with the daily notifications that are due then', function (): void {
    NotificationPreferences::update($this->user, frequencies: ['comments' => 'daily', 'reports' => 'weekly']);

    $this->user->notify(new IssueCommented(43, 'reports'));

    $this->assertHeldForDigest($this->user, fn (array $message): bool => $message['sendAt'] === '2026-11-23T13:00:00+00:00');

    $this->travelTo(Carbon::parse('2026-11-22 20:00', 'UTC'));
    $this->user->notify(new IssueCommented(42));

    Notification::fake();

    sendDigestsAt('2026-11-17 13:00');
    $this->assertNoDigestSent($this->user);

    sendDigestsAt('2026-11-23 13:00');
    Notification::assertSentTimes(NotificationDigest::class, 1);
    $this->assertDigestSent($this->user, 'Sophie commented on issue #43');
    $this->assertDigestSent($this->user, 'Sophie commented on issue #42');
});

it('leaves a notification out of the digest once it was read while it waited with unlessReadWithin()', function (): void {
    NotificationPreferences::update($this->user, frequencies: ['comments' => 'daily']);

    $this->user->notify(new IssueCommented(42, unlessRead: true));
    $this->user->notify(new IssueCommented(43, unlessRead: true));
    $this->user->notify(new IssueCommented(44));

    $this->user->inbox()
        ->get()
        ->reject(fn ($notification): bool => $notification->toInboxArray()['title'] === 'Sophie commented on issue #43')
        ->each->markAsRead();

    Notification::fake();

    sendDigestsAt('2026-11-17 13:00');

    Notification::assertSentTo($this->user, fn (NotificationDigest $digest): bool => array_column(
        $digest->messages('mail'),
        'title',
    ) === ['Sophie commented on issue #43', 'Sophie commented on issue #44']);
});

it('leaves out the notifications of a category that the user turned off since', function (): void {
    NotificationPreferences::update($this->user, frequencies: ['comments' => 'daily', 'reports' => 'daily']);

    $this->user->notify(new IssueCommented(42));
    $this->user->notify(new IssueCommented(43, 'reports'));

    NotificationPreferences::update($this->user, ['reports' => ['mail' => false]]);

    Notification::fake();

    sendDigestsAt('2026-11-17 13:00');

    $this->assertDigestSent($this->user, 'Sophie commented on issue #42');
    Notification::assertSentTo($this->user, fn (NotificationDigest $digest): bool => count($digest->messages()) === 1);
    $this->assertNothingHeldForDigest($this->user);
});

it('leaves out a notification that was retracted, and shows the new message of one that was updated', function (): void {
    NotificationPreferences::update($this->user, frequencies: ['comments' => 'daily']);

    $this->user->notify(new IssueCommented(42));
    $this->user->notify(new IssueCommented(43));
    $this->user->notify(new IssueCommented(44));

    $inbox = $this->user->inbox()->get()->keyBy(fn ($notification): string => $notification->toInboxArray()['title']);

    Inbox::retract($inbox['Sophie commented on issue #42']);
    Inbox::update($inbox['Sophie commented on issue #44'], InboxMessage::make('Sophie edited a comment on issue #44'));

    Notification::fake();

    sendDigestsAt('2026-11-17 13:00');

    Notification::assertSentTo($this->user, fn (NotificationDigest $digest): bool => array_column(
        $digest->messages('mail'),
        'title',
    ) === ['Sophie commented on issue #43', 'Sophie edited a comment on issue #44']);
    $this->assertNothingHeldForDigest($this->user);
});

it('sends the notifications that collapsed into one row once, as the newest of them with the message of the row', function (): void {
    NotificationPreferences::update($this->user, frequencies: ['comments' => 'daily']);

    $this->user->notify(new CommentAdded(User::named('Sophie'), ['inbox', 'mail']));
    $this->user->notify(new CommentAdded(User::named('Maria'), ['inbox', 'mail']));
    $this->user->notify(new CommentAdded(User::named('Liam'), ['inbox', 'mail']));

    $collapsed = $this->user->inbox()->sole()->collapsed['ids'];

    Notification::fake();

    sendDigestsAt('2026-11-17 13:00');

    Notification::assertSentTimes(NotificationDigest::class, 1);
    Notification::assertSentTo($this->user, fn (NotificationDigest $digest): bool => array_map(
        fn (array $message): array => [$message['id'], $message['title']],
        $digest->messages('mail'),
    ) === [[$collapsed[2], 'Liam commented on issue #42']]);
    $this->assertNothingHeldForDigest($this->user);
});

it('names every actor of a row that notifications collapsed into with the :actors replacement of the title', function (): void {
    NotificationPreferences::update($this->user, frequencies: ['comments' => 'daily']);

    foreach (['Sophie', 'Maria', 'Liam'] as $name) {
        $this->user->notify(new CommentAdded(User::named($name), ['inbox', 'mail'], title: ':actors commented on issue #:number'));
    }

    Notification::fake();

    sendDigestsAt('2026-11-17 13:00');

    $this->assertDigestSent($this->user, 'Liam and 2 others commented on issue #42');
});

it('sends the held mail of a notification that collapsed into the row of a notification without mail', function (): void {
    NotificationPreferences::update($this->user, frequencies: ['comments' => 'daily']);

    $this->user->notify(new CommentAdded(User::named('Sophie')));
    $this->user->notify(new CommentAdded(User::named('Maria'), ['inbox', 'mail']));

    Notification::fake();

    sendDigestsAt('2026-11-17 13:00');

    $this->assertDigestSent($this->user, 'Maria commented on issue #42');
    $this->assertNothingHeldForDigest($this->user);
});

it('leaves out every notification that collapsed into a row that was retracted', function (): void {
    NotificationPreferences::update($this->user, frequencies: ['comments' => 'daily']);

    $this->user->notify(new CommentAdded(User::named('Sophie'), ['inbox', 'mail']));
    $this->user->notify(new CommentAdded(User::named('Maria'), ['inbox', 'mail']));
    $this->user->notify(new CommentAdded(User::named('Liam'), ['inbox', 'mail']));

    Inbox::retract($this->user->inbox()->sole());

    Notification::fake();

    sendDigestsAt('2026-11-17 13:00');

    $this->assertNoDigestSent($this->user);
    $this->assertNothingHeldForDigest($this->user);
});

it('sends a notification that the notification center does not store', function (): void {
    NotificationPreferences::update($this->user, ['comments' => ['inbox' => false]], frequencies: ['comments' => 'daily']);

    $this->user->notify(new IssueCommented);

    expect($this->sent)->toBe([]);

    Notification::fake();

    sendDigestsAt('2026-11-17 13:00');

    $this->assertDigestSent($this->user, 'Sophie commented on issue #42');
});

it('sends the mail of a notification without toInbox() right away, since the digest has no message for it', function (): void {
    NotificationPreferences::update($this->user, frequencies: ['comments' => 'daily']);

    $this->user->notify(new class extends CommentPosted
    {
        /**
         * Get the notification's delivery channels.
         *
         * @return list<string>
         */
        public function via(object $notifiable): array
        {
            return ['database', 'mail'];
        }

        /**
         * Get the preference category of the notification.
         */
        public function notificationCategory(object $notifiable): string
        {
            return 'comments';
        }

        /**
         * Get the mail representation of the notification.
         */
        public function toMail(object $notifiable): MailMessage
        {
            return (new MailMessage)->line('Sophie commented on your post.');
        }
    });

    expect($this->sent)->toBe(['database', 'mail']);
    $this->assertNothingHeldForDigest($this->user);
});

it('sends no digest when every held notification was left out', function (): void {
    NotificationPreferences::update($this->user, frequencies: ['comments' => 'daily']);

    $this->user->notify(new IssueCommented(42, unlessRead: true));
    $this->user->inbox()->sole()->markAsRead();

    Notification::fake();

    sendDigestsAt('2026-11-17 13:00');

    $this->assertNoDigestSent($this->user);
    $this->assertNothingHeldForDigest($this->user);
});

it('moves the held notifications to the next digest of their new frequency', function (): void {
    NotificationPreferences::update($this->user, frequencies: ['comments' => 'daily']);
    $this->user->notify(new IssueCommented);

    NotificationPreferences::update($this->user, frequencies: ['comments' => 'weekly']);

    $this->assertHeldForDigest($this->user, fn (array $message): bool => $message['sendAt'] === '2026-11-23T13:00:00+00:00');

    NotificationPreferences::update($this->user, frequencies: ['comments' => 'instant']);
    Notification::fake();

    sendDigestsAt('2026-11-16 15:01');

    $this->assertDigestSent($this->user, 'Sophie commented on issue #42');
});

it('moves the held notifications to the digest time in the new timezone of the user', function (): void {
    NotificationPreferences::update($this->user, frequencies: ['comments' => 'daily']);
    $this->user->notify(new IssueCommented);

    NotificationPreferences::update($this->user, timezone: 'Europe/Amsterdam');

    // 08:00 in Amsterdam is 07:00 in UTC.
    $this->assertHeldForDigest($this->user, fn (array $message): bool => $message['sendAt'] === '2026-11-17T07:00:00+00:00');

    // Tuesday, 08:30 in Amsterdam, before the command sent the digest of 08:00. The timezone that
    // the resolver returns stays the timezone of the user, so the timezone of the browser moves nothing.
    $this->travelTo(Carbon::parse('2026-11-17 07:30', 'UTC'));
    NotificationPreferences::resolveTimezoneUsing(fn (): string => 'Europe/Amsterdam');
    NotificationPreferences::update($this->user, timezone: 'Asia/Tokyo');

    $this->assertHeldForDigest($this->user, fn (array $message): bool => $message['sendAt'] === '2026-11-17T07:00:00+00:00');
});

it('leaves the held notifications of the other categories in their digest when the user changes a frequency', function (): void {
    NotificationPreferences::update($this->user, frequencies: ['comments' => 'daily', 'reports' => 'daily']);
    $this->user->notify(new IssueCommented(42));
    $this->user->notify(new IssueCommented(43, 'reports'));

    // Tuesday, 09:00 in New York, before the command sent the digest of 08:00.
    $this->travelTo(Carbon::parse('2026-11-17 14:00', 'UTC'));

    $this->actingAs($this->user)
        ->postJson('/_inertia-notifications/preferences', [
            'frequencies' => ['reports' => 'weekly'],
            'timezone' => 'America/New_York',
        ])
        ->assertOk();

    $this->assertHeldForDigest($this->user, fn (array $message): bool => $message['title'] === 'Sophie commented on issue #42'
        && $message['sendAt'] === '2026-11-17T13:00:00+00:00');
    $this->assertHeldForDigest($this->user, fn (array $message): bool => $message['title'] === 'Sophie commented on issue #43'
        && $message['sendAt'] === '2026-11-23T13:00:00+00:00');
});

it('moves the held notifications of a user in the application timezone only once the browser sends another timezone', function (): void {
    config()->set('app.timezone', 'Europe/Amsterdam');
    date_default_timezone_set('Europe/Amsterdam');

    try {
        $sophie = User::named('Sophie');
        NotificationPreferences::update($sophie, frequencies: ['comments' => 'daily']);
        $sophie->notify(new IssueCommented);

        // Tuesday, 09:00 in Amsterdam, before the command sent the digest of 08:00. Older Carbon versions read
        // stored dates in the timezone of the frozen time, so it is frozen in the application's timezone.
        $this->travelTo(Carbon::parse('2026-11-17 09:00', 'Europe/Amsterdam'));

        NotificationPreferences::update($sophie, frequencies: ['reports' => 'weekly'], timezone: 'Europe/Amsterdam');

        $this->assertHeldForDigest($sophie, fn (array $message): bool => $message['category'] === 'comments'
            && $message['sendAt'] === '2026-11-17T08:00:00+01:00');

        NotificationPreferences::update($sophie, timezone: 'America/New_York');

        // 08:00 in New York is 14:00 in Amsterdam.
        $this->assertHeldForDigest($sophie, fn (array $message): bool => $message['category'] === 'comments'
            && $message['sendAt'] === '2026-11-17T14:00:00+01:00');
    } finally {
        date_default_timezone_set('UTC');
    }
});

it('finds the time of the next digest while the application uses immutable dates', function (): void {
    Date::use(CarbonImmutable::class);

    try {
        config()->set('inertia-notifications.digests.weekday', 'thursday');

        // Monday, 09:00 in New York, after the digest time of 08:00.
        $this->travelTo(Carbon::parse('2026-11-16 14:00', 'UTC'));

        NotificationPreferences::update($this->user, frequencies: ['comments' => 'daily', 'reports' => 'weekly']);

        $this->user->notify(new IssueCommented);
        $this->user->notify(new IssueCommented(43, 'reports'));

        $this->assertHeldForDigest($this->user, fn (array $message): bool => $message['category'] === 'comments'
            && $message['sendAt'] === '2026-11-17T13:00:00+00:00');
        $this->assertHeldForDigest($this->user, fn (array $message): bool => $message['category'] === 'reports'
            && $message['sendAt'] === '2026-11-19T13:00:00+00:00');
    } finally {
        Date::useDefault();
    }
});

it('finds the next full hour in the timezone of the user for hourly digests', function (
    string $timezone,
    string $time,
    string $sendAt,
): void {
    NotificationPreferences::update($this->user, frequencies: ['comments' => 'hourly'], timezone: $timezone);

    $this->travelTo(Carbon::parse($time, 'UTC'));

    $this->user->notify(new IssueCommented);

    $this->assertHeldForDigest($this->user, fn (array $message): bool => $message['sendAt'] === $sendAt);
})->with([
    // 10:15 in New York, so 11:00 there.
    'at 10:15 in New York' => ['America/New_York', '2026-11-16 15:15', '2026-11-16T16:00:00+00:00'],
    // 10:15 in Kolkata, five and a half hours ahead of UTC, so 11:00 there.
    'at 10:15 in Kolkata' => ['Asia/Kolkata', '2026-11-16 04:45', '2026-11-16T05:30:00+00:00'],
    // 11:00 in Kolkata, so 12:00 there.
    'at 11:00 in Kolkata' => ['Asia/Kolkata', '2026-11-16 05:30', '2026-11-16T06:30:00+00:00'],
]);

it('sends the hourly digest at the next full hour, with the daily notifications that are due then', function (): void {
    config()->set('inertia-notifications.digests.time', '11:00');
    NotificationPreferences::update($this->user, frequencies: ['comments' => 'hourly', 'reports' => 'daily']);

    $this->user->notify(new IssueCommented(42));
    $this->user->notify(new IssueCommented(43, 'reports'));

    // 11:00 in New York.
    $this->assertHeldForDigest(
        $this->user,
        fn (array $message): bool => $message['sendAt'] === '2026-11-16T16:00:00+00:00',
        times: 2,
    );

    Notification::fake();

    sendDigestsAt('2026-11-16 15:59');
    $this->assertNoDigestSent($this->user);

    sendDigestsAt('2026-11-16 16:00');
    Notification::assertSentTimes(NotificationDigest::class, 1);
    Notification::assertSentTo(
        $this->user,
        fn (NotificationDigest $digest): bool => array_column($digest->messages('mail'), 'title') === [
            'Sophie commented on issue #42',
            'Sophie commented on issue #43',
        ],
    );
});

it('holds a channel only once when the job that sends it is retried', function (): void {
    NotificationPreferences::update($this->user, frequencies: ['comments' => 'daily']);
    $notification = new IssueCommented;
    $notification->id = '9a5f1a2e-1c51-4f2a-9a0b-0f9c3c1d2e3f';

    $this->user->notify($notification);
    $this->user->notify($notification);

    $this->assertHeldForDigest($this->user, 'Sophie commented on issue #42', times: 1);
    $this->assertInboxMessage($this->user, 'Sophie commented on issue #42', times: 1);
});

it('lists the notifications of each category in the mail of the digest, newest first', function (): void {
    NotificationPreferences::update($this->user, frequencies: ['comments' => 'daily', 'reports' => 'daily']);

    $this->user->notify(new IssueCommented(43, 'reports'));
    $this->user->notify(new IssueCommented(42));

    $this->travel(2)->hours();

    $this->user->notify(new IssueCommented(44));

    Notification::fake();

    sendDigestsAt('2026-11-17 13:00');

    $mail = Notification::sent($this->user, NotificationDigest::class)->sole()->toMail($this->user);

    expect($mail->subject)->toBe('You have 3 new notifications');
    expect(digestMailText($mail))->toBe([
        '3 new notifications',
        '2 in Comments and 1 in Reports.',
        'Comments (2)',
        'Sophie commented on issue #44 (Mon 12:00 PM)',
        'Looks *great*!',
        'http://localhost/issues/44',
        'Sophie commented on issue #42 (Mon 10:00 AM)',
        'Looks *great*!',
        'http://localhost/issues/42',
        'Reports (1)',
        'Sophie commented on issue #43 (Mon 10:00 AM)',
        'Looks *great*!',
        'http://localhost/issues/43',
        'You receive this digest because of your notification preferences at Laravel.',
    ]);

    $this->view('inertia-notifications::mail.digest', $mail->data())
        ->assertSeeInOrder(['Comments', 'issues/44', 'issues/42', 'Reports', 'issues/43'])
        ->assertDontSee('View all notifications')
        ->assertDontSee('Manage your preferences');
});

it('links to the inbox and the preferences of the config in the mail of the digest', function (): void {
    config()->set('inertia-notifications.digests.inbox_url', '/notifications');
    config()->set('inertia-notifications.digests.preferences_url', '/settings/notifications');
    NotificationPreferences::update($this->user, frequencies: ['comments' => 'daily']);

    $this->user->notify(new IssueCommented);

    Notification::fake();

    sendDigestsAt('2026-11-17 13:00');

    $mail = Notification::sent($this->user, NotificationDigest::class)->sole()->toMail($this->user);

    expect(digestMailText($mail))->toBe([
        '1 new notification',
        'Comments (1)',
        'Sophie commented on issue #42 (Mon 10:00 AM)',
        'Looks *great*!',
        'http://localhost/issues/42',
        'View all notifications: http://localhost/notifications',
        'You receive this digest because of your notification preferences at Laravel.',
        'Manage your preferences: http://localhost/settings/notifications',
    ]);

    $this->view('inertia-notifications::mail.digest', $mail->data())
        ->assertSee('href="http://localhost/notifications"', false)
        ->assertSee('href="http://localhost/settings/notifications"', false);
});

it('sends the digest with the notification of the config', function (): void {
    $class = get_class(new class([]) extends NotificationDigest {});
    config()->set('inertia-notifications.digests.notification', $class);
    NotificationPreferences::update($this->user, frequencies: ['comments' => 'daily']);
    $this->user->notify(new IssueCommented);

    Notification::fake();

    sendDigestsAt('2026-11-17 13:00');

    Notification::assertSentTo($this->user, $class);
});

it('asserts the held notifications as the digest notification of the config lists them', function (): void {
    $class = get_class(new class([]) extends NotificationDigest
    {
        /**
         * Get the notifications that the given channel sends, or every channel.
         *
         * @return list<array<string, mixed>>
         */
        public function messages(?string $channel = null): array
        {
            return array_map(
                fn (array $message): array => [...$message, 'title' => strtoupper($message['title'])],
                parent::messages($channel),
            );
        }
    });
    config()->set('inertia-notifications.digests.notification', $class);
    NotificationPreferences::update($this->user, frequencies: ['comments' => 'daily']);

    $this->user->notify(new IssueCommented);

    $this->assertHeldForDigest($this->user, 'SOPHIE COMMENTED ON ISSUE #42');
});

it('lists the frequency of each category that users may receive in a digest', function (): void {
    NotificationPreferences::update($this->user, frequencies: ['reports' => 'weekly']);

    $this->actingAs($this->user)
        ->getJson('/_inertia-notifications/preferences')
        ->assertOk()
        ->assertJsonPath('channels.*.digest', [false, true])
        ->assertJsonPath('categories.*.frequency', ['instant', 'weekly', null, null, null]);
});

it('saves the frequency of a category and the timezone of the browser', function (): void {
    Event::fake(NotificationPreferencesChanged::class);

    $this->actingAs($this->user)
        ->postJson('/_inertia-notifications/preferences', [
            'frequencies' => ['comments' => 'daily', 'deployments' => 'daily', 'security' => 'weekly', 'billing' => 'daily'],
            'timezone' => 'Asia/Tokyo',
        ])
        ->assertOk()
        ->assertJsonPath('categories.*.frequency', ['daily', 'instant', null, null, null]);

    $this->assertDigestFrequency($this->user, 'comments', 'daily');
    $this->assertDigestFrequency($this->user, 'security', 'instant');

    expect(NotificationPreferences::timezone($this->user))->toBe('Asia/Tokyo');

    Event::assertDispatched(
        NotificationPreferencesChanged::class,
        fn (NotificationPreferencesChanged $event): bool => $event->frequencies === ['comments' => 'daily']
            && $event->categories === []
            && $event->channels === [],
    );
});

it('rejects an unknown frequency or timezone', function (): void {
    $this->actingAs($this->user)
        ->postJson('/_inertia-notifications/preferences', [
            'frequencies' => ['comments' => 'monthly'],
            'timezone' => 'Mars/Olympus_Mons',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['frequencies.comments', 'timezone']);

    $this->assertDigestFrequency($this->user, 'comments', 'instant');
});

it('lists the frequencies that the application offers, always starting with instant', function (
    array $offered,
    array $listed,
): void {
    config()->set('inertia-notifications.digests.frequencies', $offered);

    $this->actingAs($this->user)
        ->getJson('/_inertia-notifications/preferences')
        ->assertOk()
        ->assertJsonPath('frequencies', $listed);
})->with([
    'every frequency' => [['hourly', 'daily', 'weekly'], ['instant', 'hourly', 'daily', 'weekly']],
    'some frequencies in another order' => [['weekly', 'daily'], ['instant', 'daily', 'weekly']],
    'no digests' => [[], ['instant']],
]);

it('ignores a frequency that the application does not offer', function (): void {
    Event::fake(NotificationPreferencesChanged::class);
    config()->set('inertia-notifications.digests.frequencies', ['daily']);

    NotificationPreferences::update($this->user, frequencies: ['comments' => 'hourly', 'reports' => 'daily']);

    $this->assertDigestFrequency($this->user, 'comments', 'instant');
    $this->assertDigestFrequency($this->user, 'reports', 'daily');

    Event::assertDispatched(
        NotificationPreferencesChanged::class,
        fn (NotificationPreferencesChanged $event): bool => $event->frequencies === ['reports' => 'daily'],
    );

    // The frequency was not saved, so offering it later does not bring it back.
    config()->set('inertia-notifications.digests.frequencies', ['hourly', 'daily']);

    $this->assertDigestFrequency($this->user, 'comments', 'instant');
});

it('rejects a frequency that the application does not offer', function (): void {
    config()->set('inertia-notifications.digests.frequencies', ['daily']);

    $this->actingAs($this->user)
        ->postJson('/_inertia-notifications/preferences', ['frequencies' => ['comments' => 'hourly']])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('frequencies.comments');

    $this->postJson('/_inertia-notifications/preferences', [
        'frequencies' => ['comments' => 'daily', 'reports' => 'instant'],
    ])
        ->assertOk()
        ->assertJsonPath('frequencies', ['instant', 'daily'])
        ->assertJsonPath('categories.*.frequency', ['daily', 'instant', null, null, null]);
});

it('reads a frequency that the application no longer offers as instant', function (): void {
    NotificationPreferences::update($this->user, frequencies: ['comments' => 'hourly']);

    config()->set('inertia-notifications.digests.frequencies', ['daily', 'weekly']);

    $this->assertDigestFrequency($this->user, 'comments', 'instant');
});

it('resolves the timezone of a user with the resolver before the timezone of the browser', function (): void {
    NotificationPreferences::resolveTimezoneUsing(fn (User $user): ?string => $user->name === 'Pascal' ? 'Asia/Tokyo' : null);

    expect(NotificationPreferences::timezone($this->user))
        ->toBe('Asia/Tokyo')
        ->and(NotificationPreferences::timezone(User::named('Sophie')))
        ->toBe('UTC');

    NotificationPreferences::update($this->user, frequencies: ['comments' => 'daily']);
    $this->user->notify(new IssueCommented);

    // 08:00 in Tokyo is 23:00 in UTC.
    $this->assertHeldForDigest($this->user, fn (array $message): bool => $message['sendAt'] === '2026-11-16T23:00:00+00:00');
});
