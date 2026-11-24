<?php

namespace InertiaUI\Notifications\Concerns;

use DateTimeInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\RateLimiter;
use InertiaUI\Notifications\DoNotDisturb;
use InertiaUI\Notifications\Events\InboxNotificationArrived;
use InertiaUI\Notifications\InboxMessage;
use InertiaUI\Notifications\Models\InboxNotification;
use InertiaUI\Notifications\Toast;
use InertiaUI\Notifications\ToastAction;

/**
 * Stores each notification once, counts it against the throttle of its category, flashes its toast, and
 * broadcasts its arrival. An imported past notification is stored without any of that.
 */
trait RecordsNotifications
{
    /**
     * Create an unsaved notification for the given message.
     *
     * The notification is the row that the `inbox` channel stores and that its arrival broadcast sends,
     * unless it collapses into the open row of its group key.
     */
    protected static function newNotification(
        Model $notifiable,
        string $id,
        string $type,
        InboxMessage $message,
    ): InboxNotification {
        $model = self::model();
        $context = $message->getContext();

        return (new $model)->forceFill([
            'id' => $id,
            'notifiable_type' => $notifiable->getMorphClass(),
            'notifiable_id' => $notifiable->getKey(),
            'type' => $type,
            'category' => $message->getCategory(),
            'group_key' => $message->getGroup(),
            'unique_key' => $message->getUniqueKey(),
            'context_type' => $context?->getMorphClass(),
            'context_id' => $context?->getKey(),
            'data' => $message->toArray(),
            'throttled' => false,
            'quiet' => false,
            'read_at' => null,
            'seen_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * Store the given notification once.
     *
     * The `inbox` channel and the delivery rules of `once()` may each call this for the same notification, in
     * any order and possibly at the same time, and get the same stored row. Only the call that stored the row
     * flashes the toast, when the notifiable model is the user making the request and the message asks for
     * one, and broadcasts the arrival of the notification.
     *
     * When another notification already stored the key of the message's `once()`, nothing is stored and
     * the row of that other notification is returned. A message that collapses updates the open row of
     * its group key instead.
     */
    public static function record(
        Model $notifiable,
        string $id,
        string $type,
        InboxMessage $message,
    ): InboxNotification {
        self::guardCollapse($message);

        $revision = self::revision();
        $existing = self::findStored($notifiable, $id, $message);

        if ($existing instanceof InboxNotification) {
            $existing->revision = $revision;

            return $existing;
        }

        // We will read the notification hours and the pause before a collapsing notification
        // locks its row, so the lock stays short.
        $quiet = DoNotDisturb::silences($notifiable, $message->getCategory());
        $newRow = self::newNotification($notifiable, $id, $type, $message);
        $notification = null;

        if ($message->getCollapseMinutes() !== null) {
            $notification = self::collapse($notifiable, $newRow, $message, $quiet);
        }

        if (! $notification instanceof InboxNotification) {
            self::fillNewRow($newRow, $message);

            $notification = self::saveOnce($notifiable, $newRow, $message, $quiet);
        }

        $notification->revision = $revision;

        // Only the call that stored the row, or collapsed the notification into it, flashes the toast and
        // broadcasts the arrival. A call that got the row of another store, or whose save an observer
        // cancelled, wrote nothing, so it sends neither and the open pages receive the row once.
        if ($notification->wasRecentlyCreated || $notification->wasChanged()) {
            self::flashToast($notifiable, $notification, $message);
            self::broadcastArrival($notifiable, $notification);
        }

        return $notification;
    }

    /**
     * Store the given past notification with the times it was sent and read.
     *
     * The notification is stored as it happened, so it shows no toast, broadcasts no arrival, and doesn't
     * count against the throttle, and the notification hours and collapsing leave it alone. It counts as
     * seen when it was sent. A notification that was stored before is returned unchanged.
     */
    public static function import(
        Model $notifiable,
        string $id,
        string $type,
        InboxMessage $message,
        DateTimeInterface $sentAt,
        ?DateTimeInterface $readAt = null,
    ): InboxNotification {
        $existing = self::findStored($notifiable, $id, $message);

        if ($existing instanceof InboxNotification) {
            return $existing;
        }

        $notification = self::newNotification($notifiable, $id, $type, $message)->forceFill([
            'read_at' => $readAt,
            'seen_at' => $sentAt,
            'created_at' => $sentAt,
            'updated_at' => $readAt ?? $sentAt,
        ]);

        $notification->save();

        return $notification;
    }

    /**
     * Fill the given unsaved notification as a new row, opening the collapse window of its group key.
     *
     * The window only opens when the message collapses.
     */
    protected static function fillNewRow(InboxNotification $notification, InboxMessage $message): void
    {
        if ($message->getCollapseMinutes() === null) {
            return;
        }

        $notification->fillCollapsed($notification->id, $notification->type, $message)
            ->forceFill(['collapses_until' => now()->addMinutes($message->getCollapseMinutes())]);
    }

    /**
     * Set the flags of one delivery of the given message on the given row.
     *
     * The delivery counts against the throttle of its category. The row keeps the flags of its latest
     * delivery, such as of the latest notification that collapsed into it.
     */
    protected static function addDeliveryFlags(
        Model $notifiable,
        InboxNotification $notification,
        InboxMessage $message,
        bool $quiet,
    ): void {
        $notification->forceFill([
            'throttled' => self::countAgainstThrottle($notifiable, $message->getCategory()),
            'quiet' => $quiet,
        ]);
    }

    /**
     * Save the given new row with the flags of its delivery, or get the row that another store of the same
     * notification saved first.
     */
    protected static function saveOnce(
        Model $notifiable,
        InboxNotification $notification,
        InboxMessage $message,
        bool $quiet,
    ): InboxNotification {
        try {
            // We will save the notification inside a savepoint of the application's transaction,
            // so a duplicate row does not abort the transaction that the application started.
            $notification->getConnection()->transaction(
                fn () => self::insertWithDeliveryFlags($notifiable, $notification, $message, $quiet),
            );
        } catch (UniqueConstraintViolationException $uniqueConstraintViolationException) {
            return self::findStored($notifiable, $notification->id, $message)
                ?? throw $uniqueConstraintViolationException;
        }

        return $notification;
    }

    /**
     * Insert the given new row, then set the flags of its delivery on it.
     */
    protected static function insertWithDeliveryFlags(
        Model $notifiable,
        InboxNotification $notification,
        InboxMessage $message,
        bool $quiet,
    ): void {
        $notification->forceFill(['quiet' => $quiet]);

        // An observer that cancels the insert stores nothing, so the delivery doesn't count.
        if (! $notification->save()) {
            return;
        }

        // The insert claims the row, so we will count the delivery against the throttle after it.
        // A store of the same notification that loses the race fails on the key before it counts.
        self::addDeliveryFlags($notifiable, $notification, $message, $quiet);

        if ($notification->isDirty()) {
            $notification->save();
        }
    }

    /**
     * Get the throttle of the given category from the `inbox.throttle` config.
     *
     * @return array{limit: int, seconds: int}|null
     */
    protected static function throttleOf(?string $category): ?array
    {
        /** @var array<string, array{limit?: int, seconds?: int}> $throttles */
        $throttles = config('inertia-notifications.inbox.throttle', []);

        if ($category === null || ! isset($throttles[$category])) {
            return null;
        }

        return [
            'limit' => (int) ($throttles[$category]['limit'] ?? 1),
            'seconds' => (int) ($throttles[$category]['seconds'] ?? 60),
        ];
    }

    /**
     * Count a new notification of the given category against the notifiable model's throttle.
     *
     * Returns true when the notification is over the limit, so it is stored without a toast, an arrival broadcast,
     * or a push. The rate limiter hits and counts in one step, so notifications stored at the same time count apart.
     */
    protected static function countAgainstThrottle(Model $notifiable, ?string $category): bool
    {
        $throttle = self::throttleOf($category);

        if ($throttle === null) {
            return false;
        }

        $key = "inertiaui-notifications:{$notifiable->getMorphClass()}:{$notifiable->getKey()}:{$category}";

        return RateLimiter::hit($key, $throttle['seconds']) > $throttle['limit'];
    }

    /**
     * Find the stored row of the given notification.
     *
     * The row is the notification's own, the row of another notification that stored the key of the
     * message's `once()`, or the row that the notification collapsed into, all of the notifiable model.
     */
    public static function findStored(Model $notifiable, string $id, InboxMessage $message): ?InboxNotification
    {
        $stored = self::query($notifiable)->find($id);

        if ($stored instanceof InboxNotification) {
            return $stored;
        }

        if ($message->getUniqueKey() !== null) {
            return self::query($notifiable)
                ->where('unique_key', $message->getUniqueKey())
                ->first();
        }

        if ($message->getCollapseMinutes() === null) {
            return null;
        }

        // The channels of one notification, and a retried job, collapse it only once, so we will look for the
        // row of its group key that it collapsed into, however many newer rows the group key opened since.
        return self::query($notifiable)
            ->where('group_key', $message->getGroup())
            ->whereNotNull('collapses_until')
            ->whereJsonContains('collapsed->ids', $id)
            ->first();
    }

    /**
     * Flash the toast of the given notification.
     *
     * The toast is only flashed when the message asks for one, the notification is neither throttled nor
     * quiet, and the notifiable model is the user making the request. Like the toast that the browser
     * shows for a notification that arrives in real time, it has the message's icon, and the avatar
     * of the message's actor as its image.
     */
    protected static function flashToast(
        Model $notifiable,
        InboxNotification $notification,
        InboxMessage $message,
    ): void {
        if ($notification->isThrottled() || $notification->isQuiet()) {
            return;
        }

        $type = $message->getToastType();

        if ($type === null) {
            return;
        }

        $user = request()->user();

        if (! $user instanceof Model || ! $user->is($notifiable)) {
            return;
        }

        $toast = Toast::make($notification->translatedTitle(), $type)
            ->id(self::toastId($notification->id))
            ->description($message->getBody())
            ->icon($message->getIcon())
            ->image($message->getActorDetails()['avatar'] ?? null)
            ->actions($message->getActions());

        // The notification stays in the notification center, which the alternative text tells screen reader users,
        // so the link to its URL does not keep the toast open the way an action of the notification does.
        if ($message->getActions() === [] && $message->getUrl() !== null) {
            $toast->action(ToastAction::make('View')->url($message->getUrl())->altText('Also in your notifications.'));
        }

        $toast->flash();
    }

    /**
     * Get the ID of the toast that shows the given notification.
     *
     * A flashed toast and a real-time toast of the same notification share this ID, so they replace each
     * other instead of both showing.
     */
    public static function toastId(string $id): string
    {
        return "inertiaui-inbox-{$id}";
    }

    /**
     * Broadcast the arrival of the given notification to the open pages of the notifiable model.
     *
     * The arrival is only broadcast when `inbox.broadcast_notifications` is enabled and the notification is not
     * throttled. A quiet notification carries its `quiet` flag, so the pages count it without alerting the user.
     * The channel is null when `receivesBroadcastNotificationsOn()` needs the notification, and the browser
     * listens on no channel then, so nothing is broadcast.
     */
    protected static function broadcastArrival(Model $notifiable, InboxNotification $notification): void
    {
        if (! self::broadcastsNotifications()) {
            return;
        }

        if ($notification->isThrottled()) {
            return;
        }

        $channel = self::channel($notifiable);

        if ($channel === null) {
            return;
        }

        // A notification that collapsed replaces a row that the pages already counted, so we will send the
        // counts with it, and the pages count the row once instead of adding the notification to it.
        $counts = $notification->isCollapsed() ? self::summaryOf($notification) : null;

        broadcast(new InboxNotificationArrived($channel, $notification->toInboxArray(), $counts));
    }
}
