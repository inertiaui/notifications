import { Link, router, useHttp } from '@inertiajs/react'
import { toast } from '@inertiaui/notifications-react'
import { useRef, type ReactNode } from 'react'

import { announcementScenarios, browserDemos, buttonClass, notificationScenarios, scenarios, serverRequests } from '../demo'
import Layout from '../Layout'

const demos = browserDemos(toast, router)

export default function Home() {
    const archive = useHttp({})
    const failing = useHttp({})
    const dialog = useRef<HTMLDialogElement>(null)

    return (
        <main className="mx-auto max-w-2xl px-6 py-16">
            <h1 className="text-2xl font-semibold">Inertia Notifications</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">React stack</p>

            <section className="mt-10">
                <h2 className="font-medium">Flashed from Laravel</h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Each button posts to the server, which flashes toasts and redirects back.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                    {scenarios.map(({ scenario, label }) => (
                        <Link key={scenario} href="/toasts" method="post" data={{ scenario }} as="button" preserveScroll className={buttonClass}>
                            {label}
                        </Link>
                    ))}
                    {serverRequests.map(({ href, label }) => (
                        <Link key={href} href={href} method="post" as="button" preserveScroll className={buttonClass}>
                            {label}
                        </Link>
                    ))}
                    <button type="button" className={buttonClass} onClick={() => archive.post('/api/archive')}>
                        JSON endpoint
                    </button>
                    <button type="button" className={buttonClass} onClick={() => failing.post('/errors/500')}>
                        500 from useHttp
                    </button>
                </div>
            </section>

            <section className="mt-10">
                <h2 className="font-medium">Notification center</h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    Each button sends a Laravel notification through the inbox channel. Open the bell to see it.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                    {notificationScenarios.map(({ scenario, label }) => (
                        <Link key={scenario} href="/notifications" method="post" data={{ scenario }} as="button" preserveScroll className={buttonClass}>
                            {label}
                        </Link>
                    ))}
                </div>
            </section>

            <section className="mt-10" data-demo="announcements">
                <h2 className="font-medium">Announcements</h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    Each button publishes one announcement, stored once for every user. It shows in the bell with a megaphone.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                    {announcementScenarios.map(({ scenario, label }) => (
                        <Link
                            key={scenario}
                            href="/announcements"
                            method="post"
                            data={{ scenario }}
                            data-demo-announcement={scenario}
                            as="button"
                            preserveScroll
                            className={buttonClass}
                        >
                            {label}
                        </Link>
                    ))}
                </div>
            </section>

            <section className="mt-10">
                <h2 className="font-medium">From the browser</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                    {demos.map((demo) => (
                        <button key={demo.label} type="button" className={buttonClass} onClick={() => demo.run()}>
                            {demo.label}
                        </button>
                    ))}
                    <button type="button" className={buttonClass} onClick={() => dialog.current?.showModal()}>
                        Open a modal dialog
                    </button>
                </div>
            </section>

            <section className="mt-10">
                <h2 className="font-medium">Delivery</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                    <a href="/welcome" className={buttonClass}>
                        Full page load
                    </a>
                    <Link href="/deferred" className={buttonClass}>
                        Deferred prop
                    </Link>
                    <Link href="/bare" className={buttonClass}>
                        Page without a Toaster
                    </Link>
                    <Link href="/custom-toaster" className={buttonClass}>
                        Your own Toaster
                    </Link>
                </div>
            </section>

            <dialog ref={dialog} className="m-auto w-full max-w-md rounded-lg p-6 shadow-xl backdrop:bg-black/40 dark:bg-gray-900 dark:text-gray-100">
                <h2 className="font-medium">A modal dialog</h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    Everything outside a modal dialog is inert. The toasts move inside it while it is open.
                </p>
                <div className="mt-4 flex gap-2">
                    <button
                        type="button"
                        className={buttonClass}
                        onClick={() => toast('Shown inside the dialog', { action: { label: 'Got it', onClick: () => {} } })}
                    >
                        Toast from the dialog
                    </button>
                    <button type="button" className={buttonClass} onClick={() => dialog.current?.close()}>
                        Close dialog
                    </button>
                </div>
            </dialog>
        </main>
    )
}

Home.layout = (page: ReactNode) => <Layout>{page}</Layout>
