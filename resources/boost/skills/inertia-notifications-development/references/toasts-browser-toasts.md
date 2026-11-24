<!-- Generated from docs/toasts/browser-toasts.md with `pnpm docs:guide`. Edit the docs instead. -->

# Browser Toasts

To show a toast without a server request, call the `toast` function:

```js
// Vue
import { toast } from '@inertiaui/notifications-vue'

toast('Export queued')
toast.success('Link copied', { description: 'Share it with your team.' })
toast.error('Upload failed')
```

```js
// React
import { toast } from '@inertiaui/notifications-react'

toast('Export queued')
toast.success('Link copied', { description: 'Share it with your team.' })
toast.error('Upload failed')
```

The `toast` function also has the `toast.info`, `toast.warning`, and `toast.loading` methods. Each call returns the toast's ID. You may pass the following options as the second argument:

| Option | Description |
| --- | --- |
| `id` | Replaces the open toast with this ID instead of adding another one. |
| `type` | A built-in type, such as `success`, or the name of a [custom type](toasts-custom-toasts.md#custom-types). Defaults to `default`. |
| `description` | Text below the title. |
| `duration` | Milliseconds before the toast closes, or `null` to keep it open. Omit it to use the default for the type and length. |
| `action`, `actions` | One action, or a list of actions. See [Actions in the Browser](toasts-actions.md#actions-in-the-browser). |
| `icon` | A name from the Toaster's `icons` prop or an [icon resolver](icons.md), a component (Vue) or element (React), or `false` for no icon. |
| `image` | The URL of an image, such as an avatar, that shows in place of the icon. Screen readers still announce the type. |
| `dismissible` | Set to `false` to remove the dismiss button, Escape, and swiping. |
| `position` | Overrides the Toaster's position for this toast. |
| `toaster` | The `name` of the Toaster that shows the toast. |
| `politeness` | `'polite'` or `'assertive'`, to override how screen readers announce the toast. |
| `data` | Data for the [component that renders the toast's type](toasts-custom-toasts.md#components-per-type). |
| `progress` | How much of the work is done, from 0 to 1, shown as a bar. See [Progress](toasts-options.md#progress). |
| `onClose(reason)` | Runs when the toast closes. See [Close Reasons](#close-reasons). |
| `onRemove()` | Runs after the exit animation, when the toast is removed. |

## Updating and Dismissing Toasts

You may change an open toast with `toast.update()`. Fields you leave out keep their value:

```js
const id = toast.loading('Uploading 1 of 3 files…', { dismissible: false })

toast.update(id, { title: 'Uploading 2 of 3 files…' })

toast.success('3 files uploaded', { id, dismissible: true })
```

A change to the title, type, description, duration, or actions restarts the toast's timer and announces the toast again.

To move the bar of a toast's progress, pass a new `progress` to `toast.update()`. A change of the progress neither restarts the timer nor announces the toast:

```js
const id = toast.loading('Uploading report.pdf…', { progress: 0 })

toast.update(id, { progress: 0.5 })
```

To dismiss a toast, pass its ID to `toast.dismiss()`. Without an ID, it dismisses every toast:

```js
toast.dismiss(id)
toast.dismiss()
```

## Duplicates

A toast that is identical to an open one does not show twice. Instead, the open toast shows a counter, such as "×2", and restarts its timer. Loading toasts and toasts with an ID, actions, or data are never counted. To turn counting off, pass `dedupe: false` to `initNotifications()`.

## Promises

To show a loading toast while a promise runs, pass the promise, or a function that returns it, to `toast.promise()`. It replaces the loading toast in place once the promise settles:

```js
toast.promise(buildReport(), {
    loading: 'Building report…',
    success: (report) => `${report.name} is ready`,
    error: 'Could not build the report',
})
```

Each message may be a title, an object with a `title` and other options, or a function that receives the result or the error. Leaving out `success` or `error` closes the loading toast instead.

The `fetch` function resolves even when the server answers with an error, such as a 500. A promise that resolves with a `Response` whose `ok` is `false` shows the `error` message, and an `error` function receives the `Response`:

```js
toast.promise(fetch('/reports', { method: 'POST' }), {
    loading: 'Building report…',
    success: 'The report is ready',
    error: (response) => `Could not build the report (${response.status})`,
})
```

The `toast.promise` method returns the toast's `id` and an `unwrap` method instead of a promise, so a failure does not become an unhandled rejection. To get the original promise, call `unwrap()`. Like `fetch()`, it resolves with a failed `Response` instead of rejecting:

```js
const report = await toast.promise(buildReport(), { loading: 'Building report…' }).unwrap()
```

## Inertia Visits

The `toast.track` method returns visit callbacks that show a loading toast while the visit runs, with a progress bar for file uploads. Pass them to the `post` method of a form from `useForm`, or to `router.post()`:

```js
form.post('/invoices', toast.track({ loading: 'Saving…', error: 'Could not save the invoice' }))
```

The `error` message replaces the loading toast once the visit fails validation, and an `error` function receives the validation errors. A successful visit closes the loading toast, so a toast that the server flashes takes its place. To show a toast from the browser instead, pass `success`.

To replace the loading toast in place, give it an `id` and flash the server's toast with the same [`id()`](toasts-options.md#replacing-a-toast-by-its-id):

```js
router.post('/artboards/7/review', {}, toast.track({ id: 'review', loading: 'Requesting review…' }))
```

```php
Toast::success('Review requested')
    ->id('review')
    ->flash();
```

To keep visit options and callbacks of your own, pass them as the second argument:

```js
form.post('/invoices', toast.track({ loading: 'Saving…' }, { preserveScroll: true, onSuccess: () => form.reset() }))
```

## Close Reasons

The `onClose` callback receives the reason the toast closed:

| Reason | Description |
| --- | --- |
| `timeout` | Its duration ran out. |
| `user` | The user pressed its dismiss button. |
| `swipe` | The user swiped it away. |
| `action` | The user ran one of its actions. |
| `escape` | The user pressed Escape while it had focus. |
| `programmatic` | Code called `toast.dismiss()`. |
| `replaced` | A new toast with the same ID took its place. |
| `evicted` | The limit was reached and a newer toast pushed it out. |
