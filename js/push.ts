import { sameOrigin } from './actions'
import { isRecord, safeHref } from './flash'
import { relativeTime, type InboxChange, type InboxState } from './inbox'
import type { InertiaBindings } from './inertia'
import type { PreferencesLabels } from './preferences'
import { inboxIdOfToast, inboxToastId } from './realtime'
import { formatTranslation } from './translations'

/** The settings of web push in the shared prop, while the application sends pushes. */
export interface PushSettings {
    /** The application's public VAPID key, base64url-encoded, which the browser subscribes with. */
    publicKey: string
    /** The URL of the service worker, with the version of its file. Its directory is the worker's scope. */
    worker: string
    /** Whether the server stores a subscription of this browser for the signed-in user. */
    subscribed: boolean
}

/** Why push cannot turn on in this browser, or why the last request failed. */
export type PushReason =
    /** The page is not served over HTTPS or from `localhost`, so the browser offers no service workers. */
    | 'insecure'
    /** The browser has no web push. */
    | 'unsupported'
    /** iOS and iPadOS only offer push to a site that the user added to the Home Screen and opened from there. */
    | 'home-screen'
    /** The user blocked notifications for the site. */
    | 'blocked'
    /** Brave could not subscribe, as its "Use Google services for push messaging" setting is off. */
    | 'brave'
    /** Registering the service worker, subscribing, or saving the subscription failed. */
    | 'failed'

/** A device that receives the signed-in user's pushes, as the server stores its subscription. */
export interface PushDevice {
    /** The key of the subscription, which `removeDevice()` takes. */
    id: number
    /** The name of the browser, such as `Chrome`, or `null` when its user agent tells no browser we know. */
    browser: string | null
    /** The operating system of the browser, such as `macOS`, or `null` when its user agent tells none we know. */
    platform: string | null
    /** When the device last opened a page of the application while push was on, or turned push on, as ISO 8601. */
    activeAt: string
    /** Whether this is the device of the page. */
    current: boolean
}

export interface PushState {
    /** Whether the application sends pushes: the shared prop's `push` is not `null`. */
    available: boolean
    /** Whether this browser can receive pushes. */
    supported: boolean
    /** The browser's permission for notifications. */
    permission: NotificationPermission
    /** Whether this device receives the signed-in user's pushes. */
    subscribed: boolean
    /** Whether turning push on or off for this device is in progress. */
    busy: boolean
    /** Why push cannot turn on in this browser, or why the last request failed. `null` when nothing is in the way. */
    reason: PushReason | null
    /** The request that turns push on or off for this device while it runs, or after it failed. `null` once it succeeded. */
    request: { action: 'subscribe' | 'unsubscribe'; status: 'pending' | 'brave' | 'failed' } | null
    /**
     * The devices that receive the signed-in user's pushes, the most recently active first, once `loadDevices()` loaded
     * them, and `null` before. A device that `removeDevice()` removes leaves the list at once.
     */
    devices: readonly PushDevice[] | null
}

/** The state before the page shows in a browser, which the server renders. */
export const INITIAL_PUSH: PushState = {
    available: false,
    supported: false,
    permission: 'default',
    subscribed: false,
    busy: false,
    reason: null,
    request: null,
    devices: null,
}

/** What the device control of `<NotificationPreferences>` shows, as its `data-state`. */
export type PushDeviceState = 'off' | 'on' | 'busy' | 'blocked' | 'home-screen' | 'insecure' | 'brave' | 'failed'

/**
 * The state of the device control, or `null` while it hides: the application sends no pushes, or the browser has no
 * web push and nothing the user can do changes that.
 */
export function pushDeviceState(state: Omit<PushState, 'devices'>): PushDeviceState | null {
    if (!state.available || state.reason === 'unsupported') {
        return null
    }

    if (state.busy) {
        return 'busy'
    }

    return state.reason ?? (state.subscribed ? 'on' : 'off')
}

type PushLabel = Extract<keyof PreferencesLabels, `push${string}`>

