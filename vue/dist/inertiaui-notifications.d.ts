import { Component } from 'vue';
import { ComponentOptionsMixin } from 'vue';
import { ComponentProvideOptions } from 'vue';
import { ComputedRef } from 'vue';
import { DefineComponent } from 'vue';
import { MaybeRefOrGetter } from 'vue';
import { Placement } from '@inertiaui/vanilla';
import { PublicProps } from 'vue';

declare const __VLS_base: DefineComponent<__VLS_PublicProps, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, {
    action: (item: InboxItem, action: ToastAction<InboxItem>, event: MouseEvent) => any;
    itemClick: (item: InboxItem, event: MouseEvent) => any;
    "update:open": (value: boolean) => any;
}, string, PublicProps, Readonly<__VLS_PublicProps> & Readonly<{
    onAction?: ((item: InboxItem, action: ToastAction<InboxItem>, event: MouseEvent) => any) | undefined;
    onItemClick?: ((item: InboxItem, event: MouseEvent) => any) | undefined;
    "onUpdate:open"?: ((value: boolean) => any) | undefined;
}>, {
    snooze: (now: Date) => SnoozeOption[];
    group: boolean;
    count: "unread" | "unseen";
    href: string;
    icons: Record<string, Component>;
    iconResolver: IconResolverFn | null;
    classes: InboxClasses;
    placement: Placement;
    labels: Partial<InboxLabels>;
    locale: string;
    maxCount: number;
    badge: "count" | "none" | "dot";
}, {}, {}, {}, string, ComponentProvideOptions, false, {}, any>;

declare const __VLS_base_2: DefineComponent<__VLS_Props_2, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, {
    action: (item: InboxItem, action: ToastAction<InboxItem>, event: MouseEvent) => any;
    itemClick: (item: InboxItem, event: MouseEvent) => any;
}, string, PublicProps, Readonly<__VLS_Props_2> & Readonly<{
    onAction?: ((item: InboxItem, action: ToastAction<InboxItem>, event: MouseEvent) => any) | undefined;
    onItemClick?: ((item: InboxItem, event: MouseEvent) => any) | undefined;
}>, {
    preserveUrl: boolean;
    filter: InboxFilter;
    snooze: (now: Date) => SnoozeOption[];
    category: string | null;
    group: boolean;
    manual: boolean;
    icons: Record<string, Component>;
    iconResolver: IconResolverFn | null;
    classes: InboxClasses;
    labels: Partial<InboxLabels>;
    locale: string;
    maxCount: number;
    buffer: number;
}, {}, {}, {}, string, ComponentProvideOptions, false, {}, any>;

declare const __VLS_base_3: DefineComponent<__VLS_Props_3, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, {}, string, PublicProps, Readonly<__VLS_Props_3> & Readonly<{}>, {
    classes: PreferencesClasses;
    labels: Partial<PreferencesLabels>;
    locale: string;
}, {}, {}, {}, string, ComponentProvideOptions, false, {}, any>;

declare const __VLS_export: __VLS_WithSlots< DefineComponent<{
    position?: ToastPosition;
    /** Shows only the toasts whose `toaster` option has this name. */
    name?: string;
    /** The accessible name of the toast region, in place of the `toaster_label` translation; the shortcut is added to it. */
    label?: string;
    /** The accessible name of each dismiss button, in place of the `toast_dismiss` translation; `:title` is replaced with the toast's title. */
    dismissLabel?: TranslationValue;
    /** `KeyboardEvent.code` values and modifier names that focus the newest toast. Pass `[]` to disable. */
    hotkey?: readonly string[];
    /** The words that screen readers announce before a toast's title, in place of the `toast_type_` translations. */
    typeLabels?: ToastTypeLabels;
    /** How many toasts show in the collapsed stack. */
    visibleToasts?: number;
    /** Show every toast at full height instead of stacking them. */
    expand?: boolean;
    /** Show a bar that counts down the time left on timed toasts. */
    progress?: boolean;
    /** Components for icon names that toasts refer to, for toast types, and for the built-in icons, such as `dismiss`. */
    icons?: Record<string, Component>;
    /** Resolves the icons that `icons` does not have, in place of the global resolver of `setIconResolver()`. */
    iconResolver?: IconResolverFn | null;
    /** Class names added to the parts of each toast. */
    classes?: ToastClasses;
    /** Components that render the toasts of a type in place of the default markup, keyed by the type, such as `{ invite: InviteToast }`. */
    components?: Record<string, Component>;
    /** Keep the toasts usable above modal dialogs of other libraries, such as Radix and Reka, and above the notification center's panel. */
    aboveModals?: boolean;
}, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, {}, string, PublicProps, Readonly<{
    position?: ToastPosition;
    /** Shows only the toasts whose `toaster` option has this name. */
    name?: string;
    /** The accessible name of the toast region, in place of the `toaster_label` translation; the shortcut is added to it. */
    label?: string;
    /** The accessible name of each dismiss button, in place of the `toast_dismiss` translation; `:title` is replaced with the toast's title. */
    dismissLabel?: TranslationValue;
    /** `KeyboardEvent.code` values and modifier names that focus the newest toast. Pass `[]` to disable. */
    hotkey?: readonly string[];
    /** The words that screen readers announce before a toast's title, in place of the `toast_type_` translations. */
    typeLabels?: ToastTypeLabels;
    /** How many toasts show in the collapsed stack. */
    visibleToasts?: number;
    /** Show every toast at full height instead of stacking them. */
    expand?: boolean;
    /** Show a bar that counts down the time left on timed toasts. */
    progress?: boolean;
    /** Components for icon names that toasts refer to, for toast types, and for the built-in icons, such as `dismiss`. */
    icons?: Record<string, Component>;
    /** Resolves the icons that `icons` does not have, in place of the global resolver of `setIconResolver()`. */
    iconResolver?: IconResolverFn | null;
    /** Class names added to the parts of each toast. */
    classes?: ToastClasses;
    /** Components that render the toasts of a type in place of the default markup, keyed by the type, such as `{ invite: InviteToast }`. */
    components?: Record<string, Component>;
    /** Keep the toasts usable above modal dialogs of other libraries, such as Radix and Reka, and above the notification center's panel. */
    aboveModals?: boolean;
}> & Readonly<{}>, {
    progress: boolean;
    name: string;
    label: string;
    position: "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";
    hotkey: readonly string[];
    visibleToasts: number;
    expand: boolean;
    typeLabels: Partial<Record< ToastType, string>>;
    icons: Record<string, Component>;
    dismissLabel: TranslationValue;
    iconResolver: IconResolverFn | null;
    classes: Partial<Record<"progress" | "title" | "icon" | "actions" | "toast" | "action" | "description" | "dismiss", string>>;
    components: Record<string, Component>;
    aboveModals: boolean;
}, {}, {}, {}, string, ComponentProvideOptions, false, {}, any>, {
    /** Replaces the content of each toast. */
    toast?(props: {
        toast: Toast;
        dismiss: () => void;
        runAction: (index: number, event: MouseEvent) => void;
    }): unknown;
    /** Replaces the icon of each toast. */
    icon?(props: {
        toast: Toast;
    }): unknown;
}>;

declare const __VLS_export_2: __VLS_WithSlots_2<typeof __VLS_base, __VLS_Slots>;

declare const __VLS_export_3: __VLS_WithSlots_3<typeof __VLS_base_2, __VLS_Slots_2>;

declare const __VLS_export_4: DefineComponent<NotificationItemProps, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, {}, string, PublicProps, Readonly<NotificationItemProps> & Readonly<{}>, {
    snooze: (now: Date) => SnoozeOption[];
    allowedActions: readonly InboxAction[];
    selected: boolean;
    pendingAction: number;
    icons: Record<string, Component>;
    iconResolver: IconResolverFn | null;
    classes: InboxClasses;
    labels: InboxLabels;
    locale: string;
    onSelectedChange: (selected: boolean) => void;
}, {}, {}, {}, string, ComponentProvideOptions, false, {}, any>;

declare const __VLS_export_5: __VLS_WithSlots_4<typeof __VLS_base_3, __VLS_Slots_3>;

declare type __VLS_ModelProps = {
    /** Whether the panel is open. Bind it with `v-model:open` to open and close the panel from elsewhere. */
    'open'?: boolean;
};

declare type __VLS_Props = {
    /** Text of the notification center, in place of the `inbox_` translations; `:count` and `:title` are replaced. */
    labels?: Partial<InboxLabels>;
    /** What the bell shows when there are notifications: the number, a dot, or nothing. */
    badge?: 'count' | 'dot' | 'none';
    /** Which notifications the badge counts: those that arrived since the panel was last opened, or every unread one. */
    count?: 'unseen' | 'unread';
    /** The highest number the badge shows; larger counts show as this number with a plus, such as 99+. */
    maxCount?: number;
    /** The URL of a page with every notification; the panel then links to it. */
    href?: string;
    /** Components for the icon names that notifications refer to, and for the built-in icons, such as `bell`. */
    icons?: Record<string, Component>;
    /** Resolves the icons that `icons` does not have, in place of the global resolver of `setIconResolver()`. */
    iconResolver?: IconResolverFn | null;
    /** Class names added to the parts of the notification center. */
    classes?: InboxClasses;
    /** The locale of relative times and numbers; defaults to the browser's. */
    locale?: string;
    /** Show notifications with the same `InboxMessage::group()` key as one, with a button that shows the others. */
    group?: boolean;
    /** The snooze times to offer, from the current time, in place of the built-in ones. */
    snooze?: (now: Date) => SnoozeOption[];
    /** Where the panel opens next to the bell, such as `bottom-end`. It moves to the other side when there is no room. */
    placement?: Placement;
};

