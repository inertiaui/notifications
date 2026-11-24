<!-- Generated from docs/toasts/toaster.md with `pnpm docs:guide`. Edit the docs instead. -->

# The Toaster

The `Toaster` component shows the toasts. You render one in a persistent layout during the [installation](installation.md#render-the-toaster).

It accepts the following props:

| Prop | Default | Description |
| --- | --- | --- |
| `position` | `'bottom-right'` | `top-left`, `top-center`, `top-right`, `bottom-left`, `bottom-center`, or `bottom-right`. |
| `name` | | Shows only the toasts whose `toaster` option has this name. |
| `visibleToasts` | `3` | How many toasts show in the collapsed stack. |
| `expand` | `false` | Show every toast at full height instead of stacking them. |
| `progress` | `false` | Show a bar that counts down the time left on timed toasts. |
| `label` | `toaster_label` | The accessible name of the toast region, in place of the [translation](translations.md#toaster). The keyboard shortcut is added to it. |
| `dismissLabel` | `toast_dismiss` | The accessible name of each dismiss button, in place of the translation. `:title` is replaced with the toast's title. |
| `hotkey` | `['F8']` | The keys that focus the newest toast, as [`KeyboardEvent.code`](https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_code_values) values and modifiers, such as `['altKey', 'KeyT']`. Pass `[]` to turn it off. |
| `typeLabels` | `toast_type_` | The words that screen readers announce before a toast's title, such as "Error: Payment failed", in place of the translations. |
| `icons` | `{}` | Icons by name, for the `icon` option. A key named after a type or a [built-in icon](icons.md#replacing-the-built-in-icons) replaces that icon. |
| `iconResolver` | | Resolves icon names to components, in place of the global resolver. See [Icons](icons.md). |
| `classes` | `{}` | Class names for the parts of each toast. See [Styling](styling.md#class-names). |
| `components` | `{}` | Components that render the toasts of a type, keyed by the type. See [Components per Type](toasts-custom-toasts.md#components-per-type). |
| `aboveModals` | `true` | Keep the toasts usable above the modal dialogs of other libraries and the notification center's panel. See [Modal Dialogs](#modal-dialogs). |

To replace the markup of each toast or its icon, use the `toast` and `icon` slots in Vue, or the `renderToast` and `renderIcon` props in React, as [Custom Markup](styling.md#custom-markup) describes.

## Stacking

The newest toast shows in front, with older toasts stacked behind it. The stack expands while the pointer is over it or a toast in it has focus. On touch screens, tapping a toast expands the stack, which stays expanded until you tap outside it. Swiping a toast toward the edge of the screen dismisses it. Toasts at the center positions swipe away in either direction.

## Named Toasters

You may render more than one Toaster by giving each a `name`. Toasts without a `toaster` option show in the Toaster without a name:

```vue
<!-- Vue -->
<template>
    <Toaster />
    <Toaster name="uploads" position="bottom-left" />
</template>
```

```jsx
// React
<>
    <Toaster />
    <Toaster name="uploads" position="bottom-left" />
</>
```

To show a toast in a named Toaster, pass its name as the `toaster` option:

```js
toast.loading('Uploading…', { toaster: 'uploads' })
```

A toast's timer runs only while a Toaster with its name is on the page.

## Modal Dialogs

A modal `<dialog>` makes the rest of the page inert, so toasts outside it cannot be clicked or announced. While a modal dialog is open, the Toaster moves its toasts into the topmost one, and moves them back once it closes.

The Toaster also keeps its toasts usable above the modal dialogs of other libraries, such as Radix and Reka. Pressing a toast or one of its actions leaves the dialog open, and <kbd>Escape</kbd> on a focused toast closes the toast, not the dialog.

While a popover with the `dialog` role is open, such as the [notification center's](notification-center-setup.md) panel, the toasts move into it, so pressing a toast does not close it.

You may turn off the handling of other libraries' dialogs and of popovers with the `aboveModals` prop, such as for an app whose own styles already place the toasts above its dialogs. The toasts still move into an open modal `<dialog>`:

```vue
<!-- Vue -->
<template>
    <Toaster :above-modals="false" />
</template>
```

```jsx
// React
<Toaster aboveModals={false} />
```

## Keyboard and Screen Readers

The built-in Toaster supports keyboards and screen readers in the following ways:

- Screen readers announce each new toast as plain text, such as "Error: Payment failed. Your card was declined." Errors interrupt what the screen reader is saying. Other toasts wait until it is done.
- A toast is announced again when a replacement changes its type, title, or description, when an update changes its content, and when a duplicate shows.
- Press <kbd>F8</kbd> to move focus to the newest toast. <kbd>Tab</kbd> moves through the toasts, their actions, and their dismiss buttons.
- <kbd>Escape</kbd> dismisses the focused toast. Focus moves to the next toast, or back to where it was before the last toast closed.
- New toasts never take focus.
- A toast's progress is a progress bar with its value as a percentage, named after the toast's title. Screen readers read it when they reach the toast. Changes of the progress are not announced.
- Each type has its own icon shape, so the type does not depend on color.
- Close timers stop while the pointer is over the toasts, a toast has focus, an action runs, or the browser tab or window is in the background. A resumed timer keeps the toast open for at least one more second.
- Swiping is optional. Every toast that swipes away also has a dismiss button.
- With reduced motion turned on in the operating system, toasts fade without moving, and the progress bar shows the time left without moving.
