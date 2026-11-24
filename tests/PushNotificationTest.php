<?php

use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Queue\Events\JobFailed;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use InertiaUI\Notifications\Inbox;
use InertiaUI\Notifications\InboxMessage;
use InertiaUI\Notifications\Jobs\SendPushNotification;
use InertiaUI\Notifications\NotificationPreferences;
use InertiaUI\Notifications\Testing\InteractsWithNotificationCenter;
use InertiaUI\Notifications\Tests\Fixtures\CommentAdded;
use InertiaUI\Notifications\Tests\Fixtures\InvoiceOverdue;
use InertiaUI\Notifications\Tests\Fixtures\InvoicePaid;
use InertiaUI\Notifications\Tests\Fixtures\Team;
use InertiaUI\Notifications\Tests\Fixtures\User;
use InertiaUI\Notifications\WebPush\PushPayload;
use InertiaUI\Notifications\WebPush\PushSender;

uses(InteractsWithNotificationCenter::class);

beforeEach(function (): void {
    registerNotificationRoutes();

    config([
        'inertia-notifications.pause.enabled' => true,
        'inertia-notifications.preferences.categories' => [
            'billing' => ['label' => 'Billing'],
            'comments' => ['label' => 'Comments'],
        ],
    ]);

    enablePush();

    $this->travelTo(Carbon::parse('2026-11-18 10:00:00', 'UTC'));
    $this->pushes = $this->fakePush();
    $this->user = User::named('Pascal');
    $this->device = storePushSubscription($this->user);
});

/**
 * Get the notification of each recorded push.
 *
 * @return list<array<string, mixed>>
 */
function pushedNotifications(): array
{
    return test()->pushes->pushed();
}

/**
 * Run the push jobs that the fake queue holds, as a queue worker does once it unserializes them.
 */
function runQueuedPushes(): void
{
    Queue::pushed(SendPushNotification::class)
        ->each(fn (SendPushNotification $job) => unserialize(serialize($job))->handle(app(PushSender::class)));
}

/**
 * Make a notification whose push waits ten minutes for the notification to be read.
 */
function waitingPush(): InvoicePaid
{
    return new class(push: true) extends InvoicePaid
    {
        /**
         * Get the inbox representation of the notification.
         */
        public function toInbox(object $notifiable): InboxMessage
        {
            return parent::toInbox($notifiable)->unlessReadWithin(minutes: 10, channels: ['push']);
        }
    };
}

it('pushes the stored notification, which opens through the open route', function (): void {
    $this->user->notify(new InvoicePaid(push: true));

    $stored = Inbox::query($this->user)->sole();

    expect($this->pushes->recordedPushes())
        ->toHaveCount(1)
        ->and($this->pushes->recordedPushes()[0]['payload'])
        ->toBe([
            'web_push' => 8030,
            'notification' => [
                'title' => 'Invoice INV-7 paid',
                'body' => 'Paid by card.',
                'navigate' => "http://localhost/_inertia-notifications/{$stored->id}/open",
                'tag' => "inertiaui-inbox-{$stored->id}",
                'silent' => false,
                'lang' => 'en',
                'dir' => 'auto',
                'timestamp' => 1794996000000,
                'data' => ['id' => $stored->id],
            ],
            'mutable' => true,
        ]);
});

it('stores the notification without a push when its inbox message does not ask for one', function (Closure $notification): void {
    $this->user->notify($notification());

    expect(Inbox::query($this->user)->count())->toBe(1);

    $this->assertNothingPushed();
})->with([
    'without push()' => fn (): InvoiceOverdue => new InvoiceOverdue(['inbox'], waiting: []),
    'with push(false)' => fn (): InvoicePaid => new InvoicePaid(push: false),
]);

it('pushes to every device of the notifiable model', function (): void {
    $other = storePushSubscription($this->user, ['endpoint' => 'https://web.push.apple.com/QGcd']);

    storePushSubscription(User::named('Sophie'));

    $this->user->notify(new InvoicePaid(push: true));

    expect(collect(pushedNotifications())->pluck('subscription')->all())->toBe([$this->device->id, $other->id]);
});

it('shows the absolute avatar of the actor as the icon of the push', function (): void {
    $actor = User::named('Sophie');

    $actor->setAttribute('avatar_url', 'https://acme.test/avatars/sophie.png');

    $this->user->notify(new InvoicePaid(actor: $actor, push: true));

    $this->assertPushed($this->user, fn (array $push): bool => $push['icon'] === 'https://acme.test/avatars/sophie.png');
});

