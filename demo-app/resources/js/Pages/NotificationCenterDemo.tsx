import { NotificationCenter } from '@inertiaui/notifications-react'
import { useState, type ReactNode } from 'react'

import { buttonClass } from '../demo'
import Layout from '../Layout'

export default function NotificationCenterDemo() {
    const [open, setOpen] = useState(false)
    const [log, setLog] = useState<string[]>([])

    return (
        <main className="mx-auto max-w-2xl px-6 py-10">
            <h1 className="text-2xl font-semibold">Notification center</h1>

            <section className="mt-8" aria-labelledby="placement">
                <h2 id="placement" className="text-lg font-semibold">
                    Placement
                </h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    The bell in this sidebar opens its panel to the right. The bell at the bottom of the screen opens its panel above itself, because there is
                    no room below.
                </p>
                <div className="mt-4 flex h-48 overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                    <aside data-demo="placement-right" className="flex w-14 flex-col items-center border-e border-gray-200 py-2 dark:border-gray-800">
                        <NotificationCenter placement="right-start" />
                    </aside>
                    <p className="p-4 text-sm text-gray-500">Page content</p>
                </div>
            </section>

            <section className="mt-10" aria-labelledby="custom">
                <h2 id="custom" className="text-lg font-semibold">
                    Slots and events
                </h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    This bell has its own badge, header, error, and footer. Clicking a notification only logs it, and the button opens the panel from outside.
                </p>
                <div className="mt-4 flex items-center gap-3">
                    <div data-demo="custom">
                        <NotificationCenter
                            open={open}
                            onOpenChange={setOpen}
                            onItemClick={(item, event) => {
                                // Keeps the panel from opening the notification, so the page stays.
                                event.preventDefault()
                                setLog((entries) => [...entries, `Clicked ${item.title}`])
                            }}
                            onAction={(item, action) => setLog((entries) => [...entries, `Ran ${action.label}`])}
                            renderBadge={({ text }) => (
                                <span
                                    data-inbox-badge=""
                                    data-demo-badge=""
                                    aria-hidden="true"
                                    className="absolute -inset-e-1 -top-1 rounded-md bg-emerald-600 px-1 text-[0.6875rem]/4 font-semibold text-white"
                                >
                                    {text}
                                </span>
                            )}
                            renderHeader={({ titleId, title, unread, markAllAsRead, close }) => (
                                <div className="flex items-center justify-between gap-3 bg-emerald-50 px-4 py-3 dark:bg-emerald-950">
                                    <h2 id={titleId} className="text-base font-semibold">
                                        {title}: {unread} unread
                                    </h2>
                                    <div className="flex gap-3 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                                        <button type="button" data-demo-read-all="" onClick={markAllAsRead}>
                                            Read all
                                        </button>
                                        <button type="button" data-demo-close="" onClick={close}>
                                            Close
                                        </button>
                                    </div>
                                </div>
                            )}
                            renderError={({ retry }) => (
                                <>
                                    <p data-demo-error="">The inbox is out of reach.</p>
                                    <button type="button" data-demo-retry="" className="text-sm font-medium underline" onClick={retry}>
                                        Reload
                                    </button>
                                </>
                            )}
                            renderFooter={() => (
                                <button
                                    type="button"
                                    data-demo-footer=""
                                    className="border-t border-gray-200 px-4 py-2.5 text-sm font-medium dark:border-gray-800"
                                    onClick={() => setOpen(false)}
                                >
                                    Done
                                </button>
                            )}
                        />
                    </div>
                    <button type="button" data-demo="open-custom" className={buttonClass} onClick={() => setOpen(true)}>
                        {open ? 'The panel is open' : 'Open the panel'}
                    </button>
                </div>
                <ul data-demo-log="" className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                    {log.map((entry, index) => (
                        <li key={index}>{entry}</li>
                    ))}
                </ul>
            </section>

            <div
                data-demo="placement-flip"
                className="fixed inset-s-4 bottom-4 rounded-full border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"
            >
                <NotificationCenter placement="bottom-start" />
            </div>
        </main>
    )
}

NotificationCenterDemo.layout = (page: ReactNode) => <Layout>{page}</Layout>
