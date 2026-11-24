<?php

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Notifications\ChannelManager;
use Illuminate\Notifications\Events\BroadcastNotificationCreated;
use Illuminate\Notifications\Events\NotificationSent;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\SendQueuedNotifications;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use InertiaUI\Notifications\Concerns\InteractsWithInbox;
use InertiaUI\Notifications\Events\InboxNotificationArrived;
use InertiaUI\Notifications\Inbox;
use InertiaUI\Notifications\InboxMessage;
use InertiaUI\Notifications\Models\DigestItem;
use InertiaUI\Notifications\Models\InboxNotification;
use InertiaUI\Notifications\NotificationPreferences;
use InertiaUI\Notifications\Tests\Fixtures\ApplicationNotification;
use InertiaUI\Notifications\Tests\Fixtures\InvoiceOverdue;
use InertiaUI\Notifications\Tests\Fixtures\InvoicePaid;
use InertiaUI\Notifications\Tests\Fixtures\User;
use InertiaUI\Notifications\Toast;

beforeEach(function (): void {
    $this->user = User::named('Pascal');
    $this->sent = [];

    // Any channel can wait for a read, also one that the application adds itself.
    app(ChannelManager::class)->extend('sms', fn (): object => new class
    {
        /**
         * Send the given notification.
         */
        public function send(object $notifiable, Notification $notification): void {}
    });

    Event::listen(NotificationSent::class, function (NotificationSent $event): void {
        $this->sent[] = $event->channel;
    });
});

/**
 * Run the queued jobs that send notifications through the given channel.
 */
function sendQueued(string $channel): void
{
    Queue::pushed(SendQueuedNotifications::class, fn (SendQueuedNotifications $job): bool => $job->channels === [$channel])
        ->each(fn (SendQueuedNotifications $job) => $job->handle(app(ChannelManager::class)));
}

/**
 * Get the delay of each queued channel, by channel.
 *
 * @return array<string, mixed>
 */
function queuedDelays(): array
{
    return Queue::pushed(SendQueuedNotifications::class)
        ->mapWithKeys(fn (SendQueuedNotifications $job): array => [$job->channels[0] => $job->delay])
        ->all();
}

it('stores the notification right away and delays the channels of unlessReadWithin()', function (): void {
    Queue::fake();
    $this->freezeTime();

    $this->user->notify(new InvoiceOverdue(channels: ['inbox', 'mail', 'sms']));

    $delays = queuedDelays();

    expect($delays['inbox'])
        ->toBeNull()
        ->and($delays['sms'])
        ->toBeNull()
        ->and($delays['mail']->equalTo(now()->addMinutes(10)))
        ->toBeTrue();
});

it('skips a waiting channel when the notification was read during the wait', function (string $channel): void {
    Queue::fake();
    $this->user->notify(new InvoiceOverdue(channels: ['inbox', $channel], waiting: [$channel]));
    sendQueued('inbox');

    $this->user->inbox()
        ->sole()
        ->markAsRead();
    $this->travel(10)
        ->minutes();
    sendQueued($channel);

    expect($this->sent)->toBe(['inbox']);
})->with(['mail', 'sms']);

it('sends a waiting channel when the notification is still unread after the wait', function (string $channel): void {
    Queue::fake();
    $this->user->notify(new InvoiceOverdue(channels: ['inbox', $channel], waiting: [$channel]));
    sendQueued('inbox');

    // Archiving or seeing the notification is not reading it.
    $this->user->inbox()
        ->sole()
        ->markAsSeen();
    $this->travel(10)
        ->minutes();
    sendQueued($channel);

    expect($this->sent)->toBe(['inbox', $channel]);
})->with(['mail', 'sms']);

it('keeps the delay that the notification sets for its other channels', function (): void {
    Queue::fake();
    $this->freezeTime();

    $this->user->notify((new InvoiceOverdue(channels: ['inbox', 'mail', 'sms']))->delay(['sms' => 60]));

    $delays = queuedDelays();

    expect($delays['sms'])
        ->toBe(60)
        ->and($delays['mail']->equalTo(now()->addMinutes(10)))
        ->toBeTrue();
});

