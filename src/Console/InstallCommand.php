<?php

namespace InertiaUI\Notifications\Console;

use Illuminate\Console\Command;
use Illuminate\Filesystem\Filesystem;

use function Laravel\Prompts\confirm;
use function Laravel\Prompts\select;

use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Formatter\OutputFormatter;

/**
 * Publishes the configuration and the migrations, and prints the setup steps that remain.
 */
#[AsCommand(name: 'inertia-notifications:install')]
class InstallCommand extends Command
{
    /**
     * The Inertia adapters on npm, by the frontend they belong to.
     *
     * @var array<'vue'|'react', string>
     */
    protected const array ADAPTERS = ['vue' => '@inertiajs/vue3', 'react' => '@inertiajs/react'];

    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'inertia-notifications:install';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Publish the configuration and migrations, and list the remaining setup steps';

    /**
     * The number of the next step to print.
     */
    protected int $step = 1;

    /**
     * Execute the console command.
     */
    public function handle(Filesystem $files): int
    {
        $this->publishResources();
        $this->addToBoost($files);

        $frontend = $this->frontend($files);
        $this->step = 1;

        $this->printToasterSteps($frontend, $files);
        $this->printNotificationCenterSteps($frontend);

        $this->components->info('See https://inertiaui.com/inertia-notifications/docs/installation for every step.');

        return self::SUCCESS;
    }

    /**
     * Publish the configuration file and the migrations.
     */
    protected function publishResources(): void
    {
        $this->components->info('Publishing the Inertia Notifications resources.');

        $tags = [
            'Configuration' => 'inertia-notifications-config',
            'Migrations' => 'inertia-notifications-migrations',
        ];

        foreach ($tags as $description => $tag) {
            $this->components->task(
                $description,
                fn (): bool => $this->callSilent('vendor:publish', ['--tag' => $tag]) === self::SUCCESS,
            );
        }
    }

    /**
     * Add the package to the packages in the boost.json file, and update the Boost guidelines and skills.
     *
     * Boost only asks which new packages to add while it runs interactively and not as a Composer script.
     * The starter kits run boost:update as a Composer script, so Boost never adds the package by itself.
     */
    protected function addToBoost(Filesystem $files): void
    {
        $path = $this->laravel->basePath('boost.json');

        if (! $files->exists($path) || ! $this->getApplication()?->has('boost:update')) {
            return;
        }

        $config = json_decode($files->get($path), true);
        $packages = is_array($config) ? $config['packages'] ?? [] : null;

        if (! is_array($packages)) {
            $this->components->warn('The boost.json file is not valid, so the package was not added to Laravel Boost.');

            return;
        }

        if (in_array('inertiaui/notifications', $packages, true)) {
            return;
        }

        if (! confirm('Would you like to add the Inertia Notifications guidelines and skill to Laravel Boost?')) {
            return;
        }

        $config['packages'] = [...$packages, 'inertiaui/notifications'];

        ksort($config);

        $files->put($path, json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES).PHP_EOL);

