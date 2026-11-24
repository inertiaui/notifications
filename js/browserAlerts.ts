import { badgeText, type InboxItem, type InboxStore } from './inbox'
import { inboxToastId } from './realtime'
import { trans } from './translations'
import type { NotificationsOptions } from './types'

/** The `inbox` options of the features that reach users outside the page. Each is off until it is turned on. */
export type BrowserAlertsOptions = Pick<NonNullable<NotificationsOptions['inbox']>, 'titleCount' | 'appBadge' | 'desktopNotifications' | 'sound'>

/** The Web Lock that the tabs of a browser hold in turn, which elects the tab that alerts the user. */
export const ELECTION_LOCK = 'inertiaui-notifications'

export interface TabElection {
    /** Whether this tab is the one that alerts the user. */
    elected(): boolean
    /** Leaves the election, so a waiting tab takes over. */
    stop(): void
}

/**
 * Elects one tab of the browser with the Web Locks API. A tab that the user looks at takes over, and a waiting tab
 * follows once the elected tab closes, so the elected tab is the one the user looked at last. Browsers without Web
 * Locks, such as on a site without HTTPS, elect the tab that the user looks at.
 */
export function electTab(name: string): TabElection {
    const page = document
    const locks: LockManager | undefined = navigator.locks

    if (!locks) {
        return { elected: () => page.visibilityState === 'visible', stop: () => {} }
    }

    let elected = false
    let stopped = false
    // Lets go of the lock that this tab holds or waits for.
    let leave: (() => void) | undefined

    const request = (steal: boolean): void => {
        leave?.()

        const controller = new AbortController()
        let release = (): void => {}
        const attempt = (): void => {
            controller.abort()
            release()
            elected = false
        }

        leave = attempt

        locks
            .request(name, steal ? { steal: true } : { signal: controller.signal }, () => {
                // A steal cannot be aborted, so a tab that left in the meantime lets go right away.
                if (leave !== attempt) {
                    return undefined
                }

                elected = true

                return new Promise<void>((resolve) => (release = resolve))
            })
            .catch(() => {
                // Another tab took the lock, so this tab waits for it again. A tab that left ignores the abort.
                if (leave === attempt && !stopped) {
                    request(false)
                }
            })
    }

    const onVisibilityChange = (): void => {
        if (page.visibilityState === 'visible' && !elected) {
            request(true)
        }
    }

    page.addEventListener('visibilitychange', onVisibilityChange)
    request(page.visibilityState === 'visible')

    return {
        elected: () => elected,
        stop() {
            stopped = true
            page.removeEventListener('visibilitychange', onVisibilityChange)
            leave?.()
            leave = undefined
        },
    }
}

/**
 * Asks the user to allow desktop notifications, and returns their choice. Browsers only show the prompt after a user
 * gesture, so call it from a click handler. Browsers without desktop notifications return `denied`.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
    if (typeof Notification !== 'function') {
        return 'denied'
    }

    return Notification.requestPermission()
}

export interface BrowserAlerts {
    /** Turns the features on or off. Options that are left out keep their value. */
    configure(options: BrowserAlertsOptions): void
}

let chimeContext: AudioContext | undefined

/** Plays the built-in sound: two short notes, synthesized so that the package ships no audio file. */
function playChime(): void {
    if (typeof AudioContext !== 'function') {
        return
    }

    chimeContext ??= new AudioContext()

    const context = chimeContext

    for (const [index, frequency] of [880, 1320].entries()) {
        const at = context.currentTime + index * 0.15
        const oscillator = context.createOscillator()
        const gain = context.createGain()

        oscillator.frequency.value = frequency
        gain.gain.setValueAtTime(0.2, at)
        gain.gain.exponentialRampToValueAtTime(0.001, at + 0.4)
        oscillator.connect(gain).connect(context.destination)
        oscillator.start(at)
        oscillator.stop(at + 0.4)
    }
}

/**
 * Reaches users who are not looking at the page: the unread count shows in the title of every tab and on the app's
 * icon, and the elected tab plays a sound for each notification that arrives, and shows a desktop notification for
 * it while it is hidden.
 */
