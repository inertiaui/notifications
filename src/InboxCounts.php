<?php

namespace InertiaUI\Notifications;

use Illuminate\Contracts\Support\Arrayable;

/**
 * The unread and unseen counts of a notifiable model's inbox. Return it from a controller and it
 * becomes JSON with the `unread` and `unseen` keys.
 *
 * @implements Arrayable<string, int>
 */
class InboxCounts implements Arrayable
{
    /**
     * Create a new inbox counts instance.
     *
     * @param  int  $unread  The number of unread notifications and announcements.
     * @param  int  $unseen  The number of unseen notifications and announcements.
     */
    public function __construct(
        public readonly int $unread,
        public readonly int $unseen,
    ) {}

    /**
     * Get the instance as an array.
     *
     * @return array{unread: int, unseen: int}
     */
    public function toArray(): array
    {
        return [
            'unread' => $this->unread,
            'unseen' => $this->unseen,
        ];
    }
}
