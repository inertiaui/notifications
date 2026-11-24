import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

import { cn } from '../../js/cn'
import {
    inboxStore,
    label,
    snoozeTime,
    type InboxAction,
    type InboxBatchAction,
    type InboxClasses,
    type InboxFilter,
    type InboxItem,
    type InboxLabels,
    type SnoozeOption,
} from '../../js/inbox'
import { selectionActions, snoozeChoices } from '../../js/notificationCenter'
import * as styles from './classes'
import type { IconResolverFn } from './iconResolver'
import { Icon } from './parts'

export interface SelectionBarProps {
    /** The component that shows the bar, which the icon resolver receives. */
    component: 'NotificationCenter' | 'NotificationList'
    /** The notifications that the list shows, which the select-all checkbox selects. */
    items: readonly InboxItem[]
    /** The IDs of the selected notifications. */
    selected: readonly string[]
    onSelectedChange: (selected: readonly string[]) => void
    filter: InboxFilter
    allowedActions: readonly InboxAction[]
    now: number
    labels: InboxLabels
    icons: Record<string, ReactNode>
    iconResolver?: IconResolverFn | null
    classes: InboxClasses
    locale?: string
    snooze?: (now: Date) => SnoozeOption[]
}

/**
 * The bar below a list while notifications are selected: the select-all checkbox, the number of selected
 * notifications, and the actions for them, with the snooze times below it. The panel and the `NotificationList` share it.
 */
export default function SelectionBar({
    component,
    items,
    selected,
    onSelectedChange,
    filter,
    allowedActions,
    now,
    labels,
    icons,
    iconResolver,
    classes,
    locale,
    snooze,
}: SelectionBarProps) {
    const snoozeId = useId()
    const t = (name: keyof InboxLabels): string => label(labels[name])
    const selectedItems = items.filter((item) => selected.includes(item.id))
    const allSelected = selectedItems.length === items.length
    const choicesElement = useRef<HTMLDivElement>(null)
    // The snooze times while they show below the bar. Like those of a notification, they count from when they opened.
    const [choices, setChoices] = useState<SnoozeOption[] | null>(null)

    // The snooze times leave with the selection, so they never show for another one.
    if (choices !== null && selectedItems.length === 0) {
        setChoices(null)
    }

    useEffect(() => {
        if (choices) {
            choicesElement.current?.querySelector('button')?.focus()
        }
    }, [choices])

    const run = (action: InboxBatchAction, until?: Date): void => {
        onSelectedChange([])
        void inboxStore.batch(action, selectedItems, until)
    }

    if (selectedItems.length === 0) {
        return null
    }

    return (
        <>
            <div role="group" aria-label={t('selection')} data-inbox-selection="" className={styles.selectionBarClass}>
                <div className={styles.selectAllClass}>
                    <input
                        type="checkbox"
                        data-inbox-select-all=""
                        ref={(element) => {
                            if (element) {
                                element.indeterminate = !allSelected
                            }
                        }}
                        checked={allSelected}
                        aria-label={t('selectAll')}
                        className={styles.selectAllCheckboxClass}
                        onChange={() => onSelectedChange(allSelected ? [] : items.map((item) => item.id))}
                    />
                    <span aria-live="polite">{label(labels.selected, { count: selectedItems.length })}</span>
                </div>
                <div className={styles.panelActionsClass}>
                    {selectionActions(filter, allowedActions).map((entry) => (
                        <button
                            key={entry.action}
                            type="button"
                            data-inbox-batch={entry.action}
                            aria-label={t(entry.label)}
                            title={t(entry.label)}
                            aria-expanded={entry.action === 'snooze' ? choices !== null : undefined}
                            aria-controls={entry.action === 'snooze' && choices ? snoozeId : undefined}
                            className={cn(styles.controlClass, classes.control)}
                            onClick={() => (entry.action === 'snooze' ? setChoices(choices ? null : snoozeChoices(snooze, labels)) : run(entry.action))}
                        >
                            <Icon
                                name={entry.icon}
                                context={{ component, part: 'selection', action: entry.action }}
                                icons={icons}
                                resolver={iconResolver}
                                className="size-4"
                            />
                        </button>
                    ))}
                    <button
                        type="button"
                        data-inbox-clear-selection=""
                        aria-label={t('clearSelection')}
                        title={t('clearSelection')}
                        className={cn(styles.controlClass, classes.control)}
                        onClick={() => onSelectedChange([])}
                    >
                        <Icon name="dismiss" context={{ component, part: 'clear-selection' }} icons={icons} resolver={iconResolver} className="size-4" />
                    </button>
                </div>
            </div>
            {choices && (
                <div
                    id={snoozeId}
                    ref={choicesElement}
                    role="group"
                    aria-label={t('snoozeUntil')}
                    data-inbox-batch-snooze-options=""
                    className={styles.selectionSnoozeOptionsClass}
                >
                    {choices.map((option) => (
                        <button
                            key={option.label}
                            type="button"
                            data-inbox-batch-snooze-option=""
                            className={cn(styles.itemSecondaryActionClass, classes.action)}
                            onClick={() => {
                                setChoices(null)
                                run('snooze', option.until)
                            }}
                        >
                            {option.label} <span className={styles.snoozeTimeClass}>{snoozeTime(option.until, now, locale)}</span>
                        </button>
                    ))}
                </div>
            )}
        </>
    )
}
