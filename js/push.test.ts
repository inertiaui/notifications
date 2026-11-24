import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import type { InboxChange } from './inbox'
import type { InertiaBindings } from './inertia'
import { preferencesLabels } from './preferences'
import {
    VISIT_MESSAGE,
    base64UrlBytes,
    createPushStore,
    otherPushDevices,
    parsePushSettings,
    pushDeviceState,
    pushDeviceView,
    type PushDevice,
    type PushState,
    type PushStore,
} from './push'

const encode = (bytes: number[]): string =>
    btoa(String.fromCharCode(...bytes))
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replace(/=+$/, '')

/** The application's public VAPID key, and the key it had before it rotated them. */
const KEY = encode(Array.from({ length: 65 }, (_, index) => (index * 7 + 4) % 256))
const PREVIOUS_KEY = encode(Array.from({ length: 65 }, (_, index) => (index * 11 + 4) % 256))

const WORKER = '/_inertia-notifications/push/worker.js?v=2f1c'
const SCRIPT = `https://app.test${WORKER}`
const SCOPE = 'https://app.test/_inertia-notifications/push/'

const DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15'

/** The `push` key of the shared prop. */
const settings = (subscribed = false, publicKey = KEY) => ({ publicKey, worker: WORKER, subscribed })

/** Lets the store's requests and the browser's promises settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

let endpoints = 0

class FakeSubscription {
    endpoint = `https://fcm.googleapis.com/fcm/send/device-${++endpoints}`
    options: { userVisibleOnly: boolean; applicationServerKey: ArrayBuffer }
    unsubscribe = vi.fn(async () => {
        if (this.registration.subscription === this) {
            this.registration.subscription = null
        }

        return true
    })

    constructor(
        private registration: FakeRegistration,
        key: Uint8Array,
    ) {
        this.options = { userVisibleOnly: true, applicationServerKey: new Uint8Array(key).buffer }
    }

    toJSON() {
        return { endpoint: this.endpoint, expirationTime: null, keys: { p256dh: 'BPublicKeyOfTheBrowser', auth: 'AuthSecret' } }
    }
}

/** A notification that the service worker shows. */
class ShownNotification {
    closed = false

    constructor(
        public tag: string,
        public timestamp?: number,
        public data?: { id?: string; context?: string },
    ) {}

    close() {
        this.closed = true
    }
}

class FakeRegistration {
    active: { scriptURL: string } | null = null
    installing = null
    waiting = null
    subscription: FakeSubscription | null = null
    shown: ShownNotification[] = []
    subscribeError: unknown
    pushManager = {
        getSubscription: vi.fn(async () => this.subscription),
        subscribe: vi.fn(async (options: { userVisibleOnly: boolean; applicationServerKey: Uint8Array }) => {
            if (this.subscribeError) {
                throw this.subscribeError
            }

            this.subscription = new FakeSubscription(this, options.applicationServerKey)

            return this.subscription
        }),
    }
    getNotifications = vi.fn(async (filter: { tag?: string } = {}) =>
        this.shown.filter((notification) => !notification.closed && (filter.tag === undefined || notification.tag === filter.tag)),
    )

    constructor(public scope: string) {}

    /** Subscribes the registration, as if the user turned push on before this page. */
    subscribed(key = KEY) {
        this.subscription = new FakeSubscription(this, base64UrlBytes(key))

        return this.subscription
    }
}

interface BrowserOptions {
    secure?: boolean
    serviceWorker?: boolean
    pushManager?: boolean
    notification?: boolean
    permission?: NotificationPermission
    /** What the user answers to the permission prompt. */
    prompt?: NotificationPermission
    userAgent?: string
    maxTouchPoints?: number
    /** Opened from the Home Screen, as `display-mode: standalone` tells. */
    standalone?: boolean
    brave?: boolean
}

/** A browser with service workers, the Push API, and notifications, as far as the options leave them in. */
function browser(options: BrowserOptions = {}) {
    const registrations = new Map<string, FakeRegistration>()
    const container = Object.assign(new EventTarget(), {
        register: vi.fn(async (script: string, { scope }: { scope: string }) => {
            const registration = registrations.get(scope) ?? new FakeRegistration(scope)
            registration.active = { scriptURL: script }
            registrations.set(scope, registration)

            return registration
        }),
        // Like a browser, the registration with the longest scope that the URL starts with, such as the application's own.
        getRegistration: vi.fn(
            async (url: string) => [...registrations.values()].filter(({ scope }) => url.startsWith(scope)).sort((a, b) => b.scope.length - a.scope.length)[0],
        ),
        startMessages: vi.fn(),
    })

    class Permission {
        static permission: NotificationPermission = options.permission ?? 'default'
        static requestPermission = vi.fn(async () => (Permission.permission = options.prompt ?? 'granted'))
    }

    const assign = vi.fn()
    const page = Object.assign(new EventTarget(), { visibilityState: 'visible' as DocumentVisibilityState })

    vi.stubGlobal('window', {
        isSecureContext: options.secure ?? true,
        location: { href: 'https://app.test/settings/notifications', origin: 'https://app.test', assign },
        matchMedia: (query: string) => ({ matches: query === '(display-mode: standalone)' && options.standalone === true }),
        ...(options.pushManager === false ? {} : { PushManager: class {} }),
    })
    vi.stubGlobal('navigator', {
        userAgent: options.userAgent ?? DESKTOP,
        maxTouchPoints: options.maxTouchPoints ?? 0,
        ...(options.serviceWorker === false ? {} : { serviceWorker: container }),
        ...(options.brave ? { brave: { isBrave: async () => true } } : {}),
    })
    vi.stubGlobal('Notification', options.notification === false ? undefined : Permission)
    vi.stubGlobal('document', page)

    /** A registration of the package's service worker from an earlier page, or of another scope, such as the application's own. */
    const installed = (scope = SCOPE, script = SCRIPT) => {
        const registration = new FakeRegistration(scope)
        registration.active = { scriptURL: script }
        registrations.set(scope, registration)

        return registration
    }

    return { container, registrations, Notification: Permission, assign, page, installed, registration: () => registrations.get(SCOPE) }
}

