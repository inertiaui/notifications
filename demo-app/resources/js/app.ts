import '../css/app.css'
import { createInertiaApp } from '@inertiajs/vue3'
import { initNotifications, setIconResolver, setTranslations, type EchoLike } from '@inertiaui/notifications-vue'
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers'
import { createApp, h, type DefineComponent } from 'vue'

import { bellAlertIconPaths, dutchTranslations } from './demo'

const params = new URLSearchParams(window.location.search)

// Visit the demo with ?locale=nl to see it in Dutch.
if (params.get('locale') === 'nl') {
    setTranslations(dutchTranslations)
}

// Visit the demo with ?icons=demo to see the bell from an icon resolver. The Toaster's icons prop keeps its deployment icon.
if (params.get('icons') === 'demo') {
    const icon = (name: string, paths: string[]) => () =>
        h(
            'svg',
            { viewBox: '0 0 20 20', fill: 'currentColor', 'data-demo-icon': name },
            paths.map((d) => h('path', { d, 'fill-rule': 'evenodd', 'clip-rule': 'evenodd' })),
        )
    const BellAlertIcon = icon('bell', bellAlertIconPaths)
    const ResolvedDeploymentIcon = icon('deployment', [bellAlertIconPaths[0]!])

    setIconResolver((name, context) => (name === 'bell' && context.part === 'bell' ? BellAlertIcon : name === 'deployment' ? ResolvedDeploymentIcon : null))
}

// Echo is read from window.Echo, where Laravel's resources/js/echo.js puts it. The demo runs no WebSocket server, so
// it also polls the counts; the browser tests install a stand-in Echo. The Alerts page shows the alerts that reach
// users outside the page.
initNotifications({
    errorToasts: true,
    inbox: { echo: () => (window as { Echo?: EchoLike }).Echo, poll: 30_000, titleCount: true, appBadge: true, desktopNotifications: true, sound: true },
})

createInertiaApp({
    title: (title) => (title ? `${title} - Inertia Notifications` : 'Inertia Notifications'),
    resolve: (name) => resolvePageComponent(`./Pages/${name}.vue`, import.meta.glob<DefineComponent>('./Pages/**/*.vue')),
    setup({ el, App, props, plugin }) {
        createApp({ render: () => h(App, props) })
            .use(plugin)
            .mount(el)
    },
})
