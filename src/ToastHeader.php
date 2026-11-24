<?php

namespace InertiaUI\Notifications;

use Symfony\Component\HttpFoundation\Response;

/**
 * Carries toasts in a response header, for responses that are not Inertia pages, such as JSON for
 * `useHttp`. The frontend sends the same header to say that it reads toasts from responses.
 */
class ToastHeader
{
    /**
     * The name of the header that carries the toasts.
     */
    public const string NAME = 'X-InertiaUI-Toasts';

    /**
     * Add the given toasts to the header of the response.
     *
     * @param  list<array<string, mixed>>  $toasts
     */
    public static function add(Response $response, array $toasts): void
    {
        if ($toasts === []) {
            return;
        }

        // We will encode the toasts with the default JSON flags on purpose. Those
        // escape any non-ASCII characters, which keeps the header value valid.
        $response->headers->set(self::NAME, json_encode([...self::get($response), ...$toasts], JSON_THROW_ON_ERROR));
    }

    /**
     * Get the toasts from the header of the response.
     *
     * @return list<array<string, mixed>>
     */
    public static function get(Response $response): array
    {
        return FlashedToasts::filter(json_decode((string) $response->headers->get(self::NAME, '[]'), true));
    }
}
