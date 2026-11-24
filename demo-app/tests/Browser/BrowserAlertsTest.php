<?php

// Runs against the stack selected by APP_STACK. Every request is signed in as the demo user, and the demo turns on
// the browser alerts in initNotifications().

use App\Models\User;
use App\Notifications\DemoNotification;
use InertiaUI\Notifications\Inbox;
use Pest\Browser\Api\AwaitableWebpage;
use Pest\Browser\Support\ComputeUrl;

// Records the counts that the page puts on the app's icon, with 0 for a cleared badge, and still sets them.
const BADGE_RECORDER = <<<'JS'
    window.badges = []
    const setAppBadge = navigator.setAppBadge.bind(navigator)
    const clearAppBadge = navigator.clearAppBadge.bind(navigator)
    navigator.setAppBadge = (count) => (window.badges.push(count), setAppBadge(count))
    navigator.clearAppBadge = () => (window.badges.push(0), clearAppBadge())
    JS;

// A stand-in for the browser's desktop notifications, which records the ones that the page shows. Chromium's headless
// shell, which the browser tests run, refuses desktop notifications even with the permission granted.
const NOTIFICATION_RECORDER = <<<'JS'
    window.desktopNotifications = []
    window.Notification = class extends EventTarget {
        static permission = 'granted'
        static requestPermission = async () => 'granted'

        constructor(title, options) {
            super()
            Object.assign(this, { title, ...options })
            window.desktopNotifications.push(this)
        }

        close() {}
    }
    JS;

// Records the notes of the built-in chime that the page plays, with the audio context that plays them.
const CHIME_RECORDER = <<<'JS'
    window.chimes = []
    const start = OscillatorNode.prototype.start
    OscillatorNode.prototype.start = function (when) {
        window.chimes.push({ frequency: this.frequency.value, context: this.context })

        return start.call(this, when)
    }
    JS;

const CHIMES = 'window.chimes.map(({ frequency, context }) => [frequency, context.state])';

const DESKTOP_NOTIFICATIONS = 'window.desktopNotifications.map((notification) => notification.title)';

// Hides the tab or shows it again, as switching to another tab or application does.
const HIDE_TAB = <<<'JS'
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
    JS;

const SHOW_TAB = <<<'JS'
    delete document.visibilityState
    document.dispatchEvent(new Event('visibilitychange'))
    JS;

// The tab that holds the Web Lock of the election.
const ELECTED_TAB = 'navigator.locks.query().then(({ held }) => held[0]?.clientId)';

/**
 * Open the page in two tabs of one browser, with a stand-in Echo and desktop notifications, and wait until the second
 * tab, which opened last, holds the election and the first tab waits for it.
 *
 * @return array{0: AwaitableWebpage, 1: AwaitableWebpage}
 */
function openTwoTabs(string $path): array
{
    $first = visit($path);

    // The stand-ins run before the application on every page of the browser.
    $first->page()->context()->addInitScript(FAKE_ECHO.";\n".NOTIFICATION_RECORDER.";\n".CHIME_RECORDER);

    $first = $first->refresh()->assertScript(listensFor('App.Models.User.1', ARRIVED_EVENT));

    $firstTab = $first->script(ELECTED_TAB);
    $second = openTab($first, $path)->assertScript(listensFor('App.Models.User.1', ARRIVED_EVENT));

    $second->assertScript(elected(other: $firstTab));

    return [$first, $second];
}

/**
 * The script that tells whether a tab other than the given one holds the election, while one tab waits for it.
 */
function elected(string $other): string
{
    return "navigator.locks.query().then(({ held, pending }) => held[0]?.clientId !== '{$other}' && pending.length === 1)";
}

/**
 * Open the path in another tab of the page's browser, which shares its locks and its BroadcastChannel.
 */
function openTab(AwaitableWebpage $page, string $path): AwaitableWebpage
{
    $url = ComputeUrl::from($path);

    return new AwaitableWebpage($page->page()->context()->newPage()->goto($url), $url);
}

/**
 * Broadcast the newest notification of the demo user to the pages, as Echo delivers it to every tab.
 */
function broadcastNewest(AwaitableWebpage ...$pages): void
{
    $newest = Inbox::paginate(User::demo())->items()[0];

    foreach ($pages as $page) {
        broadcastNotification($page, 'App.Models.User.1', $newest);
    }
}

it('shows the unread count in the tab title when a notification arrives, and removes it once it is read', function () {
    $page = visit('/alerts')->assertTitle('Browser alerts - Inertia Notifications');
    $page->script(FAKE_ECHO);

    // The visit subscribes to the user's channel with the Echo that is now configured.
    $page->click('a[href="/alerts"]')->assertScript(listensFor('App.Models.User.1', ARRIVED_EVENT));

    User::demo()->notify(new DemoNotification('comment', 5));

    broadcastNewest($page);

    $page->assertTitle('(1) Browser alerts - Inertia Notifications')
        ->click('[data-inbox-bell]')
        ->click('[aria-label="Mark as read: Sophie Martin commented on issue #5"]')
        ->assertTitle('Browser alerts - Inertia Notifications')
        ->assertNoJavaScriptErrors();
});

