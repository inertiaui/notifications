<script setup>
import { toast, Toaster } from '@inertiaui/notifications-vue'
import { computed, ref } from 'vue'

defineProps({
    example: { type: String, default: 'stacking' },
})

const positions = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right']
// Starts in a corner that no other Toaster on the page uses, so its stack does not cover theirs.
const position = ref('bottom-center')
const expand = ref(false)

const markup = computed(() => `<Toaster position="${position.value}"${expand.value ? ' expand' : ''} />`)

const samples = [
    ['success', 'Invoice sent', 'Sent to billing@laravel.com.'],
    ['info', 'New version available', 'Reload the page to update.'],
    ['default', 'Export queued', 'We will email you the file.'],
    ['warning', 'Storage almost full', '9.6 of 10 GB used.'],
]
let added = 0

function addToast() {
    const [type, title, description] = samples[added % samples.length]
    const round = Math.floor(added++ / samples.length)

    // A number on repeats, so an identical toast does not show a counter instead.
    toast(round === 0 ? title : `${title} (${round + 1})`, { type, description, toaster: 'stacking' })
}
</script>

<template>
    <div v-if="example === 'stacking'" class="live-toaster">
        <Toaster name="stacking" :position="position" :expand="expand" />
        <div class="live-toaster-controls">
            <fieldset class="live-toaster-positions">
                <legend class="live-toaster-label">Position</legend>
                <button
                    v-for="option in positions"
                    :key="option"
                    type="button"
                    class="live-toaster-position"
                    :aria-pressed="position === option"
                    @click="position = option"
                >
                    {{ option }}
                </button>
            </fieldset>
            <div class="live-toaster-actions">
                <label class="live-toaster-expand">
                    <input v-model="expand" type="checkbox" />
                    Expand
                </label>
                <button type="button" class="docs-button" @click="addToast">Add toast</button>
            </div>
        </div>
        <code class="live-toaster-markup">{{ markup }}</code>
    </div>

    <template v-else-if="example === 'named'">
        <Toaster name="uploads" position="bottom-left" />
        <button type="button" class="docs-button" @click="toast.loading('Uploading…', { toaster: 'uploads' })">Upload</button>
    </template>
</template>

<style scoped>
.live-toaster {
    display: grid;
    width: min(100%, 34rem);
    gap: 1rem;
}

.live-toaster-controls {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1rem;
}

.live-toaster-positions {
    display: grid;
    grid-template-columns: repeat(3, auto);
    gap: 0.375rem;
    margin: 0;
    padding: 0;
    border: 0;
}

.live-toaster-label {
    margin-bottom: 0.375rem;
    padding: 0;
    color: var(--vp-c-text-2);
    font-size: 0.75rem;
    font-weight: 500;
}

.live-toaster-position {
    padding: 0.25rem 0.625rem;
    border: 1px solid var(--vp-c-divider);
    border-radius: 0.375rem;
    background: var(--vp-c-bg);
    color: var(--vp-c-text-2);
    font-family: var(--vp-font-family-mono);
    font-size: 0.75rem;
    line-height: 1.25rem;
    cursor: pointer;
}

.live-toaster-position:hover {
    border-color: var(--vp-c-brand-1);
}

.live-toaster-position[aria-pressed='true'] {
    border-color: var(--vp-c-brand-1);
    background: var(--vp-c-brand-soft);
    color: var(--vp-c-brand-1);
}

.live-toaster-position:focus-visible,
.live-toaster-expand input:focus-visible {
    outline: 2px solid var(--vp-c-brand-1);
    outline-offset: 2px;
}

.live-toaster-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.live-toaster-expand {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    color: var(--vp-c-text-1);
    font-size: 0.875rem;
    cursor: pointer;
}

.live-toaster-expand input {
    accent-color: var(--vp-c-brand-1);
}

.live-toaster-markup {
    padding: 0.5rem 0.75rem;
    border-radius: 0.375rem;
    background: var(--vp-c-bg-soft);
    color: var(--vp-c-text-1);
    font-family: var(--vp-font-family-mono);
    font-size: 0.8125rem;
}
</style>