it('keeps the delays of the withDelay() method of the base class of the notification', function (): void {
    Queue::fake();
    $this->freezeTime();

    $this->user->notify(new class extends ApplicationNotification implements ShouldQueue
    {
        use InteractsWithInbox, Queueable;

        /**
         * Get the notification's delivery channels.
         *
         * @return list<string>
         */
        public function via(object $notifiable): array
        {
            return ['inbox', 'mail', 'sms'];
        }

        /**
         * Get the inbox representation of the notification.
         */
        public function toInbox(object $notifiable): InboxMessage
        {
            return InboxMessage::make('Invoice INV-7 is overdue')->unlessReadWithin(minutes: 10, channels: ['mail']);
        }
    });

    $delays = queuedDelays();

    expect($delays['inbox'])
        ->toBeNull()
        ->and($delays['sms'])
        ->toBe(60)
        ->and($delays['mail']->equalTo(now()->addMinutes(10)))
        ->toBeTrue();
});

it('lets the withDelay() method of the notification wait for a read with inboxDelay()', function (): void {
    Queue::fake();
    $this->freezeTime();

    $this->user->notify(new class(channels: ['inbox', 'mail', 'sms']) extends InvoiceOverdue
    {
        /**
         * Get the delay of the queued job that sends the notification through the given channel.
         */
        public function withDelay(object $notifiable, string $channel): mixed
        {
            return $this->inboxDelay($notifiable, $channel) ?? ['sms' => 60];
        }
    });

    $delays = queuedDelays();

    expect($delays['sms'])
        ->toBe(60)
        ->and($delays['mail']->equalTo(now()->addMinutes(10)))
        ->toBeTrue();

    sendQueued('inbox');

    $this->travel(10)
        ->minutes();
    sendQueued('mail');

    expect($this->sent)->toBe(['inbox', 'mail']);
});

it('requires a withDelay() method of the notification to return inboxDelay() to wait for a read', function (): void {
    Queue::fake();

    $this->user->notify(new class(channels: ['inbox', 'mail']) extends InvoiceOverdue
    {
        /**
         * Get the delay of the queued job that sends the notification through the given channel.
         */
        public function withDelay(object $notifiable, string $channel): mixed
        {
            return null;
        }
    });
    sendQueued('inbox');

    expect(fn () => sendQueued('mail'))
        ->toThrow(LogicException::class, 'must be queued with inboxDelay() to delay its [mail] channel');
});

it('requires a notification sent with notifyNow() to wait for a read through the queue', function (): void {
    expect(fn () => $this->user->notifyNow(new InvoiceOverdue(channels: ['inbox', 'mail'])))
        ->toThrow(LogicException::class, 'must be queued with inboxDelay() to delay its [mail] channel');
});

it('requires a queued notification to wait for a read', function (): void {
    $notification = new class(channels: ['inbox', 'mail']) extends InvoicePaid
    {
        /**
         * Get the inbox representation of the notification.
         */
        public function toInbox(object $notifiable): InboxMessage
        {
            return parent::toInbox($notifiable)->unlessReadWithin(minutes: 10, channels: ['mail']);
        }
    };

    expect(fn () => $this->user->notify($notification))->toThrow(LogicException::class, 'must implement ShouldQueue');
});

it('requires a channel that stores the notification right away to wait for a read', function (array $channels): void {
    expect(fn () => $this->user->notify(new InvoiceOverdue($channels)))
        ->toThrow(LogicException::class, 'must use the [inbox] channel to delay its');
})->with([
    'without the inbox' => [['mail']],
    'with only the broadcast' => [['mail', 'broadcast']],
]);

it('fails on the broadcast channel without toBroadcast() or toArray(), as Laravel does', function (): void {
    expect(fn () => $this->user->notify(new InvoiceOverdue(['inbox', 'broadcast'], waiting: [])))
        ->toThrow(RuntimeException::class, 'Notification is missing toBroadcast / toArray method.');
});

it('sends an on-demand notification without storing it', function (): void {
    config([
        'inertia-notifications.preferences.categories' => ['billing' => ['label' => 'Billing', 'digest' => true]],
    ]);

    (new AnonymousNotifiable)
        ->route('mail', 'sophie@acme.test')
        ->notify(new InvoiceOverdue(['inbox', 'mail'], category: 'billing'));

    expect($this->sent)
        ->toBe(['inbox', 'mail'])
        ->and(InboxNotification::query()->count())
        ->toBe(0)
        ->and(DigestItem::query()->count())
        ->toBe(0);
});

