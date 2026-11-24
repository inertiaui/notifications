import { usePage } from '@inertiajs/react'
import { useLayoutEffect, useSyncExternalStore } from 'react'

import { syncFirstPage } from '../../js/inbox'
import { INITIAL_PUSH, pushDeviceState, pushStore, type PushDeviceState, type PushState } from '../../js/push'
import { initNotifications } from './notifications'

export type UsePush = PushState & {
    /**
     * The `data-state` of the device control of `<NotificationPreferences>` in this state, or `null` while the
     * application sends no pushes or the browser has no web push. The component also hides its control while no channel
     * of the preferences sends push, such as while they load.
     */
    deviceState: PushDeviceState | null
    /** Turns push on for this device. Call it from a click handler, as browsers only ask for permission after a user gesture. */
    subscribe(): Promise<void>
    /** Turns push off for this device. */
    unsubscribe(): Promise<void>
    /** Loads the devices that receive the signed-in user's pushes into `devices`, such as when your list of them shows. */
    loadDevices(): Promise<void>
    /** Removes the subscription of another device, which leaves `devices` at once. Use `unsubscribe()` for this device. */
    removeDevice(id: number): Promise<void>
}

const getServerSnapshot = (): PushState => INITIAL_PUSH

/**
 * Whether this device receives push notifications, why it cannot, the actions that turn push on and off, and the user's
 * other devices, for building your own device control. Every component shares the same state.
 */
export function usePush(): UsePush {
    const { props } = usePage()
    const state = useSyncExternalStore(pushStore.subscribe, pushStore.getSnapshot, getServerSnapshot)

    useLayoutEffect(() => {
        initNotifications()

        syncFirstPage(props)
    }, [])

    return {
        ...state,
        deviceState: pushDeviceState(state),
        subscribe: pushStore.enable,
        unsubscribe: pushStore.disable,
        loadDevices: pushStore.loadDevices,
        removeDevice: pushStore.removeDevice,
    }
}