        $this->call('boost:update');
    }

    /**
     * Get the frontend of the application.
     *
     * The frontend follows from the Inertia adapter in the application's package.json file. When the
     * file lists neither adapter or both of them, we will ask which one to print the steps for.
     *
     * @return 'vue'|'react'
     */
    protected function frontend(Filesystem $files): string
    {
        $dependencies = $this->dependencies($files);

        $frontends = collect(self::ADAPTERS)
            ->filter(fn (string $adapter): bool => array_key_exists($adapter, $dependencies))
            ->keys();

        if ($frontends->count() === 1) {
            return $frontends->first();
        }

        /** @var 'vue'|'react' */
        return select(
            label: 'Which frontend does your application use?',
            options: ['vue' => 'Vue', 'react' => 'React'],
            default: 'vue',
        );
    }

    /**
     * Get the npm dependencies of the application.
     *
     * @return array<string, string>
     */
    protected function dependencies(Filesystem $files): array
    {
        $path = $this->laravel->basePath('package.json');

        if (! $files->exists($path)) {
            return [];
        }

        $package = $files->json($path);

        return [...$package['dependencies'] ?? [], ...$package['devDependencies'] ?? []];
    }

    /**
     * Print the steps that show the toasts in the frontend.
     *
     * @param  'vue'|'react'  $frontend
     */
    protected function printToasterSteps(string $frontend, Filesystem $files): void
    {
        $package = "@inertiaui/notifications-{$frontend}";
        $extensions = $frontend === 'vue' ? '{ts,vue}' : '{ts,tsx}';
        $starterKit = $this->usesStarterKit($frontend, $files);

        $this->components->info('Next, set up the toasts in your frontend.');

        $this->printStep('Install the frontend package:', [
            $this->installCommand($frontend, $files),
        ]);

        $theme = $starterKit ? 'the theme and the starter kit colors' : 'the theme';

        $this->printStep("Import {$theme} after Tailwind in resources/css/app.css, and add the package's sources:", [
            "@import '{$package}/theme.css';",
            ...$starterKit ? ["@import '{$package}/shadcn.css';"] : [],
            "@source '../../vendor/inertiaui/notifications/{$frontend}/src/**/*.{$extensions}';",
        ]);

        $this->printStep('Call initNotifications() in your entry point, before createInertiaApp():', [
            "import { initNotifications } from '{$package}'",
            'initNotifications()',
        ]);

        if ($starterKit) {
            $this->printStarterKitSteps($frontend);

            return;
        }

        $this->printStep('Render one Toaster in your persistent layout:', [
            "import { Toaster } from '{$package}'",
            '<Toaster />',
        ]);
    }

    /**
     * Determine if the application is built on a Laravel starter kit, which shows its flashed toasts with sonner.
     *
     * @param  'vue'|'react'  $frontend
     */
    protected function usesStarterKit(string $frontend, Filesystem $files): bool
    {
        $listener = $frontend === 'vue' ? 'js/lib/flashToast.ts' : 'js/hooks/use-flash-toast.ts';

        return $files->exists($this->laravel->resourcePath($listener));
    }

    /**
     * Print the steps that replace the sonner Toaster of a Laravel starter kit and show the kit's flashed toasts.
     *
     * @param  'vue'|'react'  $frontend
     */
    protected function printStarterKitSteps(string $frontend): void
    {
        if ($frontend === 'vue') {
            $this->printStep('Import the Toaster from the package instead of sonner in resources/js/layouts/app/AppSidebarLayout.vue and AppHeaderLayout.vue:', [
                "import { Toaster } from '@inertiaui/notifications-vue'",
            ]);

            $this->printStep('Import toast from the package instead of vue-sonner in resources/js/lib/flashToast.ts:', [
                "import { toast } from '@inertiaui/notifications-vue'",
            ]);

            return;
        }

        $this->printStep('Import the Toaster from the package instead of sonner in resources/js/app.tsx:', [
            "import { Toaster } from '@inertiaui/notifications-react'",
        ]);

        $this->printStep('Delete resources/js/components/ui/sonner.tsx and resources/js/hooks/use-flash-toast.ts, and listen for the toasts in resources/js/app.tsx:', [
            "import { router } from '@inertiajs/react'",
            "import { toast } from '@inertiaui/notifications-react'",
            '',
            "router.on('flash', (event) => {",
            '    const data = event.detail.flash.toast',
            '',
            '    if (data) {',
            '        toast[data.type](data.message)',
            '    }',
            '})',
        ]);

        $this->printStep('Type the flash data in the InertiaConfig interface of resources/js/types/global.d.ts:', [
            "import type { InertiaUIFlashData } from '@inertiaui/notifications-react'",
            "import type { FlashToast } from '@/types/ui'",
            '',
            'flashDataType: InertiaUIFlashData & {',
            '    toast?: FlashToast',
            '}',
        ]);
    }

    /**
     * Print the steps that set up the notification center and the preferences.
     *
     * @param  'vue'|'react'  $frontend
     */
    protected function printNotificationCenterSteps(string $frontend): void
    {
        $this->components->info('To use the notification center, also follow these steps.');

        $this->printStep('Run the migrations. Models with UUID or ULID keys need uuidMorphs() or ulidMorphs() first:', [
            'php artisan migrate',
        ]);

        $this->printStep('Add the HasInbox trait to your User model, next to the Notifiable trait:', [
            'use InertiaUI\Notifications\Concerns\HasInbox;',
            'use HasInbox, Notifiable;',
        ]);

        $this->printStep('Register the routes in routes/web.php:', [
            'Route::inertiaNotifications();',
        ]);

        $this->printStep('Render the NotificationCenter in your persistent layout:', [
            "import { NotificationCenter } from '@inertiaui/notifications-{$frontend}'",
            '<NotificationCenter />',
        ]);
    }

    /**
     * Get the command that installs the frontend package with the application's package manager.
     *
     * pnpm only installs the dependencies of a package in a local folder with the file: protocol.
     *
     * @param  'vue'|'react'  $frontend
     */
    protected function installCommand(string $frontend, Filesystem $files): string
    {
        $path = "vendor/inertiaui/notifications/{$frontend}";

        if ($files->exists($this->laravel->basePath('pnpm-lock.yaml'))) {
            return "pnpm add file:{$path}";
        }

        return "npm install {$path}";
    }

    /**
     * Print the next numbered step with the code it needs.
     *
     * @param  list<string>  $code
     */
    protected function printStep(string $description, array $code): void
    {
        $this->line("  <options=bold>{$this->step}.</> {$description}");
        $this->newLine();

        foreach ($code as $line) {
            $escaped = OutputFormatter::escape($line);

            $this->line($line === '' ? '' : "     {$escaped}");
        }

        $this->newLine();

        $this->step++;
    }
}
