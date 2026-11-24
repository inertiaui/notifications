import { describe, expect, it } from 'vite-plus/test'

import { actorsText, createInboxStore, inboxLabels, parseInboxItem, stackedActors, type InboxItem } from './inbox'
import type { InertiaBindings } from './inertia'

const comment = (overrides: Partial<InboxItem> = {}): InboxItem => ({
    ...parseInboxItem({
        id: 'c',
        type: 'test',
        title: 'Sophie commented on issue #42',
        actor: { name: 'Sophie' },
        category: 'comments',
        group: 'issue:42',
        createdAt: '2026-11-15T10:00:00Z',
        revision: 1,
    })!,
    ...overrides,
})

const counts = (unread: number, revision: number, latest: string, latestIds: string[]) => ({
    unread,
    unseen: unread,
    categories: [],
    latest,
    latestIds,
    revision,
})

/** A store with the comment and an older notification loaded, both counted by the server. */
async function setup(loaded: InboxItem = comment()) {
    const older = comment({ id: 'a', title: 'Invoice paid', group: null, actor: null, actors: [], actorCount: 0, createdAt: '2026-11-15T09:00:00Z' })
    const bindings = { request: () => Promise.resolve({ items: [loaded, older], nextCursor: null }) } as unknown as InertiaBindings
    const store = createInboxStore()
    const unread = [loaded, older].filter((item) => item.readAt === null).length

    store.connect(bindings)
    store.sync({ inertiauiInbox: { url: '/inbox', ...counts(unread, 1, loaded.createdAt, [loaded.id]) } }, 'initial')
    await store.load()

    const titles = () => store.getSnapshot().items.map((item) => item.title)

    return { store, titles }
}

const collapsed = (overrides: Partial<InboxItem> = {}): InboxItem =>
    comment({
        title: 'Liam commented on issue #42',
        actor: { name: 'Liam' },
        actors: [{ name: 'Liam' }, { name: 'Maria' }, { name: 'Sophie' }],
        actorCount: 3,
        total: 3,
        createdAt: '2026-11-15T10:05:00Z',
        revision: 5,
        ...overrides,
    })

describe('collapsed notifications', () => {
    it('reads the actors and the total of a notification', () => {
        const item = parseInboxItem({ ...collapsed(), actors: [{ name: 'Liam', avatar: 'javascript:alert(1)' }, 'Maria', { name: 'Sophie' }] })

        expect(item).toMatchObject({ actors: [{ name: 'Liam', avatar: undefined }, { name: 'Sophie' }], actorCount: 3, total: 3 })
    })

    it('treats the actor of a notification from an older server as its only actor', () => {
        const { actors: _actors, actorCount: _count, total: _total, ...old } = comment()

        expect(parseInboxItem(old)).toMatchObject({ actors: [{ name: 'Sophie' }], actorCount: 1, total: 1 })
        expect(parseInboxItem({ ...old, actor: null })).toMatchObject({ actors: [], actorCount: 0 })
    })

    it('names the newest actor and the others', () => {
        const labels = inboxLabels()
        const two = comment({ actors: [{ name: 'Maria' }, { name: 'Sophie' }], actorCount: 2 })

        expect(actorsText(labels, comment())).toBeUndefined()
        expect(actorsText(labels, two)).toBe('Maria and Sophie')
        expect(actorsText(labels, collapsed({ actorCount: 7 }))).toBe('Liam and 6 others')
        expect(actorsText({ ...labels, actorsAndOthers: ({ name, count }) => `${name} +${count}` }, collapsed())).toBe('Liam +2')
        expect(actorsText(labels, collapsed({ actors: [{ avatar: '/a.png' }] }))).toBeUndefined()
    })

    it('stacks the avatars of the three newest actors', () => {
        const item = collapsed({ actors: [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }, { name: 'E' }], actorCount: 9 })

        expect(stackedActors(item).map((actor) => actor.name)).toEqual(['A', 'B', 'C'])
    })

    it('moves a notification that collapsed to the top as unread, and counts it once with the counts it came with', async () => {
        const read = comment({ createdAt: '2026-11-15T09:30:00Z', readAt: '2026-11-15T09:31:00Z', seenAt: '2026-11-15T09:31:00Z' })
        const { store, titles } = await setup(read)
        expect(titles()).toEqual(['Sophie commented on issue #42', 'Invoice paid'])
        expect(store.getSnapshot().counts.unread).toBe(1)

        store.receive(collapsed(), counts(2, 6, '2026-11-15T10:05:00Z', ['c']))

        expect(titles()).toEqual(['Liam commented on issue #42', 'Invoice paid'])
        expect(store.getSnapshot().items[0]).toMatchObject({ readAt: null, seenAt: null, actorCount: 3 })
        expect(store.getSnapshot().counts).toEqual({ unread: 2, unseen: 2 })
    })

    it('does not count an unread notification twice when it collapses again', async () => {
        const { store } = await setup()

        store.receive(collapsed(), counts(2, 6, '2026-11-15T10:05:00Z', ['c']))
        store.receive(collapsed({ total: 4, createdAt: '2026-11-15T10:06:00Z', revision: 7 }), counts(2, 7, '2026-11-15T10:06:00Z', ['c']))

        expect(store.getSnapshot().counts.unread).toBe(2)
        expect(store.getSnapshot().items[0]?.total).toBe(4)
    })

    it('keeps the newest copy when the broadcasts of collapsed notifications cross', async () => {
        const { store, titles } = await setup()

        expect(store.receive(collapsed({ total: 4, title: 'Newest' }))).toBeDefined()
        expect(store.receive(collapsed({ total: 3, title: 'Older' }))).toBeUndefined()
        expect(store.receive(collapsed({ total: 2, title: 'Oldest', createdAt: '2026-11-15T10:04:00Z' }))).toBeUndefined()

        expect(titles()).toEqual(['Newest', 'Invoice paid'])
    })

    it('replaces the loaded copy with one that collapsed in the same second', async () => {
        const { store, titles } = await setup()

        store.receive(collapsed({ createdAt: '2026-11-15T10:00:00Z', total: 2 }), counts(2, 6, '2026-11-15T10:00:00Z', ['c']))

        expect(titles()).toEqual(['Liam commented on issue #42', 'Invoice paid'])
    })
})