/** The device control in one state: the label of its text, whether the text tells what to do, and its button, which turns push on or off. */
export interface PushDeviceView {
    state: PushDeviceState
    text: PushLabel
    hint: boolean
    button: { label: PushLabel; action: 'subscribe' | 'unsubscribe'; primary: boolean } | null
}

/** What the device control shows for the state, or `null` while it hides. A request that failed shows the button that tries it again. */
export function pushDeviceView(state: Omit<PushState, 'devices'>): PushDeviceView | null {
    const device = pushDeviceState(state)
    // The action of the request that runs, or that failed and the button tries again.
    const action = state.request?.action ?? 'subscribe'
    const off = action === 'unsubscribe'

    switch (device) {
        case null:
            return null
        case 'off':
            return { state: device, text: 'pushOff', hint: false, button: { label: 'pushTurnOn', action: 'subscribe', primary: true } }
        case 'on':
            return { state: device, text: 'pushOn', hint: false, button: { label: 'pushTurnOff', action: 'unsubscribe', primary: false } }
        case 'busy':
            return {
                state: device,
                text: off ? 'pushTurningOff' : 'pushTurningOn',
                hint: false,
                button: { label: off ? 'pushTurnOff' : 'pushTurnOn', action, primary: !off },
            }
        case 'blocked':
            return { state: device, text: 'pushBlocked', hint: true, button: null }
        case 'home-screen':
            return { state: device, text: 'pushHomeScreen', hint: true, button: null }
        case 'insecure':
            return { state: device, text: 'pushInsecure', hint: true, button: null }
        case 'brave':
            return { state: device, text: 'pushBrave', hint: true, button: { label: 'pushRetry', action, primary: false } }
        case 'failed':
            return {
                state: device,
                text: off ? 'pushFailedOff' : 'pushFailed',
                hint: true,
                button: { label: 'pushRetry', action, primary: false },
            }
    }
}

/** The message that the service worker posts to a window of the application, which visits its `url` and answers on the port. */
export const VISIT_MESSAGE = 'inertiaui-notifications:visit'

/** The message that the service worker posts to every window of the application once it shows a push, with the push's `tag`. */
export const SHOWN_MESSAGE = 'inertiaui-notifications:shown'

/** The parts of the inbox store that web push follows. */
export interface PushInbox {
    subscribe(listener: () => void): () => void
    getSnapshot(): Pick<InboxState, 'url' | 'user'>
    pushSettings(): unknown
    context(): string | null
    onChange(listener: (change: InboxChange) => void): () => void
    onSaved(listener: (saved: { change: InboxChange; counts: unknown }) => void): () => void
}

export interface PushStore {
    subscribe(listener: () => void): () => void
    getSnapshot(): PushState
    /**
     * Follows the shared prop of the inbox store, checks the subscription of this device once a page shows, closes the
     * pushes of notifications that the user read or archived, and visits the page of a push that the user clicked. A push
     * that shows while `seesToast` tells that the user sees the toast of its notification closes at once.
     */
    connect(bindings: InertiaBindings, inbox: PushInbox, seesToast?: (id: string) => boolean, onFailure?: (error: unknown) => void): void
    /**
     * Turns push on for this device: asks for permission, registers the service worker, subscribes, and saves the
     * subscription. Browsers only ask for permission after a user gesture, so call it from a click handler.
     */
    enable(): Promise<void>
    /** Turns push off for this device: removes the subscription from the server, then from the browser. */
    disable(): Promise<void>
    /** Loads the devices that receive the signed-in user's pushes into `devices`, such as when a list of them shows. */
    loadDevices(): Promise<void>
    /**
     * Removes the subscription of another device of the signed-in user, such as a phone the user no longer has, so it
     * gets no more pushes. The device leaves `devices` at once and comes back when the request fails. Use `disable()`
     * for this device, which also removes the subscription from the browser.
     */
    removeDevice(id: number): Promise<void>
    /** Closes the pushes of these notifications that show on this device. */
    close(ids: readonly string[]): Promise<void>
}

/** Reads the `push` key of the shared prop. */
export function parsePushSettings(value: unknown): PushSettings | null {
    if (!isRecord(value) || typeof value.publicKey !== 'string' || value.publicKey === '' || typeof value.worker !== 'string' || value.worker === '') {
        return null
    }

    return { publicKey: value.publicKey, worker: value.worker, subscribed: value.subscribed === true }
}

