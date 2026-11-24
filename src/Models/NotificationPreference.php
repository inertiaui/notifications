<?php

namespace InertiaUI\Notifications\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Carbon;

/**
 * A user's choice to receive or skip one category of notifications on one channel.
 * Without a row, the category is on, unless it is an opt-in category. A row whose
 * category is `*` turns the channel on or off for every category. A row whose
 * channel is `*` holds settings instead: those of its category, such as the
 * digest frequency, or the user's own when its category is `*` as well.
 *
 * @property int $id
 * @property string $notifiable_type
 * @property int|string $notifiable_id
 * @property string $category
 * @property string $channel
 * @property bool|null $enabled
 * @property array<string, mixed>|null $settings
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
class NotificationPreference extends Model
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
        return (string) config('inertia-notifications.preferences.table', 'notification_preferences');
    }

    /**
     * Get the notifiable entity that the preference belongs to.
     *
     * @return MorphTo<Model, $this>
     */
    public function notifiable(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return ['enabled' => 'boolean', 'settings' => 'array'];
    }
}
