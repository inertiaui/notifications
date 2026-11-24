<?php

namespace InertiaUI\Notifications;

use Illuminate\Auth\Events\Login;
use Illuminate\Auth\Events\Logout;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Foundation\Http\Kernel as HttpKernel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Response;
use Illuminate\Notifications\ChannelManager;
use Illuminate\Notifications\Events\NotificationSending;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;
use Illuminate\Testing\TestResponse;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;
use InertiaUI\Notifications\Channels\InboxChannel;
use InertiaUI\Notifications\Console\CheckPushCommand;
use InertiaUI\Notifications\Console\InboxNotificationMakeCommand;
use InertiaUI\Notifications\Console\InstallCommand;
use InertiaUI\Notifications\Console\SendDigestsCommand;
use InertiaUI\Notifications\Console\TestPushCommand;
use InertiaUI\Notifications\Console\UnsnoozeCommand;
use InertiaUI\Notifications\Console\VapidCommand;
use InertiaUI\Notifications\Events\AnnouncementPublished;
use InertiaUI\Notifications\Http\Controllers\InboxController;
use InertiaUI\Notifications\Http\Controllers\PreferencesController;
use InertiaUI\Notifications\Http\Controllers\PushController;
use InertiaUI\Notifications\Http\Middleware\ShareInbox;
use InertiaUI\Notifications\Listeners\ApplyDeliveryRules;
use InertiaUI\Notifications\Listeners\ApplyNotificationPreferences;
use InertiaUI\Notifications\Listeners\ForgetPushDevice;
use InertiaUI\Notifications\Listeners\HoldForDigest;
use InertiaUI\Notifications\Testing\ResponseToasts;

