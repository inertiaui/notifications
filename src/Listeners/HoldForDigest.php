<?php

namespace InertiaUI\Notifications\Listeners;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Notifications\Events\NotificationSending;
use InertiaUI\Notifications\Channels\InboxChannel;
use InertiaUI\Notifications\Digest;
use InertiaUI\Notifications\DoNotDisturb;
use InertiaUI\Notifications\NotificationPreferences;

/**
 * Holds the channels of a notification for a digest, when the user receives its category hourly, daily, or weekly,
 * or until notifications reach the user again: once the user's pause ends and the next notification hours start.
 * The notification center still stores it right away.
 */
class HoldForDigest
{
    /**
     * Handle the event.
     *
     * The listener runs after the other rules, and returns `false` to skip a channel that it holds for the
     * digest, and `null` otherwise. Laravel stops asking listeners at the first answer that is not `null`.
     */
    public function handle(NotificationSending $event): ?false
    {
        if (! $event->notifiable instanceof Model) {
            return null;
        }

        $category = NotificationPreferences::category($event->notifiable, $event->notification);

        if ($category === null || ! $this->channelWaitsForDigest($event->channel, $category)) {
            return null;
        }

        $digestAt = $this->digestAt($event->notifiable, $category);

        if (! $digestAt instanceof CarbonInterface) {
            return null;
        }

        return Digest::hold($event->notifiable, $event->notification, $event->channel, $category, $digestAt)
            ? false
            : null;
    }

    /**
     * Determine if digests hold the given channel of the category.
     *
     * Digests hold the channels of the `digests.channels` config that the category offers. The notification
     * center's own channel always sends right away, and so does its push, which is dropped instead of held
     * when the notification would not alert the user, since a digest has no inbox message to push.
     */
    protected function channelWaitsForDigest(string $channel, string $category): bool
    {
        if (in_array($channel, InboxChannel::NAMES, true)) {
            return false;
        }

        $preferenceChannel = NotificationPreferences::channelFor($channel);

        return $preferenceChannel !== null
            && in_array($preferenceChannel, NotificationPreferences::digestChannels(), true)
            && in_array($preferenceChannel, NotificationPreferences::categories()[$category]['channels'] ?? [], true);
    }

    /**
     * Get the time of the digest that holds the category's channels, or null to send them right away.
     *
     * A category that the user receives right away waits while notifications do not disturb the user, which
     * is outside the user's notification hours and while the user paused their notifications.
     */
    protected function digestAt(Model $notifiable, string $category): ?CarbonInterface
    {
        $frequency = NotificationPreferences::frequency($notifiable, $category);

        if ($frequency === 'instant' && ! DoNotDisturb::silences($notifiable, $category)) {
            return null;
        }

        return Digest::digestAt($notifiable, $frequency);
    }
}
