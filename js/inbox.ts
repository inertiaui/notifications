import { actionHref, followLinkAction, followsInBrowser, isModifiedClick, performAction, sameOrigin, type ActionClick } from './actions'
import { isRecord, isToastType, parseActions, safeHref, textOrNull } from './flash'
import type { InertiaBindings, NavigationType } from './inertia'
import { defaultLabels, formatTranslation, labelsWith, type TranslationValue } from './translations'
import type { ToastAction, ToastType } from './types'

/** A built-in filter of the notification list, or the key of a tab that the application added in the `inbox.tabs` config. */
export type InboxFilter = 'all' | 'unread' | 'snoozed' | 'archived' | (string & {})

/** A tab that the application added in the `inbox.tabs` config: the notifications of a category, with the given data. */
export interface InboxTab {
    label: string
    category: string | null
    /** Values of the `InboxMessage::with()` data that the notifications have. */
    data: Readonly<Record<string, string | number | boolean>>
}

export interface InboxCounts {
    /** Notifications in the inbox that the user has not read. */
    unread: number
    /** Notifications in the inbox that arrived since the user last opened it. */
    unseen: number
}

const BATCH_ACTIONS = ['read', 'unread', 'seen', 'archive', 'unarchive', 'snooze', 'unsnooze', 'delete'] as const

/** What `batch()` does to the notifications it is given. */
export type InboxBatchAction = (typeof BATCH_ACTIONS)[number]

/** What users may do with their notifications besides reading them, as the server's `inbox.actions` config offers it. */
export type InboxAction = 'snooze' | 'archive' | 'mute' | 'delete'

const INBOX_ACTIONS: readonly InboxAction[] = ['snooze', 'archive', 'mute', 'delete']

/** The actions that the server offers without an `inbox.actions` config, until a page shares the ones it offers. */
const DEFAULT_ACTIONS: readonly InboxAction[] = ['snooze', 'archive', 'mute']

/** The action of the `inbox.actions` config that a batch action needs. Reading needs none. */
const BATCH_ACTION_NEEDS: Partial<Record<InboxBatchAction, InboxAction>> = {
    archive: 'archive',
    unarchive: 'archive',
    snooze: 'snooze',
    unsnooze: 'snooze',
    delete: 'delete',
}

/** Whether the list of the filter is offered: the Snoozed and Archived lists need snoozing and archiving. */
export const offersFilter = (filter: InboxFilter, allowedActions: readonly InboxAction[]): boolean =>
    (filter !== 'snoozed' || allowedActions.includes('snooze')) && (filter !== 'archived' || allowedActions.includes('archive'))

/** The most notifications that one request of `batch()` changes, like the server's limit. Larger batches are split. */
const BATCH_SIZE = 100

/** A change of the notification center, from the user's other sessions or from the server's response to a change. */
export type InboxChange =
    | {
          kind: 'item'
          id: string
          readAt: string | null
          seenAt: string | null
          archivedAt: string | null
          snoozedUntil: string | null
          result: string | null
      }
    /**
     * Bulk changes cover the notifications created before `before`, and those created at that time whose IDs are in `ids`, or all of them
     * when `ids` is null. A `category` limits them to the notifications of that category.
     */
    | { kind: 'read' | 'seen'; before: string; ids: readonly string[] | null; category: string | null }
    | { kind: 'archive'; before: string; ids: readonly string[] | null; category: string | null; onlyRead: boolean }
    /** The notifications with these IDs were deleted, such as by the user or by `Inbox::retract()` on the server. */
    | { kind: 'delete'; ids: readonly string[] }
    /** The server replaced the message of the notification with `Inbox::update()`. The item holds its new title, body, and data. */
    | { kind: 'update'; item: InboxItem }
    /** The notifications with these IDs were changed at `at`, such as marked as read with `batch()`. A snooze lasts `until`. */
    | { kind: 'items'; action: Exclude<InboxBatchAction, 'delete'>; ids: readonly string[]; at: string; until?: string }
    /** The user muted or unmuted the thread of the group key, with `mute()` or `unmute()`. */
    | { kind: 'mute'; group: string; muted: boolean }
    /** The user paused notifications until `until` with `pause()`, or resumed them with `resume()`, when it is `null`. */
    | { kind: 'pause'; until: string | null }

/** The person or thing that caused a notification, such as the user who commented. */
export interface InboxActor {
    name?: string
    avatar?: string
}

/** A notification in the notification center, as the server sends it. */
export interface InboxItem {
    id: string
    type: string
    title: string
    body: string | null
    icon: string | null
    image: string | null
    url: string | null
    actions: readonly ToastAction<InboxItem>[]
    actor: InboxActor | null
    /** The newest actors of a notification that later ones collapsed into with `InboxMessage::collapse()`, newest first. */
    actors: readonly InboxActor[]
    /** The number of different actors, also those that `actors` leaves out. */
    actorCount: number
    /** The number of notifications that collapsed into this one, including itself. */
    total: number
    category: string | null
    group: string | null
    /** The type of the toast that `InboxMessage::toast()` asked for, shown when the notification arrives in real time. */
    toast: ToastType | null
    /** Extra data from `InboxMessage::with()`. */
    data: Record<string, unknown>
    readAt: string | null
    seenAt: string | null
    archivedAt: string | null
    /** The notification is left out of the inbox and its counts until this time. */
    snoozedUntil: string | null
    /** The result of an action that ran, such as "Approved", which shows in place of the actions. */
    result: string | null
    /** Whether the user muted the thread of the notification's group key, so later notifications in it no longer reach them. */
    muted: boolean
    /** Sent outside the user's notification hours or while they paused, so it arrives without a toast, a sound, or a desktop notification. */
    quiet?: true
    createdAt: string
    /** When the server read this copy of the notification, in microseconds, which orders it against other copies and changes. `null` when unknown. */
    revision: number | null
    /** Whether this is an announcement, which `Announcement::publish()` stores once for every user in its audience. */
    announcement: boolean
    /** The announcement leaves the notification center at this time. `null` for notifications and announcements without an expiry. */
    expiresAt: string | null
}

export interface InboxState {
    /** The URL of the inbox routes, from the shared prop; `undefined` until a signed-in page was shown. */
    url: string | undefined
    /** An opaque identity of the signed-in user, from the shared prop. The store forgets everything when it changes. */
    user: string | undefined
    /** The private channel that receives the user's broadcast notifications, from the shared prop. */
    channel: string | null
    /** The private channel that announcements are broadcast on, from the shared prop. `null` unless the server broadcasts them. */
    announcementsChannel: string | null
    /**
     * What the user may do with notifications besides reading them, from the server's `inbox.actions` config. The panel
     * shows no buttons or tabs for the other actions, and the store skips them.
     */
    allowedActions: readonly InboxAction[]
    /**
     * Whether the user may select notifications to change them together, from the server's `inbox.selectable` config.
     * While it is `false`, the panel has no checkboxes, and `batch()` only marks notifications as seen.
     */
    selectable: boolean
    /** The categories that the panel filters by, with their labels, in order, from the server's `inbox.category_filter` config. */
    categoryFilter: Readonly<Record<string, string>>
    /** The tabs that the application added in the server's `inbox.tabs` config, by key. */
    tabs: Readonly<Record<string, InboxTab>>
    counts: InboxCounts
    /** The notifications the panel loaded for `filter`, and those that arrived since, with the user's changes applied. */
    items: readonly InboxItem[]
    /** Notifications that arrived in real time, newest first, without the user's changes. Lists from pages show them first. */
    arrived: readonly InboxItem[]
    filter: InboxFilter
    /** The category the panel's list shows, or `null` for every category. */
    category: string | null
    /** The unread notifications in the inbox, by category. Categories without unread notifications are left out. */
    categoryCounts: Readonly<Record<string, number>>
    status: 'idle' | 'loading' | 'ready' | 'error'
    loadingMore: boolean
    /** Loading the next page failed; it loads again only when asked with `loadMore({ retry: true })` or when the list reloads. */
    moreFailed: boolean
    hasMore: boolean
    /** The index of the running action, by notification ID. */
    pendingActions: Readonly<Record<string, number>>
    /**
     * Notifications are paused until this time, so they arrive without a toast, a sound, or a desktop notification, and
     * emails wait. `null` while they are not paused, once the time has passed, and while the application does not offer pausing.
     */
    pausedUntil: string | null
    /** Whether the application offers pausing notifications, from the shared prop. */
    canPause: boolean
    /** The times of the pause button, from the server's `pause.presets` config: numbers of minutes, and `'tomorrow'`. */
    pausePresets: readonly PausePreset[]
}

type ItemState = Pick<InboxItem, 'readAt' | 'seenAt' | 'archivedAt' | 'snoozedUntil' | 'result'>
type BulkChange = Extract<InboxChange, { kind: 'read' | 'seen' | 'archive' }>
type ItemsChange = Extract<InboxChange, { kind: 'items' }>
/** A change of many notifications that the store keeps, and applies to the copies of notifications that the server read before it. */
type SavedChange = BulkChange | ItemsChange

