<script setup>
import { toast, Toaster } from '@inertiaui/notifications-vue'
import { h } from 'vue'

import avatar from './live-toast-avatar.jpeg'

defineProps({
    example: { type: String, default: 'duration' },
})

// Heroicons (MIT) 20×20 solid clipboard, the icon that the "sidebar" Toaster has for the name `clipboard`.
const ClipboardIcon = () =>
    h('svg', { viewBox: '0 0 20 20', fill: 'currentColor', 'aria-hidden': 'true' }, [
        h('path', {
            'fill-rule': 'evenodd',
            'clip-rule': 'evenodd',
            d: 'M13.887 3.182c.396.037.79.08 1.183.128C16.194 3.45 17 4.414 17 5.517V16.75A2.25 2.25 0 0 1 14.75 19h-9.5A2.25 2.25 0 0 1 3 16.75V5.517c0-1.103.806-2.068 1.93-2.207.393-.048.787-.09 1.183-.128A3.001 3.001 0 0 1 9 1h2c1.373 0 2.531.923 2.887 2.182ZM7.5 4A1.5 1.5 0 0 1 9 2.5h2A1.5 1.5 0 0 1 12.5 4v.5h-5V4Z',
        }),
    ])

let imports = 0

// Each step stands in for a request that flashes the toast again with the same ID.
function importContacts() {
    const id = `import-${++imports}`
    const total = 240
    let processed = 0

    const flash = () => {
        if (processed > total) {
            toast.success('Contacts imported', { id })

            return
        }

        toast.loading('Importing contacts…', { id, description: `${processed} of ${total} contacts`, progress: processed / total })
        processed += 60
        setTimeout(flash, 900)
    }

    flash()
}
</script>

<template>
    <template v-if="example === 'duration'">
        <button type="button" class="docs-button" @click="toast.info('Backup complete', { duration: 10_000 })">Ten seconds</button>
        <button type="button" class="docs-button" @click="toast.warning('Verify your email address', { duration: null })">Persistent</button>
    </template>

    <template v-else-if="example === 'progress'">
        <button type="button" class="docs-button" @click="importContacts">Import contacts</button>
    </template>

    <template v-else-if="example === 'image'">
        <button
            type="button"
            class="docs-button"
            @click="toast.info('Iris Vale commented', { description: 'Looks great, let\'s ship it on Friday.', image: avatar })"
        >
            New comment
        </button>
    </template>

    <template v-else-if="example === 'other'">
        <Toaster name="sidebar" :icons="{ clipboard: ClipboardIcon }" />
        <button
            type="button"
            class="docs-button"
            @click="toast.info('Copied', { icon: 'clipboard', dismissible: false, position: 'top-center', toaster: 'sidebar' })"
        >
            Show toast
        </button>
    </template>
</template>
