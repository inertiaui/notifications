<?php

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Foundation\Testing\RefreshDatabaseState;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Inertia\Inertia;
use InertiaUI\Notifications\Announcement;
use InertiaUI\Notifications\Events\AnnouncementPublished;
use InertiaUI\Notifications\Inbox;
use InertiaUI\Notifications\InboxMessage;
use InertiaUI\Notifications\Models\InboxAnnouncement;
use InertiaUI\Notifications\Models\InboxAnnouncementState;
use InertiaUI\Notifications\Models\InboxNotification;
use InertiaUI\Notifications\NotificationHours;
use InertiaUI\Notifications\NotificationHoursChange;
use InertiaUI\Notifications\NotificationPreferences;
use InertiaUI\Notifications\NotificationsServiceProvider;
use InertiaUI\Notifications\Tests\Fixtures\NamedUsers;
use InertiaUI\Notifications\Tests\Fixtures\Team;
use InertiaUI\Notifications\Tests\Fixtures\User;
use InertiaUI\Notifications\ToastAction;

use function Orchestra\Testbench\artisan;

beforeEach(function (): void {
    Route::middleware('web')->group(function (): void {
        Route::inertiaNotifications();
        Route::get('/dashboard', fn () => Inertia::render('Dashboard'));
    });

    Announcement::defineAudience('named', fn (User $user, string ...$names): bool => in_array($user->name, $names, true));

    $this->user = User::named('Pascal');
});

/**
 * Publish the given announcement as if it was published the given number of minutes ago.
 */
function announced(Announcement $announcement, int $minutesAgo = 0): InboxAnnouncement
{
    test()->travelTo(now()->subMinutes($minutesAgo));

    $published = $announcement->publish();

    test()->travelBack();

    return $published;
}

/**
 * Store a notification for the user that was created the given number of minutes ago.
 */
function notified(User $user, string $title, int $minutesAgo = 0): InboxNotification
{
    test()->travelTo(now()->subMinutes($minutesAgo));

    $notification = Inbox::record($user, (string) Str::uuid(), 'test', InboxMessage::make($title));

    test()->travelBack();

    return $notification;
}

/**
 * Get the titles that the user's notification center lists for the given filter.
 *
 * @return list<string>
 */
function listedTitles(User $user, string $filter = 'all'): array
{
    return test()->actingAs($user)
        ->getJson("/_inertia-notifications?filter={$filter}")
        ->assertOk()
        ->json('items.*.title');
}

it('stores an announcement once, without a row for each user', function (): void {
    User::named('Sophie');

    Announcement::make('Scheduled maintenance')->publish();

    expect(InboxAnnouncement::query()->count())
        ->toBe(1)
        ->and(InboxAnnouncementState::query()->count())
        ->toBe(0)
        ->and(InboxNotification::query()->count())
        ->toBe(0);
});

it('shows an announcement to the users who sign up after it was published', function (): void {
    Announcement::make('Scheduled maintenance')->publish();

    $sophie = User::named('Sophie');

    expect(listedTitles($this->user))
        ->toBe(['Scheduled maintenance'])
        ->and(listedTitles($sophie))
        ->toBe(['Scheduled maintenance'])
        ->and(Inbox::counts($sophie)->toArray())
        ->toBe(['unread' => 1, 'unseen' => 1]);
});

it('marks an announcement so the frontend can tell it from a notification', function (): void {
    $expiresAt = now()->addWeek()->startOfSecond();

    $announcement = Announcement::make('New dashboard')
        ->body('Find your reports in one place.')
        ->icon('megaphone')
        ->url('/dashboard')
        ->action('Try it', '/dashboard')
        ->category('product')
        ->with(['release' => '2.0'])
        ->expiresAt($expiresAt)
        ->publish();
    notified($this->user, 'Invoice paid', 1);

    $items = $this->actingAs($this->user)
        ->getJson('/_inertia-notifications')
        ->json('items');

    expect($items[0])
        ->toMatchArray([
            'id' => $announcement->id,
            'type' => 'announcement',
            'announcement' => true,
            'title' => 'New dashboard',
            'body' => 'Find your reports in one place.',
            'icon' => 'megaphone',
            'url' => '/dashboard',
            'actions' => [['label' => 'Try it', 'href' => '/dashboard']],
            'category' => 'product',
            'data' => ['release' => '2.0'],
            'readAt' => null,
            'expiresAt' => $expiresAt->toIso8601String(),
        ])
        ->and($items[1])
        ->toMatchArray(['title' => 'Invoice paid', 'announcement' => false, 'expiresAt' => null]);
});

it('shows an announcement only to the users of a defined audience', function (): void {
    $sophie = User::named('Sophie');
    $maria = User::named('Maria');

    Announcement::make('For Sophie and Maria')
        ->audience('named', 'Sophie', 'Maria')
        ->publish();

    expect(listedTitles($sophie))
        ->toBe(['For Sophie and Maria'])
        ->and(listedTitles($maria))
        ->toBe(['For Sophie and Maria'])
        ->and(listedTitles($this->user))
        ->toBe([])
        ->and(Inbox::counts($this->user)->toArray())
        ->toBe(['unread' => 0, 'unseen' => 0]);
});

