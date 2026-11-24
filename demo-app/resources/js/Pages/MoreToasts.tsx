import { Link, router } from '@inertiajs/react'
import { toast } from '@inertiaui/notifications-react'
import * as Dialog from '@radix-ui/react-dialog'
import { useState, type ReactNode } from 'react'

import { buttonClass, deploymentIconPath } from '../demo'
import Layout from '../Layout'
import { browserInvite, dialogContentClass, dialogOverlayClass, otherType, toastWithUndo, trackUpload, uploadInSteps } from '../moreToasts'

export default function MoreToasts() {
    const [undone, setUndone] = useState(0)
    const undo = () => setUndone((count) => count + 1)

    return (
        <main className="mx-auto max-w-2xl px-6 py-16">
            <h1 className="text-2xl font-semibold">More toasts</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">React stack</p>

            <section className="mt-10">
                <h2 className="font-medium">A component per type</h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    The Toaster renders <code>invite</code> toasts with a component of the app, which reads the toast's data. Other types keep the default
                    markup.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                    <Link href="/more-toasts" method="post" data={{ scenario: 'invite' }} as="button" preserveScroll className={buttonClass}>
                        Flash an invitation
                    </Link>
                    <button type="button" className={buttonClass} onClick={() => toast(browserInvite.title, browserInvite.options)}>
                        Invitation from the browser
                    </button>
                    <button type="button" className={buttonClass} onClick={() => toast.success(otherType.title, otherType.options)}>
                        Another type
                    </button>
                </div>
            </section>

            <section className="mt-10">
                <h2 className="font-medium">Progress</h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">A toast with a progress shows a bar that screen readers read as a percentage.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" className={buttonClass} onClick={() => uploadInSteps(toast)}>
                        Upload in steps
                    </button>
                    <button type="button" className={buttonClass} onClick={() => trackUpload(toast, router)}>
                        Track an upload
                    </button>
                    <Link href="/more-toasts" method="post" data={{ scenario: 'import' }} as="button" preserveScroll className={buttonClass}>
                        Flash an import
                    </Link>
                </div>
            </section>

            <section className="mt-10">
                <h2 className="font-medium">Avatars</h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    A toast with an image shows it in place of the icon, such as the avatar of a person. A toast may also bring its own icon element.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                    <Link href="/more-toasts" method="post" data={{ scenario: 'comment' }} as="button" preserveScroll className={buttonClass}>
                        Flash a comment
                    </Link>
                    <button
                        type="button"
                        className={buttonClass}
                        onClick={() =>
                            toast.success('Release published', {
                                icon: (
                                    <svg viewBox="0 0 20 20" fill="currentColor" className="size-5" aria-hidden="true" data-demo-icon="release">
                                        <path d={deploymentIconPath} />
                                    </svg>
                                ),
                            })
                        }
                    >
                        Toast with its own icon
                    </button>
                </div>
            </section>

            <section className="mt-10">
                <h2 className="font-medium">Dialogs</h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    Toasts stay usable above a Radix dialog and the notification center's panel: their actions run, and the dialog stays open. Undone: {undone}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                    <Dialog.Root>
                        <Dialog.Trigger className={buttonClass}>Open a dialog</Dialog.Trigger>
                        <Dialog.Portal>
                            <Dialog.Overlay className={dialogOverlayClass} />
                            <Dialog.Content className={dialogContentClass}>
                                <Dialog.Title className="font-medium">Edit profile</Dialog.Title>
                                <Dialog.Description className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                    Save to show a toast with an action above this dialog.
                                </Dialog.Description>
                                <p className="mt-4 text-sm">Undone: {undone}</p>
                                <div className="mt-6 flex justify-end gap-2">
                                    <Dialog.Close className={buttonClass}>Close</Dialog.Close>
                                    <button type="button" className={buttonClass} onClick={() => toastWithUndo(toast, 'Profile saved', undo)}>
                                        Save
                                    </button>
                                </div>
                            </Dialog.Content>
                        </Dialog.Portal>
                    </Dialog.Root>
                    <button type="button" className={buttonClass} onClick={() => toastWithUndo(toast, 'Draft saved', undo)}>
                        Show a toast that stays
                    </button>
                </div>
            </section>
        </main>
    )
}

MoreToasts.layout = (page: ReactNode) => <Layout>{page}</Layout>
