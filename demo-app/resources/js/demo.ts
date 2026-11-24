// Shared by the Vue and React pages so both stacks render the same demo. Each page passes its own `toast` and
// `router`, which have the same API in both packages.
import type { router as InertiaRouter } from '@inertiajs/vue3'
import type { ToastFunction, TranslationValue } from '@inertiaui/notifications-vue'

export const scenarios = [
    { scenario: 'success', label: 'Success' },
    { scenario: 'info', label: 'Info' },
    { scenario: 'warning', label: 'Warning' },
    { scenario: 'error', label: 'Error' },
    { scenario: 'persistent', label: 'Persistent' },
    { scenario: 'multiple', label: 'Two toasts' },
    { scenario: 'action', label: 'With an action' },
    { scenario: 'undo', label: 'Undo on the server' },
    { scenario: 'deployment', label: 'Custom type' },
] as const

/** The icon of the custom `deployment` toast type: an arrow over a base, in a 20×20 box. */
export const deploymentIconPath = 'M10 2l5 6h-3v5H8V8H5l5-6Zm-6 14h12v2H4v-2Z'

/** The demo in Dutch, which the app entry sets when the URL has `?locale=nl`. Functions pick the plural forms. */
export const dutchTranslations: Record<string, TranslationValue> = {
    toaster_label: 'Meldingen',
    toast_dismiss: 'Sluiten: :title',
    toast_type_success: 'Gelukt',
    toast_type_info: 'Info',
    toast_type_warning: 'Waarschuwing',
    toast_type_error: 'Fout',
    inbox_title: 'Meldingen',
    inbox_bell: 'Meldingen',
    inbox_bell_new: ({ count, number }) => (number === 1 ? 'Meldingen, 1 nieuwe melding' : `Meldingen, ${count} nieuwe meldingen`),
    inbox_all: 'Alles',
    inbox_unread: 'Ongelezen',
    inbox_snoozed: 'Gesnoozed',
    inbox_archived: 'Gearchiveerd',
    inbox_mark_all_as_read: 'Alles gelezen',
    inbox_archive_all: 'Alles archiveren',
    inbox_more_actions: 'Meer acties',
    inbox_mark_as_read: 'Markeren als gelezen',
    inbox_archive: 'Archiveren',
    inbox_show_more: ({ count }) => (count === 1 ? 'Nog 1 melding tonen' : `Nog ${count} meldingen tonen`),
    inbox_show_less: 'Minder tonen',
    inbox_empty: 'Je hebt geen meldingen.',
    inbox_view_all: 'Alle meldingen bekijken',
    inbox_all_categories: 'Alle categorieën',
}

/** The icon that the demo's resolver gives the bell for ?icons=demo: a ringing bell, in a 20×20 box. */
export const bellAlertIconPaths = [
    'M4.214 3.227a.75.75 0 0 0-1.156-.955 8.97 8.97 0 0 0-1.856 3.825.75.75 0 0 0 1.466.316 7.47 7.47 0 0 1 1.546-3.186ZM16.942 2.272a.75.75 0 0 0-1.157.955 7.47 7.47 0 0 1 1.547 3.186.75.75 0 0 0 1.466-.316 8.971 8.971 0 0 0-1.856-3.825Z',
    'M10 2a6 6 0 0 0-6 6c0 1.887-.454 3.665-1.257 5.234a.75.75 0 0 0 .515 1.076 32.91 32.91 0 0 0 3.256.508 3.5 3.5 0 0 0 6.972 0 32.903 32.903 0 0 0 3.256-.508.75.75 0 0 0 .515-1.076A11.448 11.448 0 0 1 16 8a6 6 0 0 0-6-6Zm0 14.5a2 2 0 0 1-1.95-1.557 33.54 33.54 0 0 0 3.9 0A2 2 0 0 1 10 16.5Z',
]

export const notificationScenarios = [
    { scenario: 'comment', label: 'Comment' },
    { scenario: 'invoice', label: 'Invoice with an action' },
    { scenario: 'deploy', label: 'Deployment with a toast' },
    { scenario: 'replies', label: 'Three replies on one issue' },
    { scenario: 'many', label: '30 notifications' },
] as const

/** The announcements that the demo publishes, each stored once for every user. */
export const announcementScenarios = [
    { scenario: 'maintenance', label: 'Announcement' },
    { scenario: 'expiring', label: 'Announcement that expires in a minute' },
] as const

