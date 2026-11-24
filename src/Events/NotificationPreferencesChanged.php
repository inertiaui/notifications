<?php

namespace InertiaUI\Notifications\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Queue\SerializesModels;
use InertiaUI\Notifications\NotificationHours;

/**
 * Tells the application that a notifiable model changed its notification preferences, with the choices
 * that changed. Dispatched by `NotificationPreferences::update()`, which the preferences endpoint calls.
 */
class NotificationPreferencesChanged implements ShouldDispatchAfterCommit
{
    use SerializesModels;

    /**
     * Create a new event instance.
     *
     * @param  Model  $notifiable  The model whose preferences changed, such as the user.
     * @param  array<string, array<string, bool>>  $categories  The new choices that changed, by category and channel.
     * @param  array<string, bool>  $channels  The new switches for every category that changed, by channel.
     * @param  array<string, string>  $frequencies  The new digest frequencies that changed, by category.
     * @param  NotificationHours|null  $notificationHours  The new notification hours, when they changed.
     */
    public function __construct(
        public Model $notifiable,
        public array $categories = [],
        public array $channels = [],
        public array $frequencies = [],
        public ?NotificationHours $notificationHours = null,
    ) {}
}
