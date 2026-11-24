<?php

use Illuminate\Notifications\ChannelManager;
use Illuminate\Notifications\Events\NotificationSent;
use Illuminate\Notifications\SendQueuedNotifications;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use InertiaUI\Notifications\Events\InboxChanged;
use InertiaUI\Notifications\Inbox;
use InertiaUI\Notifications\InboxMessage;
use InertiaUI\Notifications\Models\InboxNotification;
use InertiaUI\Notifications\NotificationPreferences;
use InertiaUI\Notifications\Tests\Fixtures\CommentAdded;
use InertiaUI\Notifications\Tests\Fixtures\InvoiceOverdue;
use InertiaUI\Notifications\Tests\Fixtures\User;
use InertiaUI\Notifications\ToastAction;

beforeEach(function (): void {
    $this->user = User::named('Pascal');
});

/**
 * Store the notification of a running build for the given user.
 */
function buildRunning(User $user, string $key = 'build-42'): InboxNotification
{
    $message = InboxMessage::make('Build #:number is running', ['number' => 42]);

    return Inbox::record($user, (string) Str::uuid(), 'test', $message
        ->body('Started by Sophie.')
        ->action(ToastAction::make('Cancel')->post('/builds/42/cancel'))
        ->category('deployments')
        ->group('build:42')
        ->once($key));
}

/**
 * Run the queued jobs that send notifications through the given channel, and get the channels that sent.
 *
 * @return list<string>
 */
function sendQueuedThrough(string $channel): array
{
    $sent = [];

    Event::listen(NotificationSent::class, function (NotificationSent $event) use (&$sent): void {
        $sent[] = $event->channel;
    });

    Queue::pushed(SendQueuedNotifications::class, fn (SendQueuedNotifications $job) => $job->channels === [$channel])
        ->each(fn (SendQueuedNotifications $job) => $job->handle(app(ChannelManager::class)));

    return $sent;
}

it('replaces the message of the notifications with a key for every user who received them', function (): void {
    $mine = buildRunning($this->user);
    $theirs = buildRunning(User::named('Sophie'));
    $other = buildRunning($this->user, 'build-43');
    $mine->markAsRead();

    Inbox::update('build-42', InboxMessage::make('Build #:number passed', ['number' => 42])->with(['duration' => 93]));

    expect($mine->refresh()->toInboxArray())
        ->toMatchArray([
            'title' => 'Build #42 passed',
            'body' => null,
            'actions' => [],
            'data' => ['duration' => 93],
            'category' => 'deployments',
            'group' => 'build:42',
        ])
        ->and($mine->isRead())
        ->toBeTrue()
        ->and($theirs->refresh()->toInboxArray()['title'])
        ->toBe('Build #42 passed')
        ->and($other->refresh()->toInboxArray()['title'])
        ->toBe('Build #42 is running');
});

it('replaces the message of the notification with a key of one user', function (): void {
    $mine = buildRunning($this->user);
    $theirs = buildRunning(User::named('Sophie'));

    Inbox::update('build-42', InboxMessage::make('Build #42 passed'), notifiable: $this->user);

    expect($mine->refresh()->toInboxArray()['title'])
        ->toBe('Build #42 passed')
        ->and($theirs->refresh()->toInboxArray()['title'])
        ->toBe('Build #42 is running');
});

it('builds the new message for each user who received the notification', function (): void {
    $mine = buildRunning($this->user);
    $theirs = buildRunning(User::named('Sophie'));

    Inbox::update('build-42', fn (User $user) => InboxMessage::make("Build #42 passed, {$user->name}"));

    expect($mine->refresh()->toInboxArray()['title'])
        ->toBe('Build #42 passed, Pascal')
        ->and($theirs->refresh()->toInboxArray()['title'])
        ->toBe('Build #42 passed, Sophie');
});

it('keeps what the notification center stored next to the message', function (): void {
    config(['inertia-notifications.inbox.throttle' => ['deployments' => ['limit' => 0, 'seconds' => 60]]]);
    $notification = buildRunning($this->user);

    Inbox::update($notification, InboxMessage::make('Build #42 passed'));

    expect($notification->refresh()->isThrottled())->toBeTrue();
});

