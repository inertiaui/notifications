// A list item of the notification center: a notification, and the other notifications of its group behind a toggle.
import { useId, useState, type ReactNode } from 'react'

import { label, type InboxAction, type InboxClasses, type InboxGroup, type InboxItem, type InboxLabels, type SnoozeOption } from '../../js/inbox'
import * as styles from './classes'
import type { IconResolverFn } from './iconResolver'
import NotificationItem, { type NotificationItemProps } from './NotificationItem'

interface ItemGroupProps {
    group: InboxGroup
    now: number
    labels: InboxLabels
    icons: Record<string, ReactNode>
    iconResolver?: IconResolverFn | null
    classes: InboxClasses
    locale?: string
    pendingActions: Readonly<Record<string, number>>
    snooze?: (now: Date) => SnoozeOption[]
    allowedActions: readonly InboxAction[]
    /** The IDs of the selected notifications, with `select`; without them, the items have no checkbox. */
    selected?: readonly string[]
    select?: (id: string, selected: boolean) => void
    renderItem?: (item: InboxItem, now: number, props: NotificationItemProps) => ReactNode
}

export default function ItemGroup({
    group,
    now,
    labels,
    icons,
    iconResolver,
    classes,
    locale,
    pendingActions,
    snooze,
    allowedActions,
    selected,
    select,
    renderItem,
}: ItemGroupProps) {
    const [expanded, setExpanded] = useState(false)
    const id = useId()

    // A thread whose other notifications all left starts collapsed when the next one arrives.
    if (expanded && group.others.length === 0) {
        setExpanded(false)
    }

    const item = (notification: InboxItem, children?: ReactNode) => {
        // The props of the built-in item, which a custom item receives too, so it may fall back to the built-in one.
        const itemProps: NotificationItemProps = {
            item: notification,
            now,
            labels,
            icons,
            iconResolver,
            classes,
            locale,
            pendingAction: pendingActions[notification.id],
            snooze,
            allowedActions,
            selected: selected?.includes(notification.id) ?? false,
            onSelectedChange: select ? (value: boolean) => select(notification.id, value) : undefined,
        }

        return (
            <li
                key={notification.id}
                tabIndex={-1}
                data-inbox-item=""
                data-inbox-id={notification.id}
                data-read={String(notification.readAt !== null)}
                data-seen={String(notification.seenAt !== null)}
                data-archived={String(notification.archivedAt !== null)}
                data-announcement={notification.announcement ? 'true' : undefined}
                className={styles.listItemClass}
            >
                {renderItem ? renderItem(notification, now, itemProps) : <NotificationItem {...itemProps} />}
                {children}
            </li>
        )
    }

    return item(
        group.item,
        group.others.length > 0 && (
            <>
                <button
                    type="button"
                    data-inbox-group-toggle=""
                    aria-expanded={expanded}
                    aria-controls={expanded ? id : undefined}
                    className={styles.groupToggleClass}
                    onClick={() => setExpanded(!expanded)}
                >
                    {expanded ? label(labels.showLess) : label(labels.showMore, { count: group.others.length })}
                </button>
                {expanded && (
                    <ul id={id} role="list" className={styles.groupListClass}>
                        {group.others.map((other) => item(other))}
                    </ul>
                )}
            </>
        ),
    )
}
