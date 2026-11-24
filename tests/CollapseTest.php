<?php

use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use InertiaUI\Notifications\Events\InboxNotificationArrived;
use InertiaUI\Notifications\Inbox;
use InertiaUI\Notifications\InboxMessage;
use InertiaUI\Notifications\NotificationHours;
use InertiaUI\Notifications\NotificationHoursChange;
use InertiaUI\Notifications\NotificationPreferences;
use InertiaUI\Notifications\Tests\Fixtures\CommentAdded;
use InertiaUI\Notifications\Tests\Fixtures\Team;
use InertiaUI\Notifications\Tests\Fixtures\User;
use InertiaUI\Notifications\Toast;

beforeEach(function (): void {
    registerNotificationRoutes();

    $this->user = User::named('Pascal');
    $this->sophie = User::named('Sophie');
    $this->maria = User::named('Maria');
    $this->liam = User::named('Liam');
});

it('collapses the notifications of a group key into one row', function (): void {
    $this->user->notify(new CommentAdded($this->sophie));
    $this->user->notify(new CommentAdded($this->maria));
    $this->user->notify(new CommentAdded($this->liam));

    $item = $this->user->inbox()
        ->sole()
        ->toInboxArray();

    expect($item)
        ->toMatchArray([
            'title' => 'Liam commented on issue #42',
            'body' => 'A comment by Liam.',
            'group' => 'issue:42',
            'actor' => ['name' => 'Liam'],
            'actorCount' => 3,
            'total' => 3,
        ])
        ->and($item['actors'])
        ->toBe([['name' => 'Liam'], ['name' => 'Maria'], ['name' => 'Sophie']]);
});

it('counts the collapsed notifications once', function (): void {
    $this->user->notify(new CommentAdded($this->sophie));
    $this->user->notify(new CommentAdded($this->maria));
    $this->user->notify(new CommentAdded($this->sophie, issue: 43));

    $response = $this->actingAs($this->user)
        ->getJson('/_inertia-notifications/counts')
        ->assertOk();

    expect($response->json('counts.unread'))
        ->toBe(2)
        ->and($response->json('counts.unseen'))
        ->toBe(2);
});

it('keeps each actor once, newest first', function (): void {
    $this->user->notify(new CommentAdded($this->sophie));
    $this->user->notify(new CommentAdded($this->maria));
    $this->user->notify(new CommentAdded($this->sophie));

    $item = $this->user->inbox()
        ->sole()
        ->toInboxArray();

    expect($item['actors'])
        ->toBe([['name' => 'Sophie'], ['name' => 'Maria']])
        ->and($item['actorCount'])
        ->toBe(2)
        ->and($item['total'])
        ->toBe(3);
});

it('names the actors of the notification and those that collapsed into it with the :actors replacement of the title', function (): void {
    $title = ':actors commented on issue #:number';
    $shown = fn (): string => $this->user->inbox()->sole()->toInboxArray()['title'];

    $this->user->notify(new CommentAdded($this->sophie, title: $title));
    expect($shown())->toBe('Sophie commented on issue #42');

    $this->user->notify(new CommentAdded($this->maria, title: $title));
    expect($shown())->toBe('Maria and Sophie commented on issue #42');

    $this->user->notify(new CommentAdded($this->sophie, title: $title));
    expect($shown())->toBe('Sophie and Maria commented on issue #42');

    $this->user->notify(new CommentAdded(User::named('Noah'), title: $title));
    expect($shown())->toBe('Noah and 2 others commented on issue #42');

    // Laravel's translations word the actors in the locale of the user who reads the notification.
    app('translator')->addLines(['*.:name and :count others' => ':name en :count anderen'], 'nl');
    app()->setLocale('nl');

    expect($shown())->toBe('Noah en 2 anderen commented on issue #42');
});

it('names the actors of a collapsed notification in its flashed toast', function (): void {
    Toast::fake();
    Route::middleware('web')->post('/issues/42/comments', function () {
        request()
            ->user()
            ->notify(new CommentAdded(User::query()->where('name', request('author'))->sole(), toast: true, title: ':actors commented on issue #:number'));

        return back();
    });
    $this->actingAs($this->user);

    $this->post('/issues/42/comments', ['author' => 'Sophie']);
    $this->post('/issues/42/comments', ['author' => 'Maria']);

    Toast::assertFlashed('Sophie commented on issue #42', 1);
    Toast::assertFlashed('Maria and Sophie commented on issue #42', 1);
});

