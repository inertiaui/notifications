import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import wire from '../tests/Fixtures/inbox.json'
import {
    DEFAULT_INBOX_LABELS,
    badgeText,
    createInboxStore,
    groupItems,
    label,
    listItems,
    PAUSE_PRESETS,
    parseInboxChange,
    parseInboxItem,
    pauseEnd,
    pauseOptions,
    pauseTime,
    relativeTime,
    selectedUnread,
    snoozeOptions,
    type InboxItem,
} from './inbox'
import type { InertiaBindings } from './inertia'
import { DEFAULT_PREFERENCES_LABELS } from './preferences'
import { parsePushSettings } from './push'

// The page the store runs on, which tells the application's own URLs from those of other sites.
const assign = vi.fn()
vi.stubGlobal('window', { location: { href: 'https://app.test/dashboard', origin: 'https://app.test', assign } })

const item = (id: string, createdAt: string, overrides: Partial<InboxItem> = {}): InboxItem => ({
    ...parseInboxItem({ id, type: 'test', title: `Notification ${id}`, createdAt })!,
    ...overrides,
})

/** The summary of the inbox that the server sends with its counts, read at the given revision. */
const summary = (unread: number, unseen: number, revision: number, rest: Record<string, unknown> = {}) => ({
    unread,
    unseen,
    categories: [],
    latest: null,
    latestIds: [],
    revision,
    ...rest,
})

const readChange = (id: string, readAt: string | null) => ({ kind: 'item', id, readAt, seenAt: readAt, archivedAt: null, snoozedUntil: null })

interface Call {
    method: string
    url: string
    data?: Record<string, unknown>
    resolve: (body: unknown) => void
    reject: (error: unknown) => void
}

/** A store connected to a server whose responses the test sends by hand. */
function setup() {
    const calls: Call[] = []
    const visits: string[] = []
    const onFailure = vi.fn()
    const bindings = {
        request: (method, url, data) => new Promise((resolve, reject) => calls.push({ method, url, data, resolve, reject })),
        visit: (href: string) => void visits.push(href),
    } as InertiaBindings
    const store = createInboxStore()

    const shared = { url: '/inbox', allowedActions: ['snooze', 'archive', 'mute', 'delete'], ...summary(2, 2, 1) }

    store.connect(bindings, { onFailure })
    store.sync({ inertiauiInbox: shared }, 'initial')

    const flush = () => new Promise((resolve) => setTimeout(resolve))

    return { store, bindings, shared, calls, visits, onFailure, flush }
}

describe('inbox store', () => {
    it('loads pages with the filter and cursor, without duplicates', async () => {
        const { store, calls, flush } = setup()

        const loading = store.load('unread')
        expect(store.getSnapshot().status).toBe('loading')
        expect(calls[0]).toMatchObject({ method: 'get', url: '/inbox?filter=unread' })

        calls[0]!.resolve({
            items: [item('b', '2026-11-15T10:00:00Z'), item('a', '2026-11-15T09:00:00Z')],
            nextCursor: 'next',
            counts: summary(5, 1, 2),
        })
        await loading

        const more = store.loadMore()
        await flush()
        expect(calls[1]!.url).toBe('/inbox?filter=unread&cursor=next')
        calls[1]!.resolve({ items: [item('a', '2026-11-15T09:00:00Z'), item('z', '2026-11-14T09:00:00Z')], nextCursor: null })
        await more

        expect(store.getSnapshot()).toMatchObject({ status: 'ready', hasMore: false, counts: { unread: 5, unseen: 1 } })
        expect(store.getSnapshot().items.map((notification) => notification.id)).toEqual(['b', 'a', 'z'])
    })

    it('ignores a list response that a newer load replaced', async () => {
        const { store, calls } = setup()

        const first = store.load('all')
        const second = store.load('archived')
        calls[1]!.resolve({ items: [item('archived', '2026-11-15T10:00:00Z', { archivedAt: '2026-11-15T11:00:00Z' })], nextCursor: null })
        calls[0]!.resolve({ items: [item('stale', '2026-11-15T10:00:00Z')], nextCursor: null })
        await Promise.all([first, second])

        expect(store.getSnapshot().items.map((notification) => notification.id)).toEqual(['archived'])
    })

    it('stops loading the next page of a list that a newer load replaced, and loads the next page of the new list', async () => {
        const { store, calls } = setup()

        const loading = store.load('all')
        calls[0]!.resolve({ items: [item('a', '2026-11-15T10:00:00Z')], nextCursor: 'next' })
        await loading

        const stale = store.loadMore()
        expect(store.getSnapshot().loadingMore).toBe(true)

        const switching = store.load('unread')
        expect(store.getSnapshot()).toMatchObject({ status: 'loading', loadingMore: false })
        calls[2]!.resolve({ items: [item('b', '2026-11-15T10:00:00Z')], nextCursor: 'unread-next' })
        await switching

        const more = store.loadMore()
        expect(calls[3]!.url).toBe('/inbox?filter=unread&cursor=unread-next')

        // The page of the replaced list arrives while the new list loads its next page.
        calls[1]!.resolve({ items: [item('stale', '2026-11-15T09:00:00Z')], nextCursor: 'stale-next' })
        await stale
        expect(store.getSnapshot()).toMatchObject({ status: 'ready', loadingMore: true, hasMore: true })
        expect(store.getSnapshot().items.map((notification) => notification.id)).toEqual(['b'])

        void store.loadMore()
        expect(calls).toHaveLength(4)

        calls[3]!.resolve({ items: [item('c', '2026-11-15T09:00:00Z')], nextCursor: null })
        await more
        expect(store.getSnapshot()).toMatchObject({ loadingMore: false, moreFailed: false, hasMore: false })
        expect(store.getSnapshot().items.map((notification) => notification.id)).toEqual(['b', 'c'])
    })

    it('marks as read right away, keeps the change when saved, and rolls it back when saving fails', async () => {
        const { store, calls, onFailure } = setup()
        const unread = item('a', '2026-11-15T10:00:00Z')

        const saved = store.markAsRead(unread)
        expect(store.apply(unread).readAt).not.toBeNull()
        expect(store.getSnapshot().counts).toEqual({ unread: 1, unseen: 1 })
        expect(calls[0]).toMatchObject({ method: 'post', url: '/inbox/a/read' })

        calls[0]!.resolve({ counts: summary(1, 0, 2), change: readChange('a', '2026-11-15T10:01:00Z') })
        await saved
        expect(store.getSnapshot().counts).toEqual({ unread: 1, unseen: 0 })

        const failing = store.markAsUnread(unread)
        expect(store.apply(unread).readAt).toBeNull()
        calls[1]!.reject(new Error('Server error'))
        await failing

        expect(store.apply(unread).readAt).not.toBeNull()
        expect(store.getSnapshot().counts).toEqual({ unread: 1, unseen: 0 })
        expect(onFailure).toHaveBeenCalledOnce()
    })

    it('keeps the counts of changes still being saved, and ignores the stale counts of earlier pages', async () => {
        const { store, shared, calls } = setup()
        const unread = item('a', '2026-11-15T10:00:00Z')

        const first = store.markAsRead(unread)
        const second = store.archive(item('b', '2026-11-15T09:00:00Z'))

        // The first response was computed before the archive was saved.
        calls[0]!.resolve({ counts: summary(1, 1, 2), change: readChange('a', '2026-11-15T10:01:00Z') })
        await first
        expect(store.getSnapshot().counts).toEqual({ unread: 0, unseen: 0 })

        calls[1]!.resolve({ counts: summary(0, 0, 3), change: { ...readChange('b', null), archivedAt: '2026-11-15T10:02:00Z' } })
        await second

        // A partial reload that left the prop out keeps the prop object of the first page.
        store.sync({ inertiauiInbox: shared, other: 1 }, 'visit')
        expect(store.getSnapshot().counts).toEqual({ unread: 0, unseen: 0 })

        store.sync({ inertiauiInbox: { url: '/inbox', ...summary(2, 2, 4) } }, 'history')
        store.sync({ inertiauiInbox: { url: '/inbox', ...summary(2, 2, 4) } }, 'cached')
        expect(store.getSnapshot().counts).toEqual({ unread: 0, unseen: 0 })

        store.sync({ inertiauiInbox: { url: '/inbox', ...summary(3, 1, 5) } }, 'visit')
        expect(store.getSnapshot().counts).toEqual({ unread: 3, unseen: 1 })
    })

    it('moves archived notifications between the lists of each filter', async () => {
        const { store, calls } = setup()
        const notification = item('a', '2026-11-15T10:00:00Z')

        const loading = store.load('all')
        calls[0]!.resolve({ items: [notification], nextCursor: null })
        await loading

        void store.archive(notification)

        expect(store.getSnapshot().items).toEqual([])
        expect(store.belongs(store.apply(notification), 'archived')).toBe(true)
        expect(store.belongs(store.apply(notification), 'all')).toBe(false)
        expect(store.getSnapshot().counts.unread).toBe(1)
    })

    it('marks every notification read up to the newest one shown, leaving later arrivals unread', async () => {
        const { store, calls } = setup()
        const shown = item('shown', '2026-11-15T10:00:00Z')
        const later = item('later', '2026-11-15T10:05:00Z')

        store.remember([shown, item('older', '2026-11-15T09:00:00Z')])
        void store.markAllAsRead()

        expect(calls[0]).toMatchObject({ url: '/inbox/read', data: { before: '2026-11-15T10:00:00Z' } })
        // Read now, like the server stores it.
        expect(Date.parse(store.apply(shown).readAt!)).toBeGreaterThan(Date.parse('2026-11-15T10:05:00Z'))
        expect(store.apply(later).readAt).toBeNull()
        expect(store.apply(item('archived', '2026-11-15T09:00:00Z', { archivedAt: '2026-11-15T09:30:00Z' })).readAt).toBeNull()
        expect(store.getSnapshot().counts).toEqual({ unread: 0, unseen: 0 })
    })

    it('marks notifications as seen only when there are unseen ones', async () => {
        const { store, calls } = setup()

        void store.markAllAsSeen()
        expect(calls).toHaveLength(1)
        expect(store.getSnapshot().counts.unseen).toBe(0)

        void store.markAllAsSeen()
        expect(calls).toHaveLength(1)
    })

    it('opens a notification by marking it as read and visiting its URL, leaving modified clicks to the browser', () => {
        const { store, calls, visits } = setup()
        const notification = item('a', '2026-11-15T10:00:00Z', { url: '/invoices/7' })
        const preventDefault = vi.fn()

        store.open(notification, { button: 0, metaKey: true, ctrlKey: false, shiftKey: false, altKey: false, preventDefault })
        expect(visits).toEqual([])
        expect(calls[0]!.url).toBe('/inbox/a/read')

        store.open(item('b', '2026-11-15T10:00:00Z', { url: '/invoices/8' }), {
            button: 0,
            metaKey: false,
            ctrlKey: false,
            shiftKey: false,
            altKey: false,
            preventDefault,
        })
        expect(preventDefault).toHaveBeenCalledOnce()
        expect(visits).toEqual(['/invoices/8'])
    })

    it('loads the URL of a notification in the browser when it has another origin, instead of visiting it with Inertia', () => {
        const { store, visits } = setup()
        const click = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, preventDefault: vi.fn() }
        assign.mockClear()

        store.open(item('a', '2026-11-15T10:00:00Z', { url: 'https://app.test.evil.com/x' }), click)
        store.open(item('b', '2026-11-15T10:00:00Z', { url: 'https://app.test:8443/x' }), click)
        store.open(item('c', '2026-11-15T10:00:00Z', { url: '//cdn.other.com/x' }), click)
        store.open(item('d', '2026-11-15T10:00:00Z', { url: 'https://app.test/invoices/9' }), click)

        expect(assign.mock.calls).toEqual([['https://app.test.evil.com/x'], ['https://app.test:8443/x'], ['//cdn.other.com/x']])
        expect(visits).toEqual(['https://app.test/invoices/9'])
    })

    it('loads the list when a panel opens, and marks it seen only once it shows', async () => {
        const { store, calls, flush } = setup()

        // Not loaded yet: load first, then mark as seen up to the newest notification shown.
        const opening = store.opened()
        expect(calls).toHaveLength(1)
        calls[0]!.resolve({ items: [item('a', '2026-11-15T10:00:00Z')], nextCursor: null, counts: summary(2, 2, 2) })
        await flush()
        expect(calls[1]).toMatchObject({ url: '/inbox/seen', data: { before: '2026-11-15T10:00:00Z' } })
        calls[1]!.resolve({ counts: summary(2, 0, 3), change: { kind: 'seen', before: '2026-11-15T10:00:00Z', ids: ['a'] } })
        await opening

        // Loaded and nothing new: no request.
        await store.opened()
        expect(calls).toHaveLength(2)

        // New arrivals reload the list; a failed load marks nothing as seen.
        store.sync({ inertiauiInbox: { url: '/inbox', ...summary(3, 1, 4) } }, 'visit')
        const failing = store.opened()
        expect(calls[2]).toMatchObject({ method: 'get', url: '/inbox?filter=all' })
        calls[2]!.reject(new Error('Server error'))
        await failing
        expect(calls).toHaveLength(3)
        expect(store.getSnapshot().counts.unseen).toBe(1)
    })

    it('leaves link actions that open a new tab to the browser, and marks the notification as read', () => {
        const { store, calls, visits } = setup()
        const notification = item('a', '2026-11-15T10:00:00Z', {
            actions: [
                { label: 'Receipt', href: '/receipts/7', newTab: true },
                { label: 'View', href: '/invoices/7' },
            ],
        })
        // A click on the link of the action, as the built-in components render the actions with a URL.
        const click = {
            button: 0,
            metaKey: false,
            ctrlKey: false,
            shiftKey: false,
            altKey: false,
            preventDefault: vi.fn(),
            target: { closest: () => ({}) } as unknown as EventTarget,
        }

        store.runAction(notification, 0, click)
        expect(click.preventDefault).not.toHaveBeenCalled()
        expect(visits).toEqual([])
        expect(calls[0]!.url).toBe('/inbox/a/read')

        store.runAction(notification, 1, { ...click, ctrlKey: true })
        expect(click.preventDefault).not.toHaveBeenCalled()
        expect(visits).toEqual([])

        store.runAction(notification, 1, click)
        expect(click.preventDefault).toHaveBeenCalledOnce()
        expect(visits).toEqual(['/invoices/7'])
    })

    it('neither opens a notification nor runs its action for a click that a listener prevented', () => {
        const { store, calls, visits } = setup()
        const notification = item('a', '2026-11-15T10:00:00Z', { url: '/invoices/7', actions: [{ label: 'View', href: '/invoices/7' }] })
        const prevented = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, preventDefault: vi.fn(), defaultPrevented: true }

        store.open(notification, prevented)
        store.runAction(notification, 0, prevented)

        expect(visits).toEqual([])
        expect(calls).toEqual([])
    })

    it('forgets the notifications of a user who signed out', async () => {
        const { store, calls } = setup()

        const loading = store.load()
        calls[0]!.resolve({ items: [item('a', '2026-11-15T10:00:00Z')], nextCursor: null })
        await loading

        store.sync({ inertiauiInbox: null }, 'visit')

        expect(store.getSnapshot()).toMatchObject({ url: undefined, items: [], status: 'idle', counts: { unread: 0, unseen: 0 } })
    })
})

