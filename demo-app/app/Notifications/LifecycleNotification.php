<?php

namespace App\Notifications;

use Illuminate\Notifications\Notification;
use InertiaUI\Notifications\Concerns\InteractsWithInbox;
use InertiaUI\Notifications\InboxMessage;
use InertiaUI\Notifications\ToastAction;

/**
 * The notifications of the Lifecycle page, which change after they were sent.
 */
class LifecycleNotification extends Notification
{
    use InteractsWithInbox;

    public const array SCENARIOS = ['approval', 'build', 'comment', 'reply', 'mention'];

    /**
     * The once() key of the build, which the Lifecycle page updates and retracts.
     */
    public const string BUILD = 'demo-build';

    /**
     * The people who comment on the pull request, newest last.
     */
    public const array COMMENTERS = [
        'Maria Garcia' => null,
        'Liam Chen' => null,
        'Noah Fischer' => null,
        'Sophie Martin' => '/avatars/sophie.svg',
    ];

    public function __construct(public string $scenario, public ?string $author = null) {}

    public function via(object $notifiable): array
    {
        return ['inbox'];
    }

    public function toInbox(object $notifiable): InboxMessage
    {
        return match ($this->scenario) {
            // Each button keeps its result once its request succeeded, in place of the buttons.
            'approval' => InboxMessage::make('Expense #42 needs your approval')
                ->body('Maria Garcia spent $86.40 on a team lunch.')
                ->actor(null, 'Maria Garcia')
                ->category('billing')
                ->action(ToastAction::make('Approve')->post('/lifecycle/expenses/42/approve')->preserveScroll()->result('Approved'))
                ->action(ToastAction::make('Decline')->post('/lifecycle/expenses/42/decline')->preserveScroll()->result('Declined')),
            // The Lifecycle page replaces this message once the build passed, or retracts it.
            'build' => InboxMessage::make('Build #42 is running')
                ->body('Sophie Martin started a deployment to production.')
                ->actor(null, 'Sophie Martin')
                ->category('deployments')
                ->url('/lifecycle')
                ->once(self::BUILD),
            // Comments within an hour update one notification, which shows the people who commented.
            'comment' => InboxMessage::make(':name commented on pull request #12', ['name' => $this->author])
                ->body("{$this->author} left a review comment on \"Add send-time collapsing\".")
                ->actor(null, $this->author, self::COMMENTERS[$this->author] ?? null)
                ->category('comments')
                ->group('pull-request:12')
                ->url('/lifecycle')
                ->collapse(),
            // Replies in a discussion that the Lifecycle page mutes. A mention reaches the user in a muted thread.
            'reply' => InboxMessage::make('Sophie Martin replied in "Deploy freeze"')
                ->body('Let us hold the release until Monday.')
                ->actor(null, 'Sophie Martin', self::COMMENTERS['Sophie Martin'])
                ->category('comments')
                ->group('discussion:3')
                ->url('/lifecycle'),
            'mention' => InboxMessage::make('Sophie Martin mentioned you in "Deploy freeze"')
                ->body('@you, can you confirm the release date?')
                ->actor(null, 'Sophie Martin', self::COMMENTERS['Sophie Martin'])
                ->category('comments')
                ->group('discussion:3')
                ->url('/lifecycle')
                ->mention(),
        };
    }

    /**
     * The message that replaces the build's once it passed.
     */
    public static function buildPassed(): InboxMessage
    {
        return InboxMessage::make('Build #42 passed')
            ->body('Deployed to production in 93 seconds.')
            ->actor(null, 'Sophie Martin')
            ->url('/lifecycle');
    }
}
