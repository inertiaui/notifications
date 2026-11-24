<!-- Generated from docs/introduction.md with `pnpm docs:guide`. Edit the docs instead. -->

# Introduction

Inertia Notifications adds toasts, a notification center, and notification preferences to Laravel applications that use [Inertia.js](https://inertiajs.com). You may use it with Vue 3 or React 19. It's part of [Inertia UI](https://inertiaui.com), a suite of packages for Laravel, Inertia.js, and Tailwind CSS.

- [Toasts flashed from Laravel](toasts-flashing-from-laravel.md) with the `Toast` class, which use Inertia flash data, so they never show again when the user navigates back
- [Toasts from Vue or React](toasts-browser-toasts.md) with `toast()`, including promises and Inertia visits
- [Actions](toasts-actions.md) that visit a URL, send a request, dispatch a browser event, or run a callback
- [Descriptions, durations, progress bars, images, icons, positions](toasts-options.md), and IDs that replace an open toast
- Toasts from [JSON endpoints](toasts-json-endpoints.md), [error toasts](toasts-configuration.md#error-toasts) for failed requests, and a guide to [moving the toasts of the Laravel starter kits](toasts-flashing-from-laravel.md#starter-kit-toasts)
- [Custom toast types](toasts-custom-toasts.md), and toasts that stay usable [above modal dialogs](toasts-toaster.md#modal-dialogs)
- A [notification center](notification-center-setup.md) with a bell, an unread count, and a panel, fed by Laravel notifications through the `inbox` channel
- [Tabs, category filters, grouping, snoozing, muting, deleting, selecting](notification-center-component.md), and keyboard shortcuts in the panel
- A [notifications page](notification-center-notifications-page.md) with Inertia infinite scroll
- [Real-time updates](notification-center-real-time-updates.md) with Laravel Echo, or polling
- [Announcements](notification-center-announcements.md) to every user, including users who sign up later
- [Collapsing](notification-center-sending-notifications.md) the notifications about one thing, and [updating or retracting](notification-center-reading-and-changing.md) sent notifications
- [Desktop notifications, a sound](notification-center-browser-alerts.md), and unread counts in the tab title and on the app icon
- [Web push](notification-center-web-push.md) to phones and closed browsers, without extra packages, with commands that set it up and check it
- Notifications for each [team or tenant](notification-center-teams-and-tenants.md)
- [Notification preferences](preferences-setup.md) for each category and channel, saved as users change them
- [Hourly, daily, or weekly digest emails](preferences-digests.md) in the timezone of each user
- [Notification hours](preferences-notification-hours.md) for each day of the week, and [pausing](preferences-pausing.md) notifications until a time the user chooses
- [Translations](translations.md), [Tailwind CSS v4 theme tokens](styling.md), dark mode, custom markup, and keyboard and screen reader support
- Pest and PHPUnit helpers for testing [toasts](toasts-testing.md), the [notification center](notification-center-testing.md), and [preferences](preferences-testing.md)
- A Laravel Boost skill for AI coding agents
- The same features in Vue and React

## Quick Example

You may flash a toast from any controller. The `Toaster` component shows it after the next Inertia response:

```php
use App\Http\Requests\UpdateProfileRequest;
use InertiaUI\Notifications\Toast;

class ProfileController extends Controller
{
    public function update(UpdateProfileRequest $request)
    {
        $request->user()->update($request->validated());

        Toast::success('Profile saved')
            ->description('Your changes are live.')
            ->flash();

        return back();
    }
}
```

The notification center keeps Laravel notifications for users to read later. Its `NotificationCenter` component shows them in a panel under a bell that counts new notifications. A notification whose `via` method returns the `inbox` channel appears in the panel once you send it:

```php
$invoice = Invoice::find(1);

$invoice->user->notify(new InvoicePaid($invoice));
```

## Getting Started

The package has three parts:

- The `inertiaui/notifications` Composer package, with the `Toast` class and the `inbox` notification channel.
- The `@inertiaui/notifications-vue` package for Vue 3.
- The `@inertiaui/notifications-react` package for React 19.

Continue with the [requirements](requirements.md) and the [installation](installation.md).

## Free and Open Source

Inertia Notifications is free and open source under the MIT license, so you may use it in personal and commercial projects. Its source code is on [GitHub](https://github.com/inertiaui/notifications), where you may report issues and send pull requests. To support its development, you may [sponsor it on GitHub](https://github.com/sponsors/pascalbaljet).

## Other Inertia UI Packages

Inertia UI is built and maintained by [Pascal Baljet](https://pascalbaljet.dev). Its other packages work with the same stack:

- [Inertia Forms](https://inertiaui.com/inertia-forms) defines forms in PHP and renders them with one Vue or React component, with validation, file uploads, conditional fields, and multi-step flows. It's a commercial package.
- [Inertia Table](https://inertiaui.com/inertia-table) turns one PHP class into a data table with sorting, filtering, exports, saved views, and bulk actions, also across relationships. It's a commercial package.
- [Inertia Modal](https://inertiaui.com/inertia-modal/docs/introduction) turns any Laravel route into a modal or slideover with one component, including nested modals. It's free and open source.

Every Inertia UI package builds on [Inertia UI Vanilla](https://github.com/inertiaui/vanilla), our own lightweight library for dialogs, focus management, keyboard navigation, and positioning. The Vue and React packages have no dependencies on UI libraries such as Headless UI, Radix, Reka UI, or Floating UI, so both behave the same way, and a fix in Vanilla reaches every package at once. The PHP packages require nothing besides Laravel, Inertia, and other Inertia UI packages, and integrations such as Laravel Excel and Spatie Media Library stay optional.
