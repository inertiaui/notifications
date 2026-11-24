<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import { createPopoverController, isRightToLeft } from '@inertiaui/vanilla'
import { computed, nextTick, onBeforeUnmount, ref, useId, watch, type Component } from 'vue'

import { cn } from '../../js/cn'
import {
    badgeText,
    inboxStore,
    label,
    pauseEnd,
    pauseOptions as pauseOptionsFor,
    selectedUnread,
    type InboxClasses,
    type InboxFilter,
    type InboxItem,
    type InboxLabels,
    type InboxState,
    type PauseOption,
} from '../../js/inbox'
import {
    archiveAllIfAny,
    canArchiveAll,
    markAllAsReadIfUnread,
    pausedText,
    pauseOptionTime,
    shownTabs,
    tabForKey,
    tabProps,
    type NotificationCenterHeaderProps,
    type NotificationCenterTabProps,
    type NotificationListHeaderProps,
} from '../../js/notificationCenter'
import * as styles from './classes'
import Icon from './Icon.vue'
import type { IconResolverFn } from './iconResolver'
import Tooltip from './Tooltip.vue'

/*
 * The top of a list of notifications, which the panel and the `NotificationList` share: Mark all as read, the menu with
 * Archive all and the pause presets, the paused line, the tabs, and the category buttons. In the panel, the tabs and categories
 * show another list in place. On a page, they link to it, as the page loads its list with `Inbox::scroll()`.
 */
const props = withDefaults(
    defineProps<{
        component: 'NotificationCenter' | 'NotificationList'
        state: InboxState
        filter: InboxFilter
        category: string | null
        /** The notifications that the list shows, which Archive all archives. */
        items: readonly InboxItem[]
        labels: InboxLabels
        icons: Record<string, Component>
        iconResolver?: IconResolverFn | null
        classes: InboxClasses
        locale?: string
        maxCount?: number
        now: number
        /** The panel's title, which names its dialog and tabs, and the ID of the tabs and of the list they control. */
        panel?: { titleId: string; title: string; tabId: (filter: InboxFilter) => string; listId: string; close: () => void }
        /** The URL of another filter and category, which the tabs and categories of a page link to. */
        href?: (filter: InboxFilter, category: string | null) => string
        /** Whether the list shows, so the menu closes with the panel. */
        open?: boolean
    }>(),
    { iconResolver: undefined, locale: undefined, maxCount: 99, panel: undefined, href: undefined, open: true },
)

defineSlots<{
    header?(props: NotificationCenterHeaderProps | NotificationListHeaderProps): unknown
    tab?(props: NotificationCenterTabProps): unknown
}>()

const menuId = useId()
const pauseLabelId = useId()
const t = (name: keyof InboxLabels): string => label(props.labels[name])
const tabs = computed(() => shownTabs(props.state))
const tabList = computed(() => tabProps(tabs.value, { ...props.state, filter: props.filter }, props.labels))
const categoryEntries = computed(() => Object.entries(props.state.categoryFilter))
const unread = computed(() => selectedUnread({ ...props.state, category: props.category }))
const archivable = computed(() => canArchiveAll({ filter: props.filter, allowedActions: props.state.allowedActions }))
const readable = computed(() => props.filter === 'all' || props.filter === 'unread')
const hasMenu = computed(() => archivable.value || props.state.canPause)
const hasActions = computed(() => readable.value || hasMenu.value)
const context = (part: string) => ({ component: props.component, part })

const menuButton = ref<HTMLButtonElement>()
const menuElement = ref<HTMLElement>()
const menuOpen = ref(false)
// Its presets show their end by the list's clock, and a click counts from its own time.
const pauseMenu = computed(() => pauseOptionsFor(props.state.pausePresets, props.labels, props.locale))

// A menu button: arrow keys move between the items, and choosing one or pressing Escape closes it and focuses the button.
const menu = createPopoverController({
    reference: () => menuButton.value ?? null,
    popover: () => menuElement.value ?? null,
    position: { placement: 'bottom-end', offset: 4 },
    menu: true,
    onOpenChange: (value) => (menuOpen.value = value),
})

watch(menuOpen, async (value) => {
    if (value) {
        await nextTick()
        menu.mount()
    }
})

watch(
    () => props.open,
    () => menu.close(false),
)

onBeforeUnmount(menu.cleanup)

const pause = (option: PauseOption): void => void inboxStore.pause(pauseEnd(option.preset))

