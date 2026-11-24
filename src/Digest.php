<?php

namespace InertiaUI\Notifications;

use Carbon\CarbonInterface;
use Illuminate\Contracts\Notifications\Dispatcher;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection as BaseCollection;
use InertiaUI\Notifications\Channels\InboxChannel;
use InertiaUI\Notifications\Models\DigestItem;
use InertiaUI\Notifications\Models\InboxNotification;
use InertiaUI\Notifications\Notifications\NotificationDigest;
use InvalidArgumentException;

/**
 * Holds the channels of notifications that users receive in a digest, outside their notification hours, or while
 * they paused their notifications, and sends the digests whose time has come.
 *
 * @phpstan-import-type HeldNotification from DigestItem
 */
class Digest
{
    /**
     * The days of the week, in the order of Carbon's `dayOfWeek`.
     */
    protected const array WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    /**
     * Get the class name of the notification that sends a digest.
     *
     * @return class-string<NotificationDigest>
     */
    public static function notification(): string
    {
        /** @var class-string<NotificationDigest> */
        return config('inertia-notifications.digests.notification', NotificationDigest::class);
    }

    /**
     * Get a new query builder for the held notifications of the given notifiable model.
     *
     * @return Builder<DigestItem>
     */
    public static function query(Model $notifiable): Builder
    {
        return DigestItem::query()->whereMorphedTo('notifiable', $notifiable);
    }

    /**
     * Get a new query builder for the held notifications of the given category of the notifiable model.
     *
     * @return Builder<DigestItem>
     */
    protected static function queryInCategory(Model $notifiable, string $category): Builder
    {
        return self::query($notifiable)->where('category', $category);
    }

    /**
     * Hold the given channel of the notification for the digest of the given time.
     *
     * The digest is sent once notifications reach the notifiable model at or after that time. It shows the
     * notification's `toInbox()` message, so a notification without one is not held. A channel that is held
     * already, such as by a retried job, keeps its place in the digest.
     */
    public static function hold(
        Model $notifiable,
        Notification $notification,
        string $channel,
        string $category,
        CarbonInterface $digestAt,
    ): bool {
        $message = InboxChannel::message($notifiable, $notification);

        if (! $message instanceof InboxMessage) {
            return false;
        }

        $item = (new DigestItem)->forceFill([
            'notifiable_type' => $notifiable->getMorphClass(),
            'notifiable_id' => $notifiable->getKey(),
            'notification_id' => (string) $notification->id,
            'type' => InboxChannel::type($notifiable, $notification),
            'category' => $category,
            'channel' => $channel,
            'data' => $message->toArray(),
            'unless_read' => $message->getReadDelay($channel) !== null,
            'in_inbox' => self::goesToInbox($notifiable, $notification),
            'digest_at' => Inbox::inApplicationTimezone($digestAt),
            'send_at' => DoNotDisturb::endsAt($notifiable, $digestAt),
        ]);

        try {
            // We will save the item inside a savepoint of the application's transaction, so a
            // channel that is held already does not abort the transaction that sends it.
            $item->getConnection()->transaction(fn (): bool => $item->save());
        } catch (UniqueConstraintViolationException) {
            // The channel is held already.
        }

        return true;
    }

    /**
     * Get the channels that the notification's `via()` method returns, or none for a notification without one.
     */
    protected static function channels(Model $notifiable, Notification $notification): array
    {
        return method_exists($notification, 'via') ? (array) $notification->via($notifiable) : [];
    }

    /**
     * Determine if the notification center stores the notification for the notifiable model.
     *
     * The inbox channel may run after the held channel, so a notification that lists it counts as stored
     * before it is.
     */
    protected static function goesToInbox(Model $notifiable, Notification $notification): bool
    {
        if (! NotificationPreferences::allows($notifiable, $notification, 'inbox')) {
            return false;
        }

        $channels = self::channels($notifiable, $notification);

        return array_intersect($channels, InboxChannel::NAMES) !== []
            || Inbox::query($notifiable)->whereKey((string) $notification->id)->exists();
    }

