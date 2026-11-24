<?php

use Carbon\CarbonImmutable;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Notifications\Events\BroadcastNotificationCreated;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Inertia\Inertia;
use InertiaUI\Notifications\Concerns\InteractsWithInbox;
use InertiaUI\Notifications\Events\InboxChanged;
use InertiaUI\Notifications\Events\InboxNotificationArrived;
use InertiaUI\Notifications\Inbox;
use InertiaUI\Notifications\InboxMessage;
use InertiaUI\Notifications\Models\InboxNotification;
use InertiaUI\Notifications\NotificationPreferences;
use InertiaUI\Notifications\Push;
use InertiaUI\Notifications\Tests\Fixtures\ApplicationNotification;
use InertiaUI\Notifications\Tests\Fixtures\CommentPosted;
use InertiaUI\Notifications\Tests\Fixtures\InvoicePaid;
use InertiaUI\Notifications\Tests\Fixtures\Team;
use InertiaUI\Notifications\Tests\Fixtures\User;
use InertiaUI\Notifications\Toast;
use InvalidArgumentException;

beforeEach(function (): void {
    Route::middleware('web')->group(function (): void {
        Route::inertiaNotifications();
        Route::get('/dashboard', fn () => Inertia::render('Dashboard'));
        Route::post('/invoices/7/pay', function () {
            request()
                ->user()
                ->notify(new InvoicePaid(toast: true));

            return back();
        });
    });

    $this->user = User::named('Pascal');
});

/**
 * Store a notification for the user that was created the given number of minutes ago.
 *
 * @param  array<string, mixed>  $attributes
 */
function inboxItem(User $user, string $title, int $minutesAgo = 0, array $attributes = []): InboxNotification
{
    test()->travelTo(now()->subMinutes($minutesAgo));

    $item = Inbox::record($user, (string) Str::uuid(), 'test', InboxMessage::make($title));

    $item->forceFill($attributes)
        ->save();

    test()->travelBack();

    return $item;
}

/**
 * Store the notifications that the list tests page through and filter.
 *
 * It returns the newest notification, which is snoozed.
 */
function listedInbox(User $user): InboxNotification
{
    inboxItem(User::named('Sophie'), 'Not yours');
    inboxItem($user, 'Oldest', 50, ['read_at' => now()]);

    foreach (range(1, 4) as $minutes) {
        inboxItem($user, "Unread {$minutes}", $minutes);
    }
    inboxItem($user, 'Archived', 3, ['archived_at' => now()]);

    return inboxItem($user, 'Snoozed', 0, ['snoozed_until' => now()->addHour()]);
}

it('stores the inbox message with the notification ID', function (): void {
    // Laravel sends a copy of the notification and gives it this ID when none
    // is set, so we will set the ID on the original to compare it afterwards.
    $notification = new InvoicePaid(actor: User::named('Sophie'));
    $notification->id = (string) Str::uuid();

    $this->user->notify($notification);

    $stored = $this->user->inbox()
        ->sole();

    expect($stored->id)
        ->toBe($notification->id)
        ->and($stored->only(['type', 'category', 'group_key']))
        ->toBe([
            'type' => InvoicePaid::class,
            'category' => 'billing',
            'group_key' => 'invoice:7',
        ])
        ->and($stored->toInboxArray())
        ->toMatchArray([
            'title' => 'Invoice INV-7 paid',
            'body' => 'Paid by card.',
            'icon' => 'receipt',
            'url' => '/invoices/7',
            'actions' => [['label' => 'Refund', 'href' => '/invoices/7/refund', 'method' => 'post']],
            'actor' => ['name' => 'Sophie'],
            'data' => ['amount' => 120],
            'readAt' => null,
        ]);
});

it('broadcasts no arrival of a stored notification unless enabled', function (): void {
    Event::fake([InboxNotificationArrived::class]);

    $this->user->notify(new InvoicePaid);
    Inbox::record($this->user, (string) Str::uuid(), 'test', InboxMessage::make('Invoice INV-8 paid'));

    expect($this->user->inbox()->count())->toBe(2);

    Event::assertNotDispatched(InboxNotificationArrived::class);
});

it('broadcasts the arrival of the stored notification on the channel of the user when enabled', function (): void {
    config(['inertia-notifications.inbox.broadcast_notifications' => true]);
    Event::fake([InboxNotificationArrived::class]);

    $this->user->notify(new InvoicePaid(actor: User::named('Sophie')));

    $stored = $this->user->inbox()
        ->sole();
    $event = Event::dispatched(InboxNotificationArrived::class)->sole()[0];

    // MySQL's JSON type sorts the keys of the stored actions, so the order of the keys may differ.
    expect($event->broadcastOn())
        ->toEqual([new PrivateChannel("InertiaUI.Notifications.Tests.Fixtures.User.{$this->user->id}")])
        ->and($event->broadcastAs())
        ->toBe('inertiaui.inbox.arrived')
        ->and(array_keys($event->broadcastWith()))
        ->toBe(['item'])
        ->and(Arr::except($event->broadcastWith()['item'], 'revision'))
        ->toEqual(Arr::except($stored->toInboxArray(), 'revision'));
});

it('broadcasts no arrival of a notification stored in a transaction that rolls back', function (): void {
    config(['inertia-notifications.inbox.broadcast_notifications' => true]);
    Event::fake([InboxNotificationArrived::class]);

    expect(fn () => DB::transaction(function (): void {
        $this->user->notify(new InvoicePaid);

        throw new RuntimeException('The payment failed.');
    }))->toThrow(RuntimeException::class);

    expect($this->user->inbox()->count())->toBe(0);

    Event::assertNotDispatched(InboxNotificationArrived::class);
});

it('broadcasts no arrival when the channel of the user needs the notification', function (): void {
    config(['inertia-notifications.inbox.broadcast_notifications' => true]);
    Event::fake([InboxNotificationArrived::class]);

    $user = new class extends User
    {
        /**
         * Get the channel that the user receives the given notification broadcast on.
         */
        public function receivesBroadcastNotificationsOn(Notification $notification): string
        {
            return 'users.'.$this->getKey();
        }

        /**
         * Get the class name for polymorphic relations.
         */
        public function getMorphClass(): string
        {
            return User::class;
        }
    };

    $user->forceFill(['id' => $this->user->id]);

    Inbox::record($user, (string) Str::uuid(), 'test', InboxMessage::make('Invoice INV-7 paid'));

    expect($this->user->inbox()->count())->toBe(1);

    Event::assertNotDispatched(InboxNotificationArrived::class);
});

it('keeps the application\'s broadcast payload and type next to the arrival', function (Closure $notification): void {
    config(['inertia-notifications.inbox.broadcast_notifications' => true]);
    Event::fake([BroadcastNotificationCreated::class, InboxNotificationArrived::class]);

    $this->user->notify($notification());

    $broadcast = Event::dispatched(BroadcastNotificationCreated::class)->sole()[0];

    expect($broadcast->broadcastWith())
        ->toBe(['invoice' => 'INV-7', 'id' => $broadcast->notification->id, 'type' => 'invoice.paid'])
        ->and($broadcast->broadcastAs())
        ->toBe(BroadcastNotificationCreated::class);

    Event::assertDispatchedTimes(InboxNotificationArrived::class, 1);
})->with([
    'on the notification' => fn (): Notification => new class(channels: ['inbox', 'broadcast']) extends InvoicePaid
    {
        /**
         * Get the broadcastable representation of the notification.
         */
        public function toBroadcast(object $notifiable): BroadcastMessage
        {
            return new BroadcastMessage(['invoice' => 'INV-7']);
        }

        /**
         * Get the type of the notification being broadcast.
         */
        public function broadcastType(): string
        {
            return 'invoice.paid';
        }
    },
    'on the base class of the notification' => fn (): Notification => new class extends ApplicationNotification
    {
        use InteractsWithInbox;

        /**
         * Get the notification's delivery channels.
         *
         * @return list<string>
         */
        public function via(object $notifiable): array
        {
            return ['inbox', 'broadcast'];
        }

        /**
         * Get the inbox representation of the notification.
         */
        public function toInbox(object $notifiable): InboxMessage
        {
            return InboxMessage::make('Invoice INV-7 paid');
        }
    },
]);

it('refuses a notification on the inbox channel without a toInbox() message', function (Notification $notification): void {
    expect(fn () => $this->user->notify($notification))
        ->toThrow(LogicException::class, 'needs a toInbox method that returns an InboxMessage')
        ->and($this->user->inbox()->count())
        ->toBe(0);
})->with([
    'without toInbox()' => fn (): Notification => new class extends CommentPosted
    {
        /**
         * Get the notification's delivery channels.
         *
         * @return list<string>
         */
        public function via(object $notifiable): array
        {
            return ['inbox'];
        }
    },
    'with a toInbox() that returns an array' => fn (): Notification => new class extends CommentPosted
    {
        /**
         * Get the notification's delivery channels.
         *
         * @return list<string>
         */
        public function via(object $notifiable): array
        {
            return ['inbox'];
        }

        /**
         * Get the inbox representation of the notification.
         *
         * @return array<string, string>
         */
        public function toInbox(object $notifiable): array
        {
            return ['title' => 'Sophie commented on your post'];
        }
    },
]);

it('does not store a notification that is only sent through the database channel', function (): void {
    $this->user->notify(new CommentPosted);

    expect(DatabaseNotification::query()->count())
        ->toBe(1)
        ->and($this->user->inbox()->count())
        ->toBe(0);
});

