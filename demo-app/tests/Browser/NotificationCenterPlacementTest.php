<?php

// Runs against the stack selected by APP_STACK. Every request is signed in as the demo user.

use App\Models\User;
use App\Notifications\DemoNotification;

// Where the open panel inside the given element is, next to its bell, once its entrance transition ended.
function placement(string $within): string
{
    return <<<JS
        new Promise((resolve) => setTimeout(resolve, 300)).then(() => {
            const bell = document.querySelector('{$within} [data-inbox-bell]').getBoundingClientRect()
            const panel = document.querySelector('{$within} [data-inbox-panel]')
            const rect = panel.getBoundingClientRect()

            return {
                side: panel.dataset.side ?? null,
                below: rect.top >= bell.bottom,
                above: rect.bottom <= bell.top,
                rightOf: rect.left >= bell.right,
                endAligned: Math.abs(rect.right - bell.right) < 1,
                startAligned: Math.abs(rect.left - bell.left) < 1,
                topAligned: Math.abs(rect.top - bell.top) < 1,
                inViewport: rect.top >= 0 && rect.left >= 0 && rect.bottom <= innerHeight && rect.right <= innerWidth,
            }
        })
        JS;
}

it('opens the panel below the bell, aligned with its end edge, by default', function () {
    $page = visit('/')->resize(1280, 800)->click('header [data-inbox-bell]');

    expect($page->script(placement('header')))->toMatchArray([
        'side' => 'bottom',
        'below' => true,
        'endAligned' => true,
        'inViewport' => true,
    ]);
});

it('opens the panel on the side of the placement prop, and on the other side when there is no room', function () {
    $page = visit('/notification-center')->resize(1280, 800);

    $page->click('[data-demo="placement-right"] [data-inbox-bell]');
    expect($page->script(placement('[data-demo="placement-right"]')))->toMatchArray([
        'side' => 'right',
        'rightOf' => true,
        'topAligned' => true,
        'inViewport' => true,
    ]);

    $page->keys(':focus', 'Escape')->click('[data-demo="placement-flip"] [data-inbox-bell]');
    expect($page->script(placement('[data-demo="placement-flip"]')))->toMatchArray([
        'side' => 'top',
        'above' => true,
        'startAligned' => true,
        'inViewport' => true,
    ]);

    $page->assertNoJavaScriptErrors();
});

it('follows the bell when the page scrolls', function () {
    $page = visit('/notification-center')->resize(1280, 600)->click('[data-demo="placement-right"] [data-inbox-bell]');
    $page->script("document.body.style.minHeight = '200vh'; window.scrollBy(0, 60)");

    expect($page->script(placement('[data-demo="placement-right"]')))->toMatchArray(['rightOf' => true, 'topAligned' => true]);
});

it('opens the panel as a sheet at the bottom of a narrow screen, and next to the bell again on a wide one', function () {
    $sheet = <<<'JS'
        new Promise((resolve) => setTimeout(resolve, 300)).then(() => {
            const panel = document.querySelector('header [data-inbox-panel]')
            const rect = panel.getBoundingClientRect()

            return { bottom: Math.round(innerHeight - rect.bottom), width: Math.round(rect.width - innerWidth), side: panel.dataset.side ?? null }
        })
        JS;

    $page = visit('/')->resize(390, 800)->click('header [data-inbox-bell]');
    expect($page->script($sheet))->toBe(['bottom' => 0, 'width' => 0, 'side' => null]);

    $page->resize(1280, 800);
    expect($page->script(placement('header')))->toMatchArray(['side' => 'bottom', 'below' => true, 'endAligned' => true]);
});

it('keeps the height of the sheet on a touch screen, whose list does not scroll sideways', function () {
    $sheet = <<<'JS'
        new Promise((resolve) => setTimeout(resolve, 300)).then(() => {
            const panel = document.querySelector('header [data-inbox-panel]')
            const scroller = panel.querySelector('[data-inbox-scroller]')

            return {
                touch: matchMedia('(hover: none)').matches,
                height: Math.round(panel.getBoundingClientRect().height),
                sideways: scroller.scrollWidth - scroller.clientWidth,
            }
        })
        JS;

    DemoNotification::fill(User::demo(), 30);

    // Playwright's click on the bell does not return under touch emulation, so the page clicks the buttons itself.
    $page = visit('/')->on()->mobile()->assertSee('Inertia Notifications');
    $page->script("document.querySelector('header [data-inbox-bell]').click()");
    $page->assertSee('Sophie Martin commented on issue #30');

    $full = $page->script($sheet);
    expect($full)->toMatchArray(['touch' => true, 'sideways' => 0]);

    // The empty Archived tab does not shrink the sheet, which would move its tabs under the finger.
    $page->script("document.querySelector('header [data-inbox-tab=\"archived\"]').click()");
    $page->assertSee('You have no archived notifications.');
    expect($page->script($sheet))->toBe($full);
});
