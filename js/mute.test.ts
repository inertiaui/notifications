import { describe, expect, it, vi } from 'vite-plus/test'

import { createInboxStore, listItems, parseInboxChange, parseInboxItem, type InboxItem } from './inbox'
import type { InertiaBindings } from './inertia'

const reply = (overrides: Partial<InboxItem> = {}): InboxItem => ({
    ...parseInboxItem({
        id: 'r1',
        type: 'test',
        title: 'Sophie replied in thread #7',
        category: 'comments',
        group: 'thread:7',
        createdAt: '2026-11-15T10:00:00Z',
        revision: 1,
    })!,
    ...overrides,
})

const counts = (revision: number, rest: Record<string, unknown> = {}) => ({
    unread: 3,
    unseen: 3,
    categories: [],
    latest: '2026-11-15T10:00:00Z',
    latestIds: ['r1'],
    revision,
    ...rest,
})

interface Call {
    url: string
    resolve: (body: unknown) => void
    reject: (error: unknown) => void
}

/** A store with two replies in thread 7 and one notification without a thread, connected to a server that the test answers by hand. */
async function setup(shared: Record<string, unknown> = {}) {
    const calls: Call[] = []
    const bindings = {
        request: (_method: string, url: string) => new Promise((resolve, reject) => calls.push({ url, resolve, reject })),
    } as unknown as InertiaBindings
    const store = createInboxStore()
    const onFailure = vi.fn()

    store.connect(bindings, { onFailure })
    store.sync({ inertiauiInbox: { url: '/inbox', ...counts(1), ...shared } }, 'initial')

    const loading = store.load()
    calls.shift()!.resolve({
        items: [
            reply(),
            reply({ id: 'r2', createdAt: '2026-11-15T09:00:00Z' }),
            reply({ id: 'p', title: 'Password changed', group: null, createdAt: '2026-11-15T08:00:00Z' }),
        ],
        nextCursor: null,
        counts: counts(1),
    })
    await loading

    const muted = () => Object.fromEntries(store.getSnapshot().items.map((item) => [item.id, item.muted]))
    const flush = () => new Promise((resolve) => setTimeout(resolve))

    return { store, calls, muted, flush, onFailure }
}

describe('muted threads', () => {
    it('reads whether the thread of a notification is muted, and the change of a thread', () => {
        expect(parseInboxItem({ ...reply(), muted: true })?.muted).toBe(true)
        expect(parseInboxItem({ ...reply(), muted: undefined })?.muted).toBe(false)
        expect(parseInboxChange({ kind: 'mute', group: 'thread:7', muted: true })).toEqual({ kind: 'mute', group: 'thread:7', muted: true })
        expect(parseInboxChange({ kind: 'mute', muted: true })).toBeUndefined()
    })

    it('mutes the thread of every notification in it right away, and keeps it muted once the server saved it', async () => {
        const { store, calls, muted, flush } = await setup()

        void store.mute(store.getSnapshot().items[0]!)

        expect(calls.map((call) => call.url)).toEqual(['/inbox/r1/mute'])
        expect(muted()).toEqual({ r1: true, r2: true, p: false })
        expect(store.getSnapshot().counts.unread).toBe(3)

        calls[0]!.resolve({ change: { kind: 'mute', group: 'thread:7', muted: true }, counts: counts(5) })
        await flush()

        expect(muted()).toEqual({ r1: true, r2: true, p: false })
        // A page prop read before the mute shows it too, and a copy read after it shows its own state.
        expect(listItems(store, [reply({ revision: 2 })], 'all')[0]?.muted).toBe(true)
        expect(listItems(store, [reply({ revision: 9 })], 'all')[0]?.muted).toBe(false)
    })

    it('unmutes the thread again when saving the mute failed', async () => {
        const { store, calls, muted, flush, onFailure } = await setup()

        void store.mute(store.getSnapshot().items[1]!)
        calls[0]!.reject(new Error('Server error'))
        await flush()

        expect(muted()).toEqual({ r1: false, r2: false, p: false })
        expect(onFailure).toHaveBeenCalledOnce()
    })

    it('unmutes a muted thread', async () => {
        const { store, calls, muted, flush } = await setup()

        void store.mute(store.getSnapshot().items[0]!)
        calls[0]!.resolve({ change: { kind: 'mute', group: 'thread:7', muted: true }, counts: counts(5) })
        await flush()

        void store.unmute(store.getSnapshot().items[1]!)
        expect(calls.map((call) => call.url)).toEqual(['/inbox/r1/mute', '/inbox/r2/unmute'])
        expect(muted()).toEqual({ r1: false, r2: false, p: false })

        calls[1]!.resolve({ change: { kind: 'mute', group: 'thread:7', muted: false }, counts: counts(6) })
        await flush()

        expect(muted()).toEqual({ r1: false, r2: false, p: false })
    })

    it('sends nothing for a notification without a thread, or a thread in the same state', async () => {
        const { store, calls } = await setup()

        await store.mute(store.getSnapshot().items[2]!)
        await store.unmute(store.getSnapshot().items[0]!)

        expect(calls).toEqual([])
    })

    it('mutes the thread from another session, also of another context', async () => {
        const { store, muted } = await setup({ context: 'team-1' })

        store.receiveChange({ change: { kind: 'mute', group: 'thread:7', muted: true }, counts: counts(5, { context: 'team-2', unread: 9 }) })

        expect(muted()).toEqual({ r1: true, r2: true, p: false })
        expect(store.getSnapshot().counts.unread).toBe(3)

        // An older change that arrives late does not unmute it.
        store.receiveChange({ change: { kind: 'mute', group: 'thread:7', muted: false }, counts: counts(4, { context: 'team-1' }) })

        expect(muted()).toEqual({ r1: true, r2: true, p: false })
    })
})
