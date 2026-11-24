<?php

namespace InertiaUI\Notifications;

use Closure;
use Illuminate\Contracts\Support\Arrayable;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use Illuminate\Support\Traits\Conditionable;
use Illuminate\Support\Traits\Macroable;
use InertiaUI\Notifications\Testing\ToastFake;
use InvalidArgumentException;
use JsonSerializable;
use LogicException;
use Stringable;

/**
 * @implements Arrayable<string, mixed>
 *
 * @phpstan-consistent-constructor
 */
class Toast implements Arrayable, JsonSerializable
{
    use Conditionable, Macroable;

    /**
     * The callbacks that configure each new toast.
     *
     * @var list<Closure(Toast): void>
     */
    protected static array $configurations = [];

    /**
     * The fake that records the sent toasts.
     */
    protected static ?ToastFake $fake = null;

    /**
     * The UUID of the toast.
     *
     * The frontend uses it to show each flashed toast once, however often it receives the toast.
     */
    protected string $uuid;

    /**
     * The ID of the toast.
     *
     * A toast with an ID replaces the open toast with the same ID on the frontend. It is set with `id()`.
     */
    protected ?string $id = null;

    /**
     * The description of the toast.
     */
    protected ?string $description = null;

    /**
     * The replacements for the translated description.
     *
     * @var array<string, mixed>
     */
    protected array $descriptionReplace = [];

    /**
     * The number of milliseconds the toast stays open.
     */
    protected ?int $duration = null;

    /**
     * Indicates if the toast stays open until the user dismisses it.
     */
    protected bool $persistent = false;

    /**
     * The actions of the toast.
     *
     * @var list<ToastAction>
     */
    protected array $actions = [];

    /**
     * The name of the icon, or `false` for no icon.
     */
    protected string|false|null $icon = null;

    /**
     * The URL of the image that shows in place of the icon.
     */
    protected ?string $image = null;

    /**
     * Indicates if the user may dismiss the toast.
     */
    protected ?bool $dismissible = null;

    /**
     * The position of the toast on the screen.
     */
    protected ?ToastPosition $position = null;

    /**
     * The name of the Toaster that shows the toast.
     */
    protected ?string $toaster = null;

    /**
     * The data for the component that renders the toast's type on the frontend.
     *
     * @var array<string, mixed>
     */
    protected array $data = [];

    /**
     * How much of the work is done, from 0 to 1.
     */
    protected ?float $progress = null;

    /**
     * Create a new toast instance.
     *
     * @param  string  $title  The title of the toast.
     * @param  ToastType|string  $type  The built-in type, or the name of a custom type.
     * @param  array<string, mixed>  $replace  The replacements for the translated title.
     */
    public function __construct(
        protected string $title,
        protected ToastType|string $type = ToastType::Default,
        protected array $replace = [],
    ) {
        $this->uuid = (string) Str::uuid();
        $this->type = ToastType::resolve($type);

        foreach (static::$configurations as $configure) {
            $configure($this);
        }
    }

    /**
     * Clone the actions of the toast when cloning it.
     *
     * The copy gets its own actions, so changes made to an action afterwards leave the copy alone.
     */
    public function __clone()
    {
        $this->actions = array_map(fn (ToastAction $action): ToastAction => clone $action, $this->actions);
    }

    /**
     * Create a new toast instance.
     *
     * The class is resolved from the container, so the application can bind its own subclass.
     *
     * @param  array<string, mixed>  $replace  The replacements for the translated title.
     */
    public static function make(string $title, ToastType|string $type = ToastType::Default, array $replace = []): static
    {
        return app(static::class, ['title' => $title, 'type' => $type, 'replace' => $replace]);
    }

    /**
     * Create a new success toast.
     *
     * @param  array<string, mixed>  $replace
     */
    public static function success(string $title, array $replace = []): static
    {
        return static::make($title, ToastType::Success, $replace);
    }

    /**
     * Create a new info toast.
     *
     * @param  array<string, mixed>  $replace
     */
    public static function info(string $title, array $replace = []): static
    {
        return static::make($title, ToastType::Info, $replace);
    }

    /**
     * Create a new warning toast.
     *
     * @param  array<string, mixed>  $replace
     */
    public static function warning(string $title, array $replace = []): static
    {
        return static::make($title, ToastType::Warning, $replace);
    }

    /**
     * Create a new error toast.
     *
     * @param  array<string, mixed>  $replace
     */
    public static function error(string $title, array $replace = []): static
    {
        return static::make($title, ToastType::Error, $replace);
    }

    /**
     * Create a new loading toast.
     *
     * The toast shows a spinner and stays open until a toast with the same ID replaces it.
     *
     * @param  array<string, mixed>  $replace
     */
    public static function loading(string $title, array $replace = []): static
    {
        return static::make($title, ToastType::Loading, $replace);
    }

    /**
     * Register a callback that configures every toast created afterwards.
     *
     * Use it to change the defaults of your toasts, such as in a service provider.
     *
     * @param  Closure(Toast): void  $callback
     */
    public static function configureUsing(Closure $callback): void
    {
        static::$configurations[] = $callback;
    }

