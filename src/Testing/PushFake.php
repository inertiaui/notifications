<?php

namespace InertiaUI\Notifications\Testing;

use Illuminate\Database\Eloquent\Model;
use InertiaUI\Notifications\Models\PushSubscription;
use InertiaUI\Notifications\WebPush\PushPayload;
use InertiaUI\Notifications\WebPush\PushResult;
use InertiaUI\Notifications\WebPush\PushSender;

/**
 * Records the pushes while `Push::fake()` is active, instead of sending them. Each subscription that a push
 * would reach records the payload that its browser would decrypt, and expired subscriptions are removed
 * and subscriptions made with another VAPID key are skipped, as the real sender does.
 */
class PushFake extends PushSender
{
    /**
     * The recorded pushes, each with its subscription and its payload, in the order they were sent.
     *
     * @var list<array{subscription: PushSubscription, payload: array<string, mixed>}>
     */
    protected array $pushes = [];

    /**
     * Record the given push to the given subscriptions, as their push services accepting it.
     *
     * @param  non-empty-list<PushSubscription>  $subscriptions
     * @return list<PushResult>
     */
    protected function deliver(array $subscriptions, PushPayload $payload): array
    {
        $decoded = json_decode($payload->toJson(), true);

        foreach ($subscriptions as $subscription) {
            $this->pushes[] = ['subscription' => $subscription, 'payload' => $decoded];
        }

        return array_map(
            fn (PushSubscription $subscription): PushResult => new PushResult($subscription, 201),
            $subscriptions,
        );
    }

    /**
     * Get the notifications of the pushes to the subscriptions of the given notifiable model, or of every push.
     *
     * Each notification has the keys of the payload's `notification`, such as `title`, `body`, `navigate`, and
     * `tag`, with the subscription's ID under `subscription`.
     *
     * @return list<array<string, mixed>>
     */
    public function pushed(?Model $notifiable = null): array
    {
        return collect($this->pushes)
            ->filter(fn (array $push): bool => ! $notifiable instanceof Model
                || $push['subscription']->belongsToNotifiable($notifiable))
            ->map(fn (array $push): array => [
                ...$push['payload']['notification'],
                'subscription' => $push['subscription']->id,
            ])
            ->values()
            ->all();
    }

    /**
     * Get the recorded pushes, each with its subscription and the whole payload.
     *
     * @return list<array{subscription: PushSubscription, payload: array<string, mixed>}>
     */
    public function recordedPushes(): array
    {
        return $this->pushes;
    }
}
