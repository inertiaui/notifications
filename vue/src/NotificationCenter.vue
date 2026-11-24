<script setup lang="ts">
import { Link, router, usePage } from '@inertiajs/vue3'
import type { Placement } from '@inertiaui/vanilla'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useId, watch, type Component } from 'vue'

import { cn } from '../../js/cn'
import {
    badgeText,
    clock,
    groupItems,
    inboxLabels,
    inboxStore,
    label,
    syncFirstPage,
    type InboxClasses,
    type InboxFilter,
    type InboxItem,
    type InboxLabels,
    type SnoozeOption,
} from '../../js/inbox'
import {
    bellLabel,
    createNotificationCenterController,
    emptyText as emptyTextFor,
    handleListKeydown,
    holdArrivals,
    keepFocus,
    listState,
    shownTabs,
    shownItems,
    toggleSelected,
    trackSeen,
    clickTarget,
    type ArrivalHold,
    type NotificationCenterBadgeProps,
    type NotificationCenterController,
    type NotificationCenterErrorProps,
    type NotificationCenterFooterProps,
    type NotificationCenterHeaderProps,
    type NotificationCenterTabProps,
    type NotificationCenterTriggerProps,
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
        /** Text of the notification center, in place of the `inbox_` translations; `:count` and `:title` are replaced. */
        labels?: Partial<InboxLabels>
        /** What the bell shows when there are notifications: the number, a dot, or nothing. */
        badge?: 'count' | 'dot' | 'none'
        /** Which notifications the badge counts: those that arrived since the panel was last opened, or every unread one. */
        count?: 'unseen' | 'unread'
        /** The highest number the badge shows; larger counts show as this number with a plus, such as 99+. */
        maxCount?: number
        /** The URL of a page with every notification; the panel then links to it. */
        href?: string
        /** Components for the icon names that notifications refer to, and for the built-in icons, such as `bell`. */
        icons?: Record<string, Component>
        /** Resolves the icons that `icons` does not have, in place of the global resolver of `setIconResolver()`. */
        iconResolver?: IconResolverFn | null
        /** Class names added to the parts of the notification center. */
        classes?: InboxClasses
        /** The locale of relative times and numbers; defaults to the browser's. */
        locale?: string
        /** Show notifications with the same `InboxMessage::group()` key as one, with a button that shows the others. */
        group?: boolean
        /** The snooze times to offer, from the current time, in place of the built-in ones. */
        snooze?: (now: Date) => SnoozeOption[]
        /** Where the panel opens next to the bell, such as `bottom-end`. It moves to the other side when there is no room. */
        placement?: Placement
    }>(),
    {
        labels: () => ({}),
        badge: 'count',
        count: 'unseen',
        maxCount: 99,
        href: undefined,
        icons: () => ({}),
        iconResolver: undefined,
        classes: () => ({}),
        locale: undefined,
        group: true,
        snooze: undefined,
        placement: 'bottom-end',
    },
)

defineSlots<{
    /** Replaces the content of each notification. It receives the props of the built-in `NotificationItem`. */
    item?(props: NotificationItemProps): unknown
    /** Replaces the text shown when the selected tab has no notifications. */
    empty?(props: { filter: InboxFilter }): unknown
    /** Replaces the content of the bell button: the bell icon and the badge. */
    trigger?(props: NotificationCenterTriggerProps): unknown
    /** Replaces the badge on the bell. It renders only while the count is above zero. */
    badge?(props: NotificationCenterBadgeProps): unknown
    /** Replaces the top of the panel, with the title, the bulk actions, and the pause button. */
    header?(props: NotificationCenterHeaderProps): unknown
    /** Replaces the content of each tab. */
    tab?(props: NotificationCenterTabProps): unknown
    /** Replaces the spinner while the list loads. */
    loading?(props: Record<string, never>): unknown
    /** Replaces the message and the button shown when loading the list, or its next page, failed. */
    error?(props: NotificationCenterErrorProps): unknown
    /** Replaces the bottom of the panel, which links to `href` by default. */
    footer?(props: NotificationCenterFooterProps): unknown
}>()

