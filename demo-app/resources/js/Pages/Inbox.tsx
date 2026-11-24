import { NotificationList } from '@inertiaui/notifications-react'
import type { ReactNode } from 'react'

import Layout from '../Layout'

export default function Inbox() {
    return (
        <main className="mx-auto max-w-2xl px-6 py-10">
            <h1 className="text-2xl font-semibold">Inbox</h1>
            <div className="mt-6 rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                <NotificationList data="notifications" />
            </div>
        </main>
    )
}

Inbox.layout = (page: ReactNode) => <Layout>{page}</Layout>
