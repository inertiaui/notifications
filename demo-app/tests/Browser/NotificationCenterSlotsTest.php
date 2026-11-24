<?php

// Runs against the stack selected by APP_STACK. Every request is signed in as the demo user.

use App\Models\User;
use App\Notifications\DemoNotification;

const CUSTOM = '[data-demo="custom"]';

const INVOICE = CUSTOM.' [data-inbox-panel] [data-inbox-item]:has-text("Invoice INV-2006 paid")';

it('opens and closes the panel from outside, and reports the panel opening and closing itself', function () {
    $page = visit('/notification-center')
        // Setting the model opens the panel.
        ->click('[data-demo="open-custom"]')
        ->assertAttribute(CUSTOM.' [data-inbox-bell]', 'aria-expanded', 'true')
        ->assertVisible(CUSTOM.' [data-inbox-panel]')
        ->assertSeeIn('[data-demo="open-custom"]', 'The panel is open')
        // The close() of the header slot closes the panel, which updates the model.
        ->click('[data-demo-close]')
        ->assertAttribute(CUSTOM.' [data-inbox-bell]', 'aria-expanded', 'false')
        ->assertSeeIn('[data-demo="open-custom"]', 'Open the panel')
        // The bell opens the panel, which updates the model.
        ->click(CUSTOM.' [data-inbox-bell]')
        ->assertSeeIn('[data-demo="open-custom"]', 'The panel is open')
        // Clearing the model closes the panel.
        ->click('[data-demo-footer]')
        ->assertAttribute(CUSTOM.' [data-inbox-bell]', 'aria-expanded', 'false')
        ->assertScript("document.querySelector('[data-demo=\"custom\"] [data-inbox-panel]').matches(':popover-open')", false)
        // Escape closes the panel, which updates the model.
        ->click(CUSTOM.' [data-inbox-bell]')
        ->assertSeeIn('[data-demo="open-custom"]', 'The panel is open')
        ->keys(CUSTOM.' [data-inbox-panel]', 'Escape')
        ->assertSeeIn('[data-demo="open-custom"]', 'Open the panel');

    $page->assertNoJavaScriptErrors();
});

it('renders the badge and header slots, and lets an item click listener cancel opening the notification', function () {
    User::demo()->notify(new DemoNotification('report', 5));
    User::demo()->notify(new DemoNotification('invoice', 6));

    $page = visit('/notification-center')
        ->assertSeeIn(CUSTOM.' [data-demo-badge]', '2')
        ->click(CUSTOM.' [data-inbox-bell]')
        ->assertSeeIn(CUSTOM.' [data-inbox-panel] h2', 'Notifications: 2 unread')
        // The heading of the header slot still names the panel.
        ->assertScript("(() => { const panel = document.querySelector('[data-demo=\"custom\"] [data-inbox-panel]'); return panel.querySelector('h2').id === panel.getAttribute('aria-labelledby') })()")
        ->click(INVOICE.' [data-inbox-link]')
        ->assertSeeIn('[data-demo-log]', 'Clicked Invoice INV-2006 paid')
        ->assertPathIs('/notification-center')
        ->assertAttribute(INVOICE, 'data-read', 'false')
        // The action listener does not cancel, so the action runs.
        ->click(INVOICE.' [data-inbox-action]')
        ->assertSeeIn('[data-demo-log]', 'Ran Send receipt')
        ->assertSee('Receipt sent');

    $page->assertNoJavaScriptErrors();
});

it('renders the error slot when the list fails to load, and retries from it', function () {
    User::demo()->notify(new DemoNotification('comment', 7));

    $page = visit('/notification-center');

    // The list request goes to a missing route until the test lets it through.
    $page->script(<<<'JS'
        () => {
            window.failInbox = true
            const open = XMLHttpRequest.prototype.open
            XMLHttpRequest.prototype.open = function (method, url, ...rest) {
                return open.call(this, method, window.failInbox ? String(url).replace('/_inertia-notifications?', '/missing-inbox?') : url, ...rest)
            }
        }
        JS);

    $page->click(CUSTOM.' [data-inbox-bell]')
        ->assertSeeIn(CUSTOM.' [data-inbox-error]', 'The inbox is out of reach.')
        ->script('window.failInbox = false');

    $page->click('[data-demo-retry]')
        ->assertSeeIn(CUSTOM.' [data-inbox-panel]', 'Sophie Martin commented on issue #7');
});
