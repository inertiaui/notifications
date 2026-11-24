<?php

namespace InertiaUI\Notifications\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InertiaUI\Notifications\Http\Requests\UpdatePreferencesRequest;
use InertiaUI\Notifications\NotificationPreferences;

/**
 * The notification preferences of the signed-in user, registered with `Route::inertiaNotifications()`.
 */
class PreferencesController extends Controller
{
    /**
     * Get the preferences of the signed-in user.
     */
    public function show(Request $request): JsonResponse
    {
        return response()->json(NotificationPreferences::for($this->user($request)));
    }

    /**
     * Update the preferences of the signed-in user.
     *
     * The response returns every preference. Locked categories, channels without a switch for every category,
     * categories without digests, and categories and channels that the config does not list, keep their state.
     */
    public function update(UpdatePreferencesRequest $request): JsonResponse
    {
        NotificationPreferences::update(
            $this->user($request),
            categories: $request->categories(),
            channels: $request->channels(),
            frequencies: $request->frequencies(),
            timezone: $request->timezone(),
            notificationHours: $request->notificationHours(),
        );

        return response()->json(NotificationPreferences::for($this->user($request)));
    }
}
