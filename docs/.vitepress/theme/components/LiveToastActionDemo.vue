<script setup>
import { toast } from '@inertiaui/notifications-vue'
import { ref } from 'vue'

import avatar from './live-toast-avatar.jpeg'

const archived = ref(false)

// Stands in for the restore request of the code sample, which the docs cannot send.
const restore = () =>
    new Promise((resolve) =>
        setTimeout(() => {
            archived.value = false
            resolve()
        }, 1000),
    )

function archive() {
    archived.value = true

    toast('Message archived', {
        action: {
            label: 'Undo',
            onClick: restore,
        },
    })
}
</script>

<template>
    <div class="live-toast-inbox">
        <div v-if="!archived" class="live-toast-message">
            <img :src="avatar" alt="" class="live-toast-avatar" />
            <div class="live-toast-message-text">
                <p class="live-toast-message-from">Iris Vale</p>
                <p class="live-toast-message-subject">Q3 planning notes</p>
            </div>
            <button type="button" class="docs-button" @click="archive">Archive</button>
        </div>
        <div v-else class="live-toast-message live-toast-message-empty">
            <p>No messages</p>
            <!-- The way to undo without the toast, as the warning above asks for. -->
            <button type="button" class="docs-button" @click="archived = false">Restore</button>
        </div>
    </div>
</template>

<style scoped>
.live-toast-inbox {
    width: min(100%, 26rem);
}

.live-toast-message {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-height: 4.25rem;
    padding: 0.75rem 1rem;
    border: 1px solid var(--vp-c-divider);
    border-radius: 0.625rem;
    background: var(--vp-c-bg);
}

.live-toast-message-empty {
    justify-content: space-between;
    color: var(--vp-c-text-2);
    font-size: 0.875rem;
}

.live-toast-avatar {
    width: 2.25rem;
    height: 2.25rem;
    flex-shrink: 0;
    border-radius: 9999px;
    object-fit: cover;
}

.live-toast-message-text {
    min-width: 0;
    flex: 1;
}

.live-toast-message-from {
    color: var(--vp-c-text-1);
    font-size: 0.875rem;
    font-weight: 600;
    line-height: 1.25rem;
}

.live-toast-message-subject {
    color: var(--vp-c-text-2);
    font-size: 0.875rem;
    line-height: 1.25rem;
}
</style>
