<!-- Generated from docs/toasts/json-endpoints.md with `pnpm docs:guide`. Edit the docs instead. -->

# Toasts From JSON Endpoints

A request from Inertia's `useHttp` returns JSON instead of a page, so a toast that you flash during such a request waits for the next page. To show it as soon as the response arrives, append the `AddFlashedToastsToResponseHeaders` middleware to the `web` middleware group in your application's `bootstrap/app.php` file. Add it before Inertia's middleware, so it sees the response that Inertia's middleware sends:

```php
use App\Http\Middleware\HandleInertiaRequests;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Middleware;
use InertiaUI\Notifications\Http\Middleware\AddFlashedToastsToResponseHeaders;

return Application::configure(basePath: dirname(__DIR__))
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->web(append: [
            AddFlashedToastsToResponseHeaders::class,
            HandleInertiaRequests::class,
        ]);
    })
    ->create();
```

The middleware moves the toasts that you flash during the request to the `X-InertiaUI-Toasts` response header, and the frontend shows them:

```php
use App\Models\Message;
use InertiaUI\Notifications\Toast;

class MessageController extends Controller
{
    public function archive(Message $message)
    {
        $message->archive();

        Toast::make('Message archived')->flash();

        return response()->json(['archived' => true]);
    }
}
```

The middleware only handles the requests of Inertia's HTTP client, which sends the same header to say that it reads toasts from responses. A response that renders a page, redirects, or sends the browser to another URL leaves the toasts flashed for the next page. Toasts that an earlier request flashed for the next page go in the header too, so they show right away.

You may also add toasts to the header of a response with the `withToasts` method, such as a response that a plain `fetch()` call receives. This method does not need the middleware:

```php
return response()
    ->json(['copied' => true])
    ->withToasts(Toast::success('Copied'), 'Shared with your team');

return response()
    ->noContent()
    ->withToasts(Toast::success('Deleted'));
```

The frontend reads the header from every response that goes through Inertia's HTTP client. For a `fetch()` response, pass its headers to `toast.fromHeaders()`:

```js
const response = await fetch('/api/copy', { method: 'POST' })

toast.fromHeaders(response.headers)
```
