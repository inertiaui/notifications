<?php

// Runs against the stack selected by APP_STACK. The demo sets Dutch translations with setTranslations() for ?locale=nl.

use App\Models\User;
use App\Notifications\DemoNotification;

it('shows the global translations in the toasts and the notification center, with functions for plurals', function () {
    User::demo()->notify(new DemoNotification('comment', 7));

    visit('/?locale=nl')
        ->assertAttribute('[data-inbox-bell]', 'aria-label', 'Meldingen, 1 nieuwe melding')
        ->assertAttribute('.iui-toaster', 'aria-label', 'Meldingen (F8)')
        ->click('Error')
        ->assertSee('Payment failed')
        ->assertPresent('[aria-label="Sluiten: Payment failed"]')
        ->assertSeeIn('[data-toast-id] .sr-only', 'Fout:')
        ->click('Three replies on one issue')
        ->assertAttribute('[data-inbox-bell]', 'aria-label', 'Meldingen, 4 nieuwe meldingen')
        ->click('[data-inbox-bell]')
        ->assertSeeIn('[data-inbox-panel] h2', 'Meldingen')
        ->assertSeeIn('[data-inbox-read-all]', 'Alles gelezen')
        ->assertSeeIn('[data-inbox-tab="unread"]', 'Ongelezen')
        ->assertSeeIn('[data-inbox-group-toggle]', 'Nog 2 meldingen tonen')
        ->assertAttribute('[data-inbox-panel] [data-inbox-menu-button]', 'aria-label', 'Meer acties')
        ->assertPresent('[aria-label="Archiveren: Sophie Martin commented on issue #7"]')
        // Labels the app did not translate keep their English text.
        ->assertPresent('[aria-label="Snooze: Sophie Martin commented on issue #7"]')
        ->assertNoJavaScriptErrors();
});

it('keeps the translations on the pages it visits, also in the NotificationList', function () {
    visit('/?locale=nl')
        ->click('[data-inbox-bell]')
        ->assertSeeIn('[data-inbox-panel] [data-inbox-empty]', 'Je hebt geen meldingen.')
        ->assertSeeIn('[data-inbox-view-all]', 'Alle meldingen bekijken')
        ->click('[data-inbox-view-all]')
        ->assertPathIs('/inbox')
        ->assertSeeIn('[data-inbox-list]', 'Je hebt geen meldingen.')
        ->assertNoJavaScriptErrors();
});
