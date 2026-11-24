import { afterEach, describe, expect, it, onTestFinished, vi } from 'vite-plus/test'

import type { InertiaBindings } from './inertia'

// initNotifications() only runs in a browser, so these tests run against a minimal window and document.
const page = Object.assign(new EventTarget(), { title: 'Dashboard', visibilityState: 'visible' as DocumentVisibilityState, hasFocus: () => true })
const focus = vi.fn()
vi.stubGlobal('window', Object.assign(new EventTarget(), { location: { href: 'https://app.test/', origin: 'https://app.test' }, focus }))
vi.stubGlobal('document', page)

/** A stand-in for the browser's desktop notifications, which records the ones it shows. */
class DesktopNotification extends EventTarget {
    static permission: NotificationPermission = 'granted'
    static requestPermission = vi.fn(async () => 'granted' as NotificationPermission)
    closed = false

    constructor(
        public title: string,
        public options: NotificationOptions,
    ) {
        super()
        shown.push(this)
    }

    close() {
        this.closed = true
    }
}
const shown: DesktopNotification[] = []
vi.stubGlobal('Notification', DesktopNotification)

// Stand-ins for the browser's audio, which record the sounds they play.
const played: string[] = []
let refuseSounds = false

class SoundFile {
    currentTime = 0

    constructor(public src: string) {}

    getAttribute() {
        return this.src
    }

    play() {
        played.push(`${this.src} from ${this.currentTime}`)
        this.currentTime = 1

        return refuseSounds ? Promise.reject(new DOMException('The user did not interact with the page.', 'NotAllowedError')) : Promise.resolve()
    }
}
vi.stubGlobal('Audio', SoundFile)

class Chime {
    currentTime = 0
    destination = {}

    createOscillator() {
        const oscillator = {
            frequency: { value: 0 },
            connect: (node: unknown) => node,
            start: () => played.push(`chime ${oscillator.frequency.value}`),
            stop: () => {},
        }

        return oscillator
    }

    createGain() {
        return { gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect: (node: unknown) => node }
    }
}
vi.stubGlobal('AudioContext', Chime)

// The counts on the app's icon, with 0 for a cleared badge. Node's navigator has no badge, so the test adds one.
const badges: number[] = []
let refuseBadges = false
const badge = (count: number) => {
    badges.push(count)

    return refuseBadges ? Promise.reject(new DOMException('The app is not installed.', 'NotAllowedError')) : Promise.resolve()
}
Object.defineProperties(navigator, {
    setAppBadge: { value: (count: number) => badge(count), configurable: true },
    clearAppBadge: { value: () => badge(0), configurable: true },
})

const { ELECTION_LOCK, electTab, requestNotificationPermission } = await import('./browserAlerts')
const { inboxStore } = await import('./inbox')
const { pushStore } = await import('./push')
const { initNotifications } = await import('./toast')
const { DEFAULT_TRANSLATIONS, setTranslations } = await import('./translations')

const visits: string[] = []
const listeners: Partial<{ [K in keyof InertiaBindings]: Parameters<InertiaBindings[K]>[0] }> = {}
const bindings: InertiaBindings = {
    onFlash: () => {},
    onRequest: () => {},
    onResponse: () => {},
    onError: () => {},
    onHttpException: () => {},
    onNavigate: (listener) => void (listeners.onNavigate = listener),
    visit: (href) => void visits.push(href),
    request: () => new Promise(() => {}),
    useSocketId: () => {},
}

initNotifications(bindings)

let revision = 1

/** Shows a page whose shared prop has the given unread count. */
const navigate = (unread: number): void =>
    listeners.onNavigate!(
        { inertiauiInbox: { url: '/inbox', unread, unseen: unread, categories: [], latest: null, latestIds: [], revision: revision++ } },
        'visit',
    )

/** The names of the Web Locks that tabs hold. */
const heldLocks = async () => (await navigator.locks.query()).held.map((lock) => lock.name)

/** The names of the Web Locks that tabs wait for. */
const waitingLocks = async () => (await navigator.locks.query()).pending.map((lock) => lock.name)

/** Waits until this tab holds the election's lock, as the visible tab takes it over. */
const elected = () => vi.waitFor(async () => expect(await heldLocks()).toContain(ELECTION_LOCK))

