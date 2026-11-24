<?php

// Runs against the stack selected by APP_STACK, using its built demo assets.

/**
 * Records what each announcer region says, so an announcement that is cleared a second later can be asserted.
 */
const RECORD_ANNOUNCEMENTS = <<<'JS'
    () => {
        window.announced = { polite: [], assertive: [] }
        for (const [politeness, selector] of [['polite', '[role="status"]'], ['assertive', '[aria-live="assertive"]']]) {
            const region = document.querySelector(`.iui-toaster ${selector}`)
            new MutationObserver(() => region.textContent && window.announced[politeness].push(region.textContent))
                .observe(region, { childList: true, characterData: true, subtree: true })
        }
    }
    JS;

it('shows every toast flashed by a server action, newest closest to the screen edge', function () {
    visit('/')
        ->click('Two toasts')
        ->assertSee('Invoice sent')
        ->assertSee('A copy was sent to your email')
        // Newest first for keyboard users; the bottom-right stack shows it at the bottom.
        ->assertScript("[...document.querySelectorAll('.iui-toast')].map((toast) => toast.dataset.type)", ['info', 'success'])
        ->assertScript(
            "[...document.querySelectorAll('.iui-toast')].sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top).map((toast) => toast.dataset.type)",
            ['success', 'info'],
        )
        ->assertNoJavaScriptErrors();
});

it('shows a toast flashed before a full page load exactly once', function () {
    visit('/welcome')
        ->assertPathIs('/')
        ->assertSee('Welcome back')
        ->assertScript("document.querySelectorAll('.iui-toast').length", 1)
        ->assertNoJavaScriptErrors();
});

it('dismisses a persistent toast', function () {
    visit('/')
        ->click('Persistent')
        ->assertSee('Export queued')
        ->click('[aria-label="Dismiss: Export queued"]')
        ->assertDontSee('Export queued');
});

it('shows toasts created in the browser', function () {
    visit('/')
        ->click('Copy link')
        ->assertSee('Link copied')
        ->assertSee('Share it with your team.');
});

it('keeps a toast flashed on a page without a Toaster until a page with one renders', function () {
    visit('/bare')
        ->click('Flash a toast')
        ->wait(0.5)
        ->assertDontSee('Profile saved')
        ->click('Back to the demo')
        ->assertSee('Profile saved')
        ->assertNoJavaScriptErrors();
});

it('shows a toast flashed while loading a deferred prop', function () {
    visit('/deferred')
        ->assertSee('Report ready')
        ->assertScript("document.querySelectorAll('.iui-toast').length", 1)
        ->assertNoJavaScriptErrors();
});

it('announces toasts as plain text, errors assertively', function () {
    $page = visit('/');
    $page->script(RECORD_ANNOUNCEMENTS);

    $page->click('Two toasts')
        ->assertSee('A copy was sent to your email')
        ->click('Error')
        ->assertSee('Payment failed')
        ->wait(0.3)
        ->assertScript('window.announced.polite', ['Success: Invoice sent. Info: A copy was sent to your email.'])
        ->assertScript('window.announced.assertive', ['Error: Payment failed. Your card was declined.'])
        ->assertAttribute('.iui-toaster', 'aria-label', 'Notifications (F8)')
        ->assertAttributeMissing('.iui-toaster', 'aria-live');
});

it('moves focus with the shortcut and Escape, then returns it', function () {
    visit('/')
        ->click('Two toasts')
        ->assertSee('A copy was sent to your email')
        ->keys('Two toasts', 'F8')
        ->assertScript("document.activeElement.matches('.iui-toast') && document.activeElement.textContent.includes('A copy was sent')")
        ->keys(':focus', 'Escape')
        ->assertDontSee('A copy was sent to your email')
        ->assertScript("document.activeElement.matches('.iui-toast') && document.activeElement.textContent.includes('Invoice sent')")
        ->keys(':focus', 'Escape')
        ->assertDontSee('Invoice sent')
        ->assertScript("document.activeElement.textContent.trim() === 'Two toasts'");
});

it('does not return focus to where the shortcut moved it from once focus left the toasts', function () {
    visit('/')
        ->click('Persistent')
        ->assertSee('Export queued')
        ->keys('Persistent', 'F8')
        ->assertScript("document.activeElement.matches('.iui-toast')", true)
        // A click on the page moves focus out of the toasts, so a later click on a toast's button leaves it there.
        ->click('main > h1')
        ->assertScript('document.activeElement === document.body', true)
        ->click('[aria-label="Dismiss: Export queued"]')
        ->wait(0.5)
        ->assertDontSee('Export queued')
        ->assertScript('document.activeElement === document.body', true);
});

