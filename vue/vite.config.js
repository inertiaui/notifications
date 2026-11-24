import { resolve } from 'path'

import vue from '@vitejs/plugin-vue'
import dts from 'unplugin-dts/vite'
import { defineConfig } from 'vite-plus'

export default defineConfig({
    plugins: [
        vue(),
        dts({
            processor: 'vue',
            bundleTypes: true,
            insertTypesEntry: true,
            tsconfigPath: resolve(import.meta.dirname, 'tsconfig.json'),
        }),
    ],

    build: {
        emptyOutDir: true,
        lib: {
            entry: { 'inertiaui-notifications': resolve(import.meta.dirname, 'src/index.ts') },
            formats: ['es'],
            fileName: (_format, entryName) => `${entryName}.js`,
        },
        rollupOptions: {
            external: ['@inertiajs/core', '@inertiajs/vue3', '@inertiaui/vanilla', 'tailwind-merge', 'vue'],
        },
    },
})
