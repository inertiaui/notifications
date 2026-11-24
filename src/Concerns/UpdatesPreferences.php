<?php

namespace InertiaUI\Notifications\Concerns;

use Closure;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Arr;
use InertiaUI\Notifications\Digest;
use InertiaUI\Notifications\Events\NotificationPreferencesChanged;
use InertiaUI\Notifications\Models\NotificationPreference;
use InertiaUI\Notifications\NotificationHours;
use InertiaUI\Notifications\NotificationHoursChange;
use InertiaUI\Notifications\StoredPreferences;
use InvalidArgumentException;

/**
 * Saves the choices, frequencies, timezone, and notification hours that a notifiable model changes.
 */
trait UpdatesPreferences
{
    /**
     * Save the choices of the given notifiable model, by category and channel, its switches of channels, the
     * frequencies of its categories, and its notification hours.
     *
     * Locked categories, channels without a switch for every category, categories that may not be received
     * in a digest, frequencies that the application does not offer, and categories and channels that the
     * config does not list, are left out, and so are the notification hours while the application does
     * not offer them. The timezone, such as the one of the user's browser, is saved too. A
     * `NotificationPreferencesChanged` event is dispatched with what changed.
     *
     * @param  array<string, array<string, bool>>  $categories
     * @param  array<string, bool>  $channels
     * @param  array<string, string>  $frequencies
     *
     * @throws InvalidArgumentException
     */
    public static function update(
        Model $notifiable,
        array $categories = [],
        array $channels = [],
        array $frequencies = [],
        ?string $timezone = null,
        ?NotificationHoursChange $notificationHours = null,
    ): void {
        $stored = self::stored($notifiable);
        $categories = self::categoryChoices($categories);
        $channels = self::channelChoices($channels);
        $frequencies = self::frequencyChoices($frequencies);

        self::ensureTimezone($timezone);

        // We will save the notification hours before the timezone, so invalid hours save nothing, and a retry
        // with the timezone alone still moves the held notifications. Both build on the settings as they
        // are once their row is locked, so a change that another request saved meanwhile stays.
        $savedNotificationHours = self::saveNotificationHours($notifiable, $notificationHours);
        $timezoneChanged = self::saveTimezone($notifiable, $timezone);

        $event = new NotificationPreferencesChanged(
            $notifiable,
            self::categoryChanges($stored, $categories),
            self::channelChanges($stored, $channels),
            self::frequencyChanges($stored, $frequencies),
            $savedNotificationHours,
        );

        self::saveChoices($notifiable, $categories, $channels);
        self::saveFrequencies($notifiable, $frequencies);

        Digest::reschedule(
            $notifiable,
            categories: array_keys($event->frequencies),
            timezoneChanged: $timezoneChanged,
            doNotDisturbChanged: $savedNotificationHours instanceof NotificationHours,
        );

        if (self::hasChanges($event)) {
            event($event);
        }
    }

    /**
     * Determine if the given event holds any change of the preferences.
     */
    protected static function hasChanges(NotificationPreferencesChanged $event): bool
    {
        return $event->categories !== []
            || $event->channels !== []
            || $event->frequencies !== []
            || $event->notificationHours instanceof NotificationHours;
    }

    /**
     * Get the stored notification hours with the given changes, or null when they change nothing.
     *
     * @param  array<string, mixed>  $settings  The stored settings of the notifiable model.
     *
     * @throws InvalidArgumentException
     */
    protected static function changedNotificationHours(
        array $settings,
        NotificationHoursChange $changes,
    ): ?NotificationHours {
        $current = self::savedNotificationHours($settings);
        $next = $current->withChanges($changes);

        if (! $next->hasRanges()) {
            throw new InvalidArgumentException('The notification hours must have a range on at least one day.');
        }

        return $next->toArray() === $current->toArray() ? null : $next;
    }

    /**
     * Get the choices of the given categories that users may make.
     *
     * @param  array<string, array<string, bool>>  $categories
     * @return array<string, array<string, bool>>
     */
    protected static function categoryChoices(array $categories): array
    {
        $definitions = self::categories();
        $choices = [];

        foreach ($categories as $category => $channels) {
            if (! isset($definitions[$category]) || $definitions[$category]['locked']) {
                continue;
            }

            $offered = Arr::only($channels, $definitions[$category]['channels']);

            if ($offered !== []) {
                $choices[$category] = $offered;
            }
        }

        return $choices;
    }

    /**
     * Get the switches of the given channels for every category that users may make.
     *
     * @param  array<string, bool>  $channels
     * @return array<string, bool>
     */
    protected static function channelChoices(array $channels): array
    {
        return array_intersect_key($channels, self::switchableChannels());
    }

