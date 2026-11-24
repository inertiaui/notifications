<!-- Generated from docs/toasts/custom-toasts.md with `pnpm docs:guide`. Edit the docs instead. -->

# Custom Toasts

You may add toast types of your own, render the toasts of a type with your own component, or render every toast yourself.

## Custom Types

You may give a toast a type of your own, such as `deployment`, by passing its name wherever you pass a built-in type. A name has lowercase letters, digits, and dashes, and starts with a letter:

```php
Toast::make('Deployed to production', 'deployment')->flash();

InboxMessage::make('Deployment finished')->toast('deployment');
```

In the browser, pass the name as the `type` option:

```js
toast('Deployed to production', { type: 'deployment' })
```

A toast of a custom type looks, lasts, and queues like a `default` toast. To give the type an icon and a label that screen readers announce before the title, pass both to the Toaster, keyed by the name of the type:

```vue
<!-- Vue -->
<script setup>
import { RocketLaunchIcon } from '@heroicons/vue/20/solid'
</script>

<template>
    <Toaster :icons="{ deployment: RocketLaunchIcon }" :type-labels="{ deployment: 'Deployment' }" />
</template>
```

```jsx
// React
import { RocketLaunchIcon } from '@heroicons/react/20/solid'

<Toaster icons={{ deployment: <RocketLaunchIcon className="size-5" /> }} typeLabels={{ deployment: 'Deployment' }} />
```

