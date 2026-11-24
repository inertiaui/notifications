import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createInertiaUiDocsConfig, createInertiaUiSeoTransform, extractInertiaUiDescription, inertiaUiHead } from '@inertiaui/docs-theme'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitepress'
import llmstxt from 'vitepress-plugin-llms'

import { docsSections } from './sections.mjs'

const sharedConfig = createInertiaUiDocsConfig({ productSlug: 'inertia-notifications' })
const DOCS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SITE_NAME = 'Inertia Notifications Documentation'
const SITE_TITLE_SUFFIX = 'Inertia Notifications'
const SITE_URL = 'https://inertiaui.com/inertia-notifications/docs'
const SITE_BASE_URL = 'https://inertiaui.com/inertia-notifications'
const SITE_DESCRIPTION =
    'Toasts and a notification center for Laravel + Inertia.js. Flash toasts from your controllers, store notifications in an inbox, and render both in Vue or React.'
const OG_IMAGE = 'https://inertiaui.com/socialcard.jpeg'
const TWITTER_HANDLE = '@pascalbaljet'
const ARTICLE_DEPENDENCIES = 'PHP 8.3+, Laravel 12 or 13, Inertia Laravel 3.8+, Inertia.js 3.11+, Vue 3.5+ or React 19, Tailwind CSS 4.3+'

const sectionBySlug = new Map(
    docsSections.flatMap((section) => section.items.map(({ link }) => [link.slice(1), { name: section.name, url: `${SITE_URL}${section.canonicalPath}` }])),
)

const transformPageData = createInertiaUiSeoTransform({
    siteName: SITE_NAME,
    siteTitleSuffix: SITE_TITLE_SUFFIX,
    siteUrl: SITE_URL,
    siteBaseUrl: SITE_BASE_URL,
    siteDescription: SITE_DESCRIPTION,
    ogImage: OG_IMAGE,
    articleDependencies: ARTICLE_DEPENDENCIES,
    descriptionForPage(relativePath, fallback) {
        try {
            return extractInertiaUiDescription(fs.readFileSync(path.resolve(DOCS_ROOT, relativePath), 'utf-8'), fallback)
        } catch {
            return fallback
        }
    },
    sectionFor: (slug) => sectionBySlug.get(slug) ?? { name: 'Getting Started', url: `${SITE_URL}/introduction` },
})

export default defineConfig({
    ...sharedConfig,
    title: SITE_NAME,
    titleTemplate: `:title - ${SITE_TITLE_SUFFIX}`,
    description: SITE_DESCRIPTION,
    lastUpdated: true,
    sitemap: {
        hostname: `${SITE_URL}/`,
    },
    head: inertiaUiHead([
        ['link', { rel: 'icon', href: '/favicon.ico' }],
        ['link', { rel: 'apple-touch-icon', href: '/favicon.ico' }],
        ['meta', { name: 'application-name', content: SITE_TITLE_SUFFIX }],
        ['meta', { property: 'og:type', content: 'website' }],
        ['meta', { property: 'og:site_name', content: SITE_NAME }],
        ['meta', { property: 'og:image', content: OG_IMAGE }],
        ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
        ['meta', { name: 'twitter:site', content: TWITTER_HANDLE }],
        ['meta', { name: 'twitter:image', content: OG_IMAGE }],
    ]),
    themeConfig: {
        ...sharedConfig.themeConfig,
        siteTitle: 'Notifications Documentation',
        sidebarMenuLabel: 'Content',

        nav: [
            {
                text: 'Products',
                items: [
                    { text: 'Inertia Table', link: 'https://inertiaui.com/inertia-table/docs/introduction' },
                    { text: 'Inertia Forms', link: 'https://inertiaui.com/inertia-forms/docs/introduction' },
                    { text: 'Inertia Modal', link: 'https://inertiaui.com/inertia-modal/docs/introduction' },
                    { text: 'Inertia Notifications', link: 'https://inertiaui.com/inertia-notifications/docs/introduction' },
                ],
            },
            { text: 'Inertia UI portal', link: 'https://inertiaui.com/login' },
        ],

        sidebar: docsSections.map(({ name, items }) => ({ text: name, items })),
    },
    transformPageData,
    vite: {
        plugins: [llmstxt(), tailwindcss()],
        // The live examples and the package must share one copy of Vue and Inertia, so the examples can swap the HTTP client.
        resolve: { dedupe: ['vue', '@inertiajs/core', '@inertiajs/vue3'] },
    },
})
