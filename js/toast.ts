import { actionHref, followLinkAction, followsInBrowser, isModifiedClick, performAction, sameOrigin, type ActionClick } from './actions'
import { createBrowserAlerts, type BrowserAlerts } from './browserAlerts'
import { DEFAULT_FLASH_KEY, TOASTS_HEADER, createToastReceiver, flashFromResponse, flashToasts, headerToasts } from './flash'
import { inboxStore, internalInboxStore, type InboxChange, type InboxItem } from './inbox'
import type { HttpResponseLike, InertiaBindings } from './inertia'
import { preferencesStore } from './preferences'
import { pushStore } from './push'
import { arrivalToast, createRealtime, inboxIdOfToast, inboxToastId, toastContent, type ArrivalToasts, type Realtime, type ViewAction } from './realtime'
import { createToastStore, type ToastStore } from './toastStore'
import { DEFAULT_TRANSLATIONS, formatTranslation, trans, translation, type TranslationValue } from './translations'
import type { ErrorToastContent, ErrorToastMessages, NotificationsOptions, ToastAction, ToastOptions, ToastType, ToastUpdate } from './types'

/** The store shared by the `toast()` API and every Toaster in the application. */
export const toastStore = createToastStore()

// Counts every change of the store, including timers that pause or resume, which keep the same snapshot of toasts.
// Subscribed first, so other listeners read the new count.
let revision = 0
toastStore.subscribe(() => revision++)

/** Changes on every notification of the toast store; a stable snapshot for re-rendering when a timer changes. */
export const toastRevision = (): number => revision

let pauseScopes = 0

/**
 * Pause and resume for one component. Its reasons do not clash with the reasons of other callers, and `release()`
 * ends the pauses that are still active, such as a hover pause when an action navigates away under the pointer.
 */
export function createPauseScope(): Pick<ToastStore, 'pause' | 'resume'> & { release(): void } {
    const prefix = `scope-${++pauseScopes}:`
    const active = new Map<string, [reason: string, id: string | undefined]>()

    return {
        pause(reason = 'manual', id) {
            active.set(JSON.stringify([reason, id ?? null]), [reason, id])
            toastStore.pause(prefix + reason, id)
        },
        resume(reason = 'manual', id) {
            active.delete(JSON.stringify([reason, id ?? null]))
            toastStore.resume(prefix + reason, id)
        },
        release() {
            active.forEach(([reason, id]) => toastStore.resume(prefix + reason, id))
            active.clear()
        },
    }
}

let flashKey = DEFAULT_FLASH_KEY
// The messages of the `errorToasts` option, or `undefined` while error toasts are off.
let errorOverrides: ErrorToastMessages | undefined
let arrivalToasts: ArrivalToasts = 'requested'
let onArrival: ((item: InboxItem) => void) | undefined
let realtime: Realtime | undefined
let browserAlerts: BrowserAlerts | undefined

/**
 * Adds a toast that the server flashed. While a panel is open, the panel shows the notification of a toast that the
 * server flashed for the user's own request instead, like a notification that arrives in real time, since the toast
 * would cover the panel and the response only brings the panel's new counts.
 */
const addFlashedToast = (title: string, options: ToastOptions): void => {
    const id = options.id === undefined ? undefined : inboxIdOfToast(options.id)

    if (id !== undefined && internalInboxStore.panelOpen()) {
        void internalInboxStore.loadArrival(id).then((item) => item && showArrival(item))

        return
    }

    toastStore.add(title, options)
}

const receive = createToastReceiver(addFlashedToast)

export const handleFlash = (flash: Record<string, unknown> | undefined): void => receive(flashToasts(flash, flashKey))

const isBrowser = typeof window !== 'undefined'
let bindings: InertiaBindings | undefined

const errorToastStatuses = [403, 419, 429, '5xx', 'network'] as const

/** The built-in error toasts, with the `error_toast_` text that `text` returns. A status without a description text has none. */
function errorToastMessages(text: (key: string) => TranslationValue | undefined): ErrorToastMessages {
    const format = (key: string): string => {
        const value = text(key)

        return value === undefined ? '' : formatTranslation(value)
    }

    return Object.fromEntries(
        errorToastStatuses.map((status) => {
            const title = format(`error_toast_${status}`)
            const description = format(`error_toast_${status}_description`)

            return [status, description === '' ? { title } : { title, description }]
        }),
    )
}

export const DEFAULT_ERROR_MESSAGES: ErrorToastMessages = errorToastMessages((key) => (DEFAULT_TRANSLATIONS as Record<string, string>)[key])

