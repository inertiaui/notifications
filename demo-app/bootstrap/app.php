<?php

use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\SignInDemoUser;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use InertiaUI\Notifications\Http\Middleware\AddFlashedToastsToResponseHeaders;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Development portals and preview hosts proxy HTTPS to the local server.
        $middleware->trustProxies(at: '*');

        // Before the group's other middleware, because Laravel moves the auth middleware ahead of them.
        $middleware->web(prepend: [SignInDemoUser::class], append: [
            AddFlashedToastsToResponseHeaders::class,
            HandleInertiaRequests::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
