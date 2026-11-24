<?php

// Runs against the stack selected by APP_STACK. Every request is signed in as the demo user.

use App\Models\User;
use InertiaUI\Notifications\NotificationPreferences;

it('pauses the notifications for an hour without toasts, and shows toasts again after resuming', function () {
    $page = visit('/')
        ->click('[data-inbox-bell]')
        ->click('[data-inbox-menu-button]')
        ->assertCount('[data-inbox-pause-option]', 4)
        ->click('[data-inbox-pause-option]:nth-of-type(2)')
        ->assertSeeIn('[data-inbox-paused]', 'Notifications paused until')
        ->assertAttribute('[data-inbox-bell]', 'data-paused', 'true')
        ->assertAttribute('[data-inbox-bell]', 'aria-label', 'Notifications, paused');

    $page->wait(0.5);
    expect(NotificationPreferences::pausedUntil(User::demo())->diffInMinutes(now()->addHour(), absolute: true))->toBeLessThan(1);

    $page->click('[data-inbox-bell]')
        ->click('Deployment with a toast')
        ->assertSeeIn('[data-inbox-badge]', '1')
        ->assertAttribute('[data-inbox-bell]', 'aria-label', 'Notifications, 1 new, paused')
        ->assertNotPresent('.iui-toast')
        ->click('[data-inbox-bell]')
        ->click('[data-inbox-resume]')
        ->assertMissing('[data-inbox-paused]')
        ->assertScript("document.querySelector('[data-inbox-bell]').hasAttribute('data-paused')", false);

    $page->wait(0.5);
    expect(NotificationPreferences::pausedUntil(User::demo()))->toBeNull();

    $page->click('[data-inbox-bell]')
        ->click('Deployment with a toast')
        ->assertSee('Deployment finished')
        ->assertPresent('.iui-toast')
        ->assertNoJavaScriptErrors();
});
