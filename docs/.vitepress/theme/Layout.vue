<script setup>
import { Toaster } from '@inertiaui/notifications-vue'
import DefaultTheme from 'vitepress/theme'
</script>

<template>
    <DefaultTheme.Layout>
        <template #layout-bottom>
            <!-- One Toaster for the whole site, so every live example shows its toasts in the same place. -->
            <ClientOnly>
                <Toaster position="bottom-right" />
            </ClientOnly>
        </template>
    </DefaultTheme.Layout>
</template>
