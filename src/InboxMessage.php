<?php

namespace InertiaUI\Notifications;

use Illuminate\Contracts\Support\Arrayable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Traits\Conditionable;
use Illuminate\Support\Traits\Macroable;
use InertiaUI\Notifications\Channels\InboxChannel;
use InvalidArgumentException;

/**
 * The content of a notification in the notification center. Return it from a notification's
 * `toInbox()` method and send the notification through the `inbox` channel.
 *
 * @implements Arrayable<string, mixed>
 *
 * @phpstan-consistent-constructor
 */
class InboxMessage implements Arrayable
{
    use Conditionable, Macroable;

    /**
     * The body of the message.
     */
    protected ?string $body = null;

    /**
     * The replacements for the translated body.
     *
     * @var array<string, mixed>
     */
    protected array $bodyReplace = [];

    /**
     * The name of the message's icon.
     */
    protected ?string $icon = null;

    /**
     * The URL of the message's image.
     */
    protected ?string $image = null;

    /**
     * The URL visited when the user opens the notification.
     */
    protected ?string $url = null;

    /**
     * The actions of the message.
     *
     * @var list<ToastAction>
     */
    protected array $actions = [];

    /**
     * The category of the message.
     */
    protected ?string $category = null;

    /**
     * The group key of the message.
     */
    protected ?string $group = null;

    /**
     * The model that caused the notification.
     */
    protected ?Model $actor = null;

    /**
     * The model that the notification belongs to, such as a team.
     */
    protected ?Model $context = null;

    /**
     * The name of the actor.
     */
    protected ?string $actorName = null;

    /**
     * The avatar URL of the actor.
     */
    protected ?string $actorAvatar = null;

    /**
     * The type of the toast that shows the notification.
     */
    protected ToastType|string|null $toast = null;

    /**
     * The extra data for the frontend.
     *
     * @var array<string, mixed>
     */
    protected array $meta = [];

    /**
     * The key that the notifiable model receives the message under only once.
     */
    protected ?string $uniqueKey = null;

    /**
     * The minutes that later notifications with the group key collapse into this one.
     */
    protected ?int $collapseMinutes = null;

    /**
     * Indicates if the notification mentions the notifiable model directly, which reaches it in a muted thread.
     */
    protected bool $mention = false;

    /**
     * Indicates if the notification is pushed to the devices of the notifiable model as well.
     */
    protected bool $push = false;

    /**
     * The minutes that the waiting channels wait for the notification to be read.
     */
    protected ?int $readWithin = null;

    /**
     * The channels that only send when the notification is still unread after the wait.
     *
     * @var list<string>
     */
    protected array $waitingChannels = [];

    /**
     * Create a new inbox message instance.
     *
     * @param  string  $title  The title of the message.
     * @param  array<string, mixed>  $replace  The replacements for the translated title.
     */
    public function __construct(
        protected string $title,
        protected array $replace = [],
    ) {}

    /**
     * Create a new inbox message instance.
     *
     * @param  array<string, mixed>  $replace  The replacements for the translated title.
     */
    public static function make(string $title, array $replace = []): static
    {
        return new static($title, $replace);
    }

    /**
     * Set the body of the message.
     *
     * @param  array<string, mixed>  $replace
     */
    public function body(?string $body, array $replace = []): static
    {
        $this->body = $body;
        $this->bodyReplace = $replace;

        return $this;
    }

    /**
     * Set the icon of the message.
     *
     * The icon is the name of an icon registered with the notification center's `icons` prop.
     */
    public function icon(?string $icon): static
    {
        $this->icon = $icon;

        return $this;
    }

    /**
     * Set the image of the message.
     *
     * The image is shown below the body, such as a product photo or a screenshot.
     */
    public function image(?string $url): static
    {
        $this->image = $url;

        return $this;
    }

    /**
     * Set the URL of the message.
     *
     * The URL is visited with Inertia when the user opens the notification, which also marks it as read.
     */
    public function url(?string $url): static
    {
        $this->url = $url;

        return $this;
    }

    /**
     * Add a button to the message.
     *
     * With a URL, the button visits it with Inertia; pass a `ToastAction` for other actions. Running an
     * action marks the notification as read, and an action with a `result()` keeps that result.
     */
    public function action(ToastAction|string $action, ?string $url = null): static
    {
        $this->actions[] = ToastAction::resolve($action, $url);

        return $this;
    }

    /**
     * Set the actions of the message.
     *
     * @param  list<ToastAction>  $actions
     */
    public function actions(array $actions): static
    {
        $this->actions = $actions;

        return $this;
    }

