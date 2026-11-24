import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import laravel from 'laravel-vite-plugin'
import { defineConfig } from 'vite-plus'

export default defineConfig({
    cacheDir: 'node_modules/.vite/vue',

    resolve: {
        dedupe: ['vue', '@inertiajs/core', '@inertiajs/vue3'],
    },

    plugins: [
        laravel({
            input: 'resources/js/app.ts',
            hotFile: 'public/hot-vue',
            buildDirectory: 'build-vue',
            refresh: true,
        }),
        vue({
            template: {
                transformAssetUrls: {
                    base: null,
                    includeAbsolute: false,
                },
            },
        }),
        tailwindcss(),
    ],
})
