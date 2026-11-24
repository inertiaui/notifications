<!-- Generated from docs/notification-center/configuration.md with `pnpm docs:guide`. Edit the docs instead. -->

# Configuring the Notification Center

You may publish the configuration file using the `vendor:publish` Artisan command:

```bash
php artisan vendor:publish --tag=inertia-notifications-config
```

The `inbox` section of the file has the following options:

| Option | Default | Description |
| --- | --- | --- |
| `table` | `'inbox_notifications'` | The table of the notifications. |
| `model` | `InboxNotification::class` | The model class. See [Notifications in PHP](notification-center-reading-and-changing.md). |
| `shared_prop` | `'inertiauiInbox'` | The shared prop with the counts. Keep it a top-level key. See [The Shared Prop](#the-shared-prop). |
| `per_page` | `20` | Notifications per page, in the panel and with `Inbox::page()` and `Inbox::scroll()`. |
| `prune_after_days` | `90` | The age in days at which [pruning](#pruning) deletes a notification. Set it to `null` to keep notifications for good. |
| `broadcast_notifications` | `false` | Broadcast every stored notification to the user's open pages. Needs Laravel broadcasting and Echo. See [Broadcast Notifications](notification-center-real-time-updates.md#broadcast-notifications). |
| `broadcast_changes` | `false` | Broadcast every change to the user's other sessions. Needs Laravel broadcasting and Echo. See [Changes in Other Sessions](notification-center-real-time-updates.md#changes-in-other-sessions). |
| `actions` | `['snooze', 'archive', 'mute']` | What users may do with their notifications besides reading them: `'snooze'`, `'archive'`, `'mute'`, and `'delete'`. See [Choosing the Actions](notification-center-component.md#choosing-the-actions). |
| `selectable` | `true` | Let users select notifications to change them together. See [Selecting Notifications](notification-center-component.md#selecting-notifications). |
| `category_filter` | `false` | The categories to filter by in the panel, optionally with their labels by key, or `true` for every category of the preferences. See [Filtering by Category](notification-center-component.md#filtering-by-category). |
| `tabs` | `[]` | Tabs that list the notifications of a category or with given data. See [Custom Tabs](notification-center-component.md#custom-tabs). |
| `throttle` | `[]` | The most toasts, real-time arrivals, and pushes per user for each category. See [Throttling a Category](notification-center-real-time-updates.md#throttling-a-category). |
| `announcements_table` | `'inbox_announcements'` | The table of the [announcements](notification-center-announcements.md). |
| `announcement_states_table` | `'inbox_announcement_states'` | The table of each user's announcement state. |
| `broadcast_announcements` | `false` | Broadcast each published announcement to open pages. Needs Laravel broadcasting and Echo. See [Real-Time Updates](notification-center-announcements.md#real-time-updates). |
| `mutes_table` | `'inbox_mutes'` | The table of the [threads that users muted](notification-center-component.md#muting-threads). |

You should set the table names before you run the migrations.

## The Shared Prop

Every Inertia page of a signed-in user receives a shared prop with the counts, the URL of the JSON endpoints, and the user's broadcast channel:

```json
{
    "inertiauiInbox": {
        "url": "/_inertia-notifications",
        "channel": "App.Models.User.1",
        "announcementsChannel": null,
        "allowedActions": ["snooze", "archive", "mute"],
        "selectable": true,
        "categoryFilter": { "comments": "Comments", "billing": "Billing" },
        "tabs": { "production": { "label": "Production", "category": "deployments", "data": { "environment": "production" } } },
        "pause": { "until": "2026-11-15T11:00:00+00:00", "presets": [30, 60, 120, "tomorrow"] },
        "push": { "publicKey": "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U", "worker": "/_inertia-notifications/push/worker.js?v=8f3a1c2e9b7d4a60", "subscribed": true },
        "unread": 3,
        "unseen": 1,
        "latest": "2026-11-15T10:00:00+00:00",
        "latestIds": ["9d3c1b6e-0b7a-4c1e-9a64-5f0d2a8e1c47"],
        "categories": { "billing": 2, "comments": 1 },
        "user": "4d1f0c6b2a9e8d7c5b3a1f0e9d8c7b6a",
        "revision": 1794775816339669
    }
}
```

The `allowedActions` and `selectable` keys hold the options of the configuration, and `categoryFilter` holds the categories of the `category_filter` option with their translated labels. The `categories` key holds the number of unread notifications in each category, and `tabs` holds the [custom tabs](notification-center-component.md#custom-tabs) with their translated labels. The `announcementsChannel` key is `null` unless [`broadcast_announcements`](notification-center-announcements.md#real-time-updates) is enabled.

The `pause` key holds the end of the user's [pause](preferences-pausing.md) as `until`, or `null` while notifications are not paused, and the pause times as `presets`. The key itself is `null` while the application does not offer pausing.

The `push` key holds the setup of [web push](notification-center-web-push.md): the VAPID `publicKey` that browsers subscribe with, the URL of the service `worker` with the version of its file, and whether the current browser has a push subscription of the user, as `subscribed`. The key is `null` while push is not enabled.

The browser uses the `latest`, `latestIds`, `user`, and `revision` keys to keep its notifications up to date. With a [context](notification-center-teams-and-tenants.md) resolver, the prop also holds the opaque `context` key of the current context, or `null`.

Keep `shared_prop` a top-level key, such as `notificationCounts` instead of `app.notifications`. Inertia leaves nested shared props out of partial reloads, such as the pages that infinite scroll loads, so the counts would not refresh on those requests.

To rename the prop, change `shared_prop` and pass the same name to `initNotifications()`:

```js
initNotifications({ inbox: { prop: 'notificationCounts' } })
```

> [!WARNING] Disabling the shared prop
> Set `shared_prop` to `null` only when you do not render the notification center components. They read the URL of the JSON endpoints from this prop.

## Pruning

Laravel's `model:prune` command deletes the notifications older than `prune_after_days`. You may schedule the command for the package's model in your application's `routes/console.php` file:

```php
use Illuminate\Support\Facades\Schedule;
use InertiaUI\Notifications\Models\InboxNotification;

Schedule::command('model:prune', ['--model' => [InboxNotification::class]])->daily();
```