/** The parts of the inbox store that web push follows, with the shared prop of the page that shows. */
function fakeInbox(push: unknown, user: string | undefined) {
    let state: { url: string | undefined; user: string | undefined } = { url: '/inbox', user }
    let current = push
    let context: string | null = null
    const listeners = new Set<() => void>()
    const changes = new Set<(change: InboxChange) => void>()
    const saves = new Set<(saved: { change: InboxChange; counts: unknown }) => void>()
    const add =
        <T>(set: Set<T>) =>
        (listener: T) => {
            set.add(listener)

            return () => void set.delete(listener)
        }

    return {
        subscribe: add(listeners),
        getSnapshot: () => state,
        pushSettings: () => current,
        context: () => context,
        onChange: add(changes),
        onSaved: add(saves),
        /** Shows a page whose shared prop has the given `push`, for the given user. */
        show(next: unknown, nextUser = state.user) {
            current = next
            state = { url: '/inbox', user: nextUser }
            listeners.forEach((listener) => listener())
        },
        /** Shows a page of the given context, such as the user's team. */
        enter(next: string | null) {
            context = next
        },
        signOut() {
            current = null
            state = { url: undefined, user: undefined }
            listeners.forEach((listener) => listener())
        },
        /** A change from another session or tab. */
        change: (change: InboxChange) => changes.forEach((listener) => listener(change)),
        /** A change of this tab that the server saved. */
        saved: (change: InboxChange) => saves.forEach((listener) => listener({ change, counts: null })),
    }
}

interface Request {
    url: string
    data?: Record<string, unknown>
}

/** A push store on a page with the given `push` in its shared prop. Requests answer like the package's routes, unless `answer` says otherwise. */
function setup(push: unknown = settings(), answer?: (request: Request) => unknown) {
    const requests: Request[] = []
    const visits: string[] = []
    const bindings = {
        request: vi.fn(async (_method: string, url: string, data?: Record<string, unknown>) => {
            const request = { url, data }
            requests.push(request)

            if (answer) {
                return answer(request)
            }

            return { subscribed: url.endsWith('/push/subscribe') }
        }),
        visit: vi.fn((href: string) => void visits.push(href)),
    } as unknown as InertiaBindings
    const inbox = fakeInbox(push, 'user-1')
    const store = createPushStore()
    const failures: unknown[] = []

    store.connect(bindings, inbox, undefined, (error) => failures.push(error))

    return { store, inbox, requests, visits, bindings, failures, state: (): PushState => store.getSnapshot() }
}

const fails = () => {
    throw new Error('Server Error')
}

const subscribeRequests = (requests: Request[]) => requests.filter(({ url }) => url === '/inbox/push/subscribe')

/** Clicks the button of the device control, which runs its action, as the component does. */
const press = (store: PushStore): Promise<void> => (pushDeviceView(store.getSnapshot())?.button?.action === 'subscribe' ? store.enable() : store.disable())

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('parsePushSettings', () => {
    it('reads the push key of the shared prop, and nothing while push is off', () => {
        expect(parsePushSettings({ publicKey: KEY, worker: WORKER, subscribed: true })).toEqual({ publicKey: KEY, worker: WORKER, subscribed: true })
        expect(parsePushSettings({ publicKey: KEY, worker: WORKER })).toEqual({ publicKey: KEY, worker: WORKER, subscribed: false })
        expect(parsePushSettings(null)).toBeNull()
        expect(parsePushSettings({ publicKey: '', worker: WORKER })).toBeNull()
        expect(parsePushSettings({ publicKey: KEY })).toBeNull()
    })

    it('decodes the base64url key', () => {
        expect([...base64UrlBytes('-_8')]).toEqual([251, 255])
        expect(base64UrlBytes(KEY)).toHaveLength(65)
    })
})

