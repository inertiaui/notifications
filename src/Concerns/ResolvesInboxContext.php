<?php

namespace InertiaUI\Notifications\Concerns;

use Closure;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

/**
 * Resolves the context of the notification center, such as the signed-in user's team.
 */
trait ResolvesInboxContext
{
    /**
     * The callback that resolves the current context, such as the signed-in user's team.
     *
     * @var (Closure(Request): (Model|null))|null
     */
    protected static ?Closure $contextResolver = null;

    /**
     * Set the callback that resolves the current context, such as the signed-in user's team.
     *
     * The shared prop, the lists, and the bulk endpoints then leave out the notifications of other contexts.
     * Notifications without a context show in every context.
     *
     * @param  (Closure(Request): (Model|null))|null  $callback
     */
    public static function resolveContextUsing(?Closure $callback): void
    {
        static::$contextResolver = $callback;
    }

    /**
     * Get the current context, or null when the application resolves none.
     */
    public static function context(): ?Model
    {
        if (! static::$contextResolver instanceof Closure) {
            return null;
        }

        return (static::$contextResolver)(request());
    }

    /**
     * Get the opaque key of the given context, which the frontend compares.
     */
    public static function contextKey(string $type, int|string|null $id): string
    {
        return hash('xxh128', "{$type}|{$id}");
    }
}
