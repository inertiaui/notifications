<?php

namespace InertiaUI\Notifications\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * The state of an announcement for one notifiable model, stored once that model changes it.
 *
 * The table's key is the announcement and the notifiable model, and its columns do not share a name with
 * the announcements table, so the queries that join both may use the columns of either one.
 *
 * @property string $announcement_id
 * @property string $notifiable_type
 * @property int|string $notifiable_id
 * @property Carbon|null $read_at
 * @property Carbon|null $seen_at
 * @property Carbon|null $archived_at
 * @property Carbon|null $snoozed_until
 * @property Carbon|null $dismissed_at
 */
class InboxAnnouncementState extends Model
{
    /**
     * The columns of the table's primary key.
     *
     * @var list<string>
     */
    protected const array KEY_COLUMNS = ['announcement_id', 'notifiable_type', 'notifiable_id'];

    /**
     * The number of states that one query stores at most.
     */
    protected const int STORE_CHUNK_SIZE = 100;

    /**
     * Indicates if the IDs are auto-incrementing.
     *
     * @var bool
     */
    public $incrementing = false;

    /**
     * Indicates if the model should be timestamped.
     *
     * @var bool
     */
    public $timestamps = false;

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
        return (string) config('inertia-notifications.inbox.announcement_states_table', 'inbox_announcement_states');
    }

    /**
     * Store the given state of the announcements for the notifiable model, whether it has a state of them or not.
     *
     * The columns that the values leave out keep their stored values.
     *
     * @param  list<string>  $announcements
     * @param  array<string, mixed>  $values
     */
    public static function storeFor(Model $notifiable, array $announcements, array $values): void
    {
        $rows = array_map(fn (string $announcement): array => [
            'announcement_id' => $announcement,
            'notifiable_type' => $notifiable->getMorphClass(),
            'notifiable_id' => $notifiable->getKey(),
            ...$values,
        ], $announcements);

        // Every row binds each of its columns to the query, so we will store the rows in chunks to
        // keep each query below the number of bindings that databases allow, such as the
        // limit of about 2,100 parameters in SQL Server.
        foreach (array_chunk($rows, self::STORE_CHUNK_SIZE) as $chunk) {
            static::query()->upsert($chunk, self::KEY_COLUMNS, array_keys($values));
        }
    }

    /**
     * Set the keys for a select query.
     *
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    protected function setKeysForSelectQuery($query): Builder
    {
        foreach (self::KEY_COLUMNS as $column) {
            $query->where($column, '=', $this->original[$column] ?? $this->getAttribute($column));
        }

        return $query;
    }

    /**
     * Set the keys for a save update query.
     *
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    protected function setKeysForSaveQuery($query): Builder
    {
        return $this->setKeysForSelectQuery($query);
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'read_at' => 'datetime',
            'seen_at' => 'datetime',
            'archived_at' => 'datetime',
            'snoozed_until' => 'datetime',
            'dismissed_at' => 'datetime',
        ];
    }
}
