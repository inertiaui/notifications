import { describe, expect, it } from 'vite-plus/test'

import { createInertiaBindings } from './inertia'

/** A router that sends the events the test fires to the listeners registered with `on()`. */
function fakeRouter() {
    const listeners = new Map<string, Array<(event: { detail: unknown }) => void>>()

    return {
        router: { on: (name: string, listener: (event: { detail: unknown }) => void) => void listeners.set(name, [...(listeners.get(name) ?? []), listener]) },
        fire: (name: string, detail: unknown) => listeners.get(name)?.forEach((listener) => listener({ detail })),
    }
}

describe('inertia bindings', () => {
    it('reports every page update once, including visits that stay on the same URL', () => {
        const { router, fire } = fakeRouter()
        const calls: Array<[unknown, string]> = []
        const bindings = createInertiaBindings(router as never, {} as never)

        bindings.onNavigate((props, type) => calls.push([props.n, type]))

        // A visit to another URL fires navigate, then success.
        fire('navigate', { page: { props: { n: 1 } }, type: 'visit', visitId: 'a' })
        fire('success', { page: { props: { n: 1 } }, visitId: 'a' })
        // A redirect back to the same URL fires only success.
        fire('success', { page: { props: { n: 2 } }, visitId: 'b' })
        // A prefetched page and back navigation may carry outdated props.
        fire('navigate', { page: { props: { n: 3 } }, type: 'visit', cached: true, visitId: 'c' })
        fire('success', { page: { props: { n: 3 } }, visitId: 'c' })
        fire('navigate', { page: { props: { n: 4 } }, type: 'history' })

        expect(calls).toEqual([
            [1, 'visit'],
            [2, 'visit'],
            [3, 'cached'],
            [4, 'history'],
        ])
    })
})
