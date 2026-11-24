<script setup>
import { NotificationCenter, initNotifications, toast } from '@inertiaui/notifications-vue'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { installDemoInbox, sendDemoNotification } from '../examples/inbox.js'

const props = defineProps({
    example: { type: String, default: 'setup' },
})

// The config of each example, as the code below it sets the `inbox.category_filter` option.
installDemoInbox(
    {
        categories: { categoryFilter: { comments: 'Comments', billing: 'Billing', deployments: 'Deployments' } },
    }[props.example] ?? {},
)

const open = ref(false)

// The props of the bell, as the code below each example passes them.
const bell = computed(() => ({ setup: { href: '/notifications' }, placement: { placement: 'right-start' } })[props.example] ?? {})

// The page with every notification is not part of the docs, so its link tells where it goes instead of visiting it.
const onClick = (event) => {
    if (event.target instanceof Element && event.target.closest('[data-inbox-view-all]')) {
        event.preventDefault()
        open.value = false
        toast('This link visits /notifications in your app.')
    }
}

// The tab title example shows the count in the title while it is on the page, and the title in the example.
const title = ref('')
let observer

onMounted(() => {
    if (props.example === 'title-count') {
        initNotifications({ inbox: { titleCount: true } })
        title.value = document.title
        observer = new MutationObserver(() => (title.value = document.title))
        observer.observe(document.head, { childList: true, subtree: true, characterData: true })
    }
})

onBeforeUnmount(() => {
    if (props.example === 'title-count') {
        observer?.disconnect()
        initNotifications({ inbox: { titleCount: false } })
    }
})
</script>

<template>
    <div class="app" :class="{ 'app--sidebar': example === 'placement' }" @click.capture="onClick">
        <component :is="example === 'placement' ? 'aside' : 'header'" class="app-bar">
            <span class="app-brand">
                <span class="app-logo" aria-hidden="true">A</span>
                <span class="app-name">Acme</span>
            </span>
            <NotificationCenter v-model:open="open" v-bind="bell" />
        </component>
        <div v-if="example !== 'setup' && example !== 'categories'" class="app-body">
            <p v-if="example === 'placement'" class="app-heading">Dashboard</p>
            <button v-if="example === 'open'" type="button" class="docs-button" @click="open = true">Show notifications</button>
            <button
                v-if="example === 'realtime' || example === 'title-count' || example === 'pause'"
                type="button"
                class="docs-button"
                @click="sendDemoNotification()"
            >
                Send a notification
            </button>
            <p v-if="example === 'title-count'" class="app-title">Tab title: <code>{{ title }}</code></p>
        </div>
    </div>
</template>

<style scoped>
.app {
    display: flex;
    flex-direction: column;
    width: 100%;
    border: 1px solid var(--vp-c-divider);
    border-radius: 0.75rem;
    background: var(--vp-c-bg);
    color: var(--vp-c-text-1);
}

.app--sidebar {
    flex-direction: row;
    min-height: 10rem;
}

.app-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.5rem 0.5rem 0.5rem 1rem;
}

.app--sidebar .app-bar {
    flex-direction: column;
    justify-content: flex-start;
    padding: 0.75rem 0.5rem;
    border-right: 1px solid var(--vp-c-divider);
}

.app-bar:not(:last-child) {
    border-bottom: 1px solid var(--vp-c-divider);
}

.app--sidebar .app-bar:not(:last-child) {
    border-bottom: 0;
}

.app-brand {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
}

.app-logo {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 0.5rem;
    background: var(--vp-c-brand-1);
    color: var(--vp-c-bg);
    font-size: 0.8125rem;
}

.app--sidebar .app-name {
    display: none;
}

/* The controls start on the left, so the panel, which opens below the bell on the right, leaves them in view. */
.app-body {
    display: flex;
    flex: 1;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    padding: 1.25rem 1rem;
}

.app--sidebar .app-body {
    align-items: flex-start;
}

.app-heading {
    font-size: 0.875rem;
    font-weight: 600;
}

.app-title {
    flex-basis: 100%;
    color: var(--vp-c-text-2);
    font-size: 0.8125rem;
}

.app-title code {
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    background: var(--vp-c-default-soft);
    color: var(--vp-c-text-1);
    font-family: var(--vp-font-family-mono);
}
</style>
