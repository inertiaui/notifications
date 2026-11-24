<?php

// Runs against the stack selected by APP_STACK, using its built demo assets.

/**
 * Records what the polite announcer says, so an announcement that is cleared a second later can be asserted.
 */
const RECORD_POLITE_ANNOUNCEMENTS = <<<'JS'
    () => {
        window.politeAnnouncements = []
        const region = document.querySelector('.iui-toaster [role="status"]')
        new MutationObserver(() => region.textContent && window.politeAnnouncements.push(region.textContent))
            .observe(region, { childList: true, characterData: true, subtree: true })
    }
    JS;

/**
 * Waits up to three seconds for an element that matches the selector, such as a bar that shows a value for a moment.
 */
function waitForElement(string $selector): string
{
    return <<<JS
        () => new Promise((resolve) => {
            const started = performance.now()
            const check = () => {
                if (document.querySelector('{$selector}')) {
                    return resolve(true)
                }

                performance.now() - started > 3000 ? resolve(false) : requestAnimationFrame(check)
            }

            check()
        })
        JS;
}

it('renders the toasts of a type with the component the Toaster has for it, and announces them', function () {
    $page = visit('/more-toasts');
    $page->script(RECORD_POLITE_ANNOUNCEMENTS);

    $page->click('Flash an invitation')
        ->assertSeeIn('[data-invite-toast]', 'Join Acme as Editor · 12 members')
        ->assertScript("document.querySelector('.iui-toast:has([data-invite-toast])')?.getAttribute('data-type')", 'invite')
        ->click('Invitation from the browser')
        ->assertSeeIn('.iui-toast[data-front="true"] [data-invite-toast]', 'Join Apollo as Admin · 4 members')
        // A toast of another type keeps the default markup, also with data.
        ->click('Another type')
        ->assertSeeIn('.iui-toast[data-front="true"]', 'Toasts of other types keep the default markup.')
        ->assertMissing('.iui-toast[data-front="true"] [data-invite-toast]')
        ->assertPresent('.iui-toast[data-front="true"] [aria-label="Dismiss: Invitation sent"]')
        ->wait(0.3)
        // The announcer joins announcements that arrive together.
        ->assertScript(
            "window.politeAnnouncements.join(' ')",
            'Sophie invited you to Acme. Maria invited you to Apollo. Success: Invitation sent. Toasts of other types keep the default markup.',
        )
        ->assertNoJavaScriptErrors();
});

it('dismisses a toast rendered by a component with its own button, Escape, a swipe, or an action', function () {
    $page = visit('/more-toasts')
        ->click('Flash an invitation')
        ->assertSee('Sophie invited you to Acme')
        ->click('[aria-label="Dismiss: Sophie invited you to Acme"]')
        ->assertDontSee('Sophie invited you to Acme')
        ->click('Invitation from the browser')
        ->assertSee('Maria invited you to Apollo')
        ->keys('Invitation from the browser', 'F8')
        ->keys(':focus', 'Escape')
        ->assertDontSee('Maria invited you to Apollo')
        ->click('Invitation from the browser')
        ->assertSee('Maria invited you to Apollo');

    $page->script(<<<'JS'
        () => {
            const body = document.querySelector('.iui-toast[data-state="visible"] [data-toast-body]')
            const { left, top } = body.getBoundingClientRect()
            const event = (type, x) => new PointerEvent(type, { bubbles: true, pointerId: 7, button: 0, buttons: 1, isPrimary: true, clientX: x, clientY: top + 8 })
            body.dispatchEvent(event('pointerdown', left + 120))
            body.dispatchEvent(event('pointermove', left + 160))
            body.dispatchEvent(event('pointermove', left + 200))
            body.dispatchEvent(event('pointerup', left + 200))
        }
        JS);

    $page->assertDontSee('Maria invited you to Apollo')
        ->click('Flash an invitation')
        ->click('View team')
        ->assertDontSee('Sophie invited you to Acme')
        ->assertPathIs('/more-toasts')
        ->assertNoJavaScriptErrors();
});

it('shows the progress of a flashed toast as a bar that screen readers read', function () {
    visit('/more-toasts')
        ->click('Flash an import')
        ->assertSee('480 of 1,204 contacts')
        ->assertScript("document.querySelector('[data-toast-progressbar]')?.getAttribute('role')", 'progressbar')
        ->assertScript("document.querySelector('[data-toast-progressbar]')?.getAttribute('aria-valuenow')", '40')
        ->assertScript("document.querySelector('[data-toast-progressbar]')?.getAttribute('aria-valuemin')", '0')
        ->assertScript("document.querySelector('[data-toast-progressbar]')?.getAttribute('aria-valuemax')", '100')
        ->assertScript("document.querySelector('[data-toast-progressbar]')?.getAttribute('aria-label')", 'Importing contacts…')
        ->assertNoJavaScriptErrors();
});

it('fills the loading toast of a tracked visit with the upload progress, then replaces it', function () {
    visit('/more-toasts')
        ->click('Track an upload')
        // The server waits after the upload, so the full bar shows until the visit finishes.
        ->assertScript(waitForElement('[data-toast-progressbar][aria-valuenow="100"][aria-label="Uploading report.pdf…"]'), true)
        ->assertSee('Report uploaded')
        ->assertNotPresent('[data-toast-progressbar]')
        ->assertNoJavaScriptErrors();
});

