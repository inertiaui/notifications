<?php

// Runs against the stack selected by APP_STACK. Every request is signed in as the demo user.

use App\Models\User;
use App\Notifications\LifecycleNotification;
use Illuminate\Support\Facades\Event;
use InertiaUI\Notifications\Events\InboxChanged;
use InertiaUI\Notifications\Events\InboxNotificationArrived;
use InertiaUI\Notifications\Inbox;

/**
 * Send the newest InboxChanged event of the given kind that the server broadcast to the page, as Echo receives it.
 */
function sendChange(mixed $page, string $kind): void
{
    $event = Event::dispatched(InboxChanged::class)
        ->map(fn (array $arguments) => $arguments[0])
        ->last(fn (InboxChanged $event) => $event->change['kind'] === $kind);

    broadcastEvent($page, Inbox::channel(User::demo()), '.inertiaui.inbox.changed', $event->broadcastWith());
}

it('shows the result of an action in place of its buttons, also after a reload', function () {
    User::demo()->notify(new LifecycleNotification('approval'));

    $page = visit('/lifecycle')
        ->click('header [data-inbox-bell]')
        ->assertSeeIn('header [data-inbox-panel]', 'Expense #42 needs your approval')
        ->click('header [data-inbox-panel] [data-inbox-action="0"]')
        ->assertSeeIn('header [data-inbox-result]', 'Approved')
        ->assertMissing('header [data-inbox-panel] [data-inbox-action]')
        // The button that had focus is gone, so focus moves to its notification.
        ->assertScript("document.activeElement.matches('header [data-inbox-item]')", true);

    $page->wait(0.5);
    expect(User::demo()->inbox()->sole()->toInboxArray()['result'])->toBe('Approved');

    $page->navigate('/inbox')
        ->assertSeeIn('main [data-inbox-result]', 'Approved')
        ->assertMissing('main [data-inbox-action]')
        ->assertNoJavaScriptErrors();
});

it('shows the new message of an open notification, and leaves it out once the server retracted it', function () {
    config(['inertia-notifications.inbox.broadcast_changes' => true]);
    Event::fake([InboxChanged::class]);
    User::demo()->notify(new LifecycleNotification('build'));

    $page = visit('/lifecycle');
    $page->script(FAKE_ECHO);
    $page->click('header [data-inbox-bell]')
        ->assertSeeIn('header [data-inbox-panel]', 'Build #42 is running')
        ->assertScript(listensFor(Inbox::channel(User::demo()), '.inertiaui.inbox.changed'));

    Inbox::update(LifecycleNotification::BUILD, LifecycleNotification::buildPassed());
    sendChange($page, 'update');

    $page->assertSeeIn('header [data-inbox-panel]', 'Build #42 passed')
        ->assertSeeIn('header [data-inbox-panel]', 'Deployed to production in 93 seconds.')
        ->assertDontSeeIn('header [data-inbox-panel]', 'Build #42 is running');

    Inbox::retract(LifecycleNotification::BUILD);
    sendChange($page, 'delete');

    $page->assertDontSeeIn('header [data-inbox-panel]', 'Build #42 passed')
        ->assertSeeIn('header [data-inbox-panel]', 'You have no notifications.')
        ->assertNoJavaScriptErrors();
});

it('collapses the comments into one notification that shows who commented, and brings it back as unread', function () {
    $page = visit('/lifecycle')
        ->click('[data-demo="collapsing"] button')
        ->assertSeeIn('header [data-inbox-badge]', '1')
        ->click('header [data-inbox-bell]')
        ->assertSeeIn('header [data-inbox-panel]', 'Sophie Martin commented on pull request #12')
        ->assertSeeIn('header [data-inbox-actors]', 'Sophie Martin and 3 others')
        ->assertScript("document.querySelectorAll('header [data-inbox-panel] [data-inbox-item]').length", 1)
        ->assertScript("document.querySelectorAll('header [data-inbox-actors] [aria-hidden] > span').length", 3)
        ->assertScript("document.querySelector('header [data-inbox-actors] img')?.getAttribute('src')", '/avatars/sophie.svg')
        ->assertScript('document.title.startsWith("(1) ")', true)
        ->click('header [data-inbox-toggle-read]')
        ->assertPresent('header [data-inbox-item][data-read="true"]')
        ->click('header [data-inbox-bell]')
        ->assertMissing('header [data-inbox-badge]');

    // The same people comment again, so the notification that was read comes back as unread.
    $page->click('[data-demo="collapsing"] button')
        ->assertSeeIn('header [data-inbox-badge]', '1')
        ->click('header [data-inbox-bell]')
        ->assertPresent('header [data-inbox-item][data-read="false"]')
        ->assertScript("document.querySelectorAll('header [data-inbox-panel] [data-inbox-item]').length", 1)
        ->assertSeeIn('header [data-inbox-actors]', 'Sophie Martin and 3 others')
        ->assertNoJavaScriptErrors();

    expect(User::demo()->inbox()->sole()->toInboxArray())->toMatchArray(['actorCount' => 4, 'total' => 8]);
});

