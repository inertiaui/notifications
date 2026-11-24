<?php

namespace InertiaUI\Notifications\Http\Controllers;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controllers\HasMiddleware;
use Illuminate\Routing\Controllers\Middleware;
use Illuminate\Support\Str;
use Inertia\Inertia;
use InertiaUI\Notifications\Events\InboxChanged;
use InertiaUI\Notifications\Http\Requests\BatchNotificationsRequest;
use InertiaUI\Notifications\Http\Requests\BulkUpdateNotificationsRequest;
use InertiaUI\Notifications\Http\Requests\CompleteNotificationRequest;
use InertiaUI\Notifications\Http\Requests\ListNotificationsRequest;
use InertiaUI\Notifications\Http\Requests\PauseNotificationsRequest;
use InertiaUI\Notifications\Http\Requests\SnoozeNotificationRequest;
use InertiaUI\Notifications\Inbox;
use InertiaUI\Notifications\Models\InboxAnnouncement;
use InertiaUI\Notifications\Models\InboxNotification;
use InertiaUI\Notifications\NotificationPreferences;
use Symfony\Component\HttpFoundation\Response;

/**
 * The JSON endpoints of the notification center, registered with `Route::inertiaNotifications()`.
 * Every query is scoped to the signed-in user.
 *
 * @phpstan-import-type InboxChange from InboxChanged
 */
class InboxController extends Controller implements HasMiddleware
{
    /**
     * Get the middleware that should be assigned to the controller.
     *
     * The endpoints of a feature that the config leaves out are not found, also before their request is
     * validated: the pause endpoints while the application does not offer pausing, the endpoints of an
     * action that the `inbox.actions` config leaves out, and the batch of the selection while users may
     * not select notifications. A batch is not found for the actions that it would run either, as its
     * `action` input names them.
     *
     * @return list<Middleware>
     */
    public static function middleware(): array
    {
        return [
            new Middleware(
                self::notFoundUnless(NotificationPreferences::offersPausing(...)),
                only: ['pause', 'resume'],
            ),
            new Middleware(self::offering('archive'), only: ['archive', 'unarchive', 'archiveAll']),
            new Middleware(self::offering('snooze'), only: ['snooze', 'unsnooze']),
            new Middleware(self::offering('mute'), only: ['mute', 'unmute']),
            new Middleware(self::offering('delete'), only: ['destroy']),
            new Middleware(function (Request $request, Closure $next): Response {
                $action = $request->input('action');

                abort_unless(Inbox::selectable(), 404);
                abort_if(is_string($action) && ! Inbox::allowsBatchAction($action), 404);

                return $next($request);
            }, only: ['batch']),
        ];
    }

    /**
     * Get the middleware that finds no endpoint while the `inbox.actions` config leaves out the given action.
     *
     * @param  'snooze'|'archive'|'mute'|'delete'  $action
     */
    protected static function offering(string $action): Closure
    {
        return self::notFoundUnless(fn (): bool => Inbox::allows($action));
    }

    /**
     * Get one page of the user's notifications.
     */
    public function index(ListNotificationsRequest $request): JsonResponse
    {
        [$page, $summary] = Inbox::paginateWithSummary(
            $this->user($request),
            filter: $request->filter(),
            category: $request->category(),
            perPage: $request->perPage(),
            cursor: $request->cursor(),
        );

        return response()->json([
            'items' => $page->items(),
            'nextCursor' => $page->nextCursor()?->encode(),
            'counts' => $summary,
        ]);
    }

    /**
     * Get the counts of the user's notifications.
     */
    public function counts(Request $request): JsonResponse
    {
        return $this->respond($request);
    }

    /**
     * Get one notification of the user, or one announcement that the user sees, with the counts.
     *
     * Browsers request an announcement once it is broadcast as published. Its `quiet` key tells them to show
     * no toast or alert for it outside the user's notification hours and while the user paused them.
     */
    public function show(Request $request): JsonResponse
    {
        [$item, $summary] = Inbox::itemWithSummary($this->user($request), $this->notificationId($request));

        return response()->json(['item' => $item, 'counts' => $summary]);
    }

