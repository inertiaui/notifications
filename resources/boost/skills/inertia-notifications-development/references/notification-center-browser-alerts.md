<!-- Generated from docs/notification-center/browser-alerts.md with `pnpm docs:guide`. Edit the docs instead. -->

# Browser Alerts

Browser alerts reach users who are in another tab or application. The tab title and the app icon show the number of unread notifications, and a desktop notification and a sound announce each notification that arrives in real time. Each alert is off until you turn it on with `initNotifications()`.

## Tab Title

You may show the number of unread notifications in the title of every tab, such as "(3) Dashboard", with the `titleCount` option:

```js
// Vue
import { initNotifications } from '@inertiaui/notifications-vue'

initNotifications({ inbox: { titleCount: true } })
```

```js
// React
import { initNotifications } from '@inertiaui/notifications-react'

initNotifications({ inbox: { titleCount: true } })
```

The count follows the unread count of the notification center, including notifications that [arrive in real time](notification-center-real-time-updates.md). It stays in the title when the page changes the title, such as with Inertia's `<Head>` component. Counts above 99 show as "99+".

You may change the format with the `inbox_title_count` [translation](translations.md#notification-center). It receives the `count`, the uncapped `number`, and the page's `title`:

```js
setTranslations({
    inbox_title_count: ':title (:count)',
})
```

## App Badge

You may show the number of unread notifications on the icon of your installed app, such as in the dock or on the taskbar, with the `appBadge` option:

```js
// Vue
import { initNotifications } from '@inertiaui/notifications-vue'

initNotifications({ inbox: { appBadge: true } })
```

```js
// React
import { initNotifications } from '@inertiaui/notifications-react'

initNotifications({ inbox: { appBadge: true } })
```

The badge follows the same count, and clears at zero or once the user signs out. Browsers only support the [Badging API](https://developer.mozilla.org/docs/Web/API/Badging_API) for sites that the user installed as an app, so the option does nothing on other sites.

## Desktop Notifications

You may show a desktop notification for each notification that [arrives in real time](notification-center-real-time-updates.md) while no tab of your application is visible, with the `desktopNotifications` option:

```js
// Vue
import { echo } from '@laravel/echo-vue'
import { initNotifications } from '@inertiaui/notifications-vue'

initNotifications({ inbox: { echo, desktopNotifications: true } })
```

```js
// React
import { echo } from '@laravel/echo-react'
import { initNotifications } from '@inertiaui/notifications-react'

initNotifications({ inbox: { echo, desktopNotifications: true } })
```

Browsers only show desktop notifications on HTTPS sites that the user allowed, and only ask for permission after a click or another gesture. You may ask from a button with the `requestNotificationPermission` function, which resolves to `granted`, `denied`, or `default` for a closed prompt:

```vue
<!-- Vue -->
<script setup>
import { requestNotificationPermission } from '@inertiaui/notifications-vue'
</script>

<template>
    <button type="button" @click="requestNotificationPermission()">Turn on desktop notifications</button>
</template>
```

```jsx
// React
import { requestNotificationPermission } from '@inertiaui/notifications-react'

export default function DesktopNotificationsButton() {
    return (
        <button type="button" onClick={() => requestNotificationPermission()}>
            Turn on desktop notifications
        </button>
    )
}
```

Clicking a desktop notification brings the tab to the front, marks the notification as read, and visits its URL, if it has one. Notifications that the user already read or archived show none, and neither do notifications that arrive outside the user's [notification hours](preferences-notification-hours.md) or while the user [paused their notifications](preferences-pausing.md).

> [!INFO] Web Push
> Desktop notifications only show while a tab of your application is open. [Web Push](notification-center-web-push.md) reaches users with every tab closed, and on their phones. A device with push turned on may show both the push and the desktop notification. They share a tag, so browsers that replace a notification with one of the same tag show only one.

### Which Tab Alerts the User

A user with several tabs open receives each desktop notification and [sound](#sound) once, from the tab they looked at last. That tab only shows a desktop notification while it is hidden.

## Sound

You may play a sound for each notification that arrives in real time with the `sound` option. Pass `true` for a short built-in chime, or the URL of your own audio file:

```js
// Vue
import { echo } from '@laravel/echo-vue'
import { initNotifications } from '@inertiaui/notifications-vue'

initNotifications({ inbox: { echo, sound: '/sounds/notification.mp3' } })
```

```js
// React
import { echo } from '@laravel/echo-react'
import { initNotifications } from '@inertiaui/notifications-react'

initNotifications({ inbox: { echo, sound: '/sounds/notification.mp3' } })
```

The [tab that alerts the user](#which-tab-alerts-the-user) plays the sound, also while it is visible. Like desktop notifications, the sound skips notifications that the user already read or archived, and those that arrive outside the notification hours or during a pause. The tab also plays it on a device with [web push](notification-center-web-push.md) turned on, where the push may play a sound of its own.

> [!INFO] Autoplay
> Browsers only play sound in a tab that the user clicked, tapped, or typed in since it loaded.

## Options

The `initNotifications()` function accepts the following options under the `inbox` key, next to the options of the [notification center](notification-center-real-time-updates.md#options):

| Option | Default | Description |
| --- | --- | --- |
| `titleCount` | `false` | Show the unread count in the tab title. |
| `appBadge` | `false` | Show the unread count on the icon of the installed app. |
| `desktopNotifications` | `false` | Show a desktop notification for each notification that arrives while no tab is visible. |
| `sound` | `false` | Play a sound for each notification that arrives: `true` for the built-in chime, or an audio file URL. |
