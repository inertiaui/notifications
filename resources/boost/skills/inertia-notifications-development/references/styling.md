<!-- Generated from docs/styling.md with `pnpm docs:guide`. Edit the docs instead. -->

# Styling

The `theme.css` file defines semantic tokens as Tailwind CSS theme variables. You may override them after the import, in `:root` or in a wrapper element:

```css
@import 'tailwindcss';
@import '@inertiaui/notifications-vue/theme.css';

:root {
    --color-iui-toast-success: var(--color-green-600);
    --radius-iui-toast: 0.75rem;
}
```

Dark mode values follow your Tailwind `dark` variant, whether it uses the default `prefers-color-scheme` media query or a custom selector, such as the `&:is(.dark *)` selector of the Laravel starter kits.

An override in `:root` also applies in dark mode. To give a token a separate dark value, set it within the `dark` variant on `body`, since a selector such as `&:is(.dark *)` never matches `:root` itself:

```css
:root {
    --color-iui-toast-success: var(--color-green-600);
}

body {
    @variant dark {
        --color-iui-toast-success: var(--color-green-400);
    }
}
```

## Laravel Starter Kits

The Laravel React and Vue starter kits style their components with shadcn/ui variables, such as `--popover`, `--border`, and `--radius`. To give the toasts and the notification center the same colors and corners, import `shadcn.css` after the theme:

```css
/* Vue */
@import 'tailwindcss';
@import '@inertiaui/notifications-vue/theme.css';
@import '@inertiaui/notifications-vue/shadcn.css';
```

```css
/* React */
@import 'tailwindcss';
@import '@inertiaui/notifications-react/theme.css';
@import '@inertiaui/notifications-react/shadcn.css';
```

The components follow the shadcn/ui variables in dark mode too. The info, success, and warning colors and the focus ring keep the theme's values. You may still override any token in `:root`.

## Tokens

The theme defines the following tokens for toasts:

| Token | Used for |
| --- | --- |
| `--color-iui-toast-surface` | Toast background |
| `--color-iui-toast-foreground` | Title text |
| `--color-iui-toast-muted-foreground` | Description text |
| `--color-iui-toast-border` | Toast border |
| `--color-iui-toast-icon` | Dismiss icon |
| `--color-iui-toast-icon-hover` | Dismiss icon on hover |
| `--color-iui-toast-control-hover` | Dismiss button background on hover |
| `--color-iui-toast-ring` | Focus ring |
| `--color-iui-toast-action` | Outline and text of the first action button |
| `--color-iui-toast-default` | Icon of default toasts |
| `--color-iui-toast-info` | Icon of info toasts |
| `--color-iui-toast-success` | Icon of success toasts |
| `--color-iui-toast-warning` | Icon of warning toasts |
| `--color-iui-toast-error` | Icon of error toasts |
| `--color-iui-toast-loading` | Spinner of loading toasts |
| `--radius-iui-toast` | Toast and button corners |

## Class Names

To add your own classes to the parts of each toast, pass the `classes` prop:

```vue
<!-- Vue -->
<Toaster :classes="{ toast: 'shadow-2xl', title: 'font-semibold', action: 'uppercase' }" />
```

```jsx
// React
<Toaster classes={{ toast: 'shadow-2xl', title: 'font-semibold', action: 'uppercase' }} />
```

The available parts are `toast`, `icon`, `title`, `description`, `actions`, `action`, `dismiss`, and `progress`. Your classes replace the built-in classes they conflict with, so `shadow-2xl` replaces the toast's default shadow and `rounded-none` its rounded corners.

To target the Toaster from your own CSS, use the following classes and attributes:

| Selector | Element |
| --- | --- |
| `.iui-toaster` | The toast region |
| `.iui-toast-list` | The list of toasts at one position, with `data-position` and `data-expanded` attributes |
| `.iui-toast` | Each toast |
| `[data-toast-body]` | The content of each toast |
| `[data-toast-action]` | Each action button or link |
| `[data-toast-count]` | The duplicate counter, such as "×2" |
| `.iui-toast-progress` | The bar that counts down the time left, shown with the `progress` prop |
| `[data-toast-progressbar]` | The bar of a toast's [`progress`](toasts-options.md#progress) option |

Each toast has the following attributes:

