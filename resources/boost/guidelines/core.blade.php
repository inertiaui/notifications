{{-- Inertia Notifications Guidelines for AI Code Assistants --}}
{{-- Source: https://inertiaui.com/inertia-notifications/docs --}}
{{-- License: MIT | (c) Inertia UI --}}

## Inertia Notifications

- `inertiaui/notifications` provides toasts for Laravel + Inertia.js apps, flashed from PHP with `InertiaUI\Notifications\Toast` or shown from the browser with `toast()`, and a notification center that stores Laravel notifications sent through the `inbox` channel. Supports React and Vue.
- Always activate the `inertia-notifications-development` skill when code uses the package, such as `Toast`, `InboxMessage`, `HasInbox`, `NotificationCenter`, `Toaster`, or `NotificationPreferences`. Code uses the package when it:
    - uses anything in the `InertiaUI\Notifications` namespace, or imports from `@inertiaui/notifications-vue` or `@inertiaui/notifications-react`;
    - or uses an entry point that needs no import: the `->toast()` and `->withToasts()` response macros, `Route::inertiaNotifications()`, the `assertToast()` and `assertNoToasts()` test response macros, the `inbox` notification channel, `config/inertia-notifications.php`, the `inertia-notifications:*` Artisan commands, or `make:inbox-notification`.
- Flash toasts with `Toast::success('...')->flash()` or `back()->toast(...)`. Do not use `Inertia::flash('toast', ...)` or `session()->flash()` for toasts in apps that use this package.
