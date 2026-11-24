<?php

namespace InertiaUI\Notifications\Tests\Fixtures;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use InertiaUI\Notifications\Concerns\InteractsWithInbox;
use InertiaUI\Notifications\InboxMessage;

class IssueCommented extends Notification implements ShouldQueue
{
    use InteractsWithInbox, Queueable;

    /**
     * Create a new notification instance.
     *
     * @param  int  $issue  The number of the issue.
     * @param  string  $category  The category of the inbox message.
     * @param  bool  $unlessRead  Whether the mail waits ten minutes for the notification to be read.
     */
    public function __construct(
        public int $issue = 42,
        public string $category = 'comments',
        public bool $unlessRead = false,
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
        return InboxMessage::make('Sophie commented on issue #:number', ['number' => $this->issue])
            ->body('Looks *great*!')
            ->category($this->category)
            ->url("/issues/{$this->issue}")
            ->when($this->unlessRead, fn (InboxMessage $message) => $message->unlessReadWithin(10, ['mail']));
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)->line("Sophie commented on issue #{$this->issue}.");
    }
}
