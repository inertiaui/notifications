<!-- Generated from docs/notification-center/real-time-updates.md with `pnpm docs:guide`. Edit the docs instead. -->

# Real-Time Updates

By default, the counts update with every Inertia visit. To show a notification the moment it is sent, enable the `broadcast_notifications` option and pass Laravel Echo to `initNotifications()`. Without broadcasting, you may [poll the counts](#polling) instead.

## Broadcast Notifications

First, set up broadcasting and Echo as described in the [Laravel broadcasting documentation](https://laravel.com/docs/broadcasting). The `php artisan install:broadcasting` command adds the private `App.Models.User.{id}` channel that Laravel sends a user's notifications on.

Then enable the `broadcast_notifications` option:

```php
// config/inertia-notifications.php

return [
    'inbox' => [
        // ...
        'broadcast_notifications' => true,
    ],
];
```

Every notification that the notification center stores then arrives in the user's open pages right away. The package broadcasts the `InertiaUI\Notifications\Events\InboxNotificationArrived` event on the user's channel once for each notification it stores, so a user who turned off the notification center for the notification's [category](preferences-setup.md) receives no broadcast either.

A notification may still list Laravel's `broadcast` channel in its `via` method, with its own `toBroadcast` method, such as for an Echo listener of your own. The package leaves that broadcast alone.

Finally, pass Echo to `initNotifications()`. You may pass the Echo instance or a function that returns it:

```js
// Vue
import { echo } from '@laravel/echo-vue'
import { initNotifications } from '@inertiaui/notifications-vue'

initNotifications({ inbox: { echo } })
```

```js
// React
import { echo } from '@laravel/echo-react'
import { initNotifications } from '@inertiaui/notifications-react'

initNotifications({ inbox: { echo } })
```

```js
// laravel-echo
initNotifications({ inbox: { echo: () => window.Echo } })
```

The notification center listens on the user's channel from the [shared prop](notification-center-configuration.md#the-shared-prop), which follows the `receivesBroadcastNotificationsOn` method of your user model. It switches channels once another user signs in, and stops listening once the user signs out. Your own listeners on the same channel keep working.

A notification that arrives in real time shows in the following places:

- The bell counts it.
- The panel and the [`NotificationList`](notification-center-notifications-page.md) show it at the top, or behind a button while the user has [scrolled down the list](notification-center-component.md#new-notifications-while-scrolling).
- A toast shows it when its message calls [`toast()`](notification-center-sending-notifications.md#showing-a-toast), or for the notifications of the `arrivalToasts` option, unless the panel is open.

Broadcasts sent while the WebSocket connection is down are lost, so the notification center requests the counts again once it reconnects.

> [!INFO] Queued broadcasts
> The event implements `ShouldBroadcast`, so it is queued like other broadcast events. Laravel dispatches it once the database transaction that stores the notification commits.

## Running Code on Arrival

You may run your own code for each notification that arrives in real time, such as playing a sound, by passing the `onArrival` option. It receives the notification with the [fields of a notification item](notification-center-custom-markup.md#custom-item-markup):

```js
// Vue
import { echo } from '@laravel/echo-vue'
import { initNotifications } from '@inertiaui/notifications-vue'

initNotifications({
    inbox: {
        echo,
        onArrival: (item) => item.category === 'deployments' && new Audio('/sounds/ping.mp3').play(),
    },
})
```

```js
// React
import { echo } from '@laravel/echo-react'
import { initNotifications } from '@inertiaui/notifications-react'

initNotifications({
    inbox: {
        echo,
        onArrival: (item) => item.category === 'deployments' && new Audio('/sounds/ping.mp3').play(),
    },
})
```

The callback runs once per notification, after the notification center shows it and before its toast, including notifications that the [unsnooze command](notification-center-component.md#snoozing) brings back. To listen from a component, call `inboxStore.onArrival(callback)`, which returns a function that stops listening.

## Throttling a Category

You may limit how many toasts, real-time arrivals, and pushes a user receives for a category, such as one comment notification per minute. List the categories in the `throttle` option of the configuration file, each with a `limit` per number of `seconds`:

```php
// config/inertia-notifications.php

return [
    'inbox' => [
        // ...
        'throttle' => [
            'comments' => ['limit' => 1, 'seconds' => 60],
        ],
    ],
];
```

The limit applies per user. The package still stores a notification over the limit, but the notification shows no toast, does not arrive in real time, and gets no [push](notification-center-web-push.md). The bell counts it on the next Inertia visit. The limit leaves the notification's own `broadcast` channel alone.

> [!WARNING] Shared cache
> Laravel's rate limiter counts the notifications in your application's cache, so your servers and queue workers should share one cache store, such as `database` or `redis`.

## Changes in Other Sessions

A notification that the user marks as read in one tab shows as read in their other tabs of the same browser right away.

To update the user's other browsers and devices as well, set up broadcasting and Echo as described in [Broadcast Notifications](#broadcast-notifications), and enable the `broadcast_changes` option:

```php
// config/inertia-notifications.php

return [
    'inbox' => [
        // ...
        'broadcast_changes' => true,
    ],
];
```

Every change, such as marking a notification as read, then broadcasts the `InertiaUI\Notifications\Events\InboxChanged` event on the user's channel, to every session except the one that made the change. Your application's own changes, such as [updating or retracting](notification-center-reading-and-changing.md#updating-and-retracting-notifications) a notification, reach every session.

To run your own code for each change that arrives, call `inboxStore.onChange(callback)`, which returns a function that stops listening. The callback receives the change, such as `{ kind: 'update', item }` for a notification that the server updated, or `{ kind: 'delete', ids }` for those it retracted.

> [!INFO] Queued broadcasts
> The event implements `ShouldBroadcast`, so it is queued like other broadcast events.

## Polling

Without Echo, you may let the notification center request the counts at an interval instead. Pass the interval in milliseconds as the `poll` option:

```js
initNotifications({ inbox: { poll: 30_000 } })
```

Polling pauses while the tab is hidden, and only updates the counts. The panel loads the new notifications once it opens.

## Options

The `initNotifications()` function accepts the following real-time options under the `inbox` key:

| Option | Default | Description |
| --- | --- | --- |
| `echo` | none | Laravel Echo, or a function that returns it. Pass `null` to stop listening. |
| `arrivalToasts` | `'requested'` | Which arrivals show a toast: those that call `toast()` (`'requested'`), every unread one (`'all'`), or `'none'`. |
| `poll` | `false` | Milliseconds between requests for the counts. |
| `onArrival` | none | Runs for each notification that arrives in real time. See [Running Code on Arrival](#running-code-on-arrival). |

The `inbox` key also takes the options of the [browser alerts](notification-center-browser-alerts.md), which reach users in their other tabs, and the `prop` option of the [shared prop](notification-center-configuration.md#the-shared-prop).
