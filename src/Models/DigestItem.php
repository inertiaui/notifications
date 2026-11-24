<?php

namespace InertiaUI\Notifications\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Carbon;

/**
 * One channel of a notification that waits for the notifiable model's next digest.
 *
 * @property int $id
 * @property string $notifiable_type
 * @property int|string $notifiable_id
 * @property string $notification_id
 * @property string $type
 * @property string $category
 * @property string $channel
 * @property array<string, mixed> $data
 * @property bool $unless_read
 * @property bool $in_inbox
 * @property Carbon $digest_at
 * @property Carbon $send_at
 * @property Carbon $created_at
 * @property Carbon $updated_at
 *
 * @phpstan-type HeldNotification array{
 *     id: string,
 *     type: string,
 *     category: string,
 *     channel: string,
 *     data: array<string, mixed>,
 *     collapsed?: array<string, mixed>|null,
 *     created_at: string,
 * }
 */
class DigestItem extends Model
{
    /**
     * The guarded attributes on the model.
     *
     * @var array<string>
     */
    protected $guarded = [];

    /**
     * Get the table associated with the model.
     */
    public function getTable(): string
    {
        return (string) config('inertia-notifications.digests.table', 'notification_digest_items');
    }

    /**
     * Get the notifiable entity that the digest is sent to.
     *
     * @return MorphTo<Model, $this>
     */
    public function notifiable(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * Scope a query to only include the notifications whose digest is due.
     *
     * @param  Builder<self>  $query
     */
    public function scopeDue(Builder $query): void
    {
        $query->where('send_at', '<=', now());
    }

    /**
     * Get the notification as the digest notification receives it.
     *
     * @return HeldNotification
     */
    public function toDigestArray(): array
    {
        return [
            'id' => $this->notification_id,
            'type' => $this->type,
            'category' => $this->category,
            'channel' => $this->channel,
            'data' => $this->data,
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'data' => 'array',
            'unless_read' => 'boolean',
            'in_inbox' => 'boolean',
            'digest_at' => 'datetime',
            'send_at' => 'datetime',
        ];
    }
}
