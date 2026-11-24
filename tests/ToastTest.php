<?php

use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Inertia\Inertia;
use InertiaUI\Notifications\InboxMessage;
use InertiaUI\Notifications\Tests\Fixtures\Team;
use InertiaUI\Notifications\Toast;
use InertiaUI\Notifications\ToastAction;
use InertiaUI\Notifications\ToastType;
use PHPUnit\Framework\ExpectationFailedException;

afterEach(function (): void {
    // Macros live in a static property that outlasts the application, so we will
    // flush them after each test to keep them out of the tests that follow.
    Toast::flushMacros();
});

it('delivers every toast flashed before a redirect, in order', function (): void {
    Route::middleware('web')->group(function (): void {
        Route::post('/profile', function () {
            Toast::success('Profile saved')
                ->description('Your changes are live.')
                ->flash();
            Toast::warning('Verify your new email address')
                ->persistent()
                ->flash();

            return back();
        });

        Route::get('/profile', fn () => Inertia::render('Profile'));
    });

    $this->withHeaders(['X-Inertia' => 'true']);

    $this->from('/profile')
        ->post('/profile')
        ->assertRedirect('/profile');

    $toasts = $this->get('/profile')
        ->assertOk()
        ->json('flash.inertiaui.toasts');

    expect($toasts)
        ->toHaveCount(2)
        ->and(Str::isUuid($toasts[0]['uuid']))
        ->toBeTrue()
        ->and($toasts[1]['uuid'])
        ->not->toBe($toasts[0]['uuid'])
        ->and(Arr::except($toasts[0], 'uuid'))
        ->toBe([
            'type' => 'success',
            'title' => 'Profile saved',
            'description' => 'Your changes are live.',
        ])
        ->and($toasts[1])
        ->toHaveKey('type', 'warning')
        ->toHaveKey('title', 'Verify your new email address')
        ->toHaveKey('duration', null);
});

it('flashes the toasts that the frontend tests read', function (): void {
    Route::middleware('web')->group(function (): void {
        Route::post('/teams/acme/requests', function () {
            Toast::info('Sophie asked to join Acme')
                ->id('join-request-7')
                ->description('She signed up with sophie@acme.test.')
                ->action('View profile', '/users/sophie')
                ->action(ToastAction::make('Copy email')->event('copy-email', ['email' => 'sophie@acme.test']))
                ->action(ToastAction::make('Approve')->post('/teams/acme/requests/7/approve')->result('Approved'))
                ->icon('user-plus')
                ->image('https://acme.test/avatars/sophie.jpg')
                ->dismissible(false)
                ->position('top-center')
                ->toaster('teams')
                ->with(['team' => 'Acme'])
                ->persistent()
                ->flash();

            return back();
        });

        Route::get('/teams/acme', fn () => Inertia::render('Team'));
    });

    $this->withHeaders(['X-Inertia' => 'true'])
        ->from('/teams/acme')
        ->post('/teams/acme/requests');

    $page = $this->get('/teams/acme');

    // Every toast has a new UUID, so we will compare it as the placeholder of the fixture, while its
    // key stays where the browser reads it. Decoded as objects, so an empty JSON object and an
    // empty array stay apart.
    $flash = json_decode(str_replace(
        $page->json('flash.inertiaui.toasts.0.uuid'),
        'toast-uuid',
        (string) $page->getContent(),
    ))->flash;
    $fixture = jsonFixture('toasts.json');

    expect($flash)->toEqual($fixture);
});

it('keeps other data flashed under its key', function (): void {
    config(['inertia-notifications.flash_key' => 'app']);

    Route::middleware('web')->group(function (): void {
        Route::post('/save', function () {
            Toast::success('Saved')->flash();
            Inertia::flash('app', [...Inertia::getFlashed()['app'], 'theme' => 'dark']);
            Toast::info('Synced')->flash();

            return back();
        });

        Route::get('/save', fn () => Inertia::render('Save'));
    });

    $this->withHeaders(['X-Inertia' => 'true'])
        ->from('/save')
        ->post('/save');

    $flash = $this->get('/save')
        ->json('flash.app');

    expect($flash['theme'])
        ->toBe('dark')
        ->and(array_column($flash['toasts'], 'title'))
        ->toBe(['Saved', 'Synced']);
});

