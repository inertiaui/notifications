<?php

namespace InertiaUI\Notifications\Concerns;

use Closure;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection as BaseCollection;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use InertiaUI\Notifications\Events\AnnouncementPublished;
use InertiaUI\Notifications\Events\InboxChanged;
use InertiaUI\Notifications\InboxCounts;
use InertiaUI\Notifications\Models\InboxNotification;
use InertiaUI\Notifications\NotificationPreferences;
use InertiaUI\Notifications\Push;
use LogicException;
use stdClass;

/**
 * Counts the unread and unseen items of the notification center, and shares them with every page.
 *
 * @phpstan-import-type InboxSummary from InboxChanged
 * @phpstan-import-type InboxTab from FiltersInbox
 */
trait SummarizesInbox
{
    /**
     * Get the unread and unseen counts of the notifiable model's inbox.
     *
     * The counts include the announcements that the notifiable model sees, and leave out archived and
     * snoozed items. With a context resolver, they cover the context of the current request, so use
     * `countsInContext()` to count the inbox of another user or in a queued job.
     */
    public static function counts(Model $notifiable): InboxCounts
    {
        return self::countsInContext($notifiable, self::context());
    }

    /**
     * Get the unread and unseen counts of the notifiable model's inbox in the given context.
     *
     * Without a context, the counts cover every notification of the notifiable model, like `queryInContext()`,
     * and the announcements without a context. With a context, they leave out the notifications and the
     * announcements of other contexts.
     */
    public static function countsInContext(Model $notifiable, ?Model $context): InboxCounts
    {
        $summary = self::summaryInContext($notifiable, $context);

        return new InboxCounts(unread: $summary['unread'], unseen: $summary['unseen']);
    }

    /**
     * Get a summary of the notifiable model's inbox.
     *
     * The summary holds the counts, the creation time of the user's newest notification or announcement,
     * including archived and snoozed ones, and the IDs of those created at that time. The frontend uses
     * them to tell whether the counts already include a notification that arrives in real time: creation
     * times have no fractions of a second, so a time alone cannot tell. One statement reads them, so they
     * describe the same state of the tables. The counts include the announcements that the user sees.
     *
     * The revision is the time, in microseconds, before the statement ran. The frontend ignores counts and
     * changes with a revision older than those it already has.
     *
     * With a context resolver, the summary covers the current context and holds its opaque key.
     *
     * @return InboxSummary
     */
    public static function summary(Model $notifiable): array
    {
        return self::summaryInContext($notifiable, self::context());
    }

    /**
     * Get a summary of the notifiable model's inbox in the given context.
     *
     * @return InboxSummary
     */
    protected static function summaryInContext(Model $notifiable, ?Model $context): array
    {
        $revision = self::revision();
        $rows = self::summaryRows($notifiable, $context);
        $counts = $rows->where('row_kind', 'count');

        // The latest rows hold both the newest notifications and the newest announcements, so we will
        // take the later of the two creation times, which is the time of the user's newest item.
        $latestRows = $rows->where('row_kind', 'latest');
        $latest = $latestRows->max('created_at');

        $summary = [
            'unread' => (int) $counts->sum('unread'),
            'unseen' => (int) $counts->sum('unseen'),
            'categories' => self::unreadByCategory($counts),
            'latest' => self::latestTimestamp($latest),
            'latestIds' => $latestRows->where('created_at', $latest)
                ->map(fn (object $row): string => (string) $row->id)
                ->values()
                ->all(),
            'revision' => $revision,
        ];

        // The browser leaves out the counts and changes of other contexts that arrive in real time, so
        // we will tell it the context of these counts. Applications without contexts leave it out.
        if (static::$contextResolver instanceof Closure) {
            $summary['context'] = $context instanceof Model
                ? self::contextKey($context->getMorphClass(), $context->getKey())
                : null;
        }

        return $summary;
    }

    /**
     * Get the rows of the notifiable model's inbox summary, read in one statement.
     *
     * The rows hold the unread and unseen counts of each category and the newest notifications and
     * announcements, told apart by their `row_kind`.
     *
     * @return BaseCollection<int, stdClass>
     */
    protected static function summaryRows(Model $notifiable, ?Model $context): BaseCollection
    {
        [$announcementCounts, $latestAnnouncements] = self::announcementSummaryQueries($notifiable, $context);

        $latestCreatedAt = self::queryInContext($notifiable, $context)->toBase()->selectRaw('max(created_at)');

        return self::queryInContext($notifiable, $context)->active()->toBase()
            ->selectRaw("'count' as row_kind, category")
            ->selectRaw('count(case when read_at is null then 1 end) as unread')
            ->selectRaw('count(case when seen_at is null then 1 end) as unseen')
            ->selectRaw('null as id, null as created_at')
            ->groupBy('category')
            ->unionAll(
                self::queryInContext($notifiable, $context)->toBase()
                    ->selectRaw("'latest' as row_kind, null as category, 0 as unread, 0 as unseen, id, created_at")
                    ->where('created_at', $latestCreatedAt),
            )
            ->unionAll($announcementCounts)
            ->unionAll($latestAnnouncements)
            ->get();
    }