    /**
     * Mark the given notification as read and visit its URL, as a click on its push does.
     *
     * The notification is found in every context, since a push of one team may be clicked while another
     * team is current. The user's other sessions are told that the notification was read. An open tab
     * visits this link with Inertia, which follows a redirect with a request that can't leave the origin,
     * so a URL on another origin gets Inertia's location response, which the tab loads in full.
     */
    public function open(Request $request): Response
    {
        $item = $this->findNotification($request);

        Inbox::markAsRead($item);

        $url = url()->to($item->data['url'] ?? '/');

        // A URL such as javascript: would run script on this origin once an open tab loads it in full,
        // so we will visit the home page instead, as the notification center shows no link for it.
        if (! $this->hasSafeScheme($url)) {
            return redirect()->to('/');
        }

        if (! $this->isOnOrigin($request, $url)) {
            return Inertia::location($url);
        }

        return redirect()->to($url);
    }

    /**
     * Mark the given notification as read.
     */
    public function read(Request $request): JsonResponse
    {
        $item = $this->findNotificationOrAnnouncement($request);

        $item->markAsRead();

        return $this->respond($request, Inbox::itemChange($item));
    }

    /**
     * Mark the given notification as unread.
     */
    public function unread(Request $request): JsonResponse
    {
        $item = $this->findNotificationOrAnnouncement($request);

        $item->markAsUnread();

        return $this->respond($request, Inbox::itemChange($item));
    }

    /**
     * Archive the given notification.
     */
    public function archive(Request $request): JsonResponse
    {
        $item = $this->findNotificationOrAnnouncement($request);

        $item->archive();

        return $this->respond($request, Inbox::itemChange($item));
    }

    /**
     * Unarchive the given notification.
     */
    public function unarchive(Request $request): JsonResponse
    {
        $item = $this->findNotificationOrAnnouncement($request);

        $item->unarchive();

        return $this->respond($request, Inbox::itemChange($item));
    }

    /**
     * Snooze the given notification.
     */
    public function snooze(SnoozeNotificationRequest $request): JsonResponse
    {
        $until = $request->until();
        $item = $this->findNotificationOrAnnouncement($request);

        $item->snooze($until);

        return $this->respond($request, Inbox::itemChange($item));
    }

    /**
     * Unsnooze the given notification.
     */
    public function unsnooze(Request $request): JsonResponse
    {
        $item = $this->findNotificationOrAnnouncement($request);

        $item->unsnooze();

        return $this->respond($request, Inbox::itemChange($item));
    }

    /**
     * Complete the given notification with the result of the action that the user ran.
     */
    public function complete(CompleteNotificationRequest $request): JsonResponse
    {
        $action = $request->actionIndex();
        $item = $this->findNotification($request);

        abort_unless($item->completeAction($action), 422);

        return $this->respond($request, Inbox::itemChange($item));
    }

    /**
     * Mute the thread of the given notification's group key for the signed-in user.
     */
    public function mute(Request $request): JsonResponse
    {
        $item = $this->findGroupedNotification($request);

        Inbox::mute($this->user($request), $item->group_key);

        return $this->respond($request, ['kind' => 'mute', 'group' => $item->group_key, 'muted' => true]);
    }

    /**
     * Unmute the thread of the given notification's group key for the signed-in user.
     */
    public function unmute(Request $request): JsonResponse
    {
        $item = $this->findGroupedNotification($request);

        Inbox::unmute($this->user($request), $item->group_key);

        return $this->respond($request, ['kind' => 'mute', 'group' => $item->group_key, 'muted' => false]);
    }

    /**
     * Delete the given notification.
     */
    public function destroy(Request $request): JsonResponse
    {
        $item = $this->findNotificationOrAnnouncement($request);

        Inbox::delete($item);

        return $this->respond($request, ['kind' => 'delete', 'ids' => [$item->id]]);
    }

    /**
     * Change or delete the given notifications, such as the ones the user selected.
     *
     * Only the notifications of the current context change. The change lists the IDs of those
     * that the action ran on, so the browser leaves the others as they were.
     */
    public function batch(BatchNotificationsRequest $request): JsonResponse
    {
        $change = Inbox::runBatch(
            $this->user($request),
            action: $request->action(),
            ids: $request->ids(),
            until: $request->until(),
        );

        return $this->respond($request, $change);
    }

    /**
     * Mark the given notifications and announcements as seen, such as the ones that the panel showed for a second.
     *
     * Unlike the batch of the selection, the panel needs this whether or not users may select notifications.
     */
    public function seenItems(Request $request): JsonResponse
    {
        /** @var array{ids: array<int, string>} $validated */
        $validated = $request->validate([
            'ids' => ['required', 'array', 'max:100'],
            'ids.*' => ['uuid'],
        ]);

        $change = Inbox::runBatch($this->user($request), action: 'seen', ids: array_values($validated['ids']));

        return $this->respond($request, $change);
    }

