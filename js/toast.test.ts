import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { InertiaBindings } from './inertia'

// The toast API ignores calls outside a browser, so these tests run against a minimal window.
const assign = vi.fn()
const windowStub = Object.assign(new EventTarget(), {
    location: { href: 'https://app.test/dashboard', origin: 'https://app.test', assign },
    open: vi.fn(),
})
vi.stubGlobal('window', windowStub)
vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: () => {} })

const { DEFAULT_ERROR_MESSAGES, errorToastContent, handleActionClick, initNotifications, runToastAction, toast, toastStore } = await import('./toast')
const { inboxStore } = await import('./inbox')
const { preferencesStore } = await import('./preferences')
const { DEFAULT_TRANSLATIONS, setTranslations } = await import('./translations')

const open = () => toastStore.getSnapshot().filter((item) => item.state !== 'closing')
const byTitle = (title: string) => open().find((item) => item.title === title)

/** The shared prop of the notification center, with every key of the summary that the server sends. */
const inbox = (props: Record<string, unknown>) => ({
    inertiauiInbox: { url: '/inbox', unread: 0, unseen: 0, categories: [], latest: null, latestIds: [], revision: 1, ...props },
})

const visits: Array<{ href: string; options: Record<string, unknown> }> = []
// The requests of the notification center, which answer only when a test settles them.
const requests: string[] = []
const answers: Array<{ resolve: (body: unknown) => void; reject: (error: unknown) => void }> = []
const answer = (request: string) => answers[requests.indexOf(request)]!
const flush = async () => {
    for (let tick = 0; tick < 10; tick++) {
        await Promise.resolve()
    }
}
const listeners: Partial<{ [K in keyof InertiaBindings]: Parameters<InertiaBindings[K]>[0] }> = {}

initNotifications({
    onFlash: (listener) => void (listeners.onFlash = listener),
    onRequest: (listener) => void (listeners.onRequest = listener),
    onResponse: (listener) => void (listeners.onResponse = listener),
    onError: (listener) => void (listeners.onError = listener),
    onHttpException: (listener) => void (listeners.onHttpException = listener),
    onNavigate: (listener) => void (listeners.onNavigate = listener),
    visit: (href, options) => void visits.push({ href, options }),
    request: (method, url) => {
        requests.push(`${method} ${url}`)

        return new Promise((resolve, reject) => answers.push({ resolve, reject }))
    },
    useSocketId: () => {},
})

beforeEach(() => vi.useFakeTimers())

afterEach(() => {
    toastStore.dismiss()
    vi.advanceTimersByTime(1000)
    vi.useRealTimers()
    visits.length = 0
    requests.length = 0
    answers.length = 0
})

describe('error toasts', () => {
    const response = (status: number, headers: Record<string, string> = {}) => ({ code: 'ERR_HTTP_RESPONSE', response: { status, data: '', headers } })

    it('picks the message for the status, any server error, or a network failure', () => {
        expect(errorToastContent(response(419), DEFAULT_ERROR_MESSAGES)).toEqual(DEFAULT_ERROR_MESSAGES[419])
        expect(errorToastContent(response(503), DEFAULT_ERROR_MESSAGES)).toEqual(DEFAULT_ERROR_MESSAGES['5xx'])
        expect(errorToastContent({ code: 'ERR_NETWORK' }, DEFAULT_ERROR_MESSAGES)).toEqual(DEFAULT_ERROR_MESSAGES.network)
        expect(errorToastContent(response(500), { 500: { title: 'Server error' }, '5xx': { title: 'Other' } })).toEqual({ title: 'Server error' })
    })

    it('leaves statuses without a message, cancelled requests, and responses Inertia or the server handle alone', () => {
        expect(errorToastContent(response(404), DEFAULT_ERROR_MESSAGES)).toBeUndefined()
        expect(errorToastContent(response(422), DEFAULT_ERROR_MESSAGES)).toBeUndefined()
        expect(errorToastContent({ code: 'ERR_CANCELLED' }, DEFAULT_ERROR_MESSAGES)).toBeUndefined()
        expect(errorToastContent(response(500, { 'x-inertia': 'true' }), DEFAULT_ERROR_MESSAGES)).toBeUndefined()
        expect(errorToastContent(response(500, { 'x-inertiaui-toasts': '[]' }), DEFAULT_ERROR_MESSAGES)).toBeUndefined()
        expect(errorToastContent(response(503), { ...DEFAULT_ERROR_MESSAGES, 503: false })).toBeUndefined()
    })

    it('leaves the 409 that Inertia follows as a redirect to a URL with a fragment', () => {
        const messages = { 409: { title: 'Conflict' } }

        expect(errorToastContent(response(409, { 'x-inertia-redirect': 'https://app.test/reports#latest' }), messages)).toBeUndefined()
        expect(errorToastContent(response(409), messages)).toEqual({ title: 'Conflict' })
    })
})

