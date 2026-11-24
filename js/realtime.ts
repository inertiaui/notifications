import { isRecord } from './flash'
import type { InboxItem, InternalInboxStore } from './inbox'
import type { InertiaBindings } from './inertia'
import type { ToastAction, ToastOptions, ToastUpdate } from './types'

/** The event of `InboxNotificationArrived`, which the server sends for every stored notification when `inbox.broadcast_notifications` is enabled. */
export const ARRIVED_EVENT = '.inertiaui.inbox.arrived'

/** The event of `InboxChanged`, which the server sends when `inbox.broadcast_changes` is enabled. */
export const CHANGED_EVENT = '.inertiaui.inbox.changed'

/** The event of `AnnouncementPublished`, which the server sends when `inbox.broadcast_announcements` is enabled. */
export const ANNOUNCEMENT_EVENT = '.inertiaui.announcement.published'

/** Every signed-in browser receives a published announcement at once, so each one requests it within this many milliseconds, at random. */
export const ANNOUNCEMENT_SPREAD = 1000

/** The `BroadcastChannel` that the tabs of a browser share changes on. */
export const TAB_CHANNEL = 'inertiaui-inbox'

/** The parts of a Laravel Echo channel that the notification center uses. */
export interface EchoChannelLike {
    listen(event: string, callback: (payload: unknown) => void): unknown
    stopListening(event: string, callback?: (payload: unknown) => void): unknown
}

/** The parts of Laravel Echo that the notification center uses, from `laravel-echo` or an `@laravel/echo-*` package. */
export interface EchoLike {
    private(channel: string): EchoChannelLike
    socketId(): string | null | undefined
    connector?: { onConnectionChange?(callback: (status: string) => void): unknown }
}

export interface RealtimeOptions {
    /** Laravel Echo, or a function that returns it, such as `echo` from `@laravel/echo-vue`. `null` stops listening. */
    echo?: EchoLike | (() => EchoLike | undefined) | null
    /** Milliseconds between requests for the counts, paused while the tab is hidden. `false` stops polling. */
    poll?: number | false
}

export interface Realtime {
    configure(options: RealtimeOptions): void
    destroy(): void
}

/**
 * Keeps the store current while the page is open: listens on the user's private channel with Echo for new
 * notifications and the changes of their other sessions, and on the announcements channel for published announcements,
 * polls the counts when asked to, and shares the changes the user makes with the other tabs of the browser.
 */