/** A notification that arrives in real time, as Echo delivers it. */
const arrive = (id: string, overrides: Record<string, unknown> = {}) =>
    inboxStore.receive({ id, title: `Invoice ${id} paid`, body: 'Acme paid by card.', url: `/invoices/${id}`, createdAt: '2026-11-16T10:00:00Z', ...overrides })

afterEach(async () => {
    initNotifications(bindings, { inbox: { titleCount: false, appBadge: false, desktopNotifications: false, sound: false } })
    await vi.waitFor(async () => expect(await heldLocks()).not.toContain(ELECTION_LOCK))
    setTranslations({ inbox_title_count: DEFAULT_TRANSLATIONS.inbox_title_count })
    page.title = 'Dashboard'
    navigate(0)
    badges.length = 0
    refuseBadges = false
    page.visibilityState = 'visible'
    shown.length = 0
    visits.length = 0
    focus.mockClear()
    DesktopNotification.permission = 'granted'
    played.length = 0
    refuseSounds = false
})

describe('title count', () => {
    it('leaves the title alone by default', () => {
        navigate(3)

        expect(page.title).toBe('Dashboard')
    })

    it('shows the unread count in the title until no notification is unread', () => {
        navigate(3)
        initNotifications(bindings, { inbox: { titleCount: true } })

        expect(page.title).toBe('(3) Dashboard')

        navigate(120)
        expect(page.title).toBe('(99+) Dashboard')

        // Read in another session.
        navigate(0)
        expect(page.title).toBe('Dashboard')
    })

    it('keeps the count when the page changes its title, and removes it when turned off', () => {
        navigate(2)
        initNotifications(bindings, { inbox: { titleCount: true } })
        // A later call without the option keeps it.
        initNotifications(bindings, { inbox: {} })

        page.title = 'Settings'
        navigate(4)
        expect(page.title).toBe('(4) Settings')

        initNotifications(bindings, { inbox: { titleCount: false } })
        expect(page.title).toBe('Settings')
    })

    it('formats the title with the inbox_title_count translation', () => {
        setTranslations({ inbox_title_count: ({ number, title }) => `${title} [${number} ongelezen]` })
        navigate(120)
        initNotifications(bindings, { inbox: { titleCount: true } })

        expect(page.title).toBe('Dashboard [120 ongelezen]')
    })
})

describe('app badge', () => {
    it('leaves the app badge alone by default', () => {
        navigate(3)

        expect(badges).toEqual([])
    })

    it('shows the unread count on the app badge, clears it at zero, and sets it only when the count changes', () => {
        navigate(3)
        initNotifications(bindings, { inbox: { appBadge: true } })
        navigate(120)
        navigate(120)
        navigate(0)

        expect(badges).toEqual([3, 120, 0])
    })

    it('clears the app badge when turned off', () => {
        navigate(2)
        initNotifications(bindings, { inbox: { appBadge: true } })
        initNotifications(bindings, { inbox: { appBadge: false } })
        navigate(4)

        expect(badges).toEqual([2, 0])
    })

    it('clears the app badge when the user signs out', () => {
        navigate(2)
        initNotifications(bindings, { inbox: { appBadge: true } })
        listeners.onNavigate!({ inertiauiInbox: null }, 'visit')

        expect(badges).toEqual([2, 0])
    })

    it('ignores a browser that refuses the badge', async () => {
        refuseBadges = true
        navigate(1)
        initNotifications(bindings, { inbox: { appBadge: true } })
        await Promise.resolve()

        expect(badges).toEqual([1])
    })
})

let elections = 0

/** A tab with its own document, which takes part in an election of its own lock. */
function tab(visibilityState: DocumentVisibilityState, name = `election-${elections}`) {
    const tabDocument = Object.assign(new EventTarget(), { visibilityState })
    vi.stubGlobal('document', tabDocument)
    const election = electTab(name)
    vi.stubGlobal('document', page)

    const show = (state: DocumentVisibilityState) => {
        tabDocument.visibilityState = state
        tabDocument.dispatchEvent(new Event('visibilitychange'))
    }

    return { election, show: () => show('visible'), hide: () => show('hidden') }
}

