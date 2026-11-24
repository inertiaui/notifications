<!-- Generated from docs/preferences/component.md with `pnpm docs:guide`. Edit the docs instead. -->

# The NotificationPreferences Component

The `NotificationPreferences` component shows a switch for each category and channel. You render it on your settings page during the [setup](preferences-setup.md#render-the-component).

Each switch saves its change right away. A switch that fails to save returns to its previous state and shows an error toast, whose text is the `preferences_save_failed` [translation](translations.md):

```js
setTranslations({ preferences_save_failed: 'Je voorkeuren konden niet worden opgeslagen.' })
```

A failure that an [error toast](toasts-configuration.md#error-toasts) covers, such as a `419` response, shows only that error toast.

The component accepts the following props:

| Prop | Default | Description |
| --- | --- | --- |
| `labels` | `{}` | The text of the component. See [Labels](#labels). |
| `classes` | `{}` | Class names for the parts of the component. See [Class Names](#class-names). |
| `locale` | The browser's | The locale of the weekday names of the [notification hours](preferences-notification-hours.md), and of when the user's [other devices](#other-devices) were last active. |
| `renderCategory`, `renderGroup`, `renderChannel`, `renderEmpty` | | React only. See [Custom Markup](#custom-markup). |

## Push Notifications on This Device

While your application sends [web push](notification-center-web-push.md), the component shows a **Push** column with a switch for each category, and a control below the table that turns push on for the device the user is on. The switches choose which categories send a push, on every device of the user. The control chooses whether this device receives them.

Pushes need the notification center, so a category's **Push** switch is off and disabled while its **In the app** switch is off, such as after the user turned **In the app** off for every category. The switch keeps the user's choice, and shows it again once the category is back on in the app.

The control has a `data-state` attribute, and explains each state in a sentence:

| State | What the control shows |
| --- | --- |
| `off` | That push is off on this device, with a **Turn on for this device** button. The button asks for permission, then subscribes the device. |
| `on` | That this device gets the categories the user chose for push, with a **Turn off** button. |
| `busy` | That push is turning on or off. The button is unavailable until the request finishes. |
| `blocked` | That the user blocked notifications for the site, and that they may allow them in the browser's site settings. |
| `home-screen` | That push only works from the Home Screen on iPhone and iPad, and how to add the site there. |
| `insecure` | That push needs HTTPS, such as on a local `http://app.test` site. |
| `brave` | That Brave needs its "Use Google services for push messaging" setting, with a **Try again** button. |
| `failed` | That turning push on or off failed, with a **Try again** button. |

The control hides in a browser without web push. The column's switches still save there, as they apply to every device of the user.

Each page also keeps the device in step with the server once the user allowed notifications, such as after you rotate your VAPID keys, as [Keeping Devices in Step](notification-center-web-push.md#keeping-devices-in-step) describes. To build your own control, use [`usePush()`](preferences-custom-forms.md#push-notifications).

### Other Devices

Below the control, the component lists the user's other devices that receive pushes, such as a phone or a work laptop. Each device shows the browser and operating system of the user agent it subscribed with, such as "Safari on iOS", and when it last opened your application while push was on. Its **Remove** button stops the pushes of that device, such as a phone the user no longer has.

A removed device leaves the list at once. It comes back with an error toast when the request fails, whose text is the `preferences_push_device_remove_failed` [translation](translations.md). The device itself shows push as off the next time it opens your application, also on a page that loaded before the removal, and the user may turn push on there again. The list hides while the user has no other devices.

## Class Names

You may add your own classes to the parts of the component with the `classes` prop:

```vue
<!-- Vue -->
<NotificationPreferences :classes="{ table: 'text-base', switch: 'aria-checked:bg-emerald-600' }" />
```

```jsx
// React
<NotificationPreferences classes={{ table: 'text-base', switch: 'aria-checked:bg-emerald-600' }} />
```

The component has the following parts:

| Part | Element |
| --- | --- |
| `table` | The table |
| `head` | Each column header |
| `group` | The heading of each group |
| `row` | Each row of switches |
| `label`, `description` | The label and description of each row and of the [notification hours](preferences-notification-hours.md), the description of each group, the label and text of the [push device control](#push-notifications-on-this-device), and the name and last activity of each of the [other devices](#other-devices) |
| `badge` | The **Always on** badge of a locked category |
| `switch` | Each switch |
| `select` | Each menu of a [digest frequency](preferences-digests.md) |
| `time` | Each time field of the [notification hours](preferences-notification-hours.md) |

Your classes replace the built-in classes they conflict with, so `aria-checked:bg-emerald-600` replaces the color of a switch that is on. The [Styling](styling.md#notification-center) page lists the data attributes of each part.

## Custom Markup

You may replace the headers of the table with slots in Vue or render props in React. The switches stay the component's own, so they keep their keyboard support and accessible names:

| Vue slot | React prop | Replaces |
| --- | --- | --- |
| `category` | `renderCategory(category)` | The label, badge, and description of each category |
| `group` | `renderGroup(group)` | The label and description of each group |
| `channel` | `renderChannel(channel)` | The label of each channel's column |
| `empty` | `renderEmpty()` | The text shown when there are no categories |

```vue
<!-- Vue -->
<script setup>
import { NotificationPreferences } from '@inertiaui/notifications-vue'
import { BellIcon, MailIcon } from 'lucide-vue-next'
</script>

<template>
    <NotificationPreferences>
        <template #channel="{ channel }">
            <MailIcon v-if="channel.key === 'mail'" class="mx-auto size-4" :aria-label="channel.label" />
            <BellIcon v-else class="mx-auto size-4" :aria-label="channel.label" />
        </template>
        <template #category="{ category }">
            <span class="font-medium">{{ category.label }}</span>
            <span v-if="category.locked" class="ms-2 text-xs text-amber-700">Required</span>
        </template>
    </NotificationPreferences>
</template>
```

```jsx
// React
import { NotificationPreferences } from '@inertiaui/notifications-react'
import { BellIcon, MailIcon } from 'lucide-react'

export default function NotificationSettings() {
    return (
        <NotificationPreferences
            renderChannel={(channel) =>
                channel.key === 'mail' ? (
                    <MailIcon className="mx-auto size-4" aria-label={channel.label} />
                ) : (
                    <BellIcon className="mx-auto size-4" aria-label={channel.label} />
                )
            }
            renderCategory={(category) => (
                <>
                    <span className="font-medium">{category.label}</span>
                    {category.locked && <span className="ms-2 text-xs text-amber-700">Required</span>}
                </>
            )}
        />
    )
}
```

To change the switches too, build your own form with [`usePreferences()`](preferences-custom-forms.md).

## Labels

To translate the text of the component for the whole application, use [`setTranslations()`](translations.md) with the `preferences_` keys. To change the text of one component, pass the `labels` prop, which takes the place of the translations. The component replaces the `:category`, `:channel`, `:day`, `:start`, `:end`, `:browser`, `:platform`, `:time`, and `:device` placeholders:

| Label | Default |
| --- | --- |
| `title` | Notification preferences |
| `category` | Category |
| `toggle` | :category: :channel |
| `locked` | Always on |
| `global` | All notifications |
| `globalDescription` | Turn a channel off for every category, except those that are always on. |
| `frequency` | Frequency |
| `frequencyLabel` | :category: frequency |
| `frequencyInstant`, `frequencyHourly`, `frequencyDaily`, `frequencyWeekly` | Instantly, Hourly digest, Daily digest, Weekly digest |
| `pushDevice` | Push notifications on this device |
| `pushOff` | Off. Turn them on to get notifications on this device, even when the app is closed. |
| `pushOn` | On. This device gets the categories you chose for push notifications. |
| `pushTurnOn`, `pushTurnOff` | Turn on for this device, Turn off |
| `pushTurningOn`, `pushTurningOff` | Turning on…, Turning off… |
| `pushBlocked` | Notifications are blocked for this site. Allow them in your browser's site settings to turn on push notifications. |
| `pushHomeScreen` | On iPhone and iPad, push notifications only work from the Home Screen. Tap Share, choose Add to Home Screen, and open the app from there. |
| `pushInsecure` | Push notifications need a secure connection. Open this site over HTTPS to turn them on. |
| `pushBrave` | Brave blocks push notifications until you turn on "Use Google services for push messaging" in its privacy settings. Turn it on, then try again. |
| `pushFailed` | Push notifications could not be turned on for this device. |
| `pushFailedOff` | Push notifications could not be turned off for this device. |
| `pushRetry` | Try again |
| `pushDevices` | Other devices with push notifications |
| `pushDeviceName`, `pushDeviceUnknown` | :browser on :platform, Unknown browser |
| `pushDeviceActive` | Active :time |
| `pushDeviceRemove`, `pushDeviceRemoveLabel` | Remove, Remove :device |
| `notificationHours` | Notification hours |
| `notificationHoursDescription` | Outside these hours, emails wait and notifications arrive without a toast or a sound. Categories that are always on still send. |
| `notificationHoursStart`, `notificationHoursEnd` | From, Until |
| `notificationHoursDay` | Notification hours on :day |
| `notificationHoursOff` | Notifications wait all day |
| `notificationHoursAdd`, `notificationHoursAddLabel` | Add hours, Add hours on :day |
| `notificationHoursRemove`, `notificationHoursRemoveLabel` | Remove, Remove :start to :end on :day |
| `empty` | There are no notification preferences. |
| `loading` | Loading preferences… |
| `error`, `retry` | The preferences could not be loaded. Try again |

Screen readers read the `title` label as the table's caption, `toggle` as the name of each switch, and `frequencyLabel` as the name of each [digest frequency](preferences-digests.md) menu. Each menu offers **Instantly** and the digests that your application offers, in the order of the labels above. The switches of the **All notifications** row receive the `global` label as their `:category`, and the [notification hours](preferences-notification-hours.md) switch is named by `notificationHours`.

The [push device control](#push-notifications-on-this-device) is labeled `pushDevice`. It shows the text of its state, such as `pushBlocked`, and a button labeled `pushTurnOn`, `pushTurnOff`, or `pushRetry`. While the button works, the control shows `pushTurningOn` or `pushTurningOff`.

The list of [other devices](#other-devices) is labeled `pushDevices`. Each device shows `pushDeviceName`, or only its browser while its operating system is unknown, with `pushDeviceUnknown` in place of a browser that the package does not know. Below it, `pushDeviceActive` shows when the device was last active, such as "2 days ago" in the component's `locale`. Each remove button shows the `pushDeviceRemove` text and is named by `pushDeviceRemoveLabel`, whose `:device` is the device's name.

The notification hours show a line for each day, with the weekday's name in the component's `locale`. Each day's switch is named by `notificationHoursDay`, its time fields by `notificationHoursStart` and `notificationHoursEnd`, and its buttons by `notificationHoursAddLabel` and `notificationHoursRemoveLabel`, which show the `notificationHoursAdd` and `notificationHoursRemove` text. A day without hours shows the `notificationHoursOff` text.

## Keyboard and Screen Readers

- Each switch is a button with the `switch` role, named with its category and channel, such as "Billing: Email". <kbd>Space</kbd> and <kbd>Enter</kbd> turn it on or off.
- The switches of locked categories, those in the column of a channel that is off, and the **Push** switch of a category that is off in the app have `aria-disabled`, so they stay in the tab order and screen readers announce them as unavailable.
- The table has a caption for screen readers, and each row starts with a row header.
- The push device control's text is a polite live region, so screen readers announce each change of state. Its button is a real button, which has `aria-disabled` while push is turning on or off, and the control has `aria-busy` meanwhile.
- The list of other devices is named by its heading, and each **Remove** button is named after its device, such as "Remove Safari on iOS".
- Each day of the notification hours is a group named after the weekday. The switch of the only day with hours has `aria-disabled`, as the notification hours need a range on at least one day, and the controls of every day are unavailable while the notification hours are off.
