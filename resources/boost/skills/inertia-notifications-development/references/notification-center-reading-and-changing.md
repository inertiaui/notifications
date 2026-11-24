<!-- Generated from docs/notification-center/reading-and-changing.md with `pnpm docs:guide`. Edit the docs instead. -->

# Notifications in PHP

The `HasInbox` trait adds an `inbox` relation, ordered newest first, and an `inboxCounts` method:

```php
$user = User::find(1);

$user->inbox()->unread()->count();

$counts = $user->inboxCounts();

$counts->unread; // 3
$counts->unseen; // 1
```

The `InboxNotification` model offers the following query scopes:

| Scope | Notifications |
| --- | --- |
| `active()` | Not archived and not snoozed |
| `unread()`, `read()` | Not read, read |
| `unseen()` | Not seen in the panel |
| `snoozed()` | Snoozed until a time that has not come yet, and not archived |
| `archived()` | Archived |

It also offers the following methods:

```php
use InertiaUI\Notifications\Models\InboxNotification;

$notification = InboxNotification::first();

$notification->markAsRead();   // also marks it as seen
$notification->markAsUnread();
$notification->markAsSeen();
$notification->archive();
$notification->unarchive();
$notification->snooze(now()->addDay());
$notification->unsnooze();
$notification->isRead();
$notification->complete('Approved');
$notification->revertResult();
$notification->isCompleted();
```

These methods only change the row. To also update the user's open pages, such as after the user opened the notification's link from an email, you may call the `Inbox::markAsRead` method instead. With [changes in other sessions](notification-center-real-time-updates.md#changes-in-other-sessions) turned on, open panels show the notification as read right away:

```php
use InertiaUI\Notifications\Inbox;

Inbox::markAsRead($notification);
```

You may use your own model by extending `InertiaUI\Notifications\Models\InboxNotification` and setting the `inbox.model` [configuration option](notification-center-configuration.md).

## Action Results

A notification may show the result of an action once it ran, such as **Approved** in place of the **Approve** and **Decline** buttons. You may set it with the `result` method of the action:

```php
// In the toInbox() method of an ExpenseSubmitted notification
return InboxMessage::make('Expense #:number needs your approval', ['number' => $this->expense->number])
    ->action(ToastAction::make('Approve')
        ->post(route('expenses.approve', $this->expense))
        ->result('Approved')
    )
    ->action(ToastAction::make('Decline')
        ->post(route('expenses.decline', $this->expense))
        ->result('Declined')
    );
```

The result is saved once the action succeeds, including from the notification's [toast](notification-center-sending-notifications.md#showing-a-toast). A failed action keeps its buttons. The result is translated with its replacements, like the title. An action that redirects back keeps the page's state and scroll position, as described in [Preserving State and Scroll](toasts-actions.md#preserving-state-and-scroll).

### Completing Notifications on the Server

You may also complete notifications from your own code, such as once another admin approved the expense. The `Inbox::complete` method takes a notification or its [`once()`](notification-center-sending-notifications.md#sending-a-notification-once) key:

```php
use InertiaUI\Notifications\Inbox;

// In the controller where another admin approves $expense...

// Every user who received the notification with this key...
Inbox::complete("expense-{$expense->id}", 'Approved by :name', ['name' => $request->user()->name]);

// One user, or one InboxNotification model...
Inbox::complete("expense-{$expense->id}", 'Approved', notifiable: $expense->submitter);
Inbox::complete($expense->submitter->inbox()->first(), 'Approved');
```

The `Inbox::revertResult` method takes a notification or its key, and optionally a `notifiable`, and brings the actions back:

```php
Inbox::revertResult("expense-{$expense->id}");
```

With [changes in other sessions](notification-center-real-time-updates.md#changes-in-other-sessions) turned on, open panels show both changes right away.

## Updating and Retracting Notifications

You may change the message of a sent notification, such as once the build it announced has passed. The `Inbox::update` method takes a notification or its [`once()`](notification-center-sending-notifications.md#sending-a-notification-once) key, and the new message:

```php
use InertiaUI\Notifications\Inbox;
use InertiaUI\Notifications\InboxMessage;

Inbox::update("build-{$build->id}", InboxMessage::make('Build #:number passed', ['number' => $build->number])
    ->body('Deployed to production in :seconds seconds.', ['seconds' => $build->duration])
    ->url(route('builds.show', $build))
);
```

The new message replaces the title, body, icon, image, URL, actions, actor, toast type, and `with()` data. The notification keeps its read, seen, archived, and snoozed state, its place in the list, its category, its group key, and its context.

Every user who received the notification gets the new message, or only the `notifiable` you pass. You may also pass a closure that builds the message for each notifiable:

```php
Inbox::update("build-{$build->id}", fn (User $user) => InboxMessage::make('Your build #:number passed', [
    'number' => $build->number,
]));
```

To remove a notification for good, pass the notification or its key to the `Inbox::retract` method, and optionally a `notifiable`:

```php
// Every user who received the notification with the key...
Inbox::retract("build-{$build->id}");

// One user...
Inbox::retract("build-{$build->id}", $build->author);
```

Retracting deletes the notification, whatever the [`actions` option](notification-center-component.md#choosing-the-actions) says.

With [changes in other sessions](notification-center-real-time-updates.md#changes-in-other-sessions) turned on, open panels, [notification pages](notification-center-notifications-page.md), and toasts update right away. Otherwise, a page shows them the next time it loads the list.

### Channels That Already Sent

The notification center cannot take back what other channels already sent, such as an email or a desktop notification. A channel that waits for a read with [`unlessReadWithin()`](notification-center-sending-notifications.md#waiting-for-a-read) skips a retracted notification. After an update, it still sends what the notification's own method builds, such as `toMail()`.

## Importing Past Notifications

You may give users the notifications they received before your application had the notification center, such as those of Laravel's `database` channel. The `Inbox::import` method takes the notifiable model, the notification's UUID, its type, and its message, along with the time the notification was sent and, optionally, the time it was read:

```php
use InertiaUI\Notifications\Inbox;
use InertiaUI\Notifications\InboxMessage;

// In a command that imports the notifications of $user...

foreach ($user->notifications()->oldest()->cursor() as $notification) {
    $message = InboxMessage::make($notification->data['title'])
        ->body($notification->data['body'] ?? null)
        ->url($notification->data['url'] ?? null);

    Inbox::import(
        $user,
        $notification->id,
        $notification->type,
        $message,
        sentAt: $notification->created_at,
        readAt: $notification->read_at,
    );
}
```

The package stores each notification as it happened. It shows no toast, broadcasts no arrival, and sends no push, and the [throttle](notification-center-real-time-updates.md#throttling-a-category), the [notification hours](preferences-notification-hours.md), and [collapsing](notification-center-sending-notifications.md#collapsing-notifications) leave it alone. The notification counts as seen at the time it was sent, so the bell does not count the imported notifications as new. Those without a read time still count as unread.

Importing a notification again returns the stored one unchanged, so you may run an import more than once without undoing what users did since, such as reading a notification. A message with a [`once` key](notification-center-sending-notifications.md#sending-a-notification-once) that the user already has is not imported, and a message for a team keeps its [context](notification-center-teams-and-tenants.md).

> [!WARNING] Pruning
> The `model:prune` command deletes the notifications older than the [`prune_after_days` option](notification-center-configuration.md#pruning), 90 days by default, including imported ones. Raise the option, or set it to `null`, to keep older notifications.