declare type __VLS_Props_2 = {
    /** The name of the page prop that holds `Inbox::scroll()`. */
    data: string;
    /** The filter the page prop was loaded with, in place of the URL's `filter` query parameter; notifications that no longer match, such as archived ones in `all`, are hidden. */
    filter?: InboxFilter;
    /** Text of the list, in place of the `inbox_` translations; `:count` and `:title` are replaced. */
    labels?: Partial<InboxLabels>;
    /** Components for the icon names that notifications refer to, and for the built-in icons, such as `empty`. */
    icons?: Record<string, Component>;
    /** Resolves the icons that `icons` does not have, in place of the global resolver of `setIconResolver()`. */
    iconResolver?: IconResolverFn | null;
    classes?: InboxClasses;
    locale?: string;
    /** How far from the end of the list, in pixels, the next page starts loading. */
    buffer?: number;
    /** Load the next page with a button instead of when the end of the list scrolls into view. */
    manual?: boolean;
    /** Keep the URL when a page loads, instead of adding its cursor. */
    preserveUrl?: boolean;
    /** The category the page prop was loaded with, in place of the URL's `category` query parameter; notifications of other categories that arrive are hidden. */
    category?: string | null;
    /** Show notifications with the same `InboxMessage::group()` key as one, with a button that shows the others. */
    group?: boolean;
    /** The snooze times to offer, from the current time, in place of the built-in ones. */
    snooze?: (now: Date) => SnoozeOption[];
    /** The highest number the tabs and categories show; larger counts show as this number with a plus, such as 99+. */
    maxCount?: number;
};

declare type __VLS_Props_3 = {
    /** Text of the component, in place of the `preferences_` translations; `:category`, `:channel`, `:day`, `:start`, `:end`, `:browser`, `:platform`, `:time`, and `:device` are replaced. */
    labels?: Partial<PreferencesLabels>;
    /** Class names added to the parts of the component. */
    classes?: PreferencesClasses;
    /** The locale of the weekday names of the notification hours and of when other devices were active; defaults to the browser's. */
    locale?: string;
};

declare type __VLS_PublicProps = __VLS_Props & __VLS_ModelProps;

declare type __VLS_Slots = {
    /** Replaces the content of each notification. It receives the props of the built-in `NotificationItem`. */
    item?(props: NotificationItemProps): unknown;
    /** Replaces the text shown when the selected tab has no notifications. */
    empty?(props: {
        filter: InboxFilter;
    }): unknown;
    /** Replaces the content of the bell button: the bell icon and the badge. */
    trigger?(props: NotificationCenterTriggerProps): unknown;
    /** Replaces the badge on the bell. It renders only while the count is above zero. */
    badge?(props: NotificationCenterBadgeProps): unknown;
    /** Replaces the top of the panel, with the title, the bulk actions, and the pause button. */
    header?(props: NotificationCenterHeaderProps): unknown;
    /** Replaces the content of each tab. */
    tab?(props: NotificationCenterTabProps): unknown;
    /** Replaces the spinner while the list loads. */
    loading?(props: Record<string, never>): unknown;
    /** Replaces the message and the button shown when loading the list, or its next page, failed. */
    error?(props: NotificationCenterErrorProps): unknown;
    /** Replaces the bottom of the panel, which links to `href` by default. */
    footer?(props: NotificationCenterFooterProps): unknown;
};

declare type __VLS_Slots_2 = {
    /** Replaces the content of each notification. It receives the props of the built-in `NotificationItem`. */
    item?(props: NotificationItemProps): unknown;
    /** Replaces the text shown when there are no notifications. */
    empty?(props: {
        filter: InboxFilter;
    }): unknown;
    /** Replaces the top of the list, with the bulk actions and the pause button. */
    header?(props: NotificationListHeaderProps): unknown;
    /** Replaces the content of each tab. */
    tab?(props: NotificationCenterTabProps): unknown;
};

declare type __VLS_Slots_3 = {
    /** Replaces the label, badge, and description of each category. */
    category?(props: {
        category: PreferenceCategory;
    }): unknown;
    /** Replaces the label and description of each group. */
    group?(props: {
        group: PreferenceGroup;
    }): unknown;
    /** Replaces the label of each channel's column. */
    channel?(props: {
        channel: PreferenceChannel;
    }): unknown;
    /** Replaces the text shown when there are no categories. */
    empty?(): unknown;
};

declare type __VLS_WithSlots<T, S> = T & {
    new (): {
        $slots: S;
    };
};

declare type __VLS_WithSlots_2<T, S> = T & {
    new (): {
        $slots: S;
    };
};

declare type __VLS_WithSlots_3<T, S> = T & {
    new (): {
        $slots: S;
    };
};

declare type __VLS_WithSlots_4<T, S> = T & {
    new (): {
        $slots: S;
    };
};

/**
 * A click on a notification or on an action, with what the package reads from it. Every handler takes this one type and
 * each guard picks its parts from it, since a copy without `target` would take every click on a link for one on a button.
 */
declare type ActionClick = Pick<MouseEvent, 'button' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'preventDefault'> & {
    defaultPrevented?: boolean;
    target?: EventTarget | null;
};

/** Which notifications that arrive in real time show as a toast. */
export declare type ArrivalToasts = 'requested' | 'all' | 'none';

declare const BATCH_ACTIONS: readonly ["read", "unread", "seen", "archive", "unarchive", "snooze", "unsnooze", "delete"];

/** The types that the Toaster has an icon and a color for. */
export declare type BuiltInToastType = 'default' | 'success' | 'info' | 'warning' | 'error' | 'loading';

export declare const DEFAULT_ERROR_MESSAGES: ErrorToastMessages;

/** Matches the default `flash_key` in `config/inertia-notifications.php`. */
declare const DEFAULT_FLASH_KEY = "inertiaui";

/** The English text of the notification center. Each label is the translation with the `inbox_` key, such as `inbox_mark_all_as_read` for `markAllAsRead`. */
export declare const DEFAULT_INBOX_LABELS: Record<"error" | "delete" | "all" | "unread" | "snoozed" | "archived" | "archive" | "unarchive" | "snooze" | "unsnooze" | "mute" | "pause" | "loading" | "snoozedUntil" | "title" | "muted" | "announcement" | "loadMore" | "markAsRead" | "markAsUnread" | "unmute" | "resume" | "markAllAsRead" | "archiveAll" | "pausedUntil" | "categories" | "retry" | "bell" | "bellNew" | "bellPaused" | "moreActions" | "itemControl" | "select" | "selectAll" | "selected" | "selection" | "readSelected" | "unreadSelected" | "snoozeSelected" | "unsnoozeSelected" | "archiveSelected" | "unarchiveSelected" | "deleteSelected" | "clearSelection" | "showNew" | "snoozeUntil" | "snoozeLaterToday" | "snoozeTomorrow" | "snoozeNextWeek" | "pauseFor" | "pauseTomorrow" | "showMore" | "showLess" | "unreadState" | "actorsAndOther" | "actorsAndOthers" | "empty" | "emptyUnread" | "emptyArchived" | "emptySnoozed" | "allCategories" | "viewAll", string>;

/** The English text of `<NotificationPreferences>`. Each label is the translation with the `preferences_` key, such as `preferences_locked` for `locked`. */
export declare const DEFAULT_PREFERENCES_LABELS: Record<"error" | "loading" | "title" | "category" | "retry" | "empty" | "toggle" | "frequency" | "notificationHours" | "locked" | "global" | "globalDescription" | "frequencyLabel" | "frequencyInstant" | "frequencyHourly" | "frequencyDaily" | "frequencyWeekly" | "pushDevice" | "pushOff" | "pushOn" | "pushTurnOn" | "pushTurnOff" | "pushTurningOn" | "pushTurningOff" | "pushBlocked" | "pushHomeScreen" | "pushInsecure" | "pushBrave" | "pushFailed" | "pushFailedOff" | "pushRetry" | "pushDevices" | "pushDeviceName" | "pushDeviceUnknown" | "pushDeviceActive" | "pushDeviceRemove" | "pushDeviceRemoveLabel" | "notificationHoursDescription" | "notificationHoursStart" | "notificationHoursEnd" | "notificationHoursDay" | "notificationHoursOff" | "notificationHoursAdd" | "notificationHoursAddLabel" | "notificationHoursRemove" | "notificationHoursRemoveLabel", string>;

/**
 * The English text of every built-in string. Each key starts with the part of the package it belongs to: `toaster_`,
 * `toast_`, `error_toast_`, `inbox_` for the notification center and the `NotificationList`, and `preferences_`.
 */