    /**
     * Record the sent toasts for the assertion methods.
     *
     * The toasts are still flashed, so assertions on the response keep working.
     */
    public static function fake(): ToastFake
    {
        return static::$fake = new ToastFake;
    }

    /**
     * Assert if a toast was flashed based on its title or a truth-test callback.
     *
     * @param  (Closure(Toast): bool)|string|null  $callback  A title, or a callback that receives each toast.
     */
    public static function assertFlashed(Closure|string|null $callback = null, ?int $times = null): void
    {
        static::fakeOrFail()->assertFlashed($callback, $times);
    }

    /**
     * Assert if a toast was not flashed based on its title or a truth-test callback.
     *
     * @param  (Closure(Toast): bool)|string  $callback  A title, or a callback that receives each toast.
     */
    public static function assertNotFlashed(Closure|string $callback): void
    {
        static::fakeOrFail()->assertNotFlashed($callback);
    }

    /**
     * Assert that no toasts were flashed.
     */
    public static function assertNothingFlashed(): void
    {
        static::fakeOrFail()->assertNothingFlashed();
    }

    /**
     * Flush the configuration callbacks and the fake.
     *
     * The service provider calls this for each new application, so tests do not share them.
     */
    public static function flushState(): void
    {
        static::$configurations = [];
        static::$fake = null;
    }

    /**
     * Translate the given text if translation is enabled in the config.
     *
     * @param  array<string, mixed>  $replace
     */
    public static function translate(string $text, array $replace = []): string
    {
        if (! config('inertia-notifications.translate', true)) {
            return $text;
        }

        $translated = __($text, $replace);

        return is_string($translated) ? $translated : $text;
    }

    /**
     * Get the given replacements as they are stored to translate them later.
     *
     * The translator casts each replacement to a string, so we will store objects such as dates and models
     * as the strings they would show, instead of the JSON they encode to.
     *
     * @param  array<string, mixed>  $replace
     * @return array<string, mixed>
     */
    public static function storableReplacements(array $replace): array
    {
        return array_map(fn (mixed $value): mixed => $value instanceof Stringable ? (string) $value : $value, $replace);
    }

    /**
     * Set the ID of the toast.
     *
     * The frontend replaces the open toast with the same ID, instead of adding another one.
     */
    public function id(?string $id): static
    {
        $this->id = $id;

        return $this;
    }

    /**
     * Set the type of the toast.
     *
     * Pass a built-in type, or the name of a custom type, such as `deployment`.
     */
    public function type(ToastType|string $type): static
    {
        $this->type = ToastType::resolve($type);

        return $this;
    }

    /**
     * Set the description of the toast.
     *
     * @param  array<string, mixed>  $replace
     */
    public function description(?string $description, array $replace = []): static
    {
        $this->description = $description;
        $this->descriptionReplace = $replace;

        return $this;
    }

    /**
     * Close the toast after the given number of milliseconds.
     */
    public function duration(int $milliseconds): static
    {
        $this->duration = $milliseconds;
        $this->persistent = false;

        return $this;
    }

    /**
     * Keep the toast open until the user dismisses it.
     */
    public function persistent(): static
    {
        $this->persistent = true;

        return $this;
    }

    /**
     * Add an action button to the toast.
     *
     * Given a URL, the button visits it with Inertia, and a `ToastAction` allows other actions. Toasts with actions
     * stay open until the user dismisses them, unless they have a duration.
     */
    public function action(ToastAction|string $action, ?string $url = null): static
    {
        $this->actions[] = ToastAction::resolve($action, $url);

        return $this;
    }

    /**
     * Set the actions of the toast.
     *
     * @param  list<ToastAction>  $actions
     */
    public function actions(array $actions): static
    {
        $this->actions = $actions;

        return $this;
    }

    /**
     * Set the icon of the toast.
     *
     * Pass the name of an icon registered with the Toaster's `icons` prop, or `false` for no icon.
     */
    public function icon(string|false|null $icon): static
    {
        $this->icon = $icon;

        return $this;
    }

    /**
     * Show an image in place of the icon, such as the avatar of the person the toast is about.
     *
     * Screen readers still announce the type of the toast before its title.
     */
    public function image(?string $url): static
    {
        $this->image = $url;

        return $this;
    }

    /**
     * Indicate if the user may dismiss the toast.
     *
     * Pass `false` to remove the dismiss button, Escape, and swiping.
     */
    public function dismissible(bool $dismissible = true): static
    {
        $this->dismissible = $dismissible;

        return $this;
    }

    /**
     * Set the position of the toast on the screen.
     *
     * @throws InvalidArgumentException
     */
    public function position(ToastPosition|string $position): static
    {
        if (is_string($position)) {
            $position = ToastPosition::tryFrom($position) ?? throw new InvalidArgumentException(
                "[{$position}] is not a valid toast position. Use a position such as top-right or bottom-center.",
            );
        }

        $this->position = $position;

        return $this;
    }

