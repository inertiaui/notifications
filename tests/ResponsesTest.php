<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use InertiaUI\Notifications\Toast;
use InertiaUI\Notifications\ToastType;
use PHPUnit\Framework\ExpectationFailedException;

beforeEach(function (): void {
    Route::middleware('web')->group(function (): void {
        Route::post('/redirect', fn () => back()
            ->toast(Toast::warning('Storage almost full'))
            ->toast('Saved', ToastType::Success));
        Route::get('/render', fn () => Inertia::render('Page')->toast(Toast::info('Welcome back')));
        Route::post('/json', fn () => response()
            ->json(['ok' => true])
            ->withToasts(Toast::success('Copied'), 'Shared'));
        Route::delete('/no-content', fn () => response()
            ->noContent()
            ->withToasts(Toast::success('Deleted')));
        Route::get('/quiet', fn () => Inertia::render('Page'));
        Route::post('/queue', function () {
            Toast::success('Export queued')->flash();

            return response()->json(['ok' => true]);
        });
        Route::post('/queue/created', function () {
            Toast::success('Export queued')->flash();

            return response()->json([], 201);
        });
        Route::post('/queue/not-modified', function () {
            Toast::success('Export queued')->flash();

            return response('', 304);
        });
        Route::post('/queue/away', function () {
            Toast::success('Export queued')->flash();

            return Inertia::location('/render');
        });
        Route::post('/created', fn () => response()
            ->json([], 201)
            ->withToasts(Toast::success('Export created')));
        Route::post('/comments', fn () => redirect('/render#comments')
            ->toast('Comment posted', ToastType::Success));
    });
});

it('flashes toasts from redirect and Inertia response macros', function (): void {
    $this->from('/render')
        ->post('/redirect')
        ->assertRedirect('/render')
        ->assertToast('Storage almost full', ToastType::Warning)
        ->assertToast('Saved', 'success');

    $this->get('/render', ['X-Inertia' => 'true'])
        ->assertJsonPath('flash.inertiaui.toasts.*.title', ['Storage almost full', 'Saved', 'Welcome back']);
});

it('delivers the flashed toasts with a location response', function (): void {
    $this->post('/queue/away', [], ['X-Inertia' => 'true'])
        ->assertStatus(409)
        ->assertHeader('X-Inertia-Location')
        ->assertToast('Export queued');
});

it('delivers the flashed toasts with a redirect to a fragment', function (): void {
    $this->post('/comments', [], ['X-Inertia' => 'true'])
        ->assertStatus(409)
        ->assertHeader('X-Inertia-Redirect', 'http://localhost/render#comments')
        ->assertToast('Comment posted', ToastType::Success);
});

it('sends toasts in a header with JSON and empty responses', function (): void {
    $this->post('/json')
        ->assertOk()
        ->assertToast('Copied')
        ->assertToast('Shared', ToastType::Default);

    $this->post('/created')
        ->assertCreated()
        ->assertToast('Export created');

    $this->delete('/no-content')
        ->assertNoContent()
        ->assertToast('Deleted');

    $response = $this->post('/json');

    expect(json_decode($response->headers->get('X-InertiaUI-Toasts'), true))->toHaveCount(2);
});

it('finds toasts in the initial page and in Inertia JSON', function (): void {
    $this->get('/render')
        ->assertViewHas('page')
        ->assertToast('Welcome back');

    $this->get('/render', ['X-Inertia' => 'true'])
        ->assertToast(fn (array $toast) => $toast['type'] === 'info' && $toast['title'] === 'Welcome back');
});

it('asserts that a response delivered no toasts', function (): void {
    $this->get('/quiet', ['X-Inertia' => 'true'])
        ->assertNoToasts();
});

it('leaves toasts that stay in the session for a later page out of a response that leads to no page', function (string $uri, int $status): void {
    $this->postJson($uri)
        ->assertStatus($status)
        ->assertNoToasts();

    $this->get('/quiet', ['X-Inertia' => 'true'])
        ->assertToast('Export queued');

    $this->from('/render')->post('/redirect');

    $this->postJson($uri)->assertNoToasts();
})->with([
    'a JSON response' => ['/queue', 200],
    // Symfony counts a created response as a redirect, but without a location the browser goes nowhere.
    'a created JSON response' => ['/queue/created', 201],
    'a not modified response' => ['/queue/not-modified', 304],
]);

it('explains a failed toast assertion', function (): void {
    expect(fn () => $this->get('/render')->assertToast('Saved'))
        ->toThrow(
            ExpectationFailedException::class,
            'Expected the response to deliver a toast titled [Saved]. Delivered: [Welcome back] (info).',
        )
        ->and(fn () => $this->get('/render')->assertToast('Welcome back', ToastType::Error))
        ->toThrow(ExpectationFailedException::class, 'of type [error]')
        ->and(fn () => $this->get('/render')->assertNoToasts())
        ->toThrow(ExpectationFailedException::class, 'Delivered: [Welcome back]');
});