export interface InboxStore {
    subscribe(listener: () => void): () => void
    getSnapshot(): InboxState
    /**
     * The state before any page was shown, which the server renders. Components render it until they mount, so the
     * first render in the browser matches the server's HTML even when the store received the first page before.
     */
    getServerSnapshot(): InboxState
    connect(
        bindings: InertiaBindings,
        options?: {
            prop?: string
            onFailure?: (error: unknown) => void
        },
    ): void
    /**
     * Reads the counts and URL from the shared prop of a page, and forgets everything when the user signed out or
     * another user signed in. Ignores pages from history and the prefetch cache, whose props may be outdated.
     */
    sync(props: Record<string, unknown> | undefined, type: NavigationType): void
    /** Loads the first page of the filter, in one category or every one. A filter without a category shows every category. */
    load(filter?: InboxFilter, category?: string | null): Promise<void>
    /** Loads the next page. After a failure, only with `retry`, so a list that stays in view does not try again and again. */
    loadMore(options?: { retry?: boolean }): Promise<void>
    /** Requests the counts from the server. */
    refresh(): Promise<void>
    /**
     * Requests a notification or announcement that the server broadcast as new without its content, such as a published
     * announcement, and adds it like `receive()`. The server only finds it for the users who see it, so for other users,
     * and in another context than the item's own, nothing changes. Returns the notification, or `undefined`.
     */
    loadArrival(id: string, context?: string | null): Promise<InboxItem | undefined>
    /**
     * Adds a notification that arrived in real time, such as from Laravel Echo, and counts it unless the counts
     * already include it. Returns the notification, or `undefined` when it is invalid or arrived before.
     *
     * A notification that collapsed into one the store already has comes with the `counts` after it, so it replaces
     * the earlier copy in the counts instead of adding to them.
     */
    receive(value: unknown, counts?: unknown): InboxItem | undefined
    /**
     * Calls the listener once for each notification that `receive()` adds, such as one from Laravel Echo or a snoozed
     * notification that came back, after the store shows it. Returns a function that stops it.
     */
    onArrival(listener: (item: InboxItem) => void): () => void
    /** Applies a change from another session of the user, with the counts after it: an `InboxChanged` broadcast. */
    receiveChange(value: unknown): void
    /**
     * Calls the listener once for each change that `receiveChange()` applies, such as a notification that the server
     * updated or retracted. Returns a function that stops it.
     */
    onChange(listener: (change: InboxChange) => void): () => void
    /** Applies the user's changes, such as marking as read, to a notification from a page prop. */
    apply(item: InboxItem): InboxItem
    /** Whether a notification belongs in the list for the filter and category, after the user's changes. */
    belongs(item: InboxItem, filter: InboxFilter, category?: string | null): boolean
    /** Remembers notifications that a page shows, so bulk actions cover them. */
    remember(items: readonly InboxItem[]): void
    /** Marks a notification as read: one that a list shows, or the ID of one, such as from a toast. */
    markAsRead(item: InboxItem | string): Promise<void>
    markAsUnread(item: InboxItem): Promise<void>
    /** Archives the notification. Does nothing while the server's `inbox.actions` config leaves out archiving, like `unarchive()`. */
    archive(item: InboxItem): Promise<void>
    unarchive(item: InboxItem): Promise<void>
    /**
     * Leaves the notification out of the inbox and its counts until the given time. Does nothing while the server's
     * `inbox.actions` config leaves out snoozing, like `unsnooze()`.
     */
    snooze(item: InboxItem, until: Date | string): Promise<void>
    unsnooze(item: InboxItem): Promise<void>
    /** Deletes the notification for good. Does nothing unless the server's `inbox.actions` config offers deleting. */
    delete(item: InboxItem): Promise<void>
    /**
     * Saves the `result` of the notification's action at the index, such as "Approved", which then shows in place of its
     * actions. Takes a notification that a list shows, or the ID of one, such as from a toast. `runAction()` calls it
     * once an action with a result ran.
     */
    complete(item: InboxItem | string, index: number): Promise<void>
    /**
     * Mutes the thread of the notification's group key, so later notifications in it no longer reach the user, unless
     * they mention the user. The notifications in it that the user has stay. Does nothing without a group key, and while
     * the server's `inbox.actions` config leaves out muting, like `unmute()`.
     */
    mute(item: InboxItem): Promise<void>
    /** Unmutes the thread of the notification's group key. */
    unmute(item: InboxItem): Promise<void>
    /**
     * Pauses notifications until the given time: they arrive without a toast, a sound, or a desktop notification, and
     * emails wait. Does nothing while the application does not offer pausing.
     */
    pause(until: Date | string): Promise<void>
    /** Resumes paused notifications. */
    resume(): Promise<void>
    /**
     * Marks the given notifications as read, unread, or seen, archives or unarchives them, snoozes them until the given
     * time or unsnoozes them, or deletes them, in one request for every 100 notifications. Does nothing for an action
     * that the server's `inbox.actions` config leaves out, such as deleting by default, and for every action but
     * `'seen'` while the server's `inbox.selectable` config is off.
     */
    batch(action: InboxBatchAction, items: readonly InboxItem[], until?: Date | string): Promise<void>
    /**
     * Marks the notifications of the selected category, or of every category, as read. A `category` option, or `null`
     * for every category, takes the place of the selected one, such as the category of a page's `NotificationList`.
     */
    markAllAsRead(options?: { category?: string | null }): Promise<void>
    /** Marks every notification as seen, whatever the selected category. */
    markAllAsSeen(): Promise<void>
    /**
     * Archives the notifications of the selected category, or of every category, or only the read ones. Like
     * `markAllAsRead()`, it takes a `category` option. Does nothing while the server's `inbox.actions` config leaves
     * out archiving.
     */
    archiveAll(options?: { onlyRead?: boolean; category?: string | null }): Promise<void>
    /**
     * Call when a panel that shows the list opens: loads the list when it is not loaded yet or new notifications
     * arrived, then marks the loaded notifications as seen. Notifications that arrive while it is open are seen too.
     * With the panel's tabs, a list of another filter switches to the first tab. With the panel's categories, a list
     * of another category, which another panel selected, switches to every category. A panel that marks the
     * notifications it shows as seen itself, such as the `NotificationCenter`, passes `markAllAsSeen: false`.
     */
    opened(tabs?: readonly InboxFilter[], options?: { markAllAsSeen?: boolean; categories?: readonly string[] }): Promise<void>
    /** Call when a panel that called `opened()` closes, with the same options. */
    closed(options?: { markAllAsSeen?: boolean }): void
    /**
     * Marks the notification as read and visits its URL, if it has one. A modified click, such as one that opens a new
     * tab, is left to the browser, and a click whose default was prevented, such as by an `onItemClick` listener, does
     * nothing.
     */
    open(item: InboxItem, event?: ActionClick): void
    /**
     * Marks the notification as read and runs one of its actions. A click on a link that opens with a modifier key, in a
     * new tab, or in the browser, or that leads to another origin, is left to the browser; everything else runs the
     * action, such as a click on a button. A click whose default was prevented, such as by an `onAction` listener, does
     * nothing. An action with a `result` saves it with `complete()` once it succeeded, and a link that the browser loads
     * in this tab waits for the result to save.
     */
    runAction(item: InboxItem, index: number, event?: ActionClick): void
}

/** The methods of the store that the `useNotifications()` hooks return, for building a custom bell or panel. */
export type InboxActions = Omit<
    InboxStore,
    'subscribe' | 'getSnapshot' | 'connect' | 'sync' | 'apply' | 'belongs' | 'remember' | 'onArrival' | 'onChange' | 'getServerSnapshot' | 'loadArrival'
>

export const DEFAULT_INBOX_PROP = 'inertiauiInbox'

const time = (value: string | null | undefined): number => (value ? Date.parse(value) : Number.NaN)

/** The unread notifications of the selected category, or of every category, which marking all as read changes. */
export const selectedUnread = ({ counts, category, categoryCounts }: Pick<InboxState, 'counts' | 'category' | 'categoryCounts'>): number =>
    category === null ? counts.unread : (categoryCounts[category] ?? 0)

/** Whether the announcement's expiry has passed, so it no longer shows. */
export const isExpired = (item: Pick<InboxItem, 'expiresAt'>): boolean => item.expiresAt !== null && time(item.expiresAt) <= Date.now()

/** Whether the notification is snoozed until a time that has not come yet, by the given clock in milliseconds or else now. */
export const isSnoozed = (item: Pick<InboxItem, 'snoozedUntil'>, now = Date.now()): boolean => item.snoozedUntil !== null && time(item.snoozedUntil) > now

/** Adds `delta` to the count of a category. Categories without unread notifications are left out. */
const bump = (counts: Readonly<Record<string, number>>, category: string | null, delta: number): Readonly<Record<string, number>> => {
    if (category === null || delta === 0) {
        return counts
    }

    const { [category]: current = 0, ...rest } = counts
    const next = Math.max(0, current + delta)

    return next === 0 ? rest : { ...rest, [category]: next }
}

/**
 * Whether a copy of a notification is newer than another: created later, such as a snoozed notification that came back,
 * or with more notifications collapsed into it in the same second. Creation times have no fractions of a second.
 */
const isNewerCopy = (item: InboxItem, copy: InboxItem): boolean =>
    time(item.createdAt) > time(copy.createdAt) || (time(item.createdAt) === time(copy.createdAt) && item.total > copy.total)

/**
 * The notifications that arrived first, then the loaded ones. An arrival replaces the loaded copy of a notification only
 * when it is newer.
 */
const merge = (arrived: readonly InboxItem[], loaded: readonly InboxItem[]): InboxItem[] => {
    const known = new Map(loaded.map((item) => [item.id, item]))
    const fresh = arrived.filter((item) => {
        const copy = known.get(item.id)

        return copy === undefined || isNewerCopy(item, copy)
    })
    const replaced = new Set(fresh.map((item) => item.id))

    return [...fresh, ...loaded.filter((item) => !replaced.has(item.id))]
}
/** The creation time of the newest notification when the server counted, and the IDs of those created at that time. */
interface Counted {
    latest: string | null
    latestIds: readonly string[]
}

/**
 * Whether the server counted a notification: it is older than the newest one it knew of, or one of those created in
 * the same second. Creation times have no fractions of a second.
 */
const isCounted = (item: InboxItem, { latest, latestIds }: Counted): boolean =>
    latest !== null && (time(item.createdAt) < time(latest) || (time(item.createdAt) === time(latest) && latestIds.includes(item.id)))

const parseActor = (value: unknown): InboxActor | null =>
    isRecord(value) ? { name: textOrNull(value.name) ?? undefined, avatar: safeHref(value.avatar) } : null

