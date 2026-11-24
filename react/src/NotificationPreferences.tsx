import { useEffect, useId, useState, useSyncExternalStore, type ReactNode } from 'react'

import { cn } from '../../js/cn'
import { clock, label } from '../../js/inbox'
import {
    editNotificationHours,
    notificationHoursDays,
    preferencesLabels,
    preferencesTable,
    togglePreference,
    type NotificationHoursEdit,
    type NotificationHoursEditing,
    type PreferenceCategory,
    type PreferenceChannel,
    type PreferenceFrequency,
    type PreferenceGroup,
    type PreferencesClasses,
    type PreferencesLabels,
} from '../../js/preferences'
import { otherPushDevices, pushDeviceView, pushStore, togglePushDevice } from '../../js/push'
import * as styles from './classes'
import { Icon } from './parts'
import { usePreferences } from './usePreferences'
import { usePush } from './usePush'

export interface NotificationPreferencesProps {
    /** Text of the component, in place of the `preferences_` translations; `:category`, `:channel`, `:day`, `:start`, `:end`, `:browser`, `:platform`, `:time`, and `:device` are replaced. */
    labels?: Partial<PreferencesLabels>
    /** Class names added to the parts of the component. */
    classes?: PreferencesClasses
    /** The locale of the weekday names of the notification hours and of when other devices were active; defaults to the browser's. */
    locale?: string
    /** Replaces the label, badge, and description of each category. */
    renderCategory?: (category: PreferenceCategory) => ReactNode
    /** Replaces the label and description of each group. */
    renderGroup?: (group: PreferenceGroup) => ReactNode
    /** Replaces the label of each channel's column. */
    renderChannel?: (channel: PreferenceChannel) => ReactNode
    /** Replaces the text shown when there are no categories. */
    renderEmpty?: () => ReactNode
}

