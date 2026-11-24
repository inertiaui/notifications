import { describe, expect, it, vi } from 'vite-plus/test'

import { createInboxStore, listItems, parseInboxItem, type InboxItem } from './inbox'
import type { InertiaBindings } from './inertia'

const build = (overrides: Partial<InboxItem> = {}): InboxItem => ({
    ...parseInboxItem({
        id: 'b',
        type: 'test',
        title: 'Build #42 is running',
        body: 'Started by Sophie.',
        actions: [{ label: 'Cancel', href: '/builds/42/cancel', method: 'post' }],
        category: 'deployments',
        createdAt: '2026-11-15T10:00:00Z',
        revision: 1,
    })!,
    ...overrides,
})

const counts = (unread: number, revision: number, rest: Record<string, unknown> = {}) => ({
    unread,
    unseen: unread,
    categories: [],
    latest: '2026-11-15T10:00:00Z',
    latestIds: ['b'],
    revision,
    ...rest,
})

/** A store with the running build and an older notification loaded, connected to a server that answers with the given page. */
async function setup(shared: Record<string, unknown> = {}) {
    const bindings = {
        request: () => Promise.resolve({ items: [build(), build({ id: 'a', title: 'Invoice paid', createdAt: '2026-11-15T09:00:00Z' })], nextCursor: null }),
    } as unknown as InertiaBindings
    const store = createInboxStore()
    const arrivals = vi.fn()
    const changes = vi.fn()

    store.connect(bindings)
    store.sync({ inertiauiInbox: { url: '/inbox', ...counts(2, 1), ...shared } }, 'initial')
    store.onArrival(arrivals)
    store.onChange(changes)
    await store.load()

    const titles = () => store.getSnapshot().items.map((item) => item.title)

    return { store, arrivals, changes, titles }
}

describe('updated and retracted notifications', () => {
    it('shows the new message of a notification that the server updated, in its place and with its state', async () => {
        const { store, arrivals, changes, titles } = await setup()

        const passed = build({ title: 'Build #42 passed', body: null, actions: [], readAt: '2026-11-15T10:01:00Z', revision: 5 })
        store.receiveChange({ change: { kind: 'update', item: passed }, counts: counts(1, 6) })

        expect(titles()).toEqual(['Build #42 passed', 'Invoice paid'])
        expect(store.getSnapshot().items[0]).toMatchObject({ body: null, actions: [], readAt: '2026-11-15T10:01:00Z' })
        // The update is not a new notification.
        expect(arrivals).not.toHaveBeenCalled()
        expect(changes).toHaveBeenCalledWith({ kind: 'update', item: passed })
        expect(store.getSnapshot().counts.unread).toBe(1)
    })

    it('keeps the newest message when updates arrive out of order', async () => {
        const { store, titles } = await setup()

        store.receiveChange({ change: { kind: 'update', item: build({ title: 'Build #42 passed', revision: 9 }) }, counts: counts(2, 9) })
        store.receiveChange({ change: { kind: 'update', item: build({ title: 'Build #42 is deploying', revision: 5 }) }, counts: counts(2, 5) })

        expect(titles()).toEqual(['Build #42 passed', 'Invoice paid'])
    })

    it('shows the new message in the lists of pages that hold an older copy', async () => {
        const { store } = await setup()

        store.receiveChange({ change: { kind: 'update', item: build({ title: 'Build #42 passed', revision: 5 }) }, counts: counts(2, 6) })

        expect(listItems(store, [build()], 'all').map((item) => item.title)).toEqual(['Build #42 passed'])
        expect(listItems(store, [build({ title: 'Build #42 failed', revision: 7 })], 'all').map((item) => item.title)).toEqual(['Build #42 failed'])
    })

    it('keeps the new message of a notification that the user changed after the update', async () => {
        const { store, titles } = await setup()

        store.receiveChange({ change: { kind: 'update', item: build({ title: 'Build #42 passed', revision: 5 }) }, counts: counts(2, 6) })
        store.receiveChange({
            change: {
                kind: 'item',
                id: 'b',
                readAt: '2026-11-15T10:02:00Z',
                seenAt: '2026-11-15T10:02:00Z',
                archivedAt: null,
                snoozedUntil: null,
                result: null,
            },
            counts: counts(1, 8),
        })

        expect(titles()).toEqual(['Build #42 passed', 'Invoice paid'])
        expect(store.getSnapshot().items[0]?.readAt).toBe('2026-11-15T10:02:00Z')
    })

    it('leaves out a notification that the server retracted, with the counts after it', async () => {
        const { store, changes, titles } = await setup()

        store.receiveChange({ change: { kind: 'delete', ids: ['b'] }, counts: counts(1, 6) })

        expect(titles()).toEqual(['Invoice paid'])
        expect(store.getSnapshot().counts.unread).toBe(1)
        expect(changes).toHaveBeenCalledWith({ kind: 'delete', ids: ['b'] })
    })

    it("applies an update or a retraction from another context, without that context's counts", async () => {
        const { store, titles } = await setup({ context: 'team-1' })
        const elsewhere = (unread: number, revision: number) => counts(unread, revision, { context: null })

        store.receiveChange({ change: { kind: 'update', item: build({ title: 'Build #42 passed', revision: 5 }) }, counts: elsewhere(9, 6) })
        expect(titles()).toEqual(['Build #42 passed', 'Invoice paid'])

        store.receiveChange({ change: { kind: 'delete', ids: ['b'] }, counts: elsewhere(9, 7) })
        expect(titles()).toEqual(['Invoice paid'])
        expect(store.getSnapshot().counts.unread).toBe(2)
    })
})
