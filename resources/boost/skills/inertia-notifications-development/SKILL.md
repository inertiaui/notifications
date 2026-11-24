---
name: inertia-notifications-development
description: Build and work with inertiaui/notifications toasts and the notification center, including flashing toasts from Laravel, actions, replacing toasts by ID, toasts from JSON endpoints, browser toasts with toast(), promises, Inertia visit tracking, error toasts, the Toaster component, inbox notifications with InboxMessage, real-time notifications with Laravel Echo, the NotificationCenter and NotificationList components, snoozing, category filters, grouping, keyboard triage, announcements, browser alerts and desktop notifications, web push to the user's devices with InboxMessage push(), teams and tenants, notification preferences per category and channel, hourly, daily, and weekly digests, notification hours, pausing notifications, styling, and testing. Supports both React and Vue.
license: MIT
metadata:
  author: Inertia UI
---

# Inertia Notifications Development

## Overview
Use inertiaui/notifications to show toasts in Laravel + Inertia.js applications. Flash toasts in PHP with the `Toast` class; they travel in Inertia flash data under the `inertiaui` key and render in the `Toaster` component. Show toasts from the browser with `toast()`. Store Laravel notifications in the notification center with the `inbox` channel and show them with the `NotificationCenter` (bell and panel) and `NotificationList` (full page with Inertia infinite scroll) components. Works with React and Vue. Open source under the MIT license.

## When to Activate
- Activate when the user wants to confirm an action, report an error, show progress, offer undo, replace Laravel starter kit toasts, add a notification bell, inbox, or notifications page, publish announcements, show desktop notifications, send push notifications to phones and closed browsers, show each team's or tenant's own notifications, or let users snooze notifications, choose which notifications they receive, get a digest, choose the hours when notifications reach them, or pause their notifications for a while.

## Scope
- Out of scope: Laravel mail, SMS, or Slack notifications; confirmation dialogs (use Inertia UI Modal).

## Workflow
1. Identify the task (flash a toast, add an action, show progress, style the Toaster, write a test).
2. Open the reference file for the task from the list under References. Each file repeats one page of the docs, and its links lead to the other files.
3. Apply the patterns from the reference, using the correct framework (React or Vue).

## References

<!-- The list below is generated from the docs with `pnpm docs:guide`. Edit the docs instead. -->

### Getting Started

- [Introduction](references/introduction.md): Inertia Notifications is a free and open source package for toasts, a notification center, and notification preferences in Laravel + Inertia.js apps, with Vue and React components.
- [Requirements](references/requirements.md): Inertia Notifications requires PHP 8.3+, Laravel 12 or 13, Inertia Laravel 3.8+, Inertia.js 3.11+, Vue 3.5+ or React 19, and Tailwind CSS 4.3+.
- [Installation](references/installation.md): Install Inertia Notifications with Composer, add the Vue or React package from the vendor directory or npm, configure Tailwind CSS v4, and render the Toaster.

### Toasts

- [Flashing From Laravel](references/toasts-flashing-from-laravel.md): Flash toasts from Laravel with the Toast class, pass them to redirects and Inertia responses, and translate them. Learn how flashing works, type the flash data, and move the toasts of the Laravel starter kits to the package.
- [Toast Options](references/toasts-options.md): Give a toast a description, a duration, an ID that replaces an open toast, a progress bar, an image, data, an icon, and a position, and set defaults for every toast in a service provider.
- [Actions](references/toasts-actions.md): Add buttons to toasts that visit a URL with Inertia, send a POST, PUT, PATCH, or DELETE request, dispatch a browser event, or run a callback in Vue or React.
- [Browser Toasts](references/toasts-browser-toasts.md): Show toasts from Vue or React without a server request. Update and dismiss them, track promises and Inertia visits, and react to the reason a toast closed.
- [JSON Endpoints](references/toasts-json-endpoints.md): Show the toasts of a useHttp or fetch request, which returns JSON instead of an Inertia page, through the X-InertiaUI-Toasts response header.
- [Configuration](references/toasts-configuration.md): Configure the durations, the limit, the queue, and the error toasts of every toast with initNotifications().
- [The Toaster](references/toasts-toaster.md): The props of the Toaster component, how toasts stack, named Toasters, toasts above modal dialogs, and the keyboard and screen reader support of the built-in Toaster.
- [Custom Toasts](references/toasts-custom-toasts.md): Add toast types of your own, render the toasts of a type with your own Vue or React component, and render every toast yourself with useToasts().
- [Testing](references/toasts-testing.md): Record the toasts that your code flashes with Toast::fake() and assert on them in Pest or PHPUnit tests.

