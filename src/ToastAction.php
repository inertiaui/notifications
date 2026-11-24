<?php

namespace InertiaUI\Notifications;

use Illuminate\Contracts\Support\Arrayable;
use Illuminate\Support\Arr;
use Illuminate\Support\Traits\Conditionable;
use Illuminate\Support\Traits\Macroable;
use JsonSerializable;
use LogicException;

/**
 * A button on a toast. It visits a URL with Inertia, loads a URL in the browser, or dispatches a
 * browser event, and closes the toast afterwards unless it is kept open.
 *
 * @implements Arrayable<string, mixed>
 *
 * @phpstan-consistent-constructor
 */
class ToastAction implements Arrayable, JsonSerializable
{
    use Conditionable, Macroable;

    /**
     * The URL the action visits or loads.
     */
    protected ?string $url = null;

    /**
     * The HTTP method of the visit.
     */
    protected string $method = 'get';

    /**
     * The data sent with the visit.
     *
     * @var array<string, mixed>
     */
    protected array $data = [];

    /**
     * The options of the Inertia visit.
     *
     * @var array<string, mixed>
     */
    protected array $visit = [];

    /**
     * Indicates if the URL is loaded in the browser instead of visited with Inertia.
     */
    protected bool $external = false;

    /**
     * Indicates if the URL opens in a new tab.
     */
    protected bool $newTab = false;

    /**
     * The name of the browser event the action dispatches.
     */
    protected ?string $event = null;

    /**
     * The payload of the browser event.
     */
    protected mixed $payload = null;

    /**
     * Indicates if the toast stays open after the action ran.
     */
    protected bool $keepOpen = false;

    /**
     * The alternative text for screen reader users.
     */
    protected ?string $altText = null;

    /**
     * The replacements for the translated alternative text.
     *
     * @var array<string, mixed>
     */
    protected array $altTextReplace = [];

    /**
     * The result that a notification shows in place of its actions once the action ran.
     */
    protected ?string $result = null;

    /**
     * The replacements for the translated result.
     *
     * @var array<string, mixed>
     */
    protected array $resultReplace = [];

    /**
     * Create a new toast action instance.
     *
     * @param  string  $label  The label of the button.
     * @param  array<string, mixed>  $replace  The replacements for the translated label.
     */
    public function __construct(
        protected string $label,
        protected array $replace = [],
    ) {}

    /**
     * Create a new toast action instance.
     *
     * @param  array<string, mixed>  $replace  The replacements for the translated label.
     */
    public static function make(string $label, array $replace = []): static
    {
        return new static($label, $replace);
    }

    /**
     * Get the given action, or create one with the given label that visits the given URL.
     *
     * The `action()` methods of toasts and inbox messages accept a label with a URL in place of an action.
     */
    public static function resolve(self|string $action, ?string $url = null): self
    {
        if ($action instanceof self) {
            return $action;
        }

        $created = static::make($action);

        if ($url !== null) {
            $created->url($url);
        }

        return $created;
    }

    /**
     * Set the URL the action visits.
     *
     * The URL is visited with Inertia, or loaded in the browser after calling `external()`.
     */
    public function url(string $url): static
    {
        return $this->visitWith('get', $url);
    }

    /**
     * Visit the given URL with a POST request.
     *
     * @param  array<string, mixed>  $data
     */
    public function post(string $url, array $data = []): static
    {
        return $this->visitWith('post', $url, $data);
    }

    /**
     * Visit the given URL with a PUT request.
     *
     * @param  array<string, mixed>  $data
     */
    public function put(string $url, array $data = []): static
    {
        return $this->visitWith('put', $url, $data);
    }

    /**
     * Visit the given URL with a PATCH request.
     *
     * @param  array<string, mixed>  $data
     */
    public function patch(string $url, array $data = []): static
    {
        return $this->visitWith('patch', $url, $data);
    }

    /**
     * Visit the given URL with a DELETE request.
     *
     * @param  array<string, mixed>  $data
     */
    public function delete(string $url, array $data = []): static
    {
        return $this->visitWith('delete', $url, $data);
    }

    /**
     * Load the URL in the browser instead of visiting it with Inertia.
     *
     * Use this for a download or another site, for example.
     */
    public function external(bool $external = true): static
    {
        $this->external = $external;

        return $this;
    }

    /**
     * Open the URL in a new tab.
     */
    public function openUrlInNewTab(bool $newTab = true): static
    {
        $this->newTab = $newTab;

        return $this;
    }

    /**
     * Dispatch a browser event when the action runs.
     *
     * The event is a `CustomEvent` with the given name on `window`, with the payload as its `detail`.
     */
    public function event(string $name, mixed $payload = null): static
    {
        $this->event = $name;
        $this->payload = $payload;

        return $this;
    }

