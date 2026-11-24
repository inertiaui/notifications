<?php

namespace InertiaUI\Notifications\Concerns;

use Illuminate\Database\Eloquent\Builder;
use InertiaUI\Notifications\InboxMessage;
use InertiaUI\Notifications\Models\InboxAnnouncement;
use InertiaUI\Notifications\Models\InboxNotification;
use InertiaUI\Notifications\NotificationPreferences;
use InertiaUI\Notifications\Toast;
use InvalidArgumentException;

/**
 * Limits the lists of the notification center to the tabs of the application and the built-in filters.
 *
 * @phpstan-type InboxTab array{label: string, category: string|null, data: array<string, string|int|float|bool>}
 */
trait FiltersInbox
{
    /**
     * Get the tabs that the application added to the notification center, by key.
     *
     * Each tab lists the notifications in the inbox of its category, and those whose `InboxMessage::with()`
     * data has its data values. The browser only sends the key of a tab, so it never picks the columns.
     *
     * @return array<string, InboxTab>
     */
    public static function tabs(): array
    {
        /** @var array<string, array<string, mixed>> $tabs */
        $tabs = config('inertia-notifications.inbox.tabs', []);
        $result = [];

        foreach ($tabs as $key => $tab) {
            $result[$key] = self::tab((string) $key, $tab);
        }

        return $result;
    }

    /**
     * Get the categories that the panel filters by, by key, with their translated labels, from the
     * `inbox.category_filter` config.
     *
     * With `true`, every category of the preferences shows. With a list of keys, those categories show in its order,
     * with the labels of the preferences, unless the list gives a key its own label, such as `'review' => 'Reviews'`.
     *
     * @return array<string, string>
     */
    public static function categoryFilter(): array
    {
        $filter = config('inertia-notifications.inbox.category_filter', false);

        if (in_array($filter, [false, null, []], true)) {
            return [];
        }

        $categories = NotificationPreferences::categories();
        $keys = $filter === true ? array_keys($categories) : (array) $filter;
        $result = [];

        foreach ($keys as $key => $label) {
            if (is_int($key)) {
                $key = (string) $label;
                $label = $categories[$label]['label'] ?? null;
            }

            if (is_string($label)) {
                $result[$key] = Toast::translate($label);
            }
        }

        return $result;
    }

    /**
     * Get the filters of the notification list: the built-in ones and the keys of the application's tabs.
     *
     * The `snoozed` and `archived` filters are left out while the `inbox.actions` config leaves out snoozing
     * or archiving. Their names stay reserved, so a tab of the application never takes one of them.
     *
     * @return list<string>
     */
    public static function filters(): array
    {
        $builtIn = array_filter(self::FILTERS, fn (string $filter): bool => match ($filter) {
            'snoozed' => self::allows('snooze'),
            'archived' => self::allows('archive'),
            default => true,
        });

        // PHP turns the key of a tab that is only digits into an integer, so we will cast the keys back to
        // strings, which the strict comparisons with the requested filter expect.
        return [...array_values($builtIn), ...array_map(strval(...), array_keys(self::tabs()))];
    }

    /**
     * Get the given filter when the notification list offers it, or else `all`.
     *
     * A filter that is not one of `filters()`, such as `archived` while the application does not offer
     * archiving, lists every notification.
     */
    public static function resolveFilter(mixed $filter): string
    {
        return in_array($filter, self::filters(), true) ? $filter : 'all';
    }

    /**
     * Read the given tab of the configuration.
     *
     * @param  array<string, mixed>  $tab
     * @return InboxTab
     */
    protected static function tab(string $key, array $tab): array
    {
        if (! preg_match('/^[\w-]+$/', $key)) {
            throw new InvalidArgumentException(
                "The notification center tab [{$key}] must only use letters, numbers, dashes, and underscores.",
            );
        }

        if (in_array($key, self::FILTERS, true)) {
            throw new InvalidArgumentException(
                "The notification center tab [{$key}] must not use the name of a built-in tab.",
            );
        }

        /** @var array<string, mixed> $data */
        $data = $tab['data'] ?? [];

        foreach ($data as $field => $value) {
            self::guardTabField($key, (string) $field, $value);
        }

        $label = $tab['label'] ?? null;
        $category = $tab['category'] ?? null;

        /** @var array<string, string|int|float|bool> $data */
        return [
            'label' => Toast::translate(is_string($label) ? $label : $key),
            'category' => is_string($category) ? $category : null,
            'data' => $data,
        ];
    }

    /**
     * Ensure the given data field of a tab is one that the queries may compare.
     */
    protected static function guardTabField(string $key, string $field, mixed $value): void
    {
        if (! preg_match('/^\w+$/', $field)) {
            throw new InvalidArgumentException(
                "The data field [{$field}] of the tab [{$key}] must only use letters, numbers, and underscores.",
            );
        }

        if (! is_scalar($value)) {
            throw new InvalidArgumentException(
                "The data field [{$field}] of the tab [{$key}] must be a string, a number, or a boolean.",
            );
        }
    }

    /**
     * Limit the given query to the notifications or announcements of the given tab.
     *
     * @param  Builder<InboxNotification>|Builder<InboxAnnouncement>  $query
     * @param  InboxTab  $tab
     */
    protected static function applyTab(Builder $query, array $tab): void
    {
        if ($tab['category'] !== null) {
            $query->where('category', $tab['category']);
        }

        foreach ($tab['data'] as $field => $value) {
            $query->where("data->meta->{$field}", $value);
        }
    }

    /**
     * Limit the given query to the items of the given filter and category.
     *
     * @param  Builder<InboxNotification>|Builder<InboxAnnouncement>  $query
     */
    protected static function applyFilter(Builder $query, ?string $filter, ?string $category): void
    {
        $filter ??= 'all';

        self::applyState($query, $filter);

        $tab = self::tabs()[$filter] ?? null;

        if ($tab !== null) {
            self::applyTab($query, $tab);
        }

        if ($category !== null) {
            $query->where('category', $category);
        }
    }

    /**
     * Limit the given query to the archived, snoozed, unread, or active items of the given filter.
     *
     * @param  Builder<InboxNotification>|Builder<InboxAnnouncement>  $query
     */
    protected static function applyState(Builder $query, string $filter): void
    {
        if ($filter === 'archived') {
            $query->archived();

            return;
        }

        if ($filter === 'snoozed') {
            $query->snoozed();

            return;
        }

        $query->active();

        if ($filter === 'unread') {
            $query->unread();
        }
    }
}
