import { resolve } from 'path'

import react from '@vitejs/plugin-react'
import dts from 'unplugin-dts/vite'
import { defineConfig } from 'vite-plus'

export default defineConfig({
    plugins: [
        react(),
        dts({
            bundleTypes: true,
            insertTypesEntry: true,
            tsconfigPath: resolve(import.meta.dirname, 'tsconfig.json'),
        }),
    ],

    build: {
        emptyOutDir: true,
        minify: process.env.NODE_ENV === 'production',
        lib: {
            entry: { 'inertiaui-notifications': resolve(import.meta.dirname, 'src/index.ts') },
            formats: ['es'],
            fileName: (_format, entryName) => `${entryName}.js`,
        },
        rollupOptions: {
            external: [
                '@inertiajs/core',
                '@inertiajs/react',
                '@inertiaui/vanilla',
                'react',
                'react-dom',
                'tailwind-merge',
                'react/jsx-runtime',
                'react/jsx-dev-runtime',
            ],
        },
    },
})