describe('Inertia integration', () => {
    it('asks for toast headers on same-origin requests only', () => {
        expect(listeners.onRequest!({ url: '/api/archive', headers: { Accept: 'application/json' } })).toEqual({
            Accept: 'application/json',
            'x-inertiaui-toasts': '1',
        })
        expect(listeners.onRequest!({ url: 'https://api.example.com/items', headers: { Accept: 'application/json' } })).toEqual({ Accept: 'application/json' })
    })

    it('shows toasts from flash data, page responses, and response headers', () => {
        listeners.onFlash!({ inertiaui: { toasts: [{ uuid: 'flash', title: 'From flash' }] } })
        listeners.onResponse!({ data: '{"flash":{"inertiaui":{"toasts":[{"uuid":"page","title":"From page"}]}}}', headers: { 'x-inertia': 'true' } })
        listeners.onResponse!({ data: '{}', headers: { 'x-inertiaui-toasts': '[{"uuid":"json","title":"From JSON"}]' } })
        listeners.onError!({
            code: 'ERR_HTTP_RESPONSE',
            response: { status: 422, data: '{}', headers: { 'x-inertiaui-toasts': '[{"uuid":"failed","title":"From failure"}]' } },
        })

        expect(open().map((item) => item.title)).toEqual(['From flash', 'From page', 'From JSON', 'From failure'])
    })

    it('replaces the error dialog with a toast only when error toasts cover the status', () => {
        const failure = { status: 419, data: '', headers: {} }

        expect(listeners.onHttpException!(failure)).toBeUndefined()

        initNotifications({} as InertiaBindings, { errorToasts: { 419: { title: 'Session expired' } } })
        expect(listeners.onHttpException!(failure)).toBe(false)
        expect(listeners.onHttpException!({ ...failure, status: 404 })).toBeUndefined()

        listeners.onError!({ code: 'ERR_HTTP_RESPONSE', response: { ...failure, status: 419 } })
        listeners.onError!({ code: 'ERR_NETWORK' })
        expect(open().map((item) => [item.type, item.title])).toEqual([
            ['error', 'Session expired'],
            ['error', DEFAULT_ERROR_MESSAGES.network && DEFAULT_ERROR_MESSAGES.network.title],
        ])

        initNotifications({} as InertiaBindings, { errorToasts: false })
        expect(listeners.onHttpException!(failure)).toBeUndefined()
    })

    it('keeps the error dialog away for every status that error toasts cover, and shows the toasts of the server in place of the error toast', () => {
        const titles = () => open().map((item) => item.title)
        const failure = (status: number, headers: Record<string, string> = {}) => ({ status, data: '<h1>Server Error</h1>', headers })
        const withToasts = (uuid: string) => ({ 'x-inertiaui-toasts': JSON.stringify([{ uuid, title: 'The report could not be saved.' }]) })
        // A visit whose response failed: Inertia's HTTP client reports the error, then Inertia decides on its dialog.
        const visit = (response: ReturnType<typeof failure>) => {
            listeners.onRequest!({ url: 'https://app.test/reports', headers: { 'X-Inertia': true } })
            listeners.onError!({ code: 'ERR_HTTP_RESPONSE', url: 'https://app.test/reports', response })

            return listeners.onHttpException!({ ...response })
        }
        initNotifications({} as InertiaBindings, { errorToasts: { 503: false } })

        expect(visit(failure(500, withToasts('covered')))).toBe(false)
        expect(titles()).toEqual(['The report could not be saved.'])
        toastStore.dismiss()

        // A status set to `false` stays with Inertia's dialog, with or without toasts of the server.
        expect(visit(failure(503, withToasts('left')))).toBeUndefined()
        expect(titles()).toEqual(['The report could not be saved.'])
        toastStore.dismiss()
        expect(visit(failure(503))).toBeUndefined()
        expect(titles()).toEqual([])

        // So does a status without a message.
        expect(visit(failure(404, withToasts('uncovered')))).toBeUndefined()
        expect(titles()).toEqual(['The report could not be saved.'])
        toastStore.dismiss()
        expect(visit(failure(404))).toBeUndefined()
        expect(titles()).toEqual([])

        // An Inertia page with a covered status renders the application's own error page.
        expect(visit(failure(500, { 'x-inertia': 'true' }))).toBeUndefined()
        expect(titles()).toEqual([])

        initNotifications({} as InertiaBindings, { errorToasts: false })
    })

    it('shows one error toast for each failed request', () => {
        const titles = () => open().map((item) => item.title)
        const serverError = DEFAULT_ERROR_MESSAGES['5xx'] && DEFAULT_ERROR_MESSAGES['5xx'].title
        initNotifications({} as InertiaBindings, { errorToasts: true })

        // A visit that fails shows its toast once, and Inertia's dialog stays away.
        const visited = { status: 500, data: '', headers: {} }
        listeners.onRequest!({ url: 'https://app.test/reports', headers: { 'X-Inertia': true } })
        listeners.onError!({ code: 'ERR_HTTP_RESPONSE', url: 'https://app.test/reports', response: visited })
        expect(listeners.onHttpException!({ ...visited, data: '' })).toBe(false)
        expect(titles()).toEqual([serverError])
        toastStore.dismiss()

        // A JSON request, such as with `useHttp`, never reaches Inertia's dialog.
        listeners.onRequest!({ url: '/api/reports', headers: { Accept: 'application/json' } })
        listeners.onError!({ code: 'ERR_HTTP_RESPONSE', url: '/api/reports', response: { status: 503, data: '', headers: {} } })
        expect(titles()).toEqual([serverError])

        initNotifications({} as InertiaBindings, { errorToasts: false })
    })

    it('titles error toasts with the default, then the translation, then the errorToasts option', () => {
        const network = () => {
            listeners.onError!({ code: 'ERR_NETWORK' })
            const shown = open().map((item) => [item.title, item.description])
            toastStore.dismiss()

            return shown
        }

        initNotifications({} as InertiaBindings, { errorToasts: true })
        expect(network()).toEqual([['You appear to be offline.', 'Check your connection and try again.']])

        setTranslations({ error_toast_network: 'Je bent offline.', error_toast_network_description: '' })
        expect(network()).toEqual([['Je bent offline.', undefined]])

        initNotifications({} as InertiaBindings, { errorToasts: { network: { title: 'Geen verbinding', description: 'Probeer het later opnieuw.' } } })
        expect(network()).toEqual([['Geen verbinding', 'Probeer het later opnieuw.']])

        setTranslations(DEFAULT_TRANSLATIONS)
        initNotifications({} as InertiaBindings, { errorToasts: false })
        expect(network()).toEqual([])
    })

    it('labels the View action of arrival toasts with the translation', () => {
        const callbacks = new Map<string, (payload: unknown) => void>()
        const echo = {
            private: (channel: string) => ({
                listen: (event: string, callback: (payload: unknown) => void) => void callbacks.set(`${channel}${event}`, callback),
                stopListening: () => {},
            }),
            socketId: () => undefined,
        }

        setTranslations({ inbox_toast_view: 'Bekijken', inbox_toast_view_alt: 'Ook in je meldingen.' })
        initNotifications({} as InertiaBindings, { inbox: { echo } })
        listeners.onNavigate!(inbox({ channel: 'App.Models.User.2' }), 'visit')
        callbacks.get('App.Models.User.2.inertiaui.inbox.arrived')!({
            item: { id: 'v', title: 'Invoice paid', toast: 'info', url: '/invoices/8', createdAt: '2026-11-15T10:00:00Z' },
        })
        setTranslations(DEFAULT_TRANSLATIONS)

        expect(byTitle('Invoice paid')!.actions).toEqual([{ label: 'Bekijken', altText: 'Ook in je meldingen.', href: '/invoices/8' }])
    })

    it('shows notifications that arrive with Echo as toasts, once, also when the server flashed the same toast', () => {
        const callbacks = new Map<string, (payload: unknown) => void>()
        const echo = {
            private: (channel: string) => ({
                listen: (event: string, callback: (payload: unknown) => void) => void callbacks.set(`${channel}${event}`, callback),
                stopListening: () => {},
            }),
            socketId: () => undefined,
        }
        const arrive = (id: string, overrides: Record<string, unknown> = {}) =>
            callbacks.get('App.Models.User.1.inertiaui.inbox.arrived')!({
                item: { id, title: 'Deployment finished', toast: 'success', createdAt: '2026-11-15T10:00:00Z', ...overrides },
            })

        initNotifications({} as InertiaBindings, { inbox: { echo } })
        listeners.onNavigate!(inbox({ channel: 'App.Models.User.1' }), 'visit')

        // The server flashed the toast, with its translated action, during the user's own request, which sent the notification.
        listeners.onFlash!({
            inertiaui: {
                toasts: [{ uuid: 'f1', id: 'inertiaui-inbox-a', title: 'Deployment finished', type: 'success', actions: [{ label: 'Bekijken', href: '/' }] }],
            },
        })
        arrive('a', { url: '/' })
        arrive('b', { title: 'Comment posted', toast: null })
        arrive('c', { title: 'Invoice paid', toast: 'info', url: '/invoices/7' })

        expect(open().map((item) => [item.id, item.title, item.revision])).toEqual([
            ['inertiaui-inbox-a', 'Deployment finished', 1],
            ['inertiaui-inbox-c', 'Invoice paid', 1],
        ])
        expect(byTitle('Deployment finished')!.actions).toEqual([{ label: 'Bekijken', href: '/' }])
        expect(byTitle('Invoice paid')!.actions).toEqual([{ label: 'View', altText: 'Also in your notifications.', href: '/invoices/7' }])
    })

    it('closes the toasts of notifications once a panel opens, and shows none while it is open', () => {
        const callbacks = new Map<string, (payload: unknown) => void>()
        const echo = {
            private: (channel: string) => ({
                listen: (event: string, callback: (payload: unknown) => void) => void callbacks.set(`${channel}${event}`, callback),
                stopListening: () => {},
            }),
            socketId: () => undefined,
        }
        const arrive = (id: string, title: string) =>
            callbacks.get('App.Models.User.5.inertiaui.inbox.arrived')!({ item: { id, title, toast: 'info', createdAt: '2026-11-15T10:00:00Z' } })

        initNotifications({} as InertiaBindings, { inbox: { echo } })
        listeners.onNavigate!(inbox({ channel: 'App.Models.User.5' }), 'visit')

        toast.success('Settings saved')
        arrive('panel-a', 'Deployment finished')
        expect(open().map((item) => item.title)).toEqual(['Settings saved', 'Deployment finished'])

        void inboxStore.opened(undefined, { markAllAsSeen: false })
        arrive('panel-b', 'Invoice paid')

        // The toast of no notification stays.
        expect(open().map((item) => item.title)).toEqual(['Settings saved'])

        inboxStore.closed({ markAllAsSeen: false })
        arrive('panel-c', 'Comment posted')

        expect(open().map((item) => item.title)).toEqual(['Settings saved', 'Comment posted'])
    })

    it("lists a notification that the user's own request sent while a panel is open, instead of showing its flashed toast", async () => {
        listeners.onNavigate!(inbox({ channel: 'App.Models.User.6' }), 'visit')
        void inboxStore.opened(undefined, { markAllAsSeen: false })

        listeners.onFlash!({
            inertiaui: {
                toasts: [
                    { uuid: 'own-a', id: 'inertiaui-inbox-own-a', title: 'Liam replied' },
                    { uuid: 'own-saved', title: 'Comment posted' },
                ],
            },
        })

        // The response only brings the new counts, so the panel requests the notification.
        expect(open().map((item) => item.title)).toEqual(['Comment posted'])
        answer('get /inbox/own-a').resolve({ item: { id: 'own-a', title: 'Liam replied', toast: 'info', createdAt: '2026-11-15T10:00:00Z' } })
        await flush()

        expect(inboxStore.getSnapshot().items.map((item) => item.title)).toContain('Liam replied')
        expect(open().map((item) => item.title)).toEqual(['Comment posted'])

        inboxStore.closed({ markAllAsSeen: false })
        listeners.onFlash!({ inertiaui: { toasts: [{ uuid: 'own-b', id: 'inertiaui-inbox-own-b', title: 'Invoice paid' }] } })

        expect(open().map((item) => item.title)).toEqual(['Comment posted', 'Invoice paid'])
    })

    it('calls the onArrival option with each notification that arrives with Echo, before its toast shows', () => {
        const callbacks = new Map<string, (payload: unknown) => void>()
        const echo = {
            private: (channel: string) => ({
                listen: (event: string, callback: (payload: unknown) => void) => void callbacks.set(`${channel}${event}`, callback),
                stopListening: () => {},
            }),
            socketId: () => undefined,
        }
        const arrivals: Array<[string, boolean]> = []

        initNotifications({} as InertiaBindings, { inbox: { echo, onArrival: (item) => arrivals.push([item.title, byTitle(item.title) !== undefined]) } })
        // A later call without the option keeps it.
        initNotifications({} as InertiaBindings, { inbox: { echo } })
        listeners.onNavigate!(inbox({ channel: 'App.Models.User.3' }), 'visit')
        callbacks.get('App.Models.User.3.inertiaui.inbox.arrived')!({
            item: { id: 'arrival', title: 'Build failed', toast: 'error', createdAt: '2026-11-15T10:00:00Z' },
        })

        expect(arrivals).toEqual([['Build failed', false]])
        expect(byTitle('Build failed')).toBeDefined()
    })

    it('shows the toast of a notification that the unsnooze command brings back like one that arrives with Echo, after the onArrival option', () => {
        const callbacks = new Map<string, (payload: unknown) => void>()
        const echo = {
            private: (channel: string) => ({
                listen: (event: string, callback: (payload: unknown) => void) => void callbacks.set(`${channel}${event}`, callback),
                stopListening: () => {},
            }),
            socketId: () => undefined,
        }
        const arrivals: Array<[string, boolean]> = []
        const resurface = (id: string, overrides: Record<string, unknown> = {}) =>
            callbacks.get('App.Models.User.4.inertiaui.inbox.changed')!({
                change: {
                    kind: 'item',
                    id,
                    readAt: null,
                    seenAt: null,
                    archivedAt: null,
                    snoozedUntil: null,
                    result: null,
                    item: { id, title: 'Invoice overdue', toast: 'warning', createdAt: '2026-11-15T12:00:00Z', ...overrides },
                },
                counts: inbox({ unread: 1, unseen: 1, revision: 2 }).inertiauiInbox,
            })

        initNotifications({} as InertiaBindings, { inbox: { echo, onArrival: (item) => arrivals.push([item.title, byTitle(item.title) !== undefined]) } })
        listeners.onNavigate!(inbox({ channel: 'App.Models.User.4' }), 'visit')
        resurface('snoozed', { body: 'Invoice #12 is due today.', url: '/invoices/12' })
        resurface('untoasted', { title: 'Comment posted', toast: null })

        expect(arrivals).toEqual([
            ['Invoice overdue', false],
            ['Comment posted', false],
        ])
        expect(open().map((item) => [item.id, item.type, item.title, item.description, item.actions])).toEqual([
            [
                'inertiaui-inbox-snoozed',
                'warning',
                'Invoice overdue',
                'Invoice #12 is due today.',
                [{ label: 'View', altText: 'Also in your notifications.', href: '/invoices/12' }],
            ],
        ])
    })

    it('shows one toast for a notification that arrives with Echo, and none for one that the application receives itself', () => {
        const callbacks = new Map<string, (payload: unknown) => void>()
        const echo = {
            private: (channel: string) => ({
                listen: (event: string, callback: (payload: unknown) => void) => void callbacks.set(`${channel}${event}`, callback),
                stopListening: () => {},
            }),
            socketId: () => undefined,
        }
        const add = vi.spyOn(toastStore, 'add')

        initNotifications({} as InertiaBindings, { inbox: { echo } })
        listeners.onNavigate!(inbox({ channel: 'App.Models.User.5' }), 'visit')
        callbacks.get('App.Models.User.5.inertiaui.inbox.arrived')!({
            item: { id: 'broadcast', title: 'Build passed', toast: 'success', createdAt: '2026-11-15T12:00:00Z' },
        })
        inboxStore.receive({ id: 'received', title: 'Report ready', toast: 'info', createdAt: '2026-11-15T12:00:00Z' })
        const added = add.mock.calls.map(([title]) => title)
        add.mockRestore()

        expect(added).toEqual(['Build passed'])
        expect(open().map((item) => item.id)).toEqual(['inertiaui-inbox-broadcast'])
    })

    it("marks the notification of a toast as read when one of the toast's actions runs, however the toast arrived", () => {
        listeners.onNavigate!(inbox({ channel: 'App.Models.User.1', unread: 3 }), 'visit')
        const click = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, preventDefault: vi.fn() }

        // Flashed by the server, so the notification center never received it.
        listeners.onFlash!({
            inertiaui: {
                toasts: [
                    { uuid: 'f2', id: 'inertiaui-inbox-flashed', title: 'Deployment finished', actions: [{ label: 'View', href: '/deploys/1' }] },
                    { uuid: 'f3', id: 'inertiaui-inbox-kept', title: 'Invoice paid', actions: [{ label: 'Copy', event: 'copy', keepOpen: true }] },
                    { uuid: 'f4', id: 'inertiaui-inbox-tab', title: 'Report ready', actions: [{ label: 'Open', href: '/reports/1', newTab: true }] },
                    { uuid: 'f5', id: 'plain', title: 'Saved', actions: [{ label: 'Undo', event: 'undo' }] },
                ],
            },
        })

        runToastAction('inertiaui-inbox-flashed', 0)
        runToastAction('inertiaui-inbox-kept', 0)
        handleActionClick('inertiaui-inbox-tab', 0, click)
        runToastAction('plain', 0)

        expect(requests).toEqual(['post /inbox/flashed/read', 'post /inbox/kept/read', 'post /inbox/tab/read'])
        expect(byTitle('Invoice paid')).toBeDefined()
    })

    it("saves the result of an action that ran on a notification's toast", () => {
        listeners.onNavigate!(inbox({ channel: 'App.Models.User.1', unread: 1 }), 'visit')
        listeners.onFlash!({
            inertiaui: {
                toasts: [
                    {
                        uuid: 'f6',
                        id: 'inertiaui-inbox-expense',
                        title: 'Expense #9 needs approval',
                        actions: [{ label: 'Approve', event: 'approve', result: 'Approved' }],
                    },
                    { uuid: 'f7', id: 'plain-approval', title: 'Approve?', actions: [{ label: 'Approve', event: 'approve', result: 'Approved' }] },
                ],
            },
        })

        runToastAction('inertiaui-inbox-expense', 0)
        runToastAction('plain-approval', 0)

        expect(requests).toEqual(['post /inbox/expense/read', 'post /inbox/expense/complete'])
    })

    it('changes the open toast of a notification that the server updated, and closes it once the server retracted it', () => {
        listeners.onNavigate!(inbox({ channel: 'App.Models.User.1', unread: 1 }), 'visit')
        listeners.onFlash!({ inertiaui: { toasts: [{ uuid: 'f8', id: 'inertiaui-inbox-build', title: 'Build #42 is running', type: 'info' }] } })
        const change = (value: Record<string, unknown>, revision: number) => ({ change: value, counts: inbox({ revision }).inertiauiInbox })
        const item = { id: 'build', title: 'Build #42 passed', body: 'In 93 seconds.', url: '/builds/42', createdAt: '2026-11-15T10:00:00Z', revision: 5 }

        inboxStore.receiveChange(change({ kind: 'update', item }, 6))

        expect(byTitle('Build #42 passed')).toMatchObject({
            id: 'inertiaui-inbox-build',
            description: 'In 93 seconds.',
            actions: [{ label: 'View', href: '/builds/42' }],
        })

        inboxStore.receiveChange(change({ kind: 'delete', ids: ['build'] }, 7))

        expect(byTitle('Build #42 passed')).toBeUndefined()
    })

    it('reads the shared prop of a later call, after a call without it', async () => {
        vi.resetModules()
        const fresh = await import('./toast')
        const { inboxStore: freshInbox } = await import('./inbox')
        let navigate: Parameters<InertiaBindings['onNavigate']>[0] | undefined
        const sent: string[] = []

        // Every Toaster, NotificationCenter, and hook calls it without options when it mounts, which may be before the application's call.
        fresh.initNotifications({
            onFlash: () => {},
            onRequest: () => undefined,
            onResponse: () => {},
            onError: () => {},
            onHttpException: () => {},
            onNavigate: (listener) => void (navigate = listener),
            visit: () => {},
            request: (method, url) => {
                sent.push(`${method} ${url}`)

                return new Promise(() => {})
            },
            useSocketId: () => {},
        })
        fresh.initNotifications({} as InertiaBindings, { inbox: { prop: 'app.inbox' } })
        navigate!({ app: { inbox: inbox({ unread: 4 }).inertiauiInbox } }, 'visit')
        void freshInbox.load('all')

        expect(freshInbox.getSnapshot().counts.unread).toBe(4)
        expect(sent).toEqual(['get /inbox?filter=all'])
    })
})

