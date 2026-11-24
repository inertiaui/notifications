<?php

use App\Notifications\DemoNotification;
use App\Notifications\LifecycleNotification;
use App\Notifications\DigestDemoNotification;
use Illuminate\Http\Request;
use Illuminate\Notifications\Events\NotificationSent;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Illuminate\Validation\ValidationException;
use InertiaUI\Notifications\Announcement;
use InertiaUI\Notifications\Digest;
use InertiaUI\Notifications\Inbox;
use InertiaUI\Notifications\Models\DigestItem;
use InertiaUI\Notifications\Notifications\NotificationDigest;
use InertiaUI\Notifications\Toast;
use InertiaUI\Notifications\ToastAction;

Route::get('/', fn () => Inertia::render('Home'));

// Inertia ignores the flash data of the request that loads deferred props; the toast still shows.
Route::get('/deferred', fn () => Inertia::render('Home', [
    'report' => Inertia::defer(function () {
        Toast::info('Report ready')->description('Flashed while loading a deferred prop.')->flash();

        return 'ready';
    }),
]));

// A page without a Toaster: toasts flashed here wait until a page with one renders.
Route::get('/bare', fn () => Inertia::render('Bare'));

// A page whose Toaster is built with useToasts() instead of the package's Toaster.
Route::get('/custom-toaster', fn () => Inertia::render('CustomToaster'));

Route::post('/toasts', function (Request $request) {
    $scenario = $request->validate([
        'scenario' => ['required', 'in:success,info,warning,error,persistent,multiple,action,undo,deployment'],
    ])['scenario'];

    match ($scenario) {
        'success' => Toast::success('Profile saved')->description('Your changes are live.')->flash(),
        'info' => Toast::info('New version available')->description('Reload the page to get the latest features.')->flash(),
        'warning' => Toast::warning('Storage almost full')->description('You have used 90% of your quota.')->flash(),
        'error' => Toast::error('Payment failed')->description('Your card was declined.')->flash(),
        'persistent' => Toast::make('Export queued')->description('This toast stays until you dismiss it.')->persistent()->flash(),
        'multiple' => [
            Toast::success('Invoice sent')->flash(),
            Toast::info('A copy was sent to your email')->flash(),
        ],
        'action' => Toast::success('Invoice sent')->description('Sent to billing@acme.test.')->action('View invoice', '/welcome')->flash(),
        'undo' => Toast::make('Message archived')
            ->action(ToastAction::make('Undo')->post('/messages/restore')->preserveScroll())
            ->flash(),
        // A custom type: the Toaster in the layout has an icon, a label, and a color for it.
        'deployment' => Toast::make('Deployed to production', 'deployment')->description('Version 2.4.0 is live.')->flash(),
    };

    return back();
});

// A plain link to this route loads the app from scratch, with the toast in the initial page.
Route::get('/welcome', function () {
    Toast::success('Welcome back')->description('You are signed in.')->flash();

    return redirect('/');
});

Route::post('/messages/restore', function () {
    usleep(400_000);

    return back()->toast(Toast::success('Message restored'));
});

// The second request replaces the first toast in place, because both use the same ID.
Route::post('/imports', fn () => back()->toast(Toast::loading('Importing contacts…')->id('import')->description('This takes a few seconds.')));

Route::post('/imports/finish', fn () => back()->toast(
    Toast::success('Contacts imported')->id('import')->description('1,204 contacts were added.')->action('View contacts', '/'),
));

// A JSON endpoint for useHttp: the toast travels in a response header.
Route::post('/api/archive', function () {
    Toast::success('Archived from a JSON endpoint')
        ->description('Sent in a response header.')
        ->flash();

    return response()->json(['archived' => true]);
});

Route::post('/slow', function (Request $request) {
    usleep(600_000);

    if ($request->boolean('fail')) {
        throw ValidationException::withMessages(['name' => 'The name field is required.']);
    }

    return back();
});

// Failed requests show error toasts, because the demo enables them in initNotifications().
Route::post('/errors/{status}', fn (int $status) => abort($status));

// The JSON endpoints of the notification center. Every demo request is signed in as the demo user.
Route::inertiaNotifications();

// A full page of notifications, loaded page by page with Inertia's infinite scroll. Its tabs and category
// buttons link to this page with the filter and category in the query string, which Inbox::page() reads.
Route::get('/inbox', fn () => Inertia::render('Inbox', Inbox::page()));

// The tab title count and the other alerts that reach users outside the page.
Route::get('/alerts', fn () => Inertia::render('Alerts'));

// More ways to use the notification center, such as bells that open their panel on another side.
Route::get('/notification-center', fn () => Inertia::render('NotificationCenterDemo'));

// The categories and channels of notifications that the demo user turns on and off.
Route::get('/preferences', fn () => Inertia::render('Preferences'));

// The same preferences in a form built with usePreferences(), and the component with classes and slots.
Route::get('/preferences/custom', fn () => Inertia::render('CustomPreferences'));

