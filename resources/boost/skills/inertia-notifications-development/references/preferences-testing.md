<!-- Generated from docs/preferences/testing.md with `pnpm docs:guide`. Edit the docs instead. -->

# Testing Preferences

The `InteractsWithNotificationCenter` trait from the [notification center's testing section](notification-center-testing.md) also asserts the choices of a notifiable model. The `assertPreferenceSet` method takes the keys of a category and a channel in the configuration, as the `enabled` method does:

```php
use App\Models\User;

it('turns off billing emails', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson('/_inertia-notifications/preferences', ['preferences' => ['billing' => ['mail' => false]]])
        ->assertOk();

    $this->assertPreferenceSet($user, 'billing', 'mail', enabled: false);
    $this->assertPreferenceSet($user, 'comments', 'mail', enabled: true);
});
```

Like the `enabled` method, the assertion checks whether the user receives the category. It fails for a category that the configuration does not list or a channel that the category does not offer, so a misspelled key fails instead of passing.

To assert a [channel switch](preferences-categories.md#turning-off-a-channel), use the `assertChannelPreferenceSet` method. It fails for a channel that the configuration does not list or that has no switch:

```php
use App\Models\User;

it('turns off every email', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson('/_inertia-notifications/preferences', ['channels' => ['mail' => false]])
        ->assertOk();

    $this->assertChannelPreferenceSet($user, 'mail', enabled: false);
    $this->assertPreferenceSet($user, 'billing', 'mail', enabled: false);
});
```

## Digests and Notification Hours

The trait also asserts the digests. The `assertHeldForDigest` method takes a title or a callback, which receives each held notification with the fields of a notification item, the time of its digest in `sendAt`, and the held channels in `channels`:

```php
use App\Models\User;
use App\Notifications\CommentPosted;
use Illuminate\Support\Facades\Notification;
use InertiaUI\Notifications\NotificationPreferences;

it('sends the comments of the day in one digest', function () {
    $user = User::factory()->create();

    NotificationPreferences::update($user, frequencies: ['comments' => 'daily']);

    $user->notify(new CommentPosted);

    $this->assertInboxMessage($user, 'Sophie commented on your post');
    $this->assertHeldForDigest($user, 'Sophie commented on your post');

    Notification::fake();

    $this->travel(1)->day();
    $this->artisan('inertia-notifications:send-digests');

    $this->assertDigestSent($user, 'Sophie commented on your post');
    $this->assertNothingHeldForDigest($user);
});
```

The trait has the following assertions:

| Assertion | Passes when |
| --- | --- |
| `assertDigestFrequency($notifiable, $category, $frequency)` | The model receives the category with the frequency. It fails for a category that the configuration does not list. |
| `assertHeldForDigest($notifiable, $callback, $times)` | The model has a matching notification held for a digest, or exactly `$times` of them. |
| `assertNothingHeldForDigest($notifiable)` | The model has no notifications held for a digest. |
| `assertDigestSent($notifiable, $callback)` | A digest with a matching notification was sent to the model. Without a title or callback, any digest passes. |
| `assertNoDigestSent($notifiable)` | No digest was sent to the model. |
| `assertWithinNotificationHours($notifiable)` | Notifications reach the model now, within its [notification hours](preferences-notification-hours.md) or while it turned them off. It fails while the application does not offer notification hours. |
| `assertOutsideNotificationHours($notifiable)` | Notifications arrive silently for the model now, outside its notification hours. It fails while the application does not offer notification hours. |
| `assertNotificationsPaused($notifiable, $until)` | The model [paused its notifications](preferences-pausing.md), until the given time to the second when you pass one. It fails while the application does not offer pausing. |
| `assertNotificationsNotPaused($notifiable)` | The model did not pause its notifications, or its pause has passed. It fails while the application does not offer pausing. |

`Notification::fake()` keeps every channel from running, also the one that holds the notification, so send the notification before you fake. The `assertDigestSent` and `assertNoDigestSent` methods need the fake.

The notification hours assertions read the notification hours alone, so they leave out a pause. The [Pausing Notifications](preferences-pausing.md#testing) page shows a test of a pause.