declare const DEFAULT_TRANSLATIONS: {
    toaster_label: string;
    toaster_label_with_hotkey: string;
    toaster_hotkey_alt: string;
    toaster_hotkey_ctrl: string;
    toaster_hotkey_meta: string;
    toaster_hotkey_shift: string;
    toaster_hotkey_separator: string;
    toast_dismiss: string;
    toast_count: string;
    toast_type_default: string;
    toast_type_success: string;
    toast_type_info: string;
    toast_type_warning: string;
    toast_type_error: string;
    toast_type_loading: string;
    error_toast_403: string;
    error_toast_419: string;
    error_toast_419_description: string;
    error_toast_429: string;
    error_toast_429_description: string;
    error_toast_5xx: string;
    error_toast_5xx_description: string;
    error_toast_network: string;
    error_toast_network_description: string;
    inbox_title: string;
    inbox_bell: string;
    inbox_bell_new: string;
    inbox_bell_paused: string;
    inbox_all: string;
    inbox_unread: string;
    inbox_archived: string;
    inbox_snoozed: string;
    inbox_mark_all_as_read: string;
    inbox_archive_all: string;
    inbox_more_actions: string;
    inbox_item_control: string;
    inbox_mark_as_read: string;
    inbox_mark_as_unread: string;
    inbox_archive: string;
    inbox_unarchive: string;
    inbox_snooze: string;
    inbox_unsnooze: string;
    inbox_mute: string;
    inbox_unmute: string;
    inbox_muted: string;
    inbox_delete: string;
    inbox_select: string;
    inbox_select_all: string;
    inbox_selected: string;
    inbox_selection: string;
    inbox_read_selected: string;
    inbox_unread_selected: string;
    inbox_snooze_selected: string;
    inbox_unsnooze_selected: string;
    inbox_archive_selected: string;
    inbox_unarchive_selected: string;
    inbox_delete_selected: string;
    inbox_clear_selection: string;
    inbox_show_new: string;
    inbox_snooze_until: string;
    inbox_snoozed_until: string;
    inbox_snooze_later_today: string;
    inbox_snooze_tomorrow: string;
    inbox_snooze_next_week: string;
    inbox_pause: string;
    inbox_pause_for: string;
    inbox_pause_tomorrow: string;
    inbox_paused_until: string;
    inbox_resume: string;
    inbox_show_more: string;
    inbox_show_less: string;
    inbox_unread_state: string;
    inbox_actors_and_other: string;
    inbox_actors_and_others: string;
    inbox_empty: string;
    inbox_empty_unread: string;
    inbox_empty_archived: string;
    inbox_empty_snoozed: string;
    inbox_error: string;
    inbox_retry: string;
    inbox_categories: string;
    inbox_all_categories: string;
    inbox_loading: string;
    inbox_load_more: string;
    inbox_view_all: string;
    inbox_update_failed: string;
    inbox_toast_view: string;
    inbox_toast_view_alt: string;
    inbox_title_count: string;
    inbox_announcement: string;
    preferences_title: string;
    preferences_category: string;
    preferences_toggle: string;
    preferences_locked: string;
    preferences_global: string;
    preferences_global_description: string;
    preferences_frequency: string;
    preferences_frequency_label: string;
    preferences_frequency_instant: string;
    preferences_frequency_hourly: string;
    preferences_frequency_daily: string;
    preferences_frequency_weekly: string;
    preferences_push_device: string;
    preferences_push_off: string;
    preferences_push_on: string;
    preferences_push_turn_on: string;
    preferences_push_turn_off: string;
    preferences_push_turning_on: string;
    preferences_push_turning_off: string;
    preferences_push_blocked: string;
    preferences_push_home_screen: string;
    preferences_push_insecure: string;
    preferences_push_brave: string;
    preferences_push_failed: string;
    preferences_push_failed_off: string;
    preferences_push_retry: string;
    preferences_push_devices: string;
    preferences_push_device_name: string;
    preferences_push_device_unknown: string;
    preferences_push_device_active: string;
    preferences_push_device_remove: string;
    preferences_push_device_remove_label: string;
    preferences_notification_hours: string;
    preferences_notification_hours_description: string;
    preferences_notification_hours_start: string;
    preferences_notification_hours_end: string;
    preferences_notification_hours_day: string;
    preferences_notification_hours_off: string;
    preferences_notification_hours_add: string;
    preferences_notification_hours_add_label: string;
    preferences_notification_hours_remove: string;
    preferences_notification_hours_remove_label: string;
    preferences_empty: string;
    preferences_loading: string;
    preferences_error: string;
    preferences_retry: string;
    preferences_save_failed: string;
    preferences_push_device_remove_failed: string;
};

export declare interface DurationOptions {
    /**
     * Milliseconds that toasts without a duration stay open. A function decides per toast, including errors.
     * By default, the duration grows with the length of the toast, from 5 to 12 seconds.
     */
    duration?: number | ((toast: ToastContent) => number | null);
    /** Keep error toasts open until the user dismisses them. Defaults to `true`. */
    persistentErrors?: boolean;
    /** Multiplies the duration of every timed toast, such as for users who need more time to read. Defaults to `1`. */
    durationScale?: number;
    /** Set to `false` to keep every toast open until the user dismisses it. */
    autoDismiss?: boolean;
}

/** The parts of a Laravel Echo channel that the notification center uses. */
export declare interface EchoChannelLike {
    listen(event: string, callback: (payload: unknown) => void): unknown;
    stopListening(event: string, callback?: (payload: unknown) => void): unknown;
}

/** The parts of Laravel Echo that the notification center uses, from `laravel-echo` or an `@laravel/echo-*` package. */
export declare interface EchoLike {
    private(channel: string): EchoChannelLike;
    socketId(): string | null | undefined;
    connector?: {
        onConnectionChange?(callback: (status: string) => void): unknown;
    };
}

export declare interface ErrorToastContent {
    title: string;
    description?: string;
}

/**
 * Toasts for failed requests, instead of Inertia's error page dialog. Keys are HTTP status codes, `5xx` for any
 * server error, and `network` for requests that got no response. `false` leaves a status to Inertia.
 */
export declare type ErrorToastMessages = Partial<Record<number | '5xx' | 'network', ErrorToastContent | false>>;

/** A toast as the server flashes it, under `toasts` in the package's flash data. */
export declare interface FlashedToast {
    /** Unique per flash. */
    uuid: string;
    id?: string;
    type: ToastType;
    title: string;
    description?: string;
    /** Absent for the frontend default; `null` for a persistent toast. */
    duration?: number | null;
    actions?: Array<Omit<ToastAction, 'onClick'>>;
    icon?: string | false;
    /** Set with `->image()`. */
    image?: string;
    dismissible?: boolean;
    position?: ToastPosition;
    toaster?: string;
    /** Set with `->with()`. */
    data?: Record<string, unknown>;
    /** Set with `->progress()`, from 0 to 1. */
    progress?: number;
}

/** Whether the frequency of the category changes anything: the user receives the category on a channel that digests hold. */
declare const frequencyApplies: (category: PreferenceCategory, channels: readonly PreferenceChannel[]) => boolean;

/**
 * Groups notifications by their group key, at the place of the newest one. Notifications without a key stay alone, and
 * so does every notification when `group` is false.
 */
export declare function groupItems(items: readonly InboxItem[], group?: boolean): InboxGroup[];

declare interface HttpResponseLike {
    status?: number;
    data: unknown;
    headers: Record<string, string>;
}

/** Where an icon renders, such as `{ component: 'NotificationCenter', part: 'bell' }`, passed as the second argument of a resolver. */
export declare type IconContext = Record<string, unknown>;

/** Returns the component, or the name of a registered component, for an icon name, or `null` or `undefined` to keep the built-in icon. */
export declare type IconResolverFn = (icon: string, context: IconContext) => Component | string | null | undefined;

/** What users may do with their notifications besides reading them, as the server's `inbox.actions` config offers it. */
export declare type InboxAction = 'snooze' | 'archive' | 'mute' | 'delete';

/** The methods of the store that the `useNotifications()` hooks return, for building a custom bell or panel. */
declare type InboxActions = Omit<InboxStore, 'subscribe' | 'getSnapshot' | 'connect' | 'sync' | 'apply' | 'belongs' | 'remember' | 'onArrival' | 'onChange' | 'getServerSnapshot' | 'loadArrival'>;

/** The person or thing that caused a notification, such as the user who commented. */
export declare interface InboxActor {
    name?: string;
    avatar?: string;
}

/** What `batch()` does to the notifications it is given. */
export declare type InboxBatchAction = (typeof BATCH_ACTIONS)[number];

/** A change of the notification center, from the user's other sessions or from the server's response to a change. */
export declare type InboxChange = {
    kind: 'item';
    id: string;
    readAt: string | null;
    seenAt: string | null;
    archivedAt: string | null;
    snoozedUntil: string | null;
    result: string | null;
}
/**
* Bulk changes cover the notifications created before `before`, and those created at that time whose IDs are in `ids`, or all of them
* when `ids` is null. A `category` limits them to the notifications of that category.
*/
| {
    kind: 'read' | 'seen';
    before: string;
    ids: readonly string[] | null;
    category: string | null;
} | {
    kind: 'archive';
    before: string;
    ids: readonly string[] | null;
    category: string | null;
    onlyRead: boolean;
}
/** The notifications with these IDs were deleted, such as by the user or by `Inbox::retract()` on the server. */
| {
    kind: 'delete';
    ids: readonly string[];
}
/** The server replaced the message of the notification with `Inbox::update()`. The item holds its new title, body, and data. */
| {
    kind: 'update';
    item: InboxItem;
}
/** The notifications with these IDs were changed at `at`, such as marked as read with `batch()`. A snooze lasts `until`. */
| {
    kind: 'items';
    action: Exclude<InboxBatchAction, 'delete'>;
    ids: readonly string[];
    at: string;
    until?: string;
}
/** The user muted or unmuted the thread of the group key, with `mute()` or `unmute()`. */
| {
    kind: 'mute';
    group: string;
    muted: boolean;
}
/** The user paused notifications until `until` with `pause()`, or resumed them with `resume()`, when it is `null`. */
| {
    kind: 'pause';
    until: string | null;
};

/** Class names added to the parts of the notification center and its notifications. */
export declare interface InboxClasses {
    bell?: string;
    badge?: string;
    panel?: string;
    list?: string;
    item?: string;
    media?: string;
    title?: string;
    body?: string;
    time?: string;
    action?: string;
    /** The result of an action that ran, such as "Approved", in place of the actions. */
    result?: string;
    /** The actors of a notification that later ones collapsed into, such as "Sophie and 3 others". */
    actors?: string;
    control?: string;
}

export declare interface InboxCounts {
    /** Notifications in the inbox that the user has not read. */
    unread: number;
    /** Notifications in the inbox that arrived since the user last opened it. */
    unseen: number;
}

