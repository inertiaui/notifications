<script setup>
import { toast } from '@inertiaui/notifications-vue'
import { ref } from 'vue'

defineProps({
    example: { type: String, default: 'basic' },
})

// Stands in for the work of the code samples, which the docs cannot do.
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function uploadFiles() {
    const id = toast.loading('Uploading 1 of 3 files…', { dismissible: false })

    await wait(1200)
    toast.update(id, { title: 'Uploading 2 of 3 files…' })

    await wait(1200)
    toast.update(id, { title: 'Uploading 3 of 3 files…' })

    await wait(1200)
    toast.success('3 files uploaded', { id, dismissible: true })
}

// The open sync toasts, newest last, so "Dismiss it" closes the newest one by its ID.
const syncIds = ref([])
const sources = ['calendar', 'contacts', 'files']
let syncs = 0

function startSync() {
    const title = `Syncing ${sources[syncs++ % sources.length]}…`
    const id = toast.loading(title, { onClose: () => (syncIds.value = syncIds.value.filter((open) => open !== id)) })

    syncIds.value = [...syncIds.value, id]
}

const dismissSync = () => toast.dismiss(syncIds.value.at(-1))

const buildReport = (fails) => wait(2000).then(() => (fails ? Promise.reject(new Error('Timed out')) : { name: 'Q3 revenue report' }))

const trackReport = (fails) =>
    toast.promise(buildReport(fails), {
        loading: 'Building report…',
        success: (report) => `${report.name} is ready`,
        error: 'Could not build the report',
    })
</script>

<template>
    <template v-if="example === 'basic'">
        <button type="button" class="docs-button" @click="toast('Export queued')">Default</button>
        <button type="button" class="docs-button" @click="toast.success('Link copied', { description: 'Share it with your team.' })">Success</button>
        <button type="button" class="docs-button" @click="toast.error('Upload failed')">Error</button>
    </template>

    <template v-else-if="example === 'types'">
        <button type="button" class="docs-button" @click="toast('Export queued')">Default</button>
        <button type="button" class="docs-button" @click="toast.info('New version available')">Info</button>
        <button type="button" class="docs-button" @click="toast.success('Profile saved')">Success</button>
        <button type="button" class="docs-button" @click="toast.warning('Storage almost full')">Warning</button>
        <button type="button" class="docs-button" @click="toast.error('Payment failed')">Error</button>
        <button type="button" class="docs-button" @click="toast.loading('Importing contacts…')">Loading</button>
    </template>

    <template v-else-if="example === 'update'">
        <button type="button" class="docs-button" @click="uploadFiles">Upload 3 files</button>
    </template>

    <template v-else-if="example === 'dismiss'">
        <button type="button" class="docs-button" @click="startSync">Start sync</button>
        <button type="button" class="docs-button" :disabled="syncIds.length === 0" @click="dismissSync">Dismiss it</button>
        <button type="button" class="docs-button" @click="toast.dismiss()">Dismiss all</button>
    </template>

    <template v-else-if="example === 'promise'">
        <button type="button" class="docs-button" @click="trackReport(false)">Build report</button>
        <button type="button" class="docs-button" @click="trackReport(true)">Build report (fails)</button>
    </template>
</template>

<style scoped>
.docs-button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
}

.docs-button:disabled:hover {
    border-color: var(--vp-c-divider);
}
</style>
