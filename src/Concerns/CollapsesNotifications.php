<?php

namespace InertiaUI\Notifications\Concerns;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use InertiaUI\Notifications\InboxMessage;
use InertiaUI\Notifications\Models\InboxNotification;
use LogicException;

/**
 * Collapses the notifications of a group key into one row while its collapse window is open.
 */
trait CollapsesNotifications
{
    /**
     * Collapse the given unsaved notification into the open row of its group key.
     *
     * The row stays open for the minutes of the message that created it, and only holds notifications of the
     * same context that are still in the inbox. Returns null when there is no such row. When another store
     * of the notification already collapsed it into the row, the row is returned unchanged.
     */
    protected static function collapse(
        Model $notifiable,
        InboxNotification $notification,
        InboxMessage $message,
        bool $quiet,
    ): ?InboxNotification {
        $query = self::collapsibleRows($notifiable, $message);

        // We will lock the row while the notification collapses into it, so two notifications that collapse
        // at the same time both count, instead of the second one writing over the actors of the first.
        return $query->getConnection()->transaction(
            function () use ($query, $notifiable, $notification, $message, $quiet): ?InboxNotification {
                $row = $query->lockForUpdate()->first();

                if (! $row instanceof InboxNotification) {
                    return null;
                }

                // Another store of the same notification, such as its other channel, may have collapsed it
                // into the row after we looked for it, so we will not count it again.
                if ($row->includesNotification($notification->id)) {
                    return $row;
                }

                $row->fillCollapsed($notification->id, $notification->type, $message);

                self::addDeliveryFlags($notifiable, $row, $message, $quiet);

                $row->save();

                return $row;
            },
        );
    }

    /**
     * Get a query for the open rows of the message's group key and context, newest window first.
     *
     * @return Builder<InboxNotification>
     */
    protected static function collapsibleRows(Model $notifiable, InboxMessage $message): Builder
    {
        $context = $message->getContext();

        return self::query($notifiable)
            ->active()
            ->where('group_key', $message->getGroup())
            ->where('collapses_until', '>', now())
            ->where('context_type', $context?->getMorphClass())
            ->where('context_id', $context?->getKey())
            ->orderByDesc('collapses_until');
    }

    /**
     * Ensure the given message only collapses with a group key, and without the key of `once()`.
     *
     * @throws LogicException
     */
    protected static function guardCollapse(InboxMessage $message): void
    {
        if ($message->getCollapseMinutes() === null) {
            return;
        }

        if ($message->getGroup() === null) {
            throw new LogicException("The inbox message [{$message->getTitle()}] needs a group key to collapse.");
        }

        if ($message->getUniqueKey() !== null) {
            throw new LogicException("The inbox message [{$message->getTitle()}] cannot collapse and use once().");
        }
    }
}
