<script lang="ts">
import type { Component } from 'vue'

import type { InboxAction, InboxClasses, InboxItem, InboxLabels, SnoozeOption } from '../../js/inbox'
import type { IconResolverFn } from './iconResolver'

export interface NotificationItemProps {
    item: InboxItem
    /** The current time in milliseconds, for the relative time and whether the snooze has ended. Keep it current, or an ended snooze keeps showing. */
    now: number
    /** The text of the item; defaults to the `inbox_` translations. */
    labels?: InboxLabels
    /** Components for the icon names that notifications refer to, and for the built-in icons, such as `archive`. */
    icons?: Record<string, Component>
    /** Resolves the icons that `icons` does not have, in place of the global resolver of `setIconResolver()`. */
    iconResolver?: IconResolverFn | null
    classes?: InboxClasses
    locale?: string
    /** The index of the action that is running, from `pendingActions` of the inbox state. */
    pendingAction?: number
    /** The snooze times to offer, from the current time, in place of the built-in ones. */
    snooze?: (now: Date) => SnoozeOption[]
    /**
     * The actions that the item shows buttons for, from `allowedActions` of the inbox state: snooze, archive, mute, and
     * delete. Defaults to every action but deleting, like the server's `inbox.actions` config.
     */
    allowedActions?: readonly InboxAction[]
    /** Whether the notification is selected, for the actions of the selection bar. */
    selected?: boolean
    /** Called when the user selects or deselects the notification. Without it, the item has no checkbox. */
    onSelectedChange?: (selected: boolean) => void
}
</script>

<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, useId, watch } from 'vue'

import { actionHref } from '../../js/actions'
import { cn } from '../../js/cn'
import { customIcon } from '../../js/iconResolver'
import { actorsText, inboxLabels, inboxStore, isSnoozed, label, relativeTime, snoozeOptions, snoozeTime, stackedActors } from '../../js/inbox'
import { initials } from '../../js/notificationCenter'
import type { TranslationValue } from '../../js/translations'
import * as styles from './classes'
import Icon from './Icon.vue'
import Tooltip from './Tooltip.vue'

const props = withDefaults(defineProps<NotificationItemProps>(), {
    labels: () => inboxLabels(),
    icons: () => ({}),
    iconResolver: undefined,
    classes: () => ({}),
    locale: undefined,
    pendingAction: undefined,
    snooze: undefined,
    allowedActions: () => ['snooze', 'archive', 'mute'],
    selected: false,
    onSelectedChange: undefined,
})

// Where an icon of the item renders, for icon resolvers.
const context = (part: string) => ({ component: 'NotificationItem', part, item: props.item })

const unread = computed(() => props.item.readAt === null)
const archived = computed(() => props.item.archivedAt !== null)
const icon = computed(() => (props.item.icon ? customIcon<Component | string>(props.item.icon, context('media'), props.icons, props.iconResolver) : undefined))
const absoluteTime = computed(() => new Date(props.item.createdAt).toLocaleString(props.locale, { dateStyle: 'medium', timeStyle: 'short' }))

// By the clock of the panel or list, so a snooze that ends shows once it ticks, as in React.
const snoozed = computed(() => isSnoozed(props.item, props.now))
const actors = computed(() => actorsText(props.labels, props.item))
const stacked = computed(() => stackedActors(props.item))

const toggleRead = (): Promise<void> => (unread.value ? inboxStore.markAsRead(props.item) : inboxStore.markAsUnread(props.item))
const toggleArchived = (): Promise<void> => (archived.value ? inboxStore.unarchive(props.item) : inboxStore.archive(props.item))
const toggleMuted = (): Promise<void> => (props.item.muted ? inboxStore.unmute(props.item) : inboxStore.mute(props.item))

const allows = (action: InboxAction): boolean => props.allowedActions.includes(action)

// A control's tooltip shows its action, and its accessible name adds the notification's title.
const controlName = (action: TranslationValue): string => label(props.labels.itemControl, { action: label(action), title: props.item.title })
const showsSnooze = computed(() => allows('snooze'))

const snoozeId = useId()
const choosing = ref(false)
const options = shallowRef<SnoozeOption[]>([])
const optionsElement = ref<HTMLElement>()

// The snooze times close once snoozing is no longer offered, such as after the application left it out.
watch(showsSnooze, (shows) => {
    if (!shows) {
        choosing.value = false
    }
})

