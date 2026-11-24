<?php

use Illuminate\Contracts\Http\Kernel;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Inertia\Middleware;
use InertiaUI\Notifications\Http\Middleware\AddFlashedToastsToResponseHeaders;
use InertiaUI\Notifications\Toast;

beforeEach(function (): void {
    // Applications opt in by adding the middleware to the web group before Inertia's middleware.
    $kernel = $this->app->make(Kernel::class);
    $groups = $kernel->getMiddlewareGroups();
    array_splice($groups['web'], array_search(Middleware::class, $groups['web'], true), 0, [AddFlashedToastsToResponseHeaders::class]);
    $kernel->setMiddlewareGroups($groups);

    Route::middleware('web')->group(function (): void {
        Route::post('/save', function () {
            Toast::success('Saved')->flash();

            return back();
        });

        Route::get('/page', fn () => Inertia::render('Page'));
        Route::get('/other', fn () => Inertia::render('Other'));
    });
});

/**
 * Get the headers of an Inertia request with the given extra headers.
 *
 * @param  array<string, string>  $headers
 * @return array<string, string>
 */
function inertiaHeaders(array $headers = []): array
{
    return ['X-Inertia' => 'true', ...$headers];
}

it('sends toasts flashed by a request from the frontend that renders no page in a header', function (): void {
    Route::middleware('web')->post('/api/archive', function () {
        Toast::success('Archived')
            ->description('Moved to the archive — undo from there.')
            ->flash();

        return response()->json(['ok' => true]);
    });

    $response = $this->post('/api/archive', [], ['X-InertiaUI-Toasts' => '1'])
        ->assertOk();

    $header = $response->headers->get('X-InertiaUI-Toasts');

    // The default JSON flags escape non-ASCII characters, so the header stays valid.
    expect($header)
        ->toContain('\u2014')
        ->and(array_column(json_decode($header, true), 'title'))
        ->toBe(['Archived']);

    // The toast sent in the header is not shown a second time.
    $this->get('/page', inertiaHeaders())
        ->assertJsonMissingPath('flash');
});

it('sends toasts that an earlier request flashed for the next page in the header too', function (): void {
    Route::middleware('web')->get('/api/count', fn () => response()->json(['count' => 3]));

    // The browser has not made its next request after the redirect yet.
    $this->from('/page')
        ->post('/save')
        ->assertRedirect('/page');

    $response = $this->get('/api/count', ['X-InertiaUI-Toasts' => '1'])
        ->assertOk();

    expect(array_column(json_decode($response->headers->get('X-InertiaUI-Toasts'), true), 'title'))
        ->toBe(['Saved']);

    $this->get('/page', inertiaHeaders())
        ->assertJsonMissingPath('flash');
});

it('lets the other flash data age out when it moves the toasts to the header', function (): void {
    Route::middleware('web')->group(function (): void {
        Route::post('/welcome', function () {
            Inertia::flash('inertiaui', ['theme' => 'dark']);
            Inertia::flash('banner', 'Welcome back');
            Toast::success('Saved')->flash();

            return back();
        });

        Route::get('/api/count', fn () => response()->json(['count' => 3]));
    });

    $this->from('/page')
        ->post('/welcome')
        ->assertRedirect('/page');

    $response = $this->get('/api/count', ['X-InertiaUI-Toasts' => '1'])
        ->assertOk();

    expect(array_column(json_decode($response->headers->get('X-InertiaUI-Toasts'), true), 'title'))
        ->toBe(['Saved']);

    // Like any flash data, the theme and the banner last for one request after the redirect.
    $this->get('/page', inertiaHeaders())
        ->assertJsonMissingPath('flash');
});

it('leaves the flash data alone when a request from the frontend flashes no toasts', function (): void {
    config(['inertia-notifications.flash_key' => 'app']);

    Route::middleware('web')->group(function (): void {
        Route::post('/theme', function () {
            Inertia::flash('app', ['theme' => 'dark']);

            return back();
        });

        Route::get('/api/count', fn () => response()->json(['count' => 3]));
    });

    $this->from('/page')
        ->post('/theme')
        ->assertRedirect('/page');

    $this->get('/api/count', ['X-InertiaUI-Toasts' => '1'])
        ->assertOk()
        ->assertHeaderMissing('X-InertiaUI-Toasts');

    // Like any flash data, the theme lasts for one request after the redirect.
    $this->get('/page', inertiaHeaders())
        ->assertJsonMissingPath('flash');
});

