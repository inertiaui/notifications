<script setup lang="ts">
import { Link, usePage } from '@inertiajs/vue3'
import { NotificationCenter, Toaster } from '@inertiaui/notifications-vue'
import { h } from 'vue'

import { deploymentIconPath, navLinkClass } from './demo'
import InviteToast from './InviteToast.vue'
import { aboveModals } from './moreToasts'

const page = usePage()
const DeploymentIcon = () =>
    h('svg', { viewBox: '0 0 20 20', fill: 'currentColor', class: 'size-5', 'aria-hidden': 'true' }, [h('path', { d: deploymentIconPath })])
</script>

<template>
    <header class="border-b border-gray-200 dark:border-gray-800">
        <div class="mx-auto flex max-w-2xl items-center justify-between px-6 py-2">
            <nav class="-ms-2 flex gap-2" aria-label="Demo">
                <Link href="/" :aria-current="page.url === '/' ? 'page' : undefined" :class="navLinkClass">Toasts</Link>
                <Link href="/more-toasts" :aria-current="page.url === '/more-toasts' ? 'page' : undefined" :class="navLinkClass">More toasts</Link>
                <Link href="/inbox" :aria-current="page.url.startsWith('/inbox') ? 'page' : undefined" :class="navLinkClass">Inbox</Link>
                <Link href="/preferences" :aria-current="page.url === '/preferences' ? 'page' : undefined" :class="navLinkClass">Preferences</Link>
                <Link href="/alerts" :aria-current="page.url === '/alerts' ? 'page' : undefined" :class="navLinkClass">Alerts</Link>
                <Link href="/notification-center" :aria-current="page.url === '/notification-center' ? 'page' : undefined" :class="navLinkClass">Center</Link>
                <Link href="/lifecycle" :aria-current="page.url === '/lifecycle' ? 'page' : undefined" :class="navLinkClass">Lifecycle</Link>
            </nav>
            <NotificationCenter href="/inbox" />
        </div>
    </header>
    <slot />
    <Toaster
        progress
        :icons="{ deployment: DeploymentIcon }"
        :type-labels="{ deployment: 'Deployment' }"
        :components="{ invite: InviteToast }"
        :above-modals="aboveModals(page.url)"
    />
</template>
