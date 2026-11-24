<?php

use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use InertiaUI\Notifications\Events\InboxChanged;
use InertiaUI\Notifications\Inbox;
use InertiaUI\Notifications\InboxMessage;
use InertiaUI\Notifications\Models\InboxNotification;
use InertiaUI\Notifications\Tests\Fixtures\User;
use InertiaUI\Notifications\ToastAction;

beforeEach(function (): void {
    registerNotificationRoutes();

    app('translator')->addLines(['expenses.approved' => 'Approved by :name'], 'en');
    app('translator')->addLines(['expenses.approved' => 'Goedgekeurd door :name'], 'nl');

    $this->user = User::named('Pascal');
});

/**
 * Store an approval request for the given user under the given key.
 */
function approvalRequest(User $user, string $key = 'expense-9'): InboxNotification
{
    $approve = ToastAction::make('Approve')
        ->post('/expenses/9/approve')
        ->result('expenses.approved', ['name' => 'you']);

    return Inbox::record($user, (string) Str::uuid(), 'test', InboxMessage::make('Expense #9 needs approval')
        ->action($approve)
        ->action(ToastAction::make('Open')->url('/expenses/9'))
        ->once($key));
}

it('sends the result of an action with the notification', function (): void {
    $item = approvalRequest($this->user)->toInboxArray();

    expect($item['result'])
        ->toBeNull()
        ->and($item['actions'][0]['result'])
        ->toBe('Approved by you')
        ->and($item['actions'][1])
        ->not->toHaveKey('result');
});

it('completes a notification with the result of the action that the user ran', function (): void {
    $notification = approvalRequest($this->user);

    $response = $this->actingAs($this->user)
        ->postJson("/_inertia-notifications/{$notification->id}/complete", ['action' => 0])
        ->assertOk();

    expect($response->json('change'))
        ->toMatchArray(['kind' => 'item', 'id' => $notification->id, 'result' => 'Approved by you'])
        ->and($notification->refresh()->isCompleted())
        ->toBeTrue()
        ->and($notification->toInboxArray()['result'])
        ->toBe('Approved by you');
});

it('refuses to complete a notification with an action that has no result', function (int $action): void {
    $notification = approvalRequest($this->user);

    $this->actingAs($this->user)
        ->postJson("/_inertia-notifications/{$notification->id}/complete", ['action' => $action])
        ->assertUnprocessable();

    expect($notification->refresh()->result)->toBeNull();
})->with([1, 2]);

it('does not complete the notifications of another user', function (): void {
    $notification = approvalRequest(User::named('Sophie'));

    $this->actingAs($this->user)
        ->postJson("/_inertia-notifications/{$notification->id}/complete", ['action' => 0])
        ->assertNotFound();

    expect($notification->refresh()->result)->toBeNull();
});

it('translates the result in the locale of the user who reads it', function (): void {
    $notification = approvalRequest($this->user);

    $notification->complete('expenses.approved', ['name' => 'Sophie']);
    app()->setLocale('nl');

    expect($notification->refresh()->toInboxArray()['result'])->toBe('Goedgekeurd door Sophie');
});

it('completes the notifications with a key for every user who received them', function (): void {
    $sophie = User::named('Sophie');
    $mine = approvalRequest($this->user);
    $theirs = approvalRequest($sophie);
    $other = approvalRequest($this->user, 'expense-10');

    Inbox::complete('expense-9', 'expenses.approved', ['name' => 'Sophie']);

    expect($mine->refresh()->toInboxArray()['result'])
        ->toBe('Approved by Sophie')
        ->and($theirs->refresh()->toInboxArray()['result'])
        ->toBe('Approved by Sophie')
        ->and($other->refresh()->result)
        ->toBeNull();
});

it('completes the notification with a key of one user', function (): void {
    $mine = approvalRequest($this->user);
    $theirs = approvalRequest(User::named('Sophie'));

    Inbox::complete('expense-9', 'Done', notifiable: $this->user);

    expect($mine->refresh()->isCompleted())
        ->toBeTrue()
        ->and($theirs->refresh()->isCompleted())
        ->toBeFalse();
});

it('reverts a result, so the notification shows its actions again', function (): void {
    $notification = approvalRequest($this->user);
    $notification->complete('Approved');

    Inbox::revertResult($notification);

    expect($notification->refresh()->result)
        ->toBeNull()
        ->and($notification->toInboxArray()['actions'])
        ->toHaveCount(2);
});

it('broadcasts the result to every session of the user, also the one making the request', function (): void {
    Event::fake([InboxChanged::class]);
    config(['inertia-notifications.inbox.broadcast_changes' => true]);
    $notification = approvalRequest($this->user);

    // Such as during the request to the endpoint of the action, from the user's own browser.
    request()->headers->set('X-Socket-ID', '1234.5678');

    Inbox::complete('expense-9', 'Approved');

    $event = Event::dispatched(InboxChanged::class)->sole()[0];

    expect($event->socket)
        ->toBeNull()
        ->and($event->broadcastWith()['change'])
        ->toMatchArray(['kind' => 'item', 'id' => $notification->id, 'result' => 'Approved'])
        ->and($event->broadcastWith()['counts'])
        ->toMatchArray(['unread' => 1]);
});

it('broadcasts no result unless changes are broadcast', function (): void {
    Event::fake([InboxChanged::class]);
    approvalRequest($this->user);

    Inbox::complete('expense-9', 'Approved');

    Event::assertNotDispatched(InboxChanged::class);
});