it('stores the type of inboxType() with the notification', function (): void {
    $this->user->notify(new class extends InvoicePaid
    {
        /**
         * Get the type of the notification in the notification center.
         */
        public function inboxType(object $notifiable): string
        {
            return 'invoice-paid';
        }
    });

    expect($this->user->inbox()->sole()->type)->toBe('invoice-paid');
});

it('flashes the toast of a notification with its icon and the avatar of its actor', function (): void {
    $sophie = User::named('Sophie')->forceFill(['avatar_url' => '/avatars/sophie.png']);

    Route::middleware('web')->post('/invoices/8/pay', function () use ($sophie) {
        request()
            ->user()
            ->notify(new InvoicePaid(toast: true, actor: $sophie));

        return back();
    });

    $this->actingAs($this->user)
        ->from('/dashboard')
        ->post('/invoices/8/pay');

    $toast = $this->get('/dashboard', ['X-Inertia' => 'true'])->json('flash.inertiaui.toasts.0');

    expect($toast)->toMatchArray(['icon' => 'receipt', 'image' => '/avatars/sophie.png']);
});

it('links the flashed toast of a notification without actions to its URL, with an alternative text that lets it close', function (): void {
    Route::middleware('web')->post('/deploys/1/finish', function () {
        Inbox::record(request()->user(), (string) Str::uuid(), 'App\Notifications\DeploymentFinished', InboxMessage::make('Deployment finished')
            ->url('/deploys/1')
            ->toast());

        return back();
    });

    $this->actingAs($this->user)
        ->from('/dashboard')
        ->post('/deploys/1/finish');

    $toast = $this->get('/dashboard', ['X-Inertia' => 'true'])->json('flash.inertiaui.toasts.0');

    expect($toast['actions'])->toBe([['label' => 'View', 'href' => '/deploys/1', 'altText' => 'Also in your notifications.']]);
});

it('flashes no toast when an observer cancels storing the notification', function (): void {
    Toast::fake();
    InboxNotification::creating(fn (): bool => false);

    $this->actingAs($this->user)
        ->from('/dashboard')
        ->post('/invoices/7/pay');

    expect(Inbox::query($this->user)->exists())->toBeFalse();

    Toast::assertNothingFlashed();
});

it('flashes a toast when the notification asks for one and the notifiable user makes the request', function (): void {
    $this->actingAs($this->user)
        ->from('/dashboard')
        ->post('/invoices/7/pay')
        ->assertToast('Invoice INV-7 paid', 'success');

    $this->user->notify(new InvoicePaid(toast: 'payment'));
    User::named('Sophie')->notify(new InvoicePaid(toast: true));

    $toasts = $this->get('/dashboard', ['X-Inertia' => 'true'])
        ->json('flash.inertiaui.toasts');
    $storedTypes = Inbox::query($this->user)
        ->get()
        ->map(fn (InboxNotification $notification) => $notification->toInboxArray()['toast'])
        ->all();
    $storedIds = Inbox::query($this->user)
        ->pluck('id')
        ->map(fn (string $id) => "inertiaui-inbox-{$id}")
        ->all();

    // The toast from the second request reached only the signed-in user, once.
    expect(array_column($toasts, 'title'))
        ->toBe(['Invoice INV-7 paid', 'Invoice INV-7 paid'])
        ->and(array_column($toasts, 'type'))
        ->toBe(['success', 'payment'])
        ->and($storedTypes)
        ->toEqualCanonicalizing(['success', 'payment'])
        // A toast that Echo shows for the same notification replaces this one.
        ->and(array_column($toasts, 'id'))
        ->toEqualCanonicalizing($storedIds);
});

it('lists notifications newest first with a cursor', function (): void {
    listedInbox($this->user);
    $this->actingAs($this->user);

    $first = $this->getJson('/_inertia-notifications?per_page=3')
        ->assertOk();
    $second = $this->getJson('/_inertia-notifications?per_page=3&cursor='.$first->json('nextCursor'))
        ->assertOk();

    expect($first->json('items.*.title'))
        ->toBe(['Unread 1', 'Unread 2', 'Unread 3'])
        ->and($second->json('items.*.title'))
        ->toBe(['Unread 4', 'Oldest'])
        ->and($second->json('nextCursor'))
        ->toBeNull();
});

it('gives each listed notification the revision from before the list was read', function (): void {
    listedInbox($this->user);

    $response = $this->actingAs($this->user)
        ->getJson('/_inertia-notifications?per_page=3')
        ->assertOk();

    // Each copy carries the time before the list was read, which orders it
    // against the changes that the browser knows of.
    expect($response->json('items.*.revision'))
        ->each->toBeInt()
        ->toBeLessThan(Inbox::revision());
});

it('returns the counts with the list', function (): void {
    $newest = listedInbox($this->user);

    $response = $this->actingAs($this->user)
        ->getJson('/_inertia-notifications?per_page=3')
        ->assertOk();

    // The counts name the newest notification, also when it is not counted,
    // so the frontend knows the server has seen it.
    expect(Arr::except($response->json('counts'), 'revision'))->toBe([
        'unread' => 4,
        'unseen' => 5,
        'categories' => [],
        'latest' => $newest->created_at->toIso8601String(),
        'latestIds' => [$newest->id],
    ]);
});

it('lists only the notifications that match the filter', function (string $filter, array $titles): void {
    listedInbox($this->user);

    $response = $this->actingAs($this->user)
        ->getJson("/_inertia-notifications?filter={$filter}");

    expect($response->json('items.*.title'))->toBe($titles);
})->with([
    'unread' => ['unread', ['Unread 1', 'Unread 2', 'Unread 3', 'Unread 4']],
    'archived' => ['archived', ['Archived']],
]);

it('does not find the notifications of another user', function (): void {
    $other = inboxItem(User::named('Sophie'), 'Not yours');

    $this->actingAs($this->user)
        ->postJson("/_inertia-notifications/{$other->id}/read")
        ->assertNotFound();
});

it('rejects an unknown filter', function (): void {
    $this->actingAs($this->user)
        ->getJson('/_inertia-notifications?filter=everything')
        ->assertUnprocessable();
});

it('updates one notification and returns the new counts', function (): void {
    $item = inboxItem($this->user, 'Invoice paid', 1);
    $newest = inboxItem($this->user, 'Comment posted');
    $counts = [
        'unread' => 1,
        'unseen' => 1,
        'categories' => [],
        'latest' => $newest->created_at->toIso8601String(),
        'latestIds' => [$newest->id],
    ];
    $this->actingAs($this->user);
    $revision = Inbox::revision();

    $read = $this->postJson("/_inertia-notifications/{$item->id}/read");

    // Counts read after the change have a newer revision, so the browser ignores counts from before it.
    expect(Arr::except($read->json('counts'), 'revision'))
        ->toBe($counts)
        ->and($read->json('counts.revision'))
        ->toBeGreaterThan($revision)
        ->and($read->json('counts.revision'))
        ->toBeLessThan(Inbox::revision());

    $this->postJson("/_inertia-notifications/{$item->id}/unread")
        ->assertJsonPath('counts.unread', 2);

    $archived = $this->postJson("/_inertia-notifications/{$item->id}/archive");
    $current = $this->getJson('/_inertia-notifications/counts');

    expect(Arr::except($archived->json('counts'), 'revision'))
        ->toBe($counts)
        ->and(Arr::except($current->json('counts'), 'revision'))
        ->toBe($counts);

    $this->postJson("/_inertia-notifications/{$item->id}/unarchive")
        ->assertJsonPath('counts.unread', 2);
});

it('returns the change of one notification for the browser to pass on to its other tabs', function (): void {
    $item = inboxItem($this->user, 'Invoice paid', 1);

    $read = $this->actingAs($this->user)
        ->postJson("/_inertia-notifications/{$item->id}/read");

    $item->refresh();
    expect($read->json('change'))->toBe([
        'kind' => 'item',
        'id' => $item->id,
        'readAt' => $item->read_at->toIso8601String(),
        'seenAt' => $item->seen_at->toIso8601String(),
        'archivedAt' => null,
        'snoozedUntil' => null,
        'result' => null,
    ]);
});

it('updates in bulk only the notifications created before the given time', function (): void {
    $old = inboxItem($this->user, 'Before the panel opened', 10);
    $readOld = inboxItem($this->user, 'Read before', 9, ['read_at' => now()]);
    $new = inboxItem($this->user, 'Arrived after');
    $before = now()
        ->subMinutes(5)
        ->toIso8601String();
    $this->actingAs($this->user);

    $this->postJson('/_inertia-notifications/seen', ['before' => $before])
        ->assertJsonPath('counts.unseen', 1);

    $read = $this->postJson('/_inertia-notifications/read', ['before' => $before]);

    expect(Arr::except($read->json('counts'), 'revision'))
        ->toBe([
            'unread' => 1,
            'unseen' => 1,
            'categories' => [],
            'latest' => $new->created_at->toIso8601String(),
            'latestIds' => [$new->id],
        ])
        ->and($read->json('change'))
        ->toBe(['kind' => 'read', 'before' => $before, 'ids' => null, 'category' => null]);

    $this->postJson('/_inertia-notifications/archive', ['before' => $before, 'read' => true])
        ->assertJsonPath('change', [
            'kind' => 'archive',
            'before' => $before,
            'ids' => null,
            'category' => null,
            'onlyRead' => true,
        ]);

    expect($old->fresh()->read_at)
        ->not->toBeNull()
        ->and($new->fresh()->read_at)
        ->toBeNull()
        ->and($old->fresh()->archived_at)
        ->not->toBeNull()
        ->and($readOld->fresh()->archived_at)
        ->not->toBeNull()
        ->and($new->fresh()->archived_at)
        ->toBeNull();
});

