<?php

// Runs against the stack selected by APP_STACK. Every request is signed in as the demo user.

use App\Models\User;
use App\Notifications\DemoNotification;

const PANEL = 'header [data-inbox-panel]';

/**
 * Get the selector of the notification with the given title in the panel of the header.
 */
function panelItem(string $title): string
{
    return PANEL." [data-inbox-item]:has-text(\"{$title}\")";
}

it('archives the selected notifications in one request', function () {
    User::demo()->notify(new DemoNotification('report', 5));
    User::demo()->notify(new DemoNotification('comment', 6));
    User::demo()->notify(new DemoNotification('invoice', 7));

    $page = visit('/')
        ->click('header [data-inbox-bell]')
        ->assertMissing(PANEL.' [data-inbox-selection]')
        ->click(panelItem('Invoice INV-2007 paid').' [data-inbox-select]')
        ->click(panelItem('Weekly report #5 is ready').' [data-inbox-select]')
        ->assertSeeIn(PANEL.' [data-inbox-selection]', '2 selected')
        ->assertAttribute(panelItem('Invoice INV-2007 paid').' > div', 'data-selected', 'true')
        ->click(PANEL.' [data-inbox-batch="archive"]')
        ->assertMissing(PANEL.' [data-inbox-selection]')
        ->assertDontSeeIn(PANEL, 'Invoice INV-2007 paid')
        ->assertDontSeeIn(PANEL, 'Weekly report #5 is ready')
        ->assertSeeIn(PANEL, 'Sophie Martin commented on issue #6');

    $page->wait(0.5);
    expect(User::demo()->inbox()->archived()->count())->toBe(2);
    $page->assertNoJavaScriptErrors();
});

it('selects every notification with the checkbox of the bar, and marks them as read', function () {
    User::demo()->notify(new DemoNotification('report', 5));
    User::demo()->notify(new DemoNotification('invoice', 6));

    $page = visit('/')
        ->click('header [data-inbox-bell]')
        ->click(panelItem('Invoice INV-2006 paid').' [data-inbox-select]')
        ->click(PANEL.' [data-inbox-select-all]')
        ->assertSeeIn(PANEL.' [data-inbox-selection]', '2 selected')
        ->assertScript("document.querySelector('header [data-inbox-select-all]').indeterminate", false)
        ->click(PANEL.' [data-inbox-batch="read"]')
        ->assertAttribute(panelItem('Weekly report #5 is ready'), 'data-read', 'true')
        ->assertAttribute(panelItem('Invoice INV-2006 paid'), 'data-read', 'true');

    $page->wait(0.5);
    expect(User::demo()->inbox()->unread()->count())->toBe(0);
});

it('selects the focused notification with X, and clears the selection when the tab changes or the panel closes', function () {
    User::demo()->notify(new DemoNotification('invoice', 6));

    visit('/')
        ->click('header [data-inbox-bell]')
        ->assertSeeIn(PANEL, 'Invoice INV-2006 paid')
        ->keys(':focus', 'j')
        ->keys(':focus', 'x')
        ->assertSeeIn(PANEL.' [data-inbox-selection]', '1 selected')
        ->click(PANEL.' [data-inbox-tab="unread"]')
        ->assertMissing(PANEL.' [data-inbox-selection]')
        // Returning to the tab does not bring the selection back.
        ->click(PANEL.' [data-inbox-tab="all"]')
        ->assertSeeIn(PANEL, 'Invoice INV-2006 paid')
        ->assertMissing(PANEL.' [data-inbox-selection]')
        ->assertAttribute(panelItem('Invoice INV-2006 paid').' > div', 'data-selected', 'false')
        // Neither does opening the panel again.
        ->click(panelItem('Invoice INV-2006 paid').' [data-inbox-select]')
        ->assertSeeIn(PANEL.' [data-inbox-selection]', '1 selected')
        ->keys(':focus', 'Escape')
        ->assertAttribute('header [data-inbox-bell]', 'aria-expanded', 'false')
        ->click('header [data-inbox-bell]')
        ->assertSeeIn(PANEL, 'Invoice INV-2006 paid')
        ->assertMissing(PANEL.' [data-inbox-selection]')
        ->assertAttribute(panelItem('Invoice INV-2006 paid').' > div', 'data-selected', 'false')
        ->assertNoJavaScriptErrors();
});