// The paused line leaves with the Resume button, so focus moves to the menu button, or else to the panel or list.
const resume = (event: MouseEvent): void => {
    const fallback = (event.currentTarget as HTMLElement).closest<HTMLElement>('[data-inbox-panel], [data-inbox-list]')

    void inboxStore.resume()
    ;(menuButton.value ?? fallback)?.focus()
}

const markAllAsRead = (): void => markAllAsReadIfUnread(props.state, props.category)

const archiveAll = (): void => archiveAllIfAny(props.items, props.category)

const select = (filter: InboxFilter, category: string | null): void => void inboxStore.load(filter, category)

const onTabKeydown = (event: KeyboardEvent): void => {
    const rtl = isRightToLeft(event.currentTarget as HTMLElement)
    const next = tabForKey(event.key, props.filter, tabs.value, rtl)

    if (next !== undefined && props.panel) {
        event.preventDefault()
        select(next, props.category)
        document.getElementById(props.panel.tabId(next))?.focus()
    }
}

const headerProps = computed<NotificationCenterHeaderProps | NotificationListHeaderProps>(() => ({
    ...(props.panel && { titleId: props.panel.titleId, title: props.panel.title, close: props.panel.close }),
    filter: props.filter,
    category: props.category,
    unread: unread.value,
    markAllAsRead,
    canArchiveAll: archivable.value,
    archiveAll,
    allowedActions: props.state.allowedActions,
    canPause: props.state.canPause,
    pausedUntil: props.state.pausedUntil,
    pauseOptions: pauseMenu.value,
    pause,
    resume: () => void inboxStore.resume(),
}))
</script>

