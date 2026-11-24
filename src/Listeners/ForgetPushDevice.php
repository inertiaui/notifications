<?php

namespace InertiaUI\Notifications\Listeners;

use Illuminate\Auth\Events\Login;
use Illuminate\Auth\Events\Logout;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cookie;
use InertiaUI\Notifications\Models\PushSubscription;
use InertiaUI\Notifications\Push;

/**
 * Removes the push subscription of the current browser when its user signs out, and when another user signs in,
 * so the next person on a shared computer does not receive the pushes of the previous user.
 */
class ForgetPushDevice
{
    /**
     * Handle the event.
     */
    public function handle(Login|Logout $event): void
    {
        if (! Push::enabled()) {
            return;
        }

        $endpointHash = Push::currentEndpointHash();

        if ($endpointHash === null) {
            return;
        }

        $subscription = PushSubscription::query()->where('endpoint_hash', $endpointHash)->first();

        if ($event instanceof Login && $this->belongsToUser($subscription, $event->user)) {
            return;
        }

        $subscription?->delete();

        Cookie::queue(Push::forgetDeviceCookie());
    }

    /**
     * Determine if the given subscription belongs to the given user, who keeps it when signing in again.
     */
    protected function belongsToUser(?PushSubscription $subscription, mixed $user): bool
    {
        return $subscription instanceof PushSubscription
            && $user instanceof Model
            && $subscription->belongsToNotifiable($user);
    }
}
