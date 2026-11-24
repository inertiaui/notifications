<?php

namespace InertiaUI\Notifications\Concerns;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Arr;
use InertiaUI\Notifications\Events\InboxChanged;
use InertiaUI\Notifications\Models\InboxAnnouncement;
use InertiaUI\Notifications\Models\InboxNotification;
use InertiaUI\Notifications\NotificationPreferences;
use ReflectionMethod;

/**
 * Broadcasts the changes of the notification center to the user's other browser sessions.
 *
 * @phpstan-import-type InboxChange from InboxChanged
 * @phpstan-import-type InboxSummary from InboxChanged
 */
trait BroadcastsInboxChanges
{
    /**
     * Get the private channel that receives the notifiable model's broadcast notifications.
     *
     * This is the same channel that Laravel's `broadcast` channel uses. It is null when
     * `receivesBroadcastNotificationsOn()` needs the notification to decide.
     */
    public static function channel(Model $notifiable): ?string
    {
        if (! method_exists($notifiable, 'receivesBroadcastNotificationsOn')) {
            return str_replace('\\', '.', $notifiable::class).'.'.$notifiable->getKey();
        }

        if (
            (new ReflectionMethod($notifiable, 'receivesBroadcastNotificationsOn'))
                ->getNumberOfRequiredParameters() > 0
        ) {
            return null;
        }

        $channels = Arr::wrap($notifiable->receivesBroadcastNotificationsOn());
        $channel = Arr::first($channels);

        return is_string($channel) && $channel !== '' ? $channel : null;
    }

    /**
     * Broadcast the given change to the user's other browser sessions.
     *
     * The change is only broadcast when `inbox.broadcast_changes` is enabled. The session that made the
     * change is left out when its request sent the `X-Socket-ID` header.
     *
     * @param  InboxChange  $change
     * @param  InboxSummary|null  $summary
     */
    protected static function broadcastChange(Model $notifiable, array $change, ?array $summary = null): void
    {
        $channel = self::changesChannel($notifiable);

        if ($channel !== null) {
            broadcast(new InboxChanged($channel, $change, $summary ?? self::summary($notifiable)))->toOthers();
        }
    }

    /**
     * Broadcast the given change with a new summary of the notifiable model's inbox, and get that summary.
     *
     * The session that made the change receives the summary in its response, and the user's other sessions
     * receive it with the change.
     *
     * @param  InboxChange  $change
     * @return InboxSummary
     */
    public static function broadcastChangeWithSummary(Model $notifiable, array $change): array
    {
        $summary = self::summary($notifiable);

        self::broadcastChange($notifiable, $change, $summary);

        return $summary;
    }

    /**
     * Get the channel that the changes of the notifiable model's notifications are broadcast on.
     *
     * The channel is null unless `inbox.broadcast_changes` is enabled.
     */
    protected static function changesChannel(Model $notifiable): ?string
    {
        return config('inertia-notifications.inbox.broadcast_changes') ? self::channel($notifiable) : null;
    }

    /**
     * Broadcast a change that the application made to every session of the notification's notifiable model.
     *
     * The session that made the request also receives it, since the application made the change, not the
     * browser.
     *
     * @param  InboxChange  $change
     */
    public static function broadcastToEverySession(InboxNotification $notification, array $change): void
    {
        $notifiable = $notification->notifiable;

        if (! $notifiable instanceof Model) {
            return;
        }

        $channel = self::changesChannel($notifiable);

        if ($channel === null) {
            return;
        }

        broadcast(new InboxChanged($channel, $change, self::summaryOf($notification)));
    }

    /**
     * Get the change of the given notification or announcement.
     *
     * The change has the shape that `InboxChanged` sends.
     *
     * @return array{
     *     kind: 'item',
     *     id: string,
     *     readAt: string|null,
     *     seenAt: string|null,
     *     archivedAt: string|null,
     *     snoozedUntil: string|null,
     *     result: string|null,
     * }
     */
    public static function itemChange(InboxNotification|InboxAnnouncement $notification): array
    {
        $item = $notification->toInboxArray();

        return [
            'kind' => 'item',
            'id' => $notification->id,
            'readAt' => $item['readAt'],
            'seenAt' => $item['seenAt'],
            'archivedAt' => $item['archivedAt'],
            'snoozedUntil' => $item['snoozedUntil'],
            'result' => $item['result'],
        ];
    }

    /**
     * Get the change of the notifiable model's pause, with the time that its notifications are paused until.
     *
     * The change has the shape that `InboxChanged` sends, and its time is null while they are not paused.
     *
     * @return array{kind: 'pause', until: string|null}
     */
    public static function pauseChange(Model $notifiable): array
    {
        return ['kind' => 'pause', 'until' => NotificationPreferences::pausedUntil($notifiable)?->toIso8601String()];
    }
}