it('updates in bulk the notifications created before a UTC time in another application timezone', function (): void {
    config(['app.timezone' => 'Asia/Tokyo']);
    date_default_timezone_set('Asia/Tokyo');
    $old = inboxItem($this->user, 'Before the panel opened', 10);
    $new = inboxItem($this->user, 'Arrived after');
    $before = now()
        ->subMinutes(5)
        ->toIso8601ZuluString();

    $this->actingAs($this->user)
        ->postJson('/_inertia-notifications/read', ['before' => $before])
        ->assertJsonPath('counts.unread', 1);

    expect($old->fresh()->read_at)
        ->not->toBeNull()
        ->and($new->fresh()->read_at)
        ->toBeNull();
});

it('updates in bulk the notifications created before an instant given in another timezone', function (): void {
    $this->travelTo(Carbon::parse('2026-11-18 10:00', 'UTC'));
    $item = Inbox::record($this->user, (string) Str::uuid(), 'test', InboxMessage::make('Invoice paid'));

    $this->travelTo(Carbon::parse('2026-11-18 12:00', 'UTC'));
    Inbox::markAllAsRead($this->user, before: now('America/New_York'));

    expect($item->fresh()->read_at)->not->toBeNull();
});

it('updates in bulk only the notifications of the given category', function (string $path, string $column): void {
    $billing = inboxItem($this->user, 'Invoice paid', 10, ['category' => 'billing']);
    $comment = inboxItem($this->user, 'Sophie commented', 10, ['category' => 'comments']);
    $uncategorized = inboxItem($this->user, 'Weekly report', 10);
    $this->actingAs($this->user);

    $this->postJson("/_inertia-notifications/{$path}", ['category' => 'billing'])
        ->assertJsonPath('change.category', 'billing');

    expect($billing->fresh()->{$column})
        ->not->toBeNull()
        ->and($comment->fresh()->{$column})
        ->toBeNull()
        ->and($uncategorized->fresh()->{$column})
        ->toBeNull();
})->with([
    'seen' => ['seen', 'seen_at'],
    'read' => ['read', 'read_at'],
    'archive' => ['archive', 'archived_at'],
]);

it('rejects a bulk archive of the read notifications with a read value that is not a boolean', function (): void {
    $unread = inboxItem($this->user, 'Invoice paid');

    $this->actingAs($this->user)
        ->postJson('/_inertia-notifications/archive', ['read' => 'only'])
        ->assertJsonValidationErrors('read');

    expect($unread->fresh()->archived_at)->toBeNull();
});

it('archives every notification in bulk when no time is given', function (): void {
    $new = inboxItem($this->user, 'Arrived after');

    $this->actingAs($this->user)
        ->postJson('/_inertia-notifications/archive');

    expect($new->fresh()->archived_at)->not->toBeNull();
});

it('archives every notification in bulk when no time is given while the application uses immutable dates', function (): void {
    $new = inboxItem($this->user, 'Arrived after');

    Date::use(CarbonImmutable::class);

    try {
        $this->actingAs($this->user)
            ->postJson('/_inertia-notifications/archive')
            ->assertOk();
    } finally {
        Date::useDefault();
    }

    expect($new->fresh()->archived_at)->not->toBeNull();
});

it('leaves out of a bulk update the notifications of the same second that the browser did not have', function (
    string $path,
    string $column,
): void {
    $at = now()->startOfSecond();
    $older = inboxItem($this->user, 'Older', 0, ['created_at' => $at->copy()->subSecond()]);
    $listed = inboxItem($this->user, 'Listed', 0, ['created_at' => $at]);
    $arrived = inboxItem($this->user, 'Arrived in the same second', 0, ['created_at' => $at]);
    $this->actingAs($this->user);

    $this->postJson("/_inertia-notifications/{$path}", ['before' => $at->toIso8601String(), 'ids' => [$listed->id]])
        ->assertJsonPath('change.ids', [$listed->id]);

    expect($older->fresh()->{$column})
        ->not->toBeNull()
        ->and($listed->fresh()->{$column})
        ->not->toBeNull()
        ->and($arrived->fresh()->{$column})
        ->toBeNull();
})->with([
    'seen' => ['seen', 'seen_at'],
    'read' => ['read', 'read_at'],
    'archive' => ['archive', 'archived_at'],
]);

it('accepts at most 1000 IDs in a bulk update', function (string $path): void {
    $data = fn (int $count): array => [
        'before' => now()->toIso8601String(),
        'ids' => array_map(fn (): string => (string) Str::uuid(), range(1, $count)),
    ];
    $this->actingAs($this->user);

    $this->postJson("/_inertia-notifications/{$path}", $data(1000))
        ->assertOk();

    $this->postJson("/_inertia-notifications/{$path}", $data(1001))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('ids');
})->with(['seen', 'read', 'archive']);

it('shares nothing with the pages of a guest', function (): void {
    $this->get('/dashboard', ['X-Inertia' => 'true'])
        ->assertJsonPath('props.inertiauiInbox', null);
});

it('shares the counts, the URL, and the broadcast channel with the pages of a signed-in user', function (): void {
    $item = inboxItem($this->user, 'Invoice paid');

    $shared = $this->actingAs($this->user)
        ->get('/dashboard', ['X-Inertia' => 'true'])
        ->json('props.inertiauiInbox');

    expect(Arr::except($shared, ['user', 'revision']))->toBe([
        'url' => '/_inertia-notifications',
        // This is the channel of Laravel's broadcast notifications for the user.
        'channel' => "InertiaUI.Notifications.Tests.Fixtures.User.{$this->user->id}",
        'announcementsChannel' => null,
        'allowedActions' => ['snooze', 'archive', 'mute'],
        'selectable' => true,
        'categoryFilter' => [],
        'tabs' => [],
        'pause' => null,
        'push' => null,
        'unread' => 1,
        'unseen' => 1,
        'categories' => [],
        'latest' => $item->created_at->toIso8601String(),
        'latestIds' => [$item->id],
    ]);
});

it('shares an identity of the user that tells the browser another user signed in', function (): void {
    $shared = $this->actingAs($this->user)
        ->get('/dashboard', ['X-Inertia' => 'true'])
        ->json('props.inertiauiInbox');

    // Long-running test servers flush Inertia's shared props after each request,
    // so we will do the same before each of the requests that follow.
    Inertia::flushShared();

    $sophie = $this->actingAs(User::named('Sophie'))
        ->get('/dashboard', ['X-Inertia' => 'true'])
        ->json('props.inertiauiInbox.user');

    Inertia::flushShared();

    $again = $this->actingAs($this->user)
        ->get('/dashboard', ['X-Inertia' => 'true'])
        ->json('props.inertiauiInbox.user');

    // The identity is the same for every page of the user.
    expect($shared['user'])
        ->toBeString()
        ->not->toBe($sophie)
        ->and($again)
        ->toBe($shared['user']);
});

it('lists every notification created in the second of the newest one', function (): void {
    $at = now()->startOfSecond();
    inboxItem($this->user, 'Older', 0, ['created_at' => $at->copy()->subSecond()]);
    $first = inboxItem($this->user, 'First', 0, ['created_at' => $at]);
    $second = inboxItem($this->user, 'Second', 0, ['created_at' => $at, 'archived_at' => $at]);

    $summary = Inbox::summary($this->user);

    // Times have no fractions of a second, so the summary lists every
    // notification that was created in the second of the newest one.
    expect($summary)
        ->toMatchArray(['latest' => $at->toIso8601String()])
        ->and($summary['latestIds'])
        ->toEqualCanonicalizing([$first->id, $second->id]);
});

it('summarizes an inbox without notifications', function (): void {
    inboxItem($this->user, 'Not yours');
    $sophie = User::named('Sophie');

    $summary = Inbox::summary($sophie);

    expect(Arr::except($summary, 'revision'))->toBe([
        'unread' => 0,
        'unseen' => 0,
        'categories' => [],
        'latest' => null,
        'latestIds' => [],
    ]);
});

it('reads the counts and the newest notifications in one statement', function (): void {
    inboxItem($this->user, 'Older', 1);
    $inserted = null;

    // We will store a notification right after the query that reads the counts.
    // The summary reads everything in one statement, so the notification that
    // is stored meanwhile is in neither the counts nor the newest ones.
    DB::listen(function (QueryExecuted $query) use (&$inserted): void {
        if ($inserted === null && str_contains($query->sql, 'row_kind')) {
            // Storing the notification runs queries that call this listener
            // again, so we will mark it as stored before we store it.
            $inserted = false;
            $inserted = inboxItem($this->user, 'Stored meanwhile', 0, ['created_at' => now()->addMinute()]);
        }
    });

    $summary = Inbox::summary($this->user);

    expect($inserted)
        ->toBeInstanceOf(InboxNotification::class)
        ->and($summary['unread'])
        ->toBe(1)
        ->and($summary['latestIds'])
        ->not->toContain($inserted->id);
});

