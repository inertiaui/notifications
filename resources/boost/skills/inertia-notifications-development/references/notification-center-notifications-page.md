<!-- Generated from docs/notification-center/notifications-page.md with `pnpm docs:guide`. Edit the docs instead. -->

# A Page With Every Notification

The `NotificationList` component shows every notification on a page of its own. It loads them page by page with Inertia's [infinite scroll](https://inertiajs.com/docs/v3/data-props/infinite-scroll).

First, render the page with the props of `Inbox::page()`:

```php
use Inertia\Inertia;
use InertiaUI\Notifications\Inbox;

Route::get('/notifications', function () {
    return Inertia::render('Notifications', Inbox::page());
})->middleware('auth');
```

The list's tabs and category buttons link to the current page with the `filter` and `category` query parameters. The `Inbox::page()` method reads them and gives the page three props: `filter`, `category`, and `notifications`, which holds the matching notifications of the signed-in user as an Inertia scroll prop.

The filter is `'all'`, `'unread'`, `'snoozed'`, `'archived'`, or the key of a [custom tab](notification-center-component.md#custom-tabs). A filter that does not exist lists every notification, and so do `'snoozed'` and `'archived'` while your application does not offer [snoozing or archiving](notification-center-component.md#choosing-the-actions). You may pass a `perPage` argument in place of the `per_page` [configuration option](notification-center-configuration.md), such as `Inbox::page(perPage: 50)`.

Inertia resolves the object that `Inbox::page()` returns into props, so you may pass it along with the page's other props:

```php
use Illuminate\Http\Request;

Route::get('/notifications', function (Request $request) {
    return Inertia::render('Notifications', [
        Inbox::page(),
        'team' => $request->user()->currentTeam,
    ]);
})->middleware('auth');
```

Then pass the name of the prop to the `NotificationList` component as `data`:

```vue
<!-- Vue -->
<script setup>
import { NotificationList } from '@inertiaui/notifications-vue'
</script>

<template>
    <NotificationList data="notifications" />
</template>
```

```jsx
// React
import { NotificationList } from '@inertiaui/notifications-react'

export default function Notifications() {
    return <NotificationList data="notifications" />
}
```

The list reads the filter and category from the same query parameters. Notifications that no longer match the filter, such as archived notifications on the **All** page, leave the list.

## Loading the Notifications Yourself

The `Inbox::page()` method loads the notifications with `Inbox::scroll()`, which returns the scroll prop on its own. It accepts the notifiable model, the filter, the category, and a `perPage` argument. You may load the notifications with it yourself. Then pass the filter and category that you loaded them with to the component as the `filter` and `category` props, which take the place of the query parameters.

## What the List Shows

The list offers what the panel offers, from the same [configuration](notification-center-configuration.md). Above the notifications, it shows its tabs, with **Mark all as read** and the **More actions** menu on the same row, and the [category buttons](notification-center-component.md#filtering-by-category) below them. The menu has **Archive all** and the [pause times](notification-center-component.md#pausing-notifications). On narrow screens, **Mark all as read** and the menu move above the tabs. Both **Mark all as read** and **Archive all** only change the notifications of the list's category.

Users may [select notifications](notification-center-component.md#selecting-notifications) with the checkbox over their avatar or the X key, and the selection bar stays at the bottom of the window while the page scrolls. A notification counts as seen once it has been in view on the page for a second. A notification that arrives while the user has scrolled down the page waits behind a **1 new** button, as it does in the panel.

The component accepts the following props:

| Prop | Default | Description |
| --- | --- | --- |
| `data` | | The name of the page prop that holds the notifications, such as `notifications` with `Inbox::page()`. Required. |
| `filter` | The URL's `filter` | The filter the prop was loaded with, or `'all'` without one. |
| `category` | The URL's `category` | The category the prop was loaded with, which keeps real-time notifications of other categories out. Pass `null` for every category. |
| `buffer` | `250` | How far from the end of the list, in pixels, the next page starts loading. |
| `manual` | `false` | Load the next page with a **Load more** button instead. |
| `preserveUrl` | `false` | Keep the URL instead of adding the cursor of each loaded page. |
| `maxCount` | `99` | The highest count the tabs and category buttons show. Higher counts show as "99+". |
| `labels`, `icons`, `iconResolver`, `classes`, `locale`, `group`, `snooze` | | The same as on the [`NotificationCenter`](notification-center-component.md). |

The list has the [`item`, `empty`, `header`, and `tab` slots](notification-center-custom-markup.md#custom-list-markup) in Vue, and the `renderItem`, `renderEmpty`, `renderHeader`, and `renderTab` props in React. Like the panel, it emits the `item-click` and `action` events (`onItemClick` and `onAction` in React), which you may [prevent](notification-center-component.md#opening-the-panel-and-events).
