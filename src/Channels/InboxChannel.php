<?php

namespace InertiaUI\Notifications\Channels;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Notifications\Notification;
use InertiaUI\Notifications\Inbox;
use InertiaUI\Notifications\InboxMessage;
use InertiaUI\Notifications\Models\InboxNotification;
use InertiaUI\Notifications\Push;
use LogicException;

/**
 * The `inbox` notification channel: stores the notification in the notification center, with the
 * ID that Laravel gives every channel of the same notification, and pushes the stored notification
 * to the devices of the notifiable model when its inbox message asks for a push.
 */
class InboxChannel
{
    /**
     * The names that a notification may give the channel in its `via()` method.
     *
     * @var list<string>
     */
    public const array NAMES = ['inbox', self::class];

    /**
     * Send the given notification.
     *
     * Only this channel pushes the notification, so a user who doesn't receive the category here gets no push either.
     */
    public function send(object $notifiable, Notification $notification): ?InboxNotification
    {
        if (! $notifiable instanceof Model) {
            return null;
        }

        $message = self::message($notifiable, $notification);

        if (! $message instanceof InboxMessage) {
            $class = $notification::class;

            throw new LogicException(
                "Notification [{$class}] needs a toInbox method that returns an InboxMessage.",
            );
        }

        $stored = self::record($notifiable, $notification, $message);

        Push::dispatchFor($notifiable, $notification, $stored, $message);

        return $stored;
    }

    /**
     * Store the given notification with its inbox message once.
     *
     * The `inbox` channel stores the notification, and so do the delivery rules that read its row.
     */
    public static function record(
        Model $notifiable,
        Notification $notification,
        InboxMessage $message,
    ): InboxNotification {
        return Inbox::record($notifiable, (string) $notification->id, self::type($notifiable, $notification), $message);
    }

    /**
     * Get the inbox message of the given notification, which its `toInbox()` method returns.
     *
     * Returns null for a notification without one.
     */
    public static function message(object $notifiable, object $notification): ?InboxMessage
    {
        if (! method_exists($notification, 'toInbox')) {
            return null;
        }

        $message = $notification->toInbox($notifiable);

        return $message instanceof InboxMessage ? $message : null;
    }

    /**
     * Get the type of the given notification.
     *
     * The type comes from the notification's `inboxType()` or `databaseType()` method, or else its class name.
     */
    public static function type(object $notifiable, Notification $notification): string
    {
        foreach (['inboxType', 'databaseType'] as $method) {
            if (method_exists($notification, $method)) {
                return (string) $notification->{$method}($notifiable);
            }
        }

        return $notification::class;
    }
}
