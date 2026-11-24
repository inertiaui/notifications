<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3'
import { NotificationPreferences, usePreferences } from '@inertiaui/notifications-vue'
import { computed } from 'vue'

import Layout from '../Layout.vue'

defineOptions({ layout: Layout })

// The same preferences as the component below, in a form of our own.
const { channels, sections, set, setChannel, receives, isDisabled } = usePreferences()
const switchable = computed(() => channels.value.filter(({ globalSwitch }) => globalSwitch))

const checked = (event: Event): boolean => (event.target as HTMLInputElement).checked
</script>

<template>
    <Head title="Custom preferences" />
    <main class="mx-auto max-w-2xl px-6 py-10">
        <h1 class="text-2xl font-semibold">Custom preferences</h1>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Both forms share the preferences of the <Link href="/preferences" class="underline">Preferences</Link> page.
        </p>

        <section data-demo-custom-preferences class="mt-8">
            <h2 class="font-medium">Built with usePreferences()</h2>
            <div class="mt-3 flex flex-wrap gap-4 text-sm">
                <label v-for="channel in switchable" :key="channel.key" class="flex items-center gap-2 font-medium">
                    <input type="checkbox" :checked="channel.enabled" :data-demo-channel="channel.key" @change="setChannel(channel.key, checked($event))" />
                    All {{ channel.label.toLowerCase() }}
                </label>
            </div>
            <fieldset v-for="section in sections" :key="section.group?.key ?? ''" class="mt-4 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                <legend class="px-1 text-sm font-semibold">{{ section.group?.label ?? 'Other' }}</legend>
                <div v-for="category in section.categories" :key="category.key" class="flex items-center justify-between gap-4 py-1.5 text-sm">
                    <span>{{ category.label }}</span>
                    <span class="flex gap-4">
                        <template v-for="channel in channels" :key="channel.key">
                            <label v-if="category.channels[channel.key] !== undefined" class="flex items-center gap-1.5">
                                <input
                                    type="checkbox"
                                    :checked="receives(category, channel)"
                                    :disabled="isDisabled(category, channel)"
                                    :data-demo-preference="`${category.key}.${channel.key}`"
                                    @change="set(category.key, channel.key, checked($event))"
                                />
                                {{ channel.label }}
                            </label>
                        </template>
                    </span>
                </div>
            </fieldset>
        </section>

        <section class="mt-10">
            <h2 class="font-medium">The component with classes and slots</h2>
            <div class="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                <NotificationPreferences :classes="{ table: 'demo-preferences-table', switch: 'demo-switch aria-checked:bg-emerald-600' }">
                    <template #channel="{ channel }">
                        <span :data-demo-channel-head="channel.key" class="tracking-wide uppercase">{{ channel.label }}</span>
                    </template>
                    <template #group="{ group }">
                        <span :data-demo-group="group.key" class="text-xs font-semibold tracking-wide text-emerald-700 uppercase dark:text-emerald-400">{{
                            group.label
                        }}</span>
                    </template>
                    <template #category="{ category }">
                        <span :data-demo-category="category.key" class="font-medium">{{ category.label }}</span>
                        <span v-if="category.locked" class="ms-2 text-xs text-amber-700 dark:text-amber-400">Required</span>
                    </template>
                </NotificationPreferences>
            </div>
        </section>
    </main>
</template>
