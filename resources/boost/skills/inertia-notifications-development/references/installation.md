<!-- Generated from docs/installation.md with `pnpm docs:guide`. Edit the docs instead. -->

# Installation

## Install the Composer Package

Install Inertia Notifications with Composer:

```bash
composer require inertiaui/notifications
```

## Run the Install Command

Next, run the `inertia-notifications:install` command:

```bash
php artisan inertia-notifications:install
```

The command publishes the configuration file and the migrations, skipping files you already published. It then lists the frontend steps below and the steps that set up the [notification center](notification-center-setup.md). In an application built on a Laravel starter kit, it also lists the steps that move the kit's toasts to the package, as described in [Starter Kit Toasts](toasts-flashing-from-laravel.md#starter-kit-toasts).

### Laravel Boost

The package includes guidelines and a skill for [Laravel Boost](https://github.com/laravel/boost). Boost installs them only for the packages listed under `packages` in your `boost.json` file. The install command offers to add the package to this list, then runs `boost:update`.

Boost itself asks about new packages only while it runs interactively, so the `boost:update` script that the Laravel starter kits run after `composer require` does not add the package. You may also add it to `boost.json` yourself:

```json
{
    "packages": ["inertiaui/notifications"]
}
```

Then update the Boost guidelines and skills:

```bash
php artisan boost:update
```

## Install the Frontend Package

Next, install the Vue or React package from your application's `vendor` directory:

```bash
# Vue
npm install vendor/inertiaui/notifications/vue
```

```bash
# React
npm install vendor/inertiaui/notifications/react
```

> [!INFO] pnpm users
> The package depends on `@inertiaui/vanilla` and `tailwind-merge`. pnpm installs the dependencies of a local directory only with the `file:` protocol, such as `pnpm add file:vendor/inertiaui/notifications/vue`. The install command prints this command once it finds a `pnpm-lock.yaml` file.

### Installing From npm

You may also install the frontend package from npm. Use the same version as the Composer package:

```bash
# Vue
npm install @inertiaui/notifications-vue
```

```bash
# React
npm install @inertiaui/notifications-react
```

## Tailwind CSS

Import the package's theme after Tailwind in your `resources/css/app.css` file, then add the package's source files to Tailwind's sources. The components need the theme for their colors and the stack layout of the toasts:

```css
/* Vue */
@import 'tailwindcss';
@import '@inertiaui/notifications-vue/theme.css';

@source '../../vendor/inertiaui/notifications/vue/src/**/*.{ts,vue}';
```

```css
/* React */
@import 'tailwindcss';
@import '@inertiaui/notifications-react/theme.css';

@source '../../vendor/inertiaui/notifications/react/src/**/*.{ts,tsx}';
```

To use the frontend package from npm, point the `@source` at its `dist` directory instead:

```css
/* Vue */
@source '../../node_modules/@inertiaui/notifications-vue/dist';
```

```css
/* React */
@source '../../node_modules/@inertiaui/notifications-react/dist';
```

See [Styling](styling.md) to change the colors, spacing, and markup. In an application built on a Laravel starter kit, you may also import `shadcn.css` to use the kit's colors, as described in [Laravel Starter Kits](styling.md#laravel-starter-kits).

## Start Listening for Toasts

Call `initNotifications()` in your frontend entry point, before `createInertiaApp()`. It listens for toasts in every Inertia response, so a toast flashed on a page without a Toaster still shows on the next page that has one:

```js
// Vue
import { createInertiaApp } from '@inertiajs/vue3'
import { initNotifications } from '@inertiaui/notifications-vue'

initNotifications()

createInertiaApp({
    // ...
})
```

```js
// React
import { createInertiaApp } from '@inertiajs/react'
import { initNotifications } from '@inertiaui/notifications-react'

initNotifications()

createInertiaApp({
    // ...
})
```

You may pass options to `initNotifications()`, such as durations, the limit, and error toasts, as [Configuring Toasts](toasts-configuration.md) describes.

## Render the Toaster

Render one `Toaster` inside the Inertia app. Put it in a [persistent layout](https://inertiajs.com/docs/v3/the-basics/layouts), so it stays mounted while the user navigates:

```vue
<!-- Vue -->
<script setup>
import { Toaster } from '@inertiaui/notifications-vue'
</script>

<template>
    <slot />
    <Toaster />
</template>
```

```jsx
// React
import { Toaster } from '@inertiaui/notifications-react'

export default function Layout({ children }) {
    return (
        <>
            {children}
            <Toaster />
        </>
    )
}
```

In React, you may also render the `Toaster` next to the app in the `withApp` option of `createInertiaApp()`, where the Laravel React starter kit renders its sonner `Toaster`:

```jsx
createInertiaApp({
    withApp(app) {
        return (
            <>
                {app}
                <Toaster />
            </>
        )
    },
    // ...
})
```

Your application is now ready to [flash toasts from Laravel](toasts-flashing-from-laravel.md).

## Server-Side Rendering

The components support [server-side rendering](https://inertiajs.com/docs/v3/advanced/server-side-rendering), such as the `build:ssr` script of the Laravel starter kits. Your SSR entry point needs no changes, since `initNotifications()` and `toast()` do nothing on the server.

Each component renders the following on the server, and the rest waits for the browser:

- The `NotificationCenter` renders its bell and its closed panel. The badge shows once the browser reads the counts from the shared prop.
- The `NotificationList` renders the page's notifications. Their relative times, such as "5 minutes ago", may differ in the browser, and neither Vue nor React warns about that mismatch.
- The `Toaster` renders nothing. Toasts show once the page hydrates, including the ones Laravel flashed for the page.
- The `NotificationPreferences` component loads the user's preferences in the browser.
