import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from 'react'

import { actionHref } from '../../js/actions'
import { cn } from '../../js/cn'
import { customIcon } from '../../js/iconResolver'
import {
    actorsText,
    inboxLabels,
    inboxStore,
    isSnoozed,
    label,
    relativeTime,
    snoozeOptions,
    snoozeTime,
    stackedActors,
    type InboxAction,
    type InboxClasses,
    type InboxItem,
    type InboxLabels,
    type SnoozeOption,
} from '../../js/inbox'
import { initials } from '../../js/notificationCenter'
import type { TranslationValue } from '../../js/translations'
import * as styles from './classes'
import type { IconComponent, IconResolverFn } from './iconResolver'
import { Icon, renderIcon } from './parts'
import Tooltip from './Tooltip'

export interface NotificationItemProps {
    item: InboxItem
    /** The current time in milliseconds, for the relative time and whether the snooze has ended. Keep it current, or an ended snooze keeps showing. */
    now: number
    /** The text of the item; defaults to the `inbox_` translations. */
    labels?: InboxLabels
    /** Icons for the icon names that notifications refer to, and for the built-in icons, such as `archive`. */
    icons?: Record<string, ReactNode>
    /** Resolves the icons that `icons` does not have, in place of the global resolver of `setIconResolver()`. */
    iconResolver?: IconResolverFn | null
    classes?: InboxClasses
    locale?: string
    /** The index of the action that is running, from `pendingActions` of the inbox state. */
    pendingAction?: number
    /** The snooze times to offer, from the current time, in place of the built-in ones. */
    snooze?: (now: Date) => SnoozeOption[]
    /**
     * The actions that the item shows buttons for, from `allowedActions` of the inbox state: snooze, archive, mute, and
     * delete. Defaults to every action but deleting, like the server's `inbox.actions` config.
     */
    allowedActions?: readonly InboxAction[]
    /** Whether the notification is selected, for the actions of the selection bar. */
    selected?: boolean
    /** Called when the user selects or deselects the notification. Without it, the item has no checkbox. */
    onSelectedChange?: (selected: boolean) => void
}

const DEFAULT_ITEM_ACTIONS: readonly InboxAction[] = ['snooze', 'archive', 'mute']

