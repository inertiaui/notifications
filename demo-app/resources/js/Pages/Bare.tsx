import { Link } from '@inertiajs/react'

import { buttonClass } from '../demo'

export default function Bare() {
    return (
        <main className="mx-auto max-w-2xl px-6 py-16">
            <h1 className="text-2xl font-semibold">Page without a Toaster</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Toasts flashed here show on the next page that renders a Toaster.</p>
            <div className="mt-6 flex flex-wrap gap-2">
                <Link href="/toasts" method="post" data={{ scenario: 'success' }} as="button" className={buttonClass}>
                    Flash a toast
                </Link>
                <Link href="/" className={buttonClass}>
                    Back to the demo
                </Link>
            </div>
        </main>
    )
}
