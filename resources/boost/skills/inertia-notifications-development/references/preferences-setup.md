<!-- Generated from docs/preferences/setup.md with `pnpm docs:guide`. Edit the docs instead. -->

# Preferences Setup

Preferences let users choose which categories of notifications they receive on each channel, such as comments in the app but not by email. You list the categories and channels in the configuration, and the `NotificationPreferences` component shows a switch for each category and channel.

Preferences build on the [notification center setup](notification-center-setup.md), since the component needs its shared prop and the routes of `Route::inertiaNotifications()`.

## Run the Migration

The preferences live in their own `notification_preferences` table, which the package publishes with its other migrations. Publish and run the migrations:

```bash
php artisan vendor:publish --tag=inertia-notifications-migrations
php artisan migrate
```

> [!WARNING] UUID and ULID keys
> Notifiable models with UUID or ULID keys need a change to the published `notification_preferences` migration before you run it, as the [notification center setup](notification-center-setup.md#run-the-migration) describes.

## List the Categories

Publish the configuration with `php artisan vendor:publish --tag=inertia-notifications-config`. Then list your categories under the `preferences` key:

```php
// config/inertia-notifications.php

return [
    'preferences' => [
        'table' => 'notification_preferences',
        'channels' => [
            'inbox' => ['label' => 'In the app', 'via' => ['inbox', 'database', 'broadcast']],
            'mail' => ['label' => 'Email', 'via' => ['mail']],
        ],
        'categories' => [
            'comments' => ['label' => 'Comments', 'description' => 'Replies to the issues you follow.'],
            'billing' => ['label' => 'Billing', 'channels' => ['mail']],
            'security' => ['label' => 'Security', 'locked' => true],
            'product' => ['label' => 'Product updates', 'opt_in' => true],
        ],
    ],
];
```

Each channel is a column of switches and may have the following keys:

| Key | Description |
| --- | --- |
| `label` | The name of the channel. Defaults to its key. |
| `via` | The Laravel channels that the channel covers, as a notification's `via` method names them. Defaults to the channel's key. |
| `global_switch` | Whether users may turn the channel off for [every category at once](preferences-categories.md#turning-off-a-channel). Defaults to `true`. |

With the configuration above, turning off **In the app** for comments skips the `inbox`, `database`, and `broadcast` channels of comment notifications, and so their [pushes](notification-center-web-push.md#how-it-works) too. The package adds a **Push** channel while [web push](notification-center-web-push.md#configuration) is enabled, unless one of your channels covers `push`.

The keys of the channels and categories may be up to 100 characters long, and may not be `*`, which the package reserves.

Each category is a row and may have the following keys:

| Key | Description |
| --- | --- |
| `label` | The name of the category. Defaults to its key. |
| `description` | Text below the label. |
| `channels` | The channels that the category offers, as keys of `channels`. Defaults to every channel. |
| `group` | The key of the [group](preferences-categories.md#grouping-categories) that the category shows in. |
| `locked` | Whether the category always sends, such as security alerts. Its switches show as on and disabled. |
| `opt_in` | Whether the category is an [opt-in category](preferences-categories.md#opt-in-categories), which is off until the user turns it on. |
| `digest` | Whether users may receive the category in an [hourly, daily, or weekly digest](preferences-digests.md). |

The labels of the channels and the labels and descriptions of the categories go through Laravel's translator, like the text of [toasts](toasts-flashing-from-laravel.md#translation).

## Render the Component

Render the `NotificationPreferences` component on a settings page:

```vue
<!-- Vue -->
<script setup>
import { NotificationPreferences } from '@inertiaui/notifications-vue'
</script>

<template>
    <h1>Notifications</h1>
    <div class="rounded-lg border">
        <NotificationPreferences />
    </div>
</template>
```

```jsx
// React
import { NotificationPreferences } from '@inertiaui/notifications-react'

export default function NotificationSettings() {
    return (
        <>
            <h1>Notifications</h1>
            <div className="rounded-lg border">
                <NotificationPreferences />
            </div>
        </>
    )
}
```

The component renders a table without a border or background of its own, so it fits inside a card on your settings page.