it('keeps the count in the title when a visit changes the title', function () {
    DemoNotification::fill(User::demo(), 2);

    visit('/')
        ->assertTitle('(2) Inertia Notifications')
        ->click('a[href="/alerts"]')
        ->assertTitle('(2) Browser alerts - Inertia Notifications')
        ->assertSeeIn('[data-demo-title]', '(2) Browser alerts - Inertia Notifications')
        ->click('Send a notification')
        ->assertTitle('(3) Browser alerts - Inertia Notifications')
        ->assertNoJavaScriptErrors();
});

it('updates the count in the title of the other tabs when notifications are read', function () {
    DemoNotification::fill(User::demo(), 3);

    $first = visit('/alerts')->assertTitle('(3) Browser alerts - Inertia Notifications');
    $second = openTab($first, '/')->assertTitle('(3) Inertia Notifications');

    $first->click('[data-inbox-bell]')->click('Mark all as read');

    $second->assertTitle('Inertia Notifications');
    $first->assertTitle('Browser alerts - Inertia Notifications')
        ->assertNoJavaScriptErrors();
});

it('shows the unread count on the app badge from the first page, and clears it once the notifications are read', function () {
    DemoNotification::fill(User::demo(), 3);

    $page = visit('/alerts');

    // The recorder runs before the application on every page of the browser.
    $page->page()->context()->addInitScript(BADGE_RECORDER);

    $page->refresh()
        ->assertScript('window.badges', [3])
        ->click('Send a notification')
        ->assertScript('window.badges', [3, 4])
        ->click('[data-inbox-bell]')
        ->click('Mark all as read')
        ->assertScript('window.badges', [3, 4, 0])
        ->assertNoJavaScriptErrors();
});

it('shows a desktop notification only in the elected tab while the user looks at no tab, and opens it on click', function () {
    [$first, $second] = openTwoTabs('/alerts');

    $first->script(HIDE_TAB);
    $second->script(HIDE_TAB);

    User::demo()->notify(new DemoNotification('comment', 8));

    // Echo delivers the broadcast to every tab.
    broadcastNewest($first, $second);

    $first->assertScript(DESKTOP_NOTIFICATIONS, []);
    $second->assertScript(DESKTOP_NOTIFICATIONS, ['Sophie Martin commented on issue #8'])
        ->assertScript('window.desktopNotifications[0].body', 'Looks great! Can we ship this on Tuesday instead?')
        ->script("window.desktopNotifications[0].dispatchEvent(new Event('click'))");

    $second->assertPathIs('/inbox')
        ->assertTitle('Inertia Notifications')
        ->assertNoJavaScriptErrors();

    expect(User::demo()->inbox()->sole()->read_at)->not->toBeNull();
});

it('shows no desktop notification while the user looks at a tab, and the tab the user looks at takes over', function () {
    [$first, $second] = openTwoTabs('/alerts');

    User::demo()->notify(new DemoNotification('comment', 9));

    broadcastNewest($first, $second);

    $second->assertTitle('(1) Browser alerts - Inertia Notifications')->assertScript(DESKTOP_NOTIFICATIONS, []);
    $first->assertScript(DESKTOP_NOTIFICATIONS, []);

    // The user switches to the first tab, then to another application.
    $secondTab = $second->script(ELECTED_TAB);
    $second->script(HIDE_TAB);
    $first->script(SHOW_TAB);
    $first->assertScript(elected(other: $secondTab));
    $first->script(HIDE_TAB);

    // A second later, so the newest notification is the invoice.
    $this->travel(1)->seconds();

    User::demo()->notify(new DemoNotification('invoice', 10));

    broadcastNewest($first, $second);

    $first->assertScript(DESKTOP_NOTIFICATIONS, ['Invoice INV-2010 paid'])->assertNoJavaScriptErrors();
    $second->assertScript(DESKTOP_NOTIFICATIONS, [])->assertNoJavaScriptErrors();
});

it('plays the sound only in the elected tab, which the tab the user looks at takes over', function () {
    [$first, $second] = openTwoTabs('/alerts');

    // Browsers only play sound in a tab that the user interacted with.
    $first->click('main > h1');
    $second->click('main > h1');

    User::demo()->notify(new DemoNotification('comment', 11));

    broadcastNewest($first, $second);

    $second->assertScript(CHIMES, [[880, 'running'], [1320, 'running']]);
    $first->assertScript(CHIMES, []);

    $secondTab = $second->script(ELECTED_TAB);
    $second->script(HIDE_TAB);
    $first->script(SHOW_TAB);
    $first->assertScript(elected(other: $secondTab));

    // A second later, so the newest notification is the invoice.
    $this->travel(1)->seconds();

    User::demo()->notify(new DemoNotification('invoice', 12));

    broadcastNewest($first, $second);

    $first->assertScript(CHIMES, [[880, 'running'], [1320, 'running']])->assertNoJavaScriptErrors();
    $second->assertScript('window.chimes.length', 2)->assertNoJavaScriptErrors();
});
