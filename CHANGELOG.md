# Changelog

All notable changes to `inertiaui/notifications` will be documented in this file.

## Unreleased

### Toasts

- Flash toasts from Laravel with the `Toast` class.
- Render toasts with the Vue and React `Toaster` components, and show toasts from the browser with `toast()`.
- Listen for toasts at boot with `initNotifications()`, so toasts flashed on pages without a Toaster are not lost.
- Show the toasts flashed while loading deferred props.
- Flash toasts under a configurable, namespaced key (`inertiaui` by default).
- Set default durations from the reading time: warnings stay at least 8 seconds and errors stay until dismissed. Configure them with `duration`, `persistentErrors`, `durationScale`, and `autoDismiss`.
- Announce toasts to screen readers as plain text, errors assertively. Move focus to the newest toast with F8, dismiss the focused toast with Escape, and restore focus afterwards.
- Pause timers while the tab is hidden or the window is in the background, and give resumed toasts at least one more second.
- Show a distinct icon per type and respect reduced motion.
- Add custom toast types, such as `Toast::make('Deployed', 'deployment')`, with an icon, label, and color from the Toaster's `icons` and `typeLabels` props and the `data-type` attribute.
- Add the `loading` type, and replace an open toast by its ID from Laravel (`->id()`) and from the browser.
- Add actions that visit a URL with Inertia, load it in the browser, dispatch a browser event, or run a callback, with a loading state while they run.
- Add `toast.update()`, `toast.promise()` with `unwrap()`, `toast.track()` for Inertia visits, and `toast.fromHeaders()`. A toast that the server flashes with the ID of the loading toast stays in its place.
- Close a toast with actions after its duration once each action tells in its `altText` where else to do the same.
- Queue toasts beyond a `limit`, most important first, close the least important with `overflow: 'drop-oldest'`, or hide it until there is room with `overflow: 'hide'`. Timers only run while a toast is visible.
- Count identical toasts instead of stacking copies, and announce them again.
- Pass the reason a toast closed to `onClose`, and call `onRemove` after its exit animation.
- Stack toasts and expand the stack on hover and focus, swipe toasts away, show a progress bar, and render toasts at more than one position or in named Toasters.
- Move the toasts into the topmost open modal `<dialog>`, so they stay usable there.
- Customize the Toaster with the `classes` and `icons` props, a `toast` slot (Vue) or `renderToast` prop (React), data attributes, and CSS variables, or render toasts yourself with `useToasts()`.
- Import `shadcn.css` to give the toasts and the notification center the shadcn/ui colors and corners of the Laravel starter kits, in light and dark mode.
- Export the `InertiaUIFlashData` type to add to your app's Inertia `flashDataType`.
- Add the `back()->toast()` and `Inertia::render()->toast()` macros, `Toast::configureUsing()`, and translation of toast text with replacements.
- Show opt-in error toasts for failed requests instead of Inertia's error dialog.
- Test toasts with `Toast::fake()`, `Toast::assertFlashed()`, `assertNotFlashed()`, `assertNothingFlashed()`, and the `assertToast()` and `assertNoToasts()` response assertions.
- Run a toast's timer only while a Toaster with its name is mounted.
- Render the toasts of a type with your own component through the Toaster's `components` prop, such as `{ invite: InviteToast }`, with data from `->with([...])` in Laravel or the `data` option in the browser.
- Show a progress bar with `progress` (0 to 1) in the browser and `->progress()` in Laravel. `toast.track()` fills it from the upload progress of the visit.
- Show an image in place of a flashed toast's icon, such as an avatar, with `->image($url)`, as browser toasts do with the `image` option.
- Keep toasts usable above the modal dialogs of other libraries, such as Radix and Reka, and above the notification center's panel: their actions run without closing the dialog, and screen readers still reach them. Turn it off with the Toaster's `aboveModals` prop.

### Notification Center

