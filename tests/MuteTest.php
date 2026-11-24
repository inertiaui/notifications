<?php

use Illuminate\Notifications\Events\NotificationSent;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use InertiaUI\Notifications\Inbox;
use InertiaUI\Notifications\InboxMessage;
use InertiaUI\Notifications\Tests\Fixtures\ReplyPosted;
use InertiaUI\Notifications\Tests\Fixtures\User;

beforeEach(function (): void {
    registerNotificationRoutes();

    $this->user = User::named('Pascal');
    $this->sent = [];

    Event::listen(NotificationSent::class, function (NotificationSent $event): void {
        $this->sent[] = $event->channel;
    });
});

it('mutes the thread of a notification for the signed-in user', function (): void {
    $this->user->notify(new ReplyPosted);
    $reply = $this->user->inbox()->sole();
    $sophie = User::named('Sophie');

    $response = $this->actingAs($this->user)
        ->postJson("/_inertia-notifications/{$reply->id}/mute")
        ->assertOk();

    expect($response->json('change'))
        ->toBe(['kind' => 'mute', 'group' => 'thread:7', 'muted' => true])
        ->and($response->json('counts.unread'))
        ->toBe(1)
        ->and(Inbox::isMuted($this->user, 'thread:7'))
        ->toBeTrue()
        ->and(Inbox::isMuted($sophie, 'thread:7'))
        ->toBeFalse();
});

it('sends no channel of a later notification in a muted thread', function (): void {
    $this->user->notify(new ReplyPosted);
    Inbox::mute($this->user, 'thread:7');
    $this->sent = [];

    $this->user->notify(new ReplyPosted);
    $this->user->notify(new ReplyPosted(thread: 8));

    expect($this->sent)
        ->toBe(['inbox', 'mail'])
        ->and($this->user->inbox()->pluck('group_key')->sort()->values()->all())
        ->toBe(['thread:7', 'thread:8']);
});

it('keeps the notifications that the user already has when the thread is muted', function (): void {
    $this->user->notify(new ReplyPosted);

    Inbox::mute($this->user, 'thread:7');

    expect($this->user->inbox()->sole()->isRead())->toBeFalse();
});

it('reaches the user in a muted thread when the notification mentions them', function (): void {
    Inbox::mute($this->user, 'thread:7');

    $this->user->notify(new ReplyPosted(mention: true));

    expect($this->sent)
        ->toBe(['inbox', 'mail'])
        ->and(Inbox::isMuted($this->user, 'thread:7'))
        ->toBeTrue();
});

it('reaches the user in a muted thread of a locked category', function (): void {
    config(['inertia-notifications.preferences.categories' => ['security' => ['label' => 'Security', 'locked' => true]]]);
    Inbox::mute($this->user, 'thread:7');

    $this->user->notify(new ReplyPosted(category: 'security'));

    expect($this->sent)->toBe(['inbox', 'mail']);
});

it('reads the locked category of a muted thread from notificationCategory() before the inbox message', function (): void {
    config(['inertia-notifications.preferences.categories' => [
        'comments' => ['label' => 'Comments'],
        'security' => ['label' => 'Security', 'locked' => true],
    ]]);
    Inbox::mute($this->user, 'thread:7');

    $this->user->notify(new class extends ReplyPosted
    {
        /**
         * Get the category of the notification.
         */
        public function notificationCategory(object $notifiable): string
        {
            return 'security';
        }
    });

    expect($this->sent)->toBe(['inbox', 'mail']);

    $this->sent = [];
    $this->user->notify(new class(category: 'security') extends ReplyPosted
    {
        /**
         * Get the category of the notification.
         */
        public function notificationCategory(object $notifiable): string
        {
            return 'comments';
        }
    });

    expect($this->sent)->toBe([]);
});

