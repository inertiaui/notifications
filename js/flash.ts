import {
    TOAST_ACTION_METHODS,
    TOAST_POSITIONS,
    type Toast,
    type ToastAction,
    type ToastActionMethod,
    type ToastOptions,
    type ToastPosition,
    type ToastType,
} from './types'

/** Matches the default `flash_key` in `config/inertia-notifications.php`. */
export const DEFAULT_FLASH_KEY = 'inertiaui'

/** Carries toasts on responses that are not Inertia pages, such as JSON for `useHttp`. Also sent by the client to say it reads them. */
export const TOASTS_HEADER = 'x-inertiaui-toasts'

/** A toast as the server flashes it, under `toasts` in the package's flash data. */
export interface FlashedToast {
    /** Unique per flash. */
    uuid: string
    id?: string
    type: ToastType
    title: string
    description?: string
    /** Absent for the frontend default; `null` for a persistent toast. */
    duration?: number | null
    actions?: Array<Omit<ToastAction, 'onClick'>>
    icon?: string | false
    /** Set with `->image()`. */
    image?: string
    dismissible?: boolean
    position?: ToastPosition
    toaster?: string
    /** Set with `->with()`. */
    data?: Record<string, unknown>
    /** Set with `->progress()`, from 0 to 1. */
    progress?: number
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
export type InertiaUIFlashData<Key extends string = typeof DEFAULT_FLASH_KEY> = {
    [K in Key]?: { toasts?: FlashedToast[] }
}

/** A toast as the client accepts it from the server. */
interface ServerToast {
    /** Unique per flash, so the same flash data is shown once however often it arrives. */
    uuid: string
    /** Set with `->id()`; replaces the open toast with the same ID. */
    id?: string
    type?: ToastType
    title: string
    description?: string
    duration?: number | null
    actions?: unknown
    icon?: string | false
    image?: unknown
    dismissible?: boolean
    position?: ToastPosition
    toaster?: string
    data?: unknown
    progress?: number
}

/** Whether a value the server sent is an object, such as a JSON object, and not an array. */
export const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)

/** A string the server sent, or `null` for any other value. */
export const textOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null)

/** Whether a value is a built-in toast type or a valid custom type name. */
export const isToastType = (value: unknown): value is ToastType => typeof value === 'string' && /^[a-z][a-z\d-]*$/.test(value)

const isServerToast = (value: unknown): value is ServerToast =>
    isRecord(value) && typeof value.uuid === 'string' && typeof value.title === 'string' && (value.type === undefined || isToastType(value.type))

/** Rejects `javascript:` and similar URLs, which would run script when a link opens them. */
export function safeHref(href: unknown): string | undefined {
    if (typeof href !== 'string') {
        return undefined
    }

    // Browsers ignore tabs, newlines, and leading control characters in the scheme, so strip them before checking it.
    // oxlint-disable-next-line no-control-regex
    const scheme = /^([a-z][a-z\d+.-]*):/i.exec(href.replace(/[\u0000-\u0020]/g, ''))?.[1]?.toLowerCase()

    return scheme === undefined || scheme === 'http' || scheme === 'https' || scheme === 'mailto' || scheme === 'tel' ? href : undefined
}

/** Keeps the fields of server actions that the client understands; server actions cannot carry callbacks. */
export function parseActions<Target = Toast>(value: unknown): ToastAction<Target>[] {
    if (!Array.isArray(value)) {
        return []
    }

    return value.flatMap((action): ToastAction<Target>[] => {
        if (!isRecord(action) || typeof action.label !== 'string') {
            return []
        }

        const href = safeHref(action.href)

        if (href === undefined && typeof action.event !== 'string') {
            return []
        }

        return [
            {
                label: action.label,
                href,
                method: TOAST_ACTION_METHODS.includes(action.method as ToastActionMethod) ? (action.method as ToastActionMethod) : undefined,
                data: isRecord(action.data) ? action.data : undefined,
                visit: isRecord(action.visit) ? action.visit : undefined,
                external: action.external === true || undefined,
                newTab: action.newTab === true || undefined,
                event: typeof action.event === 'string' ? action.event : undefined,
                payload: action.payload,
                keepOpen: action.keepOpen === true || undefined,
                altText: typeof action.altText === 'string' ? action.altText : undefined,
                result: typeof action.result === 'string' ? action.result : undefined,
            },
        ]
    })
}

const optionsOf = (toast: ServerToast): ToastOptions => ({
    id: typeof toast.id === 'string' ? toast.id : undefined,
    type: toast.type,
    description: typeof toast.description === 'string' ? toast.description : undefined,
    duration: typeof toast.duration === 'number' || toast.duration === null ? toast.duration : undefined,
    actions: parseActions(toast.actions),
    icon: typeof toast.icon === 'string' || toast.icon === false ? toast.icon : undefined,
    image: safeHref(toast.image),
    dismissible: typeof toast.dismissible === 'boolean' ? toast.dismissible : undefined,
    position: TOAST_POSITIONS.includes(toast.position as ToastPosition) ? toast.position : undefined,
    toaster: typeof toast.toaster === 'string' ? toast.toaster : undefined,
    data: isRecord(toast.data) ? toast.data : undefined,
    progress: typeof toast.progress === 'number' ? toast.progress : undefined,
})

/**
 * Returns a function that passes server toasts to `add`, each once.
 *
 * The same toasts arrive more than once: from the response, from the `flash` event, and from a Toaster that reads
 * the page when it mounts. Remembering each toast's `uuid` also keeps a dismissed toast from coming back.
 */
export function createToastReceiver(add: (title: string, options: ToastOptions) => void): (toasts: unknown) => void {
    const handled = new Set<string>()

    return (toasts) => {
        if (!Array.isArray(toasts)) {
            return
        }

        for (const toast of toasts) {
            if (!isServerToast(toast)) {
                continue
            }

            if (handled.has(toast.uuid)) {
                continue
            }

            handled.add(toast.uuid)
            add(toast.title, optionsOf(toast))
        }
    }
}

/** Returns the toasts in Inertia flash data, under the given key. */
export function flashToasts(flash: Record<string, unknown> | undefined, flashKey: string): unknown {
    const bag = flash?.[flashKey]

    return isRecord(bag) ? bag.toasts : undefined
}

/** Returns the toasts in the header of a response that is not an Inertia page, such as JSON for `useHttp`. */
export function headerToasts(headers: Record<string, string>): unknown {
    const header = headers[TOASTS_HEADER]

    if (!header) {
        return undefined
    }

    try {
        return JSON.parse(header) as unknown
    } catch {
        return undefined
    }
}

/**
 * Returns the flash data of an Inertia page response.
 *
 * Inertia drops the flash data of some responses, such as the request that loads deferred props, so the
 * toasts are read from the response itself.
 */
export function flashFromResponse(response: { data: unknown; headers: Record<string, string> }): Record<string, unknown> | undefined {
    if (response.headers['x-inertia'] !== 'true') {
        return undefined
    }

    // Most responses carry no flash data; skip parsing them.
    if (typeof response.data === 'string' && !response.data.includes('"flash":')) {
        return undefined
    }

    try {
        const page = (typeof response.data === 'string' ? JSON.parse(response.data) : response.data) as { flash?: unknown } | null
        const flash = page?.flash

        return isRecord(flash) ? flash : undefined
    } catch {
        return undefined
    }
}