describe('tab election', () => {
    afterEach(() => void elections++)

    it('elects the tab that the user looks at, and a tab that the user looks at later takes over', async () => {
        const first = tab('visible')
        await vi.waitFor(() => expect(first.election.elected()).toBe(true))

        // A tab that opens in the background waits.
        const second = tab('hidden')
        await new Promise((resolve) => setTimeout(resolve, 10))
        expect([first.election.elected(), second.election.elected()]).toEqual([true, false])

        first.hide()
        second.show()
        await vi.waitFor(() => expect([first.election.elected(), second.election.elected()]).toEqual([false, true]))

        first.show()
        await vi.waitFor(() => expect([first.election.elected(), second.election.elected()]).toEqual([true, false]))

        first.election.stop()
        second.election.stop()
    })

    it('hands the election to a waiting tab once the elected tab closes', async () => {
        const first = tab('visible')
        const second = tab('hidden')
        await vi.waitFor(() => expect(first.election.elected()).toBe(true))

        first.election.stop()

        await vi.waitFor(() => expect(second.election.elected()).toBe(true))
        expect(first.election.elected()).toBe(false)

        second.election.stop()
        await vi.waitFor(async () => expect(await heldLocks()).not.toContain(`election-${elections}`))
    })

    it('elects the tab that the user looks at in browsers without Web Locks', () => {
        Object.defineProperty(navigator, 'locks', { value: undefined, configurable: true })

        try {
            const visible = tab('visible')
            const hidden = tab('hidden')

            expect([visible.election.elected(), hidden.election.elected()]).toEqual([true, false])

            hidden.show()
            expect(hidden.election.elected()).toBe(true)
        } finally {
            delete (navigator as { locks?: LockManager }).locks
        }
    })
})

describe('desktop notifications', () => {
    it('shows none by default', async () => {
        navigate(0)
        page.visibilityState = 'hidden'
        arrive('1')

        expect(shown).toEqual([])
        expect(await heldLocks()).not.toContain(ELECTION_LOCK)
    })

    it('shows a notification that arrives while the elected tab is hidden', async () => {
        navigate(0)
        initNotifications(bindings, { inbox: { desktopNotifications: true } })
        await elected()

        page.visibilityState = 'hidden'
        arrive('2', { actor: { name: 'Sophie Martin', avatar: '/avatars/sophie.png' } })

        expect(shown.map(({ title, options }) => [title, options])).toEqual([
            ['Invoice 2 paid', { body: 'Acme paid by card.', icon: '/avatars/sophie.png', tag: 'inertiaui-inbox-2' }],
        ])
    })

    it('shows none while the tab is visible, without permission, or for a notification that was read or arrived outside the notification hours', async () => {
        navigate(0)
        initNotifications(bindings, { inbox: { desktopNotifications: true } })
        await elected()

        arrive('3')
        page.visibilityState = 'hidden'
        arrive('4', { readAt: '2026-11-16T10:00:01Z' })
        arrive('4b', { quiet: true })
        DesktopNotification.permission = 'default'
        arrive('5')

        expect(shown).toEqual([])
    })

    it('shows the notification also while this device receives pushes', async () => {
        navigate(0)
        initNotifications(bindings, { inbox: { desktopNotifications: true } })
        await elected()
        const pushed = vi.spyOn(pushStore, 'getSnapshot').mockReturnValue({ ...pushStore.getSnapshot(), subscribed: true })
        onTestFinished(() => pushed.mockRestore())

        page.visibilityState = 'hidden'
        arrive('pushed')

        expect(shown.map(({ title, options }) => [title, options.tag])).toEqual([['Invoice pushed paid', 'inertiaui-inbox-pushed']])
    })

    it('brings the tab to the front and opens the notification when the user clicks it', async () => {
        navigate(0)
        initNotifications(bindings, { inbox: { desktopNotifications: true } })
        await elected()

        page.visibilityState = 'hidden'
        arrive('6')
        shown[0]!.dispatchEvent(new Event('click'))

        expect(focus).toHaveBeenCalledOnce()
        expect(shown[0]!.closed).toBe(true)
        expect(visits).toEqual(['/invoices/6'])
        expect(inboxStore.getSnapshot().items.find((item) => item.id === '6')?.readAt).not.toBeNull()

        // A notification without a URL is only marked as read.
        arrive('6b', { url: null })
        shown[1]!.dispatchEvent(new Event('click'))

        expect(visits).toEqual(['/invoices/6'])
        expect(inboxStore.getSnapshot().items.find((item) => item.id === '6b')?.readAt).not.toBeNull()
    })

    it('shows none in a tab that another tab took over from, and again once that tab closes', async () => {
        navigate(0)
        initNotifications(bindings, { inbox: { desktopNotifications: true } })
        await elected()

        // The tab that lost the lock waits for it again.
        const other = tab('visible', ELECTION_LOCK)
        onTestFinished(() => other.election.stop())
        await vi.waitFor(async () => expect(await waitingLocks()).toContain(ELECTION_LOCK))
        page.visibilityState = 'hidden'
        arrive('7')
        expect(shown).toEqual([])

        other.election.stop()
        await vi.waitFor(async () => expect(await waitingLocks()).not.toContain(ELECTION_LOCK))
        arrive('8')
        expect(shown.map(({ title }) => title)).toEqual(['Invoice 8 paid'])
    })

    it('asks for permission, and answers denied in browsers without desktop notifications', async () => {
        expect(await requestNotificationPermission()).toBe('granted')
        expect(DesktopNotification.requestPermission).toHaveBeenCalledOnce()

        vi.stubGlobal('Notification', undefined)

        try {
            expect(await requestNotificationPermission()).toBe('denied')
        } finally {
            vi.stubGlobal('Notification', DesktopNotification)
        }
    })
})

