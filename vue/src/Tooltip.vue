<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

import { createInboxTooltip } from '../../js/overlay'
import * as styles from './classes'

/*
 * Shows the name of the control in its slot, such as the archive button of a notification, with its keyboard shortcut.
 * The control's accessible name already holds the text, so no element refers to the tooltip.
 */
defineProps<{ text: string; shortcut?: string }>()

const open = ref(false)
const trigger = ref<HTMLElement>()
const panel = ref<HTMLElement>()

const tooltip = createInboxTooltip({
    reference: () => trigger.value ?? null,
    tooltip: () => panel.value ?? null,
    onOpenChange: (value) => (open.value = value),
})

watch(open, async (value) => {
    if (value) {
        await nextTick()
        tooltip.mount()
    }
})

onBeforeUnmount(tooltip.cleanup)
</script>

<template>
    <span
        ref="trigger"
        :class="styles.tooltipTriggerClass"
        @pointerenter="tooltip.onPointerEnter"
        @pointerleave="tooltip.onPointerLeave"
        @pointerdown="tooltip.onPointerDown"
        @focusin="tooltip.onFocusIn"
        @focusout="tooltip.onFocusOut"
    >
        <slot />
        <span v-if="open" ref="panel" role="tooltip" :popover="tooltip.native ? 'manual' : undefined" data-inbox-tooltip :class="styles.tooltipClass">
            {{ text }}
            <kbd v-if="shortcut" :class="styles.tooltipShortcutClass">{{ shortcut }}</kbd>
        </span>
    </span>
</template>