| Attribute | Value |
| --- | --- |
| `data-toast-id` | The toast's ID |
| `data-type` | `default`, `success`, `info`, `warning`, `error`, `loading`, or the name of a [custom type](toasts-custom-toasts.md#custom-types) |
| `data-state` | `visible`, or `closing` during the exit animation |
| `data-front` | `true` for the newest toast in its list |
| `data-overflow` | `true` for toasts beyond `visibleToasts`, hidden while the stack is collapsed |
| `data-dismissible` | `false` for toasts that cannot be dismissed |
| `data-swiping` | `true` while the toast is dragged |
| `data-swipe-out` | `left` or `right` after a swipe dismissed the toast |

## Changing the Stack

The `theme.css` file also contains the stack layout. The Toaster measures each toast and sets the following CSS variables:

| Variable | Set on | Value |
| --- | --- | --- |
| `--toast-index` | Each toast | Its position in the list, 0 for the newest |
| `--toast-height` | Each toast | Its natural height |
| `--toast-before` | Each toast | The heights of the newer toasts in its list |
| `--toast-swipe` | Each toast | The horizontal offset while it is dragged |
| `--toast-count` | Each list | The number of open toasts |
| `--toast-visible` | Each list | The number of toasts in the collapsed stack |
| `--toast-front-height` | Each list | The height of the newest toast |
| `--toast-heights` | Each list | The heights of all open toasts |

To change the spacing and motion, override the following variables on `.iui-toast-list`:

```css
.iui-toast-list {
    --toast-offset: 1.5rem;     /* distance from the screen edge */
    --toast-gap: 0.75rem;       /* space between expanded toasts */
    --toast-peek: 1rem;         /* how far stacked toasts show behind the newest one */
    --toast-width: min(28rem, 100vw - 3rem);
    --toast-duration: 300ms;
}
```

In an application with `viewport-fit=cover`, the toasts keep at least the safe area insets from each edge, so a notch or home indicator never covers them.

## Custom Markup

You may replace the content of each toast with the `toast` slot in Vue or the `renderToast` prop in React. The Toaster still handles the stacking, timers, swiping, keyboard support, and announcements:

```vue
<!-- Vue -->
<Toaster>
    <template #toast="{ toast, dismiss, runAction }">
        <div class="flex-1">
            <p class="font-semibold">{{ toast.title }}</p>
            <p v-if="toast.description">{{ toast.description }}</p>
            <button v-for="(action, index) in toast.actions" :key="index" type="button" @click="runAction(index, $event)">
                {{ action.label }}
            </button>
        </div>
        <button v-if="toast.dismissible" type="button" :aria-label="`Dismiss: ${toast.title}`" @click="dismiss">×</button>
    </template>
</Toaster>
```

```jsx
// React
<Toaster
    renderToast={(toast, { dismiss, runAction }) => (
        <>
            <div className="flex-1">
                <p className="font-semibold">{toast.title}</p>
                {toast.description && <p>{toast.description}</p>}
                {toast.actions.map((action, index) => (
                    <button key={index} type="button" onClick={(event) => runAction(index, event)}>
                        {action.label}
                    </button>
                ))}
            </div>
            {toast.dismissible && (
                <button type="button" aria-label={`Dismiss: ${toast.title}`} onClick={dismiss}>
                    ×
                </button>
            )}
        </>
    )}
/>
```

> [!WARNING] Use runAction for actions
> Call `runAction` to run an action, so the loading state and visit handling still apply.

Pressing a link, button, or form field in a toast does not start a swipe. To keep another element from starting one, such as text the user may want to select, add the `data-toast-no-swipe` attribute:

```html
<p data-toast-no-swipe class="font-mono select-all">INV-2026-0042</p>
```

To replace only the icon, use the `icon` slot in Vue or the `renderIcon` prop in React. To add icons by name, pass the `icons` prop:

```vue
<!-- Vue -->
<script setup>
import { CloudArrowUpIcon } from '@heroicons/vue/20/solid'
</script>

<template>
    <Toaster :icons="{ upload: CloudArrowUpIcon }" />
</template>
```

```jsx
// React
import { CloudArrowUpIcon } from '@heroicons/react/20/solid'

<Toaster icons={{ upload: <CloudArrowUpIcon className="size-5" /> }} />
```

Then refer to the icon from Laravel with `->icon('upload')`, or from the browser with `{ icon: 'upload' }`. To resolve icon names with your icon library, or to replace the built-in icons in every component, see [Icons](icons.md).

## Notification Center

The notification center has tokens of its own, so you may style it differently from the toasts:

| Token | Used for |
| --- | --- |
| `--color-iui-inbox-surface` | Panel background, and the buttons over a notification on hover |
| `--color-iui-inbox-foreground` | Titles |
| `--color-iui-inbox-muted-foreground` | Body text, times, and inactive tabs |
| `--color-iui-inbox-border` | Panel border, the lines between notifications, and the border of the buttons over a notification |
| `--color-iui-inbox-icon` | Bell and the read and archive buttons |
| `--color-iui-inbox-icon-hover` | The same icons on hover |
| `--color-iui-inbox-control-hover` | Button and notification background on hover |
| `--color-iui-inbox-ring` | Focus ring |
| `--color-iui-inbox-accent` | Selected tab and category, unread counts, checkboxes, switches, the footer link, and the outline of the first action button and the new notifications pill |
| `--color-iui-inbox-accent-subtle` | Background of the selected category, the unread counts, and the first action button on hover |
| `--color-iui-inbox-badge` | Badge on the bell |
| `--color-iui-inbox-badge-foreground` | Number in the badge |
| `--color-iui-inbox-unread` | Dot next to unread notifications |
| `--color-iui-inbox-tooltip` | Background of the tooltips of the buttons |
| `--color-iui-inbox-tooltip-foreground` | Text of the tooltips |
| `--radius-iui-inbox` | Panel and bell corners, doubled for the top corners of the sheet on narrow screens |

The `NotificationCenter` and the `NotificationList` also accept the `classes` prop, with the following parts:

| Part | Element |
| --- | --- |
| `bell`, `badge`, `panel`, `list` | The bell, its badge, the panel, and the list of notifications |
| `item` | Each notification |
| `media` | The avatar or icon |
| `title`, `body` | The title and body text |
| `time` | The time, and the **Thread muted** note of a [muted thread](notification-center-component.md#muting-threads) |
| `action` | Each action and snooze time |
| `result` | The [result of an action](notification-center-reading-and-changing.md#action-results) that ran |
| `actors` | The stacked avatars and names of a [collapsed notification](notification-center-sending-notifications.md#collapsing-notifications) |
| `control` | Each read, snooze, mute, archive, and delete button, and the **More actions** button |

The `NotificationPreferences` component takes [its own parts](preferences-component.md#class-names).

To target the parts from your own CSS, use the following selectors:

| Selector | Element |
| --- | --- |
| `[data-inbox]` | The `NotificationCenter`, around the bell and the panel |
| `[data-inbox-bell]` | The bell button, with a `data-paused` attribute of `true` while notifications are [paused](notification-center-component.md#pausing-notifications) |
| `[data-inbox-badge]` | The badge |
| `.iui-inbox-panel`, `[data-inbox-panel]` | The panel, with a `data-side` attribute of the side of the bell it opened on: `bottom`, `top`, `left`, or `right`. Sheets have none. |
| `[data-inbox-read-all]` | The **Mark all as read** button in the header of the panel or the `NotificationList` |
| `[data-inbox-menu-button]` | The **More actions** button in the header of the panel or the `NotificationList` |
| `[data-inbox-menu]` | The menu of the **More actions** button, with the `[data-inbox-archive-all]` item and the [pause times](notification-center-component.md#pausing-notifications), each with the `data-inbox-pause-option` attribute |
| `[data-inbox-tooltip]` | The tooltip of a button, while it shows |
| `[data-inbox-paused]` | The line at the top of the panel or the `NotificationList` while notifications are paused, with the `[data-inbox-resume]` button |
| `[data-inbox-tab]` | Each tab, with the filter as its value. The tabs of the `NotificationList` are links, with `aria-current="page"` on the current one |
| `[data-inbox-category]` | Each category button, with the category's key as its value, or an empty value for **All categories**. Those of the `NotificationList` are links, with `aria-current="page"` on the current one |
| `[data-inbox-scroller]` | The scrolling area of the panel |
| `[data-inbox-show-new]` | The button that shows the notifications that arrived while the list was scrolled down |
| `[data-inbox-empty]` | The empty state of the panel or the `NotificationList` |
| `[data-inbox-error]` | The error that replaces the list when loading it fails |
| `[data-inbox-more-failed]` | The error that replaces the spinner when loading more notifications fails |
| `[data-inbox-retry]` | The **Try again** button after loading fails |
| `[data-inbox-view-all]` | The **View all notifications** link at the bottom of the panel |
| `[data-inbox-list]` | The `NotificationList` |
| `[data-inbox-load-more]` | The **Load more** button of a `NotificationList` with the `manual` prop |
| `[data-inbox-item]` | Each notification, with its ID in `data-inbox-id`, and `data-read`, `data-seen`, and `data-archived` attributes of `true` or `false`. An [announcement](notification-center-announcements.md#showing-announcements) also has `data-announcement` |
| `[data-inbox-group-toggle]` | The button that shows or hides the other notifications of a group |
| `[data-inbox-link]` | The title link of a notification with a URL |
| `[data-inbox-action]` | Each action of a notification, with its index as the value |
| `[data-inbox-result]` | The result of an action that ran, in place of the actions |
| `[data-inbox-actors]` | The stacked avatars and names of the actors of a collapsed notification |
| `[data-inbox-snoozed-until]` | The time a snoozed notification returns |
| `[data-inbox-toggle-read]`, `[data-inbox-snooze]`, `[data-inbox-toggle-archive]`, `[data-inbox-delete]` | The read, snooze, archive, and delete buttons of a notification |
| `[data-inbox-mute]` | The button that mutes or unmutes the thread of a notification with a group key |
| `[data-inbox-muted]` | The **Thread muted** note of a notification whose thread the user muted |
| `[data-inbox-select]` | Each notification's checkbox. While selecting is offered, the notification has `data-selected` of `true` or `false`, and the list has `data-inbox-selecting` while any are selected |
| `[data-inbox-selection]` | The selection bar, with the `[data-inbox-select-all]` checkbox, a `[data-inbox-batch]` button per action, with the action as its value, and the `[data-inbox-clear-selection]` button. The snooze times of its `snooze` button show below it in `[data-inbox-batch-snooze-options]`, each with the `data-inbox-batch-snooze-option` attribute |
| `[data-inbox-snooze-options]` | The snooze times below a notification, each with the `data-inbox-snooze-option` attribute |
| `[data-inbox-preferences]` | The `NotificationPreferences` component |
| `[data-inbox-preferences-global]` | The **All notifications** row, which turns channels off for every category |
| `[data-inbox-preference-channel]` | Each switch that turns a channel off for every category, with the channel's key as its value |
| `[data-inbox-preference-group]` | The rows of each group of categories, with the group's key as its value |
| `[data-inbox-preference-category]` | Each category's row of preferences, with the category's key as its value |
| `[data-inbox-preference]` | Each preference switch, with the category and channel keys as its value, such as `comments.mail` |
| `[data-inbox-preference-frequency]` | Each menu of a [digest frequency](preferences-digests.md), with the category's key as its value |
| `[data-inbox-push-device]` | The [push device control](preferences-component.md#push-notifications-on-this-device), below the categories, with a `data-state` attribute of `off`, `on`, `busy`, `blocked`, `home-screen`, `insecure`, `brave`, or `failed` |
| `[data-inbox-push-device-status]` | The text of the push device control's state, which screen readers announce when it changes |
| `[data-inbox-push-device-button]` | The button of the push device control: **Turn on for this device**, **Turn off**, or **Try again** |
| `[data-inbox-push-other-devices]` | The list of the user's [other devices](preferences-component.md#other-devices), below the push device control |
| `[data-inbox-push-other-device]` | Each other device, with its name and when it was last active |
| `[data-inbox-push-other-device-remove]` | The **Remove** button of each other device |
| `[data-inbox-preferences-notification-hours]` | The row of the [notification hours](preferences-notification-hours.md), below the categories |
| `[data-inbox-notification-hours]` | The switch that turns the notification hours on or off |
| `[data-inbox-notification-hours-day]` | Each day's line of the notification hours, with the day, such as `monday`, as its value |
| `[data-inbox-notification-hours-day-switch]` | The switch of each day, which is on while the day has hours |
| `[data-inbox-notification-hours-start]`, `[data-inbox-notification-hours-end]` | The time fields of each range of a day |
| `[data-inbox-notification-hours-add]`, `[data-inbox-notification-hours-remove]` | The buttons that add a range to a day and remove a range |
| `[data-inbox-preferences-empty]`, `[data-inbox-preferences-error]` | The text shown when there are no categories, or when loading the preferences fails |

The panel is a [popover](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API) in the top layer, so no parent's `overflow` or `z-index` cuts it off. It opens next to the bell, on the side of the [`placement`](notification-center-component.md#placement) prop.

To change the panel's size and motion, override the following variables on `.iui-inbox-panel`:

```css
.iui-inbox-panel {
    --inbox-width: min(30rem, 100vw - 1rem);
    --inbox-max-height: 40rem;  /* the panel is shorter when the screen has less room */
    --inbox-gap: 0.75rem;       /* space between the bell and the panel */
    --inbox-offset: 0.5rem;     /* minimum distance from the screen edge */
    --inbox-duration: 200ms;
}
```

On screens narrower than 40rem, the panel opens as a sheet at the bottom of the screen. The sheet takes 85% of the screen's height, also when the list is shorter, so its tabs stay in place when the user switches between them.
