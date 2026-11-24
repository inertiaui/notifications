<?php

namespace InertiaUI\Notifications\Tests;

use Illuminate\Contracts\Http\Kernel;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\ServiceProvider;
use Inertia\Middleware;
use Inertia\ServiceProvider as InertiaServiceProvider;
use InertiaUI\Notifications\NotificationsServiceProvider;
use InertiaUI\Notifications\Tests\Fixtures\ApplicationServiceProvider;
use Orchestra\Testbench\Attributes\WithMigration;

use function Orchestra\Testbench\load_migration_paths;

use Orchestra\Testbench\TestCase as Orchestra;

#[WithMigration('laravel', 'notifications')]
abstract class TestCase extends Orchestra
{
    use RefreshDatabase;

    /**
     * Get the package providers.
     *
     * @param  Application  $app
     * @return array<int, class-string<ServiceProvider>>
     */
    protected function getPackageProviders($app): array
    {
        return [InertiaServiceProvider::class, NotificationsServiceProvider::class, ApplicationServiceProvider::class];
    }

    /**
     * Define the environment setup.
     *
     * @param  Application  $app
     */
    protected function defineEnvironment($app): void
    {
        $app['config']->set('app.key', 'base64:'.base64_encode(str_repeat('a', 32)));

        // The tests run on Testbench's in-memory SQLite database, unless DB_CONNECTION names another
        // connection, such as mysql or pgsql, which reads DB_HOST, DB_DATABASE, and the others. We
        // will turn on its foreign keys, which Testbench leaves off unless DB_FOREIGN_KEYS is set,
        // so pruning an announcement deletes the states of its users as it does in applications.
        $app['config']->set('database.connections.testing.foreign_key_constraints', true);
        $app['config']->set('inertia.testing.ensure_pages_exist', false);
        $app['config']->set('view.paths', [__DIR__.'/views']);

        // Applications add Inertia's middleware to the web group, and the package appends its own middleware
        // after it when the providers boot, so the routes of the tests run in the same order.
        $app->make(Kernel::class)->appendMiddlewareToGroup('web', Middleware::class);
    }

    /**
     * Define the database migrations.
     *
     * RefreshDatabase runs the migrations of the package, of the tests, and of Laravel once on a persistent
     * database, and runs each test in a transaction that it rolls back after the test.
     */
    protected function defineDatabaseMigrations(): void
    {
        // Testbench's loadMigrationsFrom() migrates and rolls back a path on its own once the database was
        // migrated, which would migrate a persistent database again for every other test, so we will give
        // the paths to the migrator that RefreshDatabase runs instead.
        load_migration_paths($this->app, [__DIR__.'/../database/migrations', __DIR__.'/database/migrations']);
    }
}