    /**
     * Set the category of the message.
     */
    public function category(?string $category): static
    {
        $this->category = $category;

        return $this;
    }

    /**
     * Set the group key of the message.
     *
     * Notifications with the same group key are about the same thing, such as one invoice. The panel shows
     * the loaded ones as one, and `collapse()` stores the later ones in one row.
     */
    public function group(?string $key): static
    {
        $this->group = $key;

        return $this;
    }

    /**
     * Set the actor that caused the notification.
     *
     * The name defaults to the model's `name` attribute, and the avatar to its `avatar_url`,
     * `profile_photo_url`, or `avatar` attribute. Both are stored with the notification. An actor
     * that is not a model, such as an external service, only needs the name: `actor(name: 'GitHub')`.
     */
    public function actor(?Model $actor = null, ?string $name = null, ?string $avatar = null): static
    {
        $this->actor = $actor;
        $this->actorName = $name ?? self::attribute($actor, ['name']);
        $this->actorAvatar = $avatar ?? self::attribute($actor, ['avatar_url', 'profile_photo_url', 'avatar']);

        return $this;
    }

    /**
     * Set the context that the notification belongs to, such as a team or a tenant.
     *
     * When the application resolves the current context with `Inbox::resolveContextUsing()`, the notification
     * center leaves out the notifications of other contexts.
     */
    public function for(?Model $context): static
    {
        $this->context = $context;

        return $this;
    }

    /**
     * Show the notification as a toast as well.
     *
     * The toast shows right away when the notification is sent while the notifiable user makes the request,
     * and when it arrives in real time. Pass a built-in type or the name of a custom type.
     */
    public function toast(ToastType|string|bool $type = true): static
    {
        $this->toast = match ($type) {
            true => ToastType::Info,
            false => null,
            default => ToastType::resolve($type),
        };

        return $this;
    }

    /**
     * Store and send the notification only once per notifiable model under the given key.
     *
     * A later notification with the same key, such as from a retried job, is not stored, and none of its
     * channels send.
     */
    public function once(?string $key): static
    {
        $this->uniqueKey = $key;

        return $this;
    }

    /**
     * Collapse the later notifications with the same group key into this one for the given minutes.
     *
     * A later notification updates the stored row instead of adding one: the row takes its title, body,
     * and data, moves to the top as unread, and keeps the actors and the total of the notifications.
     */
    public function collapse(?int $minutes = 60): static
    {
        $this->collapseMinutes = $minutes;

        return $this;
    }

    /**
     * Mark the notification as one that mentions the notifiable model directly, such as an @mention.
     *
     * A mention reaches the notifiable model also when it muted the thread of the group key. The thread
     * stays muted for the notifications that do not mention it.
     */
    public function mention(bool $mention = true): static
    {
        $this->mention = $mention;

        return $this;
    }

    /**
     * Push the notification to the devices of the notifiable model as well.
     *
     * The `inbox` channel sends the push once it stored the notification, so a user who turned the notification
     * center off for the category gets no push either. The push only shows when the notification would alert
     * the user, so a quiet, throttled, read, or archived notification is not pushed.
     */
    public function push(bool $push = true): static
    {
        $this->push = $push;

        return $this;
    }

    /**
     * Send the given channels only when the notification is still unread after the given minutes.
     *
     * The notification is stored in the notification center right away. The notification must implement
     * `ShouldQueue` and use the `InteractsWithInbox` trait, which delays the given channels. Pass `push` to
     * delay the push of `push()` too, which needs neither, since the package delays the job that sends it.
     *
     * @param  list<string>  $channels
     */
    public function unlessReadWithin(int $minutes, array $channels): static
    {
        if (array_intersect($channels, InboxChannel::NAMES) !== []) {
            throw new InvalidArgumentException('The [inbox] channel cannot wait for the notification to be read.');
        }

        $this->readWithin = $minutes;
        $this->waitingChannels = $channels;

        return $this;
    }

    /**
     * Add extra data for your own frontend code.
     *
     * The data is available as `item.data`.
     *
     * @param  array<string, mixed>  $data
     */
    public function with(array $data): static
    {
        $this->meta = [...$this->meta, ...$data];

        return $this;
    }

    /**
     * Get the title of the message.
     */
    public function getTitle(): string
    {
        return Toast::translate($this->title, $this->replace);
    }

    /**
     * Get the body of the message.
     */
    public function getBody(): ?string
    {
        if ($this->body === null) {
            return null;
        }

        return Toast::translate($this->body, $this->bodyReplace);
    }

    /**
     * Get the icon of the message.
     */
    public function getIcon(): ?string
    {
        return $this->icon;
    }