it('refuses to let the inbox channel wait for a read', function (): void {
    expect(fn () => InboxMessage::make('Invoice paid')->unlessReadWithin(minutes: 10, channels: ['inbox', 'mail']))
        ->toThrow(InvalidArgumentException::class);
});

it('stores and sends a notification only once per user under the key of once()', function (): void {
    $sophie = User::named('Sophie');
    $notification = fn (string $key): InvoiceOverdue => new InvoiceOverdue(['inbox', 'sms'], waiting: [], once: $key);

    // The action that sends the notification runs twice.
    $this->user->notify($notification('invoice-7-overdue'));
    $this->user->notify($notification('invoice-7-overdue'));
    $sophie->notify($notification('invoice-7-overdue'));
    $this->user->notify($notification('invoice-8-overdue'));

    expect($this->user->inbox()->pluck('unique_key')->all())
        ->toEqualCanonicalizing(['invoice-7-overdue', 'invoice-8-overdue'])
        ->and($sophie->inbox()->count())
        ->toBe(1)
        ->and($this->sent)
        ->toBe(['inbox', 'sms', 'inbox', 'sms', 'inbox', 'sms']);
});

it('does not store or send a notification again when the job that sends it is retried', function (): void {
    Queue::fake();

    // The job that sends the notification is retried, so it sends a second notification with another ID.
    $this->user->notify(new InvoiceOverdue(['inbox', 'sms'], waiting: [], once: 'invoice-7-overdue'));
    $this->user->notify(new InvoiceOverdue(['inbox', 'sms'], waiting: [], once: 'invoice-7-overdue'));

    [$firstInbox, $firstSms, $secondInbox, $secondSms] = Queue::pushed(SendQueuedNotifications::class)->all();

    // Queued channels run in separate jobs, in any order, and the queue may retry each of them.
    foreach ([$secondSms, $firstInbox, $firstSms, $secondInbox, $firstInbox] as $job) {
        $job->handle(app(ChannelManager::class));
    }

    expect($this->user->inbox()->sole()->id)
        ->toBe($secondSms->notification->id)
        ->and($this->sent)
        ->toBe(['sms', 'inbox']);
});

it('holds back a notification under the key of once() that an earlier notification stored while the inbox is off', function (): void {
    config(['inertia-notifications.preferences.categories' => ['billing' => ['label' => 'Billing']]]);
    $notification = fn (string $key): InvoiceOverdue => new InvoiceOverdue(['inbox', 'sms'], waiting: [], once: $key, category: 'billing');

    $this->user->notify($notification('invoice-7-overdue'));
    NotificationPreferences::update($this->user, ['billing' => ['inbox' => false]]);
    $this->sent = [];

    $this->user->notify($notification('invoice-7-overdue'));
    $this->user->notify($notification('invoice-8-overdue'));
    $this->user->notify($notification('invoice-8-overdue'));

    expect($this->sent)
        ->toBe(['sms', 'sms'])
        ->and($this->user->inbox()->pluck('unique_key')->all())
        ->toBe(['invoice-7-overdue']);
});

it('skips a waiting channel of a notification whose key of once() belongs to an earlier notification', function (): void {
    Queue::fake();

    $this->user->notify(new InvoiceOverdue(once: 'invoice-7-overdue'));
    $this->user->notify(new InvoiceOverdue(once: 'invoice-7-overdue'));
    sendQueued('inbox');

    $this->travel(10)
        ->minutes();
    sendQueued('mail');

    expect($this->sent)->toBe(['inbox', 'mail']);
});

it('broadcasts the arrival of a notification under the key of once() once', function (): void {
    config(['inertia-notifications.inbox.broadcast_notifications' => true]);
    Event::fake([InboxNotificationArrived::class]);

    // The delivery rules store the notification before its inbox channel runs.
    $this->user->notify(new InvoiceOverdue(['inbox', 'sms'], waiting: [], once: 'invoice-7-overdue'));
    $this->user->notify(new InvoiceOverdue(['inbox', 'sms'], waiting: [], once: 'invoice-7-overdue'));

    $event = Event::dispatched(InboxNotificationArrived::class)->sole()[0];

    expect($event->item['id'])->toBe($this->user->inbox()->sole()->id);
});