export const navLinkClass =
    'rounded-md px-2 py-1 text-sm font-medium text-gray-600 hover:text-gray-900 aria-[current=page]:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 dark:aria-[current=page]:text-gray-100'

export const serverRequests = [
    { href: '/imports', label: 'Start import' },
    { href: '/imports/finish', label: 'Finish import' },
] as const

const wait = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds))

export interface Demo {
    label: string
    run: () => unknown
}

export function browserDemos(toast: ToastFunction, router: typeof InertiaRouter): Demo[] {
    return [
        { label: 'Copy link', run: () => toast.success('Link copied', { description: 'Share it with your team.' }) },
        {
            label: 'Undo in the browser',
            run: () =>
                toast('Draft deleted', {
                    action: { label: 'Undo', onClick: () => wait(800).then(() => toast.success('Draft restored')) },
                }),
        },
        {
            label: 'Promise',
            run: () =>
                toast.promise(
                    wait(1200).then(() => ({ name: 'Q3 report' })),
                    { loading: 'Building report…', success: (report) => `${report.name} is ready`, error: 'Could not build the report' },
                ),
        },
        {
            label: 'Failing promise',
            run: () =>
                toast.promise(
                    wait(1200).then(() => Promise.reject(new Error('Disk full'))),
                    { loading: 'Exporting…', error: 'Export failed' },
                ),
        },
        {
            label: 'Upload progress',
            run: () => {
                const id = toast.loading('Uploading 1 of 3 files…', { dismissible: false })

                setTimeout(() => toast.update(id, { title: 'Uploading 2 of 3 files…' }), 700)
                setTimeout(() => toast.update(id, { title: 'Uploading 3 of 3 files…' }), 1400)
                setTimeout(() => toast.success('3 files uploaded', { id, dismissible: true }), 2100)
            },
        },
        {
            label: 'Track a visit',
            run: () => router.post('/slow', {}, toast.track({ loading: 'Saving…', success: 'Saved', error: 'Could not save' }, { preserveScroll: true })),
        },
        {
            label: 'Track a failing visit',
            run: () =>
                router.post(
                    '/slow',
                    { fail: true },
                    toast.track({ loading: 'Saving…', error: (errors) => Object.values(errors)[0] ?? 'Could not save' }, { preserveScroll: true }),
                ),
        },
        { label: 'Top center', run: () => toast.info('Shown at the top', { position: 'top-center' }) },
        {
            label: 'Stack of five',
            run: () =>
                ['Invoice sent', 'Payment received', 'Report exported', 'Backup finished', 'Profile saved'].forEach((title) =>
                    toast.success(title, { duration: 20_000 }),
                ),
        },
        { label: '419 from a visit', run: () => router.post('/errors/419') },
    ]
}

export const buttonClass =
    'rounded-md bg-white px-3 py-2 text-sm font-medium shadow-xs ring-1 ring-gray-300 hover:bg-gray-50 dark:bg-gray-900 dark:ring-gray-700 dark:hover:bg-gray-800'

/** Calls `callback` with the tab's title, and again each time it changes, for the Alerts page. Returns a function that stops. */
export function watchTitle(callback: (title: string) => void): () => void {
    const observer = new MutationObserver(() => callback(document.title))
    observer.observe(document.head, { childList: true, subtree: true, characterData: true })
    callback(document.title)

    return () => observer.disconnect()
}

/** The permission of desktop notifications, for the Alerts page. */
export const notificationPermission = (): NotificationPermission => (typeof Notification === 'function' ? Notification.permission : 'denied')

/**
 * Sends a notification after five seconds and adds it to the page as Echo would, since the demo runs no WebSocket
 * server. Only the tab that asked receives it, while Echo delivers a broadcast to every tab.
 */
export function sendLater(router: typeof InertiaRouter, receive: (value: unknown) => unknown): void {
    const added = () =>
        fetch('/_inertia-notifications', { headers: { Accept: 'application/json' } })
            .then((response) => response.json())
            .then(({ items }) => receive(items[0]))

    setTimeout(() => router.post('/notifications', { scenario: 'comment' }, { preserveScroll: true, onSuccess: () => void added() }), 5000)
}

/** The notifications of the Digests page, which send mail as well. */
export const digestScenarios = [
    { scenario: 'comment', label: 'Send a comment' },
    { scenario: 'invoice', label: 'Send an invoice' },
    { scenario: 'report', label: 'Send a weekly report' },
]

/** The time that a held notification is sent at, such as "Tue 8:00 AM", for the Digests page. */
export const digestSendTime = (iso: string): string => new Date(iso).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })
