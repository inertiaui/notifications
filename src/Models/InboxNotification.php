<?php

namespace InertiaUI\Notifications\Models;

use DateTimeInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\MassPrunable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use InertiaUI\Notifications\Inbox;
use InertiaUI\Notifications\InboxMessage;
use InertiaUI\Notifications\Toast;

/**
 * A notification in the notification center.
 *
 * @property string $id
 * @property string $notifiable_type
 * @property int|string $notifiable_id
 * @property string $type
 * @property string|null $category
 * @property string|null $group_key
 * @property string|null $unique_key
 * @property string|null $context_type
 * @property int|string|null $context_id
 * @property array<string, mixed> $data
 * @property bool $throttled
 * @property bool $quiet
 * @property Carbon|null $read_at
 * @property Carbon|null $seen_at
 * @property Carbon|null $archived_at
 * @property Carbon|null $snoozed_until
 * @property array{label: string, translate: array<string, mixed>|null}|null $result
 * @property Carbon|null $collapses_until
 * @property array{
 *     ids: list<string>,
 *     actors: list<array{key: string, name?: string, avatar?: string}>,
 *     actor_keys: list<string>,
 * }|null $collapsed
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
class InboxNotification extends Model
{
    use MassPrunable;

    /**
     * The most actors that a collapsed notification keeps to show their avatars.
     */
    public const int MAX_ACTORS = 5;

    /**
     * Indicates if the IDs are auto-incrementing.
     *
     * @var bool
     */
    public $incrementing = false;

    /**
     * The time, in microseconds, before the notification was read from the database.
     *
     * `Inbox::paginate()`, `Inbox::record()`, and `Inbox::update()` set it. The frontend keeps the newest
     * copy of each notification by it.
     */
    public ?int $revision = null;

    /**
     * Indicates if the notifiable model muted the thread of the notification, once `Inbox::paginate()` loaded it.
     */
    public ?bool $muted = null;

    /**
     * The "type" of the primary key ID.
     *
     * @var string
     */
    protected $keyType = 'string';

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
        return (string) config('inertia-notifications.inbox.table', 'inbox_notifications');
    }

    /**
     * Get the notifiable entity that the notification belongs to.
     *
     * @return MorphTo<Model, $this>
     */
    public function notifiable(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * Get the context that the notification belongs to, such as a team.
     *
     * @return MorphTo<Model, $this>
     */
    public function context(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * Scope a query to only include the notifications of the given context and those without a context.
     *
     * @param  Builder<self>  $query
     */
    public function scopeInContext(Builder $query, Model $context): void
    {
        $query->where(fn (Builder $query) => $query->whereNull('context_type')->orWhere(
            fn (Builder $query) => $query->where('context_type', $context->getMorphClass())
                ->where('context_id', $context->getKey()),
        ));
    }

    /**
     * Scope a query to only include notifications in the inbox.
     *
     * Notifications in the inbox are not archived and not snoozed.
     *
     * @param  Builder<self>  $query
     */
    public function scopeActive(Builder $query): void
    {
        $query->whereNull('archived_at')
            ->where(fn (Builder $query) => $query->whereNull('snoozed_until')->orWhere('snoozed_until', '<=', now()));
    }

    /**
     * Scope a query to only include unread notifications.
     *
     * @param  Builder<self>  $query
     */
    public function scopeUnread(Builder $query): void
    {
        $query->whereNull('read_at');
    }

    /**
     * Scope a query to only include read notifications.
     *
     * @param  Builder<self>  $query
     */
    public function scopeRead(Builder $query): void
    {
        $query->whereNotNull('read_at');
    }

    /**
     * Scope a query to only include unseen notifications.
     *
     * @param  Builder<self>  $query
     */
    public function scopeUnseen(Builder $query): void
    {
        $query->whereNull('seen_at');
    }

    /**
     * Scope a query to only include archived notifications.
     *
     * @param  Builder<self>  $query
     */
    public function scopeArchived(Builder $query): void
    {
        $query->whereNotNull('archived_at');
    }

    /**
     * Scope a query to only include snoozed notifications.
     *
     * These are notifications snoozed until a time that has not come yet, and not archived.
     *
     * @param  Builder<self>  $query
     */
    public function scopeSnoozed(Builder $query): void
    {
        $query->whereNull('archived_at')->where('snoozed_until', '>', now());
    }

    /**
     * Scope a query to only include snoozed notifications whose time has come.
     *
     * The `inertia-notifications:unsnooze` command brings these notifications back. Archived notifications
     * stay archived, so they are left out.
     *
     * @param  Builder<self>  $query
     */
    public function scopeDueToUnsnooze(Builder $query): void
    {
        $query->whereNull('archived_at')->whereNotNull('snoozed_until')->where('snoozed_until', '<=', now());
    }

    /**
     * Mark the notification as read.
     *
     * This also marks the notification as seen.
     */
    public function markAsRead(): void
    {
        if ($this->read_at === null) {
            $this->forceFill(['read_at' => now(), 'seen_at' => $this->seen_at ?? now()])->save();
        }
    }

    /**
     * Mark the notifications of the given query as read and seen.
     *
     * @param  Builder<self>  $query
     */
    public static function markAsReadInBulk(Builder $query): void
    {
        $query->update(['read_at' => now(), 'seen_at' => now()]);
    }

    /**
     * Mark the notification as unread.
     */
    public function markAsUnread(): void
    {
        if ($this->read_at !== null) {
            $this->forceFill(['read_at' => null])->save();
        }
    }

    /**
     * Mark the notification as seen.
     */
    public function markAsSeen(): void
    {
        if ($this->seen_at === null) {
            $this->forceFill(['seen_at' => now()])->save();
        }
    }

    /**
     * Archive the notification.
     */
    public function archive(): void
    {
        if ($this->archived_at === null) {
            $this->forceFill(['archived_at' => now()])->save();
        }
    }

    /**
     * Unarchive the notification.
     */
    public function unarchive(): void
    {
        if ($this->archived_at !== null) {
            $this->forceFill(['archived_at' => null])->save();
        }
    }

    /**
     * Snooze the notification until the given time.
     *
     * The notification is hidden from the inbox and its counts until then.
     */
    public function snooze(DateTimeInterface $until): void
    {
        $this->forceFill(['snoozed_until' => Inbox::inApplicationTimezone($until)])->save();
    }

    /**
     * Unsnooze the notification.
     */
    public function unsnooze(): void
    {
        if ($this->snoozed_until !== null) {
            $this->forceFill(['snoozed_until' => null])->save();
        }
    }

    /**
     * Bring back the snoozed notification as a new one.
     *
     * The notification becomes unread, unseen, and moves to the top of the list, created at the time it
     * was snoozed until. Returns false, and changes nothing, when the stored notification is no longer
     * due with the same snooze time, such as when it was snoozed again or archived since it was read.
     */
    public function unsnoozeAsNew(): bool
    {
        // We will lock the row and read it again, so a notification that was snoozed again, archived, or
        // brought back by another run since it was read stays as it is, and is only brought back once.
        return $this->getConnection()->transaction(function (): bool {
            $current = $this->newQuery()
                ->whereKey($this->getKey())
                ->dueToUnsnooze()
                ->where('snoozed_until', $this->snoozed_until)
                ->lockForUpdate()
                ->first();

            if (! $current instanceof self) {
                return false;
            }

            $this->setRawAttributes($current->getAttributes(), sync: true);

            $this->forceFill([
                'created_at' => $this->snoozed_until,
                'snoozed_until' => null,
                'read_at' => null,
                'seen_at' => null,
            ])->save();

            return true;
        });
    }

    /**
     * Replace the message of the notification, such as its title, body, actions, and data.
     *
     * The notification keeps its state, its category, group, and context, the notifications that
     * collapsed into it, and the flags of its latest delivery, such as whether it was throttled.
     */
    public function replaceMessage(InboxMessage $message): void
    {
        $this->forceFill(['data' => $message->toArray()])->save();
    }

    /**
     * Fill the notification with the given notification that collapses into it, without saving it.
     *
     * The notification takes the message, type, and category of the given notification, moves to the top
     * as unread and unseen, and adds its actor and its ID. The actors are kept newest first. The result of
     * an earlier action is cleared, since the message brings its own actions.
     */
    public function fillCollapsed(string $id, string $type, InboxMessage $message): static
    {
        $collapsed = $this->collapsed ?? ['ids' => [], 'actors' => [], 'actor_keys' => []];
        $key = $message->getActorKey();
        $keys = $collapsed['actor_keys'];
        $actors = $collapsed['actors'];

        if ($key !== null) {
            $others = array_filter($actors, fn (array $actor): bool => $actor['key'] !== $key);
            $actors = [['key' => $key, ...$message->getActorDetails()], ...$others];
            $keys = collect($keys)->push($key)->uniqueStrict()->values()->all();
        }

        return $this->forceFill([
            'type' => $type,
            'category' => $message->getCategory(),
            'data' => $message->toArray(),
            'collapsed' => [
                'ids' => [...$collapsed['ids'], $id],
                'actors' => array_slice($actors, 0, self::MAX_ACTORS),
                'actor_keys' => $keys,
            ],
            'result' => null,
            'created_at' => now(),
            'read_at' => null,
            'seen_at' => null,
        ]);
    }

    /**
     * Determine if the given notification is this one, or one that collapsed into it.
     */
    public function includesNotification(string $id): bool
    {
        return $this->id === $id || in_array($id, $this->collapsed['ids'] ?? [], true);
    }

    /**
     * Determine if later notifications collapsed into the notification.
     */
    public function isCollapsed(): bool
    {
        return $this->total() > 1;
    }

    /**
     * Determine if the notifiable model muted the thread of the notification's group key.
     */
    public function isMuted(): bool
    {
        // The copies that digests and announcements serialize have neither a group key nor a notifiable
        // model, so we will return before reading the notifiable model's columns, which are null then.
        if ($this->group_key === null) {
            return false;
        }

        return InboxMute::isThreadMuted($this->notifiable_type, $this->notifiable_id, $this->group_key);
    }

    /**
     * Complete the notification with the given result, which it shows in place of its actions.
     *
     * The result is stored untranslated, with its replacements, and translated when the notification is shown.
     *
     * @param  array<string, mixed>  $replace
     */
    public function complete(string $result, array $replace = []): void
    {
        $this->forceFill([
            'result' => ['label' => $result, 'translate' => Toast::storableReplacements($replace)],
        ])->save();
    }

    /**
     * Complete the notification with the result of its action at the given index.
     *
     * Returns false when the notification has no such action, or when the action has no result.
     */
    public function completeAction(int $index): bool
    {
        $action = $this->data['actions'][$index] ?? null;

        if (! is_array($action) || ! is_string($action['result'] ?? null)) {
            return false;
        }

        $this->forceFill([
            'result' => ['label' => $action['result'], 'translate' => $action['translate']['result'] ?? null],
        ])->save();

        return true;
    }

    /**
     * Remove the result of the notification, so it shows its actions again.
     */
    public function revertResult(): void
    {
        if ($this->result !== null) {
            $this->forceFill(['result' => null])->save();
        }
    }

    /**
     * Determine if the notification has a result.
     */
    public function isCompleted(): bool
    {
        return $this->result !== null;
    }

    /**
     * Determine if the notification has been read.
     */
    public function isRead(): bool
    {
        return $this->read_at !== null;
    }

    /**
     * Determine if the notification has been read or archived.
     */
    public function isReadOrArchived(): bool
    {
        return $this->isRead() || $this->archived_at !== null;
    }

    /**
     * Determine if the notification was over the throttle of its category when it was stored.
     *
     * A throttled notification shows no toast, is not broadcast to the open pages of its user, and is not pushed.
     */
    public function isThrottled(): bool
    {
        return $this->throttled === true;
    }

    /**
     * Determine if the notification was stored outside the notifiable model's notification hours or during its pause.
     *
     * A quiet notification shows no toast, and the browser plays no sound and shows no desktop notification.
     */
    public function isQuiet(): bool
    {
        return $this->quiet === true;
    }

    /**
     * Get the prunable model query.
     *
     * The query covers the rows older than `prune_after_days` days, which `php artisan model:prune` deletes.
     *
     * @return Builder<static>
     */
    public function prunable(): Builder
    {
        $days = config('inertia-notifications.inbox.prune_after_days', 90);

        return is_numeric($days)
            ? static::query()->where('created_at', '<', now()->subDays((int) $days))
            : static::query()->whereRaw('1 = 0');
    }

    /**
     * Convert the model instance to an array.
     *
     * The array has the shape the frontend reads, also inside paginators and Inertia props.
     *
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return $this->toInboxArray();
    }

    /**
     * Get the notification as the frontend receives it.
     *
     * The title, body, and action labels that were stored with their replacements are translated in the
     * current locale. Other text shows as it was stored.
     *
     * @return array<string, mixed>
     */
    public function toInboxArray(): array
    {
        $data = $this->data;

        return [
            'id' => $this->id,
            'type' => $this->type,
            'title' => $this->translatedTitle(),
            'body' => $this->text('body'),
            'icon' => $data['icon'] ?? null,
            'image' => $data['image'] ?? null,
            'url' => $data['url'] ?? null,
            'actions' => $this->translatedActions(),
            'actor' => $data['actor'] ?? null,
            'actors' => $this->newestActors(),
            'actorCount' => $this->actorCount(),
            'total' => $this->total(),
            'toast' => $data['toast'] ?? null,
            'category' => $this->category,
            'group' => $this->group_key,
            'data' => $data['meta'] ?? (object) [],
            'readAt' => $this->read_at?->toIso8601String(),
            'seenAt' => $this->seen_at?->toIso8601String(),
            'archivedAt' => $this->archived_at?->toIso8601String(),
            'snoozedUntil' => $this->snoozed_until?->toIso8601String(),
            'result' => $this->resultText(),
            // While the application does not offer muting, its mutes are ignored, so no thread shows as muted.
            'muted' => Inbox::allows('mute') && ($this->muted ?? $this->isMuted()),
            'createdAt' => $this->created_at->toIso8601String(),
            'revision' => $this->revision,
            'announcement' => false,
            'expiresAt' => null,
            ...$this->conditionalAttributes(),
        ];
    }

    /**
     * Get the number of notifications that the notification holds: its own and those that collapsed into it.
     */
    protected function total(): int
    {
        return $this->collapsed === null ? 1 : count($this->collapsed['ids']);
    }

    /**
     * Get the number of different actors of the notification and the notifications that collapsed into it.
     */
    protected function actorCount(): int
    {
        if ($this->collapsed !== null) {
            return count($this->collapsed['actor_keys']);
        }

        return isset($this->data['actor']) ? 1 : 0;
    }

    /**
     * Get the attributes that the serialized notification only holds when they apply.
     *
     * Every serialized notification may hold them, not only one that arrives in real time.
     *
     * @return array{quiet?: true, context?: string}
     */
    protected function conditionalAttributes(): array
    {
        $attributes = [];

        // The browser shows no toast or alert for a notification that arrives outside the notification
        // hours or while the user paused, so we will tell it that the notification is quiet. Other
        // notifications leave it out.
        if ($this->isQuiet()) {
            $attributes['quiet'] = true;
        }

        // The browser leaves out the notifications of other contexts that arrive in real time, so we
        // will tell it the context of the notification. Notifications without a context leave it out.
        if ($this->context_type !== null) {
            $attributes['context'] = Inbox::contextKey($this->context_type, $this->context_id);
        }

        return $attributes;
    }

    /**
     * Get the title of the notification, translated in the current locale.
     *
     * The `:actors` replacement names the actors of the notification and of those that collapsed into it.
     */
    public function translatedTitle(): string
    {
        $replace = $this->data['translate']['title'] ?? null;

        if (is_array($replace)) {
            $replace = ['actors' => $this->actorsText(), ...$replace];
        }

        return (string) $this->text('title', $replace);
    }

    /**
     * Get the actors of the notification as the `:actors` replacement names them, newest first, such as "Sophie",
     * "Sophie and Maria", or "Sophie and 2 others".
     */
    protected function actorsText(): string
    {
        $actors = $this->newestActors();
        $newest = $actors[0]['name'] ?? null;
        $other = $actors[1]['name'] ?? null;
        $count = $this->actorCount();

        return match (true) {
            $newest === null => '',
            $count > 2 => Toast::translate(':name and :count others', ['name' => $newest, 'count' => $count - 1]),
            $count === 2 && $other !== null => Toast::translate(':name and :other', [
                'name' => $newest,
                'other' => $other,
            ]),
            default => $newest,
        };
    }

    /**
     * Get the given text of the stored message, translated in the current locale with its stored replacements, or
     * with the given ones.
     *
     * @param  'title'|'body'  $key
     */
    protected function text(string $key, mixed $replace = null): ?string
    {
        $text = $this->data[$key] ?? null;

        if (! is_string($text)) {
            return null;
        }

        return $this->translate($text, $replace ?? $this->data['translate'][$key] ?? null);
    }

    /**
     * Get the stored actions, with their labels, alternative texts, and results translated in the current locale.
     *
     * @return list<array<string, mixed>>
     */
    protected function translatedActions(): array
    {
        $actions = [];

        foreach ($this->data['actions'] ?? [] as $action) {
            $actions[] = $this->translateAction($action);
        }

        return $actions;
    }

    /**
     * Translate the label, alternative text, and result of the given stored action in the current locale.
     *
     * @param  array<string, mixed>  $action
     * @return array<string, mixed>
     */
    protected function translateAction(array $action): array
    {
        $replace = $action['translate'] ?? [];

        unset($action['translate']);

        foreach (['label', 'altText', 'result'] as $key) {
            if (isset($action[$key])) {
                $action[$key] = $this->translate((string) $action[$key], $replace[$key] ?? null);
            }
        }

        return $action;
    }

    /**
     * Get the name and avatar of the newest actors of the notification, newest first.
     *
     * @return list<array{name?: string, avatar?: string}>
     */
    protected function newestActors(): array
    {
        if ($this->collapsed === null) {
            return isset($this->data['actor']) ? [$this->data['actor']] : [];
        }

        return array_map(fn (array $actor): array => Arr::except($actor, 'key'), $this->collapsed['actors']);
    }

    /**
     * Get the result of the notification, translated in the current locale.
     */
    protected function resultText(): ?string
    {
        if ($this->result === null) {
            return null;
        }

        return $this->translate($this->result['label'], $this->result['translate'] ?? null);
    }

    /**
     * Translate the given stored text with its stored replacements.
     *
     * Text that was stored without replacements shows as it is.
     */
    protected function translate(string $text, mixed $replace): string
    {
        return is_array($replace) ? Toast::translate($text, $replace) : $text;
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
            'throttled' => 'boolean',
            'quiet' => 'boolean',
            'read_at' => 'datetime',
            'seen_at' => 'datetime',
            'archived_at' => 'datetime',
            'snoozed_until' => 'datetime',
            'result' => 'array',
            'collapses_until' => 'datetime',
            'collapsed' => 'array',
        ];
    }
}
