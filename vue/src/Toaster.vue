<script lang="ts">
import type { Toast } from '../../js/types'

/** The props of a component in the Toaster's `components` prop, which renders the toasts of one type. */
export interface ToastComponentProps {
    toast: Toast
    /** Closes the toast, as its dismiss button does. */
    dismiss: () => void
    /** Runs an action of the toast. Pass the click event, so a modified click on a link opens it in a new tab. */
    runAction: (index: number, event: MouseEvent) => void
}
</script>

<script setup lang="ts">
import { usePage } from '@inertiajs/vue3'
import { computed, onBeforeUnmount, onMounted, onUnmounted, onUpdated, ref, shallowRef, watch, type Component } from 'vue'

import { actionHref } from '../../js/actions'
import { cn } from '../../js/cn'
import { customIcon } from '../../js/iconResolver'
import { own, toastIcons } from '../../js/icons'
import { handleActionClick, handleFlash, toastStore } from '../../js/toast'
import {
    DEFAULT_HOTKEY,
    createToasterController,
    dismissLabel as formatDismissLabel,
    regionLabel,
    toastsByPosition,
    typeLabel,
    type ToasterController,
} from '../../js/toaster'
import { trans, type TranslationValue } from '../../js/translations'
import type { ToastClasses, ToastPosition, ToastTypeLabels } from '../../js/types'
import * as styles from './classes'
import Icon from './Icon.vue'
import type { IconResolverFn } from './iconResolver'
import { initNotifications } from './notifications'

const props = withDefaults(
    defineProps<{
        position?: ToastPosition
        /** Shows only the toasts whose `toaster` option has this name. */
        name?: string
        /** The accessible name of the toast region, in place of the `toaster_label` translation; the shortcut is added to it. */
        label?: string
        /** The accessible name of each dismiss button, in place of the `toast_dismiss` translation; `:title` is replaced with the toast's title. */
        dismissLabel?: TranslationValue
        /** `KeyboardEvent.code` values and modifier names that focus the newest toast. Pass `[]` to disable. */
        hotkey?: readonly string[]
        /** The words that screen readers announce before a toast's title, in place of the `toast_type_` translations. */
        typeLabels?: ToastTypeLabels
        /** How many toasts show in the collapsed stack. */
        visibleToasts?: number
        /** Show every toast at full height instead of stacking them. */
        expand?: boolean
        /** Show a bar that counts down the time left on timed toasts. */
        progress?: boolean
        /** Components for icon names that toasts refer to, for toast types, and for the built-in icons, such as `dismiss`. */
        icons?: Record<string, Component>
        /** Resolves the icons that `icons` does not have, in place of the global resolver of `setIconResolver()`. */
        iconResolver?: IconResolverFn | null
        /** Class names added to the parts of each toast. */
        classes?: ToastClasses
        /** Components that render the toasts of a type in place of the default markup, keyed by the type, such as `{ invite: InviteToast }`. */
        components?: Record<string, Component>
        /** Keep the toasts usable above modal dialogs of other libraries, such as Radix and Reka, and above the notification center's panel. */
        aboveModals?: boolean
    }>(),
    {
        position: 'bottom-right',
        name: undefined,
        label: undefined,
        dismissLabel: undefined,
        hotkey: () => DEFAULT_HOTKEY,
        typeLabels: () => ({}),
        visibleToasts: 3,
        expand: false,
        progress: false,
        icons: () => ({}),
        iconResolver: undefined,
        classes: () => ({}),
        components: () => ({}),
        aboveModals: true,
    },
)

defineSlots<{
    /** Replaces the content of each toast. */
    toast?(props: { toast: Toast; dismiss: () => void; runAction: (index: number, event: MouseEvent) => void }): unknown
    /** Replaces the icon of each toast. */
    icon?(props: { toast: Toast }): unknown
}>()

const page = usePage()
const toasts = shallowRef(toastStore.getSnapshot())
const groups = computed(() =>
    toastsByPosition(
        toasts.value.filter((toast) => toast.toaster === props.name),
        props.position,
    ),
)

const host = shallowRef<HTMLElement>()
const region = ref<HTMLElement>()
const polite = ref<HTMLElement>()
const assertive = ref<HTMLElement>()