/** A table of the notification categories, with a switch per channel, saved as the user changes them. */
export default function NotificationPreferences({
    labels,
    classes = {},
    locale,
    renderCategory,
    renderGroup,
    renderChannel,
    renderEmpty,
}: NotificationPreferencesProps) {
    const {
        status,
        channels,
        categories,
        sections,
        notificationHours,
        frequencies,
        load,
        setChannel,
        setFrequency,
        setNotificationHours,
        receives,
        frequencyApplies,
        isDisabled,
    } = usePreferences()
    const push = usePush()
    const [editing, setEditing] = useState<NotificationHoursEditing | null>(null)
    const allLabels = preferencesLabels(labels)
    const t = (name: keyof PreferencesLabels): string => label(allLabels[name])
    const table = preferencesTable(channels, categories, frequencies, allLabels)
    // The device control shows while a channel sends web push, the application sends pushes, and the browser could receive them.
    const pushDevice = channels.some((channel) => channel.push) ? pushDeviceView(push) : null
    // The user's other devices show below the device control, which loads them each time it shows.
    const [mountedAt] = useState(Date.now)
    const now = useSyncExternalStore(clock.subscribe, clock.getSnapshot, () => mountedAt)
    const otherDevices = otherPushDevices(push.devices, allLabels, now, locale)
    const devicesId = useId()
    const showsPush = pushDevice !== null

    useEffect(() => {
        if (showsPush) {
            void pushStore.loadDevices()
        }
    }, [showsPush])

    const edit = (change: NotificationHoursEdit): void => {
        const next = editNotificationHours(notificationHours, editing, change)

        if (next) {
            setEditing(next.editing)
            void setNotificationHours({ days: { [change.day]: next.ranges } })
        }
    }

    if (status === 'error') {
        return (
            <div data-inbox-preferences="">
                <div data-inbox-preferences-error="" className={styles.stateClass}>
                    <p>{t('error')}</p>
                    <button type="button" className={styles.itemSecondaryActionClass} onClick={() => void load()}>
                        {t('retry')}
                    </button>
                </div>
            </div>
        )
    }

    if (categories.length === 0) {
        return (
            <div data-inbox-preferences="">
                {status === 'ready' ? (
                    <div data-inbox-preferences-empty="" className={styles.stateClass}>
                        {renderEmpty ? renderEmpty() : <p>{t('empty')}</p>}
                    </div>
                ) : (
                    <div role="status" className={styles.stateClass}>
                        <Icon name="spinner" context={{ component: 'NotificationPreferences', part: 'loading' }} className={styles.spinnerClass} />
                        <span className="sr-only">{t('loading')}</span>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div data-inbox-preferences="">
            <div className={styles.preferencesTableScrollClass}>
                <table className={cn(styles.preferencesTableClass, classes.table)}>
                    <caption className="sr-only">{t('title')}</caption>
                    <thead>
                        <tr>
                            <th scope="col" className={cn(styles.preferencesHeadClass, classes.head)}>
                                {t('category')}
                            </th>
                            {channels.map((channel) => (
                                <th key={channel.key} scope="col" className={cn(styles.preferencesChannelHeadClass, classes.head)}>
                                    {renderChannel ? renderChannel(channel) : channel.label}
                                </th>
                            ))}
                            {table.hasFrequencies && (
                                <th scope="col" className={cn(styles.preferencesFrequencyHeadClass, classes.head)}>
                                    {t('frequency')}
                                </th>
                            )}
                        </tr>
                    </thead>
                    {table.hasGlobalSwitches && (
                        <tbody data-inbox-preferences-global="">
                            <tr className={cn(styles.preferencesRowClass, classes.row)}>
                                <th scope="row" className={styles.preferencesCategoryClass}>
                                    <span className={cn(styles.preferencesLabelClass, classes.label)}>{t('global')}</span>
                                    <span className={cn(styles.preferencesDescriptionClass, classes.description)}>{t('globalDescription')}</span>
                                </th>
                                {channels.map((channel) => (
                                    <td key={channel.key} className={styles.preferencesCellClass}>
                                        {channel.globalSwitch && (
                                            <button
                                                type="button"
                                                role="switch"
                                                aria-checked={channel.enabled}
                                                aria-label={label(allLabels.toggle, { category: t('global'), channel: channel.label })}
                                                data-inbox-preference-channel={channel.key}
                                                className={cn(styles.switchClass, classes.switch)}
                                                onClick={() => void setChannel(channel.key, !channel.enabled)}
                                            >
                                                <span aria-hidden="true" className={styles.switchThumbClass} />
                                            </button>
                                        )}
                                    </td>
                                ))}
                                {table.hasFrequencies && <td />}
                            </tr>
                        </tbody>
                    )}
                    {sections.map((section) => (
                        <tbody key={section.group?.key ?? ''} data-inbox-preference-group={section.group?.key}>
                            {section.group && (
                                <tr className={styles.preferencesRowClass}>
                                    <th scope="rowgroup" colSpan={table.columns} className={cn(styles.preferencesGroupClass, classes.group)}>
                                        {renderGroup ? (
                                            renderGroup(section.group)
                                        ) : (
                                            <>
                                                <span className={styles.preferencesGroupLabelClass}>{section.group.label}</span>
                                                {section.group.description && (
                                                    <span className={cn(styles.preferencesDescriptionClass, classes.description)}>
                                                        {section.group.description}
                                                    </span>
                                                )}
                                            </>
                                        )}
                                    </th>
                                </tr>
                            )}
                            {section.categories.map((category) => (
                                <tr key={category.key} data-inbox-preference-category={category.key} className={cn(styles.preferencesRowClass, classes.row)}>
                                    <th scope="row" className={styles.preferencesCategoryClass}>
                                        {renderCategory ? (
                                            renderCategory(category)
                                        ) : (
                                            <>
                                                <span className={cn(styles.preferencesCategoryLabelClass, classes.label)}>{category.label}</span>
                                                {category.locked && <span className={cn(styles.preferencesLockedClass, classes.badge)}>{t('locked')}</span>}
                                                {category.description && (
                                                    <span className={cn(styles.preferencesDescriptionClass, classes.description)}>{category.description}</span>
                                                )}
                                            </>
                                        )}
                                    </th>
                                    {channels.map((channel) => (
                                        <td key={channel.key} className={styles.preferencesCellClass}>
                                            {category.channels[channel.key] !== undefined && (
                                                <button
                                                    type="button"
                                                    role="switch"
                                                    aria-checked={receives(category, channel)}
                                                    aria-disabled={isDisabled(category, channel) || undefined}
                                                    aria-label={label(allLabels.toggle, { category: category.label, channel: channel.label })}
                                                    data-inbox-preference={`${category.key}.${channel.key}`}
                                                    className={cn(styles.switchClass, classes.switch)}
                                                    onClick={() => togglePreference(category, channel, channels)}
                                                >
                                                    <span aria-hidden="true" className={styles.switchThumbClass} />
                                                </button>
                                            )}
                                        </td>
                                    ))}
                                    {table.hasFrequencies && (
                                        <td className={styles.preferencesFrequencyCellClass}>
                                            {category.frequency !== null && (
                                                <select
                                                    value={category.frequency}
                                                    disabled={!frequencyApplies(category, channels)}
                                                    aria-label={label(allLabels.frequencyLabel, { category: category.label })}
                                                    data-inbox-preference-frequency={category.key}
                                                    className={cn(styles.preferencesSelectClass, classes.select)}
                                                    onChange={(event) => void setFrequency(category.key, event.target.value as PreferenceFrequency)}
                                                >
                                                    {table.frequencyOptions.map((option) => (
                                                        <option key={option.value} value={option.value}>
                                                            {option.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    ))}
                </table>
            </div>
            {pushDevice !== null && (
                <div
                    data-inbox-push-device=""
                    data-state={pushDevice.state}
                    aria-busy={pushDevice.state === 'busy' || undefined}
                    className={styles.preferencesPushClass}
                >
                    <div className={styles.preferencesPushHeaderClass}>
                        <div className={styles.preferencesPushTextClass}>
                            <span className={cn(styles.preferencesLabelClass, classes.label)}>{t('pushDevice')}</span>
                            <div aria-live="polite" data-inbox-push-device-status="">
                                {pushDevice.hint ? (
                                    <p className={cn(styles.preferencesPushHintClass, classes.description)}>{t(pushDevice.text)}</p>
                                ) : (
                                    <span className={cn(styles.preferencesDescriptionClass, classes.description)}>{t(pushDevice.text)}</span>
                                )}
                            </div>
                        </div>
                        {pushDevice.button && (
                            <button
                                type="button"
                                aria-disabled={pushDevice.state === 'busy' || undefined}
                                data-inbox-push-device-button=""
                                className={cn(
                                    pushDevice.button.primary ? styles.itemPrimaryActionClass : styles.itemSecondaryActionClass,
                                    styles.preferencesPushButtonClass,
                                )}
                                onClick={() => togglePushDevice(pushDevice)}
                            >
                                {pushDevice.state === 'busy' && (
                                    <Icon
                                        name="spinner"
                                        context={{ component: 'NotificationPreferences', part: 'push-busy' }}
                                        className={styles.actionSpinnerClass}
                                    />
                                )}
                                {t(pushDevice.button.label)}
                            </button>
                        )}
                    </div>
                    {otherDevices.length > 0 && (
                        <div data-inbox-push-other-devices="" className={styles.preferencesPushDevicesClass}>
                            <p id={devicesId} className={styles.preferencesPushDevicesHeadingClass}>
                                {t('pushDevices')}
                            </p>
                            <ul aria-labelledby={devicesId} className={styles.preferencesPushDevicesListClass}>
                                {otherDevices.map((device) => (
                                    <li key={device.id} data-inbox-push-other-device="" className={styles.preferencesPushDeviceClass}>
                                        <div className={styles.preferencesPushBodyClass}>
                                            <span className={cn(styles.preferencesLabelClass, classes.label)}>{device.name}</span>
                                            <span className={cn(styles.preferencesDescriptionClass, classes.description)}>{device.active}</span>
                                        </div>
                                        <button
                                            type="button"
                                            aria-label={device.removeLabel}
                                            data-inbox-push-other-device-remove=""
                                            className={cn(styles.itemSecondaryActionClass, styles.preferencesPushButtonClass)}
                                            onClick={() => void pushStore.removeDevice(device.id)}
                                        >
                                            {t('pushDeviceRemove')}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
            {notificationHours !== null && (
                <div data-inbox-preferences-notification-hours="" className={styles.preferencesNotificationHoursClass}>
                    <div className={styles.preferencesNotificationHoursHeaderClass}>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={notificationHours.enabled}
                            aria-label={t('notificationHours')}
                            data-inbox-notification-hours=""
                            className={cn(styles.switchClass, classes.switch)}
                            onClick={() => void setNotificationHours({ enabled: !notificationHours.enabled })}
                        >
                            <span aria-hidden="true" className={styles.switchThumbClass} />
                        </button>
                        <div>
                            <span className={cn(styles.preferencesLabelClass, classes.label)}>{t('notificationHours')}</span>
                            <span className={cn(styles.preferencesDescriptionClass, classes.description)}>{t('notificationHoursDescription')}</span>
                        </div>
                    </div>
                    <div className={styles.preferencesNotificationHoursDaysClass}>
                        {notificationHoursDays(notificationHours, editing, locale).map(({ day, name, ranges, locked, canAdd }) => (
                            <div
                                key={day}
                                role="group"
                                aria-label={name}
                                data-inbox-notification-hours-day={day}
                                className={styles.preferencesNotificationHoursDayClass}
                                onBlur={(event) => {
                                    if (!event.currentTarget.contains(event.relatedTarget)) {
                                        setEditing(null)
                                    }
                                }}
                            >
                                <div className={styles.preferencesNotificationHoursDayNameClass}>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={ranges.length > 0}
                                        aria-disabled={locked || undefined}
                                        aria-label={label(allLabels.notificationHoursDay, { day: name })}
                                        data-inbox-notification-hours-day-switch=""
                                        className={cn(styles.switchClass, classes.switch)}
                                        onClick={() => edit({ kind: 'toggle', day })}
                                    >
                                        <span aria-hidden="true" className={styles.switchThumbClass} />
                                    </button>
                                    <span>{name}</span>
                                </div>
                                {ranges.length > 0 ? (
                                    <div className={styles.preferencesNotificationHoursRangesClass}>
                                        {ranges.map(([start, end], index) => (
                                            <div key={index} className={styles.preferencesNotificationHoursRangeClass}>
                                                <label className={styles.preferencesTimeLabelClass}>
                                                    <span className="sr-only">{t('notificationHoursStart')}</span>
                                                    <input
                                                        type="time"
                                                        required
                                                        value={start}
                                                        disabled={!notificationHours.enabled}
                                                        data-inbox-notification-hours-start=""
                                                        className={cn(styles.preferencesTimeClass, classes.time)}
                                                        onChange={(event) => edit({ kind: 'time', day, index, field: 'start', time: event.target.value })}
                                                    />
                                                </label>
                                                <span aria-hidden="true" className={styles.preferencesTimeLabelClass}>
                                                    –
                                                </span>
                                                <label className={styles.preferencesTimeLabelClass}>
                                                    <span className="sr-only">{t('notificationHoursEnd')}</span>
                                                    <input
                                                        type="time"
                                                        required
                                                        value={end}
                                                        disabled={!notificationHours.enabled}
                                                        data-inbox-notification-hours-end=""
                                                        className={cn(styles.preferencesTimeClass, classes.time)}
                                                        onChange={(event) => edit({ kind: 'time', day, index, field: 'end', time: event.target.value })}
                                                    />
                                                </label>
                                                {ranges.length > 1 && (
                                                    <button
                                                        type="button"
                                                        disabled={!notificationHours.enabled}
                                                        aria-label={label(allLabels.notificationHoursRemoveLabel, { start, end, day: name })}
                                                        data-inbox-notification-hours-remove=""
                                                        className={styles.preferencesNotificationHoursButtonClass}
                                                        onClick={() => edit({ kind: 'remove', day, index })}
                                                    >
                                                        {t('notificationHoursRemove')}
                                                    </button>
                                                )}
                                                {index === ranges.length - 1 && (
                                                    <button
                                                        type="button"
                                                        disabled={!canAdd}
                                                        aria-label={label(allLabels.notificationHoursAddLabel, { day: name })}
                                                        data-inbox-notification-hours-add=""
                                                        className={styles.preferencesNotificationHoursButtonClass}
                                                        onClick={() => edit({ kind: 'add', day })}
                                                    >
                                                        {t('notificationHoursAdd')}
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className={styles.preferencesNotificationHoursOffClass}>{t('notificationHoursOff')}</p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
