<?php

namespace InertiaUI\Notifications;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use InertiaUI\Notifications\Concerns\ChecksPreferences;
use InertiaUI\Notifications\Concerns\DefinesPreferenceCategories;
use InertiaUI\Notifications\Concerns\ListsPreferences;
use InertiaUI\Notifications\Concerns\PausesNotifications;
use InertiaUI\Notifications\Concerns\ResolvesPreferenceTimezones;
use InertiaUI\Notifications\Concerns\UpdatesPreferences;
use InertiaUI\Notifications\Models\NotificationPreference;

/**
 * The categories of notifications that users turn on and off per channel, from the `preferences` config.
 * When a notification sends, a channel that the user turned off for its category, or for every category,
 * is skipped. Users may also receive a category in an hourly, daily, or weekly digest instead of right away,
 * set the notification hours outside of which nothing alerts them, and pause their notifications for a while.
 */
class NotificationPreferences
{
    use ChecksPreferences,
        DefinesPreferenceCategories,
        ListsPreferences,
        PausesNotifications,
        ResolvesPreferenceTimezones,
        UpdatesPreferences;

    /**
     * The category under which the switch of a channel for every category is stored.
     */
    public const EVERY_CATEGORY = '*';

    /**
     * The channel under which the settings of a category are stored, such as its digest frequency.
     *
     * The row whose category is `*` as well holds the settings of the user, such as their timezone.
     */
    public const EVERY_CHANNEL = '*';

    /**
     * The frequencies that users receive a category with: right away, or in an hourly, daily, or weekly digest.
     */
    public const array FREQUENCIES = ['instant', 'hourly', 'daily', 'weekly'];

    /**
     * Flush the timezone resolver.
     *
     * The service provider calls this for each new application, so tests do not share it.
     */
    public static function flushState(): void
    {
        static::$timezoneResolver = null;
    }

    /**
     * Get the stored preferences of the given notifiable model, from one query of its rows.
     *
     * A row whose channel is `*` holds settings: the frequency of its category, or the settings of the
     * notifiable model, such as its timezone, when its category is `*` as well. Any other row whose
     * category is `*` holds the switch of a channel for every category, which only channels with
     * that switch have. Every other row holds a choice by category and channel. A choice or a
     * switch without a value, and a frequency that the application no longer offers, are
     * left out, so they read as the default.
     */
    protected static function stored(Model $notifiable): StoredPreferences
    {
        $rows = self::query($notifiable)->get(['category', 'channel', 'enabled', 'settings']);

        return new StoredPreferences(
            categories: self::storedChoices($rows),
            channels: self::storedSwitches($rows),
            frequencies: self::storedFrequencies($rows),
            settings: self::storedSettings($rows),
        );
    }

    /**
     * Get the choices by category and channel in the given preference rows, without the choices that have no value.
     *
     * @param  Collection<int, NotificationPreference>  $rows
     * @return array<string, array<string, bool>>
     */
    protected static function storedChoices(Collection $rows): array
    {
        $choices = [];

        foreach ($rows as $row) {
            if ($row->category === self::EVERY_CATEGORY || $row->channel === self::EVERY_CHANNEL) {
                continue;
            }

            if ($row->enabled !== null) {
                $choices[$row->category][$row->channel] = $row->enabled;
            }
        }

        return $choices;
    }

    /**
     * Get the switches of channels for every category in the given preference rows, without the switches that
     * have no value and those of channels without that switch.
     *
     * @param  Collection<int, NotificationPreference>  $rows
     * @return array<string, bool>
     */
    protected static function storedSwitches(Collection $rows): array
    {
        $switchableChannels = self::switchableChannels();
        $switches = [];

        foreach ($rows as $row) {
            if ($row->category !== self::EVERY_CATEGORY || $row->channel === self::EVERY_CHANNEL) {
                continue;
            }

            if ($row->enabled !== null && isset($switchableChannels[$row->channel])) {
                $switches[$row->channel] = $row->enabled;
            }
        }

        return $switches;
    }

    /**
     * Get the digest frequencies by category in the given preference rows, without the frequencies that the
     * application no longer offers.
     *
     * @param  Collection<int, NotificationPreference>  $rows
     * @return array<string, string>
     */
    protected static function storedFrequencies(Collection $rows): array
    {
        $offeredFrequencies = self::offeredFrequencies();
        $frequencies = [];

        foreach ($rows as $row) {
            if ($row->category === self::EVERY_CATEGORY || $row->channel !== self::EVERY_CHANNEL) {
                continue;
            }

            $frequency = $row->settings['frequency'] ?? null;

            if (in_array($frequency, $offeredFrequencies, true)) {
                $frequencies[$row->category] = $frequency;
            }
        }

        return $frequencies;
    }

    /**
     * Get the settings of the notifiable model in the given preference rows, such as its timezone.
     *
     * @param  Collection<int, NotificationPreference>  $rows
     * @return array<string, mixed>
     */
    protected static function storedSettings(Collection $rows): array
    {
        $row = $rows->first(fn (NotificationPreference $row): bool => $row->category === self::EVERY_CATEGORY
            && $row->channel === self::EVERY_CHANNEL);

        return is_array($row?->settings) ? $row->settings : [];
    }

    /**
     * Get a new query builder for the preferences of the given notifiable model.
     *
     * @return Builder<NotificationPreference>
     */
    protected static function query(Model $notifiable): Builder
    {
        return NotificationPreference::query()->whereMorphedTo('notifiable', $notifiable);
    }
}