- Add the notification center: send notifications through the `inbox` channel with the `InboxMessage` of their `toInbox()` method. Notifications are stored in their own table and pruned with `model:prune`.
- Add the `NotificationCenter` component: a bell with the count of new notifications, and a panel where users read, archive, and open notifications and run their actions. Changes show right away, and a failed request only undoes its own change.
- Add the `NotificationList` component for a page with every notification, loaded with Inertia's infinite scroll. Render the page with `Inertia::render('Notifications', Inbox::page())`, which reads the `filter` and `category` query parameters that the list's tabs and category buttons link to, as does the list without its `filter` and `category` props, or load the notifications yourself with `Inbox::scroll()`. It offers what the panel offers: **Mark all as read**, the **More actions** menu, the tabs and category buttons, the selection bar, seen tracking, and the "N new" button, with the `header` and `tab` slots (`renderHeader` and `renderTab`) and the `item-click` and `action` events.
- Add `useNotifications()` to build your own bell or panel, the `NotificationItem` component, and custom item markup with the `item` slot (Vue) or `renderItem` prop (React).
- Share the unread and unseen counts with every Inertia page, also on partial reloads, and register the JSON endpoints with `Route::inertiaNotifications()`.
- Flash a toast when a notification with `->toast()` is sent during a request of the user who receives it.
- Link the toast of a notification without actions to its URL with a **View** action that does not keep the toast open, since the notification stays in the notification center. Opening the panel closes the toasts of notifications, and notifications that arrive while it is open show no toast.
- Name an actor that is not a model with `InboxMessage::actor(name: 'GitHub', avatar: $url)`.
- Send other channels, such as email, only when the notification is still unread after a delay, with `InboxMessage::unlessReadWithin(minutes: 10, channels: ['mail'])`. The notification is stored right away, and the `InteractsWithInbox` trait delays the waiting channels of queued notifications. It keeps the delays of a parent class's `withDelay()`, and a notification with a `withDelay()` method of its own returns `inboxDelay()` from it for the waiting channels.
- Store and send a notification only once per user with `InboxMessage::once('invoice-42-paid')`, also when the job or action that sends it runs again. The key is unique per notifiable model in the `unique_key` column, and the first channel that runs stores it.
- Throttle the toasts and real-time arrivals of a category per user with the `inbox.throttle` config, such as one comment notification per minute. Notifications over the limit are still stored in the inbox, without a toast or a real-time arrival.
- Give notifications a team or tenant with `InboxMessage::for($team)`, and resolve the current one with `Inbox::resolveContextUsing()` to show only its notifications.
- Translate the title, body, and action labels of an `InboxMessage` when the notification center shows them, in the locale of the user who reads them. The translation keys and their replacements are stored, and text without a translation shows as it is.
- Open the panel on any side of the bell with the `placement` prop, such as `right-start` for a bell in a sidebar, and cap its height with the `--inbox-max-height` variable.
- Replace parts of the `NotificationCenter` with the `trigger`, `badge`, `header`, `tab`, `loading`, `error`, and `footer` slots (Vue) or `render*` props (React). Control the panel with `v-model:open` or the `open` and `onOpenChange` props, and cancel clicks in the `item-click` and `action` events (`onItemClick` and `onAction`).
- Choose what users may do with their notifications with the `inbox.actions` config option: snooze, archive, mute, and delete, which is off by default. An action that is left out has no buttons or tabs, the store skips it, and its endpoints answer with a `404` response. Users delete notifications for good from the `NotificationCenter`, the `NotificationList`, `delete()` of `useNotifications()`, or the `POST /{id}/delete` endpoint.
- Select notifications in the `NotificationCenter` and the `NotificationList` with the checkbox over their avatar or the X key, and mark them as read or unread, snooze or unsnooze, archive, or delete them from a bar at the bottom of the panel. Turn it off with the `inbox.selectable` config option, which also makes `POST /batch` answer with a `404` response, and change up to 100 notifications at once with `batch()` and `POST /batch`, including snoozing them until a given time.
- Hold the notifications that arrive while the user has scrolled down the panel's list behind an "N new" button at the top of the list, so the list does not move under the user. The button, or scrolling back to the top, shows them.
- Mark a notification as seen once it has been in view in the panel for a second. Panels built with `useNotifications()` may do the same with `opened(tabs, { markAllAsSeen: false })` and `batch('seen', items)`, which posts to `POST /seen/items`, also while selecting is off.
- Add tabs with the `inbox.tabs` config option, each listing the notifications of a category, with given `InboxMessage::with()` data, or both.
- Render the `NotificationCenter`, the `NotificationList`, and `useNotifications()` with the server's state until they mount, so hydration matches the server's HTML also below a Suspense boundary or an async component, and add `inboxStore.getServerSnapshot()`.
- Add `refresh()`, `receive()`, `archiveAll()`, and `closed()` to `useNotifications()`.
- Snooze notifications until later today, tomorrow, or next week, or until times you choose with the `snooze` prop. Snoozed notifications leave the inbox and its counts and show in the new **Snoozed** tab. Schedule `inertia-notifications:unsnooze` to bring them back as new, unread notifications.
- Filter the panel by category with the `inbox.category_filter` config option, which lists categories of the preferences, optionally with shorter labels by key, or takes `true` for all of them. Each category shows its unread count, shared as `categories` in the shared prop. While a category is selected, marking all as read and archiving all only change that category.
- Show notifications with the same group key as one, with a button that shows the others. Turn it off with `group={false}`.
- Triage notifications with the keyboard: J and K move between them, and U, E, H, and Enter mark the focused one as read, archive it, snooze it, or open it.
- Show **Archive all** and the pause times in a **More actions** menu in the header, next to **Mark all as read**, and name each button of a notification and the menu button in a tooltip with its key, such as **Archive E**, on hover and keyboard focus. The `inbox_archive` and other translations of the buttons are their text alone, and the new `inbox_item_control` translation adds the notification's title for screen readers.
- Order the server's responses and broadcasts by a `revision`, so a late response or `InboxChanged` event never undoes newer changes, and forget the previous user's notifications once another user signs in.
- Send the `ids` of the newest notifications the browser had to the bulk endpoints, so a notification created in the same second is left alone.
- Mark a notification as read once an action of its toast runs, also when the server flashed the toast.
- Show the result of a notification's action, such as "Approved", in place of its actions with `ToastAction::result()`. Complete notifications from your own code with `Inbox::complete()`, and bring the actions back with `Inbox::revertResult()`.
- Change or remove a sent notification with `Inbox::update()` and `Inbox::retract()`, by notification or by `once()` key. With `broadcast_changes`, open pages and toasts show the change right away, and `inboxStore.onChange()` receives it.
- Import the notifications that users received before the notification center with `Inbox::import()`, with the times they were sent and read. Imported notifications show no toast, broadcast no arrival, send no push, and leave the throttle, the notification hours, and collapsing alone.
- Collapse the notifications about one thing with `InboxMessage::collapse($minutes)`, such as the comments on a pull request, so the bell counts them once and the item shows "Sophie and 3 others".
- Name every actor of a collapsed notification in its title with the `:actors` replacement, such as "Sophie and Maria commented", in the panel, the list, toasts, pushes, and digest mails, worded with Laravel's translations of `:name and :other` and `:name and :count others`.
- Let users mute a thread from the mute button of a notification with a group key, or with `Inbox::mute()` and `mute()` of `useNotifications()`. A notification that mentions the user with `InboxMessage::mention()` still reaches them. Mutes are stored in the `inbox_mutes` table.
- Publish an announcement to every user, including those who sign up later, with `Announcement::make('Scheduled maintenance')->publish()`. Target an audience with `Announcement::defineAudience()`, expire it with `expiresAt()`, and scope it with `for()`.
- Polish the default look of the notification center: the buttons of a notification float over its title on hover and sit below it on touch screens, scrolling tabs fade at the edges, and the `NotificationList` shows its tabs and bulk actions in one row.
- Color the selected tab and category, the unread counts, the checkboxes, the switches, and the footer link with the `--color-iui-inbox-accent` and `--color-iui-inbox-accent-subtle` tokens, and outline the first action of a notification and the "N new" button in the accent color. The first action of a toast is outlined too, in the `--color-iui-toast-action` color.
- Show the notifications a tab or category already has while it loads, keep the panel's height while the rest load, and start the list at the top. On narrow screens, the sheet keeps its height, so its tabs stay in place.

