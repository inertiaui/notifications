import type { InboxItem } from './inbox'
import type { ArrivalToasts, EchoLike } from './realtime'

/** The types that the Toaster has an icon and a color for. */
export type BuiltInToastType = 'default' | 'success' | 'info' | 'warning' | 'error' | 'loading'

/**
 * A built-in type, or the name of a custom type, such as `deployment`: lowercase letters, digits, and dashes, starting
 * with a letter. A toast of a custom type shows the icon and screen reader label that the Toaster has for it, and
 * otherwise looks like a `default` toast.
 */
export type ToastType = BuiltInToastType | (string & {})

export const TOAST_POSITIONS = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'] as const

export type ToastPosition = (typeof TOAST_POSITIONS)[number]

/** Why a toast closed, passed to `onClose`. */
export type ToastCloseReason =
    /** Its duration ran out. */
    | 'timeout'
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
    | 'evicted'

/** A name the Toaster looks up in its `icons` prop, a framework component, or `false` for no icon. */
export type ToastIcon = string | false | object

export const TOAST_ACTION_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const

export type ToastActionMethod = (typeof TOAST_ACTION_METHODS)[number]

/** Options for the Inertia visit of an action, such as `{ preserveScroll: true }`. */
export interface ToastActionVisitOptions {
    preserveScroll?: boolean
    preserveState?: boolean
    replace?: boolean
    only?: string[]
    except?: string[]
    headers?: Record<string, string>
}

/**
 * A button on a toast. Set one of `onClick`, `href`, or `event`. The toast closes after the action ran, unless
 * `keepOpen` is set; while `onClick`'s promise or the visit is pending, the button shows a loading state.
 * `Target` is what `onClick` receives: the toast, or the notification for the actions of a notification.
 */
export interface ToastAction<Target = Toast> {
    label: string
    /** Runs when the action is clicked. Return a promise to keep the toast open, with a loading state, until it settles. */
    onClick?: (target: Target) => unknown
    /** Visits this URL with Inertia. Actions that visit with GET render as links. */
    href?: string
    method?: ToastActionMethod
    data?: Record<string, unknown>
    visit?: ToastActionVisitOptions
    /** Load `href` in the browser instead of visiting it with Inertia, such as for a file download or another site. */
    external?: boolean
    /** Open `href` in a new tab. */
    newTab?: boolean
    /** Dispatches a `CustomEvent` with this name on `window`, with `payload` as its `detail`. */
    event?: string
    payload?: unknown
    /** Keep the toast open after the action ran. */
    keepOpen?: boolean
    /** Tells screen reader users how to do the same without the toast, such as "Undo from the Trash page". */
    altText?: string
    /**
     * What a notification shows in place of its actions once this action succeeded, such as "Approved". The notification
     * center saves it for the user. Toasts that do not show a notification ignore it.
     */
    result?: string
}

export type ToastState = 'queued' | 'visible' | 'closing'

export interface Toast {
    id: string
    type: ToastType
    title: string
    description?: string
    /** Milliseconds before the toast closes; `null` keeps it open until dismissed. */
    duration: number | null
    actions: readonly ToastAction[]
    icon?: ToastIcon
    /** The URL of an image, such as an avatar, that shows in place of the icon. */
    image?: string
    /** Whether the user can dismiss it with its button, Escape, or a swipe. */
    dismissible: boolean
    /** Overrides the position of the Toaster that shows it. */
    position?: ToastPosition
    /** The `name` of the Toaster that shows it; the unnamed Toaster when omitted. */
    toaster?: string
    /** Overrides how urgently screen readers announce it; errors are assertive, others polite. */
    politeness?: 'polite' | 'assertive'
    /** Data for the component that the Toaster's `components` prop has for the toast's type, such as from `->with()` in Laravel. */
    data?: Record<string, unknown>
    /** How much of the work is done, from 0 to 1, shown as a bar that screen readers can read. */
    progress?: number
    /** How often the same toast was shown while it was open. */
    count: number
    /** Increases each time the content changes, so it is announced again. */
    revision: number
    /** `queued` waits for room under the limit, also after a newer toast hid it; `closing` plays its exit animation. */
    state: ToastState
    /** The index of the action that is running. */
    pendingAction?: number
    onClose?: (reason: ToastCloseReason) => void
    /** Runs after the exit animation, when the toast is removed. */
    onRemove?: () => void
}

export interface ToastOptions {
    /** Updates the open toast with this ID instead of adding another one. */
    id?: string
    type?: ToastType
    description?: string
    /** Milliseconds before the toast closes, or `null` to keep it open. Omit to use the default for its type and length. */
    duration?: number | null
    /** Shorthand for a single action. */
    action?: ToastAction
    actions?: readonly ToastAction[]
    icon?: ToastIcon
    /** The URL of an image, such as an avatar, that shows in place of the icon. Screen readers still announce the type. */
    image?: string
    /** Set to `false` to remove the dismiss button and Escape, such as for a toast that is replaced when work finishes. */
    dismissible?: boolean
    position?: ToastPosition
    toaster?: string
    politeness?: 'polite' | 'assertive'
    /** Data for the component that the Toaster's `components` prop has for the toast's type. Toasts with data are never counted as duplicates. */
    data?: Record<string, unknown>
    /** How much of the work is done, from 0 to 1, such as the share of an upload. The toast shows it as a bar. */
    progress?: number
    onClose?: (reason: ToastCloseReason) => void
    onRemove?: () => void
}

