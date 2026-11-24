import { replacePlaceholders } from '@inertiaui/vanilla'

export type TranslationParams = Record<string, string | number>

/** A string with `:name` placeholders, or a function that receives the parameters and returns the text, such as for plurals. */
export type TranslationValue = string | ((params: TranslationParams) => string)

/**
 * The English text of every built-in string. Each key starts with the part of the package it belongs to: `toaster_`,
 * `toast_`, `error_toast_`, `inbox_` for the notification center and the `NotificationList`, and `preferences_`.
 */
export const DEFAULT_TRANSLATIONS = {
    toaster_label: 'Notifications',
    toaster_label_with_hotkey: ':label (:hotkey)',
    toaster_hotkey_alt: 'Alt',
    toaster_hotkey_ctrl: 'Ctrl',
    toaster_hotkey_meta: 'Meta',
    toaster_hotkey_shift: 'Shift',
    toaster_hotkey_separator: '+',
    toast_dismiss: 'Dismiss: :title',
    toast_count: '×:count',
    toast_type_default: '',
    toast_type_success: 'Success',
    toast_type_info: 'Info',
    toast_type_warning: 'Warning',
    toast_type_error: 'Error',
    toast_type_loading: '',

    error_toast_403: 'This action is unauthorized.',
    error_toast_419: 'This page has expired.',
    error_toast_419_description: 'Refresh the page and try again.',
    error_toast_429: 'Too many requests.',
    error_toast_429_description: 'Wait a moment and try again.',
    error_toast_5xx: 'Something went wrong.',
    error_toast_5xx_description: 'Try again later.',
    error_toast_network: 'You appear to be offline.',
    error_toast_network_description: 'Check your connection and try again.',

    inbox_title: 'Notifications',
    inbox_bell: 'Notifications',
    inbox_bell_new: 'Notifications, :count new',
    inbox_bell_paused: ':label, paused',
    inbox_all: 'All',
    inbox_unread: 'Unread',
    inbox_archived: 'Archived',
    inbox_snoozed: 'Snoozed',
    inbox_mark_all_as_read: 'Mark all as read',
    inbox_archive_all: 'Archive all',
    inbox_more_actions: 'More actions',
    inbox_item_control: ':action: :title',
    inbox_mark_as_read: 'Mark as read',
    inbox_mark_as_unread: 'Mark as unread',
    inbox_archive: 'Archive',
    inbox_unarchive: 'Move to inbox',
    inbox_snooze: 'Snooze',
    inbox_unsnooze: 'Unsnooze',
    inbox_mute: 'Mute thread',
    inbox_unmute: 'Unmute thread',
    inbox_muted: 'Thread muted',
    inbox_delete: 'Delete',
    inbox_select: 'Select: :title',
    inbox_select_all: 'Select all',
    inbox_selected: ':count selected',
    inbox_selection: 'Selected notifications',
    inbox_read_selected: 'Mark selected as read',
    inbox_unread_selected: 'Mark selected as unread',
    inbox_snooze_selected: 'Snooze selected',
    inbox_unsnooze_selected: 'Unsnooze selected',
    inbox_archive_selected: 'Archive selected',
    inbox_unarchive_selected: 'Move selected to inbox',
    inbox_delete_selected: 'Delete selected',
    inbox_clear_selection: 'Clear selection',
    inbox_show_new: ':count new',
    inbox_snooze_until: 'Snooze until',
    inbox_snoozed_until: 'Snoozed until :time',
    inbox_snooze_later_today: 'Later today',
    inbox_snooze_tomorrow: 'Tomorrow',
    inbox_snooze_next_week: 'Next week',
    inbox_pause: 'Pause notifications',
    inbox_pause_for: 'For :duration',
    inbox_pause_tomorrow: 'Until tomorrow',
    inbox_paused_until: 'Notifications paused until :time',
    inbox_resume: 'Resume',
    inbox_show_more: 'Show :count more',
    inbox_show_less: 'Show less',
    inbox_unread_state: 'Unread',
    inbox_actors_and_other: ':name and :other',
    inbox_actors_and_others: ':name and :count others',
    inbox_empty: 'You have no notifications.',
    inbox_empty_unread: 'You have no unread notifications.',
    inbox_empty_archived: 'You have no archived notifications.',
    inbox_empty_snoozed: 'You have no snoozed notifications.',
    inbox_error: 'The notifications could not be loaded.',
    inbox_retry: 'Try again',
    inbox_categories: 'Categories',
    inbox_all_categories: 'All categories',
    inbox_loading: 'Loading notifications…',
    inbox_load_more: 'Load more',
    inbox_view_all: 'View all notifications',
    inbox_update_failed: 'The notification could not be updated.',
    inbox_toast_view: 'View',
    inbox_toast_view_alt: 'Also in your notifications.',
    inbox_title_count: '(:count) :title',
    inbox_announcement: 'Announcement',

    preferences_title: 'Notification preferences',
    preferences_category: 'Category',
    preferences_toggle: ':category: :channel',
    preferences_locked: 'Always on',
    preferences_global: 'All notifications',
    preferences_global_description: 'Turn a channel off for every category, except those that are always on.',
    preferences_frequency: 'Frequency',
    preferences_frequency_label: ':category: frequency',
    preferences_frequency_instant: 'Instantly',
    preferences_frequency_hourly: 'Hourly digest',
    preferences_frequency_daily: 'Daily digest',
    preferences_frequency_weekly: 'Weekly digest',
    preferences_push_device: 'Push notifications on this device',
    preferences_push_off: 'Off. Turn them on to get notifications on this device, even when the app is closed.',
    preferences_push_on: 'On. This device gets the categories you chose for push notifications.',
    preferences_push_turn_on: 'Turn on for this device',
    preferences_push_turn_off: 'Turn off',
    preferences_push_turning_on: 'Turning on…',
    preferences_push_turning_off: 'Turning off…',
    preferences_push_blocked: "Notifications are blocked for this site. Allow them in your browser's site settings to turn on push notifications.",
    preferences_push_home_screen:
        'On iPhone and iPad, push notifications only work from the Home Screen. Tap Share, choose Add to Home Screen, and open the app from there.',
    preferences_push_insecure: 'Push notifications need a secure connection. Open this site over HTTPS to turn them on.',
    preferences_push_brave:
        'Brave blocks push notifications until you turn on "Use Google services for push messaging" in its privacy settings. Turn it on, then try again.',
    preferences_push_failed: 'Push notifications could not be turned on for this device.',
    preferences_push_failed_off: 'Push notifications could not be turned off for this device.',
    preferences_push_retry: 'Try again',
    preferences_push_devices: 'Other devices with push notifications',
    preferences_push_device_name: ':browser on :platform',
    preferences_push_device_unknown: 'Unknown browser',
    preferences_push_device_active: 'Active :time',
    preferences_push_device_remove: 'Remove',
    preferences_push_device_remove_label: 'Remove :device',
    preferences_notification_hours: 'Notification hours',
    preferences_notification_hours_description:
        'Outside these hours, emails wait and notifications arrive without a toast or a sound. Categories that are always on still send.',
    preferences_notification_hours_start: 'From',
    preferences_notification_hours_end: 'Until',
    preferences_notification_hours_day: 'Notification hours on :day',
    preferences_notification_hours_off: 'Notifications wait all day',
    preferences_notification_hours_add: 'Add hours',
    preferences_notification_hours_add_label: 'Add hours on :day',
    preferences_notification_hours_remove: 'Remove',
    preferences_notification_hours_remove_label: 'Remove :start to :end on :day',
    preferences_empty: 'There are no notification preferences.',
    preferences_loading: 'Loading preferences…',
    preferences_error: 'The preferences could not be loaded.',
    preferences_retry: 'Try again',
    preferences_save_failed: 'Your preferences could not be saved.',
    preferences_push_device_remove_failed: 'The device could not be removed.',
} satisfies Record<string, string>