describe('announcements', () => {
    it('reads the marker and the expiry of an announcement, and treats other items as notifications', () => {
        const announcement = parseInboxItem({
            id: 'a',
            title: 'Scheduled maintenance',
            createdAt: '2026-11-15T10:00:00Z',
            announcement: true,
            expiresAt: '2026-11-16T10:00:00Z',
        })
        const notification = parseInboxItem({ id: 'b', title: 'Invoice paid', createdAt: '2026-11-15T10:00:00Z', announcement: 'yes' })

        expect(announcement).toMatchObject({ announcement: true, expiresAt: '2026-11-16T10:00:00Z' })
        expect(notification).toMatchObject({ announcement: false, expiresAt: null })
    })

    it('leaves an announcement out of the lists once its expiry has passed', async () => {
        vi.useFakeTimers({ now: Date.parse('2026-11-15T10:00:00Z'), toFake: ['Date'] })

        try {
            const { store, calls } = setup()
            const expiring = item('a', '2026-11-15T09:00:00Z', { announcement: true, expiresAt: '2026-11-15T11:00:00Z' })
            const lasting = item('b', '2026-11-15T08:00:00Z', { announcement: true })

            const loading = store.load()
            calls[0]!.resolve({ items: [expiring, lasting], nextCursor: null })
            await loading

            expect(store.getSnapshot().items.map(({ id }) => id)).toEqual(['a', 'b'])
            expect(listItems(store, [expiring, lasting], 'all').map(({ id }) => id)).toEqual(['a', 'b'])

            vi.setSystemTime(Date.parse('2026-11-15T11:00:00Z'))

            expect(store.belongs(expiring, 'all')).toBe(false)
            expect(store.belongs(expiring, 'archived')).toBe(false)
            expect(listItems(store, [expiring, lasting], 'all').map(({ id }) => id)).toEqual(['b'])
        } finally {
            vi.useRealTimers()
        }
    })
})