/** Keeps the fields of a server notification that the client understands. */
export function parseInboxItem(value: unknown): InboxItem | undefined {
    if (!isRecord(value) || typeof value.id !== 'string' || typeof value.title !== 'string' || typeof value.createdAt !== 'string') {
        return undefined
    }

    const actor = parseActor(value.actor)
    const actors = (Array.isArray(value.actors) ? value.actors.map(parseActor) : [actor]).filter((other) => other !== null)

    return {
        id: value.id,
        type: textOrNull(value.type) ?? '',
        title: value.title,
        body: textOrNull(value.body),
        icon: textOrNull(value.icon),
        image: safeHref(value.image) ?? null,
        url: safeHref(value.url) ?? null,
        actions: parseActions(value.actions),
        actor,
        actors,
        actorCount: typeof value.actorCount === 'number' ? value.actorCount : actors.length,
        total: typeof value.total === 'number' ? value.total : 1,
        category: textOrNull(value.category),
        group: textOrNull(value.group),
        toast: isToastType(value.toast) ? value.toast : null,
        data: isRecord(value.data) ? value.data : {},
        readAt: textOrNull(value.readAt),
        seenAt: textOrNull(value.seenAt),
        archivedAt: textOrNull(value.archivedAt),
        snoozedUntil: textOrNull(value.snoozedUntil),
        result: textOrNull(value.result),
        muted: value.muted === true,
        ...(value.quiet === true ? { quiet: true as const } : {}),
        createdAt: value.createdAt,
        revision: typeof value.revision === 'number' ? value.revision : null,
        announcement: value.announcement === true,
        expiresAt: textOrNull(value.expiresAt),
    }
}

/** The unread counts by category; PHP sends an empty object as an empty array. */
const parseCategoryCounts = (value: unknown): Record<string, number> | undefined => {
    if (Array.isArray(value)) {
        return {}
    }

    return isRecord(value) ? Object.fromEntries(Object.entries(value).filter((entry): entry is [string, number] => typeof entry[1] === 'number')) : undefined
}

interface ParsedCounts extends InboxCounts {
    categories: Record<string, number>
    /** What the counts include. */
    counted: Counted
    /** When the server read the counts, in microseconds. */
    revision: number
    /** The opaque key of the context that the counts cover, or `null` for every context. */
    context: string | null
}

/** Keeps the summary of the inbox that the server sends with its counts, or nothing when a field is missing. */
const parseCounts = (value: unknown): ParsedCounts | undefined => {
    const categories = isRecord(value) ? parseCategoryCounts(value.categories) : undefined

    return isRecord(value) &&
        typeof value.unread === 'number' &&
        typeof value.unseen === 'number' &&
        typeof value.revision === 'number' &&
        (value.latest === null || typeof value.latest === 'string') &&
        Array.isArray(value.latestIds) &&
        categories !== undefined
        ? {
              unread: value.unread,
              unseen: value.unseen,
              categories,
              revision: value.revision,
              counted: { latest: value.latest, latestIds: value.latestIds.filter((id) => typeof id === 'string') },
              context: textOrNull(value.context),
          }
        : undefined
}

/** Keeps the categories of the shared prop's filter that have a label; PHP sends an empty object as an empty array. */
const parseCategoryFilter = (value: unknown): Record<string, string> =>
    isRecord(value) ? Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string')) : {}

/** Keeps the times of the pause button that the client understands, or the built-in ones without a list. */
const parsePausePresets = (value: unknown): readonly PausePreset[] =>
    Array.isArray(value)
        ? value.filter((preset): preset is PausePreset => preset === 'tomorrow' || (typeof preset === 'number' && Number.isInteger(preset) && preset > 0))
        : PAUSE_PRESETS

/** Keeps the tabs of the shared prop that the client understands; PHP sends an empty object as an empty array. */
const parseTabs = (value: unknown): Record<string, InboxTab> => {
    if (!isRecord(value)) {
        return {}
    }

    return Object.fromEntries(
        Object.entries(value)
            .filter((entry): entry is [string, Record<string, unknown>] => isRecord(entry[1]))
            .map(([key, tab]) => [
                key,
                {
                    label: textOrNull(tab.label) ?? key,
                    category: textOrNull(tab.category),
                    data: isRecord(tab.data)
                        ? Object.fromEntries(
                              Object.entries(tab.data).filter((entry): entry is [string, string | number | boolean] =>
                                  ['string', 'number', 'boolean'].includes(typeof entry[1]),
                              ),
                          )
                        : {},
                },
            ]),
    )
}

/** Whether a notification belongs in a tab that the application added, like the server's query of the tab. */
const matchesTab = (item: InboxItem, tab: InboxTab | undefined): boolean =>
    tab !== undefined &&
    (tab.category === null || item.category === tab.category) &&
    Object.entries(tab.data).every(([field, value]) => item.data[field] === value)

/** Keeps a change that the client understands. */
export function parseInboxChange(value: unknown): InboxChange | undefined {
    if (!isRecord(value)) {
        return undefined
    }

    if (value.kind === 'item') {
        return typeof value.id === 'string'
            ? {
                  kind: 'item',
                  id: value.id,
                  readAt: textOrNull(value.readAt),
                  seenAt: textOrNull(value.seenAt),
                  archivedAt: textOrNull(value.archivedAt),
                  snoozedUntil: textOrNull(value.snoozedUntil),
                  result: textOrNull(value.result),
              }
            : undefined
    }

    if (value.kind === 'delete') {
        return Array.isArray(value.ids) ? { kind: 'delete', ids: value.ids.filter((id): id is string => typeof id === 'string') } : undefined
    }

    if (value.kind === 'update') {
        const item = parseInboxItem(value.item)

        return item === undefined ? undefined : { kind: 'update', item }
    }

    if (value.kind === 'mute') {
        return typeof value.group === 'string' ? { kind: 'mute', group: value.group, muted: value.muted === true } : undefined
    }

    if (value.kind === 'pause') {
        return value.until === null || typeof value.until === 'string' ? { kind: 'pause', until: value.until } : undefined
    }

    if (value.kind === 'items') {
        const action = BATCH_ACTIONS.find((candidate) => candidate === value.action)

        if (action === undefined || action === 'delete' || !Array.isArray(value.ids) || typeof value.at !== 'string') {
            return undefined
        }

        if (action === 'snooze' && typeof value.until !== 'string') {
            return undefined
        }

        const ids = value.ids.filter((id): id is string => typeof id === 'string')

        return action === 'snooze' ? { kind: 'items', action, ids, at: value.at, until: value.until as string } : { kind: 'items', action, ids, at: value.at }
    }

    if (typeof value.before !== 'string' || Number.isNaN(time(value.before))) {
        return undefined
    }

    const ids = Array.isArray(value.ids) ? value.ids.filter((id): id is string => typeof id === 'string') : null
    const category = textOrNull(value.category)

    if (value.kind === 'archive') {
        return { kind: 'archive', before: value.before, ids, category, onlyRead: value.onlyRead === true }
    }

    return value.kind === 'read' || value.kind === 'seen' ? { kind: value.kind, before: value.before, ids, category } : undefined
}

const lookup = (props: Record<string, unknown> | undefined, path: string): unknown =>
    path.split('.').reduce<unknown>((value, key) => (isRecord(value) ? value[key] : undefined), props)

/** A change of the unread and unseen counts, and of the unread counts by category. */
interface CountChange {
    unread: number
    unseen: number
    categories: Readonly<Record<string, number>>
}

/** A change that leaves the counts as they are. A new object each time, so no caller changes another's. */
const noCountChange = (): CountChange => ({ unread: 0, unseen: 0, categories: {} })

/** A change the user made that is being saved. It shows until the server answers. */
type Operation =
    | { kind: 'item'; id: string; state: Partial<ItemState>; delta: CountChange; createdAt: string | null }
    | { kind: 'bulk'; change: SavedChange; at: string; delta: CountChange }
    | { kind: 'delete'; ids: readonly string[]; delta: CountChange }
    | { kind: 'mute'; group: string; muted: boolean; delta: CountChange }
    | { kind: 'pause'; until: string | null; delta: CountChange }

/** The longest delay of `setTimeout()`, about 24.8 days. A longer delay overflows and runs the callback at once. */
const MAX_TIMEOUT = 2_147_483_647

/** Whether a bulk change covers a notification, like the server's query. */
const covers = (item: InboxItem, { before, ids, category }: BulkChange): boolean => {
    if (category !== null && item.category !== category) {
        return false
    }

    const created = time(item.createdAt)

    return created < time(before) || (created === time(before) && (ids === null || ids.includes(item.id)))
}

/** A notification after a bulk change, made at the given time. */
const applyBulk = (item: InboxItem, change: BulkChange, at: string): InboxItem => {
    if (!covers(item, change)) {
        return item
    }

    if (change.kind === 'archive') {
        return item.archivedAt === null && (!change.onlyRead || item.readAt !== null) ? { ...item, archivedAt: at } : item
    }

    if (change.kind === 'seen') {
        return item.seenAt === null ? { ...item, seenAt: at } : item
    }

    return item.readAt === null && item.archivedAt === null && !isSnoozed(item) ? { ...item, readAt: at, seenAt: item.seenAt ?? at } : item
}

/** A notification after a change of the notifications with the given IDs, like the methods of the model on the server. */
const applyItems = (item: InboxItem, { action, ids, at, until }: ItemsChange): InboxItem => {
    if (!ids.includes(item.id)) {
        return item
    }

    if (action === 'read') {
        return item.readAt === null ? { ...item, readAt: at, seenAt: item.seenAt ?? at } : item
    }

    if (action === 'unread') {
        return item.readAt === null ? item : { ...item, readAt: null }
    }

    if (action === 'seen') {
        return item.seenAt === null ? { ...item, seenAt: at } : item
    }

    if (action === 'archive') {
        return item.archivedAt === null ? { ...item, archivedAt: at } : item
    }

    if (action === 'unarchive') {
        return item.archivedAt === null ? item : { ...item, archivedAt: null }
    }

    if (action === 'snooze') {
        return until === undefined ? item : { ...item, snoozedUntil: until }
    }

    if (action === 'unsnooze') {
        return item.snoozedUntil === null ? item : { ...item, snoozedUntil: null }
    }

    // A new action fails to compile here until it is handled above, instead of taking the change of another one.
    action satisfies never

    return item
}

