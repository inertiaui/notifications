<?php

namespace InertiaUI\Notifications\Concerns;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Pagination\CursorPaginator;
use InertiaUI\Notifications\DoNotDisturb;
use InertiaUI\Notifications\Events\InboxChanged;
use InertiaUI\Notifications\Models\InboxAnnouncement;
use InertiaUI\Notifications\Models\InboxNotification;

/**
 * Reads the notification center together with the summary of its counts, which is read first.
 *
 * @phpstan-import-type InboxSummary from InboxChanged
 */
trait ReadsInboxWithSummary
{
    /**
     * Get one page of the notifiable model's notifications and announcements, and the summary of its inbox.
     *
     * @param  string|null  $filter  A built-in filter, or the key of one of the application's tabs.
     * @return array{CursorPaginator<int, InboxNotification|InboxAnnouncement>, InboxSummary}
     */
    public static function paginateWithSummary(
        Model $notifiable,
        ?string $filter = null,
        ?string $category = null,
        ?int $perPage = null,
        ?string $cursor = null,
    ): array {
        // We will read the counts before the list, so the list is always at least as new
        // as the revision of the counts that we return along with it.
        $summary = self::summary($notifiable);
        $page = self::paginate($notifiable, $filter, $category, $perPage, $cursor);

        return [$page, $summary];
    }

    /**
     * Get the given notification, or announcement that the notifiable model sees, as the frontend receives it,
     * and the summary of its inbox.
     *
     * The summary is read first, like the summary of a page. An announcement holds `quiet` outside the
     * notification hours of the notifiable model and while it paused its notifications, which tells
     * the browser to show no toast or alert for it.
     *
     * @return array{array<string, mixed>, InboxSummary}
     *
     * @throws ModelNotFoundException
     */
    public static function itemWithSummary(Model $notifiable, string $id): array
    {
        $summary = self::summary($notifiable);
        $item = self::find($notifiable, $id);
        $array = $item->toInboxArray();

        if ($item instanceof InboxAnnouncement && DoNotDisturb::silences($notifiable, $item->category)) {
            $array['quiet'] = true;
        }

        return [$array, $summary];
    }
}
