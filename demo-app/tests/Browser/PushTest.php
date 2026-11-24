<?php

// Runs against the stack selected by APP_STACK. Every request is signed in as the demo user.

use App\Models\User;
use InertiaUI\Notifications\NotificationPreferences;
use InertiaUI\Notifications\WebPush\KeyPair;

// Headless Chromium refuses notifications and cannot reach a push service, so this stand-in grants the permission once
// the page asks for it, or keeps the one that a test stores in localStorage, and subscribes without a push service. The
// subscription survives reloads in localStorage, like a real one, and keeps the key that it was made with, which the
// page compares with the VAPID public key. The stand-in counts the subscriptions that the page makes.
const PUSH_SERVICE = <<<'JS'
    (() => {
        const stored = () => JSON.parse(localStorage.getItem('fake-push') ?? 'null')
        const bytes = (value) => Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), (character) => character.charCodeAt(0))
        const base64Url = (buffer) => btoa(String.fromCharCode(...new Uint8Array(buffer))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
        const subscription = (data) => ({
            endpoint: data.endpoint,
            expirationTime: null,
            options: { applicationServerKey: bytes(data.key).buffer, userVisibleOnly: true },
            toJSON: () => ({
                endpoint: data.endpoint,
                expirationTime: null,
                keys: { p256dh: 'BA9waDRBE19qifleQk7MFjUbcH3aKQOfqIRF3uZtcCbL3IYzdnPgq7IwEOAueaHzfP_mJm5PetJkigCH1J52Bvg', auth: 'USEjIxYWm-sVKWJXqsZiZg' },
            }),
            unsubscribe: async () => {
                localStorage.removeItem('fake-push')

                return true
            },
        })

        let permission = localStorage.getItem('fake-permission') ?? 'default'
        Object.defineProperty(Notification, 'permission', { get: () => permission })
        Notification.requestPermission = async () => {
            permission = 'granted'
            localStorage.setItem('fake-permission', permission)

            return permission
        }

        PushManager.prototype.getSubscription = async () => (stored() ? subscription(stored()) : null)
        PushManager.prototype.subscribe = async ({ applicationServerKey }) => {
            const data = { endpoint: `https://fcm.googleapis.com/fcm/send/demo-${Date.now()}`, key: base64Url(applicationServerKey) }
            localStorage.setItem('fake-push', JSON.stringify(data))
            localStorage.setItem('fake-subscriptions', String(Number(localStorage.getItem('fake-subscriptions') ?? 0) + 1))

            return subscription(data)
        }
    })()
    JS;

it('adds a push column to the preferences, whose switches apply to every device', function () {
    visit('/preferences')
        ->assertAttribute('[data-inbox-preference="comments.push"]', 'aria-label', 'Comments: Push')
        ->assertAttribute('[data-inbox-preference="comments.push"]', 'aria-checked', 'true')
        ->assertNotPresent('[data-inbox-preference="deployments.push"]')
        ->click('[data-inbox-preference="comments.push"]')
        ->assertAttribute('[data-inbox-preference="comments.push"]', 'aria-checked', 'false')
        ->wait(0.5)
        ->assertNoJavaScriptErrors();

    expect(NotificationPreferences::enabled(User::demo(), 'comments', 'push'))->toBeFalse();
});

it('explains that the browser blocks notifications', function () {
    $page = visit('/preferences');
    $page->page()->context()->addInitScript(PUSH_SERVICE);
    $page->script("localStorage.setItem('fake-permission', 'denied')");

    $page->refresh()
        ->assertAttribute('[data-inbox-push-device]', 'data-state', 'blocked')
        ->assertSeeIn('[data-inbox-push-device]', "Allow them in your browser's site settings")
        ->assertNotPresent('[data-inbox-push-device-button]')
        ->assertNoJavaScriptErrors();
});

it('turns push on for this device, keeps it on after a reload, and turns it off again', function () {
    $page = visit('/preferences');
    $page->page()->context()->addInitScript(PUSH_SERVICE);

    $page->refresh()
        ->assertAttribute('[data-inbox-push-device]', 'data-state', 'off')
        ->assertSeeIn('[data-inbox-push-device-button]', 'Turn on for this device')
        ->click('[data-inbox-push-device-button]')
        ->assertAttribute('[data-inbox-push-device]', 'data-state', 'on')
        ->assertSeeIn('[data-inbox-push-device-button]', 'Turn off');

    $subscription = User::demo()->pushDevices()->sole();

    expect($subscription->endpoint)->toStartWith('https://fcm.googleapis.com/fcm/send/demo-')
        ->and($page->script("navigator.serviceWorker.getRegistration('/_inertia-notifications/push/').then((registration) => registration?.active?.scriptURL ?? null)"))
        ->toContain('/_inertia-notifications/push/worker.js?v=');

    // The device cookie tells the server that this browser is the subscribed device.
    $page->refresh()
        ->assertAttribute('[data-inbox-push-device]', 'data-state', 'on')
        ->click('[data-inbox-push-device-button]')
        ->assertAttribute('[data-inbox-push-device]', 'data-state', 'off')
        ->assertScript("localStorage.getItem('fake-push')", null)
        ->assertScript("localStorage.getItem('fake-subscriptions')", '1')
        ->assertNoJavaScriptErrors();

    expect(User::demo()->pushDevices()->count())->toBe(0);
});

it('subscribes this device again with the new VAPID public key once the keys change', function () {
    $page = visit('/preferences');
    $page->page()->context()->addInitScript(PUSH_SERVICE);

    $page->refresh()
        ->click('[data-inbox-push-device-button]')
        ->assertAttribute('[data-inbox-push-device]', 'data-state', 'on');

    $keys = KeyPair::generate();

    config()->set([
        'inertia-notifications.push.public_key' => $keys->publicKeyAsBase64Url(),
        'inertia-notifications.push.private_key' => $keys->privateKeyAsBase64Url(),
    ]);

    // The stand-in's subscription was made with the previous key, so the page replaces it.
    $page->refresh()
        ->assertScript("localStorage.getItem('fake-subscriptions')", '2')
        ->assertAttribute('[data-inbox-push-device]', 'data-state', 'on')
        ->wait(0.5);

    expect(User::demo()->pushDevices()->sole()->vapid_public_key)->toBe($keys->publicKeyAsBase64Url());

    $page->assertNoJavaScriptErrors();
});
