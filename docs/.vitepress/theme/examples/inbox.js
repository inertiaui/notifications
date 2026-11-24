import { http } from '@inertiajs/vue3'
import { inboxStore, initNotifications, preferencesStore } from '@inertiaui/notifications-vue'

/*
 * A stand-in for a Laravel application in the browser, so the live examples run the real components. It answers the
 * JSON endpoints of `Route::inertiaNotifications()` like the package's InboxController and PreferencesController do,
 * from notifications that live in memory until the page reloads, and broadcasts new notifications on a fake Echo
 * connection, like the `InboxNotificationArrived` event does. Requests to other URLs go to Inertia's own HTTP client.
 */

/** The URL of the endpoints, as the shared prop holds it. Requests to it never leave the browser. */
export const DEMO_URL = '/docs-demo/inbox'

/** The private channel of the signed-in user, which the notification center broadcasts new notifications on. */
const CHANNEL = 'App.Models.User.1'

/** The event of `InboxNotificationArrived`, which the notification center listens for. */
const ARRIVED_EVENT = '.inertiaui.inbox.arrived'

/** Milliseconds before each answer, so the components show a change before the server confirms it, like they do in an application. */
const LATENCY = 150

/** Notifications per page, as if the application set the `per_page` option, so the panel loads more as the reader scrolls. */
const PER_PAGE = 8

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** The server stores times without fractions of a second. */
const seconds = (ms) => Math.floor(ms / 1000) * 1000

/** A time as Carbon's `toIso8601String()` writes it, or `null`. */
const iso = (ms) => (ms === null ? null : new Date(seconds(ms)).toISOString().replace('.000Z', '+00:00'))

let lastRevision = 0

/** The time in microseconds, which orders the counts and changes, like `Inbox::revision()`. */
const revision = () => (lastRevision = Math.max(lastRevision + 1, Date.now() * 1000))

const uuid = () => (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `demo-${Date.now()}-${Math.random().toString(16).slice(2)}`)

const notification = (fields) => ({
    body: null,
    actor: null,
    category: null,
    group: null,
    toast: null,
    actions: [],
    readAt: null,
    seenAt: null,
    archivedAt: null,
    snoozedUntil: null,
    result: null,
    quiet: false,
    ...fields,
})

