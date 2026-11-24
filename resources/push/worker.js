// The service worker of Inertia UI Notifications' web push. The package serves it from its own route and registers it
// with the narrow scope of that route's directory, so it never handles the application's requests and works next to
// the application's own service worker. It shows each push as a notification, and opens the notification's page on
// a click. Plain JavaScript without dependencies, as browsers load it as it is.

/** The message that asks a window of the application to visit a URL with Inertia. The page answers on the port. */
const VISIT_MESSAGE = 'inertiaui-notifications:visit'

/** The message that tells each window of the application the tag of a push that shows. A page that shows its toast closes it. */
const SHOWN_MESSAGE = 'inertiaui-notifications:shown'

/**
 * Milliseconds that a window may take to answer the visit message before a new window opens instead. Firefox only lets
 * a worker open a window within a second of the click, so the wait leaves room for it.
 */
const VISIT_TIMEOUT = 500

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

/** The payload of a push: Declarative Web Push JSON, or text that becomes the body. */
const parse = (data) => {
    if (!data) {
        return {}
    }

    try {
        const payload = data.json()

        return payload !== null && typeof payload === 'object' ? payload : { notification: { body: String(payload) } }
    } catch {
        return { notification: { body: data.text() } }
    }
}

const text = (value) => (typeof value === 'string' ? value : undefined)

/** The windows of the application, including those that this worker does not control, which are all of them. */
const windows = () => self.clients.matchAll({ type: 'window', includeUncontrolled: true })

// Always shows a notification: browsers revoke or limit a subscription whose pushes show nothing, and Chrome would show
// its own "This site has been updated in the background" instead. A window that the user looks at shows the toast, so
// the notification arrives silently then. Once it shows, every window hears of it, so a page that showed the toast before
// the push arrived closes it.
self.addEventListener('push', (event) => {
    const notification = parse(event.data).notification ?? {}
    const tag = text(notification.tag)

    event.waitUntil(
        windows().then(async (clients) => {
            const focused = clients.some((client) => client.focused)

            await self.registration.showNotification(text(notification.title) ?? self.location.hostname, {
                body: text(notification.body),
                icon: text(notification.icon),
                tag,
                timestamp: typeof notification.timestamp === 'number' ? notification.timestamp : undefined,
                lang: text(notification.lang),
                dir: text(notification.dir),
                silent: focused || notification.silent === true,
                data: { navigate: text(notification.navigate), id: text(notification.data?.id), context: text(notification.data?.context) },
            })

            clients.forEach((client) => client.postMessage({ type: SHOWN_MESSAGE, tag }))
        }),
    )
})

/** Asks a window to visit the URL with Inertia, and resolves whether it answered in time. */
const visitIn = (client, url) =>
    new Promise((resolve) => {
        const channel = new MessageChannel()
        const answer = (answered) => {
            clearTimeout(timer)
            channel.port1.close()
            resolve(answered)
        }
        const timer = setTimeout(() => answer(false), VISIT_TIMEOUT)

        channel.port1.onmessage = () => answer(true)

        client.postMessage({ type: VISIT_MESSAGE, url }, [channel.port2])
    })

// Opens the notification's page in a window of the application, which marks the notification as read. A window whose
// page does not answer, such as a page without the package, leaves it to a new window.
self.addEventListener('notificationclick', (event) => {
    event.notification.close()

    const url = event.notification.data?.navigate ?? new URL('/', self.location.origin).href

    event.waitUntil(
        windows().then(async (clients) => {
            const client = clients.find((candidate) => candidate.focused) ?? clients.find((candidate) => candidate.visibilityState === 'visible') ?? clients[0]

            if (client) {
                await client.focus().catch(() => {})

                if (await visitIn(client, url)) {
                    return
                }
            }

            await self.clients.openWindow(url)
        }),
    )
})

// The worker leaves `pushsubscriptionchange` alone: it cannot send the CSRF token that saving a subscription needs. The
// next page that the user loads subscribes again and saves the new subscription.