export function createBrowserAlerts(store: InboxStore): BrowserAlerts {
    let titleCount = false
    // The page's own title, and the title that was written last, as the browser reads it back. A title that differs
    // from the written one was set by the page, such as with Inertia's <Head>, so it becomes the page's title.
    let pageTitle = ''
    let intended: string | undefined
    let written: string | undefined
    let observer: MutationObserver | undefined
    let appBadge = false
    // The count that this tab last put on the app's icon.
    let badge: number | undefined
    let desktopNotifications = false
    let sound: boolean | string = false
    // The audio of the sound's URL, which plays from the start for each notification.
    let audio: HTMLAudioElement | undefined
    let election: TabElection | undefined

    const showTitleCount = (): void => {
        const changed = document.title !== written

        if (changed) {
            pageTitle = document.title
        }

        const { unread } = store.getSnapshot().counts
        const title = titleCount && unread > 0 ? trans('inbox_title_count', { count: badgeText(unread, 99), number: unread, title: pageTitle }) : pageTitle

        // Writing the title changes the <head>, which calls this again; only a new title is written.
        if (changed || title !== intended) {
            intended = title

            if (document.title !== title) {
                document.title = title
            }

            written = document.title
        }
    }

    const toggleTitleCount = (enabled: boolean): void => {
        if (enabled === titleCount) {
            return
        }

        titleCount = enabled
        showTitleCount()
        observer?.disconnect()
        observer = undefined

        // Inertia replaces the <title> element on visits, which would drop the count.
        if (enabled && typeof MutationObserver === 'function' && document.head) {
            observer = new MutationObserver(showTitleCount)
            observer.observe(document.head, { childList: true, subtree: true, characterData: true })
        }
    }

    const showAppBadge = (): void => {
        const { url, counts } = store.getSnapshot()
        const count = appBadge ? counts.unread : 0

        // Until the first page brings the counts, the badge keeps the count of the previous session. Signing out
        // clears the URL too, and then clears the badge that this tab set.
        if (count === badge || (url === undefined && badge === undefined) || typeof navigator.setAppBadge !== 'function') {
            return
        }

        badge = count

        const result = count > 0 ? navigator.setAppBadge(count) : navigator.clearAppBadge()

        // Browsers may reject the badge of a site that is not installed as an app.
        result.catch(() => {})
    }

    const toggleAppBadge = (enabled: boolean): void => {
        if (enabled !== appBadge) {
            appBadge = enabled
            showAppBadge()
        }
    }

    // The tab takes part in the election while an alert that only one tab shows is turned on.
    const elect = (): void => {
        const needed = desktopNotifications || sound !== false

        if (needed && !election) {
            election = electTab(ELECTION_LOCK)
        }

        if (!needed && election) {
            election.stop()
            election = undefined
        }
    }

    const showDesktopNotification = (item: InboxItem): void => {
        if (typeof Notification !== 'function' || Notification.permission !== 'granted') {
            return
        }

        let notification: Notification

        try {
            notification = new Notification(item.title, { body: item.body ?? undefined, icon: item.actor?.avatar, tag: inboxToastId(item.id) })
        } catch {
            // Android only shows the notifications of a service worker.
            return
        }

        // Like a click in the panel, which marks the notification as read and visits its URL.
        notification.addEventListener('click', () => {
            window.focus()
            notification.close()
            store.open(item)
        })
    }

    const playSound = (source: true | string): void => {
        // Browsers only play sound once the user interacted with the page. A chime that waits for it would play late.
        if (navigator.userActivation?.hasBeenActive === false) {
            return
        }

        if (source === true) {
            playChime()

            return
        }

        if (audio?.getAttribute('src') !== source) {
            audio = new Audio(source)
        }

        audio.currentTime = 0

        // A browser that blocks the sound rejects it.
        audio.play().catch(() => {})
    }

    const alertUser = (item: InboxItem): void => {
        // A notification that was read or archived before it arrived, such as in another session, needs no alert, and
        // neither does one that arrived outside the user's notification hours or while they paused.
        if (!election?.elected() || item.quiet === true || item.readAt !== null || item.archivedAt !== null) {
            return
        }

        // A visible tab takes over the election, so a hidden elected tab means the user is not looking at any tab.
        if (desktopNotifications && document.visibilityState === 'hidden') {
            showDesktopNotification(item)
        }

        if (sound !== false) {
            playSound(sound)
        }
    }

    store.onArrival(alertUser)

    store.subscribe(() => {
        if (titleCount) {
            showTitleCount()
        }

        if (appBadge) {
            showAppBadge()
        }
    })

    return {
        configure(options) {
            if (options.titleCount !== undefined) {
                toggleTitleCount(options.titleCount)
            }

            if (options.appBadge !== undefined) {
                toggleAppBadge(options.appBadge)
            }

            desktopNotifications = options.desktopNotifications ?? desktopNotifications
            sound = options.sound ?? sound
            elect()
        },
    }
}
