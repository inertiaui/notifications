import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { performAction } from './actions'
import { parseActions } from './flash'
import { createInboxStore, parseInboxItem, type InboxItem } from './inbox'
import type { InertiaBindings } from './inertia'

const approval = (overrides: Partial<InboxItem> = {}): InboxItem => ({
    ...parseInboxItem({
        id: 'a',
        type: 'test',
        title: 'Expense #9 needs approval',
        actions: [
            { label: 'Approve', href: '/expenses/9/approve', method: 'post', result: 'Approved' },
            { label: 'Open', href: '/expenses/9' },
        ],
        createdAt: '2026-11-15T10:00:00Z',
        revision: 1,
    })!,
    ...overrides,
})

const counts = (revision: number) => ({ unread: 0, unseen: 0, categories: [], latest: null, latestIds: [], revision })

const itemChange = (id: string, result: string | null) => ({ kind: 'item', id, readAt: null, seenAt: null, archivedAt: null, snoozedUntil: null, result })

interface Call {
    url: string
    data?: Record<string, unknown>
    resolve: (body: unknown) => void
    reject: (error: unknown) => void
}

/** A store with one loaded approval request, connected to a server whose responses the test sends by hand. */
async function setup(visitSucceeds = true, item = approval()) {
    const calls: Call[] = []
    const visits: Array<[href: string, method: unknown, data: unknown]> = []
    const bindings = {
        request: (_method, url, data) => new Promise((resolve, reject) => calls.push({ url, data, resolve, reject })),
        visit: (href, options) => {
            visits.push([href, options.method, options.data])

            if (visitSucceeds) {
                options.onSuccess?.({} as never)
            }

            options.onFinish?.({} as never)
        },
    } as InertiaBindings
    const store = createInboxStore()

    store.connect(bindings, { onFailure: vi.fn() })
    store.sync({ inertiauiInbox: { url: '/inbox', ...counts(1) } }, 'initial')

    const loading = store.load()
    calls.shift()!.resolve({ items: [item], nextCursor: null, counts: counts(1) })
    await loading

    const shown = () => store.getSnapshot().items[0]!
    const flush = () => new Promise((resolve) => setTimeout(resolve))

    return { store, calls, visits, shown, flush }
}

const click = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, preventDefault: () => {} }
// A click on the link of an action, as the built-in components render the actions with a URL.
const link = { ...click, target: { closest: () => ({}) } as unknown as EventTarget }

// The page the actions run on, which tells the application's own URLs from those of other sites.
beforeEach(() => vi.stubGlobal('window', { open: vi.fn(), location: { href: 'https://app.test/', origin: 'https://app.test', assign: vi.fn() } }))
afterEach(() => vi.unstubAllGlobals())