describe('real-time updates', () => {
    const counted = (unread: number, unseen: number, revision: number, latest: string | null, latestIds: string[] = []) => ({
        url: '/inbox',
        channel: 'App.Models.User.1',
        ...summary(unread, unseen, revision, { latest, latestIds }),
    })

    it('counts a notification that arrives once, unless the counts of the page already include it', () => {
        const { store } = setup()
        store.sync({ inertiauiInbox: counted(2, 2, 2, '2026-11-15T10:00:00+00:00', ['counted']) }, 'visit')

        // Older than the newest counted notification, or created in the same second and listed with it.
        store.receive(item('older', '2026-11-15T09:59:59Z'))
        store.receive(item('counted', '2026-11-15T10:00:00Z'))
        expect(store.getSnapshot().counts).toEqual({ unread: 2, unseen: 2 })

        // Created in the same second, after the server counted.
        expect(store.receive(item('same second', '2026-11-15T10:00:00Z'))?.id).toBe('same second')
        expect(store.receive(item('new', '2026-11-15T10:00:01Z'))?.id).toBe('new')
        expect(store.receive(item('new', '2026-11-15T10:00:01Z'))).toBeUndefined()
        expect(store.receive({ id: 'invalid' })).toBeUndefined()
        expect(store.getSnapshot().counts).toEqual({ unread: 4, unseen: 4 })
        expect(store.getSnapshot().arrived.map((notification) => notification.id)).toEqual(['new', 'same second', 'counted', 'older'])
    })

    it('adds arrivals to counts from the server that were computed before they arrived', () => {
        const { store } = setup()
        store.sync({ inertiauiInbox: counted(0, 0, 2, null) }, 'visit')
        store.receive(item('new', '2026-11-15T10:00:01Z'))
        store.receive(item('read', '2026-11-15T10:00:02Z', { readAt: '2026-11-15T10:00:02Z' }))

        // A visit that was on its way when the notification arrived.
        store.sync({ inertiauiInbox: counted(1, 1, 3, '2026-11-15T09:00:00+00:00') }, 'visit')
        expect(store.getSnapshot().counts).toEqual({ unread: 2, unseen: 3 })

        // The next visit counted both.
        store.sync({ inertiauiInbox: counted(2, 3, 4, '2026-11-15T10:00:02+00:00', ['read']) }, 'visit')
        expect(store.getSnapshot().counts).toEqual({ unread: 2, unseen: 3 })
    })

    it('shows arrivals first in the panel and in lists from pages, without duplicates', async () => {
        const { store, calls } = setup()
        const loading = store.load()
        calls[0]!.resolve({ items: [item('a', '2026-11-15T09:00:00Z')], nextCursor: null })
        await loading

        store.receive(item('b', '2026-11-15T10:00:00Z'))
        store.receive(item('a', '2026-11-15T09:00:00Z'))

        expect(store.getSnapshot().items.map((notification) => notification.id)).toEqual(['b', 'a'])
        expect(
            listItems(store, [item('page', '2026-11-15T08:00:00Z'), item('b', '2026-11-15T10:00:00Z')], 'all').map((notification) => notification.id),
        ).toEqual(['a', 'page', 'b'])
        expect(listItems(store, [], 'archived')).toEqual([])
    })

    it('applies the changes of other sessions to one notification and in bulk, in the order they were made', () => {
        const { store } = setup()
        const notification = item('a', '2026-11-15T09:00:00Z')
        const later = item('later', '2026-11-15T11:00:00Z')

        store.receiveChange({ change: { kind: 'read', before: '2026-11-15T10:00:00Z' }, counts: summary(1, 1, 2) })
        expect(store.apply(notification).readAt).not.toBeNull()
        expect(store.apply(later).readAt).toBeNull()
        expect(store.getSnapshot().counts).toEqual({ unread: 1, unseen: 1 })

        // Marked as unread after the bulk change: stays unread.
        store.receiveChange({
            change: { kind: 'item', id: 'a', readAt: null, seenAt: '2026-11-15T09:30:00Z', archivedAt: null },
            counts: summary(2, 1, 3),
        })
        expect(store.apply(notification)).toMatchObject({ readAt: null, seenAt: '2026-11-15T09:30:00Z' })

        // Archiving the read notifications leaves it, archiving all of them does not.
        store.receiveChange({ change: { kind: 'archive', before: '2026-11-15T12:00:00Z', onlyRead: true }, counts: summary(2, 1, 4) })
        expect(store.apply(notification).archivedAt).toBeNull()
        store.receiveChange({ change: { kind: 'archive', before: '2026-11-15T12:00:00Z', onlyRead: false }, counts: summary(0, 0, 5) })
        expect(store.apply(notification).archivedAt).not.toBeNull()

        store.receiveChange({ change: { kind: 'read', before: 'not a date' }, counts: summary(9, 9, 6) })
        expect(store.getSnapshot().counts).toEqual({ unread: 0, unseen: 0 })
    })

    it('tells arrival listeners about each notification it adds once, after it shows, until they stop', () => {
        const { store } = setup()
        store.sync({ inertiauiInbox: { url: '/inbox', user: 'A', ...summary(0, 0, 2, { context: 'acme' }) } }, 'visit')
        const arrivals: Array<[string, number]> = []
        const stop = store.onArrival((arrival) => arrivals.push([arrival.id, store.getSnapshot().arrived.length]))

        store.receive(item('a', '2026-11-15T10:00:00Z'))
        store.receive(item('a', '2026-11-15T10:00:00Z'))
        store.receive({ ...item('globex', '2026-11-15T10:01:00Z'), context: 'globex' })
        store.receive({ id: 'invalid' })
        // A snoozed notification that the unsnooze command brought back, with its new creation time.
        store.receiveChange({
            change: { ...readChange('a', null), item: item('a', '2026-11-15T11:00:00Z') },
            counts: summary(1, 1, 3, { context: 'acme' }),
        })
        stop()
        store.receive(item('b', '2026-11-15T12:00:00Z'))

        expect(arrivals).toEqual([
            ['a', 1],
            ['a', 1],
        ])
    })

    it('leaves out the notifications and changes of another context that arrive in real time', () => {
        const { store } = setup()
        store.sync({ inertiauiInbox: { url: '/inbox', user: 'A', ...summary(0, 0, 2, { context: 'acme' }) } }, 'visit')

        expect(store.receive({ ...item('globex', '2026-11-15T10:00:00Z'), context: 'globex' })).toBeUndefined()
        expect(store.receive({ ...item('acme', '2026-11-15T10:01:00Z'), context: 'acme' })?.id).toBe('acme')
        // Notifications without a context show in every context.
        expect(store.receive(item('account', '2026-11-15T10:02:00Z'))?.id).toBe('account')
        expect(store.getSnapshot().counts).toEqual({ unread: 2, unseen: 2 })

        store.receiveChange({ change: { kind: 'read', before: '2026-11-15T11:00:00Z' }, counts: summary(0, 0, 3, { context: 'globex' }) })
        expect(store.getSnapshot().counts).toEqual({ unread: 2, unseen: 2 })
        expect(store.apply(item('acme', '2026-11-15T10:01:00Z')).readAt).toBeNull()

        store.receiveChange({ change: { kind: 'read', before: '2026-11-15T11:00:00Z' }, counts: summary(0, 0, 4, { context: 'acme' }) })
        expect(store.getSnapshot().counts).toEqual({ unread: 0, unseen: 0 })
        expect(store.apply(item('acme', '2026-11-15T10:01:00Z')).readAt).not.toBeNull()
    })

    it('applies the changes of notifications by ID from another context, without its counts', () => {
        const { store } = setup()
        store.sync({ inertiauiInbox: { url: '/inbox', user: 'A', ...summary(0, 0, 2, { context: 'acme' }) } }, 'visit')
        const account = item('account', '2026-11-15T10:00:00Z')
        const billing = item('billing', '2026-11-15T10:01:00Z')
        store.receive(account)
        store.receive(billing)
        expect(store.getSnapshot().counts).toEqual({ unread: 2, unseen: 2 })

        // Notifications without a context show in every context, so the user's session in another one reads them too.
        store.receiveChange({ change: readChange('account', '2026-11-15T11:00:00Z'), counts: summary(0, 0, 3, { context: 'globex' }) })
        store.receiveChange({
            change: { kind: 'items', action: 'archive', ids: ['billing'], at: '2026-11-15T11:00:00Z' },
            counts: summary(0, 0, 4, { context: 'globex' }),
        })

        expect(store.apply(account).readAt).toBe('2026-11-15T11:00:00Z')
        expect(store.apply(billing).archivedAt).toBe('2026-11-15T11:00:00Z')
        expect(store.getSnapshot().items.map((notification) => notification.id)).toEqual(['account'])
        expect(store.getSnapshot().items[0]!.readAt).toBe('2026-11-15T11:00:00Z')
        // The counts of the other context cover other notifications.
        expect(store.getSnapshot().counts).toEqual({ unread: 2, unseen: 2 })

        // A bulk change of another context covers the notifications of that context.
        store.receiveChange({ change: { kind: 'read', before: '2026-11-15T12:00:00Z' }, counts: summary(0, 0, 5, { context: 'globex' }) })
        store.receiveChange({ change: { kind: 'archive', before: '2026-11-15T12:00:00Z' }, counts: summary(0, 0, 6, { context: 'globex' }) })
        expect(store.apply(account).archivedAt).toBeNull()
        expect(store.getSnapshot().counts).toEqual({ unread: 2, unseen: 2 })

        // The counts of a change in the store's own context still apply.
        store.receiveChange({ change: readChange('account', '2026-11-15T12:00:00Z'), counts: summary(1, 0, 7, { context: 'acme' }) })
        expect(store.getSnapshot().counts).toEqual({ unread: 1, unseen: 0 })
    })

    it('adopts only the counts of its own context', async () => {
        const { store, calls } = setup()
        store.sync({ inertiauiInbox: { url: '/inbox', user: 'A', ...summary(1, 1, 2, { context: 'acme' }) } }, 'visit')

        const refreshing = store.refresh()
        calls[0]!.resolve({ counts: summary(9, 9, 3, { context: 'globex' }) })
        await refreshing
        expect(store.getSnapshot().counts).toEqual({ unread: 1, unseen: 1 })

        // A notification that collapsed into another comes with the counts of its own context.
        store.receive({ ...item('a', '2026-11-15T10:00:00Z'), total: 2 }, summary(8, 8, 4, { context: 'globex' }))
        expect(store.getSnapshot().counts).toEqual({ unread: 2, unseen: 2 })

        const again = store.refresh()
        calls[1]!.resolve({ counts: summary(3, 3, 5, { context: 'acme', latest: '2026-11-15T10:00:00Z', latestIds: ['a'] }) })
        await again
        expect(store.getSnapshot().counts).toEqual({ unread: 3, unseen: 3 })
    })

    it('archives every notification or only the read ones, and reports saved changes', async () => {
        const onSaved = vi.fn()
        const { store, calls } = setup()
        store.onSaved(onSaved)
        store.remember([item('shown', '2026-11-15T10:00:00Z')])
        const read = item('read', '2026-11-15T09:00:00Z', { readAt: '2026-11-15T09:10:00Z' })

        const archiving = store.archiveAll({ onlyRead: true })
        expect(calls[0]).toMatchObject({ url: '/inbox/archive', data: { before: '2026-11-15T10:00:00Z', read: true } })
        expect(store.apply(read).archivedAt).not.toBeNull()
        expect(store.apply(item('unread', '2026-11-15T09:00:00Z')).archivedAt).toBeNull()
        expect(store.getSnapshot().counts).toEqual({ unread: 2, unseen: 2 })

        const change = { kind: 'archive', before: '2026-11-15T10:00:00Z', ids: ['shown'], category: null, onlyRead: true }
        const counts = summary(2, 2, 2)
        calls[0]!.resolve({ counts, change })
        await archiving
        expect(onSaved).toHaveBeenCalledWith({ change, counts })

        void store.archiveAll()
        expect(calls[1]!.data).toEqual({ before: '2026-11-15T10:00:00Z', ids: ['shown'], read: false })
        expect(store.getSnapshot().counts).toEqual({ unread: 0, unseen: 0 })
    })

    it('marks a notification that arrives while a panel shows the list as seen', async () => {
        const { store, calls, flush } = setup()

        const opening = store.opened()
        calls[0]!.resolve({ items: [item('a', '2026-11-15T09:00:00Z')], nextCursor: null, counts: summary(2, 2, 2) })
        await flush()
        calls[1]!.resolve({ counts: summary(2, 0, 3), change: { kind: 'seen', before: '2026-11-15T09:00:00Z', ids: ['a'] } })
        await opening

        store.receive(item('b', '2026-11-15T10:00:00Z'))
        expect(calls[2]).toMatchObject({ url: '/inbox/seen', data: { before: '2026-11-15T10:00:00Z' } })
        expect(store.getSnapshot().counts).toEqual({ unread: 3, unseen: 0 })

        store.closed()
        store.receive(item('c', '2026-11-15T11:00:00Z'))
        expect(calls).toHaveLength(3)
        expect(store.getSnapshot().counts.unseen).toBe(1)
    })

    it('leaves marking as seen to a panel that marks what it shows, and reloads it only for newer notifications', async () => {
        const { store, calls } = setup()
        const latest = { latest: '2026-11-15T09:00:00Z', latestIds: ['a'] }

        const opening = store.opened(undefined, { markAllAsSeen: false })
        calls[0]!.resolve({ items: [item('a', '2026-11-15T09:00:00Z')], nextCursor: null, counts: summary(2, 2, 2, latest) })
        await opening
        expect(calls).toHaveLength(1)

        // An arrival in the open panel stays unseen until the panel reports it.
        store.receive(item('b', '2026-11-15T10:00:00Z'))
        expect(calls).toHaveLength(1)
        expect(store.getSnapshot().counts.unseen).toBe(3)
        store.closed({ markAllAsSeen: false })

        // Unseen notifications alone do not reload the list, as the panel showed every notification the server knows.
        store.sync({ inertiauiInbox: { url: '/inbox', ...summary(3, 3, 3, { latest: '2026-11-15T10:00:00Z', latestIds: ['b'] }) } }, 'visit')
        await store.opened(undefined, { markAllAsSeen: false })
        expect(calls).toHaveLength(1)
        store.closed({ markAllAsSeen: false })

        // A notification that no list showed does.
        store.sync({ inertiauiInbox: { url: '/inbox', ...summary(4, 4, 4, { latest: '2026-11-15T11:00:00Z', latestIds: ['c'] }) } }, 'visit')
        void store.opened(undefined, { markAllAsSeen: false })
        expect(calls[1]).toMatchObject({ method: 'get', url: '/inbox?filter=all' })
    })

    it('marks notifications as seen in a batch, through the endpoint that answers also while users may not select notifications', async () => {
        const { store, shared, calls } = setup()
        store.sync({ inertiauiInbox: { ...shared, selectable: false } }, 'visit')
        const unseen = item('a', '2026-11-15T10:00:00Z')

        const marking = store.batch('seen', [unseen, item('b', '2026-11-15T09:00:00Z', { seenAt: '2026-11-15T09:30:00Z' })])
        expect(calls[0]).toMatchObject({ url: '/inbox/seen/items', data: { ids: ['a', 'b'] } })
        expect(store.apply(unseen).seenAt).not.toBeNull()
        expect(store.getSnapshot().counts).toEqual({ unread: 2, unseen: 1 })

        calls[0]!.resolve({ counts: summary(2, 1, 2), change: { kind: 'items', action: 'seen', ids: ['a', 'b'], at: '2026-11-15T10:05:00Z' } })
        await marking
        expect(store.getSnapshot().counts).toEqual({ unread: 2, unseen: 1 })
    })

    it('loads a tab of the application by its key, and shows only the arrivals that match its category and data', async () => {
        const { store, calls } = setup()
        const tab = { label: 'Production', category: 'deployments', data: { environment: 'production' } }
        store.sync({ inertiauiInbox: { url: '/inbox', tabs: { production: tab }, ...summary(2, 2, 2) } }, 'visit')
        expect(store.getSnapshot().tabs).toEqual({ production: tab })

        const loading = store.load('production')
        expect(calls[0]!.url).toBe('/inbox?filter=production')
        calls[0]!.resolve({ items: [], nextCursor: null })
        await loading

        store.receive(item('match', '2026-11-15T10:00:00Z', { category: 'deployments', data: { environment: 'production' } }))
        store.receive(item('staging', '2026-11-15T10:01:00Z', { category: 'deployments', data: { environment: 'staging' } }))
        store.receive(item('other', '2026-11-15T10:02:00Z', { category: 'billing', data: { environment: 'production' } }))
        store.receive(
            item('archived', '2026-11-15T10:03:00Z', { category: 'deployments', data: { environment: 'production' }, archivedAt: '2026-11-15T10:04:00Z' }),
        )

        expect(store.getSnapshot().items.map((notification) => notification.id)).toEqual(['match'])
        expect(store.belongs(item('a', '2026-11-15T10:00:00Z'), 'unknown')).toBe(false)
    })

    it('reads no tabs from a shared prop whose tabs are an empty array', () => {
        const { store } = setup()

        store.sync({ inertiauiInbox: { url: '/inbox', tabs: [], ...summary(2, 2, 2) } }, 'visit')

        expect(store.getSnapshot().tabs).toEqual({})
    })

    it('refreshes the counts from the server', async () => {
        const { store, calls, flush } = setup()

        const refreshing = store.refresh()
        expect(calls[0]).toMatchObject({ method: 'get', url: '/inbox/counts' })
        calls[0]!.resolve({ counts: summary(7, 4, 2) })
        await refreshing
        expect(store.getSnapshot().counts).toEqual({ unread: 7, unseen: 4 })

        void store.refresh()
        calls[1]!.reject(new Error('Offline'))
        await flush()
        expect(store.getSnapshot().counts).toEqual({ unread: 7, unseen: 4 })
    })
})