/** A built-in filter of the notification list, or the key of a tab that the application added in the `inbox.tabs` config. */
export declare type InboxFilter = 'all' | 'unread' | 'snoozed' | 'archived' | (string & {});

/** A notification with the notifications of the same group that follow it in the list. */
export declare interface InboxGroup {
    /** The same while the group's notifications change: `group:` and the group key, or the notification's ID when it has no group. */
    key: string;
    item: InboxItem;
    others: InboxItem[];
}

/** A notification in the notification center, as the server sends it. */
export declare interface InboxItem {
    id: string;
    type: string;
    title: string;
    body: string | null;
    icon: string | null;
    image: string | null;
    url: string | null;
    actions: readonly ToastAction<InboxItem>[];
    actor: InboxActor | null;
    /** The newest actors of a notification that later ones collapsed into with `InboxMessage::collapse()`, newest first. */
    actors: readonly InboxActor[];
    /** The number of different actors, also those that `actors` leaves out. */
    actorCount: number;
    /** The number of notifications that collapsed into this one, including itself. */
    total: number;
    category: string | null;
    group: string | null;
    /** The type of the toast that `InboxMessage::toast()` asked for, shown when the notification arrives in real time. */
    toast: ToastType | null;
    /** Extra data from `InboxMessage::with()`. */
    data: Record<string, unknown>;
    readAt: string | null;
    seenAt: string | null;
    archivedAt: string | null;
    /** The notification is left out of the inbox and its counts until this time. */
    snoozedUntil: string | null;
    /** The result of an action that ran, such as "Approved", which shows in place of the actions. */
    result: string | null;
    /** Whether the user muted the thread of the notification's group key, so later notifications in it no longer reach them. */
    muted: boolean;
    /** Sent outside the user's notification hours or while they paused, so it arrives without a toast, a sound, or a desktop notification. */
    quiet?: true;
    createdAt: string;
    /** When the server read this copy of the notification, in microseconds, which orders it against other copies and changes. `null` when unknown. */
    revision: number | null;
    /** Whether this is an announcement, which `Announcement::publish()` stores once for every user in its audience. */
    announcement: boolean;
    /** The announcement leaves the notification center at this time. `null` for notifications and announcements without an expiry. */
    expiresAt: string | null;
}

/** The text of the notification center: strings with placeholders, or functions that receive the parameters. */
export declare type InboxLabels = Record<keyof typeof DEFAULT_INBOX_LABELS, TranslationValue>;

export declare interface InboxState {
    /** The URL of the inbox routes, from the shared prop; `undefined` until a signed-in page was shown. */
    url: string | undefined;
    /** An opaque identity of the signed-in user, from the shared prop. The store forgets everything when it changes. */
    user: string | undefined;
    /** The private channel that receives the user's broadcast notifications, from the shared prop. */
    channel: string | null;
    /** The private channel that announcements are broadcast on, from the shared prop. `null` unless the server broadcasts them. */
    announcementsChannel: string | null;
    /**
     * What the user may do with notifications besides reading them, from the server's `inbox.actions` config. The panel
     * shows no buttons or tabs for the other actions, and the store skips them.
     */
    allowedActions: readonly InboxAction[];
    /**
     * Whether the user may select notifications to change them together, from the server's `inbox.selectable` config.
     * While it is `false`, the panel has no checkboxes, and `batch()` only marks notifications as seen.
     */
    selectable: boolean;
    /** The categories that the panel filters by, with their labels, in order, from the server's `inbox.category_filter` config. */
    categoryFilter: Readonly<Record<string, string>>;
    /** The tabs that the application added in the server's `inbox.tabs` config, by key. */
    tabs: Readonly<Record<string, InboxTab>>;
    counts: InboxCounts;
    /** The notifications the panel loaded for `filter`, and those that arrived since, with the user's changes applied. */
    items: readonly InboxItem[];
    /** Notifications that arrived in real time, newest first, without the user's changes. Lists from pages show them first. */
    arrived: readonly InboxItem[];
    filter: InboxFilter;
    /** The category the panel's list shows, or `null` for every category. */
    category: string | null;
    /** The unread notifications in the inbox, by category. Categories without unread notifications are left out. */
    categoryCounts: Readonly<Record<string, number>>;
    status: 'idle' | 'loading' | 'ready' | 'error';
    loadingMore: boolean;
    /** Loading the next page failed; it loads again only when asked with `loadMore({ retry: true })` or when the list reloads. */
    moreFailed: boolean;
    hasMore: boolean;
    /** The index of the running action, by notification ID. */
    pendingActions: Readonly<Record<string, number>>;
    /**
     * Notifications are paused until this time, so they arrive without a toast, a sound, or a desktop notification, and
     * emails wait. `null` while they are not paused, once the time has passed, and while the application does not offer pausing.
     */
    pausedUntil: string | null;
    /** Whether the application offers pausing notifications, from the shared prop. */
    canPause: boolean;
    /** The times of the pause button, from the server's `pause.presets` config: numbers of minutes, and `'tomorrow'`. */
    pausePresets: readonly PausePreset[];
}

export declare interface InboxStore {
    subscribe(listener: () => void): () => void;
    getSnapshot(): InboxState;
    /**
     * The state before any page was shown, which the server renders. Components render it until they mount, so the
     * first render in the browser matches the server's HTML even when the store received the first page before.
     */
    getServerSnapshot(): InboxState;
    connect(bindings: InertiaBindings, options?: {
        prop?: string;
        onFailure?: (error: unknown) => void;
    }): void;
    /**
     * Reads the counts and URL from the shared prop of a page, and forgets everything when the user signed out or
     * another user signed in. Ignores pages from history and the prefetch cache, whose props may be outdated.
     */
    sync(props: Record<string, unknown> | undefined, type: NavigationType_2): void;
    /** Loads the first page of the filter, in one category or every one. A filter without a category shows every category. */
    load(filter?: InboxFilter, category?: string | null): Promise<void>;
    /** Loads the next page. After a failure, only with `retry`, so a list that stays in view does not try again and again. */
    loadMore(options?: {
        retry?: boolean;
    }): Promise<void>;
    /** Requests the counts from the server. */
    refresh(): Promise<void>;
    /**
     * Requests a notification or announcement that the server broadcast as new without its content, such as a published
     * announcement, and adds it like `receive()`. The server only finds it for the users who see it, so for other users,
     * and in another context than the item's own, nothing changes. Returns the notification, or `undefined`.
     */
    loadArrival(id: string, context?: string | null): Promise<InboxItem | undefined>;
    /**
     * Adds a notification that arrived in real time, such as from Laravel Echo, and counts it unless the counts
     * already include it. Returns the notification, or `undefined` when it is invalid or arrived before.
     *
     * A notification that collapsed into one the store already has comes with the `counts` after it, so it replaces
     * the earlier copy in the counts instead of adding to them.
     */
    receive(value: unknown, counts?: unknown): InboxItem | undefined;
    /**
     * Calls the listener once for each notification that `receive()` adds, such as one from Laravel Echo or a snoozed
     * notification that came back, after the store shows it. Returns a function that stops it.
     */
    onArrival(listener: (item: InboxItem) => void): () => void;
    /** Applies a change from another session of the user, with the counts after it: an `InboxChanged` broadcast. */
    receiveChange(value: unknown): void;
    /**
     * Calls the listener once for each change that `receiveChange()` applies, such as a notification that the server
     * updated or retracted. Returns a function that stops it.
     */
    onChange(listener: (change: InboxChange) => void): () => void;
    /** Applies the user's changes, such as marking as read, to a notification from a page prop. */
    apply(item: InboxItem): InboxItem;
    /** Whether a notification belongs in the list for the filter and category, after the user's changes. */
    belongs(item: InboxItem, filter: InboxFilter, category?: string | null): boolean;
    /** Remembers notifications that a page shows, so bulk actions cover them. */
    remember(items: readonly InboxItem[]): void;
    /** Marks a notification as read: one that a list shows, or the ID of one, such as from a toast. */
    markAsRead(item: InboxItem | string): Promise<void>;
    markAsUnread(item: InboxItem): Promise<void>;
    /** Archives the notification. Does nothing while the server's `inbox.actions` config leaves out archiving, like `unarchive()`. */
    archive(item: InboxItem): Promise<void>;
    unarchive(item: InboxItem): Promise<void>;
    /**
     * Leaves the notification out of the inbox and its counts until the given time. Does nothing while the server's
     * `inbox.actions` config leaves out snoozing, like `unsnooze()`.
     */
    snooze(item: InboxItem, until: Date | string): Promise<void>;
    unsnooze(item: InboxItem): Promise<void>;
    /** Deletes the notification for good. Does nothing unless the server's `inbox.actions` config offers deleting. */
    delete(item: InboxItem): Promise<void>;
    /**
     * Saves the `result` of the notification's action at the index, such as "Approved", which then shows in place of its
     * actions. Takes a notification that a list shows, or the ID of one, such as from a toast. `runAction()` calls it
     * once an action with a result ran.
     */
    complete(item: InboxItem | string, index: number): Promise<void>;
    /**
     * Mutes the thread of the notification's group key, so later notifications in it no longer reach the user, unless
     * they mention the user. The notifications in it that the user has stay. Does nothing without a group key, and while
     * the server's `inbox.actions` config leaves out muting, like `unmute()`.
     */
    mute(item: InboxItem): Promise<void>;
    /** Unmutes the thread of the notification's group key. */
    unmute(item: InboxItem): Promise<void>;
    /**
     * Pauses notifications until the given time: they arrive without a toast, a sound, or a desktop notification, and
     * emails wait. Does nothing while the application does not offer pausing.
     */
    pause(until: Date | string): Promise<void>;
    /** Resumes paused notifications. */
    resume(): Promise<void>;
    /**
     * Marks the given notifications as read, unread, or seen, archives or unarchives them, snoozes them until the given
     * time or unsnoozes them, or deletes them, in one request for every 100 notifications. Does nothing for an action
     * that the server's `inbox.actions` config leaves out, such as deleting by default, and for every action but
     * `'seen'` while the server's `inbox.selectable` config is off.
     */
    batch(action: InboxBatchAction, items: readonly InboxItem[], until?: Date | string): Promise<void>;
    /**
     * Marks the notifications of the selected category, or of every category, as read. A `category` option, or `null`
     * for every category, takes the place of the selected one, such as the category of a page's `NotificationList`.
     */
    markAllAsRead(options?: {
        category?: string | null;
    }): Promise<void>;
    /** Marks every notification as seen, whatever the selected category. */
    markAllAsSeen(): Promise<void>;
    /**
     * Archives the notifications of the selected category, or of every category, or only the read ones. Like
     * `markAllAsRead()`, it takes a `category` option. Does nothing while the server's `inbox.actions` config leaves
     * out archiving.
     */
    archiveAll(options?: {
        onlyRead?: boolean;
        category?: string | null;
    }): Promise<void>;
    /**
     * Call when a panel that shows the list opens: loads the list when it is not loaded yet or new notifications
     * arrived, then marks the loaded notifications as seen. Notifications that arrive while it is open are seen too.
     * With the panel's tabs, a list of another filter switches to the first tab. With the panel's categories, a list
     * of another category, which another panel selected, switches to every category. A panel that marks the
     * notifications it shows as seen itself, such as the `NotificationCenter`, passes `markAllAsSeen: false`.
     */
    opened(tabs?: readonly InboxFilter[], options?: {
        markAllAsSeen?: boolean;
        categories?: readonly string[];
    }): Promise<void>;
    /** Call when a panel that called `opened()` closes, with the same options. */
    closed(options?: {
        markAllAsSeen?: boolean;
    }): void;
    /**
     * Marks the notification as read and visits its URL, if it has one. A modified click, such as one that opens a new
     * tab, is left to the browser, and a click whose default was prevented, such as by an `onItemClick` listener, does
     * nothing.
     */
    open(item: InboxItem, event?: ActionClick): void;
    /**
     * Marks the notification as read and runs one of its actions. A click on a link that opens with a modifier key, in a
     * new tab, or in the browser, or that leads to another origin, is left to the browser; everything else runs the
     * action, such as a click on a button. A click whose default was prevented, such as by an `onAction` listener, does
     * nothing. An action with a `result` saves it with `complete()` once it succeeded, and a link that the browser loads
     * in this tab waits for the result to save.
     */
    runAction(item: InboxItem, index: number, event?: ActionClick): void;
}