describe('the state of push on this device', () => {
    it('hides while the application sends no pushes', () => {
        browser({ permission: 'granted' })
        const { state } = setup(null)

        expect(state()).toMatchObject({ available: false, supported: true, subscribed: false, reason: null })
        expect(pushDeviceView(state())).toBeNull()
    })

    it('is off until the user turns it on', () => {
        browser()
        const { state } = setup()

        expect(state()).toEqual({
            available: true,
            supported: true,
            permission: 'default',
            subscribed: false,
            busy: false,
            reason: null,
            request: null,
            devices: null,
        })
        expect(pushDeviceView(state())).toEqual({
            state: 'off',
            text: 'pushOff',
            hint: false,
            button: { label: 'pushTurnOn', action: 'subscribe', primary: true },
        })
    })

    it('is on while the server stores the subscription of this device', async () => {
        browser({ permission: 'granted' }).installed().subscribed()
        const { state } = setup(settings(true))
        await settle()

        expect(state()).toMatchObject({ subscribed: true, reason: null })
        expect(pushDeviceView(state())).toEqual({
            state: 'on',
            text: 'pushOn',
            hint: false,
            button: { label: 'pushTurnOff', action: 'unsubscribe', primary: false },
        })
    })

    it('tells that push needs a secure connection', () => {
        browser({ secure: false, serviceWorker: false, pushManager: false })
        const { state } = setup()

        expect(state()).toMatchObject({ supported: false, reason: 'insecure' })
        expect(pushDeviceView(state())).toEqual({ state: 'insecure', text: 'pushInsecure', hint: true, button: null })
    })

    it('hides in a browser without web push', () => {
        browser({ pushManager: false })
        expect(pushDeviceState(setup().state())).toBeNull()

        browser({ serviceWorker: false })
        expect(setup().state().reason).toBe('unsupported')

        browser({ notification: false })
        expect(setup().state().reason).toBe('unsupported')

        // Safari before 16 on a Mac, which a touch screen does not make an iPad.
        browser({ userAgent: IPAD, pushManager: false, notification: false })
        expect(setup().state().reason).toBe('unsupported')
    })

    it('asks iPhone and iPad users to open the site from the Home Screen', () => {
        browser({ userAgent: IPHONE, pushManager: false, notification: false })
        expect(pushDeviceView(setup().state())).toEqual({ state: 'home-screen', text: 'pushHomeScreen', hint: true, button: null })

        // An iPad asks for desktop pages, so only its touch screen tells it from a Mac.
        browser({ userAgent: IPAD, maxTouchPoints: 5, pushManager: false, notification: false })
        expect(setup().state().reason).toBe('home-screen')

        // Opened from the Home Screen, on an iOS version with web push.
        browser({ userAgent: IPHONE, standalone: true })
        expect(setup().state()).toMatchObject({ supported: true, reason: null })

        // Opened from the Home Screen, on an iOS version without web push.
        browser({ userAgent: IPHONE, standalone: true, pushManager: false, notification: false })
        expect(setup().state().reason).toBe('unsupported')
    })

    it('tells how to allow notifications that the user blocked, also for a device that the server knows', () => {
        browser({ permission: 'denied' })
        const { state } = setup(settings(true))

        expect(state()).toMatchObject({ permission: 'denied', subscribed: false, reason: 'blocked' })
        expect(pushDeviceView(state())).toEqual({ state: 'blocked', text: 'pushBlocked', hint: true, button: null })
    })

    it('follows the permission that the user changes in the site settings', () => {
        const fake = browser({ permission: 'denied' })
        const { state } = setup()

        fake.Notification.permission = 'default'
        fake.page.dispatchEvent(new Event('visibilitychange'))

        expect(state()).toMatchObject({ permission: 'default', reason: null })
    })

    it('tells Brave users to turn on Google services for push messaging', async () => {
        const fake = browser({ brave: true })
        const { store, state } = setup()

        fake.installed().subscribeError = new DOMException('Registration failed - push service error', 'AbortError')
        await store.enable()

        expect(state()).toMatchObject({ subscribed: false, busy: false, reason: 'brave' })
        expect(pushDeviceView(state())).toEqual({
            state: 'brave',
            text: 'pushBrave',
            hint: true,
            button: { label: 'pushRetry', action: 'subscribe', primary: false },
        })
    })

    it('shows a request that failed, with a button that tries again', async () => {
        browser()
        let failing = true
        const { store, state } = setup(settings(), (request) => (failing ? fails() : { subscribed: request.url.endsWith('/subscribe') }))

        await store.enable()

        expect(pushDeviceView(state())).toEqual({
            state: 'failed',
            text: 'pushFailed',
            hint: true,
            button: { label: 'pushRetry', action: 'subscribe', primary: false },
        })

        failing = false
        await store.enable()

        expect(state()).toMatchObject({ subscribed: true, reason: null })
    })

    it('shows a device that the server knows as off when turning push on fails, before the user allowed notifications', async () => {
        const fake = browser()
        let failing = true
        const { store, requests, state } = setup(settings(true), (request) => (failing ? fails() : { subscribed: request.url.endsWith('/subscribe') }))

        expect(pushDeviceView(state())).toMatchObject({ state: 'off', button: { action: 'subscribe' } })

        await store.enable()

        expect(state()).toMatchObject({ permission: 'granted', subscribed: false, busy: false, reason: 'failed' })
        expect(pushDeviceView(state())).toEqual({
            state: 'failed',
            text: 'pushFailed',
            hint: true,
            button: { label: 'pushRetry', action: 'subscribe', primary: false },
        })

        failing = false
        await press(store)

        expect(requests.map(({ url }) => url)).toEqual(['/inbox/push/subscribe', '/inbox/push/subscribe'])
        expect(fake.registration()!.subscription).not.toBeNull()
        expect(state()).toMatchObject({ subscribed: true, reason: null })
    })

    it('is busy while push turns on, and ignores another click meanwhile', async () => {
        const fake = browser()
        let answer = (_body: unknown) => {}
        const { store, state } = setup(settings(), () => new Promise((resolve) => (answer = resolve)))

        const enabling = store.enable()
        void store.enable()

        expect(pushDeviceView(state())).toEqual({
            state: 'busy',
            text: 'pushTurningOn',
            hint: false,
            button: { label: 'pushTurnOn', action: 'subscribe', primary: true },
        })
        expect(fake.Notification.requestPermission).toHaveBeenCalledTimes(1)

        await settle()
        answer({ subscribed: true })
        await enabling

        expect(state()).toMatchObject({ busy: false, subscribed: true })
    })

    it('is busy while push turns off', async () => {
        browser({ permission: 'granted' }).installed().subscribed()
        let answer = (_body: unknown) => {}
        const { store, state } = setup(settings(true), (request) =>
            request.url.endsWith('/unsubscribe') ? new Promise((resolve) => (answer = resolve)) : { subscribed: true },
        )
        await settle()

        const disabling = store.disable()

        expect(pushDeviceView(state())).toMatchObject({ state: 'busy', text: 'pushTurningOff', button: { label: 'pushTurnOff', action: 'unsubscribe' } })

        await settle()
        answer({ subscribed: false })
        await disabling

        expect(state()).toMatchObject({ busy: false, subscribed: false })
    })

    it('keeps the action of a request while the permission changes', async () => {
        const fake = browser()
        let answer = (_body: unknown) => {}
        const { store, state } = setup(settings(true), () => new Promise((resolve) => (answer = resolve)))

        const enabling = store.enable()
        await settle()

        // Allowing notifications in the prompt tells the page that the permission changed.
        fake.page.dispatchEvent(new Event('visibilitychange'))

        expect(state()).toMatchObject({ permission: 'granted', busy: true, request: { action: 'subscribe', status: 'pending' } })
        expect(pushDeviceView(state())).toMatchObject({ state: 'busy', text: 'pushTurningOn', button: { label: 'pushTurnOn', action: 'subscribe' } })

        answer({ subscribed: true })
        await enabling

        expect(state()).toMatchObject({ subscribed: true, busy: false, reason: null, request: null })
    })

    it('keeps turning push on while the check of the page fails, and forgets that failure once push turned on', async () => {
        const fake = browser()
        const registration = fake.installed()
        registration.pushManager.subscribe.mockRejectedValueOnce(new DOMException('Registration failed', 'AbortError'))
        // The permission that the user allows in the prompt checks the device first, before the request of the click.
        fake.Notification.requestPermission.mockImplementationOnce(async () => {
            fake.Notification.permission = 'granted'
            fake.page.dispatchEvent(new Event('visibilitychange'))

            return 'granted'
        })
        const { store, state } = setup(settings(true))
        const texts: string[] = []
        store.subscribe(() => texts.push(pushDeviceView(state())!.text))

        await store.enable()

        expect(registration.pushManager.subscribe).toHaveBeenCalledTimes(2)
        expect(texts.filter((text) => text !== 'pushTurningOn')).toEqual(['pushOn'])
        expect(texts.at(-1)).toBe('pushOn')
        expect(state()).toMatchObject({ subscribed: true, busy: false, reason: null, request: null })
    })

    it('keeps turning push off while the check of the page fails, and forgets that failure once push turned off', async () => {
        const fake = browser({ permission: 'granted' })
        const registration = fake.installed()
        registration.pushManager.subscribe.mockRejectedValueOnce(new DOMException('Registration failed', 'AbortError'))
        const { store, state } = setup(settings(true))
        const texts: string[] = []
        store.subscribe(() => texts.push(pushDeviceView(state())!.text))

        // The user turns push off while the page checks the device.
        await store.disable()

        expect(texts.filter((text) => text !== 'pushTurningOff')).toEqual(['pushOff'])
        expect(texts.at(-1)).toBe('pushOff')
        expect(state()).toMatchObject({ subscribed: false, busy: false, reason: null, request: null })
    })

    it('tries the request that failed again', async () => {
        let fake = browser({ brave: true })
        const brave = setup()
        const registration = fake.installed()
        registration.pushManager.subscribe.mockRejectedValueOnce(new DOMException('Registration failed - push service error', 'AbortError'))

        await brave.store.enable()
        await press(brave.store)

        expect(registration.pushManager.subscribe).toHaveBeenCalledTimes(2)
        expect(brave.state()).toMatchObject({ subscribed: true, reason: null, request: null })

        // Turning push off fails, and the user resets the permission in the site settings meanwhile.
        fake = browser({ permission: 'granted' })
        const subscription = fake.installed().subscribed()
        let failing = true
        const off = setup(settings(true), (request) =>
            failing && request.url.endsWith('/unsubscribe') ? fails() : { subscribed: request.url.endsWith('/push/subscribe') },
        )
        await settle()
        await off.store.disable()

        fake.Notification.permission = 'default'
        fake.page.dispatchEvent(new Event('visibilitychange'))

        expect(off.state()).toMatchObject({ reason: 'failed', request: { action: 'unsubscribe', status: 'failed' } })
        expect(pushDeviceView(off.state())).toMatchObject({ state: 'failed', text: 'pushFailedOff', button: { action: 'unsubscribe' } })

        failing = false
        await press(off.store)

        expect(off.requests.at(-1)).toEqual({ url: '/inbox/push/unsubscribe', data: { endpoint: subscription.endpoint } })
        expect(off.state()).toMatchObject({ subscribed: false, reason: null, request: null })
    })
})

