<?php

// Runs against the stack selected by APP_STACK. Every request is signed in as the demo user.

use App\Models\User;
use InertiaUI\Notifications\Digest;
use InertiaUI\Notifications\NotificationHours;
use InertiaUI\Notifications\NotificationHoursChange;
use InertiaUI\Notifications\NotificationPreferences;

it('turns on notification hours and saves the hours of each day with the timezone of the browser', function () {
    $page = visit('/preferences')
        ->assertSeeIn('[data-inbox-preferences-notification-hours]', 'Notification hours')
        ->assertAttribute('[data-inbox-notification-hours]', 'aria-checked', 'false')
        ->assertAttribute('[data-inbox-notification-hours]', 'aria-label', 'Notification hours')
        ->assertValue('[data-inbox-notification-hours-day="monday"] [data-inbox-notification-hours-start]', '08:00')
        ->assertDisabled('[data-inbox-notification-hours-day="monday"] [data-inbox-notification-hours-start]')
        ->assertSeeIn('[data-inbox-notification-hours-day="saturday"]', 'Notifications wait all day')
        ->click('[data-inbox-notification-hours]')
        ->assertAttribute('[data-inbox-notification-hours]', 'aria-checked', 'true')
        ->assertEnabled('[data-inbox-notification-hours-day="monday"] [data-inbox-notification-hours-start]')
        ->fill('[data-inbox-notification-hours-day="monday"] [data-inbox-notification-hours-start]', '09:30')
        ->wait(0.5)
        ->click('[data-inbox-notification-hours-day="tuesday"] [data-inbox-notification-hours-add]')
        ->wait(0.5)
        ->click('[data-inbox-notification-hours-day="wednesday"] [data-inbox-notification-hours-day-switch]')
        ->wait(0.5)
        ->refresh()
        ->assertAttribute('[data-inbox-notification-hours]', 'aria-checked', 'true')
        ->assertValue('[data-inbox-notification-hours-day="monday"] [data-inbox-notification-hours-start]', '09:30')
        ->assertCount('[data-inbox-notification-hours-day="tuesday"] [data-inbox-notification-hours-start]', 2)
        ->assertAttribute('[data-inbox-notification-hours-day="wednesday"] [data-inbox-notification-hours-day-switch]', 'aria-checked', 'false')
        ->assertSeeIn('[data-inbox-notification-hours-day="wednesday"]', 'Notifications wait all day');

    expect(NotificationPreferences::notificationHours(User::demo())->toArray())
        ->toBe([
            'enabled' => true,
            'days' => [
                'monday' => ['09:30-18:00'],
                'tuesday' => ['08:00-18:00', '19:00-20:00'],
                'wednesday' => [],
                'thursday' => ['08:00-18:00'],
                'friday' => ['08:00-18:00'],
                'saturday' => [],
                'sunday' => [],
            ],
        ])
        ->and(NotificationPreferences::timezone(User::demo()))
        ->toBe($page->script('Intl.DateTimeFormat().resolvedOptions().timeZone'));

    $page->assertNoJavaScriptErrors();
});

it('keeps a range in its fields while its start moves before an earlier range, and sorts the day once the focus leaves it', function () {
    NotificationPreferences::update(User::demo(), notificationHours: new NotificationHoursChange(
        enabled: true,
        days: ['monday' => ['08:00-12:00', '13:00-18:00']],
    ));

    $starts = '[data-inbox-notification-hours-day="monday"] [data-inbox-notification-hours-start]';
    $ends = '[data-inbox-notification-hours-day="monday"] [data-inbox-notification-hours-end]';

    $page = visit('/preferences')
        ->assertValue("{$starts} >> nth=1", '13:00')
        ->fill("{$starts} >> nth=1", '07:00')
        ->wait(0.5)
        ->assertScript("document.activeElement === document.querySelectorAll('{$starts}')[1]")
        ->assertValue("{$starts} >> nth=1", '07:00')
        ->assertValue("{$ends} >> nth=1", '18:00')
        ->assertValue("{$starts} >> nth=0", '08:00');

    expect(NotificationPreferences::notificationHours(User::demo())->toArray()['days']['monday'])
        ->toBe(['07:00-18:00', '08:00-12:00']);

    $page->script('document.activeElement.blur()');

    $page->assertValue("{$starts} >> nth=0", '07:00')
        ->assertValue("{$ends} >> nth=0", '18:00')
        ->assertValue("{$starts} >> nth=1", '08:00')
        ->assertValue("{$ends} >> nth=1", '12:00')
        ->assertNoJavaScriptErrors();
});

it('holds the emails and the toasts of the notifications sent outside notification hours', function () {
    $range = now('UTC')->addHour()->format('H:i').'-'.now('UTC')->addHours(2)->format('H:i');

    NotificationPreferences::update(User::demo(), timezone: 'UTC', notificationHours: new NotificationHoursChange(
        enabled: true,
        days: array_fill_keys(NotificationHours::DAYS, [$range]),
    ));

    $page = visit('/digests')
        ->click('[data-demo-digest-scenario="comment"]')
        ->assertCount('[data-demo-held-item]', 1)
        ->assertNotPresent('.iui-toast');

    // The notification arrives in the bell right away.
    expect(User::demo()->inbox()->count())->toBe(1);

    $page->click('[data-inbox-notification-hours]')
        ->assertAttribute('[data-inbox-notification-hours]', 'aria-checked', 'false')
        ->wait(0.5)
        ->click('[data-demo-digest-scenario="comment"]')
        ->assertPresent('.iui-toast')
        ->assertCount('[data-demo-held-item]', 1)
        ->assertNoJavaScriptErrors();

    // Turning notification hours off sends the held email with the next run of the command.
    expect(Digest::query(User::demo())->sole()->send_at->isFuture())->toBeFalse();
});
