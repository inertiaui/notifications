import { Link } from '@inertiajs/react'
import { useToasts } from '@inertiaui/notifications-react'

import { buttonClass } from '../demo'

export default function CustomToaster() {
    const { toasts, toast, dismiss, pause, resume, timer, runAction } = useToasts()

    return (
        <div>
            <main className="mx-auto max-w-2xl px-6 py-16">
                <h1 className="text-2xl font-semibold">Your own Toaster</h1>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">This page renders its toasts with useToasts() instead of the Toaster component.</p>
                <div className="mt-6 flex flex-wrap gap-2">
                    <button type="button" className={buttonClass} onClick={() => toast.success('Link copied', { duration: 2000 })}>
                        Show a toast
                    </button>
                    <Link href="/toasts" method="post" data={{ scenario: 'action' }} as="button" preserveScroll className={buttonClass}>
                        Flash from Laravel
                    </Link>
                    <Link href="/" className={buttonClass}>
                        Back to the demo
                    </Link>
                </div>
            </main>
            <ol
                data-custom-toaster
                aria-live="polite"
                className="fixed inset-x-0 top-4 mx-auto flex w-full max-w-sm flex-col gap-2 px-4"
                onPointerEnter={() => pause('hover')}
                onPointerLeave={() => resume('hover')}
            >
                {toasts
                    .filter((item) => item.state !== 'queued')
                    .map((item) => (
                        <li
                            key={item.id}
                            data-state={item.state}
                            className="flex items-center gap-3 rounded-lg bg-gray-900 px-4 py-3 text-sm text-white shadow-lg transition-opacity data-[state=closing]:opacity-0 dark:bg-white dark:text-gray-900"
                        >
                            <p className="flex-1">
                                <span className="font-medium">{item.title}</span>
                                {item.description && <span className="block opacity-70">{item.description}</span>}
                            </p>
                            {timer(item.id)?.running === false && <span className="text-xs opacity-70">Paused</span>}
                            {item.actions.map((action, index) => (
                                <button key={index} type="button" className="font-medium underline" onClick={() => runAction(item.id, index)}>
                                    {action.label}
                                </button>
                            ))}
                            {item.dismissible && (
                                <button
                                    type="button"
                                    aria-label={`Dismiss: ${item.title}`}
                                    className="opacity-70 hover:opacity-100"
                                    onClick={() => dismiss(item.id, 'user')}
                                >
                                    ✕
                                </button>
                            )}
                        </li>
                    ))}
            </ol>
        </div>
    )
}