it('unmutes the thread of a notification', function (): void {
    $this->user->notify(new ReplyPosted);
    $reply = $this->user->inbox()->sole();
    Inbox::mute($this->user, 'thread:7');
    Inbox::mute(User::named('Sophie'), 'thread:7');

    $response = $this->actingAs($this->user)
        ->postJson("/_inertia-notifications/{$reply->id}/unmute")
        ->assertOk();
    $this->sent = [];
    $this->user->notify(new ReplyPosted);

    expect($response->json('change'))
        ->toBe(['kind' => 'mute', 'group' => 'thread:7', 'muted' => false])
        ->and($this->sent)
        ->toBe(['inbox', 'mail'])
        ->and(Inbox::isMuted(User::query()->where('name', 'Sophie')->sole(), 'thread:7'))
        ->toBeTrue();
});

it('ignores the muted threads while the config leaves out muting, and keeps them for later', function (): void {
    config(['inertia-notifications.inbox.actions' => ['snooze', 'archive']]);
    $this->user->notify(new ReplyPosted);
    Inbox::mute($this->user, 'thread:7');
    $this->sent = [];

    $this->user->notify(new ReplyPosted);
    $items = $this->actingAs($this->user)->getJson('/_inertia-notifications')->json('items');

    expect($this->sent)
        ->toBe(['inbox', 'mail'])
        ->and(collect($items)->pluck('muted')->unique()->all())
        ->toBe([false])
        ->and($this->user->inbox()->first()->toInboxArray()['muted'])
        ->toBeFalse();

    config(['inertia-notifications.inbox.actions' => ['snooze', 'archive', 'mute']]);
    $this->sent = [];
    $this->user->notify(new ReplyPosted);

    expect($this->sent)->toBe([]);
});

it('mutes a thread once when it is muted twice', function (): void {
    Inbox::mute($this->user, 'thread:7');
    Inbox::mute($this->user, 'thread:7');
    Inbox::unmute($this->user, 'thread:7');

    expect(Inbox::isMuted($this->user, 'thread:7'))->toBeFalse();
});

it('cannot mute a notification without a group key', function (): void {
    $notification = Inbox::record($this->user, (string) Str::uuid(), 'test', InboxMessage::make('Password changed'));

    $this->actingAs($this->user)
        ->postJson("/_inertia-notifications/{$notification->id}/mute")
        ->assertStatus(422);
});

it('cannot mute the notification of another user', function (): void {
    $sophie = User::named('Sophie');
    $sophie->notify(new ReplyPosted);

    $this->actingAs($this->user)
        ->postJson("/_inertia-notifications/{$sophie->inbox()->sole()->id}/mute")
        ->assertNotFound();

    expect(Inbox::isMuted($sophie, 'thread:7'))->toBeFalse();
});

it('lists whether the thread of each notification is muted with one query', function (): void {
    $this->user->notify(new ReplyPosted);
    $this->user->notify(new ReplyPosted(thread: 8));
    $this->user->notify(new ReplyPosted(thread: 9));
    Inbox::record($this->user, (string) Str::uuid(), 'test', InboxMessage::make('Password changed'));
    Inbox::mute($this->user, 'thread:7');
    Inbox::mute($this->user, 'thread:9');
    DB::enableQueryLog();

    $response = $this->actingAs($this->user)
        ->getJson('/_inertia-notifications')
        ->assertOk();

    $muted = collect($response->json('items'))->mapWithKeys(fn (array $item): array => [$item['title'] => $item['muted']]);
    $queries = collect(DB::getQueryLog())->filter(fn (array $query): bool => str_contains($query['query'], 'inbox_mutes'));

    expect($muted->all())
        ->toEqual([
            'Sophie replied in thread #7' => true,
            'Sophie replied in thread #8' => false,
            'Sophie replied in thread #9' => true,
            'Password changed' => false,
        ])
        ->and($queries)
        ->toHaveCount(1);
});

it('sends whether the thread is muted with a single notification', function (): void {
    $this->user->notify(new ReplyPosted(mention: true));
    Inbox::mute($this->user, 'thread:7');

    expect($this->user->inbox()->sole()->toInboxArray()['muted'])->toBeTrue();
});
