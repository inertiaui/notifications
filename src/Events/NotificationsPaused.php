<?php

namespace InertiaUI\Notifications\Events;

use Carbon\CarbonInterface;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Queue\SerializesModels;

/**
 * Tells the application that a notifiable model paused its notifications, or changed the time that they are
 * paused until. Dispatched by `NotificationPreferences::pause()`, which the pause endpoint calls.
 */
class NotificationsPaused implements ShouldDispatchAfterCommit
{
    use SerializesModels;

    /**
     * Create a new event instance.
     *
     * @param  Model  $notifiable  The model that paused its notifications, such as the user.
     * @param  CarbonInterface  $until  The time that the notifications are paused until.
     */
    public function __construct(
        public Model $notifiable,
        public CarbonInterface $until,
    ) {}
}
