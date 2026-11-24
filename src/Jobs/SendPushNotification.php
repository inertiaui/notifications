<?php

namespace InertiaUI\Notifications\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Queue\Queueable;
use InertiaUI\Notifications\Inbox;
use InertiaUI\Notifications\Models\InboxNotification;
use InertiaUI\Notifications\Models\PushSubscription;
use InertiaUI\Notifications\WebPush\PushPayload;
use InertiaUI\Notifications\WebPush\PushSender;

/**
 * Sends the push of a stored notification to every browser of a notifiable model. The `inbox` channel dispatches it
 * on the connection and queue of the `push` config, so the requests to the push services do not slow down the
 * notification.
 */
class SendPushNotification implements ShouldQueue
{
    use Queueable;

    /**
     * Delete the job if its models no longer exist.
     *
     * A notifiable model that was deleted while the push waited in the queue has no devices to push to.
     *
     * @var bool
     */
    public $deleteWhenMissingModels = true;

    /**
     * Create a new job instance.
     *
     * @param  PushPayload  $payload  The push, whose ID is the ID of the stored notification that it shows.
     */
    public function __construct(
        public Model $notifiable,
        public PushPayload $payload,
    ) {}

    /**
     * Execute the job.
     */
    public function handle(PushSender $sender): void
    {
        if ($this->removedReadOrArchivedWhileQueued()) {
            return;
        }

        $sender->send(PushSubscription::of($this->notifiable)->get(), $this->payload);
    }

    /**
     * Determine if the stored notification was removed, read, or archived while the push waited in the queue.
     *
     * The `inbox` channel decided whether the notification arrived quietly or over the throttle when it
     * dispatched the job. The job does not read these flags again, as a later notification that collapses
     * into the same row replaces them with its own.
     */
    protected function removedReadOrArchivedWhileQueued(): bool
    {
        $stored = Inbox::query($this->notifiable)->find($this->payload->id);

        return ! $stored instanceof InboxNotification || $stored->isReadOrArchived();
    }
}
