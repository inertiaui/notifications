<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Inertia\Inertia;
use InertiaUI\Notifications\Events\InboxChanged;
use InertiaUI\Notifications\Inbox;
use InertiaUI\Notifications\InboxMessage;
use InertiaUI\Notifications\Models\InboxNotification;
use InertiaUI\Notifications\Tests\Fixtures\Team;
use InertiaUI\Notifications\Tests\Fixtures\User;
use InertiaUI\Notifications\ToastAction;

beforeEach(function (): void {
    Route::middleware('web')->group(function (): void {
        Route::inertiaNotifications();
        Route::get('/dashboard', fn () => Inertia::render('Dashboard'));
    });

    $this->user = User::named('Pascal');
    $this->acme = Team::query()->create(['name' => 'Acme']);
    $this->globex = Team::query()->create(['name' => 'Globex']);

    Inbox::record($this->user, (string) Str::uuid(), 'test', InboxMessage::make('Acme invoice')->for($this->acme));
    Inbox::record($this->user, (string) Str::uuid(), 'test', InboxMessage::make('Globex invoice')->for($this->globex));
    Inbox::record($this->user, (string) Str::uuid(), 'test', InboxMessage::make('Password changed'));
});

/**
 * Get the titles of the user's unread notifications.
 *
 * @return list<string>
 */
function unreadTitles(User $user): array
{
    return $user->inbox()
        ->unread()
        ->get()
        ->map(fn (InboxNotification $notification): string => $notification->toInboxArray()['title'])
        ->all();
}

/**
 * Store a notification for the user in the given context, snoozed until a minute ago.
 */
function snoozedInContext(User $user, string $title, ?Team $context): InboxNotification
{
    $message = InboxMessage::make($title);

    $notification = Inbox::record($user, (string) Str::uuid(), 'test', $context instanceof Team ? $message->for($context) : $message);
    $notification->forceFill(['snoozed_until' => now()->subMinute()->startOfSecond()])->save();

    return $notification;
}

/**
 * Resolve the context with a resolver that fails without a signed-in user, like one that reads the user's current team.
 */
function resolveContextOfSignedInUser(Team $team): void
{
    Inbox::resolveContextUsing(fn (Request $request): Team => $request->user() instanceof User
        ? $team
        : throw new LogicException('The request has no signed-in user.'));
}

it('stores the context of the message', function (): void {
    $stored = Inbox::query($this->user)
        ->where('context_type', Team::class)
        ->get();

    expect($stored->map->context->map->name->all())
        ->toEqualCanonicalizing(['Acme', 'Globex'])
        ->and($stored->map->context_id->all())
        ->toEqualCanonicalizing([$this->acme->id, $this->globex->id]);
});

it('shows every notification to an application without a context resolver, with the same queries', function (): void {
    $this->actingAs($this->user);
    DB::enableQueryLog();

    $shared = $this->get('/dashboard', ['X-Inertia' => 'true'])->json('props.inertiauiInbox');
    $items = $this->getJson('/_inertia-notifications')->json('items');
    $this->postJson('/_inertia-notifications/read')
        ->assertOk();

    $queries = collect(DB::getQueryLog())->pluck('query');

    expect($shared['unread'])
        ->toBe(3)
        ->and($shared)
        ->not->toHaveKey('context')
        ->and(array_column($items, 'title'))
        ->toEqualCanonicalizing(['Acme invoice', 'Globex invoice', 'Password changed'])
        ->and(unreadTitles($this->user))
        ->toBe([])
        ->and($queries->filter(fn (string $query): bool => preg_match('/(?<!\.)"context_(type|id)"/', $query) === 1)->all())
        ->toBe([]);
});

it('leaves out the notifications of other contexts once the application resolves the current one', function (): void {
    Inbox::resolveContextUsing(fn (): Team => $this->acme);
    $this->actingAs($this->user);

    $shared = $this->get('/dashboard', ['X-Inertia' => 'true'])->json('props.inertiauiInbox');
    $items = $this->getJson('/_inertia-notifications')->json('items');
    $this->postJson('/_inertia-notifications/read')
        ->assertOk();

    // Notifications without a context show in every context.
    expect($shared)
        ->toMatchArray(['unread' => 2, 'unseen' => 2, 'context' => Inbox::contextKey(Team::class, $this->acme->id)])
        ->and(array_column($items, 'title'))
        ->toEqualCanonicalizing(['Acme invoice', 'Password changed'])
        ->and(array_column($items, 'context', 'title'))
        ->toBe(['Acme invoice' => $shared['context']])
        ->and(unreadTitles($this->user))
        ->toBe(['Globex invoice']);
});

