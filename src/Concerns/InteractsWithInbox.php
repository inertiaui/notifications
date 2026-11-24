<?php

namespace InertiaUI\Notifications\Concerns;

use Carbon\CarbonInterface;
use Illuminate\Queue\Attributes\Delay;
use InertiaUI\Notifications\InboxMessage;
use InertiaUI\Notifications\NotificationPreferences;
use ReflectionClass;

/**
 * Add to a notification with a `toInbox()` method. Queued channels that wait with `unlessReadWithin()` are
 * then delayed by the trait's `withDelay()`, and a notification with a `withDelay()` method of its own
 * returns `inboxDelay()` from it for those channels. The trait leaves Laravel's `broadcast` channel
 * to the notification's own `toBroadcast()` or `toArray()` method.
 */
trait InteractsWithInbox
{
    /**
     * Indicates if the notification center is meant to store the notification, as recorded for a waiting channel.
     *
     * The trait's `inboxDelay()` records it on the queued job of a channel of `unlessReadWithin()`, from the
     * preferences when the notification is sent. No channel has stored the notification yet by then, so
     * it does not prove that the notification was stored. It is null for every other channel.
     */
    public ?bool $inertiaUiGoesToInbox = null;

    /**
     * Get the inbox representation of the notification.
     */
    abstract public function toInbox(object $notifiable): InboxMessage;

    /**
     * Get the delay of the queued job that sends the notification through the given channel.
     *
     * The channels of the message's `unlessReadWithin()` wait its minutes. The other channels keep the delay of
     * the parent class's `withDelay()` method, or else the delay that the notification sets with the `delay()`
     * method or the `Delay` attribute.
     */
    public function withDelay(object $notifiable, string $channel): mixed
    {
        return $this->inboxDelay($notifiable, $channel) ?? $this->delayWithoutInbox($notifiable, $channel);
    }

    /**
     * Get the delay of the queued job that sends the notification through the given channel of `unlessReadWithin()`.
     *
     * Returns null for a channel that does not wait for a read. For a channel that waits, it also records
     * `$inertiaUiGoesToInbox`, since Laravel only calls `withDelay()` on the copy of the notification that
     * each channel's job carries. A notification with a `withDelay()` method of its own returns this delay
     * from it for the channels of `unlessReadWithin()`.
     */
    public function inboxDelay(object $notifiable, string $channel): ?CarbonInterface
    {
        $minutes = $this->toInbox($notifiable)->getReadDelay($channel);

        if ($minutes === null) {
            return null;
        }

        // We will record from the preferences whether the notification center is meant to store the
        // notification now, so once the wait is over, a missing row means a removed notification,
        // whatever the user changed in the preferences since.
        $this->inertiaUiGoesToInbox = NotificationPreferences::allows($notifiable, $this, 'inbox');

        return now()->addMinutes($minutes);
    }

    /**
     * Get the delay that the given channel would have without the trait.
     */
    protected function delayWithoutInbox(object $notifiable, string $channel): mixed
    {
        $parent = get_parent_class(self::class);

        // Laravel reads only the withDelay() method of a notification that has one, so the delay() method and
        // the Delay attribute count only when the parent class has none. We will ask that method, which the
        // trait's own method replaces, so the delays of the application's base notification still apply.
        if ($parent !== false && method_exists($parent, 'withDelay')) {
            return parent::withDelay($notifiable, $channel);
        }

        if (isset($this->delay)) {
            return $this->delay;
        }

        // Laravel only reads the Delay attribute of notifications without a withDelay() method, so we will
        // read it here. Laravel 12 has no such attribute, and the reflection then finds none.
        $attribute = (new ReflectionClass($this))->getAttributes(Delay::class)[0] ?? null;

        return $attribute?->newInstance()->delay;
    }
}
