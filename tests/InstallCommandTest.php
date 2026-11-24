<?php

use Illuminate\Console\Command;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\File;

afterEach(function (): void {
    File::delete([
        base_path('boost.json'),
        base_path('package.json'),
        base_path('pnpm-lock.yaml'),
        config_path('inertia-notifications.php'),
        ...File::glob(database_path('migrations/*.php')),
    ]);

    File::deleteDirectory(resource_path('js'));
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
        ->doesntExpectOutputToContain('shadcn.css')
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

it('adds the package to Laravel Boost and updates the guidelines and skills', function (): void {
    File::put(base_path('package.json'), json_encode(['dependencies' => ['@inertiajs/vue3' => '^3.0']]));
    File::put(base_path('boost.json'), json_encode(['skills' => ['pest-testing'], 'agents' => ['claude_code']]));

    $this->app[Kernel::class]->registerCommand(new class extends Command
    {
        protected $signature = 'boost:update';

        public function handle(): void
        {
            $this->line('Boost read '.file_get_contents(base_path('boost.json')));
        }
    });

    $this->artisan('inertia-notifications:install')
        ->expectsConfirmation('Would you like to add the Inertia Notifications guidelines and skill to Laravel Boost?', 'yes')
        ->expectsOutputToContain('"packages": [')
        ->assertSuccessful();

    expect(File::json(base_path('boost.json')))->toBe([
        'agents' => ['claude_code'],
        'packages' => ['inertiaui/notifications'],
        'skills' => ['pest-testing'],
    ]);

    $this->artisan('inertia-notifications:install')
        ->doesntExpectOutputToContain('Boost read')
        ->assertSuccessful();
});

it('leaves a boost.json file that is not valid untouched', function (string $contents): void {
    File::put(base_path('package.json'), json_encode(['dependencies' => ['@inertiajs/vue3' => '^3.0']]));
    File::put(base_path('boost.json'), $contents);

    $this->app[Kernel::class]->registerCommand(new class extends Command
    {
        protected $signature = 'boost:update';

        public function handle(): void
        {
            $this->line('Boost updated');
        }
    });

    $this->artisan('inertia-notifications:install')
        ->expectsOutputToContain('The boost.json file is not valid')
        ->doesntExpectOutputToContain('Boost updated')
        ->assertSuccessful();

    expect(File::get(base_path('boost.json')))->toBe($contents);
})->with([
    'truncated' => '{"agents": ["claude_code"], "skills": [',
    'packages that are not a list' => '{"packages": "laravel/cashier"}',
]);

it('prints the steps that move the toasts of the React starter kit', function (): void {
    File::put(base_path('package.json'), json_encode(['dependencies' => ['@inertiajs/react' => '^3.0']]));
    File::ensureDirectoryExists(resource_path('js/hooks'));
    File::put(resource_path('js/hooks/use-flash-toast.ts'), '');

    $this->artisan('inertia-notifications:install')
        ->expectsOutputToContain("@import '@inertiaui/notifications-react/shadcn.css';")
        ->expectsOutputToContain('Import the Toaster from the package instead of sonner in resources/js/app.tsx')
        ->expectsOutputToContain('Delete resources/js/components/ui/sonner.tsx and resources/js/hooks/use-flash-toast.ts')
        ->expectsOutputToContain('toast[data.type](data.message)')
        ->expectsOutputToContain('toast?: FlashToast')
        ->doesntExpectOutputToContain('Render one Toaster in your persistent layout')
        ->assertSuccessful();
});

it('prints the steps that move the toasts of the Vue starter kit', function (): void {
    File::put(base_path('package.json'), json_encode(['dependencies' => ['@inertiajs/vue3' => '^3.0']]));
    File::ensureDirectoryExists(resource_path('js/lib'));
    File::put(resource_path('js/lib/flashToast.ts'), '');

    $this->artisan('inertia-notifications:install')
        ->expectsOutputToContain("@import '@inertiaui/notifications-vue/shadcn.css';")
        ->expectsOutputToContain('resources/js/layouts/app/AppSidebarLayout.vue and AppHeaderLayout.vue')
        ->expectsOutputToContain('Import toast from the package instead of vue-sonner in resources/js/lib/flashToast.ts')
        ->doesntExpectOutputToContain('Render one Toaster in your persistent layout')
        ->assertSuccessful();
});
