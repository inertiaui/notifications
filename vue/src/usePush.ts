import { usePage } from '@inertiajs/vue3'
import { computed, onBeforeUnmount, onMounted, shallowRef, type ComputedRef } from 'vue'

import { syncFirstPage } from '../../js/inbox'
import { INITIAL_PUSH, pushDeviceState, pushStore, type PushDeviceState, type PushState } from '../../js/push'
import { initNotifications } from './notifications'

export type UsePush = { [Key in keyof PushState]: ComputedRef<PushState[Key]> } & {
    /**
     * The `data-state` of the device control of `<NotificationPreferences>` in this state, or `null` while the
     * application sends no pushes or the browser has no web push. The component also hides its control while no channel
     * of the preferences sends push, such as while they load.
     */
    deviceState: ComputedRef<PushDeviceState | null>
    /** Turns push on for this device. Call it from a click handler, as browsers only ask for permission after a user gesture. */
    subscribe(): Promise<void>
    /** Turns push off for this device. */
    unsubscribe(): Promise<void>
    /** Loads the devices that receive the signed-in user's pushes into `devices`, such as when your list of them shows. */
    loadDevices(): Promise<void>
    /** Removes the subscription of another device, which leaves `devices` at once. Use `unsubscribe()` for this device. */
    removeDevice(id: number): Promise<void>
}

/**
 * Whether this device receives push notifications, why it cannot, the actions that turn push on and off, and the user's
 * other devices, for building your own device control. Every component shares the same state.
 */
export function usePush(): UsePush {
    const page = usePage()
    const state = shallowRef(INITIAL_PUSH)
    let unsubscribe: (() => void) | undefined

    onMounted(() => {
        initNotifications()
        unsubscribe = pushStore.subscribe(() => (state.value = pushStore.getSnapshot()))

        syncFirstPage(page.props)

        state.value = pushStore.getSnapshot()
    })

    onBeforeUnmount(() => unsubscribe?.())

    const field = <Key extends keyof PushState>(key: Key): ComputedRef<PushState[Key]> => computed(() => state.value[key])

    return {
        available: field('available'),
        supported: field('supported'),
        permission: field('permission'),
        subscribed: field('subscribed'),
        busy: field('busy'),
        reason: field('reason'),
        request: field('request'),
        devices: field('devices'),
        deviceState: computed(() => pushDeviceState(state.value)),
        subscribe: pushStore.enable,
        unsubscribe: pushStore.disable,
        loadDevices: pushStore.loadDevices,
        removeDevice: pushStore.removeDevice,
    }
}
