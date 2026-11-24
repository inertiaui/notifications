<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3'
import { NotificationPreferences } from '@inertiaui/notifications-vue'

import { buttonClass, digestScenarios, digestSendTime } from '../demo'
import Layout from '../Layout.vue'

defineOptions({ layout: Layout })

defineProps<{
    held: { id: number; title: string; category: string; sendAt: string }[]
    digest: string | null
}>()
</script>

<template>
    <Head title="Digests" />
    <main class="mx-auto max-w-2xl px-6 py-10">
        <h1 class="text-2xl font-semibold">Digests</h1>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Choose an hourly, daily, or weekly digest for a category, or turn on notification hours. Notifications still arrive in the bell right away, and
            their emails wait for the next digest in your timezone, or until your notification hours start.
        </p>
        <div class="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <NotificationPreferences />
        </div>
        <div class="mt-6 flex flex-wrap gap-2">
            <Link
                v-for="scenario in digestScenarios"
                :key="scenario.scenario"
                href="/digests/notifications"
                method="post"
                :data="{ scenario: scenario.scenario }"
                as="button"
                preserve-scroll
                :data-demo-digest-scenario="scenario.scenario"
                :class="buttonClass"
                >{{ scenario.label }}</Link
            >
        </div>

        <section class="mt-10" data-demo-held>
            <h2 class="font-medium">Waiting for the digest</h2>
            <p v-if="held.length === 0" class="mt-1 text-sm text-gray-600 dark:text-gray-400">No emails are waiting.</p>
            <ul v-else class="mt-3 divide-y divide-gray-200 rounded-lg border border-gray-200 text-sm dark:divide-gray-800 dark:border-gray-800">
                <li v-for="item in held" :key="item.id" data-demo-held-item class="flex justify-between gap-4 px-4 py-3">
                    <span>{{ item.title }}</span>
                    <span class="shrink-0 text-gray-600 dark:text-gray-400">{{ digestSendTime(item.sendAt) }}</span>
                </li>
            </ul>
            <div class="mt-4">
                <Link href="/digests/send" method="post" as="button" preserve-scroll data-demo-send-digest :class="buttonClass">Send the digest now</Link>
            </div>
        </section>

        <section v-if="digest" class="mt-10">
            <h2 class="font-medium">The digest email</h2>
            <iframe :srcdoc="digest" title="The digest email" data-demo-digest class="mt-3 h-144 w-full rounded-lg border border-gray-200 bg-white" />
        </section>
    </main>
</template>
