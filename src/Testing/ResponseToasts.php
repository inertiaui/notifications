<?php

namespace InertiaUI\Notifications\Testing;

use Closure;
use Illuminate\Support\Arr;
use Illuminate\Testing\TestResponse;
use Illuminate\View\View;
use Inertia\Inertia;
use Inertia\Support\Header;
use InertiaUI\Notifications\FlashedToasts;
use InertiaUI\Notifications\ToastHeader;
use InertiaUI\Notifications\ToastType;
use PHPUnit\Framework\Assert as PHPUnit;
use Symfony\Component\HttpFoundation\Response;

/**
 * Finds the toasts a test response delivers: flashed for the next page after a redirect or a location
 * response, in the flash data of an Inertia page (JSON or the initial HTML view), or in the toasts header.
 *
 * @internal
 */
class ResponseToasts
{
    /**
     * Register the `assertToast()` and `assertNoToasts()` macros on `TestResponse`.
     */
    public static function registerMacros(): void
    {
        TestResponse::macro('assertToast', function (
            Closure|string $expected,
            ToastType|string|null $type = null,
        ): TestResponse {
            /** @var TestResponse<Response> $this */
            ResponseToasts::assertHas($this, $expected, $type);

            return $this;
        });

        TestResponse::macro('assertNoToasts', function (): TestResponse {
            /** @var TestResponse<Response> $this */
            $titles = array_column(ResponseToasts::from($this), 'title');
            $delivered = implode('], [', $titles);

            PHPUnit::assertSame([], $titles, "Expected the response to deliver no toasts. Delivered: [{$delivered}].");

            return $this;
        });
    }

    /**
     * Assert if the response delivers a toast based on its title or a truth-test callback.
     *
     * The callback receives each toast as the frontend does.
     *
     * @param  TestResponse<Response>  $response
     * @param  (Closure(array<string, mixed>): bool)|string  $expected
     */
    public static function assertHas(
        TestResponse $response,
        Closure|string $expected,
        ToastType|string|null $type = null,
    ): void {
        $type = $type === null ? null : ToastType::value($type);
        $toasts = self::from($response);

        $matches = array_filter($toasts, fn (array $toast): bool => self::matches($toast, $expected, $type));

        $description = is_string($expected) ? "a toast titled [{$expected}]" : 'a matching toast';

        if ($type !== null) {
            $description = "{$description} of type [{$type}]";
        }

        $delivered = self::titles($toasts);

        PHPUnit::assertNotEmpty($matches, "Expected the response to deliver {$description}. Delivered: {$delivered}.");
    }

    /**
     * Get the toasts the response delivers.
     *
     * @param  TestResponse<Response>  $response
     * @return list<array<string, mixed>>
     */
    public static function from(TestResponse $response): array
    {
        $key = FlashedToasts::key();
        $base = $response->baseResponse;
        $original = $base->original ?? null;

        $sources = [ToastHeader::get($base)];

        // Toasts flashed for the next page arrive with the page that a redirect or a location response leads
        // to. Any other response leaves them in the session for a later page, so it did not deliver them.
        // Symfony counts a created response as a redirect, but the browser does not follow its location.
        // Inertia turns a redirect to a URL with a fragment into a conflict response with the URL.
        $redirects = $base->isRedirect() && $base->getStatusCode() !== Response::HTTP_CREATED;

        if ($redirects || $base->headers->has(Header::LOCATION) || $base->headers->has(Header::REDIRECT)) {
            $sources[] = Inertia::getFlashed($response->baseRequest)[$key]['toasts'] ?? [];
        }

        if ($base->headers->has(Header::INERTIA)) {
            $sources[] = $response->json("flash.{$key}.toasts") ?? [];
        } elseif ($original instanceof View) {
            $sources[] = $original->getData()['page']['flash'][$key]['toasts'] ?? [];
        }

        return FlashedToasts::filter(Arr::collapse($sources));
    }

    /**
     * Determine if the given toast matches the expected title or callback, and the expected type.
     *
     * @param  array<string, mixed>  $toast
     * @param  (Closure(array<string, mixed>): bool)|string  $expected
     */
    protected static function matches(array $toast, Closure|string $expected, ?string $type): bool
    {
        if ($type !== null && ($toast['type'] ?? 'default') !== $type) {
            return false;
        }

        if (is_string($expected)) {
            return ($toast['title'] ?? null) === $expected;
        }

        return (bool) $expected($toast);
    }

    /**
     * Get the titles and types of the given toasts for the failure messages.
     *
     * @param  list<array<string, mixed>>  $toasts
     */
    protected static function titles(array $toasts): string
    {
        if ($toasts === []) {
            return 'none';
        }

        return collect($toasts)
            ->map(fn (array $toast): string => "[{$toast['title']}] ({$toast['type']})")
            ->implode(', ');
    }
}