it('keeps the collapsed notifications and the flags of a collapsed row', function (): void {
    config([
        'inertia-notifications.pause.enabled' => true,
        'inertia-notifications.preferences.categories' => ['comments' => ['label' => 'Comments']],
        'inertia-notifications.inbox.throttle' => ['comments' => ['limit' => 1, 'seconds' => 60]],
    ]);
    NotificationPreferences::pause($this->user, now()->addHour());

    $this->user->notify(new CommentAdded(User::named('Sophie')));
    $this->user->notify(new CommentAdded(User::named('Maria')));

    $notification = $this->user->inbox()->sole();

    Inbox::update($notification, InboxMessage::make('Maria edited a comment on issue #42'));

    $notification->refresh();

    expect($notification->toInboxArray())
        ->toMatchArray([
            'title' => 'Maria edited a comment on issue #42',
            'actors' => [['name' => 'Maria'], ['name' => 'Sophie']],
            'actorCount' => 2,
            'total' => 2,
            'quiet' => true,
        ])
        ->and($notification->isThrottled())
        ->toBeTrue();
});

it('broadcasts the new message to every session of the user', function (): void {
    Event::fake([InboxChanged::class]);
    config(['inertia-notifications.inbox.broadcast_changes' => true]);
    $notification = buildRunning($this->user);

    Inbox::update('build-42', InboxMessage::make('Build #42 passed'));

    $event = Event::dispatched(InboxChanged::class)->sole()[0];
    $change = $event->broadcastWith()['change'];

    expect($event->socket)
        ->toBeNull()
        ->and($change['kind'])
        ->toBe('update')
        ->and($change['item'])
        ->toMatchArray(['id' => $notification->id, 'title' => 'Build #42 passed'])
        // Changes are ordered by their revision, so the new message replaces older copies of the notification.
        ->and($change['item']['revision'])
        ->toBeInt();
});

it('retracts the notifications with a key for every user who received them', function (): void {
    $sophie = User::named('Sophie');
    buildRunning($this->user);
    buildRunning($sophie);
    $other = buildRunning($this->user, 'build-43');

    Inbox::retract('build-42');

    expect($this->user->inbox()->pluck('id')->all())
        ->toBe([$other->id])
        ->and($sophie->inbox()->count())
        ->toBe(0);
});

it('retracts the notification with a key of one user', function (): void {
    $sophie = User::named('Sophie');
    buildRunning($this->user);
    buildRunning($sophie);

    Inbox::retract('build-42', $this->user);

    expect($this->user->inbox()->count())
        ->toBe(0)
        ->and($sophie->inbox()->count())
        ->toBe(1);
});

it('broadcasts the retraction to every session of the user with the new counts', function (): void {
    Event::fake([InboxChanged::class]);
    config(['inertia-notifications.inbox.broadcast_changes' => true]);
    $notification = buildRunning($this->user);

    Inbox::retract($notification);

    $event = Event::dispatched(InboxChanged::class)->sole()[0];

    expect($event->broadcastWith()['change'])
        ->toBe(['kind' => 'delete', 'ids' => [$notification->id]])
        ->and($event->broadcastWith()['counts'])
        ->toMatchArray(['unread' => 0, 'categories' => []]);
});

it('broadcasts no retraction of a notification retracted in a transaction that rolls back', function (): void {
    Event::fake([InboxChanged::class]);
    config(['inertia-notifications.inbox.broadcast_changes' => true]);
    $notification = buildRunning($this->user);

    expect(fn () => DB::transaction(function () use ($notification): void {
        Inbox::retract($notification);

        throw new RuntimeException('The build was restarted.');
    }))->toThrow(RuntimeException::class);

    expect($this->user->inbox()->whereKey($notification->id)->exists())->toBeTrue();

    Event::assertNotDispatched(InboxChanged::class);
});

it('skips a waiting channel of a notification that was retracted during the wait', function (): void {
    Queue::fake();
    $this->user->notify(new InvoiceOverdue(once: 'invoice-7-overdue'));
    sendQueuedThrough('inbox');

    Inbox::retract('invoice-7-overdue');
    $this->travel(10)
        ->minutes();

    expect(sendQueuedThrough('mail'))->toBe([]);
});

