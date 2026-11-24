<?php

// Runs against the stack selected by APP_STACK. Every request is signed in as the demo user.

use App\Models\User;
use App\Notifications\DemoNotification;
use InertiaUI\Notifications\Models\NotificationPreference;
use InertiaUI\Notifications\NotificationPreferences;

it('lists the categories with a switch for each channel they offer', function () {
    visit('/preferences')
        ->assertSee('Replies to the issues you follow.')
        ->assertAttribute('[data-inbox-preference="comments.inbox"]', 'aria-checked', 'true')
        ->assertAttribute('[data-inbox-preference="comments.mail"]', 'aria-label', 'Comments: Email')
        ->assertPresent('[data-inbox-preference="deployments.inbox"]')
        ->assertNotPresent('[data-inbox-preference="deployments.mail"]')
        ->assertNotPresent('[data-inbox-preference="reports.inbox"]')
        ->assertSeeIn('[data-inbox-preference-category="security"]', 'Always on')
        ->assertAttribute('[data-inbox-preference="security.mail"]', 'aria-disabled', 'true')
        ->assertNoJavaScriptErrors();
});

it('shows the categories of each group under its heading', function () {
    visit('/preferences')
        ->assertSeeIn('[data-inbox-preference-group="activity"] th[scope="rowgroup"]', 'Activity')
        ->assertSeeIn('[data-inbox-preference-group="activity"]', 'What happens in your projects.')
        ->assertPresent('[data-inbox-preference-group="activity"] [data-inbox-preference-category="comments"]')
        ->assertPresent('[data-inbox-preference-group="activity"] [data-inbox-preference-category="deployments"]')
        ->assertPresent('[data-inbox-preference-group="account"] [data-inbox-preference-category="billing"]')
        ->assertPresent('[data-inbox-preference-group="account"] [data-inbox-preference-category="security"]')
        ->assertPresent('[data-inbox-preference-group="updates"] [data-inbox-preference-category="product"]')
        ->assertNoJavaScriptErrors();
});

it('shows an opt-in category as off until the user turns it on', function () {
    visit('/preferences')
        ->assertAttribute('[data-inbox-preference="product.mail"]', 'aria-checked', 'false')
        ->click('[data-inbox-preference="product.mail"]')
        ->assertAttribute('[data-inbox-preference="product.mail"]', 'aria-checked', 'true')
        ->wait(0.5)
        ->refresh()
        ->assertAttribute('[data-inbox-preference="product.mail"]', 'aria-checked', 'true');

    expect(NotificationPreferences::enabled(User::demo(), 'product', 'mail'))->toBeTrue();
});

it('saves a switch, keeps it after a reload, and stops the notifications the user turned off', function () {
    $page = visit('/preferences')
        ->click('[data-inbox-preference="comments.inbox"]')
        ->assertAttribute('[data-inbox-preference="comments.inbox"]', 'aria-checked', 'false');

    // A locked category stays on. Playwright does not click elements with aria-disabled, but people can.
    $page->script("document.querySelector('[data-inbox-preference=\"security.inbox\"]').click()");
    $page->assertAttribute('[data-inbox-preference="security.inbox"]', 'aria-checked', 'true')
        ->wait(0.5);

    $page->refresh()
        ->assertAttribute('[data-inbox-preference="comments.inbox"]', 'aria-checked', 'false')
        ->assertAttribute('[data-inbox-preference="comments.mail"]', 'aria-checked', 'true')
        ->assertNoJavaScriptErrors();

    expect(NotificationPreference::query()->get(['category', 'channel', 'enabled'])->toArray())->toBe([
        ['category' => 'comments', 'channel' => 'inbox', 'enabled' => false],
    ]);

    User::demo()->notify(new DemoNotification('comment', 7));
    User::demo()->notify(new DemoNotification('invoice', 7));

    expect(User::demo()->inbox()->pluck('category')->all())->toBe(['billing']);
});

it('turns a switch on again with the keyboard', function () {
    NotificationPreference::query()->create([
        'notifiable_type' => User::demo()->getMorphClass(),
        'notifiable_id' => User::demo()->getKey(),
        'category' => 'billing',
        'channel' => 'mail',
        'enabled' => false,
    ]);

    $page = visit('/preferences')->assertAttribute('[data-inbox-preference="billing.mail"]', 'aria-checked', 'false');

    $page->keys('[data-inbox-preference="billing.mail"]', 'Space')
        ->assertAttribute('[data-inbox-preference="billing.mail"]', 'aria-checked', 'true');

    $page->wait(0.5);

    expect(NotificationPreference::query()->sole()->enabled)->toBeTrue();
});

it('turns a channel off for every category except the locked ones, and keeps the choice of each category', function () {
    $page = visit('/preferences')
        ->assertAttribute('[data-inbox-preference-channel="mail"]', 'aria-label', 'All notifications: Email')
        ->assertAttribute('[data-inbox-preference-channel="mail"]', 'aria-checked', 'true')
        ->click('[data-inbox-preference-channel="mail"]')
        ->assertAttribute('[data-inbox-preference-channel="mail"]', 'aria-checked', 'false')
        ->assertAttribute('[data-inbox-preference="comments.mail"]', 'aria-checked', 'false')
        ->assertAttribute('[data-inbox-preference="comments.mail"]', 'aria-disabled', 'true')
        ->assertAttribute('[data-inbox-preference="security.mail"]', 'aria-checked', 'true')
        ->assertAttribute('[data-inbox-preference="comments.inbox"]', 'aria-checked', 'true')
        ->wait(0.5)
        ->refresh()
        ->assertAttribute('[data-inbox-preference-channel="mail"]', 'aria-checked', 'false')
        ->assertAttribute('[data-inbox-preference="comments.mail"]', 'aria-disabled', 'true');

    expect(NotificationPreferences::enabled(User::demo(), 'comments', 'mail'))
        ->toBeFalse()
        ->and(NotificationPreferences::enabled(User::demo(), 'security', 'mail'))
        ->toBeTrue();

    $page->click('[data-inbox-preference-channel="mail"]')
        ->assertAttribute('[data-inbox-preference="comments.mail"]', 'aria-checked', 'true')
        ->assertAttributeMissing('[data-inbox-preference="comments.mail"]', 'aria-disabled')
        ->assertNoJavaScriptErrors();
});

