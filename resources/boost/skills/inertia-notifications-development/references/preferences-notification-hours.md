<!-- Generated from docs/preferences/notification-hours.md with `pnpm docs:guide`. Edit the docs instead. -->

# Notification Hours

Notification hours let users choose the hours of each day when emails, toasts, and alerts may reach them, such as on weekdays during office hours. The notification center still stores each notification right away. You may offer notification hours with the `enabled` option of the `notification_hours` configuration section:

```php
// config/inertia-notifications.php

return [
    'notification_hours' => [
        'enabled' => true,
        'days' => [
            'monday' => ['07:00-22:00'],
            'tuesday' => ['07:00-22:00'],
            'wednesday' => ['07:00-22:00'],
            'thursday' => ['07:00-22:00'],
            'friday' => ['07:00-22:00'],
            'saturday' => ['07:00-22:00'],
            'sunday' => ['07:00-22:00'],
        ],
    ],
];
```

The `NotificationPreferences` component then shows a **Notification hours** row below the categories, with a switch. Each day of the week has its own switch and the **From** and **Until** times of each range, with buttons to add and remove a range. Notification hours start off for every user, and the times are in the [timezone of each user](preferences-digests.md#the-timezone-of-each-user). The user of the example above already changed their hours to 08:00-18:00 on weekdays, so the example shows them instead of the hours of the configuration.

Outside the notification hours, emails wait in the table of the [digests](preferences-digests.md), and the `inertia-notifications:send-digests` command sends them once the next notification hours start. Follow the [setup of digests](preferences-digests.md#setup) to run the migration and schedule the command.

## Configuration

The `notification_hours` section has the following options:

| Option | Default | Description |
| --- | --- | --- |
| `enabled` | `false` | Let users set notification hours. |
| `days` | `07:00-22:00` on every day | The hours that users start with when they turn notification hours on. |

## Writing the Hours

The `days` option lists the seven days of the week by their lowercase English name. Each day holds a list of ranges in the 24-hour format, such as `'09:00-17:00'`:

```php
// config/inertia-notifications.php

return [
    'notification_hours' => [
        'enabled' => true,
        'days' => [
            'monday' => ['08:00-12:00', '13:00-18:00'],
            'tuesday' => ['08:00-12:00', '13:00-18:00'],
            'wednesday' => ['08:00-12:00'],
            'thursday' => ['08:00-12:00', '13:00-18:00'],
            'friday' => ['08:00-12:00', '20:00-02:00'],
            'saturday' => [],
            'sunday' => ['00:00-00:00'],
        ],
    ],
];
```

An empty list leaves a day without notification hours, such as `saturday` above. A range that ends at or before its start runs past midnight and ends the next day, so `20:00-02:00` on Friday lasts until 02:00 on Saturday, and `00:00-00:00` covers the whole day. Notification hours need a range on at least one day of the week.

## What Waits Outside Notification Hours

Outside their notification hours, the notifications of the categories in the configuration reach the user in the following way:

- The notification center stores each notification right away, and the bell counts it.
- The [channels that digests hold](preferences-digests.md#which-channels-wait), such as `mail`, wait until the next notification hours start. The command then sends them in one digest, together with an hourly, daily, or weekly digest that is due at that time.
- The notification shows no toast, plays no [sound](notification-center-browser-alerts.md#sound), shows no [desktop notification](notification-center-browser-alerts.md#desktop-notifications), and sends no [web push](notification-center-web-push.md#notification-hours-pausing-and-throttling), even during the user's own request. It still [arrives in real time](notification-center-real-time-updates.md#broadcast-notifications), so the bell of an open page stays current.
- A digest whose time falls outside the notification hours waits until they start.

Locked categories, and notifications without a category in the configuration, send as usual, so a security alert still reaches the user at night. A notification that arrives outside the notification hours has a `quiet` key of `true`, which your own [`onArrival` callback](notification-center-real-time-updates.md#running-code-on-arrival) may read.

A user who turns notification hours off receives the emails that waited for them with the next run of the command.

To silence notifications for a while instead, such as during a meeting, users may [pause their notifications](preferences-pausing.md). A pause and the notification hours [combine](preferences-pausing.md#pauses-and-notification-hours).