it('checks the audience each time, so users who join it later see the announcement', function (): void {
    $sophie = User::named('Sophie');

    Announcement::make('For Martin')
        ->audience('named', 'Martin')
        ->publish();

    expect(listedTitles($sophie))->toBe([]);

    $sophie->update(['name' => 'Martin']);

    expect(listedTitles($sophie))->toBe(['For Martin']);
});

it('shows an announcement to the audience of an invokable class', function (): void {
    $sophie = User::named('Sophie');

    Announcement::make('For Sophie')
        ->audience(NamedUsers::class, 'Sophie')
        ->publish();

    expect(listedTitles($sophie))
        ->toBe(['For Sophie'])
        ->and(listedTitles($this->user))
        ->toBe([]);
});

it('shows an announcement whose audience is no longer defined to nobody', function (): void {
    Announcement::make('For Pascal')
        ->audience('named', 'Pascal')
        ->publish();

    Announcement::flushState();

    expect(listedTitles($this->user))->toBe([]);
});

it('shows an announcement whose audience expects another model to nobody of the other models', function (): void {
    $team = Team::query()->create(['name' => 'Pascal']);

    Announcement::make('For Pascal')->audience('named', 'Pascal')->publish();
    Announcement::make('For Pascal too')->audience(NamedUsers::class, 'Pascal')->publish();

    expect(Inbox::counts($team)->toArray())
        ->toBe(['unread' => 0, 'unseen' => 0])
        ->and(Inbox::counts($this->user)->toArray())
        ->toBe(['unread' => 2, 'unseen' => 2]);

    Announcement::defineAudience('anyone', fn (Model $notifiable): bool => true);
    Announcement::make('For every model')->audience('anyone')->publish();

    expect(Inbox::counts($team)->toArray())->toBe(['unread' => 1, 'unseen' => 1]);
});

it('shows an announcement whose audience is typed with self or parent to the users of that class', function (
    string $audience,
): void {
    User::defineNamedAudiences();
    $team = Team::query()->create(['name' => 'Pascal']);

    Announcement::make('For Pascal')->audience($audience, 'Pascal')->publish();

    expect(Inbox::counts($this->user)->toArray())
        ->toBe(['unread' => 1, 'unseen' => 1])
        ->and(Inbox::counts(User::named('Sophie'))->toArray())
        ->toBe(['unread' => 0, 'unseen' => 0])
        ->and(Inbox::counts($team)->toArray())
        ->toBe(['unread' => 0, 'unseen' => 0]);
})->with(['named-self', 'named-parent']);

it('refuses an audience whose callback returns something other than a bool', function (
    Closure $callback,
    string $type,
): void {
    Announcement::defineAudience('members', $callback);
    Announcement::make('For the members')->audience('members')->publish();

    expect(fn () => Inbox::counts($this->user))
        ->toThrow(LogicException::class, "The announcement audience [members] must return a bool, not [{$type}].");
})->with([
    'a relation' => [fn (User $user): mixed => $user->inbox(), MorphMany::class],
    'an empty collection' => [fn (User $user): mixed => $user->newCollection(), Collection::class],
    'a string' => [fn (User $user): mixed => $user->name, 'string'],
    'an integer' => [fn (User $user): mixed => 1, 'int'],
    'null' => [fn (User $user): mixed => null, 'null'],
]);

it('rejects an audience that is not defined', function (): void {
    Announcement::make('For everyone')->audience('customers');
})->throws(InvalidArgumentException::class, 'The announcement audience [customers] is not defined.');

it('rejects an audience parameter with a comma', function (): void {
    Announcement::make('For everyone')->audience('named', 'Martin, Sophie');
})->throws(InvalidArgumentException::class, 'The parameter [Martin, Sophie] of the announcement audience [named] must not contain a comma.');

it('rejects an audience with a colon, which would hold its parameters', function (): void {
    Announcement::make('For everyone')->audience('named:Martin', 'Sophie');
})->throws(InvalidArgumentException::class, 'The announcement audience [named:Martin] must not contain a colon.');

it('rejects an action with a result, which only a notification stores for its user', function (): void {
    Announcement::make('New plan')
        ->action(ToastAction::make('Upgrade')->post('/plans/pro')->result('Upgraded'))
        ->publish();
})->throws(InvalidArgumentException::class, 'The announcement action [Upgrade] must not have a result.');