it('updates the open notification when a broadcast collapses into it, and counts it once', function () {
    config(['inertia-notifications.inbox.broadcast_notifications' => true]);
    Event::fake([InboxNotificationArrived::class]);
    User::demo()->notify(new LifecycleNotification('comment', 'Maria Garcia'));

    $page = visit('/lifecycle');
    $page->script(FAKE_ECHO);
    $page->click('header [data-inbox-bell]')
        ->assertSeeIn('header [data-inbox-panel]', 'Maria Garcia commented on pull request #12')
        ->assertMissing('header [data-inbox-actors]')
        ->assertScript(listensFor(Inbox::channel(User::demo()), ARRIVED_EVENT));

    User::demo()->notify(new LifecycleNotification('comment', 'Sophie Martin'));

    $arrival = Event::dispatched(InboxNotificationArrived::class)->last()[0];

    broadcastNotification($page, Inbox::channel(User::demo()), $arrival->item, $arrival->counts);

    $page->assertSeeIn('header [data-inbox-panel]', 'Sophie Martin commented on pull request #12')
        ->assertSeeIn('header [data-inbox-actors]', 'Sophie Martin and Maria Garcia')
        ->assertDontSeeIn('header [data-inbox-panel]', 'Maria Garcia commented on pull request #12')
        ->assertScript("document.querySelectorAll('header [data-inbox-panel] [data-inbox-item]').length", 1)
        ->assertScript('document.title.startsWith("(1) ")', true)
        ->assertNoJavaScriptErrors();
});

it('mutes a thread from the notification, so later replies no longer arrive unless they mention the user', function () {
    $page = visit('/lifecycle')
        ->click('Sophie replies')
        ->assertSeeIn('header [data-inbox-badge]', '1')
        ->click('header [data-inbox-bell]')
        ->assertSeeIn('header [data-inbox-panel]', 'Sophie Martin replied in "Deploy freeze"')
        ->assertMissing('header [data-inbox-muted]')
        ->click('header [data-inbox-mute]')
        ->assertSeeIn('header [data-inbox-muted]', 'Thread muted')
        ->assertAttribute('header [data-inbox-mute]', 'aria-label', 'Unmute thread: Sophie Martin replied in "Deploy freeze"');

    $page->wait(0.5);
    expect(Inbox::isMuted(User::demo(), 'discussion:3'))->toBeTrue();

    // A reply in the muted thread does not arrive, and a mention does.
    $page->click('header [data-inbox-bell]')
        ->click('Sophie replies')
        ->wait(0.5)
        ->click('Sophie mentions you')
        ->assertSeeIn('header [data-inbox-badge]', '2')
        ->click('header [data-inbox-bell]')
        ->assertSeeIn('header [data-inbox-panel]', 'Sophie Martin mentioned you in "Deploy freeze"')
        ->assertScript("document.querySelectorAll('header [data-inbox-panel] [data-inbox-item]').length", 1)
        ->click('header [data-inbox-group-toggle]')
        ->assertScript("document.querySelectorAll('header [data-inbox-panel] [data-inbox-item]').length", 2);

    expect(User::demo()->inbox()->count())->toBe(2);

    // The thread stays muted after a reload, and the same button unmutes it.
    $page->navigate('/lifecycle')
        ->click('header [data-inbox-bell]')
        ->assertSeeIn('header [data-inbox-muted]', 'Thread muted')
        ->click('header [data-inbox-mute]')
        ->assertMissing('header [data-inbox-muted]')
        ->click('header [data-inbox-bell]')
        ->click('Sophie replies')
        ->assertSeeIn('header [data-inbox-badge]', '3')
        ->assertNoJavaScriptErrors();

    expect(Inbox::isMuted(User::demo(), 'discussion:3'))->toBeFalse();
});