/** The store shared by every notification center and list in the application. */
export declare const inboxStore: InboxStore;

/** A tab that the application added in the `inbox.tabs` config: the notifications of a category, with the given data. */
export declare interface InboxTab {
    label: string;
    category: string | null;
    /** Values of the `InboxMessage::with()` data that the notifications have. */
    data: Readonly<Record<string, string | number | boolean>>;
}

/** The parts of the Inertia adapter the core uses; each framework package passes its own. */
declare interface InertiaBindings {
    onFlash(listener: (flash: Record<string, unknown>) => void): void;
    /** Returns the headers to send with a request. */
    onRequest(listener: (config: {
        url: string;
        headers?: Record<string, unknown>;
    }) => Record<string, unknown> | undefined): void;
    onResponse(listener: (response: HttpResponseLike) => void): void;
    onError(listener: (error: unknown) => void): void;
    /** Return `false` to stop Inertia from showing the response in its error dialog. */
    onHttpException(listener: (response: HttpResponseLike) => boolean | void): void;
    /**
     * Runs when a page is shown or updated: the first page, after every visit (including a redirect back to the same
     * URL and a partial reload), and after back or forward navigation.
     */
    onNavigate(listener: (props: Record<string, unknown>, type: NavigationType_2) => void): void;
    visit(href: string, options: Record<string, unknown>): void;
    /** Sends a JSON request through Inertia's HTTP client, which adds the CSRF token, and returns the parsed body. */
    request(method: 'get' | 'post', url: string, data?: Record<string, unknown>): Promise<unknown>;
    /**
     * Sends the socket ID that `resolve` returns with Inertia's requests, as `X-Socket-Id`, so the server can leave
     * this browser out of a broadcast with `toOthers()`. Ignored when the application chose its own resolver.
     */
    useSocketId(resolve: () => string | null | undefined): void;
}

/**
 * The package's part of Inertia's flash data. Add it to your own flash data type; pass the `flash_key` from
 * `config/inertia-notifications.php` when you changed it.
 *
 * @example
 * declare module '@inertiajs/core' {
 *     export interface InertiaConfig {
 *         flashDataType: InertiaUIFlashData & { message?: string }
 *     }
 * }
 */
export declare type InertiaUIFlashData<Key extends string = typeof DEFAULT_FLASH_KEY> = {
    [K in Key]?: {
        toasts?: FlashedToast[];
    };
};

/**
 * Call before `createInertiaApp()` so toasts flashed on pages without a Toaster are kept until one renders.
 * The Toaster also calls it, so it is only required to change options.
 */
export declare function initNotifications(options?: NotificationsOptions): void;

/** Whether the notification is snoozed until a time that has not come yet, by the given clock in milliseconds or else now. */
export declare const isSnoozed: (item: Pick<InboxItem, "snoozedUntil">, now?: number) => boolean;

/** How a page was shown. Pages from `history` and the prefetch cache (`cached`) may carry outdated props. */
declare type NavigationType_2 = 'initial' | 'visit' | 'history' | 'cached';

export declare const NotificationCenter: typeof __VLS_export_2;

/** What the `badge` slot and `renderBadge` prop receive. They render only while the count is above zero. */
export declare interface NotificationCenterBadgeProps {
    count: number;
    /** The count as the built-in badge shows it, such as "99+". */
    text: string;
}

/** What the `error` slot and `renderError` prop receive: loading the list failed, or with `more`, its next page. */
export declare interface NotificationCenterErrorProps {
    more: boolean;
    retry(): void;
}

/** What the `footer` slot and `renderFooter` prop receive: the bottom of the panel. */
export declare interface NotificationCenterFooterProps {
    href: string | undefined;
    close(): void;
}

/** What the `header` slot and `renderHeader` prop receive: the top of the panel, with the title, the bulk actions, and the pause button. */
export declare interface NotificationCenterHeaderProps {
    /** The ID that names the panel. Give it to your heading, so the panel keeps its accessible name. */
    titleId: string;
    title: string;
    filter: InboxFilter;
    category: string | null;
    /** The unread notifications of the selected category, or of every category, which `markAllAsRead()` changes. */
    unread: number;
    markAllAsRead(): void;
    /** Whether the built-in header shows the **Archive all** button: the All list shows, and the application offers archiving. */
    canArchiveAll: boolean;
    /** Archives the notifications of the selected category, or of every category. Does nothing while the application does not offer archiving. */
    archiveAll(): void;
    /** What the user may do with notifications besides reading them, from the server's `inbox.actions` config. */
    allowedActions: readonly InboxAction[];
    close(): void;
    /** Whether the built-in header shows the pause button: the application offers pausing. */
    canPause: boolean;
    /** The end of the pause, or `null` while notifications are not paused. */
    pausedUntil: string | null;
    /** The times of the pause button, from the server's `pause.presets` config. */
    pauseOptions: readonly PauseOption[];
    /** Pauses notifications for one of `pauseOptions`, counted from the call, like a click on a time of the pause button. */
    pause(option: PauseOption): void;
    resume(): void;
}

/** What the `tab` slot and `renderTab` prop receive: the content of each tab. */
export declare interface NotificationCenterTabProps {
    filter: InboxFilter;
    label: string;
    selected: boolean;
    /** The unread count on the Unread tab, or `null` on the other tabs. */
    count: number | null;
}

/** What the `trigger` slot and `renderTrigger` prop receive: the content of the bell button. */
export declare interface NotificationCenterTriggerProps {
    open: boolean;
    /** The count the badge shows, as chosen with the `count` prop. */
    count: number;
    counts: InboxCounts;
}

export declare const NotificationItem: typeof __VLS_export_4;

export declare interface NotificationItemProps {
    item: InboxItem;
    /** The current time in milliseconds, for the relative time and whether the snooze has ended. Keep it current, or an ended snooze keeps showing. */
    now: number;
    /** The text of the item; defaults to the `inbox_` translations. */
    labels?: InboxLabels;
    /** Components for the icon names that notifications refer to, and for the built-in icons, such as `archive`. */
    icons?: Record<string, Component>;
    /** Resolves the icons that `icons` does not have, in place of the global resolver of `setIconResolver()`. */
    iconResolver?: IconResolverFn | null;
    classes?: InboxClasses;
    locale?: string;
    /** The index of the action that is running, from `pendingActions` of the inbox state. */
    pendingAction?: number;
    /** The snooze times to offer, from the current time, in place of the built-in ones. */
    snooze?: (now: Date) => SnoozeOption[];
    /**
     * The actions that the item shows buttons for, from `allowedActions` of the inbox state: snooze, archive, mute, and
     * delete. Defaults to every action but deleting, like the server's `inbox.actions` config.
     */
    allowedActions?: readonly InboxAction[];
    /** Whether the notification is selected, for the actions of the selection bar. */
    selected?: boolean;
    /** Called when the user selects or deselects the notification. Without it, the item has no checkbox. */
    onSelectedChange?: (selected: boolean) => void;
}

export declare const NotificationList: typeof __VLS_export_3;