it('uses the channel of receivesBroadcastNotificationsOn(), unless it needs the notification', function (): void {
    $user = new class extends User
    {
        /**
         * Get the channel that the user receives notification broadcasts on.
         */
        public function receivesBroadcastNotificationsOn(): string
        {
            return 'users.'.$this->getKey();
        }
    };

    $perNotification = new class extends User
    {
        /**
         * Get the channel that the user receives the given notification broadcast on.
         */
        public function receivesBroadcastNotificationsOn(Notification $notification): string
        {
            return 'users.'.$this->getKey();
        }
    };

    expect(Inbox::channel($user->forceFill(['id' => 5])))
        ->toBe('users.5')
        ->and(Inbox::channel($perNotification->forceFill(['id' => 5])))
        ->toBeNull();
});

it('broadcasts no changes unless enabled', function (): void {
    Event::fake([InboxChanged::class]);
    $item = inboxItem($this->user, 'Invoice paid', 10);

    $this->actingAs($this->user)
        ->postJson("/_inertia-notifications/{$item->id}/read")
        ->assertOk();

    Event::assertNotDispatched(InboxChanged::class);
});

it('broadcasts changes to the other sessions of the user when enabled', function (): void {
    Event::fake([InboxChanged::class]);
    config(['inertia-notifications.inbox.broadcast_changes' => true]);
    $item = inboxItem($this->user, 'Invoice paid', 10);
    $this->actingAs($this->user);

    $this->postJson("/_inertia-notifications/{$item->id}/archive", [], ['X-Socket-ID' => '1234.5678'])
        ->assertOk();
    $this->postJson('/_inertia-notifications/seen', ['before' => '2026-01-02T03:04:05+00:00'])
        ->assertOk();

    $events = Event::dispatched(InboxChanged::class)->map(fn (array $args) => $args[0]);
    [$archived, $seen] = $events->all();

    expect($events)
        ->toHaveCount(2)
        ->and($archived->broadcastOn())
        ->toEqual([new PrivateChannel("InertiaUI.Notifications.Tests.Fixtures.User.{$this->user->id}")])
        ->and($archived->broadcastAs())
        ->toBe('inertiaui.inbox.changed')
        // The session that made the change already shows it.
        ->and($archived->socket)
        ->toBe('1234.5678')
        ->and(Arr::except($archived->broadcastWith()['change'], ['readAt', 'seenAt', 'archivedAt']))
        ->toBe(['kind' => 'item', 'id' => $item->id, 'snoozedUntil' => null, 'result' => null])
        ->and($archived->broadcastWith()['change']['archivedAt'])
        ->not->toBeNull()
        // The archived notification is no longer counted, but stays the newest the server knows of.
        ->and(Arr::except($archived->broadcastWith()['counts'], 'revision'))
        ->toBe([
            'unread' => 0,
            'unseen' => 0,
            'categories' => [],
            'latest' => $item->created_at->toIso8601String(),
            'latestIds' => [$item->id],
        ])
        // Queued broadcasts may arrive in another order than they were sent,
        // so each one carries a newer revision than the one before it.
        ->and($seen->broadcastWith()['counts']['revision'])
        ->toBeGreaterThan($archived->broadcastWith()['counts']['revision'])
        ->and($seen->socket)
        ->toBeNull()
        ->and($seen->broadcastWith()['change'])
        ->toBe(['kind' => 'seen', 'before' => '2026-01-02T03:04:05+00:00', 'ids' => null, 'category' => null]);
});

it('rejects a snooze time in the past', function (): void {
    $item = inboxItem($this->user, 'Invoice paid', 5);

    $this->actingAs($this->user)
        ->postJson("/_inertia-notifications/{$item->id}/snooze", ['until' => now()->subMinute()->toIso8601String()])
        ->assertUnprocessable();
});

it('snoozes a notification out of the inbox and its counts until the given time', function (): void {
    $item = inboxItem($this->user, 'Invoice paid', 5);
    inboxItem($this->user, 'Comment posted');
    // An archived notification stays archived, also while it is snoozed.
    inboxItem($this->user, 'Archived', 6, ['archived_at' => now(), 'snoozed_until' => now()->addDay()]);
    $this->actingAs($this->user);
    $until = now()
        ->addHour()
        ->startOfSecond();

    $this->postJson("/_inertia-notifications/{$item->id}/snooze", ['until' => $until->toIso8601String()])
        ->assertJsonPath('counts.unread', 1)
        ->assertJsonPath('change.snoozedUntil', $until->toIso8601String());

    $inbox = $this->getJson('/_inertia-notifications');
    $snoozed = $this->getJson('/_inertia-notifications?filter=snoozed');

    expect($inbox->json('items.*.title'))
        ->toBe(['Comment posted'])
        ->and($snoozed->json('items.*.title'))
        ->toBe(['Invoice paid']);

    // The notification is back in the inbox, in its old place, once the time has come.
    $this->travelTo($until);

    $inbox = $this->getJson('/_inertia-notifications');

    expect($inbox->json('items.*.title'))->toBe(['Comment posted', 'Invoice paid']);
});

it('snoozes a notification until a time after 2038', function (): void {
    $item = inboxItem($this->user, 'Invoice paid', 5);

    $this->actingAs($this->user)
        ->postJson("/_inertia-notifications/{$item->id}/snooze", ['until' => '2099-01-01T08:00:00+00:00'])
        ->assertOk()
        ->assertJsonPath('change.snoozedUntil', '2099-01-01T08:00:00+00:00');

    expect($item->refresh()->snoozed_until->toIso8601String())->toBe('2099-01-01T08:00:00+00:00');
});

it('snoozes until the given moment in an application timezone other than UTC', function (): void {
    config(['app.timezone' => 'Asia/Tokyo']);
    date_default_timezone_set('Asia/Tokyo');
    $item = inboxItem($this->user, 'Invoice paid', 5);
    inboxItem($this->user, 'Comment posted');
    $until = now()
        ->addHours(3)
        ->startOfSecond();
    $this->actingAs($this->user);

    // The browser sends the time in UTC.
    $this->postJson("/_inertia-notifications/{$item->id}/snooze", ['until' => $until->toIso8601ZuluString()])
        ->assertJsonPath('counts.unread', 1)
        ->assertJsonPath('change.snoozedUntil', $until->toIso8601String());

    $snoozed = $this->getJson('/_inertia-notifications?filter=snoozed');

    expect($snoozed->json('items.*.title'))->toBe(['Invoice paid']);
});

it('unsnoozes a notification', function (): void {
    $item = inboxItem($this->user, 'Invoice paid', 5, ['snoozed_until' => now()->addHour()]);
    inboxItem($this->user, 'Comment posted');
    inboxItem($this->user, 'Archived', 6, ['archived_at' => now(), 'snoozed_until' => now()->addDay()]);

    $this->actingAs($this->user)
        ->postJson("/_inertia-notifications/{$item->id}/unsnooze")
        ->assertJsonPath('counts.unread', 2);

    expect($item->fresh()->snoozed_until)->toBeNull();
});

it('deletes a notification when deleting is enabled', function (): void {
    config(['inertia-notifications.inbox.actions' => ['snooze', 'archive', 'mute', 'delete']]);
    $item = inboxItem($this->user, 'Invoice paid', 1);
    $kept = inboxItem($this->user, 'Comment posted');

    $response = $this->actingAs($this->user)
        ->postJson("/_inertia-notifications/{$item->id}/delete");

    $response->assertJsonPath('change', ['kind' => 'delete', 'ids' => [$item->id]])
        ->assertJsonPath('counts.unread', 1)
        ->assertJsonPath('counts.latestIds', [$kept->id]);

    expect(InboxNotification::query()->pluck('id')->all())->toBe([$kept->id]);
});

it('finds no endpoint to delete a notification unless deleting is enabled', function (): void {
    $item = inboxItem($this->user, 'Invoice paid');

    $this->actingAs($this->user)
        ->postJson("/_inertia-notifications/{$item->id}/delete")
        ->assertNotFound();

    expect(InboxNotification::query()->count())->toBe(1);
});

it('does not delete the notifications of another user', function (): void {
    config(['inertia-notifications.inbox.actions' => ['snooze', 'archive', 'mute', 'delete']]);
    $item = inboxItem(User::named('Sophie'), 'Not yours');

    $this->actingAs($this->user)
        ->postJson("/_inertia-notifications/{$item->id}/delete")
        ->assertNotFound();

    expect(InboxNotification::query()->count())->toBe(1);
});

it('shares with the pages the actions that the user may take on notifications', function (): void {
    config(['inertia-notifications.inbox.actions' => ['delete', 'archive']]);

    $this->actingAs($this->user)
        ->get('/dashboard', ['X-Inertia' => 'true'])
        ->assertJsonPath('props.inertiauiInbox.allowedActions', ['archive', 'delete']);
});

it('reads the actions of the config in their own order, without unknown or repeated ones', function (): void {
    config(['inertia-notifications.inbox' => Arr::except(config('inertia-notifications.inbox'), 'actions')]);

    expect(Inbox::actions())->toBe(['snooze', 'archive', 'mute']);

    config(['inertia-notifications.inbox.actions' => ['delete', 'read', 'archive', 'archive']]);

    expect(Inbox::actions())->toBe(['archive', 'delete']);

    config(['inertia-notifications.inbox.actions' => []]);

    expect(Inbox::actions())->toBe([]);
});

