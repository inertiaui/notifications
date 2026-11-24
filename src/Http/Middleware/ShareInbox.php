<?php

namespace InertiaUI\Notifications\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Inertia\Inertia;
use InertiaUI\Notifications\Inbox;
use Symfony\Component\HttpFoundation\Response;

/**
 * Shares the notification center's counts and URL with every Inertia page, under the key in
 * `inbox.shared_prop`. Shared on each request, like Inertia's own middleware does, so the prop
 * survives code that flushes Inertia's shared props between requests, such as Pest's browser tests.
 *
 * The service provider appends this middleware to the web group.
 */
class ShareInbox
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $key = config('inertia-notifications.inbox.shared_prop', 'inertiauiInbox');

        if (is_string($key) && $key !== '') {
            // We will share the prop as an "always" prop, so partial reloads, such as the pages
            // that infinite scroll loads, carry fresh counts too.
            Inertia::share($key, Inertia::always(fn (): ?array => Inbox::sharedProp()));
        }

        return $next($request);
    }
}