/** The error toasts in the current translations, with the messages of the `errorToasts` option, or `undefined` while they are off. */
const errorMessages = (): ErrorToastMessages | undefined => errorOverrides && { ...errorToastMessages(translation), ...errorOverrides }

/** The message of the error toasts for a status, or `undefined` for a status they leave to Inertia. */
function statusMessage(status: number, messages: ErrorToastMessages): ErrorToastContent | undefined {
    // `false` for a status leaves it to Inertia, also when the `5xx` message would cover it.
    return (messages[status] ?? (status >= 500 ? messages['5xx'] : undefined)) || undefined
}

/** The error toast for a failed request, or `undefined` when the request should not show one. */
export function errorToastContent(error: unknown, messages: ErrorToastMessages): ErrorToastContent | undefined {
    const { code, response } = (error ?? {}) as { code?: string; response?: HttpResponseLike }

    if (code === 'ERR_NETWORK') {
        return messages.network || undefined
    }

    if (code !== 'ERR_HTTP_RESPONSE' || response?.status === undefined) {
        return undefined
    }

    const { status, headers } = response

    // Inertia pages render their own error page, location responses and redirects to a URL with a fragment are not
    // errors, and the server may send its own toasts.
    if (headers['x-inertia'] || headers['x-inertia-location'] || (status === 409 && headers['x-inertia-redirect']) || headers[TOASTS_HEADER]) {
        return undefined
    }

    return statusMessage(status, messages)
}

const viewAction = (): ViewAction => ({ label: trans('inbox_toast_view'), altText: trans('inbox_toast_view_alt') })

const showArrival = (item: InboxItem): void => {
    const content = arrivalToast(item, arrivalToasts, viewAction())

    if (!content) {
        return
    }

    // The user sees the toast, so the push of the notification closes on this device. A hidden tab's toast is not seen.
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void pushStore.close([item.id])
    }

    // An open panel already shows the notification, and the toast would cover the panel. The server already flashed the
    // toast when the notification was sent during the user's own request.
    if (internalInboxStore.panelOpen() || toastStore.getSnapshot().some((open) => open.id === content.options.id && open.state !== 'closing')) {
        return
    }

    toastStore.add(content.title, content.options)
}

/**
 * Whether the user sees the toast of the notification, so the push that the service worker shows for it afterwards
 * closes on this device. A hidden tab's toast is not seen, and a toast that the user closed shows no longer.
 */
const seesToast = (id: string): boolean =>
    document.visibilityState === 'visible' && toastStore.getSnapshot().some((open) => open.id === inboxToastId(id) && open.state !== 'closing')

/**
 * Opening a panel closes the toasts of notifications, which the panel shows and which would cover it, except a toast
 * whose action still runs.
 */
const dismissNotificationToasts = (): void =>
    toastStore
        .getSnapshot()
        .filter((open) => inboxIdOfToast(open.id) !== undefined && open.pendingAction === undefined)
        .forEach((open) => toastStore.dismiss(open.id))

/**
 * An open toast of a notification shows the new message once the server updated the notification, and closes once
 * the notification was deleted, such as when the server retracted it.
 */
const syncArrivalToasts = (change: InboxChange): void => {
    if (change.kind === 'delete') {
        change.ids.forEach((id) => toastStore.dismiss(inboxToastId(id)))
    } else if (change.kind === 'update') {
        toastStore.update(inboxToastId(change.item.id), toastContent(change.item, viewAction()))
    }
}

/**
 * Running an action of a notification's toast marks the notification as read, like running it in the notification
 * center. The toast's ID tells which notification it shows, also when the server flashed it.
 */
const markToastRead = (toastId: string): void => {
    const id = inboxIdOfToast(toastId)

    if (id !== undefined) {
        void inboxStore.markAsRead(id)
    }
}

/**
 * An action with a result that succeeded on a notification's toast saves the result, like it does in the notification
 * center. Returns the function that saves it, or `undefined` for a toast of no notification or an action without a result.
 * Taken when the action starts, so it saves the result after the toast closed or another toast replaced it, but not for
 * another user who signed in meanwhile.
 */
const toastCompleter = (toastId: string, index: number, action: ToastAction): (() => Promise<void>) | undefined => {
    const id = inboxIdOfToast(toastId)

    return id === undefined || action.result === undefined ? undefined : internalInboxStore.completer(id, index)
}

/**
 * Starts listening for toasts from Inertia: flash data on every response, including pages without a Toaster, and
 * toasts in the headers of other responses. Safe to call more than once; later calls only change the given options.
 */
