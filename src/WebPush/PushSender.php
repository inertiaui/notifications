<?php

namespace InertiaUI\Notifications\WebPush;

use Illuminate\Http\Client\Pool;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use InertiaUI\Notifications\Models\PushSubscription;
use InertiaUI\Notifications\Push;
use Throwable;

/**
 * Sends a push to the push services of the given subscriptions, encrypted for each browser and signed with the
 * application's VAPID keys. A subscription that its push service no longer knows is removed, and so is one
 * that expired. A subscription whose push service left the `push.hosts` config is skipped and kept, so it
 * receives pushes again once its host is back. The queued job and the `test-push` command share this sender.
 */
class PushSender
{
    /**
     * The statuses with which a push service answers for a subscription that no longer exists.
     *
     * @var list<int>
     */
    protected const array GONE = [404, 410];

    /**
     * The seconds that a push service may take to answer.
     */
    protected const int TIMEOUT = 10;

    /**
     * Send the given push to the given subscriptions, and get the result of each.
     *
     * @param  iterable<PushSubscription>  $subscriptions
     * @return list<PushResult>
     *
     * @throws VapidException
     */
    public function send(iterable $subscriptions, PushPayload $payload): array
    {
        $vapidPublicKey = Push::keys()->publicKeyAsBase64Url();
        $results = [];
        $deliverable = [];

        foreach ($subscriptions as $subscription) {
            if ($subscription->isExpired()) {
                $subscription->delete();

                $results[] = PushResult::expired($subscription);
            } elseif (! Push::allowsEndpoint($subscription->endpoint)) {
                $results[] = PushResult::unlistedHost($subscription);
            } elseif (! $subscription->madeWith($vapidPublicKey)) {
                $results[] = PushResult::madeWithAnotherKey($subscription);
            } else {
                $deliverable[] = $subscription;
            }
        }

        if ($deliverable === []) {
            return $results;
        }

        return [...$results, ...$this->deliver($deliverable, $payload)];
    }

    /**
     * Send the given push to the push services of the given subscriptions at once.
     *
     * @param  non-empty-list<PushSubscription>  $subscriptions
     * @return list<PushResult>
     *
     * @throws VapidException
     */
    protected function deliver(array $subscriptions, PushPayload $payload): array
    {
        $vapid = Push::vapid();
        $json = $payload->toJson();
        $expiresAt = now()->addHours(12);

        $headers = [
            'Content-Encoding' => 'aes128gcm',
            'TTL' => (string) Push::ttl(),
            'Urgency' => 'normal',
            'Topic' => $payload->topic(),
        ];

        $responses = Http::pool(function (Pool $pool) use ($subscriptions, $vapid, $json, $expiresAt, $headers): void {
            foreach ($subscriptions as $subscription) {
                $authorization = $vapid->authorization($subscription->endpoint, $expiresAt);

                $pool->as((string) $subscription->id)
                    ->withHeaders([...$headers, 'Authorization' => $authorization])
                    ->timeout(self::TIMEOUT)
                    ->withBody($this->encrypt($json, $subscription), 'application/octet-stream')
                    ->post($subscription->endpoint);
            }
        });

        return array_map(
            fn (PushSubscription $subscription): PushResult => $this->handleResponse(
                $subscription,
                $responses[$subscription->id] ?? null,
            ),
            $subscriptions,
        );
    }

    /**
     * Encrypt the given payload for the browser of the given subscription.
     */
    protected function encrypt(string $payload, PushSubscription $subscription): string
    {
        return PayloadEncrypter::make()->encrypt($payload, $subscription->publicKey(), $subscription->authSecret());
    }

    /**
     * Handle the push service's answer for the push to the given subscription, and get the result.
     *
     * A subscription that the push service no longer knows is deleted, and a push that it refused is logged.
     * The answer is an exception when the push service could not be reached.
     */
    protected function handleResponse(PushSubscription $subscription, mixed $response): PushResult
    {
        if (! $response instanceof Response) {
            return $this->unreachable($subscription, $response);
        }

        if ($response->successful()) {
            return new PushResult($subscription, $response->status());
        }

        if (in_array($response->status(), self::GONE, true)) {
            $subscription->delete();

            return new PushResult($subscription, $response->status(), self::reason($response), removed: true);
        }

        Log::warning("The push service [{$subscription->host()}] refused a push with status [{$response->status()}].", [
            'subscription' => $subscription->id,
            'status' => $response->status(),
            'body' => $response->body(),
        ]);

        return new PushResult($subscription, $response->status(), self::reason($response));
    }

    /**
     * Get the result of a push whose push service could not be reached.
     */
    protected function unreachable(PushSubscription $subscription, mixed $exception): PushResult
    {
        $reason = $exception instanceof Throwable ? $exception->getMessage() : 'The push service did not answer.';

        Log::warning("The push service [{$subscription->host()}] could not be reached.", [
            'subscription' => $subscription->id,
            'reason' => $reason,
        ]);

        return new PushResult($subscription, null, $reason);
    }

    /**
     * Get the reason that the push service gave for its answer.
     *
     * Apple answers with a JSON `reason`, Mozilla with a JSON `message`, and Google with plain text.
     */
    protected static function reason(Response $response): ?string
    {
        $reason = $response->json('reason') ?? $response->json('message') ?? $response->json('error.message');

        if (is_string($reason) && $reason !== '') {
            return $reason;
        }

        $body = trim(strip_tags($response->body()));

        return $body === '' ? $response->reason() : Str::limit(Str::squish($body), 200);
    }
}