it('removes an announcement from every inbox once it expires', function (): void {
    Announcement::make('Maintenance tonight')
        ->expiresAt(now()->addHour())
        ->publish();

    expect(listedTitles($this->user))->toBe(['Maintenance tonight']);

    $this->travel(61)->minutes();

    expect(listedTitles($this->user))
        ->toBe([])
        ->and(listedTitles($this->user, 'archived'))
        ->toBe([])
        ->and(Inbox::counts($this->user)->toArray())
        ->toBe(['unread' => 0, 'unseen' => 0]);
});

it('expires an announcement at a time given in another timezone', function (): void {
    $this->travelTo(Carbon::parse('2026-11-17 10:00', 'UTC'));
    $expiresAt = Carbon::parse('2026-11-17 07:00', 'America/New_York');

    $announcement = Announcement::make('Maintenance tonight')
        ->expiresAt($expiresAt)
        ->publish();

    expect(listedTitles($this->user))
        ->toBe(['Maintenance tonight'])
        ->and($announcement->refresh()->expires_at->equalTo($expiresAt))
        ->toBeTrue()
        ->and($expiresAt->getTimezone()->getName())
        ->toBe('America/New_York');

    $this->travelTo(Carbon::parse('2026-11-17 12:01', 'UTC'));

    expect(listedTitles($this->user))->toBe([]);
});

it('expires an announcement at a time after 2038', function (): void {
    $expiresAt = Carbon::parse('2099-01-01 08:00', 'UTC');

    $announcement = Announcement::make('Maintenance in 2099')
        ->expiresAt($expiresAt)
        ->publish();

    expect(listedTitles($this->user))
        ->toBe(['Maintenance in 2099'])
        ->and($announcement->refresh()->expires_at->toIso8601String())
        ->toBe('2099-01-01T08:00:00+00:00');

    $this->travelTo($expiresAt);

    expect(listedTitles($this->user))->toBe([]);
});

it('stores the state of the user who reads an announcement, and only theirs', function (): void {
    $sophie = User::named('Sophie');
    $announcement = Announcement::make('Scheduled maintenance')->publish();

    $read = $this->actingAs($this->user)
        ->postJson("/_inertia-notifications/{$announcement->id}/read");

    $read->assertJsonPath('counts.unread', 0)
        ->assertJsonPath('change.kind', 'item')
        ->assertJsonPath('change.id', $announcement->id);

    expect($read->json('change.readAt'))
        ->not->toBeNull()
        ->and(InboxAnnouncementState::query()->count())
        ->toBe(1)
        ->and(Inbox::counts($this->user)->toArray())
        ->toBe(['unread' => 0, 'unseen' => 0])
        ->and(Inbox::counts($sophie)->toArray())
        ->toBe(['unread' => 1, 'unseen' => 1]);

    $this->postJson("/_inertia-notifications/{$announcement->id}/unread")
        ->assertJsonPath('counts.unread', 1);
});

it('archives, snoozes, and brings back an announcement for one user', function (): void {
    $announcement = Announcement::make('Scheduled maintenance')->publish();
    $this->actingAs($this->user);

    $this->postJson("/_inertia-notifications/{$announcement->id}/archive")
        ->assertJsonPath('counts.unread', 0);

    expect(listedTitles($this->user, 'archived'))->toBe(['Scheduled maintenance']);

    $this->postJson("/_inertia-notifications/{$announcement->id}/unarchive");
    $this->postJson("/_inertia-notifications/{$announcement->id}/snooze", ['until' => now()->addHour()->toIso8601String()])
        ->assertJsonPath('counts.unread', 0);

    expect(listedTitles($this->user))
        ->toBe([])
        ->and(listedTitles($this->user, 'snoozed'))
        ->toBe(['Scheduled maintenance'])
        ->and(listedTitles(User::named('Sophie')))
        ->toBe(['Scheduled maintenance']);
});

it('snoozes an announcement until a time after 2038', function (): void {
    $announcement = Announcement::make('Scheduled maintenance')->publish();

    $this->actingAs($this->user)
        ->postJson("/_inertia-notifications/{$announcement->id}/snooze", ['until' => '2099-01-01T08:00:00+00:00'])
        ->assertOk()
        ->assertJsonPath('change.snoozedUntil', '2099-01-01T08:00:00+00:00');

    expect(InboxAnnouncementState::query()->sole()->snoozed_until->toIso8601String())
        ->toBe('2099-01-01T08:00:00+00:00');
});

it('lists announcements and notifications together, newest first, page by page', function (): void {
    notified($this->user, 'Notification 1', 1);
    announced(Announcement::make('Announcement 2'), 2);
    notified($this->user, 'Notification 3', 3);
    announced(Announcement::make('Announcement 4'), 4);
    announced(Announcement::make('Announcement 5'), 5);
    notified($this->user, 'Notification 6', 6);
    $this->actingAs($this->user);

    $first = $this->getJson('/_inertia-notifications?per_page=2');
    $second = $this->getJson('/_inertia-notifications?per_page=2&cursor='.$first->json('nextCursor'));
    $third = $this->getJson('/_inertia-notifications?per_page=2&cursor='.$second->json('nextCursor'));

    expect($first->json('items.*.title'))
        ->toBe(['Notification 1', 'Announcement 2'])
        ->and($second->json('items.*.title'))
        ->toBe(['Notification 3', 'Announcement 4'])
        ->and($third->json('items.*.title'))
        ->toBe(['Announcement 5', 'Notification 6'])
        ->and($third->json('nextCursor'))
        ->toBeNull();
});

