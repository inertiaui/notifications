<?php

namespace InertiaUI\Notifications\Concerns;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use InertiaUI\Notifications\Digest;
use InertiaUI\Notifications\DoNotDisturbSchedule;
use InertiaUI\Notifications\Events\NotificationsPaused;
use InertiaUI\Notifications\Events\NotificationsResumed;
use InertiaUI\Notifications\Inbox;
use InertiaUI\Notifications\NotificationHours;
use InvalidArgumentException;

/**
 * Pauses the notifications of a notifiable model until a given time, resumes them, and reads the end of the
 * pause along with the notification hours.
 */
trait PausesNotifications
{
    /**
     * Determine if the application lets users pause their notifications.
     */
    public static function offersPausing(): bool
    {
        return (bool) config('inertia-notifications.pause.enabled', false);
    }

    /**
     * Get the times that the pause button offers, from the `pause.presets` config: numbers of minutes, and `tomorrow`.
     *
     * @return list<int|'tomorrow'>
     */
    public static function pausePresets(): array
    {
        $configured = (array) config('inertia-notifications.pause.presets', [30, 60, 120, 'tomorrow']);
        $presets = [];

        foreach ($configured as $value) {
            $preset = self::pausePreset($value);

            if ($preset !== false && ! in_array($preset, $presets, true)) {
                $presets[] = $preset;
            }
        }

        return $presets;
    }

    /**
     * Get the pause preset for the given value from the `pause.presets` config.
     *
     * The value is either `tomorrow` or a positive number of minutes. Anything else gives false, so the
     * pause button skips it.
     */
    protected static function pausePreset(mixed $value): int|string|false
    {
        if ($value === 'tomorrow') {
            return $value;
        }

        return filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    }

    /**
     * Pause the notifications of the notifiable model until the given time.
     *
     * While paused, notifications reach it as they do outside its notification hours, and the held notifications
     * wait until the pause ends. The pause is saved while the application does not offer pausing too, but it is
     * ignored until the application does. A `NotificationsPaused` event is dispatched.
     *
     * @throws InvalidArgumentException
     */
    public static function pause(Model $notifiable, CarbonInterface $until): void
    {
        if (! $until->isFuture()) {
            $time = $until->toIso8601String();

            throw new InvalidArgumentException(
                "The time to pause the notifications until [{$time}] must be in the future.",
            );
        }

        self::saveSettings($notifiable, ['paused_until' => $until->copy()->utc()->toIso8601String()]);

        Digest::reschedule($notifiable, doNotDisturbChanged: true);

        event(new NotificationsPaused($notifiable, $until));
    }

    /**
     * Resume the paused notifications of the notifiable model.
     *
     * The held notifications whose time came during the pause are sent with the next digests that are sent.
     * A `NotificationsResumed` event is dispatched, unless the notifications were not paused.
     */
    public static function resume(Model $notifiable): void
    {
        if (! self::currentPause(self::stored($notifiable)->settings) instanceof CarbonInterface) {
            return;
        }

        self::saveSettings($notifiable, ['paused_until' => null]);

        Digest::reschedule($notifiable, doNotDisturbChanged: true);

        event(new NotificationsResumed($notifiable));
    }

    /**
     * Get the time that the notifiable model paused its notifications until, in the application's timezone.
     *
     * The time is null while the notifications are not paused, once the pause has passed, and while the
     * application does not offer pausing.
     */
    public static function pausedUntil(Model $notifiable): ?CarbonInterface
    {
        if (! self::offersPausing()) {
            return null;
        }

        return self::currentPause(self::stored($notifiable)->settings);
    }

    /**
     * Get the end of the notifiable model's pause and its notification hours, from one query of its preferences.
     *
     * The checks of one operation, such as moving the held notifications once the preferences change,
     * should share what this returns, so they agree with each other. The application's timezone resolver
     * only runs while the notification hours apply, and nothing is read while the application offers
     * neither pausing nor the hours.
     *
     * @internal
     */
    public static function doNotDisturb(Model $notifiable): DoNotDisturbSchedule
    {
        if (! self::offersPausing() && ! NotificationHours::offered()) {
            return new DoNotDisturbSchedule;
        }

        $settings = self::stored($notifiable)->settings;
        $pausedUntil = self::offersPausing() ? self::savedPause($settings) : null;
        $notificationHours = self::turnedOnNotificationHours($settings);

        if (! $notificationHours instanceof NotificationHours) {
            return new DoNotDisturbSchedule(pausedUntil: $pausedUntil);
        }

        return new DoNotDisturbSchedule(
            pausedUntil: $pausedUntil,
            notificationHours: $notificationHours,
            timezone: self::resolvedTimezone($notifiable) ?? self::savedTimezone($settings),
        );
    }

    /**
     * Get the time in the given settings of a notifiable model that its notifications are paused until, in the
     * application's timezone, or null when they are not paused or the pause has passed.
     *
     * @param  array<string, mixed>  $settings
     */
    protected static function currentPause(array $settings): ?CarbonInterface
    {
        $until = self::savedPause($settings);

        return $until instanceof CarbonInterface && $until->isFuture() ? $until : null;
    }

    /**
     * Get the time in the given settings of a notifiable model that its notifications are paused until, in the
     * application's timezone, also once the pause has passed.
     *
     * @param  array<string, mixed>  $settings
     */
    protected static function savedPause(array $settings): ?CarbonInterface
    {
        $saved = $settings['paused_until'] ?? null;

        if (! is_string($saved)) {
            return null;
        }

        return Inbox::inApplicationTimezone(Carbon::parse($saved));
    }
}