Screen readers then announce the toast as "Deployment: Deployed to production". You may also give every Toaster the label with the `toast_type_deployment` [translation](translations.md#toaster).

By default, the icon and the progress bar use the `default` color. To give the type a color of its own, change the token for toasts with the type's `data-type` attribute:

```css
.iui-toast[data-type='deployment'] {
    --color-iui-toast-default: var(--color-violet-600);
}
```

> [!WARNING] Invalid type names
> The `Toast` and `InboxMessage` classes throw an `InvalidArgumentException` for a name that breaks the rules, such as `Deployment`. The `toast` function in the browser does not check the name.

## Components per Type

You may render the toasts of one type with your own component by passing it to the Toaster's `components` prop, keyed by the type. Toasts of other types keep the default markup, or the markup of the `toast` slot or `renderToast` prop:

```vue
<!-- Vue -->
<script setup>
import InviteToast from './InviteToast.vue'
</script>

<template>
    <Toaster :components="{ invite: InviteToast }" />
</template>
```

```jsx
// React
import InviteToast from './InviteToast'

<Toaster components={{ invite: InviteToast }} />
```

The component receives the `toast`, with its [`data`](toasts-options.md#data), a `dismiss` function, and a `runAction` function. It takes the place of the icon, the text, the actions, and the dismiss button, so it renders its own:

```vue
<!-- Vue -->
<script setup>
import { trans } from '@inertiaui/notifications-vue'

defineProps({ toast: Object, dismiss: Function, runAction: Function })
</script>

<template>
    <div class="min-w-0 flex-1">
        <p class="text-sm font-medium">{{ toast.title }}</p>
        <p class="text-sm">Join {{ toast.data.team }} as {{ toast.data.role }}</p>
        <button v-for="(action, index) in toast.actions" :key="index" type="button" @click="runAction(index, $event)">
            {{ action.label }}
        </button>
    </div>
    <button type="button" :aria-label="trans('toast_dismiss', { title: toast.title })" @click="dismiss">×</button>
</template>
```

```jsx
// React
import { trans } from '@inertiaui/notifications-react'

export default function InviteToast({ toast, dismiss, runAction }) {
    return (
        <>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{toast.title}</p>
                <p className="text-sm">
                    Join {toast.data.team} as {toast.data.role}
                </p>
                {toast.actions.map((action, index) => (
                    <button key={index} type="button" onClick={(event) => runAction(index, event)}>
                        {action.label}
                    </button>
                ))}
            </div>
            <button type="button" aria-label={trans('toast_dismiss', { title: toast.title })} onClick={dismiss}>
                ×
            </button>
        </>
    )
}
```

In TypeScript, type the props with the `ToastComponentProps` type that both packages export.

The Toaster still wraps the component and handles stacking, timers, swiping, <kbd>Escape</kbd>, and the countdown of the `progress` prop. Screen readers announce the toast's type label, title, and description, whatever the component shows, so put what a screen reader user needs in the title or the description.

## Your Own Toaster

To change the markup of each toast, use the `toast` slot in Vue or the `renderToast` prop in React, as [Custom Markup](styling.md#custom-markup) describes.

To render the toasts entirely yourself, call `useToasts()` instead of rendering a Toaster:

```vue
<!-- Vue -->
<script setup>
import { useToasts } from '@inertiaui/notifications-vue'

const { toasts, dismiss, runAction } = useToasts()
</script>

<template>
    <ol aria-live="polite">
        <template v-for="toast in toasts" :key="toast.id">
            <li v-if="toast.state === 'visible'">
                {{ toast.title }}
                <button v-for="(action, index) in toast.actions" :key="index" type="button" @click="runAction(toast.id, index)">
                    {{ action.label }}
                </button>
                <button type="button" :aria-label="`Dismiss: ${toast.title}`" @click="dismiss(toast.id, 'user')">×</button>
            </li>
        </template>
    </ol>
</template>
```

```jsx
// React
import { useToasts } from '@inertiaui/notifications-react'

export function Toasts() {
    const { toasts, dismiss, runAction } = useToasts()

    return (
        <ol aria-live="polite">
            {toasts
                .filter((toast) => toast.state === 'visible')
                .map((toast) => (
                    <li key={toast.id}>
                        {toast.title}
                        {toast.actions.map((action, index) => (
                            <button key={index} type="button" onClick={() => runAction(toast.id, index)}>
                                {action.label}
                            </button>
                        ))}
                        <button type="button" aria-label={`Dismiss: ${toast.title}`} onClick={() => dismiss(toast.id, 'user')}>
                            ×
                        </button>
                    </li>
                ))}
        </ol>
    )
}
```

By default, `useToasts()` returns the toasts without a `toaster` option. To get the toasts of a [named Toaster](toasts-toaster.md#named-toasters), pass its name, such as `useToasts('uploads')`. In Vue, pass a ref or a getter, such as `useToasts(() => props.toaster)`, to follow a name that changes. Like a mounted Toaster, the hook runs the timers of its toasts and reads the toasts flashed for the current page.

| Returns | Description |
| --- | --- |
| `toasts` | The toasts in the order they were added, as a computed ref in Vue. Each has a `state` of `visible`, `closing`, or `queued`. |
| `toast` | The same function as the `toast` export. |
| `runAction(id, index, event?)` | Runs an action with its loading state and visit. Pass the click event for links, so a modifier click opens a new tab. |
| `dismiss(id?, reason?)` | Closes one toast, or every toast. Pass `'user'` as the reason from a dismiss button. See [Close Reasons](toasts-browser-toasts.md#close-reasons). |
| `update(id, changes)` | Changes an open toast. See [Updating and Dismissing Toasts](toasts-browser-toasts.md#updating-and-dismissing-toasts). |
| `pause(reason?, id?)`, `resume(reason?, id?)` | Stop and restart timers, such as `pause('hover')` on pointer enter. A timer runs again once every reason is resumed or the component unmounts. |
| `timer(id)` | The `duration`, the `remaining` milliseconds, and the `running` state of a toast's timer, such as for a progress bar. |

> [!WARNING] Keep your Toaster accessible
> Your own Toaster must announce each new toast to screen readers, pause the timers while the user points at or focuses a toast, and make every toast dismissible from the keyboard. [Keyboard and Screen Readers](toasts-toaster.md#keyboard-and-screen-readers) lists the behavior to match.
