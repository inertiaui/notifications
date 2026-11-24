<?php

use InertiaUI\Notifications\Models\InboxNotification;
use InertiaUI\Notifications\Notifications\NotificationDigest;

return [

    /*
    |--------------------------------------------------------------------------
    | Flash Key
    |--------------------------------------------------------------------------
    |
    | This value is the key of the Inertia flash data that carries the toasts
    | to your frontend. If you change it, you should also pass the same key
    | to initNotifications({ flashKey }) in your frontend entry point.
    |
    */

    'flash_key' => 'inertiaui',

    /*
    |--------------------------------------------------------------------------
    | Translations
    |--------------------------------------------------------------------------
    |
    | When enabled, toast titles, descriptions, and action labels are passed
    | through Laravel's translator, so you may write a translation key in
    | Toast::success('invoices.sent'). Text without one is shown as is.
    |
    */

    'translate' => true,

    /*
    |--------------------------------------------------------------------------
    | Notification Center
    |--------------------------------------------------------------------------
    |
    | Here you may configure the notification center, which keeps a list of
    | the notifications sent through the "inbox" channel for each user. You
    | should set the table names below before running the migrations.
    |
    */

    'inbox' => [
        'table' => 'inbox_notifications',
        'model' => InboxNotification::class,
        'shared_prop' => 'inertiauiInbox',
        'per_page' => 20,
        'prune_after_days' => 90,
        'broadcast_notifications' => false,
        'broadcast_changes' => false,
        'actions' => ['snooze', 'archive', 'mute'],
        'selectable' => true,
        'category_filter' => false,
        'tabs' => [
            // 'production' => [
            //     'label' => 'Production',
            //     'category' => 'deployments',
            //     'data' => ['environment' => 'production'],
            // ],
        ],
        'throttle' => [
            // 'comments' => ['limit' => 1, 'seconds' => 60],
        ],
        'announcements_table' => 'inbox_announcements',
        'announcement_states_table' => 'inbox_announcement_states',
        'broadcast_announcements' => false,
        'mutes_table' => 'inbox_mutes',
    ],

    /*
    |--------------------------------------------------------------------------
    | Notification Preferences
    |--------------------------------------------------------------------------
    |
    | Here you may list the notification categories that users turn on and off
    | for each channel, using the <NotificationPreferences> component. Any
    | notification without a listed category is always sent.
    |
    */

    'preferences' => [
        'table' => 'notification_preferences',
        'channels' => [
            'inbox' => ['label' => 'In the app', 'via' => ['inbox', 'database', 'broadcast']],
            'mail' => ['label' => 'Email', 'via' => ['mail']],
            // 'sms' => ['label' => 'Text messages', 'via' => ['vonage'], 'global_switch' => false],
        ],
        'groups' => [
            // 'account' => ['label' => 'Account', 'description' => 'Your payments and sign-ins.'],
        ],
        'categories' => [
            // 'comments' => ['label' => 'Comments', 'description' => 'Replies to your issues.'],
            // 'billing' => ['label' => 'Billing', 'channels' => ['mail'], 'group' => 'account'],
            // 'security' => ['label' => 'Security', 'locked' => true, 'group' => 'account'],
            // 'product' => ['label' => 'Product updates', 'opt_in' => true],
            // 'reports' => ['label' => 'Reports', 'digest' => true],
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Digests
    |--------------------------------------------------------------------------
    |
    | Here you may let users receive a category of notifications in an hourly,
    | daily, or weekly digest instead of right away. You should schedule the
    | inertia-notifications:send-digests command to run every minute.
    |
    */

    'digests' => [
        'table' => 'notification_digest_items',
        'channels' => ['mail'],
        'frequencies' => ['hourly', 'daily', 'weekly'],
        'time' => '08:00',
        'weekday' => 'monday',
        'notification' => NotificationDigest::class,
        'inbox_url' => null,
        'preferences_url' => null,
    ],

    /*
    |--------------------------------------------------------------------------
    | Notification Hours
    |--------------------------------------------------------------------------
    |
    | Here you may let users choose the hours of each day when notifications
    | reach them, in their own timezone. Outside those hours, the channels
    | that digests hold wait and are sent once the next hours start.
    |
    */

    'notification_hours' => [
        'enabled' => false,
        'days' => [
            'monday' => ['07:00-22:00'],
            'tuesday' => ['07:00-22:00'],
            'wednesday' => ['07:00-22:00'],
            'thursday' => ['07:00-22:00'],
            'friday' => ['07:00-22:00'],
            'saturday' => ['07:00-22:00'],
            'sunday' => ['07:00-22:00'],
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Pausing Notifications
    |--------------------------------------------------------------------------
    |
    | Here you may let users pause their notifications for a while, such as
    | for an hour or until tomorrow, from the notification center's panel.
    | Pausing uses the digests table and command to hold the emails.
    |
    */

    'pause' => [
        'enabled' => false,
        'presets' => [30, 60, 120, 'tomorrow'],
    ],

    /*
    |--------------------------------------------------------------------------
    | Web Push
    |--------------------------------------------------------------------------
    |
    | Here you may let users receive notifications on their devices while your
    | application is closed. You should run inertia-notifications:vapid to
    | generate the VAPID keys, which are written to your .env file.
    |
    */

    'push' => [
        'enabled' => false,
        'public_key' => env('VAPID_PUBLIC_KEY'),
        'private_key' => env('VAPID_PRIVATE_KEY'),
        'subject' => env('VAPID_SUBJECT'),
        'table' => 'push_subscriptions',
        'ttl' => 60 * 60 * 24,
        'hosts' => [
            'fcm.googleapis.com',
            '*.push.services.mozilla.com',
            '*.push.apple.com',
            '*.notify.windows.com',
        ],
        'icon' => null,
        'connection' => null,
        'queue' => null,
    ],

];