describe('turning push on and off', () => {
    it('asks for permission, registers the worker in its own scope, subscribes, and saves the subscription', async () => {
        const fake = browser()
        const { store, requests, state } = setup()

        await store.enable()

        const registration = fake.registration()!
        expect(fake.Notification.requestPermission).toHaveBeenCalledTimes(1)
        expect(fake.container.register).toHaveBeenCalledWith(SCRIPT, { scope: SCOPE })
        expect(registration.pushManager.subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: base64UrlBytes(KEY) })
        expect(requests).toEqual([
            {
                url: '/inbox/push/subscribe',
                data: {
                    endpoint: registration.subscription!.endpoint,
                    expirationTime: null,
                    keys: { p256dh: 'BPublicKeyOfTheBrowser', auth: 'AuthSecret' },
                },
            },
        ])
        expect(state()).toMatchObject({ permission: 'granted', subscribed: true, busy: false, reason: null })
    })

    it('asks for permission before anything else, while the click counts as a user gesture', async () => {
        const fake = browser()
        const { store } = setup()

        const enabling = store.enable()

        expect(fake.Notification.requestPermission).toHaveBeenCalledTimes(1)
        expect(fake.container.getRegistration).not.toHaveBeenCalled()

        await enabling
    })

    it('stops when the user blocks notifications in the prompt', async () => {
        const fake = browser({ prompt: 'denied' })
        const { store, requests, state } = setup()

        await store.enable()

        expect(fake.container.register).not.toHaveBeenCalled()
        expect(requests).toEqual([])
        expect(state()).toMatchObject({ permission: 'denied', busy: false, reason: 'blocked' })
    })

    it('keeps the subscription that the browser has for the key', async () => {
        const subscription = browser({ permission: 'granted' }).installed().subscribed()
        const { store, requests } = setup()

        await store.enable()

        expect(requests.map(({ data }) => data?.endpoint)).toEqual([subscription.endpoint])
        expect(subscription.unsubscribe).not.toHaveBeenCalled()
    })

    it('undoes the subscription that it made when saving it fails', async () => {
        const fake = browser()
        const { store, state } = setup(settings(), fails)

        await store.enable()

        const registration = fake.registration()!
        expect(registration.pushManager.subscribe).toHaveBeenCalledTimes(1)
        expect(registration.subscription).toBeNull()
        expect(state()).toMatchObject({ subscribed: false, busy: false, reason: 'failed' })
    })

    it('reports a service worker that does not install', async () => {
        const fake = browser()
        const { store, state } = setup()
        fake.container.register.mockRejectedValueOnce(new TypeError('Failed to register a ServiceWorker: A bad HTTP response code (404) was received.'))

        await store.enable()

        expect(state()).toMatchObject({ subscribed: false, reason: 'failed' })
    })

    it('removes the subscription from the server, then from the browser', async () => {
        const subscription = browser({ permission: 'granted' }).installed().subscribed()
        const order: string[] = []
        const { store, state } = setup(settings(true), (request) => {
            order.push(request.url)

            return { subscribed: request.url.endsWith('/push/subscribe') }
        })
        await settle()
        subscription.unsubscribe.mockImplementationOnce(async () => (order.push('browser'), true))

        await store.disable()

        expect(order).toEqual(['/inbox/push/subscribe', '/inbox/push/unsubscribe', 'browser'])
        expect(state()).toMatchObject({ subscribed: false, busy: false, reason: null })
    })

    it('stays on when the server fails to remove the subscription', async () => {
        const subscription = browser({ permission: 'granted' }).installed().subscribed()
        const { store, requests, state } = setup(settings(true), (request) => (request.url.endsWith('/unsubscribe') ? fails() : { subscribed: true }))
        await settle()

        await store.disable()

        expect(requests.at(-1)).toEqual({ url: '/inbox/push/unsubscribe', data: { endpoint: subscription.endpoint } })
        expect(subscription.unsubscribe).not.toHaveBeenCalled()
        expect(state()).toMatchObject({ subscribed: true, reason: 'failed' })
        expect(pushDeviceView(state())).toMatchObject({ state: 'failed', text: 'pushFailedOff', button: { action: 'unsubscribe' } })
    })
})