it('finds no endpoints for an action that the config leaves out, before it validates the request', function (string $endpoint, array $data, array $attributes): void {
    config(['inertia-notifications.inbox.actions' => []]);
    $item = inboxItem($this->user, 'Invoice paid', 0, ['group_key' => 'thread:7', ...$attributes]);
    $state = fn (): array => [
        $item->fresh()->archived_at?->toIso8601String(),
        $item->fresh()->snoozed_until?->toIso8601String(),
        Inbox::isMuted($this->user, 'thread:7'),
    ];
    $before = $state();

    $this->actingAs($this->user)
        ->postJson('/_inertia-notifications/'.str_replace('{id}', $item->id, $endpoint), $data)
        ->assertNotFound();

    expect($state())->toBe($before);
})->with([
    'archive' => ['{id}/archive', [], []],
    'unarchive' => ['{id}/unarchive', [], ['archived_at' => '2026-11-20 10:00:00']],
    'archive all without a time' => ['archive', [], []],
    'snooze' => ['{id}/snooze', ['until' => '2099-01-01T00:00:00+00:00'], []],
    'snooze without a time' => ['{id}/snooze', [], []],
    'unsnooze' => ['{id}/unsnooze', [], ['snoozed_until' => '2099-01-01 00:00:00']],
    'mute' => ['{id}/mute', [], []],
    'unmute' => ['{id}/unmute', [], []],
    'delete' => ['{id}/delete', [], []],
]);

it('finds no batch for an action that the config leaves out, and still runs the others', function (string $action, array $data): void {
    config(['inertia-notifications.inbox.actions' => []]);
    $item = inboxItem($this->user, 'Invoice paid');

    $this->actingAs($this->user)
        ->postJson('/_inertia-notifications/batch', ['action' => $action, 'ids' => [$item->id], ...$data])
        ->assertNotFound();

    $this->postJson('/_inertia-notifications/batch', ['action' => 'read', 'ids' => [$item->id]])
        ->assertOk();

    expect($item->refresh())
        ->isRead()->toBeTrue()
        ->archived_at->toBeNull()
        ->snoozed_until->toBeNull();
})->with([
    'archive' => ['archive', []],
    'unarchive' => ['unarchive', []],
    'snooze' => ['snooze', ['until' => '2099-01-01T00:00:00+00:00']],
    'snooze without a time' => ['snooze', []],
    'unsnooze' => ['unsnooze', []],
    'delete' => ['delete', []],
]);

it('leaves out the snoozed and archived lists while the config leaves out snoozing and archiving', function (): void {
    config(['inertia-notifications.inbox.actions' => ['mute']]);
    inboxItem($this->user, 'Invoice paid');
    inboxItem($this->user, 'Archived', 1, ['archived_at' => now()]);
    Route::middleware('web')->get('/inbox', fn () => Inertia::render('Inbox', [
        'notifications' => Inbox::scroll(request()->user(), request()->query('filter')),
    ]));

    $this->actingAs($this->user)
        ->getJson('/_inertia-notifications?filter=archived')
        ->assertUnprocessable()
        ->assertJsonValidationErrors('filter');

    $page = $this->get('/inbox?filter=archived', ['X-Inertia' => 'true'])->json();

    expect(Inbox::filters())
        ->toBe(['all', 'unread'])
        ->and(array_column($page['props']['notifications']['data'], 'title'))
        ->toBe(['Invoice paid']);

    // The names of the built-in tabs stay reserved, so the application's tabs keep working once the actions return.
    config(['inertia-notifications.inbox.tabs' => ['archived' => ['category' => 'billing']]]);

    expect(fn () => Inbox::tabs())->toThrow(InvalidArgumentException::class);
});

it('changes the given notifications in one request', function (): void {
    $first = inboxItem($this->user, 'Invoice paid', 2);
    $second = inboxItem($this->user, 'Comment posted', 1);
    $other = inboxItem($this->user, 'Deployment finished');
    $notYours = inboxItem(User::named('Sophie'), 'Not yours');

    $response = $this->actingAs($this->user)->postJson('/_inertia-notifications/batch', [
        'action' => 'read',
        'ids' => [$first->id, $second->id, $notYours->id],
    ]);

    $response->assertJsonPath('change.kind', 'items')
        ->assertJsonPath('change.action', 'read')
        ->assertJsonPath('counts.unread', 1);

    expect($response->json('change.ids'))->toEqualCanonicalizing([$first->id, $second->id])
        ->and($first->refresh()->read_at)->not->toBeNull()
        ->and($second->refresh()->read_at)->not->toBeNull()
        ->and($other->refresh()->read_at)->toBeNull()
        ->and($notYours->refresh()->read_at)->toBeNull();
});

it('archives and unarchives the given notifications', function (string $action, ?string $archivedAt, bool $archived): void {
    $item = inboxItem($this->user, 'Invoice paid', 0, ['archived_at' => $archivedAt]);

    $this->actingAs($this->user)
        ->postJson('/_inertia-notifications/batch', ['action' => $action, 'ids' => [$item->id]])
        ->assertOk();

    expect($item->refresh()->archived_at !== null)->toBe($archived);
})->with([
    'archive' => ['archive', null, true],
    'unarchive' => ['unarchive', '2026-11-15 10:00:00', false],
]);

it('snoozes and unsnoozes the given notifications', function (): void {
    $first = inboxItem($this->user, 'Invoice paid', 1);
    $second = inboxItem($this->user, 'Comment posted', 0, ['snoozed_until' => '2026-11-22 12:00:00']);
    // After the notifications, because inboxItem() travels back to the current time.
    $this->travelTo('2026-11-22 09:00:00');

    $this->actingAs($this->user)
        ->postJson('/_inertia-notifications/batch', [
            'action' => 'snooze',
            'ids' => [$first->id, $second->id],
            'until' => '2026-11-23T08:00:00+00:00',
        ])
        ->assertJsonPath('change.action', 'snooze')
        ->assertJsonPath('change.until', '2026-11-23T08:00:00+00:00');

    expect($first->refresh()->snoozed_until?->toIso8601String())->toBe('2026-11-23T08:00:00+00:00')
        ->and($second->refresh()->snoozed_until?->toIso8601String())->toBe('2026-11-23T08:00:00+00:00');

    $this->postJson('/_inertia-notifications/batch', ['action' => 'unsnooze', 'ids' => [$first->id]])
        ->assertJsonPath('change.action', 'unsnooze')
        ->assertJsonMissingPath('change.until');

    expect($first->refresh()->snoozed_until)->toBeNull()
        ->and($second->refresh()->snoozed_until)->not->toBeNull();
});

it('rejects a batch snooze without a time in the future', function (array $data): void {
    $item = inboxItem($this->user, 'Invoice paid');

    $this->actingAs($this->user)
        ->postJson('/_inertia-notifications/batch', ['action' => 'snooze', 'ids' => [$item->id], ...$data])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('until');

    expect($item->refresh()->snoozed_until)->toBeNull();
})->with([
    'no time' => [[]],
    'a past time' => [['until' => '2020-01-01T00:00:00+00:00']],
]);

it('deletes the given notifications in one request when deleting is enabled', function (): void {
    config(['inertia-notifications.inbox.actions' => ['snooze', 'archive', 'mute', 'delete']]);
    $first = inboxItem($this->user, 'Invoice paid', 1);
    $kept = inboxItem($this->user, 'Comment posted');

    $this->actingAs($this->user)
        ->postJson('/_inertia-notifications/batch', ['action' => 'delete', 'ids' => [$first->id]])
        ->assertJsonPath('change', ['kind' => 'delete', 'ids' => [$first->id]]);

    expect(InboxNotification::query()->pluck('id')->all())->toBe([$kept->id]);
});

it('finds no batch to delete unless deleting is enabled', function (): void {
    $item = inboxItem($this->user, 'Invoice paid');

    $this->actingAs($this->user)
        ->postJson('/_inertia-notifications/batch', ['action' => 'delete', 'ids' => [$item->id]])
        ->assertNotFound();

    expect(InboxNotification::query()->count())->toBe(1);
});

it('finds no batch while users may not select notifications, and still marks the shown ones as seen', function (): void {
    config(['inertia-notifications.inbox.selectable' => false]);
    $item = inboxItem($this->user, 'Invoice paid');

    $this->actingAs($this->user)
        ->get('/dashboard', ['X-Inertia' => 'true'])
        ->assertJsonPath('props.inertiauiInbox.selectable', false);

    // Not found before the request is validated, as for an action that the config leaves out.
    $this->postJson('/_inertia-notifications/batch', ['action' => 'read', 'ids' => [$item->id]])
        ->assertNotFound();
    $this->postJson('/_inertia-notifications/batch')
        ->assertNotFound();

    $this->postJson('/_inertia-notifications/seen/items', ['ids' => [$item->id]])
        ->assertOk()
        ->assertJsonPath('change.kind', 'items')
        ->assertJsonPath('change.action', 'seen')
        ->assertJsonPath('change.ids', [$item->id])
        ->assertJsonPath('counts.unseen', 0);

    expect($item->refresh())
        ->seen_at->not->toBeNull()
        ->isRead()->toBeFalse();
});