    /**
     * Get the time of the next digest of the given frequency for the notifiable model, in the application's timezone.
     *
     * Hourly digests are sent at the start of every hour in the notifiable model's timezone, daily digests at
     * the `digests.time` in that timezone, and weekly digests at that time on the `digests.weekday`. The time
     * comes before the notifiable model's notification hours and pause apply, and the digest of the `instant`
     * frequency is now.
     */
    public static function digestAt(Model $notifiable, string $frequency): CarbonInterface
    {
        if ($frequency === 'instant') {
            return now();
        }

        return Inbox::inApplicationTimezone(self::nextDigestTime($notifiable, $frequency));
    }

    /**
     * Get the next time of the digests of the given frequency, in the notifiable model's timezone.
     */
    protected static function nextDigestTime(Model $notifiable, string $frequency): CarbonInterface
    {
        $now = now(NotificationPreferences::timezone($notifiable));

        if ($frequency === 'hourly') {
            return $now->startOfHour()->addHour();
        }

        $weekday = self::weekday();
        $next = $now->setTimeFromTimeString(self::timeOfDay());

        while ($next->isPast() || ($frequency === 'weekly' && $next->dayOfWeek !== $weekday)) {
            $next = $next->addDay();
        }

        return $next;
    }

    /**
     * Move the held notifications whose digest changed to the next digest of their frequency.
     *
     * A change of the notifiable model's timezone moves every held notification, and a change of the frequency
     * of a category moves the notifications of that category. A category that the notifiable model receives
     * right away again is sent with the next digests that are sent.
     *
     * A change of the notifiable model's notification hours or pause, which decide when notifications reach it,
     * moves every held notification too, but a notification whose digest came due meanwhile waits only until
     * notifications reach it again.
     *
     * @param  list<string>  $categories  The categories whose frequency changed.
     */
    public static function reschedule(
        Model $notifiable,
        array $categories = [],
        bool $timezoneChanged = false,
        bool $doNotDisturbChanged = false,
    ): void {
        if ($categories === [] && ! $timezoneChanged && ! $doNotDisturbChanged) {
            return;
        }

        /** @var list<string> $held */
        $held = self::query($notifiable)->distinct()->pluck('category')->all();
        $doNotDisturb = NotificationPreferences::doNotDisturb($notifiable);

        foreach ($held as $category) {
            if ($timezoneChanged || in_array($category, $categories, true)) {
                self::moveToNextDigest($notifiable, $category, $doNotDisturb);

                continue;
            }

            if ($doNotDisturbChanged) {
                self::moveToNextDelivery($notifiable, $category, $doNotDisturb);
            }
        }
    }

    /**
     * Move the held notifications of the category to the next digest of its frequency.
     */
    protected static function moveToNextDigest(
        Model $notifiable,
        string $category,
        DoNotDisturbSchedule $doNotDisturb,
    ): void {
        $digestAt = self::digestAt($notifiable, NotificationPreferences::frequency($notifiable, $category));

        self::queryInCategory($notifiable, $category)->update([
            'digest_at' => $digestAt,
            'send_at' => $doNotDisturb->endsAt($digestAt),
        ]);
    }

    /**
     * Move the held notifications of the category to the time when notifications reach the notifiable model.
     *
     * The notifications whose digest came due already, such as during a pause, are sent once notifications
     * reach the notifiable model, and the others wait for their digest.
     */
    protected static function moveToNextDelivery(
        Model $notifiable,
        string $category,
        DoNotDisturbSchedule $doNotDisturb,
    ): void {
        $now = now();

        self::queryInCategory($notifiable, $category)
            ->where('digest_at', '<=', $now)
            ->update(['send_at' => $doNotDisturb->endsAt($now)]);

        $digests = self::queryInCategory($notifiable, $category)
            ->where('digest_at', '>', $now)
            ->distinct()
            ->pluck('digest_at');

        foreach ($digests as $digestAt) {
            self::queryInCategory($notifiable, $category)
                ->where('digest_at', $digestAt)
                ->update(['send_at' => $doNotDisturb->endsAt($digestAt)]);
        }
    }