/** Drags the toast with the given title horizontally by the given distance, as a pointer would. */
function swipeScript(string $title, int $distance): string
{
    return <<<JS
        () => {
            const toast = [...document.querySelectorAll('.iui-toast')].find((item) => item.textContent.includes('{$title}'))
            const body = toast.querySelector('[data-toast-body]')
            const { left, top } = body.getBoundingClientRect()
            const event = (type, x) => new PointerEvent(type, { bubbles: true, pointerId: 7, button: 0, buttons: 1, isPrimary: true, clientX: x, clientY: top + 8 })
            body.dispatchEvent(event('pointerdown', left + 120))
            body.dispatchEvent(event('pointermove', left + 120 + {$distance} / 2))
            body.dispatchEvent(event('pointermove', left + 120 + {$distance}))
            body.dispatchEvent(event('pointerup', left + 120 + {$distance}))
        }
        JS;
}

it('runs a server action as an Inertia visit and closes the toast', function () {
    visit('/')
        ->click('With an action')
        ->assertSee('Invoice sent')
        ->click('View invoice')
        ->assertSee('Welcome back')
        ->assertDontSee('Invoice sent')
        ->assertNoJavaScriptErrors();
});

it('keeps an undo toast open while its request runs, then shows the result', function () {
    visit('/')
        ->click('Undo on the server')
        ->assertSee('Message archived')
        ->click('Undo')
        ->assertScript("document.querySelector('[data-toast-action]')?.getAttribute('aria-busy')", 'true')
        ->assertSee('Message restored')
        ->assertDontSee('Message archived')
        ->assertNoJavaScriptErrors();
});

it('replaces a toast flashed with the same ID by a later request', function () {
    visit('/')
        ->click('Start import')
        ->assertSee('Importing contacts…')
        ->click('Finish import')
        ->assertSee('Contacts imported')
        ->assertDontSee('Importing contacts…')
        ->assertScript("document.querySelectorAll('[data-toast-id=\"import\"]').length", 1)
        ->assertNoJavaScriptErrors();
});

it('shows a toast flashed by a useHttp request once, from the response header', function () {
    visit('/')
        ->click('JSON endpoint')
        ->assertSee('Archived from a JSON endpoint')
        ->click('Deferred prop')
        ->assertSee('Report ready')
        ->assertScript("[...document.querySelectorAll('.iui-toast')].filter((toast) => toast.textContent.includes('Archived from a JSON endpoint')).length", 1)
        ->assertNoJavaScriptErrors();
});

it('shows error toasts for failed requests instead of the error dialog', function () {
    visit('/')
        ->click('500 from useHttp')
        ->assertSee('Something went wrong.')
        ->click('419 from a visit')
        ->assertSee('This page has expired.')
        ->wait(0.3)
        ->assertScript("document.querySelectorAll('iframe').length", 0);
});

it('replaces a loading toast when a promise or visit settles', function () {
    visit('/')
        ->click('Promise')
        ->assertSee('Building report…')
        ->assertSee('Q3 report is ready')
        ->assertDontSee('Building report…')
        ->click('Track a failing visit')
        ->assertSee('The name field is required.')
        ->assertDontSee('Saving…')
        ->assertNoJavaScriptErrors();
});

it('counts a toast shown again instead of stacking a copy', function () {
    visit('/')
        ->click('Copy link')
        ->assertSee('Link copied')
        ->click('Copy link')
        ->assertSee('×2')
        ->assertScript("document.querySelectorAll('.iui-toast').length", 1);
});

it('stacks toasts and expands the stack while it is hovered', function () {
    visit('/')
        ->click('Stack of five')
        ->assertSee('Profile saved')
        ->assertAttribute('.iui-toast-list', 'data-expanded', 'false')
        ->assertScript("[...document.querySelectorAll('.iui-toast')].map((toast) => toast.dataset.overflow)", ['false', 'false', 'false', 'true', 'true'])
        ->hover('.iui-toast[data-front="true"]')
        ->assertAttribute('.iui-toast-list', 'data-expanded', 'true');
});