const nameOrNull = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null)

/** Reads the response of the endpoint that lists the devices. */
export function parsePushDevices(value: unknown): PushDevice[] | undefined {
    if (!isRecord(value) || !Array.isArray(value.devices)) {
        return undefined
    }

    return value.devices.flatMap((device: unknown) =>
        isRecord(device) && typeof device.id === 'number' && typeof device.activeAt === 'string'
            ? [
                  {
                      id: device.id,
                      browser: nameOrNull(device.browser),
                      platform: nameOrNull(device.platform),
                      activeAt: device.activeAt,
                      current: device.current === true,
                  },
              ]
            : [],
    )
}

/** The bytes of a base64url string, such as a VAPID key. */
export function base64UrlBytes(value: string): Uint8Array<ArrayBuffer> {
    const base64 = value.replaceAll('-', '+').replaceAll('_', '/')
    const binary = atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='))

    return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

/** Whether the subscription was made with the key. A browser that does not tell the key of a subscription keeps it. */
function madeWith(subscription: PushSubscription, key: Uint8Array): boolean {
    const used = subscription.options?.applicationServerKey

    if (!used) {
        return true
    }

    const bytes = new Uint8Array(used)

    return bytes.length === key.length && bytes.every((byte, index) => byte === key[index])
}

/** Whether the page runs on an iPhone or iPad, also an iPad that asks for desktop pages. */
const onIos = (): boolean => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1)

