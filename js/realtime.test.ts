import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { createInboxStore, parseInboxItem, type InboxItem } from './inbox'
import type { InertiaBindings } from './inertia'
import { ANNOUNCEMENT_EVENT, ANNOUNCEMENT_SPREAD, ARRIVED_EVENT, CHANGED_EVENT, arrivalToast, createRealtime, type EchoLike, type Realtime } from './realtime'

const item = (id: string, overrides: Partial<InboxItem> = {}): InboxItem => ({
    ...parseInboxItem({ id, type: 'test', title: `Notification ${id}`, createdAt: '2026-11-15T10:00:00Z' })!,
    ...overrides,
})

/** An Echo whose channels record their listeners, so the test can send events. */
function fakeEcho(socket = '1234.5678') {
    const listeners = new Map<string, (payload: unknown) => void>()
    const connection: Array<(status: string) => void> = []
    const echo: EchoLike = {
        private: (channel) => ({
            listen: (event, callback) => listeners.set(`${channel}${event}`, callback),
            stopListening: (event, callback) => listeners.get(`${channel}${event}`) === callback && listeners.delete(`${channel}${event}`),
        }),
        socketId: () => socket,
        connector: {
            onConnectionChange(callback) {
                connection.push(callback)

                return () => connection.splice(connection.indexOf(callback), 1)
            },
        },
    }

    return {
        echo,
        send: (channel: string, event: string, payload: unknown) => listeners.get(`${channel}${event}`)?.(payload),
        channels: () => [...listeners.keys()],
        connection: (status: string) => connection.forEach((callback) => callback(status)),
    }
}

const document = Object.assign(new EventTarget(), { visibilityState: 'visible' as DocumentVisibilityState })
vi.stubGlobal('document', document)

const shared = (channel: string | null, overrides: Record<string, unknown> = {}) => ({
    inertiauiInbox: { url: '/inbox', channel, unread: 0, unseen: 0, categories: [], latest: null, latestIds: [], revision: 1, ...overrides },
})

const realtimes: Realtime[] = []

/** A store with a realtime connection, and the requests it sends, which never answer unless the test says so. */
function setup(answer?: (url: string) => unknown) {
    const requests: string[] = []
    const socketIds: Array<() => string | null | undefined> = []
    const bindings = {
        request: (method: string, url: string) => {
            requests.push(`${method} ${url}`)

            return answer ? Promise.resolve(answer(url)) : new Promise(() => {})
        },
        useSocketId: (resolve: () => string | null | undefined) => void socketIds.push(resolve),
    } as unknown as InertiaBindings
    const store = createInboxStore()
    const arrivals: string[] = []

    store.connect(bindings)
    const realtime = createRealtime(store, bindings, (arrived) => arrivals.push(arrived.id))
    realtimes.push(realtime)

    return { store, realtime, requests, socketIds, arrivals, bindings }
}

beforeEach(() => vi.useFakeTimers())

afterEach(() => {
    realtimes.splice(0).forEach((realtime) => realtime.destroy())
    document.visibilityState = 'visible'
    vi.useRealTimers()
    vi.restoreAllMocks()
})

