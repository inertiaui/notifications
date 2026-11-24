<script setup lang="ts">
import { NotificationList } from '@inertiaui/notifications-vue'

import Layout from '../Layout.vue'

defineOptions({ layout: Layout })
</script>

<template>
    <main class="mx-auto max-w-2xl px-6 py-10">
        <h1 class="text-2xl font-semibold">Inbox</h1>
        <div class="mt-6 rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <NotificationList data="notifications" />
        </div>
    </main>
</template>
