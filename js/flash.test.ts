import { describe, expect, it } from 'vite-plus/test'

import wire from '../tests/Fixtures/toasts.json'
import { DEFAULT_FLASH_KEY, createToastReceiver, flashFromResponse, flashToasts, headerToasts, parseActions, safeHref } from './flash'
import { createToastStore } from './toastStore'

const setup = () => {
    const store = createToastStore({ duration: 4000 })

    return { store, receive: createToastReceiver(store.add) }
}

const open = (store: ReturnType<typeof createToastStore>) => store.getSnapshot().filter((toast) => toast.state !== 'closing')

describe('toast receiver', () => {
    it('adds each server toast once, however often it arrives', () => {
        const { store, receive } = setup()
        const toasts = [
            { uuid: 'a', type: 'success', title: 'Saved', description: 'Your changes are live.' },
            { uuid: 'b', type: 'warning', title: 'Verify your email', duration: null },
        ]

        receive(toasts)
        receive(structuredClone(toasts))

        expect(store.getSnapshot()).toMatchObject([
            { type: 'success', title: 'Saved', description: 'Your changes are live.', duration: 4000 },
            { type: 'warning', title: 'Verify your email', duration: null },
        ])

        receive([{ uuid: 'c', title: 'Next request' }])
        expect(store.getSnapshot().map((toast) => toast.title)).toEqual(['Saved', 'Verify your email', 'Next request'])
    })

    it('keeps a dismissed toast dismissed when the same toasts are received again', () => {
        const { store, receive } = setup()
        const toasts = [{ uuid: 'a', title: 'Saved' }]

        receive(toasts)
        store.dismiss()
        receive(toasts)

        expect(open(store)).toEqual([])
    })

    it('replaces the open toast with the same ID on each new flash', () => {
        const { store, receive } = setup()

        receive([{ uuid: 'a', id: 'import', type: 'loading', title: 'Importing' }])
        receive([{ uuid: 'a', id: 'import', type: 'loading', title: 'Importing' }])
        receive([{ uuid: 'b', id: 'import', type: 'success', title: 'Imported', actions: [{ label: 'View', href: '/imports/1' }] }])

        expect(store.getSnapshot()).toMatchObject([
            { id: 'import', type: 'success', title: 'Imported', revision: 2, duration: null, actions: [{ label: 'View', href: '/imports/1' }] },
        ])
    })

    it('ignores values that are not toasts', () => {
        const { store, receive } = setup()

        receive(undefined)
        receive('Saved')
        receive([null, { id: 'import', title: 'No uuid' }, { uuid: 'a', title: 42 }, { uuid: 'b', title: 'Invalid type', type: 'Bad Type' }])

        expect(store.getSnapshot()).toEqual([])
    })

    it('keeps the type of a custom type toast', () => {
        const { store, receive } = setup()

        receive([{ uuid: 'a', type: 'deployment', title: 'Deployed' }])

        expect(store.getSnapshot()).toMatchObject([{ type: 'deployment', title: 'Deployed', duration: 4000 }])
    })

    it('keeps the data of a server toast when it is a keyed object', () => {
        const { store, receive } = setup()

        receive([
            { uuid: 'a', type: 'invite', title: 'Sophie invited you', data: { team: 'Acme', members: 12 } },
            { uuid: 'b', type: 'invite', title: 'Maria invited you', data: ['Apollo'] },
        ])

        expect(store.getSnapshot().map((toast) => toast.data)).toEqual([{ team: 'Acme', members: 12 }, undefined])
    })

    it('keeps the image of a server toast when its URL cannot run script', () => {
        const { store, receive } = setup()

        receive([
            { uuid: 'a', type: 'info', title: 'Sophie Martin commented', image: 'https://example.com/sophie.jpg' },
            { uuid: 'b', type: 'info', title: 'Maria Garcia commented', image: 'javascript:alert(1)' },
            { uuid: 'c', type: 'info', title: 'Noah Fischer commented', image: 42 },
        ])

        expect(store.getSnapshot().map((toast) => toast.image)).toEqual(['https://example.com/sophie.jpg', undefined, undefined])
    })

    it('keeps the progress of a server toast when it is a number', () => {
        const { store, receive } = setup()

        receive([
            { uuid: 'a', id: 'import', type: 'loading', title: 'Importing contacts', progress: 0.4 },
            { uuid: 'b', type: 'loading', title: 'Exporting invoices', progress: '40%' },
        ])

        expect(store.getSnapshot().map((toast) => toast.progress)).toEqual([0.4, undefined])
    })

    // The flash data of the PHP package, which its own test compares with this file.
    it('reads the toasts that the server flashes, with an action of each kind', () => {
        const { store, receive } = setup()

        receive(flashToasts(wire, DEFAULT_FLASH_KEY))

        expect(store.getSnapshot()).toMatchObject([
            {
                id: 'join-request-7',
                type: 'info',
                title: 'Sophie asked to join Acme',
                description: 'She signed up with sophie@acme.test.',
                duration: null,
                actions: [
                    { label: 'View profile', href: '/users/sophie' },
                    { label: 'Copy email', event: 'copy-email', payload: { email: 'sophie@acme.test' } },
                    { label: 'Approve', href: '/teams/acme/requests/7/approve', method: 'post', result: 'Approved' },
                ],
                icon: 'user-plus',
                image: 'https://acme.test/avatars/sophie.jpg',
                dismissible: false,
                position: 'top-center',
                toaster: 'teams',
                data: { team: 'Acme' },
            },
        ])
    })
})