describe('toast.promise', () => {
    it('replaces the loading toast in place when the promise settles', async () => {
        const saved = toast.promise(Promise.resolve({ name: 'Q3 report' }), {
            loading: 'Building report…',
            success: (report) => ({ title: `${report.name} is ready`, description: 'Download it from Reports.' }),
            error: 'Could not build the report',
        })

        expect(open()).toMatchObject([{ id: saved.id, type: 'loading', title: 'Building report…', duration: null }])

        await expect(saved.unwrap()).resolves.toEqual({ name: 'Q3 report' })
        expect(open()).toMatchObject([{ id: saved.id, type: 'success', title: 'Q3 report is ready', description: 'Download it from Reports.' }])

        const failed = toast.promise(() => Promise.reject(new Error('Disk full')), {
            loading: 'Exporting…',
            error: (error) => `Export failed: ${(error as Error).message}`,
        })

        await expect(failed.unwrap()).rejects.toThrow('Disk full')
        expect(byTitle('Export failed: Disk full')).toMatchObject({ id: failed.id, type: 'error' })
    })

    it('shows the error message for a response of a failed request, which unwrap still resolves with', async () => {
        const response = new Response('Server Error', { status: 500 })
        const error = vi.fn((failure: unknown) => `Export failed with ${(failure as Response).status}`)
        const exporting = toast.promise(Promise.resolve(response), { loading: 'Exporting…', success: 'Exported', error })

        await expect(exporting.unwrap()).resolves.toBe(response)
        expect(error).toHaveBeenCalledWith(response)
        expect(byTitle('Export failed with 500')).toMatchObject({ id: exporting.id, type: 'error' })

        const saving = toast.promise(Promise.resolve(new Response(null, { status: 204 })), { loading: 'Saving…', success: 'Saved', error: 'Failed' })
        await saving.unwrap()
        expect(byTitle('Saved')).toMatchObject({ id: saving.id, type: 'success' })
    })

    it('closes the loading toast when no message is given for the result', async () => {
        await toast.promise(Promise.resolve(), { loading: 'Syncing…' }).unwrap()

        expect(open()).toEqual([])
    })
})

