<?php

namespace InertiaUI\Notifications\Listeners;

use Illuminate\Notifications\Events\NotificationSending;
use InertiaUI\Notifications\NotificationPreferences;

/**
 * Skips the channels that the notifiable model turned off for the notification's category.
 */
class ApplyNotificationPreferences
{
    /**
     * Handle the event.
     *
     * The listener returns `false` to skip the channel, and `null` otherwise. Laravel stops asking listeners
     * at the first answer that is not `null`, so `true` would skip the application's own listeners.
     */
    public function handle(NotificationSending $event): ?false
    {
        return NotificationPreferences::allows($event->notifiable, $event->notification, $event->channel)
            ? null
            : false;
    }
}