/** The notifications of the signed-in user, created before `now`, with the times they were seen and read. */
function seed(now) {
    const ago = (ms) => seconds(now - ms)
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(9, 0, 0, 0)

    const seen = (createdAt) => ({ createdAt, seenAt: createdAt + MINUTE })
    const read = (createdAt) => ({ createdAt, seenAt: createdAt + MINUTE, readAt: createdAt + 2 * MINUTE })

    return [
        notification({
            id: '9d3c1b6e-0b7a-4c1e-9a64-5f0d2a8e1c47',
            type: 'App\\Notifications\\UserMentioned',
            title: 'Maria mentioned you in "Release checklist"',
            body: 'Can you double-check the upgrade steps before Friday?',
            actor: { name: 'Maria Garcia' },
            category: 'comments',
            createdAt: ago(3 * MINUTE),
        }),
        notification({
            id: '9d3c1b6e-1f2a-4b8e-8c35-0a6b7c8d9e10',
            type: 'App\\Notifications\\DeploymentFinished',
            title: 'Deployment to production finished',
            body: 'acme/web 3f9c2e1 is live on 3 servers.',
            category: 'deployments',
            createdAt: ago(12 * MINUTE),
        }),
        notification({
            id: '9d3c1b6e-2c4d-4e6f-a1b2-c3d4e5f60718',
            type: 'App\\Notifications\\AccessRequested',
            title: 'Daniel requested access to Acme Billing',
            body: 'He asked for the Developer role.',
            actor: { name: 'Daniel Okafor' },
            actions: [
                { label: 'Approve', event: 'access-request', payload: { approve: true }, result: 'Approved' },
                { label: 'Decline', event: 'access-request', payload: { approve: false }, result: 'Declined' },
            ],
            createdAt: ago(26 * MINUTE),
        }),
        notification({
            id: '9d3c1b6e-3a5b-4c7d-9e0f-1a2b3c4d5e6f',
            type: 'App\\Notifications\\CommentPosted',
            title: 'Sophie commented on issue #128',
            body: 'The fix works on main. Can we tag a release?',
            actor: { name: 'Sophie Martin' },
            category: 'comments',
            group: 'issue:128',
            ...seen(ago(41 * MINUTE)),
        }),
        notification({
            id: '9d3c1b6e-4b6c-4d8e-8f90-a1b2c3d4e5f6',
            type: 'App\\Notifications\\CommentPosted',
            title: 'Liam commented on issue #128',
            body: 'I can reproduce it with the queue worker running.',
            actor: { name: 'Liam Chen' },
            category: 'comments',
            group: 'issue:128',
            ...seen(ago(70 * MINUTE)),
        }),
        notification({
            id: '9d3c1b6e-5c7d-4e9f-a0b1-c2d3e4f5a6b7',
            type: 'App\\Notifications\\CommentPosted',
            title: 'Priya commented on issue #128',
            body: 'Looks like the flash data is cleared too early.',
            actor: { name: 'Priya Patel' },
            category: 'comments',
            group: 'issue:128',
            ...read(ago(2 * HOUR)),
        }),
        notification({
            id: '9d3c1b6e-6d8e-4fa0-b1c2-d3e4f5a6b7c8',
            type: 'App\\Notifications\\InvoicePaid',
            title: 'Invoice INV-1042 paid',
            body: 'Lumen Studio paid $1,250.00.',
            category: 'billing',
            toast: 'success',
            ...read(ago(3 * HOUR)),
        }),
        notification({
            id: '9d3c1b6e-7e9f-4ab1-c2d3-e4f5a6b7c8d9',
            type: 'App\\Notifications\\DeploymentFailed',
            title: 'Deployment to staging failed',
            body: 'The migrations failed on step 3 of 5.',
            category: 'deployments',
            ...read(ago(DAY + 2 * HOUR)),
        }),
        notification({
            id: '9d3c1b6e-8fa0-4bc2-d3e4-f5a6b7c8d9e0',
            type: 'App\\Notifications\\CardExpiring',
            title: 'Your card ending in 4242 expires next month',
            body: 'Update it to keep your subscription active.',
            category: 'billing',
            ...seen(ago(2 * DAY)),
        }),
        notification({
            id: '9d3c1b6e-9ab1-4cd3-e4f5-a6b7c8d9e0f1',
            type: 'App\\Notifications\\UsageReport',
            title: 'Your weekly usage report is ready',
            body: 'Requests are up 18% from last week.',
            ...read(ago(4 * DAY)),
        }),
        notification({
            id: '9d3c1b6e-abc2-4de4-f5a6-b7c8d9e0f1a2',
            type: 'App\\Notifications\\ReviewRequested',
            title: 'Noah requested your review on pull request #57',
            body: 'Retry queued broadcasts after a failed connection.',
            actor: { name: 'Noah Fischer' },
            category: 'comments',
            ...seen(ago(5 * HOUR)),
            snoozedUntil: tomorrow.getTime(),
        }),
        notification({
            id: '9d3c1b6e-bcd3-4ef5-a6b7-c8d9e0f1a2b3',
            type: 'App\\Notifications\\InvoicePaid',
            title: 'Invoice INV-1037 paid',
            body: 'Northwind Traders paid $480.00.',
            category: 'billing',
            ...read(ago(9 * DAY)),
            archivedAt: ago(8 * DAY),
        }),
    ]
}

let invoice = 1042
const comments = [
    { name: 'Emma Wilson', body: 'Confirmed, the fix in 3.4.1 solves it for us.' },
    { name: 'Liam Chen', body: 'Tagged 3.4.2 with the fix.' },
    { name: 'Sophie Martin', body: 'Thanks, closing this one.' },
]
const sha = () =>
    Math.floor(Math.random() * 0xfffffff)
        .toString(16)
        .padStart(7, '0')