    /**
     * Show the toast in the Toaster with the given `name`.
     */
    public function toaster(?string $name): static
    {
        $this->toaster = $name;

        return $this;
    }

    /**
     * Add data for the component that renders the toast's type on the frontend.
     *
     * The Toaster's `components` prop decides which component renders each type. The data travels
     * through the session as JSON, so models and other objects arrive as the arrays they encode to.
     *
     * @param  array<string, mixed>  $data
     */
    public function with(array $data): static
    {
        $this->data = [...$this->data, ...$data];

        return $this;
    }

    /**
     * Show how much of the work is done, from 0 to 1.
     *
     * The toast shows the progress as a bar that screen readers can read. A later toast
     * with the same ID may continue it, such as on each request that checks an import.
     */
    public function progress(?float $progress): static
    {
        $this->progress = $progress;

        return $this;
    }

    /**
     * Flash the toast for the next Inertia response.
     *
     * The toast is sent after any toasts flashed earlier.
     */
    public function flash(): static
    {
        // Without a session, such as in a queued job, there is no next page to show the toast on, so
        // we will not flash the toast, and the fake will not record it as flashed either.
        if (! request()->hasSession()) {
            return $this;
        }

        FlashedToasts::push($this->deliver());

        return $this;
    }

    /**
     * Get the array the frontend receives, as the toast is sent.
     *
     * When the toasts are faked, the fake also records a copy of the toast as it is sent, so changes
     * made to the toast afterwards, which the frontend never receives, are left out of the copy.
     *
     * @internal
     *
     * @return array<string, mixed>
     */
    public function deliver(): array
    {
        static::$fake?->record(clone $this);

        return $this->toArray();
    }

    /**
     * Get the UUID of the toast.
     */
    public function getUuid(): string
    {
        return $this->uuid;
    }

    /**
     * Get the ID of the toast.
     */
    public function getId(): ?string
    {
        return $this->id;
    }

    /**
     * Get the type of the toast.
     *
     * This is a built-in type, or the name of a custom type.
     */
    public function getType(): ToastType|string
    {
        return $this->type;
    }

    /**
     * Get the title of the toast.
     */
    public function getTitle(): string
    {
        return static::translate($this->title, $this->replace);
    }

    /**
     * Get the description of the toast.
     */
    public function getDescription(): ?string
    {
        return $this->description === null ? null : static::translate($this->description, $this->descriptionReplace);
    }

    /**
     * Get the duration of the toast in milliseconds.
     *
     * This is the duration that was set, or `null` when the toast is persistent or uses the frontend default.
     */
    public function getDuration(): ?int
    {
        return $this->persistent ? null : $this->duration;
    }

    /**
     * Determine if the toast is persistent.
     */
    public function isPersistent(): bool
    {
        return $this->persistent;
    }

    /**
     * Get the actions of the toast.
     *
     * @return list<ToastAction>
     */
    public function getActions(): array
    {
        return $this->actions;
    }

    /**
     * Get the icon of the toast.
     */
    public function getIcon(): string|false|null
    {
        return $this->icon;
    }

    /**
     * Get the data for the component that renders the toast's type.
     *
     * @return array<string, mixed>
     */
    public function getData(): array
    {
        return $this->data;
    }

    /**
     * Get the instance as an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        $toast = [
            'uuid' => $this->uuid,
            'type' => ToastType::value($this->type),
            'title' => $this->getTitle(),
        ];

        $optional = [
            'id' => $this->id,
            'description' => $this->getDescription(),
            'actions' => $this->actions === []
                ? null
                : array_map(fn (ToastAction $action): array => $action->toArray(), $this->actions),
            'icon' => $this->icon,
            'image' => $this->image,
            'dismissible' => $this->dismissible,
            'position' => $this->position?->value,
            'toaster' => $this->toaster,
            'data' => $this->data === [] ? null : $this->plainData(),
            'progress' => $this->progress,
        ];

        $toast = [...$toast, ...Arr::whereNotNull($optional)];

        // When we leave the duration out, the frontend will use its default duration.
        // A null duration keeps the toast open, so we only send it when persistent.
        if ($this->persistent) {
            $toast['duration'] = null;
        } elseif ($this->duration !== null) {
            $toast['duration'] = $this->duration;
        }

        return $toast;
    }

    /**
     * Convert the object into something JSON serializable.
     *
     * @return array<string, mixed>
     */
    public function jsonSerialize(): array
    {
        return $this->toArray();
    }

    /**
     * Get the data as plain values, as the frontend receives it.
     *
     * The flashed toast is stored in the session, so we will turn the data into plain
     * arrays now, instead of storing models and other objects with the toast.
     *
     * @return array<string, mixed>
     */
    protected function plainData(): array
    {
        return json_decode(json_encode($this->data, JSON_THROW_ON_ERROR), associative: true);
    }

    /**
     * Get the toast fake, or fail when the toasts are not faked.
     *
     * @throws LogicException
     */
    protected static function fakeOrFail(): ToastFake
    {
        return static::$fake ?? throw new LogicException('Call Toast::fake() before asserting toasts.');
    }
}
