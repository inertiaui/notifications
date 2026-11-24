import { http, router, socketId, usePage } from '@inertiajs/react'
import { useLayoutEffect } from 'react'

import { createInertiaBindings } from '../../js/inertia'
import { handleFlash, initNotifications as init } from '../../js/toast'
import type { NotificationsOptions } from '../../js/types'

/**
 * Call before `createInertiaApp()` so toasts flashed on pages without a Toaster are kept until one renders.
 * The Toaster also calls it, so it is only required to change options.
 */
export function initNotifications(options?: NotificationsOptions): void {
    init(createInertiaBindings(router, http, socketId), options)
}

/**
 * Starts listening for toasts once a Toaster mounts, and shows the toasts flashed before it, for an application that
 * did not call initNotifications(). Outside Inertia's App, such as in the `withApp` option of createInertiaApp(), there
 * is no page to read them from. The Toaster usually mounts there before Inertia announces the first page's flash data,
 * but not when the first render suspends, so only initNotifications() in the entry point catches that flash for sure.
 */
export function useFlashedToasts(): void {
    let flash: Record<string, unknown> | undefined

    try {
        flash = usePage().flash as Record<string, unknown>
    } catch {}

    useLayoutEffect(() => {
        initNotifications()

        if (flash) {
            handleFlash(flash)
        }
    }, [])
}
