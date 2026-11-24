import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import laravel from 'laravel-vite-plugin'
import { defineConfig } from 'vite-plus'

export default defineConfig({
    cacheDir: 'node_modules/.vite/react',

    resolve: {
        dedupe: ['react', 'react-dom', '@inertiajs/core', '@inertiajs/react'],
    },

    plugins: [
        laravel({
            input: 'resources/js/app.tsx',
            hotFile: 'public/hot-react',
            buildDirectory: 'build-react',
            refresh: true,
        }),
        react(),
        tailwindcss(),
    ],
})