describe('sound', () => {
    it('plays none by default', async () => {
        navigate(0)
        arrive('20')

        expect(played).toEqual([])
        expect(await heldLocks()).not.toContain(ELECTION_LOCK)
    })

    it('plays the audio at the URL from the start for each unread notification within the notification hours, also while the tab is visible', async () => {
        navigate(0)
        initNotifications(bindings, { inbox: { sound: '/sounds/ping.mp3' } })
        await elected()

        arrive('21')
        page.visibilityState = 'hidden'
        arrive('22')
        arrive('23', { archivedAt: '2026-11-16T10:00:01Z' })
        arrive('23b', { quiet: true })

        expect(played).toEqual(['/sounds/ping.mp3 from 0', '/sounds/ping.mp3 from 0'])
    })

    it('plays the built-in chime', async () => {
        navigate(0)
        initNotifications(bindings, { inbox: { sound: true } })
        await elected()

        arrive('24')

        expect(played).toEqual(['chime 880', 'chime 1320'])
    })

    it('plays none in a tab that another tab took over from', async () => {
        navigate(0)
        initNotifications(bindings, { inbox: { sound: true } })
        await elected()

        const other = tab('visible', ELECTION_LOCK)
        onTestFinished(() => other.election.stop())
        await vi.waitFor(async () => expect(await waitingLocks()).toContain(ELECTION_LOCK))
        arrive('25')
        other.election.stop()

        expect(played).toEqual([])
    })

    it('plays the sound also while this device receives pushes and the tab has no focus', async () => {
        navigate(0)
        initNotifications(bindings, { inbox: { sound: '/sounds/ping.mp3' } })
        await elected()
        const pushed = vi.spyOn(pushStore, 'getSnapshot').mockReturnValue({ ...pushStore.getSnapshot(), subscribed: true })
        const focused = vi.spyOn(document, 'hasFocus').mockReturnValue(false)
        onTestFinished(() => {
            pushed.mockRestore()
            focused.mockRestore()
        })

        arrive('28')

        expect(played).toEqual(['/sounds/ping.mp3 from 0'])
    })

    it('plays none before the user interacted with the page, and ignores a browser that blocks it', async () => {
        navigate(0)
        initNotifications(bindings, { inbox: { sound: '/sounds/ping.mp3' } })
        await elected()

        Object.defineProperty(navigator, 'userActivation', { value: { hasBeenActive: false }, configurable: true })

        try {
            arrive('26')
        } finally {
            delete (navigator as { userActivation?: UserActivation }).userActivation
        }

        refuseSounds = true
        arrive('27')
        await Promise.resolve()

        expect(played).toEqual(['/sounds/ping.mp3 from 0'])
    })
})
