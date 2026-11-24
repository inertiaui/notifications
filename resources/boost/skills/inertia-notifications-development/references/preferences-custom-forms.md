<!-- Generated from docs/preferences/custom-forms.md with `pnpm docs:guide`. Edit the docs instead. -->

# Custom Preferences Forms

You may build your own preferences form with the `usePreferences()` composable in Vue or hook in React. It loads the signed-in user's preferences once your component mounts, and shares its state with every `NotificationPreferences` component:

```vue
<!-- Vue -->
<script setup>
import { usePreferences } from '@inertiaui/notifications-vue'

const { channels, categories, set, receives, isDisabled } = usePreferences()
</script>

<template>
    <fieldset v-for="category in categories" :key="category.key">
        <legend>{{ category.label }}</legend>
        <template v-for="channel in channels" :key="channel.key">
            <label v-if="category.channels[channel.key] !== undefined">
                <input
                    type="checkbox"
                    :checked="receives(category, channel)"
                    :disabled="isDisabled(category, channel)"
                    @change="set(category.key, channel.key, $event.target.checked)"
                />
                {{ channel.label }}
            </label>
        </template>
    </fieldset>
</template>
```

```jsx
// React
import { usePreferences } from '@inertiaui/notifications-react'

export default function NotificationSettings() {
    const { channels, categories, set, receives, isDisabled } = usePreferences()

    return categories.map((category) => (
        <fieldset key={category.key}>
            <legend>{category.label}</legend>
            {channels.map(
                (channel) =>
                    category.channels[channel.key] !== undefined && (
                        <label key={channel.key}>
                            <input
                                type="checkbox"
                                checked={receives(category, channel)}
                                disabled={isDisabled(category, channel)}
                                onChange={(event) => set(category.key, channel.key, event.target.checked)}
                            />
                            {channel.label}
                        </label>
                    ),
            )}
        </fieldset>
    ))
}
```

It returns the following state. In Vue, each value is a computed ref, and in React a plain value:

| State | Description |
| --- | --- |
| `status` | `'idle'`, `'loading'`, `'ready'`, or `'error'`. |
| `channels` | The channels, in order. Each has a `key`, a `label`, `globalSwitch` and `enabled` for its [channel switch](preferences-categories.md#turning-off-a-channel), [`digest`](#digest-frequencies), and [`inbox` and `push`](#push-notifications). |
| `groups` | The [groups](preferences-categories.md#grouping-categories) that have categories, in order, each with a `key`, `label`, and `description`. |
| `categories` | The categories, in order. Each has a `key`, `label`, `description`, `group`, `locked`, its choice for each offered channel in `channels`, and a [digest](#digest-frequencies) `frequency`. |
| `sections` | The categories by group, as `{ group, categories }`. The categories without a group come first, with a `group` of `null`. |
| `notificationHours` | The user's [notification hours](preferences-notification-hours.md) as `{ enabled, days }`, with a list of ranges for each day from `monday` to `sunday`, or `null` while the application does not offer them. |
| `frequencies` | The [digest frequencies](#digest-frequencies) that the application offers, `'instant'` first. |

It also returns the following actions:

| Action | Description |
| --- | --- |
| `set(category, channel, enabled)` | Turns a category on or off for one channel, by their keys. Locked categories stay on. |
| `setChannel(channel, enabled)` | Turns a channel with `globalSwitch` on or off for every category, by its key. |
| `setFrequency(category, frequency)`, `frequencyApplies(category, channels)` | Sets and checks the [digest frequency](#digest-frequencies) of a category. |
| `setNotificationHours(changes)` | Changes the [notification hours](#notification-hours), such as `{ enabled: true }` or `{ days: { saturday: [] } }`. |
| `receives(category, channel)` | Whether the user receives a category on a channel, given as objects of the state: always for a locked category, otherwise while the category and the channel are on. [Pushes](#push-notifications) also need the category in the notification center. |
| `isDisabled(category, channel)` | Whether the user's choice for a category on a channel cannot change, as the category is locked, the channel is off, or the channel sends [pushes](#push-notifications) while the user does not receive the category in the notification center. |
| `load()` | Loads the preferences again, such as after an error. |

A category's `channels` keeps the user's choice while its channel is off, and its push choice while the user does not receive it in the notification center, so use `receives` to show what the user gets. Every change shows right away and saves in the background. A change that fails to save is undone, and shows the component's [error toast](preferences-component.md).

## Digest Frequencies

Each category has a `frequency` of `'instant'`, `'hourly'`, `'daily'`, or `'weekly'`, or `null` for a category without digests. The `frequencies` state lists the frequencies that your application offers, such as `['instant', 'hourly', 'daily', 'weekly']`, and each channel has a `digest` key that tells whether digests hold it:

```vue
<!-- Vue -->
<script setup>
import { usePreferences } from '@inertiaui/notifications-vue'

const { channels, categories, frequencies, setFrequency, frequencyApplies } = usePreferences()

const names = { instant: 'Instantly', hourly: 'Once an hour', daily: 'Once a day', weekly: 'Once a week' }
</script>

<template>
    <template v-for="category in categories" :key="category.key">
        <label v-if="category.frequency !== null">
            {{ category.label }}
            <select
                :value="category.frequency"
                :disabled="!frequencyApplies(category, channels)"
                @change="setFrequency(category.key, $event.target.value)"
            >
                <option v-for="frequency in frequencies" :key="frequency" :value="frequency">{{ names[frequency] }}</option>
            </select>
        </label>
    </template>
</template>
```

```jsx
// React
import { usePreferences } from '@inertiaui/notifications-react'

const names = { instant: 'Instantly', hourly: 'Once an hour', daily: 'Once a day', weekly: 'Once a week' }

export default function DigestSettings() {
    const { channels, categories, frequencies, setFrequency, frequencyApplies } = usePreferences()

    return categories
        .filter((category) => category.frequency !== null)
        .map((category) => (
            <label key={category.key}>
                {category.label}
                <select
                    value={category.frequency}
                    disabled={!frequencyApplies(category, channels)}
                    onChange={(event) => setFrequency(category.key, event.target.value)}
                >
                    {frequencies.map((frequency) => (
                        <option key={frequency} value={frequency}>
                            {names[frequency]}
                        </option>
                    ))}
                </select>
            </label>
        ))
}
```

The `setFrequency(category, frequency)` action saves the change like the switches, along with the browser's timezone. It ignores a frequency that `frequencies` does not list. The `frequencyApplies(category, channels)` helper tells whether the user receives the category on a channel that digests hold.

## Notification Hours

The `notificationHours` state lists the ranges of each day, such as `['09:00-12:00', '13:00-17:00']`, in the user's timezone. The `setNotificationHours(changes)` action takes whether they are `enabled` and the `days` that change, and saves them like `setFrequency`. Each day you pass replaces that day's ranges, and an empty list turns the day off:

```vue
<!-- Vue -->
<script setup>
import { usePreferences } from '@inertiaui/notifications-vue'

const { notificationHours, setNotificationHours } = usePreferences()

const setDay = (day, ranges) => setNotificationHours({ days: { [day]: ranges } })

const setTime = (day, index, part, time) => {
    const ranges = notificationHours.value.days[day]
    const [start, end] = ranges[index].split('-')

    setDay(day, ranges.with(index, part === 'start' ? `${time}-${end}` : `${start}-${time}`))
}
</script>

<template>
    <fieldset v-if="notificationHours">
        <label>
            <input type="checkbox" :checked="notificationHours.enabled" @change="setNotificationHours({ enabled: $event.target.checked })" />
            Only send emails and alerts during these hours
        </label>
        <div v-for="(ranges, day) in notificationHours.days" :key="day">
            <label class="capitalize">
                <input type="checkbox" :checked="ranges.length > 0" @change="setDay(day, $event.target.checked ? ['09:00-17:00'] : [])" />
                {{ day }}
            </label>
            <div v-for="(range, index) in ranges" :key="index">
                <input type="time" :value="range.split('-')[0]" @change="setTime(day, index, 'start', $event.target.value)" />
                <input type="time" :value="range.split('-')[1]" @change="setTime(day, index, 'end', $event.target.value)" />
                <button v-if="ranges.length > 1" type="button" @click="setDay(day, ranges.toSpliced(index, 1))">Remove</button>
            </div>
            <button v-if="ranges.length > 0" type="button" @click="setDay(day, [...ranges, '19:00-21:00'])">Add evening hours</button>
        </div>
    </fieldset>
</template>
```

```jsx
// React
import { usePreferences } from '@inertiaui/notifications-react'

export default function NotificationHoursSettings() {
    const { notificationHours, setNotificationHours } = usePreferences()

    if (!notificationHours) {
        return null
    }

    const setDay = (day, ranges) => setNotificationHours({ days: { [day]: ranges } })

    const setTime = (day, index, part, time) => {
        const ranges = notificationHours.days[day]
        const [start, end] = ranges[index].split('-')

        setDay(day, ranges.with(index, part === 'start' ? `${time}-${end}` : `${start}-${time}`))
    }

    return (
        <fieldset>
            <label>
                <input type="checkbox" checked={notificationHours.enabled} onChange={(event) => setNotificationHours({ enabled: event.target.checked })} />
                Only send emails and alerts during these hours
            </label>
            {Object.entries(notificationHours.days).map(([day, ranges]) => (
                <div key={day}>
                    <label className="capitalize">
                        <input type="checkbox" checked={ranges.length > 0} onChange={(event) => setDay(day, event.target.checked ? ['09:00-17:00'] : [])} />
                        {day}
                    </label>
                    {ranges.map((range, index) => (
                        <div key={index}>
                            <input type="time" value={range.split('-')[0]} onChange={(event) => setTime(day, index, 'start', event.target.value)} />
                            <input type="time" value={range.split('-')[1]} onChange={(event) => setTime(day, index, 'end', event.target.value)} />
                            {ranges.length > 1 && (
                                <button type="button" onClick={() => setDay(day, ranges.toSpliced(index, 1))}>
                                    Remove
                                </button>
                            )}
                        </div>
                    ))}
                    {ranges.length > 0 && (
                        <button type="button" onClick={() => setDay(day, [...ranges, '19:00-21:00'])}>
                            Add evening hours
                        </button>
                    )}
                </div>
            ))}
        </fieldset>
    )
}
```

Each range is two times of day with a dash between them, and the action sorts the ranges of a day by start. A range that ends before or when it starts runs past midnight, so `'22:00-02:00'` on Monday ends at 02:00 on Tuesday, and `'00:00-00:00'` covers the whole day. The action ignores a change with a range in any other format, and a change that leaves no range on any day, as the notification hours need at least one range.

## Push Notifications

The `usePush()` composable in Vue and hook in React tells whether this device receives [web push](notification-center-web-push.md) and why it cannot, and returns the actions that turn push on and off for this device. It shares its state with the [device control](preferences-component.md#push-notifications-on-this-device) of the `NotificationPreferences` component:

```vue
<!-- Vue -->
<script setup>
import { usePush } from '@inertiaui/notifications-vue'

const { available, subscribed, busy, reason, subscribe, unsubscribe } = usePush()

const hints = {
    insecure: 'Push notifications need HTTPS.',
    'home-screen': 'Add this site to your Home Screen to get push notifications.',
    blocked: "Allow notifications for this site in your browser's settings.",
}
</script>

<template>
    <div v-if="available && reason !== 'unsupported'">
        <p v-if="hints[reason]">{{ hints[reason] }}</p>
        <button v-else-if="subscribed" type="button" :disabled="busy" @click="unsubscribe()">Stop push notifications on this device</button>
        <button v-else type="button" :disabled="busy" @click="subscribe()">Get push notifications on this device</button>
    </div>
</template>
```

```jsx
// React
import { usePush } from '@inertiaui/notifications-react'

const hints = {
    insecure: 'Push notifications need HTTPS.',
    'home-screen': 'Add this site to your Home Screen to get push notifications.',
    blocked: "Allow notifications for this site in your browser's settings.",
}

export default function PushSettings() {
    const { available, subscribed, busy, reason, subscribe, unsubscribe } = usePush()

    if (!available || reason === 'unsupported') {
        return null
    }

    if (hints[reason]) {
        return <p>{hints[reason]}</p>
    }

    return subscribed ? (
        <button type="button" disabled={busy} onClick={() => unsubscribe()}>
            Stop push notifications on this device
        </button>
    ) : (
        <button type="button" disabled={busy} onClick={() => subscribe()}>
            Get push notifications on this device
        </button>
    )
}
```

It returns the following state:

| State | Description |
| --- | --- |
| `available` | Whether your application sends web push. |
| `supported` | Whether this browser can receive pushes. |
| `permission` | The browser's permission for notifications: `'default'`, `'granted'`, or `'denied'`. |
| `subscribed` | Whether this device receives the signed-in user's pushes. |
| `busy` | Whether push is turning on or off for this device. |
| `reason` | Why push cannot turn on, or why the last request failed, as listed below. `null` while nothing is in the way. |
| `request` | The request that turns push on or off for this device while it runs, or after it failed, as an object with an `action` of `'subscribe'` or `'unsubscribe'` and a `status` of `'pending'`, `'brave'`, or `'failed'`. `null` once the request succeeded. |
| `deviceState` | The `data-state` of the component's device control in this state, or `null` while your application sends no web push or the browser has no web push. The component also hides the control while no channel of the preferences sends push, such as while they load. |
| `devices` | The devices that receive the user's pushes, the most recently active first, once `loadDevices()` loaded them. `null` before. |

The `reason` is one of the following:

| Reason | Description |
| --- | --- |
| `'insecure'` | The page is not served over HTTPS or from `localhost`, so the browser offers no service workers. |
| `'unsupported'` | The browser has no web push. |
| `'home-screen'` | The page runs in Safari on an iPhone or iPad, which only offers push to a site opened from the Home Screen. |
| `'blocked'` | The user blocked notifications for the site. |
| `'brave'` | Brave could not subscribe, as its "Use Google services for push messaging" setting is off. |
| `'failed'` | Registering the service worker, subscribing, or saving the subscription failed. |

It also returns the following actions:

| Action | Description |
| --- | --- |
| `subscribe()` | Asks for permission, registers the service worker, subscribes the device, and saves the subscription. A subscription that fails to save is undone, so the browser and the server agree. |
| `unsubscribe()` | Removes the subscription from the server, then from the browser. |
| `loadDevices()` | Loads the user's devices into `devices`. Call it once your list of devices shows. |
| `removeDevice(id)` | Removes the subscription of another device, which leaves `devices` at once and comes back with an error toast when the request fails. Use `unsubscribe()` for this device, which also removes the subscription from the browser. |

Browsers only ask for permission after a click or another gesture, so call `subscribe()` from a click handler. After a `'brave'` or `'failed'` reason, the `request` tells which action failed, and calling that action again tries again.

Each of the `devices` has the following fields, which the component's [list of other devices](preferences-component.md#other-devices) shows. `devices` loads again once this device turns push on or off:

| Field | Description |
| --- | --- |
| `id` | The key of the device, which `removeDevice()` takes. |
| `browser` | The name of the browser, such as `'Chrome'`, or `null` for a browser that the package does not know. |
| `platform` | The operating system, such as `'macOS'`, or `null` for one that the package does not know. |
| `activeAt` | When the device last opened your application while push was on, or turned push on, as an ISO 8601 string. |
| `current` | Whether this is the device of the page. |

The column of switches of the push channel, whose `push` is `true`, works like any other channel: each category's choice for the channel decides which categories send a push to the devices that turned push on. Pushes need the notification center, which the channel whose `inbox` is `true` covers, so `receives()` returns `false` and `isDisabled()` returns `true` for the push channel of a category that the user does not receive on that channel. The category keeps its push choice, which `receives()` returns again once the user receives the category in the notification center.

## JSON Endpoints

`Route::inertiaNotifications()` registers the following routes, named `inertia-notifications.preferences` and `inertia-notifications.preferences.update`. They have the same prefix and middleware as the [notification center's routes](notification-center-custom-interfaces.md#json-endpoints):

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/preferences` | The channels and categories, with the user's choices. |
| `POST` | `/preferences` | Saves the choices described below. Returns the same response as `GET`. |

Both routes return the following format:

```json
{
    "channels": [
        { "key": "inbox", "label": "In the app", "globalSwitch": true, "enabled": true, "digest": false, "inbox": true, "push": false },
        { "key": "mail", "label": "Email", "globalSwitch": true, "enabled": false, "digest": true, "inbox": false, "push": false }
    ],
    "groups": [
        { "key": "account", "label": "Account", "description": null }
    ],
    "categories": [
        {
            "key": "billing",
            "label": "Billing",
            "description": null,
            "group": "account",
            "locked": false,
            "channels": { "mail": false },
            "frequency": null
        }
    ],
    "frequencies": ["instant", "hourly", "daily", "weekly"],
    "notificationHours": null
}
```

A channel's `enabled` is `false` while the user turned it off for every category, and always `true` without `globalSwitch`. The `notificationHours` key is `null` while the application does not offer them. The other fields match the `usePreferences()` state above.

The `POST` route takes any of the following keys: the choices by category and channel in `preferences`, the channel switches in `channels`, the [digest frequencies](#digest-frequencies) in `frequencies`, and the [notification hours](#notification-hours) in `notificationHours`, with the browser's `timezone`:

```json
{
    "preferences": { "billing": { "mail": false } },
    "channels": { "mail": false },
    "frequencies": { "comments": "daily" },
    "notificationHours": { "enabled": true, "days": { "saturday": [], "sunday": ["10:00-12:00"] } },
    "timezone": "Europe/Amsterdam"
}
```

The route ignores locked categories, channels without `globalSwitch`, frequencies of categories without digests, and categories and channels that the configuration does not list. Each day in `notificationHours.days` replaces that day's ranges. The route answers with a `422` response for a frequency that the application does not offer, an unknown timezone, a range that is not two times of day, or notification hours without a range on any day.