it('counts the inbox of another user in the given context instead of the context of the request', function (): void {
    Inbox::record($this->user, (string) Str::uuid(), 'test', InboxMessage::make('Globex report')->for($this->globex));
    resolveContextOfSignedInUser($this->acme);

    Route::middleware('web')->get('/members/pascal/counts', fn (): array => [
        'request' => Inbox::counts($this->user),
        'globex' => Inbox::countsInContext($this->user, $this->globex),
        'none' => Inbox::countsInContext($this->user, null),
    ]);

    $counts = $this->actingAs(User::named('Sophie'))
        ->getJson('/members/pascal/counts')
        ->assertOk()
        ->json();

    expect($counts)
        ->toBe([
            'request' => ['unread' => 2, 'unseen' => 2],
            'globex' => ['unread' => 3, 'unseen' => 3],
            'none' => ['unread' => 4, 'unseen' => 4],
        ])
        ->and(Inbox::queryInContext($this->user, null)->unread()->count())
        ->toBe(4);
});

it('changes in a batch only the given notifications of the current context', function (): void {
    Inbox::resolveContextUsing(fn (): Team => $this->acme);

    $this->actingAs($this->user)
        ->postJson('/_inertia-notifications/batch', [
            'action' => 'read',
            'ids' => $this->user->inbox()->pluck('id')->all(),
        ])
        ->assertOk();

    expect(unreadTitles($this->user))->toBe(['Globex invoice']);
});

it('finds the notification of an item route under the prefix of the current team', function (string $method, string $path, array $data): void {
    config(['inertia-notifications.inbox.actions' => ['snooze', 'archive', 'mute', 'delete']]);
    Inbox::resolveContextUsing(fn (): Team => $this->acme);

    Route::prefix('{current_team}')
        ->middleware('web')
        ->group(fn () => Route::inertiaNotifications());

    $approve = ToastAction::make('Approve')
        ->post('/reports/9/approve')
        ->result('Approved');

    $notification = Inbox::record($this->user, (string) Str::uuid(), 'test', InboxMessage::make('Acme report')
        ->for($this->acme)
        ->group('reports')
        ->action($approve));

    $this->actingAs($this->user)
        ->json($method, "/{$this->acme->id}/_inertia-notifications/{$notification->id}{$path}", $data)
        ->assertOk();
})->with([
    'show' => ['GET', '', []],
    'read' => ['POST', '/read', []],
    'unread' => ['POST', '/unread', []],
    'archive' => ['POST', '/archive', []],
    'unarchive' => ['POST', '/unarchive', []],
    'snooze' => ['POST', '/snooze', ['until' => '2099-01-01T08:00:00+00:00']],
    'unsnooze' => ['POST', '/unsnooze', []],
    'complete' => ['POST', '/complete', ['action' => 0]],
    'mute' => ['POST', '/mute', []],
    'unmute' => ['POST', '/unmute', []],
    'delete' => ['POST', '/delete', []],
]);

it('removes the device of the route under the prefix of the current team', function (): void {
    enablePush();
    Route::prefix('{current_team}')
        ->middleware('web')
        ->group(fn () => Route::inertiaNotifications());

    // The device whose key is the team's key must stay, so the request can't remove it by the team's key.
    $devices = collect(range(1, $this->acme->id + 1))->map(fn () => storePushSubscription($this->user));
    $removed = $devices->last();

    $this->actingAs($this->user)
        ->postJson("/{$this->acme->id}/_inertia-notifications/push/devices/{$removed->id}/delete")
        ->assertOk();

    expect($this->user->pushDevices()->pluck('id')->all())
        ->toEqualCanonicalizing($devices->except($devices->count() - 1)->pluck('id')->all())
        ->and($this->user->pushDevices()->whereKey($this->acme->id)->exists())
        ->toBeTrue();
});

