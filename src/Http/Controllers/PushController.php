<?php

namespace InertiaUI\Notifications\Http\Controllers;

use Illuminate\Filesystem\Filesystem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Routing\Controllers\HasMiddleware;
use Illuminate\Routing\Controllers\Middleware;
use InertiaUI\Notifications\Http\Requests\SubscribePushRequest;
use InertiaUI\Notifications\Http\Requests\UnsubscribePushRequest;
use InertiaUI\Notifications\Models\PushSubscription;
use InertiaUI\Notifications\Push;

/**
 * The endpoints of web push, registered with `Route::inertiaNotifications()`: storing and removing the push
 * subscription of the current browser, listing and removing the user's devices, and serving the service worker
 * that shows the pushes. The browser's cookie holds the hash of its endpoint, so the shared prop tells whether
 * this browser receives pushes.
 */
class PushController extends Controller implements HasMiddleware
{
    /**
     * Get the middleware that should be assigned to the controller.
     *
     * The endpoints are not found while push is not enabled, also before their request is validated.
     *
     * @return list<Middleware>
     */
    public static function middleware(): array
    {
        return [
            new Middleware(self::notFoundUnless(Push::enabled(...))),
        ];
    }

    /**
     * Store the push subscription of the current browser for the signed-in user.
     *
     * The check that a page runs on its own sends `refresh`, which only saves the subscription of a device that the
     * user still has. A page that loaded before the user removed the device, such as from another device, would
     * otherwise bring it back.
     */
    public function subscribe(SubscribePushRequest $request): JsonResponse
    {
        $user = $this->user($request);

        if ($request->refresh() && ! Push::currentDeviceOf($user) instanceof PushSubscription) {
            return response()
                ->json(['subscribed' => false])
                ->withCookie(Push::forgetDeviceCookie());
        }

        $subscription = Push::subscribe($user, $request->subscription(), Push::currentEndpointHash());

        return response()
            ->json(['subscribed' => true])
            ->withCookie(Push::deviceCookie($subscription));
    }

    /**
     * Remove the push subscription of the given endpoint from the signed-in user.
     */
    public function unsubscribe(UnsubscribePushRequest $request): JsonResponse
    {
        Push::unsubscribe($this->user($request), $request->endpoint());

        return response()
            ->json(['subscribed' => false])
            ->withCookie(Push::forgetDeviceCookie());
    }

    /**
     * Get the devices that receive the pushes of the signed-in user.
     */
    public function devices(Request $request): JsonResponse
    {
        return response()->json(['devices' => Push::devicesOf($this->user($request))]);
    }

    /**
     * Remove the push subscription of one of the signed-in user's devices, such as a phone the user no longer has.
     *
     * Removing a device that is already gone, or that belongs to another user, changes nothing.
     */
    public function removeDevice(Request $request): JsonResponse
    {
        // Laravel passes the route's parameters to an action by position, so under a prefix with its own
        // parameter, such as a team's `{current_team}`, we will read the device's key by its name.
        $device = (string) $request->route('device');

        Push::removeDevice($this->user($request), $device);

        return response()->json(['removed' => true]);
    }

    /**
     * Serve the service worker.
     *
     * Browsers check the script for updates when it is not cached, and the shared prop links it with the
     * version of its file, so a browser installs a new service worker once the package updates it.
     */
    public function worker(Filesystem $files): Response
    {
        return response($files->get(Push::workerPath()), 200, [
            'Content-Type' => 'text/javascript; charset=utf-8',
            'Cache-Control' => 'no-cache',
        ]);
    }
}
