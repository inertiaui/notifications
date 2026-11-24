import { createInertiaApp } from '@inertiajs/react'
import { createElement, Fragment, type ComponentType } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vite-plus/test'

import ReactToaster from '../react/src/Toaster'
import { useToasts } from '../react/src/useToasts'
import { own, toastIcons } from './icons'
import { announcement } from './toaster'

describe('custom toast types', () => {
    it('shows a custom type named like an object property as a default toast, unless the app gives it a label and icon', () => {
        const toast = { type: 'constructor', title: 'Deployed', actions: [] }

        expect(announcement(toast)).toBe('Deployed.')
        expect(own(toastIcons, 'constructor')).toBeUndefined()
        expect(own({}, 'toString')).toBeUndefined()

        expect(announcement(toast, { constructor: 'Build' })).toBe('Build: Deployed.')
        expect(own({ constructor: 'rocket' }, 'constructor')).toBe('rocket')
    })
})

describe('the React Toaster', () => {
    // The Laravel React starter kit renders its Toaster next to Inertia's App, where usePage() has no page.
    it('renders next to Inertia App, as in the withApp option of createInertiaApp()', async () => {
        const Count = () => createElement('output', null, useToasts().toasts.length)

        // The server render of the starter kit's build:ssr script, which passes the app through withApp too.
        const render = await createInertiaApp({
            resolve: () => (() => createElement('main', null, 'Dashboard')) as ComponentType,
            withApp: (app) => createElement(Fragment, null, app, createElement(ReactToaster), createElement(Count)),
        })
        const { body } = await render({ component: 'Dashboard', props: { errors: {} }, url: '/', version: null, flash: {} }, renderToString)

        expect(body).toContain('<main>Dashboard</main>')
        expect(body).toContain('<output>0</output>')
    })
})