it('keeps a stack that a tap expanded open while its toasts are closed', function () {
    $page = visit('/')->click('Stack of five')->assertSee('Profile saved');

    // Safari on iOS does not focus a tapped button, so a tap on a toast's dismiss button focuses the toast.
    $tap = <<<'JS'
        (selector) => {
            const target = document.querySelector(selector)
            const event = (type) => new PointerEvent(type, { bubbles: true, pointerId: 5, pointerType: 'touch', button: 0, buttons: 1, isPrimary: true })
            target.dispatchEvent(event('pointerdown'))
            target.closest('.iui-toast').focus()
            target.dispatchEvent(event('pointerup'))
            target.click()
        }
        JS;

    $page->script("({$tap})('.iui-toast[data-front=\"true\"] [data-toast-body]')");
    $page->assertAttribute('.iui-toast-list', 'data-expanded', 'true');

    $page->script("({$tap})('.iui-toast[data-front=\"true\"] [aria-label^=\"Dismiss\"]')");
    $page->wait(0.5)
        ->assertScript("document.querySelectorAll('.iui-toast').length", 4)
        ->assertAttribute('.iui-toast-list', 'data-expanded', 'true')
        ->assertScript("document.activeElement.matches('.iui-toast[data-front=\"true\"]')", true);
});

it('dismisses a toast swiped toward the screen edge only', function () {
    $page = visit('/')->click('Persistent')->assertSee('Export queued');

    $page->script(swipeScript('Export queued', -80));
    $page->wait(0.5)->assertSee('Export queued');

    $page->script(swipeScript('Export queued', 80));
    $page->assertDontSee('Export queued');
});

it('lets one pointer at a time swipe the toasts', function () {
    $page = visit('/')
        ->click('Persistent')
        ->click('Copy link')
        ->assertSee('Export queued')
        ->assertSee('Link copied');

    // While the first finger drags a toast, a second one taps another toast and a third is cancelled.
    $page->script(<<<'JS'
        () => {
            const body = (title) => [...document.querySelectorAll('.iui-toast')].find((item) => item.textContent.includes(title)).querySelector('[data-toast-body]')
            const dragged = body('Export queued')
            const tapped = body('Link copied')
            const start = (element) => ({ x: element.getBoundingClientRect().left + 120, y: element.getBoundingClientRect().top + 8 })
            const from = { dragged: start(dragged), tapped: start(tapped) }
            const send = (element, type, pointerId, { x, y }, dx = 0) =>
                element.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId, button: 0, buttons: 1, isPrimary: pointerId === 7, clientX: x + dx, clientY: y }))

            send(dragged, 'pointerdown', 7, from.dragged)
            send(dragged, 'pointermove', 7, from.dragged, 40)
            send(tapped, 'pointerdown', 8, from.tapped)
            send(tapped, 'pointerup', 8, from.tapped)
            send(tapped, 'pointercancel', 9, from.tapped)
            send(dragged, 'pointermove', 7, from.dragged, 80)
            send(dragged, 'pointerup', 7, from.dragged, 80)
        }
        JS);

    $page->assertDontSee('Export queued')
        ->assertSee('Link copied')
        ->assertScript("document.querySelector('[data-swiping]') === null");
});

it('does not drag a toast that the pointer moves over after a press that ended outside the toasts', function () {
    $page = visit('/')->click('Persistent')->assertSee('Export queued');

    // The button goes up outside the toasts, so they never hear of it, and the pointer then moves over the toast.
    $page->script(<<<'JS'
        () => {
            const body = [...document.querySelectorAll('.iui-toast')].find((item) => item.textContent.includes('Export queued')).querySelector('[data-toast-body]')
            const { left, top } = body.getBoundingClientRect()
            const event = (type, x, buttons) => new PointerEvent(type, { bubbles: true, pointerId: 7, button: 0, buttons, isPrimary: true, clientX: x, clientY: top + 8 })
            body.dispatchEvent(event('pointerdown', left + 120, 1))
            document.body.dispatchEvent(event('pointerup', 10, 0))
            body.dispatchEvent(event('pointermove', left + 165, 0))
        }
        JS);

    $page->assertSee('Export queued')
        ->assertScript("document.querySelector('[data-swiping]') === null")
        ->assertScript("document.querySelector('.iui-toast').style.getPropertyValue('--toast-swipe')", '');

    $page->script(swipeScript('Export queued', 80));
    $page->assertDontSee('Export queued');
});