/** The notifications that `sendDemoNotification()` sends in turn, each with the toast that its message asks for. */
const arrivals = [
    (turn) => {
        const { name, body } = comments[Math.floor(turn / arrivals.length) % comments.length]

        return {
            type: 'App\\Notifications\\CommentPosted',
            title: `${name.split(' ')[0]} commented on issue #128`,
            body,
            actor: { name },
            category: 'comments',
            group: 'issue:128',
            toast: 'default',
        }
    },
    () => ({
        type: 'App\\Notifications\\DeploymentFinished',
        title: 'Deployment to production finished',
        body: `acme/web ${sha()} is live on 3 servers.`,
        category: 'deployments',
        toast: 'success',
    }),
    () => ({
        type: 'App\\Notifications\\InvoicePaid',
        title: `Invoice INV-${++invoice} paid`,
        body: 'Lumen Studio paid $1,250.00.',
        category: 'billing',
        toast: 'success',
    }),
    () => ({
        type: 'App\\Notifications\\UserMentioned',
        title: 'Sam mentioned you in "Q4 roadmap"',
        body: 'Could you add the notification center to the plan?',
        actor: { name: 'Sam Carré' },
        category: 'comments',
        toast: 'default',
    }),
]

let notifications = []
let sent = 0
/** The group keys of the threads that the user muted. */
const mutes = new Set()
/** The time the user paused notifications until, or `null`. */
let pausedUntil = null

const isPaused = (now = Date.now()) => pausedUntil !== null && pausedUntil > now

const isSnoozed = (record, now = Date.now()) => record.snoozedUntil !== null && record.snoozedUntil > now
const isActive = (record) => record.archivedAt === null && !isSnoozed(record)

/** A notification in the shape of `InboxNotification::toInboxArray()`. */
const toItem = (record, itemRevision) => ({
    id: record.id,
    type: record.type,
    title: record.title,
    body: record.body,
    icon: null,
    image: null,
    url: null,
    actions: record.actions,
    actor: record.actor,
    actors: record.actor ? [record.actor] : [],
    actorCount: record.actor ? 1 : 0,
    total: 1,
    toast: record.toast,
    category: record.category,
    group: record.group,
    data: {},
    readAt: iso(record.readAt),
    seenAt: iso(record.seenAt),
    archivedAt: iso(record.archivedAt),
    snoozedUntil: iso(record.snoozedUntil),
    result: record.result,
    muted: record.group !== null && mutes.has(record.group),
    createdAt: iso(record.createdAt),
    revision: itemRevision,
    announcement: false,
    expiresAt: null,
    // The server leaves `quiet` out unless the notification is quiet.
    ...(record.quiet ? { quiet: true } : {}),
})

/** The counts in the shape of `Inbox::summary()`. */
function summary() {
    const currentRevision = revision()
    const active = notifications.filter(isActive)
    const categories = {}

    for (const record of active) {
        if (record.readAt === null && record.category !== null) {
            categories[record.category] = (categories[record.category] ?? 0) + 1
        }
    }

    const newest = notifications.length > 0 ? Math.max(...notifications.map((record) => record.createdAt)) : null

    return {
        unread: active.filter((record) => record.readAt === null).length,
        unseen: active.filter((record) => record.seenAt === null).length,
        // PHP sends an empty object as an empty array.
        categories: Object.keys(categories).length > 0 ? categories : [],
        latest: iso(newest),
        latestIds: notifications.filter((record) => record.createdAt === newest).map((record) => record.id),
        revision: currentRevision,
    }
}

// The options of the demo's config that an example sets, such as the `inbox.category_filter` of the category example.
const config = { categoryFilter: {} }

const sharedProp = () => ({
    url: DEMO_URL,
    channel: CHANNEL,
    announcementsChannel: null,
    user: '4d1f0c6b2a9e8d7c5b3a1f0e9d8c7b6a',
    allowedActions: ['snooze', 'archive', 'mute'],
    selectable: true,
    // PHP sends an empty object as an empty array.
    categoryFilter: Object.keys(config.categoryFilter).length > 0 ? config.categoryFilter : [],
    tabs: [],
    // The application offers pausing, as with the `pause.enabled` option.
    pause: { until: isPaused() ? iso(pausedUntil) : null, presets: [30, 60, 120, 'tomorrow'] },
    ...summary(),
})

const fail = (status, message) => {
    throw Object.assign(new Error(message), { status })
}

const find = (id) => notifications.find((record) => record.id === id) ?? fail(404, 'No query results for model [InboxNotification].')

