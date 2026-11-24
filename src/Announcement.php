<?php

namespace InertiaUI\Notifications;

use Closure;
use DateTimeInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Reflector;
use Illuminate\Support\Str;
use Illuminate\Support\Traits\Conditionable;
use Illuminate\Support\Traits\Macroable;
use InertiaUI\Notifications\Events\AnnouncementPublished;
use InertiaUI\Notifications\Models\InboxAnnouncement;
use InvalidArgumentException;
use LogicException;
use ReflectionFunction;

/**
 * An announcement that is stored once and shows in the notification center of every user in its audience,
 * including the users who sign up after it was published.
 *
 * @phpstan-consistent-constructor
 */
class Announcement
{
    use Conditionable, Macroable;

    /**
     * The audiences that announcements may target, by name.
     *
     * @var array<string, Closure>
     */
    protected static array $audiences = [];

    /**
     * The message that holds the title, body, icon, actions, and the other content of the announcement.
     */
    protected InboxMessage $message;

    /**
     * The audience of the announcement, with its parameters, such as `plan:pro`.
     */
    protected ?string $audience = null;

    /**
     * The model that the announcement belongs to, such as a team.
     */
    protected ?Model $context = null;

    /**
     * The time after which the announcement no longer shows.
     */
    protected ?DateTimeInterface $expiresAt = null;

    /**
     * Create a new announcement instance.
     *
     * @param  array<string, mixed>  $replace  The replacements for the translated title.
     */
    public function __construct(string $title, array $replace = [])
    {
        $this->message = InboxMessage::make($title, $replace);
    }

    /**
     * Create a new announcement instance.
     *
     * @param  array<string, mixed>  $replace  The replacements for the translated title.
     */
    public static function make(string $title, array $replace = []): static
    {
        return new static($title, $replace);
    }

    /**
     * Define an audience that announcements may target.
     *
     * The callback receives the user who reads the notification center, and the parameters that the
     * announcement passes to `audience()`, and returns a bool that says whether the user belongs to the
     * audience. Any other result throws when the audience is checked, instead of including the user.
     *
     * @param  Closure(Model, string...): bool  $callback
     */
    public static function defineAudience(string $name, Closure $callback): void
    {
        self::guardAudienceName($name);

        static::$audiences[$name] = $callback;
    }

    /**
     * Determine if the given audience includes the notifiable model.
     *
     * The audience is the name of a defined audience or an invokable class, followed by its parameters,
     * such as `plan:pro`. An audience that is no longer defined includes nobody, and an audience that
     * expects another model, such as `fn (User $user)` for a team, includes nobody of that model.
     *
     * @throws LogicException
     */
    public static function includes(string $audience, Model $notifiable): bool
    {
        $name = Str::before($audience, ':');
        $parameters = str_contains($audience, ':') ? explode(',', Str::after($audience, ':')) : [];
        $callback = self::audienceCallback($name);

        if ($callback === null || ! self::accepts($callback, $notifiable)) {
            return false;
        }

        $included = $callback($notifiable, ...$parameters);

        // We will not cast the result to a bool, since a callback that returns a relation or a collection
        // by mistake would then include every user, and show them an announcement that is not for them.
        if (! is_bool($included)) {
            throw new LogicException(
                "The announcement audience [{$name}] must return a bool, not [".get_debug_type($included).'].',
            );
        }

        return $included;
    }

    /**
     * Get the callback of the given audience, or null when it is neither defined nor an invokable class.
     */
    protected static function audienceCallback(string $name): ?callable
    {
        if (array_key_exists($name, static::$audiences)) {
            return static::$audiences[$name];
        }

        return self::invokable($name) ? app($name) : null;
    }

    /**
     * Determine if the audience's callback accepts the notifiable model as its first argument.
     *
     * Every notifiable model that reads its notification center checks each audience, so we will skip
     * an audience typed for another model instead of calling it with a model it cannot take.
     */
    protected static function accepts(callable $callback, Model $notifiable): bool
    {
        $parameter = (new ReflectionFunction(Closure::fromCallable($callback)))->getParameters()[0] ?? null;

        if ($parameter === null) {
            return true;
        }

        // The reflector resolves `self` and `parent` to the classes they stand for, so an audience defined
        // in a model with `fn (self $user)` includes the users of that model.
        $classes = collect(Reflector::getParameterClassNames($parameter));

        return $classes->isEmpty() || $classes->contains(fn (string $class): bool => $notifiable instanceof $class);
    }

    /**
     * Flush the defined audiences.
     *
     * The service provider calls this for each new application, so tests do not share them.
     */
    public static function flushState(): void
    {
        static::$audiences = [];
    }

    /**
     * Set the body of the announcement.
     *
     * @param  array<string, mixed>  $replace
     */
    public function body(?string $body, array $replace = []): static
    {
        $this->message->body($body, $replace);

        return $this;
    }

