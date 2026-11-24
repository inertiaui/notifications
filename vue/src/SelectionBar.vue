<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, useId, watch, type Component } from 'vue'

import { cn } from '../../js/cn'
import {
    inboxStore,
    label,
    snoozeTime,
    type InboxAction,
    type InboxBatchAction,
    type InboxClasses,
    type InboxFilter,
    type InboxItem,
    type InboxLabels,
    type SnoozeOption,
} from '../../js/inbox'
import { selectionActions, snoozeChoices } from '../../js/notificationCenter'
import * as styles from './classes'
import Icon from './Icon.vue'
import type { IconResolverFn } from './iconResolver'

/*
 * The bar below a list while notifications are selected: the select-all checkbox, the number of selected
 * notifications, and the actions for them, with the snooze times below it. The panel and the `NotificationList` share it.
 */
const props = defineProps<{
    /** The component that shows the bar, which the icon resolver receives. */
    component: 'NotificationCenter' | 'NotificationList'
    /** The notifications that the list shows, which the select-all checkbox selects. */
    items: readonly InboxItem[]
    filter: InboxFilter
    allowedActions: readonly InboxAction[]
    now: number
    labels: InboxLabels
    icons: Record<string, Component>
    iconResolver?: IconResolverFn | null
    classes: InboxClasses
    locale?: string
    snooze?: (now: Date) => SnoozeOption[]
}>()

/** The IDs of the selected notifications. */
const selected = defineModel<readonly string[]>('selected', { required: true })

const snoozeId = useId()
const t = (name: keyof InboxLabels): string => label(props.labels[name])
const selectedItems = computed(() => props.items.filter((item) => selected.value.includes(item.id)))
const allSelected = computed(() => selectedItems.value.length === props.items.length)
const actions = computed(() => selectionActions(props.filter, props.allowedActions))

// The snooze times while they show below the bar. Like those of a notification, they count from when they opened.
const choices = shallowRef<SnoozeOption[] | null>(null)
const choicesElement = ref<HTMLElement>()

// The snooze times leave with the selection, so they never show for another one.
watch(
    () => selectedItems.value.length === 0,
    (empty) => {
        if (empty) {
            choices.value = null
        }
    },
)

const run = (action: InboxBatchAction, until?: Date): void => {
    const items = selectedItems.value

    selected.value = []
    void inboxStore.batch(action, items, until)
}

const toggleSnooze = async (): Promise<void> => {
    choices.value = choices.value ? null : snoozeChoices(props.snooze, props.labels)

    if (choices.value) {
        await nextTick()
        choicesElement.value?.querySelector('button')?.focus()
    }
}

const snoozeUntil = (until: Date): void => {
    choices.value = null
    run('snooze', until)
}
</script>

<template>
    <template v-if="selectedItems.length > 0">
        <div role="group" :aria-label="t('selection')" data-inbox-selection :class="styles.selectionBarClass">
            <div :class="styles.selectAllClass">
                <input
                    type="checkbox"
                    data-inbox-select-all
                    :checked="allSelected"
                    :indeterminate="!allSelected"
                    :aria-label="t('selectAll')"
                    :class="styles.selectAllCheckboxClass"
                    @change="selected = allSelected ? [] : items.map((item) => item.id)"
                />
                <span aria-live="polite">{{ label(labels.selected, { count: selectedItems.length }) }}</span>
            </div>
            <div :class="styles.panelActionsClass">
                <button
                    v-for="entry in actions"
                    :key="entry.action"
                    type="button"
                    :data-inbox-batch="entry.action"
                    :aria-label="t(entry.label)"
                    :title="t(entry.label)"
                    :aria-expanded="entry.action === 'snooze' ? (choices ? 'true' : 'false') : undefined"
                    :aria-controls="entry.action === 'snooze' && choices ? snoozeId : undefined"
                    :class="cn(styles.controlClass, classes.control)"
                    @click="entry.action === 'snooze' ? toggleSnooze() : run(entry.action)"
                >
                    <Icon
                        :name="entry.icon"
                        :context="{ component, part: 'selection', action: entry.action }"
                        :icons="icons"
                        :resolver="iconResolver"
                        class="size-4"
                    />
                </button>
                <button
                    type="button"
                    data-inbox-clear-selection
                    :aria-label="t('clearSelection')"
                    :title="t('clearSelection')"
                    :class="cn(styles.controlClass, classes.control)"
                    @click="selected = []"
                >
                    <Icon name="dismiss" :context="{ component, part: 'clear-selection' }" :icons="icons" :resolver="iconResolver" class="size-4" />
                </button>
            </div>
        </div>
    </template>
    <div
        v-if="choices"
        :id="snoozeId"
        ref="choicesElement"
        role="group"
        :aria-label="t('snoozeUntil')"
        data-inbox-batch-snooze-options
        :class="styles.selectionSnoozeOptionsClass"
    >
        <button
            v-for="option in choices"
            :key="option.label"
            type="button"
            data-inbox-batch-snooze-option
            :class="cn(styles.itemSecondaryActionClass, classes.action)"
            @click="snoozeUntil(option.until)"
        >
            {{ option.label }}
            <span :class="styles.snoozeTimeClass">{{ snoozeTime(option.until, now, locale) }}</span>
        </button>
    </div>
</template>
