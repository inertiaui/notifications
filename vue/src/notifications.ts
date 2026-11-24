import { http, router, socketId } from '@inertiajs/vue3'

import { createInertiaBindings } from '../../js/inertia'
import { initNotifications as init } from '../../js/toast'
import type { NotificationsOptions } from '../../js/types'

/**
 * Call before `createInertiaApp()` so toasts flashed on pages without a Toaster are kept until one renders.
 * The Toaster also calls it, so it is only required to change options.
 */
export function initNotifications(options?: NotificationsOptions): void {
    init(createInertiaBindings(router, http, socketId), options)
}
