import '../css/app.css'
import { createInertiaApp, type ResolvedComponent } from '@inertiajs/react'
import { initNotifications, setIconResolver, setTranslations, type EchoLike } from '@inertiaui/notifications-react'
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers'
import { StrictMode, type SVGProps } from 'react'
import { createRoot } from 'react-dom/client'

import { bellAlertIconPaths, dutchTranslations } from './demo'

const params = new URLSearchParams(window.location.search)

// Visit the demo with ?locale=nl to see it in Dutch.
if (params.get('locale') === 'nl') {
    setTranslations(dutchTranslations)
}

// Visit the demo with ?icons=demo to see the bell from an icon resolver. The Toaster's icons prop keeps its deployment icon.
if (params.get('icons') === 'demo') {
    const icon = (name: string, paths: string[]) =>
        function DemoIcon(props: SVGProps<SVGSVGElement>) {
            return (
                <svg viewBox="0 0 20 20" fill="currentColor" data-demo-icon={name} {...props}>
                    {paths.map((d) => (
                        <path key={d} d={d} fillRule="evenodd" clipRule="evenodd" />
                    ))}
                </svg>
            )
        }
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
    resolve: (name) => resolvePageComponent(`./Pages/${name}.tsx`, import.meta.glob<ResolvedComponent>('./Pages/**/*.tsx', { import: 'default' })),
    setup({ el, App, props }) {
        createRoot(el).render(
            <StrictMode>
                <App {...props} />
            </StrictMode>,
        )
    },
})