    /**
     * Add up the unread notifications and announcements of each category.
     *
     * A category may have a count row of its notifications and one of its announcements, so its unread
     * count is the sum of both rows.
     *
     * @param  BaseCollection<int, stdClass>  $counts
     * @return array<string, int>
     */
    protected static function unreadByCategory(BaseCollection $counts): array
    {
        $categories = [];

        foreach ($counts as $row) {
            if (is_string($row->category) && $row->unread > 0) {
                $categories[$row->category] = ($categories[$row->category] ?? 0) + (int) $row->unread;
            }
        }

        return $categories;
    }

    /**
     * Convert the given creation time of a summary row to an ISO 8601 string, as the notification model casts it.
     */
    protected static function latestTimestamp(mixed $createdAt): ?string
    {
        if ($createdAt === null) {
            return null;
        }

        $model = self::model();

        return (new $model)->newFromBuilder(['created_at' => $createdAt])->created_at->toIso8601String();
    }

    /**
     * Get the current time in microseconds.
     *
     * The time orders the counts and changes that the frontend receives, since responses and broadcasts
     * may arrive in a different order than they were made.
     */
    public static function revision(): int
    {
        return (int) now()->getPreciseTimestamp();
    }

    /**
     * Get a summary of the inbox that the given notification belongs to.
     *
     * The application may change the notification during another user's request or in a queued job, so the
     * summary covers the notification's own context instead of the context of the current request.
     *
     * @return InboxSummary
     */
    public static function summaryOf(InboxNotification $notification): array
    {
        $notifiable = $notification->notifiable;

        if (! $notifiable instanceof Model) {
            throw new LogicException("The notification [{$notification->id}] has no notifiable model.");
        }

        // Without a context resolver, the browser shows the notifications of every context, so the counts
        // cover every context too. With one, they cover the context the notification belongs to.
        $context = static::$contextResolver instanceof Closure ? $notification->context : null;

        return self::summaryInContext($notifiable, $context instanceof Model ? $context : null);
    }

    /**
     * Get the shared Inertia prop for the signed-in user.
     *
     * The prop holds the URL of the routes, the channel that receives the user's notifications, the channel
     * that announcements are broadcast on, an opaque identity of the user, the actions that the user may
     * take on notifications, whether the user may select them, the categories to filter by, the application's
     * tabs, the user's pause with the pause button's times, the push setup of the browser, and the counts.
     * The frontend forgets the notifications of the previous user when the identity changes.
     *
     * @return array{
     *     url: string,
     *     channel: string|null,
     *     announcementsChannel: string|null,
     *     user: string,
     *     allowedActions: list<'snooze'|'archive'|'mute'|'delete'>,
     *     selectable: bool,
     *     categoryFilter: array<string, string>,
     *     tabs: array<string, InboxTab>,
     *     pause: array{until: string|null, presets: list<int|'tomorrow'>}|null,
     *     push: array{publicKey: string, worker: string, subscribed: bool}|null,
     *     unread: int,
     *     unseen: int,
     *     categories: array<string, int>,
     *     latest: string|null,
     *     latestIds: list<string>,
     *     revision: int,
     *     context?: string|null,
     * }|null
     */
    public static function sharedProp(): ?array
    {
        $user = request()->user();

        if (! $user instanceof Model || ! Route::has(self::ROUTE)) {
            return null;
        }

        $context = self::context();

        // The browser applies the pause with the revision of the summary, so we will read the summary first.
        // Otherwise, a pause read before the revision was taken could replace a newer pause that another
        // tab of the user broadcast meanwhile, since the browser keeps whatever has the newer revision.
        $summary = self::summaryInContext($user, $context);

        return [
            'url' => route(self::ROUTE, absolute: false),
            'channel' => self::channel($user),
            'announcementsChannel' => self::broadcastsAnnouncements() ? AnnouncementPublished::CHANNEL : null,
            'user' => self::identity($user, $context),
            'allowedActions' => self::actions(),
            'selectable' => self::selectable(),
            'categoryFilter' => self::categoryFilter(),
            'tabs' => self::tabs(),
            'pause' => self::pauseProp($user),
            'push' => Push::sharedProp($user),
            ...$summary,
        ];
    }

    /**
     * Get the pause of the user's notifications as the shared prop holds it, with the times of the pause button,
     * or null while the application does not offer pausing.
     *
     * @return array{until: string|null, presets: list<int|'tomorrow'>}|null
     */
    protected static function pauseProp(Model $user): ?array
    {
        if (! NotificationPreferences::offersPausing()) {
            return null;
        }

        return [
            'until' => NotificationPreferences::pausedUntil($user)?->toIso8601String(),
            'presets' => NotificationPreferences::pausePresets(),
        ];
    }

    /**
     * Get an opaque identity of the user in the given context.
     *
     * The frontend forgets the notifications it has once the identity changes, such as when another user
     * signs in or the user switches to another team.
     */
    protected static function identity(Model $user, ?Model $context): string
    {
        $identity = "{$user->getMorphClass()}|{$user->getKey()}";

        if ($context instanceof Model) {
            $identity .= "|{$context->getMorphClass()}|{$context->getKey()}";
        }

        return hash('xxh128', $identity);
    }
}
