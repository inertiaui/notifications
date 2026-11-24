import { usePage } from '@inertiajs/vue3'
import { computed, onBeforeUnmount, onMounted, shallowRef, toValue, watch, type ComputedRef, type MaybeRefOrGetter } from 'vue'

import { createPauseScope, handleActionClick, handleFlash, runToastAction, toast, toastRevision, toastStore, type ToastFunction } from '../../js/toast'
import type { ToastStore } from '../../js/toastStore'
import type { Toast } from '../../js/types'
import { initNotifications } from './notifications'

export type UseToasts = Pick<ToastStore, 'update' | 'dismiss' | 'pause' | 'resume' | 'timer'> & {
    /**
     * The toasts of this Toaster in the order they were added. Render the `visible` ones; `closing` toasts play their
     * exit animation, and `queued` toasts wait for room under the limit.
     */
    toasts: ComputedRef<readonly Toast[]>
    /** Shows a toast. */
    toast: ToastFunction
    /** Runs an action of a toast. Pass the click event, so a modified click on a link opens it in a new tab. */
    runAction: (id: string, index: number, event?: MouseEvent) => void
}

const serverSnapshot: readonly Toast[] = []

/**
 * The toasts of the Toaster with the given name, or of the unnamed Toaster, and what to do with them, for a Toaster
 * with markup of your own. While a component uses it, the toasts' timers run, as they do while a `<Toaster>` is mounted.
 * Pauses made with its `pause()` end when the component unmounts. Pass a ref or a getter to follow a name that changes.
 */
export function useToasts(name?: MaybeRefOrGetter<string | undefined>): UseToasts {
    const page = usePage()
    const state = shallowRef(serverSnapshot)
    // Timers that pause or resume keep the same snapshot, so `timer()` reads this to update what shows the timer.
    const revision = shallowRef(toastRevision())
    const scope = createPauseScope()
    let unsubscribe: (() => void) | undefined
    let stopAttaching: (() => void) | undefined

    onMounted(() => {
        initNotifications()
        unsubscribe = toastStore.subscribe(() => {
            state.value = toastStore.getSnapshot()
            revision.value = toastRevision()
        })
        // The timers of the Toaster with the current name run, so another name runs those of the other Toaster.
        stopAttaching = watch(
            () => toValue(name),
            (current, _previous, onCleanup) => onCleanup(toastStore.attach(current)),
            { immediate: true },
        )

        // Flash data that arrived before this component mounted, when the application did not call initNotifications().
        handleFlash(page.flash as Record<string, unknown>)
        state.value = toastStore.getSnapshot()
        revision.value = toastRevision()
    })

    onBeforeUnmount(() => {
        unsubscribe?.()
        stopAttaching?.()
        scope.release()
    })

    return {
        toasts: computed(() => state.value.filter((toast) => toast.toaster === toValue(name))),
        toast,
        update: toastStore.update,
        dismiss: toastStore.dismiss,
        pause: scope.pause,
        resume: scope.resume,
        timer: (id) => {
            revision.value
            return toastStore.timer(id)
        },
        runAction: (id, index, event) => (event ? handleActionClick(id, index, event) : runToastAction(id, index)),
    }
}
