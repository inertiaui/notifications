<?php

// Runs against the stack selected by APP_STACK. Every request is signed in as the demo user.

use App\Models\User;
use InertiaUI\Notifications\Digest;
use InertiaUI\Notifications\NotificationPreferences;

it('chooses a digest for a category and saves it with the timezone of the browser', function () {
    $page = visit('/preferences')
        ->assertSeeIn('[data-inbox-preferences] thead', 'Frequency')
        ->assertSelected('[data-inbox-preference-frequency="comments"]', 'instant')
        ->assertAttribute('[data-inbox-preference-frequency="comments"]', 'aria-label', 'Comments: frequency')
        ->assertNotPresent('[data-inbox-preference-frequency="deployments"]')
        ->assertNotPresent('[data-inbox-preference-frequency="security"]')
        ->select('[data-inbox-preference-frequency="comments"]', 'daily')
        ->assertSelected('[data-inbox-preference-frequency="comments"]', 'daily')
        ->wait(0.5)
        ->refresh()
        ->assertSelected('[data-inbox-preference-frequency="comments"]', 'daily');

    expect(NotificationPreferences::frequency(User::demo(), 'comments'))
        ->toBe('daily')
        ->and(NotificationPreferences::timezone(User::demo()))
        ->toBe($page->script('Intl.DateTimeFormat().resolvedOptions().timeZone'));

    $page->assertNoJavaScriptErrors();
});

it('disables the frequency of a category that the user receives on no channel that digests hold', function () {
    visit('/preferences')
        ->assertEnabled('[data-inbox-preference-frequency="billing"]')
        ->click('[data-inbox-preference="billing.mail"]')
        ->assertDisabled('[data-inbox-preference-frequency="billing"]')
        ->click('[data-inbox-preference-channel="mail"]')
        ->assertDisabled('[data-inbox-preference-frequency="reports"]')
        ->assertNoJavaScriptErrors();
});

it('holds the emails of a category in a digest, and sends them in one email', function () {
    NotificationPreferences::update(User::demo(), frequencies: ['comments' => 'daily', 'reports' => 'weekly']);

    $page = visit('/digests')
        ->assertSee('No emails are waiting.')
        ->click('[data-demo-digest-scenario="comment"]')
        ->assertSeeIn('[data-demo-held]', 'Sophie Martin commented on issue')
        ->click('[data-demo-digest-scenario="report"]')
        ->assertCount('[data-demo-held-item]', 2)
        ->click('[data-demo-digest-scenario="invoice"]')
        ->assertCount('[data-demo-held-item]', 2);

    // The notifications arrive in the bell right away.
    expect(User::demo()->inbox()->count())->toBe(3);

    $page->click('[data-demo-send-digest]')
        ->assertSee('No emails are waiting.')
        ->assertAttributeContains('[data-demo-digest]', 'srcdoc', 'Weekly reports')
        ->assertAttributeContains('[data-demo-digest]', 'srcdoc', 'Sophie Martin commented on issue')
        ->assertNoJavaScriptErrors();

    expect(Digest::query(User::demo())->count())->toBe(0);
});