it('replaces a value flashed under its key that is not a toast list', function (): void {
    config(['inertia-notifications.flash_key' => 'app']);

    Route::middleware('web')->group(function (): void {
        Route::post('/save', function () {
            Inertia::flash('app', 'not a toast list');
            Toast::success('Saved')->flash();

            return back();
        });

        Route::get('/save', fn () => Inertia::render('Save'));
    });

    $this->withHeaders(['X-Inertia' => 'true'])
        ->from('/save')
        ->post('/save');

    $flash = $this->get('/save')
        ->json('flash.app');

    expect(array_keys($flash))
        ->toBe(['toasts'])
        ->and(array_column($flash['toasts'], 'title'))
        ->toBe(['Saved']);
});

it('omits the duration and description unless they are set', function (): void {
    $default = Toast::info('Default')->toArray();
    $timed = Toast::info('Timed')
        ->duration(3000)
        ->toArray();

    expect($default)
        ->not->toHaveKeys(['duration', 'description'])
        ->and($timed)
        ->toHaveKey('duration', 3000);
});

it('lets the last call of duration() and persistent() decide the duration', function (): void {
    $pinned = Toast::info('Pinned')
        ->duration(3000)
        ->persistent()
        ->toArray();
    $timed = Toast::info('Timed again')
        ->persistent()
        ->duration(2000)
        ->toArray();

    expect($pinned)
        ->toHaveKey('duration', null)
        ->and($timed)
        ->toHaveKey('duration', 2000);
});

it('serializes the ID, actions, and display options the frontend reads', function (): void {
    $toast = Toast::loading('Importing contacts')
        ->id('import-7')
        ->action('View', '/imports/7')
        ->action(
            ToastAction::make('Cancel')
                ->delete('/imports/7', ['reason' => 'user'])
                ->preserveScroll()
                ->keepOpen(),
        )
        ->action(
            ToastAction::make('Download')
                ->url('/imports/7.csv')
                ->external()
                ->altText('Download it from the Imports page'),
        )
        ->action(ToastAction::make('Copy ID')->event('copy-import', ['id' => 7]))
        ->icon('upload')
        ->dismissible(false)
        ->position('top-center')
        ->toaster('uploads')
        ->toArray();

    expect(Arr::except($toast, 'uuid'))->toBe([
        'type' => 'loading',
        'title' => 'Importing contacts',
        'id' => 'import-7',
        'actions' => [
            ['label' => 'View', 'href' => '/imports/7'],
            [
                'label' => 'Cancel',
                'href' => '/imports/7',
                'method' => 'delete',
                'data' => ['reason' => 'user'],
                'visit' => ['preserveScroll' => true],
                'keepOpen' => true,
            ],
            [
                'label' => 'Download',
                'href' => '/imports/7.csv',
                'external' => true,
                'altText' => 'Download it from the Imports page',
            ],
            ['label' => 'Copy ID', 'event' => 'copy-import', 'payload' => ['id' => 7]],
        ],
        'icon' => 'upload',
        'dismissible' => false,
        'position' => 'top-center',
        'toaster' => 'uploads',
    ]);
});

it('sends the data of a toast as plain values, merged across calls', function (): void {
    $team = new Team(['name' => 'Acme', 'members' => 12]);

    $toast = Toast::make('Sophie invited you', 'invite')
        ->with(['team' => $team, 'role' => 'editor'])
        ->with(['role' => 'admin', 'expires' => Carbon::parse('2026-11-30 12:00:00', 'UTC')]);

    expect($toast->getData())
        ->toMatchArray(['team' => $team, 'role' => 'admin'])
        ->and($toast->toArray()['data'])
        ->toBe([
            'team' => ['name' => 'Acme', 'members' => 12],
            'role' => 'admin',
            'expires' => '2026-11-30T12:00:00.000000Z',
        ])
        ->and(Toast::info('Saved')->toArray())
        ->not->toHaveKey('data');
});

it('sends the image of a toast only when it is set', function (): void {
    $comment = Toast::info('Sophie Martin commented')
        ->image('https://example.com/sophie.jpg')
        ->toArray();

    expect($comment)
        ->toHaveKey('image', 'https://example.com/sophie.jpg')
        ->and(Toast::info('Saved')->toArray())
        ->not->toHaveKey('image');
});

it('sends the progress of a toast only when it is set', function (): void {
    $importing = Toast::loading('Importing contacts')
        ->id('import')
        ->progress(0.4)
        ->toArray();

    expect($importing)
        ->toHaveKey('progress', 0.4)
        ->and(Toast::loading('Exporting invoices')->toArray())
        ->not->toHaveKey('progress');
});

