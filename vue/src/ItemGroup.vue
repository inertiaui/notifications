<script setup lang="ts">
// A list item of the notification center: a notification, and the other notifications of its group behind a toggle.
import { ref, useId, watch, type Component } from 'vue'

import { label, type InboxAction, type InboxClasses, type InboxGroup, type InboxItem, type InboxLabels, type SnoozeOption } from '../../js/inbox'
import * as styles from './classes'
import type { IconResolverFn } from './iconResolver'
import NotificationItem, { type NotificationItemProps } from './NotificationItem.vue'

const props = defineProps<{
    group: InboxGroup
    now: number
    labels: InboxLabels
    icons: Record<string, Component>
    iconResolver?: IconResolverFn | null
    classes: InboxClasses
    locale?: string
    pendingActions: Readonly<Record<string, number>>
    snooze?: (now: Date) => SnoozeOption[]
    allowedActions: readonly InboxAction[]
    /** The IDs of the selected notifications, with `select`; without them, the items have no checkbox. */
    selected?: readonly string[]
    select?: (id: string, selected: boolean) => void
}>()

defineSlots<{
    item?(props: NotificationItemProps): unknown
}>()

// The props of the built-in item, which a custom item receives too, so it may fall back to the built-in one.
const itemProps = (item: InboxItem): NotificationItemProps => ({
    item,
    now: props.now,
    labels: props.labels,
    icons: props.icons,
    iconResolver: props.iconResolver,
    classes: props.classes,
    locale: props.locale,
    pendingAction: props.pendingActions[item.id],
    snooze: props.snooze,
    allowedActions: props.allowedActions,
    selected: props.selected?.includes(item.id) ?? false,
    onSelectedChange: props.select ? (selected: boolean) => props.select!(item.id, selected) : undefined,
})

const expanded = ref(false)
const id = useId()

// A thread whose other notifications all left starts collapsed when the next one arrives.
watch(
    () => props.group.others.length === 0,
    (alone) => {
        if (alone) {
            expanded.value = false
        }
    },
)
</script>

<template>
    <li
        :key="props.group.item.id"
        tabindex="-1"
        data-inbox-item
        :data-inbox-id="props.group.item.id"
        :data-read="String(props.group.item.readAt !== null)"
        :data-seen="String(props.group.item.seenAt !== null)"
        :data-archived="String(props.group.item.archivedAt !== null)"
        :data-announcement="props.group.item.announcement ? 'true' : undefined"
        :class="styles.listItemClass"
    >
        <slot name="item" v-bind="itemProps(props.group.item)">
            <NotificationItem v-bind="itemProps(props.group.item)" />
        </slot>
        <template v-if="props.group.others.length > 0">
            <button
                type="button"
                data-inbox-group-toggle
                :aria-expanded="expanded ? 'true' : 'false'"
                :aria-controls="expanded ? id : undefined"
                :class="styles.groupToggleClass"
                @click="expanded = !expanded"
            >
                {{ expanded ? label(props.labels.showLess) : label(props.labels.showMore, { count: props.group.others.length }) }}
            </button>
            <ul v-if="expanded" :id="id" role="list" :class="styles.groupListClass">
                <li
                    v-for="item in props.group.others"
                    :key="item.id"
                    tabindex="-1"
                    data-inbox-item
                    :data-inbox-id="item.id"
                    :data-read="String(item.readAt !== null)"
                    :data-seen="String(item.seenAt !== null)"
                    :data-archived="String(item.archivedAt !== null)"
                    :data-announcement="item.announcement ? 'true' : undefined"
                    :class="styles.listItemClass"
                >
                    <slot name="item" v-bind="itemProps(item)">
                        <NotificationItem v-bind="itemProps(item)" />
                    </slot>
                </li>
            </ul>
        </template>
    </li>
</template>