class NotificationsServiceProvider extends ServiceProvider
{
    /**
     * Register the package's services.
     */
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__.'/../config/inertia-notifications.php', 'inertia-notifications');

        // Each application should start without the configuration callbacks, the fake, and the context
        // resolver that a previous application left behind, such as in tests, so we will flush the
        // state of the package's entry classes every time the services are registered.
        Toast::flushState();
        Inbox::flushState();
        NotificationPreferences::flushState();
        Announcement::flushState();
        Push::flushState();
    }

    /**
     * Bootstrap the package's services.
     */
    public function boot(): void
    {
        $this->registerResources();
        $this->registerPublishing();
        $this->registerCommands();
        $this->registerMiddleware();
        $this->registerResponseMacros();
        $this->registerInbox();
    }

    /**
     * Register the package's views.
     */
    protected function registerResources(): void
    {
        $this->loadViewsFrom(__DIR__.'/../resources/views', 'inertia-notifications');
    }

    /**
     * Register the package's publishable resources.
     */
    protected function registerPublishing(): void
    {
        if ($this->app->runningInConsole()) {
            $this->publishes([
                __DIR__.'/../config/inertia-notifications.php' => config_path('inertia-notifications.php'),
            ], 'inertia-notifications-config');

            $this->publishes([
                __DIR__.'/../resources/views' => resource_path('views/vendor/inertia-notifications'),
            ], 'inertia-notifications-views');

            $this->publishesMigrations([
                __DIR__.'/../database/migrations' => database_path('migrations'),
            ], 'inertia-notifications-migrations');
        }
    }

    /**
     * Register the package's Artisan commands.
     */
    protected function registerCommands(): void
    {
        if ($this->app->runningInConsole()) {
            $this->commands([
                InstallCommand::class,
                InboxNotificationMakeCommand::class,
                UnsnoozeCommand::class,
                SendDigestsCommand::class,
                VapidCommand::class,
                CheckPushCommand::class,
                TestPushCommand::class,
            ]);
        }
    }

    /**
     * Append the inbox middleware to the web group.
     */
    protected function registerMiddleware(): void
    {
        // Providers boot after the application has configured its middleware, so the middleware
        // we append to the web group here will run after the application's Inertia middleware.
        $this->callAfterResolving(Kernel::class, function (Kernel $kernel): void {
            if ($kernel instanceof HttpKernel && array_key_exists('web', $kernel->getMiddlewareGroups())) {
                $kernel->appendMiddlewareToGroup('web', ShareInbox::class);
            }
        });
    }

    /**
     * Register the notification center's channels, listeners, and route macro.
     */
    protected function registerInbox(): void
    {
        $this->registerInboxChannel();
        $this->registerListeners();
        $this->registerAnnouncementChannel();
        $this->registerRouteMacro();
    }

    /**
     * Register the "inbox" notification channel.
     */
    protected function registerInboxChannel(): void
    {
        $this->callAfterResolving(ChannelManager::class, function (ChannelManager $channels): void {
            $channels->extend('inbox', fn ($app): InboxChannel => $app->make(InboxChannel::class));
        });
    }

    /**
     * Register the listeners that apply the preferences, the delivery rules, and the digests.
     */
    protected function registerListeners(): void
    {
        Event::listen(NotificationSending::class, ApplyNotificationPreferences::class);
        Event::listen(NotificationSending::class, ApplyDeliveryRules::class);
        Event::listen([Login::class, Logout::class], ForgetPushDevice::class);

        // Digests hold the channels that every other rule lets through, so we will register this listener once
        // the application has booted, after the listeners that its providers register while they boot. Laravel
        // stops at the listener that holds a channel, so a listener registered after booting won't see it.
        $this->app->booted(function (): void {
            Event::listen(NotificationSending::class, HoldForDigest::class);
        });
    }

    /**
     * Register the broadcast channel of the published announcements.
     */
    protected function registerAnnouncementChannel(): void
    {
        // Every signed-in user may listen for published announcements, which hold no content.
        if (Inbox::broadcastsAnnouncements()) {
            Broadcast::channel(AnnouncementPublished::CHANNEL, fn (): bool => true);
        }
    }

    /**
     * Register the route macro that registers the notification center's routes.
     */
    protected function registerRouteMacro(): void
    {
        $registerWorkerRoute = $this->registerWorkerRoute(...);
        $registerOpenRoute = $this->registerOpenRoute(...);

        Route::macro('inertiaNotifications', function (
            string $prefix = '_inertia-notifications',
            array|string $middleware = ['auth'],
        ) use ($registerWorkerRoute, $registerOpenRoute): void {
            $registerWorkerRoute($prefix);
            $registerOpenRoute($prefix, $middleware);

            // Notifications and announcements have UUIDs, which the uuid columns of databases such as PostgreSQL
            // can't compare with other strings, so the routes of a notification only match a UUID.
            Route::prefix($prefix)
                ->middleware($middleware)
                ->name('inertia-notifications.')
                ->controller(InboxController::class)
                ->whereUuid('notification')
                ->group(function (): void {
                    Route::get('/', 'index')->name('index');
                    Route::get('counts', 'counts')->name('counts');
                    Route::post('seen', 'seen')->name('seen');
                    Route::post('seen/items', 'seenItems')->name('seen-items');
                    Route::post('read', 'readAll')->name('read-all');
                    Route::post('archive', 'archiveAll')->name('archive-all');
                    Route::post('batch', 'batch')->name('batch');
                    Route::post('pause', 'pause')->name('pause');
                    Route::post('resume', 'resume')->name('resume');
                    Route::get('preferences', [PreferencesController::class, 'show'])->name('preferences');
                    Route::post('preferences', [PreferencesController::class, 'update'])->name('preferences.update');
                    Route::post('push/subscribe', [PushController::class, 'subscribe'])->name('push.subscribe');
                    Route::post('push/unsubscribe', [PushController::class, 'unsubscribe'])->name('push.unsubscribe');
                    Route::get('push/devices', [PushController::class, 'devices'])->name('push.devices');
                    Route::post('push/devices/{device}/delete', [PushController::class, 'removeDevice'])
                        ->whereNumber('device')
                        ->name('push.devices.delete');
                    Route::post('{notification}/read', 'read')->name('read');
                    Route::post('{notification}/unread', 'unread')->name('unread');
                    Route::post('{notification}/archive', 'archive')->name('archive');
                    Route::post('{notification}/unarchive', 'unarchive')->name('unarchive');
                    Route::post('{notification}/snooze', 'snooze')->name('snooze');
                    Route::post('{notification}/unsnooze', 'unsnooze')->name('unsnooze');
                    Route::post('{notification}/delete', 'destroy')->name('delete');
                    Route::post('{notification}/complete', 'complete')->name('complete');
                    Route::post('{notification}/mute', 'mute')->name('mute');
                    Route::post('{notification}/unmute', 'unmute')->name('unmute');
                    Route::get('{notification}', 'show')->name('show');
                });
        });
    }

    /**
     * Register the route that serves the service worker, unless it is registered already.
     */
    protected function registerWorkerRoute(string $prefix): void
    {
        if (Route::has(Push::WORKER_ROUTE)) {
            return;
        }

        $path = trim($prefix, '/');

        // Browsers scope a service worker to the directory of its script and fetch the script outside
        // of the page, even while nobody is signed in, so we will serve it from one path outside of
        // any group. Under a team prefix, every team then shares the one worker of the browser.
        Route::getRoutes()->add(
            Route::newRoute(['GET', 'HEAD'], "{$path}/push/worker.js", [PushController::class, 'worker'])
                ->name(Push::WORKER_ROUTE)
        );
    }

    /**
     * Register the route that opens the notification of a push, unless it is registered already.
     */
    protected function registerOpenRoute(string $prefix, array|string $middleware): void
    {
        if (Route::has('inertia-notifications.open')) {
            return;
        }

        $path = trim($prefix, '/');

        // A push links to the route that opens its notification, and a queued job or a command builds that
        // link without the URL defaults that a request sets for a prefix such as the current team. So we will
        // register this route outside of any group as well, with the session and the given middleware. It finds
        // the user's notification in every context, so the push of one team opens while another team is current.
        Route::getRoutes()->add(
            Route::newRoute(['GET', 'HEAD'], "{$path}/{notification}/open", [InboxController::class, 'open'])
                ->name('inertia-notifications.open')
                ->middleware('web')
                ->middleware($middleware)
                ->whereUuid('notification')
        );
    }

    /**
     * Register the toast macros of the response classes.
     */
    protected function registerResponseMacros(): void
    {
        $this->registerFlashMacros();
        $this->registerHeaderMacros();

        if (class_exists(TestResponse::class)) {
            ResponseToasts::registerMacros();
        }
    }

    /**
     * Register the "toast" macros that flash a toast for the next page.
     */
    protected function registerFlashMacros(): void
    {
        $resolveToast = $this->resolveToast(...);

        RedirectResponse::macro('toast', function (
            Toast|string $title,
            ToastType|string $type = ToastType::Default,
        ) use ($resolveToast): RedirectResponse {
            /** @var RedirectResponse $this */
            $resolveToast($title, $type)->flash();

            return $this;
        });

        InertiaResponse::macro('toast', function (
            Toast|string $title,
            ToastType|string $type = ToastType::Default,
        ) use ($resolveToast): InertiaResponse {
            /** @var InertiaResponse $this */
            $resolveToast($title, $type)->flash();

            return $this;
        });
    }

    /**
     * Register the "withToasts" macros that send toasts in a response header.
     */
    protected function registerHeaderMacros(): void
    {
        $resolveToast = $this->resolveToast(...);

        foreach ([JsonResponse::class, Response::class] as $class) {
            $class::macro('withToasts', function (Toast|string ...$toasts) use ($resolveToast): JsonResponse|Response {
                /** @var JsonResponse|Response $this */
                $delivered = collect($toasts)
                    ->map(fn (Toast|string $item): array => $resolveToast($item)->deliver())
                    ->values()
                    ->all();

                ToastHeader::add($this, $delivered);

                return $this;
            });
        }
    }

    /**
     * Get the given toast, or make a toast with the given title and type.
     */
    protected function resolveToast(Toast|string $toast, ToastType|string $type = ToastType::Default): Toast
    {
        if ($toast instanceof Toast) {
            return $toast;
        }

        return Toast::make($toast, $type);
    }
}