it('pages back through announcements and notifications with the previous cursor', function (): void {
    notified($this->user, 'Notification 1', 1);
    announced(Announcement::make('Announcement 2'), 2);
    announced(Announcement::make('Announcement 3'), 3);
    notified($this->user, 'Notification 4', 4);
    announced(Announcement::make('Announcement 5'), 5);

    $page = Inbox::paginate($this->user, perPage: 2);
    $page = Inbox::paginate($this->user, perPage: 2, cursor: $page->nextCursor()->encode());
    $page = Inbox::paginate($this->user, perPage: 2, cursor: $page->nextCursor()->encode());
    $previous = Inbox::paginate($this->user, perPage: 2, cursor: $page->previousCursor()->encode());

    expect(collect($page->items())->map->toInboxArray()->pluck('title')->all())
        ->toBe(['Announcement 5'])
        ->and(collect($previous->items())->map->toInboxArray()->pluck('title')->all())
        ->toBe(['Announcement 3', 'Notification 4']);
});

it('counts the unread announcements with the notifications, by category', function (): void {
    Inbox::record($this->user, (string) Str::uuid(), 'test', InboxMessage::make('Invoice paid')->category('billing'));
    announced(Announcement::make('New invoices')->category('billing'));
    announced(Announcement::make('New dashboard')->category('product'));

    $summary = Inbox::summary($this->user);

    expect($summary['unread'])
        ->toBe(3)
        ->and($summary['unseen'])
        ->toBe(3)
        ->and($summary['categories'])
        ->toEqualCanonicalizing(['billing' => 2, 'product' => 1]);
});

it('names the newest announcement in the summary', function (): void {
    notified($this->user, 'Invoice paid', 5);
    $announcement = announced(Announcement::make('Scheduled maintenance'));

    $summary = Inbox::summary($this->user);

    expect($summary['latest'])
        ->toBe($announcement->created_at->toIso8601String())
        ->and($summary['latestIds'])
        ->toBe([$announcement->id]);
});

describe('with a table prefix', function (): void {
    beforeEach(function (): void {
        $connection = config('database.default');

        // We will replace every table with one with the prefix, on a new connection that adds the prefix to the
        // names of the indexes too, as Laravel's MySQL and PostgreSQL connections do, and drop them all after
        // the test, so the next test migrates the database again.
        config()->set("database.connections.{$connection}.prefix", 'app_');
        config()->set("database.connections.{$connection}.prefix_indexes", true);
        DB::purge($connection);
        RefreshDatabaseState::$migrated = false;
        artisan($this, 'db:wipe');
        artisan($this, 'migrate');

        $this->beforeApplicationDestroyed(fn () => artisan($this, 'db:wipe'));

        $this->user = User::named('Pascal');
    });

    it('counts the announcements with the notifications', function (): void {
        $this->travelTo(now()->subMinutes(10));
        Inbox::record($this->user, (string) Str::uuid(), 'test', InboxMessage::make('Invoice paid')->category('billing'));
        $this->travelBack();
        $read = announced(Announcement::make('New invoices')->category('billing'), 5);
        $unread = announced(Announcement::make('New dashboard')->category('product'), 2);
        InboxAnnouncement::inboxQuery($this->user, null)->whereKey($read->id)->sole()->markAsRead();

        $summary = Inbox::summary($this->user);

        expect(DB::getTablePrefix())
            ->toBe('app_')
            ->and($summary['unread'])
            ->toBe(2)
            ->and($summary['unseen'])
            ->toBe(2)
            ->and($summary['categories'])
            ->toEqualCanonicalizing(['billing' => 1, 'product' => 1])
            ->and($summary['latest'])
            ->toBe($unread->created_at->toIso8601String())
            ->and($summary['latestIds'])
            ->toBe([$unread->id]);
    });

    it('summarizes an empty inbox', function (): void {
        expect(Inbox::summary($this->user))
            ->toMatchArray(['unread' => 0, 'unseen' => 0, 'categories' => [], 'latest' => null, 'latestIds' => []]);
    });

    it('migrates the tables of another prefix into the same database', function (): void {
        // PostgreSQL shares the names of the indexes between the tables of a schema, and SQLite between
        // the tables of a database, so the second install only migrates when its names differ.
        DB::setTablePrefix('other_');

        artisan($this, 'migrate');

        expect(Schema::getIndexListing('inbox_notifications'))
            ->toContain('other_inbox_notifications_notifiable_index', 'other_inbox_notifications_list_index');

        DB::setTablePrefix('app_');

        expect(Schema::getIndexListing('inbox_notifications'))
            ->toContain('app_inbox_notifications_notifiable_index', 'app_inbox_notifications_list_index');
    });

    it('leaves the prefix out of the index names while the connection does not prefix them', function (): void {
        $connection = config('database.default');

        config()->set("database.connections.{$connection}.prefix_indexes", false);
        DB::purge($connection);
        artisan($this, 'db:wipe');
        artisan($this, 'migrate');

        expect(DB::getTablePrefix())
            ->toBe('app_')
            ->and(Schema::getIndexListing('inbox_notifications'))
            ->toContain('inbox_notifications_notifiable_index', 'inbox_notifications_list_index')
            ->not->toContain('app_inbox_notifications_notifiable_index')
            ->not->toContain('app_inbox_notifications_list_index');
    });

    it('keeps the names of the indexes within 63 characters with a prefix of 21 characters', function (): void {
        // MySQL refuses a name longer than 64 characters, and PostgreSQL cuts it to 63. The databases name the
        // primary keys themselves, such as PRIMARY on MySQL, and Laravel's own tables are not the package's.
        $connection = config('database.default');

        config()->set("database.connections.{$connection}.prefix", str_repeat('x', 20).'_');
        DB::purge($connection);
        artisan($this, 'db:wipe');
        artisan($this, 'migrate', ['--path' => realpath(__DIR__.'/../database/migrations'), '--realpath' => true]);

        $names = collect([
            'inbox_notifications',
            'inbox_mutes',
            'inbox_announcements',
            'inbox_announcement_states',
            'notification_digest_items',
            'notification_preferences',
            'push_subscriptions',
        ])->flatMap(fn (string $table): array => [
            ...collect(Schema::getIndexes($table))->where('primary', false)->pluck('name'),
            ...array_filter(array_column(Schema::getForeignKeys($table), 'name')),
        ]);

        expect($names)
            ->toContain(str_repeat('x', 20).'_inbox_notifications_list_index')
            ->and($names->map(fn (string $name): int => strlen($name))->max())
            ->toBeLessThanOrEqual(63);
    });
});