const applyChange = (item: InboxItem, change: SavedChange, at: string): InboxItem =>
    change.kind === 'items' ? applyItems(item, change) : applyBulk(item, change, at)

const stateOf = ({ readAt, seenAt, archivedAt, snoozedUntil, result }: InboxItem): ItemState => ({ readAt, seenAt, archivedAt, snoozedUntil, result })

/**
 * The store with the methods that the package uses apart from the public API: `completer()` for the actions of
 * notifications' toasts, `onSaved()` for the other tabs and web push, and `pushSettings()` and `context()` for web push.
 */
export interface InternalInboxStore extends InboxStore {
    /**
     * Returns a function that saves the `result` of the notification's action at the index with `complete()`, unless the
     * user signed out or another user signed in since. Take it when the action starts, and call it once the action succeeded.
     */
    completer(item: InboxItem | string, index: number): () => Promise<void>
    /**
     * The `push` key of the newest shared prop, as the server sent it: `null` while the application sends no pushes.
     * Pages from history and the prefetch cache leave it, as they may tell an outdated state of the browser.
     */
    pushSettings(): unknown
    /** The opaque key of the context that the shared prop covers, such as the user's team, or `null` for every context. */
    context(): string | null
    /**
     * Calls the listener once for each change of this tab that the server saved, such as marking a notification as read,
     * with the counts after it. Returns a function that stops it.
     */
    onSaved(listener: (saved: { change: InboxChange; counts: unknown }) => void): () => void
    /** Whether a panel that called `opened()`, such as the notification center's, is open. */
    panelOpen(): boolean
    /** Calls the listener each time a panel calls `opened()`. Returns a function that stops it. */
    onPanelOpened(listener: () => void): () => void
}

