import { createInertiaApp as createReactApp } from '@inertiajs/react'
import { createInertiaApp as createVueApp } from '@inertiajs/vue3'
import { createElement, type ComponentType } from 'react'
import { renderToString as renderReact } from 'react-dom/server'
import { describe, expect, it, vi } from 'vite-plus/test'
import { createSSRApp, defineComponent, h, type Component } from 'vue'
import { renderToString as renderVue } from 'vue/server-renderer'

import ReactNotificationCenter from '../react/src/NotificationCenter'
import ReactNotificationItem from '../react/src/NotificationItem'
import ReactNotificationList from '../react/src/NotificationList'
import { useNotifications as useReactNotifications } from '../react/src/useNotifications'
import { usePreferences as useReactPreferences } from '../react/src/usePreferences'
import { useToasts as useReactToasts } from '../react/src/useToasts'
import VueNotificationCenter from '../vue/src/NotificationCenter.vue'
import VueNotificationItem from '../vue/src/NotificationItem.vue'
import { useNotifications as useVueNotifications } from '../vue/src/useNotifications'
import { usePreferences as useVuePreferences } from '../vue/src/usePreferences'
import { useToasts as useVueToasts } from '../vue/src/useToasts'
import { inboxStore, parseInboxItem } from './inbox'
import type { InertiaBindings } from './inertia'
import { preferencesStore } from './preferences'
import { toastStore } from './toast'

// The React elements that render, with props that the server's HTML leaves out, such as `suppressHydrationWarning`.
const elements = vi.hoisted(() => [] as Array<{ type: unknown; props: Record<string, unknown> }>)

vi.mock('react/jsx-dev-runtime', async (importOriginal) => {
    const runtime = await importOriginal<typeof import('react/jsx-dev-runtime')>()

    return {
        ...runtime,
        jsxDEV: (...args: Parameters<typeof runtime.jsxDEV>) => {
            elements.push({ type: args[0], props: args[1] as Record<string, unknown> })

            return runtime.jsxDEV(...args)
        },
    }
})

const shared = { url: '/inbox', channel: null, user: 'u1', unread: 3, unseen: 3, categories: [], latest: null, latestIds: [], revision: 1 }
const page = { component: 'Page', props: { inertiauiInbox: shared, errors: {} }, url: '/', version: null, flash: {} }

// The browser's first render hydrates the server's HTML. Inertia's first navigate event may fill the store before a
// component below a Suspense boundary or an async component hydrates, so that render must not read the store.
describe('hydration', () => {
    inboxStore.sync({ inertiauiInbox: shared }, 'initial')

    it('renders the React components with the state the server rendered, after the store received the first page', async () => {
        const Unseen = () => createElement('output', null, useReactNotifications().counts.unseen)
        const Page = () => createElement('header', null, createElement(ReactNotificationCenter), createElement(Unseen))

        const { body } = await createReactApp({
            page,
            render: renderReact,
            resolve: () => Page as ComponentType,
            setup: ({ App, props }) => createElement(App, props),
        })

        expect(inboxStore.getSnapshot().counts.unseen).toBe(3)
        expect(body).toContain('aria-label="Notifications"')
        expect(body).not.toContain('data-inbox-badge')
        expect(body).toContain('<output>0</output>')
    })

    it('renders the Vue components with the state the server rendered, after the store received the first page', async () => {
        const Unseen = defineComponent({
            setup() {
                const { counts } = useVueNotifications()

                return () => h('output', counts.value.unseen)
            },
        })
        const Page = { render: () => h('header', [h(VueNotificationCenter), h(Unseen)]) }

        const { body } = await createVueApp({
            page,
            render: renderVue,
            resolve: () => Page as Component,
            setup: ({ App, props, plugin }) => createSSRApp({ render: () => h(App, props) }).use(plugin),
        })

        expect(body).toContain('aria-label="Notifications"')
        expect(body).not.toContain('data-inbox-badge')
        expect(body).toContain('<output>0</output>')
    })

    /** Shows a toast and loads the preferences before the components render, like a toast or a preferences load that reaches the store before they hydrate. */
    const changeStores = async (): Promise<void> => {
        toastStore.add('Invoice paid')
        preferencesStore.connect({
            request: async () => ({ channels: [{ key: 'mail', label: 'Mail' }], categories: [] }),
        } as Partial<InertiaBindings> as InertiaBindings)
        await preferencesStore.load('/inbox')

        expect(toastStore.getSnapshot()).not.toHaveLength(0)
        expect(preferencesStore.getSnapshot().status).toBe('ready')
    }

    it('renders the React hooks of toasts and preferences with the state the server rendered, after their stores changed', async () => {
        await changeStores()
        const Page = () => createElement('output', null, `${useReactToasts().toasts.length} ${useReactPreferences().status}`)

        const { body } = await createReactApp({
            page,
            render: renderReact,
            resolve: () => Page as ComponentType,
            setup: ({ App, props }) => createElement(App, props),
        })

        expect(body).toContain('<output>0 idle</output>')
    })

    it('renders the Vue hooks of toasts and preferences with the state the server rendered, after their stores changed', async () => {
        await changeStores()
        const Page = defineComponent({
            setup() {
                const { toasts } = useVueToasts()
                const { status } = useVuePreferences()

                return () => h('output', `${toasts.value.length} ${status.value}`)
            },
        })

        const { body } = await createVueApp({
            page,
            render: renderVue,
            resolve: () => Page as Component,
            setup: ({ App, props, plugin }) => createSSRApp({ render: () => h(App, props) }).use(plugin),
        })

        expect(body).toContain('<output>0 idle</output>')
    })

    // A server process renders many requests, long after the shared clock read the time when the module loaded.
    it('renders the relative times of the React NotificationList against the time of the request', async () => {
        vi.setSystemTime(Date.now() + 3 * 24 * 60 * 60 * 1000)

        try {
            const createdAt = new Date(Date.now() - 5 * 60 * 1000).toISOString()
            const { body } = await createReactApp({
                page: { ...page, props: { ...page.props, notifications: { data: [{ id: 'a', title: 'Invoice paid', createdAt }] } } },
                render: renderReact,
                resolve: () => (() => createElement(ReactNotificationList, { data: 'notifications' })) as ComponentType,
                setup: ({ App, props }) => createElement(App, props),
            })

            expect(body).toContain('5 minutes ago')
        } finally {
            vi.useRealTimers()
        }
    })

    // The browser formats a time in its own timezone, which may differ from the server's.
    it('lets the snoozed-until time of a notification differ from the one the server rendered', async () => {
        const item = parseInboxItem({ id: 'a', title: 'Invoice paid', createdAt: '2026-11-15T10:00:00Z', snoozedUntil: '2099-01-05T09:00:00Z' })!
        elements.length = 0

        renderReact(createElement(ReactNotificationItem, { item, now: Date.now() }))
        const html = await renderVue(createSSRApp({ render: () => h(VueNotificationItem, { item, now: Date.now() }) }))

        expect(elements.find(({ type, props }) => type === 'p' && 'data-inbox-snoozed-until' in props)?.props).toMatchObject({ suppressHydrationWarning: true })
        expect(/<p data-inbox-snoozed-until[^>]*>/.exec(html)?.[0]).toContain('data-allow-mismatch')
    })
})