/** What the `header` slot and `renderHeader` prop of the `NotificationList` receive: the bulk actions and the pause button above the list. */
export declare type NotificationListHeaderProps = Omit<NotificationCenterHeaderProps, 'titleId' | 'title' | 'close'>;

export declare const NotificationPreferences: typeof __VLS_export_5;

export declare interface NotificationsOptions extends StoreOptions {
    /** The Inertia flash key that carries toasts. Must match `flash_key` in `config/inertia-notifications.php`. */
    flashKey?: string;
    /** Show a toast when a request fails. `true` uses the `error_toast_` translations; an object changes or adds messages. Defaults to `false`. */
    errorToasts?: boolean | ErrorToastMessages;
    inbox?: {
        /** The path of the shared prop with the counts. Must match `inbox.shared_prop` in `config/inertia-notifications.php`. */
        prop?: string;
        /**
         * Laravel Echo, to show notifications the moment they arrive and the changes the user makes in other sessions.
         * Pass the instance, or a function that returns it, such as `echo` from `@laravel/echo-vue`. `null` stops listening.
         */
        echo?: EchoLike | (() => EchoLike | undefined) | null;
        /**
         * Which notifications that arrive in real time also show as a toast: those whose message calls `toast()`
         * (`requested`, the default), every notification (`all`), or none (`none`).
         */
        arrivalToasts?: ArrivalToasts;
        /** Milliseconds between requests for the counts, such as for applications without Echo. Paused while the tab is hidden. Off by default. */
        poll?: number | false;
        /**
         * Runs once for each notification that arrives in real time, such as from Echo or a snoozed notification that
         * came back, after the notification center shows it and before its toast.
         */
        onArrival?: (item: InboxItem) => void;
        /** Shows the unread count in the title of every tab, such as "(3) Dashboard", with the `inbox_title_count` translation. Off by default. */
        titleCount?: boolean;
        /** Shows the unread count on the icon of the installed app with `navigator.setAppBadge()`. Off by default. */
        appBadge?: boolean;
        /**
         * Shows a desktop notification for each notification that arrives in real time while the user is not looking at
         * any tab of the application. One tab shows it. Ask for permission with `requestNotificationPermission()`. Off by default.
         */
        desktopNotifications?: boolean;
        /**
         * Plays a sound in one tab for each notification that arrives in real time: a short built-in chime with `true`, or
         * the audio file at a URL. Browsers only play sound once the user interacted with the page. Off by default.
         */
        sound?: boolean | string;
    };
}

/**
 * When a pause of the preset ends, counted from `now`: after its number of minutes, or for `'tomorrow'`, at 08:00 the
 * next day in the browser's time zone. A custom header shows the end of each of its `pauseOptions` with `pauseTime()`.
 */
export declare function pauseEnd(preset: PausePreset, now?: Date): Date;

/** An option of the pause menu, such as "For 30 minutes", whose end counts from its preset when the menu shows it and when the user picks it. */
export declare interface PauseOption {
    label: string;
    preset: PausePreset;
}

/** A preset of the pause menu: a number of minutes, or `'tomorrow'` for 08:00 the next day in the browser's time zone. */
export declare type PausePreset = number | 'tomorrow';

/**
 * The end of a pause in the locale, as the pause menu shows it: only the time when it is today, with the weekday within
 * six days, and else with the date, such as "Dec 24, 8:00 AM". `now` is the current time in milliseconds, such as `Date.now()`.
 */
export declare function pauseTime(date: Date | string, now: number, locale?: string): string;

/** The frequencies that the user may receive a category in on the channels that digests hold, in the order forms offer them. */
declare const PREFERENCE_FREQUENCIES: readonly ["instant", "hourly", "daily", "weekly"];

/** The days of the notification hours, Monday first. */
declare const PREFERENCE_WEEKDAYS: readonly ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

export declare interface PreferenceCategory {
    key: string;
    label: string;
    description: string | null;
    /** The key of the group that the category is shown in, or `null`. */
    group: string | null;
    /** A locked category always sends, so its channels cannot be turned off. */
    locked: boolean;
    /** The user's choice for each channel the category offers, by channel key. A channel that is off overrides it. */
    channels: Readonly<Record<string, boolean>>;
    /** How often the user receives the category on the channels that digests hold, or `null` when it is always sent right away. */
    frequency: PreferenceFrequency | null;
}

export declare interface PreferenceChannel {
    key: string;
    label: string;
    /** Whether the user may turn the channel off for every category at once. */
    globalSwitch: boolean;
    /** Whether the channel is on. While it is off, the user receives only the locked categories on it. */
    enabled: boolean;
    /** Whether digests hold the channel, from the server's `digests.channels` config. */
    digest: boolean;
    /** Whether the channel covers the notification center, which the pushes of a category need. */
    inbox: boolean;
    /** Whether the channel sends web push, which reaches only the devices where the user turned push on. */
    push: boolean;
}

/** How often the user receives a category on the channels that digests hold: right away, or in an hourly, daily, or weekly digest. */
export declare type PreferenceFrequency = (typeof PREFERENCE_FREQUENCIES)[number];

export declare interface PreferenceGroup {
    key: string;
    label: string;
    description: string | null;
}

/**
 * The hours, in the user's timezone, during which notifications reach the user on the channels that digests hold, and
 * with a toast, a sound, and a desktop notification. Outside them, those wait or arrive silently.
 */
export declare interface PreferenceNotificationHours {
    enabled: boolean;
    /**
     * The ranges of each day, such as `['09:00-12:00', '13:00-17:00']`, sorted by start. A day without ranges has no
     * notification hours. A range that ends before or when it starts runs past midnight, so `22:00-02:00` ends at 02:00
     * the next day, and `00:00-00:00` is the whole day.
     */
    days: Record<PreferenceWeekday, string[]>;
}

/** Class names added to the parts of `<NotificationPreferences>`. */
export declare interface PreferencesClasses {
    table?: string;
    /** Each column header: the categories and each channel. */
    head?: string;
    /** The heading of each group. */
    group?: string;
    /** Each row of switches: the **All notifications** row and each category. */
    row?: string;
    label?: string;
    description?: string;
    /** The badge of a locked category. */
    badge?: string;
    switch?: string;
    /** The frequency menu of each category that users may receive in a digest. */
    select?: string;
    /** The time fields of the notification hours. */
    time?: string;
}

/** The categories of one group, or those without a group when `group` is `null`. */
export declare interface PreferenceSection {
    group: PreferenceGroup | null;
    categories: readonly PreferenceCategory[];
}

/** The text of `<NotificationPreferences>`: strings with placeholders, or functions that receive the parameters. */
export declare type PreferencesLabels = Record<keyof typeof DEFAULT_PREFERENCES_LABELS, TranslationValue>;

export declare interface PreferencesState {
    status: 'idle' | 'loading' | 'ready' | 'error';
    channels: readonly PreferenceChannel[];
    /** The groups that have categories, in order. */
    groups: readonly PreferenceGroup[];
    categories: readonly PreferenceCategory[];
    /** The user's notification hours, or `null` when the application does not offer them. */
    notificationHours: PreferenceNotificationHours | null;
    /** The frequencies that the application offers, `instant` first. Every frequency when the server does not list them. */
    frequencies: readonly PreferenceFrequency[];
}

export declare interface PreferencesStore {
    subscribe(listener: () => void): () => void;
    getSnapshot(): PreferencesState;
    connect(bindings: InertiaBindings, options?: {
        onFailure?: (error: unknown) => void;
    }): void;
    /** Loads the preferences of the signed-in user from the notification center's routes, at the URL of the shared prop. */
    load(url: string | undefined): Promise<void>;
    /**
     * Turns a category on or off for one channel. The change shows at once and is undone when saving fails. Each
     * switch saves one change at a time, so the server saves the user's newest choice last.
     */
    set(category: string, channel: string, enabled: boolean): Promise<void>;
    /** Turns a channel off or on for every category, except the locked categories, which always send. Saves like `set()`. */
    setChannel(channel: string, enabled: boolean): Promise<void>;
    /**
     * Sets how often the user receives a category that may be received in a digest, to one of the offered `frequencies`,
     * with the browser's timezone. Saves like `set()`.
     */
    setFrequency(category: string, frequency: PreferenceFrequency): Promise<void>;
    /**
     * Changes the notification hours: whether they are on, and the ranges of the days that change, such as
     * `{ days: { saturday: ['10:00-14:00'] } }`. An empty list turns a day off. Saves like `setFrequency()`. A change with
     * a range that is not two times of day, or that leaves no range on any day, changes nothing.
     */
    setNotificationHours(changes: {
        enabled?: boolean;
        days?: Partial<Record<PreferenceWeekday, string[]>>;
    }): Promise<void>;
    /** Forgets the preferences after the user signed out or another user signed in, and loads them again when they show. */
    reset(url: string | undefined): void;
}

/** The store shared by every `<NotificationPreferences>` in the application. */
export declare const preferencesStore: PreferencesStore;

/** A day of the week, as the notification hours name it. */
export declare type PreferenceWeekday = (typeof PREFERENCE_WEEKDAYS)[number];

export declare interface PromiseToast<T> {
    id: string;
    /**
     * The original promise. `toast.promise()` returns this object instead of the promise, so a failure does not become an
     * unhandled rejection. A failed `Response` still resolves it, as it resolves `fetch()`.
     */
    unwrap(): Promise<T>;
}

export declare interface PromiseToastOptions<T> extends Omit<ToastOptions, 'type'> {
    loading: ToastInput;
    /** Replaces the loading toast when the promise resolves; omit to close it. */
    success?: ToastInput | ((value: T) => ToastInput);
    /** Replaces the loading toast when the promise rejects or resolves with a failed `Response`, which it receives; omit to close it. */
    error?: ToastInput | ((error: unknown) => ToastInput);
}