describe('action results', () => {
    it('keeps the result of an action once its visit succeeded, for the user and after a reload', async () => {
        const { store, calls, shown, flush } = await setup()

        store.runAction(shown(), 0, click)

        expect(calls.map((call) => [call.url, call.data])).toEqual([
            ['/inbox/a/read', undefined],
            ['/inbox/a/complete', { action: 0 }],
        ])
        expect(shown().result).toBe('Approved')

        calls[1]!.resolve({ change: itemChange('a', 'Approved'), counts: counts(2) })
        await flush()

        expect(shown().result).toBe('Approved')
    })

    it('keeps no result when the visit of the action failed', async () => {
        const { store, calls, shown } = await setup(false)

        store.runAction(shown(), 0, click)

        expect(calls.map((call) => call.url)).toEqual(['/inbox/a/read'])
        expect(shown().result).toBeNull()
    })

    it('visits an action with another method than GET with Inertia, also when it asks for the browser or a new tab, and keeps its result once it succeeded', async () => {
        const browser = { open: vi.fn(), location: { href: 'https://app.test/', origin: 'https://app.test', assign: vi.fn() } }
        vi.stubGlobal('window', browser)
        const actions = [
            { label: 'Reject', href: '/expenses/9/reject', method: 'delete' as const, data: { reason: 'duplicate' }, newTab: true, result: 'Rejected' },
            {
                label: 'Approve',
                href: '/expenses/9/approve',
                method: 'patch' as const,
                data: { amount: 120, notify: false },
                external: true,
                result: 'Approved',
            },
        ]

        const failing = await setup(false, approval({ actions }))
        failing.store.runAction(failing.shown(), 0, click)

        expect(failing.visits).toEqual([['/expenses/9/reject', 'delete', { reason: 'duplicate' }]])
        expect(failing.calls.map((call) => call.url)).toEqual(['/inbox/a/read'])

        const succeeding = await setup(true, approval({ actions }))
        succeeding.store.runAction(succeeding.shown(), 1, click)

        expect(succeeding.visits).toEqual([['/expenses/9/approve', 'patch', { amount: 120, notify: false }]])
        expect(succeeding.calls.map((call) => [call.url, call.data])).toEqual([
            ['/inbox/a/read', undefined],
            ['/inbox/a/complete', { action: 1 }],
        ])
        expect(browser.open).not.toHaveBeenCalled()
        expect(browser.location.assign).not.toHaveBeenCalled()
    })

    it('runs no action with another method than GET without Inertia, instead of loading its URL with GET', () => {
        const browser = { open: vi.fn(), location: { href: 'https://app.test/', origin: 'https://app.test', assign: vi.fn() } }
        vi.stubGlobal('window', browser)
        const onSettled = vi.fn()

        expect(
            performAction({ label: 'Reject', href: '/expenses/9/reject', method: 'delete', newTab: true, result: 'Rejected' }, null, undefined, onSettled),
        ).toBe('failed')
        expect(performAction({ label: 'Approve', href: '/expenses/9/approve', method: 'post', external: true }, null, undefined, onSettled)).toBe('failed')
        expect(browser.open).not.toHaveBeenCalled()
        expect(browser.location.assign).not.toHaveBeenCalled()
        expect(onSettled).not.toHaveBeenCalled()
    })

    it('follows a link to another site in the same tab once its result saved', async () => {
        const browser = { open: vi.fn(), location: { href: 'https://app.test/', origin: 'https://app.test', assign: vi.fn() } }
        vi.stubGlobal('window', browser)
        const { store, calls, shown, flush } = await setup(
            true,
            approval({ actions: [{ label: 'Pay', href: 'https://billing.test/invoices/9', external: true, result: 'Paid' }] }),
        )
        const event = { ...link, preventDefault: vi.fn() }

        store.runAction(shown(), 0, event)
        await flush()

        expect(event.preventDefault).toHaveBeenCalled()
        expect(calls.map((call) => call.url)).toEqual(['/inbox/a/read', '/inbox/a/complete'])
        expect(browser.location.assign).not.toHaveBeenCalled()

        calls[1]!.resolve({ change: itemChange('a', 'Paid'), counts: counts(2) })
        await flush()

        expect(browser.location.assign).toHaveBeenCalledWith('https://billing.test/invoices/9')
    })

    it('keeps no result for an action without one', async () => {
        const { store, calls, shown } = await setup()

        store.runAction(shown(), 1, click)

        expect(calls.map((call) => call.url)).toEqual(['/inbox/a/read'])
        expect(shown().result).toBeNull()
    })

    it('shows the actions again when the server could not save the result', async () => {
        const { store, calls, shown, flush } = await setup()

        void store.complete(shown(), 0)
        expect(shown().result).toBe('Approved')

        calls[0]!.reject(new Error('offline'))
        await flush()

        expect(shown().result).toBeNull()
    })

    it('saves the result of a notification that no list shows, such as one of a toast', async () => {
        const { store, calls } = await setup()

        void store.complete('elsewhere', 0)

        expect(calls.map((call) => [call.url, call.data])).toEqual([['/inbox/elsewhere/complete', { action: 0 }]])
    })

    it('shows the result that another tab or the server saved', async () => {
        const { store, shown } = await setup()

        store.receiveChange({ change: itemChange('a', 'Approved by Sophie'), counts: counts(2) })
        expect(shown().result).toBe('Approved by Sophie')

        // An older change, such as a broadcast that arrived late, does not undo it.
        store.receiveChange({ change: itemChange('a', null), counts: counts(1) })
        expect(shown().result).toBe('Approved by Sophie')
    })

    it('reads the result of a notification and of its actions from the server', () => {
        expect(parseInboxItem({ ...approval(), result: 'Approved' })?.result).toBe('Approved')
        expect(
            parseActions([
                { label: 'Approve', href: '/approve', result: 'Approved' },
                { label: 'Open', href: '/open', result: 7 },
            ]),
        ).toMatchObject([{ result: 'Approved' }, { result: undefined }])
    })
})

