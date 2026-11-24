import { describe, expect, it, vi } from 'vite-plus/test'

import wire from '../tests/Fixtures/preferences.json'
import type { InertiaBindings } from './inertia'
import {
    createPreferencesStore,
    DEFAULT_PREFERENCES_LABELS,
    editNotificationHours,
    frequencyApplies,
    isDisabled,
    isOnlyDayWithHours,
    nextRange,
    notificationHoursDays,
    parsePreferences,
    preferenceSections,
    preferencesTable,
    rangeForDay,
    rangeTimes,
    receives,
    weekdayName,
    type PreferenceCategory,
    type PreferenceChannel,
    type PreferenceNotificationHours,
} from './preferences'

interface Call {
    method: string
    url: string
    data?: Record<string, unknown>
    resolve: (body: unknown) => void
    reject: (error: unknown) => void
}

/** Notification hours with the same ranges from Monday to Friday, and others on the weekend. */
const week = (weekdays: string[], weekend: string[] = []): PreferenceNotificationHours['days'] => ({
    monday: weekdays,
    tuesday: weekdays,
    wednesday: weekdays,
    thursday: weekdays,
    friday: weekdays,
    saturday: weekend,
    sunday: weekend,
})

const HOURS: PreferenceNotificationHours = { enabled: false, days: week(['09:00-17:00']) }

const response = (
    billing: Record<string, boolean>,
    comments: Record<string, boolean> = { inbox: true },
    mail = true,
    inboxSwitch = true,
    frequency: string | null = 'instant',
    notificationHours: Record<string, unknown> | null = HOURS,
) => ({
    channels: [
        { key: 'inbox', label: 'In the app', globalSwitch: inboxSwitch, enabled: true, digest: false },
        { key: 'mail', label: 'Email', globalSwitch: true, enabled: mail, digest: true },
    ],
    categories: [
        { key: 'billing', label: 'Billing', description: 'Invoices.', locked: false, channels: billing, frequency },
        { key: 'comments', label: 'Comments', description: null, locked: false, channels: comments, frequency: null },
        { key: 'security', label: 'Security', description: null, locked: true, channels: { inbox: true, mail: true }, frequency: null },
    ],
    notificationHours,
})

async function setup(initial: unknown = response({ inbox: true, mail: true })) {
    const calls: Call[] = []
    const onFailure = vi.fn()
    const store = createPreferencesStore()

    store.connect({ request: (method, url, data) => new Promise((resolve, reject) => calls.push({ method, url, data, resolve, reject })) } as InertiaBindings, {
        onFailure,
    })

    const loading = store.load('/inbox')
    calls[0]!.resolve(initial)
    await loading

    const channels = (category: string) => store.getSnapshot().categories.find(({ key }) => key === category)!.channels
    const frequency = (category: string) => store.getSnapshot().categories.find(({ key }) => key === category)!.frequency
    const channel = (key: string) => store.getSnapshot().channels.find((entry) => entry.key === key)!.enabled
    const flush = () => new Promise((resolve) => setTimeout(resolve))

    return { store, calls, onFailure, channels, channel, frequency, flush }
}

