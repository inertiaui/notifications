<?php

namespace InertiaUI\Notifications\Concerns;

use Closure;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use InertiaUI\Notifications\InboxMessage;
use InertiaUI\Notifications\Models\InboxNotification;

/**
 * Changes stored notifications for the application: their read state, results, and messages, and brings back the
 * snoozed notifications whose time has come. Every session of the notifiable model receives the change.
 */
trait ChangesNotifications
{
    /**
     * Mark the given notification as read, such as when the user opens its link from a push or a mail.
     *
     * A notification that was read already stays as it is, and its sessions receive no change.
     */
    public static function markAsRead(InboxNotification $notification): void
    {
        if ($notification->isRead()) {
            return;
        }

        $notification->markAsRead();

        self::broadcastToEverySession($notification, self::itemChange($notification));
    }

    /**
     * Bring back the snoozed notifications whose time has come, as new notifications at the top of the list, and
     * get how many came back.
     *
     * The `inertia-notifications:unsnooze` command runs this every minute once you schedule it.
     */
    public static function unsnoozeDue(): int
    {
        $count = 0;

        $notifications = self::model()::query()
            ->dueToUnsnooze()
            ->with(['notifiable', 'context'])
            ->lazyById(200);

        foreach ($notifications as $notification) {
            if (! $notification->unsnoozeAsNew()) {
                continue;
            }

            $count++;

            self::broadcastUnsnoozed($notification);
        }

        return $count;
    }

    /**
     * Broadcast the given notification that came back to every session of its notifiable model.
     */
    protected static function broadcastUnsnoozed(InboxNotification $notification): void
    {
        $notifiable = $notification->notifiable;

        // Serializing the notification also reads whether its thread is muted, so we will only serialize
        // it while the changes of the notifiable model are broadcast, instead of for every notification.
        if (! $notifiable instanceof Model || self::changesChannel($notifiable) === null) {
            return;
        }

        self::broadcastToEverySession($notification, [
            ...self::itemChange($notification),
            'item' => $notification->toInboxArray(),
        ]);
    }

    /**
     * Complete the given notification, or the notifications with the given `once()` key, with the given result.
     *
     * The notifications show the result, such as "Approved by Sophie", in place of their actions. Without a
     * notifiable model, every notification with the key changes, such as the request that each admin got.
     *
     * @param  array<string, mixed>  $replace
     */
    public static function complete(
        InboxNotification|string $notification,
        string $result,
        array $replace = [],
        ?Model $notifiable = null,
    ): void {
        foreach (self::resolveNotifications($notification, $notifiable) as $target) {
            $target->complete($result, $replace);

            self::broadcastToEverySession($target, self::itemChange($target));
        }
    }

    /**
     * Remove the result of the given notification, or of the notifications with the given `once()` key.
     *
     * The notifications show their actions again.
     */
    public static function revertResult(InboxNotification|string $notification, ?Model $notifiable = null): void
    {
        foreach (self::resolveNotifications($notification, $notifiable) as $target) {
            $target->revertResult();

            self::broadcastToEverySession($target, self::itemChange($target));
        }
    }

    /**
     * Replace the message of the given notification, or of the notifications with the given `once()` key.
     *
     * The notifications keep their state, such as read or archived, and their category, group, and context.
     * Pass a closure to build the message for each notifiable model. Open panels show the new message, and
     * open toasts of the notifications change with it.
     *
     * @param  InboxMessage|(Closure(Model): InboxMessage)  $message
     */
    public static function update(
        InboxNotification|string $notification,
        InboxMessage|Closure $message,
        ?Model $notifiable = null,
    ): void {
        foreach (self::resolveNotifications($notification, $notifiable) as $target) {
            $target->revision = self::revision();

            $target->replaceMessage($message instanceof Closure ? $message($target->notifiable) : $message);

            self::broadcastToEverySession($target, ['kind' => 'update', 'item' => $target->toInboxArray()]);
        }
    }

    /**
     * Delete the given notification, or the notifications with the given `once()` key, for good.
     *
     * Open panels leave the notifications out and close their toasts. The channels that already sent the
     * notification, such as `mail`, cannot take it back, and those that wait with `unlessReadWithin()`
     * no longer send it.
     */
    public static function retract(InboxNotification|string $notification, ?Model $notifiable = null): void
    {
        foreach (self::resolveNotifications($notification, $notifiable) as $target) {
            $target->delete();

            self::broadcastToEverySession($target, ['kind' => 'delete', 'ids' => [$target->id]]);
        }
    }

    /**
     * Get the given notification, or the notifications with the given `once()` key.
     *
     * The key finds the notifications of every notifiable model, or only those of the given one.
     *
     * @return Collection<int, InboxNotification>
     */
    protected static function resolveNotifications(
        InboxNotification|string $notification,
        ?Model $notifiable,
    ): Collection {
        if ($notification instanceof InboxNotification) {
            return new Collection([$notification]);
        }

        $query = $notifiable instanceof Model ? self::query($notifiable) : self::model()::query();

        return $query->where('unique_key', $notification)
            ->with(['notifiable', 'context'])
            ->get();
    }
}
