<?php

namespace InertiaUI\Notifications\Concerns;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Pagination\Cursor;
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Support\Collection;
use InertiaUI\Notifications\Models\InboxAnnouncement;
use InertiaUI\Notifications\Models\InboxAnnouncementState;
use InertiaUI\Notifications\Models\InboxNotification;

/**
 * Adds the announcements that a user sees to the lists and the counts of the notification center.
 */
trait IncludesAnnouncements
{
    /**
     * Add the announcements of the given query to the given page of notifications.
     *
     * The page holds one notification more than the given number per page, like the announcements read
     * after the same cursor, so the new page holds the newest of both, in order, and tells whether more
     * items follow. Its cursor continues where either one left off.
     *
     * @param  CursorPaginator<int, InboxNotification>  $notifications
     * @param  Builder<InboxAnnouncement>  $query
     * @return CursorPaginator<int, InboxNotification|InboxAnnouncement>
     */
    protected static function withAnnouncements(
        CursorPaginator $notifications,
        Builder $query,
        int $perPage,
    ): CursorPaginator {
        $cursor = $notifications->cursor();
        $items = collect($notifications->items())
            ->concat(self::announcementsFromCursor($query, $cursor, $perPage + 1))
            ->sort(self::compareNewest(...))
            ->values();

        // The paginator reverses the items of a previous page, so they should come closest to the cursor first,
        // like the rows of its query. It keeps one item more than a page to tell whether there are more items.
        if ($cursor?->pointsToPreviousItems()) {
            $items = $items->reverse();
        }

        return new CursorPaginator(
            items: $items->take($perPage + 1)->values(),
            perPage: $perPage,
            cursor: $cursor,
            options: $notifications->getOptions(),
        );
    }

    /**
     * Get the announcements of the given query after the given cursor, newest first, or oldest first before it.
     *
     * @param  Builder<InboxAnnouncement>  $query
     * @return Collection<int, InboxAnnouncement>
     */
    protected static function announcementsFromCursor(Builder $query, ?Cursor $cursor, int $limit): Collection
    {
        $createdAt = $query->getModel()->qualifyColumn('created_at');
        $id = $query->getModel()->qualifyColumn('id');
        $previous = $cursor instanceof Cursor && $cursor->pointsToPreviousItems();
        $direction = $previous ? 'asc' : 'desc';

        if ($cursor instanceof Cursor) {
            $operator = $previous ? '>' : '<';

            $query->where(fn (Builder $query) => $query->where($createdAt, $operator, $cursor->parameter('created_at'))
                ->orWhere(fn (Builder $query) => $query->where($createdAt, $cursor->parameter('created_at'))
                    ->where($id, $operator, $cursor->parameter('id'))));
        }

        return $query->orderBy($createdAt, $direction)
            ->orderBy($id, $direction)
            ->limit($limit)
            ->get()
            ->toBase();
    }

    /**
     * Compare two items of the notification center, so the newer one comes first.
     */
    protected static function compareNewest(Model $first, Model $second): int
    {
        $newer = [$second->getAttribute('created_at'), $second->getKey()];

        return $newer <=> [$first->getAttribute('created_at'), $first->getKey()];
    }

    /**
     * Get the queries of the announcements' rows of the inbox summary.
     *
     * The first counts the unread and unseen announcements by category, and the second holds the newest
     * announcements, like the queries of the notifications that the summary unites them with.
     *
     * @return array{QueryBuilder, QueryBuilder}
     */
    protected static function announcementSummaryQueries(Model $notifiable, ?Model $context): array
    {
        $announcements = (new InboxAnnouncement)->getTable();
        $states = (new InboxAnnouncementState)->getTable();
        $visible = InboxAnnouncement::query()->visibleTo($notifiable, $context);

        // Raw expressions hold their columns as they are, so we will wrap the columns ourselves, which
        // adds the table prefix of the connection, like the builder does for the other clauses.
        $grammar = $visible->getQuery()->getGrammar();
        $createdAt = $grammar->wrap("{$announcements}.created_at");
        $category = $grammar->wrap("{$announcements}.category");
        $readAt = $grammar->wrap("{$states}.read_at");
        $seenAt = $grammar->wrap("{$states}.seen_at");

        $newest = (clone $visible)->toBase()->selectRaw("max({$createdAt})");

        $counts = (clone $visible)->active()->toBase()
            ->selectRaw("'count' as row_kind, {$category}")
            ->selectRaw("count(case when {$readAt} is null then 1 end) as unread")
            ->selectRaw("count(case when {$seenAt} is null then 1 end) as unseen")
            ->selectRaw('null as id, null as created_at')
            ->groupBy("{$announcements}.category");

        $latest = (clone $visible)->toBase()
            ->selectRaw("'latest' as row_kind, null as category, 0 as unread, 0 as unseen")
            ->addSelect(["{$announcements}.id", "{$announcements}.created_at"])
            ->where("{$announcements}.created_at", $newest);

        return [$counts, $latest];
    }
}