    /**
     * Get the frequencies of the given categories that users may choose.
     *
     * @param  array<string, string>  $frequencies
     * @return array<string, string>
     */
    protected static function frequencyChoices(array $frequencies): array
    {
        $definitions = self::categories();
        $offered = self::offeredFrequencies();

        return Arr::where(
            $frequencies,
            fn (string $frequency, string $category): bool => ($definitions[$category]['digest'] ?? false)
                && in_array($frequency, $offered, true),
        );
    }

    /**
     * Get the given choices that differ from the stored choices or the defaults.
     *
     * @param  array<string, array<string, bool>>  $choices
     * @return array<string, array<string, bool>>
     */
    protected static function categoryChanges(StoredPreferences $stored, array $choices): array
    {
        $definitions = self::categories();

        return collect($choices)
            ->map(fn (array $channels, string $category): array => Arr::where(
                $channels,
                fn (bool $enabled, string $channel): bool => $enabled
                    !== $stored->choice($category, $channel, $definitions[$category]['opt_in']),
            ))
            ->filter()
            ->all();
    }

    /**
     * Get the given switches of channels that differ from the stored switches, which are on by default.
     *
     * @param  array<string, bool>  $channels
     * @return array<string, bool>
     */
    protected static function channelChanges(StoredPreferences $stored, array $channels): array
    {
        return Arr::where(
            $channels,
            fn (bool $enabled, string $channel): bool => $stored->channelEnabled($channel) !== $enabled,
        );
    }

    /**
     * Get the given frequencies that differ from the stored frequencies or the default.
     *
     * @param  array<string, string>  $frequencies
     * @return array<string, string>
     */
    protected static function frequencyChanges(StoredPreferences $stored, array $frequencies): array
    {
        return Arr::where(
            $frequencies,
            fn (string $frequency, string $category): bool => $stored->frequency($category) !== $frequency,
        );
    }

    /**
     * Store the given choices and switches of channels of the notifiable model, replacing the ones it made before.
     *
     * A switch of a channel is stored under the category `*`.
     *
     * @param  array<string, array<string, bool>>  $categories
     * @param  array<string, bool>  $channels
     */
    protected static function saveChoices(Model $notifiable, array $categories, array $channels): void
    {
        $rows = [];
        $row = fn (string $category, string $channel, bool $enabled): array => [
            'notifiable_type' => $notifiable->getMorphClass(),
            'notifiable_id' => $notifiable->getKey(),
            'category' => $category,
            'channel' => $channel,
            'enabled' => $enabled,
            'created_at' => now(),
            'updated_at' => now(),
        ];

        foreach ($categories as $category => $choices) {
            foreach ($choices as $channel => $enabled) {
                $rows[] = $row($category, $channel, $enabled);
            }
        }

        foreach ($channels as $channel => $enabled) {
            $rows[] = $row(self::EVERY_CATEGORY, $channel, $enabled);
        }

        if ($rows === []) {
            return;
        }

        NotificationPreference::query()->upsert(
            $rows,
            ['notifiable_type', 'notifiable_id', 'category', 'channel'],
            ['enabled', 'updated_at'],
        );
    }

