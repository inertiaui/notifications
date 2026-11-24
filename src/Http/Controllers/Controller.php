<?php

namespace InertiaUI\Notifications\Http\Controllers;

use Closure;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * The base of the notification center's controllers.
 */
abstract class Controller
{
    /**
     * Get the signed-in user.
     *
     * The notification center stores notifications by the morph class and key of a model, so a signed-in
     * user that is not an Eloquent model is refused.
     */
    protected function user(Request $request): Model
    {
        $user = $request->user();

        abort_unless($user instanceof Model, 403);

        return $user;
    }

    /**
     * Get the middleware that finds no endpoint unless the given condition is true.
     *
     * The condition runs with each request, before its form request is validated.
     *
     * @param  Closure(): bool  $condition
     */
    protected static function notFoundUnless(Closure $condition): Closure
    {
        return function (Request $request, Closure $next) use ($condition): Response {
            abort_unless($condition(), 404);

            return $next($request);
        };
    }
}
