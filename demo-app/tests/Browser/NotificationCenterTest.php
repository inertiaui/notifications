<?php

// Runs against the stack selected by APP_STACK. Every request is signed in as the demo user.

use App\Models\User;
use App\Notifications\DemoNotification;
use InertiaUI\Notifications\Inbox;
use Pest\Browser\Api\AwaitableWebpage;
use Pest\Browser\Api\PendingAwaitablePage;

const LIST_ITEMS = "document.querySelectorAll('[data-inbox-list] [data-inbox-item]').length";

/**
 * Broadcast every notification of the demo user to the page, oldest first.
 */
function broadcastAll(AwaitableWebpage|PendingAwaitablePage $page): void
{
    foreach (array_reverse(Inbox::paginate(User::demo())->items()) as $item) {
        broadcastNotification($page, 'App.Models.User.1', $item);
    }
}

it('counts a notification sent by a server action on the bell, and shows its toast', function () {
    visit('/')
        ->assertMissing('[data-inbox-badge]')
        ->click('Deployment with a toast')
        ->assertSee('Deployment finished')
        ->assertSeeIn('[data-inbox-badge]', '1')
        ->assertAttribute('[data-inbox-bell]', 'aria-label', 'Notifications, 1 new')
        ->assertNoJavaScriptErrors();
});

it('marks a notification as read when the action of its flashed toast runs', function () {
    $page = visit('/')
        ->click('Deployment with a toast')
        ->assertSee('Deployment finished')
        ->click('[data-toast-id^="inertiaui-inbox-"] [data-toast-action]');

    $page->wait(0.5);
    expect(User::demo()->inbox()->sole()->read_at)->not->toBeNull();
    $page->assertNoJavaScriptErrors();
});

it('opens the panel with focus on it, marks the notifications as seen, and returns focus on Escape', function () {
    // Numbered from the oldest: invoice 1, report 2, comment 3.
    DemoNotification::fill(User::demo(), 3);

    visit('/')
        ->assertSeeIn('[data-inbox-badge]', '3')
        ->click('[data-inbox-bell]')
        ->assertSee('Sophie Martin commented on issue #3')
        ->assertAttribute('[data-inbox-bell]', 'aria-expanded', 'true')
        ->assertScript("document.activeElement.hasAttribute('data-inbox-panel')")
        // Newest first.
        ->assertScript("[...document.querySelectorAll('[data-inbox-panel] [data-inbox-link]')].map((link) => link.textContent.trim())", [
            'Sophie Martin commented on issue #3',
            'Weekly report #2 is ready',
            'Invoice INV-2001 paid',
        ])
        // The notifications count as seen once they have shown for a second.
        ->assertSeeIn('[data-inbox-badge]', '3')
        ->wait(1.5)
        ->assertMissing('[data-inbox-badge]')
        ->keys(':focus', 'Escape')
        ->assertAttribute('[data-inbox-bell]', 'aria-expanded', 'false')
        ->assertScript("document.activeElement.hasAttribute('data-inbox-bell')")
        // The server stored them as seen, but not as read.
        ->refresh()
        ->assertMissing('[data-inbox-badge]')
        ->click('[data-inbox-bell]')
        ->assertSeeIn('[data-inbox-tab="unread"]', '3');
});

it('marks a notification as read and archives it, moving it to the Archived tab', function () {
    User::demo()->notify(new DemoNotification('comment', 7));
    $title = 'Sophie Martin commented on issue #7';

    visit('/')
        ->click('[data-inbox-bell]')
        ->assertSee($title)
        ->assertAttribute('[data-inbox-item]', 'data-read', 'false')
        ->click("[aria-label=\"Mark as read: {$title}\"]")
        ->assertAttribute('[data-inbox-item]', 'data-read', 'true')
        ->assertDontSeeIn('[data-inbox-tab="unread"]', '1')
        ->click("[aria-label=\"Archive: {$title}\"]")
        ->assertSee('You have no notifications.')
        ->click('[data-inbox-tab="archived"]')
        ->assertSee($title)
        ->assertPresent("[aria-label=\"Move to inbox: {$title}\"]")
        // The full inbox page reads the stored state.
        ->navigate('/inbox?filter=archived')
        ->assertSeeIn('[data-inbox-list]', $title)
        ->navigate('/inbox')
        ->assertSee('You have no notifications.')
        ->assertNoJavaScriptErrors();
});

