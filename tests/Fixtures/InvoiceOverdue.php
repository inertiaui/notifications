<?php

namespace InertiaUI\Notifications\Tests\Fixtures;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use InertiaUI\Notifications\Concerns\InteractsWithInbox;
use InertiaUI\Notifications\InboxMessage;

class InvoiceOverdue extends Notification implements ShouldQueue
{
    use InteractsWithInbox, Queueable;

    /**
     * Create a new notification instance.
     *
     * @param  list<string>  $channels  The channels that the notification is sent through.
     * @param  list<string>  $waiting  The channels that wait ten minutes for the notification to be read.
     * @param  string|null  $once  The key that the notifiable model receives the notification under only once.
     * @param  string|null  $category  The category of the inbox message.
     */
    public function __construct(
        public array $channels = ['inbox', 'mail'],
        public array $waiting = ['mail'],
        public ?string $once = null,
        public ?string $category = null,
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
        return InboxMessage::make('Invoice INV-7 is overdue')
            ->unlessReadWithin(minutes: 10, channels: $this->waiting)
            ->once($this->once)
            ->category($this->category);
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)->line('Invoice INV-7 is overdue.');
    }
}
