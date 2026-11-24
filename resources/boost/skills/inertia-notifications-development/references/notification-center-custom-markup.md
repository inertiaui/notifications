<!-- Generated from docs/notification-center/custom-markup.md with `pnpm docs:guide`. Edit the docs instead. -->

# Custom Notification Center Markup

You may replace the markup of each notification, and of the other parts of the bell and the panel, with slots in Vue or render props in React.

## Custom Item Markup

You may replace the content of each notification with the `item` slot in Vue or the `renderItem` prop in React. In Vue, the slot receives the props of the built-in item, including the notification as `item` and the current time in milliseconds as `now`. In React, the render prop receives the notification, the current time, and those props. The current time updates every minute:

```vue
<!-- Vue -->
<NotificationCenter>
    <template #item="itemProps">
        <InvoiceNotification v-if="itemProps.item.type === 'App\\Notifications\\InvoicePaid'" :item="itemProps.item" :now="itemProps.now" />
        <NotificationItem v-else v-bind="itemProps" />
    </template>
</NotificationCenter>
```

```jsx
// React
<NotificationCenter
    renderItem={(item, now, props) =>
        item.type === 'App\\Notifications\\InvoicePaid' ? <InvoiceNotification item={item} now={now} /> : <NotificationItem {...props} />
    }
/>
```

The package exports the built-in `NotificationItem` component and its `NotificationItemProps` type. You may replace the icon and text of an empty tab with the `empty` slot in Vue or the `renderEmpty` prop in React, which receive the selected filter.

Each notification item has the following fields:

| Field | Description |
| --- | --- |
| `id`, `type` | The notification's ID and type. The type is the class name, unless the notification has an `inboxType` or `databaseType` method. |
| `title`, `body`, `icon`, `image`, `url`, `actions`, `actor`, `category`, `group` | The fields of the `InboxMessage`. |
| `toast` | The type of the [toast](notification-center-sending-notifications.md#showing-a-toast) that the message asked for, or `null`. |
| `data` | The extra data from `with()`. |
| `readAt`, `seenAt`, `archivedAt`, `snoozedUntil`, `createdAt` | ISO 8601 times. All but `createdAt` may be `null`. |
| `result` | The [result](notification-center-reading-and-changing.md#action-results) of an action that ran, such as "Approved", or `null`. |
| `muted` | Whether the user muted the notification's [thread](notification-center-component.md#muting-threads). |
| `actors`, `actorCount`, `total` | Up to five newest actors with a `name` and `avatar`, the number of different actors, and the number of [collapsed](notification-center-sending-notifications.md#collapsing-notifications) notifications, or 1. |
| `revision` | The server time, in microseconds, when this copy was read, or `null` when unknown. |
| `announcement`, `expiresAt` | Whether the item is an [announcement](notification-center-announcements.md), and its expiry time or `null`. |
| `quiet` | `true` for a notification that arrived silently outside the user's [notification hours](preferences-notification-hours.md) or during a [pause](preferences-pausing.md), left out otherwise. |

<kbd>J</kbd> and <kbd>K</kbd> still move between custom items. The other [keyboard shortcuts](notification-center-component.md#keyboard-and-screen-readers) press the elements of the focused notification with these attributes:

| Attribute | Key |
| --- | --- |
| `data-inbox-toggle-read` | <kbd>U</kbd> |
| `data-inbox-toggle-archive` | <kbd>E</kbd> |
| `data-inbox-snooze` | <kbd>H</kbd> |
| `data-inbox-select` | <kbd>X</kbd> |
| `data-inbox-link` | <kbd>Enter</kbd> |

To keep these keys working, add the attributes to your own link and buttons, and name the keys with `aria-keyshortcuts`. The following `InvoiceNotification` component does so:

```vue
<!-- Vue -->
<script setup>
import { useNotifications } from '@inertiaui/notifications-vue'

defineProps({ item: Object })

const { open, markAsRead, markAsUnread, archive } = useNotifications()
</script>

<template>
    <div class="flex items-start gap-3 px-4 py-3">
        <a data-inbox-link :href="item.url" class="flex-1" @click="open(item, $event)">{{ item.title }}</a>
        <button type="button" data-inbox-toggle-read aria-keyshortcuts="U" @click="item.readAt ? markAsUnread(item) : markAsRead(item)">
            {{ item.readAt ? 'Mark as unread' : 'Mark as read' }}
        </button>
        <button type="button" data-inbox-toggle-archive aria-keyshortcuts="E" @click="archive(item)">Archive</button>
    </div>
</template>
```

```jsx
// React
import { useNotifications } from '@inertiaui/notifications-react'

export default function InvoiceNotification({ item }) {
    const { open, markAsRead, markAsUnread, archive } = useNotifications()

    return (
        <div className="flex items-start gap-3 px-4 py-3">
            <a data-inbox-link href={item.url} className="flex-1" onClick={(event) => open(item, event)}>
                {item.title}
            </a>
            <button type="button" data-inbox-toggle-read aria-keyshortcuts="U" onClick={() => (item.readAt ? markAsUnread(item) : markAsRead(item))}>
                {item.readAt ? 'Mark as unread' : 'Mark as read'}
            </button>
            <button type="button" data-inbox-toggle-archive aria-keyshortcuts="E" onClick={() => archive(item)}>
                Archive
            </button>
        </div>
    )
}
```

## Custom Panel Markup

The other parts of the bell and the panel have their own slots and render props, which receive the data and actions of their part:

| Vue slot | React prop | Replaces | Receives |
| --- | --- | --- | --- |
| `trigger` | `renderTrigger` | The content of the bell button | `open`, `count`, and `counts` |
| `badge` | `renderBadge` | The badge, while the count is above zero | `count`, and `text`, such as "99+" |
| `header` | `renderHeader` | The title, **Mark all as read**, and the **More actions** menu | `titleId`, `title`, `filter`, `category`, `unread`, `markAllAsRead()`, `canArchiveAll`, which tells whether the built-in header shows **Archive all**, `archiveAll()`, `allowedActions`, `close()`, `canPause`, `pausedUntil`, `pauseOptions`, `pause(option)`, and `resume()` |
| `tab` | `renderTab` | The content of each tab | `filter`, `label`, `selected`, and `count`, which is `null` except on the **Unread** tab |
| `loading` | `renderLoading` | The spinner while the list loads and has no notifications to show yet | Nothing |
| `error` | `renderError` | The message and button after loading fails | `more`, which is `true` for the next page, and `retry()` |
| `footer` | `renderFooter` | The **View all notifications** link | `href` and `close()` |

The following header shows the unread count next to the title:

```vue
<!-- Vue -->
<NotificationCenter>
    <template #header="{ titleId, title, unread, markAllAsRead }">
        <div class="flex items-center justify-between px-4 py-3">
            <h2 :id="titleId">{{ title }}: {{ unread }} unread</h2>
            <button type="button" @click="markAllAsRead">Read all</button>
        </div>
    </template>
</NotificationCenter>
```

```jsx
// React
<NotificationCenter
    renderHeader={({ titleId, title, unread, markAllAsRead }) => (
        <div className="flex items-center justify-between px-4 py-3">
            <h2 id={titleId}>
                {title}: {unread} unread
            </h2>
            <button type="button" onClick={markAllAsRead}>
                Read all
            </button>
        </div>
    )}
/>
```

Give the `titleId` to your heading so the panel keeps its accessible name. The bell button already names its count, so mark a custom badge with `aria-hidden="true"`.

A custom header also takes the place of the [pause times](notification-center-component.md#pausing-notifications) in the menu. You may keep pausing with `canPause`, which tells whether the built-in header would offer them, and `pauseOptions`, the times of the [`pause.presets` option](notification-center-component.md#pausing-notifications). The `pause` function counts the end of the pause from the moment you call it, and `pausedUntil` holds the end of the current pause, or `null`:

```vue
<!-- Vue -->
<NotificationCenter>
    <template #header="{ titleId, title, canPause, pausedUntil, pauseOptions, pause }">
        <div class="flex items-center justify-between px-4 py-3">
            <h2 :id="titleId">{{ title }}</h2>
            <div v-if="canPause && pausedUntil === null" class="flex gap-2">
                <button v-for="option in pauseOptions" :key="option.label" type="button" @click="pause(option)">
                    {{ option.label }}
                </button>
            </div>
        </div>
    </template>
</NotificationCenter>
```

```jsx
// React
<NotificationCenter
    renderHeader={({ titleId, title, canPause, pausedUntil, pauseOptions, pause }) => (
        <div className="flex items-center justify-between px-4 py-3">
            <h2 id={titleId}>{title}</h2>
            {canPause && pausedUntil === null && (
                <div className="flex gap-2">
                    {pauseOptions.map((option) => (
                        <button key={option.label} type="button" onClick={() => pause(option)}>
                            {option.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )}
/>
```

To show when each option ends, as the built-in menu does, both packages export `pauseEnd(preset, now = new Date())`, which returns the `Date` that a pause of the option's `preset` ends, and `pauseTime(date, now, locale)`, which formats that end in the locale, with `now` in milliseconds:

```js
const end = pauseTime(pauseEnd(option.preset), Date.now()) // "10:30 AM", or "Thu 8:00 AM" until tomorrow
```

During a pause, the panel still shows its end below the header, with a **Resume** button.

## Custom List Markup

The [`NotificationList`](notification-center-notifications-page.md) has the same `item`, `empty`, `header`, and `tab` slots, and the same `renderItem`, `renderEmpty`, `renderHeader`, and `renderTab` props. Its `header` receives the props of the panel's header without `titleId`, `title`, and `close()`, as the page has its own heading:

```vue
<!-- Vue -->
<NotificationList data="notifications">
    <template #header="{ unread, markAllAsRead }">
        <div class="flex justify-end px-4 pt-3">
            <button type="button" :disabled="unread === 0" @click="markAllAsRead">Mark {{ unread }} as read</button>
        </div>
    </template>
</NotificationList>
```

```jsx
// React
<NotificationList
    data="notifications"
    renderHeader={({ unread, markAllAsRead }) => (
        <div className="flex justify-end px-4 pt-3">
            <button type="button" disabled={unread === 0} onClick={markAllAsRead}>
                Mark {unread} as read
            </button>
        </div>
    )}
/>
```

The list's tabs and category buttons are links, so its `tab` slot only replaces the content of each link.