it('returns the row of the notification that stored the key of once() while another stored it too', function (): void {
    $message = InboxMessage::make('Invoice INV-7 is overdue')->once('invoice-7-overdue');
    $first = null;

    // The other notification is stored right after this one looked for the key, and before this one is stored.
    DB::listen(function (QueryExecuted $query) use (&$first, $message): void {
        if ($first === null && str_starts_with($query->sql, 'select') && str_contains($query->sql, 'unique_key')) {
            // Storing the notification runs queries that call this listener
            // again, so we will mark it as stored before we store it.
            $first = false;
            $first = Inbox::record($this->user, (string) Str::uuid(), 'test', $message);
        }
    });

    $second = Inbox::record($this->user, (string) Str::uuid(), 'test', $message);

    expect($second->id)
        ->toBe($first->id)
        ->and($this->user->inbox()->count())
        ->toBe(1);
});

it('does not give a second user the row of a notification with the same preset ID', function (): void {
    config(['inertia-notifications.inbox.broadcast_notifications' => true]);
    Event::fake([InboxNotificationArrived::class]);
    $sophie = User::named('Sophie');
    $notification = new InvoicePaid;
    $notification->id = (string) Str::uuid();

    $this->user->notify($notification);

    // Like Laravel's database channel, the row of the second user fails on the primary key.
    $this->assertThrows(fn () => $sophie->notify($notification), UniqueConstraintViolationException::class);

    Event::assertDispatchedTimes(InboxNotificationArrived::class, 1);
    Event::assertNotDispatched(
        InboxNotificationArrived::class,
        fn (InboxNotificationArrived $event): bool => $event->channel === Inbox::channel($sophie),
    );
    expect($sophie->inbox()->count())->toBe(0);
});

it('stores the notifications over the throttle of their category without broadcasting them', function (): void {
    config([
        'inertia-notifications.inbox.broadcast_notifications' => true,
        'inertia-notifications.inbox.throttle' => ['billing' => ['limit' => 2, 'seconds' => 60]],
    ]);
    Event::fake([InboxNotificationArrived::class]);
    $sophie = User::named('Sophie');

    $comment = new class extends InvoicePaid
    {
        /**
         * Get the inbox representation of the notification.
         */
        public function toInbox(object $notifiable): InboxMessage
        {
            return parent::toInbox($notifiable)->category('comments');
        }
    };

    Collection::times(3, fn () => $this->user->notify(new InvoicePaid));
    $sophie->notify(new InvoicePaid);
    $this->user->notify($comment);

    // The third billing notification of the user is over the limit.
    Event::assertDispatchedTimes(InboxNotificationArrived::class, 4);
    expect($this->user->inbox()->where('category', 'billing')->get()->map->isThrottled()->all())
        ->toEqualCanonicalizing([false, false, true]);

    // The throttle counts per number of seconds.
    $this->travel(61)
        ->seconds();
    $this->user->notify(new InvoicePaid);

    Event::assertDispatchedTimes(InboxNotificationArrived::class, 5);
    expect($this->user->inbox()->count())->toBe(5);
});

it('sends the broadcast channel of a notification over the throttle of its category', function (): void {
    Event::fake([BroadcastNotificationCreated::class]);
    config(['inertia-notifications.inbox.throttle' => ['billing' => ['limit' => 1, 'seconds' => 60]]]);

    $this->user->notify(new InvoicePaid(channels: ['inbox', 'broadcast']));
    $this->user->notify(new InvoicePaid(channels: ['inbox', 'broadcast']));

    Event::assertDispatchedTimes(BroadcastNotificationCreated::class, 2);
    expect($this->sent)->toBe(['inbox', 'broadcast', 'inbox', 'broadcast']);
});

it('counts a notification once against the throttle when another store saved it after this one looked for it', function (): void {
    config(['inertia-notifications.inbox.throttle' => ['billing' => ['limit' => 2, 'seconds' => 60]]]);
    $id = (string) Str::uuid();
    $message = (new InvoicePaid)->toInbox($this->user);
    $lookup = DB::getQueryGrammar()->wrap('id').' = ?';

    // The other store saves the notification once this one found no row with its ID.
    $raced = runOnceAfterQuery(
        fn (string $sql): bool => str_starts_with($sql, 'select') && str_contains($sql, $lookup),
        fn () => Inbox::record($this->user, $id, 'test', $message),
    );

    $stored = Inbox::record($this->user, $id, 'test', $message);
    $next = Inbox::record($this->user, (string) Str::uuid(), 'test', $message);

    expect($raced())
        ->toBeTrue()
        ->and($stored->id)
        ->toBe($id)
        ->and($stored->isThrottled())
        ->toBeFalse()
        // The limit allows two notifications, and the next one is only the second.
        ->and($next->isThrottled())
        ->toBeFalse()
        ->and($this->user->inbox()->get()->map->isThrottled()->all())
        ->toBe([false, false]);
});

