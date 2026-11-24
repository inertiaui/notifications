<!-- Generated from docs/notification-center/teams-and-tenants.md with `pnpm docs:guide`. Edit the docs instead. -->

# Teams and Tenants

You may show only the notifications of the user's current team. First, give each notification its team with the `for` method of the message:

```php
// In the toInbox() method of an InvoicePaid notification
return InboxMessage::make('Invoice :number paid', ['number' => $this->invoice->number])
    ->for($this->invoice->team);
```

Then resolve the current team in the `boot` method of your `AppServiceProvider`:

```php
use Illuminate\Http\Request;
use InertiaUI\Notifications\Inbox;

// In the boot() method of your AppServiceProvider
Inbox::resolveContextUsing(fn (Request $request) => $request->user()?->currentTeam);
```

The context may be any model, such as a team, an organization, or a tenant. The counts, the lists, and the bulk actions then cover the current context and the notifications without one, such as a password change.

While the resolver returns `null`, such as on a page outside a team, every notification shows. The browser forgets its notifications once the user switches context, and ignores real-time notifications and [changes](notification-center-real-time-updates.md#changes-in-other-sessions) of other contexts. You may give an [announcement](notification-center-announcements.md#teams-and-tenants) a context too.

> [!WARNING] UUID and ULID keys
> Context models with UUID or ULID keys need a change to the published notifications and announcements migrations before you run them. Change `nullableMorphs('context', ...)` to `nullableUuidMorphs('context', ...)` or `nullableUlidMorphs('context', ...)`, and keep the name of the index.

## Counting in Another Context

The `Inbox::counts` and `inboxCounts` methods count the notifications of the context that the resolver returns for the current request. To count them in another context, such as for another user or in a queued job, you may pass the context to the `Inbox::countsInContext` method:

```php
use InertiaUI\Notifications\Inbox;

Inbox::countsInContext($user, $user->currentTeam)->unread; // 3
```

Passing `null` counts the notifications of every context, and only the announcements without a context.

## Starter Kit Teams

The Laravel starter kits with teams put the current team in the URL, such as `/{current_team}/dashboard`. Their `EnsureTeamMembership` middleware makes the team of the URL the user's `currentTeam`, which the resolver above returns.

A user with two teams open in two tabs therefore switches `currentTeam` with every page. To keep each tab's endpoints on its own team, register the routes under the team prefix with the same middleware:

```php
use App\Http\Middleware\EnsureTeamMembership;

Route::prefix('{current_team}')
    ->middleware(['auth', EnsureTeamMembership::class])
    ->group(function () {
        Route::inertiaNotifications();
    });
```

The kits register URL defaults for the current team, so the endpoint URL in the shared prop includes it.

The service worker of [web push](notification-center-web-push.md) stays outside the team prefix and its middleware, at `/_inertia-notifications/push/worker.js`. A browser scopes a service worker to the path of its script, so every team shares the device's one worker and its push subscription.

The route that [opens a notification from its push](notification-center-web-push.md#how-it-works) stays outside the team prefix and its middleware too, at `/_inertia-notifications/{id}/open`, since a queued job or a command builds the push's link without the URL defaults of a request. It runs the `web` middleware and the middleware you pass to `Route::inertiaNotifications()`, and finds the user's notification in every team.

## Prefixed Broadcast Channels

Some multi-tenancy packages, such as [Tenancy for Laravel](https://v4.tenancyforlaravel.com/broadcasting/), prefix each tenant's broadcast channels. The channel in the [shared prop](notification-center-configuration.md#the-shared-prop) has no prefix, so give the `echo` option a `private` method that adds it:

```js
initNotifications({
    inbox: {
        echo: () => ({
            private: (channel) => window.Echo.private(`${window.tenantKey}.${channel}`),
            socketId: () => window.Echo.socketId(),
            connector: window.Echo.connector,
        }),
    },
})
```