it('moves the toasts into an open modal dialog so they can be used there', function () {
    visit('/')
        ->click('Open a modal dialog')
        ->click('Toast from the dialog')
        ->assertSee('Shown inside the dialog')
        ->assertScript("document.querySelector('.iui-toaster-host').parentElement.tagName", 'DIALOG')
        ->click('Got it')
        ->assertDontSee('Shown inside the dialog')
        ->click('Close dialog')
        ->assertScript("document.querySelector('.iui-toaster-host').parentElement === document.body")
        ->assertNoJavaScriptErrors();
});

it('keeps a toast that cannot be dismissed open on Escape until it is replaced', function () {
    visit('/')
        ->click('Upload progress')
        ->assertSee('Uploading 1 of 3 files…')
        ->assertMissing('[aria-label^="Dismiss: Uploading"]')
        ->keys('Upload progress', 'F8')
        ->keys(':focus', 'Escape')
        ->assertSee('Uploading')
        ->assertSee('3 files uploaded')
        ->assertPresent('[aria-label="Dismiss: 3 files uploaded"]');
});

it('shows a toast of a custom type with the icon, label, and color the app gives that type', function () {
    $page = visit('/');
    $page->script(RECORD_ANNOUNCEMENTS);

    $page->click('Custom type')
        ->assertSee('Deployed to production')
        ->assertAttribute('.iui-toast', 'data-type', 'deployment')
        ->assertScript("document.querySelector('.iui-toast svg path').getAttribute('d')", 'M10 2l5 6h-3v5H8V8H5l5-6Zm-6 14h12v2H4v-2Z')
        // The app's CSS changes the default color for the type, which custom types use.
        ->assertScript(<<<'JS'
            () => {
                const probe = document.body.appendChild(Object.assign(document.createElement('span'), { style: 'color: var(--color-violet-600)' }))
                const expected = getComputedStyle(probe).color
                probe.remove()

                return getComputedStyle(document.querySelector('.iui-toast svg')).color === expected
            }
            JS, true)
        ->wait(0.3)
        ->assertScript('window.announced.polite', ['Deployment: Deployed to production. Version 2.4.0 is live.'])
        ->assertNoJavaScriptErrors();
});

it('switches to the dark tokens under the dark variant of the Laravel starter kits', function () {
    visit('/')
        ->click('Copy link')
        ->assertScript("getComputedStyle(document.querySelector('.iui-toast')).backgroundColor", 'rgb(255, 255, 255)');

    // The demo app uses the &:is(.dark *) variant of the starter kits, which never matches the root element.
    visit('/')
        ->inDarkMode()
        ->click('Copy link')
        ->assertSee('Link copied')
        ->assertScript(<<<'JS'
            () => {
                const probe = document.body.appendChild(Object.assign(document.createElement('span'), { style: 'color: var(--color-zinc-900)' }))
                const expected = getComputedStyle(probe).color
                probe.remove()

                return getComputedStyle(document.querySelector('.iui-toast')).backgroundColor === expected
            }
            JS, true)
        ->assertScript("getComputedStyle(document.querySelector('.iui-inbox-panel')).colorScheme", 'dark')
        ->assertNoJavaScriptErrors();
});

it('shows toasts in a Toaster built with useToasts, which runs their timers and actions', function () {
    visit('/custom-toaster')
        ->click('Show a toast')
        ->assertSeeIn('[data-custom-toaster]', 'Link copied')
        ->assertMissing('.iui-toast')
        // Pointing at the toasts pauses the timer, and the page shows the timer's state from the hook.
        ->hover('[data-custom-toaster] li')
        ->assertSeeIn('[data-custom-toaster]', 'Paused')
        ->wait(2.5)
        ->assertSee('Link copied')
        ->hover('Back to the demo')
        ->assertDontSee('Paused')
        // No Toaster component was mounted, so only the hook runs the timer.
        ->wait(3)
        ->assertDontSee('Link copied')
        ->click('Flash from Laravel')
        ->assertSeeIn('[data-custom-toaster]', 'Invoice sent')
        ->click('[data-custom-toaster] [aria-label="Dismiss: Invoice sent"]')
        ->assertDontSee('Invoice sent')
        ->click('Flash from Laravel')
        // The action navigates while the pointer pauses the toasts; the pause ends with the page.
        ->click('View invoice')
        ->assertPathIs('/')
        ->assertSee('Welcome back')
        ->click('Copy link')
        ->assertSee('Link copied')
        ->wait(6)
        ->assertDontSee('Link copied')
        ->assertNoJavaScriptErrors();
});
