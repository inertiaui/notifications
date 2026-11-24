<?php

namespace InertiaUI\Notifications\WebPush;

use InertiaUI\Notifications\Models\PushSubscription;

/**
 * The outcome of a push to one subscription: the status that its push service answered with and the reason
 * that it gave, or the reason that the push was not sent.
 */
class PushResult
{
    /**
     * Create a new push result instance.
     *
     * @param  int|null  $status  The HTTP status of the push service, or null when nothing was sent.
     * @param  string|null  $reason  The reason that the push service gave, or the reason that nothing was sent.
     * @param  bool  $removed  Indicates if the subscription was removed, since it no longer receives pushes.
     */
    public function __construct(
        public readonly PushSubscription $subscription,
        public readonly ?int $status,
        public readonly ?string $reason = null,
        public readonly bool $removed = false,
    ) {}

    /**
     * Create a result for a subscription that expired, which was removed without sending.
     */
    public static function expired(PushSubscription $subscription): self
    {
        return new self($subscription, null, 'The subscription expired.', removed: true);
    }

    /**
     * Create a result for a subscription of a push service that left the `push.hosts` config, which was skipped.
     */
    public static function unlistedHost(PushSubscription $subscription): self
    {
        return new self(
            $subscription,
            null,
            "The push service [{$subscription->host()}] is not in the [inertia-notifications.push.hosts] config.",
        );
    }

    /**
     * Create a result for a subscription made with another VAPID key, which was skipped.
     */
    public static function madeWithAnotherKey(PushSubscription $subscription): self
    {
        return new self($subscription, null, 'The browser subscribed with another VAPID public key.');
    }

    /**
     * Determine if the push service accepted the push.
     */
    public function delivered(): bool
    {
        return $this->status !== null && $this->status >= 200 && $this->status < 300;
    }
}
