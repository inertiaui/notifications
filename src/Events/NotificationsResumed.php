<?php

namespace InertiaUI\Notifications\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Queue\SerializesModels;

/**
 * Tells the application that a notifiable model resumed its paused notifications before the pause ended.
 * Dispatched by `NotificationPreferences::resume()`, which the resume endpoint calls.
 */
class NotificationsResumed implements ShouldDispatchAfterCommit
{
    use SerializesModels;

    /**
     * Create a new event instance.
     *
     * @param  Model  $notifiable  The model that resumed its notifications, such as the user.
     */
    public function __construct(
        public Model $notifiable,
    ) {}
}
