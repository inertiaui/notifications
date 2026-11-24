<!-- Generated from docs/notification-center/custom-interfaces.md with `pnpm docs:guide`. Edit the docs instead. -->

# Custom Interfaces

The `useNotifications()` composable in Vue and hook in React return the state of the notification center and its actions. You may use it to build your own bell or panel, or to add a **Mark all as read** button to a page:

```vue
<!-- Vue -->
<script setup>
import { useNotifications } from '@inertiaui/notifications-vue'

const { counts, markAllAsRead } = useNotifications()
</script>

<template>
    <button type="button" :disabled="counts.unread === 0" @click="markAllAsRead()">Mark all as read</button>
</template>
```

```jsx
// React
import { useNotifications } from '@inertiaui/notifications-react'

export default function MarkAllAsRead() {
    const { counts, markAllAsRead } = useNotifications()

    return (
        <button type="button" disabled={counts.unread === 0} onClick={() => markAllAsRead()}>
            Mark all as read
        </button>
    )
}
```

With [server-side rendering](installation.md#server-side-rendering), the first render matches the server's HTML, and the current state shows once the component mounts. Code that reads `inboxStore` with React's `useSyncExternalStore` should pass `inboxStore.getServerSnapshot` as its third argument.

The composable and hook return the following state. In Vue, each value is a computed ref. In React, each value is a plain value:

| State | Description |
| --- | --- |
| `counts` | `{ unread, unseen }`, leaving out archived and snoozed notifications. |
| `items` | The loaded and arrived notifications, newest first, with the user's changes applied. |
| `arrived` | The notifications that arrived in real time, newest first. |
| `filter`, `category` | The selected filter, and the selected category or `null`. |
| `categoryCounts` | The unread count of each category that has unread notifications. |
| `status` | `'idle'`, `'loading'`, `'ready'`, or `'error'`. |
| `loadingMore`, `hasMore` | Whether the next page is loading, and whether there is one. |
| `moreFailed` | Whether loading the next page failed. |
| `pendingActions` | The index of the running action of each notification, by notification ID. |
| `url` | The URL of the JSON endpoints, or `undefined` while no user is signed in. |
| `user` | The `user` of the [shared prop](notification-center-configuration.md#the-shared-prop), or `undefined` while no user is signed in. |
| `channel` | The private channel of the user's broadcast notifications, or `null`. |
| `announcementsChannel` | The private channel of [published announcements](notification-center-announcements.md#real-time-updates), or `null` unless they are broadcast. |
| `allowedActions` | The [actions](notification-center-component.md#choosing-the-actions) that the user may take besides reading: `'snooze'`, `'archive'`, `'mute'`, and `'delete'`. |
| `selectable` | Whether the user may [select notifications](notification-center-component.md#selecting-notifications) to change them together. |
| `categoryFilter` | The [categories to filter by](notification-center-component.md#filtering-by-category), as labels by key. |
| `tabs` | The [custom tabs](notification-center-component.md#custom-tabs) by key, each with its `label`, `category`, and `data`. |
| `pausedUntil` | The ISO 8601 time that notifications are [paused](notification-center-component.md#pausing-notifications) until, or `null` while they are not paused. It turns `null` by itself once the time passes. |
| `canPause` | Whether your application offers [pausing](preferences-pausing.md). While it does not, `pausedUntil` is `null`. |
| `pausePresets` | The pause times of the `pause.presets` option: numbers of minutes, and `'tomorrow'`. |

It also returns the following actions:

| Action | Description |
| --- | --- |
| `load(filter, category)` | Loads the first page of the filter, in one category, or in every category with `null`. |
| `loadMore({ retry })` | Loads the next page. After a failure, it only loads again with `retry: true`. |
| `opened(tabs, { markAllAsSeen, categories })` | Call when your panel opens. It loads the list when needed and marks it as seen. Every panel shares one list, so pass the tabs and category keys of your panel to switch away from a tab or category that another panel selected. To mark only what your panel shows as seen, pass `markAllAsSeen: false` and call `batch('seen', items)`. Until `closed()`, arriving notifications show no toast, and opening closes the toasts of notifications. |
| `closed({ markAllAsSeen })` | Call when your panel closes, with the options it opened with. |
| `refresh()` | Requests the counts. |
| `receive(item, counts)` | Adds a notification from your own Echo listener. Pass the broadcast's `counts` too, so a [collapsed notification](notification-center-sending-notifications.md#collapsing-notifications) is not counted twice. |
| `receiveChange(payload)` | Applies an `InboxChanged` broadcast, with its `change` and `counts`, from your own Echo listener. |
| `markAsRead(item)`, `markAsUnread(item)` | Changes one notification. `markAsRead()` also takes the ID of a notification that no list shows. |
| `archive(item)`, `unarchive(item)` | Moves one notification to the archive, or back. |
| `snooze(item, until)`, `unsnooze(item)` | Hides one notification until a `Date` or ISO 8601 time, or moves it back. |
| `delete(item)` | Deletes one notification for good. |
| `mute(item)`, `unmute(item)` | Mutes or unmutes the [thread](notification-center-component.md#muting-threads) of the notification's group key. |
| `pause(until)`, `resume()` | [Pauses notifications](notification-center-component.md#pausing-notifications) until a future `Date` or ISO 8601 time, or resumes them. They do nothing while `canPause` is `false`. |
| `complete(item, index)` | Saves the [result](notification-center-reading-and-changing.md#action-results) of the action at the index. Also takes the ID of a notification that no list shows. |
| `batch(action, items, until)` | Runs `'read'`, `'unread'`, `'seen'`, `'archive'`, `'unarchive'`, `'snooze'`, `'unsnooze'`, or `'delete'` on the given notifications. Snoozing needs the `until` time, a `Date` or an ISO 8601 string. While `selectable` is `false`, only `'seen'` runs. |
| `markAllAsRead({ category })` | Marks the notifications of the selected category, or of every category, as read, up to the newest one loaded. A `category` option, or `null` for every category, takes the place of the selected one. |
| `markAllAsSeen()` | Marks every notification as seen, up to the newest one loaded. |
| `archiveAll({ onlyRead, category })` | Archives the notifications of the selected category, or of every category, up to the newest one loaded. With `onlyRead: true`, it only archives the read ones. It takes the `category` option of `markAllAsRead()`. |
| `open(item, event)` | Marks the notification as read and visits its URL, if it has one. A click that opens a new tab is left to the browser. |
| `runAction(item, index, event)` | Marks the notification as read and runs one of its actions, saving its `result` once it succeeds. |
| `toast` | The `toast()` function. |

Every change shows right away, and a failed request undoes only its own change. The actions that snooze, archive, mute, or delete do nothing while your application does not offer that [action](notification-center-component.md#choosing-the-actions), such as `delete(item)` by default. The same goes for `archiveAll()` and for those actions of `batch()`.

## JSON Endpoints

The `Route::inertiaNotifications` method registers the following routes, named `inertia-notifications.*`, such as `inertia-notifications.index`. Except for `/preferences` and the `/push` routes, every response contains the new `counts`, with the count keys of the [shared prop](notification-center-configuration.md#the-shared-prop), such as `unread`, `unseen`, and `categories`. The response of each of these `POST` routes also contains the `change` that the browser shares with its other tabs.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/` | One page of `items`, with `nextCursor`. Accepts `filter`, `category`, `cursor`, and `per_page` (1 to 100). |
| `GET` | `/counts` | The counts. |
| `GET` | `/{id}` | One notification or [announcement](notification-center-announcements.md#real-time-updates) of the user, as `item`. |
| `POST` | `/{id}/read`, `/{id}/unread` | Marks one notification as read or unread. |
| `POST` | `/{id}/archive`, `/{id}/unarchive` | Archives one notification, or moves it back. |
| `POST` | `/{id}/snooze`, `/{id}/unsnooze` | Snoozes one notification until the future `until` time, or moves it back. |
| `POST` | `/{id}/complete` | Saves the result of the action at the `action` index. |
| `POST` | `/{id}/mute`, `/{id}/unmute` | Mutes or unmutes the thread of the notification's group key. A notification without a group key gets a `422` response. |
| `POST` | `/{id}/delete` | Deletes one notification. |
| `POST` | `/read` | Marks every unread notification as read. |
| `POST` | `/seen` | Marks every notification as seen. |
| `POST` | `/seen/items` | Marks up to 100 notifications and announcements in `ids` as seen, such as the ones that a panel showed. |
| `POST` | `/archive` | Archives every notification, or only the read ones with `read: true`. |
| `POST` | `/batch` | Runs the `action` on up to 100 notifications in `ids`: `read`, `unread`, `seen`, `archive`, `unarchive`, `snooze`, `unsnooze`, or `delete`. The `snooze` action needs an `until` time in the future. Not found while users may not [select notifications](notification-center-component.md#selecting-notifications). |
| `POST` | `/pause`, `/resume` | [Pauses](preferences-pausing.md#json-endpoints) the user's notifications until the future `until` time, or resumes them. |
| `GET`, `POST` | `/preferences` | Reads or saves the user's [preferences](preferences-custom-forms.md#json-endpoints). |
| `POST` | `/push/subscribe`, `/push/unsubscribe` | Saves the browser's [push subscription](notification-center-web-push.md#how-it-works) for the user, or removes the one of the `endpoint`, and answers `subscribed`. Not found while push is off. |
| `GET` | `/push/devices` | The user's devices with push, in the `devices` format of [`usePush()`](preferences-custom-forms.md#push-notifications). Not found while push is off. |
| `POST` | `/push/devices/{device}/delete` | Removes the subscription of one of the user's devices by its numeric ID, and answers `removed`. A device of another user stays. Not found while push is off. |

The `/read`, `/seen`, and `/archive` endpoints accept a `category`, a `before` time, and the `ids` of the newest notifications the browser had, up to 1000. They change the notifications created before `before`, and those created at that second whose IDs are listed, so a notification that arrived in the same second is left alone.

The endpoints of an [action](notification-center-component.md#choosing-the-actions) that your application does not offer answer with a `404` response, such as `/{id}/delete` by default, and so does `/batch` for that action. The `GET /` endpoint answers with a `422` response for a filter that the list does not offer, such as `snoozed` while snoozing is not offered.

The `{id}` of a path and the `ids` of a request are the UUIDs of notifications and announcements. A path with another ID is not found, and `ids` with another ID fail validation.

The method also registers two routes that do not answer with JSON: `GET /{id}/open`, which [opens a notification from its push](notification-center-web-push.md#how-it-works) and redirects to its URL, and the service worker of web push at `/push/worker.js`. Both stay outside the groups that you register the routes in, such as a [team prefix](notification-center-teams-and-tenants.md#starter-kit-teams). The `/{id}/open` route runs the `web` middleware and the middleware of the other routes. The worker runs neither, and like the other `/push` routes, it is not found while push is off.
