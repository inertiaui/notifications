<?php

namespace InertiaUI\Notifications\Concerns;

use InertiaUI\Notifications\Channels\InboxChannel;
use InertiaUI\Notifications\Push;

/**
 * Reads the channels, categories, and groups that users choose from in the `preferences` config.
 */
trait DefinesPreferenceCategories
{
    /**
     * Get the channels that users choose from, by key.
     *
     * Each channel lists the Laravel channels it covers, or `push` for the pushes of the `inbox` channel, and
     * whether users may turn it off for every category. While push is enabled, a `push` channel follows the
     * channels of the config when none of them covers the pushes.
     *
     * @return array<string, array{label: string, via: list<string>, global_switch: bool}>
     */
    public static function channels(): array
    {
        /** @var array<string, array{label?: string, via?: list<string>, global_switch?: bool}> $channels */
        $channels = config('inertia-notifications.preferences.channels', [
            'inbox' => ['label' => 'In the app', 'via' => ['inbox', 'database', 'broadcast']],
            'mail' => ['label' => 'Email', 'via' => ['mail']],
        ]);

        $channels = collect($channels)
            ->except(self::EVERY_CHANNEL)
            ->map(fn (array $channel, string $key): array => [
                'label' => $channel['label'] ?? $key,
                'via' => $channel['via'] ?? [$key],
                'global_switch' => (bool) ($channel['global_switch'] ?? true),
            ]);

        if (self::needsPushChannel($channels->all())) {
            $channels->put('push', ['label' => 'Push', 'via' => ['push'], 'global_switch' => true]);
        }

        return $channels->all();
    }

    /**
     * Determine if the given channels need the `push` channel that the package adds.
     *
     * Enabling push should be enough for users to turn it on and off, so the package adds the channel
     * while push is enabled, unless the application lists a channel that covers it, or a `push` key.
     *
     * @param  array<string, array{label: string, via: list<string>, global_switch: bool}>  $channels
     */
    protected static function needsPushChannel(array $channels): bool
    {
        if (! Push::enabled() || isset($channels['push'])) {
            return false;
        }

        return collect($channels)->doesntContain(fn (array $channel): bool => in_array('push', $channel['via'], true));
    }

    /**
     * Get the categories that users turn on and off, by key.
     *
     * Each category lists the channels it offers, and whether users may receive it in a digest. Only a category
     * that is not locked and offers a channel that digests hold back may be received in a digest.
     *
     * @return array<string, array{
     *     label: string,
     *     description: string|null,
     *     group: string|null,
     *     locked: bool,
     *     opt_in: bool,
     *     digest: bool,
     *     channels: list<string>,
     * }>
     */
    public static function categories(): array
    {
        /**
         * @var array<string, array{
         *     label?: string,
         *     description?: string|null,
         *     group?: string|null,
         *     locked?: bool,
         *     opt_in?: bool,
         *     digest?: bool,
         *     channels?: list<string>,
         * }> $categories
         */
        $categories = config('inertia-notifications.preferences.categories', []);
        $channels = array_keys(self::channels());
        $digestChannels = self::digestChannels();

        return collect($categories)
            ->except(self::EVERY_CATEGORY)
            ->map(function (array $category, string $key) use ($channels, $digestChannels): array {
                $offered = collect($channels)->intersect($category['channels'] ?? $channels)->values()->all();
                $locked = (bool) ($category['locked'] ?? false);
                $digest = ($category['digest'] ?? false)
                    && ! $locked
                    && array_intersect($offered, $digestChannels) !== [];

                return [
                    'label' => $category['label'] ?? $key,
                    'description' => $category['description'] ?? null,
                    'group' => $category['group'] ?? null,
                    'locked' => $locked,
                    'opt_in' => (bool) ($category['opt_in'] ?? false),
                    'digest' => $digest,
                    'channels' => $offered,
                ];
            })
            ->all();
    }

    /**
     * Get the channels that digests hold back, as keys of the `channels` config.
     *
     * @return list<string>
     */
    public static function digestChannels(): array
    {
        /** @var list<string> $digestChannels */
        $digestChannels = config('inertia-notifications.digests.channels', ['mail']);

        return collect(self::channels())->keys()->intersect($digestChannels)->values()->all();
    }

    /**
     * Get the frequencies that users may choose, in the order of `FREQUENCIES`: always `instant`, and the digest
     * frequencies of the `digests.frequencies` config.
     *
     * @return list<string>
     */
    public static function offeredFrequencies(): array
    {
        /** @var list<string> $digestFrequencies */
        $digestFrequencies = config('inertia-notifications.digests.frequencies', ['hourly', 'daily', 'weekly']);

        return collect(self::FREQUENCIES)
            ->filter(fn (string $frequency): bool => $frequency === 'instant'
                || in_array($frequency, $digestFrequencies, true))
            ->values()
            ->all();
    }

    /**
     * Get the key of the channel in the `channels` config that covers the given Laravel channel.
     *
     * The Laravel channel is given as a notification's `via()` method returns it, or as `push` for the pushes
     * of the `inbox` channel.
     */
    public static function channelFor(string $channel): ?string
    {
        $key = collect(self::channels())->search(fn (array $config): bool => in_array($channel, $config['via'], true));

        return $key === false ? null : $key;
    }

    /**
     * Get the groups that the categories are shown in, by key.
     *
     * A group that a category names without the `groups` config listing it is labeled with its key.
     *
     * @return array<string, array{label: string, description: string|null}>
     */
    public static function groups(): array
    {
        /** @var array<string, array{label?: string, description?: string|null}> $groups */
        $groups = config('inertia-notifications.preferences.groups', []);

        $named = collect(self::categories())
            ->pluck('group')
            ->filter()
            ->mapWithKeys(fn (string $group): array => [$group => []]);

        return collect($groups)
            ->union($named)
            ->map(fn (array $group, string $key): array => [
                'label' => $group['label'] ?? $key,
                'description' => $group['description'] ?? null,
            ])
            ->all();
    }

    /**
     * Get the channels that users may turn off for every category, by key.
     *
     * @return array<string, array{label: string, via: list<string>, global_switch: bool}>
     */
    protected static function switchableChannels(): array
    {
        return collect(self::channels())
            ->filter(fn (array $channel): bool => $channel['global_switch'])
            ->all();
    }

    /**
     * Get the category of the given notification.
     *
     * The category is what the notification's `notificationCategory()` method returns, or else the
     * category of its `toInbox()` message.
     */
    public static function category(object $notifiable, object $notification): ?string
    {
        if (method_exists($notification, 'notificationCategory')) {
            $category = $notification->notificationCategory($notifiable);

            return is_string($category) ? $category : null;
        }

        return InboxChannel::message($notifiable, $notification)?->getCategory();
    }
}
