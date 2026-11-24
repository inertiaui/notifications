import { usePage } from '@inertiajs/vue3'
import { computed, onBeforeUnmount, onMounted, shallowRef, type ComputedRef } from 'vue'

import { inboxActions, inboxStore, syncFirstPage, type InboxActions, type InboxState } from '../../js/inbox'
import { toast, type ToastFunction } from '../../js/toast'
import { initNotifications } from './notifications'

export type UseNotifications = { [Key in keyof InboxState]: ComputedRef<InboxState[Key]> } & InboxActions & {
        /** Shows a toast. */
        toast: ToastFunction
    }

/**
 * The notification center's state, such as the counts and the loaded notifications, and its actions, for building
 * a custom bell or panel. Every component shares the same state.
 */
export function useNotifications(): UseNotifications {
    const page = usePage()
    const state = shallowRef(inboxStore.getServerSnapshot())
    let unsubscribe: (() => void) | undefined

    onMounted(() => {
        initNotifications()
        unsubscribe = inboxStore.subscribe(() => (state.value = inboxStore.getSnapshot()))

        syncFirstPage(page.props)

        state.value = inboxStore.getSnapshot()
    })

    onBeforeUnmount(() => unsubscribe?.())

    const field = <Key extends keyof InboxState>(key: Key): ComputedRef<InboxState[Key]> => computed(() => state.value[key])

    return {
        url: field('url'),
        user: field('user'),
        channel: field('channel'),
        announcementsChannel: field('announcementsChannel'),
        allowedActions: field('allowedActions'),
        selectable: field('selectable'),
        categoryFilter: field('categoryFilter'),
        tabs: field('tabs'),
        counts: field('counts'),
        items: field('items'),
        arrived: field('arrived'),
        filter: field('filter'),
        category: field('category'),
        categoryCounts: field('categoryCounts'),
        status: field('status'),
        loadingMore: field('loadingMore'),
        moreFailed: field('moreFailed'),
        hasMore: field('hasMore'),
        pendingActions: field('pendingActions'),
        pausedUntil: field('pausedUntil'),
        canPause: field('canPause'),
        pausePresets: field('pausePresets'),
        ...inboxActions,
        toast,
    }
}