/** Whether the panel is open. Bind it with `v-model:open` to open and close the panel from elsewhere. */
const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
    /** The link of a notification was clicked. Call `event.preventDefault()` to keep the panel from opening it. */
    itemClick: [item: InboxItem, event: MouseEvent]
    /** An action of a notification was clicked. Call `event.preventDefault()` to keep the panel from running it. */
    action: [item: InboxItem, action: ToastAction<InboxItem>, event: MouseEvent]
}>()

const page = usePage()
const id = useId()
const ids = {
    panel: `${id}-panel`,
    title: `${id}-title`,
    list: `${id}-list`,
    tab: (filter: InboxFilter) => `${id}-tab-${filter}`,
}

const state = shallowRef(inboxStore.getServerSnapshot())
const now = ref(Date.now())
const allLabels = computed(() => inboxLabels(props.labels))
const t = (name: keyof InboxLabels): string => label(allLabels.value[name])
const badgeCount = computed(() => state.value.counts[props.count])
const emptyText = computed(() => emptyTextFor(state.value.filter, allLabels.value))
const tabs = computed(() => shownTabs(state.value))
// The notifications that arrived while the reader scrolled down wait behind the button at the top of the list.
const held = shallowRef<readonly string[]>([])
const items = computed(() => shownItems(state.value.items, held.value))
const list = computed(() => listState(state.value, items.value.length))
const groups = computed(() => groupItems(items.value, props.group))

const trigger = ref<HTMLButtonElement>()
const panel = ref<HTMLElement>()
const sentinel = ref<HTMLElement>()
const scroller = ref<HTMLElement>()

let controller: NotificationCenterController | undefined
let arrivals: ArrivalHold | undefined
const cleanups: Array<() => void> = []
let stopClock: (() => void) | undefined
let openedAt: string | undefined

onMounted(() => {
    initNotifications()
    cleanups.push(inboxStore.subscribe(() => (state.value = inboxStore.getSnapshot())))

    syncFirstPage(page.props)

    state.value = inboxStore.getSnapshot()
    cleanups.push(keepFocus(panel.value!))

    arrivals = holdArrivals(scroller.value!, (ids) => (held.value = ids), {
        scroller: scroller.value!,
        listed: (id) => inboxStore.getSnapshot().items.some((item) => item.id === id),
    })
    cleanups.push(() => arrivals?.destroy())

    // The panel marks the notifications that the user saw as seen, rather than all of them when it opens.
    const seen = trackSeen(scroller.value!, () => inboxStore.getSnapshot().items)
    cleanups.push(() => seen.destroy())

    controller = createNotificationCenterController(trigger.value!, panel.value!, {
        onToggle(isOpen) {
            open.value = isOpen
            stopClock?.()
            stopClock = undefined

            if (isOpen) {
                openedAt = window.location.href
                stopClock = clock.subscribe(() => (now.value = clock.getSnapshot()))
                now.value = clock.getSnapshot()
                void inboxStore.opened(tabs.value, { markAllAsSeen: false, categories: Object.keys(state.value.categoryFilter) })
            } else {
                inboxStore.closed({ markAllAsSeen: false })
            }
        },
        onEndReached: () => void inboxStore.loadMore(),
        placement: () => props.placement,
    })

    // A visit to another page, such as by opening a notification, closes the panel.
    cleanups.push(router.on('navigate', () => window.location.href !== openedAt && controller?.close()))

    showOpen(open.value)
})

// Opens or closes the panel to match the `open` model.
const showOpen = (value: boolean): void => {
    const shown = panel.value?.matches(':popover-open') ?? false

    if (value && !shown) {
        panel.value?.showPopover()
    } else if (!value && shown) {
        controller?.close()
    }
}

watch(open, showOpen)

watch([state, open, sentinel], () => controller?.observe(open.value ? (sentinel.value ?? null) : null), { flush: 'post' })

watch(
    () => props.placement,
    () => controller?.place(),
)