describe('accounts and ordering', () => {
    it('forgets the previous user, and ignores the answers to their requests that arrive after the user changed', async () => {
        const { store, calls } = setup()
        store.sync({ inertiauiInbox: { url: '/inbox', user: 'A', ...summary(1, 1, 2) } }, 'visit')

        const loading = store.load()
        store.receive(item('private', '2026-11-15T10:00:00Z'))
        const reading = store.markAsRead(item('other', '2026-11-15T09:00:00Z'))

        // Another user signed in, without a signed-out page between.
        store.sync({ inertiauiInbox: { url: '/inbox', user: 'B', ...summary(5, 0, 3) } }, 'visit')
        expect(store.getSnapshot()).toMatchObject({ user: 'B', items: [], arrived: [], status: 'idle', counts: { unread: 5, unseen: 0 } })

        calls[0]!.resolve({ items: [item('private', '2026-11-15T10:00:00Z')], nextCursor: null, counts: summary(1, 1, 100) })
        calls[1]!.resolve({ counts: summary(0, 0, 100), change: readChange('other', '2026-11-15T10:01:00Z') })
        await Promise.all([loading, reading])

        expect(store.getSnapshot()).toMatchObject({ items: [], arrived: [], status: 'idle', counts: { unread: 5, unseen: 0 } })
        expect(store.apply(item('other', '2026-11-15T09:00:00Z')).readAt).toBeNull()

        // A page from history keeps the props of the user who saw it.
        store.sync({ inertiauiInbox: null }, 'visit')
        store.sync({ inertiauiInbox: { url: '/inbox', user: 'B', ...summary(5, 0, 3) } }, 'history')
        expect(store.getSnapshot()).toMatchObject({ url: undefined, user: undefined, counts: { unread: 0, unseen: 0 } })
        expect(store.receive(item('late', '2026-11-15T11:00:00Z'))).toBeUndefined()
    })

    it('keeps the next page of the new user loading when the next page that the previous user asked for arrives', async () => {
        const { store, calls } = setup()
        store.sync({ inertiauiInbox: { url: '/inbox', user: 'A', ...summary(1, 1, 2) } }, 'visit')

        const loading = store.load()
        calls[0]!.resolve({ items: [item('a', '2026-11-15T10:00:00Z')], nextCursor: 'next' })
        await loading

        const stale = store.loadMore()

        store.sync({ inertiauiInbox: { url: '/inbox', user: 'B', ...summary(5, 0, 3) } }, 'visit')
        const loadingB = store.load()
        calls[2]!.resolve({ items: [item('b', '2026-11-15T10:00:00Z')], nextCursor: 'b-next' })
        await loadingB

        const more = store.loadMore()
        expect(calls[3]!.url).toBe('/inbox?filter=all&cursor=b-next')

        calls[1]!.resolve({ items: [item('private', '2026-11-15T09:00:00Z')], nextCursor: null })
        await stale
        expect(store.getSnapshot()).toMatchObject({ user: 'B', loadingMore: true, hasMore: true })
        expect(store.getSnapshot().items.map((notification) => notification.id)).toEqual(['b'])

        void store.loadMore()
        expect(calls).toHaveLength(4)

        calls[3]!.resolve({ items: [item('c', '2026-11-15T09:00:00Z')], nextCursor: null })
        await more
        expect(store.getSnapshot()).toMatchObject({ loadingMore: false, hasMore: false })
        expect(store.getSnapshot().items.map((notification) => notification.id)).toEqual(['b', 'c'])
    })

    it('keeps a later saved change when an earlier one fails', async () => {
        const { store, calls } = setup()
        const notification = item('a', '2026-11-15T10:00:00Z')

        const reading = store.markAsRead(notification)
        const archiving = store.archive(notification)

        // The archive was saved; the read, which the server never saved, fails afterwards.
        calls[1]!.resolve({ counts: summary(1, 1, 100), change: { ...readChange('a', null), archivedAt: '2026-11-15T10:01:00Z' } })
        await archiving
        calls[0]!.reject(new Error('Server error'))
        await reading

        expect(store.apply(notification)).toMatchObject({ readAt: null, archivedAt: '2026-11-15T10:01:00Z' })
        expect(store.getSnapshot().counts).toEqual({ unread: 1, unseen: 1 })
    })

    it('ignores counts and changes that the server read before newer ones', async () => {
        const { store, calls } = setup()
        const notification = item('a', '2026-11-15T10:00:00Z')

        const refreshing = store.refresh()
        const reading = store.markAsRead(notification)
        calls[1]!.resolve({ counts: summary(1, 1, 200), change: readChange('a', '2026-11-15T10:01:00Z') })
        await reading

        // The refresh was read before the change was saved, and answered after it.
        calls[0]!.resolve({ counts: summary(2, 2, 100) })
        await refreshing
        expect(store.getSnapshot().counts).toEqual({ unread: 1, unseen: 1 })

        // Broadcasts from another session that arrive in the reverse order.
        store.receiveChange({ change: readChange('a', null), counts: summary(2, 2, 400) })
        store.receiveChange({ change: readChange('a', '2026-11-15T10:02:00Z'), counts: summary(1, 1, 300) })
        expect(store.apply(notification).readAt).toBeNull()
        expect(store.getSnapshot().counts).toEqual({ unread: 2, unseen: 2 })
    })

    it('ignores counts without a revision, and rolls back a change that the server answered without it', async () => {
        const { store, calls, onFailure } = setup()
        const notification = item('a', '2026-11-15T10:00:00Z')

        store.sync({ inertiauiInbox: { url: '/inbox', unread: 9, unseen: 9 } }, 'visit')
        store.receiveChange({ change: readChange('a', '2026-11-15T10:01:00Z'), counts: { unread: 9, unseen: 9 } })
        expect(store.getSnapshot().counts).toEqual({ unread: 2, unseen: 2 })
        expect(store.apply(notification).readAt).toBeNull()

        const reading = store.markAsRead(notification)
        calls[0]!.resolve({ counts: summary(1, 1, 2) })
        await reading
        expect(store.apply(notification).readAt).toBeNull()
        expect(store.getSnapshot().counts).toEqual({ unread: 2, unseen: 2 })
        expect(onFailure).toHaveBeenCalledOnce()
    })

    it('marks a notification that the unsnooze command brought back while a panel shows the list as seen', async () => {
        const { store, calls, flush } = setup()
        const old = item('a', '2026-11-15T08:00:00Z', { readAt: '2026-11-15T08:10:00Z', seenAt: '2026-11-15T08:10:00Z', revision: 100 })

        const opening = store.opened()
        calls[0]!.resolve({ items: [old], nextCursor: null, counts: summary(0, 0, 100) })
        await opening

        const until = new Date(Date.now() + 3_600_000).toISOString()
        void store.snooze(old, until)
        calls[1]!.resolve({ counts: summary(0, 0, 200), change: { ...readChange('a', old.readAt), snoozedUntil: until } })
        await flush()

        // The command sends the notification without a revision of its own.
        store.receiveChange({
            change: { ...readChange('a', null), item: { ...old, readAt: null, seenAt: null, createdAt: '2026-11-15T10:00:00Z', revision: null } },
            counts: summary(1, 1, 300),
        })

        expect(store.getSnapshot().items.map(({ id, readAt, snoozedUntil }) => [id, readAt, snoozedUntil])).toEqual([['a', null, null]])
        expect(calls[2]).toMatchObject({ url: '/inbox/seen', data: { before: '2026-11-15T10:00:00Z' } })
    })

    it('shows the newer state of a list from the server over changes the user saved before', async () => {
        const { store, calls, flush } = setup()
        const notification = item('a', '2026-11-15T10:00:00Z')

        const reading = store.markAsRead(notification)
        calls[0]!.resolve({ counts: summary(1, 1, 100), change: readChange('a', '2026-11-15T10:01:00Z') })
        await reading
        store.remember([item('b', '2026-11-15T09:00:00Z')])
        const readingAll = store.markAllAsRead()
        calls[1]!.resolve({ counts: summary(0, 0, 200), change: { kind: 'read', before: '2026-11-15T09:00:00Z', ids: ['b'] } })
        await readingAll

        // Another device marked both as unread, and no broadcast told this page.
        const loading = store.load()
        calls[2]!.resolve({
            items: [item('a', '2026-11-15T10:00:00Z', { revision: 300 }), item('b', '2026-11-15T09:00:00Z', { revision: 300 })],
            nextCursor: null,
            counts: summary(2, 2, 300),
        })
        await loading

        expect(store.getSnapshot().items.map(({ id, readAt }) => [id, readAt])).toEqual([
            ['a', null],
            ['b', null],
        ])

        // Marking it as read again reaches the server.
        void store.markAsRead(store.getSnapshot().items[0]!)
        await flush()
        expect(calls[3]!.url).toBe('/inbox/a/read')
    })

    it('leaves read arrivals out of the Unread list, and keeps a notification the user read in it until it reloads', async () => {
        const { store, calls } = setup()

        const loading = store.load('unread')
        calls[0]!.resolve({ items: [], nextCursor: null })
        await loading

        store.receive(item('read', '2026-11-15T10:00:00Z', { readAt: '2026-11-15T10:00:00Z' }))
        store.receive(item('unread', '2026-11-15T10:01:00Z'))
        expect(store.getSnapshot().items.map(({ id }) => id)).toEqual(['unread'])
        expect(listItems(store, [], 'unread').map(({ id }) => id)).toEqual(['unread'])

        void store.markAsRead(item('unread', '2026-11-15T10:01:00Z'))
        expect(store.getSnapshot().items.map(({ id }) => id)).toEqual(['unread'])

        void store.load('unread')
        expect(store.getSnapshot().items).toEqual([])
    })

    it('leaves the notifications of the same second that no list showed out of bulk changes', () => {
        const { store, calls } = setup()
        store.remember([item('shown', '2026-11-15T10:00:00Z'), item('also shown', '2026-11-15T10:00:00Z')])

        void store.markAllAsRead()

        expect(calls[0]!.data).toEqual({ before: '2026-11-15T10:00:00Z', ids: ['shown', 'also shown'] })
        expect(store.apply(item('also shown', '2026-11-15T10:00:00Z')).readAt).not.toBeNull()
        expect(store.apply(item('arrived', '2026-11-15T10:00:00Z')).readAt).toBeNull()
    })

    it('loads the next page again after a failure only when asked', async () => {
        const { store, calls, flush } = setup()

        const loading = store.load()
        calls[0]!.resolve({ items: [item('a', '2026-11-15T10:00:00Z')], nextCursor: 'next' })
        await loading

        const failing = store.loadMore()
        calls[1]!.reject(new Error('Server error'))
        await failing
        expect(store.getSnapshot()).toMatchObject({ moreFailed: true, loadingMore: false, hasMore: true })

        // A sentinel that stays in view reports again after every change.
        await store.loadMore()
        expect(calls).toHaveLength(2)

        void store.loadMore({ retry: true })
        await flush()
        expect(calls[2]!.url).toBe('/inbox?filter=all&cursor=next')
        expect(store.getSnapshot().moreFailed).toBe(false)
    })

    it('keeps the failure of the next page of the new list when a page of the list that it replaced fails', async () => {
        const { store, calls } = setup()

        const loading = store.load('all')
        calls[0]!.resolve({ items: [item('a', '2026-11-15T10:00:00Z')], nextCursor: 'next' })
        await loading

        const stale = store.loadMore()
        const switching = store.load('unread')
        calls[2]!.resolve({ items: [item('b', '2026-11-15T10:00:00Z')], nextCursor: 'unread-next' })
        await switching

        const failing = store.loadMore()
        calls[3]!.reject(new Error('Server error'))
        await failing
        expect(store.getSnapshot()).toMatchObject({ moreFailed: true, loadingMore: false })

        calls[1]!.reject(new Error('Server error'))
        await stale
        expect(store.getSnapshot()).toMatchObject({ moreFailed: true, loadingMore: false })

        // The new list still waits to be asked before it loads its next page again.
        void store.loadMore()
        expect(calls).toHaveLength(4)
    })

    it('opens a panel on its first tab when the list shows another filter', () => {
        const { store, calls } = setup()

        void store.opened(['unread', 'archived'])

        expect(calls[0]!.url).toBe('/inbox?filter=unread')
        expect(store.getSnapshot().filter).toBe('unread')
    })

    it('opens a panel on every category when another panel left a category it does not offer', async () => {
        const { store, calls } = setup()

        const loading = store.load('all', 'billing')
        calls[0]!.resolve({ items: [item('a', '2026-11-15T10:00:00Z', { category: 'billing' })], nextCursor: null })
        await loading

        // A panel that offers the category, or one that does not say which it offers, keeps it.
        await store.opened(['all'], { markAllAsSeen: false, categories: ['comments', 'billing'] })
        store.closed({ markAllAsSeen: false })
        await store.opened(['all'], { markAllAsSeen: false })
        store.closed({ markAllAsSeen: false })
        expect(calls).toHaveLength(1)

        void store.opened(['unread', 'archived'], { markAllAsSeen: false, categories: [] })
        expect(calls).toHaveLength(2)
        expect(calls[1]!.url).toBe('/inbox?filter=unread')
        expect(store.getSnapshot()).toMatchObject({ filter: 'unread', category: null })
    })

    it('marks a notification that no list shows as read by its ID', async () => {
        const { store, calls } = setup()

        const reading = store.markAsRead('a')
        expect(calls[0]).toMatchObject({ method: 'post', url: '/inbox/a/read' })
        expect(store.getSnapshot().counts).toEqual({ unread: 2, unseen: 2 })

        calls[0]!.resolve({ counts: summary(1, 2, 100), change: readChange('a', '2026-11-15T10:01:00Z') })
        await reading
        expect(store.getSnapshot().counts).toEqual({ unread: 1, unseen: 2 })
    })
})

