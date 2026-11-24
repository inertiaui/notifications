import { Head, Link } from '@inertiajs/react'
import { NotificationPreferences } from '@inertiaui/notifications-react'
import type { ReactNode } from 'react'

import { buttonClass, digestScenarios, digestSendTime } from '../demo'
import Layout from '../Layout'

interface DigestsProps {
    held: { id: number; title: string; category: string; sendAt: string }[]
    digest: string | null
}

export default function Digests({ held, digest }: DigestsProps) {
    return (
        <>
            <Head title="Digests" />
            <main className="mx-auto max-w-2xl px-6 py-10">
                <h1 className="text-2xl font-semibold">Digests</h1>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    Choose an hourly, daily, or weekly digest for a category, or turn on notification hours. Notifications still arrive in the bell right away,
                    and their emails wait for the next digest in your timezone, or until your notification hours start.
                </p>
                <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                    <NotificationPreferences />
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                    {digestScenarios.map(({ scenario, label }) => (
                        <Link
                            key={scenario}
                            href="/digests/notifications"
                            method="post"
                            data={{ scenario }}
                            as="button"
                            preserveScroll
                            data-demo-digest-scenario={scenario}
                            className={buttonClass}
                        >
                            {label}
                        </Link>
                    ))}
                </div>

                <section className="mt-10" data-demo-held="">
                    <h2 className="font-medium">Waiting for the digest</h2>
                    {held.length === 0 ? (
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">No emails are waiting.</p>
                    ) : (
                        <ul className="mt-3 divide-y divide-gray-200 rounded-lg border border-gray-200 text-sm dark:divide-gray-800 dark:border-gray-800">
                            {held.map((item) => (
                                <li key={item.id} data-demo-held-item="" className="flex justify-between gap-4 px-4 py-3">
                                    <span>{item.title}</span>
                                    <span className="shrink-0 text-gray-600 dark:text-gray-400">{digestSendTime(item.sendAt)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                    <div className="mt-4">
                        <Link href="/digests/send" method="post" as="button" preserveScroll data-demo-send-digest="" className={buttonClass}>
                            Send the digest now
                        </Link>
                    </div>
                </section>

                {digest && (
                    <section className="mt-10">
                        <h2 className="font-medium">The digest email</h2>
                        <iframe
                            srcDoc={digest}
                            title="The digest email"
                            data-demo-digest=""
                            className="mt-3 h-144 w-full rounded-lg border border-gray-200 bg-white"
                        />
                    </section>
                )}
            </main>
        </>
    )
}

Digests.layout = (page: ReactNode) => <Layout>{page}</Layout>