it('marks only the given notifications of the user as seen', function (): void {
    $shown = inboxItem($this->user, 'Invoice paid', 1);
    $notShown = inboxItem($this->user, 'Comment posted');
    $notYours = inboxItem(User::named('Sophie'), 'Not yours');

    $this->actingAs($this->user)
        ->postJson(route('inertia-notifications.seen-items'), ['ids' => [$shown->id, $notYours->id]])
        ->assertOk()
        ->assertJsonPath('change.ids', [$shown->id])
        ->assertJsonPath('counts.unseen', 1);

    expect([$shown->refresh()->seen_at, $notShown->refresh()->seen_at, $notYours->refresh()->seen_at])
        ->sequence(
            fn ($seenAt) => $seenAt->not->toBeNull(),
            fn ($seenAt) => $seenAt->toBeNull(),
            fn ($seenAt) => $seenAt->toBeNull(),
        );
});

it('validates the notifications to mark as seen', function (array $data): void {
    $this->actingAs($this->user)
        ->postJson('/_inertia-notifications/seen/items', $data)
        ->assertUnprocessable();
})->with([
    'without ids' => [[]],
    'with ids that are not UUIDs' => [['ids' => ['7']]],
    'with more than 100 ids' => [['ids' => array_map(fn (): string => (string) Str::uuid(), range(1, 101))]],
]);

it('shares the categories of the config\'s category filter with their labels, in its order', function (): void {
    config([
        'inertia-notifications.preferences.categories' => [
            'comments' => ['label' => 'Comments'],
            'billing' => ['label' => 'Billing'],
            'reports' => ['label' => 'Weekly reports'],
        ],
        'inertia-notifications.inbox.category_filter' => ['reports', 'deployments', 'comments'],
    ]);

    // A key that the preferences do not list has no label to show, so it is left out.
    $this->actingAs($this->user)
        ->get('/dashboard', ['X-Inertia' => 'true'])
        ->assertJsonPath('props.inertiauiInbox.categoryFilter', ['reports' => 'Weekly reports', 'comments' => 'Comments']);

    config(['inertia-notifications.inbox.category_filter' => true]);

    expect(Inbox::categoryFilter())->toBe(['comments' => 'Comments', 'billing' => 'Billing', 'reports' => 'Weekly reports']);

    // A key with its own label shows that label, also when the preferences do not list it.
    config(['inertia-notifications.inbox.category_filter' => ['reports' => 'Reports', 'comments', 'deployments' => 'Deploys']]);

    expect(Inbox::categoryFilter())->toBe(['reports' => 'Reports', 'comments' => 'Comments', 'deployments' => 'Deploys']);

    config(['inertia-notifications.inbox.category_filter' => false]);

    expect(Inbox::categoryFilter())->toBe([]);
});

it('rejects an unknown batch action and more than 100 notifications', function (array $data): void {
    $this->actingAs($this->user)
        ->postJson('/_inertia-notifications/batch', $data)
        ->assertUnprocessable();
})->with([
    'unknown action' => [['action' => 'complete', 'ids' => ['a']]],
    'too many' => [['action' => 'read', 'ids' => array_map('strval', range(1, 101))]],
]);

it('rejects the IDs of a batch that are not UUIDs', function (): void {
    $this->actingAs($this->user)
        ->postJson('/_inertia-notifications/batch', ['action' => 'read', 'ids' => ['7']])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('ids.0');
});

it('rejects the IDs of a bulk update that are not UUIDs', function (string $endpoint): void {
    $this->actingAs($this->user)
        ->postJson("/_inertia-notifications/{$endpoint}", ['before' => now()->toIso8601String(), 'ids' => ['7']])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('ids.0');
})->with(['read', 'seen', 'archive']);

it('does not find a notification by an ID that is not a UUID', function (string $method, string $path): void {
    $this->actingAs($this->user)
        ->json($method, "/_inertia-notifications/{$path}")
        ->assertNotFound();
})->with([
    'show' => ['GET', '7'],
    'open' => ['GET', '7/open'],
    'read' => ['POST', '7/read'],
    'unread' => ['POST', '7/unread'],
    'archive' => ['POST', '7/archive'],
    'unarchive' => ['POST', '7/unarchive'],
    'snooze' => ['POST', '7/snooze'],
    'unsnooze' => ['POST', '7/unsnooze'],
    'delete' => ['POST', '7/delete'],
    'complete' => ['POST', '7/complete'],
    'mute' => ['POST', '7/mute'],
    'unmute' => ['POST', '7/unmute'],
]);

it('lists the notifications of a tab that the application added, by category and data', function (): void {
    config(['inertia-notifications.inbox.tabs' => [
        'production' => ['label' => 'Production', 'category' => 'deployments', 'data' => ['environment' => 'production', 'urgent' => true]],
    ]]);
    $record = fn (string $title, ?string $category, array $data, array $attributes = []) => Inbox::record(
        $this->user,
        (string) Str::uuid(),
        'test',
        InboxMessage::make($title)->category($category)->with($data),
    )->forceFill($attributes)->save();

    $record('Production deployed', 'deployments', ['environment' => 'production', 'urgent' => true]);
    $record('Staging deployed', 'deployments', ['environment' => 'staging', 'urgent' => true]);
    $record('Not urgent', 'deployments', ['environment' => 'production', 'urgent' => false]);
    $record('Other category', 'billing', ['environment' => 'production', 'urgent' => true]);
    $record('Archived production', 'deployments', ['environment' => 'production', 'urgent' => true], ['archived_at' => now()]);

    $items = $this->actingAs($this->user)
        ->getJson('/_inertia-notifications?filter=production')
        ->assertOk()
        ->json('items');

    expect(array_column($items, 'title'))->toBe(['Production deployed']);
});

it('rejects the columns of a filter that is not a tab', function (): void {
    config(['inertia-notifications.inbox.tabs' => ['production' => ['category' => 'deployments']]]);

    $this->actingAs($this->user)
        ->getJson('/_inertia-notifications?filter=category')
        ->assertUnprocessable();
});

it('shares the tabs of the application, with their translated labels', function (): void {
    config(['inertia-notifications.inbox.tabs' => ['production' => ['label' => 'Production', 'data' => ['environment' => 'production']]]]);

    $this->actingAs($this->user)
        ->get('/dashboard', ['X-Inertia' => 'true'])
        ->assertJsonPath('props.inertiauiInbox.tabs', [
            'production' => ['label' => 'Production', 'category' => null, 'data' => ['environment' => 'production']],
        ]);
});

it('rejects a tab that would take the place of a built-in tab or query an unsafe data field', function (array $tabs): void {
    config(['inertia-notifications.inbox.tabs' => $tabs]);

    expect(fn () => Inbox::tabs())->toThrow(InvalidArgumentException::class);
})->with([
    'built-in name' => [['archived' => ['category' => 'billing']]],
    'unsafe key' => [['a b' => ['category' => 'billing']]],
    'unsafe data field' => [['production' => ['data' => ["environment') or 1=1 --" => 'x']]]],
    'array value' => [['production' => ['data' => ['environment' => ['production']]]]],
]);

it('filters a full inbox page by a tab of the application', function (): void {
    config(['inertia-notifications.inbox.tabs' => ['billing' => ['category' => 'billing']]]);
    Inbox::record($this->user, (string) Str::uuid(), 'test', InboxMessage::make('Invoice paid')->category('billing'));
    Inbox::record($this->user, (string) Str::uuid(), 'test', InboxMessage::make('Comment posted')->category('comments'));
    Route::middleware('web')->get('/inbox', fn () => Inertia::render('Inbox', [
        'notifications' => Inbox::scroll(request()->user(), request()->query('filter')),
    ]));

    $page = $this->actingAs($this->user)
        ->get('/inbox?filter=billing', ['X-Inertia' => 'true'])
        ->json();

    expect(array_column($page['props']['notifications']['data'], 'title'))->toBe(['Invoice paid']);
});

it('keeps the inbox of another kind of notifiable model with the same ID apart', function (): void {
    $team = Team::query()->create(['id' => $this->user->id, 'name' => 'Acme']);
    $titles = fn (Model $notifiable): array => collect(Inbox::paginate($notifiable)->items())
        ->map->toInboxArray()
        ->pluck('title')
        ->all();

    $this->user->notify(new InvoicePaid);
    $team->notify(new class extends InvoicePaid
    {
        /**
         * Get the inbox representation of the notification.
         */
        public function toInbox(object $notifiable): InboxMessage
        {
            return InboxMessage::make('Team plan renewed');
        }
    });
    Inbox::record($team, (string) Str::uuid(), 'test', InboxMessage::make('Team member joined'));

    expect($team->getKey())
        ->toBe($this->user->getKey())
        ->and($titles($this->user))
        ->toBe(['Invoice INV-7 paid'])
        ->and($titles($team))
        ->toEqualCanonicalizing(['Team plan renewed', 'Team member joined'])
        ->and($this->user->inboxCounts()->toArray())
        ->toBe(['unread' => 1, 'unseen' => 1])
        ->and($team->inboxCounts()->toArray())
        ->toBe(['unread' => 2, 'unseen' => 2]);
});

it('filters a full inbox page by a tab whose key is only digits', function (): void {
    config(['inertia-notifications.inbox.tabs' => ['2024' => ['category' => 'billing']]]);
    Inbox::record($this->user, (string) Str::uuid(), 'test', InboxMessage::make('Invoice paid')->category('billing'));
    Inbox::record($this->user, (string) Str::uuid(), 'test', InboxMessage::make('Comment posted')->category('comments'));
    Route::middleware('web')->get('/inbox', fn () => Inertia::render('Inbox', [
        'notifications' => Inbox::scroll(request()->user(), request()->query('filter')),
    ]));

    $page = $this->actingAs($this->user)
        ->get('/inbox?filter=2024', ['X-Inertia' => 'true'])
        ->json();

    expect(array_column($page['props']['notifications']['data'], 'title'))
        ->toBe(['Invoice paid'])
        ->and(Inbox::filters())
        ->toBe([...Inbox::FILTERS, '2024']);
});

