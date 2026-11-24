<?php

namespace InertiaUI\Notifications\Tests\Fixtures;

use Illuminate\Notifications\Events\NotificationSending;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;

class ApplicationServiceProvider extends ServiceProvider
{
    /**
     * The channels that the application's own listener was asked about, in order.
     *
     * @var list<string>
     */
    public static array $sending = [];

    /**
     * Register any application services.
     */
    public function register(): void
    {
        static::$sending = [];
    }

    /**
     * Bootstrap any application services.
     *
     * Applications register their own listeners while their providers boot, after the package's provider.
     */
    public function boot(): void
    {
        Event::listen(NotificationSending::class, function (NotificationSending $event): void {
            static::$sending[] = $event->channel;
        });
    }
}