it('keeps the newest actors and counts all of them', function (): void {
    foreach (range(1, 7) as $number) {
        $this->user->notify(new CommentAdded(User::named("Author {$number}")));
    }

    $item = $this->user->inbox()
        ->sole()
        ->toInboxArray();

    expect(Arr::pluck($item['actors'], 'name'))
        ->toBe(['Author 7', 'Author 6', 'Author 5', 'Author 4', 'Author 3'])
        ->and($item['actorCount'])
        ->toBe(7);
});

it('moves the collapsed notification to the top as unread and unseen', function (): void {
    $this->user->notify(new CommentAdded($this->sophie));
    $collapsed = $this->user->inbox()->sole();
    $collapsed->markAsRead();

    $this->travel(2)
        ->minutes();
    $other = Inbox::record($this->user, (string) Str::uuid(), 'test', InboxMessage::make('Invoice paid'));
    $this->travel(1)
        ->minute();
    $this->user->notify(new CommentAdded($this->maria));

    $collapsed->refresh();

    expect($collapsed->isRead())
        ->toBeFalse()
        ->and($collapsed->seen_at)
        ->toBeNull()
        ->and($collapsed->created_at->isAfter($other->created_at))
        ->toBeTrue();

    $response = $this->actingAs($this->user)
        ->getJson('/_inertia-notifications')
        ->assertOk();

    expect($response->json('items.*.title'))->toBe(['Maria commented on issue #42', 'Invoice paid']);
});

it('clears the result of an action when a notification collapses', function (): void {
    $this->user->notify(new CommentAdded($this->sophie));
    $collapsed = $this->user->inbox()->sole();
    $collapsed->complete('Replied');

    $this->user->notify(new CommentAdded($this->maria));

    expect($collapsed->refresh()->isCompleted())->toBeFalse();
});

it('stores a new row once the window of the collapsing row has passed', function (): void {
    $this->user->notify(new CommentAdded($this->sophie));

    $this->travel(11)
        ->minutes();
    $this->user->notify(new CommentAdded($this->maria));
    $this->user->notify(new CommentAdded($this->liam));

    $items = $this->user->inbox()
        ->latest()
        ->get()
        ->map->toInboxArray();

    expect($items->pluck('total')->all())
        ->toBe([2, 1])
        ->and($items->pluck('actorCount')->all())
        ->toBe([2, 1]);
});

it('stores a new row when the collapsing row was archived', function (): void {
    $this->user->notify(new CommentAdded($this->sophie));
    $this->user->inbox()
        ->sole()
        ->archive();

    $this->user->notify(new CommentAdded($this->maria));

    expect($this->user->inbox()->count())->toBe(2);
});

it('collapses only the notifications of the same context', function (): void {
    $acme = Team::query()->create(['name' => 'Acme']);
    $globex = Team::query()->create(['name' => 'Globex']);

    $this->user->notify(new CommentAdded($this->sophie, team: $acme));
    $this->user->notify(new CommentAdded($this->maria, team: $globex));
    $this->user->notify(new CommentAdded($this->liam, team: $acme));

    expect($this->user->inbox()->inContext($acme)->sole()->toInboxArray()['total'])
        ->toBe(2)
        ->and($this->user->inbox()->inContext($globex)->sole()->toInboxArray()['total'])
        ->toBe(1);
});

it('collapses a notification once when the job that sends it is retried', function (): void {
    $this->user->notify(new CommentAdded($this->sophie));
    $this->user->notify(new CommentAdded($this->maria));

    // A retried job sends the same notification again.
    $retried = new CommentAdded($this->maria);
    $retried->id = $this->user->inbox()->sole()->collapsed['ids'][1];
    $this->user->notify($retried);

    expect($this->user->inbox()->sole()->toInboxArray()['total'])->toBe(2);
});

