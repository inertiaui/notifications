import { isRecord, textOrNull } from './flash'
import type { InertiaBindings } from './inertia'
import { defaultLabels, formatTranslation, labelsWith, type TranslationValue } from './translations'

/** The frequencies that the user may receive a category in on the channels that digests hold, in the order forms offer them. */
export const PREFERENCE_FREQUENCIES = ['instant', 'hourly', 'daily', 'weekly'] as const

/** How often the user receives a category on the channels that digests hold: right away, or in an hourly, daily, or weekly digest. */
export type PreferenceFrequency = (typeof PREFERENCE_FREQUENCIES)[number]

export interface PreferenceChannel {
    key: string
    label: string
    /** Whether the user may turn the channel off for every category at once. */
    globalSwitch: boolean
    /** Whether the channel is on. While it is off, the user receives only the locked categories on it. */
    enabled: boolean
    /** Whether digests hold the channel, from the server's `digests.channels` config. */
    digest: boolean
    /** Whether the channel covers the notification center, which the pushes of a category need. */
    inbox: boolean
    /** Whether the channel sends web push, which reaches only the devices where the user turned push on. */
    push: boolean
}

/** The days of the notification hours, Monday first. */
export const PREFERENCE_WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

/** A day of the week, as the notification hours name it. */
export type PreferenceWeekday = (typeof PREFERENCE_WEEKDAYS)[number]

/**
 * The hours, in the user's timezone, during which notifications reach the user on the channels that digests hold, and
 * with a toast, a sound, and a desktop notification. Outside them, those wait or arrive silently.
 */
export interface PreferenceNotificationHours {
    enabled: boolean
    /**
     * The ranges of each day, such as `['09:00-12:00', '13:00-17:00']`, sorted by start. A day without ranges has no
     * notification hours. A range that ends before or when it starts runs past midnight, so `22:00-02:00` ends at 02:00
     * the next day, and `00:00-00:00` is the whole day.
     */
    days: Record<PreferenceWeekday, string[]>
}

export interface PreferenceGroup {
    key: string
    label: string
    description: string | null
}

export interface PreferenceCategory {
    key: string
    label: string
    description: string | null
    /** The key of the group that the category is shown in, or `null`. */
    group: string | null
    /** A locked category always sends, so its channels cannot be turned off. */
    locked: boolean
    /** The user's choice for each channel the category offers, by channel key. A channel that is off overrides it. */
    channels: Readonly<Record<string, boolean>>
    /** How often the user receives the category on the channels that digests hold, or `null` when it is always sent right away. */
    frequency: PreferenceFrequency | null
}

export interface PreferencesState {
    status: 'idle' | 'loading' | 'ready' | 'error'
    channels: readonly PreferenceChannel[]
    /** The groups that have categories, in order. */
    groups: readonly PreferenceGroup[]
    categories: readonly PreferenceCategory[]
    /** The user's notification hours, or `null` when the application does not offer them. */
    notificationHours: PreferenceNotificationHours | null
    /** The frequencies that the application offers, `instant` first. Every frequency when the server does not list them. */
    frequencies: readonly PreferenceFrequency[]
}

/**
 * The state before the preferences load, which the server renders. Hooks render it until they mount, so the first render
 * in the browser matches the server's HTML even when the store loaded the preferences before.
 */
export const INITIAL_PREFERENCES: PreferencesState = {
    status: 'idle',
    channels: [],
    groups: [],
    categories: [],
    notificationHours: null,
    frequencies: PREFERENCE_FREQUENCIES,
}

/** The categories of one group, or those without a group when `group` is `null`. */
export interface PreferenceSection {
    group: PreferenceGroup | null
    categories: readonly PreferenceCategory[]
}

/** Class names added to the parts of `<NotificationPreferences>`. */
export interface PreferencesClasses {
    table?: string
    /** Each column header: the categories and each channel. */
    head?: string
    /** The heading of each group. */
    group?: string
    /** Each row of switches: the **All notifications** row and each category. */
    row?: string
    label?: string
    description?: string
    /** The badge of a locked category. */
    badge?: string
    switch?: string
    /** The frequency menu of each category that users may receive in a digest. */
    select?: string
    /** The time fields of the notification hours. */
    time?: string
}

