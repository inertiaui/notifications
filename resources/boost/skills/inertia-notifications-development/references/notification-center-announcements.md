<!-- Generated from docs/notification-center/announcements.md with `pnpm docs:guide`. Edit the docs instead. -->

# Announcements

You may show one message to many users, such as a maintenance window or a new feature, by publishing an announcement. The package stores an announcement once, so users who sign up after you publish it see it too:

```php
use InertiaUI\Notifications\Announcement;

Announcement::make('Scheduled maintenance on Sunday')
    ->body('The app is read-only from 02:00 to 03:00 UTC.')
    ->action('Status page', '/status')
    ->expiresAt(now()->next('Monday'))
    ->publish();
```

The bell counts the announcement, and users read, archive, snooze, and select it like a notification.

An announcement has the `body`, `icon`, `image`, `url`, `action`, `actions`, `category`, and `with` methods of an [`InboxMessage`](notification-center-sending-notifications.md). The title, body, and action labels may be translation keys, which the package [translates](notification-center-sending-notifications.md#translation) in the locale of each reader:

```php
use InertiaUI\Notifications\Announcement;
use InertiaUI\Notifications\ToastAction;

Announcement::make('announcements.maintenance', ['day' => 'Sunday'])
    ->action(ToastAction::make('announcements.status')->url('/status'))
    ->publish();
```

An announcement shows no toast, and its actions may not have a [result](notification-center-reading-and-changing.md#action-results). The `publish` method throws an `InvalidArgumentException` for such an action.

## Audiences

By default, an announcement shows to every user. You may define an audience in the `boot` method of your `AppServiceProvider`. Its callback receives the user and the audience's parameters, and returns whether the user belongs to the audience:

```php
use App\Models\User;
use InertiaUI\Notifications\Announcement;

// In the boot() method of your AppServiceProvider
Announcement::defineAudience('admins', fn (User $user): bool => $user->is_admin);
Announcement::defineAudience('plan', fn (User $user, string ...$plans): bool => in_array($user->plan, $plans, true));
```

The callback must return `true` or `false`. Any other result, such as `null`, `1`, or a collection, throws a `LogicException`, so a mistake in a callback never shows an announcement to users outside its audience. You should cast attributes such as `is_admin` to `boolean` on the model, since the database may return them as integers.

Then pass the name of the audience, and its parameters, to the `audience` method:

```php
use InertiaUI\Notifications\Announcement;

Announcement::make('Pro plans now include 10 seats')
    ->audience('plan', 'pro', 'team')
    ->publish();
```

An audience may also be an invokable class, which the container resolves:

```php
namespace App\Audiences;

use App\Models\User;

class TrialUsers
{
    public function __invoke(User $user): bool
    {
        return $user->onTrial();
    }
}
```

```php
use App\Audiences\TrialUsers;
use InertiaUI\Notifications\Announcement;

Announcement::make('Your trial includes every feature')
    ->audience(TrialUsers::class)
    ->publish();
```

The package checks the audience on every read, so users who join it later see the announcement, and users who leave it no longer do. An audience that is no longer defined includes nobody. An audience typed for one model, such as `fn (User $user)`, includes no other notifiable model, such as a team that reads its own notification center. A callback defined in a model may type its user as `self` or `parent`. The parameters may not contain commas.

> [!WARNING] Keep audiences fast
> Every Inertia page of a signed-in user checks the audiences of the announcements that have not expired. Read what an audience needs from the user model or a cached value instead of running slow queries.

## Expiry

The `expiresAt` method sets the time the announcement leaves every notification center, including the **Archived** tab. Open lists drop it on their next update. Without an expiry, an announcement stays until you delete it or prune it.

Laravel's `model:prune` command deletes expired announcements and those older than the [`prune_after_days`](notification-center-configuration.md) option. You should add the announcement model to its schedule:

```php
use Illuminate\Support\Facades\Schedule;
use InertiaUI\Notifications\Models\InboxAnnouncement;
use InertiaUI\Notifications\Models\InboxNotification;

Schedule::command('model:prune', [
    '--model' => [InboxNotification::class, InboxAnnouncement::class],
])->daily();
```

## Read and Archived State

Each user reads, archives, snoozes, and marks an announcement as seen for themselves. The package stores the user's state in the `inbox_announcement_states` table once the user first changes the announcement.

The bulk actions, such as **Mark all as read**, and the [selection bar](notification-center-component.md#selecting-notifications) include announcements. A snoozed announcement returns to its old place once the snooze ends, since the [unsnooze command](notification-center-component.md#snoozing) only brings back notifications. With the `delete` [action](notification-center-component.md#choosing-the-actions), deleting an announcement only removes it for that user.

## Showing Announcements

Each announcement has the [fields of a notification](notification-center-custom-markup.md#custom-item-markup), with `type` set to `announcement`, `announcement` set to `true`, and its expiry in `expiresAt`. Its list item has a `data-announcement` attribute for styling:

```css
[data-inbox-item][data-announcement] {
    background-color: var(--color-amber-50);
}
```

An announcement without an icon shows the `announcement` [icon](icons.md#replacing-the-built-in-icons), a megaphone. Screen readers hear the `inbox_announcement` [translation](translations.md#notification-center) before its title. A [custom item](notification-center-custom-markup.md#custom-item-markup) may check the `announcement` field:

```vue
<!-- Vue -->
<NotificationCenter>
    <template #item="itemProps">
        <AnnouncementBanner v-if="itemProps.item.announcement" :item="itemProps.item" />
        <NotificationItem v-else v-bind="itemProps" />
    </template>
</NotificationCenter>
```

```jsx
// React
<NotificationCenter
    renderItem={(item, now, props) => (item.announcement ? <AnnouncementBanner item={item} /> : <NotificationItem {...props} />)}
/>
```

## Categories and Tabs

An announcement with a `category` shows in that category of the [category filter](notification-center-component.md#filtering-by-category), and in the [custom tabs](notification-center-component.md#custom-tabs) whose category and `data` values it matches. The `with` method sets the data that the tabs compare.

The announcement also follows the user's [preferences](preferences-setup.md) of its category for the `inbox` channel, including opt-in and locked categories.

## Teams and Tenants

You may give an announcement a [context](notification-center-teams-and-tenants.md) with the `for` method, such as the team whose members should see it:

```php
use InertiaUI\Notifications\Announcement;

Announcement::make('Your team now has a shared inbox')
    ->for($team)
    ->publish();
```

The announcement then only shows while `Inbox::resolveContextUsing()` resolves that context, and shows to nobody in an application without a context resolver. Announcements without a context show in every context.

## Real-Time Updates

Users see a new announcement on their next Inertia visit or [polling](notification-center-real-time-updates.md#polling) request. You may show it on open pages right away with the `broadcast_announcements` option, which uses the setup of [broadcast notifications](notification-center-real-time-updates.md#broadcast-notifications):

```php
// config/inertia-notifications.php

return [
    'inbox' => [
        // ...
        'broadcast_announcements' => true,
    ],
];
```

Publishing then broadcasts the `InertiaUI\Notifications\Events\AnnouncementPublished` event on the private `inertiaui.announcements` channel, which every signed-in user may listen on. The event holds the announcement's ID and no content, so each open page requests the announcement from the server, which only returns it to users in its audience.

The announcement plays the [sound](notification-center-browser-alerts.md#sound) and shows the [desktop notification](notification-center-browser-alerts.md#desktop-notifications) that you enabled, unless it arrives outside the user's [notification hours](preferences-notification-hours.md) or while the user [paused their notifications](preferences-pausing.md). It also runs your [arrival callback](notification-center-real-time-updates.md#running-code-on-arrival).

> [!INFO] Queued broadcasts
> The event implements `ShouldBroadcast`, so it is queued. Laravel dispatches it once the database transaction that publishes the announcement commits.

## Reading Announcements in PHP

The `InboxAnnouncement::inboxQuery` method returns the announcements that a user sees in a context, with that user's state. The `markAsRead`, `markAsUnread`, `markAsSeen`, `archive`, `unarchive`, `snooze`, `unsnooze`, and `dismiss` methods change that user's state only:

```php
use InertiaUI\Notifications\Inbox;
use InertiaUI\Notifications\Models\InboxAnnouncement;

$announcement = InboxAnnouncement::inboxQuery($user, Inbox::context())
    ->latest()
    ->first();

$announcement->markAsRead();
```

The `Inbox::counts` and `inboxCounts` methods include announcements, but the `inbox` relation does not. The model's `delete` method deletes an announcement for every user.

> [!WARNING] UUID and ULID keys
> Notifiable models with UUID or ULID keys need a change to the `inbox_announcement_states` table of the published announcements migration too, as the [notification center setup](notification-center-setup.md#run-the-migration) describes.
