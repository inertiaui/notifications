<script setup lang="ts">
import { NotificationCenter, type InboxItem, type ToastAction } from '@inertiaui/notifications-vue'
import { ref } from 'vue'

import { buttonClass } from '../demo'
import Layout from '../Layout.vue'

defineOptions({ layout: Layout })

const open = ref(false)
const log = ref<string[]>([])

// Keeps the panel from opening the notification, so the page stays.
const onItemClick = (item: InboxItem, event: MouseEvent): void => {
    event.preventDefault()
    log.value = [...log.value, `Clicked ${item.title}`]
}

const onAction = (item: InboxItem, action: ToastAction<InboxItem>): void => {
    log.value = [...log.value, `Ran ${action.label}`]
}
</script>

<template>
    <main class="mx-auto max-w-2xl px-6 py-10">
        <h1 class="text-2xl font-semibold">Notification center</h1>

        <section class="mt-8" aria-labelledby="placement">
            <h2 id="placement" class="text-lg font-semibold">Placement</h2>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                The bell in this sidebar opens its panel to the right. The bell at the bottom of the screen opens its panel above itself, because there is no
                room below.
            </p>
            <div class="mt-4 flex h-48 overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                <aside data-demo="placement-right" class="flex w-14 flex-col items-center border-e border-gray-200 py-2 dark:border-gray-800">
                    <NotificationCenter placement="right-start" />
                </aside>
                <p class="p-4 text-sm text-gray-500">Page content</p>
            </div>
        </section>

        <section class="mt-10" aria-labelledby="custom">
            <h2 id="custom" class="text-lg font-semibold">Slots and events</h2>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                This bell has its own badge, header, error, and footer. Clicking a notification only logs it, and the button opens the panel from outside.
            </p>
            <div class="mt-4 flex items-center gap-3">
                <div data-demo="custom">
                    <NotificationCenter v-model:open="open" @item-click="onItemClick" @action="onAction">
                        <template #badge="{ text }">
                            <span
                                data-inbox-badge
                                data-demo-badge
                                aria-hidden="true"
                                class="absolute -inset-e-1 -top-1 rounded-md bg-emerald-600 px-1 text-[0.6875rem]/4 font-semibold text-white"
                            >
                                {{ text }}
                            </span>
                        </template>
                        <template #header="{ titleId, title, unread, markAllAsRead, close }">
                            <div class="flex items-center justify-between gap-3 bg-emerald-50 px-4 py-3 dark:bg-emerald-950">
                                <h2 :id="titleId" class="text-base font-semibold">{{ title }}: {{ unread }} unread</h2>
                                <div class="flex gap-3 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                                    <button type="button" data-demo-read-all @click="markAllAsRead">Read all</button>
                                    <button type="button" data-demo-close @click="close">Close</button>
                                </div>
                            </div>
                        </template>
                        <template #error="{ retry }">
                            <p data-demo-error>The inbox is out of reach.</p>
                            <button type="button" data-demo-retry class="text-sm font-medium underline" @click="retry">Reload</button>
                        </template>
                        <template #footer>
                            <button
                                type="button"
                                data-demo-footer
                                class="border-t border-gray-200 px-4 py-2.5 text-sm font-medium dark:border-gray-800"
                                @click="open = false"
                            >
                                Done
                            </button>
                        </template>
                    </NotificationCenter>
                </div>
                <button type="button" data-demo="open-custom" :class="buttonClass" @click="open = true">
                    {{ open ? 'The panel is open' : 'Open the panel' }}
                </button>
            </div>
            <ul data-demo-log class="mt-3 text-sm text-gray-600 dark:text-gray-400">
                <li v-for="(entry, index) in log" :key="index">{{ entry }}</li>
            </ul>
        </section>

        <div
            data-demo="placement-flip"
            class="fixed inset-s-4 bottom-4 rounded-full border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"
        >
            <NotificationCenter placement="bottom-start" />
        </div>
    </main>
</template>
