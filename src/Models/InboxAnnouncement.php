<?php

namespace InertiaUI\Notifications\Models;

use DateTimeInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\MassPrunable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Query\JoinClause;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection as BaseCollection;
use InertiaUI\Notifications\Announcement;
use InertiaUI\Notifications\Inbox;
use InertiaUI\Notifications\NotificationPreferences;
use LogicException;

/**
 * An announcement in the notification center, stored once for every user in its audience.
 *
 * Loaded with `inboxQuery()`, the announcement also holds the state of one notifiable model, such as the
 * time that model read it, and its methods change that state.
 *
 * @property string $id
 * @property string|null $audience
 * @property string|null $category
 * @property string|null $context_type
 * @property int|string|null $context_id
 * @property array<string, mixed> $data
 * @property Carbon|null $expires_at
 * @property Carbon|null $read_at
 * @property Carbon|null $seen_at
 * @property Carbon|null $archived_at
 * @property Carbon|null $snoozed_until
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
class InboxAnnouncement extends Model
{
    use HasUuids, MassPrunable;

    /**
     * The type of the announcements in the notification center.
     */
    public const string TYPE = 'announcement';

    /**
     * The columns of the notifiable model's state that `inboxQuery()` selects.
     *
     * @var list<string>
     */
    protected const array STATE_COLUMNS = ['read_at', 'seen_at', 'archived_at', 'snoozed_until'];

    /**
     * The time, in microseconds, before the announcement was read from the database.
     */
    public ?int $revision = null;

    /**
     * The notifiable model whose state of the announcement was loaded.
     */
    public ?Model $notifiable = null;

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
        return (string) config('inertia-notifications.inbox.announcements_table', 'inbox_announcements');
    }

    /**
     * Get a new query builder for the announcements in the notifiable model's notification center.
     *
     * Each announcement holds the notifiable model's state of it, such as the time it was read.
     *
     * @return Builder<static>
     */
    public static function inboxQuery(Model $notifiable, ?Model $context): Builder
    {
        $query = static::query()->visibleTo($notifiable, $context);
        $state = new InboxAnnouncementState;

        return $query->select($query->getModel()->qualifyColumn('*'))
            ->addSelect(array_map($state->qualifyColumn(...), self::STATE_COLUMNS))
            ->afterQuery(function (BaseCollection $results) use ($notifiable): void {
                foreach ($results->whereInstanceOf(self::class) as $announcement) {
                    $announcement->notifiable = $notifiable;
                }
            });
    }

    /**
     * Get the audiences that include the notifiable model, among those of the announcements that have not expired.
     *
     * @return list<string>
     */
    public static function audiencesOf(Model $notifiable): array
    {
        return static::query()
            ->unexpired()
            ->whereNotNull('audience')
            ->distinct()
            ->pluck('audience')
            ->filter(fn (string $audience): bool => Announcement::includes($audience, $notifiable))
            ->values()
            ->all();
    }

    /**
     * Update the notifiable model's state of the announcements of the given query.
     *
     * The notifiable model's state of each announcement is stored when it has none yet.
     *
     * @param  Builder<self>  $query
     * @param  array<string, mixed>  $values
     */
    public static function updateStates(Builder $query, Model $notifiable, array $values): void
    {
        $announcements = $query->pluck($query->getModel()->getQualifiedKeyName())->all();

        InboxAnnouncementState::storeFor($notifiable, $announcements, $values);
    }

    /**
     * Get the context that the announcement belongs to, such as a team.
     *
     * @return MorphTo<Model, $this>
     */
    public function context(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * Get the states of the announcement, one for each notifiable model that changed it.
     *
     * @return HasMany<InboxAnnouncementState, $this>
     */
    public function states(): HasMany
    {
        return $this->hasMany(InboxAnnouncementState::class, 'announcement_id');
    }

    /**
     * Scope a query to the announcements that the notifiable model sees in the given context.
     *
     * These are the announcements that have not expired, whose audience includes the notifiable model, whose
     * category it receives in the notification center, and that it did not delete. An announcement with a
     * context only shows in that context, so it shows to nobody without a context resolver.
     *
     * @param  Builder<self>  $query
     */
    public function scopeVisibleTo(Builder $query, Model $notifiable, ?Model $context): void
    {
        $table = $this->getTable();
        $states = (new InboxAnnouncementState)->getTable();

        $query->leftJoin($states, fn (JoinClause $join) => $join->on("{$states}.announcement_id", '=', "{$table}.id")
            ->where("{$states}.notifiable_type", $notifiable->getMorphClass())
            ->where("{$states}.notifiable_id", $notifiable->getKey()));

        $query->whereNull("{$states}.dismissed_at")
            ->unexpired()
            ->where(fn (Builder $query) => $query->whereNull("{$table}.audience")
                ->orWhereIn("{$table}.audience", self::audiencesOf($notifiable)));

        $this->applyContext($query, $context);
        $this->applyPreferences($query, $notifiable);
    }

    /**
     * Scope a query to only include the announcements that have not expired.
     *
     * @param  Builder<self>  $query
     */
    public function scopeUnexpired(Builder $query): void
    {
        $column = $this->qualifyColumn('expires_at');

        $query->where(fn (Builder $query) => $query->whereNull($column)->orWhere($column, '>', now()));
    }

    /**
     * Scope a query to only include the announcements in the notifiable model's inbox.
     *
     * These are the announcements that it did not archive, and did not snooze until a time that has not come.
     *
     * @param  Builder<self>  $query
     */
    public function scopeActive(Builder $query): void
    {
        $snoozedUntil = $this->stateColumn('snoozed_until');

        $query->whereNull($this->stateColumn('archived_at'))
            ->where(fn (Builder $query) => $query->whereNull($snoozedUntil)->orWhere($snoozedUntil, '<=', now()));
    }

    /**
     * Scope a query to only include the announcements that the notifiable model has not read.
     *
     * @param  Builder<self>  $query
     */
    public function scopeUnread(Builder $query): void
    {
        $query->whereNull($this->stateColumn('read_at'));
    }

    /**
     * Scope a query to only include the announcements that the notifiable model has read.
     *
     * @param  Builder<self>  $query
     */
    public function scopeRead(Builder $query): void
    {
        $query->whereNotNull($this->stateColumn('read_at'));
    }

    /**
     * Scope a query to only include the announcements that the notifiable model has not seen.
     *
     * @param  Builder<self>  $query
     */
    public function scopeUnseen(Builder $query): void
    {
        $query->whereNull($this->stateColumn('seen_at'));
    }

    /**
     * Scope a query to only include the announcements that the notifiable model has not archived.
     *
     * @param  Builder<self>  $query
     */
    public function scopeUnarchived(Builder $query): void
    {
        $query->whereNull($this->stateColumn('archived_at'));
    }

    /**
     * Scope a query to only include the announcements that the notifiable model has archived.
     *
     * @param  Builder<self>  $query
     */
    public function scopeArchived(Builder $query): void
    {
        $query->whereNotNull($this->stateColumn('archived_at'));
    }

    /**
     * Scope a query to only include the announcements that the notifiable model snoozed until a time that has not come.
     *
     * @param  Builder<self>  $query
     */
    public function scopeSnoozed(Builder $query): void
    {
        $query->whereNull($this->stateColumn('archived_at'))->where($this->stateColumn('snoozed_until'), '>', now());
    }

    /**
     * Mark the announcement as read for the notifiable model.
     *
     * This also marks the announcement as seen.
     */
    public function markAsRead(): void
    {
        if ($this->read_at === null) {
            $this->updateState(['read_at' => now(), 'seen_at' => $this->seen_at ?? now()]);
        }
    }

    /**
     * Mark the announcement as unread for the notifiable model.
     */
    public function markAsUnread(): void
    {
        if ($this->read_at !== null) {
            $this->updateState(['read_at' => null]);
        }
    }

    /**
     * Mark the announcement as seen for the notifiable model.
     */
    public function markAsSeen(): void
    {
        if ($this->seen_at === null) {
            $this->updateState(['seen_at' => now()]);
        }
    }

    /**
     * Archive the announcement for the notifiable model.
     */
    public function archive(): void
    {
        if ($this->archived_at === null) {
            $this->updateState(['archived_at' => now()]);
        }
    }

    /**
     * Unarchive the announcement for the notifiable model.
     */
    public function unarchive(): void
    {
        if ($this->archived_at !== null) {
            $this->updateState(['archived_at' => null]);
        }
    }

    /**
     * Snooze the announcement for the notifiable model until the given time.
     */
    public function snooze(DateTimeInterface $until): void
    {
        $this->updateState(['snoozed_until' => Inbox::inApplicationTimezone($until)]);
    }

    /**
     * Unsnooze the announcement for the notifiable model.
     */
    public function unsnooze(): void
    {
        if ($this->snoozed_until !== null) {
            $this->updateState(['snoozed_until' => null]);
        }
    }

    /**
     * Remove the announcement from the notifiable model's notification center, while others still see it.
     */
    public function dismiss(): void
    {
        $this->updateState(['dismissed_at' => now()]);
    }

    /**
     * Determine if the notifiable model has read the announcement.
     */
    public function isRead(): bool
    {
        return $this->read_at !== null;
    }

    /**
     * Get the prunable model query.
     *
     * The query covers the announcements that expired, and those older than `prune_after_days` days.
     *
     * @return Builder<static>
     */
    public function prunable(): Builder
    {
        $days = config('inertia-notifications.inbox.prune_after_days', 90);

        return static::query()->where(fn (Builder $query) => $query->where('expires_at', '<=', now())->when(
            is_numeric($days),
            fn (Builder $query) => $query->orWhere('created_at', '<', now()->subDays((int) $days)),
        ));
    }

    /**
     * Convert the model instance to an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return $this->toInboxArray();
    }

    /**
     * Get the announcement as the frontend receives it, with the notifiable model's state.
     *
     * An announcement has the shape of a notification, with `announcement` set to true, so the notification
     * center shows both alike. The text is translated in the current locale.
     *
     * @return array<string, mixed>
     */
    public function toInboxArray(): array
    {
        $model = Inbox::model();
        $notification = (new $model)->forceFill([
            'id' => $this->id,
            'type' => self::TYPE,
            'category' => $this->category,
            'context_type' => $this->context_type,
            'context_id' => $this->context_id,
            'data' => $this->data,
            'read_at' => $this->read_at,
            'seen_at' => $this->seen_at,
            'archived_at' => $this->archived_at,
            'snoozed_until' => $this->snoozed_until,
            'created_at' => $this->created_at,
        ]);

        $notification->revision = $this->revision;

        return [
            ...$notification->toInboxArray(),
            'announcement' => true,
            'expiresAt' => $this->expires_at?->toIso8601String(),
        ];
    }

    /**
     * Store the given state of the announcement for the notifiable model.
     *
     * @param  array<string, mixed>  $values
     */
    protected function updateState(array $values): void
    {
        if (! $this->notifiable instanceof Model) {
            throw new LogicException(
                "Load the announcement [{$this->id}] with InboxAnnouncement::inboxQuery() to change its state.",
            );
        }

        InboxAnnouncementState::storeFor($this->notifiable, [$this->id], $values);

        $this->forceFill($values)->syncOriginalAttributes(array_keys($values));
    }

    /**
     * Limit the given query to the announcements of the given context and those without a context.
     *
     * @param  Builder<self>  $query
     */
    protected function applyContext(Builder $query, ?Model $context): void
    {
        $type = $this->qualifyColumn('context_type');
        $id = $this->qualifyColumn('context_id');

        if (! $context instanceof Model) {
            $query->whereNull($type);

            return;
        }

        $query->where(fn (Builder $query) => $query->whereNull($type)->orWhere(
            fn (Builder $query) => $query->where($type, $context->getMorphClass())->where($id, $context->getKey()),
        ));
    }

    /**
     * Leave out the announcements of the categories that the notifiable model turned off for the notification center.
     *
     * @param  Builder<self>  $query
     */
    protected function applyPreferences(Builder $query, Model $notifiable): void
    {
        $disabled = NotificationPreferences::disabledCategories($notifiable, 'inbox');

        if ($disabled === []) {
            return;
        }

        $column = $this->qualifyColumn('category');

        $query->where(fn (Builder $query) => $query->whereNull($column)->orWhereNotIn($column, $disabled));
    }

    /**
     * Get the given column of the notifiable model's state, qualified with the table of the states.
     */
    protected function stateColumn(string $column): string
    {
        return (new InboxAnnouncementState)->qualifyColumn($column);
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
            'expires_at' => 'datetime',
            'read_at' => 'datetime',
            'seen_at' => 'datetime',
            'archived_at' => 'datetime',
            'snoozed_until' => 'datetime',
        ];
    }
}
