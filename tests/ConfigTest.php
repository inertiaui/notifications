<?php

use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Inertia\Inertia;
use InertiaUI\Notifications\Announcement;
use InertiaUI\Notifications\Inbox;
use InertiaUI\Notifications\InboxMessage;
use InertiaUI\Notifications\Models\InboxAnnouncement;
use InertiaUI\Notifications\Models\InboxNotification;
use InertiaUI\Notifications\NotificationPreferences;
use InertiaUI\Notifications\Push;
use InertiaUI\Notifications\Tests\Fixtures\User;

it('applies the default of a nested key that a published config lacks', function (string $key, Closure $assertDefault): void {
    // The package fills in only the top-level keys that a published config lacks, so a
    // config that was published before these nested keys were added lacks them.
    $config = config('inertia-notifications');

    Arr::forget($config, $key);

    config(['inertia-notifications' => $config]);

    $assertDefault();
})->with([
    'the name of the shared prop' => ['inbox.shared_prop', function (): void {
        Route::middleware('web')->group(function (): void {
            Route::inertiaNotifications();
            Route::get('/dashboard', fn () => Inertia::render('Dashboard'));
        });

        $shared = test()->actingAs(User::named('Sophie'))
            ->get('/dashboard', ['X-Inertia' => 'true'])
            ->json('props.inertiauiInbox');

        expect($shared)->toBeArray();
    }],
    'the days after which rows are pruned' => ['inbox.prune_after_days', function (): void {
        $user = User::named('Sophie');

        test()->travelTo(now()->subDays(91));

        Inbox::record($user, (string) Str::uuid(), 'test', InboxMessage::make('Old'));
        Announcement::make('Old')->publish();

        test()->travelBack();

        $notification = Inbox::record($user, (string) Str::uuid(), 'test', InboxMessage::make('Recent'));
        $announcement = Announcement::make('Recent')->publish();

        test()->artisan('model:prune', ['--model' => [InboxNotification::class, InboxAnnouncement::class]])
            ->assertSuccessful();

        expect(InboxNotification::query()->pluck('id')->all())
            ->toBe([$notification->id])
            ->and(InboxAnnouncement::query()->pluck('id')->all())
            ->toBe([$announcement->id]);
    }],
    'the channels of the preferences' => [
        'preferences.channels',
        fn () => expect(array_keys(NotificationPreferences::channels()))->toBe(['inbox', 'mail']),
    ],
    'the hosts of the push services' => [
        'push.hosts',
        fn () => expect(Push::hostPatternOf('updates.push.apple.com'))->toBe('*.push.apple.com'),
    ],
]);
