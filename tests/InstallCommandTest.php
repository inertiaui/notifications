<?php

use Illuminate\Support\Facades\File;

afterEach(function (): void {
    File::delete([
        base_path('package.json'),
        base_path('pnpm-lock.yaml'),
        config_path('inertia-notifications.php'),
        ...File::glob(database_path('migrations/*.php')),
    ]);
});

it('publishes the configuration and the migrations', function (): void {
    File::put(base_path('package.json'), json_encode(['dependencies' => ['@inertiajs/vue3' => '^3.0']]));

    $this->artisan('inertia-notifications:install')
        ->assertSuccessful();

    expect(config_path('inertia-notifications.php'))
        ->toBeFile()
        ->and(File::glob(database_path('migrations/*.php')))
        ->sequence(
            fn ($migration) => $migration->toEndWith('create_inbox_announcements_table.php'),
            fn ($migration) => $migration->toEndWith('create_inbox_notifications_table.php'),
            fn ($migration) => $migration->toEndWith('create_notification_digest_items_table.php'),
            fn ($migration) => $migration->toEndWith('create_notification_preferences_table.php'),
            fn ($migration) => $migration->toEndWith('create_push_subscriptions_table.php'),
        );
});

it('keeps the configuration that the application already published', function (): void {
    File::put(base_path('package.json'), json_encode(['dependencies' => ['@inertiajs/vue3' => '^3.0']]));
    File::put(config_path('inertia-notifications.php'), '<?php return [];');

    $this->artisan('inertia-notifications:install')
        ->assertSuccessful();

    expect(File::get(config_path('inertia-notifications.php')))->toBe('<?php return [];');
});

it('prints the steps for the frontend in the package.json file', function (): void {
    File::put(base_path('package.json'), json_encode(['devDependencies' => ['@inertiajs/react' => '^3.0']]));

    $this->artisan('inertia-notifications:install')
        ->expectsOutputToContain('npm install vendor/inertiaui/notifications/react')
        ->expectsOutputToContain("@import '@inertiaui/notifications-react/theme.css';")
        ->expectsOutputToContain("@source '../../vendor/inertiaui/notifications/react/src/**/*.{ts,tsx}';")
        ->expectsOutputToContain("import { initNotifications } from '@inertiaui/notifications-react'")
        ->expectsOutputToContain('<Toaster />')
        ->expectsOutputToContain('php artisan migrate')
        ->expectsOutputToContain('Route::inertiaNotifications();')
        ->expectsOutputToContain('<NotificationCenter />')
        ->assertSuccessful();
});

it('asks for the frontend when the package.json file does not tell', function (): void {
    File::put(base_path('package.json'), json_encode([
        'dependencies' => ['@inertiajs/vue3' => '^3.0', '@inertiajs/react' => '^3.0'],
    ]));

    $this->artisan('inertia-notifications:install')
        ->expectsChoice('Which frontend does your application use?', 'vue', ['vue' => 'Vue', 'react' => 'React'])
        ->expectsOutputToContain("@source '../../vendor/inertiaui/notifications/vue/src/**/*.{ts,vue}';")
        ->assertSuccessful();
});

it('installs the frontend package with the file protocol in pnpm applications', function (): void {
    File::put(base_path('package.json'), json_encode(['dependencies' => ['@inertiajs/vue3' => '^3.0']]));
    File::put(base_path('pnpm-lock.yaml'), '');

    $this->artisan('inertia-notifications:install')
        ->expectsOutputToContain('pnpm add file:vendor/inertiaui/notifications/vue')
        ->assertSuccessful();
});