/** A device that receives the signed-in user's pushes, as the server stores its subscription. */
declare interface PushDevice {
    /** The key of the subscription, which `removeDevice()` takes. */
    id: number;
    /** The name of the browser, such as `Chrome`, or `null` when its user agent tells no browser we know. */
    browser: string | null;
    /** The operating system of the browser, such as `macOS`, or `null` when its user agent tells none we know. */
    platform: string | null;
    /** When the device last opened a page of the application while push was on, or turned push on, as ISO 8601. */
    activeAt: string;
    /** Whether this is the device of the page. */
    current: boolean;
}

/** What the device control of `<NotificationPreferences>` shows, as its `data-state`. */
export declare type PushDeviceState = 'off' | 'on' | 'busy' | 'blocked' | 'home-screen' | 'insecure' | 'brave' | 'failed';

/** Why push cannot turn on in this browser, or why the last request failed. */
export declare type PushReason = 
/** The page is not served over HTTPS or from `localhost`, so the browser offers no service workers. */
'insecure'
/** The browser has no web push. */
| 'unsupported'
/** iOS and iPadOS only offer push to a site that the user added to the Home Screen and opened from there. */
| 'home-screen'
/** The user blocked notifications for the site. */
| 'blocked'
/** Brave could not subscribe, as its "Use Google services for push messaging" setting is off. */
| 'brave'
/** Registering the service worker, subscribing, or saving the subscription failed. */
| 'failed';

export declare interface PushState {
    /** Whether the application sends pushes: the shared prop's `push` is not `null`. */
    available: boolean;
    /** Whether this browser can receive pushes. */
    supported: boolean;
    /** The browser's permission for notifications. */
    permission: NotificationPermission;
    /** Whether this device receives the signed-in user's pushes. */
    subscribed: boolean;
    /** Whether turning push on or off for this device is in progress. */
    busy: boolean;
    /** Why push cannot turn on in this browser, or why the last request failed. `null` when nothing is in the way. */
    reason: PushReason | null;
    /** The request that turns push on or off for this device while it runs, or after it failed. `null` once it succeeded. */
    request: {
        action: 'subscribe' | 'unsubscribe';
        status: 'pending' | 'brave' | 'failed';
    } | null;
    /**
     * The devices that receive the signed-in user's pushes, the most recently active first, once `loadDevices()` loaded
     * them, and `null` before. A device that `removeDevice()` removes leaves the list at once.
     */
    devices: readonly PushDevice[] | null;
}

/** Formats a time relative to now, such as "5 minutes ago" or "yesterday", in the given locale. */
export declare function relativeTime(iso: string, now: number, locale?: string): string;

/**
 * Asks the user to allow desktop notifications, and returns their choice. Browsers only show the prompt after a user
 * gesture, so call it from a click handler. Browsers without desktop notifications return `denied`.
 */
export declare function requestNotificationPermission(): Promise<NotificationPermission>;

/** The component that the global resolver returns for an icon name, or `null`. */
export declare const resolveIcon: (icon: string, context?: IconContext) => Component | string | null;

/** Registers the resolver that every component asks for its icons, or clears it with `null`. */
export declare const setIconResolver: (resolver: IconResolverFn | null) => void;

/** Changes built-in strings for the whole application. Keys you leave out keep their current text. */
export declare function setTranslations(overrides: Record<string, TranslationValue>): void;

export declare interface SnoozeOption {
    label: string;
    until: Date;
}

/**
 * The default snooze times: in three hours when that is still today, tomorrow at 9:00, and next Monday at 9:00 unless
 * that is tomorrow. Labels that are not given use the translations.
 */
export declare function snoozeOptions(overrides?: Readonly<Partial<Pick<InboxLabels, 'snoozeLaterToday' | 'snoozeTomorrow' | 'snoozeNextWeek'>>>, now?: Date): SnoozeOption[];

export declare interface StoreOptions extends DurationOptions {
    /** The most toasts each Toaster shows at once. Defaults to `5`. */
    limit?: number;
    /**
     * What happens when a toast arrives while the limit of toasts shows: it waits for room (`queue`, the default), the
     * least important showing toast closes (`drop-oldest`), or the least important showing toast hides until there is
     * room again (`hide`). The oldest goes first among toasts of the same importance.
     */
    overflow?: 'queue' | 'drop-oldest' | 'hide';
    /** Show a counter on an open toast instead of adding the same toast again. Defaults to `true`. */
    dedupe?: boolean;
    /** Milliseconds a closing toast stays rendered for its exit animation. Defaults to `200`. */
    removeDelay?: number;
}

export declare interface Toast {
    id: string;
    type: ToastType;
    title: string;
    description?: string;
    /** Milliseconds before the toast closes; `null` keeps it open until dismissed. */
    duration: number | null;
    actions: readonly ToastAction[];
    icon?: ToastIcon;
    /** The URL of an image, such as an avatar, that shows in place of the icon. */
    image?: string;
    /** Whether the user can dismiss it with its button, Escape, or a swipe. */
    dismissible: boolean;
    /** Overrides the position of the Toaster that shows it. */
    position?: ToastPosition;
    /** The `name` of the Toaster that shows it; the unnamed Toaster when omitted. */
    toaster?: string;
    /** Overrides how urgently screen readers announce it; errors are assertive, others polite. */
    politeness?: 'polite' | 'assertive';
    /** Data for the component that the Toaster's `components` prop has for the toast's type, such as from `->with()` in Laravel. */
    data?: Record<string, unknown>;
    /** How much of the work is done, from 0 to 1, shown as a bar that screen readers can read. */
    progress?: number;
    /** How often the same toast was shown while it was open. */
    count: number;
    /** Increases each time the content changes, so it is announced again. */
    revision: number;
    /** `queued` waits for room under the limit, also after a newer toast hid it; `closing` plays its exit animation. */
    state: ToastState;
    /** The index of the action that is running. */
    pendingAction?: number;
    onClose?: (reason: ToastCloseReason) => void;
    /** Runs after the exit animation, when the toast is removed. */
    onRemove?: () => void;
}

export declare const toast: ToastFunction;

declare const TOAST_ACTION_METHODS: readonly ["get", "post", "put", "patch", "delete"];

declare const TOAST_POSITIONS: readonly ["top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right"];

/**
 * A button on a toast. Set one of `onClick`, `href`, or `event`. The toast closes after the action ran, unless
 * `keepOpen` is set; while `onClick`'s promise or the visit is pending, the button shows a loading state.
 * `Target` is what `onClick` receives: the toast, or the notification for the actions of a notification.
 */
export declare interface ToastAction<Target = Toast> {
    label: string;
    /** Runs when the action is clicked. Return a promise to keep the toast open, with a loading state, until it settles. */
    onClick?: (target: Target) => unknown;
    /** Visits this URL with Inertia. Actions that visit with GET render as links. */
    href?: string;
    method?: ToastActionMethod;
    data?: Record<string, unknown>;
    visit?: ToastActionVisitOptions;
    /** Load `href` in the browser instead of visiting it with Inertia, such as for a file download or another site. */
    external?: boolean;
    /** Open `href` in a new tab. */
    newTab?: boolean;
    /** Dispatches a `CustomEvent` with this name on `window`, with `payload` as its `detail`. */
    event?: string;
    payload?: unknown;
    /** Keep the toast open after the action ran. */
    keepOpen?: boolean;
    /** Tells screen reader users how to do the same without the toast, such as "Undo from the Trash page". */
    altText?: string;
    /**
     * What a notification shows in place of its actions once this action succeeded, such as "Approved". The notification
     * center saves it for the user. Toasts that do not show a notification ignore it.
     */
    result?: string;
}

export declare type ToastActionMethod = (typeof TOAST_ACTION_METHODS)[number];

/** Options for the Inertia visit of an action, such as `{ preserveScroll: true }`. */
export declare interface ToastActionVisitOptions {
    preserveScroll?: boolean;
    preserveState?: boolean;
    replace?: boolean;
    only?: string[];
    except?: string[];
    headers?: Record<string, string>;
}

/** Class names added to the parts of each toast. */
export declare type ToastClasses = Partial<Record<'toast' | 'icon' | 'title' | 'description' | 'actions' | 'action' | 'dismiss' | 'progress', string>>;

/** Why a toast closed, passed to `onClose`. */
export declare type ToastCloseReason = 
/** Its duration ran out. */
'timeout'
/** The user pressed its dismiss button. */
| 'user'
/** The user swiped it away. */
| 'swipe'
/** The user ran one of its actions. */
| 'action'
/** The user pressed Escape while it had focus. */
| 'escape'
/** Code called `toast.dismiss()`. */
| 'programmatic'
/** A new toast with the same ID took its place. */
| 'replaced'
/** The limit was reached and a newer toast pushed it out. */
| 'evicted';

/** The props of a component in the Toaster's `components` prop, which renders the toasts of one type. */
export declare interface ToastComponentProps {
    toast: Toast;
    /** Closes the toast, as its dismiss button does. */
    dismiss: () => void;
    /** Runs an action of the toast. Pass the click event, so a modified click on a link opens it in a new tab. */
    runAction: (index: number, event: MouseEvent) => void;
}

/** What a `duration` function receives: the content of the toast that it times. */
export declare type ToastContent = Pick<Toast, 'type' | 'title' | 'description'> & {
    actions?: readonly ToastAction[];
};

export declare const Toaster: typeof __VLS_export;