describe('checking the device when a page shows', () => {
    it('saves the subscription of a device that the server knows once per page, without asking', async () => {
        const fake = browser({ permission: 'granted' })
        const subscription = fake.installed().subscribed()
        const { inbox, requests, state } = setup(settings(true))
        await settle()

        // The next page, with a new shared prop.
        inbox.show(settings(true))
        await settle()

        expect(requests).toEqual([{ url: '/inbox/push/subscribe', data: expect.objectContaining({ endpoint: subscription.endpoint }) }])
        expect(fake.Notification.requestPermission).not.toHaveBeenCalled()
        expect(fake.registration()!.pushManager.subscribe).not.toHaveBeenCalled()
        expect(state().subscribed).toBe(true)
    })

    it('removes the subscription of a device that the user removed after the page loaded, instead of saving it again', async () => {
        const fake = browser({ permission: 'granted' })
        const subscription = fake.installed().subscribed()
        const { requests, state } = setup(settings(true), ({ url }) => ({ subscribed: url.endsWith('/push/subscribe') ? false : undefined }))
        await settle()

        expect(requests).toEqual([{ url: '/inbox/push/subscribe', data: expect.objectContaining({ endpoint: subscription.endpoint, refresh: true }) }])
        expect(subscription.unsubscribe).toHaveBeenCalledTimes(1)
        expect(fake.registration()!.pushManager.subscribe).not.toHaveBeenCalled()
        expect(state()).toMatchObject({ subscribed: false, reason: null })
    })

    it('undoes the new subscription of a device that the user removed, when the browser lost its own subscription', async () => {
        const fake = browser({ permission: 'granted' })
        const { requests, state } = setup(settings(true), ({ url }) => ({ subscribed: url.endsWith('/push/subscribe') ? false : undefined }))
        await settle()

        const registration = fake.registration()!
        expect(subscribeRequests(requests).map(({ data }) => data?.refresh)).toEqual([true])
        expect(registration.pushManager.subscribe).toHaveBeenCalledTimes(1)
        expect(registration.subscription).toBeNull()
        expect(state()).toMatchObject({ subscribed: false, reason: null })
    })

    it('keeps a device on when saving its subscription again fails', async () => {
        browser({ permission: 'granted' }).installed().subscribed()
        const { state } = setup(settings(true), fails)
        await settle()

        expect(state()).toMatchObject({ subscribed: true, reason: null })
    })

    it('subscribes a device that the server knows again, without asking, when the browser lost its subscription', async () => {
        const fake = browser({ permission: 'granted' })
        const { requests, state } = setup(settings(true))
        await settle()

        const registration = fake.registration()!
        expect(fake.container.register).toHaveBeenCalledWith(SCRIPT, { scope: SCOPE })
        expect(registration.pushManager.subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: base64UrlBytes(KEY) })
        expect(subscribeRequests(requests).map(({ data }) => data?.endpoint)).toEqual([registration.subscription!.endpoint])
        expect(fake.Notification.requestPermission).not.toHaveBeenCalled()
        expect(state().subscribed).toBe(true)
    })

    it('replaces the subscription of the previous key after the application rotated its keys', async () => {
        const fake = browser({ permission: 'granted' })
        const previous = fake.installed().subscribed(PREVIOUS_KEY)
        const { requests, state } = setup(settings(true))
        await settle()

        const current = fake.registration()!.subscription!
        expect(previous.unsubscribe).toHaveBeenCalledTimes(1)
        expect(new Uint8Array(current.options.applicationServerKey)).toEqual(base64UrlBytes(KEY))
        expect(requests.map(({ data }) => data?.endpoint)).toEqual([current.endpoint])
        expect(state().subscribed).toBe(true)
    })

    it('removes the subscription of the previous key from a device that the server does not know, without subscribing it', async () => {
        const fake = browser({ permission: 'granted' })
        const previous = fake.installed().subscribed(PREVIOUS_KEY)
        const { requests, state } = setup(settings(false))
        await settle()

        expect(previous.unsubscribe).toHaveBeenCalledTimes(1)
        expect(fake.registration()!.pushManager.subscribe).not.toHaveBeenCalled()
        expect(requests).toEqual([])
        expect(state().subscribed).toBe(false)
    })

    it('never subscribes a device that the server does not know, such as on a shared computer', async () => {
        // A browser that never turned push on gets no service worker.
        let fake = browser({ permission: 'granted' })
        let { requests, state } = setup(settings(false))
        await settle()

        expect(fake.container.register).not.toHaveBeenCalled()
        expect(requests).toEqual([])
        expect(state().subscribed).toBe(false)

        // The worker of an earlier user, without a subscription.
        fake = browser({ permission: 'granted' })
        const registration = fake.installed()
        ;({ requests, state } = setup(settings(false)))
        await settle()

        expect(registration.pushManager.subscribe).not.toHaveBeenCalled()
        expect(requests).toEqual([])

        // The subscription of an earlier user, which the server forgot when that user signed out.
        fake = browser({ permission: 'granted' })
        fake.installed().subscribed()
        ;({ requests, state } = setup(settings(false)))
        await settle()

        expect(requests).toEqual([])
        expect(state().subscribed).toBe(false)
    })

    it('leaves the device alone until the user allowed notifications', async () => {
        const fake = browser({ permission: 'default' })
        const { requests } = setup(settings(true))
        await settle()

        expect(fake.container.getRegistration).not.toHaveBeenCalled()
        expect(requests).toEqual([])
    })

    it("leaves the application's own service worker alone", async () => {
        const fake = browser({ permission: 'granted' })
        const own = fake.installed('https://app.test/', 'https://app.test/sw.js').subscribed(PREVIOUS_KEY)
        setup(settings(false))
        await settle()

        expect(own.unsubscribe).not.toHaveBeenCalled()
        expect(fake.container.register).not.toHaveBeenCalled()
    })

    it('installs the version of the worker that the page links', async () => {
        const fake = browser({ permission: 'granted' })
        fake.installed(SCOPE, 'https://app.test/_inertia-notifications/push/worker.js?v=old').subscribed()
        setup(settings(true))
        await settle()

        expect(fake.container.register).toHaveBeenCalledWith(SCRIPT, { scope: SCOPE })
    })

    it('shows a device that the server knows as off when it cannot subscribe again', async () => {
        const fake = browser({ permission: 'granted' })
        fake.installed().subscribeError = new DOMException('Registration failed', 'AbortError')
        const { inbox, state } = setup(settings(true))
        await settle()

        expect(state()).toMatchObject({ subscribed: false, reason: 'failed' })

        // A later page, which the server rendered with the same answer, keeps what this page found.
        inbox.show(settings(true))
        expect(state()).toMatchObject({ subscribed: false, reason: 'failed' })
    })

    it('subscribes the device again with the button of a check that failed', async () => {
        const fake = browser({ permission: 'granted' })
        const registration = fake.installed()
        registration.pushManager.subscribe.mockRejectedValueOnce(new DOMException('Registration failed', 'AbortError'))
        const { store, state } = setup(settings(true))
        await settle()

        expect(state()).toMatchObject({ reason: 'failed', request: { action: 'subscribe', status: 'failed' } })

        await press(store)

        expect(registration.pushManager.subscribe).toHaveBeenCalledTimes(2)
        expect(state()).toMatchObject({ subscribed: true, reason: null, request: null })
    })
})

