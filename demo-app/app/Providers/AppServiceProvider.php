<?php

namespace App\Providers;

use Illuminate\Foundation\Console\ServeCommand;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Artisan serve only forwards an allowlist of environment variables to its PHP server.
        ServeCommand::$passthroughVariables[] = 'APP_STACK';
        ServeCommand::$passthroughVariables[] = 'APP_URL';
    }

    public function boot(): void
    {
        // The package's migration, which applications publish with the inertia-notifications-migrations tag.
        $this->loadMigrationsFrom(base_path('vendor/inertiaui/notifications/database/migrations'));

        // Applications list their categories in config/inertia-notifications.php, published with the
        // inertia-notifications-config tag.
        config(['inertia-notifications.preferences.groups' => [
            'activity' => ['label' => 'Activity', 'description' => 'What happens in your projects.'],
            'account' => ['label' => 'Account'],
            'updates' => ['label' => 'Updates'],
        ]]);

        config(['inertia-notifications.preferences.categories' => [
            'comments' => ['label' => 'Comments', 'description' => 'Replies to the issues you follow.', 'group' => 'activity', 'digest' => true],
            'billing' => ['label' => 'Billing', 'description' => 'Paid invoices and failed payments.', 'group' => 'account', 'digest' => true],
            'deployments' => ['label' => 'Deployments', 'description' => 'Finished and failed deployments.', 'channels' => ['inbox'], 'group' => 'activity'],
            'reports' => ['label' => 'Weekly reports', 'channels' => ['mail'], 'group' => 'updates', 'digest' => true],
            'security' => ['label' => 'Security', 'description' => 'Sign-ins from new devices.', 'locked' => true, 'group' => 'account'],
            'product' => ['label' => 'Product updates', 'description' => 'New features and tips.', 'channels' => ['mail'], 'opt_in' => true, 'group' => 'updates'],
        ]]);

        // Notification hours are off by default, so the demo turns them on to show them in the preferences,
        // with office hours on weekdays and none at the weekend, so the preferences also show a day off.
        config(['inertia-notifications.notification_hours' => [
            'enabled' => true,
            'days' => [
                'monday' => ['08:00-18:00'],
                'tuesday' => ['08:00-18:00'],
                'wednesday' => ['08:00-18:00'],
                'thursday' => ['08:00-18:00'],
                'friday' => ['08:00-18:00'],
                'saturday' => [],
                'sunday' => [],
            ],
        ]]);

        // Pausing is off by default, so the demo turns it on to show the pause button in the panel.
        config(['inertia-notifications.pause.enabled' => true]);

        // Web push is off by default, so the demo turns it on to show the push column and the device control in the
        // preferences. Run `php artisan inertia-notifications:vapid` to write the keys that it needs to the .env file.
        config(['inertia-notifications.push.enabled' => true]);

        // Deleting notifications is not one of the default actions, so the demo adds it to show the delete buttons.
        config(['inertia-notifications.inbox.actions' => ['snooze', 'archive', 'mute', 'delete']]);

        // The panel shows a button for each category of the demo notifications.
        config(['inertia-notifications.inbox.category_filter' => ['comments', 'billing', 'deployments', 'reports']]);

        // A tab after the built-in ones, with the deployments whose with() data names production.
        config(['inertia-notifications.inbox.tabs' => [
            'production' => ['label' => 'Production', 'category' => 'deployments', 'data' => ['environment' => 'production']],
        ]]);

        $stack = config('demo.stack');

        Vite::useBuildDirectory("build-{$stack}");

        // Browser tests always use built assets, even while a Vite dev server is running.
        Vite::useHotFile($this->app->environment('testing')
            ? storage_path('framework/testing/disabled-vite-hot')
            : public_path("hot-{$stack}"));
    }
}