    /**
     * Store the given frequencies of the notifiable model's categories, replacing the ones it chose before.
     *
     * @param  array<string, string>  $frequencies
     */
    protected static function saveFrequencies(Model $notifiable, array $frequencies): void
    {
        if ($frequencies === []) {
            return;
        }

        $rows = [];

        foreach ($frequencies as $category => $frequency) {
            $rows[] = [
                'notifiable_type' => $notifiable->getMorphClass(),
                'notifiable_id' => $notifiable->getKey(),
                'category' => $category,
                'channel' => self::EVERY_CHANNEL,
                'enabled' => null,
                'settings' => json_encode(['frequency' => $frequency]),
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        NotificationPreference::query()->upsert(
            $rows,
            ['notifiable_type', 'notifiable_id', 'category', 'channel'],
            ['settings', 'updated_at'],
        );
    }

    /**
     * Ensure the given timezone is a valid timezone, when one is given.
     *
     * @throws InvalidArgumentException
     */
    protected static function ensureTimezone(?string $timezone): void
    {
        if ($timezone !== null && ! self::isTimezone($timezone)) {
            throw new InvalidArgumentException("The timezone [{$timezone}] is not a valid timezone.");
        }
    }

    /**
     * Store the given timezone with the settings of the notifiable model, and determine if it changed the
     * timezone of the notifiable model.
     */
    protected static function saveTimezone(Model $notifiable, ?string $timezone): bool
    {
        if ($timezone === null) {
            return false;
        }

        return self::changeSettings(
            $notifiable,
            function (NotificationPreference $preference) use ($notifiable, $timezone): bool {
                $changed = self::timezoneChanged($notifiable, $timezone, $preference->settings ?? []);

                self::mergeSettings($preference, ['timezone' => $timezone]);

                return $changed;
            },
        );
    }

    /**
     * Determine if the given timezone changes the timezone of the notifiable model.
     *
     * The timezone that the application's resolver returns stays the timezone of the notifiable model.
     *
     * @param  array<string, mixed>  $settings  The stored settings of the notifiable model.
     */
    protected static function timezoneChanged(Model $notifiable, ?string $timezone, array $settings): bool
    {
        if ($timezone === null || self::resolvedTimezone($notifiable) !== null) {
            return false;
        }

        return self::savedTimezone($settings) !== $timezone;
    }

    /**
     * Store the notification hours of the notifiable model with the given changes, and get them, or null when
     * they change nothing.
     *
     * The changes apply to the notification hours as they are saved once their row is locked, so the days
     * that another request changed since the notifiable model's preferences were read keep their ranges.
     *
     * @throws InvalidArgumentException
     */
    protected static function saveNotificationHours(
        Model $notifiable,
        ?NotificationHoursChange $changes,
    ): ?NotificationHours {
        if (! $changes instanceof NotificationHoursChange || $changes->isEmpty() || ! NotificationHours::offered()) {
            return null;
        }

        return self::changeSettings(
            $notifiable,
            function (NotificationPreference $preference) use ($changes): ?NotificationHours {
                $hours = self::changedNotificationHours($preference->settings ?? [], $changes);

                if (! $hours instanceof NotificationHours) {
                    return null;
                }

                self::mergeSettings($preference, ['notification_hours' => $hours->toArray()]);

                return $hours;
            },
        );
    }

    /**
     * Store the given settings of the notifiable model, keeping its other settings.
     *
     * @param  array<string, mixed>  $settings
     */
    protected static function saveSettings(Model $notifiable, array $settings): void
    {
        self::changeSettings(
            $notifiable,
            fn (NotificationPreference $preference) => self::mergeSettings($preference, $settings),
        );
    }

    /**
     * Run the given callback with the row of the notifiable model's settings, in a transaction that keeps the
     * row locked until the callback returns, and get what the callback returns.
     *
     * Another change of the settings waits for the transaction, so the settings that the callback stores
     * build on the ones it receives. MySQL may end two first changes that lock the gap where the row
     * goes in a deadlock, so we will try the transaction once more before we give up.
     *
     * @template TReturn
     *
     * @param  Closure(NotificationPreference): TReturn  $callback
     * @return TReturn
     */
    protected static function changeSettings(Model $notifiable, Closure $callback): mixed
    {
        return NotificationPreference::query()
            ->getConnection()
            ->transaction(fn (): mixed => $callback(self::firstOrCreateLockedSettings($notifiable)), attempts: 2);
    }

    /**
     * Get or create the row of the notifiable model's settings, locked until the transaction ends.
     *
     * Two first changes of the settings may both find no row, so we will create an empty row, or find the
     * row of the other change once the unique key refuses ours, and then lock the row that either stored.
     */
    protected static function firstOrCreateLockedSettings(Model $notifiable): NotificationPreference
    {
        $preference = self::settingsQuery($notifiable)->lockForUpdate()->first();

        if ($preference instanceof NotificationPreference) {
            return $preference;
        }

        NotificationPreference::query()->createOrFirst([
            'notifiable_type' => $notifiable->getMorphClass(),
            'notifiable_id' => $notifiable->getKey(),
            'category' => self::EVERY_CATEGORY,
            'channel' => self::EVERY_CHANNEL,
        ]);

        return self::settingsQuery($notifiable)->lockForUpdate()->sole();
    }

    /**
     * Get a new query builder for the row of the notifiable model's settings.
     *
     * @return Builder<NotificationPreference>
     */
    protected static function settingsQuery(Model $notifiable): Builder
    {
        return self::query($notifiable)
            ->where('category', self::EVERY_CATEGORY)
            ->where('channel', self::EVERY_CHANNEL);
    }

    /**
     * Store the given settings in the row of a notifiable model's settings, keeping its other settings.
     *
     * @param  array<string, mixed>  $settings
     */
    protected static function mergeSettings(NotificationPreference $preference, array $settings): void
    {
        $preference->settings = [...$preference->settings ?? [], ...$settings];

        $preference->save();
    }
}
