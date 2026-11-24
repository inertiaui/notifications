<script setup>
import { setTranslations, toast, Toaster } from '@inertiaui/notifications-vue'
import { h } from 'vue'

import LiveToastInvite from './LiveToastInvite.vue'

defineProps({
    example: { type: String, default: 'type' },
})

// The site's Toaster has no icons or type labels, so the deployment toast brings its own icon, and the translation that
// gives every Toaster the label makes screen readers announce "Deployment: Deployed to production".
setTranslations({ toast_type_deployment: 'Deployment' })

// Heroicons (MIT) 20×20 solid rocket launch, as RocketLaunchIcon from @heroicons/vue renders it. An object component,
// because the Toaster ignores a function, such as a functional component, as the `icon` option of a toast.
const RocketLaunchIcon = {
    render: () =>
        h('svg', { viewBox: '0 0 20 20', fill: 'currentColor', 'aria-hidden': 'true' }, [
            h('path', {
                'fill-rule': 'evenodd',
                'clip-rule': 'evenodd',
                d: 'M4.606 12.97a.75.75 0 0 1-.134 1.051 2.494 2.494 0 0 0-.93 2.437 2.494 2.494 0 0 0 2.437-.93.75.75 0 1 1 1.186.918 3.995 3.995 0 0 1-4.482 1.332.75.75 0 0 1-.461-.461 3.994 3.994 0 0 1 1.332-4.482.75.75 0 0 1 1.052.134Z',
            }),
            h('path', {
                'fill-rule': 'evenodd',
                'clip-rule': 'evenodd',
                d: 'M5.752 12A13.07 13.07 0 0 0 8 14.248v4.002c0 .414.336.75.75.75a5 5 0 0 0 4.797-6.414 12.984 12.984 0 0 0 5.45-10.848.75.75 0 0 0-.735-.735 12.984 12.984 0 0 0-10.849 5.45A5 5 0 0 0 1 11.25c.001.414.337.75.751.75h4.002ZM13 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
            }),
        ]),
}

const invite = () =>
    toast('Sophie invited you to Acme', {
        type: 'invite',
        toaster: 'invites',
        data: { inviter: 'Sophie', team: 'Acme', role: 'Editor' },
        // The follow-up shows in the same Toaster as the invite, as it would in an app with one Toaster.
        actions: [{ label: 'Accept', onClick: () => toast.success('You joined Acme', { toaster: 'invites' }) }, { label: 'Decline' }],
    })
</script>

<template>
    <template v-if="example === 'type'">
        <button type="button" class="docs-button" @click="toast('Deployed to production', { type: 'deployment', icon: RocketLaunchIcon })">Deploy</button>
    </template>

    <template v-else-if="example === 'component'">
        <!-- A named Toaster in a corner of its own, as a second Toaster would be in an app, so the site's Toaster keeps its markup. -->
        <Toaster name="invites" position="bottom-left" :components="{ invite: LiveToastInvite }" />
        <button type="button" class="docs-button" @click="invite">Invite</button>
    </template>
</template>
