<?php

// Runs against the stack selected by APP_STACK. Every request is signed in as the demo user.

use App\Models\User;
use App\Notifications\DemoNotification;
use InertiaUI\Notifications\Inbox;
use Pest\Browser\Api\AwaitableWebpage;
use Pest\Browser\Api\PendingAwaitablePage;

/**
 * Broadcast the demo user's deployment notification, which shares the second of the newest filled notification.
 */
function broadcastDeployment(AwaitableWebpage|PendingAwaitablePage $page): void
{
    $deployment = collect(Inbox::paginate(User::demo())->items())->first(
        fn ($item) => $item->toInboxArray()['title'] === 'Deployment finished',
    );

    broadcastNotification($page, 'App.Models.User.1', $deployment);
}

const PILL_SCROLLER = "document.querySelector('header [data-inbox-scroller]')";

// Scrolls the panel's list back to the top, and resolves once the page has rendered the scroll.
const PILL_SCROLL_TO_TOP = <<<'JS'
    new Promise((resolve) => {
        document.querySelector('header [data-inbox-scroller]').scrollTop = 0
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)))
    })
    JS;

it('holds a notification that arrives while the list is scrolled down behind a button that shows it', function () {
    DemoNotification::fill(User::demo(), 30);

    $page = visit('/');
    $page->script(FAKE_ECHO);

    // The visit subscribes to the user's channel with the Echo that is now configured.
    $page->click('Inbox')
        ->assertPathIs('/inbox')
        ->click('header [data-inbox-bell]')
        ->assertSeeIn('header [data-inbox-panel]', 'Sophie Martin commented on issue #30');

    $page->script(PILL_SCROLLER.'.scrollTop = 400');

    User::demo()->notify(new DemoNotification('deploy', 9));
    broadcastDeployment($page);

    $page->assertSeeIn('header [data-inbox-show-new]', '1 new')
        ->assertDontSeeIn('header [data-inbox-scroller]', 'Deployment finished')
        ->assertScript(PILL_SCROLLER.'.scrollTop', 400)
        ->click('header [data-inbox-show-new]')
        ->assertMissing('header [data-inbox-show-new]')
        ->assertSeeIn('header [data-inbox-panel] [data-inbox-item]:first-child', 'Deployment finished')
        ->assertScript(PILL_SCROLLER.'.scrollTop', 0)
        ->assertScript("document.activeElement.closest('[data-inbox-item]')?.textContent.includes('Deployment finished')", true)
        ->assertNoJavaScriptErrors();
});

it('shows a notification that arrives at the top right away while the list is not scrolled', function () {
    DemoNotification::fill(User::demo(), 30);

    $page = visit('/');
    $page->script(FAKE_ECHO);

    $page->click('Inbox')
        ->assertPathIs('/inbox')
        ->click('header [data-inbox-bell]')
        ->assertSeeIn('header [data-inbox-panel]', 'Sophie Martin commented on issue #30');

    User::demo()->notify(new DemoNotification('deploy', 9));
    broadcastDeployment($page);

    $page->assertSeeIn('header [data-inbox-panel] [data-inbox-item]:first-child', 'Deployment finished')
        ->assertMissing('header [data-inbox-show-new]');
});

it('shows the held notifications once the reader scrolls back to the top', function () {
    DemoNotification::fill(User::demo(), 30);

    $page = visit('/');
    $page->script(FAKE_ECHO);

    $page->click('Inbox')
        ->assertPathIs('/inbox')
        ->click('header [data-inbox-bell]')
        ->assertSeeIn('header [data-inbox-panel]', 'Sophie Martin commented on issue #30');

    $page->script(PILL_SCROLLER.'.scrollTop = 400');

    User::demo()->notify(new DemoNotification('deploy', 9));
    broadcastDeployment($page);

    $page->assertSeeIn('header [data-inbox-show-new]', '1 new');
    $page->script(PILL_SCROLL_TO_TOP);

    $page->assertMissing('header [data-inbox-show-new]')
        ->assertSeeIn('header [data-inbox-panel] [data-inbox-item]:first-child', 'Deployment finished');
});
