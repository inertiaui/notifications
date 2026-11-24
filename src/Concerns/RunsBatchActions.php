<?php

namespace InertiaUI\Notifications\Concerns;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use InertiaUI\Notifications\Models\InboxAnnouncement;
use InertiaUI\Notifications\Models\InboxNotification;
use InvalidArgumentException;

/**
 * Runs the batch actions of the notification center, such as reading or deleting the notifications the user selected.
 */
trait RunsBatchActions
{
    /**
     * Get the actions that may run on the notifications and announcements that the user selected.
     *
     * @return list<'read'|'unread'|'seen'|'archive'|'unarchive'|'snooze'|'unsnooze'|'delete'>
     */
    public static function batchActions(): array
    {
        return self::BATCH_ACTIONS;
    }

    /**
     * Determine if the `inbox.actions` config offers what the given batch action needs.
     *
     * Archiving and unarchiving need `archive`, snoozing and unsnoozing need `snooze`, and deleting needs
     * `delete`. The other actions are always offered, and the request's validation refuses the names of
     * actions that don't exist.
     */
    public static function allowsBatchAction(string $action): bool
    {
        return match ($action) {
            'archive', 'unarchive' => self::allows('archive'),
            'snooze', 'unsnooze' => self::allows('snooze'),
            'delete' => self::allows('delete'),
            default => true,
        };
    }

    /**
     * Run the given action on the notifiable model's notifications and announcements with the given IDs.
     *
     * Only the items of the current context change. The returned change lists the IDs of those that the
     * action ran on, so the browser leaves the others as they were. Snoozing needs the time to snooze
     * the items until, which the change returns too.
     *
     * @param  'read'|'unread'|'seen'|'archive'|'unarchive'|'snooze'|'unsnooze'|'delete'  $action
     * @param  list<string>  $ids
     * @return array{kind: 'delete', ids: list<string>}|array{
     *     kind: 'items',
     *     action: 'read'|'unread'|'seen'|'archive'|'unarchive'|'snooze'|'unsnooze',
     *     ids: list<string>,
     *     at: string,
     *     until?: string,
     * }
     *
     * @throws InvalidArgumentException
     */
    public static function runBatch(
        Model $notifiable,
        string $action,
        array $ids,
        ?CarbonInterface $until = null,
    ): array {
        if ($action === 'snooze' && ! $until instanceof CarbonInterface) {
            throw new InvalidArgumentException('Snoozing notifications needs the time to snooze them until.');
        }

        $context = self::context();
        $items = self::queryInContext($notifiable, $context)
            ->whereKey($ids)
            ->get()
            ->concat(InboxAnnouncement::inboxQuery($notifiable, $context)->whereKey($ids)->get());

        foreach ($items as $item) {
            self::runBatchAction($item, $action, $until);
        }

        $changed = $items->modelKeys();

        if ($action === 'delete') {
            return ['kind' => 'delete', 'ids' => $changed];
        }

        return [
            'kind' => 'items',
            'action' => $action,
            'ids' => $changed,
            'at' => now()->toIso8601String(),
            ...($action === 'snooze' ? ['until' => $until->toIso8601String()] : []),
        ];
    }

    /**
     * Delete the given notification for good, or remove the given announcement from the notification center.
     *
     * An announcement only leaves the notification center of the notifiable model that it was found for.
     */
    public static function delete(InboxNotification|InboxAnnouncement $item): void
    {
        self::runBatchAction($item, 'delete');
    }

    /**
     * Run the given batch action on the given notification or announcement.
     *
     * Deleting an announcement only removes it from the notifiable model's notification center.
     *
     * @throws InvalidArgumentException
     */
    protected static function runBatchAction(
        InboxNotification|InboxAnnouncement $item,
        string $action,
        ?CarbonInterface $until = null,
    ): void {
        if ($action === 'snooze' && ! $until instanceof CarbonInterface) {
            throw new InvalidArgumentException('Snoozing notifications needs the time to snooze them until.');
        }

        if ($action === 'delete' && $item instanceof InboxAnnouncement) {
            $item->dismiss();

            return;
        }

        match ($action) {
            'read' => $item->markAsRead(),
            'unread' => $item->markAsUnread(),
            'seen' => $item->markAsSeen(),
            'archive' => $item->archive(),
            'unarchive' => $item->unarchive(),
            'snooze' => $item->snooze($until),
            'unsnooze' => $item->unsnooze(),
            'delete' => $item->delete(),
            default => throw new InvalidArgumentException("The batch action [{$action}] does not exist."),
        };
    }
}
