<?php

namespace InertiaUI\Notifications\Concerns;

use Illuminate\Database\Eloquent\Model;
use InertiaUI\Notifications\NotificationHours;
use InertiaUI\Notifications\NotificationPreferences;
use InertiaUI\Notifications\StoredPreferences;
use InertiaUI\Notifications\Toast;

/**
 * Lists the preferences of a notifiable model in the shape that the preferences component reads.
 */
trait ListsPreferences
{
    /**
     * Get the preferences of the given notifiable model.
     *
     * The preferences have the shape that the `<NotificationPreferences>` component reads, with the frequencies
     * that users may choose, starting with `instant`.
     *
     * @return array{
     *     channels: list<array{
     *         key: string,
     *         label: string,
     *         globalSwitch: bool,
     *         enabled: bool,
     *         digest: bool,
     *         inbox: bool,
     *         push: bool,
     *     }>,
     *     groups: list<array{key: string, label: string, description: string|null}>,
     *     categories: list<array{
     *         key: string,
     *         label: string,
     *         description: string|null,
     *         group: string|null,
     *         locked: bool,
     *         channels: array<string, bool>,
     *         frequency: string|null,
     *     }>,
     *     frequencies: list<string>,
     *     notificationHours: array{enabled: bool, days: array<string, list<string>>}|null,
     * }
     */
    public static function for(Model $notifiable): array
    {
        $stored = self::stored($notifiable);

        return [
            'channels' => self::channelList($stored),
            'groups' => self::groupList(),
            'categories' => self::categoryList($stored),
            'frequencies' => self::offeredFrequencies(),
            'notificationHours' => NotificationHours::offered()
                ? self::savedNotificationHours($stored->settings)->toArray()
                : null,
        ];
    }

    /**
     * Get the channels with their stored switches, in the shape that the component reads.
     *
     * A channel without a switch for every category is always on. The `inbox` key tells the component which
     * channel covers the notification center, and the `push` key which channel covers the pushes, which
     * also need the permission of the browser and reach the user only with the notification center.
     *
     * @return list<array{
     *     key: string,
     *     label: string,
     *     globalSwitch: bool,
     *     enabled: bool,
     *     digest: bool,
     *     inbox: bool,
     *     push: bool,
     * }>
     */
    protected static function channelList(StoredPreferences $stored): array
    {
        $channels = [];
        $digestChannels = self::digestChannels();

        foreach (self::channels() as $key => $channel) {
            $channels[] = [
                'key' => $key,
                'label' => Toast::translate($channel['label']),
                'globalSwitch' => $channel['global_switch'],
                'enabled' => $stored->channelEnabled($key),
                'digest' => in_array($key, $digestChannels, true),
                'inbox' => in_array('inbox', $channel['via'], true),
                'push' => in_array('push', $channel['via'], true),
            ];
        }

        return $channels;
    }

    /**
     * Get the groups that have categories, in the shape that the component reads.
     *
     * @return list<array{key: string, label: string, description: string|null}>
     */
    protected static function groupList(): array
    {
        $named = array_column(self::categories(), 'group');
        $groups = [];

        foreach (self::groups() as $key => $group) {
            if (! in_array($key, $named, true)) {
                continue;
            }

            $groups[] = [
                'key' => $key,
                'label' => Toast::translate($group['label']),
                'description' => $group['description'] === null ? null : Toast::translate($group['description']),
            ];
        }

        return $groups;
    }

    /**
     * Get the categories with their stored choices and frequencies, in the shape that the component reads.
     *
     * The frequency is null for a category that may not be received in a digest.
     *
     * @return list<array{
     *     key: string,
     *     label: string,
     *     description: string|null,
     *     group: string|null,
     *     locked: bool,
     *     channels: array<string, bool>,
     *     frequency: string|null,
     * }>
     */
    protected static function categoryList(StoredPreferences $stored): array
    {
        $categories = [];

        foreach (self::categories() as $key => $category) {
            $enabled = [];
            $frequency = null;

            foreach ($category['channels'] as $channel) {
                $enabled[$channel] = $category['locked'] || $stored->choice($key, $channel, $category['opt_in']);
            }

            if ($category['digest']) {
                $frequency = $stored->frequency($key);
            }

            $categories[] = [
                'key' => $key,
                'label' => Toast::translate($category['label']),
                'description' => $category['description'] === null ? null : Toast::translate($category['description']),
                'group' => $category['group'],
                'locked' => $category['locked'],
                'channels' => $enabled,
                'frequency' => $frequency,
            ];
        }

        return $categories;
    }
}
