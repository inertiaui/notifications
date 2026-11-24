<?php

namespace InertiaUI\Notifications\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * A thread that a notifiable model muted, by the group key of its notifications.
 *
 * @property int $id
 * @property string $notifiable_type
 * @property int|string $notifiable_id
 * @property string $group_key
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
class InboxMute extends Model
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
        return (string) config('inertia-notifications.inbox.mutes_table', 'inbox_mutes');
    }

    /**
     * Get a query for the threads that the notifiable model of the given type and key muted.
     *
     * @return Builder<static>
     */
    public static function of(string $type, int|string $id): Builder
    {
        return static::query()
            ->where('notifiable_type', $type)
            ->where('notifiable_id', $id);
    }

    /**
     * Determine if the notifiable model of the given type and key muted the thread of the given group key.
     *
     * A notification without a group key belongs to no thread, so it is never muted.
     */
    public static function isThreadMuted(string $type, int|string $id, ?string $group): bool
    {
        if ($group === null) {
            return false;
        }

        return static::of($type, $id)
            ->where('group_key', $group)
            ->exists();
    }
}
