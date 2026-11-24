<script setup>
import { NotificationPreferences } from '@inertiaui/notifications-vue'

import { installDemoPreferences } from '../examples/inbox.js'

const props = defineProps({
    example: { type: String, default: 'setup' },
})

installDemoPreferences({ notificationHours: props.example === 'notification-hours' })
</script>

<template>
    <div class="card">
        <NotificationPreferences v-if="example === 'classes'" :classes="{ table: 'text-base', switch: 'aria-checked:bg-emerald-600' }" />
        <NotificationPreferences v-else />
    </div>
</template>

<style scoped>
.card {
    width: 100%;
    overflow-x: auto;
    border: 1px solid var(--vp-c-divider);
    border-radius: 0.5rem;
    background: var(--vp-c-bg);
    color: var(--vp-c-text-1);
}
</style>
