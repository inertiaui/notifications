<?php

namespace InertiaUI\Notifications\Tests\Fixtures;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use InertiaUI\Notifications\Concerns\InteractsWithInbox;
use InertiaUI\Notifications\InboxMessage;

class ReplyPosted extends Notification
{
    use InteractsWithInbox;

    /**
     * Create a new notification instance.
     */
    public function __construct(
        public int $thread = 7,
        public bool $mention = false,
        public string $category = 'comments',
    ) {}

    /**
     * Get the notification's delivery channels.
     *
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['inbox', 'mail'];
    }

    /**
     * Get the inbox representation of the notification.
     */
    public function toInbox(object $notifiable): InboxMessage
    {
        return InboxMessage::make('Sophie replied in thread #:number', ['number' => $this->thread])
            ->category($this->category)
            ->group("thread:{$this->thread}")
            ->mention($this->mention);
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)->line("Sophie replied in thread #{$this->thread}.");
    }
}