Route::post('/notifications', function (Request $request) {
    $scenario = $request->validate([
        'scenario' => ['required', 'in:'.implode(',', [...DemoNotification::SCENARIOS, 'many', 'replies'])],
    ])['scenario'];

    if ($scenario === 'many') {
        DemoNotification::fill($request->user(), 30);
    } elseif ($scenario === 'replies') {
        foreach (['Sophie Martin', 'Maria Garcia', 'Noah Fischer'] as $actor) {
            $request->user()->notify(new DemoNotification('comment', 42, $actor));
        }
    } else {
        $request->user()->notify(new DemoNotification($scenario, random_int(2, 99)));
    }

    return back();
});

// Announcements are stored once and show in the notification center of every user, also those who sign up later.
Route::post('/announcements', function (Request $request) {
    $scenario = $request->validate([
        'scenario' => ['required', 'in:maintenance,expiring'],
    ])['scenario'];

    match ($scenario) {
        'maintenance' => Announcement::make('Scheduled maintenance on Sunday')
            ->body('The app is read-only from 02:00 to 03:00 UTC.')
            ->action('Status page', '/notification-center')
            ->publish(),
        'expiring' => Announcement::make('Live Q&A starts soon')
            ->body('This announcement leaves every inbox in one minute.')
            ->expiresAt(now()->addMinute())
            ->publish(),
    };

    return back();
});

Route::post('/receipts', function () {
    usleep(400_000);

    return back()->toast(Toast::success('Receipt sent'));
});

// The toast features of the More toasts page.
Route::get('/more-toasts', fn () => Inertia::render('MoreToasts'));

Route::post('/more-toasts', function (Request $request) {
    $scenario = $request->validate([
        'scenario' => ['required', 'in:invite,import,comment'],
    ])['scenario'];

    match ($scenario) {
        // The Toaster in the layout renders this type with a component that reads the data.
        'invite' => Toast::make('Sophie invited you to Acme', 'invite')
            ->with(['inviter' => 'Sophie', 'team' => 'Acme', 'role' => 'Editor', 'members' => 12])
            ->action('View team', '/more-toasts')
            ->flash(),
        'import' => Toast::loading('Importing contacts…')
            ->id('import-progress')
            ->description('480 of 1,204 contacts')
            ->progress(0.4)
            ->flash(),
        // The avatar shows in place of the icon.
        'comment' => Toast::info('Sophie Martin commented')
            ->description('Looks great, ship it!')
            ->image('/avatars/sophie.svg')
            ->flash(),
    };

    return back();
});

// toast.track() fills the loading toast from the upload progress while the file uploads.
Route::post('/more-toasts/upload', function () {
    usleep(1_500_000);

    return back();
});

// The Lifecycle page: notifications that change after they were sent.
Route::get('/lifecycle', fn () => Inertia::render('Lifecycle'));

Route::post('/lifecycle', function (Request $request) {
    $scenario = $request->validate([
        'scenario' => ['required', 'in:'.implode(',', LifecycleNotification::SCENARIOS)],
    ])['scenario'];

    // The build has a once() key, so the demo retracts the previous build before it sends another.
    if ($scenario === 'build') {
        Inbox::retract(LifecycleNotification::BUILD, $request->user());
    }

    // Everyone comments on the pull request, and the comments collapse into one notification.
    if ($scenario === 'comment') {
        foreach (array_keys(LifecycleNotification::COMMENTERS) as $author) {
            $request->user()->notify(new LifecycleNotification($scenario, $author));
        }

        return back();
    }

    $request->user()->notify(new LifecycleNotification($scenario));

    return back();
});

Route::post('/lifecycle/build/pass', function (Request $request) {
    Inbox::update(LifecycleNotification::BUILD, LifecycleNotification::buildPassed(), $request->user());

    return back();
});

Route::post('/lifecycle/build/retract', function (Request $request) {
    Inbox::retract(LifecycleNotification::BUILD, $request->user());

    return back();
});

// The buttons of the approval request, which keep their result once the request succeeded.
Route::post('/lifecycle/expenses/{expense}/{decision}', function () {
    usleep(300_000);

    return back();
})->whereIn('decision', ['approve', 'decline']);

// Digests: the mail of the categories that the demo user receives daily or weekly waits for their digest.
Route::get('/digests', fn (Request $request) => Inertia::render('Digests', [
    'held' => Digest::query($request->user())->orderBy('created_at')->orderBy('id')->get()->map(fn (DigestItem $item) => [
        'id' => $item->id,
        'title' => (new NotificationDigest([$item->toDigestArray()]))->messages()[0]['title'],
        'category' => $item->category,
        'sendAt' => $item->send_at->toIso8601String(),
    ]),
    'digest' => session('digest'),
]));

Route::post('/digests/notifications', function (Request $request) {
    $scenario = $request->validate([
        'scenario' => ['required', 'in:'.implode(',', DigestDemoNotification::SCENARIOS)],
    ])['scenario'];

    $request->user()->notify(new DigestDemoNotification($scenario, random_int(2, 99)));

    return back();
});

// Sends the held notifications now, as if their digest were due, and shows the mail of the digest.
Route::post('/digests/send', function (Request $request) {
    $digest = null;

    Event::listen(NotificationSent::class, function (NotificationSent $event) use (&$digest) {
        if ($event->notification instanceof NotificationDigest) {
            $digest = (string) $event->notification->toMail($event->notifiable)->render();
        }
    });

    Digest::query($request->user())->update(['send_at' => now()]);
    Digest::sendDue();

    return back()->with('digest', $digest);
});