it('sends a waiting channel to a user who turned off the notification center for its category', function (): void {
    config(['inertia-notifications.preferences.categories' => ['billing' => ['label' => 'Billing']]]);
    NotificationPreferences::update($this->user, ['billing' => ['inbox' => false]]);
    Queue::fake();
    $this->user->notify(new InvoiceOverdue(category: 'billing'));
    sendQueuedThrough('inbox');

    $this->travel(10)
        ->minutes();

    expect($this->user->inbox()->count())
        ->toBe(0)
        ->and(sendQueuedThrough('mail'))
        ->toBe(['mail']);
});

it('sends a waiting channel to a user who turned on the notification center for its category during the wait', function (): void {
    config(['inertia-notifications.preferences.categories' => ['billing' => ['label' => 'Billing']]]);
    NotificationPreferences::update($this->user, ['billing' => ['inbox' => false]]);
    Queue::fake();
    $this->user->notify(new InvoiceOverdue(category: 'billing'));
    sendQueuedThrough('inbox');

    NotificationPreferences::update($this->user, ['billing' => ['inbox' => true]]);
    $this->travel(10)
        ->minutes();

    expect($this->user->inbox()->count())
        ->toBe(0)
        ->and(sendQueuedThrough('mail'))
        ->toBe(['mail']);
});

it('skips a waiting channel of a retracted notification when the user turned off the notification center for its category', function (): void {
    config(['inertia-notifications.preferences.categories' => ['billing' => ['label' => 'Billing']]]);
    Queue::fake();
    $this->user->notify(new InvoiceOverdue(once: 'invoice-7-overdue', category: 'billing'));
    sendQueuedThrough('inbox');

    Inbox::retract('invoice-7-overdue');
    NotificationPreferences::update($this->user, ['billing' => ['inbox' => false]]);
    $this->travel(10)
        ->minutes();

    expect(sendQueuedThrough('mail'))->toBe([]);
});

it('records for each user whether the notification center stores a waiting notification', function (): void {
    config(['inertia-notifications.preferences.categories' => ['billing' => ['label' => 'Billing']]]);
    $sophie = User::named('Sophie');
    NotificationPreferences::update($sophie, ['billing' => ['inbox' => false]]);
    Queue::fake();
    Notification::send([$this->user, $sophie], new InvoiceOverdue(once: 'invoice-7-overdue', category: 'billing'));
    sendQueuedThrough('inbox');

    // Pascal's notification is retracted, and both users change their preferences during the wait.
    Inbox::retract('invoice-7-overdue');
    NotificationPreferences::update($this->user, ['billing' => ['inbox' => false]]);
    NotificationPreferences::update($sophie, ['billing' => ['inbox' => true]]);
    $mailed = [];

    Event::listen(NotificationSent::class, function (NotificationSent $event) use (&$mailed): void {
        $mailed[] = $event->notifiable->name;
    });

    $this->travel(10)
        ->minutes();
    sendQueuedThrough('mail');

    expect($mailed)->toBe(['Sophie']);
});

it('keeps whether the notification center stores a waiting notification in the serialized job', function (): void {
    config(['inertia-notifications.preferences.categories' => ['billing' => ['label' => 'Billing']]]);
    NotificationPreferences::update($this->user, ['billing' => ['inbox' => false]]);
    Queue::fake();
    $this->user->notify(new InvoiceOverdue(category: 'billing'));

    $job = Queue::pushed(SendQueuedNotifications::class, fn (SendQueuedNotifications $job) => $job->channels === ['mail'])
        ->sole();
    $job = unserialize(serialize($job));
    $sent = [];

    Event::listen(NotificationSent::class, function (NotificationSent $event) use (&$sent): void {
        $sent[] = $event->channel;
    });

    NotificationPreferences::update($this->user, ['billing' => ['inbox' => true]]);
    $this->travel(10)
        ->minutes();
    $job->handle(app(ChannelManager::class));

    expect($sent)->toBe(['mail']);
});
