import { Link } from '@inertiajs/react'
import { NotificationPreferences } from '@inertiaui/notifications-react'
import type { ReactNode } from 'react'

import Layout from '../Layout'

export default function Preferences() {
    return (
        <main className="mx-auto max-w-2xl px-6 py-10">
            <h1 className="text-2xl font-semibold">Preferences</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Choose where each kind of notification reaches you. Changes save right away.</p>
            <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                <NotificationPreferences />
            </div>
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                <Link href="/preferences/custom" className="underline" data-demo-custom-preferences-link="">
                    Build your own form with usePreferences()
                </Link>
            </p>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                <Link href="/digests" className="underline" data-demo-digests-link="">
                    See the emails that wait for a digest
                </Link>
            </p>
        </main>
    )
}

Preferences.layout = (page: ReactNode) => <Layout>{page}</Layout>