    /**
     * Indicate if the visit should preserve the scroll position.
     */
    public function preserveScroll(bool $preserve = true): static
    {
        $this->visit['preserveScroll'] = $preserve;

        return $this;
    }

    /**
     * Indicate if the visit should preserve the state of the page component.
     */
    public function preserveState(bool $preserve = true): static
    {
        $this->visit['preserveState'] = $preserve;

        return $this;
    }

    /**
     * Reload only the given props after the visit.
     *
     * @param  list<string>  $props
     */
    public function only(array $props): static
    {
        $this->visit['only'] = $props;

        return $this;
    }

    /**
     * Keep the toast open after the action ran.
     */
    public function keepOpen(bool $keepOpen = true): static
    {
        $this->keepOpen = $keepOpen;

        return $this;
    }

    /**
     * Set the alternative text for screen reader users.
     *
     * It tells them how to do the same without the toast, such as "Undo from the Trash page".
     *
     * @param  array<string, mixed>  $replace
     */
    public function altText(?string $altText, array $replace = []): static
    {
        $this->altText = $altText;
        $this->altTextReplace = $replace;

        return $this;
    }

    /**
     * Set the result that a notification shows in place of its actions once this action ran, such as "Approved".
     *
     * The notification center stores the result for the user who ran the action, so it stays after a reload and
     * shows in the user's other tabs. A toast that does not show a notification ignores it.
     *
     * @param  array<string, mixed>  $replace
     */
    public function result(?string $result, array $replace = []): static
    {
        $this->result = $result;
        $this->resultReplace = $replace;

        return $this;
    }

    /**
     * Get the label of the action.
     */
    public function getLabel(): string
    {
        return Toast::translate($this->label, $this->replace);
    }

    /**
     * Get the URL of the action.
     */
    public function getUrl(): ?string
    {
        return $this->url;
    }

    /**
     * Get the HTTP method of the action.
     */
    public function getMethod(): string
    {
        return $this->method;
    }

    /**
     * Get the name of the browser event the action dispatches.
     */
    public function getEvent(): ?string
    {
        return $this->event;
    }

    /**
     * Get the instance as an array.
     *
     * @return array<string, mixed>
     *
     * @throws LogicException
     */
    public function toArray(): array
    {
        if ($this->url === null && $this->event === null) {
            throw new LogicException("The toast action [{$this->label}] needs a URL or an event.");
        }

        if ($this->external && $this->method !== 'get') {
            throw new LogicException(
                "The external toast action [{$this->label}] may load its URL only with GET, not [{$this->method}]."
            );
        }

        if ($this->newTab && $this->method !== 'get') {
            throw new LogicException(
                "The toast action [{$this->label}] may open its URL in a new tab only with GET, not [{$this->method}]."
            );
        }

        return Arr::whereNotNull([
            'label' => $this->getLabel(),
            'href' => $this->url,
            'method' => $this->method === 'get' ? null : $this->method,
            'data' => $this->data === [] ? null : $this->data,
            'visit' => $this->visit === [] ? null : $this->visit,
            'external' => $this->external ?: null,
            'newTab' => $this->newTab ?: null,
            'event' => $this->event,
            'payload' => $this->payload,
            'keepOpen' => $this->keepOpen ?: null,
            'altText' => $this->altText === null ? null : Toast::translate($this->altText, $this->altTextReplace),
            'result' => $this->result === null ? null : Toast::translate($this->result, $this->resultReplace),
        ]);
    }

    /**
     * Get the action as the notification center stores it.
     *
     * The label, the alternative text, and the result stay untranslated, with their replacements under
     * `translate`, so the notification center translates them in the locale of the user who reads them.
     *
     * @return array<string, mixed>
     */
    public function toInboxArray(): array
    {
        $translate = ['label' => Toast::storableReplacements($this->replace)];

        if ($this->altText !== null) {
            $translate['altText'] = Toast::storableReplacements($this->altTextReplace);
        }

        if ($this->result !== null) {
            $translate['result'] = Toast::storableReplacements($this->resultReplace);
        }

        return Arr::whereNotNull([
            ...$this->toArray(),
            'label' => $this->label,
            'altText' => $this->altText,
            'result' => $this->result,
            'translate' => $translate,
        ]);
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
     * Set the HTTP method, URL, and data of the visit.
     *
     * @param  array<string, mixed>  $data
     */
    protected function visitWith(string $method, string $url, array $data = []): static
    {
        $this->method = $method;
        $this->url = $url;
        $this->data = $data;

        return $this;
    }
}
