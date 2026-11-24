import { describe, expect, it, vi } from 'vite-plus/test'

import type { InertiaBindings } from './inertia'
import type { EchoLike } from './realtime'

// initNotifications() only runs in a browser, so these tests run against a minimal window and a device that shows pushes.
const page = Object.assign(new EventTarget(), { visibilityState: 'visible' as DocumentVisibilityState })
vi.stubGlobal('document', page)
vi.stubGlobal(
    'window',
    Object.assign(new EventTarget(), {
        isSecureContext: true,
        location: { href: 'https://app.test/dashboard', origin: 'https://app.test' },
        matchMedia: () => ({ matches: false }),
        PushManager: class {},
    }),
)

/** A push that the service worker shows on this device. */
class ShownNotification {
    closed = false

    constructor(public tag: string) {}

    close() {
        this.closed = true
    }
}

const SCOPE = 'https://app.test/_inertia-notifications/push/'
const shown: ShownNotification[] = []
const registration = {
    scope: SCOPE,
    active: { scriptURL: `${SCOPE}worker.js?v=1` },
    pushManager: { getSubscription: async () => null, subscribe: async () => null },
    getNotifications: async ({ tag }: { tag?: string } = {}) => shown.filter((notification) => !notification.closed && notification.tag === tag),
}
const serviceWorker = Object.assign(new EventTarget(), { getRegistration: async () => registration, startMessages: () => {} })
vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0', maxTouchPoints: 0, serviceWorker })
vi.stubGlobal(
    'Notification',
    class {
        static permission = 'default'
    },
)

const { SHOWN_MESSAGE } = await import('./push')
const { ARRIVED_EVENT } = await import('./realtime')
const { initNotifications, toastStore } = await import('./toast')

const listeners = new Map<string, (payload: unknown) => void>()
const echo: EchoLike = {
    private: (channel) => ({
        listen: (event, callback) => listeners.set(`${channel}${event}`, callback),
        stopListening: () => {},
    }),
    socketId: () => null,
}

let navigate: Parameters<InertiaBindings['onNavigate']>[0] = () => {}
const bindings: InertiaBindings = {
    onFlash: () => {},
    onRequest: () => {},
    onResponse: () => {},
    onError: () => {},
    onHttpException: () => {},
    onNavigate: (listener) => void (navigate = listener),
    visit: () => {},
    request: () => new Promise(() => {}),
    useSocketId: () => {},
}

initNotifications(bindings, { inbox: { echo, arrivalToasts: 'all' } })
navigate(
    {
        inertiauiInbox: {
            url: '/inbox',
            user: 'user-1',
            channel: 'App.Models.User.1',
            push: { publicKey: 'BKey', worker: '/_inertia-notifications/push/worker.js?v=1', subscribed: true },
            unread: 0,
            unseen: 0,
            categories: [],
            latest: null,
            latestIds: [],
            revision: 1,
        },
    },
    'initial',
)

/** A notification that arrives with Echo. */
const broadcast = (id: string) =>
    listeners.get(`App.Models.User.1${ARRIVED_EVENT}`)!({
        item: { id, title: `Invoice ${id} paid`, createdAt: '2026-11-18T10:00:00Z' },
    })

/** A notification that arrives with Echo, while its push shows on this device. */
const arrive = (id: string) => {
    const push = new ShownNotification(`inertiaui-inbox-${id}`)
    shown.push(push)
    broadcast(id)

    return push
}

/** The service worker shows the push of a notification after its toast, and tells the page. */
const showPush = (id: string) => {
    const push = new ShownNotification(`inertiaui-inbox-${id}`)
    shown.push(push)
    serviceWorker.dispatchEvent(new MessageEvent('message', { data: { type: SHOWN_MESSAGE, tag: push.tag } }))

    return push
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('the pushes of arrivals', () => {
    it('closes the push of a notification whose toast the user sees', async () => {
        const push = arrive('n1')
        await settle()

        expect(push.closed).toBe(true)
    })

    it('closes the push that shows after the toast of its notification', async () => {
        broadcast('n3')
        await settle()
        const push = showPush('n3')
        await settle()

        expect(push.closed).toBe(true)
    })

    it('keeps the push that shows after the user closed the toast of its notification', async () => {
        broadcast('n4')
        toastStore.dismiss('inertiaui-inbox-n4')
        await settle()
        const push = showPush('n4')
        await settle()

        expect(push.closed).toBe(false)
    })

    it('keeps the push of a notification that arrives in a hidden tab', async () => {
        page.visibilityState = 'hidden'
        const push = arrive('n2')
        await settle()
        page.visibilityState = 'visible'

        expect(push.closed).toBe(false)
    })
})