describe('triage', () => {
    const inAnHour = () => new Date(Date.now() + 3_600_000).toISOString()

    it('snoozes a batch until the given time and unsnoozes it, and applies the snooze of another session', async () => {
        const { store, calls } = setup()
        const a = item('a', '2026-11-15T10:00:00Z')
        const b = item('b', '2026-11-15T09:00:00Z')
        store.sync({ inertiauiInbox: { url: '/inbox', ...summary(2, 2, 2) } }, 'visit')

        const until = inAnHour()
        const snoozing = store.batch('snooze', [a, b], new Date(until))
        expect(calls[0]).toMatchObject({ url: '/inbox/batch', data: { action: 'snooze', ids: ['a', 'b'], until } })
        expect(store.getSnapshot().counts).toEqual({ unread: 0, unseen: 0 })
        expect([a, b].map((entry) => store.belongs(store.apply(entry), 'snoozed'))).toEqual([true, true])

        calls[0]!.resolve({ counts: summary(0, 0, 3), change: { kind: 'items', action: 'snooze', ids: ['a', 'b'], at: '2026-11-15T10:05:00Z', until } })
        await snoozing
        expect(store.apply(a).snoozedUntil).toBe(until)

        void store.batch('unsnooze', [store.apply(a)])
        expect(calls[1]).toMatchObject({ url: '/inbox/batch', data: { action: 'unsnooze', ids: ['a'] } })
        expect(calls[1]!.data).not.toHaveProperty('until')
        expect(store.belongs(store.apply(a), 'all')).toBe(true)
        expect(store.belongs(store.apply(b), 'all')).toBe(false)

        const c = item('c', '2026-11-15T08:00:00Z')
        store.receiveChange({ change: { kind: 'items', action: 'snooze', ids: ['c'], at: '2026-11-15T10:06:00Z', until }, counts: summary(0, 0, 4) })
        expect(store.apply(c).snoozedUntil).toBe(until)

        // A snooze without its time is not a change the client knows.
        const d = item('d', '2026-11-15T07:00:00Z')
        store.receiveChange({ change: { kind: 'items', action: 'snooze', ids: ['d'], at: '2026-11-15T10:07:00Z' }, counts: summary(0, 0, 5) })
        expect(store.apply(d).snoozedUntil).toBeNull()
    })

    it('refuses a batch snooze without a time', async () => {
        const { store, calls } = setup()

        await expect(store.batch('snooze', [item('a', '2026-11-15T10:00:00Z')])).rejects.toThrow(TypeError)
        expect(calls).toEqual([])
    })

    it('snoozes a notification out of the inbox and its counts, into the Snoozed list, and rolls back on failure', async () => {
        const { store, calls, onFailure } = setup()
        const notification = item('a', '2026-11-15T10:00:00Z', { category: 'billing' })
        store.sync({ inertiauiInbox: { url: '/inbox', ...summary(2, 2, 2, { categories: { billing: 2 } }) } }, 'visit')

        const until = inAnHour()
        const snoozing = store.snooze(notification, until)
        expect(calls[0]).toMatchObject({ url: '/inbox/a/snooze', data: { until } })
        expect(store.getSnapshot()).toMatchObject({ counts: { unread: 1, unseen: 1 }, categoryCounts: { billing: 1 } })
        expect(store.belongs(store.apply(notification), 'all')).toBe(false)
        expect(store.belongs(store.apply(notification), 'snoozed')).toBe(true)
        expect(store.belongs(store.apply(notification), 'unread')).toBe(false)

        calls[0]!.reject(new Error('Server error'))
        await snoozing
        expect(store.apply(notification).snoozedUntil).toBeNull()
        expect(store.getSnapshot()).toMatchObject({ counts: { unread: 2, unseen: 2 }, categoryCounts: { billing: 2 } })
        expect(onFailure).toHaveBeenCalledOnce()

        // A notification whose snooze time has passed is back in the inbox.
        expect(store.belongs(item('b', '2026-11-15T10:00:00Z', { snoozedUntil: '2026-11-15T09:00:00Z' }), 'all')).toBe(true)
    })

    it('unsnoozes back into the counts, and leaves read and archived notifications out of them', () => {
        const { store, calls } = setup()

        void store.unsnooze(item('a', '2026-11-15T10:00:00Z', { snoozedUntil: inAnHour() }))
        expect(calls[0]!.url).toBe('/inbox/a/unsnooze')
        expect(store.getSnapshot().counts).toEqual({ unread: 3, unseen: 3 })

        void store.unsnooze(item('b', '2026-11-15T10:00:00Z', { snoozedUntil: inAnHour(), readAt: '2026-11-15T10:00:00Z', seenAt: '2026-11-15T10:00:00Z' }))
        void store.unarchive(item('c', '2026-11-15T10:00:00Z', { archivedAt: '2026-11-15T10:00:00Z', snoozedUntil: inAnHour() }))
        expect(store.getSnapshot().counts).toEqual({ unread: 3, unseen: 3 })

        // Already in the inbox: no request.
        void store.unsnooze(item('d', '2026-11-15T10:00:00Z'))
        expect(calls).toHaveLength(3)
    })

    it('archives and unarchives in the counts only the notifications in the inbox, and rolls back on failure', async () => {
        const { store, calls } = setup()
        store.sync({ inertiauiInbox: { url: '/inbox', ...summary(2, 2, 2, { categories: { billing: 2 } }) } }, 'visit')

        // A snoozed notification is not in the counts, so archiving it from the Snoozed list leaves them as they are.
        void store.archive(item('a', '2026-11-15T10:00:00Z', { snoozedUntil: inAnHour(), category: 'billing' }))
        expect(store.getSnapshot()).toMatchObject({ counts: { unread: 2, unseen: 2 }, categoryCounts: { billing: 2 } })

        const unarchiving = store.unarchive(item('b', '2026-11-15T10:00:00Z', { archivedAt: '2026-11-15T10:00:00Z', category: 'billing' }))
        expect(store.getSnapshot()).toMatchObject({ counts: { unread: 3, unseen: 3 }, categoryCounts: { billing: 3 } })

        calls[1]!.reject(new Error('Server error'))
        await unarchiving
        expect(store.getSnapshot()).toMatchObject({ counts: { unread: 2, unseen: 2 }, categoryCounts: { billing: 2 } })
    })

    it('deletes a notification from the lists and the counts right away, and brings it back when deleting fails', async () => {
        const { store, calls, onFailure } = setup()
        store.sync({ inertiauiInbox: { url: '/inbox', allowedActions: ['delete'], ...summary(2, 2, 2, { categories: { billing: 2 } }) } }, 'visit')
        const loading = store.load()
        calls[0]!.resolve({ items: [item('a', '2026-11-15T10:00:00Z', { category: 'billing' }), item('b', '2026-11-15T09:00:00Z', { category: 'billing' })] })
        await loading

        expect(store.getSnapshot().allowedActions).toEqual(['delete'])

        const failing = store.delete(store.getSnapshot().items[1]!)
        expect(calls[1]).toMatchObject({ method: 'post', url: '/inbox/b/delete' })
        expect(store.getSnapshot()).toMatchObject({ counts: { unread: 1, unseen: 1 }, categoryCounts: { billing: 1 } })
        expect(store.getSnapshot().items.map((notification) => notification.id)).toEqual(['a'])

        calls[1]!.reject(new Error('Server error'))
        await failing
        expect(store.getSnapshot()).toMatchObject({ counts: { unread: 2, unseen: 2 }, categoryCounts: { billing: 2 } })
        expect(store.getSnapshot().items.map((notification) => notification.id)).toEqual(['a', 'b'])
        expect(onFailure).toHaveBeenCalledOnce()

        const deleting = store.delete(store.getSnapshot().items[1]!)
        calls[2]!.resolve({ counts: summary(1, 1, 3, { categories: { billing: 1 } }), change: { kind: 'delete', ids: ['b'] } })
        await deleting
        expect(store.getSnapshot().items.map((notification) => notification.id)).toEqual(['a'])
        expect(store.getSnapshot().counts).toEqual({ unread: 1, unseen: 1 })
    })

    it('does not count again a deleted arrival that the server never counted', async () => {
        const { store, calls } = setup()
        store.receive(item('new', '2026-11-15T11:00:00Z'))
        expect(store.getSnapshot().counts).toEqual({ unread: 3, unseen: 3 })

        const deleting = store.delete(item('new', '2026-11-15T11:00:00Z'))
        expect(store.getSnapshot().counts).toEqual({ unread: 2, unseen: 2 })

        // The newest notification the server knows of is older, as the arrival is gone.
        calls[0]!.resolve({ counts: summary(2, 2, 2, { latest: '2026-11-15T10:00:00Z', latestIds: ['old'] }), change: { kind: 'delete', ids: ['new'] } })
        await deleting
        expect(store.getSnapshot().counts).toEqual({ unread: 2, unseen: 2 })
        expect(store.getSnapshot().arrived).toEqual([])
    })

    it('leaves out a notification that another session deleted, also from the lists of pages and when it arrives late', () => {
        const { store } = setup()
        const notification = item('a', '2026-11-15T10:00:00Z')

        store.receiveChange({ change: { kind: 'delete', ids: ['a'] }, counts: summary(1, 1, 2) })

        expect(listItems(store, [notification, item('b', '2026-11-15T09:00:00Z')], 'all').map((entry) => entry.id)).toEqual(['b'])
        expect(store.receive(notification)).toBeUndefined()
        expect(store.getSnapshot().counts).toEqual({ unread: 1, unseen: 1 })
    })

    it('changes the given notifications in one request right away, and rolls the change back when saving fails', async () => {
        const { store, calls, onFailure } = setup()
        store.sync({ inertiauiInbox: { url: '/inbox', ...summary(2, 2, 2, { categories: { billing: 2 } }) } }, 'visit')
        const a = item('a', '2026-11-15T10:00:00Z', { category: 'billing' })
        const b = item('b', '2026-11-15T09:00:00Z', { category: 'billing' })
        const read = item('c', '2026-11-15T08:00:00Z', { readAt: '2026-11-15T08:30:00Z', seenAt: '2026-11-15T08:30:00Z' })

        const failing = store.batch('read', [a, b, read])
        expect(calls[0]).toMatchObject({ method: 'post', url: '/inbox/batch', data: { action: 'read', ids: ['a', 'b', 'c'] } })
        expect(store.apply(a).readAt).not.toBeNull()
        expect(store.getSnapshot()).toMatchObject({ counts: { unread: 0, unseen: 0 }, categoryCounts: {} })

        calls[0]!.reject(new Error('Server error'))
        await failing
        expect(store.apply(a).readAt).toBeNull()
        expect(store.getSnapshot()).toMatchObject({ counts: { unread: 2, unseen: 2 }, categoryCounts: { billing: 2 } })
        expect(onFailure).toHaveBeenCalledOnce()

        const unreading = store.batch('unread', [read])
        expect(store.getSnapshot().counts).toEqual({ unread: 3, unseen: 2 })
        calls[1]!.resolve({ counts: summary(3, 2, 3), change: { kind: 'items', action: 'unread', ids: ['c'], at: '2026-11-15T10:05:00Z' } })
        await unreading
        expect(store.apply(read).readAt).toBeNull()
        expect(store.getSnapshot().counts).toEqual({ unread: 3, unseen: 2 })
    })

    it('skips the actions that the server leaves out, before any request or change, and still reads and runs the others', async () => {
        const { store, calls } = setup()
        store.sync({ inertiauiInbox: { url: '/inbox', allowedActions: ['mute'], ...summary(1, 1, 2) } }, 'visit')
        const notification = item('a', '2026-11-15T10:00:00Z', { group: 'thread:7' })
        const archived = item('b', '2026-11-15T09:00:00Z', { archivedAt: '2026-11-15T09:30:00Z', snoozedUntil: '2099-01-01T00:00:00Z' })

        await Promise.all([
            store.archive(notification),
            store.unarchive(archived),
            store.snooze(notification, 'not a date'),
            store.unsnooze(archived),
            store.delete(notification),
            store.archiveAll(),
            store.batch('snooze', [notification]),
            store.batch('unarchive', [archived]),
            store.batch('delete', [notification]),
        ])

        expect(calls).toEqual([])
        expect(store.apply(notification)).toEqual(notification)
        expect(store.getSnapshot().counts).toEqual({ unread: 1, unseen: 1 })

        void store.mute(notification)
        void store.batch('read', [notification])

        expect(calls.map((call) => call.url)).toEqual(['/inbox/a/mute', '/inbox/batch'])

        // Without the prop, as from a server before `inbox.actions`, the store offers the actions of the default config.
        store.sync({ inertiauiInbox: { url: '/inbox', ...summary(1, 1, 3) } }, 'visit')
        expect(store.getSnapshot().allowedActions).toEqual(['snooze', 'archive', 'mute'])
    })

    it('skips the batches of the selection while the server leaves out selecting, and reads the settings of the config only from new pages', async () => {
        const { store, shared, calls } = setup()
        const configured = {
            selectable: false,
            categoryFilter: { billing: 'Billing', comments: 7 },
            pause: { until: null, presets: ['tomorrow', 45, 0, -15, 1.5, 'later'] },
        }
        store.sync({ inertiauiInbox: { ...shared, ...configured } }, 'visit')
        const notification = item('a', '2026-11-15T10:00:00Z')

        await Promise.all([store.batch('read', [notification]), store.batch('archive', [notification])])
        expect(calls).toEqual([])

        const settings = { selectable: false, categoryFilter: { billing: 'Billing' }, pausePresets: ['tomorrow', 45] }
        expect(store.getSnapshot()).toMatchObject(settings)

        // A page from history carries the config of when it loaded, which the server may have changed since.
        store.sync({ inertiauiInbox: { ...shared, selectable: true, categoryFilter: [], pause: { until: null, presets: [15] } } }, 'history')
        expect(store.getSnapshot()).toMatchObject(settings)

        // PHP sends an empty filter as an empty array, and a server before these settings sends none of them.
        store.sync({ inertiauiInbox: { ...shared, categoryFilter: [], pause: { until: null } } }, 'visit')
        expect(store.getSnapshot()).toMatchObject({ selectable: true, categoryFilter: {}, pausePresets: PAUSE_PRESETS })
    })

    it('lists every notification in place of a list that the server no longer offers, and keeps the actions of a newer page', async () => {
        const { store, calls } = setup()

        const loading = store.load('archived')
        calls[0]!.resolve({ items: [] })
        await loading

        store.sync({ inertiauiInbox: { url: '/inbox', allowedActions: ['delete', 'snooze', 'unknown'], ...summary(2, 2, 2) } }, 'visit')

        expect(store.getSnapshot()).toMatchObject({ allowedActions: ['snooze', 'delete'], filter: 'all', status: 'loading' })
        expect(calls[1]!.url).toBe('/inbox?filter=all')

        // A page from history carries the actions of when it was loaded, which the server may refuse by now.
        store.sync({ inertiauiInbox: { url: '/inbox', allowedActions: ['archive'], ...summary(2, 2, 2) } }, 'history')
        void store.load('archived')

        expect(store.getSnapshot()).toMatchObject({ allowedActions: ['snooze', 'delete'], filter: 'all' })
        expect(calls[2]!.url).toBe('/inbox?filter=all')
    })

    it('splits a batch of more than 100 notifications into requests of 100', () => {
        const { store, calls } = setup()
        const items = Array.from({ length: 150 }, (_, index) => item(`n${index}`, '2026-11-15T10:00:00Z'))

        void store.batch('delete', items)

        expect(calls.map((call) => (call.data!.ids as string[]).length)).toEqual([100, 50])
        expect(calls[0]!.data?.action).toBe('delete')
        expect(listItems(store, items, 'all')).toEqual([])
    })

    it('applies a batch change of another session to the notifications it lists', () => {
        const { store } = setup()
        const notifications = [item('a', '2026-11-15T10:00:00Z'), item('b', '2026-11-15T09:00:00Z')]

        store.receiveChange({ change: { kind: 'items', action: 'archive', ids: ['a'], at: '2026-11-15T10:05:00Z' }, counts: summary(1, 1, 2) })

        expect(listItems(store, notifications, 'all').map((entry) => entry.id)).toEqual(['b'])
        expect(listItems(store, notifications, 'archived').map((entry) => entry.id)).toEqual(['a'])
    })

    it('loads one category, keeps it across tabs, and drops it when only a filter is given', async () => {
        const { store, calls } = setup()

        void store.load('all', 'billing')
        expect(calls[0]!.url).toBe('/inbox?filter=all&category=billing')
        void store.load('unread', store.getSnapshot().category)
        expect(calls[1]!.url).toBe('/inbox?filter=unread&category=billing')
        void store.load()
        expect(calls[2]!.url).toBe('/inbox?filter=unread&category=billing')
        void store.load('all')
        expect(calls[3]!.url).toBe('/inbox?filter=all')

        calls[3]!.resolve({ items: [item('a', '2026-11-15T10:00:00Z', { category: 'billing' })], nextCursor: null })
        await new Promise((resolve) => setTimeout(resolve))
        store.receive(item('b', '2026-11-15T11:00:00Z', { category: 'comments' }))
        expect(listItems(store, [], 'all', 'billing')).toEqual([])
        expect(store.belongs(item('a', '2026-11-15T10:00:00Z', { category: 'billing' }), 'all', 'billing')).toBe(true)
    })

    it('counts the unread notifications of each category, from the server and as they change', () => {
        const { store } = setup()
        store.sync({ inertiauiInbox: { url: '/inbox', ...summary(1, 1, 2, { categories: { deployments: 1 } }) } }, 'visit')
        expect(store.getSnapshot().categoryCounts).toEqual({ deployments: 1 })
        // PHP sends an empty object as an empty array.
        store.sync({ inertiauiInbox: { url: '/inbox', ...summary(0, 0, 3, { categories: [] }) } }, 'visit')
        expect(store.getSnapshot().categoryCounts).toEqual({})

        store.receive(item('a', '2026-11-15T10:00:00Z', { category: 'billing' }))
        store.receive(item('b', '2026-11-15T10:01:00Z', { category: 'billing' }))
        store.receive(item('c', '2026-11-15T10:02:00Z'))
        expect(store.getSnapshot().categoryCounts).toEqual({ billing: 2 })

        void store.markAsRead(item('a', '2026-11-15T10:00:00Z', { category: 'billing' }))
        expect(store.getSnapshot().categoryCounts).toEqual({ billing: 1 })

        void store.markAllAsRead()
        expect(store.getSnapshot().categoryCounts).toEqual({})
    })

    it('changes only the selected category in bulk, clears only its counts, and rolls back when saving fails', async () => {
        const { store, calls, flush } = setup()
        store.sync({ inertiauiInbox: { url: '/inbox', ...summary(3, 0, 2, { categories: { billing: 2, comments: 1 } }) } }, 'visit')
        const invoice = item('invoice', '2026-11-15T10:00:00Z', { category: 'billing' })
        const comment = item('comment', '2026-11-15T09:00:00Z', { category: 'comments' })
        store.remember([comment])

        const loading = store.load('all', 'billing')
        calls[0]!.resolve({ items: [invoice], nextCursor: null })
        await loading
        expect(selectedUnread(store.getSnapshot())).toBe(2)

        const reading = store.markAllAsRead()
        expect(calls[1]).toMatchObject({ url: '/inbox/read', data: { before: '2026-11-15T10:00:00Z', ids: ['invoice'], category: 'billing' } })
        expect(store.getSnapshot()).toMatchObject({ counts: { unread: 1, unseen: 0 }, categoryCounts: { comments: 1 } })
        expect(store.apply(invoice).readAt).not.toBeNull()
        expect(store.apply(comment).readAt).toBeNull()

        calls[1]!.reject(new Error('Server error'))
        await reading
        expect(store.getSnapshot()).toMatchObject({ counts: { unread: 3, unseen: 0 }, categoryCounts: { billing: 2, comments: 1 } })
        expect(store.apply(invoice).readAt).toBeNull()

        void store.archiveAll()
        expect(calls[2]!.data).toEqual({ before: '2026-11-15T10:00:00Z', ids: ['invoice'], category: 'billing', read: false })
        expect(store.apply(comment).archivedAt).toBeNull()

        // Another tab marked the comments as read, which leaves the invoice alone.
        store.receiveChange({
            change: { kind: 'read', before: '2026-11-15T10:00:00Z', ids: null, category: 'comments' },
            counts: summary(2, 0, 3, { categories: { billing: 2 } }),
        })
        await flush()
        expect(store.apply(comment).readAt).not.toBeNull()
        expect(store.apply(invoice).readAt).toBeNull()

        // A page's list passes its own category, whatever the panel selected, or null for every category.
        void store.markAllAsRead({ category: 'comments' })
        expect(calls.at(-1)!.data).toMatchObject({ category: 'comments' })
        expect(store.getSnapshot().categoryCounts).toEqual({})
        void store.archiveAll({ category: null })
        expect(calls.at(-1)!.data).not.toHaveProperty('category')
        expect(store.apply(comment).archivedAt).not.toBeNull()
    })

    it('shows a snoozed notification that came back at the top, with the state the server stored', async () => {
        const { store, calls } = setup()
        const loading = store.load()
        const old = item('a', '2026-11-15T08:00:00Z', { readAt: '2026-11-15T08:10:00Z', seenAt: '2026-11-15T08:10:00Z' })
        calls[0]!.resolve({ items: [item('b', '2026-11-15T09:00:00Z'), old], nextCursor: null })
        await loading

        void store.snooze(old, inAnHour())
        expect(store.getSnapshot().items.map((notification) => notification.id)).toEqual(['b'])

        // Another session's command brought it back as a new notification.
        store.receiveChange({
            change: {
                kind: 'item',
                id: 'a',
                readAt: null,
                seenAt: null,
                archivedAt: null,
                snoozedUntil: null,
                item: { ...old, readAt: null, seenAt: null, createdAt: '2026-11-15T10:00:00Z' },
            },
            counts: summary(4, 4, 2),
        })

        expect(store.getSnapshot().items.map((notification) => [notification.id, notification.readAt])).toEqual([
            ['a', null],
            ['b', null],
        ])

        // Snoozed again here, then brought back by a broadcast that carries only the notification.
        void store.snooze(old, inAnHour())
        store.receive({ ...old, readAt: null, seenAt: null, createdAt: '2026-11-15T11:00:00Z' })
        expect(store.getSnapshot().items.map((notification) => [notification.id, notification.readAt, notification.snoozedUntil])).toEqual([
            ['a', null, null],
            ['b', null, null],
        ])
    })

    it('ignores bulk reads for snoozed notifications, like the server', () => {
        const { store } = setup()
        store.remember([item('shown', '2026-11-15T10:00:00Z')])

        void store.markAllAsRead()

        expect(store.apply(item('snoozed', '2026-11-15T09:00:00Z', { snoozedUntil: inAnHour() })).readAt).toBeNull()
        expect(store.apply(item('inbox', '2026-11-15T09:00:00Z')).readAt).not.toBeNull()
    })
})

