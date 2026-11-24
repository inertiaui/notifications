<!-- Generated from docs/icons.md with `pnpm docs:guide`. Edit the docs instead. -->

# Icons

The components ship with built-in Heroicons. You may replace them with your preferred icon library, and resolve the icon names that your toasts and notifications refer to. A *resolver* function maps an icon name to a Vue or React component, for one component or globally.

## Heroicons Example

A toast or notification refers to an icon by name, such as `->icon('RocketLaunchIcon')` in Laravel. To show [Heroicons](https://heroicons.com), define a resolver that maps the name to the icon component, and pass it to the component:

```vue
<!-- Vue -->
<script setup>
import { NotificationCenter } from '@inertiaui/notifications-vue'
import * as Icons from '@heroicons/vue/20/solid'

function resolveIcon(icon) {
    return Icons[icon]
}
</script>

<template>
    <NotificationCenter :icon-resolver="resolveIcon" />
</template>
```

```jsx
// React
import { NotificationCenter } from '@inertiaui/notifications-react'
import * as Icons from '@heroicons/react/20/solid'

export default function Header() {
    function resolveIcon(icon) {
        return Icons[icon]
    }

    return <NotificationCenter iconResolver={resolveIcon} />
}
```

The `Toaster`, the `NotificationCenter`, the `NotificationList`, and the `NotificationItem` accept the `iconResolver` prop. For a name that the resolver does not know, return `null` or `undefined`, and the component keeps its built-in icon.

## Resolving Icons Globally

To use one resolver in every component, register it in your app entry file with `setIconResolver`:

```js
// Vue
import { setIconResolver } from '@inertiaui/notifications-vue'
import * as Icons from '@heroicons/vue/20/solid'

setIconResolver((icon, context) => Icons[icon])
```

```js
// React
import { setIconResolver } from '@inertiaui/notifications-react'
import * as Icons from '@heroicons/react/20/solid'

setIconResolver((icon, context) => Icons[icon])
```

A component's `iconResolver` prop takes the place of the global resolver for that component. Pass `null` to `setIconResolver()` to clear the global resolver.

In Vue, a resolver returns a component, or the name of a globally registered component. In React, it returns a component, which receives the `className` of the built-in icon, or an element.

## Replacing the Built-In Icons

The resolver also receives the names of the built-in icons. To replace them, map those names to your own components:

```js
// Vue
import { setIconResolver } from '@inertiaui/notifications-vue'
import { ArchiveBoxIcon, BellAlertIcon, XCircleIcon } from '@heroicons/vue/20/solid'

setIconResolver((icon) =>
    ({
        bell: BellAlertIcon,
        archive: ArchiveBoxIcon,
        dismiss: XCircleIcon,
    })[icon],
)
```

```js
// React
import { setIconResolver } from '@inertiaui/notifications-react'
import { ArchiveBoxIcon, BellAlertIcon, XCircleIcon } from '@heroicons/react/20/solid'

setIconResolver((icon) =>
    ({
        bell: BellAlertIcon,
        archive: ArchiveBoxIcon,
        dismiss: XCircleIcon,
    })[icon],
)
```

The components use the following names:

| Name | Icon |
| --- | --- |
| `bell` | The bell of the `NotificationCenter`. |
| `notification` | A notification without an avatar, an icon, or an actor. |
| `announcement` | An [announcement](notification-center-announcements.md#showing-announcements) without an icon. |
| `read`, `unread` | The buttons that mark a notification as read or unread, also in the [selection bar](notification-center-component.md#selecting-notifications). |
| `archive`, `unarchive` | The buttons that archive a notification or move it back to the inbox, also in the selection bar. `archive` also shows next to **Archive all** in the **More actions** menu. |
| `snooze`, `unsnooze` | The buttons that snooze a notification or bring it back. `snooze` also shows next to "Snoozed until". |
| `mute`, `unmute` | The button that [mutes a thread](notification-center-component.md#muting-threads) or unmutes it. `mute` also shows next to "Thread muted". |
| `delete` | The button that [deletes a notification](notification-center-component.md#choosing-the-actions), also in the selection bar. |
| `more` | The **More actions** button in the header of the panel or the `NotificationList`. |
| `pause` | The heading of the [pause times](notification-center-component.md#pausing-notifications) in the **More actions** menu. |
| `paused` | The bell in place of `bell` while notifications are paused, and the icon of the line that tells until when. |
| `result` | The [result of an action](notification-center-reading-and-changing.md#action-results), such as "Approved", in place of the actions. |
| `empty` | A tab or list without notifications. |
| `spinner` | The loading states, and an action while it runs. |
| `dismiss` | The dismiss button of each toast, and the clear button of the selection bar. |
| `success`, `info`, `warning`, `error`, `loading`, `default` | The icon of each toast type. A [custom type](toasts-custom-toasts.md#custom-types) uses its own name, such as `deployment`. |

Your own icon names, from `->icon()` in Laravel or the `icon` option of `toast()`, go through the same resolver. For an unknown name, a toast shows the icon of its type, and a notification shows its actor's avatar or initials, or the `notification` icon.

### The Context Argument

The resolver receives a second argument, `context`, which tells where the icon renders. Its `component` key names the component, such as `NotificationCenter`, and its `part` key names the place in it, such as `bell`. You may use it to resolve the same name differently in different places:

```js
setIconResolver((icon, context) => {
    if (icon === 'spinner' && context.part === 'action') {
        return SmallSpinner
    }

    return Icons[icon]
})
```

| Component | Parts | Other keys |
| --- | --- | --- |
| `Toaster` | `type`, `icon`, `dismiss`, `action` | `toast`, and `action` for the spinner of a running action |
| `NotificationCenter` | `bell`, `more-actions`, `archive-all`, `pause`, `paused`, `loading`, `loading-more`, `empty`, `selection`, `clear-selection` | `filter` for `empty`, and `action` for `selection` |
| `NotificationList` | `more-actions`, `archive-all`, `pause`, `paused`, `loading-more`, `empty`, `selection`, `clear-selection` | `filter` for `empty`, and `action` for `selection` |
| `NotificationItem` | `media`, `toggle-read`, `snooze`, `mute`, `archive`, `delete`, `snoozed-until`, `muted`, `action`, `result` | `item`, and `action` for the spinner of a running action |
| `NotificationPreferences` | `loading`, `push-busy` | |

The `bell` part is the `bell` icon, or the `paused` icon during a pause. The `more-actions` part is the `more` icon, and the `archive-all` part is the `archive` icon of the **Archive all** item. The `type` part is the icon of the toast's type, and the `icon` part is a name from the toast's `icon` option. The `media` part is the icon of a notification, or the `notification` or `announcement` icon. The `push-busy` part is the spinner of the push device control's button. The `NotificationPreferences` component uses the global resolver only.

## The Icons Prop

The `icons` prop of the `Toaster`, the `NotificationCenter`, the `NotificationList`, and the `NotificationItem` maps names to icons for one component. It takes components in Vue and elements in React, and it accepts the same names as a resolver:

```vue
<!-- Vue -->
<script setup>
import { BellAlertIcon } from '@heroicons/vue/20/solid'
</script>

<template>
    <NotificationCenter :icons="{ bell: BellAlertIcon }" />
</template>
```

```jsx
// React
import { BellAlertIcon } from '@heroicons/react/20/solid'

<NotificationCenter icons={{ bell: <BellAlertIcon className="size-5" /> }} />
```

Each icon resolves in the following order: the component's `icons` prop, then its `iconResolver` prop or else the global resolver, and finally the built-in icon.

## Resolving an Icon in Your Own Components

You may call `resolveIcon` in a custom notification item or your own Toaster, so it shows the same icons as the built-in components. It uses the global resolver, and returns `null` without one:

```js
// Vue
import { resolveIcon } from '@inertiaui/notifications-vue'

const Icon = resolveIcon('bell', { component: 'Header', part: 'bell' })
```

```js
// React
import { resolveIcon } from '@inertiaui/notifications-react'

const Icon = resolveIcon('bell', { component: 'Header', part: 'bell' })
```

Both packages export the `IconResolverFn` and `IconContext` types, and the React package exports the `IconComponent` type.