describe('the devices of the user', () => {
    const phone: PushDevice = { id: 1, browser: 'Safari', platform: 'iOS', activeAt: '2026-11-20T09:00:00+00:00', current: false }
    const laptop: PushDevice = { id: 2, browser: 'Chrome', platform: 'macOS', activeAt: '2026-11-22T09:00:00+00:00', current: true }
    const tablet: PushDevice = { id: 3, browser: null, platform: null, activeAt: '2026-11-01T09:00:00+00:00', current: false }

    /** Answers like the package's routes, with the given devices, and holds each request whose URL ends with `held` until it is released. */
    const routes = (devices: PushDevice[], options: { held?: string; fail?: string } = {}) => {
        const releases: Array<() => void> = []
        const answer = async (request: Request): Promise<unknown> => {
            if (options.held !== undefined && request.url.endsWith(options.held)) {
                await new Promise<void>((resolve) => releases.push(resolve))
            }

            if (options.fail !== undefined && request.url.endsWith(options.fail)) {
                fails()
            }

            if (request.url.endsWith('/push/devices')) {
                return { devices }
            }

            return request.url.endsWith('/delete') ? { removed: true } : { subscribed: request.url.endsWith('/push/subscribe') }
        }

        return { answer, release: () => releases.splice(0).forEach((release) => release()) }
    }

    it('has no list until it loads, and reads only the devices that the endpoint describes', async () => {
        browser()
        const { store, state } = setup(settings(), () => ({
            devices: [laptop, { ...phone, browser: '', platform: 7 }, { id: '4', activeAt: '2026-11-22T09:00:00+00:00' }, { id: 5 }, 'tablet'],
        }))
        expect(state().devices).toBeNull()

        await store.loadDevices()

        expect(state().devices).toEqual([laptop, { ...phone, browser: null, platform: null }])
    })

    it('removes another device from the list at once, and keeps it out once the server removed it', async () => {
        browser()
        const { answer, release } = routes([laptop, phone, tablet], { held: '/delete' })
        const { store, requests, failures, state } = setup(settings(), answer)
        await store.loadDevices()

        const removing = store.removeDevice(phone.id)

        expect(state().devices).toEqual([laptop, tablet])
        expect(requests.at(-1)).toEqual({ url: '/inbox/push/devices/1/delete', data: {} })

        release()
        await removing

        expect(state().devices).toEqual([laptop, tablet])
        expect(failures).toEqual([])
    })

    it('brings a device back in its place and reports the failure when removing it fails', async () => {
        browser()
        const { answer } = routes([laptop, phone, tablet], { fail: '/delete' })
        const { store, failures, state } = setup(settings(), answer)
        await store.loadDevices()

        await store.removeDevice(phone.id)

        expect(state().devices).toEqual([laptop, phone, tablet])
        expect(failures).toHaveLength(1)
    })

    it('keeps a removed device out of a list that loaded before the server removed it', async () => {
        browser()
        const { answer, release } = routes([laptop, phone], { held: '/push/devices' })
        const { store, state } = setup(settings(), answer)
        const first = store.loadDevices()
        release()
        await first

        const loading = store.loadDevices()
        await store.removeDevice(phone.id)
        release()
        await loading

        expect(state().devices).toEqual([laptop])
    })

    it('loads the list again once this device turns push on or off, while the list shows', async () => {
        browser({ permission: 'granted' })
        const { answer } = routes([laptop])
        const { store, requests } = setup(settings(), answer)
        const listRequests = () => requests.filter(({ url }) => url === '/inbox/push/devices')

        await store.enable()
        expect(listRequests()).toHaveLength(0)

        await store.loadDevices()
        await store.disable()
        await settle()
        await store.enable()
        await settle()

        expect(listRequests()).toHaveLength(3)
    })

    it('forgets the devices of the previous user', async () => {
        browser()
        const { store, inbox, state } = setup(settings(), routes([laptop, phone]).answer)
        await store.loadDevices()

        inbox.show(settings(), 'user-2')

        expect(state().devices).toBeNull()
    })

    it('lists the other devices by name, with when each was last active and the label of its remove button', () => {
        const labels = preferencesLabels()
        const now = Date.parse('2026-11-22T10:00:00+00:00')

        expect(otherPushDevices([laptop, phone, tablet, { ...phone, id: 4, browser: 'Firefox', platform: null }], labels, now, 'en')).toEqual([
            { id: 1, name: 'Safari on iOS', active: 'Active 2 days ago', removeLabel: 'Remove Safari on iOS' },
            { id: 3, name: 'Unknown browser', active: 'Active 3 weeks ago', removeLabel: 'Remove Unknown browser' },
            { id: 4, name: 'Firefox', active: 'Active 2 days ago', removeLabel: 'Remove Firefox' },
        ])
        expect(otherPushDevices(null, labels, now)).toEqual([])
    })
})