export function createInboxStore(): InternalInboxStore {
    let bindings: InertiaBindings | undefined
    let prop = DEFAULT_INBOX_PROP
    let onFailure: ((error: unknown) => void) | undefined

    // Changes when the user signs out or another user signs in, so that answers for the previous user are ignored.
    let generation = 0
    let user: string | undefined
    let url: string | undefined
    let channel: string | null = null
    let announcementsChannel: string | null = null
    let allowedActions = DEFAULT_ACTIONS
    let selectable = true
    let categoryFilter: Record<string, string> = {}
    let pausePresets = PAUSE_PRESETS
    let tabs: Record<string, InboxTab> = {}
    // The opaque key of the context that the shared prop covers, such as the user's team, or `null` for every context.
    let context: string | null = null
    let lastShared: unknown
    // The newest counts from the server, by revision.
    let latest: ParsedCounts | undefined
    let counts: InboxCounts = { unread: 0, unseen: 0 }
    let categoryCounts: Readonly<Record<string, number>> = {}
    let loaded: InboxItem[] = []
    let arrived: InboxItem[] = []
    let filter: InboxFilter = 'all'
    let category: string | null = null
    let status: InboxState['status'] = 'idle'
    let loadingMore = false
    let moreFailed = false
    let nextCursor: string | null = null
    let request = 0
    // The newest notifications that lists showed, where bulk changes stop.
    let newest: { at: string; ids: Set<string> } | undefined
    let pendingActions: Record<string, number> = {}
    // The open panels that mark every notification as seen, which also covers the notifications that arrive.
    let panelsMarkingSeen = 0
    let panelsOpen = 0
    const panelOpenedListeners = new Set<() => void>()

    // The newest state of each notification that the server sent, with its revision: from lists, arrivals, saved
    // changes, and the changes of the user's other sessions. A copy of a notification with an older revision shows it.
    const known = new Map<string, { state: Partial<ItemState>; revision: number }>()
    // The changes of many notifications that the server saved, with their revision.
    let saved: Array<{ change: SavedChange; at: string; revision: number }> = []
    // The changes being saved, in the order the user made them, shown on top of what the server sent.
    let operations: Operation[] = []
    // Notifications the user read in the Unread list, which stay in it until it reloads, so they do not jump away.
    const retained = new Set<string>()
    // The notifications that were deleted, which the lists of pages may still hold.
    const deleted = new Set<string>()
    // The newest copy of each notification whose message the server replaced, which the lists of pages may hold older copies of.
    const updates = new Map<string, InboxItem>()
    // Whether the user muted the thread of each group key that changed, with the revision of the change.
    const mutes = new Map<string, { muted: boolean; revision: number }>()
    // Whether the application offers pausing, from the shared prop, and the newest time that the server said
    // notifications are paused until, with its revision.
    let pausable = false
    let pause: { until: string | null; revision: number } = { until: null, revision: Number.NEGATIVE_INFINITY }
    // The `push` of the newest shared prop that is not from history or the prefetch cache.
    let push: unknown = null
    // The timer that shows the end of the pause, and the time it waits for.
    let pauseTimer: ReturnType<typeof setTimeout> | undefined
    let pauseTimerFor: string | null = null

    const listeners = new Set<() => void>()
    const arrivalListeners = new Set<(item: InboxItem) => void>()
    const changeListeners = new Set<(change: InboxChange) => void>()
    const savedListeners = new Set<(saved: { change: InboxChange; counts: unknown }) => void>()
    let snapshot!: InboxState

    const learn = (id: string, state: Partial<ItemState>, revision: number): void => {
        const current = known.get(id)

        if (!current || revision > current.revision) {
            known.set(id, { state, revision })
        }
    }

    const apply = (item: InboxItem): InboxItem => {
        const update = updates.get(item.id)
        let revision = item.revision ?? Number.NEGATIVE_INFINITY
        let result = item

        // The server replaced the message after it read this copy, so the copy shows the new message.
        if (update !== undefined && (update.revision ?? Number.NEGATIVE_INFINITY) > revision) {
            result = update
            revision = update.revision ?? revision
        }

        // The user muted or unmuted the thread after the server read this copy.
        const mute = result.group === null ? undefined : mutes.get(result.group)

        if (mute !== undefined && mute.revision > revision) {
            result = { ...result, muted: mute.muted }
        }

        const newer = known.get(item.id)

        // The newer state goes on top of the newest message, so a change after an update keeps the new message.
        if (newer && newer.revision > revision) {
            result = { ...result, ...newer.state }
            revision = newer.revision
        }

        for (const entry of saved) {
            if (entry.revision > revision) {
                result = applyChange(result, entry.change, entry.at)
            }
        }

        for (const operation of operations) {
            if (operation.kind === 'bulk') {
                result = applyChange(result, operation.change, operation.at)
            } else if (operation.kind === 'mute' && operation.group === result.group) {
                result = { ...result, muted: operation.muted }
            } else if (
                operation.kind === 'item' &&
                operation.id === item.id &&
                (operation.createdAt === null || time(item.createdAt) <= time(operation.createdAt))
            ) {
                // A notification that came back from snoozing since is a new one.
                result = { ...result, ...operation.state }
            }
        }

        return result
    }

    const isDeleted = (id: string): boolean => deleted.has(id) || operations.some((operation) => operation.kind === 'delete' && operation.ids.includes(id))

    const belongs = (item: InboxItem, listFilter: InboxFilter, listCategory: string | null = null): boolean => {
        if (isDeleted(item.id) || isExpired(item) || (listCategory !== null && item.category !== listCategory)) {
            return false
        }

        if (listFilter === 'archived' || item.archivedAt !== null) {
            return listFilter === 'archived' && item.archivedAt !== null
        }

        if (isSnoozed(item) !== (listFilter === 'snoozed')) {
            return false
        }

        if (listFilter === 'unread') {
            return item.readAt === null || retained.has(item.id)
        }

        return listFilter === 'all' || listFilter === 'snoozed' || matchesTab(item, Object.hasOwn(tabs, listFilter) ? tabs[listFilter] : undefined)
    }

    // The time notifications are paused until, while it has not passed: the newest pause or resume that is being saved,
    // or else the server's.
    const pausedUntil = (): string | null => {
        const pending = operations.reduce<string | null | undefined>((until, operation) => (operation.kind === 'pause' ? operation.until : until), undefined)
        const until = pending === undefined ? pause.until : pending

        return pausable && until !== null && time(until) > Date.now() ? until : null
    }

    // Shows the end of the pause once its time passes. A pause longer than the longest timer waits again.
    const watchPause = (until: string | null): void => {
        if (until === pauseTimerFor) {
            return
        }

        clearTimeout(pauseTimer)
        pauseTimer = undefined
        pauseTimerFor = until

        if (until !== null) {
            pauseTimer = setTimeout(
                () => {
                    pauseTimerFor = null

                    if (pausedUntil() === null) {
                        emit()
                    } else {
                        watchPause(until)
                    }
                },
                Math.min(time(until) - Date.now(), MAX_TIMEOUT),
            )
        }
    }

    const learnPause = (until: string | null, revision: number): void => {
        if (revision > pause.revision) {
            pause = { until, revision }
        }
    }

    const emit = (): void => {
        const paused = pausedUntil()
        watchPause(paused)

        snapshot = {
            url,
            user,
            channel,
            announcementsChannel,
            allowedActions,
            selectable,
            categoryFilter,
            tabs,
            counts,
            items: merge(arrived, loaded)
                .map(apply)
                .filter((item) => belongs(item, filter, category)),
            arrived,
            filter,
            category,
            categoryCounts,
            status,
            loadingMore,
            moreFailed,
            hasMore: nextCursor !== null,
            pendingActions,
            pausedUntil: paused,
            canPause: pausable,
            pausePresets,
        }

        listeners.forEach((listener) => listener())
    }

    emit()

    const serverSnapshot = snapshot

    const remember = (items: readonly InboxItem[]): void => {
        for (const item of items) {
            const created = time(item.createdAt)

            if (newest === undefined || created > time(newest.at)) {
                newest = { at: item.createdAt, ids: new Set([item.id]) }
            } else if (created === time(newest.at)) {
                newest.ids.add(item.id)
            }

            if (item.revision !== null) {
                learn(item.id, stateOf(item), item.revision)
            }
        }
    }

    const now = (): string => new Date().toISOString()

    // Whether the server counted a notification that is newer than every notification that lists showed.
    const hasUnshown = (): boolean =>
        latest !== undefined && latest.counted.latest !== null && (newest === undefined || time(latest.counted.latest) > time(newest.at))

    const inInbox = (item: InboxItem): boolean => item.archivedAt === null && !isSnoozed(item)

    // What a notification adds to the counts. Like on the server, only the notifications in the inbox count.
    const weight = (item: InboxItem): InboxCounts =>
        inInbox(item) ? { unread: item.readAt === null ? 1 : 0, unseen: item.seenAt === null ? 1 : 0 } : { unread: 0, unseen: 0 }

    const count = (item: InboxItem): void => {
        const { unread, unseen } = weight(item)
        counts = { unread: counts.unread + unread, unseen: counts.unseen + unseen }
        categoryCounts = bump(categoryCounts, item.category, unread)
    }

    // Whether the newest counts from the server leave out a notification that arrived in real time.
    const uncounted = (item: InboxItem): boolean => latest === undefined || !isCounted(item, latest.counted)

    // Shows the newest counts from the server, with the notifications that arrived after it counted. While changes are
    // being saved, their effect stays on the counts shown instead, until the server answered all of them.
    const recount = (): void => {
        if (latest === undefined || operations.length > 0) {
            return
        }

        counts = { unread: latest.unread, unseen: latest.unseen }
        categoryCounts = latest.categories

        for (const item of arrived) {
            if (uncounted(item)) {
                count(apply(item))
            }
        }
    }

    const adopt = (value: unknown): void => {
        const next = parseCounts(isRecord(value) ? value.counts : undefined)

        // The counts of another context, such as another team, cover other notifications. Counts read before the
        // newest ones, such as from a slow request that crossed a save, would undo changes.
        if (!next || next.context !== context || (latest !== undefined && next.revision < latest.revision)) {
            return
        }

        latest = next
        recount()
    }

    const shift = ({ unread, unseen, categories }: CountChange, sign: 1 | -1): void => {
        counts = { unread: Math.max(0, counts.unread + sign * unread), unseen: Math.max(0, counts.unseen + sign * unseen) }
        categoryCounts = Object.entries(categories).reduce((result, [key, delta]) => bump(result, key, sign * delta), categoryCounts)
    }

    const confirm = (change: InboxChange, revision: number): void => {
        if (change.kind === 'item') {
            const { kind: _kind, id, ...state } = change
            learn(id, state, revision)
        } else if (change.kind === 'delete') {
            forget(change.ids)
        } else if (change.kind === 'update') {
            const item = { ...change.item, revision: change.item.revision ?? revision }
            const current = updates.get(item.id)

            if (current === undefined || (current.revision ?? 0) < item.revision) {
                updates.set(item.id, item)
            }

            learn(item.id, stateOf(item), item.revision)
        } else if (change.kind === 'mute') {
            const current = mutes.get(change.group)

            if (current === undefined || current.revision < revision) {
                mutes.set(change.group, { muted: change.muted, revision })
            }
        } else if (change.kind === 'pause') {
            learnPause(change.until, revision)
        } else {
            saved = [...saved, { change, at: now(), revision }]
        }
    }

    // Drops deleted notifications, so they no longer show or count as arrivals that the server did not count.
    const forget = (ids: readonly string[]): void => {
        ids.forEach((id) => deleted.add(id))
        arrived = arrived.filter((item) => !deleted.has(item.id))
        loaded = loaded.filter((item) => !deleted.has(item.id))
    }

    const reset = (): void => {
        generation++
        request++
        user = undefined
        url = undefined
        channel = null
        announcementsChannel = null
        allowedActions = DEFAULT_ACTIONS
        selectable = true
        categoryFilter = {}
        pausePresets = PAUSE_PRESETS
        tabs = {}
        context = null
        lastShared = undefined
        latest = undefined
        counts = { unread: 0, unseen: 0 }
        categoryCounts = {}
        loaded = []
        arrived = []
        filter = 'all'
        category = null
        status = 'idle'
        loadingMore = false
        moreFailed = false
        nextCursor = null
        newest = undefined
        pendingActions = {}
        known.clear()
        saved = []
        operations = []
        retained.clear()
        deleted.clear()
        updates.clear()
        mutes.clear()
        pausable = false
        pause = { until: null, revision: Number.NEGATIVE_INFINITY }
        push = null
    }

    const fetchPage = async (cursor: string | null): Promise<{ items: InboxItem[]; cursor: string | null; body: unknown }> => {
        const query = new URLSearchParams({ filter })

        if (category !== null) {
            query.set('category', category)
        }

        if (cursor) {
            query.set('cursor', cursor)
        }

        const body = await bindings!.request('get', `${url}?${query.toString()}`)
        const items = isRecord(body) && Array.isArray(body.items) ? body.items.map(parseInboxItem).filter((item) => item !== undefined) : []

        return { items, cursor: isRecord(body) && typeof body.nextCursor === 'string' ? body.nextCursor : null, body }
    }

    const mutate = async (operation: Operation, path: string, data?: Record<string, unknown>): Promise<void> => {
        if (!bindings || url === undefined) {
            return
        }

        const current = generation
        operations = [...operations, operation]
        shift(operation.delta, 1)
        emit()

        try {
            const body = await bindings.request('post', `${url}/${path}`, data)

            if (current !== generation) {
                return
            }

            const response = isRecord(body) ? body : {}
            const change = parseInboxChange(response.change)
            const revision = parseCounts(response.counts)?.revision

            if (!change || revision === undefined) {
                throw new Error('The inbox endpoint answered without the change and the counts.')
            }

            operations = operations.filter((candidate) => candidate !== operation)
            confirm(change, revision)
            adopt(response)
            savedListeners.forEach((listener) => listener({ change, counts: response.counts }))
        } catch (error) {
            if (current !== generation) {
                return
            }

            operations = operations.filter((candidate) => candidate !== operation)
            shift(operation.delta, -1)
            onFailure?.(error)
        }

        recount()
        emit()
    }

    /** What the given notifications add to the counts after a change, less what they added before. */
    const difference = (changes: ReadonlyArray<{ before: InboxItem; after: InboxItem | undefined }>): CountChange =>
        changes.reduce<CountChange>((total, { before, after }) => {
            const from = weight(before)
            const to = after === undefined ? { unread: 0, unseen: 0 } : weight(after)
            const unread = to.unread - from.unread

            return {
                unread: total.unread + unread,
                unseen: total.unseen + to.unseen - from.unseen,
                categories: before.category === null || unread === 0 ? total.categories : bump(total.categories, before.category, unread),
            }
        }, noCountChange())

    /**
     * Saves one request of `batch()`: a change of the given notifications, or their deletion. Marking as seen has its own
     * endpoint, which the panel needs also while the server's `inbox.selectable` config leaves out the selection.
     */
    const saveBatch = (action: InboxBatchAction, items: readonly InboxItem[], until: string | undefined): Promise<void> => {
        const ids = items.map((item) => item.id)

        if (action === 'delete') {
            return mutate({ kind: 'delete', ids, delta: difference(items.map((before) => ({ before, after: undefined }))) }, 'batch', { action, ids })
        }

        const change: ItemsChange = { kind: 'items', action, ids, at: now(), ...(until === undefined ? {} : { until }) }
        const delta = difference(items.map((before) => ({ before, after: applyItems(before, change) })))

        if (action === 'seen') {
            return mutate({ kind: 'bulk', change, at: change.at, delta }, 'seen/items', { ids })
        }

        return mutate({ kind: 'bulk', change, at: change.at, delta }, 'batch', { action, ids, ...(until === undefined ? {} : { until }) })
    }

    /** Saves a change of one notification, and changes the counts by what it adds to them before and after. */
    const changeItem = (item: InboxItem, state: Partial<ItemState>, path: string, data?: Record<string, unknown>) => {
        const before = weight(item)
        const after = weight({ ...item, ...state })
        const unread = after.unread - before.unread

        return mutate(
            {
                kind: 'item',
                id: item.id,
                state,
                createdAt: item.createdAt,
                delta: { unread, unseen: after.unseen - before.unseen, categories: item.category === null ? {} : { [item.category]: unread } },
            },
            `${encodeURIComponent(item.id)}/${path}`,
            data,
        )
    }

    /** Mutes or unmutes the thread of the given group key, which shows on every notification in it right away. */
    const changeThread = (item: InboxItem, group: string, muted: boolean) =>
        mutate({ kind: 'mute', group, muted, delta: noCountChange() }, `${encodeURIComponent(item.id)}/${muted ? 'mute' : 'unmute'}`)

    /** Saves a bulk change of the notifications up to the newest one that lists showed, or up to now, in one category or every one. */
    const changeAll = (
        change: { kind: 'read' | 'seen' } | { kind: 'archive'; onlyRead: boolean },
        scope: string | null,
        delta: CountChange,
        path: string,
        data?: Record<string, unknown>,
    ) => {
        const edge = newest ? { before: newest.at, ids: [...newest.ids] } : { before: now(), ids: null }
        const body = { ...(newest ? edge : {}), ...(scope === null ? {} : { category: scope }), ...data }

        return mutate(
            { kind: 'bulk', change: { ...change, ...edge, category: scope }, at: now(), delta },
            path,
            Object.keys(body).length > 0 ? body : undefined,
        )
    }

    /** Clears the counts, or only the unseen count. In one category, it clears its unread count, and the server's answer brings the unseen count. */
    const clearing = (unreadToo: boolean, scope: string | null = null): CountChange => {
        if (scope !== null) {
            const unread = unreadToo ? (categoryCounts[scope] ?? 0) : 0

            return { unread: -unread, unseen: 0, categories: unread === 0 ? {} : { [scope]: -unread } }
        }

        return {
            unread: unreadToo ? -counts.unread : 0,
            unseen: -counts.unseen,
            categories: unreadToo ? Object.fromEntries(Object.entries(categoryCounts).map(([key, value]) => [key, -value])) : {},
        }
    }

    const find = (id: string): InboxItem | undefined => {
        const copy = arrived.find((item) => item.id === id) ?? loaded.find((item) => item.id === id)

        return copy && apply(copy)
    }

    const markAsRead = (raw: InboxItem | string): Promise<void> => {
        const id = typeof raw === 'string' ? raw : raw.id
        const item = typeof raw === 'string' ? find(raw) : apply(raw)
        const at = now()

        if (item === undefined) {
            // A notification no list shows: the counts come with the response.
            return mutate({ kind: 'item', id, state: { readAt: at }, delta: noCountChange(), createdAt: null }, `${encodeURIComponent(id)}/read`)
        }

        if (item.readAt !== null) {
            return Promise.resolve()
        }

        retained.add(id)

        return changeItem(item, { readAt: at, seenAt: item.seenAt ?? at }, 'read')
    }

    const complete = (raw: InboxItem | string, index: number): Promise<void> => {
        const id = typeof raw === 'string' ? raw : raw.id
        const item = typeof raw === 'string' ? find(raw) : apply(raw)
        const path = `${encodeURIComponent(id)}/complete`

        if (item === undefined) {
            // A notification no list shows: the result comes with the response.
            return mutate({ kind: 'item', id, state: {}, delta: noCountChange(), createdAt: null }, path, { action: index })
        }

        const result = item.actions[index]?.result

        return result === undefined ? Promise.resolve() : changeItem(item, { result }, 'complete', { action: index })
    }

    const completer = (raw: InboxItem | string, index: number): (() => Promise<void>) => {
        const current = generation

        return () => (current === generation ? complete(raw, index) : Promise.resolve())
    }

    /** Whether the server's `inbox.actions` config offers the action, so the store saves it. */
    const allows = (action: InboxAction): boolean => allowedActions.includes(action)

    const store: InternalInboxStore = {
        subscribe(listener) {
            listeners.add(listener)

            return () => listeners.delete(listener)
        },
        getSnapshot: () => snapshot,
        getServerSnapshot: () => serverSnapshot,
        connect(connected, options = {}) {
            bindings = connected
            prop = options.prop ?? prop
            onFailure = options.onFailure ?? onFailure
        },
        sync(props, type) {
            const shared = lookup(props, prop)
            // Pages from history and the prefetch cache carry the props of when they were loaded, possibly of another user.
            const outdated = type === 'history' || type === 'cached'

            if (!isRecord(shared)) {
                // Signed out: forget the previous user's notifications.
                if (shared === null && !outdated && url !== undefined) {
                    reset()
                    emit()
                }

                return
            }

            const identity = textOrNull(shared.user) ?? undefined

            if (identity !== user) {
                if (outdated) {
                    return
                }

                // Another user signed in.
                reset()
                user = identity
            }

            url = textOrNull(shared.url) ?? url
            channel = textOrNull(shared.channel)
            announcementsChannel = textOrNull(shared.announcementsChannel)
            tabs = parseTabs(shared.tabs)
            context = textOrNull(shared.context)
            pausable = isRecord(shared.pause)

            // A page from history may carry the settings of an older config, which the server would refuse now.
            if (!outdated) {
                const actions = shared.allowedActions
                allowedActions = Array.isArray(actions) ? INBOX_ACTIONS.filter((action) => actions.includes(action)) : DEFAULT_ACTIONS
                selectable = shared.selectable !== false
                categoryFilter = parseCategoryFilter(shared.categoryFilter)
                pausePresets = parsePausePresets(isRecord(shared.pause) ? shared.pause.presets : undefined)
            }

            // A list that the application no longer offers, such as Archived once archiving is left out, lists every notification.
            if (!offersFilter(filter, allowedActions)) {
                filter = 'all'

                if (status !== 'idle') {
                    void store.load()
                }
            }

            // A partial reload without the prop keeps the object of an earlier response.
            if (!outdated && shared !== lastShared) {
                retained.clear()
                adopt({ counts: shared })
                push = shared.push ?? null

                // A page read before the newest pause or resume that the store knows of would undo it.
                if (isRecord(shared.pause)) {
                    learnPause(textOrNull(shared.pause.until), typeof shared.revision === 'number' ? shared.revision : 0)
                }
            }

            lastShared = shared

            emit()
        },
        async load(nextFilter, nextCategory) {
            if (!bindings || url === undefined) {
                return
            }

            const current = generation
            const id = ++request
            category = nextCategory !== undefined ? nextCategory : nextFilter !== undefined ? null : category
            filter = nextFilter ?? filter
            filter = offersFilter(filter, allowedActions) ? filter : 'all'
            status = 'loading'
            loadingMore = false
            moreFailed = false
            retained.clear()
            emit()

            try {
                const page = await fetchPage(null)

                if (current === generation && id === request) {
                    loaded = page.items
                    nextCursor = page.cursor
                    status = 'ready'
                    remember(page.items)
                    adopt(page.body)
                }
            } catch {
                if (current === generation && id === request) {
                    status = 'error'
                }
            }

            emit()
        },
        async loadMore({ retry = false } = {}) {
            if (!bindings || url === undefined || nextCursor === null || loadingMore || status !== 'ready' || (moreFailed && !retry)) {
                return
            }

            const current = generation
            const id = request
            loadingMore = true
            moreFailed = false
            emit()

            const page = await fetchPage(nextCursor).catch(() => undefined)

            // A newer list, or another user, keeps the state of its own next page.
            if (current !== generation || id !== request) {
                return
            }

            if (page === undefined) {
                moreFailed = true
            } else {
                const ids = new Set(loaded.map((item) => item.id))
                loaded = [...loaded, ...page.items.filter((item) => !ids.has(item.id))]
                nextCursor = page.cursor
                remember(page.items)
            }

            loadingMore = false
            emit()
        },
        async refresh() {
            if (!bindings || url === undefined) {
                return
            }

            const current = generation

            try {
                const body = await bindings.request('get', `${url}/counts`)

                if (current === generation) {
                    adopt(body)
                    emit()
                }
            } catch {
                // The next refresh tries again.
            }
        },
        async loadArrival(id, itemContext = null) {
            // Items without a context show in every context.
            if (!bindings || url === undefined || (itemContext !== null && itemContext !== context)) {
                return undefined
            }

            const current = generation

            try {
                const body = await bindings.request('get', `${url}/${encodeURIComponent(id)}`)

                return current === generation && isRecord(body) ? store.receive(body.item, body.counts) : undefined
            } catch {
                // The user does not see it, such as an announcement for another audience.
                return undefined
            }
        },
        receive(value, counts) {
            const item = parseInboxItem(value)

            // A copy that is not newer than the one that arrived before, such as a collapsed notification whose broadcasts
            // crossed, would show an older message.
            if (!item || url === undefined || deleted.has(item.id) || arrived.some((other) => other.id === item.id && !isNewerCopy(item, other))) {
                return undefined
            }

            // A notification of another context, such as another team, stays out. Those without a context show in every one.
            const itemContext = isRecord(value) ? textOrNull(value.context) : null

            if (context !== null && itemContext !== null && itemContext !== context) {
                return undefined
            }

            arrived = [item, ...arrived.filter((other) => other.id !== item.id)].sort((a, b) => time(b.createdAt) - time(a.createdAt))
            remember([item])

            const shown = apply(item)

            // The counts of a collapsed notification cover its own context, which `adopt()` leaves out when it is another one.
            adopt({ counts })

            if (operations.length > 0 || latest === undefined) {
                if (uncounted(item)) {
                    count(shown)
                }
            } else {
                recount()
            }

            emit()

            // An open panel shows the notification right away.
            if (panelsMarkingSeen > 0 && status === 'ready' && belongs(shown, filter, category) && shown.seenAt === null) {
                void store.markAllAsSeen()
            }

            arrivalListeners.forEach((listener) => listener(item))

            return item
        },
        onArrival(listener) {
            arrivalListeners.add(listener)

            return () => arrivalListeners.delete(listener)
        },
        receiveChange(value) {
            const raw = isRecord(value) ? value.change : undefined
            const change = parseInboxChange(raw)
            const changed = parseCounts(isRecord(value) ? value.counts : undefined)

            if (!change || changed === undefined || url === undefined) {
                return
            }

            const { revision } = changed

            // The bulk changes of a session in another context, such as another team, cover the notifications of that
            // context. Changes of notifications by ID, and of a muted thread, cover the same notifications in every
            // context, such as those without a context, so they apply, and `adopt()` leaves out only the counts.
            if (changed.context !== context && (change.kind === 'read' || change.kind === 'seen' || change.kind === 'archive')) {
                return
            }

            // A snoozed notification that came back, with its new creation time. The unsnooze command sends it without
            // a revision of its own, so it takes the revision of the counts it came with.
            if (change.kind === 'item' && isRecord(raw) && isRecord(raw.item)) {
                store.receive({ ...raw.item, revision: raw.item.revision ?? revision })
            }

            confirm(change, revision)
            adopt(value)
            emit()
            changeListeners.forEach((listener) => listener(change))
        },
        onChange(listener) {
            changeListeners.add(listener)

            return () => changeListeners.delete(listener)
        },
        apply,
        belongs,
        remember,
        markAsRead,
        complete,
        completer,
        pushSettings: () => push,
        context: () => context,
        onSaved(listener) {
            savedListeners.add(listener)

            return () => savedListeners.delete(listener)
        },
        markAsUnread(raw) {
            const item = apply(raw)

            return item.readAt === null ? Promise.resolve() : changeItem(item, { readAt: null }, 'unread')
        },
        archive(raw) {
            const item = apply(raw)

            return !allows('archive') || item.archivedAt !== null ? Promise.resolve() : changeItem(item, { archivedAt: now() }, 'archive')
        },
        unarchive(raw) {
            const item = apply(raw)

            return !allows('archive') || item.archivedAt === null ? Promise.resolve() : changeItem(item, { archivedAt: null }, 'unarchive')
        },
        snooze(raw, until) {
            if (!allows('snooze')) {
                return Promise.resolve()
            }

            const item = apply(raw)
            const iso = new Date(until).toISOString()

            return changeItem(item, { snoozedUntil: iso }, 'snooze', { until: iso })
        },
        unsnooze(raw) {
            const item = apply(raw)

            return !allows('snooze') || item.snoozedUntil === null ? Promise.resolve() : changeItem(item, { snoozedUntil: null }, 'unsnooze')
        },
        mute(raw) {
            const item = apply(raw)

            return !allows('mute') || item.group === null || item.muted ? Promise.resolve() : changeThread(item, item.group, true)
        },
        unmute(raw) {
            const item = apply(raw)

            return !allows('mute') || item.group === null || !item.muted ? Promise.resolve() : changeThread(item, item.group, false)
        },
        pause(until) {
            const iso = new Date(until).toISOString()

            return pausable ? mutate({ kind: 'pause', until: iso, delta: noCountChange() }, 'pause', { until: iso }) : Promise.resolve()
        },
        resume() {
            return pausedUntil() === null ? Promise.resolve() : mutate({ kind: 'pause', until: null, delta: noCountChange() }, 'resume')
        },
        batch(action, raw, until) {
            const needs = BATCH_ACTION_NEEDS[action]

            if ((action !== 'seen' && !selectable) || (needs !== undefined && !allows(needs))) {
                return Promise.resolve()
            }

            if (action === 'snooze' && until === undefined) {
                return Promise.reject(new TypeError('Snoozing notifications needs the time to snooze them until.'))
            }

            const items = raw.map(apply)
            const iso = action === 'snooze' && until !== undefined ? new Date(until).toISOString() : undefined
            const requests: Array<Promise<void>> = []

            for (let start = 0; start < items.length; start += BATCH_SIZE) {
                requests.push(saveBatch(action, items.slice(start, start + BATCH_SIZE), iso))
            }

            return Promise.all(requests).then(() => undefined)
        },
        delete(raw) {
            if (!allows('delete')) {
                return Promise.resolve()
            }

            const item = apply(raw)
            const { unread, unseen } = weight(item)

            return mutate(
                {
                    kind: 'delete',
                    ids: [item.id],
                    delta: { unread: -unread, unseen: -unseen, categories: item.category === null ? {} : { [item.category]: -unread } },
                },
                `${encodeURIComponent(item.id)}/delete`,
            )
        },
        markAllAsRead({ category: scope = category } = {}) {
            return changeAll({ kind: 'read' }, scope, clearing(true, scope), 'read')
        },
        markAllAsSeen() {
            // Opening the panel shows the newest notifications of every category on the bell, so all of them were seen.
            return counts.unseen === 0 ? Promise.resolve() : changeAll({ kind: 'seen' }, null, clearing(false), 'seen')
        },
        archiveAll({ onlyRead = false, category: scope = category } = {}) {
            if (!allows('archive')) {
                return Promise.resolve()
            }

            // Archiving only the read notifications leaves the unread ones in the counts.
            const delta = onlyRead ? noCountChange() : clearing(true, scope)

            return changeAll({ kind: 'archive', onlyRead }, scope, delta, 'archive', { read: onlyRead })
        },
        async opened(tabs, { markAllAsSeen = true, categories } = {}) {
            if (markAllAsSeen) {
                panelsMarkingSeen++
            }

            panelsOpen++
            panelOpenedListeners.forEach((listener) => listener())

            // A panel that only marks what it shows leaves notifications unseen, so it reloads only for newer ones.
            const outdated = markAllAsSeen ? counts.unseen > 0 : hasUnshown()
            // Panels share the list, so a panel shows one of its own tabs and categories rather than what another panel left.
            const nextFilter = tabs !== undefined && !tabs.includes(filter) ? (tabs[0] ?? filter) : filter
            const nextCategory = categories !== undefined && category !== null && !categories.includes(category) ? null : category

            if (nextFilter !== filter || nextCategory !== category) {
                await store.load(nextFilter, nextCategory)
            } else if (status !== 'ready' || outdated) {
                await store.load()
            }

            // Without a list on screen, nothing was seen.
            if (markAllAsSeen && status === 'ready') {
                await store.markAllAsSeen()
            }
        },
        closed({ markAllAsSeen = true } = {}) {
            if (markAllAsSeen) {
                panelsMarkingSeen = Math.max(0, panelsMarkingSeen - 1)
            }

            panelsOpen = Math.max(0, panelsOpen - 1)
        },
        panelOpen: () => panelsOpen > 0,
        onPanelOpened(listener) {
            panelOpenedListeners.add(listener)

            return () => panelOpenedListeners.delete(listener)
        },
        open(raw, event) {
            if (event?.defaultPrevented) {
                return
            }

            void markAsRead(raw)

            const href = safeHref(raw.url)

            if (href === undefined || (event && isModifiedClick(event))) {
                return
            }

            event?.preventDefault()

            if (!sameOrigin(href) || !bindings) {
                window.location.assign(href)
            } else {
                bindings.visit(href, {})
            }
        },
        runAction(raw, index, event) {
            const action = raw.actions[index]

            if (!action || event?.defaultPrevented) {
                return
            }

            const href = actionHref(action)

            // Clicks on links that open a new tab or leave the application are followed by the browser.
            if (event && href !== undefined && followsInBrowser(action, href, event)) {
                if (action.event && !isModifiedClick(event)) {
                    window.dispatchEvent(new CustomEvent(action.event, { detail: action.payload }))
                }

                followLinkAction(href, action, event, () => void markAsRead(raw), action.result === undefined ? undefined : () => complete(raw, index))

                return
            }

            event?.preventDefault()

            if (pendingActions[raw.id] !== undefined) {
                return
            }

            void markAsRead(raw)

            const current = generation
            // An action with a result keeps it once it succeeded, such as "Approved" after its visit.
            const save = action.result === undefined ? undefined : completer(raw, index)
            const settle = (): void => {
                if (current !== generation) {
                    return
                }

                const { [raw.id]: _done, ...rest } = pendingActions
                pendingActions = rest
                emit()
            }

            const outcome = performAction(action, raw, bindings, settle, save)

            if (outcome === 'pending') {
                pendingActions = { ...pendingActions, [raw.id]: index }
                emit()
            }
        },
    }

    return store
}

