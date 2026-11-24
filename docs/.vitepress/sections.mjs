// The pages of the sidebar, in order. This file imports nothing, so scripts/boost-guide.mjs may read it to write
// the Boost guide without loading the VitePress config and its plugins.
export const docsSections = [
    {
        name: 'Getting Started',
        canonicalPath: '/introduction',
        items: [
            { text: 'Introduction', link: '/introduction' },
            { text: 'Requirements', link: '/requirements' },
            { text: 'Installation', link: '/installation' },
        ],
    },
    {
        name: 'Toasts',
        canonicalPath: '/toasts/flashing-from-laravel',
        items: [
            { text: 'Flashing From Laravel', link: '/toasts/flashing-from-laravel' },
            { text: 'Toast Options', link: '/toasts/options' },
            { text: 'Actions', link: '/toasts/actions' },
            { text: 'Browser Toasts', link: '/toasts/browser-toasts' },
            { text: 'JSON Endpoints', link: '/toasts/json-endpoints' },
            { text: 'Configuration', link: '/toasts/configuration' },
            { text: 'The Toaster', link: '/toasts/toaster' },
            { text: 'Custom Toasts', link: '/toasts/custom-toasts' },
            { text: 'Testing', link: '/toasts/testing' },
        ],
    },
    {
        name: 'Notification Center',
        canonicalPath: '/notification-center/setup',
        items: [
            { text: 'Setup', link: '/notification-center/setup' },
            { text: 'Sending Notifications', link: '/notification-center/sending-notifications' },
            { text: 'Announcements', link: '/notification-center/announcements' },
            { text: 'Real-Time Updates', link: '/notification-center/real-time-updates' },
            { text: 'Component', link: '/notification-center/component' },
            { text: 'Custom Markup', link: '/notification-center/custom-markup' },
            { text: 'Notifications Page', link: '/notification-center/notifications-page' },
            { text: 'Browser Alerts', link: '/notification-center/browser-alerts' },
            { text: 'Web Push', link: '/notification-center/web-push' },
            { text: 'Teams and Tenants', link: '/notification-center/teams-and-tenants' },
            { text: 'Custom Interfaces', link: '/notification-center/custom-interfaces' },
            { text: 'PHP API', link: '/notification-center/reading-and-changing' },
            { text: 'Configuration', link: '/notification-center/configuration' },
            { text: 'Testing', link: '/notification-center/testing' },
        ],
    },
    {
        name: 'Preferences',
        canonicalPath: '/preferences/setup',
        items: [
            { text: 'Setup', link: '/preferences/setup' },
            { text: 'Categories and Channels', link: '/preferences/categories' },
            { text: 'Digests', link: '/preferences/digests' },
            { text: 'Notification Hours', link: '/preferences/notification-hours' },
            { text: 'Pausing Notifications', link: '/preferences/pausing' },
            { text: 'Component', link: '/preferences/component' },
            { text: 'Custom Forms', link: '/preferences/custom-forms' },
            { text: 'PHP API', link: '/preferences/php' },
            { text: 'Testing', link: '/preferences/testing' },
        ],
    },
    {
        name: 'Advanced',
        canonicalPath: '/styling',
        items: [
            { text: 'Styling', link: '/styling' },
            { text: 'Icons', link: '/icons' },
            { text: 'Translations', link: '/translations' },
        ],
    },
]
