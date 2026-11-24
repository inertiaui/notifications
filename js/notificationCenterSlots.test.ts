import { createInertiaApp as createReactApp } from '@inertiajs/react'
import { createInertiaApp as createVueApp } from '@inertiajs/vue3'
import { createElement, type ComponentType } from 'react'
import { renderToString as renderReact } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { createSSRApp, h, type Component } from 'vue'
import { renderToString as renderVue } from 'vue/server-renderer'

import ReactNotificationCenter from '../react/src/NotificationCenter'
import ReactNotificationItem from '../react/src/NotificationItem'
import VueNotificationCenter from '../vue/src/NotificationCenter.vue'
import VueNotificationItem from '../vue/src/NotificationItem.vue'
import { inboxStore, parseInboxItem, type InboxState } from './inbox'
import type {
    NotificationCenterFooterProps,
    NotificationCenterHeaderProps,
    NotificationCenterTabProps,
    NotificationCenterTriggerProps,
} from './notificationCenter'

const page = { component: 'Page', props: { errors: {} }, url: '/', version: null, flash: {} }

// The parts that the server renders: the bell, and the closed panel with its header, tabs, loading state, and footer.
const trigger = ({ open, count }: NotificationCenterTriggerProps) => `bell ${open ? 'open' : 'closed'}, ${count} new`
const header = ({ titleId, title, filter, unread }: NotificationCenterHeaderProps) => [titleId.endsWith('-title'), `${title} (${filter}, ${unread})`] as const
const tab = ({ label, selected, count }: NotificationCenterTabProps) => `[${label}${selected ? '*' : ''}${count === null ? '' : ` ${count}`}]`
const footer = ({ href }: NotificationCenterFooterProps) => `footer ${href ?? 'none'}`

const expectParts = (body: string): void => {
    expect(body).toContain('bell closed, 0 new')
    expect(body).toMatch(/<h2 id="[^"]+-title">Notifications \(all, 0\)<\/h2>/)
    expect(body).toContain('[All*]')
    expect(body).toContain('[Unread 0]')
    expect(body).toContain('custom loading')
    expect(body).toContain('footer none')
    // The built-in parts are replaced.
    expect(body).not.toContain('data-inbox-read-all')
    expect(body).not.toContain('Loading notifications')
}

describe('notification center slots and render props', () => {
    it('renders the React render props in place of the built-in parts', async () => {
        const Page = () =>
            createElement(ReactNotificationCenter, {
                tabs: ['all', 'unread'],
                renderTrigger: trigger,
                renderHeader: (props: NotificationCenterHeaderProps) => {
                    const [, text] = header(props)

                    return createElement('h2', { id: props.titleId }, text)
                },
                renderTab: tab,
                renderLoading: () => 'custom loading',
                renderFooter: footer,
            })

        const { body } = await createReactApp({
            page,
            render: renderReact,
            resolve: () => Page as ComponentType,
            setup: ({ App, props }) => createElement(App, props),
        })

        expectParts(body)
    })

    it('renders the Vue slots in place of the built-in parts', async () => {
        const Page = {
            render: () =>
                h(
                    VueNotificationCenter,
                    { tabs: ['all', 'unread'] },
                    {
                        trigger,
                        header: (props: NotificationCenterHeaderProps) => h('h2', { id: props.titleId }, header(props)[1]),
                        tab,
                        loading: () => 'custom loading',
                        footer,
                    },
                ),
        }

        const { body } = await createVueApp({
            page,
            render: renderVue,
            resolve: () => Page as Component,
            setup: ({ App, props, plugin }) => createSSRApp({ render: () => h(App, props) }).use(plugin),
        })

        expectParts(body.replaceAll('<!--[-->', '').replaceAll('<!--]-->', ''))
    })
})