/**
 * The notifications of a list from a page prop, after those that arrived in real time since, with the user's
 * changes applied. Leaves out the notifications that no longer match the filter, such as archived ones in `all`.
 */
export function listItems(store: InboxStore, loaded: readonly InboxItem[], filter: InboxFilter, category: string | null = null): InboxItem[] {
    return merge(store.getSnapshot().arrived, loaded)
        .map((item) => store.apply(item))
        .filter((item) => store.belongs(item, filter, category))
}

/** A notification with the notifications of the same group that follow it in the list. */
export interface InboxGroup {
    /** The same while the group's notifications change: `group:` and the group key, or the notification's ID when it has no group. */
    key: string
    item: InboxItem
    others: InboxItem[]
}

/**
 * Groups notifications by their group key, at the place of the newest one. Notifications without a key stay alone, and
 * so does every notification when `group` is false.
 */
export function groupItems(items: readonly InboxItem[], group = true): InboxGroup[] {
    const groups: InboxGroup[] = []
    const byKey = new Map<string, InboxGroup>()

    for (const item of items) {
        const groupKey = group ? item.group : null
        const existing = groupKey === null ? undefined : byKey.get(groupKey)

        if (existing) {
            existing.others.push(item)
        } else {
            const created = { key: groupKey === null ? item.id : `group:${groupKey}`, item, others: [] }
            groups.push(created)

            if (groupKey !== null) {
                byKey.set(groupKey, created)
            }
        }
    }

    return groups
}

