<?php

namespace InertiaUI\Notifications;

use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Inertia\Inertia;

/**
 * Reads and writes the toasts in Inertia's flash data, under the configured key:
 * `flash.inertiaui.toasts` by default.
 */
class FlashedToasts
{
    /**
     * Get the key the toasts are flashed under.
     */
    public static function key(): string
    {
        return (string) config('inertia-notifications.flash_key', 'inertiaui');
    }

    /**
     * Get the flashed toasts.
     *
     * @return list<array<string, mixed>>
     */
    public static function get(?Request $request = null): array
    {
        $bag = Inertia::getFlashed($request)[self::key()] ?? null;

        // The application may flash anything under our key, so we will ignore
        // whatever is flashed there that is not a list of toasts.
        if (! is_array($bag)) {
            return [];
        }

        return self::filter($bag['toasts'] ?? null);
    }

    /**
     * Replace the flashed toasts.
     *
     * Anything else flashed under the same key is kept.
     *
     * @param  list<array<string, mixed>>  $toasts
     */
    public static function put(array $toasts): void
    {
        if (! request()->hasSession()) {
            return;
        }

        $bag = Inertia::getFlashed()[self::key()] ?? [];

        $bag = Arr::except(is_array($bag) ? $bag : [], 'toasts');

        if ($toasts !== []) {
            Inertia::flash(self::key(), [...$bag, 'toasts' => $toasts]);

            return;
        }

        // Flashing would keep all the flash data for another request, so we will forget the toasts
        // instead, and the rest of the flash data still ages out after the request it was for.
        Inertia::forgetFlashed($bag === [] ? self::key() : self::key().'.toasts');
    }

    /**
     * Flash the given toast.
     *
     * @param  array<string, mixed>  $toast
     */
    public static function push(array $toast): void
    {
        self::put([...self::get(), $toast]);
    }

    /**
     * Get the toasts in the given value, leaving out anything that is not a toast.
     *
     * @internal
     *
     * @return list<array<string, mixed>>
     */
    public static function filter(mixed $toasts): array
    {
        if (! is_array($toasts)) {
            return [];
        }

        return collect($toasts)
            ->filter(fn (mixed $toast): bool => is_array($toast))
            ->values()
            ->all();
    }
}