describe('server actions', () => {
    it('keeps only URLs that cannot run script', () => {
        expect(safeHref('/invoices/7')).toBe('/invoices/7')
        expect(safeHref('https://example.com')).toBe('https://example.com')
        expect(safeHref('mailto:billing@acme.test')).toBe('mailto:billing@acme.test')
        expect(safeHref('invoices/7?tab=lines')).toBe('invoices/7?tab=lines')
        expect(safeHref('javascript:alert(1)')).toBeUndefined()
        expect(safeHref(' JavaScript:alert(1)')).toBeUndefined()
        expect(safeHref('java\tscript:alert(1)')).toBeUndefined()
        expect(safeHref('data:text/html,<script>alert(1)</script>')).toBeUndefined()
        expect(safeHref(42)).toBeUndefined()
    })

    it('keeps the fields the client understands and drops actions it cannot run', () => {
        expect(
            parseActions([
                {
                    label: 'Cancel',
                    href: '/imports/7',
                    method: 'delete',
                    data: { reason: 'user' },
                    visit: { preserveScroll: true },
                    keepOpen: true,
                    onClick: 'alert(1)',
                },
                { label: 'Copy ID', event: 'copy-import', payload: { id: 7 } },
                { label: 'Run', href: 'javascript:alert(1)' },
                { label: 'Nothing' },
                { href: '/no-label' },
                { label: 'Odd method', href: '/x', method: 'trace' },
            ]),
        ).toEqual([
            { label: 'Cancel', href: '/imports/7', method: 'delete', data: { reason: 'user' }, visit: { preserveScroll: true }, keepOpen: true },
            { label: 'Copy ID', event: 'copy-import', payload: { id: 7 } },
            { label: 'Odd method', href: '/x' },
        ])
        expect(parseActions('View')).toEqual([])
    })
})

describe('reading toasts from responses', () => {
    const page = { component: 'Home', props: {}, flash: { inertiaui: { toasts: [{ uuid: 'a', title: 'Saved' }] } } }

    it('reads the flash data of Inertia page responses under the configured key', () => {
        const flash = flashFromResponse({ data: JSON.stringify(page), headers: { 'x-inertia': 'true' } })

        expect(flash).toEqual(page.flash)
        expect(flashToasts(flash, 'inertiaui')).toEqual(page.flash.inertiaui.toasts)
        expect(flashToasts(flash, 'app')).toBeUndefined()
        expect(flashToasts({ inertiaui: 'Saved' }, 'inertiaui')).toBeUndefined()
    })

    it('skips other responses and pages without flash data', () => {
        const data = JSON.stringify(page)

        expect(flashFromResponse({ data, headers: { 'content-type': 'application/json' } })).toBeUndefined()
        expect(flashFromResponse({ data: JSON.stringify({ ...page, flash: undefined }), headers: { 'x-inertia': 'true' } })).toBeUndefined()
        expect(flashFromResponse({ data: '{"flash": broken', headers: { 'x-inertia': 'true' } })).toBeUndefined()
    })

    it('reads toasts from the header of other responses', () => {
        expect(headerToasts({ 'x-inertiaui-toasts': '[{"uuid":"a","title":"Copied \\u2014 share it"}]' })).toEqual([{ uuid: 'a', title: 'Copied — share it' }])
        expect(headerToasts({ 'x-inertiaui-toasts': 'not json' })).toBeUndefined()
        expect(headerToasts({})).toBeUndefined()
    })
})