it('keeps toasts flashed by a request without the header for the next page', function (): void {
    Route::middleware('web')->post('/api/legacy', function () {
        Toast::success('Archived')->flash();

        return response()->json(['ok' => true]);
    });

    $this->post('/api/legacy')
        ->assertOk()
        ->assertHeaderMissing('X-InertiaUI-Toasts');

    $response = $this->get('/page', inertiaHeaders());

    expect($response->json('flash.inertiaui.toasts.*.title'))->toBe(['Archived']);
});

it('keeps toasts flashed by an Inertia request that returns nothing for the page Inertia redirects back to', function (): void {
    Route::middleware('web')->post('/archive', function (): void {
        Toast::success('Archived')->flash();
    });

    $this->from('/page')
        ->post('/archive', [], inertiaHeaders(['X-InertiaUI-Toasts' => '1']))
        ->assertRedirect('/page')
        ->assertHeaderMissing('X-InertiaUI-Toasts');

    $first = $this->get('/page', inertiaHeaders());
    $second = $this->get('/page', inertiaHeaders());

    expect($first->json('flash.inertiaui.toasts.*.title'))
        ->toBe(['Archived'])
        ->and($second->json('flash'))
        ->toBeNull();
});

it('keeps toasts flashed by a request that returns a location response for the next page', function (): void {
    Route::middleware('web')->post('/export', function () {
        Toast::success('Export ready')->flash();

        return Inertia::location('/other');
    });

    $this->post('/export', [], inertiaHeaders(['X-InertiaUI-Toasts' => '1']))
        ->assertStatus(409)
        ->assertHeader('X-Inertia-Location')
        ->assertHeaderMissing('X-InertiaUI-Toasts');

    $page = $this->get('/other')
        ->assertOk()
        ->viewData('page');

    expect(array_column($page['flash']['inertiaui']['toasts'], 'title'))->toBe(['Export ready']);
});

it('keeps toasts flashed by a request that redirects to a URL with a fragment for the next page', function (): void {
    Route::middleware('web')->post('/sections', function () {
        Toast::success('Section added')->flash();

        return redirect('/page#section');
    });

    // Inertia's middleware turns the redirect into a conflict response that the client follows.
    $this->post('/sections', [], inertiaHeaders(['X-InertiaUI-Toasts' => '1']))
        ->assertStatus(409)
        ->assertHeader('X-Inertia-Redirect')
        ->assertHeaderMissing('X-InertiaUI-Toasts');

    $this->get('/page', inertiaHeaders())
        ->assertJsonPath('flash.inertiaui.toasts.0.title', 'Section added');
});

it('sends toasts flashed by a request that returns a conflict without a location in a header', function (): void {
    Route::middleware('web')->post('/api/rename', function () {
        Toast::error('The name is taken')->flash();

        return response()->json(['message' => 'The name is taken.'], 409);
    });

    $response = $this->post('/api/rename', [], ['X-InertiaUI-Toasts' => '1'])
        ->assertStatus(409);

    expect(array_column(json_decode($response->headers->get('X-InertiaUI-Toasts'), true), 'title'))
        ->toBe(['The name is taken']);

    $this->get('/page', inertiaHeaders())
        ->assertJsonMissingPath('flash');
});

it('keeps toasts flashed by a request for an outdated asset version that renders no page', function (): void {
    Route::middleware('web')->get('/api/report', function () {
        Toast::success('Report ready')->flash();

        return response()->json(['ok' => true]);
    });

    $this->get('/api/report', inertiaHeaders(['X-Inertia-Version' => 'stale', 'X-InertiaUI-Toasts' => '1']))
        ->assertStatus(409)
        ->assertHeader('X-Inertia-Location')
        ->assertHeaderMissing('X-InertiaUI-Toasts');

    $page = $this->get('/page')
        ->assertOk()
        ->viewData('page');

    expect(array_column($page['flash']['inertiaui']['toasts'], 'title'))->toBe(['Report ready']);
});

it('keeps toasts in flash data when the request renders a page or redirects', function (): void {
    $this->post('/save', [], ['X-InertiaUI-Toasts' => '1', 'X-Inertia' => 'true'])
        ->assertRedirect()
        ->assertHeaderMissing('X-InertiaUI-Toasts');

    $this->get('/page', inertiaHeaders(['X-InertiaUI-Toasts' => '1']))
        ->assertHeaderMissing('X-InertiaUI-Toasts')
        ->assertJsonPath('flash.inertiaui.toasts.0.title', 'Saved');
});