// An open panel whose tabs no longer include the list it shows switches to the first tab.
watch(
    () => tabs.value.join(),
    () => {
        if (open.value && tabs.value.length > 0 && !tabs.value.includes(state.value.filter)) {
            void inboxStore.load(tabs.value[0], state.value.category)
        }
    },
)

onBeforeUnmount(() => {
    if (open.value) {
        inboxStore.closed({ markAllAsSeen: false })
    }

    cleanups.forEach((cleanup) => cleanup())
    stopClock?.()
    controller?.destroy()
})

const onPanelKeydown = (event: KeyboardEvent): void => handleListKeydown(event, panel.value!)

const close = (): void => controller?.close()

const panelHeader = computed(() => ({ titleId: ids.title, title: t('title'), tabId: ids.tab, listId: ids.list, close }))

// The selection lasts while the panel shows the same list, so another tab or category starts without one.
const selectedIds = shallowRef<readonly string[]>([])
const selecting = computed(() => items.value.some((item) => selectedIds.value.includes(item.id)))

watch(
    () => `${state.value.filter}|${state.value.category}|${open.value}|${state.value.selectable}`,
    () => {
        selectedIds.value = []
        arrivals?.release()
    },
)

const select = (id: string, selected: boolean): void => {
    selectedIds.value = toggleSelected(selectedIds.value, id, selected)
}

// Runs before the click reaches the notification, so a listener may prevent it.
const onPanelClick = (event: MouseEvent): void => {
    const target = clickTarget(event, state.value.items)

    if (target?.action) {
        emit('action', target.item, target.action, event)
    } else if (target) {
        emit('itemClick', target.item, event)
    }
}
</script>