const itemChange = (record) => ({
    kind: 'item',
    id: record.id,
    readAt: iso(record.readAt),
    seenAt: iso(record.seenAt),
    archivedAt: iso(record.archivedAt),
    snoozedUntil: iso(record.snoozedUntil),
    result: record.result,
})

const respond = (change) => ({ counts: summary(), change })

/** The methods of the notification model, by the action of the batch endpoint. */
const methods = {
    read: (record, now) => {
        if (record.readAt === null) {
            record.readAt = now
            record.seenAt ??= now
        }
    },
    unread: (record) => void (record.readAt = null),
    seen: (record, now) => void (record.seenAt ??= now),
    archive: (record, now) => void (record.archivedAt ??= now),
    unarchive: (record) => void (record.archivedAt = null),
    unsnooze: (record) => void (record.snoozedUntil = null),
}

/** An endpoint that changes one notification with the given method and responds with its new state. */
const changing = (method) => (record) => {
    method(record, Date.now())

    return respond(itemChange(record))
}

/** The endpoints of one notification, by the last segment of their path. */
const itemEndpoints = {
    read: changing(methods.read),
    unread: changing(methods.unread),
    archive: changing(methods.archive),
    unarchive: changing(methods.unarchive),
    unsnooze: changing(methods.unsnooze),
    snooze: (record, body) => {
        const until = Date.parse(body.until)

        if (Number.isNaN(until) || until <= Date.now()) {
            fail(422, 'The until field must be a date after now.')
        }

        record.snoozedUntil = until

        return respond(itemChange(record))
    },
    complete: (record, body) => {
        const result = Number.isInteger(body.action) ? record.actions[body.action]?.result : undefined

        if (typeof result !== 'string') {
            fail(422, 'The action has no result.')
        }

        record.result = result

        return respond(itemChange(record))
    },
    mute: (record) => mute(record, true),
    unmute: (record) => mute(record, false),
    // Deleting is not one of the demo's actions, so its endpoint is not found.
    delete: () => fail(404, 'Not found.'),
}

function mute(record, muted) {
    if (record.group === null) {
        fail(422, 'The notification has no group key.')
    }

    if (muted) {
        mutes.add(record.group)
    } else {
        mutes.delete(record.group)
    }

    return respond({ kind: 'mute', group: record.group, muted })
}

/** Pauses notifications until a future time, like `InboxController::pause()`. */
function pause(body) {
    const until = Date.parse(body.until)

    if (Number.isNaN(until) || until <= Date.now()) {
        fail(422, 'The until field must be a date after now.')
    }

    pausedUntil = seconds(until)

    return respond({ kind: 'pause', until: iso(pausedUntil) })
}

function resume() {
    pausedUntil = null

    return respond({ kind: 'pause', until: null })
}

/** The notifications that a bulk update covers, like `InboxController::bulk()`, and the change that describes them. */
function bulk(kind, body) {
    const now = Date.now()
    const before = body.before ? Date.parse(body.before) : now
    const ids = body.before && Array.isArray(body.ids) ? body.ids : null
    const category = typeof body.category === 'string' ? body.category : null
    const records = notifications.filter(
        (record) =>
            (category === null || record.category === category) &&
            (ids === null ? record.createdAt <= before : record.createdAt < before || (record.createdAt === before && ids.includes(record.id))),
    )

    return { now, records, change: { kind, before: iso(before), ids, category } }
}

function readAll(body) {
    const { now, records, change } = bulk('read', body)

    records.filter((record) => isActive(record) && record.readAt === null).forEach((record) => Object.assign(record, { readAt: now, seenAt: now }))

    return respond(change)
}

function seenAll(body) {
    const { now, records, change } = bulk('seen', body)

    records.forEach((record) => methods.seen(record, now))

    return respond(change)
}

function archiveAll(body) {
    const { now, records, change } = bulk('archive', body)
    const onlyRead = body.read === true

    records.filter((record) => record.archivedAt === null && (!onlyRead || record.readAt !== null)).forEach((record) => (record.archivedAt = now))

    return respond({ ...change, onlyRead })
}