it('shows every notification while the resolver resolves no context', function (): void {
    Inbox::resolveContextUsing(fn (): ?Team => null);

    $shared = $this->actingAs($this->user)
        ->get('/dashboard', ['X-Inertia' => 'true'])
        ->json('props.inertiauiInbox');

    expect($shared)->toMatchArray(['unread' => 3, 'context' => null]);
});

it('tells the browser that the user switched to another context', function (): void {
    $current = $this->acme;
    Inbox::resolveContextUsing(function () use (&$current): Team {
        return $current;
    });
    $this->actingAs($this->user);

    $acme = $this->get('/dashboard', ['X-Inertia' => 'true'])->json('props.inertiauiInbox');

    // Long-running test servers flush Inertia's shared props after each request,
    // so we will do the same before the request that follows.
    Inertia::flushShared();
    $current = $this->globex;

    $globex = $this->get('/dashboard', ['X-Inertia' => 'true'])->json('props.inertiauiInbox');

    // The browser forgets the notifications of the previous context once the identity changes.
    expect($globex['user'])
        ->not->toBe($acme['user'])
        ->and($globex['context'])
        ->not->toBe($acme['context'])
        ->and($globex['unread'])
        ->toBe(2);
});

it('broadcasts the notifications that the unsnooze command brings back with the counts of their own context', function (): void {
    Event::fake([InboxChanged::class]);
    config(['inertia-notifications.inbox.broadcast_changes' => true]);
    resolveContextOfSignedInUser($this->acme);

    $acme = snoozedInContext($this->user, 'Acme report', $this->acme);
    $globex = snoozedInContext($this->user, 'Globex report', $this->globex);
    Inbox::record($this->user, (string) Str::uuid(), 'test', InboxMessage::make('Globex refund')->for($this->globex));

    $this->artisan('inertia-notifications:unsnooze')
        ->assertSuccessful();

    $counts = Event::dispatched(InboxChanged::class)->mapWithKeys(function (array $arguments): array {
        $payload = $arguments[0]->broadcastWith();

        return [$payload['change']['id'] => $payload['counts']];
    });

    // Each context also counts the notification without a context.
    expect($acme->fresh()->snoozed_until)
        ->toBeNull()
        ->and($globex->fresh()->snoozed_until)
        ->toBeNull()
        ->and($counts)
        ->toHaveCount(2)
        ->and($counts[$acme->id])
        ->toMatchArray(['unread' => 3, 'unseen' => 3, 'context' => Inbox::contextKey($this->acme->getMorphClass(), $this->acme->id)])
        ->and($counts[$globex->id])
        ->toMatchArray(['unread' => 4, 'unseen' => 4, 'context' => Inbox::contextKey($this->globex->getMorphClass(), $this->globex->id)]);
});

it('broadcasts a notification without a context that the unsnooze command brings back with the counts of every context', function (): void {
    Event::fake([InboxChanged::class]);
    config(['inertia-notifications.inbox.broadcast_changes' => true]);
    resolveContextOfSignedInUser($this->acme);

    $notification = snoozedInContext($this->user, 'Backup finished', null);

    $this->artisan('inertia-notifications:unsnooze')
        ->assertSuccessful();

    $event = Event::dispatched(InboxChanged::class)->sole()[0];

    expect($notification->fresh()->snoozed_until)
        ->toBeNull()
        ->and($event->broadcastWith()['counts'])
        ->toMatchArray(['unread' => 4, 'unseen' => 4, 'context' => null]);
});

it('brings back snoozed notifications without reading the counts while changes are not broadcast', function (): void {
    Event::fake([InboxChanged::class]);
    resolveContextOfSignedInUser($this->acme);

    $notification = snoozedInContext($this->user, 'Acme report', $this->acme);
    DB::enableQueryLog();

    $this->artisan('inertia-notifications:unsnooze')
        ->assertSuccessful();

    $summaries = collect(DB::getQueryLog())
        ->pluck('query')
        ->filter(fn (string $query): bool => str_contains($query, 'row_kind'));

    expect($notification->fresh()->snoozed_until)
        ->toBeNull()
        ->and($summaries->all())
        ->toBe([]);

    Event::assertNotDispatched(InboxChanged::class);
});