it('counts the unread notifications of each category in the inbox', function (): void {
    foreach (['billing', 'billing', 'comments', null] as $index => $category) {
        inboxItem($this->user, "Notification {$index}", $index, ['category' => $category]);
    }
    inboxItem($this->user, 'Read', 5, ['category' => 'deployments', 'read_at' => now()]);
    inboxItem($this->user, 'Archived', 6, ['category' => 'comments', 'archived_at' => now()]);
    inboxItem($this->user, 'Snoozed', 7, ['category' => 'billing', 'snoozed_until' => now()->addDay()]);

    $summary = Inbox::summary($this->user);

    expect($summary)->toMatchArray(['unread' => 4, 'unseen' => 5, 'categories' => ['billing' => 2, 'comments' => 1]]);
});

it('lists only the notifications of the given category', function (): void {
    foreach (['billing', 'billing', 'comments', null] as $index => $category) {
        inboxItem($this->user, "Notification {$index}", $index, ['category' => $category]);
    }
    inboxItem($this->user, 'Read', 5, ['category' => 'deployments', 'read_at' => now()]);
    inboxItem($this->user, 'Archived', 6, ['category' => 'comments', 'archived_at' => now()]);
    inboxItem($this->user, 'Snoozed', 7, ['category' => 'billing', 'snoozed_until' => now()->addDay()]);

    $response = $this->actingAs($this->user)
        ->getJson('/_inertia-notifications?category=billing');

    expect($response->json('items.*.title'))->toBe(['Notification 0', 'Notification 1']);
});

it('brings back snoozed notifications as new ones at the top with the unsnooze command', function (): void {
    $snoozedUntil = now()->subMinute()->startOfSecond();

    $due = inboxItem($this->user, 'Due', 60, [
        'read_at' => now(),
        'seen_at' => now(),
        'snoozed_until' => $snoozedUntil,
    ]);
    $later = inboxItem($this->user, 'Later', 60, ['snoozed_until' => now()->addHour()]);
    // An archived notification stays archived and read, also when its snooze time has come.
    $archived = inboxItem($this->user, 'Archived', 60, [
        'read_at' => now(),
        'archived_at' => now(),
        'snoozed_until' => $snoozedUntil,
    ]);
    inboxItem($this->user, 'Newer', 30);

    $this->artisan('inertia-notifications:unsnooze')
        ->assertSuccessful();

    $due->refresh();
    expect($due->only(['read_at', 'seen_at', 'snoozed_until']))
        ->toBe(['read_at' => null, 'seen_at' => null, 'snoozed_until' => null])
        ->and($due->created_at->toIso8601String())
        ->toBe($snoozedUntil->toIso8601String())
        ->and($later->fresh()->snoozed_until)
        ->not->toBeNull()
        ->and($archived->fresh()->read_at)
        ->not->toBeNull()
        ->and($this->actingAs($this->user)->getJson('/_inertia-notifications')->json('items.*.title'))
        ->toBe(['Due', 'Newer']);
});

it('broadcasts the notifications that the unsnooze command brings back', function (): void {
    Event::fake([InboxChanged::class]);
    config(['inertia-notifications.inbox.broadcast_changes' => true]);
    $due = inboxItem($this->user, 'Due', 60, [
        'read_at' => now(),
        'seen_at' => now(),
        'snoozed_until' => now()->subMinute()->startOfSecond(),
    ]);
    inboxItem($this->user, 'Later', 60, ['snoozed_until' => now()->addHour()]);
    inboxItem($this->user, 'Newer', 30);

    $this->artisan('inertia-notifications:unsnooze')
        ->assertSuccessful();

    $due->refresh();
    $event = Event::dispatched(InboxChanged::class)->sole()[0];

    // The user's open pages add the notification to the list and the counts.
    expect(Arr::except($event->broadcastWith()['change']['item'], 'revision'))
        ->toEqual(Arr::except($due->toInboxArray(), 'revision'))
        ->and($event->broadcastWith()['counts'])
        ->toMatchArray(['unread' => 2, 'unseen' => 2]);
});

it('leaves a snoozed notification as it is when it changed after it was read', function (Closure $change): void {
    $item = inboxItem($this->user, 'Due', 60, [
        'read_at' => now(),
        'seen_at' => now(),
        'snoozed_until' => now()->subMinute()->startOfSecond(),
    ]);
    $read = InboxNotification::query()->dueToUnsnooze()->sole();

    $change($item);
    $changed = $item->fresh()->getAttributes();

    expect($read->unsnoozeAsNew())
        ->toBeFalse()
        ->and($item->fresh()->getAttributes())
        ->toBe($changed);
})->with([
    'snoozed again' => [fn (InboxNotification $item) => $item->snooze(now()->addHour())],
    'snoozed again until a past time' => [fn (InboxNotification $item) => $item->snooze(now()->subSeconds(30))],
    'archived' => [fn (InboxNotification $item) => $item->archive()],
]);

it('brings back a snoozed notification only once', function (): void {
    $item = inboxItem($this->user, 'Due', 60, ['snoozed_until' => now()->subMinute()->startOfSecond()]);
    $read = InboxNotification::query()->dueToUnsnooze()->sole();

    expect($read->unsnoozeAsNew())->toBeTrue();

    $broughtBack = $item->fresh()->getAttributes();
    $this->travel(5)->minutes();

    expect($read->unsnoozeAsNew())
        ->toBeFalse()
        ->and($item->fresh()->getAttributes())
        ->toBe($broughtBack);
});

it('broadcasts a snoozed notification once when two runs of the unsnooze command overlap', function (): void {
    Event::fake([InboxChanged::class]);
    config(['inertia-notifications.inbox.broadcast_changes' => true]);
    inboxItem($this->user, 'Due', 60, ['snoozed_until' => now()->subMinute()->startOfSecond()]);

    // The other run brings the notification back once this one read it.
    $overlapped = runOnceAfterQuery(
        fn (string $sql): bool => str_contains($sql, DB::getQueryGrammar()->wrap('snoozed_until').' <= ?'),
        fn () => Artisan::call('inertia-notifications:unsnooze'),
    );

    $this->artisan('inertia-notifications:unsnooze')
        ->expectsOutputToContain('Brought back 0 snoozed notifications.')
        ->assertSuccessful();

    expect($overlapped())->toBeTrue();

    Event::assertDispatchedTimes(InboxChanged::class, 1);
});

it('requires a signed-in user for the endpoints', function (): void {
    Route::get('/login', fn () => 'login')->name('login');

    $this->getJson('/_inertia-notifications')
        ->assertUnauthorized();
});

it('prunes notifications older than the retention with model:prune', function (): void {
    $old = inboxItem($this->user, 'Old', 60 * 24 * 91);
    $recent = inboxItem($this->user, 'Recent', 60 * 24 * 89);

    $this->artisan('model:prune', ['--model' => [InboxNotification::class]])
        ->assertSuccessful();

    expect(InboxNotification::query()->pluck('id')->all())
        ->toBe([$recent->id])
        ->and($old->exists)
        ->toBeTrue();
});

it('prunes nothing when the retention is turned off', function (): void {
    config(['inertia-notifications.inbox.prune_after_days' => null]);
    inboxItem($this->user, 'Old', 60 * 24 * 91);
    inboxItem($this->user, 'Ancient', 60 * 24 * 900);

    $this->artisan('model:prune', ['--model' => [InboxNotification::class]])
        ->assertSuccessful();

    expect(InboxNotification::query()->count())->toBe(2);
});

it('loads a full inbox page with Inertia infinite scroll metadata', function (): void {
    Route::middleware('web')->get('/inbox', fn () => Inertia::render('Inbox', [
        'notifications' => Inbox::scroll(request()->user(), request()->query('filter'), perPage: 2),
    ]));

    foreach (range(1, 3) as $minutes) {
        inboxItem($this->user, "Unread {$minutes}", $minutes);
    }
    inboxItem($this->user, 'Archived', 5, ['archived_at' => now()]);
    $this->actingAs($this->user);

    $page = $this->get('/inbox', ['X-Inertia' => 'true'])
        ->json();
    $next = $page['scrollProps']['notifications']['nextPage'];

    expect(array_column($page['props']['notifications']['data'], 'title'))
        ->toBe(['Unread 1', 'Unread 2'])
        ->and($page['mergeProps'])
        ->toContain('notifications.data');

    $headers = [
        'X-Inertia' => 'true',
        'X-Inertia-Partial-Component' => 'Inbox',
        'X-Inertia-Partial-Data' => 'notifications',
    ];
    $second = $this->get('/inbox?cursor='.$next, $headers)
        ->json();

    // The counts stay current while the user reads further down the list.
    expect(array_column($second['props']['notifications']['data'], 'title'))
        ->toBe(['Unread 3'])
        ->and(Arr::only($second['props']['inertiauiInbox'] ?? [], ['unread', 'unseen']))
        ->toBe(['unread' => 3, 'unseen' => 3])
        ->and($second['scrollProps']['notifications']['nextPage'])
        ->toBeNull();
});