<template>
    <slot name="header" v-bind="headerProps">
        <div v-if="panel || tabs.length > 1 || hasActions" :class="panel ? styles.panelHeaderClass : styles.listToolbarClass">
            <h2 v-if="panel" :id="panel.titleId" :class="styles.panelTitleClass">{{ panel.title }}</h2>
            <div v-if="href && tabs.length > 1" :class="styles.listTabListClass">
                <Link
                    v-for="tab in tabList"
                    :key="tab.filter"
                    :href="href(tab.filter, category)"
                    :aria-current="tab.selected ? 'page' : undefined"
                    :data-inbox-tab="tab.filter"
                    :class="styles.tabClass"
                >
                    <slot name="tab" v-bind="tab">
                        {{ tab.label }}
                        <span v-if="tab.count !== null && tab.count > 0" :class="styles.tabCountClass">{{ badgeText(tab.count, maxCount, locale) }}</span>
                    </slot>
                </Link>
            </div>
            <div v-if="hasActions" :class="panel ? styles.panelActionsClass : styles.listActionsClass">
                <button
                    v-if="readable"
                    type="button"
                    data-inbox-read-all
                    :aria-disabled="unread === 0 || undefined"
                    :class="styles.textButtonClass"
                    @click="markAllAsRead"
                >
                    {{ t('markAllAsRead') }}
                </button>
                <template v-if="hasMenu">
                    <Tooltip :text="t('moreActions')">
                        <button
                            ref="menuButton"
                            type="button"
                            data-inbox-menu-button
                            aria-haspopup="menu"
                            :aria-label="t('moreActions')"
                            :aria-expanded="menuOpen ? 'true' : 'false'"
                            :aria-controls="menuOpen ? menuId : undefined"
                            :class="cn(styles.controlClass, classes.control)"
                            @click="menu.toggle"
                            @pointerdown="menu.onPointerDown"
                            @keydown="menu.onKeydown"
                            @focusout="menu.onFocusOut"
                        >
                            <Icon name="more" :context="context('more-actions')" :icons="icons" :resolver="iconResolver" class="size-4" />
                        </button>
                    </Tooltip>
                    <div
                        v-if="menuOpen"
                        :id="menuId"
                        ref="menuElement"
                        role="menu"
                        :aria-label="t('moreActions')"
                        :popover="menu.native ? 'auto' : undefined"
                        data-inbox-menu
                        :class="styles.menuClass"
                    >
                        <button
                            v-if="archivable"
                            type="button"
                            role="menuitem"
                            data-inbox-archive-all
                            :aria-disabled="items.length === 0 || undefined"
                            :class="styles.menuItemClass"
                            @click="archiveAll"
                        >
                            <Icon name="archive" :context="context('archive-all')" :icons="icons" :resolver="iconResolver" :class="styles.menuIconClass" />
                            {{ t('archiveAll') }}
                        </button>
                        <div v-if="archivable && state.canPause" role="separator" :class="styles.menuSeparatorClass" />
                        <div v-if="state.canPause" role="group" :aria-labelledby="pauseLabelId">
                            <div :id="pauseLabelId" :class="styles.menuLabelClass">
                                <Icon name="pause" :context="context('pause')" :icons="icons" :resolver="iconResolver" :class="styles.menuIconClass" />
                                {{ t('pause') }}
                            </div>
                            <button
                                v-for="option in pauseMenu"
                                :key="option.label"
                                type="button"
                                role="menuitem"
                                data-inbox-pause-option
                                :class="styles.menuPresetClass"
                                @click="pause(option)"
                            >
                                {{ option.label }}
                                <span :class="styles.pauseTimeClass">{{ pauseOptionTime(option, now, locale) }}</span>
                            </button>
                        </div>
                    </div>
                </template>
            </div>
        </div>
    </slot>

    <div aria-live="polite">
        <p v-if="state.pausedUntil !== null" data-inbox-paused :class="styles.pausedClass">
            <Icon name="paused" :context="context('paused')" :icons="icons" :resolver="iconResolver" :class="styles.pausedIconClass" />
            <span class="min-w-0 flex-1">{{ pausedText(labels, state.pausedUntil, now, locale) }}</span>
            <button type="button" data-inbox-resume :class="styles.resumeClass" @click="resume">{{ t('resume') }}</button>
        </p>
    </div>

    <!-- The list's tabs share a row with its actions, unless a custom header takes their place. -->
    <template v-if="tabs.length > 1">
        <div v-if="href && $slots.header" :class="styles.tabListClass">
            <Link
                v-for="tab in tabList"
                :key="tab.filter"
                :href="href(tab.filter, category)"
                :aria-current="tab.selected ? 'page' : undefined"
                :data-inbox-tab="tab.filter"
                :class="styles.tabClass"
            >
                <slot name="tab" v-bind="tab">
                    {{ tab.label }}
                    <span v-if="tab.count !== null && tab.count > 0" :class="styles.tabCountClass">{{ badgeText(tab.count, maxCount, locale) }}</span>
                </slot>
            </Link>
        </div>
        <div v-else-if="panel" role="tablist" :aria-labelledby="panel.titleId" :class="styles.tabListClass" @keydown="onTabKeydown">
            <button
                v-for="tab in tabList"
                :id="panel.tabId(tab.filter)"
                :key="tab.filter"
                type="button"
                role="tab"
                :aria-selected="tab.selected ? 'true' : 'false'"
                :aria-controls="panel.listId"
                :tabindex="tab.selected ? 0 : -1"
                :data-inbox-tab="tab.filter"
                :class="styles.tabClass"
                @click="select(tab.filter, category)"
            >
                <slot name="tab" v-bind="tab">
                    {{ tab.label }}
                    <span v-if="tab.count !== null && tab.count > 0" :class="styles.tabCountClass">{{ badgeText(tab.count, maxCount, locale) }}</span>
                </slot>
            </button>
        </div>
    </template>

    <div v-if="categoryEntries.length > 0" role="group" :aria-label="t('categories')" :class="styles.categoryListClass">
        <template v-for="[key, name] in [[null, t('allCategories')] as const, ...categoryEntries]" :key="key ?? ''">
            <Link
                v-if="href"
                :href="href(filter, key)"
                :data-inbox-category="key ?? ''"
                :aria-current="category === key ? 'page' : undefined"
                :class="styles.categoryClass"
            >
                {{ name }}
                <span v-if="key !== null && state.categoryCounts[key]" :class="styles.categoryCountClass">
                    {{ badgeText(state.categoryCounts[key], maxCount, locale) }}
                </span>
            </Link>
            <button
                v-else
                type="button"
                :data-inbox-category="key ?? ''"
                :aria-pressed="category === key ? 'true' : 'false'"
                :class="styles.categoryClass"
                @click="select(filter, key)"
            >
                {{ name }}
                <span v-if="key !== null && state.categoryCounts[key]" :class="styles.categoryCountClass">
                    {{ badgeText(state.categoryCounts[key], maxCount, locale) }}
                </span>
            </button>
        </template>
    </div>
</template>