let controller: ToasterController | undefined
let unsubscribe: (() => void) | undefined

// The toast's own icon, or the icon of its type, from the props or a resolver; `undefined` for the built-in icon of its type.
const typeIcon = (toast: Toast): Component | string | undefined => {
    // Functional components, such as the Vue icons of Heroicons, are functions.
    if (typeof toast.icon === 'object' || typeof toast.icon === 'function') {
        return toast.icon as Component
    }

    const icon = (name: string, part: string) => customIcon<Component | string>(name, { component: 'Toaster', part, toast }, props.icons, props.iconResolver)

    return (typeof toast.icon === 'string' ? icon(toast.icon, 'icon') : undefined) ?? icon(toast.type, 'type')
}

const dismiss = (toast: Toast): void => toastStore.dismiss(toast.id, 'user')
const runAction = (toast: Toast, index: number, event: MouseEvent): void => handleActionClick(toast.id, index, event)

onMounted(() => {
    initNotifications()
    unsubscribe = toastStore.subscribe(() => (toasts.value = toastStore.getSnapshot()))

    // Flash data that arrived before this component mounted, when the application did not call initNotifications().
    handleFlash(page.flash as Record<string, unknown>)
    toasts.value = toastStore.getSnapshot()

    // The toasts render into an element of their own, which can move into an open modal dialog.
    const element = document.createElement('div')
    element.className = 'iui-toaster-host'
    document.body.append(element)
    host.value = element
})

watch(
    region,
    (element) => {
        if (element && !controller) {
            controller = createToasterController(toastStore, { region: element, host: host.value, polite: polite.value!, assertive: assertive.value! }, () => ({
                name: props.name,
                hotkey: props.hotkey,
                typeLabels: props.typeLabels,
                visibleToasts: props.visibleToasts,
                expand: props.expand,
                aboveModals: props.aboveModals,
            }))
            controller.update()
        }
    },
    { flush: 'post' },
)

// The controller lays out and observes what this component rendered, so it updates after every render.
onUpdated(() => controller?.update())

onBeforeUnmount(() => {
    unsubscribe?.()
    controller?.destroy()
})

onUnmounted(() => host.value?.remove())
</script>

