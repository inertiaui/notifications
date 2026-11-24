<?php

namespace InertiaUI\Notifications\Concerns;

use Illuminate\Database\Eloquent\Model;
use InertiaUI\Notifications\Models\InboxMute;

/**
 * Mutes and unmutes the threads of notifications by their group key, so later ones no longer reach the user.
 */
trait MutesThreads
{
    /**
     * Mute the thread of the given group key for the notifiable model.
     *
     * Later notifications with the group key do not reach the notifiable model through any channel, unless
     * they mention it with `InboxMessage::mention()` or belong to a locked category. The notifications it
     * already has stay where they are.
     */
    public static function mute(Model $notifiable, string $group): void
    {
        InboxMute::query()->createOrFirst([
            'notifiable_type' => $notifiable->getMorphClass(),
            'notifiable_id' => $notifiable->getKey(),
            'group_key' => $group,
        ]);
    }

    /**
     * Unmute the thread of the given group key for the notifiable model.
     */
    public static function unmute(Model $notifiable, string $group): void
    {
        InboxMute::of($notifiable->getMorphClass(), $notifiable->getKey())
            ->where('group_key', $group)
            ->delete();
    }

    /**
     * Determine if the notifiable model muted the thread of the given group key.
     */
    public static function isMuted(Model $notifiable, ?string $group): bool
    {
        return InboxMute::isThreadMuted($notifiable->getMorphClass(), $notifiable->getKey(), $group);
    }
}
