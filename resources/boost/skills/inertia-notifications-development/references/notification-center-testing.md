<!-- Generated from docs/notification-center/testing.md with `pnpm docs:guide`. Edit the docs instead. -->

# Testing the Notification Center

To assert on the notification center in your tests, add the `InteractsWithNotificationCenter` trait to your base test case:

```php
namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use InertiaUI\Notifications\Testing\InteractsWithNotificationCenter;

abstract class TestCase extends BaseTestCase
{
    use InteractsWithNotificationCenter;
}
```

Most assertions take the notifiable model and a title or a callback. The trait compares a title with the translated title in the current locale, and passes a callback the [fields of a notification item](notification-center-custom-markup.md#custom-item-markup):

```php
use App\Models\Invoice;

it('tells the customer that the invoice was paid', function () {
    $invoice = Invoice::factory()->create(['number' => 'INV-7']);

    $this->post(route('invoices.pay', $invoice))->assertRedirect();

    $this->assertInboxMessage($invoice->user, 'Invoice INV-7 paid');
    $this->assertInboxMessage($invoice->user, fn (array $message) => $message['category'] === 'billing', times: 1);
    $this->assertInboxMessageMissing($invoice->user, 'Payment failed');
    $this->assertMarkedUnread($invoice->user, 'Invoice INV-7 paid');
});
```

The trait has the following assertions. They cover the model's notifications in every context, including archived and snoozed ones, and leave out [announcements](notification-center-announcements.md):

| Assertion | Passes when |
| --- | --- |
| `assertInboxMessage($notifiable, $callback, $times)` | The model has a matching notification, or exactly `$times` of them. Without a title or callback, any notification matches. |
| `assertInboxMessageMissing($notifiable, $callback)` | The model has no matching notification. |
| `assertNoInboxMessages($notifiable)` | The model has no notifications. |
| `assertMarkedRead($notifiable, $callback)` | At least one notification matches, and each match is read. Without a title or callback, every notification must be read. |
| `assertMarkedUnread($notifiable, $callback)` | At least one notification matches, and each match is unread. Without a title or callback, every notification must be unread. |
| `assertArchived($notifiable, $callback)` | At least one notification matches, and each match is archived. Without a title or callback, every notification must be archived. |

> [!WARNING] Notification fakes
> The assertions read what the `inbox` channel stored, so they find nothing after `Notification::fake()`, which keeps every channel from running.

The trait also has the assertions of [preferences](preferences-testing.md), [digests and notification hours](preferences-testing.md#digests-and-notification-hours), and [web push](notification-center-web-push.md#testing).