export function initNotifications(inertia: InertiaBindings, options: NotificationsOptions = {}): void {
    flashKey = options.flashKey ?? flashKey
    toastStore.configure(options)

    arrivalToasts = options.inbox?.arrivalToasts ?? arrivalToasts
    onArrival = options.inbox?.onArrival ?? onArrival

    if (options.errorToasts !== undefined) {
        errorOverrides = options.errorToasts === false ? undefined : options.errorToasts === true ? {} : options.errorToasts
    }

    if (!isBrowser) {
        return
    }

    if (!bindings) {
        bindings = inertia
        // Failures that an error toast already covers show only that toast.
        const fail = (message: () => string) => (error: unknown) => {
            const messages = errorMessages()

            if (!(messages && errorToastContent(error, messages))) {
                toastStore.add(message(), { type: 'error' })
            }
        }

        inboxStore.connect(inertia, { onFailure: fail(() => trans('inbox_update_failed')) })
        preferencesStore.connect(inertia, { onFailure: fail(() => trans('preferences_save_failed')) })

        // The preferences of a user who signed out must not show to the next one, and a component that stayed on the
        // page loads those of the user who signs in. The first user's preferences load when the component mounts.
        const accountOf = ({ url, user }: { url: string | undefined; user: string | undefined }) => (url === undefined ? undefined : (user ?? ''))
        let account = accountOf(inboxStore.getSnapshot())
        let known = account !== undefined

        inboxStore.subscribe(() => {
            const next = accountOf(inboxStore.getSnapshot())

            if (next !== account) {
                if (known) {
                    preferencesStore.reset(inboxStore.getSnapshot().url)
                }

                known ||= next !== undefined
                account = next
            }
        })
        listen(inertia)
        inboxStore.onArrival((item) => onArrival?.(item))
        inboxStore.onChange(syncArrivalToasts)
        internalInboxStore.onPanelOpened(dismissNotificationToasts)
        realtime = createRealtime(internalInboxStore, inertia, showArrival)
        browserAlerts = createBrowserAlerts(inboxStore)
        pushStore.connect(
            inertia,
            internalInboxStore,
            seesToast,
            fail(() => trans('preferences_push_device_remove_failed')),
        )
    }

    inboxStore.connect(bindings, { prop: options.inbox?.prop })
    realtime?.configure({ echo: options.inbox?.echo, poll: options.inbox?.poll })
    browserAlerts?.configure(options.inbox ?? {})
}

/** Shows the toasts of Inertia's responses and keeps the notification center's counts current. */
function listen(inertia: InertiaBindings): void {
    inertia.onFlash(handleFlash)
    inertia.onNavigate((props, type) => inboxStore.sync(props, type))

    // Tells the server this client reads toasts from response headers. Same origin only, to avoid CORS preflights.
    inertia.onRequest((config) => (sameOrigin(config.url) ? { ...config.headers, [TOASTS_HEADER]: '1' } : config.headers))

    inertia.onResponse((response) => {
        handleFlash(flashFromResponse(response))
        receive(headerToasts(response.headers))
    })

    const showError = (error: unknown): void => {
        const response = (error as { response?: HttpResponseLike } | null)?.response

        if (response?.headers) {
            receive(headerToasts(response.headers))
        }

        const messages = errorMessages()
        const content = messages && errorToastContent(error, messages)

        if (content) {
            toastStore.add(content.title, { type: 'error', description: content.description })
        }
    }

    inertia.onError(showError)

    // The toasts replace Inertia's error dialog for the statuses that error toasts cover: the error toast, or the toasts
    // that the server sent in its place. An Inertia page renders instead, which `false` would stop.
    inertia.onHttpException((response) => {
        const messages = errorMessages()

        return messages && response.status !== undefined && !response.headers['x-inertia'] && statusMessage(response.status, messages) ? false : undefined
    })

    const syncVisibility = (): void => (document.visibilityState === 'hidden' ? toastStore.pause('hidden') : toastStore.resume('hidden'))
    document.addEventListener('visibilitychange', syncVisibility)
    syncVisibility()

    window.addEventListener('blur', () => toastStore.pause('blur'))
    window.addEventListener('focus', () => toastStore.resume('blur'))
}

// The action that runs on each toast, so an action settles only the toast it started on.
const actionRuns = new Map<string, object>()