function batch(body) {
    // Deleting is not one of the demo's actions, so its batch is not found.
    if (body.action === 'delete') {
        fail(404, 'Not found.')
    }

    const until = body.action === 'snooze' ? Date.parse(body.until) : undefined

    if (
        !['read', 'unread', 'seen', 'archive', 'unarchive', 'snooze', 'unsnooze'].includes(body.action) ||
        !Array.isArray(body.ids) ||
        body.ids.length > 100 ||
        (until !== undefined && !(until > Date.now()))
    ) {
        fail(422, 'The given data was invalid.')
    }

    const now = Date.now()
    const records = notifications.filter((record) => body.ids.includes(record.id))

    records.forEach((record) => (until === undefined ? methods[body.action](record, now) : (record.snoozedUntil = until)))

    return respond({
        kind: 'items',
        action: body.action,
        ids: records.map((record) => record.id),
        at: iso(now),
        ...(until === undefined ? {} : { until: iso(until) }),
    })
}

/** Marks the given notifications as seen, like the `seen/items` endpoint that the panel calls for what it showed. */
function seenItems(body) {
    return batch({ action: 'seen', ids: body.ids })
}

/** One page of notifications, like `Inbox::paginate()`, with the counts read before it. */
function index(query) {
    const filter = query.get('filter') ?? 'all'
    const category = query.get('category')
    const perPage = Number(query.get('per_page') ?? PER_PAGE)
    const offset = Number(query.get('cursor') ?? 0)

    if (!['all', 'unread', 'snoozed', 'archived'].includes(filter) || !Number.isInteger(perPage) || perPage < 1 || perPage > 100) {
        fail(422, 'The given data was invalid.')
    }

    const counts = summary()
    const now = Date.now()
    const matches = {
        all: isActive,
        unread: (record) => isActive(record) && record.readAt === null,
        snoozed: (record) => record.archivedAt === null && isSnoozed(record, now),
        archived: (record) => record.archivedAt !== null,
    }
    const records = notifications
        .filter((record) => matches[filter](record) && (category === null || record.category === category))
        .sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id))
    const itemRevision = revision()

    return {
        items: records.slice(offset, offset + perPage).map((record) => toItem(record, itemRevision)),
        nextCursor: offset + perPage < records.length ? String(offset + perPage) : null,
        counts,
    }
}

/*
 * The preferences, as `config/inertia-notifications.php` lists them on the Preferences Setup page. Notification hours
 * show while an example asks for them, as if the application turned on the `notification_hours` option, and the demo
 * user's hours are on weekdays from 08:00 to 18:00.
 */
const CHANNELS = [
    { key: 'inbox', label: 'In the app', globalSwitch: true },
    { key: 'mail', label: 'Email', globalSwitch: true },
]

const CATEGORIES = [
    { key: 'comments', label: 'Comments', description: 'Replies to the issues you follow.', channels: ['inbox', 'mail'] },
    { key: 'billing', label: 'Billing', channels: ['mail'] },
    { key: 'security', label: 'Security', locked: true, channels: ['inbox', 'mail'] },
    { key: 'product', label: 'Product updates', optIn: true, channels: ['inbox', 'mail'] },
]

const choices = { channels: {}, categories: {} }
const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

const notificationHours = {
    enabled: false,
    days: Object.fromEntries(WEEKDAYS.map((day) => [day, ['saturday', 'sunday'].includes(day) ? [] : ['08:00-18:00']])),
}
let offersNotificationHours = false

/** Whether the user receives the category on the channel, like `NotificationPreferences::allows()`. */
const allows = (key, channel) => {
    const category = CATEGORIES.find((candidate) => candidate.key === key)

    if (!category || category.locked || !category.channels.includes(channel)) {
        return true
    }

    return choices.channels[channel] !== false && (choices.categories[key]?.[channel] ?? !category.optIn)
}

/** Whether the category arrives quietly, like `DoNotDisturb::silences()`: a pause covers the categories of the config, except the locked ones. */
const silences = (key) => {
    const category = CATEGORIES.find((candidate) => candidate.key === key)

    return category !== undefined && !category.locked && isPaused()
}