it('shows the icon of the config when the avatar of the actor is not an absolute URL', function (): void {
    config(['inertia-notifications.push.icon' => 'https://acme.test/icon-192.png']);

    $actor = User::named('Sophie');

    $actor->setAttribute('avatar_url', '/avatars/sophie.png');

    $this->user->notify(new InvoicePaid(actor: $actor, push: true));

    $this->assertPushed($this->user, fn (array $push): bool => $push['icon'] === 'https://acme.test/icon-192.png');
});

it('pushes the title and body in the locale of the notification', function (): void {
    app('translator')->addLines(['*.Invoice :number paid' => 'Factuur :number betaald'], 'nl');

    $this->user->notify((new InvoicePaid(push: true))->locale('nl'));

    $this->assertPushed($this->user, fn (array $push): bool => $push['title'] === 'Factuur INV-7 betaald'
        && $push['lang'] === 'nl');
});

it('replaces the push of a notification that collapses, with the same tag', function (): void {
    $author = User::named('Sophie');

    $this->user->notify(new CommentAdded($author, push: true));

    $this->travel(1)->minute();

    $this->user->notify(new CommentAdded(User::named('Maria'), push: true));

    $row = Inbox::query($this->user)->sole();
    $pushed = pushedNotifications();

    expect($pushed)
        ->toHaveCount(2)
        ->and(array_unique(array_column($pushed, 'tag')))
        ->toBe(["inertiaui-inbox-{$row->id}"])
        ->and($pushed[1]['navigate'])
        ->toBe("http://localhost/_inertia-notifications/{$row->id}/open")
        ->and($pushed[1]['timestamp'])
        ->toBe(Carbon::parse('2026-11-18 10:01:00', 'UTC')->getTimestampMs());
});

it('names the actors of a collapsed notification in its push', function (): void {
    $title = ':actors commented on issue #:number';

    $this->user->notify(new CommentAdded(User::named('Sophie'), push: true, title: $title));
    $this->travel(1)->minute();
    $this->user->notify(new CommentAdded(User::named('Maria'), push: true, title: $title));

    expect(array_column(pushedNotifications(), 'title'))->toBe(['Sophie commented on issue #42', 'Maria and Sophie commented on issue #42']);
});

it('drops the push of a notification that arrives outside the notification hours or while paused', function (Closure $doNotDisturb): void {
    $doNotDisturb($this->user);

    $this->user->notify(new InvoicePaid(push: true));

    $this->assertInboxMessage($this->user, fn (array $message): bool => $message['quiet'] === true);
    $this->assertNothingPushed();
    $this->assertNothingHeldForDigest($this->user);
})->with([
    'outside the notification hours' => [fn (User $user) => setNotificationHours($user, '12:00-20:00')],
    'while paused' => [fn (User $user) => NotificationPreferences::pause($user, now()->addHour())],
]);

it('never holds a push for a digest, also when the digests list the push channel of the preferences', function (): void {
    config(['inertia-notifications.digests.channels' => ['mail', 'push']]);
    NotificationPreferences::pause($this->user, now()->addHour());

    $this->user->notify(new InvoicePaid(push: true));

    $this->assertNothingPushed();
    $this->assertNothingHeldForDigest($this->user);
});

it('drops the push of a notification over the throttle of its category', function (): void {
    config(['inertia-notifications.inbox.throttle.billing' => ['limit' => 1, 'seconds' => 60]]);

    $this->user->notify(new InvoicePaid(push: true));
    $this->user->notify(new InvoicePaid(push: true));

    expect(Inbox::query($this->user)->count())
        ->toBe(2)
        ->and(pushedNotifications())
        ->toHaveCount(1);
});

it('drops the push of a notification that the user already read or archived', function (string $change): void {
    $notification = new InvoicePaid(push: true);
    $notification->id = (string) Str::uuid();

    Inbox::record($this->user, $notification->id, InvoicePaid::class, $notification->toInbox($this->user))->{$change}();

    $this->user->notify($notification);

    $this->assertNothingPushed();
})->with(['read' => 'markAsRead', 'archived' => 'archive']);

it('drops a queued push once the user read, archived, or deleted the notification before it runs', function (string $change): void {
    Queue::fake();

    $this->user->notify(new InvoicePaid(push: true));

    Inbox::query($this->user)->sole()->{$change}();

    runQueuedPushes();

    $this->assertNothingPushed();
})->with(['read' => 'markAsRead', 'archived' => 'archive', 'deleted' => 'delete']);

it('delays the push by the minutes of unlessReadWithin()', function (string $dates): void {
    Queue::fake();
    Date::use($dates);

    try {
        $this->user->notify(waitingPush());
    } finally {
        Date::useDefault();
    }

    $job = Queue::pushed(SendPushNotification::class)->sole();

    expect($job->delay->toDateTimeString())->toBe('2026-11-18 10:10:00');
})->with([
    'mutable dates' => Carbon::class,
    'immutable dates' => CarbonImmutable::class,
]);

