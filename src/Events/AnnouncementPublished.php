<?php

namespace InertiaUI\Notifications\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;

/**
 * Tells every signed-in browser that an announcement was published, when `inbox.broadcast_announcements` is
 * enabled. The event holds no content, since only the server knows who is in the audience: each browser
 * requests the announcement and shows it when the server finds it for the signed-in user.
 */
class AnnouncementPublished implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    /**
     * The private channel that every signed-in user may listen on.
     */
    public const string CHANNEL = 'inertiaui.announcements';

    /**
     * Create a new event instance.
     *
     * @param  string  $id  The ID of the announcement.
     * @param  string|null  $context  The opaque key of the announcement's context, so browsers in another
     *                                context do not request it, or null for an announcement without one.
     */
    public function __construct(
        public string $id,
        public ?string $context = null,
    ) {}

    /**
     * Get the channels the event should broadcast on.
     *
     * @return list<PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [new PrivateChannel(self::CHANNEL)];
    }

    /**
     * Get the broadcast event name.
     */
    public function broadcastAs(): string
    {
        return 'inertiaui.announcement.published';
    }

    /**
     * Get the data to broadcast.
     *
     * @return array{id: string, context: string|null}
     */
    public function broadcastWith(): array
    {
        return ['id' => $this->id, 'context' => $this->context];
    }
}
