<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import { useToasts } from '@inertiaui/notifications-vue'
import { computed } from 'vue'

import { buttonClass } from '../demo'

const { toasts, toast, dismiss, pause, resume, timer, runAction } = useToasts()
const shown = computed(() => toasts.value.filter((item) => item.state !== 'queued'))
</script>

<template>
    <div>
        <main class="mx-auto max-w-2xl px-6 py-16">
            <h1 class="text-2xl font-semibold">Your own Toaster</h1>
            <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">This page renders its toasts with useToasts() instead of the Toaster component.</p>
            <div class="mt-6 flex flex-wrap gap-2">
                <button type="button" :class="buttonClass" @click="toast.success('Link copied', { duration: 2000 })">Show a toast</button>
                <Link href="/toasts" method="post" :data="{ scenario: 'action' }" as="button" preserve-scroll :class="buttonClass">Flash from Laravel</Link>
                <Link href="/" :class="buttonClass">Back to the demo</Link>
            </div>
        </main>
        <ol
            data-custom-toaster
            aria-live="polite"
            class="fixed inset-x-0 top-4 mx-auto flex w-full max-w-sm flex-col gap-2 px-4"
            @pointerenter="pause('hover')"
            @pointerleave="resume('hover')"
        >
            <li
                v-for="item in shown"
                :key="item.id"
                :data-state="item.state"
                class="flex items-center gap-3 rounded-lg bg-gray-900 px-4 py-3 text-sm text-white shadow-lg transition-opacity data-[state=closing]:opacity-0 dark:bg-white dark:text-gray-900"
            >
                <p class="flex-1">
                    <span class="font-medium">{{ item.title }}</span>
                    <span v-if="item.description" class="block opacity-70">{{ item.description }}</span>
                </p>
                <span v-if="timer(item.id)?.running === false" class="text-xs opacity-70">Paused</span>
                <button v-for="(action, index) in item.actions" :key="index" type="button" class="font-medium underline" @click="runAction(item.id, index)">
                    {{ action.label }}
                </button>
                <button
                    v-if="item.dismissible"
                    type="button"
                    :aria-label="`Dismiss: ${item.title}`"
                    class="opacity-70 hover:opacity-100"
                    @click="dismiss(item.id, 'user')"
                >
                    ✕
                </button>
            </li>
        </ol>
    </div>
</template>