it('drops the delayed push of a notification that the user read in the meantime', function (): void {
    Queue::fake();

    $this->user->notify(waitingPush());

    // The database returns the rows of the same second in any order, so the second one comes a second later.
    $this->travel(1)
        ->second();
    $this->user->notify(waitingPush());
    $this->travel(10)
        ->minutes();

    [$read, $unread] = Inbox::query($this->user)->oldest()->get();

    $read->markAsRead();

    runQueuedPushes();

    expect(collect(pushedNotifications())->pluck('data.id')->all())->toBe([$unread->id]);
});

it('skips the push that the user turned off', function (array $categories, array $channels): void {
    NotificationPreferences::update($this->user, $categories, $channels);

    $this->user->notify(new InvoicePaid(push: true));

    $this->assertInboxMessage($this->user, 'Invoice INV-7 paid');
    $this->assertNothingPushed();
})->with([
    'for the category' => [['billing' => ['push' => false]], []],
    'for every category' => [[], ['push' => false]],
]);

it('pushes nothing to a user who turned the notification center off, even with the push on', function (array $categories, array $channels): void {
    NotificationPreferences::update($this->user, $categories, $channels);

    $this->user->notify(new InvoicePaid(push: true));

    $this->assertNoInboxMessages($this->user);
    $this->assertNothingPushed();
})->with([
    'for the category' => [['billing' => ['inbox' => false, 'push' => true]], []],
    'for every category' => [['billing' => ['push' => true]], ['inbox' => false]],
]);

it('tells the context key of the stored notification in the push', function (): void {
    $acme = Team::query()->create(['name' => 'Acme']);

    $this->user->notify(new CommentAdded(User::named('Maria'), team: $acme, push: true));
    $this->user->notify(new InvoicePaid(push: true));

    expect(collect(pushedNotifications())->pluck('data.context')->all())
        ->toBe([Inbox::contextKey($acme->getMorphClass(), $acme->getKey()), null]);
});

it('stores the notification but pushes nothing while push is not enabled', function (): void {
    Queue::fake();
    config(['inertia-notifications.push.enabled' => false]);

    $this->user->notify(new InvoicePaid(push: true));

    Queue::assertNothingPushed();

    $this->assertInboxMessage($this->user, 'Invoice INV-7 paid');
});

it('stores the notification but sends nothing to a notifiable model without devices', function (): void {
    Queue::fake();

    $this->device->delete();

    $this->user->notify(new InvoicePaid(push: true));

    Queue::assertNothingPushed();

    $this->assertInboxMessage($this->user, 'Invoice INV-7 paid');
});

it('sends the pushes with a job on the connection and queue of the config', function (): void {
    Queue::fake();
    config([
        'inertia-notifications.push.connection' => 'redis',
        'inertia-notifications.push.queue' => 'pushes',
    ]);

    $this->user->notify(new InvoicePaid(push: true));

    $stored = Inbox::query($this->user)->sole();

    Queue::assertPushedOn('pushes', SendPushNotification::class, fn (SendPushNotification $job): bool => $job->connection === 'redis'
        && $job->notifiable->is($this->user)
        && $job->payload->id === $stored->id
        && $job->delay === null
        && $job->payload->title === 'Invoice INV-7 paid');
});

it('deletes the queued push of a user who was deleted while it waited, instead of failing it', function (): void {
    Event::fake([JobFailed::class]);
    $deleted = User::named('Sophie');
    $deleted->delete();

    // The sync queue serializes the job like any other queue, so the deleted user can't be restored.
    dispatch(new SendPushNotification($deleted, new PushPayload(
        id: (string) Str::uuid(),
        title: 'Invoice INV-7 paid',
        body: null,
        navigate: '/invoices/7',
        tag: 'inertiaui-inbox-7',
    )))->onConnection('sync');

    Event::assertNotDispatched(JobFailed::class);
    expect($this->pushes->recordedPushes())->toBe([]);
});

it('pushes nothing for a notification sent in a transaction that rolls back', function (): void {
    expect(fn () => DB::transaction(function (): void {
        $this->user->notify(new InvoicePaid(push: true));

        throw new RuntimeException('The invoice could not be saved.');
    }))->toThrow(RuntimeException::class);

    $this->assertNothingPushed();
});

it('pushes a notification sent in a transaction once the transaction commits', function (): void {
    DB::transaction(function (): void {
        $this->user->notify(new InvoicePaid(push: true));

        $this->assertNothingPushed();
    });

    $this->assertPushed($this->user, 'Invoice INV-7 paid');
});

