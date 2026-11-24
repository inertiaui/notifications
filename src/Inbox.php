<?php

namespace InertiaUI\Notifications;

use DateTimeInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Carbon;
use InertiaUI\Notifications\Concerns\BroadcastsInboxChanges;
use InertiaUI\Notifications\Concerns\ChangesNotifications;
use InertiaUI\Notifications\Concerns\CollapsesNotifications;
use InertiaUI\Notifications\Concerns\FiltersInbox;
use InertiaUI\Notifications\Concerns\IncludesAnnouncements;
use InertiaUI\Notifications\Concerns\MutesThreads;
use InertiaUI\Notifications\Concerns\PaginatesInbox;
use InertiaUI\Notifications\Concerns\ReadsInboxWithSummary;
use InertiaUI\Notifications\Concerns\RecordsNotifications;
use InertiaUI\Notifications\Concerns\ResolvesInboxContext;
use InertiaUI\Notifications\Concerns\RunsBatchActions;
use InertiaUI\Notifications\Concerns\SummarizesInbox;
use InertiaUI\Notifications\Concerns\UpdatesNotificationsInBulk;
use InertiaUI\Notifications\Models\InboxAnnouncement;
use InertiaUI\Notifications\Models\InboxNotification;

/**
 * Reads and writes the notification center of a notifiable model.
 */
class Inbox
{
    use BroadcastsInboxChanges,
        ChangesNotifications,
        CollapsesNotifications,
        FiltersInbox,
        IncludesAnnouncements,
        MutesThreads,
        PaginatesInbox,
        ReadsInboxWithSummary,
        RecordsNotifications,
        ResolvesInboxContext,
        RunsBatchActions,
        SummarizesInbox,
        UpdatesNotificationsInBulk;

    /**
     * The name of the notification center's index route.
     */
    public const string ROUTE = 'inertia-notifications.index';

    /**
     * The built-in filters of the notification list.
     */
    public const array FILTERS = ['all', 'unread', 'snoozed', 'archived'];

    /**
     * The actions on notifications that the `inbox.actions` config may offer users. Reading is always offered.
     *
     * @var list<'snooze'|'archive'|'mute'|'delete'>
     */
    public const array ACTIONS = ['snooze', 'archive', 'mute', 'delete'];

    /**
     * The actions that may run on the notifications and announcements that the user selected.
     *
     * @var list<'read'|'unread'|'seen'|'archive'|'unarchive'|'snooze'|'unsnooze'|'delete'>
     */
    protected const array BATCH_ACTIONS = [
        'read',
        'unread',
        'seen',
        'archive',
        'unarchive',
        'snooze',
        'unsnooze',
        'delete',
    ];

    /**
     * Flush the context resolver.
     *
     * The service provider calls this for each new application, so tests do not share it.
     */
    public static function flushState(): void
    {
        static::$contextResolver = null;
    }

    /**
     * Get the class name of the notification model.
     *
     * @return class-string<InboxNotification>
     */
    public static function model(): string
    {
        /** @var class-string<InboxNotification> */
        return config('inertia-notifications.inbox.model', InboxNotification::class);
    }

    /**
     * Get the actions on notifications that the application offers its users, from the `inbox.actions` config.
     *
     * @return list<'snooze'|'archive'|'mute'|'delete'>
     */
    public static function actions(): array
    {
        $actions = (array) config('inertia-notifications.inbox.actions', ['snooze', 'archive', 'mute']);

        return collect(self::ACTIONS)
            ->filter(fn (string $action): bool => in_array($action, $actions, true))
            ->values()
            ->all();
    }

    /**
     * Determine if users may select notifications in the panel, to change them together, from the
     * `inbox.selectable` config.
     */
    public static function selectable(): bool
    {
        return (bool) config('inertia-notifications.inbox.selectable', true);
    }

    /**
     * Determine if the application offers its users the given action on notifications.
     *
     * @param  'snooze'|'archive'|'mute'|'delete'  $action
     */
    public static function allows(string $action): bool
    {
        return in_array($action, self::actions(), true);
    }

    /**
     * Determine if the notifications that the notification center stores are broadcast to the user's open pages.
     */
    public static function broadcastsNotifications(): bool
    {
        return (bool) config('inertia-notifications.inbox.broadcast_notifications', false);
    }

    /**
     * Determine if published announcements are broadcast to every signed-in browser.
     */
    public static function broadcastsAnnouncements(): bool
    {
        return (bool) config('inertia-notifications.inbox.broadcast_announcements', false);
    }

    /**
     * Get a copy of the given time in the application's timezone.
     *
     * The queries compare stored times with now() in the application's timezone, while Eloquent stores
     * a date in the timezone it has, such as the user's timezone or the UTC of the browser's times.
     */
    public static function inApplicationTimezone(DateTimeInterface $time): Carbon
    {
        return Carbon::instance($time)->setTimezone(date_default_timezone_get());
    }

    /**
     * Get a new query builder for the notifications of the given notifiable model.
     *
     * @return Builder<InboxNotification>
     */
    public static function query(Model $notifiable): Builder
    {
        return self::model()::query()->whereMorphedTo('notifiable', $notifiable);
    }

    /**
     * Get a new query builder for the notifications of the given notifiable model in the given context.
     *
     * Without a context, the query covers every notification of the notifiable model. With a context, it
     * leaves out the notifications of other contexts.
     *
     * @return Builder<InboxNotification>
     */
    public static function queryInContext(Model $notifiable, ?Model $context): Builder
    {
        $query = self::query($notifiable);

        return $context instanceof Model ? $query->inContext($context) : $query;
    }

    /**
     * Find the given notification of the notifiable model, or the given announcement that it sees.
     *
     * The notification is found in every context, and the announcement only in the current context.
     *
     * @throws ModelNotFoundException
     */
    public static function find(Model $notifiable, string $id): InboxNotification|InboxAnnouncement
    {
        return self::query($notifiable)->find($id)
            ?? InboxAnnouncement::inboxQuery($notifiable, self::context())->findOrFail($id);
    }
}
