import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite-plus'

export default defineConfig({
    // Compiles the Vue components that the server rendering tests import.
    plugins: [vue()],
    test: {
        environment: 'node',
        include: ['js/**/*.test.ts'],
    },
    fmt: {
        printWidth: 160,
        semi: false,
        singleQuote: true,
        tabWidth: 4,
        trailingComma: 'all',
        sortTailwindcss: {},
        sortImports: {},
        endOfLine: 'lf',
        sortPackageJson: false,
        ignorePatterns: [
            'pnpm-lock.yaml',
            '*.lock',
            '*.md',
            '**/dist/**',
            '**/vendor/**',
            '**/node_modules/**',
            '**/.vitepress/cache/**',
            '**/bootstrap/ssr/**',
            '**/public/build*/**',
            '**/storage/framework/views/**',
        ],
    },
    lint: {
        plugins: ['typescript', 'react', 'vue', 'unicorn'],
        env: {
            builtin: true,
            browser: true,
            es2024: true,
        },
        ignorePatterns: [
            '**/dist/**',
            '**/node_modules/**',
            '**/vendor/**',
            '**/.vitepress/cache/**',
            '**/bootstrap/ssr/**',
            '**/public/build*/**',
            '**/storage/framework/views/**',
            '**/*.d.ts',
        ],
        overrides: [
            {
                files: ['js/**/*.ts', 'vue/src/**/*.ts', 'vue/src/**/*.vue', 'react/src/**/*.ts', 'react/src/**/*.tsx'],
                rules: {
                    curly: ['error', 'all'],
                },
            },
        ],
        rules: {
            'react/react-in-jsx-scope': 'off',
            'react/no-unescaped-entities': 'off',
            'react-hooks/exhaustive-deps': 'off',
            'no-unused-vars': 'off',
            'no-unused-expressions': 'off',
            'no-empty-pattern': 'off',
            'vite-plus/prefer-vite-plus-imports': 'error',
        },
        jsPlugins: [
            {
                name: 'vite-plus',
                specifier: 'vite-plus/oxlint-plugin',
            },
        ],
    },
})