describe('header of the notification center', () => {
    const serverState = inboxStore.getServerSnapshot()

    afterEach(() => {
        vi.restoreAllMocks()
        vi.useRealTimers()
    })

    /** Renders the panel of React and of Vue on the server with the given props and state, and returns what each custom header received. */
    async function headers(props: Record<string, unknown>, state: Partial<InboxState> = {}): Promise<NotificationCenterHeaderProps[]> {
        vi.spyOn(inboxStore, 'getServerSnapshot').mockReturnValue({ ...serverState, ...state })
        const received: NotificationCenterHeaderProps[] = []
        const header = (header: NotificationCenterHeaderProps) => {
            received.push(header)

            return null
        }

        await createReactApp({
            page,
            render: renderReact,
            resolve: () => (() => createElement(ReactNotificationCenter, { ...props, renderHeader: header })) as ComponentType,
            setup: ({ App, props }) => createElement(App, props),
        })

        await createVueApp({
            page,
            render: renderVue,
            resolve: () => ({ render: () => h(VueNotificationCenter, props, { header }) }) as Component,
            setup: ({ App, props, plugin }) => createSSRApp({ render: () => h(App, props) }).use(plugin),
        })

        expect(received).toHaveLength(2)

        return received
    }

    const defaults = [
        { label: 'For 30 minutes', preset: 30 },
        { label: 'For 1 hour', preset: 60 },
        { label: 'For 2 hours', preset: 120 },
        { label: 'Until tomorrow', preset: 'tomorrow' },
    ]

    it('gives a custom header the state and the times of the pause button, in Vue and in React', async () => {
        for (const header of await headers({ locale: 'en' }, { canPause: true, pausedUntil: '2026-11-18T11:00:00.000Z', pausePresets: [15, 'tomorrow'] })) {
            expect(header).toMatchObject({
                canPause: true,
                pausedUntil: '2026-11-18T11:00:00.000Z',
                pauseOptions: [
                    { label: 'For 15 minutes', preset: 15 },
                    { label: 'Until tomorrow', preset: 'tomorrow' },
                ],
            })
        }

        for (const header of await headers({ locale: 'en' }, { canPause: true, pausedUntil: null })) {
            expect(header).toMatchObject({ canPause: true, pausedUntil: null, pauseOptions: defaults })
        }
    })

    it('tells a custom header that the built-in one shows no pause button without pausing on the server', async () => {
        for (const header of await headers({ locale: 'en' }, { canPause: false, pausedUntil: null })) {
            expect(header).toMatchObject({ canPause: false, pausedUntil: null, pauseOptions: defaults })
        }
    })

    it('pauses from the moment a custom header calls pause(), not from when it rendered, and resumes, in Vue and in React', async () => {
        vi.useFakeTimers({ now: Date.parse('2026-11-18T10:00:00Z'), toFake: ['Date'] })
        const pause = vi.spyOn(inboxStore, 'pause').mockResolvedValue()
        const resume = vi.spyOn(inboxStore, 'resume').mockResolvedValue()
        const received = await headers({ locale: 'en' }, { canPause: true, pausedUntil: null })

        // The header rendered twenty minutes before the user picks "For 30 minutes".
        vi.setSystemTime(Date.parse('2026-11-18T10:20:00Z'))

        for (const header of received) {
            pause.mockClear()
            resume.mockClear()

            header.pause(header.pauseOptions[0]!)
            expect(pause).toHaveBeenCalledExactlyOnceWith(new Date('2026-11-18T10:50:00Z'))

            header.resume()
            expect(resume).toHaveBeenCalledOnce()
        }
    })
})

describe('notification item', () => {
    afterEach(() => vi.useRealTimers())

    // The clock of the panel or list ticks every minute, and both adapters show a snooze until it passes the end.
    it('tells whether a notification is still snoozed by the clock it renders with, in Vue and in React', async () => {
        vi.useFakeTimers({ now: Date.parse('2026-11-18T10:31:00Z'), toFake: ['Date'] })
        const item = parseInboxItem({ id: 'a', title: 'Invoice paid', createdAt: '2026-11-18T09:00:00Z', snoozedUntil: '2026-11-18T10:30:00Z' })!

        const render = async (now: string) => [
            renderReact(createElement(ReactNotificationItem, { item, now: Date.parse(now) })),
            await renderVue(createSSRApp({ render: () => h(VueNotificationItem, { item, now: Date.parse(now) }) })),
        ]

        for (const html of await render('2026-11-18T10:29:00Z')) {
            expect(html).toContain('data-inbox-snoozed-until')
            expect(html).toContain('aria-label="Unsnooze: Invoice paid"')
        }

        for (const html of await render('2026-11-18T10:31:00Z')) {
            expect(html).not.toContain('data-inbox-snoozed-until')
            expect(html).toContain('aria-label="Snooze: Invoice paid"')
        }
    })
})
