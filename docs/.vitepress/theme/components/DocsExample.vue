<script setup>
defineProps({
    label: { type: String, default: 'Live example' },
})
</script>

<template>
    <!-- vp-raw keeps the VitePress content styles off the package's own markup. -->
    <section class="vp-raw docs-example" :aria-label="label">
        <ClientOnly>
            <slot />
        </ClientOnly>
    </section>
</template>

<style scoped>
.docs-example {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    margin: 1.5rem 0 2rem;
    min-height: 7.5rem;
    padding: 1.5rem;
    border: 1px solid var(--vp-c-divider);
    border-radius: 0.875rem;
    background: var(--vp-c-bg-elv);
    box-shadow: 0 1px 2px rgb(15 23 42 / 0.04);
}

/* An example directly above a code block shares its border, so the two read as one. */
:global(.vp-doc .docs-example:has(+ div[class*='language-'])),
:global(.vp-doc .docs-example:has(+ .vp-code-group)) {
    margin-bottom: 0;
    border-bottom-right-radius: 0;
    border-bottom-left-radius: 0;
}

:global(.vp-doc .docs-example + div[class*='language-']),
:global(.vp-doc .docs-example + .vp-code-group),
:global(.vp-doc .docs-example + .vp-code-group .tabs) {
    margin-top: 0;
    border-top-right-radius: 0;
    border-top-left-radius: 0;
}
</style>
