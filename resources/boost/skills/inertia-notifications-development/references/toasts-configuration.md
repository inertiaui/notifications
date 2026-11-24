<!-- Generated from docs/toasts/configuration.md with `pnpm docs:guide`. Edit the docs instead. -->

# Configuring Toasts

You may configure toasts by passing options to `initNotifications()` in your frontend entry point:

```js
initNotifications({
    duration: 6000,
    limit: 3,
    errorToasts: true,
})
```

| Option | Default | Description |
| --- | --- | --- |
| `duration` | [Varies](toasts-options.md#duration) | Milliseconds for toasts without a duration, except those that stay open, or a function that maps the toast's `type`, `title`, `description`, and `actions` to milliseconds or `null`. |
| `persistentErrors` | `true` | Keep error toasts open until the user dismisses them. Ignored when `duration` is a function. |
| `durationScale` | `1` | Multiplies the duration of every timed toast. |
| `autoDismiss` | `true` | Set to `false` to keep every toast open until the user dismisses it. |
| `limit` | `5` | The most toasts that each Toaster shows at once. |
| `overflow` | `'queue'` | What happens beyond the limit: `queue`, `drop-oldest`, or `hide`. See [The Queue](#the-queue). |
| `dedupe` | `true` | Show a counter on an open toast instead of adding an identical one. |
| `removeDelay` | `200` | Milliseconds that a closing toast stays rendered for its exit animation. |
| `errorToasts` | `false` | Show a toast when a request fails. See [Error Toasts](#error-toasts). |
| `flashKey` | `'inertiaui'` | The Inertia flash key that carries toasts. Must match `flash_key` in `config/inertia-notifications.php`. |

The `inbox` option configures the notification center, as described in [Real-Time Updates](notification-center-real-time-updates.md#options).

The `durationScale` and `autoDismiss` options let users who need more time to read keep toasts open longer. For example, you may store the choice as a user preference and pass it when the app starts:

```js
initNotifications({ autoDismiss: !user.prefersPersistentNotifications })
```

## The Queue

By default, toasts beyond the limit wait in a queue until an open toast closes, and the most important one shows first. A queued toast's timer starts once it shows, and you may update the toast before then.

With `overflow: 'drop-oldest'`, a new toast always shows and closes the least important open toast, the oldest among equals. With `overflow: 'hide'`, that toast joins the queue instead, and its timer keeps the time it had left.

Errors are the most important, then warnings, then the rest. Within each group, toasts with actions come first.

## Error Toasts

With `errorToasts: true`, a failed request shows an error toast instead of Inertia's error page dialog. This covers Inertia visits and `useHttp` requests. The error toasts use the following default titles, which you may translate with the `error_toast_` [translations](translations.md#error-toasts):

| Key | Default title |
| --- | --- |
| `403` | This action is unauthorized. |
| `419` | This page has expired. |
| `429` | Too many requests. |
| `5xx` | Something went wrong. |
| `network` | You appear to be offline. |

To change or add messages, pass an object. Its messages take the place of the translations. To leave a status to Inertia, set it to `false`:

```js
initNotifications({
    errorToasts: {
        404: { title: 'Not found', description: 'The page may have moved.' },
        419: { title: 'Your session expired.', description: 'Refresh the page to continue.' },
        503: false,
    },
})
```

Requests whose response is an Inertia page, or carries toasts from the server, never show an error toast. For a status that the error toasts cover, the toasts from the server take the place of the error toast, so Inertia's error page dialog still stays away. Validation errors (422) do not show one either. Show those next to the form fields.
