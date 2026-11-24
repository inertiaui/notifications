<script setup lang="ts">
import { Head, Link, router } from '@inertiajs/vue3'
import { inboxStore } from '@inertiaui/notifications-vue'

import { buttonClass } from '../demo'
import Layout from '../Layout.vue'

defineOptions({ layout: Layout })

// With Echo, open panels change by themselves. The demo runs no WebSocket server, so it loads the list again.
const change = (path: string, data: Record<string, string> = {}): void =>
    router.post(path, data, { preserveScroll: true, onSuccess: () => void inboxStore.load() })
</script>

<template>
    <Head title="Lifecycle" />
    <main class="mx-auto max-w-2xl px-6 py-10">
        <h1 class="text-2xl font-semibold">Notification lifecycle</h1>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">Notifications that change after they were sent.</p>

        <section class="mt-10" data-demo="results">
            <h2 class="font-medium">Actions that keep their result</h2>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Send an approval request, then approve or decline it in the bell. The notification shows the result in place of its buttons, also after a reload
                and in your other tabs.
            </p>
            <div class="mt-4 flex flex-wrap gap-2">
                <Link href="/lifecycle" method="post" :data="{ scenario: 'approval' }" as="button" preserve-scroll :class="buttonClass"
                    >Send an approval request</Link
                >
            </div>
        </section>

        <section class="mt-10" data-demo="updates">
            <h2 class="font-medium">Updating and retracting</h2>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Start a build, then let it pass or retract it. The server changes the notification it sent, with Inbox::update() and Inbox::retract().
            </p>
            <div class="mt-4 flex flex-wrap gap-2">
                <Link href="/lifecycle" method="post" :data="{ scenario: 'build' }" as="button" preserve-scroll :class="buttonClass">Start a build</Link>
                <button type="button" :class="buttonClass" @click="change('/lifecycle/build/pass')">Let the build pass</button>
                <button type="button" :class="buttonClass" @click="change('/lifecycle/build/retract')">Retract the build</button>
            </div>
        </section>

        <section class="mt-10" data-demo="collapsing">
            <h2 class="font-medium">Collapsing with actor stacks</h2>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Four people comment on a pull request. With InboxMessage::collapse(), the comments update one notification, which counts once and shows who
                commented. Comment again after reading it, and it comes back as unread.
            </p>
            <div class="mt-4 flex flex-wrap gap-2">
                <button type="button" :class="buttonClass" @click="change('/lifecycle', { scenario: 'comment' })">Four people comment</button>
            </div>
        </section>

        <section class="mt-10" data-demo="muting">
            <h2 class="font-medium">Muting a thread</h2>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Sophie replies in a discussion. Mute the thread with the bell-slash button of the notification, and later replies no longer reach you, unless
                Sophie mentions you. The same button unmutes it.
            </p>
            <div class="mt-4 flex flex-wrap gap-2">
                <button type="button" :class="buttonClass" @click="change('/lifecycle', { scenario: 'reply' })">Sophie replies</button>
                <button type="button" :class="buttonClass" @click="change('/lifecycle', { scenario: 'mention' })">Sophie mentions you</button>
            </div>
        </section>
    </main>
</template>
