// Shared by the Vue and React pages of /more-toasts, the toast features that a Toaster in the layout renders.
import type { router as InertiaRouter } from '@inertiajs/vue3'
import type { ToastFunction, ToastOptions } from '@inertiaui/notifications-vue'

/** An `invite` toast from the browser, which the layout's Toaster renders with the InviteToast component. */
export const browserInvite: { title: string; options: ToastOptions } = {
    title: 'Maria invited you to Apollo',
    options: { type: 'invite', data: { inviter: 'Maria', team: 'Apollo', role: 'Admin', members: 4 } },
}

/** A toast of a type without a component, which keeps the default markup. */
export const otherType: { title: string; options: ToastOptions } = {
    title: 'Invitation sent',
    options: { description: 'Toasts of other types keep the default markup.', data: { team: 'Apollo' } },
}

/** Fills the bar of a loading toast in steps with toast.update(), then replaces it with a success toast. */
export function uploadInSteps(toast: ToastFunction): void {
    const id = toast.loading('Uploading report.pdf…', { progress: 0, dismissible: false })

    ;[0.35, 0.7, 1].forEach((progress, index) => setTimeout(() => toast.update(id, { progress }), 600 * (index + 1)))
    setTimeout(() => toast.success('report.pdf uploaded', { id, dismissible: true }), 2400)
}

/** Uploads a file of 100 kB, so toast.track() fills the loading toast from Inertia's upload progress. */
export function trackUpload(toast: ToastFunction, router: typeof InertiaRouter): void {
    const file = new File([new Uint8Array(100_000)], 'report.pdf', { type: 'application/pdf' })

    router.post('/more-toasts/upload', { file }, toast.track({ loading: 'Uploading report.pdf…', success: 'Report uploaded' }, { preserveScroll: true }))
}

/** A toast with an action that stays open, such as above a dialog or the notification center's panel. */
export function toastWithUndo(toast: ToastFunction, title: string, onUndo: () => void): void {
    toast.success(title, { duration: null, action: { label: 'Undo', onClick: onUndo } })
}

/** The Toaster in the layout keeps the toasts usable above dialogs, unless the URL has ?above-modals=off. */
export const aboveModals = (url: string): boolean => !/[?&]above-modals=off\b/.test(url)

export const dialogOverlayClass = 'fixed inset-0 z-50 bg-gray-950/40'
export const dialogContentClass =
    'fixed top-1/2 left-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900'