### Notification Center

- [Setup](references/notification-center-setup.md): Store Laravel notifications in an inbox and show them in a bell with a panel. Run the migration, add the HasInbox trait, register the routes, and render the bell.
- [Sending Notifications](references/notification-center-sending-notifications.md): Send Laravel notifications to the notification center with the inbox channel and an InboxMessage. Translate them, show a toast, wait for a read before sending other channels, send a notification once, and collapse the notifications about one thing.
- [Announcements](references/notification-center-announcements.md): Publish one message to every user in an audience, including users who sign up later, with an optional expiry and a read state per user.
- [Real-Time Updates](references/notification-center-real-time-updates.md): Show notifications the moment they are sent with Laravel broadcasting and Echo. Run code on arrival, throttle a category, share changes with other sessions, or poll the counts.
- [Component](references/notification-center-component.md): Place the panel of the NotificationCenter component, add tabs, filter by category, and group, snooze, mute, delete, select, and pause notifications. Listen for its events, change its labels, and use it with a keyboard or screen reader.
- [Custom Markup](references/notification-center-custom-markup.md): Replace the markup of each notification and of the other parts of the bell and the panel with Vue slots or React render props.
- [Notifications Page](references/notification-center-notifications-page.md): Show every notification on a page of its own with the NotificationList component and Inertia infinite scroll.
- [Browser Alerts](references/notification-center-browser-alerts.md): Reach users in other tabs and applications with an unread count in the tab title and on the app icon, desktop notifications, and a sound.
- [Web Push](references/notification-center-web-push.md): Show notifications on your users' devices while your application is closed, with web push in Chrome, Edge, Firefox, and Safari, without extra packages.
- [Teams and Tenants](references/notification-center-teams-and-tenants.md): Show only the notifications of the current team or tenant, including the teams of the Laravel starter kits, and listen on prefixed broadcast channels.
- [Custom Interfaces](references/notification-center-custom-interfaces.md): Build your own bell, panel, or buttons with the useNotifications() composable in Vue and hook in React, or call the JSON endpoints of the notification center yourself.
- [PHP API](references/notification-center-reading-and-changing.md): Read, count, and change a user's notifications in PHP with the HasInbox trait. Keep the results of actions, update or retract sent notifications, and import past ones.
- [Configuration](references/notification-center-configuration.md): The inbox options of the configuration file, the shared prop with the counts of the notification center, and pruning old notifications.
- [Testing](references/notification-center-testing.md): Assert on stored inbox notifications with the InteractsWithNotificationCenter trait in Pest or PHPUnit tests.

### Preferences

- [Setup](references/preferences-setup.md): Let users choose which categories of notifications they receive on each channel. Run the migration, list the categories and channels in the configuration, and render the NotificationPreferences component.
- [Categories and Channels](references/preferences-categories.md): Make categories opt-in, group them under headings, let users turn off a channel for every category, and see which notifications Laravel sends or skips.
- [Digests](references/preferences-digests.md): Let users receive a category of notifications in an hourly, daily, or weekly digest instead of one email at a time, in their own timezone. Schedule the command and change the digest mail.
- [Notification Hours](references/preferences-notification-hours.md): Let users choose the hours of each day when emails, toasts, and alerts reach them, while the notification center still shows each notification right away.
- [Pausing Notifications](references/preferences-pausing.md): Let users pause their notifications until a time they choose, such as for an hour or until tomorrow, while the notification center still shows each notification right away.
- [Component](references/preferences-component.md): Save each preference right away with the NotificationPreferences component, add classes to its parts, replace its markup with slots or render props, and change its labels.
- [Custom Forms](references/preferences-custom-forms.md): Build your own preferences form with the usePreferences() composable in Vue and hook in React, including digest frequencies, notification hours, and push notifications with usePush(), or call the JSON endpoints yourself.
- [PHP API](references/preferences-php.md): Read and save the preferences, digest frequencies, notification hours, and pause of a user in PHP, and listen for the events that the package dispatches when they change.
- [Testing](references/preferences-testing.md): Assert the preferences, digests, notification hours, and pause of a user with the InteractsWithNotificationCenter trait in Pest or PHPUnit tests.

### Advanced

- [Styling](references/styling.md): Change the colors, spacing, and markup of Inertia Notifications toasts with Tailwind CSS v4 theme tokens, part classes, data attributes, CSS variables, and a custom toast slot or render prop.
- [Icons](references/icons.md): Replace the built-in icons of the Toaster, the notification center, and the preferences, and resolve icon names from Laravel to Vue or React components with `setIconResolver()`.
- [Translations](references/translations.md): Translate the built-in text of the Toaster, the notification center, the preferences, and the error toasts with `setTranslations()`, using placeholders and functions for plurals.