it('runs an action of a notification and marks it as read', function () {
    User::demo()->notify(new DemoNotification('invoice', 41));

    visit('/')
        ->click('[data-inbox-bell]')
        ->assertSee('Invoice INV-2041 paid')
        ->click('[data-inbox-panel] [data-inbox-action]')
        ->assertSee('Receipt sent')
        ->assertAttribute('[data-inbox-panel] [data-inbox-item]', 'data-read', 'true')
        ->assertNoJavaScriptErrors();
});

it('shows a notification that arrives with Echo on the bell, as a toast, and first on the inbox page, counted once', function () {
    User::demo()->notify(new DemoNotification('comment', 1));

    $page = visit('/')->assertSeeIn('[data-inbox-badge]', '1');
    $page->script(FAKE_ECHO);

    // The visit subscribes to the user's channel with the Echo that is now configured.
    $page->click('Inbox')->assertPathIs('/inbox')->assertScript(LIST_ITEMS, 1);

    User::demo()->notify(new DemoNotification('deploy', 9));

    // The page already counted the comment, so only the deployment is new.
    broadcastAll($page);

    $page->assertSeeIn('[data-inbox-badge]', '2')
        ->assertSee('Version 2.9 is live on production.')
        ->assertScript(LIST_ITEMS, 2)
        ->assertSeeIn('[data-inbox-list] [data-inbox-item]:first-child', 'Deployment finished')
        ->assertNoJavaScriptErrors();
});

it('marks a notification that arrives while the panel is open as seen', function () {
    User::demo()->notify(new DemoNotification('comment', 1));

    $page = visit('/');
    $page->script(FAKE_ECHO);
    $page->click('[data-inbox-bell]')
        ->assertSee('Sophie Martin commented on issue #1')
        ->wait(1.5)
        ->assertMissing('[data-inbox-badge]');

    User::demo()->notify(new DemoNotification('report', 2));
    broadcastAll($page);

    $page->assertSeeIn('[data-inbox-panel]', 'Weekly report #2 is ready')
        ->assertSeeIn('[data-inbox-badge]', '1')
        ->wait(1.5)
        ->assertMissing('[data-inbox-badge]')
        ->assertNoJavaScriptErrors();

    // Lets the test server answer the request that stores it as seen.
    $page->wait(0.5);
    expect(User::demo()->inbox()->unseen()->count())->toBe(0);
});

it('requests the counts when the tab shows again, without a visit', function () {
    $page = visit('/')->assertMissing('[data-inbox-badge]');
    $page->script('window.withoutVisit = true');

    User::demo()->notify(new DemoNotification('invoice', 3));
    $page->script("document.dispatchEvent(new Event('visibilitychange'))");

    $page->assertSeeIn('[data-inbox-badge]', '1')
        ->assertScript('window.withoutVisit', true);
});

it('snoozes a notification into the Snoozed tab, and brings it back', function () {
    User::demo()->notify(new DemoNotification('comment', 7));
    $title = 'Sophie Martin commented on issue #7';

    visit('/')
        ->click('[data-inbox-bell]')
        ->assertSeeIn('[data-inbox-tab="unread"]', '1')
        ->click("[aria-label=\"Snooze: {$title}\"]")
        ->assertAttribute("[aria-label=\"Snooze: {$title}\"]", 'aria-expanded', 'true')
        // The first snooze time has focus.
        ->assertScript("document.activeElement.matches('[data-inbox-snooze-options] button:first-child')")
        ->click('[data-inbox-snooze-options] button:first-child')
        ->assertSee('You have no notifications.')
        ->assertDontSeeIn('[data-inbox-tab="unread"]', '1')
        ->click('[data-inbox-tab="snoozed"]')
        ->assertSeeIn('[data-inbox-panel]', $title)
        ->assertPresent('[data-inbox-panel] [data-inbox-snoozed-until]')
        ->assertNoJavaScriptErrors();

    expect(User::demo()->inbox()->sole()->snoozed_until?->isFuture())->toBeTrue();

    visit('/inbox?filter=snoozed')
        ->assertSeeIn('[data-inbox-list]', $title)
        ->click("[data-inbox-list] [aria-label=\"Unsnooze: {$title}\"]")
        ->assertSee('You have no snoozed notifications.')
        ->navigate('/inbox')
        ->assertSeeIn('[data-inbox-list]', $title);

    expect(User::demo()->inbox()->sole()->snoozed_until)->toBeNull();
});

