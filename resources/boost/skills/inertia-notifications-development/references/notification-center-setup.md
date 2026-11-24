<!-- Generated from docs/notification-center/setup.md with `pnpm docs:guide`. Edit the docs instead. -->

# Notification Center Setup

The notification center stores Laravel notifications in their own table and shows them in two places:

- The `NotificationCenter` component shows a bell that opens a panel with the list.
- The `NotificationList` component shows every notification on a [page of its own](notification-center-notifications-page.md).

Both components share the same state, so a notification that the user reads in the panel also shows as read on the page. Users may choose which notifications they receive with the [notification preferences](preferences-setup.md).

Before you continue, complete the [installation](installation.md) steps.

## Run the Migration

Publish the migration and run it:

```bash
php artisan vendor:publish --tag=inertia-notifications-migrations
php artisan migrate
```

The tag publishes every migration of the package. The notification center uses the `inbox_notifications` table, the `inbox_mutes` table of [muted threads](notification-center-component.md#muting-threads), and the two tables of [announcements](notification-center-announcements.md), which the panel lists with the notifications.

> [!WARNING] UUID and ULID keys
> Notifiable models with UUID or ULID keys need a change to the published migrations before you run them. In each migration, change `morphs('notifiable', ...)` to `uuidMorphs('notifiable', ...)` or `ulidMorphs('notifiable', ...)`, and keep the name of the index. These columns are in the `inbox_notifications`, `inbox_mutes`, `inbox_announcement_states`, `notification_preferences`, `notification_digest_items`, and `push_subscriptions` tables.

## Add the Trait

Add the `HasInbox` trait to the notifiable model, next to Laravel's `Notifiable` trait:

```php
use Illuminate\Notifications\Notifiable;
use InertiaUI\Notifications\Concerns\HasInbox;

class User extends Authenticatable
{
    use HasInbox, Notifiable;
}
```

## Register the Routes

The panel reads and changes notifications through JSON endpoints. You should register their routes in your application's `routes/web.php` file:

```php
Route::inertiaNotifications();
```

By default, the routes use the `_inertia-notifications` prefix and the `auth` middleware. You may pass a different prefix and middleware as arguments:

```php
Route::inertiaNotifications('account/notifications', ['auth', 'verified']);
```

Each endpoint only reads and changes the notifications of the signed-in user. The [JSON Endpoints](notification-center-custom-interfaces.md#json-endpoints) section lists every route.

## Render the Notification Center

Render the `NotificationCenter` component where the bell should appear in your persistent layout:

```vue
<!-- Vue -->
<script setup>
import { NotificationCenter, Toaster } from '@inertiaui/notifications-vue'
</script>

<template>
    <header>
        <!-- ... -->
        <NotificationCenter href="/notifications" />
    </header>
    <slot />
    <Toaster />
</template>
```

```jsx
// React
import { NotificationCenter, Toaster } from '@inertiaui/notifications-react'

export default function Layout({ children }) {
    return (
        <>
            <header>
                {/* ... */}
                <NotificationCenter href="/notifications" />
            </header>
            {children}
            <Toaster />
        </>
    )
}
```

The `href` prop adds a link to [a page with every notification](notification-center-notifications-page.md) at the bottom of the panel. You may leave it out when your application has no such page. To link the [digest mail](preferences-digests.md#linking-to-your-pages) to the same page, set the `inbox_url` option of the `digests` configuration.