/** Whether the page was opened from the Home Screen, as an app. */
const standalone = (): boolean =>
    (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true

/** Why this browser cannot receive pushes, or `null` when it can. */
function environmentReason(): PushReason | null {
    if (!window.isSecureContext) {
        return 'insecure'
    }

    if (navigator.serviceWorker !== undefined && 'PushManager' in window && typeof Notification === 'function') {
        return null
    }

    return onIos() && !standalone() ? 'home-screen' : 'unsupported'
}

const isBrave = (): boolean => 'brave' in navigator

const readPermission = (): NotificationPermission => (typeof Notification === 'function' ? Notification.permission : 'default')

/** The scope of the service worker: the directory of its script, which no request of the application uses. */
const scopeOf = (worker: string): string => new URL('./', new URL(worker, window.location.href)).href

/** Resolves once the registration has an active service worker, which subscribing needs. */
function activated(registration: ServiceWorkerRegistration): Promise<ServiceWorkerRegistration> {
    const worker = registration.installing ?? registration.waiting

    if (registration.active || !worker) {
        return registration.active ? Promise.resolve(registration) : Promise.reject(new Error('The service worker did not install.'))
    }

    return new Promise((resolve, reject) => {
        const onStateChange = (): void => {
            if (registration.active || worker.state === 'redundant') {
                worker.removeEventListener('statechange', onStateChange)

                return registration.active ? resolve(registration) : reject(new Error('The service worker did not install.'))
            }
        }

        worker.addEventListener('statechange', onStateChange)
    })
}

export function createPushStore(): PushStore {
    let bindings: InertiaBindings | undefined
    let inbox: PushInbox | undefined
    let seesToast: ((id: string) => boolean) | undefined
    let onFailure: ((error: unknown) => void) | undefined
    // The signed-in user, like the inbox store tells it: `undefined` while signed out.
    let account: string | undefined
    // Changes when the user changes, so that requests for the previous user change nothing.
    let generation = 0
    let raw: unknown = null
    let settings: PushSettings | null = null
    let environment: PushReason | null = 'unsupported'
    let permission: NotificationPermission = 'default'
    // Whether this device receives pushes. A page's prop changes it only when the server's answer changes, so a request
    // of this page, or a failed repair, is not undone by a page that the server rendered before it.
    let subscribed = false
    let told: boolean | undefined
    // The request that runs, or the last one when it failed, whose action the control tells. Only the request that runs
    // ends it, and a check that fails only writes it while it is empty.
    let request: PushState['request'] = null
    // Whether this page checked the subscription of the device for the signed-in user.
    let checked = false
    // Requests run one at a time, so a repair and a click do not race.
    let queue: Promise<unknown> = Promise.resolve()
    // The devices as the server listed them, those being removed, and the list without those, which the state shows. Each
    // load and removal counts up, so a list that an earlier request loaded does not replace a newer one.
    let devices: readonly PushDevice[] | null = null
    const removing = new Set<number>()
    let shownDevices: readonly PushDevice[] | null = null
    let devicesVersion = 0
    let snapshot = INITIAL_PUSH
    const listeners = new Set<() => void>()

    const pending = (): boolean => request?.status === 'pending'

    const emit = (): void => {
        const available = settings !== null
        const supported = environment === null
        const next: PushState = {
            available,
            supported,
            permission,
            subscribed: available && supported && permission === 'granted' && subscribed,
            busy: pending(),
            reason: environment ?? (permission === 'denied' ? 'blocked' : request === null || request.status === 'pending' ? null : request.status),
            request,
            devices: available ? shownDevices : null,
        }

        if ((Object.keys(next) as Array<keyof PushState>).some((key) => next[key] !== snapshot[key])) {
            snapshot = next
            listeners.forEach((listener) => listener())
        }
    }

    const run = <T>(task: () => Promise<T>): Promise<T> => {
        const result = queue.then(task)
        queue = result.catch(() => {})

        return result
    }

    const url = (): string | undefined => inbox?.getSnapshot().url

    // The registration of the service worker, without registering it. The registration of another scope, such as the
    // application's own service worker, does not count.
    const registrationOf = async (target: PushSettings): Promise<ServiceWorkerRegistration | undefined> => {
        const scope = scopeOf(target.worker)
        const registration = await navigator.serviceWorker.getRegistration(scope)

        return registration?.scope === scope ? registration : undefined
    }

    // Registers the service worker, or the new version of its script, and waits until it is active.
    const install = async (target: PushSettings, registration: ServiceWorkerRegistration | undefined): Promise<ServiceWorkerRegistration> => {
        const script = new URL(target.worker, window.location.href).href

        return activated(
            registration?.active?.scriptURL === script ? registration : await navigator.serviceWorker.register(script, { scope: scopeOf(target.worker) }),
        )
    }

    // Sends a request for the user of the generation, and never for a user who signed in since.
    const post = (current: number, path: string, data: Record<string, unknown>): Promise<unknown> =>
        current === generation ? bindings!.request('post', `${url()}/${path}`, data) : Promise.reject(new Error('Another user signed in.'))

    /**
     * Saves the subscription. With `refresh`, the server only saves the subscription of a device that the user still has,
     * and the answer is `false` for a device that was removed meanwhile, such as from another device.
     */
    const save = async (current: number, subscription: PushSubscription, refresh = false): Promise<boolean> => {
        const body = await post(current, 'push/subscribe', { ...subscription.toJSON(), ...(refresh ? { refresh: true } : {}) })

        if (refresh && isRecord(body) && body.subscribed === false) {
            return false
        }

        if (!isRecord(body) || body.subscribed !== true) {
            throw new Error('The push endpoint did not save the subscription.')
        }

        return true
    }

    /**
     * Subscribes the registration, or keeps its subscription when it was made with the key, and saves the subscription.
     * Undoes a subscription that it made when saving fails, so the browser and the server agree. With `refresh`, the
     * answer is `false` for a device that the server no longer has, whose subscription goes.
     */
    const subscribeWith = async (current: number, registration: ServiceWorkerRegistration, target: PushSettings, refresh = false): Promise<boolean> => {
        const key = base64UrlBytes(target.publicKey)
        let subscription: PushSubscription | null
        let made: PushSubscription | undefined

        try {
            subscription = await registration.pushManager.getSubscription()

            if (subscription && !madeWith(subscription, key)) {
                await subscription.unsubscribe()
                subscription = null
            }

            subscription ??= made = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
        } catch (error) {
            // Brave only subscribes once the user turned on its "Use Google services for push messaging" setting.
            throw isBrave() ? Object.assign(new Error('Brave could not subscribe.'), { brave: true, cause: error }) : error
        }

        try {
            if (!(await save(current, subscription, refresh))) {
                await subscription.unsubscribe().catch(() => {})

                return false
            }
        } catch (error) {
            await made?.unsubscribe().catch(() => {})

            throw error
        }

        return true
    }

    const failureOf = (error: unknown): 'brave' | 'failed' => (isRecord(error) && error.brave === true ? 'brave' : 'failed')

    /**
     * Checks the subscription of this device once a page shows: a subscription made with another key, such as before
     * the application rotated its keys, goes, and a device that the server knows subscribes again, or saves its
     * subscription, which the browser may have replaced. A device that the server does not know never subscribes here,
     * as on a shared computer it would receive the pushes of the previous user. Neither does a device that the user
     * removed after the page loaded, which the server refuses: it shows as off, and its subscription goes.
     */
    const check = (): void => {
        if (checked || settings === null || environment !== null || permission !== 'granted' || !bindings) {
            return
        }

        checked = true

        const current = generation
        const target = settings

        void run(async () => {
            if (current !== generation) {
                return
            }

            const existing = await registrationOf(target).catch(() => undefined)

            // A browser that never turned push on gets no service worker.
            if (!existing && !target.subscribed) {
                return
            }

            const removed = (): void => {
                if (current === generation) {
                    subscribed = false
                    emit()
                    reloadDevices()
                }
            }

            try {
                const registration = await install(target, existing)
                const subscription = await registration.pushManager.getSubscription()

                if (subscription && madeWith(subscription, base64UrlBytes(target.publicKey))) {
                    // Saved once per page, quietly: the device keeps its pushes when saving fails.
                    if (target.subscribed && !(await save(current, subscription, true).catch(() => true))) {
                        await subscription.unsubscribe().catch(() => {})
                        removed()
                    }

                    return
                }

                if (subscription) {
                    await subscription.unsubscribe()
                }

                if (target.subscribed && !(await subscribeWith(current, registration, target, true))) {
                    removed()
                }
            } catch (error) {
                // The device that the server knows has no subscription that works, so it shows as off, with the reason,
                // unless the user clicked meanwhile, whose request tells what happened.
                if (current === generation && target.subscribed) {
                    subscribed = false
                    request ??= { action: 'subscribe', status: failureOf(error) }
                    emit()
                }
            }
        })
    }

    const showDevices = (): void => {
        shownDevices = devices?.filter(({ id }) => !removing.has(id)) ?? null
        emit()
    }

    const loadDevices = async (): Promise<void> => {
        if (settings === null || !bindings) {
            return
        }

        const current = generation
        const version = ++devicesVersion

        try {
            const loaded = parsePushDevices(await bindings.request('get', `${url()}/push/devices`))

            if (current === generation && version === devicesVersion && loaded) {
                devices = loaded
                showDevices()
            }
        } catch {
            // The list stays as it was.
        }
    }

    // Loads the list again after this device turned push on or off, while it shows.
    const reloadDevices = (): void => {
        if (devices !== null) {
            void loadDevices()
        }
    }

    const reset = (): void => {
        generation++
        raw = null
        settings = null
        subscribed = false
        told = undefined
        request = null
        checked = false
        queue = Promise.resolve()
        devices = shownDevices = null
        removing.clear()
        devicesVersion++
    }

    const sync = (): void => {
        const state = inbox!.getSnapshot()
        const next = state.url === undefined ? undefined : (state.user ?? '')

        if (next !== account) {
            account = next
            reset()
        }

        const value = inbox!.pushSettings()

        if (value !== raw) {
            raw = value
            settings = parsePushSettings(value)

            if (settings === null) {
                subscribed = false
                told = undefined
                request = pending() ? request : null
            } else if (settings.subscribed !== told) {
                subscribed = told = settings.subscribed
            }
        }

        permission = readPermission()
        emit()
        check()
    }

    const refreshPermission = (): void => {
        permission = readPermission()
        emit()
        check()
    }

    // Visits the page of the push that the user clicked, in this window, and closes a push that shows after the toast of
    // its notification, which the user already sees.
    const onMessage = (event: MessageEvent): void => {
        const data: unknown = event.data

        if (isRecord(data) && data.type === SHOWN_MESSAGE) {
            const id = typeof data.tag === 'string' ? inboxIdOfToast(data.tag) : undefined

            if (id !== undefined && seesToast?.(id)) {
                void closeWhere([inboxToastId(id)])
            }

            return
        }

        if (!isRecord(data) || data.type !== VISIT_MESSAGE) {
            return
        }

        const href = safeHref(data.url)

        if (href === undefined) {
            return
        }

        event.ports[0]?.postMessage(true)

        if (bindings && sameOrigin(href)) {
            bindings.visit(href, {})
        } else {
            window.location.assign(href)
        }
    }

    /**
     * Closes the pushes with these tags, or every push of the package that arrived up to the given time. A context limits
     * the latter to the pushes of that context and those without one.
     */
    const closeWhere = async (tags: readonly string[] | null, until?: number, context: string | null = null): Promise<void> => {
        if (settings === null || environment !== null || (tags !== null && tags.length === 0)) {
            return
        }

        try {
            const registration = await registrationOf(settings)

            if (!registration) {
                return
            }

            // Browsers that do not tell when a notification arrived, which TypeScript's types leave out, close it.
            const arrivedBy = (notification: Notification & { timestamp?: number }): boolean =>
                typeof notification.timestamp !== 'number' || until === undefined || notification.timestamp <= until
            // A push keeps the context key of its notification in its data, which a notification without a context leaves out.
            const inContext = (notification: Notification): boolean => {
                const key: unknown = isRecord(notification.data) ? notification.data.context : undefined

                return context === null || key === undefined || key === context
            }

            const shown =
                tags === null
                    ? (await registration.getNotifications()).filter(
                          (notification) => inboxIdOfToast(notification.tag) !== undefined && arrivedBy(notification) && inContext(notification),
                      )
                    : (await Promise.all(tags.map((tag) => registration.getNotifications({ tag })))).flat()

            shown.forEach((notification) => notification.close())
        } catch {
            // The pushes stay until the user closes them.
        }
    }

    /** Closes the pushes of the notifications that a change marks as read, archives, or deletes. */
    const closeChanged = (change: InboxChange): Promise<void> => {
        switch (change.kind) {
            case 'item':
                return change.readAt !== null || change.archivedAt !== null ? closeWhere([inboxToastId(change.id)]) : Promise.resolve()
            case 'items':
                return change.action === 'read' || change.action === 'archive' ? closeWhere(change.ids.map(inboxToastId)) : Promise.resolve()
            case 'delete':
                return closeWhere(change.ids.map(inboxToastId))
            case 'read':
            case 'archive':
                // The pushes do not tell their category, so only the changes of every category close them. Archiving
                // only the read notifications leaves the pushes of the unread ones. The server changes the notifications
                // of the current context and those without a context, or every notification without a current context,
                // so the pushes of other contexts stay.
                return change.category === null && !(change.kind === 'archive' && change.onlyRead)
                    ? closeWhere(null, Date.parse(change.before), inbox?.context() ?? null)
                    : Promise.resolve()
            default:
                return Promise.resolve()
        }
    }

    const store: PushStore = {
        subscribe(listener) {
            listeners.add(listener)

            return () => listeners.delete(listener)
        },
        getSnapshot: () => snapshot,
        connect(connected, followed, sees, failed) {
            bindings = connected

            if (inbox) {
                return
            }

            inbox = followed
            seesToast = sees
            onFailure = failed
            environment = environmentReason()

            if (environment === null) {
                navigator.serviceWorker.addEventListener('message', onMessage)
                navigator.serviceWorker.startMessages()

                // The user may allow notifications in the site settings while the page shows.
                navigator.permissions
                    ?.query({ name: 'notifications' })
                    .then((status) => status.addEventListener('change', refreshPermission))
                    .catch(() => {})
                document.addEventListener('visibilitychange', refreshPermission)
            }

            const closeFor = (change: InboxChange): void => void closeChanged(change)

            followed.onChange(closeFor)
            followed.onSaved(({ change }) => closeFor(change))
            followed.subscribe(sync)
            sync()
        },
        async enable() {
            if (pending() || settings === null || environment !== null || !bindings) {
                return
            }

            const current = generation
            const target = settings

            request = { action: 'subscribe', status: 'pending' }
            emit()

            // Before anything else, while the click still counts as a user gesture.
            permission = Notification.permission === 'default' ? await Notification.requestPermission().catch(readPermission) : Notification.permission

            if (current !== generation) {
                return
            }

            if (permission === 'granted') {
                // Turning push on checks the subscription, so the page does not check it again.
                checked = true

                await run(async () => {
                    if (current !== generation) {
                        return
                    }

                    try {
                        await subscribeWith(current, await install(target, await registrationOf(target)), target)

                        if (current === generation) {
                            subscribed = true
                            reloadDevices()
                        }
                    } catch (error) {
                        // The device has no subscription that works, also when the server knows it.
                        if (current === generation) {
                            subscribed = false
                            request = { action: 'subscribe', status: failureOf(error) }
                        }
                    }
                })
            }

            if (current === generation) {
                request = pending() ? null : request
                emit()
            }
        },
        async disable() {
            if (pending() || settings === null || !bindings) {
                return
            }

            const current = generation
            const target = settings

            request = { action: 'unsubscribe', status: 'pending' }
            emit()

            await run(async () => {
                if (current !== generation) {
                    return
                }

                try {
                    const registration = environment === null ? await registrationOf(target) : undefined
                    const subscription = await registration?.pushManager.getSubscription()

                    // The server forgets the subscription first, so a request that fails leaves the device on, as the server knows it.
                    if (subscription) {
                        await post(current, 'push/unsubscribe', { endpoint: subscription.endpoint })
                        await subscription.unsubscribe().catch(() => {})
                    }

                    if (current === generation) {
                        subscribed = false
                        reloadDevices()
                    }
                } catch {
                    if (current === generation) {
                        request = { action: 'unsubscribe', status: 'failed' }
                    }
                }
            })

            if (current === generation) {
                request = pending() ? null : request
                emit()
            }
        },
        loadDevices,
        async removeDevice(id) {
            if (removing.has(id) || !devices?.some((device) => device.id === id)) {
                return
            }

            const current = generation

            removing.add(id)
            showDevices()

            try {
                await post(current, `push/devices/${id}/delete`, {})

                if (current !== generation) {
                    return
                }

                devices = devices?.filter((device) => device.id !== id) ?? null
                devicesVersion++
            } catch (error) {
                if (current !== generation) {
                    return
                }

                onFailure?.(error)
            }

            removing.delete(id)
            showDevices()
        },
        close: (ids) => closeWhere(ids.map(inboxToastId)),
    }

    return store
}

/** The store of web push on this device, shared by every component. */
export const pushStore = createPushStore()

/** A row of the list of other devices in `<NotificationPreferences>`: the device's name, when it was last active, and the label of its remove button. */
export interface OtherPushDevice {
    id: number
    name: string
    active: string
    removeLabel: string
}

/** The devices other than this one, as the list of `<NotificationPreferences>` shows them, the most recently active first. */
export function otherPushDevices(devices: readonly PushDevice[] | null, labels: PreferencesLabels, now: number, locale?: string): OtherPushDevice[] {
    return (devices ?? [])
        .filter((device) => !device.current)
        .map((device) => {
            const browser = device.browser ?? formatTranslation(labels.pushDeviceUnknown)
            const name = device.platform === null ? browser : formatTranslation(labels.pushDeviceName, { browser, platform: device.platform })

            return {
                id: device.id,
                name,
                active: formatTranslation(labels.pushDeviceActive, { time: relativeTime(device.activeAt, now, locale) }),
                removeLabel: formatTranslation(labels.pushDeviceRemoveLabel, { device: name }),
            }
        })
}

/** Runs the action of the button of the device control, unless its request is still running. Call it from a click handler. */
export function togglePushDevice(view: PushDeviceView | null): void {
    const button = view?.button

    if (button && view?.state !== 'busy') {
        void (button.action === 'subscribe' ? pushStore.enable() : pushStore.disable())
    }
}