it('shares the counts of the announcements with every page', function (): void {
    Announcement::make('Scheduled maintenance')->publish();

    $this->actingAs($this->user)
        ->get('/dashboard', ['X-Inertia' => 'true'])
        ->assertJsonPath('props.inertiauiInbox.unread', 1)
        ->assertJsonPath('props.inertiauiInbox.unseen', 1);
});

it('lists the unread announcements on the unread tab and in a category', function (): void {
    $read = announced(Announcement::make('Read announcement')->category('billing'), 2);
    announced(Announcement::make('Product announcement')->category('product'), 1);
    announced(Announcement::make('Billing announcement')->category('billing'));
    $this->actingAs($this->user)
        ->postJson("/_inertia-notifications/{$read->id}/read");

    $billing = $this->getJson('/_inertia-notifications?category=billing')->json('items.*.title');

    expect(listedTitles($this->user, 'unread'))
        ->toBe(['Billing announcement', 'Product announcement'])
        ->and($billing)
        ->toBe(['Billing announcement', 'Read announcement']);
});

it('lists announcements on the tabs of the application, by category and data', function (): void {
    config(['inertia-notifications.inbox.tabs' => [
        'releases' => ['label' => 'Releases', 'category' => 'product', 'data' => ['major' => true]],
    ]]);
    announced(Announcement::make('Version 2')->category('product')->with(['major' => true]), 1);
    announced(Announcement::make('Version 1.1')->category('product')->with(['major' => false]));

    expect(listedTitles($this->user, 'releases'))->toBe(['Version 2']);
});

it('marks every announcement as read with the notifications, up to the given time', function (): void {
    $notification = notified($this->user, 'Invoice paid', 2);
    $before = announced(Announcement::make('Before the panel opened'), 1);
    announced(Announcement::make('After the panel opened'));
    $this->actingAs($this->user);

    $this->postJson('/_inertia-notifications/read', [
        'before' => $before->created_at->toIso8601String(),
        'ids' => [$before->id],
    ])->assertJsonPath('counts.unread', 1);

    expect(listedTitles($this->user, 'unread'))
        ->toBe(['After the panel opened'])
        ->and($notification->refresh()->read_at)
        ->not->toBeNull()
        ->and(Inbox::counts(User::named('Sophie'))->toArray())
        ->toBe(['unread' => 2, 'unseen' => 2]);
});

it('marks announcements as seen and archives them in bulk', function (): void {
    Announcement::make('Read announcement')->publish();
    $this->actingAs($this->user);

    $this->postJson('/_inertia-notifications/seen')
        ->assertJsonPath('counts.unseen', 0)
        ->assertJsonPath('counts.unread', 1);

    $this->postJson('/_inertia-notifications/archive', ['read' => true])
        ->assertJsonPath('counts.unread', 1);

    $this->postJson('/_inertia-notifications/archive')
        ->assertJsonPath('counts.unread', 0);

    expect(listedTitles($this->user, 'archived'))->toBe(['Read announcement']);
});