describe('signing out', () => {
    it('forgets the state of the previous user', async () => {
        browser({ permission: 'granted' }).installed().subscribed()
        const { inbox, requests, state } = setup(settings(true))
        await settle()
        expect(state().subscribed).toBe(true)

        inbox.signOut()
        expect(state()).toMatchObject({ available: false, subscribed: false })

        // Another user signs in on the same computer.
        inbox.show(settings(false), 'user-2')
        await settle()

        expect(state()).toMatchObject({ available: true, subscribed: false })
        expect(requests).toHaveLength(1)
    })

    it('sends no request of the previous user for the next one', async () => {
        const fake = browser({ permission: 'granted' })
        const registration = fake.installed()
        let subscribe = () => {}
        const subscribing = registration.pushManager.subscribe.getMockImplementation()!
        registration.pushManager.subscribe.mockImplementationOnce(
            (options) => new Promise((resolve) => (subscribe = () => resolve(subscribing(options) as unknown as Promise<FakeSubscription>))),
        )
        const { inbox, requests, state } = setup(settings(true))
        await settle()

        // The repair of the first user is still subscribing when the next user signs in.
        inbox.show(settings(false), 'user-2')
        subscribe()
        await settle()

        expect(requests).toEqual([])
        expect(state().subscribed).toBe(false)
    })
})