### Real-Time Updates

- Show every notification that the notification center stores the moment it is stored, with the `inbox.broadcast_notifications` option and `initNotifications({ inbox: { echo } })`. The new `InboxNotificationArrived` event is broadcast once the transaction that stored the notification commits, and Laravel's `broadcast` channel stays the application's own. Show a toast for every arrival with `arrivalToasts: 'all'`.
- Share the user's changes with their other tabs through a `BroadcastChannel`, and with their other devices through the `InboxChanged` event when `inbox.broadcast_changes` is enabled. The browser that made the change sends its socket ID, so the event leaves it out.
- Poll the counts with `initNotifications({ inbox: { poll } })` in applications without broadcasting. Polling pauses while the tab is hidden.
- Run your own code for each notification that arrives in real time with `initNotifications({ inbox: { onArrival } })`, or listen from a component with `inboxStore.onArrival()`.
- Show a published announcement on open pages right away with the `inbox.broadcast_announcements` option. Pages load it from the new `GET /{id}` endpoint.
- Show the number of unread notifications in the title of every tab with `initNotifications({ inbox: { titleCount: true } })`, formatted with the `inbox_title_count` translation.
- Show the number of unread notifications on the icon of the installed app with `initNotifications({ inbox: { appBadge: true } })`.
- Show a desktop notification for each arrival while no tab of the application is in view with `initNotifications({ inbox: { desktopNotifications: true } })`, and ask for permission with `requestNotificationPermission()`.
- Play a sound in one tab for each notification that arrives in real time with `initNotifications({ inbox: { sound: true } })` for a built-in chime, which the package synthesizes instead of shipping an audio file, or with the URL of your own file.

