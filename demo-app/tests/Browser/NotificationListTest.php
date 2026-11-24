<?php

// Runs against the stack selected by APP_STACK. Every request is signed in as the demo user.

use App\Models\User;
use App\Notifications\DemoNotification;
use InertiaUI\Notifications\Inbox;

const PAGE_LIST = 'main [data-inbox-list]';

/**
 * Get the selector of the notification with the given title in the page's list.
 */
function listItem(string $title): string
{
    return PAGE_LIST." [data-inbox-item]:has-text(\"{$title}\")";
}

it('archives the selected notifications of the page in one request, and links its tabs and categories to the page', function () {
    User::demo()->notify(new DemoNotification('report', 5));
    User::demo()->notify(new DemoNotification('comment', 6));
    User::demo()->notify(new DemoNotification('invoice', 7));

    $page = visit('/inbox')
        ->assertMissing(PAGE_LIST.' [data-inbox-selection]')
        ->click(listItem('Invoice INV-2007 paid').' [data-inbox-select]')
        ->click(listItem('Weekly report #5 is ready').' [data-inbox-select]')
        ->assertSeeIn(PAGE_LIST.' [data-inbox-selection]', '2 selected')
        ->click(PAGE_LIST.' [data-inbox-batch="archive"]')
        ->assertMissing(PAGE_LIST.' [data-inbox-selection]')
        ->assertDontSeeIn(PAGE_LIST, 'Invoice INV-2007 paid')
        ->assertSeeIn(PAGE_LIST, 'Sophie Martin commented on issue #6');

    $page->wait(0.5);
    expect(User::demo()->inbox()->archived()->count())->toBe(2);

    // Another list starts without a selection.
    $page->click(listItem('Sophie Martin commented on issue #6').' [data-inbox-select]')
        ->assertSeeIn(PAGE_LIST.' [data-inbox-selection]', '1 selected')
        ->click(PAGE_LIST.' [data-inbox-category="billing"]')
        ->assertQueryStringHas('category', 'billing')
        ->assertAttribute(PAGE_LIST.' [data-inbox-category="billing"]', 'aria-current', 'page')
        ->assertMissing(PAGE_LIST.' [data-inbox-selection]')
        ->click(PAGE_LIST.' [data-inbox-tab="archived"]')
        ->assertQueryStringHas('filter', 'archived')
        ->assertQueryStringHas('category', 'billing')
        ->assertSeeIn(PAGE_LIST, 'Invoice INV-2007 paid')
        ->assertDontSeeIn(PAGE_LIST, 'Weekly report #5 is ready')
        ->assertNoJavaScriptErrors();
});

it('holds a notification that arrives while the page is scrolled down behind a button that shows it', function () {
    DemoNotification::fill(User::demo(), 30);

    $page = visit('/');
    $page->script(FAKE_ECHO);

    // The visit subscribes to the user's channel with the Echo that is now configured.
    $page->click('Inbox')
        ->assertPathIs('/inbox')
        ->assertSeeIn(PAGE_LIST, 'Sophie Martin commented on issue #30');

    $page->script('window.scrollTo(0, 800)');

    User::demo()->notify(new DemoNotification('deploy', 9));

    $deployment = collect(Inbox::paginate(User::demo())->items())->first(
        fn ($item) => $item->toInboxArray()['title'] === 'Deployment finished',
    );

    broadcastNotification($page, 'App.Models.User.1', $deployment);

    $page->assertSeeIn(PAGE_LIST.' [data-inbox-show-new]', '1 new')
        ->assertDontSeeIn(PAGE_LIST.' ul', 'Deployment finished')
        ->click(PAGE_LIST.' [data-inbox-show-new]')
        ->assertMissing(PAGE_LIST.' [data-inbox-show-new]')
        ->assertSeeIn(PAGE_LIST.' [data-inbox-item]:first-child', 'Deployment finished')
        ->assertScript("document.activeElement.closest('[data-inbox-item]')?.textContent.includes('Deployment finished')", true)
        ->assertNoJavaScriptErrors();
});

it('marks the notifications that the user saw on the page as seen', function () {
    foreach (range(1, 30) as $number) {
        User::demo()->notify(new DemoNotification('report', $number));
    }

    $page = visit('/inbox')
        ->assertScript("document.querySelectorAll('main [data-inbox-item]').length", 20)
        ->wait(1.6);

    $unseen = User::demo()->inbox()->unseen()->count();

    expect($unseen)->toBeGreaterThan(0)->toBeLessThan(30);

    $page->assertSeeIn('[data-inbox-badge]', (string) $unseen)
        ->assertNoJavaScriptErrors();
});