describe('pausing notifications', () => {
    const NOW = Date.parse('2026-11-18T10:00:00Z')
    const DAY = 86_400_000
    const later = (minutes: number) => new Date(NOW + minutes * 60_000).toISOString()

    beforeEach(() => vi.useFakeTimers({ now: NOW }))
    afterEach(() => vi.useRealTimers())

    /** A store on a page of an application that offers pausing, with notifications paused until the given time. */
    function paused(until: string | null = null) {
        const context = setup()

        context.store.sync({ inertiauiInbox: { ...context.shared, pause: { until } } }, 'visit')

        return context
    }

    it('reads the pause from the shared prop, and offers pausing only while the prop has one', () => {
        const { store } = setup()

        expect(store.getSnapshot()).toMatchObject({ canPause: false, pausedUntil: null })

        store.sync({ inertiauiInbox: { url: '/inbox', ...summary(2, 2, 2), pause: { until: later(30) } } }, 'visit')
        expect(store.getSnapshot()).toMatchObject({ canPause: true, pausedUntil: later(30) })

        store.sync({ inertiauiInbox: { url: '/inbox', ...summary(2, 2, 3), pause: { until: null } } }, 'visit')
        expect(store.getSnapshot()).toMatchObject({ canPause: true, pausedUntil: null })

        // A pause that has passed shows as none.
        store.sync({ inertiauiInbox: { url: '/inbox', ...summary(2, 2, 4), pause: { until: later(-5) } } }, 'visit')
        expect(store.getSnapshot()).toMatchObject({ canPause: true, pausedUntil: null })

        store.sync({ inertiauiInbox: { url: '/inbox', ...summary(2, 2, 5), pause: null } }, 'visit')
        expect(store.getSnapshot()).toMatchObject({ canPause: false, pausedUntil: null })
    })

    it('reads the changes of a pause', () => {
        expect(parseInboxChange({ kind: 'pause', until: '2026-11-18T10:30:00+00:00' })).toEqual({ kind: 'pause', until: '2026-11-18T10:30:00+00:00' })
        expect(parseInboxChange({ kind: 'pause', until: null })).toEqual({ kind: 'pause', until: null })
        expect(parseInboxChange({ kind: 'pause' })).toBeUndefined()
        expect(parseInboxChange({ kind: 'pause', until: 1794736800 })).toBeUndefined()
    })

    it('shows a pause at once, and undoes it when the server rejects the time', async () => {
        const { store, calls, onFailure } = paused()

        const pausing = store.pause(new Date(NOW + 30 * 60_000))

        expect(calls[0]).toMatchObject({ method: 'post', url: '/inbox/pause', data: { until: later(30) } })
        expect(store.getSnapshot().pausedUntil).toBe(later(30))

        calls[0]!.reject(Object.assign(new Error('Request failed with status 422'), { response: { status: 422 } }))
        await pausing

        expect(store.getSnapshot().pausedUntil).toBeNull()
        expect(onFailure).toHaveBeenCalledOnce()
    })

    it('keeps a pause once the server saved it, and resumes at once, back to the pause when resuming fails', async () => {
        const { store, calls, onFailure } = paused()

        const pausing = store.pause(later(60))
        calls[0]!.resolve({ counts: summary(2, 2, 5), change: { kind: 'pause', until: '2026-11-18T11:00:00+00:00' } })
        await pausing

        expect(store.getSnapshot().pausedUntil).toBe('2026-11-18T11:00:00+00:00')
        expect(onFailure).not.toHaveBeenCalled()

        const resuming = store.resume()

        expect(calls[1]).toMatchObject({ method: 'post', url: '/inbox/resume', data: undefined })
        expect(store.getSnapshot().pausedUntil).toBeNull()

        calls[1]!.reject(new Error('offline'))
        await resuming

        expect(store.getSnapshot().pausedUntil).toBe('2026-11-18T11:00:00+00:00')
        expect(onFailure).toHaveBeenCalledOnce()
    })

    it('sends nothing while the application does not offer pausing, or to resume notifications that are not paused', async () => {
        const { store, calls } = setup()

        await store.pause(later(30))
        expect(store.getSnapshot().pausedUntil).toBeNull()

        store.sync({ inertiauiInbox: { url: '/inbox', ...summary(2, 2, 2), pause: { until: null } } }, 'visit')
        await store.resume()

        expect(calls).toEqual([])
    })

    it('applies a pause from another tab or device, and ignores an older change that arrives late', () => {
        const { store } = paused()

        store.receiveChange({ change: { kind: 'pause', until: later(120) }, counts: summary(2, 2, 5) })
        expect(store.getSnapshot().pausedUntil).toBe(later(120))

        // A resume that the server saved before the pause does not undo it.
        store.receiveChange({ change: { kind: 'pause', until: null }, counts: summary(2, 2, 4) })
        expect(store.getSnapshot().pausedUntil).toBe(later(120))

        store.receiveChange({ change: { kind: 'pause', until: null }, counts: summary(2, 2, 6) })
        expect(store.getSnapshot().pausedUntil).toBeNull()
    })

    it('keeps a saved pause when a page that the server read before it arrives', async () => {
        const { store, calls } = paused()

        const pausing = store.pause(later(30))
        calls[0]!.resolve({ counts: summary(2, 2, 5), change: { kind: 'pause', until: later(30) } })
        await pausing

        store.sync({ inertiauiInbox: { url: '/inbox', ...summary(2, 2, 3), pause: { until: null } } }, 'visit')

        expect(store.getSnapshot().pausedUntil).toBe(later(30))
    })

    it('clears the pause by itself once its time passes', () => {
        const { store } = paused(later(30))
        const listener = vi.fn()
        store.subscribe(listener)

        vi.advanceTimersByTime(30 * 60_000 - 1)
        expect(store.getSnapshot().pausedUntil).toBe(later(30))
        expect(listener).not.toHaveBeenCalled()

        vi.advanceTimersByTime(1)
        expect(store.getSnapshot().pausedUntil).toBeNull()
        expect(listener).toHaveBeenCalledOnce()
    })

    it('waits for a pause longer than the longest timer, without waking up early', () => {
        const { store } = paused(later(30 * 24 * 60))
        const listener = vi.fn()
        store.subscribe(listener)

        // A delay above about 24.8 days overflows, and a timer with it would run at once.
        vi.advanceTimersToNextTimer()
        expect(Date.now()).toBe(NOW + 2_147_483_647)
        expect(store.getSnapshot().pausedUntil).toBe(later(30 * 24 * 60))
        expect(listener).not.toHaveBeenCalled()

        vi.advanceTimersToNextTimer()
        expect(Date.now()).toBe(NOW + 30 * DAY)
        expect(store.getSnapshot().pausedUntil).toBeNull()
        expect(listener).toHaveBeenCalledOnce()
    })

    it('stops waiting for a pause that ended early, and forgets it when the user signs out', () => {
        const { store } = paused(later(30))

        store.receiveChange({ change: { kind: 'pause', until: null }, counts: summary(2, 2, 5) })
        expect(vi.getTimerCount()).toBe(0)

        store.receiveChange({ change: { kind: 'pause', until: later(60) }, counts: summary(2, 2, 6) })
        expect(vi.getTimerCount()).toBe(1)

        store.sync({ inertiauiInbox: null }, 'visit')
        expect(store.getSnapshot()).toMatchObject({ canPause: false, pausedUntil: null })
        expect(vi.getTimerCount()).toBe(0)
    })
})