describe('preferences store', () => {
    it('loads the preferences from the inbox routes', async () => {
        const { store, calls } = await setup()

        expect(calls[0]).toMatchObject({ method: 'get', url: '/inbox/preferences' })
        expect(store.getSnapshot()).toMatchObject({ status: 'ready', channels: [{ key: 'inbox' }, { key: 'mail' }] })
        expect(store.getSnapshot().categories.map(({ key, locked }) => [key, locked])).toEqual([
            ['billing', false],
            ['comments', false],
            ['security', true],
        ])
    })

    it('shows an error without the URL of the inbox routes, or when loading fails', async () => {
        const store = createPreferencesStore()
        store.connect({ request: () => Promise.reject(new Error('offline')) } as unknown as InertiaBindings)

        await store.load(undefined)
        expect(store.getSnapshot().status).toBe('error')

        await store.load('/inbox')
        expect(store.getSnapshot().status).toBe('error')
    })

    it('shows a change at once and sends only that change', async () => {
        const { store, calls, channels } = await setup()

        const saving = store.set('billing', 'mail', false)

        expect(channels('billing')).toEqual({ inbox: true, mail: false })
        expect(calls[1]).toMatchObject({ method: 'post', url: '/inbox/preferences', data: { preferences: { billing: { mail: false } } } })

        calls[1]!.resolve(response({ inbox: true, mail: false }))
        await saving

        expect(channels('billing')).toEqual({ inbox: true, mail: false })
    })

    it('ignores locked categories, unknown channels, and choices that change nothing', async () => {
        const { store, calls } = await setup()

        await store.set('security', 'mail', false)
        await store.set('comments', 'mail', false)
        await store.set('billing', 'mail', true)

        expect(calls).toHaveLength(1)
    })

    it('undoes a change that fails, and keeps the changes that are still being saved', async () => {
        const { store, calls, channels, onFailure } = await setup()

        const first = store.set('billing', 'mail', false)
        const second = store.set('comments', 'inbox', false)

        calls[1]!.reject(new Error('500'))
        await first

        expect(channels('billing')).toEqual({ inbox: true, mail: true })
        expect(channels('comments')).toEqual({ inbox: false })
        expect(onFailure).toHaveBeenCalledOnce()

        calls[2]!.resolve(response({ inbox: true, mail: true }, { inbox: false }))
        await second

        expect(channels('comments')).toEqual({ inbox: false })
    })

    it('does not let the response to an earlier change undo a later one, in whichever order they arrive', async () => {
        const { store, calls, channels } = await setup()

        const first = store.set('billing', 'mail', false)
        const second = store.set('billing', 'inbox', false)

        // The second change was saved after the first, but its response arrives first.
        calls[2]!.resolve(response({ inbox: false, mail: false }))
        await second
        calls[1]!.resolve(response({ inbox: true, mail: false }))
        await first

        expect(channels('billing')).toEqual({ inbox: false, mail: false })
    })

    it('saves one change of a switch at a time, so the server saves the newest choice last', async () => {
        const { store, calls, channels, flush } = await setup()

        const first = store.set('billing', 'mail', false)
        const second = store.set('billing', 'mail', true)
        expect(calls).toHaveLength(2)
        expect(channels('billing')).toEqual({ inbox: true, mail: true })

        calls[1]!.resolve(response({ inbox: true, mail: false }))
        await flush()
        expect(calls[2]!.data).toEqual({ preferences: { billing: { mail: true } } })
        expect(channels('billing')).toEqual({ inbox: true, mail: true })

        calls[2]!.resolve(response({ inbox: true, mail: true }))
        await Promise.all([first, second])
        expect(channels('billing')).toEqual({ inbox: true, mail: true })
        expect(calls).toHaveLength(3)
    })

    it('sends nothing more when the user changed a switch back to what the server has', async () => {
        const { store, calls, channels } = await setup()

        const first = store.set('billing', 'mail', false)
        const second = store.set('billing', 'mail', true)

        calls[1]!.reject(new Error('500'))
        await Promise.all([first, second])

        expect(channels('billing')).toEqual({ inbox: true, mail: true })
        expect(calls).toHaveLength(2)
    })

    it('shows what the server saved when the newest change of a switch fails', async () => {
        const { store, calls, channels, flush } = await setup()

        const first = store.set('billing', 'mail', false)
        const second = store.set('billing', 'mail', true)

        calls[1]!.resolve(response({ inbox: true, mail: false }))
        await flush()
        calls[2]!.reject(new Error('500'))
        await Promise.all([first, second])

        expect(channels('billing')).toEqual({ inbox: true, mail: false })
    })

    it('keeps a change saved while the preferences loaded', async () => {
        const { store, calls, channels } = await setup()

        const loading = store.load('/inbox')
        const saving = store.set('billing', 'mail', false)
        calls[2]!.resolve(response({ inbox: true, mail: false }))
        await saving

        // Read before the change was saved.
        calls[1]!.resolve(response({ inbox: true, mail: true }, { inbox: false }))
        await loading

        expect(channels('billing')).toEqual({ inbox: true, mail: false })
        expect(channels('comments')).toEqual({ inbox: false })
    })

    it('turns a channel off for every category at once, and sends only that switch', async () => {
        const { store, calls, channels, channel } = await setup()

        const saving = store.setChannel('mail', false)

        expect(channel('mail')).toBe(false)
        expect(calls[1]).toMatchObject({ method: 'post', url: '/inbox/preferences', data: { channels: { mail: false } } })

        calls[1]!.resolve(response({ inbox: true, mail: true }, { inbox: true }, false))
        await saving

        expect(channel('mail')).toBe(false)
        expect(channel('inbox')).toBe(true)
        expect(channels('billing')).toEqual({ inbox: true, mail: true })
    })

    it('undoes a channel switch that fails', async () => {
        const { store, calls, channel, onFailure } = await setup()

        const saving = store.setChannel('mail', false)
        calls[1]!.reject(new Error('500'))
        await saving

        expect(channel('mail')).toBe(true)
        expect(onFailure).toHaveBeenCalledOnce()
    })

    it('ignores channels without a switch for every category, and channel switches that change nothing', async () => {
        const { store, calls } = await setup(response({ inbox: true, mail: true }, { inbox: true }, true, false))

        await store.setChannel('inbox', false)
        await store.setChannel('mail', true)
        await store.setChannel('slack', false)

        expect(calls).toHaveLength(1)
    })

    it('keeps a channel switch saved while the preferences loaded', async () => {
        const { store, calls, channel } = await setup()

        const loading = store.load('/inbox')
        const saving = store.setChannel('mail', false)
        calls[2]!.resolve(response({ inbox: true, mail: true }, { inbox: true }, false))
        await saving

        // Read before the switch was saved.
        calls[1]!.resolve(response({ inbox: true, mail: true }))
        await loading

        expect(channel('mail')).toBe(false)
    })

    it('sets the frequency of a category at once, and sends it with the timezone of the browser', async () => {
        const { store, calls, frequency } = await setup()
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

        const saving = store.setFrequency('billing', 'daily')

        expect(frequency('billing')).toBe('daily')
        expect(calls[1]).toMatchObject({ method: 'post', url: '/inbox/preferences', data: { frequencies: { billing: 'daily' }, timezone } })

        calls[1]!.resolve(response({ inbox: true, mail: true }, undefined, true, true, 'daily'))
        await saving

        expect(frequency('billing')).toBe('daily')
        expect(calls).toHaveLength(2)
    })

    it('undoes a frequency that fails to save', async () => {
        const { store, calls, frequency, onFailure } = await setup()

        const saving = store.setFrequency('billing', 'weekly')
        calls[1]!.reject(new Error('offline'))
        await saving

        expect(frequency('billing')).toBe('instant')
        expect(onFailure).toHaveBeenCalledTimes(1)
    })

    it('saves the newest frequency last, and keeps it while the preferences loaded', async () => {
        const { store, calls, frequency, flush } = await setup()

        const saving = store.setFrequency('billing', 'daily')
        void store.setFrequency('billing', 'weekly')
        const loading = store.load('/inbox')

        expect(frequency('billing')).toBe('weekly')
        expect(calls).toHaveLength(3)

        calls[1]!.resolve(response({ inbox: true, mail: true }, undefined, true, true, 'daily'))
        await flush()

        expect(calls[3]).toMatchObject({ data: { frequencies: { billing: 'weekly' } } })

        calls[3]!.resolve(response({ inbox: true, mail: true }, undefined, true, true, 'weekly'))
        await saving

        // The preferences were read before the newest frequency was saved.
        calls[2]!.resolve(response({ inbox: true, mail: true }, undefined, true, true, 'daily'))
        await loading

        expect(frequency('billing')).toBe('weekly')
    })

    it('ignores the frequency of categories without digests, unknown frequencies, and frequencies that change nothing', async () => {
        const { store, calls, frequency } = await setup()

        await store.setFrequency('comments', 'daily')
        await store.setFrequency('billing', 'instant')
        await store.setFrequency('billing', 'monthly' as never)
        await store.setFrequency('unknown', 'daily')

        expect(calls).toHaveLength(1)
        expect(frequency('comments')).toBeNull()
    })

    it('offers the frequencies of the response, and every frequency when it lists none', async () => {
        const { store, calls, frequency } = await setup({ ...response({ inbox: true, mail: true }), frequencies: ['instant', 'daily'] })

        expect(store.getSnapshot().frequencies).toEqual(['instant', 'daily'])

        // The application does not offer hourly digests, so the server would reject it.
        await store.setFrequency('billing', 'hourly')
        expect(calls).toHaveLength(1)
        expect(frequency('billing')).toBe('instant')

        // Preferences loaded again without the key, such as from an older server, offer every frequency.
        const loading = store.load('/inbox')
        calls[1]!.resolve(response({ inbox: true, mail: true }))
        await loading
        expect(store.getSnapshot().frequencies).toEqual(['instant', 'hourly', 'daily', 'weekly'])

        void store.setFrequency('billing', 'hourly')
        expect(frequency('billing')).toBe('hourly')
        expect(calls[2]).toMatchObject({ data: { frequencies: { billing: 'hourly' } } })
    })

    it('offers every frequency again after the user changes', async () => {
        const { store } = await setup({ ...response({ inbox: true, mail: true }), frequencies: ['instant', 'weekly'] })

        store.reset(undefined)

        expect(store.getSnapshot().frequencies).toEqual(['instant', 'hourly', 'daily', 'weekly'])
    })

    it('changes the notification hours at once, and sends every day with the timezone of the browser, a day turned off too', async () => {
        const { store, calls } = await setup()
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
        const notificationHours = { enabled: true, days: { ...week(['09:00-17:00']), monday: [], saturday: ['22:00-02:00'] } }

        const saving = store.setNotificationHours({ enabled: true, days: { monday: [], saturday: ['22:00-02:00'] } })

        expect(store.getSnapshot().notificationHours).toEqual(notificationHours)
        expect(calls[1]).toMatchObject({ method: 'post', url: '/inbox/preferences' })
        expect(JSON.parse(JSON.stringify(calls[1]!.data))).toEqual({ notificationHours, timezone })

        calls[1]!.resolve(response({ inbox: true, mail: true }, undefined, true, true, 'instant', notificationHours))
        await saving

        expect(store.getSnapshot().notificationHours).toEqual(notificationHours)
        expect(calls).toHaveLength(2)
    })

    it('sorts the ranges of a day by start, and keeps the other days', async () => {
        const { store, calls } = await setup()

        void store.setNotificationHours({ days: { tuesday: ['13:00-17:00', '00:00-00:00', '09:00-12:00'] } })

        expect(store.getSnapshot().notificationHours?.days).toEqual({ ...week(['09:00-17:00']), tuesday: ['00:00-00:00', '09:00-12:00', '13:00-17:00'] })
        expect(calls[1]!.data).toMatchObject({ notificationHours: { enabled: false, days: { tuesday: ['00:00-00:00', '09:00-12:00', '13:00-17:00'] } } })
    })

    it('saves a day sorted while the form changes its ranges in the order they show, the newest change last', async () => {
        const split = { ...HOURS, days: { ...HOURS.days, monday: ['08:00-12:00', '13:00-18:00'] } }
        const { store, calls, flush } = await setup(response({ inbox: true, mail: true }, undefined, true, true, 'instant', split))

        // The user types an earlier start into the second range, which stays the second range in the form.
        const saving = store.setNotificationHours({ days: { monday: ['08:00-12:00', '01:00-18:00'] } })
        void store.setNotificationHours({ days: { monday: ['08:00-12:00', '07:00-18:00'] } })

        expect(store.getSnapshot().notificationHours?.days.monday).toEqual(['07:00-18:00', '08:00-12:00'])
        expect(calls[1]!.data).toMatchObject({ notificationHours: { days: { monday: ['01:00-18:00', '08:00-12:00'] } } })

        calls[1]!.resolve(
            response({ inbox: true, mail: true }, undefined, true, true, 'instant', {
                ...split,
                days: { ...split.days, monday: ['01:00-18:00', '08:00-12:00'] },
            }),
        )
        await flush()

        expect(calls[2]!.data).toMatchObject({ notificationHours: { days: { monday: ['07:00-18:00', '08:00-12:00'] } } })

        calls[2]!.resolve(
            response({ inbox: true, mail: true }, undefined, true, true, 'instant', {
                ...split,
                days: { ...split.days, monday: ['07:00-18:00', '08:00-12:00'] },
            }),
        )
        await saving

        expect(store.getSnapshot().notificationHours?.days.monday).toEqual(['07:00-18:00', '08:00-12:00'])
        expect(calls).toHaveLength(3)
    })

    it('shows notification hours while they save, undoes those that fail, and keeps those saved while the preferences loaded', async () => {
        const { store, calls, onFailure, flush } = await setup()

        const failing = store.setNotificationHours({ enabled: true, days: { sunday: ['10:00-12:00'] } })
        expect(store.getSnapshot().notificationHours).toEqual({ enabled: true, days: { ...HOURS.days, sunday: ['10:00-12:00'] } })

        calls[1]!.reject(new Error('offline'))
        await failing

        expect(store.getSnapshot().notificationHours).toEqual(HOURS)
        expect(onFailure).toHaveBeenCalledTimes(1)

        const friday = { ...HOURS, days: { ...HOURS.days, friday: ['09:00-15:00'] } }
        const loading = store.load('/inbox')
        void store.setNotificationHours({ days: { friday: ['09:00-15:00'] } })
        calls[3]!.resolve(response({ inbox: true, mail: true }, undefined, true, true, 'instant', friday))
        await flush()
        // Read before the change was saved.
        calls[2]!.resolve(response({ inbox: true, mail: true }))
        await loading

        expect(store.getSnapshot().notificationHours).toEqual(friday)
    })

    it('sends notification hours that changed away and back during a failing save once, as they compare by their ranges', async () => {
        const { store, calls, onFailure, flush } = await setup()

        const saving = store.setNotificationHours({ days: { saturday: ['10:00-14:00'] } })
        void store.setNotificationHours({ days: { saturday: [] } })
        calls[1]!.reject(new Error('offline'))
        await flush()
        // The server stays offline.
        calls.slice(2).forEach((call) => call.reject(new Error('offline')))
        await saving

        expect(calls).toHaveLength(2)
        expect(onFailure).toHaveBeenCalledTimes(1)
        expect(store.getSnapshot().notificationHours).toEqual(HOURS)
    })

    it('sends notification hours that changed back to what the server had before a save that succeeded', async () => {
        const { store, calls, flush } = await setup()
        const saturday = { ...HOURS, days: { ...HOURS.days, saturday: ['10:00-14:00'] } }

        const saving = store.setNotificationHours({ days: { saturday: ['10:00-14:00'] } })
        void store.setNotificationHours({ days: { saturday: [] } })
        calls[1]!.resolve(response({ inbox: true, mail: true }, undefined, true, true, 'instant', saturday))
        await flush()

        expect(calls).toHaveLength(3)
        expect(calls[2]!.data).toMatchObject({ notificationHours: HOURS })

        calls[2]!.resolve(response({ inbox: true, mail: true }))
        await saving

        expect(store.getSnapshot().notificationHours).toEqual(HOURS)
    })

    it('sends notification hours that changed away and back to those on their way to the server only once', async () => {
        const { store, calls, flush } = await setup()
        const evening = { ...HOURS, days: { ...HOURS.days, monday: ['09:00-12:00', '18:00-20:00'] } }

        void store.setNotificationHours({ days: { monday: ['09:00-12:00', '18:00-20:00'] } })
        void store.setNotificationHours({ days: { monday: ['09:00-17:00'] } })
        void store.setNotificationHours({ days: { monday: ['18:00-20:00', '09:00-12:00'] } })
        calls[1]!.resolve(response({ inbox: true, mail: true }, undefined, true, true, 'instant', evening))
        await flush()

        expect(calls).toHaveLength(2)
        expect(store.getSnapshot().notificationHours).toEqual(evening)
    })

    it('ignores notification hours that change nothing, ranges that are not times of day, and a change that leaves no range', async () => {
        const { store, calls } = await setup()

        await store.setNotificationHours({ enabled: false, days: { monday: ['09:00-17:00'] } })
        await store.setNotificationHours({ days: { monday: ['9:00-17:00'] } })
        await store.setNotificationHours({ enabled: true, days: { monday: ['09:00-24:00'] } })
        await store.setNotificationHours({ days: { tuesday: ['09:00'] } })
        await store.setNotificationHours({ days: { wednesday: 'all day' as never } })
        await store.setNotificationHours({ enabled: true, days: { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [] } })

        expect(calls).toHaveLength(1)
        expect(store.getSnapshot().notificationHours).toEqual(HOURS)

        const only = await setup(response({ inbox: true, mail: true }, undefined, true, true, 'instant', { enabled: true, days: { monday: ['09:00-17:00'] } }))
        await only.store.setNotificationHours({ days: { monday: [] } })

        expect(only.calls).toHaveLength(1)
    })

    it('ignores notification hours in applications that do not offer them', async () => {
        const { store, calls } = await setup(response({ inbox: true, mail: true }, undefined, true, true, 'instant', null))

        await store.setNotificationHours({ enabled: true })

        expect(store.getSnapshot().notificationHours).toBeNull()
        expect(calls).toHaveLength(1)
    })

    it('leaves out a channel, a frequency, and notification hours that the server stopped offering while they saved', async () => {
        const { store, calls, channels, frequency, flush } = await setup()
        const offered = response({ inbox: true }, undefined, true, true, null, null)

        const saving = [
            store.set('billing', 'mail', false),
            store.setFrequency('billing', 'daily'),
            store.setNotificationHours({ days: { saturday: ['10:00-14:00'] } }),
        ]
        const loading = store.load('/inbox')
        calls[4]!.resolve(offered)
        await loading

        calls.slice(1, 4).forEach((call) => call.resolve(offered))
        await Promise.all(saving)
        await flush()

        expect(channels('billing')).toEqual({ inbox: true })
        expect(frequency('billing')).toBeNull()
        expect(store.getSnapshot().notificationHours).toBeNull()
        expect(calls).toHaveLength(5)
    })

    it('forgets the preferences when the user changes, and ignores the answers for the previous user', async () => {
        const { store, calls, channels } = await setup()
        const unsubscribe = store.subscribe(() => {})

        const saving = store.set('billing', 'mail', false)
        store.reset('/inbox')
        expect(store.getSnapshot()).toMatchObject({ status: 'loading', categories: [] })

        calls[1]!.resolve(response({ inbox: true, mail: false }))
        await saving
        expect(store.getSnapshot().categories).toEqual([])

        calls[2]!.resolve(response({ inbox: false, mail: true }))
        await new Promise((resolve) => setTimeout(resolve))
        expect(channels('billing')).toEqual({ inbox: false, mail: true })

        unsubscribe()
    })
})

