<?php

namespace InertiaUI\Notifications\Tests\Fixtures;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Notifications\Notification;
use InertiaUI\Notifications\Concerns\InteractsWithInbox;
use InertiaUI\Notifications\InboxMessage;

class CommentAdded extends Notification
{
    use InteractsWithInbox;

    /**
     * Create a new notification instance.
     *
     * @param  list<string>  $channels
     */
    public function __construct(
        public User $author,
        public array $channels = ['inbox'],
        public int $issue = 42,
        public bool $toast = false,
        public ?Model $team = null,
        public bool $push = false,
        public string $title = ':name commented on issue #:number',
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
        return InboxMessage::make($this->title, [
            'name' => $this->author->name,
            'number' => $this->issue,
        ])
            ->body("A comment by {$this->author->name}.")
            ->category('comments')
            ->group("issue:{$this->issue}")
            ->actor($this->author)
            ->for($this->team)
            ->toast($this->toast)
            ->push($this->push)
            ->collapse(10);
    }
}