describe('pause presets', () => {
    const zone = process.env.TZ

    afterEach(() => {
        vi.useRealTimers()

        if (zone === undefined) {
            delete process.env.TZ
        } else {
            process.env.TZ = zone
        }
    })

    it('ends a pause of minutes that many minutes from now', () => {
        const now = new Date('2026-11-18T10:00:00Z')

        expect(pauseEnd(30, now).toISOString()).toBe('2026-11-18T10:30:00.000Z')
        expect(pauseEnd(120, now).toISOString()).toBe('2026-11-18T12:00:00.000Z')
    })

    it('pauses until 08:00 the next day in the local time, also just before midnight, at the end of a year, and when clocks change', () => {
        // Five hours behind UTC in November, so local days end at 05:00 UTC.
        process.env.TZ = 'America/New_York'

        expect(pauseEnd('tomorrow', new Date(2026, 10, 18, 10, 0))).toEqual(new Date(2026, 10, 19, 8, 0))
        expect(pauseEnd('tomorrow', new Date(2026, 10, 18, 23, 59, 59)).toISOString()).toBe('2026-11-19T13:00:00.000Z')
        expect(pauseEnd('tomorrow', new Date(2026, 10, 19, 0, 1)).toISOString()).toBe('2026-11-20T13:00:00.000Z')
        expect(pauseEnd('tomorrow', new Date(2026, 11, 31, 23, 30)).toISOString()).toBe('2027-01-01T13:00:00.000Z')
        // Clocks move forward on the night of 8 March 2026, so 08:00 is four hours behind UTC.
        expect(pauseEnd('tomorrow', new Date(2026, 2, 7, 23, 30)).toISOString()).toBe('2026-03-08T12:00:00.000Z')
    })

    it('names each preset, in hours when they are whole, and leaves out presets that are not a positive number of minutes', () => {
        expect(pauseOptions(PAUSE_PRESETS, DEFAULT_INBOX_LABELS, 'en')).toEqual([
            { label: 'For 30 minutes', preset: 30 },
            { label: 'For 1 hour', preset: 60 },
            { label: 'For 2 hours', preset: 120 },
            { label: 'Until tomorrow', preset: 'tomorrow' },
        ])
        expect(pauseOptions([0, -15, Number.NaN, 90], DEFAULT_INBOX_LABELS, 'en')).toEqual([{ label: 'For 90 minutes', preset: 90 }])
        expect(pauseOptions([45, 180], { ...DEFAULT_INBOX_LABELS, pauseFor: ({ minutes }) => `${minutes} min` }, 'en').map(({ label }) => label)).toEqual([
            '45 min',
            '180 min',
        ])
    })

    it('ends the pause of an option counting from when the user picks it, not from when the menu opened', () => {
        vi.useFakeTimers({ now: Date.parse('2026-11-18T10:00:00Z') })
        const [option] = pauseOptions(PAUSE_PRESETS, DEFAULT_INBOX_LABELS, 'en')

        // The menu stays open for twenty minutes before the user picks "For 30 minutes".
        vi.advanceTimersByTime(20 * 60_000)

        expect(pauseEnd(option!.preset).toISOString()).toBe('2026-11-18T10:50:00.000Z')
    })

    it('shows the end of a pause as a time today, with the weekday within a week, and with the date after that', () => {
        const now = new Date(2026, 10, 18, 10, 0).getTime()
        const text = (date: Date) => pauseTime(date, now, 'en').replace(/\s/g, ' ')

        expect(text(new Date(2026, 10, 18, 21, 0))).toBe('9:00 PM')
        expect(text(new Date(2026, 10, 19, 8, 0))).toBe('Thu 8:00 AM')
        expect(text(new Date(2026, 11, 24, 8, 0))).toBe('Dec 24, 8:00 AM')
    })
})

