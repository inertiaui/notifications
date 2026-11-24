<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * The demo has no login page: every request is signed in as the demo user.
 */
class SignInDemoUser
{
    public function handle(Request $request, Closure $next): Response
    {
        Auth::setUser(User::demo());

        return $next($request);
    }
}
