<?php

namespace InertiaUI\Notifications\Listeners;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Notifications\Events\NotificationSending;
use InertiaUI\Notifications\Channels\InboxChannel;
use InertiaUI\Notifications\Inbox;
use InertiaUI\Notifications\InboxMessage;
use InertiaUI\Notifications\Models\InboxNotification;
use InertiaUI\Notifications\NotificationPreferences;
use LogicException;

/**
 * Skips the channels that the notification's inbox message holds back: every channel of a notification
 * in a thread that the notifiable model muted, every channel of a notification whose `once()` key another
 * notification already has, and the channels of `unlessReadWithin()` once the notification has been read
 * or removed.
 */
class ApplyDeliveryRules
{
    /**
     * Handle the event.
     *
     * The listener returns `false` to skip the channel, and `null` otherwise. Laravel stops asking listeners
     * at the first answer that is not `null`, so `true` would skip the application's own listeners.
     */
    public function handle(NotificationSending $event): ?false
    {
        $message = $this->message($event);

        if (! $message instanceof InboxMessage) {
            return null;
        }

        if ($this->threadIsMuted($event, $message)) {
            return false;
        }

        $waits = $message->getReadDelay($event->channel) !== null;

        if ($waits) {
            $this->ensureChannelCanWait($event, $message);
        }

        $stored = $this->findOrRecord($event, $message, $waits);

        if ($waits && $this->removedOrReadWhileWaiting($event, $stored)) {
            return false;
        }

        if ($this->keyBelongsToAnotherNotification($event, $message, $stored)) {
            return false;
        }

        return null;
    }

    /**
     * Get the inbox message of the notification, or null for a notifiable that is not a model.
     */
    protected function message(NotificationSending $event): ?InboxMessage
    {
        if (! $event->notifiable instanceof Model) {
            return null;
        }

        return InboxChannel::message($event->notifiable, $event->notification);
    }

    /**
     * Determine if the notification was removed or read while the channel waited.
     *
     * A waiting channel skips a notification that was removed while it waited, such as by `Inbox::retract()`.
     * A notification that the user turned off the notification center for was never stored, though, so a
     * missing row only means a removed notification when the notification center was meant to store it.
     */
    protected function removedOrReadWhileWaiting(NotificationSending $event, ?InboxNotification $stored): bool
    {
        if ($stored instanceof InboxNotification) {
            return $stored->isRead();
        }

        return $this->goesToInbox($event);
    }

    /**
     * Determine if the notification center is meant to store the notification of the waiting channel.
     *
     * The trait's `inboxDelay()` records it when the notification is queued, which a waiting channel requires.
     */
    protected function goesToInbox(NotificationSending $event): bool
    {
        return $event->notification->inertiaUiGoesToInbox ?? false;
    }

    /**
     * Determine if the notifiable model muted the thread of the message's group key.
     *
     * A notification that mentions the notifiable model, or that belongs to a locked category of the
     * preferences, reaches it anyway. As in the preferences, the notification's `notificationCategory()`
     * decides the category before its inbox message does. While the `inbox.actions` config leaves out
     * muting, the mutes are kept but ignored, so they apply again once muting is offered again.
     */
    protected function threadIsMuted(NotificationSending $event, InboxMessage $message): bool
    {
        if ($message->getGroup() === null || $message->isMention() || ! Inbox::allows('mute')) {
            return false;
        }

        $category = NotificationPreferences::category($event->notifiable, $event->notification);

        if ($category !== null && (NotificationPreferences::categories()[$category]['locked'] ?? false)) {
            return false;
        }

        return Inbox::isMuted($event->notifiable, $message->getGroup());
    }

    /**
     * Find the stored row of the notification that the checks read, or store the notification to get it.
     *
     * A waiting channel reads the row that another channel stored and never stores the notification, so a
     * notification that was removed while the channel waited is not stored again through its `once()` key.
     * Another channel stores the notification when the preferences allow it, which we will only read
     * when the key of `once()` needs the row.
     */
    protected function findOrRecord(NotificationSending $event, InboxMessage $message, bool $waits): ?InboxNotification
    {
        $id = (string) $event->notification->id;

        if ($waits) {
            return Inbox::findStored($event->notifiable, $id, $message);
        }

        if ($message->getUniqueKey() === null) {
            return null;
        }

        if (! NotificationPreferences::allows($event->notifiable, $event->notification, 'inbox')) {
            return null;
        }

        return InboxChannel::record($event->notifiable, $event->notification, $message);
    }

    /**
     * Determine if another notification to the notifiable model already has the key of the message's `once()`.
     *
     * The first channel that stores the notification takes the key, so the key belongs to the notification
     * whose channel ran first. When the user turned off the notification center for the category, nothing
     * is stored, and only a key that an earlier notification stored holds the channel back.
     */
    protected function keyBelongsToAnotherNotification(
        NotificationSending $event,
        InboxMessage $message,
        ?InboxNotification $stored,
    ): bool {
        $key = $message->getUniqueKey();
        $id = (string) $event->notification->id;

        if ($key === null) {
            return false;
        }

        if ($stored instanceof InboxNotification) {
            return $stored->id !== $id;
        }

        return Inbox::query($event->notifiable)
            ->where('unique_key', $key)
            ->whereKeyNot($id)
            ->exists();
    }

    /**
     * Ensure that the queue delays the channel, so the channel waits before the notification is checked, and
     * that another channel stores the notification right away, so the waiting channel finds it.
     *
     * @throws LogicException
     */
    protected function ensureChannelCanWait(NotificationSending $event, InboxMessage $message): void
    {
        $class = $event->notification::class;
        $channel = $event->channel;

        if (! $event->notification instanceof ShouldQueue) {
            throw new LogicException(
                "The notification [{$class}] must implement ShouldQueue to delay its [{$channel}] channel.",
            );
        }

        if (! method_exists($event->notification, 'inboxDelay')) {
            throw new LogicException(
                "The notification [{$class}] must use InteractsWithInbox to delay its [{$channel}] channel.",
            );
        }

        if (! $this->storedRightAway($event, $message)) {
            throw new LogicException(
                "The notification [{$class}] must use the [inbox] channel to delay its [{$channel}] channel.",
            );
        }

        $goesToInbox = $event->notification->inertiaUiGoesToInbox ?? null;

        // The trait's inboxDelay() records on the job of a waiting channel whether the notification center is
        // meant to store the notification. A job without that record did not wait: the notification was sent
        // without the queue, or its own withDelay() method left out the delay of inboxDelay().
        if ($goesToInbox === null) {
            throw new LogicException(
                "The notification [{$class}] must be queued with inboxDelay() to delay its [{$channel}] channel.",
            );
        }
    }

    /**
     * Determine if a channel of the notification's `via()` stores the notification without waiting for a read.
     *
     * A notification without a `via()` method was sent through the channels that the application passed,
     * which we cannot see, so it passes.
     */
    protected function storedRightAway(NotificationSending $event, InboxMessage $message): bool
    {
        if (! method_exists($event->notification, 'via')) {
            return true;
        }

        foreach ((array) $event->notification->via($event->notifiable) as $channel) {
            if (in_array($channel, InboxChannel::NAMES, true) && $message->getReadDelay($channel) === null) {
                return true;
            }
        }

        return false;
    }
}
