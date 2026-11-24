---
title: Toast Actions
description: Add buttons to toasts that visit a URL with Inertia, send a POST, PUT, PATCH, or DELETE request, dispatch a browser event, or run a callback in Vue or React.
---

<script setup>
import DocsExample from '../.vitepress/theme/components/DocsExample.vue'
import LiveToastActionDemo from '../.vitepress/theme/components/LiveToastActionDemo.vue'
</script>

# Toast Actions

An action is a button on the toast. To visit a URL with Inertia, pass a label and the URL to the `action` method:

```php
Toast::success('Invoice sent')
    ->action('View invoice', route('invoices.show', $invoice))
    ->flash();
```

For other requests, you may pass a `ToastAction` instead:

```php
use InertiaUI\Notifications\ToastAction;

Toast::make('Message archived')
    ->action(ToastAction::make('Undo')
        ->post(route('messages.restore', $message))
        ->preserveScroll()
    )
    ->flash();
```

The `ToastAction` class has the following methods:

| Method | Description |
| --- | --- |
| `url($url)` | Visit the URL with Inertia. Actions that visit with GET render as links. |
| `post($url, $data)`, `put()`, `patch()`, `delete()` | Visit the URL with another method and data. |
| `external()` | Load the URL in the browser instead of visiting it with Inertia, such as for a download or another site. |
| `openUrlInNewTab()` | Open the URL in a new tab. |
| `event($name, $payload)` | Dispatch a `CustomEvent` with this name on `window`, with the payload as its `detail`. |
| `preserveScroll()`, `preserveState()`, `only([...])` | Options for the Inertia visit. |
| `keepOpen()` | Keep the toast open after the action ran. |
| `altText($text)` | Tell screen reader users how to do the same without the toast, such as "Undo from the Trash page". A toast whose actions all have one closes after its duration. |
| `result($text, $replace)` | Set what a notification shows in place of its actions once this action succeeds, such as "Approved". See [Action Results](/notification-center/reading-and-changing#action-results). |

An action needs a URL or an event, so flashing a toast with an action that has neither throws a `LogicException`. The browser loads a URL only with GET, so an action that combines `external()` or `openUrlInNewTab()` with `post()`, `put()`, `patch()`, or `delete()` throws one too.

While the visit runs, the button shows a spinner and the toast stays open. The toast closes once the visit succeeds, and stays open after a failed visit so the user may try again.

A toast with actions stays open until the user dismisses it, unless you set a duration or each action has an `altText`, which tells where else to do the same.

> [!WARNING] Actions need a fallback
> A toast may close before a keyboard or screen reader user reaches it. Make sure the user can do the same thing somewhere else in your app.

## Actions in the Browser

An action from the browser may run an `onClick` callback. While a returned promise is pending, the button shows a spinner and the toast stays open. The request methods of Inertia's `useHttp()` return such a promise:

<DocsExample>
    <LiveToastActionDemo />
</DocsExample>

::: code-group

```js [Vue]
import { useHttp } from '@inertiajs/vue3'
import { toast } from '@inertiaui/notifications-vue'

// In the component's setup, like other composables
const http = useHttp()

toast('Message archived', {
    action: {
        label: 'Undo',
        onClick: () => http.post(`/messages/${message.id}/restore`),
    },
})
```

```js [React]
import { useHttp } from '@inertiajs/react'
import { toast } from '@inertiaui/notifications-react'

// In the component, like other hooks
const http = useHttp()

toast('Message archived', {
    action: {
        label: 'Undo',
        onClick: () => http.post(`/messages/${message.id}/restore`),
    },
})
```

:::

The toast closes once the promise resolves, and stays open after it rejects, such as after a failed request. Actions also accept the fields of server actions: `href`, `method`, `data`, `visit`, `external`, `newTab`, `event`, `payload`, `keepOpen`, and `altText`.