/** The preferences in the shape of `NotificationPreferences::for()`. */
const preferences = () => ({
    channels: CHANNELS.map((channel) => ({ ...channel, enabled: choices.channels[channel.key] ?? true, digest: false })),
    groups: [],
    categories: CATEGORIES.map((category) => ({
        key: category.key,
        label: category.label,
        description: category.description ?? null,
        group: null,
        locked: category.locked === true,
        channels: Object.fromEntries(
            category.channels.map((channel) => [channel, category.locked === true || (choices.categories[category.key]?.[channel] ?? !category.optIn)]),
        ),
        frequency: null,
    })),
    notificationHours: offersNotificationHours ? { enabled: notificationHours.enabled, days: { ...notificationHours.days } } : null,
    frequencies: ['instant', 'hourly', 'daily', 'weekly'],
})

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const isRange = (value) => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/.test(value)

/**
 * The notification hours after the changes of a request, in which each given day replaces that day's ranges. Like the
 * server, it rejects ranges that are not times of day, and hours without a range on any day.
 */
function changedNotificationHours(hours) {
    const days = isRecord(hours) ? (hours.days ?? {}) : undefined

    if (
        !isRecord(days) ||
        (hours.enabled !== undefined && typeof hours.enabled !== 'boolean') ||
        Object.entries(days).some(([day, ranges]) => !WEEKDAYS.includes(day) || !Array.isArray(ranges) || !ranges.every(isRange))
    ) {
        fail(422, 'The notification hours must be ranges of times on the days of the week, such as 09:00-17:00.')
    }

    const changed = {
        enabled: hours.enabled ?? notificationHours.enabled,
        days: Object.fromEntries(WEEKDAYS.map((day) => [day, [...(days[day] ?? notificationHours.days[day])].sort()])),
    }

    if (Object.values(changed.days).every((ranges) => ranges.length === 0)) {
        fail(422, 'The notification hours must have a range on at least one day.')
    }

    return changed
}

/** Saves the choices that the request sends, and leaves out the locked categories and what the config does not list. */
function updatePreferences(body) {
    const { preferences: categories, channels, notificationHours: hours } = body

    if (categories === undefined && channels === undefined && body.frequencies === undefined && hours === undefined) {
        fail(422, 'The preferences field is required.')
    }

    const changed = hours === undefined ? undefined : changedNotificationHours(hours)

    for (const [key, values] of Object.entries(categories ?? {})) {
        const category = CATEGORIES.find((candidate) => candidate.key === key)

        for (const [channel, enabled] of Object.entries(values ?? {})) {
            if (category && !category.locked && category.channels.includes(channel)) {
                choices.categories[key] = { ...choices.categories[key], [channel]: enabled === true }
            }
        }
    }

    for (const [channel, enabled] of Object.entries(channels ?? {})) {
        if (CHANNELS.some((candidate) => candidate.key === channel && candidate.globalSwitch)) {
            choices.channels[channel] = enabled === true
        }
    }

    if (changed !== undefined && offersNotificationHours) {
        Object.assign(notificationHours, changed)
    }

    return preferences()
}

/** Answers a request like the routes of `Route::inertiaNotifications()`, in the order they are registered. */
function route(method, path, query, body) {
    if (path === '' && method === 'get') {
        return index(query)
    }

    if (path === 'counts' && method === 'get') {
        return { counts: summary() }
    }

    if (path === 'preferences') {
        return method === 'get' ? preferences() : updatePreferences(body)
    }

    const bulkEndpoints = { seen: seenAll, 'seen/items': seenItems, read: readAll, archive: archiveAll, batch, pause, resume }

    if (method === 'post' && Object.hasOwn(bulkEndpoints, path)) {
        return bulkEndpoints[path](body)
    }

    const [id, action, ...rest] = path.split('/').map(decodeURIComponent)

    if (rest.length === 0 && action === undefined && method === 'get') {
        return { item: toItem(find(id), revision()), counts: summary() }
    }

    if (rest.length === 0 && method === 'post' && Object.hasOwn(itemEndpoints, action)) {
        return itemEndpoints[action](find(id), body)
    }

    return fail(404, 'Not found.')
}

const demoPath = (url) => {
    const parsed = new URL(url, window.location.origin)

    return parsed.origin === window.location.origin && (parsed.pathname === DEMO_URL || parsed.pathname.startsWith(`${DEMO_URL}/`)) ? parsed : undefined
}

