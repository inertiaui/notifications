<!-- Generated from docs/preferences/php.md with `pnpm docs:guide`. Edit the docs instead. -->

# Preferences in PHP

You may read and save the choices of a notifiable model with the `NotificationPreferences` class:

```php
use App\Models\User;
use InertiaUI\Notifications\NotificationPreferences;

$user = User::find(1);

NotificationPreferences::enabled($user, 'billing', 'mail'); // false when the user turned it off
NotificationPreferences::enabled($user, 'product', 'mail'); // false until the user turns it on
NotificationPreferences::channelEnabled($user, 'mail'); // false when the user turned off email for every category

NotificationPreferences::update($user, ['billing' => ['mail' => false]]);
NotificationPreferences::update($user, channels: ['mail' => false]);

NotificationPreferences::for($user); // the preferences as the component reads them
```

The `enabled` method takes the key of a channel in the configuration, not the name of a Laravel channel. It tells whether the user receives the category, so it returns `false` while the channel is off, except for locked categories.

The `update` method ignores locked categories, channels without a [channel switch](preferences-categories.md#turning-off-a-channel), channels that a category does not offer, and categories and channels that the configuration does not list.

## Frequencies and Notification Hours

You may read and save the frequencies, notification hours, and pause of a notifiable model with the `NotificationPreferences` class, and check whether notifications reach it with the `NotificationHours` and `DoNotDisturb` classes:

```php
use App\Models\User;
use InertiaUI\Notifications\Digest;
use InertiaUI\Notifications\DoNotDisturb;
use InertiaUI\Notifications\NotificationHours;
use InertiaUI\Notifications\NotificationHoursChange;
use InertiaUI\Notifications\NotificationPreferences;

$user = User::find(1);

NotificationPreferences::frequency($user, 'comments'); // 'instant', 'hourly', 'daily', or 'weekly'
NotificationPreferences::offeredFrequencies(); // ['instant', 'hourly', 'daily', 'weekly']
NotificationPreferences::timezone($user); // the timezone that the digests of the user are sent in
NotificationPreferences::notificationHours($user)->days; // ['monday' => ['07:00-22:00'], ...]
NotificationPreferences::pausedUntil($user); // the end of the user's pause, or null
NotificationHours::within($user); // false outside the notification hours
NotificationHours::next($user, now()); // the start of the next notification hours, or now within them
DoNotDisturb::active($user); // true while notifications arrive silently, outside the hours or during a pause
DoNotDisturb::endsAt($user, now()); // the time when notifications reach the user again, or now

NotificationPreferences::update($user, frequencies: ['comments' => 'daily'], timezone: 'Europe/Amsterdam');
NotificationPreferences::update($user, notificationHours: new NotificationHoursChange(
    enabled: true,
    days: ['saturday' => [], 'sunday' => ['10:00-18:00']],
));
NotificationPreferences::pause($user, now()->addHour());
NotificationPreferences::resume($user);

Digest::query($user)->get(); // the held notifications of the user
```

The `update` method ignores frequencies of categories without `'digest' => true`, frequencies that the [`digests.frequencies` option](preferences-digests.md#choosing-the-frequencies) does not offer, and notification hours while the application does not offer them. Each day you pass replaces the ranges of that day, and the days you leave out stay the same. The method throws an `InvalidArgumentException` for an unknown timezone, an unknown day, a range that is not two times of day, such as `7am-5pm`, or notification hours without a range on any day. The [Pausing Notifications](preferences-pausing.md#pausing-in-php) page describes the `pause` and `resume` methods.

## Listening for Changes

The package dispatches the `NotificationPreferencesChanged` event when a user changes their choices through the component, the [JSON endpoint](preferences-custom-forms.md#json-endpoints), or the `update` method. You may listen for it to keep the choices in sync with another service, such as the mailing lists of your email provider:

```php
namespace App\Listeners;

use App\Services\Newsletter;
use InertiaUI\Notifications\Events\NotificationPreferencesChanged;

class SyncNewsletterSubscription
{
    public function __construct(protected Newsletter $newsletter) {}

    public function handle(NotificationPreferencesChanged $event): void
    {
        $subscribed = $event->categories['product']['mail'] ?? null;

        if ($subscribed !== null) {
            $this->newsletter->update($event->notifiable, subscribed: $subscribed);
        }
    }
}
```

The event has the following properties:

| Property | Description |
| --- | --- |
| `notifiable` | The model whose choices changed, such as the user. |
| `categories` | The choices that changed, by category and channel, such as `['billing' => ['mail' => false]]`. |
| `channels` | The [channel switches](preferences-categories.md#turning-off-a-channel) that changed, by channel, such as `['mail' => false]`. |
| `frequencies` | The [digest frequencies](preferences-digests.md) that changed, by category, such as `['comments' => 'daily']`. |
| `notificationHours` | The new [notification hours](preferences-notification-hours.md) as a `NotificationHours` instance, or `null` when they stayed the same. |

Each value is the new choice. The event leaves out choices that stayed the same, and the package does not dispatch it when nothing changed, such as for a change of the timezone alone. Within a database transaction, the event waits until the transaction commits.

Pausing and resuming dispatch the [`NotificationsPaused` and `NotificationsResumed` events](preferences-pausing.md#listening-for-pauses) instead.
