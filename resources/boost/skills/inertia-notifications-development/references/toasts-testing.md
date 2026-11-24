<!-- Generated from docs/toasts/testing.md with `pnpm docs:guide`. Edit the docs instead. -->

# Testing Toasts

To record the toasts that your code sends, call `Toast::fake()`. The fake still flashes the toasts, so assertions on the response keep working:

```php
use InertiaUI\Notifications\Toast;
use InertiaUI\Notifications\ToastType;

it('confirms the invoice was sent', function () {
    Toast::fake();

    $this->post('/invoices', ['amount' => 1500])->assertRedirect();

    Toast::assertFlashed('Invoice sent');
    Toast::assertFlashed(fn (Toast $toast) => $toast->getType() === ToastType::Success, times: 1);
    Toast::assertNotFlashed('Payment failed');
});
```

You may also call `Toast::assertNothingFlashed()`, which fails when any toast was sent.

You may also assert on the toasts that a response delivers, with or without the fake. These are the toasts flashed for the page a redirect leads to, the toasts in an Inertia page, and the toasts in the header of a [JSON response](toasts-json-endpoints.md). Toasts that a response leaves in the session for a later page do not count:

```php
$this->post('/invoices', ['amount' => 1500])->assertToast('Invoice sent', ToastType::Success);

$this->get('/welcome')->assertToast(fn (array $toast) => str_starts_with($toast['title'], 'Welcome'));

$this->get('/dashboard')->assertNoToasts();
```

A callback receives each toast as the frontend receives it, with keys such as `type`, `title`, `description`, `id`, and `actions`.
