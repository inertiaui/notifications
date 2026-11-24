<!-- Generated from docs/notification-center/sending-notifications.md with `pnpm docs:guide`. Edit the docs instead. -->

# Sending Notifications

To send a [Laravel notification](https://laravel.com/docs/notifications) to the notification center, add the `inbox` channel to its `via` method. Then describe the notification in a `toInbox` method that returns an `InboxMessage`:

```php
use Illuminate\Notifications\Notification;
use InertiaUI\Notifications\InboxMessage;
use InertiaUI\Notifications\ToastAction;

class InvoicePaid extends Notification
{
    public function __construct(public Invoice $invoice) {}

    public function via(object $notifiable): array
    {
        return ['inbox', 'mail'];
    }

    public function toInbox(object $notifiable): InboxMessage
    {
        return InboxMessage::make('Invoice :number paid', ['number' => $this->invoice->number])
            ->body('Paid by card.')
            ->url(route('invoices.show', $this->invoice))
            ->action(ToastAction::make('Send receipt')->post(route('invoices.receipt', $this->invoice)))
            ->category('billing');
    }
}
```

The `inbox` channel throws a `LogicException` for a notification without a `toInbox` method, or for one whose `toInbox` method returns something other than an `InboxMessage`.

You may generate such a notification using the `make:inbox-notification` Artisan command. The command places the new class in your application's `app/Notifications` directory, with the `inbox` channel, a `toInbox` method, and the `InteractsWithInbox` trait that [waiting for a read](#waiting-for-a-read) needs:

```bash
php artisan make:inbox-notification InvoicePaid
```

Send it like any other Laravel notification:

```php
$invoice = Invoice::find(1);

$invoice->user->notify(new InvoicePaid($invoice));
```

The `InboxMessage` class has the following methods:

| Method | Description |
| --- | --- |
| `make($title, $replace)` | Creates the message with its title, translated with the replacements. See [Translation](#translation). |
| `body($body, $replace)` | Text below the title, translated with the replacements. |
| `url($url)` | Where the notification leads. Opening the notification marks it as read and visits this URL with Inertia. |
| `action($action, $url)`, `actions($actions)` | Buttons below the body. They take the same `ToastAction` objects as toasts, and `action` also takes a label with the URL that the button visits. See [Actions](toasts-actions.md). |
| `icon($icon)` | The name of an icon from the `icons` prop of the component or an [icon resolver](icons.md). |
| `image($url)` | An image below the body. |
| `actor($actor, $name, $avatar)` | Who caused the notification. The name defaults to the model's `name` attribute, and the avatar to its `avatar_url`, `profile_photo_url`, or `avatar` attribute. For an actor that is not a model, pass only the name and avatar, such as `actor(name: 'GitHub')`. |
| `category($category)` | A category, stored in its own column. The panel [filters by category](notification-center-component.md#filtering-by-category), and users may turn categories off in their [preferences](preferences-setup.md). |
| `group($key)` | A group key, stored in its own column. Notifications with the same key show as one. See [Grouping](notification-center-component.md#grouping). |
| `for($context)` | The team, tenant, or other model the notification belongs to. See [Teams and Tenants](notification-center-teams-and-tenants.md). |
| `once($key)` | Stores and sends the notification only once per user under the key. See [Sending a Notification Once](#sending-a-notification-once). |
| `mention($mention)` | Marks the notification as a mention, which reaches the user even in a [muted thread](notification-center-component.md#muting-threads). |
| `collapse($minutes)` | Later notifications with the same group key update this one for the given minutes, 60 by default. See [Collapsing Notifications](#collapsing-notifications). |
| `toast($type)` | Also shows the notification as a toast. See [Showing a Toast](#showing-a-toast). |
| `push($push)` | Also pushes the notification to the user's devices. See [Web Push](notification-center-web-push.md). |
| `unlessReadWithin($minutes, $channels)` | Sends the given channels only to users who have not read the notification by then. See [Waiting for a Read](#waiting-for-a-read). |
| `with($data)` | Extra data for your own frontend code, available as `item.data`. |

## Translation

The title, body, and action labels of a message go through Laravel's translator, like the text of [toasts](toasts-flashing-from-laravel.md#translation). The notification center stores the translation keys with their replacements, and translates them each time it shows the notification, in the locale of the user who reads it:

```php
// In the toInbox() method of an InvoicePaid notification
return InboxMessage::make('invoices.paid', ['number' => $this->invoice->number])
    ->body('invoices.paid_by', ['method' => 'card'])
    ->action(ToastAction::make('invoices.receipt')->url(route('invoices.receipt', $this->invoice)));
```

A user who switches to another language sees their notifications in that language too, and text without a translation shows as it is written. Toasts, emails, and broadcasts use the locale that Laravel sends the notification in, such as the user's `preferredLocale()`.

## Showing a Toast

You may show the notification as a toast as well using the `toast` method of the message:

```php
use InertiaUI\Notifications\ToastType;

InboxMessage::make('Deployment finished')->toast(ToastType::Success);
```

The package flashes the toast when the notification is sent during a request of the user who receives it, such as after a form submission. With [real-time updates](notification-center-real-time-updates.md), the toast also shows when the notification arrives in the browser. Both toasts share one ID, so the user sees the toast only once.

The toast is an info toast unless you pass a `ToastType` or the name of a [custom type](toasts-custom-toasts.md#custom-types), such as `toast('deployment')`. A message with a URL and no actions gets a **View** action. Its alternative text, "Also in your notifications.", tells screen reader users where else to find the notification, so the toast closes after its duration like a toast without actions.

The panel of the `NotificationCenter` shows the same notifications. Opening the panel closes their toasts, except one whose action is still running, and notifications that arrive while the panel is open show no toast. A notification sent during the user's own request while the panel is open shows in the panel instead of as a toast, also without real-time updates.

## Waiting for a Read

You may send other channels, such as email, only to users who have not read the notification in the notification center within a given time. Pass the minutes to wait and the waiting channels to the `unlessReadWithin` method:

```php
// In the toInbox() method of an InvoicePaid notification
return InboxMessage::make('Invoice :number paid', ['number' => $this->invoice->number])
    ->unlessReadWithin(minutes: 10, channels: ['mail']);
```

The notification center stores the notification right away. Ten minutes later, the `mail` channel sends only when the notification is still unread. Seeing or archiving the notification does not count as reading it. Any channel except `inbox` may wait, and so may the [push](notification-center-web-push.md#waiting-for-a-read) of the message.

The queue delays the waiting channels, so the notification must implement `ShouldQueue` and use the `InteractsWithInbox` trait:

```php
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use InertiaUI\Notifications\Concerns\InteractsWithInbox;

class InvoicePaid extends Notification implements ShouldQueue
{
    use InteractsWithInbox, Queueable;

    public function via(object $notifiable): array
    {
        return ['inbox', 'mail'];
    }

    // toInbox()...
}
```

The trait delays the waiting channels in its own `withDelay` method. The other channels keep the delay of a `withDelay` method on a parent class, or else the delay that the notification sets with the `delay` method or the `Delay` attribute. A `withDelay` method on a parent or child class must use the signature of the trait's method, `withDelay(object $notifiable, string $channel): mixed`, or PHP refuses to load the class.

You may also define a `withDelay` method on the notification itself, as long as it returns the delay of the `inboxDelay` method for the waiting channels:

```php
class InvoicePaid extends Notification implements ShouldQueue
{
    use InteractsWithInbox, Queueable;

    public function withDelay(object $notifiable, string $channel): mixed
    {
        return $this->inboxDelay($notifiable, $channel) ?? ['sms' => now()->addMinutes(5)];
    }
}
```

A waiting channel throws a `LogicException` once it sends without having waited, such as for a notification:

- That does not implement `ShouldQueue` or does not use the `InteractsWithInbox` trait.
- That you send with `notifyNow`.
- Whose `withDelay` method leaves out `inboxDelay`.
- Whose `via` method leaves out the `inbox` channel, which stores the notification that the waiting channels check. Laravel's `database` channel does not count.

The `notify` and `notifyNow` methods throw the exception for a channel that runs without a queue worker, such as on the `sync` queue. A queue worker reports it as a failed job.

## Sending a Notification Once

You may store and send a notification only once per user, even when the code that sends it runs twice, such as a retried job or a webhook that arrives twice. Pass a key that names the notification to the `once` method:

```php
// In the toInbox() method of an InvoicePaid notification
return InboxMessage::make('Invoice :number paid', ['number' => $this->invoice->number])
    ->once("invoice-{$this->invoice->id}-paid");
```

The package stores no later notification with the same key for the same user, and none of its channels send, such as `mail`. A unique index on the `unique_key` column holds the key per user, even for notifications sent at the same time, until [pruning](notification-center-configuration.md#pruning) deletes the notification.

## Collapsing Notifications

You may collapse the notifications about one thing into one notification, such as the comments on a pull request, so the bell counts one notification instead of one per comment. Give the message a group key and call the `collapse` method with the minutes that later notifications collapse into it:

```php
// In the toInbox() method of a CommentPosted notification
$comment = $this->comment;

return InboxMessage::make(':name commented on pull request #:number', [
    'name' => $comment->author->name,
    'number' => $comment->pullRequest->number,
])
    ->actor($comment->author)
    ->group("pull-request:{$comment->pullRequest->id}")
    ->collapse(minutes: 60);
```

For the next 60 minutes, a notification with the same group key updates the stored one instead of adding one. It takes the new message, moves to the top as unread, and keeps the newest actors, such as "Sophie and 3 others". After 60 minutes, the next notification starts a new one.

The title of the collapsed notification is the newest message's, so a title that names one actor reads as if only that actor commented. To name all of them, write `:actors` in the title instead:

```php
// In the toInbox() method of a CommentPosted notification
$comment = $this->comment;

return InboxMessage::make(':actors commented on pull request #:number', [
    'number' => $comment->pullRequest->number,
])
    ->actor($comment->author)
    ->group("pull-request:{$comment->pullRequest->id}")
    ->collapse(minutes: 60);
```

The package replaces `:actors` with the actors, newest first, such as "Sophie", "Sophie and Maria", or "Sophie and 3 others". The title reads the same in the panel, the `NotificationList`, toasts, pushes, and [digest](preferences-digests.md) mails. You may translate the `:name and :other` and `:name and :count others` strings in your application's `lang` JSON files.

Notifications only collapse into one that is still in the inbox and belongs to the same [context](notification-center-teams-and-tenants.md), not one the user archived or snoozed. Each notification still sends its other channels, such as `mail`. A [digest](preferences-digests.md) lists the notifications that collapsed into one only once, with the newest message.

> [!WARNING] Group keys and once()
> A message without a group key, or with a [`once` key](#sending-a-notification-once), cannot collapse. Storing one throws a `LogicException`.
