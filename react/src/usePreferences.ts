import { usePage } from '@inertiajs/react'
import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react'

import { inboxStore, syncFirstPage } from '../../js/inbox'
import {
    INITIAL_PREFERENCES,
    frequencyApplies,
    isDisabled,
    preferenceSections,
    preferencesStore,
    receives,
    type PreferenceCategory,
    type PreferenceChannel,
    type PreferenceSection,
    type PreferencesState,
    type PreferencesStore,
} from '../../js/preferences'
import { initNotifications } from './notifications'

export type UsePreferences = PreferencesState &
    Pick<PreferencesStore, 'set' | 'setChannel' | 'setFrequency' | 'setNotificationHours'> & {
        /** The categories by group: first those without a group, then each group in order. */
        sections: PreferenceSection[]
        /** Loads the preferences of the signed-in user again. */
        load(): Promise<void>
        /** Whether the user receives the category on the channel: always if locked, else while both are on, and pushes only with the notification center. */
        receives(category: PreferenceCategory, channel: PreferenceChannel): boolean
        /** Whether the frequency of the category changes anything: the user receives the category on a channel that digests hold. */
        frequencyApplies: typeof frequencyApplies
        /** Whether the choice for the category on the channel cannot change: it is locked, the channel is off, or pushes wait for the notification center. */
        isDisabled(category: PreferenceCategory, channel: PreferenceChannel): boolean
    }

const load = (): Promise<void> => preferencesStore.load(inboxStore.getSnapshot().url)

/**
 * The notification preferences of the signed-in user and the actions that change them, for building your own preferences
 * page. Loads the preferences when the component mounts. Every component shares the same state.
 */
export function usePreferences(): UsePreferences {
    const { props } = usePage()
    const state = useSyncExternalStore(preferencesStore.subscribe, preferencesStore.getSnapshot, () => INITIAL_PREFERENCES)
    const sections = useMemo(() => preferenceSections(state), [state])

    useLayoutEffect(() => {
        initNotifications()

        syncFirstPage(props)

        void load()
    }, [])

    return {
        ...state,
        sections,
        load,
        set: preferencesStore.set,
        setChannel: preferencesStore.setChannel,
        setFrequency: preferencesStore.setFrequency,
        setNotificationHours: preferencesStore.setNotificationHours,
        receives: (category, channel) => receives(category, channel, state.channels),
        frequencyApplies,
        isDisabled: (category, channel) => isDisabled(category, channel, state.channels),
    }
}