export declare interface ToastFunction {
    (title: string, options?: ToastOptions): string;
    success: TypedToast;
    info: TypedToast;
    warning: TypedToast;
    error: TypedToast;
    /** A toast with a spinner that stays open; replace it by passing its ID to another toast. */
    loading: TypedToast;
    /** Changes an open toast; omitted fields keep their value. */
    update(id: string, changes: ToastUpdate): void;
    /** Closes one toast, or every toast when no ID is given. */
    dismiss(id?: string): void;
    /** Shows a loading toast until the promise settles, then replaces it with a success or error toast. */
    promise<T>(promise: Promise<T> | (() => Promise<T>), options: PromiseToastOptions<T>): PromiseToast<T>;
    /**
     * Returns callbacks for an Inertia visit, such as `router.post(url, data, toast.track({ loading: 'Saving…' }))`,
     * that show a loading toast while the visit runs, with the progress of a file upload. Pass visit options as the
     * second argument to keep their callbacks.
     */
    track<T extends object = Record<never, never>>(options: TrackToastOptions, visitOptions?: T): T & Required<VisitCallbacks>;
    /** Shows the toasts in the headers of a response that did not come through Inertia, such as from `fetch()`. */
    fromHeaders(headers: Headers | Record<string, string>): void;
}

/** A name the Toaster looks up in its `icons` prop, a framework component, or `false` for no icon. */
export declare type ToastIcon = string | false | object;

/** A toast's title, or its title with options. */
export declare type ToastInput = string | (ToastOptions & {
    title: string;
});

export declare interface ToastOptions {
    /** Updates the open toast with this ID instead of adding another one. */
    id?: string;
    type?: ToastType;
    description?: string;
    /** Milliseconds before the toast closes, or `null` to keep it open. Omit to use the default for its type and length. */
    duration?: number | null;
    /** Shorthand for a single action. */
    action?: ToastAction;
    actions?: readonly ToastAction[];
    icon?: ToastIcon;
    /** The URL of an image, such as an avatar, that shows in place of the icon. Screen readers still announce the type. */
    image?: string;
    /** Set to `false` to remove the dismiss button and Escape, such as for a toast that is replaced when work finishes. */
    dismissible?: boolean;
    position?: ToastPosition;
    toaster?: string;
    politeness?: 'polite' | 'assertive';
    /** Data for the component that the Toaster's `components` prop has for the toast's type. Toasts with data are never counted as duplicates. */
    data?: Record<string, unknown>;
    /** How much of the work is done, from 0 to 1, such as the share of an upload. The toast shows it as a bar. */
    progress?: number;
    onClose?: (reason: ToastCloseReason) => void;
    onRemove?: () => void;
}

export declare type ToastPosition = (typeof TOAST_POSITIONS)[number];

export declare type ToastState = 'queued' | 'visible' | 'closing';

export declare interface ToastStore {
    /** Subscribe to changes; compatible with React's `useSyncExternalStore`. Also called when timers pause or resume. */
    subscribe(listener: () => void): () => void;
    /** Every toast in the order it was added, including queued and closing toasts. */
    getSnapshot(): readonly Toast[];
    /** Adds a toast and returns its ID. With the ID of an open toast, replaces that toast in place. */
    add(title: string, options?: ToastOptions): string;
    /** Changes an open or queued toast; omitted fields keep their value. Content changes restart its timer. */
    update(id: string, changes: ToastUpdate): void;
    /** Closes one toast, or every toast when no ID is given. */
    dismiss(id?: string, reason?: ToastCloseReason): void;
    /**
     * Stops close timers for the given reason: every timer, or only the timer of one toast. Timers run again
     * once every reason is resumed.
     */
    pause(reason?: string, id?: string): void;
    /** Removes a pause reason. Each toast continues with the time it had left, but at least a second. */
    resume(reason?: string, id?: string): void;
    timer(id: string): ToastTimer | undefined;
    /** Marks the action that is running, which also stops the toast's timer. */
    setPendingAction(id: string, index: number | undefined): void;
    /** Changes the defaults of toasts added from now on, and the limit. */
    configure(options: StoreOptions): void;
    /**
     * Records a mounted Toaster that shows the toasts of the given name, or the unnamed toasts, and returns how to record
     * that it unmounted. A toast's timer runs only while a Toaster of its name is mounted.
     */
    attach(toaster: string | undefined): () => void;
}

export declare interface ToastTimer {
    duration: number;
    /** Milliseconds left, counted down while the timer runs. */
    remaining: number;
    running: boolean;
}

/**
 * A built-in type, or the name of a custom type, such as `deployment`: lowercase letters, digits, and dashes, starting
 * with a letter. A toast of a custom type shows the icon and screen reader label that the Toaster has for it, and
 * otherwise looks like a `default` toast.
 */
export declare type ToastType = BuiltInToastType | (string & {});

/** Labels that screen readers announce before a toast's title, such as "Error: Payment failed". They take the place of the `toast_type_` translations. */
export declare type ToastTypeLabels = Partial<Record<ToastType, string>>;

/** Changes for `toast.update()`; omitted fields keep their value. */
export declare type ToastUpdate = Omit<ToastOptions, 'id'> & {
    title?: string;
};

export declare interface TrackToastOptions extends Omit<ToastOptions, 'type'> {
    /** Shown while the visit runs. */
    loading?: ToastInput;
    /** Shown when the visit succeeds; omit when the server flashes its own toast. */
    success?: ToastInput | ((page: unknown) => ToastInput);
    /** Shown when the visit fails validation, with the errors; omit to only close the loading toast. */
    error?: ToastInput | ((errors: Record<string, string>) => ToastInput);
}

/** The text of a key with its parameters. A key without a translation renders as the key, so it is easy to spot. */
export declare function trans(key: string, params?: TranslationParams): string;

export declare type TranslationKey = keyof typeof DEFAULT_TRANSLATIONS;

export declare type TranslationParams = Record<string, string | number>;

/** A string with `:name` placeholders, or a function that receives the parameters and returns the text, such as for plurals. */
export declare type TranslationValue = string | ((params: TranslationParams) => string);

declare type TypedToast = (title: string, options?: Omit<ToastOptions, 'type'>) => string;

export declare type UseNotifications = {
    [Key in keyof InboxState]: ComputedRef<InboxState[Key]>;
} & InboxActions & {
    /** Shows a toast. */
    toast: ToastFunction;
};

/**
 * The notification center's state, such as the counts and the loaded notifications, and its actions, for building
 * a custom bell or panel. Every component shares the same state.
 */
export declare function useNotifications(): UseNotifications;

export declare type UsePreferences = {
    [Key in keyof PreferencesState]: ComputedRef<PreferencesState[Key]>;
} & Pick<PreferencesStore, 'set' | 'setChannel' | 'setFrequency' | 'setNotificationHours'> & {
    /** The categories by group: first those without a group, then each group in order. */
    sections: ComputedRef<PreferenceSection[]>;
    /** Loads the preferences of the signed-in user again. */
    load(): Promise<void>;
    /** Whether the user receives the category on the channel: always if locked, else while both are on, and pushes only with the notification center. */
    receives(category: PreferenceCategory, channel: PreferenceChannel): boolean;
    /** Whether the frequency of the category changes anything: the user receives the category on a channel that digests hold. */
    frequencyApplies: typeof frequencyApplies;
    /** Whether the choice for the category on the channel cannot change: it is locked, the channel is off, or pushes wait for the notification center. */
    isDisabled(category: PreferenceCategory, channel: PreferenceChannel): boolean;
};

/**
 * The notification preferences of the signed-in user and the actions that change them, for building your own preferences
 * page. Loads the preferences when the component mounts. Every component shares the same state.
 */
export declare function usePreferences(): UsePreferences;

export declare type UsePush = {
    [Key in keyof PushState]: ComputedRef<PushState[Key]>;
} & {
    /**
     * The `data-state` of the device control of `<NotificationPreferences>` in this state, or `null` while the
     * application sends no pushes or the browser has no web push. The component also hides its control while no channel
     * of the preferences sends push, such as while they load.
     */
    deviceState: ComputedRef<PushDeviceState | null>;
    /** Turns push on for this device. Call it from a click handler, as browsers only ask for permission after a user gesture. */
    subscribe(): Promise<void>;
    /** Turns push off for this device. */
    unsubscribe(): Promise<void>;
    /** Loads the devices that receive the signed-in user's pushes into `devices`, such as when your list of them shows. */
    loadDevices(): Promise<void>;
    /** Removes the subscription of another device, which leaves `devices` at once. Use `unsubscribe()` for this device. */
    removeDevice(id: number): Promise<void>;
};

/**
 * Whether this device receives push notifications, why it cannot, the actions that turn push on and off, and the user's
 * other devices, for building your own device control. Every component shares the same state.
 */
export declare function usePush(): UsePush;

export declare type UseToasts = Pick<ToastStore, 'update' | 'dismiss' | 'pause' | 'resume' | 'timer'> & {
    /**
     * The toasts of this Toaster in the order they were added. Render the `visible` ones; `closing` toasts play their
     * exit animation, and `queued` toasts wait for room under the limit.
     */
    toasts: ComputedRef<readonly Toast[]>;
    /** Shows a toast. */
    toast: ToastFunction;
    /** Runs an action of a toast. Pass the click event, so a modified click on a link opens it in a new tab. */
    runAction: (id: string, index: number, event?: MouseEvent) => void;
};

/**
 * The toasts of the Toaster with the given name, or of the unnamed Toaster, and what to do with them, for a Toaster
 * with markup of your own. While a component uses it, the toasts' timers run, as they do while a `<Toaster>` is mounted.
 * Pauses made with its `pause()` end when the component unmounts. Pass a ref or a getter to follow a name that changes.
 */
export declare function useToasts(name?: MaybeRefOrGetter<string | undefined>): UseToasts;

declare interface VisitCallbacks {
    onStart?: (visit: unknown) => void;
    onProgress?: (progress: unknown) => void;
    onSuccess?: (page: unknown) => void;
    onError?: (errors: unknown) => void;
    onFinish?: (visit: unknown) => void;
}

export { }
