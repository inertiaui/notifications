<script setup lang="ts">
import { InfiniteScroll, usePage } from '@inertiajs/vue3'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch, type Component } from 'vue'

import { cn } from '../../js/cn'
import {
    clock,
    groupItems,
    inboxLabels,
    inboxStore,
    label,
    listItems,
    parseInboxItem,
    syncFirstPage,
    type InboxClasses,
    type InboxFilter,
    type InboxItem,
    type InboxLabels,
    type SnoozeOption,
} from '../../js/inbox'
import {
    clickTarget,
    emptyText as emptyTextFor,
    handleListKeydown,
    holdArrivals,
    keepFocus,
    listHref,
    listScope,
    shownItems,
    toggleSelected,
    trackSeen,
    type ArrivalHold,
    type NotificationCenterTabProps,
    type NotificationListHeaderProps,
} from '../../js/notificationCenter'
import type { ToastAction } from '../../js/types'
import * as styles from './classes'
import Icon from './Icon.vue'
import type { IconResolverFn } from './iconResolver'
import InboxHeader from './InboxHeader.vue'
import ItemGroup from './ItemGroup.vue'
import type { NotificationItemProps } from './NotificationItem.vue'
import { initNotifications } from './notifications'
import SelectionBar from './SelectionBar.vue'

const props = withDefaults(
    defineProps<{
        /** The name of the page prop that holds `Inbox::scroll()`. */
        data: string
        /** The filter the page prop was loaded with, in place of the URL's `filter` query parameter; notifications that no longer match, such as archived ones in `all`, are hidden. */
        filter?: InboxFilter
        /** Text of the list, in place of the `inbox_` translations; `:count` and `:title` are replaced. */
        labels?: Partial<InboxLabels>
        /** Components for the icon names that notifications refer to, and for the built-in icons, such as `empty`. */
        icons?: Record<string, Component>
        /** Resolves the icons that `icons` does not have, in place of the global resolver of `setIconResolver()`. */
        iconResolver?: IconResolverFn | null
        classes?: InboxClasses
        locale?: string
        /** How far from the end of the list, in pixels, the next page starts loading. */
        buffer?: number
        /** Load the next page with a button instead of when the end of the list scrolls into view. */
        manual?: boolean
        /** Keep the URL when a page loads, instead of adding its cursor. */
        preserveUrl?: boolean
        /** The category the page prop was loaded with, in place of the URL's `category` query parameter; notifications of other categories that arrive are hidden. */
        category?: string | null
        /** Show notifications with the same `InboxMessage::group()` key as one, with a button that shows the others. */
        group?: boolean
        /** The snooze times to offer, from the current time, in place of the built-in ones. */
        snooze?: (now: Date) => SnoozeOption[]
        /** The highest number the tabs and categories show; larger counts show as this number with a plus, such as 99+. */
        maxCount?: number
    }>(),
    {
        filter: undefined,
        labels: () => ({}),
        icons: () => ({}),
        iconResolver: undefined,
        classes: () => ({}),
        locale: undefined,
        buffer: 250,
        manual: false,
        preserveUrl: false,
        category: undefined,
        group: true,
        snooze: undefined,
        maxCount: 99,
    },
)

defineSlots<{
    /** Replaces the content of each notification. It receives the props of the built-in `NotificationItem`. */
    item?(props: NotificationItemProps): unknown
    /** Replaces the text shown when there are no notifications. */
    empty?(props: { filter: InboxFilter }): unknown
    /** Replaces the top of the list, with the bulk actions and the pause button. */
    header?(props: NotificationListHeaderProps): unknown
    /** Replaces the content of each tab. */
    tab?(props: NotificationCenterTabProps): unknown
}>()

const emit = defineEmits<{
    /** The link of a notification was clicked. Call `event.preventDefault()` to keep the list from opening it. */
    itemClick: [item: InboxItem, event: MouseEvent]
    /** An action of a notification was clicked. Call `event.preventDefault()` to keep the list from running it. */
    action: [item: InboxItem, action: ToastAction<InboxItem>, event: MouseEvent]
}>()

const page = usePage()
const state = shallowRef(inboxStore.getServerSnapshot())
const now = ref(Date.now())
const allLabels = computed(() => inboxLabels(props.labels))
// Without the filter and category props, the list shows those of the URL, which its tabs and category buttons link to.
const scope = computed(() => listScope(page.url, state.value, props.filter, props.category))
const emptyText = computed(() => emptyTextFor(scope.value.filter, allLabels.value))
const root = ref<HTMLElement>()

const loaded = computed(() => {
    const value = (page.props as Record<string, unknown>)[props.data] as { data?: unknown } | undefined

    return Array.isArray(value?.data) ? value.data.map(parseInboxItem).filter((item) => item !== undefined) : []
})

// Notifications that arrive in real time show first, and the user's changes, such as marking as read in the
// notification center, apply to the page's notifications too.
const listed = (): InboxItem[] => listItems(inboxStore, loaded.value, scope.value.filter, scope.value.category)

// Those that arrived while the reader scrolled down the page wait behind the button at the top of the list.
const held = shallowRef<readonly string[]>([])

const items = computed(() => {
    void state.value

    return shownItems(listed(), held.value)
})

const groups = computed(() => groupItems(items.value, props.group))

const hasMore = computed(() => Boolean(page.scrollProps?.[props.data]?.nextPage))

// The tabs and categories link to the same page with another filter and category, from its newest notifications.
const href = (filter: InboxFilter, category: string | null): string => listHref(page.url, filter, category, page.scrollProps?.[props.data]?.pageName)

// The selection lasts while the page shows the same list.
const selectedIds = shallowRef<readonly string[]>([])
const selecting = computed(() => items.value.some((item) => selectedIds.value.includes(item.id)))