export interface PreferencesStore {
    subscribe(listener: () => void): () => void
    getSnapshot(): PreferencesState
    connect(bindings: InertiaBindings, options?: { onFailure?: (error: unknown) => void }): void
    /** Loads the preferences of the signed-in user from the notification center's routes, at the URL of the shared prop. */
    load(url: string | undefined): Promise<void>
    /**
     * Turns a category on or off for one channel. The change shows at once and is undone when saving fails. Each
     * switch saves one change at a time, so the server saves the user's newest choice last.
     */
    set(category: string, channel: string, enabled: boolean): Promise<void>
    /** Turns a channel off or on for every category, except the locked categories, which always send. Saves like `set()`. */
    setChannel(channel: string, enabled: boolean): Promise<void>
    /**
     * Sets how often the user receives a category that may be received in a digest, to one of the offered `frequencies`,
     * with the browser's timezone. Saves like `set()`.
     */
    setFrequency(category: string, frequency: PreferenceFrequency): Promise<void>
    /**
     * Changes the notification hours: whether they are on, and the ranges of the days that change, such as
     * `{ days: { saturday: ['10:00-14:00'] } }`. An empty list turns a day off. Saves like `setFrequency()`. A change with
     * a range that is not two times of day, or that leaves no range on any day, changes nothing.
     */
    setNotificationHours(changes: { enabled?: boolean; days?: Partial<Record<PreferenceWeekday, string[]>> }): Promise<void>
    /** Forgets the preferences after the user signed out or another user signed in, and loads them again when they show. */
    reset(url: string | undefined): void
}

const text = (value: unknown, fallback: string): string => (typeof value === 'string' ? value : fallback)
const isFrequency = (value: unknown): value is PreferenceFrequency => PREFERENCE_FREQUENCIES.includes(value as PreferenceFrequency)

/** Whether a value is a range of notification hours: two times of day, such as `09:00-17:00`. */
const isTimeRange = (value: unknown): value is string => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/.test(value)

/** The ranges of a day sorted by start, which is their order as text. */
const sortRanges = (ranges: readonly string[]): string[] => [...ranges].sort()

const parseNotificationHours = (value: unknown): PreferenceNotificationHours | null => {
    if (!isRecord(value) || !isRecord(value.days)) {
        return null
    }

    const days = value.days

    return {
        enabled: value.enabled === true,
        days: Object.fromEntries(
            PREFERENCE_WEEKDAYS.map((day) => [day, sortRanges(Array.isArray(days[day]) ? days[day].filter(isTimeRange) : [])]),
        ) as PreferenceNotificationHours['days'],
    }
}

/** The frequencies that the application offers, in the order forms offer them, or every frequency when the server lists none. */
const parseFrequencies = (value: unknown): readonly PreferenceFrequency[] => {
    const offered = Array.isArray(value) ? PREFERENCE_FREQUENCIES.filter((frequency) => value.includes(frequency)) : []

    return offered.length > 0 ? offered : PREFERENCE_FREQUENCIES
}