export interface SnoozeOption {
    label: string
    until: Date
}

/**
 * The default snooze times: in three hours when that is still today, tomorrow at 9:00, and next Monday at 9:00 unless
 * that is tomorrow. Labels that are not given use the translations.
 */
export function snoozeOptions(
    overrides: Readonly<Partial<Pick<InboxLabels, 'snoozeLaterToday' | 'snoozeTomorrow' | 'snoozeNextWeek'>>> = {},
    now = new Date(),
): SnoozeOption[] {
    const labels = inboxLabels(overrides)

    const at = (days: number): Date => {
        const date = new Date(now)
        date.setDate(now.getDate() + days)
        date.setHours(9, 0, 0, 0)

        return date
    }

    const laterToday = new Date(now.getTime() + 3 * 3_600_000)
    const options = laterToday.getDate() === now.getDate() ? [{ label: label(labels.snoozeLaterToday), until: laterToday }] : []

    const nextMonday = (8 - now.getDay()) % 7 || 7

    return [
        ...options,
        { label: label(labels.snoozeTomorrow), until: at(1) },
        ...(nextMonday > 1 ? [{ label: label(labels.snoozeNextWeek), until: at(nextMonday) }] : []),
    ]
}

/** A snooze time: only the time when it is today, otherwise the weekday and the time, such as "Mon 9:00 AM". */
export function snoozeTime(date: Date | string, now: number, locale?: string): string {
    const value = new Date(date)
    const today = new Date(now).toDateString() === value.toDateString()

    return value.toLocaleString(locale, today ? { hour: 'numeric', minute: '2-digit' } : { weekday: 'short', hour: 'numeric', minute: '2-digit' })
}