    /**
     * Mark the user's notifications as seen.
     */
    public function seen(BulkUpdateNotificationsRequest $request): JsonResponse
    {
        $change = Inbox::markAllAsSeen(
            $this->user($request),
            before: $request->before(),
            ids: $request->ids(),
            category: $request->category(),
        );

        return $this->respond($request, $change);
    }

    /**
     * Mark the user's notifications as read.
     */
    public function readAll(BulkUpdateNotificationsRequest $request): JsonResponse
    {
        $change = Inbox::markAllAsRead(
            $this->user($request),
            before: $request->before(),
            ids: $request->ids(),
            category: $request->category(),
        );

        return $this->respond($request, $change);
    }

    /**
     * Archive the user's notifications.
     *
     * When the request sends `read`, only the notifications that have been read are archived.
     */
    public function archiveAll(BulkUpdateNotificationsRequest $request): JsonResponse
    {
        $change = Inbox::archiveAll(
            $this->user($request),
            before: $request->before(),
            ids: $request->ids(),
            category: $request->category(),
            onlyRead: $request->onlyRead(),
        );

        return $this->respond($request, $change);
    }

    /**
     * Pause the user's notifications until the given time.
     */
    public function pause(PauseNotificationsRequest $request): JsonResponse
    {
        $user = $this->user($request);

        NotificationPreferences::pause($user, $request->until());

        return $this->respond($request, Inbox::pauseChange($user));
    }

    /**
     * Resume the user's paused notifications.
     */
    public function resume(Request $request): JsonResponse
    {
        $user = $this->user($request);

        NotificationPreferences::resume($user);

        return $this->respond($request, Inbox::pauseChange($user));
    }

    /**
     * Find the given notification of the signed-in user, which must have a group key to mute its thread.
     */
    protected function findGroupedNotification(Request $request): InboxNotification
    {
        $item = $this->findNotification($request);

        abort_if($item->group_key === null, 422);

        return $item;
    }

    /**
     * Determine if the given URL has no scheme or one that the notification center links to, as safeHref() checks.
     */
    protected function hasSafeScheme(string $url): bool
    {
        $scheme = parse_url($url, PHP_URL_SCHEME);

        if ($scheme === null) {
            return true;
        }

        return in_array(Str::lower((string) $scheme), ['http', 'https', 'mailto', 'tel'], true);
    }

    /**
     * Determine if the given URL has the scheme, the host, and the port of the request, as a relative URL has.
     */
    protected function isOnOrigin(Request $request, string $url): bool
    {
        $parts = parse_url(url()->to($url));

        if (! is_array($parts) || ! isset($parts['scheme'], $parts['host'])) {
            return false;
        }

        $scheme = strtolower($parts['scheme']);
        $defaultPort = $scheme === 'https' ? 443 : 80;

        return $scheme === $request->getScheme()
            && strtolower($parts['host']) === $request->getHost()
            && ($parts['port'] ?? $defaultPort) === (int) $request->getPort();
    }

    /**
     * Get the ID of the notification in the route.
     *
     * Laravel passes the route's parameters to an action by position, so under a prefix with its own
     * parameter, such as a team's `{current_team}`, we will read the notification's ID by its name.
     */
    protected function notificationId(Request $request): string
    {
        return (string) $request->route('notification');
    }

    /**
     * Find the signed-in user's notification in the route, in any context.
     */
    protected function findNotification(Request $request): InboxNotification
    {
        return Inbox::query($this->user($request))->findOrFail($this->notificationId($request));
    }

    /**
     * Find the signed-in user's notification in the route, or the announcement in the route that the user sees.
     */
    protected function findNotificationOrAnnouncement(Request $request): InboxNotification|InboxAnnouncement
    {
        return Inbox::find($this->user($request), $this->notificationId($request));
    }

    /**
     * Respond with the new counts and the given change.
     *
     * The browser shares the change with its other tabs, and the user's other sessions are told about
     * the change as well.
     *
     * @param  InboxChange|null  $change
     */
    protected function respond(Request $request, ?array $change = null): JsonResponse
    {
        $user = $this->user($request);

        if ($change === null) {
            return response()->json(['counts' => Inbox::summary($user)]);
        }

        $summary = Inbox::broadcastChangeWithSummary($user, $change);

        return response()->json(['counts' => $summary, 'change' => $change]);
    }
}
