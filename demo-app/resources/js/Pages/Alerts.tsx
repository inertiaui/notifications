import { Head, Link, router } from '@inertiajs/react'
import { inboxStore, requestNotificationPermission } from '@inertiaui/notifications-react'
import { useEffect, useState, type ReactNode } from 'react'

import { buttonClass, notificationPermission, sendLater, watchTitle } from '../demo'
import Layout from '../Layout'

export default function Alerts() {
    const [title, setTitle] = useState('')
    const [permission, setPermission] = useState(notificationPermission)

    useEffect(() => watchTitle(setTitle), [])

    return (
        <>
            <Head title="Browser alerts" />
            <main className="mx-auto max-w-2xl px-6 py-10">
                <h1 className="text-2xl font-semibold">Browser alerts</h1>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    Reach users who are in another tab. The demo turns on each alert in initNotifications().
                </p>

                <section className="mt-10">
                    <h2 className="font-medium">Tab title</h2>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        The title of every tab starts with the number of unread notifications. Send one, then read it in the bell.
                    </p>
                    <p className="mt-4 text-sm">
                        This tab's title:{' '}
                        <span data-demo-title className="font-medium">
                            {title}
                        </span>
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                        <Link href="/notifications" method="post" data={{ scenario: 'comment' }} as="button" preserveScroll className={buttonClass}>
                            Send a notification
                        </Link>
                    </div>
                </section>

                <section className="mt-10">
                    <h2 className="font-medium">App badge</h2>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        Install the demo as an app, and its icon shows the number of unread notifications in browsers that support badges.
                    </p>
                </section>

                <section className="mt-10">
                    <h2 className="font-medium">Desktop notifications</h2>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        Send a notification, then switch to another tab or application within five seconds. The demo tab you looked at last shows a desktop
                        notification. Click it to come back and open the notification.
                    </p>
                    <p className="mt-4 text-sm">
                        Permission:{' '}
                        <span data-demo-permission className="font-medium">
                            {permission}
                        </span>
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                        <button type="button" className={buttonClass} onClick={async () => setPermission(await requestNotificationPermission())}>
                            Turn on desktop notifications
                        </button>
                        <button type="button" className={buttonClass} onClick={() => sendLater(router, inboxStore.receive)}>
                            Send a notification in 5 seconds
                        </button>
                    </div>
                </section>

                <section className="mt-10">
                    <h2 className="font-medium">Sound</h2>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        The demo tab you looked at last plays a chime for each notification that arrives. Browsers only play sound in a tab you clicked in, so
                        click anywhere on this page before you send one.
                    </p>
                </section>
            </main>
        </>
    )
}

Alerts.layout = (page: ReactNode) => <Layout>{page}</Layout>