it('archives the announcements in bulk whether the user changed them before or not', function (): void {
    $snoozed = announced(Announcement::make('Snoozed announcement'), 1);
    announced(Announcement::make('New announcement'));
    $until = now()->addDay()->startOfSecond();
    InboxAnnouncement::inboxQuery($this->user, null)->whereKey($snoozed->id)->sole()->snooze($until);

    $this->actingAs($this->user)
        ->postJson('/_inertia-notifications/archive')
        ->assertJsonPath('counts.unread', 0);

    $state = InboxAnnouncement::inboxQuery($this->user, null)->whereKey($snoozed->id)->sole();

    expect(listedTitles($this->user, 'archived'))
        ->toBe(['New announcement', 'Snoozed announcement'])
        ->and($state->snoozed_until->equalTo($until))
        ->toBeTrue()
        ->and(listedTitles(User::named('Sophie')))
        ->toBe(['New announcement', 'Snoozed announcement']);
});

it('changes the selected announcements and notifications in one request', function (): void {
    $notification = notified($this->user, 'Invoice paid', 1);
    $announcement = Announcement::make('Scheduled maintenance')->publish();
    $hidden = Announcement::make('For Sophie')->audience('named', 'Sophie')->publish();

    $response = $this->actingAs($this->user)->postJson('/_inertia-notifications/batch', [
        'action' => 'read',
        'ids' => [$notification->id, $announcement->id, $hidden->id],
    ]);

    expect($response->json('change.ids'))
        ->toEqualCanonicalizing([$notification->id, $announcement->id])
        ->and($response->json('counts.unread'))
        ->toBe(0)
        ->and(InboxAnnouncementState::query()->pluck('announcement_id')->all())
        ->toBe([$announcement->id]);
});

it('removes a deleted announcement from the inbox of one user only', function (): void {
    config(['inertia-notifications.inbox.actions' => ['snooze', 'archive', 'mute', 'delete']]);
    $announcement = Announcement::make('Scheduled maintenance')->publish();
    $this->actingAs($this->user);

    $this->postJson("/_inertia-notifications/{$announcement->id}/delete")
        ->assertJsonPath('change', ['kind' => 'delete', 'ids' => [$announcement->id]])
        ->assertJsonPath('counts.unread', 0);

    expect(listedTitles($this->user))
        ->toBe([])
        ->and(listedTitles($this->user, 'archived'))
        ->toBe([])
        ->and(listedTitles(User::named('Sophie')))
        ->toBe(['Scheduled maintenance'])
        ->and(InboxAnnouncement::query()->count())
        ->toBe(1);
});

it('refuses to change an announcement outside the audience of the user', function (): void {
    $announcement = Announcement::make('For Sophie')
        ->audience('named', 'Sophie')
        ->publish();

    $this->actingAs($this->user)
        ->postJson("/_inertia-notifications/{$announcement->id}/read")
        ->assertNotFound();

    expect(InboxAnnouncementState::query()->count())->toBe(0);
});

it('leaves out the announcements of a category that the user turned off in the notification center', function (): void {
    config()->set('inertia-notifications.preferences.categories', [
        'product' => ['label' => 'Product updates', 'opt_in' => true],
        'billing' => ['label' => 'Billing'],
        'security' => ['label' => 'Security', 'locked' => true],
    ]);
    announced(Announcement::make('New dashboard')->category('product'), 3);
    announced(Announcement::make('New invoices')->category('billing'), 2);
    announced(Announcement::make('New sign-in alerts')->category('security'), 1);
    announced(Announcement::make('Office closed'));

    NotificationPreferences::update($this->user, ['billing' => ['inbox' => false]]);

    expect(listedTitles($this->user))
        ->toBe(['Office closed', 'New sign-in alerts'])
        ->and(Inbox::counts($this->user)->toArray())
        ->toBe(['unread' => 2, 'unseen' => 2]);

    NotificationPreferences::update($this->user, ['product' => ['inbox' => true]]);

    expect(listedTitles($this->user))->toBe(['Office closed', 'New sign-in alerts', 'New dashboard']);

    NotificationPreferences::update($this->user, channels: ['inbox' => false]);

    expect(listedTitles($this->user))->toBe(['Office closed', 'New sign-in alerts']);
});

it('shows the announcement of a context only while that context is the current one', function (): void {
    $acme = Team::query()->create(['name' => 'Acme']);
    $globex = Team::query()->create(['name' => 'Globex']);
    announced(Announcement::make('For Acme')->for($acme), 1);
    announced(Announcement::make('For everyone'));

    expect(listedTitles($this->user))->toBe(['For everyone']);

    Inbox::resolveContextUsing(fn (): Team => $acme);

    expect(listedTitles($this->user))
        ->toBe(['For everyone', 'For Acme'])
        ->and(Inbox::counts($this->user)->toArray())
        ->toBe(['unread' => 2, 'unseen' => 2]);

    Inbox::resolveContextUsing(fn (): Team => $globex);

    expect(listedTitles($this->user))->toBe(['For everyone']);
});