describe('toast.track', () => {
    it('shows a loading toast during the visit and keeps the visit callbacks', () => {
        const onSuccess = vi.fn()
        const callbacks = toast.track(
            { loading: 'Saving…', success: 'Saved', error: (errors) => `Fix ${Object.keys(errors).length} fields` },
            { preserveScroll: true, onSuccess },
        )

        expect(callbacks.preserveScroll).toBe(true)

        callbacks.onStart({})
        expect(open()).toMatchObject([{ type: 'loading', title: 'Saving…' }])

        callbacks.onSuccess({ component: 'Home' })
        callbacks.onFinish({})
        expect(open()).toMatchObject([{ type: 'success', title: 'Saved' }])
        expect(onSuccess).toHaveBeenCalledWith({ component: 'Home' })

        callbacks.onStart({})
        callbacks.onError({ name: 'Required', email: 'Invalid' })
        expect(open()).toMatchObject([{ type: 'error', title: 'Fix 2 fields' }])
    })

    it('fills the loading toast with the progress of the upload, and keeps the visit callback', () => {
        const onProgress = vi.fn()
        const callbacks = toast.track({ loading: 'Uploading report.pdf…', success: 'Report uploaded' }, { onProgress })

        callbacks.onStart({})
        expect(byTitle('Uploading report.pdf…')?.progress).toBeUndefined()

        // Inertia reports a percentage of 0 while the size of the upload is unknown, which shows no bar.
        callbacks.onProgress({ progress: undefined, loaded: 600, total: undefined, percentage: 0 })
        expect(byTitle('Uploading report.pdf…')?.progress).toBeUndefined()
        expect(onProgress).toHaveBeenCalledWith({ progress: undefined, loaded: 600, total: undefined, percentage: 0 })

        callbacks.onProgress({ progress: 0, loaded: 0, total: 1000, percentage: 0 })
        expect(byTitle('Uploading report.pdf…')?.progress).toBe(0)

        callbacks.onProgress({ progress: 0.25, loaded: 250, total: 1000, percentage: 25 })
        expect(byTitle('Uploading report.pdf…')?.progress).toBe(0.25)

        callbacks.onSuccess({ component: 'Reports' })
        expect(byTitle('Report uploaded')?.progress).toBeUndefined()
    })

    it('keeps the toast that the server flashed with the ID of the loading toast', () => {
        const callbacks = toast.track({ id: 'review', loading: 'Requesting review…' })

        callbacks.onStart({})
        // The flash data of the response arrives before the visit's onSuccess.
        listeners.onFlash!({ inertiaui: { toasts: [{ uuid: 'review-flash', id: 'review', type: 'success', title: 'Review requested' }] } })
        callbacks.onSuccess({ component: 'Artboard' })
        callbacks.onFinish({})

        expect(open()).toMatchObject([{ id: 'review', type: 'success', title: 'Review requested' }])
    })

    it('closes the loading toast when the visit is cancelled', () => {
        const callbacks = toast.track({ loading: 'Saving…' })

        callbacks.onStart({})
        callbacks.onFinish({})

        expect(open()).toEqual([])
    })
})