describe('parsePreferences', () => {
    it('reads the response and skips invalid entries', () => {
        expect(
            parsePreferences({
                channels: [{ key: 'inbox' }, { label: 'No key' }, 'mail'],
                groups: [{ key: 'account', description: 'Payments.' }, { label: 'No key' }],
                categories: [
                    { key: 'billing', locked: 1, group: 'account', channels: [] },
                    { key: 'comments', group: 7, channels: { inbox: false, mail: 'yes' } },
                    { label: 'No key' },
                ],
            }),
        ).toEqual({
            channels: [{ key: 'inbox', label: 'inbox', globalSwitch: false, enabled: true, digest: false, inbox: false, push: false }],
            groups: [{ key: 'account', label: 'account', description: 'Payments.' }],
            categories: [
                { key: 'billing', label: 'billing', description: null, group: 'account', locked: false, channels: {}, frequency: null },
                { key: 'comments', label: 'comments', description: null, group: null, locked: false, channels: { inbox: false }, frequency: null },
            ],
            notificationHours: null,
            frequencies: ['instant', 'hourly', 'daily', 'weekly'],
        })
        expect(parsePreferences({ channels: [], categories: [] })).toEqual({
            channels: [],
            groups: [],
            categories: [],
            notificationHours: null,
            frequencies: ['instant', 'hourly', 'daily', 'weekly'],
        })
        expect(parsePreferences({ channels: [{ key: 'mail', globalSwitch: true, enabled: false, digest: true }], categories: [] })?.channels).toEqual([
            { key: 'mail', label: 'mail', globalSwitch: true, enabled: false, digest: true, inbox: false, push: false },
        ])
        expect(parsePreferences({ channels: [{ key: 'push', label: 'Push notifications', push: true }], categories: [] })?.channels).toEqual([
            { key: 'push', label: 'Push notifications', globalSwitch: false, enabled: true, digest: false, inbox: false, push: true },
        ])
        expect(
            parsePreferences({
                channels: [],
                categories: [
                    { key: 'a', frequency: 'weekly' },
                    { key: 'b', frequency: 'hourly' },
                    { key: 'c', frequency: 'monthly' },
                ],
            })?.categories.map(({ frequency }) => frequency),
        ).toEqual(['weekly', 'hourly', null])
        expect(
            parsePreferences({ channels: [], categories: [], notificationHours: { enabled: true, start: '22:00', end: '07:00' } })?.notificationHours,
        ).toBeNull()
        expect(parsePreferences({ channels: [], categories: [], notificationHours: { enabled: false, days: [] } })?.notificationHours).toBeNull()
        expect(parsePreferences({ channels: [] })).toBeUndefined()
    })

    // The response of the PHP package, which its own test compares with this file.
    it('keeps every channel, group, category, frequency, and notification hour that the endpoint sends', () => {
        expect(parsePreferences(wire)).toEqual(wire)
    })
})

