import { usePage } from '@inertiajs/react'
import { useLayoutEffect, useMemo, useState, useSyncExternalStore, type MouseEvent } from 'react'

import { createPauseScope, handleActionClick, handleFlash, runToastAction, toast, toastRevision, toastStore, type ToastFunction } from '../../js/toast'
import type { ToastStore } from '../../js/toastStore'
import type { Toast } from '../../js/types'
import { initNotifications } from './notifications'

export type UseToasts = Pick<ToastStore, 'update' | 'dismiss' | 'pause' | 'resume' | 'timer'> & {
    /**
     * The toasts of this Toaster in the order they were added. Render the `visible` ones; `closing` toasts play their
     * exit animation, and `queued` toasts wait for room under the limit.
     */
    toasts: readonly Toast[]
    /** Shows a toast. */
    toast: ToastFunction
    /** Runs an action of a toast. Pass the click event, so a modified click on a link opens it in a new tab. */
    runAction: (id: string, index: number, event?: MouseEvent) => void
}

const serverSnapshot: readonly Toast[] = []

const runAction: UseToasts['runAction'] = (id, index, event) => (event ? handleActionClick(id, index, event.nativeEvent) : runToastAction(id, index))

/**
 * The toasts of the Toaster with the given name, or of the unnamed Toaster, and what to do with them, for a Toaster
 * with markup of your own. While a component uses it, the toasts' timers run, as they do while a `<Toaster>` is mounted.
 * Pauses made with its `pause()` end when the component unmounts.
 */
export function useToasts(name?: string): UseToasts {
    const { flash } = usePage()
    const snapshot = useSyncExternalStore(toastStore.subscribe, toastStore.getSnapshot, () => serverSnapshot)
    // Timers that pause or resume keep the same snapshot; this re-renders, so what shows `timer()` updates.
    useSyncExternalStore(toastStore.subscribe, toastRevision, () => 0)
    const toasts = useMemo(() => snapshot.filter((toast) => toast.toaster === name), [snapshot, name])
    const [scope] = useState(createPauseScope)

    useLayoutEffect(() => toastStore.attach(name), [name])

    useLayoutEffect(() => {
        initNotifications()

        // Flash data that arrived before this component mounted, when the application did not call initNotifications().
        handleFlash(flash as Record<string, unknown>)

        // An action can navigate away while the pointer still pauses the toasts.
        return scope.release
    }, [])

    return {
        toasts,
        toast,
        update: toastStore.update,
        dismiss: toastStore.dismiss,
        pause: scope.pause,
        resume: scope.resume,
        timer: toastStore.timer,
        runAction,
    }
}
