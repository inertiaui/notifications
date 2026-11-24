import type { http as Http, router as Router, socketId as SocketId } from '@inertiajs/core'

export interface HttpResponseLike {
    status?: number
    data: unknown
    headers: Record<string, string>
}

/** How a page was shown. Pages from `history` and the prefetch cache (`cached`) may carry outdated props. */
export type NavigationType = 'initial' | 'visit' | 'history' | 'cached'

/** The parts of the Inertia adapter the core uses; each framework package passes its own. */
export interface InertiaBindings {
    onFlash(listener: (flash: Record<string, unknown>) => void): void
    /** Returns the headers to send with a request. */
    onRequest(listener: (config: { url: string; headers?: Record<string, unknown> }) => Record<string, unknown> | undefined): void
    onResponse(listener: (response: HttpResponseLike) => void): void
    onError(listener: (error: unknown) => void): void
    /** Return `false` to stop Inertia from showing the response in its error dialog. */
    onHttpException(listener: (response: HttpResponseLike) => boolean | void): void
    /**
     * Runs when a page is shown or updated: the first page, after every visit (including a redirect back to the same
     * URL and a partial reload), and after back or forward navigation.
     */
    onNavigate(listener: (props: Record<string, unknown>, type: NavigationType) => void): void
    visit(href: string, options: Record<string, unknown>): void
    /** Sends a JSON request through Inertia's HTTP client, which adds the CSRF token, and returns the parsed body. */
    request(method: 'get' | 'post', url: string, data?: Record<string, unknown>): Promise<unknown>
    /**
     * Sends the socket ID that `resolve` returns with Inertia's requests, as `X-Socket-Id`, so the server can leave
     * this browser out of a broadcast with `toOthers()`. Ignored when the application chose its own resolver.
     */
    useSocketId(resolve: () => string | null | undefined): void
}

/** Connects the core to the router and HTTP client that a framework package re-exports from `@inertiajs/core`. */
export function createInertiaBindings(router: typeof Router, http: typeof Http, socketId: typeof SocketId): InertiaBindings {
    return {
        onFlash: (listener) => void router.on('flash', (event) => listener(event.detail.flash as Record<string, unknown>)),
        onRequest: (listener) => void http.onRequest((config) => ({ ...config, headers: listener(config) })),
        onResponse: (listener) =>
            void http.onResponse((response) => {
                listener(response)

                return response
            }),
        onError: (listener) => void http.onError((error) => listener(error)),
        onHttpException: (listener) => void router.on('httpException', (event) => listener(event.detail.response)),
        onNavigate: (listener) => {
            let navigated: string | undefined

            router.on('navigate', (event) => {
                navigated = event.detail.visitId
                listener(event.detail.page.props as Record<string, unknown>, event.detail.cached ? 'cached' : event.detail.type)
            })

            // Inertia fires no navigate event for a visit that stays on the same URL, such as a redirect back after a
            // form post or a partial reload.
            router.on('success', (event) => {
                if (event.detail.visitId === undefined || event.detail.visitId !== navigated) {
                    listener(event.detail.page.props as Record<string, unknown>, 'visit')
                }
            })
        },
        visit: (href, options) => router.visit(href, options),
        request: async (method, url, data) => {
            const response = await http.getClient().request({
                method,
                url,
                data: data === undefined ? undefined : JSON.stringify(data),
                headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            })

            return response.data ? (JSON.parse(response.data) as unknown) : null
        },
        useSocketId: (resolve) => socketId.resolveUsingDefault(() => resolve() ?? null),
    }
}
