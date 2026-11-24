<script setup lang="ts">
import { Head, Link, router } from '@inertiajs/vue3'
import { inboxStore, requestNotificationPermission } from '@inertiaui/notifications-vue'
import { onMounted, onUnmounted, ref } from 'vue'

import { buttonClass, notificationPermission, sendLater, watchTitle } from '../demo'
import Layout from '../Layout.vue'

defineOptions({ layout: Layout })

const title = ref('')
const permission = ref(notificationPermission())
let stopWatching = (): void => {}

onMounted(() => (stopWatching = watchTitle((value) => (title.value = value))))
onUnmounted(() => stopWatching())

const turnOnDesktopNotifications = async (): Promise<void> => void (permission.value = await requestNotificationPermission())
</script>

<template>
    <Head title="Browser alerts" />
    <main class="mx-auto max-w-2xl px-6 py-10">
        <h1 class="text-2xl font-semibold">Browser alerts</h1>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">Reach users who are in another tab. The demo turns on each alert in initNotifications().</p>

        <section class="mt-10">
            <h2 class="font-medium">Tab title</h2>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                The title of every tab starts with the number of unread notifications. Send one, then read it in the bell.
            </p>
            <p class="mt-4 text-sm">This tab's title: <span data-demo-title class="font-medium">{{ title }}</span></p>
            <div class="mt-4 flex flex-wrap gap-2">
                <Link href="/notifications" method="post" :data="{ scenario: 'comment' }" as="button" preserve-scroll :class="buttonClass"
                    >Send a notification</Link
                >
            </div>
        </section>

        <section class="mt-10">
            <h2 class="font-medium">App badge</h2>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Install the demo as an app, and its icon shows the number of unread notifications in browsers that support badges.
            </p>
        </section>

        <section class="mt-10">
            <h2 class="font-medium">Desktop notifications</h2>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Send a notification, then switch to another tab or application within five seconds. The demo tab you looked at last shows a desktop
                notification. Click it to come back and open the notification.
            </p>
            <p class="mt-4 text-sm">Permission: <span data-demo-permission class="font-medium">{{ permission }}</span></p>
            <div class="mt-4 flex flex-wrap gap-2">
                <button type="button" :class="buttonClass" @click="turnOnDesktopNotifications()">Turn on desktop notifications</button>
                <button type="button" :class="buttonClass" @click="sendLater(router, inboxStore.receive)">Send a notification in 5 seconds</button>
            </div>
        </section>

        <section class="mt-10">
            <h2 class="font-medium">Sound</h2>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                The demo tab you looked at last plays a chime for each notification that arrives. Browsers only play sound in a tab you clicked in, so click
                anywhere on this page before you send one.
            </p>
        </section>
    </main>
</template>
