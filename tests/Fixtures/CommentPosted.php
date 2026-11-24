<?php

namespace InertiaUI\Notifications\Tests\Fixtures;

use Illuminate\Notifications\Notification;

class CommentPosted extends Notification
{
    /**
     * Get the notification's delivery channels.
     *
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * Get the array representation of the notification.
     *
     * @return array<string, string>
     */
    public function toArray(object $notifiable): array
    {
        return ['message' => 'Sophie commented on your post', 'action_url' => '/posts/1#comment-9'];
    }
}