describe('realtime', () => {
    it("listens on the signed-in user's channel, moves when another user signs in, and stops on sign out", () => {
        const { store, realtime, socketIds } = setup()
        const echo = fakeEcho()

        realtime.configure({ echo: () => echo.echo })
        expect(echo.channels()).toEqual([])

        store.sync(shared('App.Models.User.1'), 'initial')
        expect(echo.channels()).toEqual([`App.Models.User.1${ARRIVED_EVENT}`, `App.Models.User.1${CHANGED_EVENT}`])
        expect(socketIds.map((resolve) => resolve())).toEqual(['1234.5678'])

        store.sync(shared('App.Models.User.2'), 'visit')
        expect(echo.channels()).toEqual([`App.Models.User.2${ARRIVED_EVENT}`, `App.Models.User.2${CHANGED_EVENT}`])

        store.sync({ inertiauiInbox: null }, 'visit')
        expect(echo.channels()).toEqual([])
    })

    it('waits for Echo to be configured, and stops listening when it is removed', () => {
        const { store, realtime } = setup()
        const echo = fakeEcho()
        let configured: EchoLike | undefined

        realtime.configure({
            echo: () => {
                if (!configured) {
                    throw new Error('Echo is not configured')
                }

                return configured
            },
        })
        store.sync(shared('App.Models.User.1'), 'initial')
        expect(echo.channels()).toEqual([])

        configured = echo.echo
        store.sync(shared('App.Models.User.1', { unread: 1 }), 'visit')
        expect(echo.channels()).toHaveLength(2)

        realtime.configure({ echo: null })
        expect(echo.channels()).toEqual([])
    })

    it('adds the notifications that arrive with their item, and applies changes from other sessions', () => {
        const { store, realtime, arrivals } = setup()
        const echo = fakeEcho()
        realtime.configure({ echo: echo.echo })
        store.sync(shared('App.Models.User.1'), 'initial')

        // The arrival holds the notification under `item`, so a payload in the shape of a broadcast notification adds nothing.
        echo.send('App.Models.User.1', ARRIVED_EVENT, { type: 'inertiaui.inbox', inertiaui: item('a') })
        echo.send('App.Models.User.1', ARRIVED_EVENT, { item: item('a') })
        echo.send('App.Models.User.1', ARRIVED_EVENT, { item: item('a') })

        expect(arrivals).toEqual(['a'])
        expect(store.getSnapshot().counts).toEqual({ unread: 1, unseen: 1 })

        echo.send('App.Models.User.1', CHANGED_EVENT, {
            change: { kind: 'item', id: 'a', readAt: '2026-11-15T10:01:00Z', seenAt: '2026-11-15T10:01:00Z', archivedAt: null, snoozedUntil: null },
            counts: { unread: 0, unseen: 0, categories: [], latest: '2026-11-15T10:00:00Z', latestIds: ['a'], revision: 2 },
        })

        expect(store.apply(item('a')).readAt).toBe('2026-11-15T10:01:00Z')
        expect(store.getSnapshot().counts).toEqual({ unread: 0, unseen: 0 })
    })

    it('counts an arriving notification that collapsed into an earlier one with the counts it came with', () => {
        const { store, realtime, arrivals } = setup()
        const echo = fakeEcho()
        realtime.configure({ echo: echo.echo })
        // The server counted the notification before a later one collapsed into it.
        store.sync(shared('App.Models.User.1', { unread: 1, unseen: 1, latest: '2026-11-15T10:00:00Z', latestIds: ['a'] }), 'initial')

        echo.send('App.Models.User.1', ARRIVED_EVENT, {
            item: item('a', { title: 'Collapsed', total: 2, createdAt: '2026-11-15T10:01:00Z' }),
            counts: { unread: 1, unseen: 1, categories: [], latest: '2026-11-15T10:01:00Z', latestIds: ['a'], revision: 2 },
        })

        expect(arrivals).toEqual(['a'])
        expect(store.getSnapshot().items.map((notification) => notification.title)).toEqual(['Collapsed'])
        expect(store.getSnapshot().counts).toEqual({ unread: 1, unseen: 1 })
    })

    it('requests a published announcement after a random delay, in the current context only, and adds it like a notification', async () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.5)
        const { store, realtime, requests, arrivals } = setup((url) => {
            // The server finds no announcement outside the user's audience.
            if (url !== '/inbox/a') {
                throw new Error('Not Found')
            }

            // The counts include the announcement and a notification that the store has not received yet.
            return {
                item: item('a', { type: 'announcement', announcement: true }),
                counts: { unread: 2, unseen: 2, categories: [], latest: '2026-11-15T10:00:00Z', latestIds: ['a'], revision: 2, context: 'acme' },
            }
        })
        const echo = fakeEcho()
        realtime.configure({ echo: echo.echo })

        store.sync(shared('App.Models.User.1', { context: 'acme' }), 'initial')
        expect(echo.channels()).not.toContain(`inertiaui.announcements${ANNOUNCEMENT_EVENT}`)

        store.sync(shared('App.Models.User.1', { context: 'acme', announcementsChannel: 'inertiaui.announcements' }), 'visit')
        expect(echo.channels()).toContain(`inertiaui.announcements${ANNOUNCEMENT_EVENT}`)

        echo.send('inertiaui.announcements', ANNOUNCEMENT_EVENT, { id: 'b', context: 'globex' })
        echo.send('inertiaui.announcements', ANNOUNCEMENT_EVENT, { id: 'c', context: null })
        echo.send('inertiaui.announcements', ANNOUNCEMENT_EVENT, { id: 'a', context: 'acme' })

        await vi.advanceTimersByTimeAsync(ANNOUNCEMENT_SPREAD / 2 - 1)
        expect(requests).toEqual([])

        await vi.advanceTimersByTimeAsync(1)
        expect(requests).toEqual(['get /inbox/c', 'get /inbox/a'])
        expect(arrivals).toEqual(['a'])
        expect(store.getSnapshot().items.map((notification) => notification.id)).toEqual(['a'])
        expect(store.getSnapshot().counts).toEqual({ unread: 2, unseen: 2 })

        // A page that closes before the delay ends requests nothing.
        echo.send('inertiaui.announcements', ANNOUNCEMENT_EVENT, { id: 'd', context: null })
        realtime.destroy()
        await vi.advanceTimersByTimeAsync(ANNOUNCEMENT_SPREAD)
        expect(requests).toHaveLength(2)
        expect(echo.channels()).not.toContain(`inertiaui.announcements${ANNOUNCEMENT_EVENT}`)
    })

    it('requests the counts again when the connection comes back, because events sent meanwhile are lost', () => {
        const { store, realtime, requests } = setup()
        const echo = fakeEcho()
        realtime.configure({ echo: echo.echo })
        store.sync(shared('App.Models.User.1'), 'initial')

        echo.connection('connected')
        expect(requests).toEqual([])

        echo.connection('reconnecting')
        echo.connection('connected')
        expect(requests).toEqual(['get /inbox/counts'])
    })

    it('polls the counts only while the tab is visible, and right away when it shows again', () => {
        const { store, realtime, requests } = setup()
        store.sync(shared(null), 'initial')

        realtime.configure({ poll: 10_000 })
        vi.advanceTimersByTime(20_000)
        expect(requests).toEqual(['get /inbox/counts', 'get /inbox/counts'])

        document.visibilityState = 'hidden'
        document.dispatchEvent(new Event('visibilitychange'))
        vi.advanceTimersByTime(30_000)
        expect(requests).toHaveLength(2)

        document.visibilityState = 'visible'
        document.dispatchEvent(new Event('visibilitychange'))
        expect(requests).toHaveLength(3)

        realtime.configure({ poll: false })
        vi.advanceTimersByTime(30_000)
        document.dispatchEvent(new Event('visibilitychange'))
        expect(requests).toHaveLength(3)
    })

    it("shares the user's saved changes with the other tabs of the same user", async () => {
        vi.useRealTimers()
        const change = { kind: 'item', id: 'a', readAt: '2026-11-15T10:01:00Z', seenAt: '2026-11-15T10:01:00Z', archivedAt: null, snoozedUntil: null }
        const first = setup(() => ({ counts: { unread: 0, unseen: 0, categories: [], latest: null, latestIds: [], revision: 2 }, change }))
        const second = setup()
        const other = setup()

        first.store.sync(shared('App.Models.User.1', { user: 'A', unread: 1, unseen: 1 }), 'initial')
        second.store.sync(shared('App.Models.User.1', { user: 'A', unread: 1, unseen: 1 }), 'initial')
        // Another user, on a channel that the application shares between users.
        other.store.sync(shared('App.Models.User.1', { user: 'B', unread: 1, unseen: 1 }), 'initial')

        await first.store.markAsRead(item('a'))
        await new Promise((resolve) => setTimeout(resolve, 50))

        expect(second.store.apply(item('a')).readAt).toBe('2026-11-15T10:01:00Z')
        expect(second.store.getSnapshot().counts).toEqual({ unread: 0, unseen: 0 })
        // A tab of another user ignores it.
        expect(other.store.apply(item('a')).readAt).toBeNull()
        expect(other.store.getSnapshot().counts).toEqual({ unread: 1, unseen: 1 })
    })

    it('keeps sharing the saved changes with the other tabs once a second realtime connection of the store stops', async () => {
        vi.useRealTimers()
        const change = { kind: 'item', id: 'a', readAt: '2026-11-15T10:01:00Z', seenAt: '2026-11-15T10:01:00Z', archivedAt: null, snoozedUntil: null }
        const first = setup(() => ({ counts: { unread: 0, unseen: 0, categories: [], latest: null, latestIds: [], revision: 2 }, change }))
        const second = setup()

        first.store.sync(shared('App.Models.User.1', { user: 'A', unread: 1, unseen: 1 }), 'initial')
        second.store.sync(shared('App.Models.User.1', { user: 'A', unread: 1, unseen: 1 }), 'initial')
        createRealtime(first.store, first.bindings, () => {}).destroy()

        await first.store.markAsRead(item('a'))
        await new Promise((resolve) => setTimeout(resolve, 50))

        expect(second.store.apply(item('a')).readAt).toBe('2026-11-15T10:01:00Z')
    })

    it('shares a pause with the other tabs of the same user', async () => {
        vi.useRealTimers()
        const until = new Date(Date.now() + 3_600_000).toISOString()
        const first = setup(() => ({
            counts: { unread: 0, unseen: 0, categories: [], latest: null, latestIds: [], revision: 2 },
            change: { kind: 'pause', until },
        }))
        const second = setup()

        first.store.sync(shared('App.Models.User.1', { user: 'A', pause: { until: null } }), 'initial')
        second.store.sync(shared('App.Models.User.1', { user: 'A', pause: { until: null } }), 'initial')

        await first.store.pause(until)
        await new Promise((resolve) => setTimeout(resolve, 50))

        expect(second.store.getSnapshot().pausedUntil).toBe(until)

        // Signing out stops the timers that wait for the end of the pause.
        first.store.sync({ inertiauiInbox: null }, 'visit')
        second.store.sync({ inertiauiInbox: null }, 'visit')
    })
})