describe('action results of links to another origin', () => {
    it('follows a link to another origin without external() in the same tab once its result saved', async () => {
        const browser = { open: vi.fn(), location: { href: 'https://app.test/', origin: 'https://app.test', assign: vi.fn() } }
        vi.stubGlobal('window', browser)
        const { store, calls, visits, shown, flush } = await setup(
            true,
            approval({ actions: [{ label: 'Pay', href: 'https://billing.test/invoices/9', result: 'Paid' }] }),
        )
        const event = { ...link, preventDefault: vi.fn() }

        store.runAction(shown(), 0, event)
        await flush()

        expect(event.preventDefault).toHaveBeenCalled()
        expect(calls.map((call) => call.url)).toEqual(['/inbox/a/read', '/inbox/a/complete'])
        expect(browser.location.assign).not.toHaveBeenCalled()
        expect(visits).toEqual([])

        calls[1]!.resolve({ change: itemChange('a', 'Paid'), counts: counts(2) })
        await flush()

        expect(browser.location.assign).toHaveBeenCalledWith('https://billing.test/invoices/9')
    })

    it('leaves a click on a link to another origin without a result to the browser, and loads the link for a click on a button', async () => {
        const browser = { open: vi.fn(), location: { href: 'https://app.test/', origin: 'https://app.test', assign: vi.fn() } }
        vi.stubGlobal('window', browser)
        const { store, visits, shown } = await setup(true, approval({ actions: [{ label: 'Read', href: 'https://docs.test/guide' }] }))
        const linked = { ...link, preventDefault: vi.fn() }
        const button = { ...click, preventDefault: vi.fn() }

        store.runAction(shown(), 0, linked)

        expect(linked.preventDefault).not.toHaveBeenCalled()
        expect(browser.location.assign).not.toHaveBeenCalled()

        // A custom panel may render the action as a button, which the browser has no link to follow for.
        store.runAction(shown(), 0, button)

        expect(button.preventDefault).toHaveBeenCalled()
        expect(browser.location.assign).toHaveBeenCalledWith('https://docs.test/guide')
        expect(visits).toEqual([])
    })

    it('visits a link to the application with Inertia, and saves its result once the visit succeeded', async () => {
        const browser = { open: vi.fn(), location: { href: 'https://app.test/', origin: 'https://app.test', assign: vi.fn() } }
        vi.stubGlobal('window', browser)
        const { store, calls, visits, shown } = await setup(true, approval({ actions: [{ label: 'Review', href: '/expenses/9', result: 'Reviewed' }] }))
        const event = { ...click, preventDefault: vi.fn() }

        store.runAction(shown(), 0, event)

        expect(event.preventDefault).toHaveBeenCalled()
        expect(visits).toEqual([['/expenses/9', 'get', undefined]])
        expect(calls.map((call) => call.url)).toEqual(['/inbox/a/read', '/inbox/a/complete'])
        expect(browser.location.assign).not.toHaveBeenCalled()
    })
})