    /**
     * Send the digests whose time has come, one per notifiable model, and get the number of digests sent.
     */
    public static function sendDue(): int
    {
        $count = 0;

        $items = DigestItem::query()
            ->due()
            ->select(['notifiable_type', 'notifiable_id'])
            ->distinct()
            ->with('notifiable')
            ->get();

        foreach ($items as $item) {
            if (! $item->notifiable instanceof Model) {
                self::forgetDeletedNotifiable($item);

                continue;
            }

            // A digest that fails keeps its notifications, so it is sent again on the next run, and the digests
            // of the other notifiable models are still sent on this one.
            if (rescue(fn (): bool => self::send($item->notifiable), false)) {
                $count++;
            }
        }

        return $count;
    }

    /**
     * Send the notifiable model's held notifications whose digest is due, and determine if a digest was sent.
     *
     * Each channel that held a notification sends its own digest. The notifications that the notifiable
     * model should no longer receive are left out, and the due notifications of a channel are forgotten
     * once its digest is sent.
     */
    protected static function send(Model $notifiable): bool
    {
        $doNotDisturb = NotificationPreferences::doNotDisturb($notifiable);

        if ($doNotDisturb->active(now())) {
            self::postpone($notifiable, $doNotDisturb);

            return false;
        }

        $items = self::query($notifiable)
            ->due()
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();

        $stored = self::storedRows($notifiable, $items);
        $sent = false;

        foreach ($items->groupBy('channel') as $channel => $held) {
            if (self::sendChannel($notifiable, $channel, $held, $stored)) {
                $sent = true;
            }
        }

        return $sent;
    }

    /**
     * Get the stored rows of the given held notifications, keyed by the ID of each held notification.
     *
     * A notification that collapsed lives on in the row that it collapsed into, which the inbox shows in its
     * place, so we will find that row through the notifications that collapsed into it, like `Inbox::findStored()`.
     *
     * @param  Collection<int, DigestItem>  $items
     * @return BaseCollection<string, InboxNotification>
     */
    protected static function storedRows(Model $notifiable, Collection $items): BaseCollection
    {
        $ids = $items->pluck('notification_id')->unique()->values();

        $rows = Inbox::query($notifiable)
            ->where(function (Builder $query) use ($ids): void {
                $query->whereKey($ids->all());

                foreach ($ids as $id) {
                    $query->orWhere(fn (Builder $query) => $query->whereNotNull('collapses_until')
                        ->whereJsonContains('collapsed->ids', $id));
                }
            })
            ->get();

        return $ids->mapWithKeys(fn (string $id): array => [
            $id => $rows->first(fn (InboxNotification $row): bool => $row->includesNotification($id)),
        ])->filter();
    }

    /**
     * Send the digest of the given due notifications of the channel, and determine if it was sent.
     *
     * The notifications are forgotten once the digest is sent, or when none of them should be sent anymore.
     *
     * @param  Collection<int, DigestItem>  $items
     * @param  BaseCollection<string, InboxNotification>  $stored
     */
    protected static function sendChannel(
        Model $notifiable,
        string $channel,
        Collection $items,
        BaseCollection $stored,
    ): bool {
        $disabled = NotificationPreferences::disabledCategories($notifiable, $channel);
        $sending = $items->filter(
            fn (DigestItem $item): bool => self::shouldSend($item, $stored->get($item->notification_id), $disabled),
        );

        if ($sending->isEmpty()) {
            self::forget($notifiable, $items);

            return false;
        }

        // A digest that fails keeps its notifications, so it is sent again on the next run, while the
        // digests of the other channels, which were sent already, are not sent again along with it.
        $sent = rescue(function () use ($notifiable, $sending, $stored): bool {
            self::sendDigest($notifiable, $sending, $stored);

            return true;
        }, false);

        if ($sent) {
            self::forget($notifiable, $items);
        }

        return $sent;
    }