it('rejects an action without a URL or event', function (): void {
    Toast::info('Saved')
        ->action('Undo')
        ->toArray();
})->throws(LogicException::class, 'needs a URL or an event');

it('rejects an action that loads its URL in the browser with another method than GET', function (string $method, Closure $configure): void {
    $configure(ToastAction::make('Cancel'), $method)->toArray();
})
    ->with(['post', 'put', 'patch', 'delete'])
    ->with([
        'external after the method' => fn (ToastAction $action, string $method) => $action->{$method}('/imports/7', ['reason' => 'user'])->external(),
        'external before the method' => fn (ToastAction $action, string $method) => $action->external()->{$method}('/imports/7', ['reason' => 'user']),
        'a new tab after the method' => fn (ToastAction $action, string $method) => $action->{$method}('/imports/7', ['reason' => 'user'])->openUrlInNewTab(),
        'a new tab before the method' => fn (ToastAction $action, string $method) => $action->openUrlInNewTab()->{$method}('/imports/7', ['reason' => 'user']),
    ])
    ->throws(LogicException::class, 'only with GET');

it('loads a GET URL in the browser or a new tab, and visits other methods with Inertia', function (): void {
    $download = ToastAction::make('Download')
        ->url('/imports/7.csv')
        ->external()
        ->openUrlInNewTab();

    $cancel = ToastAction::make('Cancel')
        ->delete('/imports/7', ['reason' => 'user'])
        ->external(false)
        ->openUrlInNewTab(false);

    expect($download->toArray())
        ->toBe(['label' => 'Download', 'href' => '/imports/7.csv', 'external' => true, 'newTab' => true])
        ->and($cancel->toInboxArray())
        ->toMatchArray(['href' => '/imports/7', 'method' => 'delete', 'data' => ['reason' => 'user']])
        ->not->toHaveKeys(['external', 'newTab']);
});

it('rejects an unknown position', function (): void {
    Toast::info('Saved')->position('middle');
})->throws(InvalidArgumentException::class, '[middle] is not a valid toast position.');

it('takes a toast type by name', function (): void {
    $custom = Toast::make('Deployed', 'deployment')->toArray();
    $builtIn = Toast::make('Saved', 'success')->getType();

    expect($custom)
        ->toMatchArray(['type' => 'deployment'])
        ->and($builtIn)
        ->toBe(ToastType::Success);
});

it('rejects a type name the frontend would not accept', function (Closure $create): void {
    $create();
})
    ->with([
        'an uppercase letter' => fn () => Toast::make('Deployed', 'Deployment'),
        'a trailing newline' => fn () => Toast::info('Deployed')->type("deployment\n"),
    ])
    ->throws(InvalidArgumentException::class, 'not a valid toast type');

it('translates titles, descriptions, and action labels with replacements', function (): void {
    app('translator')->addLines([
        'invoices.sent' => 'Invoice :number sent',
        'invoices.sent_to' => 'Sent to :email',
        'invoices.view' => 'View :number',
    ], 'en');

    $toast = Toast::success('invoices.sent', ['number' => 'INV-7'])
        ->description('invoices.sent_to', ['email' => 'billing@acme.test'])
        ->action(ToastAction::make('invoices.view', ['number' => 'INV-7'])->url('/invoices/7'))
        ->toArray();

    expect($toast)
        ->toMatchArray(['title' => 'Invoice INV-7 sent', 'description' => 'Sent to billing@acme.test'])
        ->and($toast['actions'][0]['label'])
        ->toBe('View INV-7');
});

it('keeps a title without a translation as written', function (): void {
    $toast = Toast::info('No translation: keep as written')->toArray();

    expect($toast['title'])->toBe('No translation: keep as written');
});

it('leaves the text untranslated when translation is turned off', function (): void {
    // We will give the key a translation, so the title can only stay as it was
    // written because translation is turned off.
    app('translator')->addLines(['invoices.sent' => 'Invoice :number sent'], 'en');
    config(['inertia-notifications.translate' => false]);

    $toast = Toast::success('invoices.sent', ['number' => 'INV-7'])->toArray();

    expect($toast['title'])->toBe('invoices.sent');
});