describe('actions that run without a click on their link', () => {
    const stubBrowser = () => {
        const browser = { open: vi.fn(), location: { href: 'https://app.test/', origin: 'https://app.test', assign: vi.fn() } }
        vi.stubGlobal('window', browser)

        return browser
    }

    it('saves the result of an action that loads in this tab before the browser leaves', async () => {
        const browser = stubBrowser()
        const { store, calls, visits, shown, flush } = await setup(
            true,
            approval({ actions: [{ label: 'Download', href: '/expenses/9/receipt.pdf', external: true, result: 'Downloaded' }] }),
        )

        store.runAction(shown(), 0)
        await flush()

        expect(calls.map((call) => call.url)).toEqual(['/inbox/a/read', '/inbox/a/complete'])
        expect(browser.location.assign).not.toHaveBeenCalled()

        calls[1]!.resolve({ change: itemChange('a', 'Downloaded'), counts: counts(2) })
        await flush()

        expect(browser.location.assign).toHaveBeenCalledExactlyOnceWith('/expenses/9/receipt.pdf')
        expect(visits).toEqual([])
    })

    it('opens the new tab of an action at once and saves its result without waiting, also for a click on a button', async () => {
        const browser = stubBrowser()
        const actions = [{ label: 'Open', href: '/expenses/9/receipt.pdf', newTab: true, result: 'Opened' }]
        const code = await setup(true, approval({ actions }))

        code.store.runAction(code.shown(), 0)

        expect(browser.open).toHaveBeenCalledExactlyOnceWith('/expenses/9/receipt.pdf', '_blank', 'noopener')
        expect(code.calls.map((call) => call.url)).toEqual(['/inbox/a/read', '/inbox/a/complete'])

        const clicked = await setup(true, approval({ actions }))
        const button = { ...click, preventDefault: vi.fn() }

        clicked.store.runAction(clicked.shown(), 0, button)

        expect(button.preventDefault).toHaveBeenCalled()
        expect(browser.open).toHaveBeenCalledTimes(2)
        expect(clicked.calls.map((call) => call.url)).toEqual(['/inbox/a/read', '/inbox/a/complete'])
        expect(browser.location.assign).not.toHaveBeenCalled()
    })

    it('leaves at once for an action without a result, also for a click on a button, and leaves clicks on links to the browser', async () => {
        const browser = stubBrowser()
        const { store, calls, visits, shown } = await setup(
            true,
            approval({
                actions: [
                    { label: 'Download', href: '/expenses/9/receipt.pdf', external: true },
                    { label: 'Receipt', href: '/expenses/9/receipt', newTab: true },
                ],
            }),
        )
        const buttons = [
            { ...click, preventDefault: vi.fn() },
            { ...click, preventDefault: vi.fn() },
        ]
        const links = [
            { ...link, preventDefault: vi.fn() },
            { ...link, preventDefault: vi.fn() },
        ]

        store.runAction(shown(), 0)
        expect(browser.location.assign).toHaveBeenCalledExactlyOnceWith('/expenses/9/receipt.pdf')

        store.runAction(shown(), 0, buttons[0])
        store.runAction(shown(), 1, buttons[1])

        expect(buttons.filter((event) => event.preventDefault.mock.calls.length > 0)).toHaveLength(2)
        expect(browser.location.assign).toHaveBeenCalledTimes(2)
        expect(browser.open).toHaveBeenCalledExactlyOnceWith('/expenses/9/receipt', '_blank', 'noopener')

        // The browser follows a click on the link of an action itself.
        store.runAction(shown(), 0, links[0])
        store.runAction(shown(), 1, links[1])

        expect(links.filter((event) => event.preventDefault.mock.calls.length > 0)).toEqual([])
        expect(browser.location.assign).toHaveBeenCalledTimes(2)
        expect(browser.open).toHaveBeenCalledOnce()
        expect(calls.map((call) => call.url)).toEqual(['/inbox/a/read'])
        expect(visits).toEqual([])
    })
})
