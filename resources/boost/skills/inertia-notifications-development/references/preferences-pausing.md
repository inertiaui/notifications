<!-- Generated from docs/preferences/pausing.md with `pnpm docs:guide`. Edit the docs instead. -->

# Pausing Notifications

Pausing lets users silence their notifications for a while, such as for an hour during a meeting or until tomorrow morning. You may offer it with the `enabled` option of the `pause` section:

```php
// config/inertia-notifications.php

return [
    'pause' => [
        'enabled' => true,
    ],
];
```

The **More actions** menu in the header of the `NotificationCenter` panel then offers **For 30 minutes**, **For 1 hour**, **For 2 hours**, and **Until tomorrow**. While the notifications are paused, the top of the panel shows until when, with a **Resume** button, and the bell shows that notifications are paused. You may change the times with the `presets` option, as described in [Pausing Notifications](notification-center-component.md#pausing-notifications).

Pausing does not need [notification hours](preferences-notification-hours.md), but like them, it holds emails in the table of the [digests](preferences-digests.md) until the `inertia-notifications:send-digests` command sends them. Follow the [setup of digests](preferences-digests.md#setup) to run the migration and schedule the command.

## What Waits During a Pause

While a user's notifications are paused, notifications reach them as they do [outside their notification hours](preferences-notification-hours.md#what-waits-outside-notification-hours). The notification center stores each notification right away without a toast, sound, desktop notification, or push, and the channels that digests hold, such as `mail`, wait until the pause ends. A digest whose time falls within the pause waits as well.

Locked categories, and notifications without a category in the configuration, send as usual. A notification that arrives during a pause has a `quiet` key of `true`, like one that arrives outside the notification hours.

## Pauses and Notification Hours

The emails that wait during a pause are sent once the pause has ended and the notification hours have started. For example, a user whose notification hours end at 17:00 and who pauses until 18:00 receives the held emails when the next notification hours start, such as at 09:00 the next day. A pause that ends within the notification hours sends them at the end of the pause.

## Resuming

A user who resumes before the end of the pause receives the emails that waited with the next run of the command. A digest that came due during the pause goes out with that run too, and the other held notifications wait for the time of their own digest. Outside the notification hours, they wait until the hours start.

A pause stops on its own once its time has come, so the package treats a pause that has passed as no pause at all.

## Pausing in PHP

You may pause and resume the notifications of a notifiable model with the `NotificationPreferences` class:

```php
use App\Models\User;
use InertiaUI\Notifications\DoNotDisturb;
use InertiaUI\Notifications\NotificationPreferences;

$user = User::find(1);

NotificationPreferences::pause($user, now()->addHours(2));
NotificationPreferences::pausedUntil($user); // the end of the pause, or null
DoNotDisturb::active($user); // true while paused or outside the notification hours
NotificationPreferences::resume($user);
```

The `pause` method throws an `InvalidArgumentException` for a time that is not in the future. Both methods save the change while the application does not offer pausing, but the package ignores the pause until it does, so the `pausedUntil` method returns `null` until then.

### Listening for Pauses

The package dispatches the `NotificationsPaused` event when a user pauses their notifications or changes the end of a pause, and the `NotificationsResumed` event when a user resumes a pause. You may listen for them to show the pause elsewhere, such as in your team's chat:

```php
namespace App\Listeners;

use App\Services\TeamChat;
use InertiaUI\Notifications\Events\NotificationsPaused;

class ShowPausedStatus
{
    public function __construct(protected TeamChat $chat) {}

    public function handle(NotificationsPaused $event): void
    {
        $this->chat->setStatus($event->notifiable, "Notifications paused until {$event->until->format('H:i')}");
    }
}
```

Both events live in the `InertiaUI\Notifications\Events` namespace and have a `notifiable` property. The `NotificationsPaused` event also has the `until` time. Resuming without a pause, or after the pause has passed, dispatches no event. Within a database transaction, both events wait until the transaction commits.

## JSON Endpoints

`Route::inertiaNotifications()` registers the following routes, named `inertia-notifications.pause` and `inertia-notifications.resume`. They have the same prefix and middleware as the [notification center's routes](notification-center-custom-interfaces.md#json-endpoints), and both answer with a `404` response while the application does not offer pausing:

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/pause` | Pauses the notifications until the `until` time, such as `{ "until": "2026-11-18T15:00:00Z" }`. The time must be in the future. |
| `POST` | `/resume` | Resumes the notifications. |

Both routes respond with the new `counts` and a `change` that holds the end of the pause, or `null` once the user resumed:

```json
{
    "counts": {
        "unread": 3,
        "unseen": 1,
        "categories": { "billing": 2, "comments": 1 },
        "latest": "2026-11-18T13:52:00+00:00",
        "latestIds": ["9d3c1b6e-0b7a-4c1e-9a64-5f0d2a8e1c47"],
        "revision": 1794938400000000
    },
    "change": { "kind": "pause", "until": "2026-11-18T15:00:00+00:00" }
}
```

With [changes in other sessions](notification-center-real-time-updates.md#changes-in-other-sessions) turned on, the user's other browsers and devices receive the same change. The [shared prop](notification-center-configuration.md#the-shared-prop) holds the pause of the signed-in user under its `pause` key.

## Testing

The `InteractsWithNotificationCenter` trait from the [testing page](preferences-testing.md#digests-and-notification-hours) asserts the pause of a notifiable model with the `assertNotificationsPaused` and `assertNotificationsNotPaused` methods. The first takes the end of the pause as an optional second argument:

```php
use App\Models\User;
use App\Notifications\CommentPosted;

it('holds the comment emails while the user is paused', function () {
    $this->freezeTime();
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson('/_inertia-notifications/pause', ['until' => now()->addHour()->toIso8601String()])
        ->assertOk();

    $this->assertNotificationsPaused($user, now()->addHour());

    $user->notify(new CommentPosted);

    $this->assertHeldForDigest($user, 'Sophie commented on your post');

    $this->postJson('/_inertia-notifications/resume')->assertOk();

    $this->assertNotificationsNotPaused($user);
});
```

Both assertions fail while the application does not offer pausing.