export default function NotificationItem({
    item,
    now,
    labels = inboxLabels(),
    icons = {},
    iconResolver,
    classes = {},
    locale,
    pendingAction,
    snooze,
    allowedActions = DEFAULT_ITEM_ACTIONS,
    selected = false,
    onSelectedChange,
}: NotificationItemProps) {
    const unread = item.readAt === null
    const archived = item.archivedAt !== null
    const snoozed = isSnoozed(item, now)
    const actors = actorsText(labels, item)
    const stacked = stackedActors(item)
    const allows = (action: InboxAction): boolean => allowedActions.includes(action)
    // A control's tooltip shows its action, and its accessible name adds the notification's title.
    const controlName = (action: TranslationValue): string => label(labels.itemControl, { action: label(action), title: item.title })
    const showsSnooze = allows('snooze')
    const snoozeId = useId()
    const [options, setOptions] = useState<SnoozeOption[] | null>(null)
    const optionsElement = useRef<HTMLDivElement>(null)

    // The snooze times close once snoozing is no longer offered, such as after the application left it out.
    if (options && !showsSnooze) {
        setOptions(null)
    }

    useEffect(() => {
        if (options) {
            optionsElement.current?.querySelector('button')?.focus()
        }
    }, [options])

    // A snoozed notification goes back to the inbox; otherwise the snooze times show below the notification.
    const toggleSnooze = (): void => {
        if (snoozed) {
            void inboxStore.unsnooze(item)
        } else if (options) {
            setOptions(null)
        } else {
            const current = new Date()
            setOptions(snooze ? snooze(current) : snoozeOptions(labels, current))
        }
    }
    // Where an icon of the item renders, for icon resolvers.
    const context = (part: string) => ({ component: 'NotificationItem', part, item })
    const icon = item.icon ? customIcon<ReactNode | IconComponent>(item.icon, context('media'), icons, iconResolver) : undefined
    const absoluteTime = new Date(item.createdAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })

    let media: ReactNode = (
        <Icon name={item.announcement ? 'announcement' : 'notification'} context={context('media')} icons={icons} resolver={iconResolver} className="size-5" />
    )

    if (item.actor?.avatar) {
        media = <img src={item.actor.avatar} alt="" className="size-full object-cover" />
    } else if (icon !== undefined) {
        media = renderIcon(icon, 'size-5')
    } else if (item.actor?.name) {
        media = initials(item.actor.name)
    }

    const Leading = onSelectedChange ? 'label' : 'span'

    return (
        <div
            data-read={String(!unread)}
            data-archived={String(archived)}
            data-selected={onSelectedChange ? String(selected) : undefined}
            className={cn(styles.itemClass, classes.item)}
        >
            <Leading className={cn(styles.leadingClass, onSelectedChange && styles.selectableLeadingClass)}>
                <span aria-hidden="true" className={cn(styles.mediaClass, classes.media)}>
                    {media}
                </span>
                {onSelectedChange && (
                    <span className={styles.checkboxOverlayClass}>
                        <input
                            type="checkbox"
                            data-inbox-select=""
                            aria-keyshortcuts="X"
                            checked={selected}
                            aria-label={label(labels.select, { title: item.title })}
                            className={styles.checkboxClass}
                            onChange={(event) => onSelectedChange(event.target.checked)}
                        />
                    </span>
                )}
                {unread && <span aria-hidden="true" className={styles.unreadDotClass} />}
            </Leading>
            <div className="min-w-0 flex-1">
                <p className={cn(styles.itemTitleClass, classes.title)}>
                    {unread && <span className="sr-only">{label(labels.unreadState)}: </span>}
                    {item.announcement && <span className="sr-only">{label(labels.announcement)}: </span>}
                    {item.url ? (
                        <a data-inbox-link="" href={item.url} className={styles.linkClass} onClick={(event) => inboxStore.open(item, event.nativeEvent)}>
                            {item.title}
                        </a>
                    ) : (
                        item.title
                    )}
                </p>
                {item.body && <p className={cn(styles.itemBodyClass, classes.body)}>{item.body}</p>}
                {item.image && <img src={item.image} alt="" className={styles.itemImageClass} />}
                {actors && (
                    <p data-inbox-actors="" className={cn(styles.itemActorsClass, classes.actors)}>
                        <span aria-hidden="true" className={styles.actorStackClass}>
                            {stacked.map((actor, index) => (
                                <span key={index} style={{ zIndex: stacked.length - index }} className={styles.stackedAvatarClass}>
                                    {actor.avatar ? <img src={actor.avatar} alt="" className="size-full object-cover" /> : actor.name && initials(actor.name)}
                                </span>
                            ))}
                        </span>
                        {actors}
                    </p>
                )}
                {snoozed && item.snoozedUntil ? (
                    <p data-inbox-snoozed-until="" suppressHydrationWarning className={cn(styles.snoozedUntilClass, classes.time)}>
                        <Icon name="snooze" context={context('snoozed-until')} icons={icons} resolver={iconResolver} className="size-3.5" />
                        {label(labels.snoozedUntil, { time: snoozeTime(item.snoozedUntil, now, locale) })}
                    </p>
                ) : (
                    <time dateTime={item.createdAt} title={absoluteTime} suppressHydrationWarning className={cn(styles.timeClass, classes.time)}>
                        {relativeTime(item.createdAt, now, locale)}
                    </time>
                )}
                {item.muted && (
                    <p data-inbox-muted="" className={cn(styles.mutedClass, classes.time)}>
                        <Icon name="mute" context={context('muted')} icons={icons} resolver={iconResolver} className="size-3.5" />
                        {label(labels.muted)}
                    </p>
                )}
                {item.result !== null && (
                    <p data-inbox-result="" className={cn(styles.itemResultClass, classes.result)}>
                        <Icon name="result" context={context('result')} icons={icons} resolver={iconResolver} className="size-3.5" />
                        {item.result}
                    </p>
                )}
                {item.result === null && item.actions.length > 0 && (
                    <div className={styles.itemActionsClass}>
                        {item.actions.map((action, index) => {
                            const href = actionHref(action)
                            const props = {
                                'aria-disabled': pendingAction !== undefined || undefined,
                                'aria-busy': pendingAction === index || undefined,
                                'data-inbox-action': String(index),
                                className: cn(index === 0 ? styles.itemPrimaryActionClass : styles.itemSecondaryActionClass, classes.action),
                                onClick: (event: MouseEvent) => inboxStore.runAction(item, index, event.nativeEvent),
                            }
                            const children = (
                                <>
                                    {pendingAction === index && (
                                        <Icon
                                            name="spinner"
                                            context={{ ...context('action'), action }}
                                            icons={icons}
                                            resolver={iconResolver}
                                            className={styles.actionSpinnerClass}
                                        />
                                    )}
                                    {action.label}
                                </>
                            )

                            return href === undefined ? (
                                <button key={index} type="button" {...props}>
                                    {children}
                                </button>
                            ) : (
                                <a
                                    key={index}
                                    href={href}
                                    target={action.newTab ? '_blank' : undefined}
                                    rel={action.newTab ? 'noopener noreferrer' : undefined}
                                    {...props}
                                >
                                    {children}
                                </a>
                            )
                        })}
                    </div>
                )}
                {options && (
                    <div
                        id={snoozeId}
                        ref={optionsElement}
                        role="group"
                        aria-label={label(labels.snoozeUntil)}
                        data-inbox-snooze-options=""
                        className={styles.itemActionsClass}
                    >
                        {options.map((option) => (
                            <button
                                key={option.label}
                                type="button"
                                data-inbox-snooze-option=""
                                className={cn(styles.itemSecondaryActionClass, classes.action)}
                                onClick={() => {
                                    setOptions(null)
                                    void inboxStore.snooze(item, option.until)
                                }}
                            >
                                {option.label} <span className={styles.snoozeTimeClass}>{snoozeTime(option.until, now, locale)}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <div className={styles.controlsClass}>
                <Tooltip text={label(unread ? labels.markAsRead : labels.markAsUnread)} shortcut="U">
                    <button
                        type="button"
                        data-inbox-toggle-read=""
                        aria-keyshortcuts="U"
                        aria-label={controlName(unread ? labels.markAsRead : labels.markAsUnread)}
                        className={cn(styles.controlClass, classes.control)}
                        onClick={() => void (unread ? inboxStore.markAsRead(item) : inboxStore.markAsUnread(item))}
                    >
                        <Icon name={unread ? 'read' : 'unread'} context={context('toggle-read')} icons={icons} resolver={iconResolver} className="size-4" />
                    </button>
                </Tooltip>
                {showsSnooze && !archived && (
                    <Tooltip text={label(snoozed ? labels.unsnooze : labels.snooze)} shortcut="H">
                        <button
                            type="button"
                            data-inbox-snooze=""
                            aria-keyshortcuts="H"
                            aria-label={controlName(snoozed ? labels.unsnooze : labels.snooze)}
                            aria-expanded={snoozed ? undefined : options !== null}
                            aria-controls={snoozed || !options ? undefined : snoozeId}
                            className={cn(styles.controlClass, classes.control)}
                            onClick={toggleSnooze}
                        >
                            <Icon name={snoozed ? 'unsnooze' : 'snooze'} context={context('snooze')} icons={icons} resolver={iconResolver} className="size-4" />
                        </button>
                    </Tooltip>
                )}
                {item.group !== null && allows('mute') && (
                    <Tooltip text={label(item.muted ? labels.unmute : labels.mute)}>
                        <button
                            type="button"
                            data-inbox-mute=""
                            aria-label={controlName(item.muted ? labels.unmute : labels.mute)}
                            className={cn(styles.controlClass, classes.control)}
                            onClick={() => void (item.muted ? inboxStore.unmute(item) : inboxStore.mute(item))}
                        >
                            <Icon name={item.muted ? 'unmute' : 'mute'} context={context('mute')} icons={icons} resolver={iconResolver} className="size-4" />
                        </button>
                    </Tooltip>
                )}
                {allows('archive') && (
                    <Tooltip text={label(archived ? labels.unarchive : labels.archive)} shortcut="E">
                        <button
                            type="button"
                            data-inbox-toggle-archive=""
                            aria-keyshortcuts="E"
                            aria-label={controlName(archived ? labels.unarchive : labels.archive)}
                            className={cn(styles.controlClass, classes.control)}
                            onClick={() => void (archived ? inboxStore.unarchive(item) : inboxStore.archive(item))}
                        >
                            <Icon
                                name={archived ? 'unarchive' : 'archive'}
                                context={context('archive')}
                                icons={icons}
                                resolver={iconResolver}
                                className="size-4"
                            />
                        </button>
                    </Tooltip>
                )}
                {allows('delete') && (
                    <Tooltip text={label(labels.delete)}>
                        <button
                            type="button"
                            data-inbox-delete=""
                            aria-label={controlName(labels.delete)}
                            className={cn(styles.controlClass, classes.control)}
                            onClick={() => void inboxStore.delete(item)}
                        >
                            <Icon name="delete" context={context('delete')} icons={icons} resolver={iconResolver} className="size-4" />
                        </button>
                    </Tooltip>
                )}
            </div>
        </div>
    )
}