/** Runs an action of an open toast: its callback, event, and visit. Ignored while another action of the toast runs. */
export function runToastAction(id: string, index: number): void {
    const toast = toastStore.getSnapshot().find((candidate) => candidate.id === id)
    const action = toast?.actions[index]

    if (!toast || !action || toast.state === 'closing' || toast.pendingAction !== undefined) {
        return
    }

    markToastRead(id)

    const complete = toastCompleter(id, index, action)
    const run = {}
    const finish = (): void => {
        if (action.keepOpen) {
            toastStore.setPendingAction(id, undefined)
        } else {
            toastStore.dismiss(id, 'action')
        }
    }

    // `performAction()` saved the result of an action that succeeded whatever happened to the toast meanwhile. A toast that
    // replaced this one by its ID, or that was added again, starts without a pending action and is not this run's to close,
    // and neither is a toast whose next run started.
    const settle = (succeeded: boolean): void => {
        if (actionRuns.get(id) !== run) {
            return
        }

        actionRuns.delete(id)

        if (toastStore.getSnapshot().find((candidate) => candidate.id === id)?.pendingAction === index) {
            succeeded ? finish() : toastStore.setPendingAction(id, undefined)
        }
    }

    const outcome = performAction(action, toast, bindings, settle, complete)

    if (outcome === 'pending') {
        actionRuns.set(id, run)
        toastStore.setPendingAction(id, index)
    } else if (outcome === 'done') {
        finish()
    }
}

/**
 * Handles a click on an action. A click on a link that opens with a modifier key, in a new tab, or in the browser, or
 * that leads to another origin, is left to the browser, and saves the result of a notification's action like the
 * notification center; everything else runs the action, such as a click on a button.
 */
export function handleActionClick(id: string, index: number, event: ActionClick): void {
    const toast = toastStore.getSnapshot().find((candidate) => candidate.id === id)
    const action = toast?.actions[index]

    if (!action) {
        return
    }

    const href = actionHref(action)
    const save = toastCompleter(id, index, action)

    if (href !== undefined && followsInBrowser(action, href, event)) {
        followLinkAction(href, action, event, () => markToastRead(id), save)

        if (isModifiedClick(event)) {
            return
        }

        if (action.event) {
            window.dispatchEvent(new CustomEvent(action.event, { detail: action.payload }))
        }

        if (!action.keepOpen) {
            toastStore.dismiss(id, 'action')
        }

        return
    }

    event.preventDefault()
    runToastAction(id, index)
}

/** A toast's title, or its title with options. */
export type ToastInput = string | (ToastOptions & { title: string })

export interface PromiseToastOptions<T> extends Omit<ToastOptions, 'type'> {
    loading: ToastInput
    /** Replaces the loading toast when the promise resolves; omit to close it. */
    success?: ToastInput | ((value: T) => ToastInput)
    /** Replaces the loading toast when the promise rejects or resolves with a failed `Response`, which it receives; omit to close it. */
    error?: ToastInput | ((error: unknown) => ToastInput)
}

export interface PromiseToast<T> {
    id: string
    /**
     * The original promise. `toast.promise()` returns this object instead of the promise, so a failure does not become an
     * unhandled rejection. A failed `Response` still resolves it, as it resolves `fetch()`.
     */
    unwrap(): Promise<T>
}

export interface TrackToastOptions extends Omit<ToastOptions, 'type'> {
    /** Shown while the visit runs. */
    loading?: ToastInput
    /** Shown when the visit succeeds; omit when the server flashes its own toast. */
    success?: ToastInput | ((page: unknown) => ToastInput)
    /** Shown when the visit fails validation, with the errors; omit to only close the loading toast. */
    error?: ToastInput | ((errors: Record<string, string>) => ToastInput)
}

interface VisitCallbacks {
    onStart?: (visit: unknown) => void
    onProgress?: (progress: unknown) => void
    onSuccess?: (page: unknown) => void
    onError?: (errors: unknown) => void
    onFinish?: (visit: unknown) => void
}

type TypedToast = (title: string, options?: Omit<ToastOptions, 'type'>) => string

export interface ToastFunction {
    (title: string, options?: ToastOptions): string
    success: TypedToast
    info: TypedToast
    warning: TypedToast
    error: TypedToast
    /** A toast with a spinner that stays open; replace it by passing its ID to another toast. */
    loading: TypedToast
    /** Changes an open toast; omitted fields keep their value. */
    update(id: string, changes: ToastUpdate): void
    /** Closes one toast, or every toast when no ID is given. */
    dismiss(id?: string): void
    /** Shows a loading toast until the promise settles, then replaces it with a success or error toast. */
    promise<T>(promise: Promise<T> | (() => Promise<T>), options: PromiseToastOptions<T>): PromiseToast<T>
    /**
     * Returns callbacks for an Inertia visit, such as `router.post(url, data, toast.track({ loading: 'Saving…' }))`,
     * that show a loading toast while the visit runs, with the progress of a file upload. Pass visit options as the
     * second argument to keep their callbacks.
     */
    track<T extends object = Record<never, never>>(options: TrackToastOptions, visitOptions?: T): T & Required<VisitCallbacks>
    /** Shows the toasts in the headers of a response that did not come through Inertia, such as from `fetch()`. */
    fromHeaders(headers: Headers | Record<string, string>): void
}

