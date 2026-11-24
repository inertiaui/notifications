<script setup lang="ts">
// A built-in icon, which the component's `icons` prop, its `iconResolver` prop, or the global resolver may replace.
import { computed, type Component } from 'vue'

import { customIcon, type IconContext } from '../../js/iconResolver'
import { builtInIcons, own, spinnerArc } from '../../js/icons'
import type { IconResolverFn } from './iconResolver'

const props = withDefaults(
    defineProps<{
        /** The name of a built-in icon, such as `bell` or `spinner`. */
        name: string
        context: IconContext
        icons?: Record<string, Component>
        resolver?: IconResolverFn | null
    }>(),
    { icons: () => ({}), resolver: undefined },
)

const custom = computed(() => customIcon<Component | string>(props.name, props.context, props.icons, props.resolver))
</script>

<template>
    <component :is="custom" v-if="custom" aria-hidden="true" />
    <svg v-else-if="props.name === 'spinner'" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <circle cx="10" cy="10" r="7" opacity="0.25" />
        <path :d="spinnerArc" stroke-linecap="round" />
    </svg>
    <svg v-else viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path v-for="path in own(builtInIcons, props.name)" :key="path" fill-rule="evenodd" clip-rule="evenodd" :d="path" />
    </svg>
</template>