export function createRealtime(store: InternalInboxStore, bindings: InertiaBindings, onArrival: (item: InboxItem) => void): Realtime {
    let resolveEcho: (() => EchoLike | undefined) | undefined
    let socketIdSent = false
    let subscription: { channel: string; resolve: () => EchoLike | undefined; stop: () => void } | undefined
    let announcements: { channel: string; resolve: () => EchoLike | undefined; stop: () => void } | undefined
    const waiting = new Set<ReturnType<typeof setTimeout>>()
    let interval: number | false = false
    let timer: ReturnType<typeof setInterval> | undefined

    const echo = (): EchoLike | undefined => {
        try {
            return resolveEcho?.()
        } catch {
            // Echo is not configured yet; the next change of the store tries again.
            return undefined
        }
    }

    const onNotification = (payload: unknown): void => {
        const item = isRecord(payload) ? store.receive(payload.item, payload.counts) : undefined

        if (item) {
            onArrival(item)
        }
    }

    // A snoozed notification that the unsnooze command brought back arrives like a new one, after the store's listeners.
    const onChange = (payload: unknown): void => {
        const stop = store.onArrival(onArrival)

        try {
            store.receiveChange(payload)
        } finally {
            stop()
        }
    }

    // The broadcast only holds the announcement's ID, since the server decides who sees it.
    const onAnnouncement = (payload: unknown): void => {
        if (!isRecord(payload) || typeof payload.id !== 'string') {
            return
        }

        const { id } = payload
        const context = typeof payload.context === 'string' ? payload.context : null
        const timer = setTimeout(() => {
            waiting.delete(timer)
            void store.loadArrival(id, context).then((item) => item && onArrival(item))
        }, Math.random() * ANNOUNCEMENT_SPREAD)

        waiting.add(timer)
    }

    // Listens on the announcements channel while the server broadcasts announcements and a user is signed in.
    const followAnnouncements = (): void => {
        const { announcementsChannel: channel } = store.getSnapshot()

        if (announcements && announcements.channel === channel && announcements.resolve === resolveEcho) {
            return
        }

        announcements?.stop()
        announcements = undefined

        const instance = channel === null ? undefined : echo()

        if (!instance || channel === null || !resolveEcho) {
            return
        }

        const echoChannel = instance.private(channel)
        echoChannel.listen(ANNOUNCEMENT_EVENT, onAnnouncement)

        announcements = {
            channel,
            resolve: resolveEcho,
            stop: () => echoChannel.stopListening(ANNOUNCEMENT_EVENT, onAnnouncement),
        }
    }

    const follow = (): void => {
        followUser()
        followAnnouncements()
    }

    // Listens on the channel of the signed-in user, and moves to the new channel when another user signs in.
    const followUser = (): void => {
        const { channel } = store.getSnapshot()

        if (subscription && subscription.channel === channel && subscription.resolve === resolveEcho) {
            return
        }

        subscription?.stop()
        subscription = undefined

        const instance = channel === null ? undefined : echo()

        if (!instance || channel === null || !resolveEcho) {
            return
        }

        const echoChannel = instance.private(channel)
        echoChannel.listen(ARRIVED_EVENT, onNotification)
        echoChannel.listen(CHANGED_EVENT, onChange)

        let offline = false
        const unwatch = instance.connector?.onConnectionChange?.((status) => {
            // Events sent while the connection was down are lost, so the counts are requested again.
            if (status === 'connected' && offline) {
                void store.refresh()
            }

            offline = status !== 'connected'
        })

        subscription = {
            channel,
            resolve: resolveEcho,
            stop() {
                // Only this listener: the application may listen on the same channel.
                echoChannel.stopListening(ARRIVED_EVENT, onNotification)
                echoChannel.stopListening(CHANGED_EVENT, onChange)

                if (typeof unwatch === 'function') {
                    unwatch()
                }
            },
        }
    }

    const hidden = (): boolean => typeof document !== 'undefined' && document.visibilityState === 'hidden'

    const schedule = (): void => {
        clearInterval(timer)
        timer = interval && !hidden() ? setInterval(() => void store.refresh(), interval) : undefined
    }

    const onVisibilityChange = (): void => {
        if (interval && !hidden()) {
            void store.refresh()
        }

        schedule()
    }

    if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', onVisibilityChange)
    }

    const tabs = typeof BroadcastChannel === 'function' ? new BroadcastChannel(TAB_CHANNEL) : undefined

    tabs?.addEventListener('message', (event: MessageEvent) => {
        const { url, user, channel } = store.getSnapshot()
        const data: unknown = event.data

        // Tabs of a signed-out user, or of another user, ignore the change.
        if (isRecord(data) && url !== undefined && data.url === url && data.user === user && data.channel === channel) {
            store.receiveChange(data)
        }
    })

    const stopSharing = store.onSaved(({ change, counts }) => {
        const { url, user, channel } = store.getSnapshot()
        tabs?.postMessage({ change, counts, url, user, channel })
    })

    const unsubscribe = store.subscribe(follow)

    return {
        configure(options) {
            if (options.echo !== undefined) {
                const value = options.echo
                resolveEcho = typeof value === 'function' ? value : value ? () => value : undefined

                // Lets the server leave this browser out of the changes it broadcasts with toOthers().
                if (resolveEcho && !socketIdSent) {
                    socketIdSent = true
                    bindings.useSocketId(() => echo()?.socketId())
                }
            }

            if (options.poll !== undefined) {
                interval = options.poll
                schedule()
            }

            follow()
        },
        destroy() {
            unsubscribe()
            stopSharing()
            subscription?.stop()
            subscription = undefined
            announcements?.stop()
            announcements = undefined
            waiting.forEach((timer) => clearTimeout(timer))
            waiting.clear()
            clearInterval(timer)
            tabs?.close()

            if (typeof document !== 'undefined') {
                document.removeEventListener('visibilitychange', onVisibilityChange)
            }
        },
    }
}

/** Which notifications that arrive in real time show as a toast. */
export type ArrivalToasts = 'requested' | 'all' | 'none'

const TOAST_PREFIX = 'inertiaui-inbox-'

/** The ID of the toast for a notification. A toast that the server flashes for it has the same ID, so only one shows. */
export const inboxToastId = (id: string): string => `${TOAST_PREFIX}${id}`

/** The ID of the notification that a toast shows, from the toast's ID, or `undefined` for other toasts. */
export const inboxIdOfToast = (toastId: string): string | undefined => (toastId.startsWith(TOAST_PREFIX) ? toastId.slice(TOAST_PREFIX.length) : undefined)

/**
 * The toast for a notification that arrived in real time: the one the server flashes for `InboxMessage::toast()`.
 * With `all`, notifications without a toast type show as a default toast. Announcements never show one. It shows the notification's icon, or the
 * avatar of its actor. Returns `undefined` for no toast.
 */
export function arrivalToast(item: InboxItem, mode: ArrivalToasts, view: ViewAction): { title: string; options: ToastOptions } | undefined {
    const silent = mode === 'none' || item.announcement || item.quiet === true || item.readAt !== null || item.archivedAt !== null
    const type = silent ? null : (item.toast ?? (mode === 'all' ? 'default' : null))

    if (type === null) {
        return undefined
    }

    const { title, ...content } = toastContent(item, view)

    return { title, options: { id: inboxToastId(item.id), type, ...content } }
}

/**
 * The link of a notification's toast to the notification's URL. Its `altText` tells that the notification is also in the
 * notification center, so the link does not keep the toast open.
 */
export type ViewAction = Pick<ToastAction, 'label' | 'altText'>

/** The text, actions, and image of the toast of a notification, also for an open toast whose notification the server updated. */
export function toastContent(item: InboxItem, view: ViewAction): ToastUpdate & { title: string } {
    // The server's actions have no callbacks, which would receive the notification instead of the toast.
    const actions: readonly ToastAction[] =
        item.actions.length > 0 || item.url === null ? item.actions.map(({ onClick: _onClick, ...action }) => action) : [{ ...view, href: item.url }]

    return { title: item.title, description: item.body ?? undefined, actions, icon: item.icon ?? undefined, image: item.actor?.avatar }
}