it('triages the panel with the keyboard: J and K move, U reads, E archives, H snoozes', function () {
    // Numbered from the oldest: invoice 1, report 2, comment 3.
    DemoNotification::fill(User::demo(), 3);
    $focused = "document.activeElement.closest('[data-inbox-item]')?.querySelector('[data-inbox-link]')?.textContent.trim()";

    $page = visit('/')->click('[data-inbox-bell]')->assertSee('Sophie Martin commented on issue #3');

    $page->keys(':focus', 'j')->assertScript($focused, 'Sophie Martin commented on issue #3')
        ->keys(':focus', 'j')->assertScript($focused, 'Weekly report #2 is ready')
        ->keys(':focus', 'k')->assertScript($focused, 'Sophie Martin commented on issue #3')
        ->keys(':focus', 'u')
        ->assertAttribute('[data-inbox-panel] [data-inbox-item]:first-child', 'data-read', 'true')
        ->keys(':focus', 'u')
        ->assertAttribute('[data-inbox-panel] [data-inbox-item]:first-child', 'data-read', 'false')
        // Archiving moves focus to the next notification.
        ->keys(':focus', 'e')
        ->assertDontSeeIn('[data-inbox-panel]', 'Sophie Martin commented on issue #3')
        ->assertScript($focused, 'Weekly report #2 is ready')
        ->keys(':focus', 'h')
        ->assertScript("document.activeElement.matches('[data-inbox-snooze-options] button:first-child')")
        ->keys(':focus', 'Enter')
        ->assertDontSeeIn('[data-inbox-panel]', 'Weekly report #2 is ready')
        // Focus moves on from the snoozed notification, so triage continues.
        ->assertScript($focused, 'Invoice INV-2001 paid')
        ->assertScript("[...document.querySelectorAll('[data-inbox-panel] [data-inbox-link]')].map((link) => link.textContent.trim())", ['Invoice INV-2001 paid'])
        // Archiving the last notification leaves focus in the panel.
        ->keys(':focus', 'e')
        ->assertSee('You have no notifications.')
        ->assertScript("document.activeElement.matches('[data-inbox-panel]')")
        ->assertNoJavaScriptErrors();

    $page->wait(0.5);
    expect(User::demo()->inbox()->whereNotNull('archived_at')->count())->toBe(2)
        ->and(User::demo()->inbox()->snoozed()->count())->toBe(1);
});

it('filters the panel by category, with the unread count of each', function () {
    User::demo()->notify(new DemoNotification('invoice', 5));
    User::demo()->notify(new DemoNotification('comment', 6));

    visit('/')
        ->click('[data-inbox-bell]')
        ->assertSeeIn('[data-inbox-category="billing"]', '1')
        ->assertSeeIn('[data-inbox-category="comments"]', '1')
        ->click('[data-inbox-category="billing"]')
        ->assertAttribute('[data-inbox-category="billing"]', 'aria-pressed', 'true')
        ->assertSeeIn('[data-inbox-panel]', 'Invoice INV-2005 paid')
        ->assertDontSeeIn('[data-inbox-panel]', 'Sophie Martin commented on issue #6')
        ->click("[aria-label=\"Mark as read: Invoice INV-2005 paid\"]")
        ->assertDontSeeIn('[data-inbox-category="billing"]', '1')
        // The category stays selected on another tab.
        ->click('[data-inbox-tab="unread"]')
        ->assertSee('You have no unread notifications.')
        ->click('[data-inbox-category=""]')
        ->assertSeeIn('[data-inbox-panel]', 'Sophie Martin commented on issue #6')
        ->assertNoJavaScriptErrors();
});