it('collapses a retried notification once after many newer rows of its group key', function (): void {
    $this->user->notify(new CommentAdded($this->sophie));
    $this->user->notify(new CommentAdded($this->maria));
    $collapsed = $this->user->inbox()->sole()->collapsed['ids'][1];

    // Each notification opens a new row, since the window of the row before it has passed.
    for ($row = 0; $row < 10; $row++) {
        $this->travel(11)
            ->minutes();
        $this->user->notify(new CommentAdded($this->liam));
    }

    // A retried job sends the second notification again, long after it collapsed into the first row.
    $retried = new CommentAdded($this->maria);
    $retried->id = $collapsed;
    $this->user->notify($retried);

    $items = $this->user->inbox()
        ->latest()
        ->get()
        ->map->toInboxArray();

    expect($items->pluck('total')->all())->toBe([...array_fill(0, 10, 1), 2]);
});

it('broadcasts the arrival of a collapsed notification with the row and the counts', function (): void {
    config(['inertia-notifications.inbox.broadcast_notifications' => true]);
    $this->user->notify(new CommentAdded($this->sophie));
    Event::fake([InboxNotificationArrived::class]);

    $this->user->notify(new CommentAdded($this->maria));

    $broadcast = Event::dispatched(InboxNotificationArrived::class)->sole()[0]->broadcastWith();
    $stored = $this->user->inbox()->sole();

    expect(Arr::except($broadcast['item'], 'revision'))
        ->toEqual(Arr::except($stored->toInboxArray(), 'revision'))
        ->and($broadcast['counts'])
        ->toMatchArray(['unread' => 1, 'unseen' => 1, 'latestIds' => [$stored->id]]);
});

it('broadcasts the arrival of the first notification of a group key without the counts', function (): void {
    config(['inertia-notifications.inbox.broadcast_notifications' => true]);
    Event::fake([InboxNotificationArrived::class]);

    $this->user->notify(new CommentAdded($this->sophie));

    expect(Event::dispatched(InboxNotificationArrived::class)->sole()[0]->broadcastWith())->not->toHaveKey('counts');
});

it('counts every collapsed notification against the throttle of its category', function (): void {
    config(['inertia-notifications.inbox.throttle' => ['comments' => ['limit' => 2, 'seconds' => 60]]]);

    $this->user->notify(new CommentAdded($this->sophie));
    $this->user->notify(new CommentAdded($this->maria));

    expect($this->user->inbox()->sole()->isThrottled())->toBeFalse();

    $this->user->notify(new CommentAdded($this->liam));

    expect($this->user->inbox()->sole()->isThrottled())->toBeTrue();
});

it('flashes the toast of a collapsed notification with the id of its row', function (): void {
    Toast::fake();
    Route::middleware('web')->post('/issues/42/comments', function () {
        request()
            ->user()
            ->notify(new CommentAdded(User::query()->where('name', request('author'))->sole(), toast: true));

        return back();
    });
    $this->actingAs($this->user);

    $this->post('/issues/42/comments', ['author' => 'Sophie']);
    $this->post('/issues/42/comments', ['author' => 'Maria']);

    $id = $this->user->inbox()->sole()->id;

    Toast::assertFlashed('Sophie commented on issue #42', 1);
    Toast::assertFlashed(fn (Toast $toast): bool => $toast->getTitle() === 'Maria commented on issue #42'
        && $toast->getId() === Inbox::toastId($id));
});

