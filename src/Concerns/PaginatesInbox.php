<?php

namespace InertiaUI\Notifications\Concerns;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\ScrollProp;
use InertiaUI\Notifications\Inbox;
use InertiaUI\Notifications\InboxPage;
use InertiaUI\Notifications\Models\InboxAnnouncement;
use InertiaUI\Notifications\Models\InboxMute;
use InertiaUI\Notifications\Models\InboxNotification;

/**
 * Reads the notification center one page at a time, newest first.
 */
trait PaginatesInbox
{
    /**
     * Get one page of the notifiable model's notifications and announcements, newest first.
     *
     * Each item serializes to the shape the frontend reads. The `all` and `unread` filters, and the
     * application's tabs, leave out archived and snoozed items.
     *
     * @param  string|null  $filter  A built-in filter, or the key of one of the application's tabs.
     * @return CursorPaginator<int, InboxNotification|InboxAnnouncement>
     */
    public static function paginate(
        Model $notifiable,
        ?string $filter = null,
        ?string $category = null,
        ?int $perPage = null,
        ?string $cursor = null,
    ): CursorPaginator {
        $context = self::context();
        $query = self::queryInContext($notifiable, $context);
        $announcements = InboxAnnouncement::inboxQuery($notifiable, $context);

        self::applyFilter($query, $filter, $category);
        self::applyFilter($announcements, $filter, $category);

        $perPage ??= (int) config('inertia-notifications.inbox.per_page', 20);
        $revision = self::revision();

        // We will read one notification more than a page, like the announcements, so the page that
        // holds the newest of both can tell whether more notifications follow its last item.
        $notifications = $query->orderByDesc('created_at')
            ->orderByDesc('id')
            ->cursorPaginate(perPage: $perPage + 1, cursor: $cursor);

        $page = self::withAnnouncements($notifications, $announcements, $perPage);

        foreach ($page->items() as $notification) {
            $notification->revision = $revision;
        }

        self::loadMutes($notifiable, $page->items());

        return $page;
    }

    /**
     * Load whether the notifiable model muted the thread of each of the given notifications, in one query.
     *
     * @param  array<int, InboxNotification|InboxAnnouncement>  $items
     */
    protected static function loadMutes(Model $notifiable, array $items): void
    {
        $notifications = collect($items)->whereInstanceOf(InboxNotification::class);
        $muted = self::mutedGroups($notifiable, $notifications);

        foreach ($notifications as $notification) {
            $notification->muted = in_array($notification->group_key, $muted, true);
        }
    }

    /**
     * Get the group keys of the given notifications whose threads the notifiable model muted.
     *
     * While the `inbox.actions` config leaves out muting, no thread counts as muted.
     *
     * @param  Collection<int, InboxNotification>  $notifications
     * @return list<string>
     */
    protected static function mutedGroups(Model $notifiable, Collection $notifications): array
    {
        if (! self::allows('mute')) {
            return [];
        }

        $groups = $notifications->pluck('group_key')->filter()->unique()->values();

        if ($groups->isEmpty()) {
            return [];
        }

        return InboxMute::of($notifiable->getMorphClass(), $notifiable->getKey())
            ->whereIn('group_key', $groups->all())
            ->pluck('group_key')
            ->all();
    }

    /**
     * Create the infinite scroll prop for a full inbox page.
     *
     * The page renders `<NotificationList>`, which loads the next pages with Inertia's infinite scroll:
     * `'notifications' => Inbox::scroll($request->user(), $request->query('filter'))`. A filter that the list
     * does not offer lists `all`, as `Inbox::resolveFilter()` decides.
     *
     * @return ScrollProp<CursorPaginator<int, InboxNotification|InboxAnnouncement>>
     */
    public static function scroll(
        Model $notifiable,
        mixed $filter = null,
        ?string $category = null,
        ?int $perPage = null,
    ): ScrollProp {
        $filter = self::resolveFilter($filter);

        return Inertia::scroll(fn (): CursorPaginator => self::paginate($notifiable, $filter, $category, $perPage));
    }

    /**
     * Get the props of a full inbox page of the signed-in user: `Inertia::render('Notifications', Inbox::page())`.
     *
     * The page receives the `filter` and `category` query parameters, which the tabs and category buttons of
     * `<NotificationList>` link to, as the `filter` and `category` props, and the notifications that match them as
     * the `notifications` prop.
     */
    public static function page(?int $perPage = null): InboxPage
    {
        return new InboxPage($perPage);
    }
}
