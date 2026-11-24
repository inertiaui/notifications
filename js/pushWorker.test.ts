import { readFileSync } from 'node:fs'

import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import wire from '../tests/Fixtures/push.json'
import { SHOWN_MESSAGE, VISIT_MESSAGE } from './push'

const source = readFileSync(new URL('../resources/push/worker.js', import.meta.url), 'utf8')

/** A window of the application, as `clients.matchAll()` returns it. */
interface FakeClient {
    focused: boolean
    visibilityState: DocumentVisibilityState
    focus: ReturnType<typeof vi.fn>
    postMessage: ReturnType<typeof vi.fn>
}

/** A window whose page runs the package, so it answers the visit message, unless `answers` is false. */
const appWindow = (focused = false, answers = true): FakeClient => ({
    focused,
    visibilityState: focused ? 'visible' : 'hidden',
    focus: vi.fn(async () => {}),
    postMessage: vi.fn((message: { type: string }, ports: MessagePort[] = []) => {
        if (answers && message.type === VISIT_MESSAGE) {
            ports[0].postMessage(true)
            ports[0].close()
        }
    }),
})

/** Loads the worker into a fake `self`, with the given windows of the application. */
function worker(windows: FakeClient[] = []) {
    const handlers = new Map<string, (event: unknown) => void>()
    const self = {
        location: new URL('https://app.test/_inertia-notifications/push/worker.js?v=2f1c'),
        addEventListener: (type: string, handler: (event: unknown) => void) => handlers.set(type, handler),
        skipWaiting: vi.fn(async () => {}),
        registration: { showNotification: vi.fn(async (_title: string, _options: NotificationOptions) => {}) },
        clients: {
            claim: vi.fn(async () => {}),
            matchAll: vi.fn(async (_options: unknown) => windows),
            openWindow: vi.fn(async (_url: string) => null),
        },
    }

    new Function('self', source)(self)

    /** Dispatches an event, and waits for the promises that the worker passed to `waitUntil()`. */
    const dispatch = async (type: string, fields: Record<string, unknown> = {}) => {
        const pending: Promise<unknown>[] = []

        handlers.get(type)?.({ waitUntil: (promise: Promise<unknown>) => pending.push(promise), ...fields })
        await Promise.all(pending)
    }

    return { self, handlers, dispatch }
}

/** The data of a push, as the browser passes it to the worker. */
const pushData = (body: string) => ({
    text: () => body,
    json: () => JSON.parse(body),
})

afterEach(() => {
    vi.useRealTimers()
})

describe('the service worker', () => {
    it('takes over at once', async () => {
        const { self, dispatch } = worker()

        await dispatch('install')
        await dispatch('activate')

        expect(self.skipWaiting).toHaveBeenCalled()
        expect(self.clients.claim).toHaveBeenCalled()
    })

    it('shows each push, with the page to open and the context of its notification in its data', async () => {
        const { self, dispatch } = worker([appWindow(false)])

        await dispatch('push', { data: pushData(JSON.stringify(wire)) })

        expect(self.clients.matchAll).toHaveBeenCalledWith({ type: 'window', includeUncontrolled: true })
        expect(self.registration.showNotification).toHaveBeenCalledWith('Invoice INV-7 paid', {
            body: 'Paid by card.',
            icon: 'https://acme.test/avatars/sophie.png',
            tag: 'inertiaui-inbox-9d3c1b6e-0b7a-4c1e-9a64-5f0d2a8e1c47',
            timestamp: 1794938400000,
            lang: 'en',
            dir: 'auto',
            silent: false,
            data: {
                navigate: 'https://acme.test/_inertia-notifications/9d3c1b6e-0b7a-4c1e-9a64-5f0d2a8e1c47/open',
                id: '9d3c1b6e-0b7a-4c1e-9a64-5f0d2a8e1c47',
                context: '5e2800deb8d23927533bbbae89e7b58b',
            },
        })
    })

    it('tells every window of the application the tag of a push once it shows', async () => {
        const windows = [appWindow(false), appWindow(true)]
        const { self, dispatch } = worker(windows)
        let shown!: () => void
        self.registration.showNotification.mockImplementation(() => new Promise<void>((resolve) => (shown = resolve)))

        const pushed = dispatch('push', { data: pushData(JSON.stringify(wire)) })
        await vi.waitFor(() => expect(self.registration.showNotification).toHaveBeenCalled())
        expect(windows[0].postMessage).not.toHaveBeenCalled()

        shown()
        await pushed

        windows.forEach((window) => expect(window.postMessage).toHaveBeenCalledWith({ type: SHOWN_MESSAGE, tag: wire.notification.tag }))
    })

    it('shows a push silently while the user looks at a window of the application', async () => {
        const { self, dispatch } = worker([appWindow(false), appWindow(true)])

        await dispatch('push', { data: pushData(JSON.stringify(wire)) })

        expect(self.registration.showNotification).toHaveBeenCalledWith('Invoice INV-7 paid', expect.objectContaining({ silent: true }))
    })

    it('shows a push without an icon, as text, and without data', async () => {
        const { self, dispatch } = worker()
        const { icon: _icon, ...notification } = wire.notification

        await dispatch('push', { data: pushData(JSON.stringify({ ...wire, notification })) })
        await dispatch('push', { data: pushData('Your export is ready.') })
        await dispatch('push', { data: null })

        const calls = self.registration.showNotification.mock.calls
        expect(calls).toHaveLength(3)
        expect(calls[0][1].icon).toBeUndefined()
        expect(calls[1]).toEqual(['app.test', expect.objectContaining({ body: 'Your export is ready.', silent: false })])
        expect(calls[2][0]).toBe('app.test')
    })

    it('asks a window of the application to open the page of a clicked push', async () => {
        const hidden = appWindow(false)
        const focused = appWindow(true)
        const { self, dispatch } = worker([hidden, focused])
        const notification = { close: vi.fn(), data: { navigate: wire.notification.navigate, id: wire.notification.data.id } }

        await dispatch('notificationclick', { notification })

        expect(notification.close).toHaveBeenCalled()
        expect(focused.focus).toHaveBeenCalled()
        expect(focused.postMessage).toHaveBeenCalledWith({ type: VISIT_MESSAGE, url: wire.notification.navigate }, [expect.any(MessagePort)])
        expect(hidden.postMessage).not.toHaveBeenCalled()
        expect(self.clients.openWindow).not.toHaveBeenCalled()
    })

    it('opens a window when the application has none', async () => {
        const { self, dispatch } = worker([])
        const notification = { close: vi.fn(), data: { navigate: wire.notification.navigate } }

        await dispatch('notificationclick', { notification })

        expect(notification.close).toHaveBeenCalled()
        expect(self.clients.openWindow).toHaveBeenCalledWith(wire.notification.navigate)
    })

    it('opens a window when the page of the window does not answer', async () => {
        vi.useFakeTimers()
        const silent = appWindow(false, false)
        const { self, dispatch } = worker([silent])

        const clicked = dispatch('notificationclick', { notification: { close: vi.fn(), data: { navigate: wire.notification.navigate } } })
        await vi.advanceTimersByTimeAsync(1000)
        await clicked

        expect(silent.postMessage).toHaveBeenCalled()
        expect(self.clients.openWindow).toHaveBeenCalledWith(wire.notification.navigate)
    })

    it('leaves a changed subscription to the next page, which can send the CSRF token', () => {
        const { handlers } = worker()

        expect(handlers.has('pushsubscriptionchange')).toBe(false)
        expect(source).not.toMatch(/\bfetch\(/)
    })
})