    /**
     * Set the icon of the announcement.
     *
     * The icon is the name of an icon registered with the notification center's `icons` prop.
     */
    public function icon(?string $icon): static
    {
        $this->message->icon($icon);

        return $this;
    }

    /**
     * Set the image of the announcement.
     */
    public function image(?string $url): static
    {
        $this->message->image($url);

        return $this;
    }

    /**
     * Set the URL that the notification center visits when the user opens the announcement.
     */
    public function url(?string $url): static
    {
        $this->message->url($url);

        return $this;
    }

    /**
     * Add a button to the announcement.
     */
    public function action(ToastAction|string $action, ?string $url = null): static
    {
        $this->message->action($action, $url);

        return $this;
    }

    /**
     * Set the actions of the announcement.
     *
     * @param  list<ToastAction>  $actions
     */
    public function actions(array $actions): static
    {
        $this->message->actions($actions);

        return $this;
    }

    /**
     * Set the category of the announcement.
     *
     * Users who turned off the category for the notification center do not see the announcement.
     */
    public function category(?string $category): static
    {
        $this->message->category($category);

        return $this;
    }

    /**
     * Add extra data for your own frontend code.
     *
     * @param  array<string, mixed>  $data
     */
    public function with(array $data): static
    {
        $this->message->with($data);

        return $this;
    }

    /**
     * Show the announcement only to the users in the given audience.
     *
     * The audience is the name of an audience defined with `defineAudience()`, or an invokable class that
     * receives the user and the parameters. The audience is checked whenever the user reads the
     * notification center, so it also includes the users who join it later.
     */
    public function audience(?string $audience, string|int ...$parameters): static
    {
        if ($audience === null) {
            $this->audience = null;

            return $this;
        }

        $this->guardAudience($audience);

        foreach ($parameters as $parameter) {
            $this->guardAudienceParameter($audience, (string) $parameter);
        }

        $list = implode(',', $parameters);
        $this->audience = $parameters === [] ? $audience : "{$audience}:{$list}";

        return $this;
    }

    /**
     * Set the context that the announcement belongs to, such as a team or a tenant.
     *
     * The announcement then only shows while `Inbox::resolveContextUsing()` resolves this context.
     */
    public function for(?Model $context): static
    {
        $this->context = $context;

        return $this;
    }

    /**
     * Set the time after which the announcement no longer shows in any notification center.
     */
    public function expiresAt(?DateTimeInterface $time): static
    {
        $this->expiresAt = $time instanceof DateTimeInterface ? Inbox::inApplicationTimezone($time) : null;

        return $this;
    }

    /**
     * Store the announcement, so it shows in the notification center of every user in its audience.
     *
     * With `inbox.broadcast_announcements` enabled, the open pages of these users show it right away.
     */
    public function publish(): InboxAnnouncement
    {
        foreach ($this->message->getActions() as $action) {
            $this->guardAction($action);
        }

        $announcement = InboxAnnouncement::query()->create([
            'audience' => $this->audience,
            'category' => $this->message->getCategory(),
            'context_type' => $this->context?->getMorphClass(),
            'context_id' => $this->context?->getKey(),
            'data' => $this->message->toArray(),
            'expires_at' => $this->expiresAt,
        ]);

        if (Inbox::broadcastsAnnouncements()) {
            $context = $this->context instanceof Model
                ? Inbox::contextKey($this->context->getMorphClass(), $this->context->getKey())
                : null;

            broadcast(new AnnouncementPublished($announcement->id, $context));
        }

        return $announcement;
    }

    /**
     * Ensure the given action does not need a result, which only notifications store for their user.
     */
    protected function guardAction(ToastAction $action): void
    {
        $stored = $action->toInboxArray();

        if (isset($stored['result'])) {
            throw new InvalidArgumentException("The announcement action [{$stored['label']}] must not have a result.");
        }
    }

    /**
     * Ensure the given audience is defined or names an invokable class.
     */
    protected function guardAudience(string $audience): void
    {
        self::guardAudienceName($audience);

        if (! isset(static::$audiences[$audience]) && ! self::invokable($audience)) {
            throw new InvalidArgumentException("The announcement audience [{$audience}] is not defined.");
        }
    }

    /**
     * Ensure the given name of an audience can be stored in front of its parameters.
     *
     * The stored audience puts a colon between the name and its parameters, so the name may not hold one.
     */
    protected static function guardAudienceName(string $name): void
    {
        if (str_contains($name, ':')) {
            throw new InvalidArgumentException("The announcement audience [{$name}] must not contain a colon.");
        }
    }

    /**
     * Ensure the given parameter of an audience can be stored next to the others.
     */
    protected function guardAudienceParameter(string $audience, string $parameter): void
    {
        if (str_contains($parameter, ',')) {
            throw new InvalidArgumentException(
                "The parameter [{$parameter}] of the announcement audience [{$audience}] must not contain a comma.",
            );
        }
    }

    /**
     * Determine if the given name is an invokable class.
     */
    protected static function invokable(string $name): bool
    {
        return class_exists($name) && method_exists($name, '__invoke');
    }
}
