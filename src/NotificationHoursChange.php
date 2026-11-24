<?php

namespace InertiaUI\Notifications;

/**
 * The changes of a notifiable model's notification hours, given to `NotificationPreferences::update()`.
 * A value that is null stays as it is, and each given day replaces the ranges of that day, so an empty
 * list leaves the day without notification hours.
 */
class NotificationHoursChange
{
    /**
     * Create a new notification hours change instance.
     *
     * @param  bool|null  $enabled  Whether the notification hours are on.
     * @param  array<string, list<string>|null>|null  $days  The new ranges by day, such as `09:00-17:00`.
     */
    public function __construct(
        public readonly ?bool $enabled = null,
        public readonly ?array $days = null,
    ) {}

    /**
     * Determine if the change leaves every value as it is.
     */
    public function isEmpty(): bool
    {
        return $this->enabled === null && ($this->days === null || $this->days === []);
    }
}