    /**
     * Send the digest of the given held notifications to the notifiable model.
     *
     * @param  Collection<int, DigestItem>  $sending
     * @param  BaseCollection<string, InboxNotification>  $stored
     */
    protected static function sendDigest(Model $notifiable, Collection $sending, BaseCollection $stored): void
    {
        $class = self::notification();
        $held = self::newestOfEachRow($sending, $stored)
            ->map(fn (DigestItem $item): array => self::digestArray($item, $stored->get($item->notification_id)))
            ->values()
            ->all();

        app(Dispatcher::class)->send($notifiable, new $class($held));
    }

    /**
     * Get the newest of the given held notifications of each stored row.
     *
     * The notifications that collapsed into one row show once in the digest, with the row's message, like
     * the inbox shows them. The items are held oldest first, so the newest of each row comes last.
     *
     * @param  Collection<int, DigestItem>  $items
     * @param  BaseCollection<string, InboxNotification>  $stored
     * @return Collection<int, DigestItem>
     */
    protected static function newestOfEachRow(Collection $items, BaseCollection $stored): Collection
    {
        $rowId = fn (DigestItem $item): string => $stored->get($item->notification_id)->id ?? $item->notification_id;

        return $items->reverse()
            ->unique($rowId)
            ->reverse();
    }

    /**
     * Forget the given held notifications of the notifiable model.
     *
     * @param  Collection<int, DigestItem>  $items
     */
    protected static function forget(Model $notifiable, Collection $items): void
    {
        self::query($notifiable)->whereKey($items->modelKeys())->delete();
    }

    /**
     * Determine if the held notification should still be sent to the notifiable model.
     *
     * A notification whose category the notifiable model turned off on the channel since is left out, and
     * so is a notification that was retracted from the notification center with `Inbox::retract()`, and a
     * notification that waits for a read with `unlessReadWithin()` once it has been read.
     *
     * @param  list<string>  $disabled  The categories that the notifiable model turned off on the item's channel.
     */
    protected static function shouldSend(DigestItem $item, ?InboxNotification $stored, array $disabled): bool
    {
        if (in_array($item->category, $disabled, true)) {
            return false;
        }

        if ($item->in_inbox && ! $stored instanceof InboxNotification) {
            return false;
        }

        return ! $item->unless_read || $stored?->read_at === null;
    }

    /**
     * Get the held notification as the digest notification receives it.
     *
     * The message is the one the notification center has now, so a notification that was changed with
     * `Inbox::update()` shows its new message.
     *
     * @return HeldNotification
     */
    protected static function digestArray(DigestItem $item, ?InboxNotification $stored): array
    {
        if (! $stored instanceof InboxNotification) {
            return $item->toDigestArray();
        }

        return [...$item->toDigestArray(), 'data' => $stored->data, 'collapsed' => $stored->collapsed];
    }

    /**
     * Move the due notifications of the notifiable model to the time when notifications reach it again.
     *
     * The notification hours ended or changed, or the notifiable model paused its notifications, after the
     * notifications were held.
     */
    protected static function postpone(Model $notifiable, DoNotDisturbSchedule $doNotDisturb): void
    {
        self::query($notifiable)
            ->due()
            ->update(['send_at' => $doNotDisturb->endsAt(now())]);
    }

    /**
     * Forget the held notifications of a notifiable model that has been deleted.
     */
    protected static function forgetDeletedNotifiable(DigestItem $item): void
    {
        DigestItem::query()
            ->where('notifiable_type', $item->notifiable_type)
            ->where('notifiable_id', $item->notifiable_id)
            ->delete();
    }

    /**
     * Get the time of day that daily and weekly digests are sent at, such as `08:00`.
     */
    protected static function timeOfDay(): string
    {
        return (string) config('inertia-notifications.digests.time', '08:00');
    }

    /**
     * Get the day of the week that weekly digests are sent on, as Carbon's `dayOfWeek`.
     *
     * @throws InvalidArgumentException
     */
    protected static function weekday(): int
    {
        $name = (string) config('inertia-notifications.digests.weekday', 'monday');
        $weekday = array_search(strtolower($name), self::WEEKDAYS, true);

        if ($weekday === false) {
            throw new InvalidArgumentException(
                "The digest weekday [{$name}] must be the name of a day, such as monday.",
            );
        }

        return $weekday;
    }
}