it('keeps a notification that collapses outside the notification hours quiet, until one collapses within', function (): void {
    Toast::fake();
    config()->set('inertia-notifications.inbox.broadcast_notifications', true);
    config()->set('inertia-notifications.notification_hours.enabled', true);
    config()->set('inertia-notifications.preferences.categories', ['comments' => ['label' => 'Comments']]);
    NotificationPreferences::update($this->user, timezone: 'UTC', notificationHours: new NotificationHoursChange(
        enabled: true,
        days: array_fill_keys(NotificationHours::DAYS, ['10:05-23:00']),
    ));
    Route::middleware('web')->post('/issues/42/comments', function () {
        request()
            ->user()
            ->notify(new CommentAdded(User::query()->where('name', request('author'))->sole(), toast: true));

        return back();
    });
    $this->actingAs($this->user);

    $broadcasts = [];

    Event::listen(InboxNotificationArrived::class, function (InboxNotificationArrived $event) use (&$broadcasts): void {
        $broadcasts[] = $event->item;
    });

    $this->travelTo(Carbon::parse('2026-11-16 10:00', 'UTC'));
    $this->post('/issues/42/comments', ['author' => 'Sophie']);
    $this->post('/issues/42/comments', ['author' => 'Maria']);

    Toast::assertNothingFlashed();

    expect($this->user->inbox()->sole()->toInboxArray())
        ->toMatchArray(['total' => 2, 'quiet' => true])
        ->and(Arr::pluck($broadcasts, 'quiet'))
        ->toBe([true, true]);

    $this->travelTo(Carbon::parse('2026-11-16 10:05', 'UTC'));
    $this->post('/issues/42/comments', ['author' => 'Liam']);

    Toast::assertFlashed('Liam commented on issue #42', 1);

    expect($this->user->inbox()->sole()->toInboxArray())
        ->toHaveKey('total', 3)
        ->not->toHaveKey('quiet')
        ->and($broadcasts[2])
        ->not->toHaveKey('quiet');
});

it('counts a notification once when another store collapsed it after this one looked for it', function (): void {
    Toast::fake();
    config(['inertia-notifications.inbox.throttle' => ['comments' => ['limit' => 2, 'seconds' => 60]]]);
    $this->user->notify(new CommentAdded($this->sophie));

    $id = (string) Str::uuid();
    $message = (new CommentAdded($this->maria, toast: true))->toInbox($this->user);

    // The other store collapses the notification once this one found no row that holds it.
    $raced = runOnceAfterQuery(
        fn (string $sql): bool => str_contains($sql, 'collapsed'),
        fn () => Inbox::record($this->user, $id, 'test', $message),
    );

    Route::middleware('web')->post('/issues/42/comments', function () use ($id, $message) {
        Inbox::record(request()->user(), $id, 'test', $message);

        return back();
    });

    $this->actingAs($this->user)
        ->post('/issues/42/comments');

    expect($raced())
        ->toBeTrue()
        ->and($this->user->inbox()->sole()->toInboxArray()['total'])
        ->toBe(2)
        ->and($this->user->inbox()->sole()->isThrottled())
        ->toBeFalse();

    Toast::assertFlashed('Maria commented on issue #42', 1);
});

it('needs a group key to collapse', function (): void {
    Inbox::record($this->user, (string) Str::uuid(), 'test', InboxMessage::make('Comment')->collapse());
})->throws(LogicException::class, 'The inbox message [Comment] needs a group key to collapse.');

it('cannot collapse a message with a once() key', function (): void {
    $message = InboxMessage::make('Comment')
        ->group('issue:42')
        ->once('comment-9')
        ->collapse();

    Inbox::record($this->user, (string) Str::uuid(), 'test', $message);
})->throws(LogicException::class, 'The inbox message [Comment] cannot collapse and use once().');

it('keeps one row per notification without collapse()', function (): void {
    $message = InboxMessage::make('Comment')->group('issue:42');

    Inbox::record($this->user, (string) Str::uuid(), 'test', $message);
    Inbox::record($this->user, (string) Str::uuid(), 'test', $message);

    expect($this->user->inbox()->get()->map->toInboxArray()->pluck('total')->all())->toBe([1, 1]);
});

it('sends a single actor for a notification that did not collapse', function (): void {
    Inbox::record($this->user, (string) Str::uuid(), 'test', InboxMessage::make('Comment')->actor($this->sophie));

    expect($this->user->inbox()->sole()->toInboxArray())->toMatchArray([
        'actors' => [['name' => 'Sophie']],
        'actorCount' => 1,
        'total' => 1,
    ]);
});

it('takes an actor that is not a model by its name and avatar', function (): void {
    Inbox::record($this->user, (string) Str::uuid(), 'test', InboxMessage::make('Build failed')->actor(name: 'GitHub', avatar: '/avatars/github.png'));

    expect($this->user->inbox()->sole()->toInboxArray()['actors'])->toBe([['name' => 'GitHub', 'avatar' => '/avatars/github.png']]);
});