/** A preset of the pause menu: a number of minutes, or `'tomorrow'` for 08:00 the next day in the browser's time zone. */
export type PausePreset = number | 'tomorrow'

/** The default presets of the pause menu: 30 minutes, an hour, two hours, and until tomorrow. */
export const PAUSE_PRESETS: readonly PausePreset[] = [30, 60, 120, 'tomorrow']

/** An option of the pause menu, such as "For 30 minutes", whose end counts from its preset when the menu shows it and when the user picks it. */
export interface PauseOption {
    label: string
    preset: PausePreset
}

/**
 * When a pause of the preset ends, counted from `now`: after its number of minutes, or for `'tomorrow'`, at 08:00 the
 * next day in the browser's time zone. A custom header shows the end of each of its `pauseOptions` with `pauseTime()`.
 */
export function pauseEnd(preset: PausePreset, now = new Date()): Date {
    if (preset !== 'tomorrow') {
        return new Date(now.getTime() + preset * 60_000)
    }

    const date = new Date(now)
    date.setDate(now.getDate() + 1)
    date.setHours(8, 0, 0, 0)

    return date
}

/**
 * The options of the pause menu, such as "For 30 minutes" and "Until tomorrow". The `pauseFor` label receives the
 * duration in the locale as `duration`, in hours when they are whole hours, and the number of minutes as `minutes`.
 * Presets that are not a positive number of minutes are left out.
 */
export function pauseOptions(presets: readonly PausePreset[], labels: Pick<InboxLabels, 'pauseFor' | 'pauseTomorrow'>, locale?: string): PauseOption[] {
    return presets
        .filter((preset) => preset === 'tomorrow' || (Number.isFinite(preset) && preset > 0))
        .map((preset) => {
            if (preset === 'tomorrow') {
                return { label: label(labels.pauseTomorrow), preset }
            }

            const hours = preset % 60 === 0
            const unit = new Intl.NumberFormat(locale, { style: 'unit', unit: hours ? 'hour' : 'minute', unitDisplay: 'long' })

            return { label: label(labels.pauseFor, { duration: unit.format(hours ? preset / 60 : preset), minutes: preset }), preset }
        })
}

/**
 * The end of a pause in the locale, as the pause menu shows it: only the time when it is today, with the weekday within
 * six days, and else with the date, such as "Dec 24, 8:00 AM". `now` is the current time in milliseconds, such as `Date.now()`.
 */
export function pauseTime(date: Date | string, now: number, locale?: string): string {
    const value = new Date(date)

    return value.getTime() - now < 6 * 86_400_000
        ? snoozeTime(value, now, locale)
        : value.toLocaleString(locale, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

const sharedStore = createInboxStore()

/** The store shared by every notification center and list in the application. */
export const inboxStore: InboxStore = sharedStore

/** The actions of the shared store that the `useNotifications()` hooks return. */
export const inboxActions: InboxActions = {
    load: inboxStore.load,
    loadMore: inboxStore.loadMore,
    refresh: inboxStore.refresh,
    receive: inboxStore.receive,
    receiveChange: inboxStore.receiveChange,
    markAsRead: inboxStore.markAsRead,
    markAsUnread: inboxStore.markAsUnread,
    archive: inboxStore.archive,
    unarchive: inboxStore.unarchive,
    snooze: inboxStore.snooze,
    unsnooze: inboxStore.unsnooze,
    delete: inboxStore.delete,
    complete: inboxStore.complete,
    mute: inboxStore.mute,
    unmute: inboxStore.unmute,
    pause: inboxStore.pause,
    resume: inboxStore.resume,
    batch: inboxStore.batch,
    markAllAsRead: inboxStore.markAllAsRead,
    markAllAsSeen: inboxStore.markAllAsSeen,
    archiveAll: inboxStore.archiveAll,
    opened: inboxStore.opened,
    closed: inboxStore.closed,
    open: inboxStore.open,
    runAction: inboxStore.runAction,
}

/**
 * Reads the first page's shared prop into the store when a component mounts, as the application may not have called
 * `initNotifications()` before `createInertiaApp()`.
 */
export function syncFirstPage(props: object): void {
    if (inboxStore.getSnapshot().url === undefined) {
        inboxStore.sync(props as Record<string, unknown>, 'initial')
    }
}

/** The shared store with the methods that the package uses apart from the public API, such as those that web push follows. */
export const internalInboxStore = sharedStore

/** A clock that ticks every minute while it has subscribers, so relative times stay current. */
export function createClock(interval = 60_000): { subscribe(listener: () => void): () => void; getSnapshot(): number } {
    const listeners = new Set<() => void>()
    let now = Date.now()
    let timer: ReturnType<typeof setInterval> | undefined

    const tick = (): void => {
        now = Date.now()
        listeners.forEach((listener) => listener())
    }

    return {
        subscribe(listener) {
            listeners.add(listener)

            if (timer === undefined) {
                now = Date.now()
                timer = setInterval(tick, interval)
            }

            return () => {
                listeners.delete(listener)

                if (listeners.size === 0) {
                    clearInterval(timer)
                    timer = undefined
                }
            }
        },
        getSnapshot: () => now,
    }
}

export const clock = createClock()

/** Formats a time relative to now, such as "5 minutes ago" or "yesterday", in the given locale. */
export function relativeTime(iso: string, now: number, locale?: string): string {
    const seconds = (time(iso) - now) / 1000
    const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
    const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
        ['year', 31_536_000],
        ['month', 2_592_000],
        ['week', 604_800],
        ['day', 86_400],
        ['hour', 3600],
        ['minute', 60],
    ]

    for (const [unit, size] of units) {
        if (Math.abs(seconds) >= size) {
            return format.format(Math.round(seconds / size), unit)
        }
    }

    return format.format(0, 'second')
}

/** The badge text for a count: the count, or the maximum with a plus, such as "99+". */
export function badgeText(count: number, max: number, locale?: string): string {
    const number = new Intl.NumberFormat(locale)

    return count > max ? `${number.format(max)}+` : number.format(count)
}

const inboxLabelNames = [
    'title',
    'bell',
    'bellNew',
    'bellPaused',
    'all',
    'unread',
    'archived',
    'snoozed',
    'markAllAsRead',
    'archiveAll',
    'moreActions',
    'itemControl',
    'markAsRead',
    'markAsUnread',
    'archive',
    'unarchive',
    'snooze',
    'unsnooze',
    'mute',
    'unmute',
    'muted',
    'delete',
    'select',
    'selectAll',
    'selected',
    'selection',
    'readSelected',
    'unreadSelected',
    'snoozeSelected',
    'unsnoozeSelected',
    'archiveSelected',
    'unarchiveSelected',
    'deleteSelected',
    'clearSelection',
    'showNew',
    'snoozeUntil',
    'snoozedUntil',
    'snoozeLaterToday',
    'snoozeTomorrow',
    'snoozeNextWeek',
    'pause',
    'pauseFor',
    'pauseTomorrow',
    'pausedUntil',
    'resume',
    'showMore',
    'showLess',
    'unreadState',
    'actorsAndOther',
    'actorsAndOthers',
    'empty',
    'emptyUnread',
    'emptyArchived',
    'emptySnoozed',
    'error',
    'retry',
    'categories',
    'allCategories',
    'loading',
    'loadMore',
    'viewAll',
    'announcement',
] as const

/** The English text of the notification center. Each label is the translation with the `inbox_` key, such as `inbox_mark_all_as_read` for `markAllAsRead`. */
export const DEFAULT_INBOX_LABELS = defaultLabels('inbox_', inboxLabelNames)

/** The text of the notification center: strings with placeholders, or functions that receive the parameters. */
export type InboxLabels = Record<keyof typeof DEFAULT_INBOX_LABELS, TranslationValue>

/** The labels of a notification center or list: those it was given, and the translations for the rest. */
export const inboxLabels = (overrides?: Readonly<Partial<InboxLabels>>): InboxLabels => labelsWith('inbox_', inboxLabelNames, overrides)

/** Class names added to the parts of the notification center and its notifications. */
export interface InboxClasses {
    bell?: string
    badge?: string
    panel?: string
    list?: string
    item?: string
    media?: string
    title?: string
    body?: string
    time?: string
    action?: string
    /** The result of an action that ran, such as "Approved", in place of the actions. */
    result?: string
    /** The actors of a notification that later ones collapsed into, such as "Sophie and 3 others". */
    actors?: string
    control?: string
}

export const label = formatTranslation

/** The actors whose avatars a notification that later ones collapsed into shows, stacked: the three newest. */
export const stackedActors = (item: InboxItem): readonly InboxActor[] => item.actors.slice(0, 3)

/**
 * The actors of a notification that later ones collapsed into with `InboxMessage::collapse()`, such as "Sophie and 3
 * others". Returns `undefined` for a notification with one actor or none, or when the names are unknown.
 */
export function actorsText(labels: Pick<InboxLabels, 'actorsAndOther' | 'actorsAndOthers'>, item: InboxItem): string | undefined {
    const [newest, other] = item.actors

    if (item.actorCount < 2 || !newest?.name) {
        return undefined
    }

    if (item.actorCount > 2) {
        return label(labels.actorsAndOthers, { name: newest.name, count: item.actorCount - 1 })
    }

    return other?.name ? label(labels.actorsAndOther, { name: newest.name, other: other.name }) : undefined
}
