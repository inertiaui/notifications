<?php

// Runs against the stack selected by APP_STACK. Every request is signed in as the demo user.

use App\Models\User;
use App\Notifications\DemoNotification;

it('deletes a notification from the panel for good', function () {
    User::demo()->notify(new DemoNotification('report', 5));
    User::demo()->notify(new DemoNotification('invoice', 6));

    $page = visit('/')
        ->click('header [data-inbox-bell]')
        ->assertSeeIn('header [data-inbox-panel]', 'Invoice INV-2006 paid')
        ->click('header [data-inbox-item]:has-text("Invoice INV-2006 paid") [data-inbox-delete]')
        ->assertDontSeeIn('header [data-inbox-panel]', 'Invoice INV-2006 paid')
        ->assertSeeIn('header [data-inbox-panel]', 'Weekly report #5 is ready');

    $page->wait(0.5);
    expect(User::demo()->inbox()->count())->toBe(1);

    $page->navigate('/inbox')
        ->assertSee('Weekly report #5 is ready')
        ->assertDontSee('Invoice INV-2006 paid')
        ->assertNoJavaScriptErrors();
});

it('names the notification on its delete button', function () {
    User::demo()->notify(new DemoNotification('invoice', 6));

    visit('/')
        ->click('header [data-inbox-bell]')
        ->assertAttribute('header [data-inbox-delete]', 'aria-label', 'Delete: Invoice INV-2006 paid');
});