/** Reads the response of the preferences endpoint. */
export function parsePreferences(
    value: unknown,
): Pick<PreferencesState, 'channels' | 'groups' | 'categories' | 'notificationHours' | 'frequencies'> | undefined {
    if (!isRecord(value) || !Array.isArray(value.channels) || !Array.isArray(value.categories)) {
        return undefined
    }

    return {
        channels: value.channels.filter(isRecord).flatMap((channel) =>
            typeof channel.key === 'string'
                ? [
                      {
                          key: channel.key,
                          label: text(channel.label, channel.key),
                          globalSwitch: channel.globalSwitch === true,
                          enabled: channel.enabled !== false,
                          digest: channel.digest === true,
                          inbox: channel.inbox === true,
                          push: channel.push === true,
                      },
                  ]
                : [],
        ),
        groups: (Array.isArray(value.groups) ? value.groups : [])
            .filter(isRecord)
            .flatMap((group) =>
                typeof group.key === 'string' ? [{ key: group.key, label: text(group.label, group.key), description: textOrNull(group.description) }] : [],
            ),
        categories: value.categories.filter(isRecord).flatMap((category) =>
            typeof category.key === 'string'
                ? [
                      {
                          key: category.key,
                          label: text(category.label, category.key),
                          description: textOrNull(category.description),
                          group: textOrNull(category.group),
                          locked: category.locked === true,
                          // A category without channels is an empty array in PHP's JSON.
                          channels: Object.fromEntries(
                              Object.entries(isRecord(category.channels) ? category.channels : {}).filter(
                                  (entry): entry is [string, boolean] => typeof entry[1] === 'boolean',
                              ),
                          ),
                          frequency: isFrequency(category.frequency) ? category.frequency : null,
                      },
                  ]
                : [],
        ),
        notificationHours: parseNotificationHours(value.notificationHours),
        frequencies: parseFrequencies(value.frequencies),
    }
}

/**
 * The categories by group: first those without a group, then each group in order. A category whose group the
 * preferences do not list shows with the categories without a group.
 */
export function preferenceSections(state: Pick<PreferencesState, 'groups' | 'categories'>): PreferenceSection[] {
    const listed = new Set(state.groups.map(({ key }) => key))
    const ungrouped = state.categories.filter(({ group }) => group === null || !listed.has(group))
    const sections = state.groups.map((group) => ({ group, categories: state.categories.filter((category) => category.group === group.key) }))

    return [...(ungrouped.length > 0 ? [{ group: null, categories: ungrouped }] : []), ...sections.filter(({ categories }) => categories.length > 0)]
}

/** Whether the user chose the category on the channel while the channel is on, or the category is locked, as the server's `enabled()` checks. */
const chooses = (category: PreferenceCategory, channel: PreferenceChannel): boolean =>
    category.locked || (channel.enabled && category.channels[channel.key] === true)

/**
 * Whether the notification center lets the category's pushes through, as pushes only send through it: always for a channel
 * without push, for the channel that covers both, without a channel that covers the notification center, and in a category
 * that does not offer that channel, as the server then always allows it, and otherwise while the user receives the
 * category on that channel.
 */
const inboxAllows = (category: PreferenceCategory, channel: PreferenceChannel, channels: readonly PreferenceChannel[]): boolean => {
    const inbox = channels.find((entry) => entry.inbox)

    return !channel.push || inbox === undefined || inbox.key === channel.key || category.channels[inbox.key] === undefined || chooses(category, inbox)
}

/**
 * Whether the user receives the category on the channel: a locked category always, and another one while it and the
 * channel are on. The pushes of a category also need the user to receive it in the notification center.
 */
export const receives = (category: PreferenceCategory, channel: PreferenceChannel, channels: readonly PreferenceChannel[]): boolean =>
    chooses(category, channel) && inboxAllows(category, channel, channels)

/**
 * Whether the user's choice for the category on the channel cannot change: a locked category always sends, a channel that
 * is off for every category overrides the choices of its categories, and the pushes of a category wait for the user to
 * receive it in the notification center.
 */
export const isDisabled = (category: PreferenceCategory, channel: PreferenceChannel, channels: readonly PreferenceChannel[]): boolean =>
    category.locked || !channel.enabled || !inboxAllows(category, channel, channels)

/** Whether the frequency of the category changes anything: the user receives the category on a channel that digests hold. */
export const frequencyApplies = (category: PreferenceCategory, channels: readonly PreferenceChannel[]): boolean =>
    category.frequency !== null &&
    channels.some((channel) => channel.digest && category.channels[channel.key] !== undefined && receives(category, channel, channels))