describe('the page', () => {
    const message = (data: unknown) => {
        const port = { postMessage: vi.fn() }

        return { event: Object.assign(new Event('message'), { data, ports: [port] }), port }
    }

    it('starts the messages that the worker posted while the page loaded', () => {
        const fake = browser()
        setup()

        expect(fake.container.startMessages).toHaveBeenCalled()
    })

    it('visits the page of a clicked push with Inertia, and answers the worker', () => {
        const fake = browser()
        const { visits } = setup()
        const { event, port } = message({ type: VISIT_MESSAGE, url: 'https://app.test/_inertia-notifications/9d3c/open' })

        fake.container.dispatchEvent(event)

        expect(visits).toEqual(['https://app.test/_inertia-notifications/9d3c/open'])
        expect(port.postMessage).toHaveBeenCalledWith(true)
    })

    it('leaves a URL of another site to the browser, and ignores other messages', () => {
        const fake = browser()
        const { visits } = setup()

        fake.container.dispatchEvent(message({ type: VISIT_MESSAGE, url: 'https://status.example.com/' }).event)
        fake.container.dispatchEvent(message({ type: VISIT_MESSAGE, url: 'javascript:alert(1)' }).event)
        fake.container.dispatchEvent(message({ type: 'cache-updated', url: '/' }).event)

        expect(fake.assign).toHaveBeenCalledWith('https://status.example.com/')
        expect(visits).toEqual([])
    })

    /** A device that shows the pushes of the given notifications. */
    async function showing(...notifications: ShownNotification[]) {
        const fake = browser({ permission: 'granted' })
        const registration = fake.installed()
        registration.subscribed()
        registration.shown.push(...notifications)
        const context = setup(settings(true))
        await settle()

        return { ...context, registration }
    }

    const itemChange = (id: string, state: { readAt?: string | null; archivedAt?: string | null }): InboxChange => ({
        kind: 'item',
        id,
        readAt: null,
        seenAt: '2026-11-18T10:00:00Z',
        archivedAt: null,
        snoozedUntil: null,
        result: null,
        ...state,
    })

    it('closes the push of a notification that the user read or archived', async () => {
        const first = new ShownNotification('inertiaui-inbox-n1')
        const second = new ShownNotification('inertiaui-inbox-n2')
        const third = new ShownNotification('inertiaui-inbox-n3')
        const { inbox, registration } = await showing(first, second, third)

        // Read in this tab, archived in another session, and marked as unread.
        inbox.saved(itemChange('n1', { readAt: '2026-11-18T10:00:00Z' }))
        inbox.change(itemChange('n2', { archivedAt: '2026-11-18T10:00:00Z' }))
        inbox.saved(itemChange('n3', { readAt: null }))
        await settle()

        expect(registration.getNotifications).toHaveBeenCalledWith({ tag: 'inertiaui-inbox-n1' })
        expect([first.closed, second.closed, third.closed]).toEqual([true, true, false])
    })

    it('closes the pushes of notifications that a batch read, archived, or deleted', async () => {
        const pushes = ['n1', 'n2', 'n3', 'n4'].map((id) => new ShownNotification(`inertiaui-inbox-${id}`))
        const { inbox } = await showing(...pushes)

        inbox.saved({ kind: 'items', action: 'read', ids: ['n1'], at: '2026-11-18T10:00:00Z' })
        inbox.saved({ kind: 'items', action: 'unread', ids: ['n2'], at: '2026-11-18T10:00:00Z' })
        inbox.change({ kind: 'delete', ids: ['n3', 'n4'] })
        await settle()

        expect(pushes.map(({ closed }) => closed)).toEqual([true, false, true, true])
    })

    it('closes the pushes up to a change of every category', async () => {
        const before = Date.parse('2026-11-18T10:00:00Z')
        const old = new ShownNotification('inertiaui-inbox-n1', before - 60_000)
        const newer = new ShownNotification('inertiaui-inbox-n2', before + 60_000)
        const other = new ShownNotification('deployment-finished', before - 60_000)
        const { inbox } = await showing(old, newer, other)

        // A change of one category, and archiving only what was read, leave the pushes.
        inbox.saved({ kind: 'read', before: '2026-11-18T10:00:00Z', ids: null, category: 'billing' })
        inbox.saved({ kind: 'archive', before: '2026-11-18T10:00:00Z', ids: null, category: null, onlyRead: true })
        await settle()
        expect(old.closed).toBe(false)

        inbox.saved({ kind: 'read', before: '2026-11-18T10:00:00Z', ids: null, category: null })
        await settle()

        expect([old.closed, newer.closed, other.closed]).toEqual([true, false, false])
    })

    it('closes only the pushes of the current context and of no context on a change of every category', async () => {
        const before = Date.parse('2026-11-18T10:00:00Z')
        const teamA = new ShownNotification('inertiaui-inbox-n1', before - 60_000, { id: 'n1', context: 'team-a' })
        const teamB = new ShownNotification('inertiaui-inbox-n2', before - 60_000, { id: 'n2', context: 'team-b' })
        const none = new ShownNotification('inertiaui-inbox-n3', before - 60_000, { id: 'n3' })
        const { inbox } = await showing(teamA, teamB, none)
        inbox.enter('team-a')

        inbox.saved({ kind: 'read', before: '2026-11-18T10:00:00Z', ids: null, category: null })
        await settle()

        expect([teamA.closed, teamB.closed, none.closed]).toEqual([true, false, true])
    })

    it('closes the pushes that the page asks for', async () => {
        const push = new ShownNotification('inertiaui-inbox-n1')
        const { store } = await showing(push)

        await store.close(['n1'])

        expect(push.closed).toBe(true)
    })
})