it('translates an announcement in the locale of the user who reads it', function (): void {
    app('translator')->addLines(['announcements.maintenance' => 'Maintenance on :day'], 'en');
    app('translator')->addLines(['announcements.maintenance' => 'Onderhoud op :day'], 'nl');
    app('translator')->addLines(['announcements.details' => 'Details'], 'en');
    app('translator')->addLines(['announcements.details' => 'Meer informatie'], 'nl');

    Announcement::make('announcements.maintenance', ['day' => 'Friday'])
        ->action(ToastAction::make('announcements.details')->url('/status'))
        ->publish();

    app()->setLocale('nl');

    $item = $this->actingAs($this->user)
        ->getJson('/_inertia-notifications')
        ->json('items.0');

    expect($item['title'])
        ->toBe('Onderhoud op Friday')
        ->and($item['actions'][0]['label'])
        ->toBe('Meer informatie');
});

it('reads the announcements that a user sees in PHP, with the state of that user', function (): void {
    $sophie = User::named('Sophie');
    announced(Announcement::make('Older'), 5);
    announced(Announcement::make('Scheduled maintenance'));

    $announcement = InboxAnnouncement::inboxQuery($this->user, null)
        ->latest()
        ->first();

    $announcement->markAsRead();
    $announcement->archive();

    $mine = InboxAnnouncement::inboxQuery($this->user, null)->whereKey($announcement->id)->sole();
    $theirs = InboxAnnouncement::inboxQuery($sophie, null)->where('id', $announcement->id)->sole();

    expect($announcement->toInboxArray()['title'])
        ->toBe('Scheduled maintenance')
        ->and($mine->isRead())
        ->toBeTrue()
        ->and($mine->archived_at)
        ->not->toBeNull()
        ->and($theirs->isRead())
        ->toBeFalse()
        ->and(Inbox::counts($this->user)->toArray())
        ->toBe(['unread' => 1, 'unseen' => 1]);
});

it('updates a state of an announcement by its announcement and notifiable model', function (): void {
    $sophie = User::named('Sophie');
    $announcement = announced(Announcement::make('Scheduled maintenance'), 1);
    announced(Announcement::make('New dashboard'));
    InboxAnnouncement::inboxQuery($this->user, null)->get()->each->markAsRead();
    InboxAnnouncement::inboxQuery($sophie, null)->whereKey($announcement->id)->sole()->markAsRead();

    $state = $announcement->states()
        ->where('notifiable_id', $this->user->getKey())
        ->sole();

    $state->update(['read_at' => null]);

    expect(listedTitles($this->user, 'unread'))
        ->toBe(['Scheduled maintenance'])
        ->and(listedTitles($sophie, 'unread'))
        ->toBe(['New dashboard']);
});

it('deletes a state of an announcement by its announcement and notifiable model', function (): void {
    $sophie = User::named('Sophie');
    $announcement = announced(Announcement::make('Scheduled maintenance'), 1);
    announced(Announcement::make('New dashboard'));
    InboxAnnouncement::inboxQuery($this->user, null)->get()->each->markAsRead();
    InboxAnnouncement::inboxQuery($sophie, null)->whereKey($announcement->id)->sole()->markAsRead();

    $state = $announcement->states()
        ->where('notifiable_id', $this->user->getKey())
        ->sole();

    $state->delete();

    expect(InboxAnnouncementState::query()->count())
        ->toBe(2)
        ->and($announcement->states()->sole()->notifiable_id)
        ->toBe($sophie->getKey());
});

it('loads announcements on a full inbox page', function (): void {
    Route::middleware('web')->get('/inbox', fn () => Inertia::render('Inbox', [
        'notifications' => Inbox::scroll(request()->user(), request()->query('filter')),
    ]));
    notified($this->user, 'Invoice paid', 1);
    Announcement::make('Scheduled maintenance')->publish();

    $page = $this->actingAs($this->user)
        ->get('/inbox', ['X-Inertia' => 'true'])
        ->json('props.notifications.data');

    expect(array_column($page, 'title'))
        ->toBe(['Scheduled maintenance', 'Invoice paid'])
        ->and($page[0]['announcement'])
        ->toBeTrue();
});

