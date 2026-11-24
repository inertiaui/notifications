<?php

namespace InertiaUI\Notifications\Concerns;

use Closure;
use DateTimeZone;
use Illuminate\Database\Eloquent\Model;

/**
 * Resolves the timezone of a notifiable model, which its digests and notification hours follow.
 */
trait ResolvesPreferenceTimezones
{
    /**
     * The callback that resolves the timezone of a notifiable model.
     *
     * @var (Closure(Model): (string|null))|null
     */
    protected static ?Closure $timezoneResolver = null;

    /**
     * Set the callback that resolves the timezone of a notifiable model, such as from its `timezone` attribute.
     *
     * When the callback returns null, the timezone is the one the browser sent with the user's last change.
     *
     * @param  (Closure(Model): (string|null))|null  $callback
     */
    public static function resolveTimezoneUsing(?Closure $callback): void
    {
        static::$timezoneResolver = $callback;
    }

    /**
     * Get the timezone of the notifiable model.
     *
     * The timezone is the one that the application's resolver returns, or else the one that the browser sent
     * with the user's last change, or else the application's timezone.
     */
    public static function timezone(Model $notifiable): string
    {
        return self::resolvedTimezone($notifiable) ?? self::savedTimezone(self::stored($notifiable)->settings);
    }

    /**
     * Get the timezone that the application's resolver returns for the notifiable model, if it is a timezone.
     */
    protected static function resolvedTimezone(Model $notifiable): ?string
    {
        $resolved = static::$timezoneResolver instanceof Closure ? (static::$timezoneResolver)($notifiable) : null;

        return is_string($resolved) && self::isTimezone($resolved) ? $resolved : null;
    }

    /**
     * Get the timezone in the given settings of a notifiable model, or else the application's timezone.
     *
     * @param  array<string, mixed>  $settings
     */
    protected static function savedTimezone(array $settings): string
    {
        $saved = $settings['timezone'] ?? null;

        return is_string($saved) && self::isTimezone($saved) ? $saved : date_default_timezone_get();
    }

    /**
     * Determine if the given value is the name of a timezone, including the older names that browsers may send.
     */
    protected static function isTimezone(string $timezone): bool
    {
        return in_array($timezone, DateTimeZone::listIdentifiers(DateTimeZone::ALL_WITH_BC), true);
    }
}