/** Changes for `toast.update()`; omitted fields keep their value. */
export type ToastUpdate = Omit<ToastOptions, 'id'> & { title?: string }

/** What a `duration` function receives: the content of the toast that it times. */
export type ToastContent = Pick<Toast, 'type' | 'title' | 'description'> & { actions?: readonly ToastAction[] }

export interface DurationOptions {
    /**
     * Milliseconds that toasts without a duration stay open. A function decides per toast, including errors.
     * By default, the duration grows with the length of the toast, from 5 to 12 seconds.
     */
    duration?: number | ((toast: ToastContent) => number | null)
    /** Keep error toasts open until the user dismisses them. Defaults to `true`. */
    persistentErrors?: boolean
    /** Multiplies the duration of every timed toast, such as for users who need more time to read. Defaults to `1`. */
    durationScale?: number
    /** Set to `false` to keep every toast open until the user dismisses it. */
    autoDismiss?: boolean
}

export interface StoreOptions extends DurationOptions {
    /** The most toasts each Toaster shows at once. Defaults to `5`. */
    limit?: number
    /**
     * What happens when a toast arrives while the limit of toasts shows: it waits for room (`queue`, the default), the
     * least important showing toast closes (`drop-oldest`), or the least important showing toast hides until there is
     * room again (`hide`). The oldest goes first among toasts of the same importance.
     */
    overflow?: 'queue' | 'drop-oldest' | 'hide'
    /** Show a counter on an open toast instead of adding the same toast again. Defaults to `true`. */
    dedupe?: boolean
    /** Milliseconds a closing toast stays rendered for its exit animation. Defaults to `200`. */
    removeDelay?: number
}

export interface ErrorToastContent {
    title: string
    description?: string
}

/**
 * Toasts for failed requests, instead of Inertia's error page dialog. Keys are HTTP status codes, `5xx` for any
 * server error, and `network` for requests that got no response. `false` leaves a status to Inertia.
 */
export type ErrorToastMessages = Partial<Record<number | '5xx' | 'network', ErrorToastContent | false>>

export interface NotificationsOptions extends StoreOptions {
    /** The Inertia flash key that carries toasts. Must match `flash_key` in `config/inertia-notifications.php`. */
    flashKey?: string
    /** Show a toast when a request fails. `true` uses the `error_toast_` translations; an object changes or adds messages. Defaults to `false`. */
    errorToasts?: boolean | ErrorToastMessages
    inbox?: {
        /** The path of the shared prop with the counts. Must match `inbox.shared_prop` in `config/inertia-notifications.php`. */
        prop?: string
        /**
         * Laravel Echo, to show notifications the moment they arrive and the changes the user makes in other sessions.
         * Pass the instance, or a function that returns it, such as `echo` from `@laravel/echo-vue`. `null` stops listening.
         */
        echo?: EchoLike | (() => EchoLike | undefined) | null
        /**
         * Which notifications that arrive in real time also show as a toast: those whose message calls `toast()`
         * (`requested`, the default), every notification (`all`), or none (`none`).
         */
        arrivalToasts?: ArrivalToasts
        /** Milliseconds between requests for the counts, such as for applications without Echo. Paused while the tab is hidden. Off by default. */
        poll?: number | false
        /**
         * Runs once for each notification that arrives in real time, such as from Echo or a snoozed notification that
         * came back, after the notification center shows it and before its toast.
         */
        onArrival?: (item: InboxItem) => void
        /** Shows the unread count in the title of every tab, such as "(3) Dashboard", with the `inbox_title_count` translation. Off by default. */
        titleCount?: boolean
        /** Shows the unread count on the icon of the installed app with `navigator.setAppBadge()`. Off by default. */
        appBadge?: boolean
        /**
         * Shows a desktop notification for each notification that arrives in real time while the user is not looking at
         * any tab of the application. One tab shows it. Ask for permission with `requestNotificationPermission()`. Off by default.
         */
        desktopNotifications?: boolean
        /**
         * Plays a sound in one tab for each notification that arrives in real time: a short built-in chime with `true`, or
         * the audio file at a URL. Browsers only play sound once the user interacted with the page. Off by default.
         */
        sound?: boolean | string
    }
}

/** Labels that screen readers announce before a toast's title, such as "Error: Payment failed". They take the place of the `toast_type_` translations. */
export type ToastTypeLabels = Partial<Record<ToastType, string>>

/** Class names added to the parts of each toast. */
export type ToastClasses = Partial<Record<'toast' | 'icon' | 'title' | 'description' | 'actions' | 'action' | 'dismiss' | 'progress', string>>
