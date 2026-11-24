import { safeHref } from './flash'
import type { InertiaBindings } from './inertia'
import type { ToastAction } from './types'

/** The URL an action links to, when it navigates with GET; such actions render as links. */
export function actionHref<Target>(action: ToastAction<Target>): string | undefined {
    const href = safeHref(action.href)

    return href !== undefined && (action.method ?? 'get') === 'get' ? href : undefined
}

/** Whether a URL, such as a relative one, has the origin of the current page. A URL that does not parse has another one. */
export function sameOrigin(url: string): boolean {
    try {
        return new URL(url, window.location.href).origin === window.location.origin
    } catch {
        return false
    }
}

/**
 * A click on a notification or on an action, with what the package reads from it. Every handler takes this one type and
 * each guard picks its parts from it, since a copy without `target` would take every click on a link for one on a button.
 */
export type ActionClick = Pick<MouseEvent, 'button' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'preventDefault'> & {
    defaultPrevented?: boolean
    target?: EventTarget | null
}

/** Whether a click comes with a modifier key or from a button other than the main one, such as a click that opens a new tab. */
export function isModifiedClick(event: Pick<ActionClick, 'button' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>): boolean {
    return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
}

/** Whether a click comes from a link that the browser can follow, unlike one on a button that runs the action. */
function clickedLink(event: Pick<ActionClick, 'target'>): boolean {
    const target = event.target as Partial<Pick<Element, 'closest'>> | null | undefined

    return typeof target?.closest === 'function' && target.closest('a[href]') !== null
}

/**
 * Whether the browser follows a click on the link of an action itself instead of running the action: a click that opens
 * a new tab, or a link that opens one, loads in the browser, or leads to another origin. A click on a button has no link
 * to follow, so the action runs, and an action with a callback runs it.
 */
export function followsInBrowser<Target>(
    action: ToastAction<Target>,
    href: string,
    event: Pick<ActionClick, 'button' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'target'>,
): boolean {
    return !action.onClick && clickedLink(event) && (isModifiedClick(event) || action.external || action.newTab || !sameOrigin(href))
}

/** How long an action that leaves in the same tab waits for its notification's result to save. */
const SAVE_BEFORE_LEAVING = 1500

/**
 * Follows a link in the same tab once the result of its notification saved or failed to, since a request may be lost
 * when the page unloads. A server that does not answer in time does not keep the user on the page.
 */
function followAfterSave(saving: Promise<unknown>, href: string): void {
    let timer: ReturnType<typeof setTimeout> | undefined
    const follow = (): void => {
        if (timer !== undefined) {
            clearTimeout(timer)
            timer = undefined
            window.location.assign(href)
        }
    }

    timer = setTimeout(follow, SAVE_BEFORE_LEAVING)
    void saving.then(follow, follow)
}

/**
 * The steps of a link action that the browser follows itself, such as one that opens a new tab, of a notification in the
 * notification center or of its toast: marks the notification as read and saves the action's result. A link that leaves
 * in this tab waits for the result to save.
 */
export function followLinkAction(
    href: string,
    action: Pick<ToastAction<unknown>, 'newTab'>,
    event: Pick<ActionClick, 'button' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'preventDefault'>,
    markAsRead: () => void,
    save: (() => Promise<void>) | undefined,
): void {
    markAsRead()

    const saving = save?.()

    // A request may be lost once the page unloads, so a link that leaves in this tab waits for the result to save.
    if (saving && !isModifiedClick(event) && !action.newTab) {
        event.preventDefault()
        followAfterSave(saving, href)
    }
}

const isThenable = (value: unknown): value is PromiseLike<unknown> => typeof (value as PromiseLike<unknown> | null)?.then === 'function'

/**
 * Runs an action: dispatches its event, calls its callback, and visits or loads its URL. The browser loads a GET link to
 * another origin, which is no page of the application. Returns `pending` when the callback's promise or the Inertia visit
 * is still running; `onSettled` then reports whether it succeeded. Returns `failed` for a URL with another method than
 * GET without Inertia, as the browser loads URLs only with GET, and `done` for an action that ran at once.
 *
 * An action that succeeded saves its result with `save`: at once when it ran at once, and otherwise before `onSettled`
 * reports the success. A URL that loads in this tab waits for the result to save, and a new tab opens first, so it still
 * opens within the user's click.
 */
export function performAction<Target>(
    action: ToastAction<Target>,
    target: Target,
    bindings: InertiaBindings | undefined,
    onSettled: (succeeded: boolean) => void,
    save?: () => Promise<void>,
): 'done' | 'pending' | 'failed' {
    if (action.event) {
        window.dispatchEvent(new CustomEvent(action.event, { detail: action.payload }))
    }

    const result = action.onClick?.(target)

    if (isThenable(result)) {
        result.then(
            () => {
                void save?.()
                onSettled(true)
            },
            () => onSettled(false),
        )

        return 'pending'
    }

    const href = safeHref(action.href)

    if (href === undefined) {
        void save?.()

        return 'done'
    }

    const method = action.method ?? 'get'

    // The browser loads a URL only with GET, so another method and its data always need Inertia's visit, also with `external` or `newTab`.
    if (method === 'get' && (action.external || action.newTab || !bindings || !sameOrigin(href))) {
        if (action.newTab) {
            window.open(href, '_blank', 'noopener')
            void save?.()
        } else {
            const saving = save?.()

            if (saving) {
                followAfterSave(saving, href)
            } else {
                window.location.assign(href)
            }
        }

        return 'done'
    }

    if (!bindings) {
        return 'failed'
    }

    let succeeded = false

    bindings.visit(href, {
        method,
        data: action.data,
        ...action.visit,
        onSuccess: () => void (succeeded = true),
        onFinish: () => {
            if (succeeded) {
                void save?.()
            }

            onSettled(succeeded)
        },
    })

    return 'pending'
}
