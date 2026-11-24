<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\URL;
use Inertia\Inertia;
use InertiaUI\Notifications\Http\Controllers\PushController;
use InertiaUI\Notifications\Inbox;
use InertiaUI\Notifications\Testing\InteractsWithNotificationCenter;
use InertiaUI\Notifications\Tests\Fixtures\InvoicePaid;
use InertiaUI\Notifications\Tests\Fixtures\User;

uses(InteractsWithNotificationCenter::class);

beforeEach(function (): void {
    // The routes sit under the prefix of the current team, as in the starter kits, behind
    // middleware that a browser fetching the service worker can't pass, such as `signed`.
    Route::middleware('web')->group(function (): void {
        Route::prefix('{current_team}')
            ->middleware('signed')
            ->group(fn () => Route::inertiaNotifications());

        Route::get('/dashboard', fn () => Inertia::render('Dashboard'));
    });

    enablePush();
});

it('serves the service worker outside the prefix and the middleware around the routes', function (): void {
    // The kits set the URL default of the current team in a middleware of each request.
    URL::defaults(['current_team' => 'acme']);

    $hash = hash_file('xxh3', __DIR__.'/../resources/push/worker.js');

    $this->actingAs(User::named('Pascal'))
        ->get('/dashboard', ['X-Inertia' => 'true'])
        ->assertJsonPath('props.inertiauiInbox.push.worker', "/_inertia-notifications/push/worker.js?v={$hash}");

    $this->get("/_inertia-notifications/push/worker.js?v={$hash}")
        ->assertOk()
        ->assertHeader('Content-Type', 'text/javascript; charset=utf-8');
});

it('keeps the other push routes under the prefix around the routes', function (): void {
    URL::defaults(['current_team' => 'acme']);

    expect(route('inertia-notifications.push.subscribe', absolute: false))
        ->toBe('/acme/_inertia-notifications/push/subscribe')
        ->and(route('inertia-notifications.push.unsubscribe', absolute: false))
        ->toBe('/acme/_inertia-notifications/push/unsubscribe');
});

it('registers the service worker once when the routes are registered more than once', function (): void {
    Route::inertiaNotifications('admin/notifications');

    $workers = collect(Route::getRoutes()->getRoutes())
        ->filter(fn ($route): bool => $route->getActionName() === PushController::class.'@worker')
        ->map(fn ($route): string => $route->uri())
        ->values()
        ->all();

    expect($workers)->toBe(['_inertia-notifications/push/worker.js']);
});

it('opens a push outside the prefix and the middleware around the routes, as a queued job knows no current team', function (): void {
    $this->fakePush();

    $user = User::named('Pascal');

    $this->createPushSubscription($user);

    $user->notify(new InvoicePaid(push: true));

    $stored = Inbox::query($user)->sole();

    $this->assertPushed($user, fn (array $push): bool => $push['navigate'] === "http://localhost/_inertia-notifications/{$stored->id}/open");

    expect(Route::getRoutes()->getByName('inertia-notifications.open')->gatherMiddleware())->toBe(['web', 'auth']);

    $this->actingAs($user)
        ->get("/_inertia-notifications/{$stored->id}/open")
        ->assertRedirect('http://localhost/invoices/7');

    expect($stored->refresh()->isRead())->toBeTrue();
});
