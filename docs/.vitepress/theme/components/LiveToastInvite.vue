<script setup>
import { trans } from '@inertiaui/notifications-vue'

// The InviteToast component of the Custom Toasts page, with styles for its buttons.
defineProps({ toast: Object, dismiss: Function, runAction: Function })
</script>

<template>
    <div class="min-w-0 flex-1">
        <p class="text-sm font-medium">{{ toast.title }}</p>
        <p class="text-sm">Join {{ toast.data.team }} as {{ toast.data.role }}</p>
        <div class="live-toast-invite-actions">
            <button v-for="(action, index) in toast.actions" :key="index" type="button" class="live-toast-invite-action" @click="runAction(index, $event)">
                {{ action.label }}
            </button>
        </div>
    </div>
    <button type="button" class="live-toast-invite-dismiss" :aria-label="trans('toast_dismiss', { title: toast.title })" @click="dismiss">×</button>
</template>

<style scoped>
.live-toast-invite-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.75rem;
}

.live-toast-invite-action {
    padding: 0.375rem 0.75rem;
    border: 1px solid var(--color-iui-toast-border);
    border-radius: var(--radius-iui-toast);
    font-size: 0.75rem;
    font-weight: 500;
    line-height: 1rem;
    cursor: pointer;
}

.live-toast-invite-action:first-child {
    border-color: transparent;
    background: var(--color-iui-toast-action);
    color: var(--color-iui-toast-action-foreground);
}

.live-toast-invite-action:hover,
.live-toast-invite-dismiss:hover {
    background-color: var(--color-iui-toast-control-hover);
}

.live-toast-invite-action:first-child:hover {
    background: var(--color-iui-toast-action);
    opacity: 0.9;
}

.live-toast-invite-dismiss {
    margin: -0.25rem;
    padding: 0 0.375rem;
    border-radius: var(--radius-iui-toast);
    color: var(--color-iui-toast-icon);
    font-size: 1.25rem;
    line-height: 1.5rem;
    cursor: pointer;
}

.live-toast-invite-action:focus-visible,
.live-toast-invite-dismiss:focus-visible {
    outline: 2px solid var(--color-iui-toast-ring);
    outline-offset: 2px;
}
</style>
