<?php

// Runs against the stack selected by APP_STACK. The demo registers an icon resolver with setIconResolver() for ?icons=demo.

it('shows the icons of the global resolver in place of the built-in icons', function () {
    visit('/')
        ->assertMissing('[data-demo-icon]')
        ->assertPresent('[data-inbox-bell] svg');

    visit('/?icons=demo')
        ->assertPresent('[data-inbox-bell] svg[data-demo-icon="bell"]')
        ->assertScript("document.querySelectorAll('[data-inbox-bell] svg').length", 1)
        ->assertScript("document.querySelector('[data-inbox-bell] svg').getBoundingClientRect().width", 20)
        ->assertNoJavaScriptErrors();
});

it('keeps the icon of the icons prop of a component, which wins over the global resolver', function () {
    visit('/?icons=demo')
        ->click('Custom type')
        ->assertSee('Deployed to production')
        ->assertPresent('.iui-toast[data-type="deployment"] svg')
        ->assertMissing('.iui-toast [data-demo-icon]')
        ->assertNoJavaScriptErrors();
});
