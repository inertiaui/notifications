<?php

namespace InertiaUI\Notifications\Console;

use Illuminate\Console\Command;
use Illuminate\Filesystem\Filesystem;

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

        $this->components->info('Next, set up the toasts in your frontend.');

        $this->printStep('Install the frontend package:', [
            $this->installCommand($frontend, $files),
        ]);

        $this->printStep("Import the theme after Tailwind in resources/css/app.css, and add the package's sources:", [
            "@import '{$package}/theme.css';",
            "@source '../../vendor/inertiaui/notifications/{$frontend}/src/**/*.{$extensions}';",
        ]);

        $this->printStep('Call initNotifications() in your entry point, before createInertiaApp():', [
            "import { initNotifications } from '{$package}'",
            'initNotifications()',
        ]);

        $this->printStep('Render one Toaster in your persistent layout:', [
            "import { Toaster } from '{$package}'",
            '<Toaster />',
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

            $this->line("     {$escaped}");
        }

        $this->newLine();

        $this->step++;
    }
}