<template>
    <Teleport v-if="host" :to="host">
        <section ref="region" :aria-label="regionLabel(props.label, props.hotkey)" tabindex="-1" class="iui-toaster outline-none" :data-toaster="props.name">
            <ol v-for="[listPosition, items] in groups" :key="listPosition" role="list" data-toast-list :data-position="listPosition" class="iui-toast-list">
                <li
                    v-for="toast in items"
                    :key="toast.id"
                    :data-toast-id="toast.id"
                    :data-type="toast.type"
                    :data-state="toast.state"
                    :data-dismissible="String(toast.dismissible)"
                    :aria-busy="toast.type === 'loading' || undefined"
                    tabindex="0"
                    :class="cn(styles.toastClass, props.classes.toast)"
                >
                    <div data-toast-body :class="styles.bodyClass">
                        <component
                            :is="own(props.components, toast.type)"
                            v-if="own(props.components, toast.type)"
                            :toast="toast"
                            :dismiss="() => dismiss(toast)"
                            :run-action="(index: number, event: MouseEvent) => runAction(toast, index, event)"
                        />
                        <slot
                            v-else
                            name="toast"
                            :toast="toast"
                            :dismiss="() => dismiss(toast)"
                            :run-action="(index: number, event: MouseEvent) => runAction(toast, index, event)"
                        >
                            <span
                                v-if="toast.icon !== false"
                                aria-hidden="true"
                                :class="cn(styles.iconClass, own(styles.typeClasses, toast.type) ?? styles.typeClasses.default, props.classes.icon)"
                            >
                                <slot name="icon" :toast="toast">
                                    <img v-if="toast.image" :src="toast.image" alt="" :class="styles.imageClass" />
                                    <component :is="typeIcon(toast)" v-else-if="typeIcon(toast)" class="size-5" />
                                    <Icon
                                        v-else-if="toast.type === 'loading'"
                                        name="spinner"
                                        :context="{ component: 'Toaster', part: 'type', toast }"
                                        :icons="props.icons"
                                        :resolver="props.iconResolver"
                                        :class="styles.spinnerClass"
                                    />
                                    <svg v-else-if="own(toastIcons, toast.type)" viewBox="0 0 20 20" fill="currentColor" class="size-5">
                                        <path fill-rule="evenodd" clip-rule="evenodd" :d="own(toastIcons, toast.type)" />
                                    </svg>
                                    <span v-else :class="styles.dotClass" />
                                </slot>
                            </span>
                            <div class="min-w-0 flex-1">
                                <p :class="cn(styles.titleClass, props.classes.title)">
                                    <span v-if="typeLabel(toast.type, props.typeLabels)" class="sr-only">{{ typeLabel(toast.type, props.typeLabels) }}: </span
                                    >{{ toast.title
                                    }}<span v-if="toast.count > 1" data-toast-count aria-hidden="true" :class="styles.countClass">{{
                                        trans('toast_count', { count: toast.count })
                                    }}</span>
                                </p>
                                <p v-if="toast.description" :class="cn(styles.descriptionClass, props.classes.description)">{{ toast.description }}</p>
                                <div
                                    v-if="toast.progress !== undefined"
                                    role="progressbar"
                                    :aria-label="toast.title"
                                    aria-valuemin="0"
                                    aria-valuemax="100"
                                    :aria-valuenow="Math.round(toast.progress * 100)"
                                    data-toast-progressbar
                                    :class="styles.progressBarClass"
                                >
                                    <div
                                        :class="cn(styles.progressBarFillClass, own(styles.typeClasses, toast.type) ?? styles.typeClasses.default)"
                                        :style="{ width: `${toast.progress * 100}%` }"
                                    />
                                </div>
                                <div v-if="toast.actions.length > 0" :class="cn(styles.actionsClass, props.classes.actions)">
                                    <component
                                        :is="actionHref(action) === undefined ? 'button' : 'a'"
                                        v-for="(action, index) in toast.actions"
                                        :key="index"
                                        :type="actionHref(action) === undefined ? 'button' : undefined"
                                        :href="actionHref(action)"
                                        :target="action.newTab ? '_blank' : undefined"
                                        :rel="action.newTab ? 'noopener noreferrer' : undefined"
                                        :aria-disabled="toast.pendingAction !== undefined || undefined"
                                        :aria-busy="toast.pendingAction === index || undefined"
                                        data-toast-action
                                        :class="cn(index === 0 ? styles.primaryActionClass : styles.secondaryActionClass, props.classes.action)"
                                        @click="runAction(toast, index, $event)"
                                    >
                                        <Icon
                                            v-if="toast.pendingAction === index"
                                            name="spinner"
                                            :context="{ component: 'Toaster', part: 'action', toast, action }"
                                            :icons="props.icons"
                                            :resolver="props.iconResolver"
                                            :class="styles.actionSpinnerClass"
                                        />
                                        {{ action.label }}
                                    </component>
                                </div>
                            </div>
                            <button
                                v-if="toast.dismissible"
                                type="button"
                                :aria-label="formatDismissLabel(props.dismissLabel, toast)"
                                :class="cn(styles.dismissClass, props.classes.dismiss)"
                                @click="dismiss(toast)"
                            >
                                <Icon
                                    name="dismiss"
                                    :context="{ component: 'Toaster', part: 'dismiss', toast }"
                                    :icons="props.icons"
                                    :resolver="props.iconResolver"
                                    class="size-4"
                                />
                            </button>
                        </slot>
                    </div>
                    <div
                        v-if="props.progress && toast.duration !== null"
                        data-toast-progress
                        aria-hidden="true"
                        :class="cn(styles.progressClass, own(styles.typeClasses, toast.type) ?? styles.typeClasses.default, props.classes.progress)"
                    />
                </li>
            </ol>
            <div ref="polite" role="status" aria-live="polite" aria-atomic="true" class="sr-only" />
            <div ref="assertive" aria-live="assertive" aria-atomic="true" class="sr-only" />
        </section>
    </Teleport>
</template>