it('applies the configured defaults to every new toast', function (): void {
    Toast::configureUsing(fn (Toast $toast) => $toast
        ->duration(9000)
        ->position('top-right'));

    $toast = Toast::success('Saved');
    $persistent = Toast::error('Failed')
        ->persistent()
        ->toArray();

    expect($toast->toArray())
        ->toMatchArray(['duration' => 9000, 'position' => 'top-right'])
        ->and($persistent)
        ->toHaveKey('duration', null);
});

it('resolves the toast class from the container', function (): void {
    app()->bind(Toast::class, BrandedToast::class);

    $toast = Toast::success('Saved');

    expect($toast)->toBeInstanceOf(BrandedToast::class);
});

it('records toasts for assertions while still flashing them', function (): void {
    $fake = Toast::fake();

    Route::middleware('web')->post('/save', function () {
        Toast::success('Saved')->flash();
        Toast::info('Synced')->flash();

        return back();
    });

    $this->from('/settings')
        ->post('/save')
        ->assertToast('Saved');

    Toast::assertFlashed('Saved');
    Toast::assertFlashed(fn (Toast $toast) => $toast->getType() === ToastType::Info, times: 1);
    Toast::assertNotFlashed('Deleted');

    expect($fake->flashed())->toHaveCount(2);
});

it('does not record a toast flashed without a session, such as in a queued job', function (): void {
    Toast::fake();

    Toast::success('Imported')->flash();

    Toast::assertNothingFlashed();
});

it('records a toast as it was flashed, without the changes made afterwards', function (): void {
    Toast::fake();

    Route::middleware('web')->post('/save', function () {
        Toast::success('Saved')
            ->flash()
            ->description('Changed after it was flashed.');

        return back();
    });

    $this->from('/settings')
        ->post('/save');

    Toast::assertFlashed(fn (Toast $toast): bool => $toast->getDescription() === null);
});

it('records the actions of a toast as they were flashed, without the changes made afterwards', function (): void {
    $fake = Toast::fake();

    Route::middleware('web')->post('/invite', function () {
        $action = ToastAction::make('View team');

        foreach (['/teams/1', '/teams/2'] as $url) {
            Toast::success('Invitation sent')
                ->action($action->url($url))
                ->flash();
        }

        return back();
    });

    $this->from('/teams')
        ->post('/invite');

    $urls = array_map(fn (Toast $toast): ?string => $toast->getActions()[0]->getUrl(), $fake->flashed());

    expect($urls)->toBe(['/teams/1', '/teams/2']);
});

it('explains a failed assertion on the fake', function (): void {
    Toast::fake();

    Route::middleware('web')->post('/save', function () {
        Toast::success('Saved')->flash();
        Toast::info('Synced')->flash();

        return back();
    });

    $this->from('/settings')
        ->post('/save');

    expect(fn () => Toast::assertNothingFlashed())
        ->toThrow(ExpectationFailedException::class, 'Flashed: [Saved], [Synced]')
        ->and(fn () => Toast::assertFlashed('Saved', times: 2))
        ->toThrow(ExpectationFailedException::class, 'flashed 2 times, but it was flashed 1 time.')
        ->and(fn () => Toast::assertNotFlashed('Synced'))
        ->toThrow(ExpectationFailedException::class);
});

it('starts each test without the fake or configured defaults of the previous one', function (): void {
    expect(fn () => Toast::assertNothingFlashed())
        ->toThrow(LogicException::class, 'Call Toast::fake()')
        ->and(Toast::info('Default')->toArray())
        ->not->toHaveKeys(['duration', 'position']);
});

class BrandedToast extends Toast {}

it('lets apps add macros to the toast builder', function (): void {
    Toast::macro('deployed', function (string $version): Toast {
        /** @var Toast $this */
        return $this->description("Version {$version} is live.");
    });

    $toast = Toast::success('Deployed')->deployed('2.4.0');

    expect($toast->toArray())->description->toBe('Version 2.4.0 is live.');
});

it('applies calls to the builders conditionally', function (): void {
    $toast = Toast::success('Deployed')->when(false, fn (Toast $toast) => $toast->persistent());
    $action = ToastAction::make('View')->unless(false, fn (ToastAction $action) => $action->url('/deploys/7'));
    $message = InboxMessage::make('Deployed')->when(true, fn (InboxMessage $message) => $message->url('/deploys/7'));

    expect($toast->toArray())->not->toHaveKey('duration');
    expect($action->toArray()['href'])->toBe('/deploys/7');
    expect($message->toArray()['url'])->toBe('/deploys/7');
});
