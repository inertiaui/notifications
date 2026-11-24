// The exports of the core that the Vue and React packages share. Each package adds its components, hooks, and icon resolver.
export { requestNotificationPermission } from './browserAlerts'
export { setTranslations, trans } from './translations'
export type { TranslationKey, TranslationParams, TranslationValue } from './translations'
export { DEFAULT_INBOX_LABELS, groupItems, inboxStore, isSnoozed, pauseEnd, pauseTime, relativeTime, snoozeOptions } from './inbox'
export type {
    InboxAction,
    InboxActor,
    InboxBatchAction,
    InboxChange,
    InboxClasses,
    InboxCounts,
    InboxFilter,
    InboxGroup,
    InboxItem,
    InboxLabels,
    InboxState,
    InboxStore,
    InboxTab,
    PauseOption,
    PausePreset,
    SnoozeOption,
} from './inbox'
export { DEFAULT_PREFERENCES_LABELS, preferencesStore } from './preferences'
export type {
    PreferenceCategory,
    PreferenceChannel,
    PreferenceFrequency,
    PreferenceNotificationHours,
    PreferenceGroup,
    PreferenceSection,
    PreferencesClasses,
    PreferencesLabels,
    PreferencesState,
    PreferencesStore,
    PreferenceWeekday,
} from './preferences'
export type { PushDeviceState, PushReason, PushState } from './push'
export type {
    NotificationCenterBadgeProps,
    NotificationCenterErrorProps,
    NotificationCenterFooterProps,
    NotificationCenterHeaderProps,
    NotificationCenterTabProps,
    NotificationCenterTriggerProps,
    NotificationListHeaderProps,
} from './notificationCenter'
export type { FlashedToast, InertiaUIFlashData } from './flash'
export type { ArrivalToasts, EchoChannelLike, EchoLike } from './realtime'
export { DEFAULT_ERROR_MESSAGES, toast } from './toast'
export type { PromiseToast, PromiseToastOptions, ToastFunction, ToastInput, TrackToastOptions } from './toast'
export type { ToastStore, ToastTimer } from './toastStore'
export type {
    BuiltInToastType,
    DurationOptions,
    ErrorToastContent,
    ErrorToastMessages,
    NotificationsOptions,
    StoreOptions,
    Toast,
    ToastAction,
    ToastActionMethod,
    ToastActionVisitOptions,
    ToastClasses,
    ToastCloseReason,
    ToastContent,
    ToastIcon,
    ToastOptions,
    ToastPosition,
    ToastState,
    ToastType,
    ToastTypeLabels,
    ToastUpdate,
} from './types'
