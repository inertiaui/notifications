<?php

namespace App\Notifications;

use App\Models\User;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;
use InertiaUI\Notifications\Inbox;
use InertiaUI\Notifications\InboxMessage;
use InertiaUI\Notifications\ToastAction;
use InertiaUI\Notifications\ToastType;

class DemoNotification extends Notification
{
    public const array SCENARIOS = ['comment', 'invoice', 'deploy', 'report'];

    public function __construct(public string $scenario, public int $number = 1, public string $actor = 'Sophie Martin') {}

    public function via(object $notifiable): array
    {
        return ['inbox'];
    }

    public function toInbox(object $notifiable): InboxMessage
    {
        return match ($this->scenario) {
            // Comments on the same issue show as one notification, with a button that shows the others.
            'comment' => InboxMessage::make(':actor commented on issue #:number', ['actor' => $this->actor, 'number' => $this->number])
                ->body('Looks great! Can we ship this on Tuesday instead?')
                ->actor(name: $this->actor)
                ->category('comments')
                ->group("issue:{$this->number}")
                ->url('/inbox')
                ->push(),
            'invoice' => InboxMessage::make('Invoice INV-:number paid', ['number' => 2000 + $this->number])
                ->body('Acme Corp paid $1,200.00 by card.')
                ->category('billing')
                ->url('/inbox')
                ->action(ToastAction::make('Send receipt')->post('/receipts')->preserveScroll())
                ->push(),
            'deploy' => InboxMessage::make('Deployment finished')
                ->body('Version 2.:number is live on production.', ['number' => $this->number])
                ->category('deployments')
                ->with(['environment' => 'production'])
                ->url('/')
                ->toast(ToastType::Success)
                ->push(),
            default => InboxMessage::make('Weekly report #:number is ready', ['number' => $this->number])
                ->body('Signups grew 12% compared to last week.')
                ->category('reports')
                ->url('/inbox')
                ->push(),
        };
    }

    /**
     * Stores sample notifications, an hour apart and numbered from the oldest. All but the newest three are read.
     */
    public static function fill(User $user, int $count): void
    {
        foreach (range(1, $count) as $number) {
            $scenario = ['comment', 'invoice', 'report'][$number % 3];
            $message = (new self($scenario, $number))->toInbox($user)->toast(false);
            $createdAt = now()->subHours($count - $number);
            $read = $number <= $count - 3 ? $createdAt : null;

            Inbox::record($user, (string) Str::uuid(), self::class, $message)
                ->forceFill([
                    'read_at' => $read,
                    'seen_at' => $read,
                    'created_at' => $createdAt,
                    'updated_at' => $createdAt,
                ])
                ->save();
        }
    }
}