### Web Push

- Push a notification to the devices of a user with web push by calling `InboxMessage::push()`, while every tab of the application is closed and on phones, with the `push.enabled` config. The `inbox` channel pushes the notification it stores, and `unlessReadWithin(minutes: 10, channels: ['push'])` pushes it only when it is still unread by then. The package encrypts and signs each push with OpenSSL, without a dependency, and sends it in the Declarative Web Push format with a queued job.
- Push a category only while the user receives it in the notification center, and grey out its **Push** switch in the `NotificationPreferences` component while its **In the app** switch is off.
- Show a **Push** column in the `NotificationPreferences` component, and a control that turns push on for the device the user is on and tells why it cannot, such as on a page without HTTPS, in Safari on iOS outside the Home Screen, or in Brave. Below it, list the user's other devices with push, so the user may remove one, such as a lost phone. Build your own control with `usePush()`.
- Serve the service worker from the package, and share the VAPID public key in the `push` key of the shared prop, so there is no file to copy and no `VITE_` variable. A device subscribes again on its own after a key rotation.
- Generate the VAPID keys into the `.env` file with `inertia-notifications:vapid`, check every part of the setup with its fix with `inertia-notifications:check-push`, and send a test push to each device of a user with `inertia-notifications:test-push`.
- Drop the push of a notification that arrives outside the notification hours, during a pause, over the throttle of its category, or after the user read it. Remove a device once its push service no longer knows it, and the device of a browser once its user signs out or another user signs in.
- Open a notification from its push through the new `GET /{id}/open` endpoint, which marks it as read and redirects to its URL in any team or tenant.
- Give each push the tag of the desktop notification that an open tab shows for the same notification, so browsers that replace a notification with one of the same tag show only one. An open tab still shows its desktop notification and plays its sound on a device with push turned on.
- Test pushes with `fakePush()`, `createPushSubscription()`, `assertPushed()`, `assertNotPushed()`, and `assertNothingPushed()`.

### Preferences