it('marks the notification as read and visits its URL when the push is opened', function (): void {
    $this->user->notify(new InvoicePaid(['inbox']));

    $notification = Inbox::query($this->user)->sole();

    $this->actingAs($this->user)
        ->get(route('inertia-notifications.open', $notification->id))
        ->assertRedirect('http://localhost/invoices/7');

    expect($notification->refresh()->isRead())->toBeTrue();
});

it('visits a URL on the same origin with Inertia when the push is opened in an open tab', function (string $url): void {
    $notification = Inbox::record($this->user, (string) Str::uuid(), 'test', InboxMessage::make('Invoice paid')->url($url));

    $this->actingAs($this->user)
        ->withHeaders(['X-Inertia' => 'true'])
        ->get(route('inertia-notifications.open', $notification->id))
        ->assertRedirect('http://localhost/invoices/7');
})->with([
    'a relative URL' => '/invoices/7',
    'an absolute URL' => 'http://localhost/invoices/7',
]);

it('loads a URL on another origin in full when the push is opened in an open tab', function (string $url): void {
    $notification = Inbox::record($this->user, (string) Str::uuid(), 'test', InboxMessage::make('Invoice paid')->url($url));

    $this->actingAs($this->user)
        ->withHeaders(['X-Inertia' => 'true'])
        ->get(route('inertia-notifications.open', $notification->id))
        ->assertStatus(409)
        ->assertHeader('X-Inertia-Location', $url);

    expect($notification->refresh()->isRead())->toBeTrue();
})->with([
    'another host' => 'https://billing.acme.test/invoices/7',
    'a host that starts with the same name' => 'http://localhost.evil.com/invoices/7',
    'another port' => 'http://localhost:8443/invoices/7',
    'another scheme' => 'https://localhost/invoices/7',
    'a protocol-relative URL' => '//cdn.other.com/invoices/7',
    'a mailto URL' => 'mailto:billing@acme.test',
    'a tel URL' => 'tel:+31201234567',
]);

it('visits the home page instead of a URL that runs script when the push is opened in an open tab', function (string $url): void {
    $notification = Inbox::record(
        $this->user,
        (string) Str::uuid(),
        'test',
        InboxMessage::make('Invoice paid')->url($url),
    );

    $this->actingAs($this->user)
        ->withHeaders(['X-Inertia' => 'true'])
        ->get(route('inertia-notifications.open', $notification->id))
        ->assertRedirect('http://localhost');

    expect($notification->refresh()->isRead())->toBeTrue();
})->with([
    'a script URL' => 'javascript://%0aalert(1)',
    'a script URL in capitals' => 'JAVASCRIPT://%0aalert(1)',
    'a data URL' => 'data://text/html,alert(1)',
]);

it('redirects to a URL on another origin when the push is opened without a tab', function (): void {
    $notification = Inbox::record(
        $this->user,
        (string) Str::uuid(),
        'test',
        InboxMessage::make('Invoice paid')->url('https://billing.acme.test/invoices/7'),
    );

    $this->actingAs($this->user)
        ->get(route('inertia-notifications.open', $notification->id))
        ->assertRedirect('https://billing.acme.test/invoices/7');
});

it('visits the home page when the opened notification has no URL', function (): void {
    $notification = Inbox::record($this->user, (string) Str::uuid(), 'test', InboxMessage::make('Renew the domain'));

    $this->actingAs($this->user)
        ->get(route('inertia-notifications.open', $notification->id))
        ->assertRedirect('http://localhost');
});

it('opens the notification of another context than the current one', function (): void {
    $acme = Team::query()->create(['name' => 'Acme']);
    $globex = Team::query()->create(['name' => 'Globex']);

    Inbox::resolveContextUsing(fn (Request $request): Team => $acme);

    $notification = Inbox::record(
        $this->user,
        (string) Str::uuid(),
        'test',
        InboxMessage::make('Globex invoice')->url('/globex/invoices/7')->for($globex),
    );

    $this->actingAs($this->user)
        ->get(route('inertia-notifications.open', $notification->id))
        ->assertRedirect('http://localhost/globex/invoices/7');

    expect($notification->refresh()->isRead())->toBeTrue();
});

it('does not open the notification of another user', function (): void {
    $notification = Inbox::record(User::named('Sophie'), (string) Str::uuid(), 'test', InboxMessage::make('Invoice paid'));

    $this->actingAs($this->user)
        ->get(route('inertia-notifications.open', $notification->id))
        ->assertNotFound();

    expect($notification->refresh()->isRead())->toBeFalse();
});
