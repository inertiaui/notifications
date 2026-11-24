import { describe, expect, it, vi } from 'vite-plus/test'

import { DEFAULT_INBOX_LABELS, inboxStore, snoozeOptions, type InboxAction } from './inbox'
import type { InertiaBindings } from './inertia'
import {
    bellLabel,
    canArchiveAll,
    defaultTabs,
    emptyText,
    holdArrivals,
    initials,
    listHref,
    listScope,
    listState,
    selectionActions,
    shownTabs,
    snoozeChoices,
    tabForKey,
    tabLabel,
    tabProps,
    toggleSelected,
} from './notificationCenter'

vi.stubGlobal('CSS', { escape: (value: string) => value })

const counts = (revision: number) => ({ unread: 0, unseen: 0, categories: [], latest: null, latestIds: [], revision })

const arrival = (id: string, category: string | null = null) => ({ id, title: `Notification ${id}`, category, createdAt: new Date().toISOString() })

describe('notification center helpers', () => {
    it('moves between tabs with the arrow keys, wrapping around and following the reading direction', () => {
        const tabs = ['all', 'unread', 'archived'] as const

        expect(tabForKey('ArrowRight', 'all', tabs)).toBe('unread')
        expect(tabForKey('ArrowRight', 'archived', tabs)).toBe('all')
        expect(tabForKey('ArrowLeft', 'all', tabs)).toBe('archived')
        expect(tabForKey('ArrowRight', 'all', tabs, true)).toBe('archived')
        expect(tabForKey('ArrowLeft', 'all', tabs, true)).toBe('unread')
        expect(tabForKey('End', 'all', tabs)).toBe('archived')
        expect(tabForKey('Home', 'archived', tabs)).toBe('all')
        expect(tabForKey('Enter', 'all', tabs)).toBeUndefined()
    })

    it('gives each tab its label, whether it is selected, and the unread count on the Unread tab', () => {
        const tabs = { production: { label: 'Production', category: null, data: { environment: 'production' } } }

        expect(tabProps(['all', 'unread', 'production'], { filter: 'unread', tabs, counts: { unread: 4, unseen: 1 } }, DEFAULT_INBOX_LABELS)).toEqual([
            { filter: 'all', label: 'All', selected: false, count: null },
            { filter: 'unread', label: 'Unread', selected: true, count: 4 },
            { filter: 'production', label: 'Production', selected: false, count: null },
        ])
    })

    it('shows the spinner only while no notifications of the list are known, then the error, the empty text, or the notifications', () => {
        expect(listState({ status: 'idle' }, 2)).toBe('loading')
        expect(listState({ status: 'loading' }, 0)).toBe('loading')
        expect(listState({ status: 'loading' }, 2)).toBe('items')
        expect(listState({ status: 'error' }, 2)).toBe('error')
        expect(listState({ status: 'ready' }, 0)).toBe('empty')
        expect(listState({ status: 'ready' }, 2)).toBe('items')
    })

    it('links the tabs and categories of a page to its other lists, from their newest notifications', () => {
        // The cursor of the infinite scroll belongs to the old list, while the page's other query parameters stay.
        expect(listHref('/inbox?team=4&page=eyJpZCI6OX0&filter=unread', 'archived', 'billing', 'page')).toBe('/inbox?team=4&filter=archived&category=billing')
        // All and every category are the page without the parameters.
        expect(listHref('/inbox?category=billing&filter=unread', 'all', null)).toBe('/inbox')
        expect(listHref('/inbox?cursor=abc', 'unread', null)).toBe('/inbox?cursor=abc&filter=unread')
    })

    it('reads the filter and category of a list without those props from the URL that its tabs link to', () => {
        const state = { tabs: { billing: { label: 'Billing', category: 'billing', data: {} } }, allowedActions: ['snooze'] as InboxAction[] }

        expect(listScope('/inbox?filter=billing&category=invoices', state)).toEqual({ filter: 'billing', category: 'invoices' })
        // The server lists every notification for a filter that the list does not offer, such as Archived without archiving.
        expect(listScope('/inbox?filter=archived', state)).toEqual({ filter: 'all', category: null })
        expect(listScope('/inbox?filter=unknown&category=', state)).toEqual({ filter: 'all', category: null })
        // The props win over the URL, including a null category for every category.
        expect(listScope('/inbox?filter=billing&category=invoices', state, 'unread', null)).toEqual({ filter: 'unread', category: null })
        expect(listScope('/inbox?filter=billing&category=invoices', state, undefined, 'comments')).toEqual({ filter: 'billing', category: 'comments' })
    })

    it('adds a notification that the user selects at the end of the selection, and leaves out one that the user unselects', () => {
        expect(toggleSelected(['a', 'b'], 'c', true)).toEqual(['a', 'b', 'c'])
        expect(toggleSelected(['a', 'b'], 'a', true)).toEqual(['b', 'a'])
        expect(toggleSelected(['a', 'b'], 'a', false)).toEqual(['b'])
    })

    it('offers unarchiving for selected archived notifications, and only the actions that the application offers', () => {
        const actions = (filter: Parameters<typeof selectionActions>[0], allowed: InboxAction[]) =>
            selectionActions(filter, allowed).map((entry) => entry.action)

        expect(actions('all', ['snooze', 'archive', 'mute'])).toEqual(['read', 'unread', 'snooze', 'archive'])
        expect(actions('archived', ['snooze', 'archive', 'mute'])).toEqual(['read', 'unread', 'unarchive'])
        expect(actions('unread', ['delete', 'archive', 'snooze'])).toEqual(['read', 'unread', 'snooze', 'archive', 'delete'])
        expect(actions('all', ['delete'])).toEqual(['read', 'unread', 'delete'])
        expect(actions('snoozed', [])).toEqual(['read', 'unread'])
    })

    it('offers unsnoozing for selected snoozed notifications, and snoozing in the other lists but the archived one', () => {
        const allowed: InboxAction[] = ['snooze', 'archive', 'mute']
        const actions = (filter: Parameters<typeof selectionActions>[0]) => selectionActions(filter, allowed).map((entry) => entry.action)

        expect(selectionActions('all', allowed)[2]).toEqual({ action: 'snooze', icon: 'snooze', label: 'snoozeSelected' })
        expect(selectionActions('snoozed', allowed)[2]).toEqual({ action: 'unsnooze', icon: 'unsnooze', label: 'unsnoozeSelected' })
        expect(actions('production')).toEqual(['read', 'unread', 'snooze', 'archive'])
        expect(actions('archived')).not.toContain('snooze')
    })

    it('offers the snooze times of the snooze prop, and the built-in ones without it', () => {
        const now = new Date(2026, 10, 18, 10, 0)
        const custom = [{ label: 'In an hour', until: new Date(2026, 10, 18, 11, 0) }]
        const snooze = vi.fn(() => custom)

        expect(snoozeChoices(snooze, DEFAULT_INBOX_LABELS, now)).toBe(custom)
        expect(snooze).toHaveBeenCalledWith(now)
        expect(snoozeChoices(undefined, DEFAULT_INBOX_LABELS, now)).toEqual(snoozeOptions(DEFAULT_INBOX_LABELS, now))
        expect(snoozeChoices(undefined, { ...DEFAULT_INBOX_LABELS, snoozeTomorrow: 'In the morning' }, now).map((option) => option.label)).toContain(
            'In the morning',
        )
    })

    it('adds the tabs of the application after the built-in ones, with their labels and the shared empty text', () => {
        const tabs = { production: { label: 'Production', category: null, data: { environment: 'production' } } }

        expect(defaultTabs(tabs)).toEqual(['all', 'unread', 'snoozed', 'archived', 'production'])
        expect(shownTabs({ tabs, allowedActions: ['archive'] })).toEqual(['all', 'unread', 'archived', 'production'])
        expect(shownTabs({ tabs, allowedActions: ['mute'] })).toEqual(['all', 'unread', 'production'])
        expect(canArchiveAll({ filter: 'all', allowedActions: ['archive'] })).toBe(true)
        expect(canArchiveAll({ filter: 'all', allowedActions: ['snooze'] })).toBe(false)
        expect(canArchiveAll({ filter: 'unread', allowedActions: ['archive'] })).toBe(false)
        expect(tabLabel('production', DEFAULT_INBOX_LABELS, tabs)).toBe('Production')
        expect(tabLabel('unread', DEFAULT_INBOX_LABELS, tabs)).toBe('Unread')
        expect(emptyText('production', DEFAULT_INBOX_LABELS)).toBe('You have no notifications.')
        expect(emptyText('archived', DEFAULT_INBOX_LABELS)).toBe('You have no archived notifications.')
    })

    it('names the bell with the capped count of new notifications', () => {
        expect(bellLabel(DEFAULT_INBOX_LABELS, 0, 99, 'en')).toBe('Notifications')
        expect(bellLabel(DEFAULT_INBOX_LABELS, 3, 99, 'en')).toBe('Notifications, 3 new')
        expect(bellLabel(DEFAULT_INBOX_LABELS, 140, 99, 'en')).toBe('Notifications, 99+ new')
    })

    it('says that notifications are paused in the name of the bell, with the count', () => {
        expect(bellLabel(DEFAULT_INBOX_LABELS, 0, 99, 'en', true)).toBe('Notifications, paused')
        expect(bellLabel(DEFAULT_INBOX_LABELS, 3, 99, 'en', true)).toBe('Notifications, 3 new, paused')
        expect(bellLabel({ ...DEFAULT_INBOX_LABELS, bellPaused: 'Paused: :label' }, 0, 99, 'en', true)).toBe('Paused: Notifications')
    })

    it('shows up to two initials of an actor without an avatar', () => {
        expect(initials('sophie  martin')).toBe('SM')
        expect(initials('Maria Garcia Smith')).toBe('MG')
        expect(initials('Émile')).toBe('É')
    })

    it('holds only the arrivals that the list shows, and forgets those that leave it', async () => {
        inboxStore.connect({ request: async () => ({ items: [], nextCursor: null }) } as unknown as InertiaBindings)
        inboxStore.sync({ inertiauiInbox: { url: '/inbox', user: 'held', ...counts(1) } }, 'visit')
        await inboxStore.load('all', 'billing')

        // The list is scrolled down and never renders the held notifications.
        const scroller = Object.assign(new EventTarget(), { scrollTop: 120, querySelector: () => null }) as unknown as HTMLElement
        const changes: Array<readonly string[]> = []
        const hold = holdArrivals(scroller, (held) => changes.push(held), {
            scroller,
            listed: (id) => inboxStore.getSnapshot().items.some((item) => item.id === id),
        })

        // A notification of another category is not in the list of the selected one.
        inboxStore.receive(arrival('deploy', 'deploys'))
        inboxStore.receive(arrival('invoice', 'billing'))
        inboxStore.receive(arrival('receipt', 'billing'))
        expect(changes.at(-1)).toEqual(['invoice', 'receipt'])

        // Another session deleted one and archived the other.
        inboxStore.receiveChange({ change: { kind: 'delete', ids: ['invoice'] }, counts: counts(2) })
        expect(changes.at(-1)).toEqual(['receipt'])
        inboxStore.receiveChange({ change: { kind: 'items', action: 'archive', ids: ['receipt'], at: new Date().toISOString() }, counts: counts(3) })
        expect(changes.at(-1)).toEqual([])

        // The Archived tab starts at the top and does not show new notifications.
        hold.release()
        expect(scroller.scrollTop).toBe(0)
        await inboxStore.load('archived')
        const before = changes.length
        inboxStore.receive(arrival('archived', 'billing'))
        expect(changes).toHaveLength(before)

        hold.destroy()
    })
})
