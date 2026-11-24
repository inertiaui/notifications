<!-- Generated from docs/translations.md with `pnpm docs:guide`. Edit the docs instead. -->

# Translations

The Vue and React components ship with English text for their buttons, tabs, empty states, error toasts, and screen reader labels. You may override any or all of it with `setTranslations()`.

The text of your toasts and notifications comes from your Laravel application, which translates it with its own translator. See the translation of [toasts](toasts-flashing-from-laravel.md#translation) and of [notifications](notification-center-sending-notifications.md#translation).

## Setting Translations

Import `setTranslations()` and pass it the translations you want to change. Register them once in your app entry file, before `createInertiaApp()`:

```js
// Vue
import { initNotifications, setTranslations } from '@inertiaui/notifications-vue'

setTranslations({
    inbox_title: 'Meldingen',
    inbox_mark_all_as_read: 'Alles als gelezen markeren',
    inbox_archive: 'Archiveren',
    toast_dismiss: 'Sluiten: :title',
})

initNotifications()
```

```js
// React
import { initNotifications, setTranslations } from '@inertiaui/notifications-react'

setTranslations({
    inbox_title: 'Meldingen',
    inbox_mark_all_as_read: 'Alles als gelezen markeren',
    inbox_archive: 'Archiveren',
    toast_dismiss: 'Sluiten: :title',
})

initNotifications()
```

`setTranslations()` merges your translations with the current ones, so the keys you leave out keep their text.

### Placeholders

String values use `:name` placeholders, which the component replaces with its parameters:

```js
setTranslations({
    inbox_bell_new: 'Meldingen, :count nieuw',
    inbox_snoozed_until: 'Gesnoozed tot :time',
})
```

The [available translations](#available-translations) list the parameters of each key.

### Plurals and Custom Formatting

For text that needs plurals or custom formatting, pass a function instead of a string. The function receives the same parameters as the placeholders and returns the text:

```js
// Vue
import { setTranslations } from '@inertiaui/notifications-vue'

setTranslations({
    inbox_show_more: ({ count }) => (count === 1 ? 'Nog 1 melding tonen' : `Nog ${count} meldingen tonen`),
})
```

```js
// React
import { setTranslations } from '@inertiaui/notifications-react'

setTranslations({
    inbox_show_more: ({ count }) => (count === 1 ? 'Nog 1 melding tonen' : `Nog ${count} meldingen tonen`),
})
```

The `inbox_bell_new` translation receives the count as the badge shows it, such as "99+", as `count`, and the number itself as `number`. This lets you choose the plural form for a capped count too:

```js
setTranslations({
    inbox_bell_new: ({ count, number }) => `Notifications, ${count} new ${number === 1 ? 'message' : 'messages'}`,
})
```

Both packages export the type of a translation as `TranslationValue`.

### Storing Translations in a Separate File

You may store the translations in a separate file. For example, create a `nl.json` file in your `resources/js` directory:

```json
{
    "inbox_title": "Meldingen",
    "inbox_mark_all_as_read": "Alles als gelezen markeren"
}
```

Then import the file and pass it to `setTranslations()`:

```js
// Vue
import { setTranslations } from '@inertiaui/notifications-vue'
import nl from './nl.json'

setTranslations(nl)
```

```js
// React
import { setTranslations } from '@inertiaui/notifications-react'
import nl from './nl.json'

setTranslations(nl)
```

## Overriding Text for One Component

A component's text props take the place of the translations for that one component, so a page may use its own wording:

| Prop or option | Translations it replaces |
| --- | --- |
| `label` of the `Toaster` | `toaster_label` |
| `dismissLabel` of the `Toaster` | `toast_dismiss` |
| `typeLabels` of the `Toaster` | `toast_type_` |
| `labels` of the `NotificationCenter` and the `NotificationList` | `inbox_` |
| `labels` of the `NotificationPreferences` | `preferences_` |
| `errorToasts` of `initNotifications()` | `error_toast_` |

The `labels` props take the keys in camel case, without their prefix, such as `markAllAsRead` for `inbox_mark_all_as_read`. Their values may be functions too:

```vue
<!-- Vue -->
<NotificationCenter :labels="{ title: 'Updates', showMore: ({ count }) => `Show ${count} more updates` }" />
```

```jsx
// React
<NotificationCenter labels={{ title: 'Updates', showMore: ({ count }) => `Show ${count} more updates` }} />
```

## Using Translations in Your Own Components

The `trans` function returns the current text of a key, with its parameters. You may use it in a custom notification item or in your own Toaster, so its text matches the built-in components:

```js
// Vue
import { trans } from '@inertiaui/notifications-vue'

const name = trans('inbox_item_control', { action: trans('inbox_archive'), title: 'Invoice paid' })
```

```js
// React
import { trans } from '@inertiaui/notifications-react'

const name = trans('inbox_item_control', { action: trans('inbox_archive'), title: 'Invoice paid' })
```

For a key without a translation, the `trans` function returns the key itself.

## Available Translations

Each key starts with the part of the package that uses it: `toaster_` and `toast_` for the Toaster, `error_toast_` for the error toasts, `inbox_` for the notification center and the `NotificationList`, and `preferences_` for the `NotificationPreferences` component.

### Toaster

| Key | Default | Parameters |
| --- | --- | --- |
| `toaster_label` | Notifications | |
| `toaster_label_with_hotkey` | :label (:hotkey) | `label`, `hotkey` |
| `toaster_hotkey_alt`, `toaster_hotkey_ctrl`, `toaster_hotkey_meta`, `toaster_hotkey_shift` | Alt, Ctrl, Meta, Shift | |
| `toaster_hotkey_separator` | + | |
| `toast_dismiss` | Dismiss: :title | `title` |
| `toast_count` | ×:count | `count` |
| `toast_type_success`, `toast_type_info`, `toast_type_warning`, `toast_type_error` | Success, Info, Warning, Error | |
| `toast_type_default`, `toast_type_loading` | None | |

The `toaster_label` text is the accessible name of the toast region. With a [keyboard shortcut](toasts-toaster.md#keyboard-and-screen-readers), the region uses `toaster_label_with_hotkey` instead, such as "Notifications (F8)". The `toast_count` text is the counter of a toast that showed more than once.

Screen readers announce the `toast_type_` word before a toast's title, such as "Error: Payment failed". Toasts of the `default` and `loading` types announce none. A [custom type](toasts-custom-toasts.md#custom-types) uses the key with its name, such as `toast_type_deployment`.

### Error Toasts

| Key | Default |
| --- | --- |
| `error_toast_403` | This action is unauthorized. |
| `error_toast_419`, `error_toast_419_description` | This page has expired. Refresh the page and try again. |
| `error_toast_429`, `error_toast_429_description` | Too many requests. Wait a moment and try again. |
| `error_toast_5xx`, `error_toast_5xx_description` | Something went wrong. Try again later. |
| `error_toast_network`, `error_toast_network_description` | You appear to be offline. Check your connection and try again. |

These are the title and description of each [error toast](toasts-configuration.md#error-toasts). An empty description leaves the description out, and you may give the 403 toast one with `error_toast_403_description`. Toasts for other statuses come from the `errorToasts` option.

### Notification Center

| Key | Default | Parameters |
| --- | --- | --- |
| `inbox_title` | Notifications | |
| `inbox_bell` | Notifications | |
| `inbox_bell_new` | Notifications, :count new | `count`, `number` |
| `inbox_bell_paused` | :label, paused | `label` |
| `inbox_all`, `inbox_unread`, `inbox_snoozed`, `inbox_archived` | All, Unread, Snoozed, Archived | |
| `inbox_mark_all_as_read`, `inbox_archive_all` | Mark all as read, Archive all | |
| `inbox_more_actions` | More actions | |
| `inbox_item_control` | :action: :title | `action`, `title` |
| `inbox_mark_as_read`, `inbox_mark_as_unread` | Mark as read, Mark as unread | |
| `inbox_archive`, `inbox_unarchive` | Archive, Move to inbox | |
| `inbox_snooze`, `inbox_unsnooze` | Snooze, Unsnooze | |
| `inbox_mute`, `inbox_unmute`, `inbox_muted` | Mute thread, Unmute thread, Thread muted | |
| `inbox_delete` | Delete | |
| `inbox_select` | Select: :title | `title` |
| `inbox_select_all`, `inbox_selected`, `inbox_selection` | Select all, :count selected, Selected notifications | `count` for `inbox_selected` |
| `inbox_read_selected`, `inbox_unread_selected` | Mark selected as read, Mark selected as unread | |
| `inbox_snooze_selected`, `inbox_unsnooze_selected` | Snooze selected, Unsnooze selected | |
| `inbox_archive_selected`, `inbox_unarchive_selected`, `inbox_delete_selected` | Archive selected, Move selected to inbox, Delete selected | |
| `inbox_clear_selection` | Clear selection | |
| `inbox_show_new` | :count new | `count` |
| `inbox_snooze_until` | Snooze until | |
| `inbox_snoozed_until` | Snoozed until :time | `time` |
| `inbox_snooze_later_today`, `inbox_snooze_tomorrow`, `inbox_snooze_next_week` | Later today, Tomorrow, Next week | |
| `inbox_pause` | Pause notifications | |
| `inbox_pause_for`, `inbox_pause_tomorrow` | For :duration, Until tomorrow | `duration` and `minutes` for `inbox_pause_for` |
| `inbox_paused_until`, `inbox_resume` | Notifications paused until :time, Resume | `time` for `inbox_paused_until` |
| `inbox_show_more`, `inbox_show_less` | Show :count more, Show less | `count` |
| `inbox_categories`, `inbox_all_categories` | Categories, All categories | |
| `inbox_unread_state` | Unread | |
| `inbox_actors_and_other`, `inbox_actors_and_others` | :name and :other, :name and :count others | `name`, `other`, and `count` |
| `inbox_empty`, `inbox_empty_unread`, `inbox_empty_snoozed`, `inbox_empty_archived` | You have no notifications. You have no unread notifications. You have no snoozed notifications. You have no archived notifications. | |
| `inbox_error`, `inbox_retry` | The notifications could not be loaded. Try again | |
| `inbox_loading`, `inbox_load_more` | Loading notifications…, Load more | |
| `inbox_view_all` | View all notifications | |
| `inbox_update_failed` | The notification could not be updated. | |
| `inbox_toast_view`, `inbox_toast_view_alt` | View, Also in your notifications. | |
| `inbox_title_count` | (:count) :title | `count`, `number`, `title` |
| `inbox_announcement` | Announcement | |

The `inbox_bell` text is the accessible name of the bell, and `inbox_bell_new` names it while there are new notifications. While notifications are [paused](notification-center-component.md#pausing-notifications), `inbox_bell_paused` names the bell, with one of the other two as `label`. Screen readers read `inbox_unread_state` for an unread notification and `inbox_announcement` for an [announcement](notification-center-announcements.md#showing-announcements).

The tooltip of each button of a notification shows its text, such as `inbox_archive`. Screen readers read `inbox_item_control` instead, with that text as `action` and the notification's title as `title`, such as "Archive: Invoice paid".

The `inbox_pause` text names the pause times in the **More actions** menu. The `inbox_pause_for` text labels each number of minutes of the [`pause.presets` option](notification-center-component.md#pausing-notifications), with the duration as the locale writes it, such as "30 minutes" or "2 hours", as `duration`, and the number itself as `minutes`. The `inbox_paused_until` text shows at the top of the panel during a pause, with the end of the pause as `time`.

The `inbox_actors_` texts name the actors of a [collapsed notification](notification-center-sending-notifications.md#collapsing-notifications), with the newest as `name`. The `inbox_show_new` text labels the button of [new notifications while scrolling](notification-center-component.md#new-notifications-while-scrolling), and `inbox_title_count` is the [tab title](notification-center-browser-alerts.md#tab-title) while notifications are unread.

The `inbox_update_failed` text is the error toast for a failed read or archive. The `inbox_toast_view` text labels the action of a notification's toast when the notification has a URL and no actions, and screen readers read `inbox_toast_view_alt` after the toast. A toast that the server [flashes for a notification](notification-center-sending-notifications.md#showing-a-toast) uses Laravel's translations of `View` and `Also in your notifications.` instead.

### Preferences

| Key | Default | Parameters |
| --- | --- | --- |
| `preferences_title` | Notification preferences | |
| `preferences_category` | Category | |
| `preferences_toggle` | :category: :channel | `category`, `channel` |
| `preferences_locked` | Always on | |
| `preferences_global` | All notifications | |
| `preferences_global_description` | Turn a channel off for every category, except those that are always on. | |
| `preferences_frequency` | Frequency | |
| `preferences_frequency_label` | :category: frequency | `category` |
| `preferences_frequency_instant` | Instantly | |
| `preferences_frequency_hourly` | Hourly digest | |
| `preferences_frequency_daily` | Daily digest | |
| `preferences_frequency_weekly` | Weekly digest | |
| `preferences_push_device` | Push notifications on this device | |
| `preferences_push_off` | Off. Turn them on to get notifications on this device, even when the app is closed. | |
| `preferences_push_on` | On. This device gets the categories you chose for push notifications. | |
| `preferences_push_turn_on` | Turn on for this device | |
| `preferences_push_turn_off` | Turn off | |
| `preferences_push_turning_on` | Turning on… | |
| `preferences_push_turning_off` | Turning off… | |
| `preferences_push_blocked` | Notifications are blocked for this site. Allow them in your browser's site settings to turn on push notifications. | |
| `preferences_push_home_screen` | On iPhone and iPad, push notifications only work from the Home Screen. Tap Share, choose Add to Home Screen, and open the app from there. | |
| `preferences_push_insecure` | Push notifications need a secure connection. Open this site over HTTPS to turn them on. | |
| `preferences_push_brave` | Brave blocks push notifications until you turn on "Use Google services for push messaging" in its privacy settings. Turn it on, then try again. | |
| `preferences_push_failed` | Push notifications could not be turned on for this device. | |
| `preferences_push_failed_off` | Push notifications could not be turned off for this device. | |
| `preferences_push_retry` | Try again | |
| `preferences_push_devices` | Other devices with push notifications | |
| `preferences_push_device_name` | :browser on :platform | `browser`, `platform` |
| `preferences_push_device_unknown` | Unknown browser | |
| `preferences_push_device_active` | Active :time | `time` |
| `preferences_push_device_remove` | Remove | |
| `preferences_push_device_remove_label` | Remove :device | `device` |
| `preferences_notification_hours` | Notification hours | |
| `preferences_notification_hours_description` | Outside these hours, emails wait and notifications arrive without a toast or a sound. Categories that are always on still send. | |
| `preferences_notification_hours_start` | From | |
| `preferences_notification_hours_end` | Until | |
| `preferences_notification_hours_day` | Notification hours on :day | `day` |
| `preferences_notification_hours_off` | Notifications wait all day | |
| `preferences_notification_hours_add` | Add hours | |
| `preferences_notification_hours_add_label` | Add hours on :day | `day` |
| `preferences_notification_hours_remove` | Remove | |
| `preferences_notification_hours_remove_label` | Remove :start to :end on :day | `start`, `end`, `day` |
| `preferences_empty` | There are no notification preferences. | |
| `preferences_loading` | Loading preferences… | |
| `preferences_error`, `preferences_retry` | The preferences could not be loaded. Try again | |
| `preferences_save_failed` | Your preferences could not be saved. | |
| `preferences_push_device_remove_failed` | The device could not be removed. | |

The [labels of the `NotificationPreferences` component](preferences-component.md#labels) describe where each text shows, such as `title` for `preferences_title`. The `preferences_push_` texts show in the [push device control](preferences-component.md#push-notifications-on-this-device) and the list of [other devices](preferences-component.md#other-devices). The `preferences_save_failed` text is the error toast for a switch that fails to save, and `preferences_push_device_remove_failed` the one for a device that fails to be removed.
