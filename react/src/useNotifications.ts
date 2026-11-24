import { usePage } from '@inertiajs/react'
import { useLayoutEffect, useSyncExternalStore } from 'react'

import { inboxActions, inboxStore, syncFirstPage, type InboxActions, type InboxState } from '../../js/inbox'
import { toast, type ToastFunction } from '../../js/toast'
import { initNotifications } from './notifications'

export type UseNotifications = InboxState &
    InboxActions & {
        /** Shows a toast. */
        toast: ToastFunction
    }

/**
 * The notification center's state, such as the counts and the loaded notifications, and its actions, for building
 * a custom bell or panel. Every component shares the same state.
 */
export function useNotifications(): UseNotifications {
    const { props } = usePage()
    const state = useSyncExternalStore(inboxStore.subscribe, inboxStore.getSnapshot, inboxStore.getServerSnapshot)

    useLayoutEffect(() => {
        initNotifications()

        syncFirstPage(props)
    }, [])

    return {
        ...state,
        ...inboxActions,
        toast,
    }
}
