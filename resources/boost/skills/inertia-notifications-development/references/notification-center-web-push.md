<!-- Generated from docs/notification-center/web-push.md with `pnpm docs:guide`. Edit the docs instead. -->

# Web Push

Web push shows a notification on your users' devices while every tab of your application is closed, including on their phones. You may push a notification by calling the `push` method on its `toInbox` message, and the `inbox` channel sends the push once it stores the notification. Users turn push on per device in the [notification preferences](preferences-component.md#push-notifications-on-this-device). The package encrypts and signs each push itself, so it needs no extra Composer or npm packages.

Web push differs from the [desktop notifications](notification-center-browser-alerts.md#desktop-notifications) of the browser alerts, which only show while a tab of your application is open. An open tab still shows its desktop notification on a device with push turned on, so the device may show both. They share a tag, so browsers that replace a notification with one of the same tag show only one.

## Quick Start

1. Publish the configuration with `php artisan vendor:publish --tag=inertia-notifications-config`, unless you already did, and enable push in its `push` section:

    ```php
    // config/inertia-notifications.php

    return [
        'push' => [
            'enabled' => true,
            // ...
        ],
    ];
    ```

2. Generate the VAPID keys, which identify your application to the push services of the browsers. The command writes them to your `.env` file, with the address where the push services may reach you:

    ```shell
    php artisan inertia-notifications:vapid
    ```

    You may pass the address with the `--subject` option, such as `--subject=mailto:you@your-app.com`. Without it, the command uses the `VAPID_SUBJECT` that your configuration already has, or asks for the address.

3. Publish and run the migration of the devices:

    ```shell
    php artisan vendor:publish --tag=inertia-notifications-migrations
    php artisan migrate
    ```

    Notifiable models with UUID or ULID keys need a change to the `push_subscriptions` migration before you run it, as the [notification center setup](notification-center-setup.md#run-the-migration) describes.

4. Call the `push` method on the `toInbox` message of the notifications that should reach your users' devices, and send them through the `inbox` channel. The push shows the message:

    ```php
    use App\Models\Invoice;
    use Illuminate\Notifications\Notification;
    use InertiaUI\Notifications\InboxMessage;

    class InvoicePaid extends Notification
    {
        public function __construct(public Invoice $invoice) {}

        public function via(object $notifiable): array
        {
            return ['inbox'];
        }

        public function toInbox(object $notifiable): InboxMessage
        {
            return InboxMessage::make('Invoice :number paid', ['number' => $this->invoice->number])
                ->url(route('invoices.show', $this->invoice))
                ->category('billing')
                ->push();
        }
    }
    ```

5. Check the setup. The command prints a line for each part, with the fix of each problem:

    ```shell
    php artisan inertia-notifications:check-push
    ```

6. Sign in to your application, open the notification preferences, and turn on push for your device, as described in [Turning Push On](#turning-push-on).

7. Send a test push to every device of the user with the key `1`. The command shows how each push service answered, and links to [Troubleshooting](#troubleshooting) when a push fails:

    ```shell
    php artisan inertia-notifications:test-push 1
    ```

The package sends each push with a queued job, so run a queue worker, such as with `php artisan queue:work`, unless your queue connection is `sync`.

## Turning Push On

Users turn push on in the [`NotificationPreferences` component](preferences-component.md#push-notifications-on-this-device). While push is enabled, the component shows a **Push** column with a switch for each category, and a **Push notifications on this device** control below the table. The switches choose which categories send a push, on every device of the user. The control turns push on for the device the user is on: its **Turn on for this device** button asks the browser for permission, registers the package's service worker, and saves the device's subscription. There is nothing to copy to your `public` directory, and the public key reaches the browser in the shared prop, so you need no `VITE_` variable.

The control always tells the user why push is off, such as on a site that is not served over HTTPS or from `localhost`, and hides in a browser without web push. [Push Notifications on This Device](preferences-component.md#push-notifications-on-this-device) lists each state of the control, and you may build your own control with [`usePush()`](preferences-custom-forms.md#push-notifications).

### Keeping Devices in Step

Each page checks the device once the user allowed notifications, so push keeps working without the user noticing:

- The page removes a subscription made with an older VAPID key, such as before you [rotated your keys](#rotating-the-keys). A device that the server knows then subscribes again with the new key, without asking the user.
- A device that the server knows, but whose browser lost its subscription, subscribes again without asking.
- A device that the server knows saves its subscription once per page load, so a subscription that the browser replaced reaches the server.
- A page that loaded before the user [removed its device](preferences-component.md#other-devices), such as from another device, does not bring the device back. It shows push as off instead.
- A device that the server does not know never subscribes on its own. On a shared computer, the next user does not receive the previous user's pushes, and turns push on with the button instead.

Turning push off removes the subscription from the server first, then from the browser, so a request that fails leaves the device on, with a **Try again** button.

Below the control, the component lists the user's [other devices](preferences-component.md#other-devices) with push, so the user may stop the pushes of a phone or laptop they no longer have. In PHP, the `pushDevices` relation of the `HasInbox` trait returns the user's devices, and the `Push::removeDevice` method removes one, given the user and the key of the device.

### Opening a Push

Clicking a push focuses an open tab of your application and visits the notification's page with Inertia. Without an open tab, the browser opens one. A push arrives without a sound while the user looks at a tab of your application. The push of a notification closes on the device once the page shows its toast, or once the user reads, archives, or deletes the notification.

## How It Works

Once a user turns push on for a device, the browser registers the package's service worker, subscribes to its push service with your VAPID public key, and posts the subscription to the package's routes. The package stores it in the `push_subscriptions` table, and a cookie remembers which subscription belongs to this browser.

The `inbox` channel then stores the notification in the notification center and, since its message calls `push`, dispatches a job that sends the push to every device of the user. A user without devices still gets the stored notification, and no job. The package encrypts each push for its device, so the push service cannot read it, and signs it with your VAPID private key.

Only the `inbox` channel pushes, so a push needs the notification center. A user who turned the notification center off for the notification's [category](preferences-categories.md), or for every category, gets no push for it, even with its **Push** switch on. The [`NotificationPreferences` component](preferences-component.md) greys out a category's **Push** switch while its **In the app** switch is off.

Clicking a push opens the `/_inertia-notifications/{id}/open` route, which marks the notification as read and redirects to its URL. A notification without a URL, or with a URL that would run script, such as `javascript:`, redirects to `/`. The route finds the user's notification in every [team or tenant](notification-center-teams-and-tenants.md), so a push of one team opens while another team is current.

The package removes a device once its push service says that it no longer exists, and once the browser's subscription expires. It only accepts the subscriptions of the push services in the [`hosts` option](#configuration), and only sends to them, so a browser cannot make your server send requests to other hosts. A device whose push service you remove from the option keeps its subscription, and receives pushes again once you add the host back.

## What a Push Shows

A push shows the title and body of the notification's `toInbox` message, translated in the notification's locale. Its icon is the avatar of the message's actor when that is an absolute URL, or else the [`icon` option](#configuration). The package shortens a long body first, and then the title, so the push fits in the 4 KB that every push service accepts:

```php
// In the toInbox() method of an InvoicePaid notification
return InboxMessage::make('Invoice :number paid', ['number' => $this->invoice->number])
    ->body('Paid by card.')
    ->url(route('invoices.show', $this->invoice))
    ->actor($this->invoice->customer)
    ->category('billing')
    ->push();
```

Each push has the tag of its notification. A notification that [collapses](notification-center-sending-notifications.md#collapsing-notifications) into an earlier one has the same tag, so the device replaces the push it showed before. An open page closes the push of a notification that it already showed as a toast. Safari may show a push without running the service worker, so it may keep such a push until the user reads the notification.

The push uses the [Declarative Web Push](https://webkit.org/blog/16535/meet-declarative-web-push/) format, which Safari shows without the service worker on iOS and iPadOS 18.4 and later. Other browsers hand it to the service worker, which shows the same notification.

## Notification Hours, Pausing, and Throttling

A push shows exactly when the [browser alerts](notification-center-browser-alerts.md) of an open tab would show for the same notification. The package drops the push of a notification that arrives outside the user's [notification hours](preferences-notification-hours.md), while the user [paused their notifications](preferences-pausing.md), or over the [throttle of its category](notification-center-real-time-updates.md#throttling-a-category). It also drops the push of a notification that the user already read or archived, such as on another device.

The notification center still stores these notifications. The package does not hold their pushes for a digest, so a user who comes back from a pause finds the notifications in the panel instead of a burst of pushes.

## Waiting for a Read

You may push a notification only to users who have not read it within a few minutes, such as in an open tab of your application. Pass `push` to the [`unlessReadWithin` method](notification-center-sending-notifications.md#waiting-for-a-read) of the message, next to any channels that wait as well:

```php
// In the toInbox() method of an InvoicePaid notification
return InboxMessage::make('Invoice :number paid', ['number' => $this->invoice->number])
    ->push()
    ->unlessReadWithin(minutes: 10, channels: ['push']);
```

The package stores the notification right away, and the job that sends the push waits ten minutes. The job drops the push once the user read, archived, or deleted the notification in the meantime. Only the job waits, not a channel of the notification, so the notification needs neither `ShouldQueue` nor the `InteractsWithInbox` trait for its push to wait.

> [!WARNING] The sync connection
> The `sync` queue connection ignores delays, so it sends a waiting push right away. Set the [`connection` option](#configuration) to a queue that a worker runs.

## Shared Computers

The package removes the device of the current browser once its user signs out, and once another user signs in on that browser, using Laravel's `Logout` and `Login` events. The next person on a shared computer never gets the pushes of the previous user.

## Rotating the Keys

Push services refuse the pushes of new VAPID keys to the devices that subscribed with the previous keys. You may replace the keys with the `--force` option:

```shell
php artisan inertia-notifications:vapid --force
```

The package skips the devices of the previous keys. Each of them gets pushes again once its user opens your application on it, as the page then subscribes the device with the new keys. The `check-push` command counts the devices that still wait for this.

Use the same keys in every environment that sends to the same devices, such as each of your servers.

## Browser Support

| Browser | Support |
| --- | --- |
| Chrome and Edge | On desktop and Android. On desktop, the browser should be running, also in the background. |
| Firefox | On desktop and Android. |
| Safari on macOS | Safari 16.1 and later, on macOS 13 and later, also while Safari is not running. |
| Safari on iPhone and iPad | iOS and iPadOS 16.4 and later, only for a site that the user added to the Home Screen. Your site needs a [web app manifest](https://developer.mozilla.org/docs/Web/Manifest) with `"display": "standalone"`. |
| Brave | Only with its "Use Google services for push messaging" setting turned on. |

## Local Development

Browsers only offer push on HTTPS sites and on `localhost`. A site served by `php artisan serve` on `http://localhost:8000` works. A site on another local domain, such as `http://acme.test`, needs HTTPS, such as with `herd secure` or `valet secure`. The `APP_URL` of your `.env` file should be the same URL, since every push links to it.

Your machine sends each push to the push service of the device, so it needs to reach the internet. Apple refuses pushes whose subject is on `localhost` or `example.com`, so use an address on a domain you own, also locally.

## Configuration

The `push` section of the configuration file has the following options:

| Option | Default | Description |
| --- | --- | --- |
| `enabled` | `false` | Send pushes, share the push setup with every page, and add a **Push** channel to the preferences. |
| `public_key` | `env('VAPID_PUBLIC_KEY')` | The VAPID public key, which browsers subscribe with. |
| `private_key` | `env('VAPID_PRIVATE_KEY')` | The VAPID private key, which signs each push. |
| `subject` | `env('VAPID_SUBJECT')` | The `mailto:` address or `https://` URL where push services may reach you. |
| `table` | `'push_subscriptions'` | The table of the devices. Set it before you run the migration. |
| `ttl` | `86400` | The seconds that a push service keeps a push for a device that is offline. |
| `hosts` | See below | The push services that the package sends to. A `*.` matches any subdomain. |
| `icon` | `null` | The absolute URL of the icon of a push whose actor has no avatar. |
| `connection` | `null` | The queue connection of the job that sends the pushes, or `null` for your default connection. |
| `queue` | `null` | The queue of that job, or `null` for the connection's default queue. |

The `hosts` option lists the push services of Chrome, Firefox, Safari, and Edge: `fcm.googleapis.com`, `*.push.services.mozilla.com`, `*.push.apple.com`, and `*.notify.windows.com`.

While push is enabled and no channel of the [preferences](preferences-categories.md) covers `push`, the package adds a `push` channel labeled **Push**. You may list your own channel instead, such as to change its label:

```php
// config/inertia-notifications.php

return [
    'preferences' => [
        'channels' => [
            'inbox' => ['label' => 'In the app', 'via' => ['inbox', 'database', 'broadcast']],
            'mail' => ['label' => 'Email', 'via' => ['mail']],
            'push' => ['label' => 'On your devices', 'via' => ['push']],
        ],
    ],
];
```

A category that lists its own `channels` without that channel has no **Push** switch, and its pushes always send, like those of any channel that a category does not offer.

> [!WARNING] Missing keys
> While push is enabled, every Inertia page of a signed-in user fails until the VAPID keys and the subject are valid, like a missing `APP_KEY` does. The error tells you how to fix them.

## Testing

You may fake the pushes with the `fakePush` method of the `InteractsWithNotificationCenter` trait, which records each push instead of sending it. The `createPushSubscription` method stores a device of a user:

```php
use App\Models\Invoice;

it('pushes the paid invoice to the customer', function () {
    $this->fakePush();

    $invoice = Invoice::factory()->create(['number' => 'INV-7']);

    $this->createPushSubscription($invoice->user);

    $this->post(route('invoices.pay', $invoice))->assertRedirect();

    $this->assertPushed($invoice->user, 'Invoice INV-7 paid');
    $this->assertPushed($invoice->user, fn (array $push) => str_ends_with($push['navigate'], '/open'));
    $this->assertNotPushed($invoice->user, 'Payment failed');
});
```

A callback receives the `notification` of the push, with keys such as `title`, `body`, `navigate`, `tag`, and `icon`, and the ID of the device's subscription under `subscription`. The trait has the following assertions:

| Assertion | Passes when |
| --- | --- |
| `assertPushed($notifiable, $callback)` | A matching push reached a device of the model. |
| `assertNotPushed($notifiable, $callback)` | No matching push reached a device of the model. |
| `assertNothingPushed()` | No push reached any device. |

The `fakePush` method returns the fake. Its `recordedPushes` method returns each push with its subscription and its whole payload, such as to check the `data` of the notification.

A queued job sends the pushes, so the fake runs the job on the `sync` connection, whatever the `connection` option names. The fake also sends a push that [waits for a read](#waiting-for-a-read) right away, since the `sync` connection ignores delays. Under `Queue::fake()`, the job stays in the fake queue, so no push reaches a device. The fake sets VAPID keys and a subject for the test when your configuration has none.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Every page fails with "Web push needs VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY". | Push is enabled without keys. | Run `php artisan inertia-notifications:vapid`, and `php artisan config:cache` when your configuration is cached. |
| Every page fails with "VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are not one pair". | The keys come from two pairs, such as from two environments. | Copy both keys from the same pair, or [rotate the keys](#rotating-the-keys). |
| Every page fails with "The VAPID keys are invalid", such as with "The private key must be a valid scalar of the P-256 curve". | A key is not a valid P-256 key, such as one that was cut short or changed when it was copied. | Copy both keys again from the same pair, or [rotate the keys](#rotating-the-keys). |
| The preferences show no **Push** column. | Push is not enabled, or the cached configuration predates it. | Set `enabled` to `true`, and run `php artisan config:cache` when your configuration is cached. |
| The preferences say that push needs a secure connection. | The page is not on HTTPS or `localhost`. | Serve the site over HTTPS, as described in [Local Development](#local-development). |
| An iPhone says that push only works from the Home Screen. | Safari on iOS only offers push to sites on the Home Screen. | Add a web app manifest, add the site to the Home Screen, and open it from there. |
| Turning push on fails in Brave. | Brave turns off Google's push service. | Turn on "Use Google services for push messaging" in Brave's privacy settings. |
| Turning push on answers with "The push service [...] is not in the [inertia-notifications.push.hosts] config". | The browser uses a push service that the `hosts` option does not list. | Add its host to the `hosts` option. |
| `test-push` shows a 403 from `web.push.apple.com`, such as `BadJwtToken`. | Apple refuses the subject. | Set `VAPID_SUBJECT` to an address or URL on a domain you own, not `localhost` or `example.com`. |
| `test-push` shows a 401 or 403 from `fcm.googleapis.com`. | The device subscribed with other keys, such as those of another environment. | Use the same keys everywhere, and open your application on the device again. |
| `test-push` shows another 400, 401, or 403. | The push service refuses the VAPID token. | Run `php artisan inertia-notifications:check-push` to check the keys and the subject. |
| `test-push` shows a 404 or 410. | The user blocked notifications or cleared the site data. | Nothing. The package removed the device, and the user may turn push on again. |
| `test-push` shows a 413. | The push is larger than the push service accepts. | Use a shorter `icon` option and `APP_URL`, since the package only shortens the title and body of a push. |
| `test-push` shows a 429. | The push service limits how many pushes it accepts from your server. | Try again later. |
| `test-push` shows "Not sent" with another VAPID public key. | The device subscribed before you rotated the keys. | Open your application on the device, which subscribes it with the new keys. |
| `test-push` shows "Not sent: The subscription expired." | The browser said that its subscription expired, so the package removed the device. | Turn push on again in that browser. |
| `test-push` shows "Not sent: The push service [...] is not in the [inertia-notifications.push.hosts] config." | The device subscribed before its push service left the `hosts` option. | Add the host to the `hosts` option again, or let the user turn push on in a browser whose push service the option lists. |
| `test-push` shows "Not sent" with a connection error, such as `Could not resolve host`. | Your server could not reach the push service. | Allow your server to make outgoing HTTPS requests to the push services of the [`hosts` option](#configuration). |
| Push services accept the test push, but nothing shows. | The operating system silences the browser, such as with Focus or Do Not Disturb. | Allow notifications for the browser in the system settings. |
| Pushes arrive late, or only after a deploy. | No queue worker runs the jobs. | Run `php artisan queue:work`, or set the `connection` option to a queue that a worker runs. |
| No notification is pushed. | The `toInbox` message does not call `push`, or the notification is not sent through the `inbox` channel. | Call `push` on the message, and return `inbox` from `via()`. |
| A notification arrives without a push. | It arrived outside the notification hours, during a pause, over its throttle, or after the user read it. | Nothing. See [Notification Hours, Pausing, and Throttling](#notification-hours-pausing-and-throttling). |
| A category is never pushed to a user. | The user turned the notification center off for the category, or for every category. | Nothing. A push [needs the notification center](#how-it-works). |
