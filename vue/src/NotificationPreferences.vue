<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, useId, watch } from 'vue'

import { cn } from '../../js/cn'
import { clock, label } from '../../js/inbox'
import {
    editNotificationHours,
    notificationHoursDays,
    preferencesLabels,
    preferencesTable,
    togglePreference,
    type NotificationHoursEdit,
    type NotificationHoursEditing,
    type PreferenceCategory,
    type PreferenceChannel,
    type PreferenceFrequency,
    type PreferenceGroup,
    type PreferencesClasses,
    type PreferencesLabels,
    type PreferenceWeekday,
} from '../../js/preferences'
import { otherPushDevices, pushDeviceView, togglePushDevice } from '../../js/push'
import * as styles from './classes'
import Icon from './Icon.vue'
import { usePreferences } from './usePreferences'
import { usePush } from './usePush'

const props = withDefaults(
    defineProps<{
        /** Text of the component, in place of the `preferences_` translations; `:category`, `:channel`, `:day`, `:start`, `:end`, `:browser`, `:platform`, `:time`, and `:device` are replaced. */
        labels?: Partial<PreferencesLabels>
        /** Class names added to the parts of the component. */
        classes?: PreferencesClasses
        /** The locale of the weekday names of the notification hours and of when other devices were active; defaults to the browser's. */
        locale?: string
    }>(),
    { labels: () => ({}), classes: () => ({}), locale: undefined },
)

defineSlots<{
    /** Replaces the label, badge, and description of each category. */
    category?(props: { category: PreferenceCategory }): unknown
    /** Replaces the label and description of each group. */
    group?(props: { group: PreferenceGroup }): unknown
    /** Replaces the label of each channel's column. */
    channel?(props: { channel: PreferenceChannel }): unknown
    /** Replaces the text shown when there are no categories. */
    empty?(): unknown
}>()

const {
    status,
    channels,
    categories,
    sections,
    notificationHours,
    frequencies,
    load,
    setChannel,
    setFrequency,
    setNotificationHours,
    receives,
    frequencyApplies,
    isDisabled,
} = usePreferences()
const push = usePush()
const allLabels = computed(() => preferencesLabels(props.labels))
const table = computed(() => preferencesTable(channels.value, categories.value, frequencies.value, allLabels.value))
const t = (name: keyof PreferencesLabels): string => label(allLabels.value[name])

// The device control shows while a channel sends web push, the application sends pushes, and the browser could receive them.
const pushDevice = computed(() =>
    channels.value.some((channel) => channel.push)
        ? pushDeviceView({
              available: push.available.value,
              supported: push.supported.value,
              permission: push.permission.value,
              subscribed: push.subscribed.value,
              busy: push.busy.value,
              reason: push.reason.value,
              request: push.request.value,
          })
        : null,
)

// The user's other devices show below the device control, which loads them each time it shows.
const now = shallowRef(0)
const otherDevices = computed(() => otherPushDevices(push.devices.value, allLabels.value, now.value, props.locale))
const devicesId = useId()
let stopClock: (() => void) | undefined

onMounted(() => {
    stopClock = clock.subscribe(() => (now.value = clock.getSnapshot()))
    now.value = clock.getSnapshot()
})

onBeforeUnmount(() => stopClock?.())

watch(
    () => pushDevice.value !== null,
    (shown) => {
        if (shown) {
            void push.loadDevices()
        }
    },
    { immediate: true },
)

const changeFrequency = (category: PreferenceCategory, event: Event): void => {
    void setFrequency(category.key, (event.target as HTMLSelectElement).value as PreferenceFrequency)
}

const editing = shallowRef<NotificationHoursEditing | null>(null)
const weekdays = computed(() => notificationHoursDays(notificationHours.value, editing.value, props.locale))

const leaveDay = (event: FocusEvent): void => {
    if (!(event.currentTarget as Node).contains(event.relatedTarget as Node | null)) {
        editing.value = null
    }
}

const edit = (change: NotificationHoursEdit): void => {
    const next = editNotificationHours(notificationHours.value, editing.value, change)

    if (next) {
        editing.value = next.editing(editing.value)
        void setNotificationHours({ days: { [change.day]: next.ranges } })
    }
}

const changeTime = (day: PreferenceWeekday, index: number, field: 'start' | 'end', event: Event): void =>
    edit({ kind: 'time', day, index, field, time: (event.target as HTMLInputElement).value })