/** The name of a weekday in the locale, such as "Monday". */
export const weekdayName = (day: PreferenceWeekday, locale?: string): string =>
    // 1 January 2024 was a Monday.
    new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(Date.UTC(2024, 0, 1 + PREFERENCE_WEEKDAYS.indexOf(day)))

/** The start and end of a range of notification hours, such as `['09:00', '17:00']` for `09:00-17:00`. */
export const rangeTimes = (range: string): [start: string, end: string] => {
    const [start = '', end = ''] = range.split('-')

    return [start, end]
}

/** Whether the day is the only one with notification hours, which the user cannot turn off, as the hours need a range. */
export const isOnlyDayWithHours = (hours: PreferenceNotificationHours, day: PreferenceWeekday): boolean =>
    hours.days[day].length > 0 && PREFERENCE_WEEKDAYS.every((other) => other === day || hours.days[other].length === 0)

/** The range that a day gets when the user turns it on: the first range of the nearest day before it with hours, or 09:00 to 17:00. */
export function rangeForDay(hours: PreferenceNotificationHours, day: PreferenceWeekday): string {
    const index = PREFERENCE_WEEKDAYS.indexOf(day)

    for (let back = 1; back < PREFERENCE_WEEKDAYS.length; back++) {
        const [range] = hours.days[PREFERENCE_WEEKDAYS[(index + PREFERENCE_WEEKDAYS.length - back) % PREFERENCE_WEEKDAYS.length]]

        if (range !== undefined) {
            return range
        }
    }

    return '09:00-17:00'
}

const MINUTES_PER_DAY = 24 * 60

const minutesOf = (time: string): number => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))

const timeOf = (minutes: number): string => [Math.floor(minutes / 60) % 24, minutes % 60].map((part) => String(part).padStart(2, '0')).join(':')

/**
 * The range that adding one to a day gives: an hour long, an hour after the day's latest range ends, so the two do not
 * overlap. `undefined` while the day has no ranges, or no room for it before midnight, such as after a range that runs past midnight.
 */
export function nextRange(ranges: readonly string[]): string | undefined {
    const spans = ranges.map((range) => rangeTimes(range).map(minutesOf))

    if (spans.length === 0 || spans.some(([start, end]) => end <= start)) {
        return undefined
    }

    const end = Math.max(...spans.map(([, until]) => until))

    return end + 120 <= MINUTES_PER_DAY ? `${timeOf(end + 60)}-${timeOf(end + 120)}` : undefined
}

/**
 * The ranges of the day whose times the user changes, in the order they show, so a range keeps its fields while its
 * start moves before another range's. The day shows its ranges sorted once the focus leaves it.
 */
export interface NotificationHoursEditing {
    day: PreferenceWeekday
    ranges: string[]
}

/** A day of the notification hours as the form shows it. */
export interface NotificationHoursDay {
    day: PreferenceWeekday
    name: string
    /** The start and end of each range, in the order they show. */
    ranges: [start: string, end: string][]
    /** Whether the switch of the day cannot change: the notification hours are off, or the day is the only one with hours. */
    locked: boolean
    /** Whether the day has room for another range. */
    canAdd: boolean
}

/** A change of a day in the notification hours form. */
export type NotificationHoursEdit =
    | { kind: 'toggle'; day: PreferenceWeekday }
    | { kind: 'time'; day: PreferenceWeekday; index: number; field: 'start' | 'end'; time: string }
    | { kind: 'remove'; day: PreferenceWeekday; index: number }
    | { kind: 'add'; day: PreferenceWeekday }

const shownRanges = (hours: PreferenceNotificationHours | null, editing: NotificationHoursEditing | null, day: PreferenceWeekday): string[] =>
    editing?.day === day ? editing.ranges : (hours?.days[day] ?? [])

/** Each day of the notification hours, Monday first, or none while the application does not offer them. */
export const notificationHoursDays = (
    hours: PreferenceNotificationHours | null,
    editing: NotificationHoursEditing | null,
    locale?: string,
): NotificationHoursDay[] =>
    hours === null
        ? []
        : PREFERENCE_WEEKDAYS.map((day) => ({
              day,
              name: weekdayName(day, locale),
              ranges: shownRanges(hours, editing, day).map(rangeTimes),
              locked: !hours.enabled || isOnlyDayWithHours(hours, day),
              canAdd: hours.enabled && nextRange(hours.days[day]) !== undefined,
          }))

