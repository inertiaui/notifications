<?php

namespace InertiaUI\Notifications;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;

/**
 * The times when notifications do not disturb a notifiable model: outside its notification hours, and while it
 * paused its notifications. During those times, the categories of the `preferences` config, except the locked
 * ones, arrive without a toast, sound, or alert, and the channels that digests hold wait until they end.
 */
class DoNotDisturb
{
    /**
     * Determine if notifications do not disturb the notifiable model at the given time, or now.
     *
     * They do outside its notification hours, and while it paused its notifications.
     */
    public static function active(Model $notifiable, ?CarbonInterface $at = null): bool
    {
        return NotificationPreferences::doNotDisturb($notifiable)->active($at ?? now());
    }

    /**
     * Determine if the given category is silent for the notifiable model at the given time, or now.
     *
     * Notification hours and pauses cover the categories of the `preferences` config, except the locked ones.
     */
    public static function silences(Model $notifiable, ?string $category, ?CarbonInterface $at = null): bool
    {
        if ($category === null) {
            return false;
        }

        $definition = NotificationPreferences::categories()[$category] ?? null;

        if ($definition === null || $definition['locked']) {
            return false;
        }

        return self::active($notifiable, $at);
    }

    /**
     * Get the given time when notifications reach the notifiable model at that time, or else the end of its
     * pause, or the start of the notification hours that follow, in the application's timezone.
     */
    public static function endsAt(Model $notifiable, CarbonInterface $time): CarbonInterface
    {
        return NotificationPreferences::doNotDisturb($notifiable)->endsAt($time);
    }
}