it('counts no notification against the throttle when an observer cancels storing it', function (): void {
    config(['inertia-notifications.inbox.throttle' => ['billing' => ['limit' => 1, 'seconds' => 60]]]);
    $message = (new InvoicePaid)->toInbox($this->user);
    $cancelled = (string) Str::uuid();

    InboxNotification::creating(fn (InboxNotification $notification): bool => $notification->id !== $cancelled);

    Inbox::record($this->user, $cancelled, 'test', $message);
    $stored = Inbox::record($this->user, (string) Str::uuid(), 'test', $message);

    expect($this->user->inbox()->pluck('id')->all())
        ->toBe([$stored->id])
        ->and($stored->isThrottled())
        ->toBeFalse();
});

it('flashes no toast for a notification over the throttle of its category', function (): void {
    Toast::fake();
    config(['inertia-notifications.inbox.throttle' => ['billing' => ['limit' => 1, 'seconds' => 60]]]);
    Route::middleware('web')->post('/invoices/7/pay', function () {
        request()
            ->user()
            ->notify(new InvoicePaid(toast: true));

        return back();
    });
    $this->actingAs($this->user);

    $this->post('/invoices/7/pay');
    $this->post('/invoices/7/pay');

    Toast::assertFlashed('Invoice INV-7 paid', 1);
    expect($this->user->inbox()->count())->toBe(2);
});

it('imports a past notification with its times, without delivering it, counting it against the throttle, or collapsing it', function (): void {
    Toast::fake();
    Event::fake([InboxNotificationArrived::class]);
    config([
        'inertia-notifications.inbox.broadcast_notifications' => true,
        'inertia-notifications.inbox.throttle' => ['billing' => ['limit' => 1, 'seconds' => 60]],
    ]);
    $paid = (string) Str::uuid();
    $overdue = (string) Str::uuid();
    Route::middleware('web')->post('/invoices/import', function () use ($paid, $overdue): string {
        $message = fn (): InboxMessage => (new InvoicePaid(toast: true))->toInbox(request()->user())->collapse();

        Inbox::import(request()->user(), $paid, InvoicePaid::class, $message(), sentAt: now()->subDays(20), readAt: now()->subDays(19));
        Inbox::import(request()->user(), $overdue, InvoicePaid::class, $message(), sentAt: now()->subDays(10));

        return 'imported';
    });
    $this->actingAs($this->user);

    $this->post('/invoices/import')->assertOk();

    Toast::assertNothingFlashed();
    Event::assertNotDispatched(InboxNotificationArrived::class);
    expect($this->user->inbox()->get()->map(fn (InboxNotification $row): array => [
        $row->created_at->toDateString(),
        $row->read_at?->toDateString(),
        $row->seen_at?->toDateString(),
        $row->isThrottled(),
        $row->collapses_until,
    ])->all())->toBe([
        [now()->subDays(10)->toDateString(), null, now()->subDays(10)->toDateString(), false, null],
        [now()->subDays(20)->toDateString(), now()->subDays(19)->toDateString(), now()->subDays(20)->toDateString(), false, null],
    ])->and($this->user->inboxCounts())->toMatchArray(['unread' => 1, 'unseen' => 0]);

    // A second import leaves alone what the user changed since, such as marking a notification as read.
    Inbox::markAsRead(Inbox::query($this->user)->findOrFail($overdue));
    $this->post('/invoices/import')->assertOk();

    expect($this->user->inbox()->count())->toBe(2)
        ->and($this->user->inboxCounts())->toMatchArray(['unread' => 0]);

    // The next notification arrives as usual, with the whole throttle of its category.
    $this->user->notify(new InvoicePaid);

    Event::assertDispatchedTimes(InboxNotificationArrived::class, 1);
});