/**
 * The ranges that a change of the form gives its day, or `undefined` when the change does nothing, and the day whose
 * times the user changes after it, from the one at the time of the change, which a React state setter takes as it is.
 * Turning a day on gives it the first range of the day before it that has hours, and adding a range adds one an hour
 * after the day's latest one ends. Changing a time keeps the order of the day until the focus leaves it, and a day whose
 * times the user changes keeps that order when a range is added or removed.
 */
export function editNotificationHours(
    hours: PreferenceNotificationHours | null,
    editing: NotificationHoursEditing | null,
    edit: NotificationHoursEdit,
): { ranges: string[]; editing: (current: NotificationHoursEditing | null) => NotificationHoursEditing | null } | undefined {
    const { day } = edit
    const shown = shownRanges(hours, editing, day)
    let ranges: string[]

    switch (edit.kind) {
        case 'toggle':
            if (!hours?.enabled || isOnlyDayWithHours(hours, day)) {
                return undefined
            }

            ranges = hours.days[day].length > 0 ? [] : [rangeForDay(hours, day)]
            break
        case 'time': {
            const [start, end] = rangeTimes(shown[edit.index] ?? '')
            const range = edit.field === 'start' ? `${edit.time}-${end}` : `${start}-${edit.time}`

            ranges = shown.map((other, position) => (position === edit.index ? range : other))

            return { ranges, editing: () => ({ day, ranges }) }
        }
        case 'remove':
            ranges = shown.filter((_, position) => position !== edit.index)
            break
        case 'add': {
            const range = nextRange(shown)

            if (!hours?.enabled || range === undefined) {
                return undefined
            }

            ranges = [...shown, range]
        }
    }

    return { ranges, editing: (current) => (current?.day === day ? { day, ranges } : current) }
}

/** The timezone of the browser, which the server sends the digests in when the application does not know the user's timezone. */
const browserTimezone = (): string | undefined => {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone
    } catch {
        return undefined
    }
}

/** The value of a switch, the frequency of a category, or the notification hours. */
type CellValue = boolean | PreferenceFrequency | PreferenceNotificationHours

/** Whether two schedules of notification hours are the same, range by range. Ranges hold no commas. */
const sameHours = (a: PreferenceNotificationHours, b: PreferenceNotificationHours): boolean =>
    a.enabled === b.enabled && PREFERENCE_WEEKDAYS.every((day) => a.days[day].join() === b.days[day].join())

/** Whether two values of a cell are the same. Notification hours compare by their ranges, as each change of them is a new object. */
const sameValue = (a: CellValue | undefined, b: CellValue | undefined): boolean => (typeof a === 'object' && typeof b === 'object' ? sameHours(a, b) : a === b)

/** The channel of a category's cell that holds its frequency. */
const FREQUENCY = '*'

/** The channel of the cell without a category that holds the notification hours. */
const NOTIFICATION_HOURS = '*'

/**
 * A switch: a channel of a category, or a channel for every category when the category is null. The `*` channel of a
 * category is its frequency, and the `*` channel without a category is the notification hours.
 */
interface Cell {
    category: string | null
    channel: string
}

/** What the store keeps of the server's answers. */
type Saved = Pick<PreferencesState, 'channels' | 'categories' | 'notificationHours'>

