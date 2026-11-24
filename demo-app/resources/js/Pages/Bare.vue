<script setup lang="ts">
import { Link } from '@inertiajs/vue3'

import { buttonClass } from '../demo'
</script>

<template>
    <main class="mx-auto max-w-2xl px-6 py-16">
        <h1 class="text-2xl font-semibold">Page without a Toaster</h1>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">Toasts flashed here show on the next page that renders a Toaster.</p>
        <div class="mt-6 flex flex-wrap gap-2">
            <Link href="/toasts" method="post" :data="{ scenario: 'success' }" as="button" :class="buttonClass">Flash a toast</Link>
            <Link href="/" :class="buttonClass">Back to the demo</Link>
        </div>
    </main>
</template>