const select = (id: string, selected: boolean): void => {
    selectedIds.value = toggleSelected(selectedIds.value, id, selected)
}

let arrivals: ArrivalHold | undefined
const cleanups: Array<() => void> = []

watch(
    () => `${scope.value.filter}|${scope.value.category}|${state.value.selectable}`,
    () => {
        selectedIds.value = []
        arrivals?.release()
    },
)

// Runs before the click reaches the notification, so a listener may prevent it.
const onClick = (event: MouseEvent): void => {
    const target = clickTarget(event, items.value)

    if (target?.action) {
        emit('action', target.item, target.action, event)
    } else if (target) {
        emit('itemClick', target.item, event)
    }
}

onMounted(() => {
    initNotifications()
    cleanups.push(inboxStore.subscribe(() => (state.value = inboxStore.getSnapshot())))
    cleanups.push(clock.subscribe(() => (now.value = clock.getSnapshot())))

    syncFirstPage(page.props)

    // Only the browser remembers the page's notifications, as on the server every request shares the store. After the
    // sync above, which starts over when another user signed in.
    inboxStore.remember(loaded.value)
    cleanups.push(watch(loaded, (list) => inboxStore.remember(list)))

    state.value = inboxStore.getSnapshot()
    now.value = clock.getSnapshot()
    cleanups.push(keepFocus(root.value!))

    arrivals = holdArrivals(root.value!, (ids) => (held.value = ids), { listed: (id) => listed().some((item) => item.id === id) })
    cleanups.push(() => arrivals?.destroy())

    // Like the panel, the list marks the notifications that the user saw on the page as seen.
    const seen = trackSeen(root.value!, () => items.value, null)
    cleanups.push(() => seen.destroy())
})

onBeforeUnmount(() => cleanups.forEach((cleanup) => cleanup()))
</script>

<template>
    <div ref="root" data-inbox-list tabindex="-1" @keydown="handleListKeydown($event, root!)" @click.capture="onClick">
        <InboxHeader
            component="NotificationList"
            :state="state"
            :filter="scope.filter"
            :category="scope.category"
            :items="items"
            :labels="allLabels"
            :icons="props.icons"
            :icon-resolver="props.iconResolver"
            :classes="props.classes"
            :locale="props.locale"
            :max-count="props.maxCount"
            :now="now"
            :href="href"
        >
            <template v-if="$slots.header" #header="headerProps">
                <slot name="header" v-bind="headerProps as NotificationListHeaderProps" />
            </template>
            <template v-if="$slots.tab" #tab="tabProps">
                <slot name="tab" v-bind="tabProps" />
            </template>
        </InboxHeader>

        <div aria-live="polite" :class="styles.newPillRowClass">
            <button v-if="held.length > 0" type="button" data-inbox-show-new :class="styles.newPillClass" @click="arrivals?.reveal()">
                {{ label(allLabels.showNew, { count: held.length }) }}
            </button>
        </div>

        <InfiniteScroll
            :data="props.data"
            :buffer="props.buffer"
            :manual="props.manual"
            :preserve-url="props.preserveUrl"
            as="ul"
            role="list"
            :hidden="items.length === 0 || undefined"
            :data-inbox-selecting="selecting || undefined"
            :class="cn(styles.listClass, props.classes.list)"
        >
            <ItemGroup
                v-for="entry in groups"
                :key="entry.key"
                :group="entry"
                :now="now"
                :labels="allLabels"
                :icons="props.icons"
                :icon-resolver="props.iconResolver"
                :classes="props.classes"
                :locale="props.locale"
                :pending-actions="state.pendingActions"
                :snooze="props.snooze"
                :allowed-actions="state.allowedActions"
                :selected="state.selectable ? selectedIds : undefined"
                :select="state.selectable ? select : undefined"
            >
                <template v-if="$slots.item" #item="itemProps">
                    <slot name="item" v-bind="itemProps" />
                </template>
            </ItemGroup>

            <template #loading>
                <div role="status" :class="styles.loadingMoreClass">
                    <Icon
                        name="spinner"
                        :context="{ component: 'NotificationList', part: 'loading-more' }"
                        :icons="props.icons"
                        :resolver="props.iconResolver"
                        :class="styles.spinnerClass"
                    />
                    <span class="sr-only">{{ label(allLabels.loading) }}</span>
                </div>
            </template>

            <template v-if="props.manual" #next="{ fetch, hasMore: more, loading }">
                <div v-if="more" :class="styles.loadingMoreClass">
                    <button type="button" data-inbox-load-more :aria-busy="loading || undefined" :class="styles.itemSecondaryActionClass" @click="fetch">
                        {{ label(allLabels.loadMore) }}
                    </button>
                </div>
            </template>
        </InfiniteScroll>

        <div v-if="items.length === 0 && !hasMore" data-inbox-empty :class="styles.stateClass">
            <slot name="empty" :filter="scope.filter">
                <Icon
                    name="empty"
                    :context="{ component: 'NotificationList', part: 'empty', filter: scope.filter }"
                    :icons="props.icons"
                    :resolver="props.iconResolver"
                    :class="styles.stateIconClass"
                />
                <p>{{ emptyText }}</p>
            </slot>
        </div>

        <div v-if="selecting" :class="styles.listSelectionClass">
            <SelectionBar
                v-model:selected="selectedIds"
                component="NotificationList"
                :items="items"
                :filter="scope.filter"
                :allowed-actions="state.allowedActions"
                :now="now"
                :labels="allLabels"
                :icons="props.icons"
                :icon-resolver="props.iconResolver"
                :classes="props.classes"
                :locale="props.locale"
                :snooze="props.snooze"
            />
        </div>
    </div>
</template>