it('stops the notifications of every category on a channel that the user turned off', function () {
    visit('/preferences')
        ->click('[data-inbox-preference-channel="inbox"]')
        ->assertAttribute('[data-inbox-preference-channel="inbox"]', 'aria-checked', 'false')
        ->wait(0.5);

    User::demo()->notify(new DemoNotification('comment', 7));
    User::demo()->notify(new DemoNotification('deploy', 7));

    expect(User::demo()->inbox()->count())->toBe(0);
});

it('turns the push switch of a category off and disables it while the user does not receive the category in the app', function () {
    $page = visit('/preferences')
        ->assertAttribute('[data-inbox-preference="comments.push"]', 'aria-checked', 'true')
        ->assertAttributeMissing('[data-inbox-preference="comments.push"]', 'aria-disabled')
        ->click('[data-inbox-preference="comments.inbox"]')
        ->assertAttribute('[data-inbox-preference="comments.inbox"]', 'aria-checked', 'false')
        ->assertAttribute('[data-inbox-preference="comments.push"]', 'aria-checked', 'false')
        ->assertAttribute('[data-inbox-preference="comments.push"]', 'aria-disabled', 'true')
        ->assertAttribute('[data-inbox-preference="comments.mail"]', 'aria-checked', 'true')
        ->assertAttributeMissing('[data-inbox-preference="comments.mail"]', 'aria-disabled')
        ->assertAttribute('[data-inbox-preference="billing.push"]', 'aria-checked', 'true')
        ->wait(0.5);

    // The disabled switch changes nothing. Playwright does not click elements with aria-disabled, but people can.
    $page->script("document.querySelector('[data-inbox-preference=\"comments.push\"]').click()");
    $page->assertAttribute('[data-inbox-preference="comments.push"]', 'aria-checked', 'false')
        ->wait(0.5);

    $page->refresh()
        ->assertAttribute('[data-inbox-preference="comments.push"]', 'aria-checked', 'false')
        ->assertAttribute('[data-inbox-preference="comments.push"]', 'aria-disabled', 'true')
        ->click('[data-inbox-preference="comments.inbox"]')
        ->assertAttribute('[data-inbox-preference="comments.inbox"]', 'aria-checked', 'true')
        ->assertAttribute('[data-inbox-preference="comments.push"]', 'aria-checked', 'true')
        ->assertAttributeMissing('[data-inbox-preference="comments.push"]', 'aria-disabled')
        ->wait(0.5)
        ->assertNoJavaScriptErrors();

    // The category's push choice stays as the user left it, so the push switch is on again.
    expect(NotificationPreference::query()->get(['category', 'channel', 'enabled'])->toArray())->toBe([
        ['category' => 'comments', 'channel' => 'inbox', 'enabled' => true],
    ]);
});

it('builds a preferences form with usePreferences() that shares its state with the component', function () {
    $page = visit('/preferences/custom')
        ->assertChecked('[data-demo-preference="comments.mail"]')
        ->assertNotChecked('[data-demo-preference="product.mail"]')
        ->assertDisabled('[data-demo-preference="security.mail"]')
        ->click('[data-demo-preference="comments.mail"]')
        ->assertNotChecked('[data-demo-preference="comments.mail"]')
        ->assertAttribute('[data-inbox-preference="comments.mail"]', 'aria-checked', 'false')
        ->click('[data-demo-channel="inbox"]')
        ->assertNotChecked('[data-demo-channel="inbox"]')
        ->assertDisabled('[data-demo-preference="comments.inbox"]')
        ->assertAttribute('[data-inbox-preference-channel="inbox"]', 'aria-checked', 'false')
        ->click('[data-inbox-preference="billing.mail"]')
        ->assertNotChecked('[data-demo-preference="billing.mail"]')
        ->wait(0.5);

    expect(NotificationPreferences::enabled(User::demo(), 'comments', 'mail'))
        ->toBeFalse()
        ->and(NotificationPreferences::enabled(User::demo(), 'billing', 'mail'))
        ->toBeFalse()
        ->and(NotificationPreferences::channelEnabled(User::demo(), 'inbox'))
        ->toBeFalse();

    $page->assertNoJavaScriptErrors();
});

it('adds classes to the parts of the component and replaces its markup with slots', function () {
    visit('/preferences/custom')
        ->assertPresent('table.demo-preferences-table')
        ->assertPresent('[data-inbox-preference="billing.mail"].demo-switch')
        ->assertPresent('[data-inbox-preference-channel="mail"].demo-switch')
        ->assertSeeIn('th [data-demo-channel-head="mail"]', 'EMAIL')
        ->assertSeeIn('[data-inbox-preference-group="account"] [data-demo-group="account"]', 'ACCOUNT')
        ->assertSeeIn('[data-inbox-preference-category="security"] [data-demo-category="security"]', 'Security')
        ->assertSeeIn('[data-inbox-preference-category="security"]', 'Required')
        ->assertDontSeeIn('[data-inbox-preference-category="security"]', 'Sign-ins from new devices.')
        ->assertNoJavaScriptErrors();
});
