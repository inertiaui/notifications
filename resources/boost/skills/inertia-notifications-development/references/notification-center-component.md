<!-- Generated from docs/notification-center/component.md with `pnpm docs:guide`. Edit the docs instead. -->

# The NotificationCenter Component

The `NotificationCenter` component shows a bell that opens a panel with the user's notifications.

The bell counts the notifications the user has not seen yet. A notification counts as seen once it has been in view in the panel for a second, and stays unread until the user opens it or marks it as read.

The panel has four tabs: **All**, **Unread**, **Snoozed**, and **Archived**, followed by your [custom tabs](#custom-tabs). **All** and **Unread** leave out snoozed and archived notifications. The **Snoozed** and **Archived** tabs only show while your application offers [snoozing and archiving](#choosing-the-actions), and a panel with one tab shows no tab bar. The list loads more notifications as the user scrolls.

The header has a **Mark all as read** button in the **All** and **Unread** tabs, and a **More actions** menu with **Archive all** in the **All** tab. You may target them with the `data-inbox-read-all` and `data-inbox-archive-all` attributes.

The [configuration file](notification-center-configuration.md) decides what users may do and which tabs and category buttons the panel shows, so every component and endpoint agrees. The props of the `NotificationCenter` component only change how it looks and behaves in the browser:

| Prop | Default | Description |
| --- | --- | --- |
| `href` | | The URL of a page with every notification. The panel links to it. |
| `badge` | `'count'` | What the bell shows: `'count'`, `'dot'`, or `'none'`. |
| `count` | `'unseen'` | What the badge counts: `'unseen'` or `'unread'` notifications. |
| `maxCount` | `99` | The highest count the badge, tabs, and category buttons show. Higher counts show as "99+". |
| `group` | `true` | Show notifications with the same group key as one. See [Grouping](#grouping). |
| `snooze` | | A function that returns the snooze times to offer. See [Snoozing](#snoozing). |
| `placement` | `'bottom-end'` | Where the panel opens. See [Placement](#placement). |
| `open` | | Whether the panel is open, as `v-model:open` in Vue. See [Opening the Panel and Events](#opening-the-panel-and-events). |
| `labels` | | Text of the component. See [Labels](#labels). |
| `icons` | `{}` | Icons by name, for notifications and the [built-in icons](icons.md#replacing-the-built-in-icons). |
| `iconResolver` | | Resolves icon names, in place of the global resolver. See [Icons](icons.md). |
| `classes` | `{}` | Class names for each part. See [Styling](styling.md#notification-center). |
| `locale` | The browser's | The locale of relative times and numbers. |

## Placement

The panel opens below the bell, aligned with its end edge. You may open it on another side with the `placement` prop, such as for a bell in a sidebar:

```vue
<!-- Vue -->
<NotificationCenter placement="right-start" />
```

```jsx
// React
<NotificationCenter placement="right-start" />
```

The prop accepts `top`, `bottom`, `left`, or `right`, optionally followed by `-start` or `-end`. The alignment follows the reading direction, and the panel moves to the other side when there is no room. On screens narrower than 40rem, the panel opens as a sheet at the bottom of the screen.

## Custom Tabs

You may add tabs in the `tabs` option of the configuration file. A tab lists the notifications of its `category`, the notifications whose [`with()` data](notification-center-sending-notifications.md) has its `data` values, or both:

```php
// config/inertia-notifications.php

return [
    'inbox' => [
        // ...
        'tabs' => [
            'production' => [
                'label' => 'Production',
                'category' => 'deployments',
                'data' => ['environment' => 'production'],
            ],
        ],
    ],
];
```

Custom tabs show after the built-in tabs. Like **All**, they leave out snoozed and archived notifications, and their labels are translated.

A tab's key may only contain letters, numbers, dashes, and underscores, and may not be the name of a built-in tab. The keys of its `data` may only contain letters, numbers, and underscores, and the values must be strings, numbers, or booleans. The package throws an `InvalidArgumentException` for a tab that breaks these rules. The `NotificationList` and `Inbox::scroll()` accept the tab keys as their filter too.

## Filtering by Category

To show a row of category buttons below the tabs, list the categories in the `category_filter` option of the configuration file. The keys are the values you pass to `InboxMessage::category()`, and the buttons show in the order of the list:

```php
// config/inertia-notifications.php

return [
    'inbox' => [
        // ...
        'category_filter' => ['comments', 'billing', 'deployments'],
    ],
];
```

Each button has the translated label of its category in the [preferences](preferences-setup.md#list-the-categories), so a key that the preferences do not list shows no button. To show a button for every category of the preferences, set the option to `true`.

To give a button a shorter label than the preferences use, such as "Reviews" for "Review requests", list the category with its label. The label is translated, and a category with its own label shows even when the preferences do not list it:

```php
// config/inertia-notifications.php

return [
    'inbox' => [
        // ...
        'category_filter' => ['comments', 'review' => 'Reviews', 'versions' => 'Versions'],
    ],
];
```

Each button shows the unread count of its category. While a category is selected, **Mark all as read** and **Archive all** only change that category.

## Grouping

Notifications with the same `InboxMessage::group()` key show as one: the newest notification, with a **Show 2 more** button for the others. You may group the notifications about one thing, such as the comments on an issue:

```php
// In the toInbox() method of a CommentPosted notification
$comment = $this->comment;

return InboxMessage::make(':name commented on issue #:number', [
    'name' => $comment->author->name,
    'number' => $comment->issue->number,
])->group("issue:{$comment->issue->id}");
```

Each notification in a group keeps its own state, so the user may read or archive one without the others. To show every notification on its own, pass `:group="false"` in Vue or `group={false}` in React.

Grouping happens in the browser, so every notification in a group still counts on the bell. To store the notifications about one thing as one notification that counts once, [collapse them](notification-center-sending-notifications.md#collapsing-notifications) when they are sent.

## Snoozing

The snooze button of a notification offers three times:

- **Later today**, three hours from now, while that is still today.
- **Tomorrow** at 9:00.
- **Next week**, on Monday at 9:00, unless Monday is tomorrow.

A snoozed notification leaves the inbox and its counts until that time, and shows in the **Snoozed** tab, where its snooze button moves it back. To bring it back as a new, unread notification at the top of the list, schedule the `inertia-notifications:unsnooze` command in your `routes/console.php` file:

```php
use Illuminate\Support\Facades\Schedule;

Schedule::command('inertia-notifications:unsnooze')->everyMinute();
```

Without the command, the notification returns in its old place with its old read state. With [changes in other sessions](notification-center-real-time-updates.md#changes-in-other-sessions) turned on, open pages show it right away.

To offer other times, pass a function that receives the current time and returns options with a `label` and an `until` date:

```js
const snoozeTimes = (now) => [
    { label: 'In an hour', until: new Date(now.getTime() + 60 * 60 * 1000) },
    { label: 'Tomorrow', until: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 8, 0) },
]
```

Pass it as `:snooze="snoozeTimes"` in Vue or `snooze={snoozeTimes}` in React. Both packages export the default options as `snoozeOptions(labels, now)`. To leave out snoozing, leave `snooze` out of the [actions](#choosing-the-actions).

## Muting Threads

A notification with a group key has a mute button. Muting the thread stops later notifications with the same key from reaching the user, such as the replies in a discussion that no longer interests them. The same button unmutes it.

The package skips every channel of a notification in a muted thread, so nothing is stored, mailed, or broadcast. A notification still goes out when its message mentions the user, or when its category is [locked](preferences-setup.md#list-the-categories):

```php
// In the toInbox() method of a ReplyPosted notification
$reply = $this->reply;

$message = InboxMessage::make(':name replied in ":title"', [
    'name' => $reply->author->name,
    'title' => $reply->discussion->title,
])->group("discussion:{$reply->discussion->id}");

return $message->mention($reply->mentionedUsers->contains($notifiable));
```

Muting covers the notifications that Laravel sends with `notify()`, not the ones you store with `Inbox::record()`. You may also mute threads from your own code, such as from a settings page:

```php
use InertiaUI\Notifications\Inbox;

Inbox::mute($user, 'discussion:3');
Inbox::unmute($user, 'discussion:3');
Inbox::isMuted($user, 'discussion:3'); // false
```

Each notification item has a `muted` field, and `useNotifications()` has `mute(item)` and `unmute(item)` for [custom items](notification-center-custom-markup.md#custom-item-markup) and [your own interface](notification-center-custom-interfaces.md).

## Choosing the Actions

Users may snooze, archive, and mute their notifications, and mark them as read or unread. You may choose the actions that your application offers with the `actions` option of the configuration file, such as to let users delete notifications for good, or to offer only archiving:

```php
// config/inertia-notifications.php

return [
    'inbox' => [
        // ...
        'actions' => ['archive', 'delete'],
    ],
];
```

The actions are `snooze`, `archive`, `mute`, and `delete`, and an empty list leaves only marking as read or unread. An action that the list leaves out has no buttons in the panel, the `NotificationList`, or the selection bar, and its endpoints answer with a `404` response, as if they did not exist. Without snoozing, the panel has no **Snoozed** tab, and without archiving, it has no **Archived** tab and its menu has no **Archive all**.

Leaving out an action keeps what users did with it:

- Snoozed notifications still return at their time.
- Archived notifications stay archived, and show in the **Archived** tab again once you add `archive` back.
- Muted threads reach users again on every channel. The package keeps the mutes, so they apply again once you add `mute` back.

A [custom item](notification-center-custom-markup.md#custom-item-markup) receives the actions as its `allowedActions` prop, and `useNotifications()` returns them as `allowedActions`. The methods of `Inbox` and of the models, such as `Inbox::mute()`, keep working in your own code.

## Selecting Notifications

Users may select a notification with the checkbox that shows over its avatar on hover, or with the X key. Once the user selects one, a bar at the bottom of the panel offers to select every loaded notification, to mark the selected ones as read or unread, and to snooze, archive or unarchive, or delete them, with the [actions](#choosing-the-actions) that your application offers.

The bar's snooze button shows the [snooze times](#snoozing) of the `snooze` prop below the bar. In the **Snoozed** tab, the bar moves the selected notifications back to the inbox instead. Archived notifications have no snooze button, so the **Archived** tab offers neither.

Each request changes up to 100 notifications, and a larger selection is sent in several requests. The selection clears once the user picks another tab or category, or closes the panel. The [`NotificationList`](notification-center-notifications-page.md#what-the-list-shows) offers the same selection. To leave out the checkboxes and the bar in both, disable the `selectable` option of the configuration file:

```php
// config/inertia-notifications.php

return [
    'inbox' => [
        // ...
        'selectable' => false,
    ],
];
```

The `POST /batch` endpoint then answers with a `404` response. The panel and the list still mark the notifications that they show as seen.

A [custom item](notification-center-custom-markup.md#custom-item-markup) receives the `selected` prop and the `onSelectedChange` function to render its own checkbox.

## Pausing Notifications

Users may pause their notifications for a while, such as during a meeting. Once you turn on pausing, as described in [Pausing Notifications](preferences-pausing.md), the **More actions** menu in the panel's header offers **For 30 minutes**, **For 1 hour**, **For 2 hours**, and **Until tomorrow**, which is 8:00 the next morning in the browser's time zone:

During a pause, notifications still show in the panel, but without a toast, a sound, or a desktop notification, and emails wait until the pause ends. Locked categories, and notifications without a category in the configuration, arrive as usual, as described in [What Waits During a Pause](preferences-pausing.md#what-waits-during-a-pause).

The top of the panel shows the end of the pause, such as "Notifications paused until 9:00 AM", with a **Resume** button. The bell shows a bell with a slash and has a `data-paused` attribute of `true`. The pause ends by itself once its time passes, also in the user's other tabs.

To offer other times, list numbers of minutes, and `'tomorrow'`, in the `presets` of the `pause` option of the configuration file:

```php
// config/inertia-notifications.php

return [
    'pause' => [
        'enabled' => true,
        'presets' => [15, 60, 240, 'tomorrow'],
    ],
];
```

The `useNotifications()` composable and hook return `pausedUntil`, `canPause`, `pause(until)`, and `resume()` for [your own interface](notification-center-custom-interfaces.md).

## New Notifications While Scrolling

A notification that arrives in real time shows at the top of the open panel. While the user has scrolled down, the panel holds it behind a **1 new** button instead, so the list does not move. The button, or scrolling back to the top, shows the held notifications. The `NotificationList` does the same while the user has scrolled down the page.

## Action Results

Once an action with a [result](notification-center-reading-and-changing.md#action-results) succeeds, the notification shows the result in place of its actions, such as **Approved**, so the user cannot also run **Decline**.

## Opening the Panel and Events

You may open and close the panel from elsewhere on the page, such as from a keyboard shortcut, with `v-model:open` in Vue, or the `open` and `onOpenChange` props in React:

```vue
<!-- Vue -->
<script setup>
import { ref } from 'vue'

const open = ref(false)
</script>

<template>
    <NotificationCenter v-model:open="open" />
    <button type="button" @click="open = true">Show notifications</button>
</template>
```

```jsx
// React
const [open, setOpen] = useState(false)

return (
    <>
        <NotificationCenter open={open} onOpenChange={setOpen} />
        <button type="button" onClick={() => setOpen(true)}>
            Show notifications
        </button>
    </>
)
```

A click outside the panel closes it first, so a button elsewhere on the page should open the panel, not toggle it.

The `item-click` event (`onItemClick` in React) receives the notification and the click event once the user opens a notification. The `action` event (`onAction`) also receives the action. You may call `event.preventDefault()` in either one to stop the panel, such as to show the notification in a modal instead:

```vue
<!-- Vue -->
<script setup>
const onItemClick = (item, event) => {
    if (item.type === 'App\\Notifications\\InvoicePaid') {
        event.preventDefault()
        showInvoice(item)
    }
}
</script>

<template>
    <NotificationCenter @item-click="onItemClick" />
</template>
```

```jsx
// React
<NotificationCenter
    onItemClick={(item, event) => {
        if (item.type === 'App\\Notifications\\InvoicePaid') {
            event.preventDefault()
            showInvoice(item)
        }
    }}
/>
```

A prevented click leaves the notification unread. The events also cover [custom items](notification-center-custom-markup.md#custom-item-markup), as long as their elements have the `data-inbox-link` attribute, or the `data-inbox-action` attribute with the index of the action.

## Labels

To translate the components for the whole application, use [`setTranslations()`](translations.md) with the `inbox_` keys. To change the text of one component, pass the `labels` prop, with the keys in camel case and without their prefix, such as `markAllAsRead` for `inbox_mark_all_as_read`:

```vue
<!-- Vue -->
<NotificationCenter :labels="{ title: 'Updates', markAllAsRead: 'Mark everything as read' }" />
```

```jsx
// React
<NotificationCenter labels={{ title: 'Updates', markAllAsRead: 'Mark everything as read' }} />
```

A label may contain the placeholders of its translation, such as `:count`, or be a function that receives them. The [Notification Center](translations.md#notification-center) section of the Translations page lists every label.

The package undoes a change that fails, such as marking a notification as read, and shows an error toast. You may change its text with the `inbox_update_failed` [translation](translations.md):

```js
setTranslations({ inbox_update_failed: 'De melding kon niet worden bijgewerkt.' })
```

## Keyboard and Screen Readers

- The bell's accessible name includes the count, such as "Notifications, 3 new", and ends with "paused" while notifications are [paused](#pausing-notifications).
- The panel is a dialog named by its heading, and opening it moves focus into it. <kbd>Escape</kbd> closes it and returns focus to the bell.
- The tabs follow the ARIA tabs pattern, with the arrow keys, <kbd>Home</kbd>, and <kbd>End</kbd>.
- <kbd>J</kbd> and <kbd>K</kbd> move to the next and the previous notification, in the panel and on the page, as do <kbd>↓</kbd> and <kbd>↑</kbd> on a focused notification.
- On a focused notification, <kbd>U</kbd>, <kbd>E</kbd>, and <kbd>H</kbd> press its read, archive, and snooze buttons, <kbd>X</kbd> selects it, and <kbd>Enter</kbd> opens it. The buttons name their key with `aria-keyshortcuts`.
- Screen readers announce unread notifications with "Unread" before the title, the selected category button as pressed, and the **1 new** button and the paused line as they appear.
- The **More actions** button follows the ARIA menu button pattern. <kbd>Enter</kbd>, <kbd>Space</kbd>, and <kbd>↓</kbd> open its menu, the arrow keys move between its items, and choosing one or pressing <kbd>Escape</kbd> closes it and returns focus to the button. After the user presses **Resume**, focus moves to the button too.
- The buttons of a notification are named with its title, such as "Archive: Invoice INV-7 paid". They show on hover and focus, and always on touch screens.
- A tooltip names each button of a notification and the **More actions** button after a short delay on hover or keyboard focus, with the key of the button, such as **Archive E**. Touch screens show no tooltips, and one tooltip shows at a time.
- Each relative time, such as "5 minutes ago", shows the full date and time on hover.
