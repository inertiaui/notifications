<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use InertiaUI\Notifications\InboxMessage;

/**
 * A notification that also sends mail, which the digests and notification hours of the Digests page hold.
 */
class DigestDemoNotification extends Notification
{
    public const array SCENARIOS = ['comment', 'invoice', 'report'];

    public function __construct(public string $scenario, public int $number = 1) {}

    public function via(object $notifiable): array
    {
        return ['inbox', 'mail'];
    }

    public function toInbox(object $notifiable): InboxMessage
    {
        return match ($this->scenario) {
            'comment' => InboxMessage::make('Sophie Martin commented on issue #:number', ['number' => $this->number])
                ->body('Looks great! Can we ship this on Tuesday instead?')
                ->actor(null, 'Sophie Martin')
                ->category('comments')
                ->url('/inbox')
                ->toast(),
            'invoice' => InboxMessage::make('Invoice INV-:number paid', ['number' => 2000 + $this->number])
                ->body('Acme Corp paid $1,200.00 by card.')
                ->category('billing')
                ->url('/inbox'),
            default => InboxMessage::make('Weekly report #:number is ready', ['number' => $this->number])
                ->body('Signups grew 12% compared to last week.')
                ->category('reports')
                ->url('/inbox'),
        };
    }

    public function toMail(object $notifiable): MailMessage
    {
        $message = $this->toInbox($notifiable);

        return (new MailMessage)->subject($message->getTitle())->line((string) $message->getBody());
    }
}