export function createPreferencesStore(): PreferencesStore {
    let bindings: InertiaBindings | undefined
    let onFailure: ((error: unknown) => void) | undefined
    let url: string | undefined
    // Changes when the user changes, so that answers for the previous user are ignored.
    let generation = 0
    let request = 0
    let tick = 0
    // The channels and categories as the server saved them.
    let saved: Saved = { channels: [], categories: [], notificationHours: null }
    // The user's newest choice for each switch that is being saved, the saves on their way, and when each switch was last
    // saved, by the key of the switch.
    const wanted = new Map<string, { cell: Cell; value: CellValue }>()
    const sending = new Map<string, Promise<void>>()
    const acknowledged = new Map<string, { cell: Cell; at: number }>()
    let snapshot = INITIAL_PREFERENCES
    const listeners = new Set<() => void>()

    const keyOf = ({ category, channel }: Cell): string => JSON.stringify([category, channel])

    const valueIn = (state: Saved, { category, channel }: Cell): CellValue | undefined => {
        if (category === null) {
            return channel === NOTIFICATION_HOURS ? (state.notificationHours ?? undefined) : state.channels.find(({ key }) => key === channel)?.enabled
        }

        const entry = state.categories.find(({ key }) => key === category)

        return channel === FREQUENCY ? (entry?.frequency ?? undefined) : entry?.channels[channel]
    }

    const withCategoryValue = (entry: PreferenceCategory, channel: string, value: CellValue | undefined): PreferenceCategory => {
        if (channel === FREQUENCY) {
            return entry.frequency !== null && isFrequency(value) ? { ...entry, frequency: value } : entry
        }

        return entry.channels[channel] !== undefined && typeof value === 'boolean' ? { ...entry, channels: { ...entry.channels, [channel]: value } } : entry
    }

    // The state with the value in the switch. Only a switch that the state has takes a value, and only one of its kind, so
    // a channel, frequency, or notification hours that the server stopped offering stay out. The other entries stay as they are.
    const withValue = (state: Saved, { category, channel }: Cell, value: CellValue | undefined): Saved => {
        if (category !== null) {
            return { ...state, categories: state.categories.map((entry) => (entry.key === category ? withCategoryValue(entry, channel, value) : entry)) }
        }

        if (channel === NOTIFICATION_HOURS) {
            return state.notificationHours !== null && typeof value === 'object' ? { ...state, notificationHours: value } : state
        }

        return typeof value === 'boolean'
            ? { ...state, channels: state.channels.map((entry) => (entry.key === channel ? { ...entry, enabled: value } : entry)) }
            : state
    }

    const bodyOf = ({ category, channel }: Cell, value: CellValue): Record<string, unknown> => {
        if (category === null) {
            return channel === NOTIFICATION_HOURS ? { notificationHours: value, timezone: browserTimezone() } : { channels: { [channel]: value } }
        }

        return channel === FREQUENCY
            ? { frequencies: { [category]: value }, timezone: browserTimezone() }
            : { preferences: { [category]: { [channel]: value } } }
    }

    const update = (next: Partial<PreferencesState>): void => {
        snapshot = { ...snapshot, ...next }
        listeners.forEach((listener) => listener())
    }

    // Shows what the server saved, with the choices that are still being saved.
    const show = (next: Partial<PreferencesState> = {}): void =>
        update({ ...next, ...[...wanted.values()].reduce((state, { cell, value }) => withValue(state, cell, value), saved) })

    const send = async (cell: Cell, key: string): Promise<void> => {
        const current = generation
        const enabled = wanted.get(key)!.value

        try {
            const parsed = parsePreferences(await bindings!.request('post', `${url}/preferences`, bodyOf(cell, enabled)))

            if (current !== generation) {
                return
            }

            // Only this switch: the response may be older than the saves of other switches.
            saved = withValue(saved, cell, (parsed && valueIn(parsed, cell)) ?? enabled)
            acknowledged.set(key, { cell, at: ++tick })
        } catch (error) {
            if (current !== generation) {
                return
            }

            onFailure?.(error)
        }

        // The user changed the switch again while it was being saved, unless back to what the server has.
        if (sameValue(wanted.get(key)?.value, enabled) || sameValue(wanted.get(key)?.value, valueIn(saved, cell))) {
            wanted.delete(key)
        }

        show()

        if (wanted.has(key)) {
            await send(cell, key)
        }
    }

    // Shows the change at once and saves it, after the save of the same switch that is on its way.
    const change = (category: string | null, channel: string, enabled: CellValue): Promise<void> => {
        const cell = { category, channel }
        const key = keyOf(cell)
        wanted.set(key, { cell, value: enabled })
        show()

        const running = sending.get(key)

        if (running) {
            return running
        }

        const current = generation
        const saving = send(cell, key).finally(() => {
            if (current === generation) {
                sending.delete(key)
            }
        })
        sending.set(key, saving)

        return saving
    }

    const store: PreferencesStore = {
        subscribe(listener) {
            listeners.add(listener)

            return () => listeners.delete(listener)
        },
        getSnapshot: () => snapshot,
        connect(connected, options = {}) {
            bindings = connected
            onFailure = options.onFailure ?? onFailure
        },
        async load(inboxUrl) {
            const current = generation
            const id = ++request
            const startedAt = tick
            url = inboxUrl

            if (!bindings || url === undefined) {
                update({ status: 'error' })

                return
            }

            update({ status: 'loading' })

            try {
                const parsed = parsePreferences(await bindings.request('get', `${url}/preferences`))

                if (current !== generation || id !== request) {
                    return
                }

                if (!parsed) {
                    update({ status: 'error' })

                    return
                }

                // A switch saved after the request started keeps what the server answered to the save.
                saved = [...acknowledged.values()]
                    .filter(({ at }) => at > startedAt)
                    .reduce((state, { cell }) => withValue(state, cell, valueIn(saved, cell)), {
                        channels: parsed.channels,
                        categories: parsed.categories,
                        notificationHours: parsed.notificationHours,
                    })
                show({ status: 'ready', groups: parsed.groups, frequencies: parsed.frequencies })
            } catch {
                if (current === generation && id === request) {
                    update({ status: 'error' })
                }
            }
        },
        set(category, channel, enabled) {
            const entry = snapshot.categories.find(({ key }) => key === category)
            const previous = entry?.channels[channel]

            if (!bindings || url === undefined || !entry || entry.locked || previous === undefined || previous === enabled) {
                return Promise.resolve()
            }

            return change(category, channel, enabled)
        },
        setChannel(channel, enabled) {
            const entry = snapshot.channels.find(({ key }) => key === channel)

            if (!bindings || url === undefined || !entry?.globalSwitch || entry.enabled === enabled) {
                return Promise.resolve()
            }

            return change(null, channel, enabled)
        },
        setFrequency(category, frequency) {
            const entry = snapshot.categories.find(({ key }) => key === category)

            if (
                !bindings ||
                url === undefined ||
                !entry ||
                entry.frequency === null ||
                entry.frequency === frequency ||
                !snapshot.frequencies.includes(frequency)
            ) {
                return Promise.resolve()
            }

            return change(category, FREQUENCY, frequency)
        },
        setNotificationHours(changes) {
            const current = snapshot.notificationHours

            if (!bindings || url === undefined || current === null) {
                return Promise.resolve()
            }

            const days = PREFERENCE_WEEKDAYS.map((day) => [day, changes.days?.[day] ?? current.days[day]] as const)

            // A range that is not two times of day, or a schedule without any range, changes nothing, as the server rejects it.
            if (!days.every(([, ranges]) => Array.isArray(ranges) && ranges.every(isTimeRange)) || days.every(([, ranges]) => ranges.length === 0)) {
                return Promise.resolve()
            }

            const next: PreferenceNotificationHours = {
                enabled: changes.enabled ?? current.enabled,
                days: Object.fromEntries(days.map(([day, ranges]) => [day, sortRanges(ranges)])) as PreferenceNotificationHours['days'],
            }

            return sameValue(next, current) ? Promise.resolve() : change(null, NOTIFICATION_HOURS, next)
        },
        reset(next) {
            generation++
            request++
            saved = { channels: [], categories: [], notificationHours: null }
            wanted.clear()
            sending.clear()
            acknowledged.clear()
            url = next
            update(INITIAL_PREFERENCES)

            // A <NotificationPreferences> on the page shows the preferences of the new user.
            if (listeners.size > 0 && next !== undefined) {
                void store.load(next)
            }
        },
    }

    return store
}