- Let users choose which categories they receive on each channel with the `NotificationPreferences` component. List the categories and channels in the `preferences` config, and lock the ones users must receive.
- Make a preference category opt-in with `'opt_in' => true`, so it stays off until the user turns it on.
- Show preference categories in groups with a heading, such as **Activity** and **Account**, with the `group` key of a category and the `groups` config.
- Turn a channel off for every category at once in the **All notifications** row, or with `NotificationPreferences::update($user, channels: [...])`. Leave the switch out with `'global_switch' => false`.
- Dispatch the `NotificationPreferencesChanged` event when a user changes their preferences, with the category choices and channel switches that changed.
- Let users receive a category in a daily or weekly digest with `'digest' => true` and the **Frequency** column. Schedule `inertia-notifications:send-digests` to send one `NotificationDigest` per user at the `digests.time` in their timezone, and test digests with `assertHeldForDigest()` and `assertDigestSent()`.
- Send the digest as a mail that leads with the number of notifications in each category, lists each category's notifications newest first with the actor's avatar or initials and the time in the user's timezone, and has a plain text version. Link it to your pages with `digests.inbox_url` and `digests.preferences_url`, and publish its views with the `inertia-notifications-views` tag.
- Let users choose their notification hours for each day of the week with the `notification_hours.enabled` config, as ranges such as `09:00-17:00` in their own timezone. Outside them, notifications show no toast or desktop notification, and digest emails wait until the next notification hours start. Check them with `NotificationHours::within()`, and test them with `assertWithinNotificationHours()` and `assertOutsideNotificationHours()`.
- Let users pause their notifications until a time they choose, such as for an hour or until tomorrow, with the `pause.enabled` config. While paused, notifications arrive as they do outside the notification hours, and digest emails wait until the pause ends and the notification hours start. Offer other times on the pause button with `pause.presets`. Pause and resume with `NotificationPreferences::pause()` and `resume()` or the `POST /pause` and `POST /resume` endpoints, read the pause from the `pause` key of the shared prop, listen for the `NotificationsPaused` and `NotificationsResumed` events, and test it with `assertNotificationsPaused()` and `assertNotificationsNotPaused()`.
- Add the `hourly` digest frequency, sent at the start of every hour in the user's timezone, together with the daily and weekly digests that are due then. Choose the frequencies that users may pick with the `digests.frequencies` config, which the preferences endpoint lists in its new `frequencies` key.
- Build your own preferences form with `usePreferences()`, and customize the `NotificationPreferences` component with the `classes` prop and its slots (Vue) or `render*` props (React).

### Customization

- Send the flashed toasts to a request of Inertia's HTTP client that renders no page, such as a `useHttp` request, in the `X-InertiaUI-Toasts` header with the opt-in `AddFlashedToastsToResponseHeaders` middleware, and add them to any response with `withToasts()`.
- Translate every built-in string for the whole application with `setTranslations()`, using keys such as `inbox_mark_all_as_read`. A translation may be a function, such as for plurals, and the `labels` props still override it per component.
- Resolve icon names to components with `setIconResolver()` or the `iconResolver` prop, including built-in icons such as `bell` and `spinner`. The `icons` props replace icons by name and win over the resolvers.
- Depend on `@inertiaui/vanilla` 1.7 in the Vue and React packages for the screen reader announcer, label placeholders, the direction and reduced motion checks, and the menu and tooltip controllers. A label value that contains a placeholder, such as a category named `Alerts :channel`, now shows as it is.
- Depend on `tailwind-merge` 3 in the Vue and React packages, so a class from the `classes` prop replaces the built-in class it conflicts with, such as `shadow-2xl` replacing the toast's default shadow.

### Developer Experience

- Add the `inertia-notifications:install` command, which publishes the configuration and the migrations and lists the remaining setup steps for Vue or React.
- Add the `make:inbox-notification` command, which creates a notification with the `inbox` channel, a `toInbox()` method, and the `InteractsWithInbox` trait.
- Test the notification center and the preferences with the `InteractsWithNotificationCenter` trait: `assertInboxMessage()`, `assertInboxMessageMissing()`, `assertNoInboxMessages()`, `assertMarkedRead()`, `assertMarkedUnread()`, `assertArchived()`, and `assertPreferenceSet()`.
- Add Laravel Boost guidelines and a skill for AI assistants.
