<?php

// Runs against the stack selected by APP_STACK. Every request is signed in as the demo user.

use App\Models\User;
use App\Notifications\DemoNotification;

it('marks only the notifications that the user saw as seen, in a batch', function () {
    foreach (range(1, 20) as $number) {
        User::demo()->notify(new DemoNotification('report', $number));
    }

    $page = visit('/')
        ->assertSeeIn('[data-inbox-badge]', '20')
        ->click('header [data-inbox-bell]')
        ->assertSeeIn('header [data-inbox-panel]', 'Weekly report #20 is ready')
        ->wait(1.6);

    $seen = 20 - User::demo()->inbox()->unseen()->count();

    expect($seen)->toBeGreaterThan(0)->toBeLessThan(20);

    $page->assertSeeIn('[data-inbox-badge]', (string) (20 - $seen));

    // Scrolling down shows the others.
    $page->script("document.querySelector('header [data-inbox-scroller]').scrollTop = 100000");
    $page->wait(1.6);

    expect(User::demo()->inbox()->unseen()->count())->toBeLessThan(20 - $seen);
    $page->assertNoJavaScriptErrors();
});

it('marks nothing as seen when the panel closes within a second', function () {
    User::demo()->notify(new DemoNotification('invoice', 6));

    $page = visit('/')
        ->click('header [data-inbox-bell]')
        ->assertSeeIn('header [data-inbox-panel]', 'Invoice INV-2006 paid')
        ->keys(':focus', 'Escape');

    $page->wait(1.6);

    expect(User::demo()->inbox()->unseen()->count())->toBe(1);
    $page->assertSeeIn('[data-inbox-badge]', '1');
});
