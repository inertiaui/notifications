import { Head, Link } from '@inertiajs/react'
import { NotificationPreferences, usePreferences } from '@inertiaui/notifications-react'
import type { ReactNode } from 'react'

import Layout from '../Layout'

export default function CustomPreferences() {
    // The same preferences as the component below, in a form of our own.
    const { channels, sections, set, setChannel, receives, isDisabled } = usePreferences()

    return (
        <>
            <Head title="Custom preferences" />
            <main className="mx-auto max-w-2xl px-6 py-10">
                <h1 className="text-2xl font-semibold">Custom preferences</h1>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    Both forms share the preferences of the{' '}
                    <Link href="/preferences" className="underline">
                        Preferences
                    </Link>{' '}
                    page.
                </p>

                <section data-demo-custom-preferences="" className="mt-8">
                    <h2 className="font-medium">Built with usePreferences()</h2>
                    <div className="mt-3 flex flex-wrap gap-4 text-sm">
                        {channels
                            .filter(({ globalSwitch }) => globalSwitch)
                            .map((channel) => (
                                <label key={channel.key} className="flex items-center gap-2 font-medium">
                                    <input
                                        type="checkbox"
                                        checked={channel.enabled}
                                        data-demo-channel={channel.key}
                                        onChange={(event) => void setChannel(channel.key, event.target.checked)}
                                    />
                                    All {channel.label.toLowerCase()}
                                </label>
                            ))}
                    </div>
                    {sections.map((section) => (
                        <fieldset key={section.group?.key ?? ''} className="mt-4 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                            <legend className="px-1 text-sm font-semibold">{section.group?.label ?? 'Other'}</legend>
                            {section.categories.map((category) => (
                                <div key={category.key} className="flex items-center justify-between gap-4 py-1.5 text-sm">
                                    <span>{category.label}</span>
                                    <span className="flex gap-4">
                                        {channels.map(
                                            (channel) =>
                                                category.channels[channel.key] !== undefined && (
                                                    <label key={channel.key} className="flex items-center gap-1.5">
                                                        <input
                                                            type="checkbox"
                                                            checked={receives(category, channel)}
                                                            disabled={isDisabled(category, channel)}
                                                            data-demo-preference={`${category.key}.${channel.key}`}
                                                            onChange={(event) => void set(category.key, channel.key, event.target.checked)}
                                                        />
                                                        {channel.label}
                                                    </label>
                                                ),
                                        )}
                                    </span>
                                </div>
                            ))}
                        </fieldset>
                    ))}
                </section>

                <section className="mt-10">
                    <h2 className="font-medium">The component with classes and slots</h2>
                    <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                        <NotificationPreferences
                            classes={{
                                table: 'demo-preferences-table',
                                switch: 'demo-switch aria-checked:bg-emerald-600',
                            }}
                            renderChannel={(channel) => (
                                <span data-demo-channel-head={channel.key} className="tracking-wide uppercase">
                                    {channel.label}
                                </span>
                            )}
                            renderGroup={(group) => (
                                <span
                                    data-demo-group={group.key}
                                    className="text-xs font-semibold tracking-wide text-emerald-700 uppercase dark:text-emerald-400"
                                >
                                    {group.label}
                                </span>
                            )}
                            renderCategory={(category) => (
                                <>
                                    <span data-demo-category={category.key} className="font-medium">
                                        {category.label}
                                    </span>
                                    {category.locked && <span className="ms-2 text-xs text-amber-700 dark:text-amber-400">Required</span>}
                                </>
                            )}
                        />
                    </div>
                </section>
            </main>
        </>
    )
}

CustomPreferences.layout = (page: ReactNode) => <Layout>{page}</Layout>