<!-- End of the generated list. -->

## Core Concepts

### Flash a toast before a redirect
```php
use InertiaUI\Notifications\Toast;

Toast::success('Invoice sent')
    ->description('Sent to billing@acme.test.')
    ->flash();

return back();

// Or in one statement
return back()->toast(Toast::success('Invoice sent'));
```

### Action that sends a POST request with Inertia
```php
use InertiaUI\Notifications\ToastAction;

Toast::make('Message archived')
    ->action(ToastAction::make('Undo')
        ->post(route('messages.restore', $message))
        ->preserveScroll()
    )
    ->flash();
```

### Replace a toast across requests
```php
Toast::loading('Importing contacts…')
    ->id("import-{$import->id}")
    ->flash();
// later request
Toast::success('Contacts imported')
    ->id("import-{$import->id}")
    ->flash();
```

### Browser toasts
```ts
import { toast } from '@inertiaui/notifications-vue' // or '@inertiaui/notifications-react'

toast.success('Link copied')
toast.promise(save(), { loading: 'Saving…', success: 'Saved', error: 'Could not save' })
router.post('/invoices', form, toast.track({ loading: 'Saving…' }))
```

### Setup
Run `php artisan inertia-notifications:install` after `composer require`. It publishes the config and the migrations and lists the remaining steps for Vue or React.
```ts
// Entry point, before createInertiaApp()
initNotifications({ errorToasts: true })
```
Render one `<Toaster />` in a persistent layout.

### Notification center
```php
// Notification: send through the inbox channel
class InvoicePaid extends Notification
{
    public function via(object $notifiable): array
    {
        return ['inbox'];
    }

    public function toInbox(object $notifiable): InboxMessage
    {
        return InboxMessage::make('Invoice :number paid', ['number' => $this->invoice->number])
            ->body('Paid by card.')
            ->url(route('invoices.show', $this->invoice))
            ->action(ToastAction::make('Send receipt')->post(route('invoices.receipt', $this->invoice)))
            ->toast(ToastType::Success); // optional: also flash a toast to the current user
    }
}

// routes/web.php
Route::inertiaNotifications();

// A full page with every notification. Its tabs and category buttons link here with ?filter= and ?category=,
// which Inbox::page() reads. Pass other props along with it: [Inbox::page(), 'team' => $team].
Route::get('/notifications', fn () => Inertia::render('Notifications', Inbox::page()))->middleware('auth');
```
Generate a notification like this with `php artisan make:inbox-notification InvoicePaid`. Add `HasInbox` to the User model, publish and run the migration (`--tag=inertia-notifications-migrations`), render `<NotificationCenter href="/notifications" />` in the layout, and `<NotificationList data="notifications" />` on the page, which reads the filter and category from the URL. The list offers what the panel offers, from the same config: the bulk actions, pausing, tabs, category buttons, selection, seen tracking, and the "N new" button.

### Real-time updates
```php
// config/inertia-notifications.php: broadcast every notification that the notification center stores on the
// user's private channel, with the InboxNotificationArrived event, once the transaction that stored it commits
return [
    'inbox' => [
        'broadcast_notifications' => true,
    ],
];
```
```js
// app.js: Echo from @laravel/echo-vue or @laravel/echo-react, or () => window.Echo
initNotifications({ inbox: { echo } })

// Without broadcasting: poll the counts every 30 seconds while the tab is visible
initNotifications({ inbox: { poll: 30_000 } })
```
Set `inbox.broadcast_changes` to `true` to send reads and archives to the user's other devices with the `InboxChanged` event. Tabs of the same browser share changes without it. Set `inbox.broadcast_announcements` to `true` to show a published `Announcement` on the open pages of its audience right away.

