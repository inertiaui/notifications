<?php

namespace InertiaUI\Notifications\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Inertia\Support\Header;
use InertiaUI\Notifications\FlashedToasts;
use InertiaUI\Notifications\ToastHeader;
use Symfony\Component\HttpFoundation\Response;

/**
 * Sends the flashed toasts in a response header to requests of Inertia's HTTP client.
 *
 * The frontend sends the `X-InertiaUI-Toasts` header with every request of Inertia's HTTP client to say that it reads
 * toasts from response headers. For such a request whose response renders no page, such as the JSON that a `useHttp`
 * request receives, this middleware moves the flashed toasts to the same header of the response, so they show as soon
 * as it arrives. This includes toasts that an earlier request flashed for the next page. A response that renders a
 * page, redirects, or sends the browser to another URL leaves them flashed for the next page.
 *
 * Append this middleware to the web group before Inertia's middleware, so it sees the response that Inertia's
 * middleware sends, such as the location response that replaces a response for an outdated asset version.
 */
class AddFlashedToastsToResponseHeaders
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if (! $request->headers->has(ToastHeader::NAME) || ! $this->carriesToastsInHeader($response)) {
            return $response;
        }

        $toasts = FlashedToasts::get($request);

        if ($toasts !== []) {
            ToastHeader::add($response, $toasts);

            FlashedToasts::put([]);
        }

        return $response;
    }

    /**
     * Determine if the response should carry the toasts in a header.
     *
     * This is the case for a response that renders no page, does not redirect to one, and does not send
     * the browser to another URL with a location response. Inertia's middleware turns a redirect to a
     * URL with a fragment into a conflict response with the URL, which the client follows as a visit.
     */
    protected function carriesToastsInHeader(Response $response): bool
    {
        return ! $response->headers->has(Header::INERTIA)
            && ! $response->isRedirection()
            && ! $response->headers->has(Header::LOCATION)
            && ! $response->headers->has(Header::REDIRECT);
    }
}
