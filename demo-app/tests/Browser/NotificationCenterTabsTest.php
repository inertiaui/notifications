<?php

// Runs against the stack selected by APP_STACK. Every request is signed in as the demo user.

use App\Models\User;
use App\Notifications\DemoNotification;

it('lists the notifications of a tab that the application added, after the built-in tabs', function () {
    User::demo()->notify(new DemoNotification('deploy', 9));
    User::demo()->notify(new DemoNotification('invoice', 6));

    visit('/')
        ->click('header [data-inbox-bell]')
        ->assertScript("[...document.querySelectorAll('header [data-inbox-tab]')].map((tab) => tab.dataset.inboxTab)", [
            'all',
            'unread',
            'snoozed',
            'archived',
            'production',
        ])
        ->assertSeeIn('header [data-inbox-tab="production"]', 'Production')
        ->click('header [data-inbox-tab="production"]')
        ->assertAttribute('header [data-inbox-tab="production"]', 'aria-selected', 'true')
        ->assertSeeIn('header [data-inbox-scroller]', 'Deployment finished')
        ->assertDontSeeIn('header [data-inbox-scroller]', 'Invoice INV-2006 paid')
        ->assertNoJavaScriptErrors();
});