const preferencesLabelNames = [
    'title',
    'category',
    'toggle',
    'locked',
    'global',
    'globalDescription',
    'frequency',
    'frequencyLabel',
    'frequencyInstant',
    'frequencyHourly',
    'frequencyDaily',
    'frequencyWeekly',
    'pushDevice',
    'pushOff',
    'pushOn',
    'pushTurnOn',
    'pushTurnOff',
    'pushTurningOn',
    'pushTurningOff',
    'pushBlocked',
    'pushHomeScreen',
    'pushInsecure',
    'pushBrave',
    'pushFailed',
    'pushFailedOff',
    'pushRetry',
    'pushDevices',
    'pushDeviceName',
    'pushDeviceUnknown',
    'pushDeviceActive',
    'pushDeviceRemove',
    'pushDeviceRemoveLabel',
    'notificationHours',
    'notificationHoursDescription',
    'notificationHoursStart',
    'notificationHoursEnd',
    'notificationHoursDay',
    'notificationHoursOff',
    'notificationHoursAdd',
    'notificationHoursAddLabel',
    'notificationHoursRemove',
    'notificationHoursRemoveLabel',
    'empty',
    'loading',
    'error',
    'retry',
] as const

/** The English text of `<NotificationPreferences>`. Each label is the translation with the `preferences_` key, such as `preferences_locked` for `locked`. */
export const DEFAULT_PREFERENCES_LABELS = defaultLabels('preferences_', preferencesLabelNames)