it('names the controls of a notification and the menu button in tooltips on hover', function () {
    User::demo()->notify(new DemoNotification('invoice', 5));

    visit('/')
        ->click('[data-inbox-bell]')
        ->hover('[data-inbox-toggle-archive]')
        ->assertSeeIn('[data-inbox-tooltip]', 'Archive')
        ->assertSeeIn('[data-inbox-tooltip] kbd', 'E')
        ->assertAttribute('[data-inbox-toggle-archive]', 'aria-label', 'Archive: Invoice INV-2005 paid')
        ->hover('[data-inbox-menu-button]')
        ->assertSeeIn('[data-inbox-tooltip]', 'More actions')
        ->assertCount('[data-inbox-tooltip]', 1)
        ->assertNoJavaScriptErrors();
});

it('archives the notifications of the selected category from the panel header', function () {
    User::demo()->notify(new DemoNotification('invoice', 5));
    User::demo()->notify(new DemoNotification('comment', 6));

    $page = visit('/')
        ->click('[data-inbox-bell]')
        ->click('[data-inbox-category="billing"]')
        ->assertSeeIn('[data-inbox-panel]', 'Invoice INV-2005 paid')
        ->click('[data-inbox-menu-button]')
        ->click('[data-inbox-archive-all]')
        ->assertSee('You have no notifications.')
        ->assertMissing('[data-inbox-menu]')
        ->click('[data-inbox-menu-button]')
        ->assertAttribute('[data-inbox-archive-all]', 'aria-disabled', 'true')
        ->keys('[data-inbox-menu]', 'Escape')
        ->assertMissing('[data-inbox-menu]')
        ->assertScript("document.activeElement.hasAttribute('data-inbox-menu-button')")
        ->click('[data-inbox-category=""]')
        ->assertSeeIn('[data-inbox-panel]', 'Sophie Martin commented on issue #6')
        // Only the All tab offers to archive everything.
        ->click('[data-inbox-tab="unread"]')
        ->click('[data-inbox-menu-button]')
        ->assertMissing('[data-inbox-archive-all]')
        ->assertPresent('[data-inbox-pause-option]')
        ->assertPresent('[data-inbox-read-all]');

    expect(User::demo()->inbox()->whereNotNull('archived_at')->pluck('category')->all())->toBe(['billing']);
    $page->assertNoJavaScriptErrors();
});

it('shows notifications of the same group as one, with a button that shows the others', function () {
    visit('/')
        ->click('Three replies on one issue')
        ->assertSeeIn('[data-inbox-badge]', '3')
        ->click('[data-inbox-bell]')
        ->assertScript("document.querySelectorAll('[data-inbox-panel] [data-inbox-item]').length", 1)
        ->assertSeeIn('[data-inbox-panel] [data-inbox-group-toggle]', 'Show 2 more')
        ->click('[data-inbox-panel] [data-inbox-group-toggle]')
        ->assertAttribute('[data-inbox-panel] [data-inbox-group-toggle]', 'aria-expanded', 'true')
        ->assertScript("document.querySelectorAll('[data-inbox-panel] [data-inbox-item]').length", 3)
        ->assertSeeIn('[data-inbox-panel]', 'Maria Garcia commented on issue #42')
        ->assertSeeIn('[data-inbox-panel]', 'Noah Fischer commented on issue #42')
        ->assertNoJavaScriptErrors();
});