    /**
     * Get the category of the message.
     */
    public function getCategory(): ?string
    {
        return $this->category;
    }

    /**
     * Get the group key of the message.
     */
    public function getGroup(): ?string
    {
        return $this->group;
    }

    /**
     * Get the actor that caused the notification.
     */
    public function getActor(): ?Model
    {
        return $this->actor;
    }

    /**
     * Get the context that the notification belongs to.
     */
    public function getContext(): ?Model
    {
        return $this->context;
    }

    /**
     * Get the type of the toast that shows the notification.
     */
    public function getToastType(): ToastType|string|null
    {
        return $this->toast;
    }

    /**
     * Get the actions of the message.
     *
     * @return list<ToastAction>
     */
    public function getActions(): array
    {
        return $this->actions;
    }

    /**
     * Get the URL of the message.
     */
    public function getUrl(): ?string
    {
        return $this->url;
    }

    /**
     * Get the key that the notifiable model receives the message under only once.
     */
    public function getUniqueKey(): ?string
    {
        return $this->uniqueKey;
    }

    /**
     * Get the minutes that later notifications with the group key collapse into this one.
     */
    public function getCollapseMinutes(): ?int
    {
        return $this->collapseMinutes;
    }

    /**
     * Determine if the notification mentions the notifiable model directly.
     */
    public function isMention(): bool
    {
        return $this->mention;
    }

    /**
     * Determine if the notification is pushed to the devices of the notifiable model.
     */
    public function shouldPush(): bool
    {
        return $this->push;
    }

    /**
     * Get the key that tells the actor apart from other actors, or null for a message without an actor.
     */
    public function getActorKey(): ?string
    {
        if ($this->actor instanceof Model) {
            return hash('xxh64', "{$this->actor->getMorphClass()}|{$this->actor->getKey()}");
        }

        return $this->actorName === null ? null : hash('xxh64', "name|{$this->actorName}");
    }

    /**
     * Get the name and avatar of the actor that the notification center shows.
     *
     * @return array{name?: string, avatar?: string}
     */
    public function getActorDetails(): array
    {
        return array_filter(
            ['name' => $this->actorName, 'avatar' => $this->actorAvatar],
            fn (?string $value): bool => $value !== null,
        );
    }

    /**
     * Get the minutes that the given channel waits for the notification to be read.
     *
     * The minutes are null when the channel sends right away.
     */
    public function getReadDelay(string $channel): ?int
    {
        return in_array($channel, $this->waitingChannels, true) ? $this->readWithin : null;
    }

    /**
     * Get the message as the `data` column of the stored notification.
     *
     * The title, body, and action labels are stored untranslated, with their replacements under `translate`,
     * so the notification center translates them in the locale of the user who reads the notification.
     *
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        $actor = $this->getActorDetails();

        return array_filter([
            'title' => $this->title,
            'body' => $this->body,
            'translate' => $this->translation(),
            'icon' => $this->icon,
            'image' => $this->image,
            'url' => $this->url,
            'actions' => $this->actions === []
                ? null
                : array_map(fn (ToastAction $action): array => $action->toInboxArray(), $this->actions),
            'actor' => $actor === [] ? null : $actor,
            'toast' => $this->toast === null ? null : ToastType::value($this->toast),
            'meta' => $this->meta === [] ? null : $this->meta,
        ], fn (mixed $value): bool => $value !== null);
    }

    /**
     * Get the replacements of the title and body, which are stored to translate them when they are shown.
     *
     * @return array{title: array<string, mixed>, body: array<string, mixed>}
     */
    protected function translation(): array
    {
        return [
            'title' => Toast::storableReplacements($this->replace),
            'body' => Toast::storableReplacements($this->bodyReplace),
        ];
    }

    /**
     * Get the first non-empty string among the given attributes of the model.
     *
     * @param  list<string>  $attributes
     */
    protected static function attribute(?Model $model, array $attributes): ?string
    {
        if (! $model instanceof Model) {
            return null;
        }

        foreach ($attributes as $attribute) {
            // Reading a missing attribute throws an exception when the application has enabled
            // Model::shouldBeStrict(), so we will skip the attributes that the model does not
            // have and does not define a mutator for.
            if (
                ! array_key_exists($attribute, $model->getAttributes())
                && ! $model->hasGetMutator($attribute)
                && ! $model->hasAttributeMutator($attribute)
            ) {
                continue;
            }

            $value = $model->getAttribute($attribute);

            if (is_string($value) && $value !== '') {
                return $value;
            }
        }

        return null;
    }
}