describe('web push', () => {
    const push = (subscribed: boolean) => ({ publicKey: 'BKey', worker: '/_inertia-notifications/push/worker.js?v=1', subscribed })

    it('keeps the push settings of the newest page, and leaves out pages from history and the prefetch cache', () => {
        const { store } = setup()
        expect(store.pushSettings()).toBeNull()

        store.sync({ inertiauiInbox: { url: '/inbox', push: push(true), ...summary(2, 2, 2) } }, 'visit')
        expect(store.pushSettings()).toEqual(push(true))

        // A page from before the user turned push off on this device.
        store.sync({ inertiauiInbox: { url: '/inbox', push: push(false), ...summary(2, 2, 3) } }, 'visit')
        store.sync({ inertiauiInbox: { url: '/inbox', push: push(true), ...summary(2, 2, 1) } }, 'history')
        store.sync({ inertiauiInbox: { url: '/inbox', push: push(true), ...summary(2, 2, 1) } }, 'cached')
        expect(store.pushSettings()).toEqual(push(false))

        // Signed out.
        store.sync({ inertiauiInbox: null }, 'visit')
        expect(store.pushSettings()).toBeNull()
    })

    it('tells the changes of this tab once the server saved them', async () => {
        const { store, calls } = setup()
        const saved = vi.fn()
        const stop = store.onSaved(saved)

        const reading = store.markAsRead(item('a', '2026-11-15T10:00:00Z'))
        expect(saved).not.toHaveBeenCalled()
        calls[0]!.resolve({ counts: summary(1, 1, 2), change: readChange('a', '2026-11-15T10:01:00Z') })
        await reading

        expect(saved).toHaveBeenCalledWith({
            change: expect.objectContaining({ kind: 'item', id: 'a', readAt: '2026-11-15T10:01:00Z' }),
            counts: summary(1, 1, 2),
        })

        // A change that fails to save, and a change after the listener stopped, are not told.
        const failing = store.archive(item('b', '2026-11-15T10:00:00Z'))
        calls[1]!.reject(new Error('Server error'))
        await failing
        stop()
        const later = store.markAsRead(item('c', '2026-11-15T10:00:00Z'))
        calls[2]!.resolve({ counts: summary(0, 0, 3), change: readChange('c', '2026-11-15T10:02:00Z') })
        await later

        expect(saved).toHaveBeenCalledTimes(1)
    })
})

describe('server JSON', () => {
    // The responses of the PHP package, which its own test compares with this file.
    it('reads the notifications, counts, and changes that the endpoints send', async () => {
        const { store, calls, onFailure } = setup()
        const served = wire.index.items[0]!

        expect(parseInboxItem(served)).toEqual(served)

        const loading = store.load()
        calls[0]!.resolve(wire.index)
        await loading
        expect(store.getSnapshot()).toMatchObject({ counts: { unread: 1, unseen: 1 }, categoryCounts: { billing: 1 }, items: [served] })

        const reading = store.markAsRead(served)
        calls[1]!.resolve(wire.read)
        await reading
        expect(onFailure).not.toHaveBeenCalled()
        expect(store.getSnapshot().counts).toEqual({ unread: 0, unseen: 0 })
        expect(store.getSnapshot().categoryCounts).toEqual({})
        expect(store.apply(served)).toMatchObject({ readAt: wire.read.change.readAt, seenAt: wire.read.change.seenAt })
    })

    it('keeps every kind of change that the server broadcasts', () => {
        const { item: resurfaced, ...item } = wire.changes.item

        // The unsnooze command adds the notification it brought back, which the store receives apart from the change.
        expect(parseInboxChange(wire.changes.item)).toEqual(item)
        expect(parseInboxItem(resurfaced)).toEqual(resurfaced)

        for (const change of [
            wire.changes.read,
            wire.changes.seen,
            wire.changes.archive,
            wire.changes.delete,
            wire.changes.update,
            wire.changes.items,
            wire.changes.mute,
            wire.changes.pause,
        ]) {
            expect(parseInboxChange(change)).toEqual(change)
        }
    })

    it('reads the prop that every page shares, with the pause and the push of the user', () => {
        vi.useFakeTimers({ now: Date.parse('2026-11-15T10:00:00Z') })

        try {
            const { store, calls } = setup()

            store.sync({ inertiauiInbox: wire.shared }, 'visit')

            expect(store.getSnapshot()).toMatchObject({
                url: '/_inertia-notifications',
                user: 'user-identity',
                channel: 'InertiaUI.Notifications.Tests.Fixtures.User.1',
                announcementsChannel: 'inertiaui.announcements',
                allowedActions: ['snooze', 'archive', 'mute', 'delete'],
                tabs: { releases: { label: 'Releases', category: 'product', data: { major: true } } },
                counts: { unread: 1, unseen: 1 },
                categoryCounts: { billing: 1 },
                canPause: true,
                pausedUntil: '2026-11-15T12:00:00+00:00',
                selectable: false,
                categoryFilter: { billing: 'Billing' },
                pausePresets: [15, 'tomorrow'],
            })
            expect(parsePushSettings(store.pushSettings())).toEqual({
                publicKey: 'vapid-public-key',
                worker: '/_inertia-notifications/push/worker.js?v=worker-version',
                subscribed: true,
            })

            // A notification that arrives in another context, such as another team, is not loaded.
            void store.loadArrival('a', 'another-context')
            void store.loadArrival('b', wire.shared.context)
            expect(calls.map(({ url }) => url)).toEqual(['/_inertia-notifications/b'])
        } finally {
            vi.useRealTimers()
        }
    })
})

describe('inbox helpers', () => {
    it('fills labels without reading placeholders in the values or splitting a longer placeholder', () => {
        expect(label(DEFAULT_PREFERENCES_LABELS.toggle, { category: 'Mentions :channel', channel: 'Email' })).toBe('Mentions :channel: Email')
        expect(label('Show :names to :name', { name: 'Sophie', names: 'Maria, Noah' })).toBe('Show Maria, Noah to Sophie')
    })

    it('groups notifications by key at the place of the newest one', () => {
        const thread = [item('a', '2026-11-15T10:00:00Z', { group: 'issue:7' }), item('c', '2026-11-15T08:00:00Z', { group: 'issue:7' })]
        const groups = groupItems([
            thread[0]!,
            item('b', '2026-11-15T09:00:00Z'),
            thread[1]!,
            item('d', '2026-11-15T07:00:00Z', { group: 'issue:8' }),
            item('e', '2026-11-15T06:00:00Z'),
        ])

        expect(groups.map(({ key, item: first, others }) => [key, first.id, others.map((other) => other.id)])).toEqual([
            ['group:issue:7', 'a', ['c']],
            ['b', 'b', []],
            ['group:issue:8', 'd', []],
            ['e', 'e', []],
        ])

        // A thread keeps its key when its newest notification leaves, and when a newer one arrives.
        expect(groupItems([thread[1]!]).map(({ key, item: first }) => [key, first.id])).toEqual([['group:issue:7', 'c']])
        expect(groupItems([item('z', '2026-11-15T11:00:00Z', { group: 'issue:7' }), ...thread]).map(({ key, item: first }) => [key, first.id])).toEqual([
            ['group:issue:7', 'z'],
        ])

        // Without grouping, every notification stays alone under its ID.
        expect(groupItems(thread, false).map(({ key, item: first, others }) => [key, first.id, others.length])).toEqual([
            ['a', 'a', 0],
            ['c', 'c', 0],
        ])
    })

    it('offers later today only while it is still today, then tomorrow and next Monday at 9:00', () => {
        // Wednesday 10:00 and 22:30 in the local time zone.
        const morning = new Date(2026, 10, 18, 10, 0)
        const evening = new Date(2026, 10, 18, 22, 30)
        const sunday = new Date(2026, 10, 22, 10, 0)

        expect(snoozeOptions(DEFAULT_INBOX_LABELS, morning).map(({ label, until }) => [label, until.toString()])).toEqual([
            ['Later today', new Date(2026, 10, 18, 13, 0).toString()],
            ['Tomorrow', new Date(2026, 10, 19, 9, 0).toString()],
            ['Next week', new Date(2026, 10, 23, 9, 0).toString()],
        ])
        expect(snoozeOptions(DEFAULT_INBOX_LABELS, evening).map(({ label }) => label)).toEqual(['Tomorrow', 'Next week'])
        // On a Sunday, next week starts tomorrow.
        expect(snoozeOptions(DEFAULT_INBOX_LABELS, sunday).map(({ label }) => label)).toEqual(['Later today', 'Tomorrow'])
    })

    it('keeps only safe URLs, and custom toast types, when parsing server notifications', () => {
        const parsed = parseInboxItem({
            id: 'a',
            title: 'Invoice paid',
            createdAt: '2026-11-15T10:00:00Z',
            url: 'javascript:alert(1)',
            actor: { name: 'Sophie', avatar: 'javascript:alert(1)' },
            actions: [{ label: 'View', href: '/invoices/7' }],
            toast: 'payment',
        })

        expect(parsed).toMatchObject({
            url: null,
            actor: { name: 'Sophie', avatar: undefined },
            actions: [{ label: 'View', href: '/invoices/7' }],
            toast: 'payment',
        })
        expect(parseInboxItem({ id: 'a', title: 'No date' })).toBeUndefined()
    })

    it('formats relative times and capped badge counts', () => {
        const now = Date.parse('2026-11-15T12:00:00Z')

        expect(relativeTime('2026-11-15T11:59:40Z', now, 'en')).toBe('now')
        expect(relativeTime('2026-11-15T11:55:00Z', now, 'en')).toBe('5 minutes ago')
        expect(relativeTime('2026-11-14T12:00:00Z', now, 'en')).toBe('yesterday')
        expect(relativeTime('2026-11-01T12:00:00Z', now, 'en')).toBe('2 weeks ago')
        expect(badgeText(7, 99, 'en')).toBe('7')
        expect(badgeText(1200, 999, 'en')).toBe('999+')
        expect(badgeText(120, 99, 'ar-EG')).toBe('٩٩+')
    })
})