// A snoozed notification goes back to the inbox; otherwise the snooze times show below the notification.
const toggleSnooze = async (): Promise<void> => {
    if (snoozed.value) {
        void inboxStore.unsnooze(props.item)

        return
    }

    choosing.value = !choosing.value

    if (choosing.value) {
        const now = new Date()
        options.value = props.snooze ? props.snooze(now) : snoozeOptions(props.labels, now)
        await nextTick()
        optionsElement.value?.querySelector('button')?.focus()
    }
}

const snoozeUntil = (until: Date): void => {
    choosing.value = false
    void inboxStore.snooze(props.item, until)
}
</script>

<template>
    <div
        :data-read="String(!unread)"
        :data-archived="String(archived)"
        :data-selected="onSelectedChange ? String(selected) : undefined"
        :class="cn(styles.itemClass, classes.item)"
    >
        <component :is="onSelectedChange ? 'label' : 'span'" :class="cn(styles.leadingClass, onSelectedChange && styles.selectableLeadingClass)">
            <span aria-hidden="true" :class="cn(styles.mediaClass, classes.media)">
                <img v-if="item.actor?.avatar" :src="item.actor.avatar" alt="" class="size-full object-cover" />
                <component :is="icon" v-else-if="icon" class="size-5" />
                <template v-else-if="item.actor?.name">{{ initials(item.actor.name) }}</template>
                <Icon
                    v-else
                    :name="item.announcement ? 'announcement' : 'notification'"
                    :context="context('media')"
                    :icons="icons"
                    :resolver="iconResolver"
                    class="size-5"
                />
            </span>
            <span v-if="onSelectedChange" :class="styles.checkboxOverlayClass">
                <input
                    type="checkbox"
                    data-inbox-select
                    aria-keyshortcuts="X"
                    :checked="selected"
                    :aria-label="label(labels.select, { title: item.title })"
                    :class="styles.checkboxClass"
                    @change="onSelectedChange(($event.target as HTMLInputElement).checked)"
                />
            </span>
            <span v-if="unread" aria-hidden="true" :class="styles.unreadDotClass" />
        </component>
        <div class="min-w-0 flex-1">
            <p :class="cn(styles.itemTitleClass, classes.title)">
                <span v-if="unread" class="sr-only">{{ label(labels.unreadState) }}: </span>
                <span v-if="item.announcement" class="sr-only">{{ label(labels.announcement) }}: </span>
                <a v-if="item.url" data-inbox-link :href="item.url" :class="styles.linkClass" @click="inboxStore.open(item, $event)">{{ item.title }}</a>
                <template v-else>{{ item.title }}</template>
            </p>
            <p v-if="item.body" :class="cn(styles.itemBodyClass, classes.body)">{{ item.body }}</p>
            <img v-if="item.image" :src="item.image" alt="" :class="styles.itemImageClass" />
            <p v-if="actors" data-inbox-actors :class="cn(styles.itemActorsClass, classes.actors)">
                <span aria-hidden="true" :class="styles.actorStackClass">
                    <span v-for="(actor, index) in stacked" :key="index" :style="{ zIndex: stacked.length - index }" :class="styles.stackedAvatarClass">
                        <img v-if="actor.avatar" :src="actor.avatar" alt="" class="size-full object-cover" />
                        <template v-else-if="actor.name">{{ initials(actor.name) }}</template>
                    </span>
                </span>
                {{ actors }}
            </p>
            <p v-if="snoozed && item.snoozedUntil" data-inbox-snoozed-until data-allow-mismatch :class="cn(styles.snoozedUntilClass, classes.time)">
                <Icon name="snooze" :context="context('snoozed-until')" :icons="icons" :resolver="iconResolver" class="size-3.5" />
                {{ label(labels.snoozedUntil, { time: snoozeTime(item.snoozedUntil, now, locale) }) }}
            </p>
            <time v-else :datetime="item.createdAt" :title="absoluteTime" data-allow-mismatch :class="cn(styles.timeClass, classes.time)">
                {{ relativeTime(item.createdAt, now, locale) }}
            </time>
            <p v-if="item.muted" data-inbox-muted :class="cn(styles.mutedClass, classes.time)">
                <Icon name="mute" :context="context('muted')" :icons="icons" :resolver="iconResolver" class="size-3.5" />
                {{ label(labels.muted) }}
            </p>
            <p v-if="item.result !== null" data-inbox-result :class="cn(styles.itemResultClass, classes.result)">
                <Icon name="result" :context="context('result')" :icons="icons" :resolver="iconResolver" class="size-3.5" />
                {{ item.result }}
            </p>
            <div v-else-if="item.actions.length > 0" :class="styles.itemActionsClass">
                <component
                    :is="actionHref(action) === undefined ? 'button' : 'a'"
                    v-for="(action, index) in item.actions"
                    :key="index"
                    :type="actionHref(action) === undefined ? 'button' : undefined"
                    :href="actionHref(action)"
                    :target="action.newTab ? '_blank' : undefined"
                    :rel="action.newTab ? 'noopener noreferrer' : undefined"
                    :aria-disabled="pendingAction !== undefined || undefined"
                    :aria-busy="pendingAction === index || undefined"
                    :data-inbox-action="index"
                    :class="cn(index === 0 ? styles.itemPrimaryActionClass : styles.itemSecondaryActionClass, classes.action)"
                    @click="inboxStore.runAction(item, index, $event)"
                >
                    <Icon
                        v-if="pendingAction === index"
                        name="spinner"
                        :context="{ ...context('action'), action }"
                        :icons="icons"
                        :resolver="iconResolver"
                        :class="styles.actionSpinnerClass"
                    />
                    {{ action.label }}
                </component>
            </div>
            <div
                v-if="choosing && showsSnooze"
                :id="snoozeId"
                ref="optionsElement"
                role="group"
                :aria-label="label(labels.snoozeUntil)"
                data-inbox-snooze-options
                :class="styles.itemActionsClass"
            >
                <button
                    v-for="option in options"
                    :key="option.label"
                    type="button"
                    data-inbox-snooze-option
                    :class="cn(styles.itemSecondaryActionClass, classes.action)"
                    @click="snoozeUntil(option.until)"
                >
                    {{ option.label }}
                    <span :class="styles.snoozeTimeClass">{{ snoozeTime(option.until, now, locale) }}</span>
                </button>
            </div>
        </div>
        <div :class="styles.controlsClass">
            <Tooltip :text="label(unread ? labels.markAsRead : labels.markAsUnread)" shortcut="U">
                <button
                    type="button"
                    data-inbox-toggle-read
                    aria-keyshortcuts="U"
                    :aria-label="controlName(unread ? labels.markAsRead : labels.markAsUnread)"
                    :class="cn(styles.controlClass, classes.control)"
                    @click="toggleRead"
                >
                    <Icon :name="unread ? 'read' : 'unread'" :context="context('toggle-read')" :icons="icons" :resolver="iconResolver" class="size-4" />
                </button>
            </Tooltip>
            <Tooltip v-if="showsSnooze && !archived" :text="label(snoozed ? labels.unsnooze : labels.snooze)" shortcut="H">
                <button
                    type="button"
                    data-inbox-snooze
                    aria-keyshortcuts="H"
                    :aria-label="controlName(snoozed ? labels.unsnooze : labels.snooze)"
                    :aria-expanded="snoozed ? undefined : choosing ? 'true' : 'false'"
                    :aria-controls="snoozed || !choosing ? undefined : snoozeId"
                    :class="cn(styles.controlClass, classes.control)"
                    @click="toggleSnooze"
                >
                    <Icon :name="snoozed ? 'unsnooze' : 'snooze'" :context="context('snooze')" :icons="icons" :resolver="iconResolver" class="size-4" />
                </button>
            </Tooltip>
            <Tooltip v-if="item.group !== null && allows('mute')" :text="label(item.muted ? labels.unmute : labels.mute)">
                <button
                    type="button"
                    data-inbox-mute
                    :aria-label="controlName(item.muted ? labels.unmute : labels.mute)"
                    :class="cn(styles.controlClass, classes.control)"
                    @click="toggleMuted"
                >
                    <Icon :name="item.muted ? 'unmute' : 'mute'" :context="context('mute')" :icons="icons" :resolver="iconResolver" class="size-4" />
                </button>
            </Tooltip>
            <Tooltip v-if="allows('archive')" :text="label(archived ? labels.unarchive : labels.archive)" shortcut="E">
                <button
                    type="button"
                    data-inbox-toggle-archive
                    aria-keyshortcuts="E"
                    :aria-label="controlName(archived ? labels.unarchive : labels.archive)"
                    :class="cn(styles.controlClass, classes.control)"
                    @click="toggleArchived"
                >
                    <Icon :name="archived ? 'unarchive' : 'archive'" :context="context('archive')" :icons="icons" :resolver="iconResolver" class="size-4" />
                </button>
            </Tooltip>
            <Tooltip v-if="allows('delete')" :text="label(labels.delete)">
                <button
                    type="button"
                    data-inbox-delete
                    :aria-label="controlName(labels.delete)"
                    :class="cn(styles.controlClass, classes.control)"
                    @click="inboxStore.delete(item)"
                >
                    <Icon name="delete" :context="context('delete')" :icons="icons" :resolver="iconResolver" class="size-4" />
                </button>
            </Tooltip>
        </div>
    </div>
</template>