it('broadcasts a published announcement with only its ID and context, once enabled', function (): void {
    Event::fake([AnnouncementPublished::class]);
    $acme = (new Team)->forceFill(['id' => 7, 'name' => 'Acme']);

    Announcement::make('Not broadcast')->publish();

    Event::assertNotDispatched(AnnouncementPublished::class);

    config(['inertia-notifications.inbox.broadcast_announcements' => true]);
    $everyone = Announcement::make('For everyone')->publish();
    $forAcme = Announcement::make('For Acme')->for($acme)->publish();

    // The browser compares the context of the broadcast with the one that the pages of that context share.
    Inbox::resolveContextUsing(fn (): Team => $acme);
    $context = $this->actingAs($this->user)
        ->get('/dashboard', ['X-Inertia' => 'true'])
        ->json('props.inertiauiInbox.context');

    $events = Event::dispatched(AnnouncementPublished::class)->map(fn (array $args): AnnouncementPublished => $args[0]);

    expect($events->map(fn (AnnouncementPublished $event): array => $event->broadcastWith())->all())
        ->toBe([
            ['id' => $everyone->id, 'context' => null],
            ['id' => $forAcme->id, 'context' => $context],
        ])
        ->and($context)
        ->toBeString()
        ->and($events->first()->broadcastOn()[0]->name)
        ->toBe('private-inertiaui.announcements')
        ->and($events->first()->broadcastAs())
        ->toBe('inertiaui.announcement.published');
});

it('shares the announcements channel, which every signed-in user may listen on, once enabled', function (): void {
    $shared = fn (): ?string => $this->actingAs($this->user)
        ->get('/dashboard', ['X-Inertia' => 'true'])
        ->json('props.inertiauiInbox.announcementsChannel');

    expect($shared())
        ->toBeNull()
        ->and(Broadcast::driver()->getChannels()->has('inertiaui.announcements'))
        ->toBeFalse();

    // The package registers the channel when it boots, with the config of the application.
    config(['inertia-notifications.inbox.broadcast_announcements' => true]);
    $this->app->register(NotificationsServiceProvider::class, force: true);

    $authorize = Broadcast::driver()->getChannels()->get('inertiaui.announcements');

    expect($shared())
        ->toBe('inertiaui.announcements')
        ->and($authorize($this->user))
        ->toBeTrue();
});

it('returns a published announcement with the counts to the users of its audience only', function (): void {
    notified($this->user, 'Invoice paid', 1);
    $announcement = Announcement::make('For Pascal')
        ->audience('named', 'Pascal')
        ->publish();

    // The counts include the announcement already, so the browser does not count it again.
    $this->actingAs($this->user)
        ->getJson("/_inertia-notifications/{$announcement->id}")
        ->assertOk()
        ->assertJsonPath('item.id', $announcement->id)
        ->assertJsonPath('item.title', 'For Pascal')
        ->assertJsonPath('item.announcement', true)
        ->assertJsonMissingPath('item.quiet')
        ->assertJsonPath('counts.unread', 2)
        ->assertJsonPath('counts.latestIds', [$announcement->id]);

    $this->actingAs(User::named('Sophie'))
        ->getJson("/_inertia-notifications/{$announcement->id}")
        ->assertNotFound();
});

it('tells the browser to stay quiet about an announcement outside the notification hours', function (): void {
    config()->set('inertia-notifications.notification_hours.enabled', true);
    config()->set('inertia-notifications.preferences.categories', [
        'product' => ['label' => 'Product'],
        'security' => ['label' => 'Security', 'locked' => true],
    ]);
    NotificationPreferences::update($this->user, timezone: 'UTC', notificationHours: new NotificationHoursChange(
        enabled: true,
        days: array_fill_keys(NotificationHours::DAYS, ['12:00-23:00']),
    ));
    $this->travelTo(Carbon::parse('2026-11-16 10:00', 'UTC'));
    $product = Announcement::make('New dashboard')->category('product')->publish();
    $security = Announcement::make('New sign-in rules')->category('security')->publish();
    $quiet = fn (InboxAnnouncement $announcement): ?bool => $this->actingAs($this->user)
        ->getJson("/_inertia-notifications/{$announcement->id}")
        ->assertOk()
        ->json('item.quiet');

    expect($quiet($product))
        ->toBeTrue()
        ->and($quiet($security))
        ->toBeNull();

    $this->travelTo(Carbon::parse('2026-11-16 12:30', 'UTC'));

    expect($quiet($product))->toBeNull();
});

it('prunes the announcements that expired, with the states of their users', function (): void {
    $expired = announced(Announcement::make('Expired')->expiresAt(now()->subMinute()));
    $current = announced(Announcement::make('Current')->expiresAt(now()->addDay()));
    $old = announced(Announcement::make('Old'), 60 * 24 * 91);
    InboxAnnouncement::inboxQuery($this->user, null)->get()->each->markAsRead();

    $this->artisan('model:prune', ['--model' => [InboxAnnouncement::class]])
        ->assertSuccessful();

    expect(InboxAnnouncement::query()->pluck('id')->all())
        ->toBe([$current->id])
        ->and(InboxAnnouncementState::query()->pluck('announcement_id')->all())
        ->toBe([$current->id])
        ->and($expired->exists && $old->exists)
        ->toBeTrue();
});
