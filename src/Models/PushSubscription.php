<?php

namespace InertiaUI\Notifications\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Carbon;
use InertiaUI\Notifications\WebPush\Base64Url;

/**
 * A browser that receives the pushes of a notifiable model, as the browser's `PushSubscription` describes it.
 *
 * @property int $id
 * @property string $notifiable_type
 * @property int|string $notifiable_id
 * @property string $endpoint
 * @property string $endpoint_hash
 * @property string $p256dh
 * @property string $auth
 * @property string|null $user_agent
 * @property Carbon|null $expires_at
 * @property string $vapid_public_key
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
class PushSubscription extends Model
{
    /**
     * The guarded attributes on the model.
     *
     * @var array<string>
     */
    protected $guarded = [];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = ['p256dh', 'auth'];

    /**
     * Get the table associated with the model.
     */
    public function getTable(): string
    {
        return (string) config('inertia-notifications.push.table', 'push_subscriptions');
    }

    /**
     * Get the notifiable entity that the subscription belongs to.
     *
     * @return MorphTo<Model, $this>
     */
    public function notifiable(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * Get a query for the subscriptions of the given notifiable model.
     *
     * @return Builder<static>
     */
    public static function of(Model $notifiable): Builder
    {
        return static::query()->whereMorphedTo('notifiable', $notifiable);
    }

    /**
     * Get the SHA-256 hash of the given endpoint, which the subscriptions are unique by.
     */
    public static function hash(string $endpoint): string
    {
        return hash('sha256', $endpoint);
    }

    /**
     * Determine if the subscription belongs to the given notifiable model.
     */
    public function belongsToNotifiable(Model $notifiable): bool
    {
        return $this->notifiable_type === $notifiable->getMorphClass()
            && (string) $this->notifiable_id === (string) $notifiable->getKey();
    }

    /**
     * Determine if the browser said that the subscription expires before now.
     */
    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }

    /**
     * Determine if the browser subscribed with the given VAPID public key.
     */
    public function madeWith(string $vapidPublicKey): bool
    {
        return $this->vapid_public_key === $vapidPublicKey;
    }

    /**
     * Get the host of the push service that the subscription's endpoint belongs to.
     */
    public function host(): string
    {
        return strtolower((string) parse_url($this->endpoint, PHP_URL_HOST));
    }

    /**
     * Get the name of the browser that subscribed, by its user agent, or null for a browser we don't know.
     */
    public function browser(): ?string
    {
        $agent = (string) $this->user_agent;

        return match (true) {
            str_contains($agent, 'Edg/') => 'Edge',
            str_contains($agent, 'OPR/') => 'Opera',
            str_contains($agent, 'Firefox/'), str_contains($agent, 'FxiOS/') => 'Firefox',
            str_contains($agent, 'Chrome/'), str_contains($agent, 'CriOS/') => 'Chrome',
            str_contains($agent, 'Safari/') => 'Safari',
            default => null,
        };
    }

    /**
     * Get the name of the operating system of the browser that subscribed, by its user agent, or null for one we
     * don't know.
     */
    public function platform(): ?string
    {
        $agent = (string) $this->user_agent;

        return match (true) {
            str_contains($agent, 'iPhone') => 'iOS',
            str_contains($agent, 'iPad') => 'iPadOS',
            str_contains($agent, 'Android') => 'Android',
            str_contains($agent, 'Windows') => 'Windows',
            str_contains($agent, 'Mac OS X'), str_contains($agent, 'Macintosh') => 'macOS',
            str_contains($agent, 'CrOS') => 'ChromeOS',
            str_contains($agent, 'Linux') => 'Linux',
            default => null,
        };
    }

    /**
     * Get the `p256dh` key of the browser, as the 65-byte uncompressed point.
     */
    public function publicKey(): string
    {
        return Base64Url::decode($this->p256dh);
    }

    /**
     * Get the `auth` secret of the browser, as 16 bytes.
     */
    public function authSecret(): string
    {
        return Base64Url::decode($this->auth);
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
        ];
    }
}