</script>

<template>
    <div data-inbox-preferences>
        <div v-if="status === 'error'" data-inbox-preferences-error :class="styles.stateClass">
            <p>{{ t('error') }}</p>
            <button type="button" :class="styles.itemSecondaryActionClass" @click="load">{{ t('retry') }}</button>
        </div>
        <div v-else-if="status !== 'ready' && categories.length === 0" role="status" :class="styles.stateClass">
            <Icon name="spinner" :context="{ component: 'NotificationPreferences', part: 'loading' }" :class="styles.spinnerClass" />
            <span class="sr-only">{{ t('loading') }}</span>
        </div>
        <div v-else-if="categories.length === 0" data-inbox-preferences-empty :class="styles.stateClass">
            <slot name="empty">
                <p>{{ t('empty') }}</p>
            </slot>
        </div>
        <div v-else :class="styles.preferencesTableScrollClass">
            <table :class="cn(styles.preferencesTableClass, props.classes.table)">
                <caption class="sr-only">
                    {{ t('title') }}
                </caption>
                <thead>
                    <tr>
                        <th scope="col" :class="cn(styles.preferencesHeadClass, props.classes.head)">{{ t('category') }}</th>
                        <th v-for="channel in channels" :key="channel.key" scope="col" :class="cn(styles.preferencesChannelHeadClass, props.classes.head)">
                            <slot name="channel" :channel="channel">{{ channel.label }}</slot>
                        </th>
                        <th v-if="table.hasFrequencies" scope="col" :class="cn(styles.preferencesFrequencyHeadClass, props.classes.head)">
                            {{ t('frequency') }}
                        </th>
                    </tr>
                </thead>
                <tbody v-if="table.hasGlobalSwitches" data-inbox-preferences-global>
                    <tr :class="cn(styles.preferencesRowClass, props.classes.row)">
                        <th scope="row" :class="styles.preferencesCategoryClass">
                            <span :class="cn(styles.preferencesLabelClass, props.classes.label)">{{ t('global') }}</span>
                            <span :class="cn(styles.preferencesDescriptionClass, props.classes.description)">{{ t('globalDescription') }}</span>
                        </th>
                        <td v-for="channel in channels" :key="channel.key" :class="styles.preferencesCellClass">
                            <button
                                v-if="channel.globalSwitch"
                                type="button"
                                role="switch"
                                :aria-checked="channel.enabled ? 'true' : 'false'"
                                :aria-label="label(allLabels.toggle, { category: t('global'), channel: channel.label })"
                                :data-inbox-preference-channel="channel.key"
                                :class="cn(styles.switchClass, props.classes.switch)"
                                @click="setChannel(channel.key, !channel.enabled)"
                            >
                                <span aria-hidden="true" :class="styles.switchThumbClass" />
                            </button>
                        </td>
                        <td v-if="table.hasFrequencies" />
                    </tr>
                </tbody>
                <tbody v-for="section in sections" :key="section.group?.key ?? ''" :data-inbox-preference-group="section.group?.key">
                    <tr v-if="section.group" :class="styles.preferencesRowClass">
                        <th scope="rowgroup" :colspan="table.columns" :class="cn(styles.preferencesGroupClass, props.classes.group)">
                            <slot name="group" :group="section.group">
                                <span :class="styles.preferencesGroupLabelClass">{{ section.group.label }}</span>
                                <span v-if="section.group.description" :class="cn(styles.preferencesDescriptionClass, props.classes.description)">{{
                                    section.group.description
                                }}</span>
                            </slot>
                        </th>
                    </tr>
                    <tr
                        v-for="category in section.categories"
                        :key="category.key"
                        :data-inbox-preference-category="category.key"
                        :class="cn(styles.preferencesRowClass, props.classes.row)"
                    >
                        <th scope="row" :class="styles.preferencesCategoryClass">
                            <slot name="category" :category="category">
                                <span :class="cn(styles.preferencesCategoryLabelClass, props.classes.label)">{{ category.label }}</span>
                                <span v-if="category.locked" :class="cn(styles.preferencesLockedClass, props.classes.badge)">{{ t('locked') }}</span>
                                <span v-if="category.description" :class="cn(styles.preferencesDescriptionClass, props.classes.description)">{{
                                    category.description
                                }}</span>
                            </slot>
                        </th>
                        <td v-for="channel in channels" :key="channel.key" :class="styles.preferencesCellClass">
                            <button
                                v-if="category.channels[channel.key] !== undefined"
                                type="button"
                                role="switch"
                                :aria-checked="receives(category, channel) ? 'true' : 'false'"
                                :aria-disabled="isDisabled(category, channel) || undefined"
                                :aria-label="label(allLabels.toggle, { category: category.label, channel: channel.label })"
                                :data-inbox-preference="`${category.key}.${channel.key}`"
                                :class="cn(styles.switchClass, props.classes.switch)"
                                @click="togglePreference(category, channel, channels)"
                            >
                                <span aria-hidden="true" :class="styles.switchThumbClass" />
                            </button>
                        </td>
                        <td v-if="table.hasFrequencies" :class="styles.preferencesFrequencyCellClass">
                            <select
                                v-if="category.frequency !== null"
                                :value="category.frequency"
                                :disabled="!frequencyApplies(category, channels)"
                                :aria-label="label(allLabels.frequencyLabel, { category: category.label })"
                                :data-inbox-preference-frequency="category.key"
                                :class="cn(styles.preferencesSelectClass, props.classes.select)"
                                @change="changeFrequency(category, $event)"
                            >
                                <option v-for="option in table.frequencyOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
                            </select>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <div
            v-if="pushDevice !== null && status !== 'error' && categories.length > 0"
            data-inbox-push-device
            :data-state="pushDevice.state"
            :aria-busy="pushDevice.state === 'busy' ? 'true' : undefined"
            :class="styles.preferencesPushClass"
        >
            <div :class="styles.preferencesPushHeaderClass">
                <div :class="styles.preferencesPushTextClass">
                    <span :class="cn(styles.preferencesLabelClass, props.classes.label)">{{ t('pushDevice') }}</span>
                    <div aria-live="polite" data-inbox-push-device-status>
                        <p v-if="pushDevice.hint" :class="cn(styles.preferencesPushHintClass, props.classes.description)">{{ t(pushDevice.text) }}</p>
                        <span v-else :class="cn(styles.preferencesDescriptionClass, props.classes.description)">{{ t(pushDevice.text) }}</span>
                    </div>
                </div>
                <button
                    v-if="pushDevice.button"
                    type="button"
                    :aria-disabled="pushDevice.state === 'busy' || undefined"
                    data-inbox-push-device-button
                    :class="cn(pushDevice.button.primary ? styles.itemPrimaryActionClass : styles.itemSecondaryActionClass, styles.preferencesPushButtonClass)"
                    @click="togglePushDevice(pushDevice)"
                >
                    <Icon
                        v-if="pushDevice.state === 'busy'"
                        name="spinner"
                        :context="{ component: 'NotificationPreferences', part: 'push-busy' }"
                        :class="styles.actionSpinnerClass"
                    />
                    {{ t(pushDevice.button.label) }}
                </button>
            </div>
            <div v-if="otherDevices.length > 0" data-inbox-push-other-devices :class="styles.preferencesPushDevicesClass">
                <p :id="devicesId" :class="styles.preferencesPushDevicesHeadingClass">{{ t('pushDevices') }}</p>
                <ul :aria-labelledby="devicesId" :class="styles.preferencesPushDevicesListClass">
                    <li v-for="device in otherDevices" :key="device.id" data-inbox-push-other-device :class="styles.preferencesPushDeviceClass">
                        <div :class="styles.preferencesPushBodyClass">
                            <span :class="cn(styles.preferencesLabelClass, props.classes.label)">{{ device.name }}</span>
                            <span :class="cn(styles.preferencesDescriptionClass, props.classes.description)">{{ device.active }}</span>
                        </div>
                        <button
                            type="button"
                            :aria-label="device.removeLabel"
                            data-inbox-push-other-device-remove
                            :class="cn(styles.itemSecondaryActionClass, styles.preferencesPushButtonClass)"
                            @click="push.removeDevice(device.id)"
                        >
                            {{ t('pushDeviceRemove') }}
                        </button>
                    </li>
                </ul>
            </div>
        </div>
        <div
            v-if="notificationHours !== null && status !== 'error' && categories.length > 0"
            data-inbox-preferences-notification-hours
            :class="styles.preferencesNotificationHoursClass"
        >
            <div :class="styles.preferencesNotificationHoursHeaderClass">
                <button
                    type="button"
                    role="switch"
                    :aria-checked="notificationHours.enabled ? 'true' : 'false'"
                    :aria-label="t('notificationHours')"
                    data-inbox-notification-hours
                    :class="cn(styles.switchClass, props.classes.switch)"
                    @click="setNotificationHours({ enabled: !notificationHours.enabled })"
                >
                    <span aria-hidden="true" :class="styles.switchThumbClass" />
                </button>
                <div>
                    <span :class="cn(styles.preferencesLabelClass, props.classes.label)">{{ t('notificationHours') }}</span>
                    <span :class="cn(styles.preferencesDescriptionClass, props.classes.description)">{{ t('notificationHoursDescription') }}</span>
                </div>
            </div>
            <div :class="styles.preferencesNotificationHoursDaysClass">
                <div
                    v-for="day in weekdays"
                    :key="day.day"
                    role="group"
                    :aria-label="day.name"
                    :data-inbox-notification-hours-day="day.day"
                    :class="styles.preferencesNotificationHoursDayClass"
                    @focusout="leaveDay"
                >
                    <div :class="styles.preferencesNotificationHoursDayNameClass">
                        <button
                            type="button"
                            role="switch"
                            :aria-checked="day.ranges.length > 0 ? 'true' : 'false'"
                            :aria-disabled="day.locked || undefined"
                            :aria-label="label(allLabels.notificationHoursDay, { day: day.name })"
                            data-inbox-notification-hours-day-switch
                            :class="cn(styles.switchClass, props.classes.switch)"
                            @click="edit({ kind: 'toggle', day: day.day })"
                        >
                            <span aria-hidden="true" :class="styles.switchThumbClass" />
                        </button>
                        <span>{{ day.name }}</span>
                    </div>
                    <div v-if="day.ranges.length > 0" :class="styles.preferencesNotificationHoursRangesClass">
                        <div v-for="([start, end], index) in day.ranges" :key="index" :class="styles.preferencesNotificationHoursRangeClass">
                            <label :class="styles.preferencesTimeLabelClass">
                                <span class="sr-only">{{ t('notificationHoursStart') }}</span>
                                <input
                                    type="time"
                                    required
                                    :value="start"
                                    :disabled="!notificationHours.enabled"
                                    data-inbox-notification-hours-start
                                    :class="cn(styles.preferencesTimeClass, props.classes.time)"
                                    @change="changeTime(day.day, index, 'start', $event)"
                                />
                            </label>
                            <span aria-hidden="true" :class="styles.preferencesTimeLabelClass">–</span>
                            <label :class="styles.preferencesTimeLabelClass">
                                <span class="sr-only">{{ t('notificationHoursEnd') }}</span>
                                <input
                                    type="time"
                                    required
                                    :value="end"
                                    :disabled="!notificationHours.enabled"
                                    data-inbox-notification-hours-end
                                    :class="cn(styles.preferencesTimeClass, props.classes.time)"
                                    @change="changeTime(day.day, index, 'end', $event)"
                                />
                            </label>
                            <button
                                v-if="day.ranges.length > 1"
                                type="button"
                                :disabled="!notificationHours.enabled"
                                :aria-label="label(allLabels.notificationHoursRemoveLabel, { start, end, day: day.name })"
                                data-inbox-notification-hours-remove
                                :class="styles.preferencesNotificationHoursButtonClass"
                                @click="edit({ kind: 'remove', day: day.day, index })"
                            >
                                {{ t('notificationHoursRemove') }}
                            </button>
                            <button
                                v-if="index === day.ranges.length - 1"
                                type="button"
                                :disabled="!day.canAdd"
                                :aria-label="label(allLabels.notificationHoursAddLabel, { day: day.name })"
                                data-inbox-notification-hours-add
                                :class="styles.preferencesNotificationHoursButtonClass"
                                @click="edit({ kind: 'add', day: day.day })"
                            >
                                {{ t('notificationHoursAdd') }}
                            </button>
                        </div>
                    </div>
                    <p v-else :class="styles.preferencesNotificationHoursOffClass">{{ t('notificationHoursOff') }}</p>
                </div>
            </div>
        </div>
    </div>
</template>
