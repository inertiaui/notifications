<?php

namespace InertiaUI\Notifications\Concerns;

use Illuminate\Database\Eloquent\Relations\MorphMany;
use InertiaUI\Notifications\Inbox;
use InertiaUI\Notifications\InboxCounts;
use InertiaUI\Notifications\Models\InboxNotification;
use InertiaUI\Notifications\Models\PushSubscription;

/**
 * Add to the notifiable model, usually `User`, next to Laravel's `Notifiable` trait.
 */
trait HasInbox
{
    /**
     * Get the notifications in the notification center, newest first.
     *
     * @return MorphMany<InboxNotification, $this>
     */
    public function inbox(): MorphMany
    {
        return $this->morphMany(Inbox::model(), 'notifiable')->latest()->latest('id');
    }

    /**
     * Get the devices that receive the pushes of the notifications, one subscription for each browser.
     *
     * The `HasPushSubscriptions` trait of the `laravel-notification-channels/webpush` package already has a
     * `pushSubscriptions()` method, so this name lets a model keep that trait while it moves to this package.
     *
     * @return MorphMany<PushSubscription, $this>
     */
    public function pushDevices(): MorphMany
    {
        return $this->morphMany(PushSubscription::class, 'notifiable');
    }

    /**
     * Get the unread and unseen counts of the notification center.
     *
     * With a context resolver, the counts cover the context of the current request. Use
     * `Inbox::countsInContext()` to count in another context, such as in a queued job.
     */
    public function inboxCounts(): InboxCounts
    {
        return Inbox::counts($this);
    }
}
