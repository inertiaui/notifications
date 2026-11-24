<!-- Generated from docs/toasts/flashing-from-laravel.md with `pnpm docs:guide`. Edit the docs instead. -->

# Flashing Toasts From Laravel

To flash a toast, create it with one of the `Toast` constructors and call its `flash` method. The toast appears after the next Inertia response, which is usually the page that a redirect leads to:

```php
use InertiaUI\Notifications\Toast;

Toast::success('Profile saved')->flash();

return back();
```

The `Toast` class has a constructor for each type:

```php
Toast::make('Export queued');           // default
Toast::info('New version available');
Toast::success('Profile saved');
Toast::warning('Storage almost full');
Toast::error('Payment failed');
Toast::loading('Importing contacts…');  // shows a spinner and stays open
```

To add types of your own, such as `deployment`, see [Custom Types](toasts-custom-toasts.md#custom-types).

You may flash more than one toast in a request. They appear in the order you flashed them.

To add a description, a duration, an image, and other options to a toast, see [Toast Options](toasts-options.md). To add buttons, see [Toast Actions](toasts-actions.md).

## Redirects and Inertia Responses

You may also pass a toast to a redirect or an Inertia response, which flashes it:

```php
return back()->toast(Toast::success('Profile saved'));

return redirect()
    ->route('invoices.index')
    ->toast('Invoice deleted');

return Inertia::render('Dashboard')->toast(Toast::info('Welcome back'));
```

A title in place of a `Toast` flashes a default toast. You may pass its type as the second argument, such as `->toast('Invoice deleted', 'success')`.

## Translation

Titles, descriptions, and the labels, alternative texts, and results of actions go through Laravel's translator. You may pass replacements as the second argument, or as the third argument of `Toast::make`:

```php
Toast::success('invoices.sent', ['number' => $invoice->number])
    ->description('invoices.sent_to', ['email' => $invoice->email])
    ->flash();
```

Text without a translation is shown as written. To turn translation off, set `translate` to `false` in `config/inertia-notifications.php`.

## How Flashing Works

The `flash` method adds the toast to the `inertiaui.toasts` key of [Inertia's flash data](https://inertiajs.com/docs/v3/data-props/flash-data). Inertia does not save flash data in the browser history, and each flashed toast has a unique `uuid`. A flashed toast therefore shows only once.

Laravel keeps flash data for one request, and Inertia keeps it through redirects, location responses, and the reload after you deploy new assets. A flashed toast therefore shows on the next page, unless another request that renders no page, such as a `fetch()` call, reaches your application first. Code that runs without a session, such as a queued job, has no next page, so the `flash` method does nothing there. To show the toasts that you flash during a `useHttp` request as soon as its response arrives, see [Toasts From JSON Endpoints](toasts-json-endpoints.md).

To use another flash key, change `flash_key` in the `config/inertia-notifications.php` file, which the [install command](installation.md#run-the-install-command) publishes. You may also publish it yourself:

```bash
php artisan vendor:publish --tag=inertia-notifications-config
```

Then pass the same key to `initNotifications()` in your frontend entry point:

```js
initNotifications({ flashKey: 'notifications' })
```

## Typing the Flash Data

The package exports the `InertiaUIFlashData` type, which describes the package's key in Inertia's flash data. To type `page.flash` in TypeScript, add the type to the `flashDataType` of your Inertia configuration, together with your own flash data:

```ts
import type { InertiaUIFlashData } from '@inertiaui/notifications-vue'

declare module '@inertiajs/core' {
    export interface InertiaConfig {
        flashDataType: InertiaUIFlashData & {
            message?: string
        }
    }
}
```

With a custom `flash_key`, pass the key as the type argument, such as `InertiaUIFlashData<'notifications'>`. Each toast under `toasts` has the `FlashedToast` type. The package does not declare `flashDataType` itself, because TypeScript rejects two different declarations of it.

## Starter Kit Toasts

Laravel's React and Vue starter kits flash their toasts under Inertia's `toast` flash key, and show them with sonner:

```php
Inertia::flash('toast', ['type' => 'success', 'message' => __('Profile updated.')]);
```

The package does not read this key. To show these toasts, render the package's [Toaster](installation.md#render-the-toaster) in place of the kit's sonner `Toaster`, delete the kit's toast listener in `resources/js/lib/flashToast.ts` (Vue) or `resources/js/hooks/use-flash-toast.ts` (React), and choose one of the two ways below.

### Moving to the Toast Class

You may replace each call with the `Toast` constructor of its type. Toast titles go through Laravel's translator, so you may drop the `__` calls and pass their replacements as the second argument:

```php
use InertiaUI\Notifications\Toast;

Toast::success('Profile updated.')->flash();

Toast::success('You left the team ":name"', ['name' => $team->name])->flash();
```

The starter kits with teams flash more toasts, in their team, invitation, and member controllers. Once moved, these toasts work like every other flashed toast. They may show from the response header of a [JSON endpoint](toasts-json-endpoints.md), and the [testing helpers](toasts-testing.md) see them.

### Keeping the Starter Kit Calls

To show the toasts without changing your controllers, listen for Inertia's `flash` event and pass the kit's toast to the package's `toast` function. Add the listener to your frontend entry point, next to `initNotifications()`:

```js
// Vue
import { router } from '@inertiajs/vue3'
import { toast } from '@inertiaui/notifications-vue'

router.on('flash', (event) => {
    const data = event.detail.flash.toast

    if (data) {
        toast[data.type](data.message)
    }
})
```

```js
// React
import { router } from '@inertiajs/react'
import { toast } from '@inertiaui/notifications-react'

router.on('flash', (event) => {
    const data = event.detail.flash.toast

    if (data) {
        toast[data.type](data.message)
    }
})
```

> [!WARNING] Browser toasts
> These toasts are [browser toasts](toasts-browser-toasts.md), so the testing helpers do not see them, and they never show from the response header of a [JSON endpoint](toasts-json-endpoints.md). Move them to the `Toast` class to get both.
