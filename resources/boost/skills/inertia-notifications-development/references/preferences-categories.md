<!-- Generated from docs/preferences/categories.md with `pnpm docs:guide`. Edit the docs instead. -->

# Categories and Channels

The categories and channels in the configuration decide what the `NotificationPreferences` component shows and which notifications Laravel sends.

## Opt-In Categories

A category is on for every user until they turn it off. You may send a category only to the users who ask for it, such as product news, by making it an opt-in category:

```php
// config/inertia-notifications.php

return [
    'preferences' => [
        'categories' => [
            'product' => ['label' => 'Product updates', 'description' => 'New features and tips.', 'opt_in' => true],
        ],
    ],
];
```

Its switches show as off until the user turns them on. Adding or removing `opt_in` later only changes the switches that a user never changed.

A locked category always sends, so `locked` wins over `opt_in`.

## Grouping Categories

You may show categories in groups, such as **Activity** and **Account**, by giving each category the key of its group and listing the groups under the `groups` key:

```php
// config/inertia-notifications.php

return [
    'preferences' => [
        'groups' => [
            'activity' => ['label' => 'Activity', 'description' => 'What happens in your projects.'],
            'account' => ['label' => 'Account'],
        ],
        'categories' => [
            'comments' => ['label' => 'Comments', 'group' => 'activity'],
            'deployments' => ['label' => 'Deployments', 'group' => 'activity'],
            'billing' => ['label' => 'Billing', 'group' => 'account'],
            'security' => ['label' => 'Security', 'locked' => true, 'group' => 'account'],
        ],
    ],
];
```

The component shows each group's categories below a heading with the group's label and description, translated like those of categories. Categories without a group come first, followed by the groups in the order of the `groups` key. A group that the `groups` key does not list comes last, labeled with its key.

Groups only change how the categories are shown, not how notifications are sent.

## Turning Off a Channel

Users may also turn a channel off for every category at once, such as all email. The component shows these switches in an **All notifications** row above the categories.

While a channel is off, the package skips it for every category except the locked ones. The other switches in that column show as off and disabled, and return to their previous state once the user turns the channel back on.

The channel switches only cover the categories in the configuration. A notification without a listed category, such as a password reset, still sends while its channel is off.

Each channel has this switch by default. You may leave it out with the `global_switch` key, so users only turn the channel off per category:

```php
// config/inertia-notifications.php

return [
    'preferences' => [
        'channels' => [
            'inbox' => ['label' => 'In the app', 'via' => ['inbox', 'database', 'broadcast'], 'global_switch' => false],
            'mail' => ['label' => 'Email', 'via' => ['mail']],
        ],
    ],
];
```

The component leaves out the **All notifications** row when no channel has the switch.

## Which Notifications Are Sent

The package listens to Laravel's `NotificationSending` event and skips each channel that the user turned off for the notification's category, or for every category. The notification's other channels still send.

A notification takes its category from the `category` method of its `toInbox` message. A notification without a `toInbox` method, such as one that only sends mail, may return its category from a `notificationCategory` method:

```php
class PaymentFailed extends Notification
{
    public function notificationCategory(object $notifiable): ?string
    {
        return 'billing';
    }
}
```

A notification with both methods takes its category from the `notificationCategory` method. You may read the category that the package finds with `NotificationPreferences::category($notifiable, $notification)`.

> [!WARNING] Side effects in toInbox()
> The package calls the `toInbox` method for each channel to read the category, so keep that method free of side effects.

A notification always sends in the following cases:

- It has no category, or a category that the configuration does not list.
- Its category is locked.
- No channel in the configuration covers the Laravel channel. For example, the configuration above does not cover `slack`.
- The category does not offer the channel, such as **In the app** for billing in the configuration of the [setup](preferences-setup.md#list-the-categories).
- The notifiable is not an Eloquent model, such as an on-demand notification.

A notification in a [thread that the user muted](notification-center-component.md#muting-threads) sends none of its channels, unless it mentions the user or its category is locked.