describe('toast actions', () => {
    const click = (overrides: Partial<MouseEvent> = {}) => ({
        button: 0,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        preventDefault: vi.fn(),
        ...overrides,
    })
    // A click on an action that renders as a link, as the built-in Toaster renders the actions with a URL.
    const linkClick = (overrides: Partial<MouseEvent> = {}) => click({ target: { closest: () => ({}) } as unknown as EventTarget, ...overrides })

    it('keeps the toast open with a loading state until the action settles', async () => {
        let resolve!: () => void
        let reject!: () => void
        const first = new Promise<void>((done) => (resolve = done))
        const second = new Promise<void>((_, fail) => (reject = fail))
        const onClick = vi.fn().mockReturnValueOnce(second).mockReturnValueOnce(first)
        const onClose = vi.fn()
        const id = toast('Message archived', { action: { label: 'Undo', onClick }, onClose })

        runToastAction(id, 0)
        expect(byTitle('Message archived')?.pendingAction).toBe(0)

        // A second click while the action runs is ignored.
        runToastAction(id, 0)
        expect(onClick).toHaveBeenCalledTimes(1)

        reject()
        await second.catch(() => {})
        await Promise.resolve()
        expect(byTitle('Message archived')?.pendingAction).toBeUndefined()

        runToastAction(id, 0)
        resolve()
        await first
        await Promise.resolve()
        expect(byTitle('Message archived')).toBeUndefined()
        expect(onClose).toHaveBeenCalledWith('action')
    })

    it('dispatches events and keeps the toast open when asked', () => {
        const received = vi.fn()
        window.addEventListener('copy-import', (event) => received((event as CustomEvent).detail))
        const id = toast('Import ready', { action: { label: 'Copy ID', event: 'copy-import', payload: { id: 7 }, keepOpen: true } })

        runToastAction(id, 0)

        expect(received).toHaveBeenCalledWith({ id: 7 })
        expect(byTitle('Import ready')).toBeDefined()
    })

    it('visits URLs with Inertia and closes the toast only when the visit succeeds', () => {
        const id = toast('Invoice sent', {
            actions: [
                { label: 'Unsend', href: '/invoices/7/unsend', method: 'post', data: { notify: false }, visit: { preserveScroll: true } },
                { label: 'Download', href: '/invoices/7.pdf', external: true },
            ],
        })

        runToastAction(id, 0)
        expect(visits).toMatchObject([{ href: '/invoices/7/unsend', options: { method: 'post', data: { notify: false }, preserveScroll: true } }])

        visits[0]!.options.onFinish!.call(undefined)
        expect(byTitle('Invoice sent')?.pendingAction).toBeUndefined()

        runToastAction(id, 0)
        visits[1]!.options.onSuccess!.call(undefined)
        visits[1]!.options.onFinish!.call(undefined)
        expect(byTitle('Invoice sent')).toBeUndefined()

        const other = toast('Invoice ready', { action: { label: 'Download', href: '/invoices/7.pdf', external: true } })
        runToastAction(other, 0)
        expect(assign).toHaveBeenCalledWith('/invoices/7.pdf')
    })

    it("loads the View action of a notification's toast in the browser when it links to another origin, and visits other methods with Inertia", () => {
        assign.mockClear()
        listeners.onFlash!({
            inertiaui: {
                toasts: [
                    {
                        uuid: 'f-guide',
                        id: 'inertiaui-inbox-guide',
                        title: 'Guide published',
                        actions: [{ label: 'View', href: 'https://docs.other.test/guide' }],
                    },
                    {
                        uuid: 'f-api',
                        id: 'inertiaui-inbox-api',
                        title: 'API reference published',
                        actions: [{ label: 'View', href: 'https://docs.other.test/api' }],
                    },
                    {
                        uuid: 'f-sync',
                        id: 'sync',
                        title: 'Sync requested',
                        actions: [{ label: 'Confirm', href: 'https://api.other.test/sync', method: 'post' }],
                    },
                ],
            },
        })

        const view = click({ target: { closest: () => ({}) } as unknown as EventTarget })

        handleActionClick('inertiaui-inbox-guide', 0, view)
        runToastAction('inertiaui-inbox-api', 0)
        runToastAction('sync', 0)

        // The browser follows the clicked link itself, and loads the link of an action that runs without a click.
        expect(view.preventDefault).not.toHaveBeenCalled()
        expect(assign.mock.calls).toEqual([['https://docs.other.test/api']])
        expect(visits.map((visit) => [visit.href, visit.options.method])).toEqual([['https://api.other.test/sync', 'post']])
    })

    it("loads the link of an action to another origin without a result in the browser for a click on a button, such as a custom toast's", () => {
        assign.mockClear()
        const id = toast('Guide published', { action: { label: 'View', href: 'https://docs.other.test/guide' } })
        const button = click()

        handleActionClick(id, 0, button)

        expect(button.preventDefault).toHaveBeenCalled()
        expect(assign).toHaveBeenCalledWith('https://docs.other.test/guide')
    })

    it('loads an external action and opens a new tab for a click on a button, such as in a custom toast, and leaves clicks on links to the browser', () => {
        assign.mockClear()
        windowStub.open.mockClear()
        const id = toast('Invoice ready', {
            actions: [
                { label: 'Download', href: '/invoices/7.pdf', external: true, keepOpen: true },
                { label: 'Receipt', href: '/receipts/7.pdf', newTab: true, keepOpen: true },
            ],
        })
        const buttons = [click(), click()]

        handleActionClick(id, 0, buttons[0]!)
        handleActionClick(id, 1, buttons[1]!)

        expect(buttons.filter((event) => event.preventDefault.mock.calls.length > 0)).toHaveLength(2)
        expect(assign.mock.calls).toEqual([['/invoices/7.pdf']])
        expect(windowStub.open.mock.calls).toEqual([['/receipts/7.pdf', '_blank', 'noopener']])

        // The browser follows a click on the link of an action itself.
        const links = [linkClick(), linkClick()]

        handleActionClick(id, 0, links[0]!)
        handleActionClick(id, 1, links[1]!)

        expect(links.filter((event) => event.preventDefault.mock.calls.length > 0)).toEqual([])
        expect(assign).toHaveBeenCalledOnce()
        expect(windowStub.open).toHaveBeenCalledOnce()
        expect(visits).toEqual([])
    })

    it('leaves a toast that replaced the running one by its ID open', () => {
        const id = toast('Importing', { id: 'import-1', type: 'loading', action: { label: 'Cancel', href: '/imports/1/cancel', method: 'post' } })

        runToastAction(id, 0)
        // The endpoint flashes its confirmation with the same ID, which arrives before the visit finishes.
        toast('Import cancelled', { id: 'import-1', type: 'success' })
        visits[0]!.options.onSuccess!.call(undefined)
        visits[0]!.options.onFinish!.call(undefined)

        expect(byTitle('Import cancelled')).toBeDefined()
    })

    it('settles only the run that is still running on the toast', async () => {
        const resolvers: Array<() => void> = []
        const onClick = vi.fn(() => new Promise<void>((done) => resolvers.push(done)))
        const id = toast('Syncing', { id: 'sync-1', action: { label: 'Retry', onClick } })

        runToastAction(id, 0)
        toast('Sync failed', { id: 'sync-1', action: { label: 'Retry', onClick } })
        runToastAction(id, 0)
        toast.update(id, { description: 'Retrying' })

        resolvers[0]!()
        await Promise.resolve()
        expect(byTitle('Sync failed')?.pendingAction).toBe(0)

        resolvers[1]!()
        await Promise.resolve()
        expect(byTitle('Sync failed')).toBeUndefined()
    })

    describe("results of a notification toast's actions", () => {
        const approve = { label: 'Approve', href: '/expenses/9/approve', method: 'post' as const, result: 'Approved' }
        const completions = () => requests.filter((request) => request.endsWith('/complete'))
        const succeed = (index = 0) => {
            visits[index]!.options.onSuccess!.call(undefined)
            visits[index]!.options.onFinish!.call(undefined)
        }

        beforeEach(() => listeners.onNavigate!(inbox({ channel: 'App.Models.User.1', unread: 1 }), 'visit'))

        it('saves the result of an action whose toast closed before it succeeded', () => {
            const id = toast('Expense #9 needs approval', { id: 'inertiaui-inbox-expense', action: approve })

            runToastAction(id, 0)
            toast.dismiss(id)
            succeed()

            expect(completions()).toEqual(['post /inbox/expense/complete'])
        })

        it('saves the result of an action whose toast another one replaced, and leaves that toast open', () => {
            const id = toast('Expense #9 needs approval', { id: 'inertiaui-inbox-expense', action: approve })

            runToastAction(id, 0)
            toast('Approving expense #9', { id: 'inertiaui-inbox-expense', type: 'loading' })
            succeed()

            expect(completions()).toEqual(['post /inbox/expense/complete'])
            expect(byTitle('Approving expense #9')).toBeDefined()
        })

        it('saves the result of an earlier run that succeeded while a newer run is pending, and leaves the newer run running', () => {
            const id = toast('Expense #9 needs approval', { id: 'inertiaui-inbox-expense', action: approve })

            runToastAction(id, 0)
            toast('Expense #9 still needs approval', { id: 'inertiaui-inbox-expense', action: approve })
            runToastAction(id, 0)
            succeed(0)

            expect(completions()).toEqual(['post /inbox/expense/complete'])
            expect(byTitle('Expense #9 still needs approval')?.pendingAction).toBe(0)
        })

        it('visits an action with another method than GET with Inertia, also when it asks for the browser or a new tab, and saves its result once it succeeded', () => {
            assign.mockClear()
            windowStub.open.mockClear()
            const id = toast('Expense #9 needs approval', {
                id: 'inertiaui-inbox-expense',
                actions: [
                    { label: 'Reject', href: '/expenses/9/reject', method: 'delete', data: { reason: 'duplicate' }, newTab: true, result: 'Rejected' },
                    {
                        label: 'Approve',
                        href: '/expenses/9/approve',
                        method: 'patch',
                        data: { amount: 120, notify: false },
                        external: true,
                        result: 'Approved',
                    },
                ],
            })

            const visited = () => visits.map(({ href, options }) => [href, options.method, options.data])

            handleActionClick(id, 0, click())
            expect(visited()).toEqual([['/expenses/9/reject', 'delete', { reason: 'duplicate' }]])

            visits[0]!.options.onFinish!.call(undefined)
            handleActionClick(id, 1, click())
            expect(visited()[1]).toEqual(['/expenses/9/approve', 'patch', { amount: 120, notify: false }])
            expect(completions()).toEqual([])

            succeed(1)

            expect(completions()).toEqual(['post /inbox/expense/complete'])
            expect(windowStub.open).not.toHaveBeenCalled()
            expect(assign).not.toHaveBeenCalled()
        })

        it('saves no result when the visit failed, for a toast of no notification, or for an action without one', () => {
            const id = toast('Expense #9 needs approval', { id: 'inertiaui-inbox-expense', action: approve })
            const plain = toast('Approve expense #9?', { action: approve })
            const other = toast('Expense #10 needs approval', {
                id: 'inertiaui-inbox-other',
                action: { label: 'Remind', href: '/expenses/10/remind', method: 'post' },
            })

            runToastAction(id, 0)
            visits[0]!.options.onFinish!.call(undefined)
            runToastAction(plain, 0)
            succeed(1)
            runToastAction(other, 0)
            succeed(2)

            expect(completions()).toEqual([])
        })

        it('saves the result of a link that the browser follows, such as one that opens a new tab or another site', () => {
            const cmd = toast('Expense #9 needs review', { id: 'inertiaui-inbox-cmd', action: { label: 'Review', href: '/expenses/9', result: 'Reviewed' } })
            const ctrl = toast('Expense #10 needs review', {
                id: 'inertiaui-inbox-ctrl',
                action: { label: 'Review', href: '/expenses/10', result: 'Reviewed' },
            })
            const tab = toast('Receipt ready', {
                id: 'inertiaui-inbox-tab',
                action: { label: 'Open', href: '/receipts/9.pdf', newTab: true, result: 'Opened' },
            })
            const site = toast('Invoice due', {
                id: 'inertiaui-inbox-site',
                action: { label: 'Pay', href: 'https://billing.test/invoices/9', external: true, result: 'Paid' },
            })
            const clicks = [linkClick({ metaKey: true }), linkClick({ ctrlKey: true }), linkClick()]

            handleActionClick(cmd, 0, clicks[0]!)
            handleActionClick(ctrl, 0, clicks[1]!)
            handleActionClick(tab, 0, clicks[2]!)
            handleActionClick(site, 0, linkClick())

            expect(completions()).toEqual(['post /inbox/cmd/complete', 'post /inbox/ctrl/complete', 'post /inbox/tab/complete', 'post /inbox/site/complete'])
            expect(clicks.filter((event) => event.preventDefault.mock.calls.length > 0)).toEqual([])
            expect(visits).toEqual([])
        })

        it('saves no result of a link that the browser follows for a toast of no notification or an action without one', () => {
            assign.mockClear()
            const plain = toast('Invoice due', { action: { label: 'Pay', href: 'https://billing.test/invoices/9', external: true, result: 'Paid' } })
            const other = toast('Receipt ready', { id: 'inertiaui-inbox-tab', action: { label: 'Open', href: '/receipts/9.pdf', newTab: true } })
            const clicks = [linkClick(), linkClick({ metaKey: true }), linkClick()]

            handleActionClick(plain, 0, clicks[0]!)
            handleActionClick(other, 0, clicks[1]!)
            handleActionClick(other, 0, clicks[2]!)

            expect(completions()).toEqual([])
            expect(clicks.filter((event) => event.preventDefault.mock.calls.length > 0)).toEqual([])
            expect(assign).not.toHaveBeenCalled()
        })

        it('follows a link to another site in the same tab once its result saved, also when saving failed', async () => {
            assign.mockClear()
            const id = toast('Invoice due', {
                id: 'inertiaui-inbox-invoice',
                action: { label: 'Pay', href: 'https://billing.test/invoices/9', external: true, result: 'Paid' },
            })
            const plain = linkClick()

            handleActionClick(id, 0, plain)
            await flush()

            expect(plain.preventDefault).toHaveBeenCalled()
            expect(completions()).toEqual(['post /inbox/invoice/complete'])
            expect(assign).not.toHaveBeenCalled()

            answer('post /inbox/invoice/complete').reject(new Error('offline'))
            await flush()

            expect(assign).toHaveBeenCalledWith('https://billing.test/invoices/9')
        })

        it('follows a link to another site in the same tab after a second and a half when saving its result does not finish', async () => {
            assign.mockClear()
            const id = toast('Invoice due', {
                id: 'inertiaui-inbox-slow',
                action: { label: 'Pay', href: 'https://billing.test/invoices/9', external: true, result: 'Paid' },
            })

            handleActionClick(id, 0, linkClick())
            await flush()
            vi.advanceTimersByTime(1499)

            expect(assign).not.toHaveBeenCalled()

            vi.advanceTimersByTime(1)

            expect(assign).toHaveBeenCalledWith('https://billing.test/invoices/9')

            answer('post /inbox/slow/complete').reject(new Error('offline'))
            await flush()

            expect(assign).toHaveBeenCalledTimes(1)
        })

        it('follows a link to another origin without external() in the same tab once its result saved', async () => {
            assign.mockClear()
            const id = toast('Invoice due', {
                id: 'inertiaui-inbox-billing',
                action: { label: 'Pay', href: 'https://billing.test/invoices/9', result: 'Paid' },
            })
            const plain = linkClick()

            handleActionClick(id, 0, plain)
            await flush()

            expect(plain.preventDefault).toHaveBeenCalled()
            expect(completions()).toEqual(['post /inbox/billing/complete'])
            expect(assign).not.toHaveBeenCalled()
            expect(visits).toEqual([])

            answer('post /inbox/billing/complete').resolve({})
            await flush()

            expect(assign).toHaveBeenCalledWith('https://billing.test/invoices/9')
        })

        it('saves the result of an action that loads in this tab before the browser leaves, also when it runs without a click', async () => {
            assign.mockClear()
            const id = toast('Receipt ready', {
                id: 'inertiaui-inbox-download',
                action: { label: 'Download', href: '/receipts/9.pdf', external: true, result: 'Downloaded' },
            })

            runToastAction(id, 0)
            await flush()

            expect(completions()).toEqual(['post /inbox/download/complete'])
            expect(assign).not.toHaveBeenCalled()

            answer('post /inbox/download/complete').resolve({})
            await flush()

            expect(assign).toHaveBeenCalledExactlyOnceWith('/receipts/9.pdf')
        })

        it('loads a link to another origin after a second and a half when saving its result does not finish, also when it runs without a click', async () => {
            assign.mockClear()
            const id = toast('Invoice due', { id: 'inertiaui-inbox-late', action: { label: 'Pay', href: 'https://billing.test/invoices/9', result: 'Paid' } })

            runToastAction(id, 0)
            await flush()
            vi.advanceTimersByTime(1499)

            expect(completions()).toEqual(['post /inbox/late/complete'])
            expect(assign).not.toHaveBeenCalled()

            vi.advanceTimersByTime(1)

            expect(assign).toHaveBeenCalledExactlyOnceWith('https://billing.test/invoices/9')
        })

        it('opens the new tab of an action at once and saves its result without waiting, also for a click on a button', () => {
            windowStub.open.mockClear()
            const id = toast('Receipt ready', {
                id: 'inertiaui-inbox-receipt',
                action: { label: 'Open', href: '/receipts/9.pdf', newTab: true, result: 'Opened' },
            })
            const other = toast('Report ready', {
                id: 'inertiaui-inbox-report',
                action: { label: 'Open', href: '/reports/9.pdf', newTab: true, result: 'Opened' },
            })
            const button = click()

            runToastAction(id, 0)
            handleActionClick(other, 0, button)

            expect(windowStub.open.mock.calls).toEqual([
                ['/receipts/9.pdf', '_blank', 'noopener'],
                ['/reports/9.pdf', '_blank', 'noopener'],
            ])
            expect(button.preventDefault).toHaveBeenCalled()
            expect(completions()).toEqual(['post /inbox/receipt/complete', 'post /inbox/report/complete'])
        })

        it('visits a link to the application with Inertia, and saves its result once the visit succeeded', () => {
            assign.mockClear()
            const id = toast('Expense #9 needs review', { id: 'inertiaui-inbox-review', action: { label: 'Review', href: '/expenses/9', result: 'Reviewed' } })
            const plain = click()

            handleActionClick(id, 0, plain)

            expect(plain.preventDefault).toHaveBeenCalled()
            expect(visits.map((visit) => [visit.href, visit.options.method])).toEqual([['/expenses/9', 'get']])
            expect(completions()).toEqual([])

            succeed()

            expect(completions()).toEqual(['post /inbox/review/complete'])
            expect(assign).not.toHaveBeenCalled()
        })

        it('saves no result once another user signed in, also when the first user signed in again', () => {
            listeners.onNavigate!(inbox({ user: 'A' }), 'visit')
            const id = toast('Expense #9 needs approval', { id: 'inertiaui-inbox-expense', action: approve })

            runToastAction(id, 0)
            listeners.onNavigate!(inbox({ user: 'B' }), 'visit')
            listeners.onNavigate!(inbox({ user: 'A' }), 'visit')
            succeed()

            expect(completions()).toEqual([])
        })
    })

    it('leaves link clicks with a modifier key to the browser', () => {
        const id = toast('Invoice sent', { action: { label: 'View', href: '/invoices/7' } })
        const modified = linkClick({ metaKey: true })
        const plain = linkClick()

        handleActionClick(id, 0, modified)
        expect(modified.preventDefault).not.toHaveBeenCalled()
        expect(visits).toEqual([])

        handleActionClick(id, 0, plain)
        expect(plain.preventDefault).toHaveBeenCalled()
        expect(visits).toMatchObject([{ href: '/invoices/7', options: { method: 'get' } }])
    })

    it('never runs a javascript: URL', () => {
        const id = toast('Hacked', { action: { label: 'Run', href: 'javascript:alert(1)' } })

        runToastAction(id, 0)

        expect(visits).toEqual([])
        expect(assign).not.toHaveBeenCalledWith('javascript:alert(1)')
    })
})

describe('toast.fromHeaders', () => {
    it('shows toasts from a fetch response', () => {
        toast.fromHeaders(new Headers({ 'X-InertiaUI-Toasts': '[{"uuid":"fetch","title":"Copied"}]' }))

        expect(byTitle('Copied')).toBeDefined()
    })
})

describe('preferences', () => {
    it('loads the preferences of the next user who signs in for a component that stayed on the page', () => {
        listeners.onNavigate!(inbox({ user: 'A' }), 'visit')
        const unsubscribe = preferencesStore.subscribe(() => {})
        void preferencesStore.load('/inbox')

        listeners.onNavigate!({ inertiauiInbox: null }, 'visit')
        requests.length = 0
        listeners.onNavigate!(inbox({ user: 'B' }), 'visit')

        expect(requests).toContain('get /inbox/preferences')
        unsubscribe()
    })
})
