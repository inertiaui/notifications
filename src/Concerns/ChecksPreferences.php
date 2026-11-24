<?php

namespace InertiaUI\Notifications\Concerns;

use Illuminate\Database\Eloquent\Model;
use InertiaUI\Notifications\NotificationHours;
use InvalidArgumentException;

/**
 * Determines whether a notifiable model receives a category on a channel, how often, and at what hours.
 */
trait ChecksPreferences
{
    /**
     * Determine if the notifiable model receives the category on the given channel.
     *
     * The channel is a key of the `channels` config. Locked categories, and categories and channels that
     * the config does not list, are always on. Opt-in categories are off until the user turns them on, and
     * every other category is off while the user turned off the channel for every category.
     */
    public static function enabled(Model $notifiable, string $category, string $channel): bool
    {
        $definition = self::categories()[$category] ?? null;

        if ($definition === null || $definition['locked'] || ! in_array($channel, $definition['channels'], true)) {
            return true;
        }

        $stored = self::stored($notifiable);

        if (! $stored->channelEnabled($channel)) {
            return false;
        }

        return $stored->choice($category, $channel, $definition['opt_in']);
    }

    /**
     * Determine if the notifiable model receives the given channel, by its switch for every category.
     *
     * The channel is a key of the `channels` config. Channels without that switch, and channels that the
     * config does not list, are always on. Locked categories send even while the channel is off.
     */
    public static function channelEnabled(Model $notifiable, string $channel): bool
    {
        if (! isset(self::switchableChannels()[$channel])) {
            return true;
        }

        return self::stored($notifiable)->channelEnabled($channel);
    }

    /**
     * Determine if the notification may send on the given Laravel channel.
     *
     * The channel is given as the notification's `via()` method returns it, or as `push` for the push that
     * the `inbox` channel sends.
     */
    public static function allows(object $notifiable, object $notification, string $channel): bool
    {
        if (! $notifiable instanceof Model || self::categories() === []) {
            return true;
        }

        $preferenceChannel = self::channelFor($channel);

        if ($preferenceChannel === null) {
            return true;
        }

        $category = self::category($notifiable, $notification);

        return $category === null || self::enabled($notifiable, $category, $preferenceChannel);
    }

    /**
     * Get the frequency that the notifiable model receives the category with: `instant`, `hourly`, `daily`, or
     * `weekly`.
     *
     * Categories that may not be received in a digest, and categories that the config does not list, are
     * always `instant`, and so is a category whose frequency the application no longer offers.
     */
    public static function frequency(Model $notifiable, string $category): string
    {
        if (! (self::categories()[$category]['digest'] ?? false)) {
            return 'instant';
        }

        return self::stored($notifiable)->frequency($category);
    }

    /**
     * Get the categories that the notifiable model does not receive on the given Laravel channel, such as `inbox`.
     *
     * The categories follow the same rules as `enabled()`, from one query of the notifiable model's choices.
     *
     * @return list<string>
     */
    public static function disabledCategories(Model $notifiable, string $channel): array
    {
        $preferenceChannel = self::channelFor($channel);

        if ($preferenceChannel === null || self::categories() === []) {
            return [];
        }

        $stored = self::stored($notifiable);
        $channelEnabled = $stored->channelEnabled($preferenceChannel);

        return collect(self::categories())
            ->reject(fn (array $category): bool => $category['locked'])
            ->filter(fn (array $category): bool => in_array($preferenceChannel, $category['channels'], true))
            ->reject(fn (array $category, string $key): bool => $channelEnabled
                && $stored->choice($key, $preferenceChannel, $category['opt_in']))
            ->keys()
            ->all();
    }

    /**
     * Get the notification hours of the notifiable model, also while they are off.
     *
     * Users who never set them start with the `notification_hours.days` config.
     *
     * @throws InvalidArgumentException
     */
    public static function notificationHours(Model $notifiable): NotificationHours
    {
        return self::savedNotificationHours(self::stored($notifiable)->settings);
    }

    /**
     * Get the notification hours in the given settings of a notifiable model, with the days of the config
     * for the days that it did not set.
     *
     * @param  array<string, mixed>  $settings
     *
     * @throws InvalidArgumentException
     */
    protected static function savedNotificationHours(array $settings): NotificationHours
    {
        $saved = $settings['notification_hours'] ?? [];
        $configured = self::configuredNotificationHours();
        $days = [];

        foreach (NotificationHours::DAYS as $day) {
            $days[$day] = $saved['days'][$day] ?? $configured[$day] ?? ['07:00-22:00'];
        }

        return new NotificationHours(
            enabled: (bool) ($saved['enabled'] ?? false),
            days: $days,
        );
    }

    /**
     * Get the ranges of each day that the `notification_hours.days` config lists.
     *
     * @return array<string, list<string>>
     *
     * @throws InvalidArgumentException
     */
    protected static function configuredNotificationHours(): array
    {
        $days = config('inertia-notifications.notification_hours.days', []);

        foreach ($days as $day => $ranges) {
            self::ensureConfiguredRanges($day, $ranges);
        }

        return $days;
    }

    /**
     * Ensure the given ranges of a day of the `notification_hours.days` config follow the rules of the
     * notification hours that users save.
     *
     * @throws InvalidArgumentException
     */
    protected static function ensureConfiguredRanges(string $day, mixed $ranges): void
    {
        $key = "inertia-notifications.notification_hours.days.{$day}";

        if (! is_array($ranges) || ! collect($ranges)->every(fn (mixed $range): bool => is_string($range))) {
            throw new InvalidArgumentException(
                "The [{$key}] config must be a list of ranges, such as ['09:00-17:00'].",
            );
        }

        try {
            NotificationHours::ensureRanges($day, $ranges);
        } catch (InvalidArgumentException $invalidArgumentException) {
            throw new InvalidArgumentException(
                "The [{$key}] config is invalid: {$invalidArgumentException->getMessage()}",
                $invalidArgumentException->getCode(),
                previous: $invalidArgumentException,
            );
        }
    }

    /**
     * Get the notification hours in the given settings of a notifiable model while the application offers them
     * and they are on, or else null.
     *
     * Notification hours without any range, such as from a config that lists none, would hold every
     * notification forever, so we will treat them as turned off until the user sets a range.
     *
     * @param  array<string, mixed>  $settings
     */
    protected static function turnedOnNotificationHours(array $settings): ?NotificationHours
    {
        if (! NotificationHours::offered()) {
            return null;
        }

        $hours = self::savedNotificationHours($settings);

        if (! $hours->enabled) {
            return null;
        }

        return $hours->hasRanges() ? $hours : null;
    }
}