### Snooze, categories, and grouping
```php
// routes/console.php: bring snoozed notifications back as new, unread ones
Schedule::command('inertia-notifications:unsnooze')->everyMinute();

// In CommentPosted::toInbox(): the same group key shows as one notification with a "Show 2 more" button
$issue = $this->comment->issue;
$name = $this->comment->author->name;

return InboxMessage::make(':name commented on issue #:number', ['name' => $name, 'number' => $issue->number])
    ->category('comments')
    ->group("issue:{$issue->id}");
```
```php
// config/inertia-notifications.php: what users may do and which tabs and buttons the panel shows live in the config, not in props
return [
    'inbox' => [
        'actions' => ['snooze', 'archive', 'mute'], // add 'delete' to let users delete notifications
        'selectable' => true, // false hides the checkboxes and the selection bar of the panel and the list, and POST /batch answers 404
        'category_filter' => ['comments', 'review' => 'Reviews'], // category buttons with the labels of the preferences or their own, or true for all
    ],
];
```
The panel has All, Unread, Snoozed, and Archived tabs, without those of actions that `inbox.actions` leaves out, whose endpoints answer 404. J and K move between notifications; U, E, and H toggle read, archived, and snoozed on the focused one, X selects it, and Enter opens it.

### Preferences per category and channel
```php
// config/inertia-notifications.php

return [
    'preferences' => [
        'channels' => [
            'inbox' => ['label' => 'In the app', 'via' => ['inbox', 'database', 'broadcast']],
            'mail' => ['label' => 'Email', 'via' => ['mail']],
        ],
        'categories' => [
            'comments' => ['label' => 'Comments'],
            'security' => ['label' => 'Security', 'locked' => true],
        ],
    ],
];
```
Render `<NotificationPreferences />` on a settings page. The package skips each channel that a user turned off for the notification's category, in Laravel's `NotificationSending` event. The category comes from `notificationCategory()` on the notification, or else from `toInbox()->category()`.

### Testing
```php
Toast::fake();
$this->post('/invoices', $data)
    ->assertRedirect()
    ->assertToast('Invoice sent');
Toast::assertFlashed('Invoice sent');

// The InteractsWithNotificationCenter trait on the base TestCase asserts on stored notifications.
// Do not call Notification::fake() in these tests: it keeps the inbox channel from storing anything.
$this->assertInboxMessage($user, 'Invoice INV-7 paid');
$this->assertMarkedRead($user, 'Invoice INV-7 paid');
$this->assertPreferenceSet($user, 'billing', 'mail', enabled: false);
```

## Rules
- Call `->flash()` on toasts built with `Toast::...`. The `->toast()` macros flash on their own; do not call `->flash()` on toasts passed to them as well.
- Use `->id()` only to replace a toast on purpose. Each flashed toast already shows once without an ID.
- Loading toasts, error toasts, and toasts with actions stay open until dismissed or replaced, unless every action has an `altText` that tells where else to do the same. Make sure what an action does is also possible elsewhere in the app.
- Do not show validation errors as toasts; show them next to the fields.
- With the opt-in `AddFlashedToastsToResponseHeaders` middleware in the web group before Inertia's middleware, a request through Inertia's HTTP client or `useHttp` that renders no page receives the toasts of `Toast::...->flash()` in the `X-InertiaUI-Toasts` header. A plain `fetch()` does not get them: add the toasts to the response with `->withToasts()` and show them with `toast.fromHeaders(response.headers)`.
- To type `page.flash`, add `InertiaUIFlashData` to the app's own `flashDataType`. The package does not declare `flashDataType`, so declare it once, in the app.
- For a type of your own, pass its name as the type, such as `Toast::make('Deployed', 'deployment')` or `toast('Deployed', { type: 'deployment' })`, and give the `Toaster` an icon and a label for it with the `icons` and `typeLabels` props. Names start with a lowercase letter and use lowercase letters, digits, and dashes.
- Prefer the `Toaster`'s `toast` slot (Vue) or `renderToast` prop (React) for custom toast markup; it keeps the keyboard support and screen reader announcements. Use `useToasts()` only for a Toaster rendered entirely by the app.
- Do not build a custom scroll loader for the notifications page; `NotificationList` uses Inertia's `InfiniteScroll` with the `notifications` prop of `Inbox::page()`.
- Keep `inbox.shared_prop` a top-level key, and pass the same name to `initNotifications({ inbox: { prop } })` when you change it.
- For real-time notifications, set `inbox.broadcast_notifications` to `true`; do not add `broadcast` to `via()` for them. Do not write your own Echo listener for them; pass Echo to `initNotifications({ inbox: { echo } })`. A notification's own `broadcast` channel, with its own `toBroadcast()`, stays the application's, and the package leaves it alone.
- Do not configure Echo a second time for the package: it listens on the Echo instance the application already set up.
- Do not filter notifications by preference in `via()` yourself; list the categories in the `preferences` config and let the package skip disabled channels. Keep `toInbox()` free of side effects, because the preference check calls it.
- Mark security and other required notifications as `locked` instead of leaving them out of the config, so the preferences page shows them as always on.