/** A client for Inertia's HTTP requests, which answers the requests to the demo's URL and sends the others on. */
function demoClient(fallback) {
    return {
        async request(config) {
            const url = demoPath(config.url)

            if (url === undefined) {
                return fallback.request(config)
            }

            await new Promise((resolve) => setTimeout(resolve, LATENCY))

            const body = typeof config.data === 'string' ? JSON.parse(config.data) : (config.data ?? {})
            const headers = { 'content-type': 'application/json' }

            try {
                const data = route(config.method.toLowerCase(), url.pathname.slice(DEMO_URL.length + 1), url.searchParams, body)

                return { status: 200, data: JSON.stringify(data), headers }
            } catch (error) {
                if (error.status === undefined) {
                    throw error
                }

                throw Object.assign(new Error(`Request failed with status ${error.status}`), {
                    response: { status: error.status, data: JSON.stringify({ message: error.message }), headers },
                })
            }
        },
    }
}

/** The callbacks that listen on the fake Echo connection, by channel and event. */
const listeners = new Map()

/** The parts of Laravel Echo that the notification center uses, connected to nothing. */
const echo = {
    private(channel) {
        return {
            listen(event, callback) {
                const key = `${channel}|${event}`
                listeners.set(key, new Set(listeners.get(key)).add(callback))

                return this
            },
            stopListening(event, callback) {
                listeners.get(`${channel}|${event}`)?.delete(callback)

                return this
            },
        }
    },
    socketId: () => null,
}

const broadcast = (event, payload) => listeners.get(`${CHANNEL}|${event}`)?.forEach((callback) => callback(payload))

let installed = false

/**
 * Signs in the demo user: answers the demo's requests in the browser, passes the fake Echo connection to the
 * notification center, and shows the shared prop, as the first page of an application would. Call it in the setup
 * of a component that only renders in the browser, before the notification center components mount.
 */
export function installDemoInbox(options = {}) {
    if (typeof window === 'undefined') {
        return
    }

    // An example that sets an option of the config shares it with the other examples of the page, as one app would.
    const changes = Object.entries(options).filter(([key, value]) => JSON.stringify(config[key]) !== JSON.stringify(value))
    Object.assign(config, Object.fromEntries(changes))

    if (installed) {
        if (changes.length > 0) {
            inboxStore.sync({ inertiauiInbox: sharedProp() }, 'visit')
        }

        return
    }

    installed = true
    notifications = seed(Date.now())
    http.setClient(demoClient(http.getClient()))
    initNotifications({ inbox: { echo } })

    if (inboxStore.getSnapshot().url === undefined) {
        inboxStore.sync({ inertiauiInbox: sharedProp() }, 'initial')
    }
}

/**
 * Stores the next notification and broadcasts it to the user's channel, like sending a notification through the
 * `inbox` channel while `broadcast_notifications` is enabled. Like the server, it sends nothing for a muted thread or
 * for a category that the user turned off in the app, and while the user paused notifications, a category of the
 * config that is not locked arrives quietly, without a toast. Notification hours never make a notification quiet
 * here, because the inbox examples use a config that does not offer them, and `NotificationHours::within()` lets
 * every notification through then.
 */
export function sendDemoNotification() {
    installDemoInbox()

    for (let tries = 0; tries < arrivals.length; tries++) {
        const turn = sent++
        const fields = arrivals[turn % arrivals.length](turn)

        if ((fields.group === undefined || !mutes.has(fields.group)) && allows(fields.category, 'inbox')) {
            const record = notification({ id: uuid(), createdAt: seconds(Date.now()), ...fields, quiet: silences(fields.category) })
            notifications.unshift(record)
            broadcast(ARRIVED_EVENT, { item: toItem(record, null) })

            return
        }
    }
}

/**
 * Signs in the demo user for a `NotificationPreferences` example, with or without the notification hours. Every
 * component shares one store, so a change loads the preferences again.
 */
export function installDemoPreferences({ notificationHours: offered = false } = {}) {
    installDemoInbox()

    if (offered !== offersNotificationHours) {
        offersNotificationHours = offered
        preferencesStore.reset(DEMO_URL)
    }
}
