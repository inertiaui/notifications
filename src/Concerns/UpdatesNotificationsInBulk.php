<?php

namespace InertiaUI\Notifications\Concerns;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use InertiaUI\Notifications\Models\InboxAnnouncement;
use InertiaUI\Notifications\Models\InboxNotification;

/**
 * Marks the notifications and announcements of a notifiable model as seen or read, or archives them, at once.
 *
 * A bulk update covers the items in the current context that were created until the given time. With IDs, it
 * covers those created before that time, and only those created at that time whose IDs are given: creation
 * times have no fractions of a second, so a later item can share the time of the newest one the browser
 * had. A category limits the update to the items of that category. The time is compared with the stored
 * creation times, which are in the application's timezone.
 */
trait UpdatesNotificationsInBulk
{
    /**
     * Mark the notifiable model's notifications and announcements as seen, and get the change that describes them.
     *
     * @param  list<string>|null  $ids
     * @return array{kind: 'seen', before: string, ids: list<string>|null, category: string|null}
     */
    public static function markAllAsSeen(
        Model $notifiable,
        CarbonInterface $before,
        ?array $ids = null,
        ?string $category = null,
    ): array {
        [$notifications, $announcements] = self::bulkQueries($notifiable, $before, $ids, $category);

        $notifications->unseen()->update(['seen_at' => now()]);

        InboxAnnouncement::updateStates($announcements->unseen(), $notifiable, ['seen_at' => now()]);

        return self::bulkChange('seen', $before, $ids, $category);
    }

    /**
     * Mark the notifiable model's notifications and announcements as read, and get the change that describes them.
     *
     * Archived and snoozed items keep their state.
     *
     * @param  list<string>|null  $ids
     * @return array{kind: 'read', before: string, ids: list<string>|null, category: string|null}
     */
    public static function markAllAsRead(
        Model $notifiable,
        CarbonInterface $before,
        ?array $ids = null,
        ?string $category = null,
    ): array {
        [$notifications, $announcements] = self::bulkQueries($notifiable, $before, $ids, $category);

        self::model()::markAsReadInBulk($notifications->active()->unread());

        InboxAnnouncement::updateStates(
            $announcements->active()->unread(),
            $notifiable,
            ['read_at' => now(), 'seen_at' => now()],
        );

        return self::bulkChange('read', $before, $ids, $category);
    }

    /**
     * Archive the notifiable model's notifications and announcements, and get the change that describes them.
     *
     * With `onlyRead`, only the items that have been read are archived.
     *
     * @param  list<string>|null  $ids
     * @return array{
     *     kind: 'archive',
     *     before: string,
     *     ids: list<string>|null,
     *     category: string|null,
     *     onlyRead: bool,
     * }
     */
    public static function archiveAll(
        Model $notifiable,
        CarbonInterface $before,
        ?array $ids = null,
        ?string $category = null,
        bool $onlyRead = false,
    ): array {
        [$notifications, $announcements] = self::bulkQueries($notifiable, $before, $ids, $category);

        $notifications->whereNull('archived_at');
        $announcements->unarchived();

        if ($onlyRead) {
            $notifications->read();
            $announcements->read();
        }

        $notifications->update(['archived_at' => now()]);

        InboxAnnouncement::updateStates($announcements, $notifiable, ['archived_at' => now()]);

        return [...self::bulkChange('archive', $before, $ids, $category), 'onlyRead' => $onlyRead];
    }

    /**
     * Get the queries of the notifiable model's notifications and announcements that a bulk update covers.
     *
     * @param  list<string>|null  $ids
     * @return array{Builder<InboxNotification>, Builder<InboxAnnouncement>}
     */
    protected static function bulkQueries(
        Model $notifiable,
        CarbonInterface $before,
        ?array $ids,
        ?string $category,
    ): array {
        // The given time may be in any timezone, such as the user's, while the queries compare it with
        // stored creation times, so we will move the same instant to the application's timezone.
        $before = self::inApplicationTimezone($before);
        $context = self::context();
        $notifications = self::queryInContext($notifiable, $context);
        $announcements = InboxAnnouncement::query()->visibleTo($notifiable, $context);

        self::applyBulkScope($notifications, $before, $ids, $category);
        self::applyBulkScope($announcements, $before, $ids, $category);

        return [$notifications, $announcements];
    }

    /**
     * Limit the given query to the items that a bulk update covers.
     *
     * @param  Builder<InboxNotification>|Builder<InboxAnnouncement>  $query
     * @param  list<string>|null  $ids
     */
    protected static function applyBulkScope(
        Builder $query,
        CarbonInterface $before,
        ?array $ids,
        ?string $category,
    ): void {
        $createdAt = $query->getModel()->qualifyColumn('created_at');
        $id = $query->getModel()->qualifyColumn('id');

        if ($ids === null) {
            $query->where($createdAt, '<=', $before);
        } else {
            $query->where(fn (Builder $query) => $query->where($createdAt, '<', $before)
                ->orWhere(fn (Builder $query) => $query->where($createdAt, $before)->whereIn($id, $ids)));
        }

        if ($category !== null) {
            $query->where($query->getModel()->qualifyColumn('category'), $category);
        }
    }

    /**
     * Get the change that describes a bulk update, which the browser and the user's other sessions apply.
     *
     * @template TKind of 'read'|'seen'|'archive'
     *
     * @param  TKind  $kind
     * @param  list<string>|null  $ids
     * @return array{kind: TKind, before: string, ids: list<string>|null, category: string|null}
     */
    protected static function bulkChange(string $kind, CarbonInterface $before, ?array $ids, ?string $category): array
    {
        return [
            'kind' => $kind,
            'before' => $before->toIso8601String(),
            'ids' => $ids,
            'category' => $category,
        ];
    }
}
