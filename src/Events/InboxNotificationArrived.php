<?php

namespace InertiaUI\Notifications\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;

/**
 * Tells the user's open pages that the notification center stored a notification, so they show it right away.
 * Broadcast on the channel that receives the user's notifications, when `inbox.broadcast_notifications` is
 * enabled, and only once the database transaction that stored the notification commits.
 *
 * A notification that collapsed into one the user already has also sends the counts after it, so the browser
 * counts the notification once instead of adding it to the count of the one it replaces.
 *
 * @phpstan-import-type InboxSummary from InboxChanged
 */
class InboxNotificationArrived implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    /**
     * Create a new event instance.
     *
     * @param  string  $channel  The channel that receives the user's notifications.
     * @param  array<string, mixed>  $item  The notification as the frontend receives it.
     * @param  InboxSummary|null  $counts  The counts after a notification that collapsed, or null for a new row.
     */
    public function __construct(
        public string $channel,
        public array $item,
        public ?array $counts = null,
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
        return 'inertiaui.inbox.arrived';
    }

    /**
     * Get the data to broadcast.
     *
     * @return array{item: array<string, mixed>, counts?: InboxSummary}
     */
    public function broadcastWith(): array
    {
        if ($this->counts === null) {
            return ['item' => $this->item];
        }

        return ['item' => $this->item, 'counts' => $this->counts];
    }
}
