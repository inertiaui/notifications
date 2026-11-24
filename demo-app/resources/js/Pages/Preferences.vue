<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import { NotificationPreferences } from '@inertiaui/notifications-vue'

import Layout from '../Layout.vue'

defineOptions({ layout: Layout })
</script>

<template>
    <main class="mx-auto max-w-2xl px-6 py-10">
        <h1 class="text-2xl font-semibold">Preferences</h1>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">Choose where each kind of notification reaches you. Changes save right away.</p>
        <div class="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <NotificationPreferences />
        </div>
        <p class="mt-4 text-sm text-gray-600 dark:text-gray-400">
            <Link href="/preferences/custom" class="underline" data-demo-custom-preferences-link>Build your own form with usePreferences()</Link>
        </p>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            <Link href="/digests" class="underline" data-demo-digests-link>See the emails that wait for a digest</Link>
        </p>
    </main>
</template>
