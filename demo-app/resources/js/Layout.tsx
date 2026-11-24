import { Link, usePage } from '@inertiajs/react'
import { NotificationCenter, Toaster } from '@inertiaui/notifications-react'
import type { ReactNode } from 'react'

import { deploymentIconPath, navLinkClass } from './demo'
import InviteToast from './InviteToast'
import { aboveModals } from './moreToasts'

const icons = {
    deployment: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-5" aria-hidden="true">
            <path d={deploymentIconPath} />
        </svg>
    ),
}

export default function Layout({ children }: { children: ReactNode }) {
    const { url } = usePage()

    return (
        <>
            <header className="border-b border-gray-200 dark:border-gray-800">
                <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-2">
                    <nav className="-ms-2 flex gap-2" aria-label="Demo">
                        <Link href="/" aria-current={url === '/' ? 'page' : undefined} className={navLinkClass}>
                            Toasts
                        </Link>
                        <Link href="/more-toasts" aria-current={url === '/more-toasts' ? 'page' : undefined} className={navLinkClass}>
                            More toasts
                        </Link>
                        <Link href="/inbox" aria-current={url.startsWith('/inbox') ? 'page' : undefined} className={navLinkClass}>
                            Inbox
                        </Link>
                        <Link href="/preferences" aria-current={url === '/preferences' ? 'page' : undefined} className={navLinkClass}>
                            Preferences
                        </Link>
                        <Link href="/alerts" aria-current={url === '/alerts' ? 'page' : undefined} className={navLinkClass}>
                            Alerts
                        </Link>
                        <Link href="/notification-center" aria-current={url === '/notification-center' ? 'page' : undefined} className={navLinkClass}>
                            Center
                        </Link>
                        <Link href="/lifecycle" aria-current={url === '/lifecycle' ? 'page' : undefined} className={navLinkClass}>
                            Lifecycle
                        </Link>
                    </nav>
                    <NotificationCenter href="/inbox" />
                </div>
            </header>
            {children}
            <Toaster progress icons={icons} typeLabels={{ deployment: 'Deployment' }} components={{ invite: InviteToast }} aboveModals={aboveModals(url)} />
        </>
    )
}