/** The text of `<NotificationPreferences>`: strings with placeholders, or functions that receive the parameters. */
export type PreferencesLabels = Record<keyof typeof DEFAULT_PREFERENCES_LABELS, TranslationValue>

/** The label of each frequency in `<NotificationPreferences>`, such as `frequencyDaily` for `daily`. */
export const FREQUENCY_LABELS: Readonly<Record<PreferenceFrequency, keyof PreferencesLabels>> = {
    instant: 'frequencyInstant',
    hourly: 'frequencyHourly',
    daily: 'frequencyDaily',
    weekly: 'frequencyWeekly',
}

/** The labels of a `<NotificationPreferences>`: those it was given, and the translations for the rest. */
export const preferencesLabels = (overrides?: Readonly<Partial<PreferencesLabels>>): PreferencesLabels =>
    labelsWith('preferences_', preferencesLabelNames, overrides)

/** The store shared by every `<NotificationPreferences>` in the application. */
export const preferencesStore = createPreferencesStore()

/**
 * The shape of the table of `<NotificationPreferences>`: whether it has the row of switches for every category and the
 * column of frequencies, its number of columns, and the options of the frequency menus.
 */
export function preferencesTable(
    channels: readonly PreferenceChannel[],
    categories: readonly PreferenceCategory[],
    frequencies: readonly PreferenceFrequency[],
    labels: PreferencesLabels,
): { hasGlobalSwitches: boolean; hasFrequencies: boolean; columns: number; frequencyOptions: { value: PreferenceFrequency; label: string }[] } {
    const hasFrequencies = categories.some(({ frequency }) => frequency !== null)

    return {
        hasGlobalSwitches: channels.some(({ globalSwitch }) => globalSwitch),
        hasFrequencies,
        columns: channels.length + (hasFrequencies ? 2 : 1),
        frequencyOptions: frequencies.map((value) => ({ value, label: formatTranslation(labels[FREQUENCY_LABELS[value]]) })),
    }
}

/** Turns the category on or off for the channel, unless the choice cannot change, such as in a locked category. */
export function togglePreference(category: PreferenceCategory, channel: PreferenceChannel, channels: readonly PreferenceChannel[]): void {
    if (!isDisabled(category, channel, channels)) {
        void preferencesStore.set(category.key, channel.key, !category.channels[channel.key])
    }
}
