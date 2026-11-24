<?php

namespace InertiaUI\Notifications;

use Carbon\CarbonInterface;

/**
 * The end of a notifiable model's pause and its notification hours in its timezone, read together from one
 * query of its preferences by `NotificationPreferences::doNotDisturb()`, so the checks that share it agree.
 * It holds no clock of its own: each check is made at the time it is given.
 *
 * @internal
 */
class DoNotDisturbSchedule
{
    /**
     * Create a new do not disturb schedule instance.
     *
     * @param  CarbonInterface|null  $pausedUntil  The saved end of the pause, also once it has passed.
     * @param  NotificationHours|null  $notificationHours  The notification hours while they are on and have a range.
     * @param  string|null  $timezone  The timezone that the notification hours follow, set along with them.
     */
    public function __construct(
        public readonly ?CarbonInterface $pausedUntil = null,
        public readonly ?NotificationHours $notificationHours = null,
        public readonly ?string $timezone = null,
    ) {}

    /**
     * Determine if notifications do not disturb the notifiable model at the given time.
     */
    public function active(CarbonInterface $at): bool
    {
        return $this->paused($at) || ! $this->withinNotificationHours($at);
    }

    /**
     * Get the given time when notifications reach the notifiable model at that time, or else the end of its
     * pause, or the start of the notification hours that follow, in the application's timezone.
     */
    public function endsAt(CarbonInterface $time): CarbonInterface
    {
        if ($this->paused($time)) {
            return $this->nextNotificationHours($this->pausedUntil);
        }

        return $this->nextNotificationHours($time);
    }

    /**
     * Determine if the given time falls within the notification hours, which it always does without them.
     */
    public function withinNotificationHours(CarbonInterface $at): bool
    {
        if (! $this->notificationHours instanceof NotificationHours) {
            return true;
        }

        return $this->notificationHours->includes($at, $this->timezone);
    }

    /**
     * Get the given time when it falls within the notification hours, or else the start of their next range,
     * in the application's timezone.
     */
    public function nextNotificationHours(CarbonInterface $time): CarbonInterface
    {
        if ($this->withinNotificationHours($time)) {
            return $time->copy()->setTimezone(date_default_timezone_get());
        }

        return $this->notificationHours
            ->nextStart($time, $this->timezone)
            ->setTimezone(date_default_timezone_get());
    }

    /**
     * Determine if the notifiable model paused its notifications at the given time.
     */
    protected function paused(CarbonInterface $at): bool
    {
        return $this->pausedUntil instanceof CarbonInterface && $this->pausedUntil->greaterThan($at);
    }
}
