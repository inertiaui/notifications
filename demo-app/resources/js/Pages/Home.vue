<script setup lang="ts">
import { Link, router, useHttp } from '@inertiajs/vue3'
import { toast } from '@inertiaui/notifications-vue'
import { ref } from 'vue'

import { announcementScenarios, browserDemos, buttonClass, notificationScenarios, scenarios, serverRequests } from '../demo'
import Layout from '../Layout.vue'

defineOptions({ layout: Layout })

const demos = browserDemos(toast, router)
const archive = useHttp({})
const failing = useHttp({})
const dialog = ref<HTMLDialogElement>()
</script>

<template>
    <main class="mx-auto max-w-2xl px-6 py-16">
        <h1 class="text-2xl font-semibold">Inertia Notifications</h1>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">Vue stack</p>

        <section class="mt-10">
            <h2 class="font-medium">Flashed from Laravel</h2>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">Each button posts to the server, which flashes toasts and redirects back.</p>
            <div class="mt-4 flex flex-wrap gap-2">
                <Link
                    v-for="{ scenario, label } in scenarios"
                    :key="scenario"
                    href="/toasts"
                    method="post"
                    :data="{ scenario }"
                    as="button"
                    preserve-scroll
                    :class="buttonClass"
                >
                    {{ label }}
                </Link>
                <Link v-for="{ href, label } in serverRequests" :key="href" :href="href" method="post" as="button" preserve-scroll :class="buttonClass">
                    {{ label }}
                </Link>
                <button type="button" :class="buttonClass" @click="archive.post('/api/archive')">JSON endpoint</button>
                <button type="button" :class="buttonClass" @click="failing.post('/errors/500')">500 from useHttp</button>
            </div>
        </section>

        <section class="mt-10">
            <h2 class="font-medium">Notification center</h2>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Each button sends a Laravel notification through the inbox channel. Open the bell to see it.
            </p>
            <div class="mt-4 flex flex-wrap gap-2">
                <Link
                    v-for="{ scenario, label } in notificationScenarios"
                    :key="scenario"
                    href="/notifications"
                    method="post"
                    :data="{ scenario }"
                    as="button"
                    preserve-scroll
                    :class="buttonClass"
                >
                    {{ label }}
                </Link>
            </div>
        </section>

        <section class="mt-10" data-demo="announcements">
            <h2 class="font-medium">Announcements</h2>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Each button publishes one announcement, stored once for every user. It shows in the bell with a megaphone.
            </p>
            <div class="mt-4 flex flex-wrap gap-2">
                <Link
                    v-for="{ scenario, label } in announcementScenarios"
                    :key="scenario"
                    href="/announcements"
                    method="post"
                    :data="{ scenario }"
                    :data-demo-announcement="scenario"
                    as="button"
                    preserve-scroll
                    :class="buttonClass"
                >
                    {{ label }}
                </Link>
            </div>
        </section>

        <section class="mt-10">
            <h2 class="font-medium">From the browser</h2>
            <div class="mt-4 flex flex-wrap gap-2">
                <button v-for="demo in demos" :key="demo.label" type="button" :class="buttonClass" @click="demo.run()">{{ demo.label }}</button>
                <button type="button" :class="buttonClass" @click="dialog?.showModal()">Open a modal dialog</button>
            </div>
        </section>

        <section class="mt-10">
            <h2 class="font-medium">Delivery</h2>
            <div class="mt-4 flex flex-wrap gap-2">
                <a href="/welcome" :class="buttonClass">Full page load</a>
                <Link href="/deferred" :class="buttonClass">Deferred prop</Link>
                <Link href="/bare" :class="buttonClass">Page without a Toaster</Link>
                <Link href="/custom-toaster" :class="buttonClass">Your own Toaster</Link>
            </div>
        </section>

        <dialog ref="dialog" class="m-auto w-full max-w-md rounded-lg p-6 shadow-xl backdrop:bg-black/40 dark:bg-gray-900 dark:text-gray-100">
            <h2 class="font-medium">A modal dialog</h2>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">Everything outside a modal dialog is inert. The toasts move inside it while it is open.</p>
            <div class="mt-4 flex gap-2">
                <button type="button" :class="buttonClass" @click="toast('Shown inside the dialog', { action: { label: 'Got it', onClick: () => {} } })">
                    Toast from the dialog
                </button>
                <button type="button" :class="buttonClass" @click="dialog?.close()">Close dialog</button>
            </div>
        </dialog>
    </main>
</template>