describe('arrival toasts', () => {
    const view = { label: 'View', altText: 'Also in your notifications.' }

    it('shows the toast the notification asked for, or every unread notification with all', () => {
        const requested = item('a', { toast: 'success', body: 'Version 2.1 is live.', url: '/deploys/1' })

        expect(arrivalToast(requested, 'requested', view)).toEqual({
            title: 'Notification a',
            options: {
                id: 'inertiaui-inbox-a',
                type: 'success',
                description: 'Version 2.1 is live.',
                actions: [{ label: 'View', altText: 'Also in your notifications.', href: '/deploys/1' }],
            },
        })
        expect(arrivalToast(item('b'), 'requested', view)).toBeUndefined()
        expect(arrivalToast(item('b'), 'all', view)?.options.type).toBe('default')
        expect(arrivalToast(requested, 'none', view)).toBeUndefined()
        expect(arrivalToast({ ...requested, readAt: '2026-11-15T10:00:00Z' }, 'all', view)).toBeUndefined()
        expect(arrivalToast({ ...requested, quiet: true }, 'all', view)).toBeUndefined()
        expect(arrivalToast({ ...requested, announcement: true }, 'all', view)).toBeUndefined()

        // The notification's own actions replace the link to its URL.
        const actions = [{ label: 'Refund', href: '/invoices/7/refund', method: 'post' as const }]
        expect(arrivalToast({ ...requested, actions }, 'requested', view)?.options.actions).toEqual(actions)
    })

    it('shows the icon of the notification, and the avatar of its actor in place of it', () => {
        const comment = item('c', { toast: 'default', icon: 'chat', actor: { name: 'Sophie Martin', avatar: 'https://example.com/sophie.jpg' } })

        expect(arrivalToast(comment, 'requested', view)?.options).toMatchObject({ icon: 'chat', image: 'https://example.com/sophie.jpg' })
        expect(arrivalToast({ ...comment, actor: { name: 'Sophie Martin' } }, 'requested', view)?.options.image).toBeUndefined()
        expect(arrivalToast({ ...comment, icon: null }, 'requested', view)?.options.icon).toBeUndefined()
    })
})
