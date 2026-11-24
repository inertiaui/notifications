<script setup lang="ts">
import { Link, router } from '@inertiajs/vue3'
import { toast } from '@inertiaui/notifications-vue'
import { DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle, DialogTrigger } from 'reka-ui'
import { h, ref } from 'vue'

import { buttonClass, deploymentIconPath } from '../demo'
import Layout from '../Layout.vue'
import { browserInvite, dialogContentClass, dialogOverlayClass, otherType, toastWithUndo, trackUpload, uploadInSteps } from '../moreToasts'

defineOptions({ layout: Layout })

// A functional component, like the Vue icons of Heroicons.
const ReleaseIcon = () =>
    h('svg', { viewBox: '0 0 20 20', fill: 'currentColor', class: 'size-5', 'aria-hidden': 'true', 'data-demo-icon': 'release' }, [
        h('path', { d: deploymentIconPath }),
    ])

const undone = ref(0)
</script>

<template>
    <main class="mx-auto max-w-2xl px-6 py-16">
        <h1 class="text-2xl font-semibold">More toasts</h1>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">Vue stack</p>

        <section class="mt-10">
            <h2 class="font-medium">A component per type</h2>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                The Toaster renders <code>invite</code> toasts with a component of the app, which reads the toast's data. Other types keep the default markup.
            </p>
            <div class="mt-4 flex flex-wrap gap-2">
                <Link href="/more-toasts" method="post" :data="{ scenario: 'invite' }" as="button" preserve-scroll :class="buttonClass"
                    >Flash an invitation</Link
                >
                <button type="button" :class="buttonClass" @click="toast(browserInvite.title, browserInvite.options)">Invitation from the browser</button>
                <button type="button" :class="buttonClass" @click="toast.success(otherType.title, otherType.options)">Another type</button>
            </div>
        </section>

        <section class="mt-10">
            <h2 class="font-medium">Progress</h2>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">A toast with a progress shows a bar that screen readers read as a percentage.</p>
            <div class="mt-4 flex flex-wrap gap-2">
                <button type="button" :class="buttonClass" @click="uploadInSteps(toast)">Upload in steps</button>
                <button type="button" :class="buttonClass" @click="trackUpload(toast, router)">Track an upload</button>
                <Link href="/more-toasts" method="post" :data="{ scenario: 'import' }" as="button" preserve-scroll :class="buttonClass">Flash an import</Link>
            </div>
        </section>

        <section class="mt-10">
            <h2 class="font-medium">Avatars</h2>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                A toast with an image shows it in place of the icon, such as the avatar of a person. A toast may also bring its own icon component.
            </p>
            <div class="mt-4 flex flex-wrap gap-2">
                <Link href="/more-toasts" method="post" :data="{ scenario: 'comment' }" as="button" preserve-scroll :class="buttonClass">Flash a comment</Link>
                <button type="button" :class="buttonClass" @click="toast.success('Release published', { icon: ReleaseIcon })">Toast with its own icon</button>
            </div>
        </section>

        <section class="mt-10">
            <h2 class="font-medium">Dialogs</h2>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Toasts stay usable above a Reka dialog and the notification center's panel: their actions run, and the dialog stays open. Undone: {{ undone }}
            </p>
            <div class="mt-4 flex flex-wrap gap-2">
                <DialogRoot>
                    <DialogTrigger :class="buttonClass">Open a dialog</DialogTrigger>
                    <DialogPortal>
                        <DialogOverlay :class="dialogOverlayClass" />
                        <DialogContent :class="dialogContentClass">
                            <DialogTitle class="font-medium">Edit profile</DialogTitle>
                            <DialogDescription class="mt-1 text-sm text-gray-600 dark:text-gray-400"
                                >Save to show a toast with an action above this dialog.</DialogDescription
                            >
                            <p class="mt-4 text-sm">Undone: {{ undone }}</p>
                            <div class="mt-6 flex justify-end gap-2">
                                <DialogClose :class="buttonClass">Close</DialogClose>
                                <button type="button" :class="buttonClass" @click="toastWithUndo(toast, 'Profile saved', () => undone++)">Save</button>
                            </div>
                        </DialogContent>
                    </DialogPortal>
                </DialogRoot>
                <button type="button" :class="buttonClass" @click="toastWithUndo(toast, 'Draft saved', () => undone++)">Show a toast that stays</button>
            </div>
        </section>
    </main>
</template>