it('updates the bar of a toast from the browser', function () {
    visit('/more-toasts')
        ->click('Upload in steps')
        ->assertScript(waitForElement('[data-toast-progressbar][aria-valuenow="35"]'), true)
        ->assertScript(waitForElement('[data-toast-progressbar][aria-valuenow="70"]'), true)
        ->assertSee('report.pdf uploaded')
        ->assertNotPresent('[data-toast-progressbar]');
});

it('shows the image of a flashed toast in place of its icon, and still announces its type', function () {
    $page = visit('/more-toasts');
    $page->script(RECORD_POLITE_ANNOUNCEMENTS);

    $page->click('Flash a comment')
        ->assertSee('Looks great, ship it!')
        ->assertScript("document.querySelector('.iui-toast img')?.getAttribute('src')", '/avatars/sophie.svg')
        ->assertScript("document.querySelector('.iui-toast img')?.getAttribute('alt')", '')
        ->assertScript("() => document.querySelector('.iui-toast img').decode().then(() => true, () => false)")
        ->assertNotPresent('.iui-toast span[aria-hidden="true"] > svg')
        ->wait(0.3)
        ->assertScript("window.politeAnnouncements.join(' ')", 'Info: Sophie Martin commented. Looks great, ship it!')
        ->assertNoJavaScriptErrors();
});

it('shows the icon component or element that a browser toast passes', function () {
    visit('/more-toasts')
        ->click('Toast with its own icon')
        ->assertSee('Release published')
        ->assertPresent('.iui-toast[data-type="success"] svg[data-demo-icon="release"]')
        ->assertNoJavaScriptErrors();
});

/**
 * Whether the pointer reaches the toast with the title at its center, above everything else on the page, and whether
 * screen readers reach it.
 */
function toastReach(string $title): string
{
    return <<<JS
        () => {
            const toast = [...document.querySelectorAll('.iui-toast')].find((item) => item.textContent.includes('{$title}'))
            const { left, top, width, height } = toast.getBoundingClientRect()

            return {
                pointer: toast.contains(document.elementFromPoint(left + width / 2, top + height / 2)),
                screenReaders: toast.closest('[aria-hidden="true"], [inert]') === null,
            }
        }
        JS;
}

it('keeps the toasts usable above a dialog of another library, which stays open when an action runs', function () {
    visit('/more-toasts')
        ->click('Show a toast that stays')
        ->click('Open a dialog')
        // The dialog hides the rest of the page from screen readers and turns off its pointer events, but not the toasts'.
        ->assertScript("document.querySelector('main').closest('[aria-hidden=\"true\"]') !== null")
        ->assertScript('document.body.style.pointerEvents', 'none')
        ->assertScript(toastReach('Draft saved'), ['pointer' => true, 'screenReaders' => true])
        ->click('Save')
        ->assertSee('Profile saved')
        ->assertScript(toastReach('Profile saved'), ['pointer' => true, 'screenReaders' => true])
        ->click('Undo')
        ->assertDontSee('Profile saved')
        ->assertVisible('[role="dialog"][data-state="open"]')
        ->assertSeeIn('[role="dialog"][data-state="open"]', 'Undone: 1')
        ->assertNoJavaScriptErrors();
});

it('focuses a toast above a dialog of another library with the shortcut, and closes only the toast on Escape', function () {
    visit('/more-toasts')
        ->click('Open a dialog')
        ->click('Save')
        ->assertSee('Profile saved')
        ->keys('Save', 'F8')
        ->wait(0.2)
        // The dialog's focus trap leaves focus on the toast.
        ->assertScript("document.activeElement.closest('.iui-toast')?.textContent.includes('Profile saved')", true)
        ->keys(':focus', 'Escape')
        ->assertDontSee('Profile saved')
        ->assertVisible('[role="dialog"][data-state="open"]')
        ->assertScript('document.activeElement.textContent.trim()', 'Save')
        ->assertNoJavaScriptErrors();
});

it('keeps the toasts usable above the notification center panel, which stays open when an action runs', function () {
    visit('/more-toasts')
        ->click('Show a toast that stays')
        ->assertSee('Draft saved')
        ->click('[data-inbox-bell]')
        ->assertScript("document.querySelector('.iui-inbox-panel').matches(':popover-open')", true)
        ->assertScript("document.querySelector('.iui-toaster-host').parentElement.classList.contains('iui-inbox-panel')", true)
        ->assertScript(toastReach('Draft saved'), ['pointer' => true, 'screenReaders' => true])
        ->click('Undo')
        ->assertDontSee('Draft saved')
        ->assertSee('Undone: 1')
        ->assertScript("document.querySelector('.iui-inbox-panel').matches(':popover-open')", true)
        // The toasts leave the panel before it closes.
        ->click('[data-inbox-bell]')
        ->assertScript("document.querySelector('.iui-inbox-panel').matches(':popover-open')", false)
        ->assertScript("document.querySelector('.iui-toaster-host').parentElement === document.body", true)
        ->assertNoJavaScriptErrors();
});

it('leaves the toasts under the dialogs of other libraries when aboveModals is off', function () {
    visit('/more-toasts?above-modals=off')
        ->click('Show a toast that stays')
        ->click('Open a dialog')
        ->assertSee('Draft saved')
        ->assertScript("document.querySelector('.iui-toaster-host').hasAttribute('popover')", false)
        ->assertScript(toastReach('Draft saved'), ['pointer' => false, 'screenReaders' => false])
        ->assertNoJavaScriptErrors();
});