describe('parsePreferences frequencies', () => {
    const frequencies = (value: unknown) => parsePreferences({ channels: [], categories: [], frequencies: value })?.frequencies

    it('keeps the offered frequencies in the order forms offer them, and leaves out unknown ones', () => {
        expect(frequencies(['instant', 'hourly', 'daily', 'weekly'])).toEqual(['instant', 'hourly', 'daily', 'weekly'])
        expect(frequencies(['instant', 'daily'])).toEqual(['instant', 'daily'])
        expect(frequencies(['weekly', 'monthly', 'hourly', 'instant'])).toEqual(['instant', 'hourly', 'weekly'])
    })

    it('offers every frequency when the response lists none it knows', () => {
        const every = ['instant', 'hourly', 'daily', 'weekly']

        expect(frequencies(undefined)).toEqual(every)
        expect(frequencies([])).toEqual(every)
        expect(frequencies(['monthly'])).toEqual(every)
        expect(frequencies({ instant: true })).toEqual(every)
    })
})

describe('parsePreferences notification hours', () => {
    it('reads every day, Monday first, with its valid ranges sorted by start', () => {
        const hours = parsePreferences({
            channels: [],
            categories: [],
            notificationHours: { enabled: 1, days: { sunday: 'all day', friday: ['13:00-17:00', '9 to 5', '09:00-12:00'], monday: ['22:00-02:00'] } },
        })?.notificationHours

        expect(hours).toEqual({ enabled: false, days: { ...week([], []), monday: ['22:00-02:00'], friday: ['09:00-12:00', '13:00-17:00'] } })
        expect(Object.keys(hours!.days)).toEqual(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
    })
})

describe('notification hours helpers', () => {
    const hours: PreferenceNotificationHours = { enabled: true, days: { ...week([]), tuesday: ['08:00-12:00', '13:00-18:00'], thursday: ['10:00-16:00'] } }

    it('names the weekdays in the locale', () => {
        expect(weekdayName('monday', 'en')).toBe('Monday')
        expect(weekdayName('sunday', 'de')).toBe('Sonntag')
    })

    it('splits a range into its start and end', () => {
        expect(rangeTimes('22:00-02:00')).toEqual(['22:00', '02:00'])
    })

    it('gives a day that turns on the first range of the nearest day before it with hours, or 09:00 to 17:00', () => {
        expect(rangeForDay(hours, 'wednesday')).toBe('08:00-12:00')
        expect(rangeForDay(hours, 'saturday')).toBe('10:00-16:00')
        expect(rangeForDay(hours, 'monday')).toBe('10:00-16:00')
        expect(rangeForDay({ enabled: true, days: week([]) }, 'monday')).toBe('09:00-17:00')
    })

    it('adds an hour-long range an hour after the latest range of the day ends, while it fits before midnight', () => {
        expect(nextRange(['13:00-18:00', '08:00-12:00'])).toBe('19:00-20:00')
        expect(nextRange(['20:00-22:00'])).toBe('23:00-00:00')
        expect(nextRange(['20:00-22:30'])).toBeUndefined()
        expect(nextRange(['09:00-12:00', '22:00-02:00'])).toBeUndefined()
        expect(nextRange(['00:00-00:00'])).toBeUndefined()
        expect(nextRange([])).toBeUndefined()
    })

    it('locks the switch of the only day with hours', () => {
        expect(isOnlyDayWithHours(hours, 'tuesday')).toBe(false)
        expect(isOnlyDayWithHours({ enabled: true, days: { ...week([]), friday: ['09:00-17:00'] } }, 'friday')).toBe(true)
        expect(isOnlyDayWithHours({ enabled: true, days: { ...week([]), friday: ['09:00-17:00'] } }, 'monday')).toBe(false)
    })

    it('shows each day with its ranges, its switch locked while the hours are off or on the only day with hours, and room for another range', () => {
        const friday = { enabled: true, days: { ...week([]), friday: ['20:00-22:30'] } }

        expect(notificationHoursDays(null, null)).toEqual([])
        expect(notificationHoursDays(hours, null, 'en').map(({ day }) => day)).toEqual([
            'monday',
            'tuesday',
            'wednesday',
            'thursday',
            'friday',
            'saturday',
            'sunday',
        ])
        expect(notificationHoursDays(hours, null, 'en')[1]).toEqual({
            day: 'tuesday',
            name: 'Tuesday',
            ranges: [
                ['08:00', '12:00'],
                ['13:00', '18:00'],
            ],
            locked: false,
            canAdd: true,
        })
        expect(notificationHoursDays(friday, null, 'en')[4]).toMatchObject({ locked: true, canAdd: false })
        expect(notificationHoursDays({ ...hours, enabled: false }, null, 'en')[1]).toMatchObject({ locked: true, canAdd: false })
    })

    it('keeps the order of a day while the user changes its times, and shows that order until the focus leaves the day', () => {
        const typed = editNotificationHours(hours, null, { kind: 'time', day: 'tuesday', index: 1, field: 'start', time: '07:00' })!
        const editing = typed.editing(null)
        // The store saves the day sorted.
        const saved = { ...hours, days: { ...hours.days, tuesday: ['07:00-18:00', '08:00-12:00'] } }

        expect(typed.ranges).toEqual(['08:00-12:00', '07:00-18:00'])
        expect(editing).toEqual({ day: 'tuesday', ranges: ['08:00-12:00', '07:00-18:00'] })
        // Changing a time of another day moves the order that the form keeps to that day.
        expect(editNotificationHours(saved, editing, { kind: 'time', day: 'thursday', index: 0, field: 'end', time: '17:00' })!.editing(editing)).toEqual({
            day: 'thursday',
            ranges: ['10:00-17:00'],
        })
        expect(notificationHoursDays(saved, editing, 'en')[1]!.ranges).toEqual([
            ['08:00', '12:00'],
            ['07:00', '18:00'],
        ])
        expect(notificationHoursDays(saved, null, 'en')[1]!.ranges).toEqual([
            ['07:00', '18:00'],
            ['08:00', '12:00'],
        ])
        expect(editNotificationHours(saved, editing, { kind: 'time', day: 'tuesday', index: 1, field: 'end', time: '19:00' })?.ranges).toEqual([
            '08:00-12:00',
            '07:00-19:00',
        ])
    })

    it('turns a day off, or on with the first range of the day before it, except the only day with hours and while the hours are off', () => {
        expect(editNotificationHours(hours, null, { kind: 'toggle', day: 'tuesday' })?.ranges).toEqual([])
        expect(editNotificationHours(hours, null, { kind: 'toggle', day: 'wednesday' })?.ranges).toEqual(['08:00-12:00'])
        expect(editNotificationHours({ ...hours, enabled: false }, null, { kind: 'toggle', day: 'wednesday' })).toBeUndefined()
        expect(
            editNotificationHours({ enabled: true, days: { ...week([]), friday: ['09:00-17:00'] } }, null, { kind: 'toggle', day: 'friday' }),
        ).toBeUndefined()
    })

    it('adds a range after the latest one of a day and removes one, in the order that a day whose times change shows', () => {
        const editing = { day: 'tuesday' as const, ranges: ['13:00-18:00', '08:00-12:00'] }
        const added = editNotificationHours(hours, editing, { kind: 'add', day: 'tuesday' })!
        const removed = editNotificationHours(hours, editing, { kind: 'remove', day: 'tuesday', index: 0 })!
        const elsewhere = editNotificationHours(hours, editing, { kind: 'add', day: 'thursday' })!

        expect(added.ranges).toEqual(['13:00-18:00', '08:00-12:00', '19:00-20:00'])
        expect(added.editing(editing)).toEqual({ day: 'tuesday', ranges: ['13:00-18:00', '08:00-12:00', '19:00-20:00'] })
        expect(removed.ranges).toEqual(['08:00-12:00'])
        expect(removed.editing(editing)).toEqual({ day: 'tuesday', ranges: ['08:00-12:00'] })
        expect(elsewhere.ranges).toEqual(['10:00-16:00', '17:00-18:00'])
        expect(elsewhere.editing(editing)).toBe(editing)
        // The day whose times the user changes is the one at the time of the change, such as none after the focus left it.
        expect(added.editing(null)).toBeNull()
        expect(editNotificationHours(hours, null, { kind: 'add', day: 'monday' })).toBeUndefined()
        expect(editNotificationHours({ ...hours, enabled: false }, null, { kind: 'add', day: 'thursday' })).toBeUndefined()
    })
})

describe('preferencesTable', () => {
    const channel = (key: string, globalSwitch = false): PreferenceChannel => ({
        key,
        label: key,
        globalSwitch,
        enabled: true,
        digest: false,
        inbox: false,
        push: false,
    })
    const category = (frequency: PreferenceCategory['frequency']): PreferenceCategory => ({
        key: 'billing',
        label: 'Billing',
        description: null,
        group: null,
        locked: false,
        channels: {},
        frequency,
    })

    it('adds the row of channel switches and the frequency column only when a channel or category has them', () => {
        expect(preferencesTable([channel('inbox'), channel('mail')], [category(null)], ['instant'], DEFAULT_PREFERENCES_LABELS)).toEqual({
            hasGlobalSwitches: false,
            hasFrequencies: false,
            columns: 3,
            frequencyOptions: [{ value: 'instant', label: 'Instantly' }],
        })
        expect(
            preferencesTable([channel('inbox'), channel('mail', true)], [category('daily')], ['instant', 'daily'], DEFAULT_PREFERENCES_LABELS),
        ).toMatchObject({
            hasGlobalSwitches: true,
            hasFrequencies: true,
            columns: 4,
            frequencyOptions: [{ value: 'instant' }, { value: 'daily' }],
        })
    })
})

describe('preferenceSections', () => {
    const category = (key: string, group: string | null): PreferenceCategory => ({
        key,
        label: key,
        description: null,
        group,
        locked: false,
        channels: {},
        frequency: null,
    })

    it('lists the categories without a group first, then each group with categories in order', () => {
        const groups = [
            { key: 'news', label: 'News', description: null },
            { key: 'account', label: 'Account', description: null },
            { key: 'empty', label: 'Empty', description: null },
        ]
        const categories = [category('billing', 'account'), category('comments', null), category('product', 'news'), category('security', 'account')]

        expect(preferenceSections({ groups, categories }).map(({ group, categories }) => [group?.key ?? null, categories.map(({ key }) => key)])).toEqual([
            [null, ['comments']],
            ['news', ['product']],
            ['account', ['billing', 'security']],
        ])
    })

    it('shows a category whose group is not listed with the categories without a group', () => {
        const sections = preferenceSections({ groups: [], categories: [category('billing', 'account')] })

        expect(sections).toEqual([{ group: null, categories: [category('billing', 'account')] }])
    })
})

describe('receives', () => {
    const billing: PreferenceCategory = {
        key: 'billing',
        label: 'Billing',
        description: null,
        group: null,
        locked: false,
        channels: { mail: true, inbox: false },
        frequency: 'daily',
    }
    const mail: PreferenceChannel = { key: 'mail', label: 'Email', globalSwitch: true, enabled: true, digest: true, inbox: false, push: false }

    it('follows the choice of the category while the channel is on', () => {
        expect(receives(billing, mail, [mail])).toBe(true)
        expect(receives(billing, { ...mail, key: 'inbox' }, [mail])).toBe(false)
    })

    it('receives nothing on a channel that is off, except locked categories', () => {
        expect(receives(billing, { ...mail, enabled: false }, [mail])).toBe(false)
        expect(receives({ ...billing, locked: true }, { ...mail, enabled: false }, [mail])).toBe(true)
    })
})

describe('the push switch', () => {
    const inbox: PreferenceChannel = { key: 'inbox', label: 'In the app', globalSwitch: true, enabled: true, digest: false, inbox: true, push: false }
    const mail: PreferenceChannel = { key: 'mail', label: 'Email', globalSwitch: true, enabled: true, digest: true, inbox: false, push: false }
    const push: PreferenceChannel = { key: 'push', label: 'Push', globalSwitch: true, enabled: true, digest: false, inbox: false, push: true }
    const comments = (channels: Record<string, boolean>, locked = false): PreferenceCategory => ({
        key: 'comments',
        label: 'Comments',
        description: null,
        group: null,
        locked,
        channels,
        frequency: null,
    })

    /** Whether the switch of the channel is on, and whether it is disabled. */
    const pushSwitch = (category: PreferenceCategory, channels: readonly PreferenceChannel[] = [inbox, mail, push], channel = push) => [
        receives(category, channel, channels),
        isDisabled(category, channel, channels),
    ]

    it('is off and disabled while the user does not receive the category in the notification center', () => {
        expect(pushSwitch(comments({ inbox: false, mail: true, push: true }))).toEqual([false, true])
        expect(pushSwitch(comments({ inbox: true, mail: true, push: true }))).toEqual([true, false])
        expect(pushSwitch(comments({ inbox: true, mail: true, push: false }))).toEqual([false, false])
        expect(pushSwitch(comments({ inbox: false, mail: true, push: true }), [inbox, mail, push], mail)).toEqual([true, false])
    })

    it('is off and disabled while the inbox channel is off for every category', () => {
        expect(pushSwitch(comments({ inbox: true, push: true }), [{ ...inbox, enabled: false }, mail, push])).toEqual([false, true])
    })

    it('stays on in a locked category, which always sends, also while the inbox and push channels are off', () => {
        const pushOff = { ...push, enabled: false }

        expect(pushSwitch(comments({ inbox: true, push: true }, true), [{ ...inbox, enabled: false }, mail, push])).toEqual([true, true])
        expect(pushSwitch(comments({ inbox: true, push: true }, true), [{ ...inbox, enabled: false }, mail, pushOff], pushOff)).toEqual([true, true])
    })

    it('follows the choice of a channel that covers both the notification center and the pushes', () => {
        const both = { ...inbox, push: true }

        expect(pushSwitch(comments({ inbox: false, mail: true }), [both, mail], both)).toEqual([false, false])
        expect(pushSwitch(comments({ inbox: true, mail: true }), [both, mail], both)).toEqual([true, false])
    })

    it('follows its own choice without a channel that covers the notification center', () => {
        expect(pushSwitch(comments({ mail: false, push: true }), [mail, push])).toEqual([true, false])
        expect(pushSwitch(comments({ mail: false, push: false }), [mail, push])).toEqual([false, false])
    })

    it('follows its own choice in a category that does not offer the inbox channel, also while that channel is off', () => {
        expect(pushSwitch(comments({ mail: false, push: true }))).toEqual([true, false])
        expect(pushSwitch(comments({ mail: false, push: true }), [{ ...inbox, enabled: false }, mail, push])).toEqual([true, false])
    })

    it('is off and disabled while the push channel is off for every category', () => {
        const pushOff = { ...push, enabled: false }

        expect(pushSwitch(comments({ inbox: true, push: true }), [inbox, mail, pushOff], pushOff)).toEqual([false, true])
    })

    it('shows the stored choice again once the user receives the category in the notification center again', async () => {
        const { store, channels } = await setup({
            channels: [inbox, push],
            categories: [comments({ inbox: true, push: true }), { ...comments({ inbox: true, push: false }), key: 'billing' }],
        })
        const pushSwitches = () => store.getSnapshot().categories.map((category) => pushSwitch(category, store.getSnapshot().channels))

        void store.set('comments', 'inbox', false)
        void store.set('billing', 'inbox', false)

        expect(pushSwitches()).toEqual([
            [false, true],
            [false, true],
        ])

        void store.set('comments', 'inbox', true)
        void store.set('billing', 'inbox', true)

        expect(pushSwitches()).toEqual([
            [true, false],
            [false, false],
        ])
        expect([channels('comments'), channels('billing')]).toEqual([
            { inbox: true, push: true },
            { inbox: true, push: false },
        ])
    })
})

describe('frequencyApplies', () => {
    const billing: PreferenceCategory = {
        key: 'billing',
        label: 'Billing',
        description: null,
        group: null,
        locked: false,
        channels: { mail: true, inbox: true },
        frequency: 'daily',
    }
    const inbox = { key: 'inbox', label: 'In the app', globalSwitch: true, enabled: true, digest: false }
    const mail = { key: 'mail', label: 'Email', globalSwitch: true, enabled: true, digest: true }

    it('applies while the user receives the category on a channel that digests hold', () => {
        expect(frequencyApplies(billing, [inbox, mail])).toBe(true)
        expect(frequencyApplies({ ...billing, channels: { mail: false, inbox: true } }, [inbox, mail])).toBe(false)
        expect(frequencyApplies(billing, [inbox, { ...mail, enabled: false }])).toBe(false)
        expect(frequencyApplies({ ...billing, frequency: null }, [inbox, mail])).toBe(false)
    })
})