it('keeps a thread expanded when its newest notification leaves', function () {
    // A second apart, so the comment of Noah Fischer leads the thread.
    foreach (['Sophie Martin', 'Maria Garcia', 'Noah Fischer'] as $actor) {
        User::demo()->notify(new DemoNotification('comment', 42, $actor));
        $this->travel(1)->seconds();
    }

    // The clock runs again, so the archive gets a newer revision than the list, which the panel needs to apply it.
    $this->travelBack();

    visit('/')
        ->click('[data-inbox-bell]')
        ->click('[data-inbox-panel] [data-inbox-group-toggle]')
        ->assertScript("document.querySelectorAll('[data-inbox-panel] [data-inbox-item]').length", 3)
        ->click('[aria-label="Archive: Noah Fischer commented on issue #42"]')
        ->assertDontSeeIn('[data-inbox-panel]', 'Noah Fischer commented on issue #42')
        ->assertAttribute('[data-inbox-panel] [data-inbox-group-toggle]', 'aria-expanded', 'true')
        ->assertSeeIn('[data-inbox-panel] [data-inbox-group-toggle]', 'Show less')
        ->assertScript("document.querySelectorAll('[data-inbox-panel] [data-inbox-item]').length", 2)
        ->assertSeeIn('[data-inbox-panel]', 'Maria Garcia commented on issue #42')
        ->assertSeeIn('[data-inbox-panel]', 'Sophie Martin commented on issue #42')
        ->assertNoJavaScriptErrors();
});

it('leaves the snooze times of the newest notification of a thread behind when it leaves', function () {
    // A second apart, so the comment of Noah Fischer leads the thread.
    foreach (['Sophie Martin', 'Maria Garcia', 'Noah Fischer'] as $actor) {
        User::demo()->notify(new DemoNotification('comment', 42, $actor));
        $this->travel(1)->seconds();
    }

    // The clock runs again, so the archive gets a newer revision than the list, which the panel needs to apply it.
    $this->travelBack();

    visit('/')
        ->click('[data-inbox-bell]')
        ->click('[aria-label="Snooze: Noah Fischer commented on issue #42"]')
        ->assertPresent('[data-inbox-panel] [data-inbox-snooze-options]')
        ->click('[aria-label="Archive: Noah Fischer commented on issue #42"]')
        ->assertDontSeeIn('[data-inbox-panel]', 'Noah Fischer commented on issue #42')
        ->assertSeeIn('[data-inbox-panel]', 'Maria Garcia commented on issue #42')
        ->assertNotPresent('[data-inbox-panel] [data-inbox-snooze-options]')
        ->assertAttribute('[aria-label="Snooze: Maria Garcia commented on issue #42"]', 'aria-expanded', 'false')
        ->assertNoJavaScriptErrors();
});

it('opens a notification by visiting its URL, which closes the panel', function () {
    User::demo()->notify(new DemoNotification('report', 5));

    visit('/')
        ->click('[data-inbox-bell]')
        ->click('[data-inbox-link]')
        ->assertPathIs('/inbox')
        ->assertAttribute('[data-inbox-bell]', 'aria-expanded', 'false')
        ->assertAttribute('[data-inbox-list] [data-inbox-item]', 'data-read', 'true')
        ->refresh()
        ->assertAttribute('[data-inbox-list] [data-inbox-item]', 'data-read', 'true');
});

it('loads the full inbox page by page with infinite scroll, and marks every notification as read', function () {
    DemoNotification::fill(User::demo(), 30);

    $page = visit('/inbox')
        ->assertScript(LIST_ITEMS, 20)
        ->assertDontSee('Invoice INV-2001 paid');

    $page->script('window.scrollTo(0, document.body.scrollHeight)');

    $page->assertSee('Invoice INV-2001 paid')
        ->assertScript(LIST_ITEMS, 30)
        ->assertSeeIn('[data-inbox-badge]', '3')
        ->click('main [data-inbox-read-all]')
        ->assertMissing('[data-inbox-badge]')
        ->assertScript("document.querySelectorAll('[data-inbox-list] [data-read=\"false\"]').length", 0)
        // Notifications loaded by scrolling were marked as read on the server too.
        ->refresh()
        ->assertScript("document.querySelectorAll('[data-inbox-list] [data-read=\"false\"]').length", 0)
        ->assertNoJavaScriptErrors();
});
