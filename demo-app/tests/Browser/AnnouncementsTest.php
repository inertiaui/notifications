<?php

// Runs against the stack selected by APP_STACK. Every request is signed in as the demo user.

use App\Models\User;
use Illuminate\Support\Facades\Event;
use InertiaUI\Notifications\Announcement;
use InertiaUI\Notifications\Events\AnnouncementPublished;
use InertiaUI\Notifications\Models\InboxAnnouncementState;

// The title of the announcement in the panel, with the text that only screen readers read.
const ANNOUNCED_TITLE = "document.querySelector('header [data-inbox-item][data-announcement] p').textContent.replace(/\\s+/g, ' ').trim()";

it('shows a published announcement in the bell with its marker, and remembers that the user read it', function () {
    $page = visit('/')
        ->assertMissing('[data-inbox-badge]')
        ->click('[data-demo-announcement="maintenance"]')
        ->assertSeeIn('header [data-inbox-badge]', '1')
        ->click('header [data-inbox-bell]')
        ->assertSeeIn('header [data-inbox-panel]', 'Scheduled maintenance on Sunday')
        ->assertPresent('header [data-inbox-item][data-announcement="true"][data-read="false"]')
        ->assertScript("document.querySelector('header [data-inbox-item][data-announcement] [data-inbox-toggle-read]').getAttribute('aria-label')", 'Mark as read: Scheduled maintenance on Sunday')
        // Screen readers hear that it is an announcement before its title.
        ->assertScript(ANNOUNCED_TITLE, 'Unread: Announcement: Scheduled maintenance on Sunday')
        ->click('header [data-inbox-item][data-announcement] [data-inbox-toggle-read]')
        ->assertPresent('header [data-inbox-item][data-announcement="true"][data-read="true"]');

    $page->wait(0.5);
    expect(InboxAnnouncementState::query()->sole()->read_at)->not->toBeNull()
        ->and(User::demo()->inbox()->count())->toBe(0);

    $page->navigate('/inbox')
        ->assertPresent('[data-inbox-list] [data-inbox-item][data-announcement="true"][data-read="true"]')
        ->assertNoJavaScriptErrors();
});

it('shows an announcement to a user who signed up after it was published', function () {
    Announcement::make('Welcome to the new inbox')->publish();

    expect(User::query()->count())->toBe(0);

    visit('/')
        ->assertSeeIn('header [data-inbox-badge]', '1')
        ->click('header [data-inbox-bell]')
        ->assertSeeIn('header [data-inbox-panel]', 'Welcome to the new inbox')
        ->assertNoJavaScriptErrors();
});

it('leaves out an announcement whose expiry has passed', function () {
    Announcement::make('Yesterday only')->expiresAt(now()->subMinute())->publish();
    Announcement::make('This week')->expiresAt(now()->addWeek())->publish();

    visit('/')
        ->assertSeeIn('header [data-inbox-badge]', '1')
        ->click('header [data-inbox-bell]')
        ->assertSeeIn('header [data-inbox-panel]', 'This week')
        ->assertDontSeeIn('header [data-inbox-panel]', 'Yesterday only')
        ->assertNoJavaScriptErrors();
});

it('shows a published announcement on an open page right away once announcements are broadcast, without a toast', function () {
    config(['inertia-notifications.inbox.broadcast_announcements' => true]);
    Event::fake([AnnouncementPublished::class]);

    $page = visit('/')->assertMissing('[data-inbox-badge]');
    $page->script(FAKE_ECHO);

    // The visit subscribes to the announcements channel with the Echo that is now configured.
    $page->click('Inbox')
        ->assertPathIs('/inbox')
        ->assertScript(listensFor('inertiaui.announcements', '.inertiaui.announcement.published'));

    Announcement::defineAudience('billing', fn (User $user): bool => false);
    $hidden = Announcement::make('For the billing team')->audience('billing')->publish();
    $shown = Announcement::make('Scheduled maintenance on Sunday')->publish();

    // Echo sends both broadcasts to every signed-in user, and the server only finds the second one for the demo user.
    Event::dispatched(AnnouncementPublished::class)->each(
        fn (array $event) => broadcastEvent($page, 'inertiaui.announcements', '.inertiaui.announcement.published', $event[0]->broadcastWith()),
    );

    $page->assertSeeIn('header [data-inbox-badge]', '1')
        ->assertSeeIn('[data-inbox-list] [data-inbox-item][data-announcement="true"]', 'Scheduled maintenance on Sunday')
        ->assertDontSee('For the billing team')
        ->assertMissing('[data-toast-id^="inertiaui-inbox-"]')
        ->assertNoJavaScriptErrors();

    expect(Event::dispatched(AnnouncementPublished::class)->map(fn (array $event) => $event[0]->id)->all())
        ->toBe([$hidden->id, $shown->id]);
});