<template>
    <div data-inbox class="inline-flex">
        <button
            ref="trigger"
            type="button"
            :popovertarget="ids.panel"
            aria-haspopup="dialog"
            :aria-expanded="open ? 'true' : 'false'"
            :aria-controls="ids.panel"
            :aria-label="bellLabel(allLabels, badgeCount, props.maxCount, props.locale, state.pausedUntil !== null)"
            data-inbox-bell
            :data-paused="state.pausedUntil !== null ? 'true' : undefined"
            :class="cn(styles.bellClass, props.classes.bell)"
        >
            <slot name="trigger" :open="open" :count="badgeCount" :counts="state.counts">
                <Icon
                    :name="state.pausedUntil !== null ? 'paused' : 'bell'"
                    :context="{ component: 'NotificationCenter', part: 'bell' }"
                    :icons="props.icons"
                    :resolver="props.iconResolver"
                    class="size-5"
                />
                <template v-if="props.badge !== 'none' && badgeCount > 0">
                    <slot name="badge" :count="badgeCount" :text="badgeText(badgeCount, props.maxCount, props.locale)">
                        <span v-if="props.badge === 'count'" data-inbox-badge aria-hidden="true" :class="cn(styles.badgeClass, props.classes.badge)">
                            {{ badgeText(badgeCount, props.maxCount, props.locale) }}
                        </span>
                        <span v-else data-inbox-badge aria-hidden="true" :class="cn(styles.badgeDotClass, props.classes.badge)" />
                    </slot>
                </template>
            </slot>
        </button>

        <div
            :id="ids.panel"
            ref="panel"
            popover="auto"
            role="dialog"
            :aria-labelledby="ids.title"
            tabindex="-1"
            data-inbox-panel
            :class="cn(styles.panelClass, props.classes.panel)"
            @keydown="onPanelKeydown"
            @click.capture="onPanelClick"
        >
            <div :class="styles.panelBodyClass">
                <InboxHeader
                    component="NotificationCenter"
                    :state="state"
                    :filter="state.filter"
                    :category="state.category"
                    :items="state.items"
                    :labels="allLabels"
                    :icons="props.icons"
                    :icon-resolver="props.iconResolver"
                    :classes="props.classes"
                    :locale="props.locale"
                    :max-count="props.maxCount"
                    :now="now"
                    :panel="panelHeader"
                    :open="open"
                >
                    <template v-if="$slots.header" #header="headerProps">
                        <slot name="header" v-bind="headerProps as NotificationCenterHeaderProps" />
                    </template>
                    <template v-if="$slots.tab" #tab="tabProps">
                        <slot name="tab" v-bind="tabProps" />
                    </template>
                </InboxHeader>

                <div
                    :id="ids.list"
                    ref="scroller"
                    data-inbox-scroller
                    :role="tabs.length > 1 ? 'tabpanel' : undefined"
                    :aria-labelledby="tabs.length > 1 ? ids.tab(state.filter) : undefined"
                    :aria-busy="state.status === 'loading' || state.loadingMore || undefined"
                    :class="styles.scrollerClass"
                >
                    <div aria-live="polite" :class="styles.newPillRowClass">
                        <button v-if="held.length > 0" type="button" data-inbox-show-new :class="styles.newPillClass" @click="arrivals?.reveal()">
                            {{ label(allLabels.showNew, { count: held.length }) }}
                        </button>
                    </div>

                    <div v-if="list === 'loading'" role="status" :class="styles.stateClass">
                        <slot name="loading">
                            <Icon
                                name="spinner"
                                :context="{ component: 'NotificationCenter', part: 'loading' }"
                                :icons="props.icons"
                                :resolver="props.iconResolver"
                                :class="[styles.stateIconClass, 'motion-safe:animate-spin']"
                            />
                            <span class="sr-only">{{ t('loading') }}</span>
                        </slot>
                    </div>

                    <div v-else-if="list === 'error'" data-inbox-error :class="styles.stateClass">
                        <slot name="error" :more="false" :retry="() => void inboxStore.load()">
                            <p role="alert">{{ t('error') }}</p>
                            <button type="button" data-inbox-retry :class="styles.itemSecondaryActionClass" @click="inboxStore.load()">{{ t('retry') }}</button>
                        </slot>
                    </div>

                    <div v-else-if="list === 'empty'" data-inbox-empty :class="styles.stateClass">
                        <slot name="empty" :filter="state.filter">
                            <Icon
                                name="empty"
                                :context="{ component: 'NotificationCenter', part: 'empty', filter: state.filter }"
                                :icons="props.icons"
                                :resolver="props.iconResolver"
                                :class="styles.stateIconClass"
                            />
                            <p>{{ emptyText }}</p>
                        </slot>
                    </div>

                    <template v-else>
                        <ul role="list" :data-inbox-selecting="selecting || undefined" :class="cn(styles.listClass, props.classes.list)">
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
                        </ul>
                        <div v-if="state.hasMore && state.moreFailed" data-inbox-more-failed :class="styles.stateClass">
                            <slot name="error" :more="true" :retry="() => void inboxStore.loadMore({ retry: true })">
                                <p role="alert">{{ t('error') }}</p>
                                <button type="button" data-inbox-retry :class="styles.itemSecondaryActionClass" @click="inboxStore.loadMore({ retry: true })">
                                    {{ t('retry') }}
                                </button>
                            </slot>
                        </div>
                        <div v-else-if="state.hasMore" ref="sentinel" aria-hidden="true" :class="styles.loadingMoreClass">
                            <Icon
                                v-if="state.loadingMore"
                                name="spinner"
                                :context="{ component: 'NotificationCenter', part: 'loading-more' }"
                                :icons="props.icons"
                                :resolver="props.iconResolver"
                                :class="styles.spinnerClass"
                            />
                        </div>
                    </template>
                </div>

                <SelectionBar
                    v-model:selected="selectedIds"
                    component="NotificationCenter"
                    :items="items"
                    :filter="state.filter"
                    :allowed-actions="state.allowedActions"
                    :now="now"
                    :labels="allLabels"
                    :icons="props.icons"
                    :icon-resolver="props.iconResolver"
                    :classes="props.classes"
                    :locale="props.locale"
                    :snooze="props.snooze"
                />

                <slot v-if="$slots.footer || props.href" name="footer" :href="props.href" :close="close">
                    <Link :href="props.href!" data-inbox-view-all :class="styles.footerClass">{{ t('viewAll') }}</Link>
                </slot>
            </div>
        </div>
    </div>
</template>