it('filters a full inbox page', function (): void {
    Route::middleware('web')->get('/inbox', fn () => Inertia::render('Inbox', [
        'notifications' => Inbox::scroll(request()->user(), request()->query('filter'), perPage: 2),
    ]));

    foreach (range(1, 3) as $minutes) {
        inboxItem($this->user, "Unread {$minutes}", $minutes);
    }
    inboxItem($this->user, 'Archived', 5, ['archived_at' => now()]);
    $this->actingAs($this->user);

    $page = $this->get('/inbox?filter=archived', ['X-Inertia' => 'true'])
        ->json();

    expect(array_column($page['props']['notifications']['data'], 'title'))->toBe(['Archived']);
});

it('reads the filter and category of a full inbox page from the query string with Inbox::page()', function (): void {
    Route::middleware('web')->get('/inbox', fn () => Inertia::render('Inbox', [Inbox::page(perPage: 1), 'team' => 'Acme']));

    inboxItem($this->user, 'Invoice paid', 1, ['category' => 'billing']);
    inboxItem($this->user, 'Invoice sent', 2, ['category' => 'billing']);
    inboxItem($this->user, 'Invoice read', 3, ['category' => 'billing', 'read_at' => now()]);
    inboxItem($this->user, 'Comment posted', 4, ['category' => 'comments']);
    $this->actingAs($this->user);

    $page = $this->get('/inbox?filter=unread&category=billing', ['X-Inertia' => 'true'])->json();

    expect(Arr::only($page['props'], ['filter', 'category', 'team']))
        ->toBe(['filter' => 'unread', 'category' => 'billing', 'team' => 'Acme'])
        ->and(array_column($page['props']['notifications']['data'], 'title'))
        ->toBe(['Invoice paid']);

    // The infinite scroll loads the next page of the same list.
    $next = $this->get('/inbox?filter=unread&category=billing&cursor='.$page['scrollProps']['notifications']['nextPage'], [
        'X-Inertia' => 'true',
        'X-Inertia-Partial-Component' => 'Inbox',
        'X-Inertia-Partial-Data' => 'notifications',
    ])->json();

    expect(array_column($next['props']['notifications']['data'], 'title'))->toBe(['Invoice sent']);

    // A filter that the application does not offer lists every notification, like the component shows it.
    config(['inertia-notifications.inbox.actions' => ['mute']]);

    $page = $this->get('/inbox?filter=archived', ['X-Inertia' => 'true'])->json();

    expect(Arr::only($page['props'], ['filter', 'category']))
        ->toBe(['filter' => 'all', 'category' => null])
        ->and(array_column($page['props']['notifications']['data'], 'title'))
        ->toBe(['Invoice paid']);
});

it('answers with the JSON that the frontend tests read', function (): void {
    $this->travelTo(Carbon::parse('2026-11-15 10:00:00'));
    $id = '9d3c1b6e-0b7a-4c1e-9a64-5f0d2a8e1c47';

    Inbox::record($this->user, $id, 'App\Notifications\InvoicePaid', InboxMessage::make('Invoice INV-7 paid')
        ->body('Sophie paid $120.00.')
        ->url('/invoices/7')
        ->action('Download receipt', '/invoices/7/receipt')
        ->category('billing')
        ->group('invoice:7')
        ->toast()
        ->with(['invoice' => 7]));

    $this->actingAs($this->user);
    $index = $this->getJson(route('inertia-notifications.index'))->getContent();

    $this->travelTo(Carbon::parse('2026-11-15 10:01:00'));
    $read = $this->postJson(route('inertia-notifications.read', $id))->getContent();
    $fixture = jsonFixture('inbox.json');

    // Decoded as objects, so an empty JSON object and an empty array stay apart.
    expect(json_decode((string) $index))
        ->toEqual($fixture->index)
        ->and(json_decode((string) $read))
        ->toEqual($fixture->read);
});

it('broadcasts every kind of change in the shape that the frontend tests read', function (): void {
    Event::fake([InboxChanged::class]);
    config([
        'inertia-notifications.inbox.broadcast_changes' => true,
        'inertia-notifications.inbox.actions' => ['snooze', 'archive', 'mute', 'delete'],
        'inertia-notifications.pause.enabled' => true,
    ]);
    $this->travelTo(Carbon::parse('2026-11-15 10:00:00'));
    $invoice = '9d3c1b6e-0b7a-4c1e-9a64-5f0d2a8e1c47';
    $comment = '3f6a2c1d-8e4b-4d7a-b2c9-0e5f1a7d6b38';

    Inbox::record($this->user, $invoice, 'App\Notifications\InvoicePaid', InboxMessage::make('Invoice INV-7 paid')
        ->category('billing')
        ->group('invoice:7'));
    Inbox::record($this->user, $comment, 'App\Notifications\CommentPosted', InboxMessage::make('Sophie commented'));
    Inbox::record($this->user, '7b2e9f4a-1c6d-4e8b-a3f5-2d9c0b6e8a14', 'App\Notifications\RenewDomain', InboxMessage::make('Renew the domain'))
        ->forceFill(['snoozed_until' => now()->addMinutes(5)])
        ->save();

    $this->actingAs($this->user);
    $this->travelTo(Carbon::parse('2026-11-15 10:01:00'));
    $this->postJson(route('inertia-notifications.seen'), ['before' => '2026-11-15T10:00:00+00:00', 'ids' => [$invoice]])
        ->assertOk();
    $this->travelTo(Carbon::parse('2026-11-15 10:02:00'));
    $this->postJson(route('inertia-notifications.read-all'), ['category' => 'billing'])
        ->assertOk();
    $this->travelTo(Carbon::parse('2026-11-15 10:03:00'));
    $this->postJson(route('inertia-notifications.archive-all'), ['read' => true])
        ->assertOk();
    $this->travelTo(Carbon::parse('2026-11-15 10:04:00'));
    $this->postJson(route('inertia-notifications.batch'), ['action' => 'read', 'ids' => [$comment]])
        ->assertOk();
    $this->postJson(route('inertia-notifications.delete', $comment))
        ->assertOk();
    $this->postJson(route('inertia-notifications.mute', $invoice))
        ->assertOk();
    $this->postJson(route('inertia-notifications.pause'), ['until' => '2026-11-15T12:00:00+00:00'])
        ->assertOk();
    $this->travelTo(Carbon::parse('2026-11-15 10:05:00'));
    $this->artisan('inertia-notifications:unsnooze')
        ->assertSuccessful();
    Inbox::update(Inbox::query($this->user)->findOrFail($invoice), InboxMessage::make('Invoice INV-7 refunded')
        ->body('Sophie got $120.00 back.'));

    $sent = Event::dispatched(InboxChanged::class)
        ->map(fn (array $args): mixed => json_decode((string) json_encode($args[0]->broadcastWith()['change'])));
    $fixture = jsonFixture('inbox.json');

    // One change of each kind, decoded as objects, so an empty JSON object and an empty array stay apart.
    expect($sent)
        ->toHaveCount(9)
        ->and((object) $sent->keyBy('kind')->all())
        ->toEqual($fixture->changes);
});

it('shares the prop that the frontend tests read', function (): void {
    config([
        'inertia-notifications.inbox.broadcast_announcements' => true,
        'inertia-notifications.inbox.actions' => ['snooze', 'archive', 'mute', 'delete'],
        'inertia-notifications.inbox.tabs' => [
            'releases' => ['label' => 'Releases', 'category' => 'product', 'data' => ['major' => true]],
        ],
        'inertia-notifications.inbox.selectable' => false,
        'inertia-notifications.inbox.category_filter' => ['billing'],
        'inertia-notifications.preferences.categories' => [
            'billing' => ['label' => 'Billing'],
            'product' => ['label' => 'Product updates'],
        ],
        'inertia-notifications.pause.enabled' => true,
        'inertia-notifications.pause.presets' => [15, 'tomorrow'],
    ]);
    $keys = enablePush();

    // The fixture holds the first IDs of the users and the teams, which a database that keeps its sequences
    // between the tests gives out only once, so we will give the user and the team those IDs.
    $this->user->forceFill(['id' => 1])->save();
    $team = Team::query()->create(['id' => 1, 'name' => 'Acme']);
    Inbox::resolveContextUsing(fn (): Team => $team);
    $this->travelTo(Carbon::parse('2026-11-15 10:00:00'));
    $id = '9d3c1b6e-0b7a-4c1e-9a64-5f0d2a8e1c47';

    Inbox::record($this->user, $id, 'App\Notifications\InvoicePaid', InboxMessage::make('Invoice INV-7 paid')
        ->category('billing'));
    NotificationPreferences::pause($this->user, now()->addHours(2));
    $subscription = storePushSubscription($this->user);

    $page = $this->actingAs($this->user)
        ->withCookie(Push::DEVICE_COOKIE, $subscription->endpoint_hash)
        ->get('/dashboard', ['X-Inertia' => 'true']);

    // The VAPID key, the version of the service worker, and the hash of the user are not fixed values, so
    // we will compare them as the placeholders of the fixture, while their keys stay where the browser
    // reads them. Decoded as objects, so an empty JSON object and an empty array stay apart.
    $random = [
        $keys->publicKeyAsBase64Url() => 'vapid-public-key',
        hash_file('xxh3', Push::workerPath()) => 'worker-version',
        $page->json('props.inertiauiInbox.user') => 'user-identity',
    ];
    $shared = json_decode(strtr((string) $page->getContent(), $random));
    $fixture = jsonFixture('inbox.json');

    expect($shared->props->inertiauiInbox)->toEqual($fixture->shared);
});
