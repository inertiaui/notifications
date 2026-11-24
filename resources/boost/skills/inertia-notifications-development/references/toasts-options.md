<!-- Generated from docs/toasts/options.md with `pnpm docs:guide`. Edit the docs instead. -->

# Toast Options

You may chain the following methods on a toast before you call `flash()`. In the browser, the [`toast` function](toasts-browser-toasts.md) takes them as options.

## Description

To add text below the title, pass it to the `description` method:

```php
Toast::error('Payment failed')
    ->description('Your card was declined.')
    ->flash();
```

## Duration

By default, a toast stays open for five to twelve seconds, depending on the length of its text, and a warning for at least eight. Errors, loading toasts, and toasts with [actions](toasts-actions.md) stay open until the user dismisses them or a newer toast replaces them. A toast whose actions each have an `altText` closes like one without actions.

You may pass a duration in milliseconds to the `duration` method. To keep any toast open until the user dismisses it, call `persistent()`:

```php
Toast::info('Backup complete')
    ->duration(10_000)
    ->flash();

Toast::warning('Verify your email address')
    ->persistent()
    ->flash();
```

To change the defaults for every toast, see [Configuring Toasts](toasts-configuration.md).

## Replacing a Toast by Its ID

You may give a toast an ID with the `id` method, so it replaces the open toast with the same ID instead of adding another one. This is useful for work that spans requests, such as an import:

```php
// When the import starts
Toast::loading('Importing contacts…')
    ->id("import-{$import->id}")
    ->flash();

// When the next request finds it finished
Toast::success('Contacts imported')
    ->id("import-{$import->id}")
    ->flash();
```

The replacement restarts the timer. Screen readers announce it again when its type, title, or description differs from the toast it replaces. A toast whose ID matches no open toast is added as usual.

## Progress

To show how much of the work is done, pass a number from 0 to 1 to the `progress` method. The toast shows a bar, which screen readers read as a percentage. With an ID, each request may move the bar of the same toast:

```php
Toast::loading('Importing contacts…')
    ->id("import-{$import->id}")
    ->description("{$import->processed} of {$import->total} contacts")
    ->progress($import->processed / $import->total)
    ->flash();
```

## Images

To show an image in place of the icon, such as the avatar of the person a toast is about, pass its URL to the `image` method. Screen readers still announce the toast's type before its title:

```php
Toast::info("{$comment->author->name} commented")
    ->description($comment->excerpt)
    ->image($comment->author->avatar_url)
    ->flash();
```

For toasts from Laravel, the frontend only shows images from relative, `http`, and `https` URLs. In the browser, pass the URL as the `image` option.

## Data

You may send data with a toast using the `with` method. The [component that renders the toast's type](toasts-custom-toasts.md#components-per-type) receives it as `toast.data`:

```php
Toast::make('Sophie invited you to Acme', 'invite')
    ->with(['inviter' => 'Sophie', 'team' => 'Acme', 'role' => 'Editor'])
    ->flash();
```

The toast travels through the session as JSON, so models and other objects arrive as the arrays they encode to. Each call of `with` adds to the data of earlier calls.

## Other Options

You may customize a toast further with the following methods:

```php
Toast::info('Copied')
    ->icon('clipboard')        // a name from the Toaster's icons prop or an icon resolver, or false for no icon
    ->dismissible(false)       // no dismiss button, Escape, or swipe
    ->position('top-center')   // overrides the Toaster's position
    ->toaster('sidebar')       // shows the toast in the Toaster named "sidebar"
    ->flash();
```

## Defaults for Every Toast

You may set defaults for every toast by calling `Toast::configureUsing()` in a service provider. The callback runs for every toast created afterwards:

```php
use Illuminate\Support\ServiceProvider;
use InertiaUI\Notifications\Toast;

class AppServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Toast::configureUsing(fn (Toast $toast) => $toast->position('top-right'));
    }
}
```

> [!WARNING] Laravel Octane
> Octane keeps your application in memory between requests. A callback that you register while handling a request, such as in middleware or a controller, therefore stays for every later request, and each request adds another one. Call `Toast::configureUsing()` in a service provider only.

The constructors resolve the `Toast` class from the container, so you may also bind a subclass with your own methods.
