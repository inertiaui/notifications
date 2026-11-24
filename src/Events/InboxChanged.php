<?php

namespace InertiaUI\Notifications\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;

/**
 * Tells the user's other browser sessions that the notification center changed, such as a
 * notification marked as read on another device. Broadcast on the channel that receives the
 * user's notifications, when `inbox.broadcast_changes` is enabled.
 *
 * The change has the shapes of `InboxChange` in `js/inbox.ts`, which drops a shape it does not know. An
 * `item` change holds the state of one notification, and the unsnooze command adds the whole notification
 * under `item`. The `read`, `seen`, and `archive` changes cover the notifications created before `before`,
 * and those created at that time whose IDs are in `ids` (every one when `ids` is null), limited to the
 * `category` unless it is null. A `delete` change lists the IDs of the deleted notifications, an `update`
 * change holds the notification with its new message, an `items` change lists the notifications that its
 * `action` changed at the `at` time, a `mute` change tells whether the user muted the thread of `group`, and a
 * `pause` change holds the time that the user paused their notifications `until`, or null once they resumed.
 *
 * The counts hold a `revision` that orders broadcasts that arrive out of order, and a `context` that names
 * the context they cover when the application resolves contexts.
 *
 * @phpstan-type InboxChange array{
 *     kind: 'item',
 *     id: string,
 *     readAt: string|null,
 *     seenAt: string|null,
 *     archivedAt: string|null,
 *     snoozedUntil: string|null,
 *     result: string|null,
 *     item?: array<string, mixed>,
 * }|array{
 *     kind: 'read'|'seen',
 *     before: string,
 *     ids: list<string>|null,
 *     category: string|null,
 * }|array{
 *     kind: 'archive',
 *     before: string,
 *     ids: list<string>|null,
 *     category: string|null,
 *     onlyRead: bool,
 * }|array{
 *     kind: 'delete',
 *     ids: list<string>,
 * }|array{
 *     kind: 'update',
 *     item: array<string, mixed>,
 * }|array{
 *     kind: 'items',
 *     action: 'read'|'unread'|'seen'|'archive'|'unarchive'|'snooze'|'unsnooze',
 *     ids: list<string>,
 *     at: string,
 *     until?: string,
 * }|array{
 *     kind: 'mute',
 *     group: string,
 *     muted: bool,
 * }|array{
 *     kind: 'pause',
 *     until: string|null,
 * }
 * @phpstan-type InboxSummary array{
 *     unread: int,
 *     unseen: int,
 *     categories: array<string, int>,
 *     latest: string|null,
 *     latestIds: list<string>,
 *     revision: int,
 *     context?: string|null,
 * }
 */
class InboxChanged implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use InteractsWithSockets;

    /**
     * Create a new event instance.
     *
     * @param  string  $channel  The channel that receives the user's notifications.
     * @param  InboxChange  $change  The change that the receiving browser sessions apply.
     * @param  InboxSummary  $counts  The counts after the change.
     */
    public function __construct(
        public string $channel,
        public array $change,
        public array $counts,
    ) {}

    /**
     * Get the channels the event should broadcast on.
     *
     * @return list<PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [new PrivateChannel($this->channel)];
    }

    /**
     * Get the broadcast event name.
     */
    public function broadcastAs(): string
    {
        return 'inertiaui.inbox.changed';
    }

    /**
     * Get the data to broadcast.
     *
     * @return array{change: InboxChange, counts: InboxSummary}
     */
    public function broadcastWith(): array
    {
        return ['change' => $this->change, 'counts' => $this->counts];
    }
}
