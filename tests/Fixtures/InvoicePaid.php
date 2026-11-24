<?php

namespace InertiaUI\Notifications\Tests\Fixtures;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Notifications\Notification;
use InertiaUI\Notifications\Concerns\InteractsWithInbox;
use InertiaUI\Notifications\InboxMessage;
use InertiaUI\Notifications\ToastAction;
use InertiaUI\Notifications\ToastType;

class InvoicePaid extends Notification
{
    use InteractsWithInbox;

    /**
     * Create a new notification instance.
     *
     * @param  list<string>  $channels  The channels that the notification is sent through.
     * @param  ToastType|string|bool  $toast  The toast type, true for a success toast, or false for none.
     * @param  Model|null  $actor  The actor shown with the inbox message.
     * @param  bool  $push  Whether the inbox message asks for a push.
     */
    public function __construct(
        public array $channels = ['inbox'],
        public ToastType|string|bool $toast = false,
        public ?Model $actor = null,
        public bool $push = false,
    ) {}

    /**
     * Get the notification's delivery channels.
     *
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return $this->channels;
    }

    /**
     * Get the inbox representation of the notification.
     */
    public function toInbox(object $notifiable): InboxMessage
    {
        return InboxMessage::make('Invoice :number paid', ['number' => 'INV-7'])
            ->body('Paid by card.')
            ->icon('receipt')
            ->url('/invoices/7')
            ->category('billing')
            ->group('invoice:7')
            ->actor($this->actor)
            ->action(ToastAction::make('Refund')->post('/invoices/7/refund'))
            ->toast($this->toast === true ? ToastType::Success : $this->toast)
            ->push($this->push)
            ->with(['amount' => 120]);
    }

    /**
     * Get the array representation of the notification.
     *
     * @return array<string, string>
     */
    public function toArray(object $notifiable): array
    {
        return ['title' => 'Invoice INV-7 paid', 'url' => '/invoices/7'];
    }
}