// On the server, the module-level store would be shared by every request, so toasts are ignored there.
const add = (title: string, options?: ToastOptions): string => (isBrowser ? toastStore.add(title, options) : (options?.id ?? ''))

const typed =
    (type: ToastType): TypedToast =>
    (title, options) =>
        add(title, { ...options, type })

/** Adds `input` as a toast of the given type, replacing the toast with ID `id`. */
const replace = (id: string, type: ToastType, common: ToastOptions, input: ToastInput): string => {
    const { title, ...options } = typeof input === 'string' ? { title: input } : input

    return add(title, { ...common, type, ...options, id })
}

const settle = <A>(id: string, type: ToastType, common: ToastOptions, input: ToastInput | ((argument: A) => ToastInput) | undefined, argument: A): void => {
    if (input !== undefined) {
        replace(id, type, common, typeof input === 'function' ? input(argument) : input)
    } else if (toastStore.getSnapshot().some((open) => open.id === id && open.type === 'loading')) {
        // A toast that already took the place of the loading toast, such as one the server flashed with its ID, stays.
        toastStore.dismiss(id)
    }
}

let trackCounter = 0

export const toast: ToastFunction = Object.assign(add, {
    success: typed('success'),
    info: typed('info'),
    warning: typed('warning'),
    error: typed('error'),
    loading: typed('loading'),
    update: (id: string, changes: ToastUpdate) => toastStore.update(id, changes),
    dismiss: (id?: string) => toastStore.dismiss(id),
    promise<T>(promise: Promise<T> | (() => Promise<T>), { loading, success, error, ...common }: PromiseToastOptions<T>): PromiseToast<T> {
        const id = replace(common.id ?? `iui-promise-${++trackCounter}`, 'loading', common, loading)
        const result = (typeof promise === 'function' ? promise() : promise).then(
            (value) => {
                // fetch() also resolves with the response of a failed request, such as a 500.
                if (typeof Response !== 'undefined' && value instanceof Response && !value.ok) {
                    settle(id, 'error', common, error, value)
                } else {
                    settle(id, 'success', common, success, value)
                }

                return value
            },
            (reason: unknown) => {
                settle(id, 'error', common, error, reason)

                throw reason
            },
        )

        result.catch(() => {})

        return { id, unwrap: () => result }
    },
    track<T extends object>({ loading, success, error, ...common }: TrackToastOptions, visitOptions?: T) {
        const callbacks = (visitOptions ?? {}) as VisitCallbacks
        const id = common.id ?? `iui-track-${++trackCounter}`
        let settled = false

        return {
            ...visitOptions,
            onStart(visit: unknown) {
                settled = false

                if (loading !== undefined) {
                    replace(id, 'loading', common, loading)
                }

                callbacks.onStart?.(visit)
            },
            onProgress(progress: unknown) {
                // Inertia reports the progress of visits that upload files. Its `percentage` is 0 while the size is
                // unknown, so only `progress` counts.
                const fraction = (progress as { progress?: number } | null | undefined)?.progress

                if (loading !== undefined && fraction !== undefined) {
                    toastStore.update(id, { progress: fraction })
                }

                callbacks.onProgress?.(progress)
            },
            onSuccess(page: unknown) {
                settled = true
                settle(id, 'success', common, success, page)
                callbacks.onSuccess?.(page)
            },
            onError(errors: unknown) {
                settled = true
                settle(id, 'error', common, error, errors as Record<string, string>)
                callbacks.onError?.(errors)
            },
            onFinish(visit: unknown) {
                // Cancelled and interrupted visits.
                if (!settled) {
                    toastStore.dismiss(id)
                }

                callbacks.onFinish?.(visit)
            },
        } as T & Required<VisitCallbacks>
    },
    fromHeaders(headers: Headers | Record<string, string>) {
        const value = headers instanceof Headers ? headers.get(TOASTS_HEADER) : (headers[TOASTS_HEADER] ?? headers['X-InertiaUI-Toasts'])

        if (isBrowser && value) {
            receive(headerToasts({ [TOASTS_HEADER]: value }))
        }
    },
})