export type TranslationKey = keyof typeof DEFAULT_TRANSLATIONS

// Without a prototype, so a key such as `__proto__` from a JSON file is stored like any other key.
const translations: Record<string, TranslationValue> = Object.assign(Object.create(null), DEFAULT_TRANSLATIONS)

/** Changes built-in strings for the whole application. Keys you leave out keep their current text. */
export function setTranslations(overrides: Record<string, TranslationValue>): void {
    for (const [key, value] of Object.entries(overrides)) {
        if (value !== undefined) {
            translations[key] = value
        }
    }
}

/** The translation of a key as it was set, or `undefined` for a key without one. */
export const translation = (key: string): TranslationValue | undefined => (Object.hasOwn(translations, key) ? translations[key] : undefined)

/** Replaces the placeholders of a string, or calls a function with the parameters. */
export function formatTranslation(value: TranslationValue, params: TranslationParams = {}): string {
    return typeof value === 'function' ? value(params) : replacePlaceholders(value, params)
}

/** The text of a key with its parameters. A key without a translation renders as the key, so it is easy to spot. */
export function trans(key: string, params: TranslationParams = {}): string {
    const value = translation(key)

    return value === undefined ? key : formatTranslation(value, params)
}

/** The key of a label name, such as `inbox_mark_all_as_read` for `markAllAsRead` with the `inbox_` prefix. */
export const labelKey = (prefix: string, name: string): string => prefix + name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)

/** The English text of a component's labels, by label name. */
export function defaultLabels<Name extends string>(prefix: string, names: readonly Name[]): Record<Name, string> {
    return Object.fromEntries(names.map((name) => [name, DEFAULT_TRANSLATIONS[labelKey(prefix, name) as TranslationKey]])) as Record<Name, string>
}

/** The labels of a component: those it was given, and the translations for the rest. */
export function labelsWith<Name extends string>(
    prefix: string,
    names: readonly Name[],
    overrides?: Readonly<Partial<Record<Name, TranslationValue>>>,
): Record<Name, TranslationValue> {
    const given = (name: Name): TranslationValue | undefined => (overrides && Object.hasOwn(overrides, name) ? overrides[name] : undefined)

    return Object.fromEntries(names.map((name) => [name, given(name) ?? translation(labelKey(prefix, name)) ?? labelKey(prefix, name)])) as Record<
        Name,
        TranslationValue
    >
}
