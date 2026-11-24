import { Link, router, usePage } from '@inertiajs/react'
import type { Placement } from '@inertiaui/vanilla'
import { useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type MouseEvent, type ReactNode } from 'react'

import { cn } from '../../js/cn'
import {
    badgeText,
    clock,
    groupItems,
    inboxLabels,
    inboxStore,
    label,
    syncFirstPage,
    type InboxClasses,
    type InboxFilter,
    type InboxItem,
    type InboxLabels,
    type SnoozeOption,
} from '../../js/inbox'
import {
    bellLabel,
    createNotificationCenterController,
    emptyText as emptyTextFor,
    handleListKeydown,
    holdArrivals,
    keepFocus,
    listState,
    shownTabs,
    shownItems,
    toggleSelected,
    trackSeen,
    clickTarget,
    type ArrivalHold,
    type NotificationCenterBadgeProps,
    type NotificationCenterController,
    type NotificationCenterErrorProps,
    type NotificationCenterFooterProps,
    type NotificationCenterHeaderProps,
    type NotificationCenterTabProps,
    type NotificationCenterTriggerProps,
} from '../../js/notificationCenter'
import type { ToastAction } from '../../js/types'
import * as styles from './classes'
import type { IconResolverFn } from './iconResolver'
import InboxHeader from './InboxHeader'
import ItemGroup from './ItemGroup'
import type { NotificationItemProps } from './NotificationItem'
import { initNotifications } from './notifications'
import { Icon } from './parts'
import SelectionBar from './SelectionBar'

export interface NotificationCenterProps {
    /** Text of the notification center, in place of the `inbox_` translations; `:count` and `:title` are replaced. */
    labels?: Partial<InboxLabels>
    /** What the bell shows when there are notifications: the number, a dot, or nothing. */
    badge?: 'count' | 'dot' | 'none'
    /** Which notifications the badge counts: those that arrived since the panel was last opened, or every unread one. */
    count?: 'unseen' | 'unread'
    /** The highest number the badge shows; larger counts show as this number with a plus, such as 99+. */
    maxCount?: number
    /** The URL of a page with every notification; the panel then links to it. */
    href?: string
    /** Icons for the icon names that notifications refer to, and for the built-in icons, such as `bell`. */
    icons?: Record<string, ReactNode>
    /** Resolves the icons that `icons` does not have, in place of the global resolver of `setIconResolver()`. */
    iconResolver?: IconResolverFn | null
    /** Class names added to the parts of the notification center. */
    classes?: InboxClasses
    /** The locale of relative times and numbers; defaults to the browser's. */
    locale?: string
    /** Replaces the content of each notification. It receives the props of the built-in `NotificationItem`. */
    renderItem?: (item: InboxItem, now: number, props: NotificationItemProps) => ReactNode
    /** Replaces the text shown when the selected tab has no notifications. */
    renderEmpty?: (filter: InboxFilter) => ReactNode
    /** Show notifications with the same `InboxMessage::group()` key as one, with a button that shows the others. */
    group?: boolean
    /** The snooze times to offer, from the current time, in place of the built-in ones. */
    snooze?: (now: Date) => SnoozeOption[]
    /** Where the panel opens next to the bell, such as `bottom-end`. It moves to the other side when there is no room. */
    placement?: Placement
    /** Opens or closes the panel from elsewhere. Pair it with `onOpenChange`, which reports the changes of the panel itself. */
    open?: boolean
    /** Runs after the panel opened or closed. */
    onOpenChange?: (open: boolean) => void
    /** The link of a notification was clicked. Call `event.preventDefault()` to keep the panel from opening it. */
    onItemClick?: (item: InboxItem, event: MouseEvent<HTMLElement>) => void
    /** An action of a notification was clicked. Call `event.preventDefault()` to keep the panel from running it. */
    onAction?: (item: InboxItem, action: ToastAction<InboxItem>, event: MouseEvent<HTMLElement>) => void
    /** Replaces the content of the bell button: the bell icon and the badge. */
    renderTrigger?: (props: NotificationCenterTriggerProps) => ReactNode
    /** Replaces the badge on the bell. It renders only while the count is above zero. */
    renderBadge?: (props: NotificationCenterBadgeProps) => ReactNode
    /** Replaces the top of the panel, with the title, the bulk actions, and the pause button. */
    renderHeader?: (props: NotificationCenterHeaderProps) => ReactNode
    /** Replaces the content of each tab. */
    renderTab?: (props: NotificationCenterTabProps) => ReactNode
    /** Replaces the spinner while the list loads. */
    renderLoading?: () => ReactNode
    /** Replaces the message and the button shown when loading the list, or its next page, failed. */
    renderError?: (props: NotificationCenterErrorProps) => ReactNode
    /** Replaces the bottom of the panel, which links to `href` by default. */
    renderFooter?: (props: NotificationCenterFooterProps) => ReactNode
}

const subscribeNothing = () => () => {}

export default function NotificationCenter({
    labels,
    badge = 'count',
    count = 'unseen',
    maxCount = 99,
    href,
    icons = {},
    iconResolver,
    classes = {},
    locale,
    renderItem,
    renderEmpty,
    group = true,
    snooze,
    placement = 'bottom-end',
    open: openProp,
    onOpenChange,
    onItemClick,
    onAction,
    renderTrigger,
    renderBadge,
    renderHeader,
    renderTab,
    renderLoading,
    renderError,
    renderFooter,
}: NotificationCenterProps) {
    const { props } = usePage()
    const id = useId()
    const ids = {
        panel: `${id}-panel`,
        title: `${id}-title`,
        list: `${id}-list`,
        tab: (filter: InboxFilter) => `${id}-tab-${filter}`,
    }

    const state = useSyncExternalStore(inboxStore.subscribe, inboxStore.getSnapshot, inboxStore.getServerSnapshot)
    const [open, setOpen] = useState(false)
    const [mountedAt] = useState(Date.now)
    // Relative times refresh every minute while the panel is open.
    const now = useSyncExternalStore(open ? clock.subscribe : subscribeNothing, clock.getSnapshot, () => mountedAt)

    const allLabels = inboxLabels(labels)
    const t = (name: keyof InboxLabels): string => label(allLabels[name])
    const badgeCount = state.counts[count]
    const emptyText = emptyTextFor(state.filter, allLabels)
    const tabs = shownTabs(state)
    const categories = state.categoryFilter
    // The notifications that arrived while the reader scrolled down wait behind the button at the top of the list.
    const [held, setHeld] = useState<readonly string[]>([])
    const items = shownItems(state.items, held)
    const groups = groupItems(items, group)
    const hasTabs = tabs.length > 1

    const trigger = useRef<HTMLButtonElement>(null)
    const panel = useRef<HTMLDivElement>(null)
    const sentinel = useRef<HTMLDivElement>(null)
    const scroller = useRef<HTMLDivElement>(null)
    const arrivals = useRef<ArrivalHold | null>(null)
    const controller = useRef<NotificationCenterController | null>(null)
    // The tabs and categories when the panel opens, which may have changed since it mounted.
    const tabsRef = useRef(tabs)
    const categoriesRef = useRef(categories)
    const placementRef = useRef(placement)
    const onOpenChangeRef = useRef(onOpenChange)

    useLayoutEffect(() => {
        initNotifications()

        syncFirstPage(props)

        let openedAt: string | undefined
        let isOpenNow = false
        const stopKeepingFocus = keepFocus(panel.current!)
        const hold = holdArrivals(scroller.current!, setHeld, {
            scroller: scroller.current!,
            listed: (id) => inboxStore.getSnapshot().items.some((item) => item.id === id),
        })
        arrivals.current = hold
        // The panel marks the notifications that the user saw as seen, rather than all of them when it opens.
        const seen = trackSeen(scroller.current!, () => inboxStore.getSnapshot().items)

        const instance = createNotificationCenterController(trigger.current!, panel.current!, {
            onToggle(isOpen) {
                setOpen(isOpen)
                isOpenNow = isOpen
                onOpenChangeRef.current?.(isOpen)

                if (isOpen) {
                    openedAt = window.location.href
                    void inboxStore.opened(tabsRef.current, { markAllAsSeen: false, categories: Object.keys(categoriesRef.current) })
                } else {
                    inboxStore.closed({ markAllAsSeen: false })
                }
            },
            onEndReached: () => void inboxStore.loadMore(),
            placement: () => placementRef.current,
        })
        controller.current = instance

        // A visit to another page, such as by opening a notification, closes the panel.
        const stopListening = router.on('navigate', () => {
            if (window.location.href !== openedAt) {
                instance.close()
            }
        })

        return () => {
            if (isOpenNow) {
                inboxStore.closed({ markAllAsSeen: false })
            }

            stopListening()
            stopKeepingFocus()
            hold.destroy()
            seen.destroy()
            instance.destroy()
            controller.current = null
        }
    }, [])

    // The held notifications can empty the list and bring it back without a change of the store, which mounts a new sentinel.
    useLayoutEffect(() => controller.current?.observe(open ? sentinel.current : null), [state, open, items.length > 0])

    useLayoutEffect(() => {
        onOpenChangeRef.current = onOpenChange
        tabsRef.current = tabs
        categoriesRef.current = categories
    })

    // Opens or closes the panel to match the `open` prop.
    useLayoutEffect(() => {
        const shown = panel.current?.matches(':popover-open') ?? false

        if (openProp === true && !shown) {
            panel.current?.showPopover()
        } else if (openProp === false && shown) {
            controller.current?.close()
        }
    }, [openProp])

    useLayoutEffect(() => {
        placementRef.current = placement
        controller.current?.place()
    }, [placement])

    // An open panel whose tabs no longer include the list it shows switches to the first tab.
    useLayoutEffect(() => {
        if (open && tabs.length > 0 && !tabs.includes(state.filter)) {
            void inboxStore.load(tabs[0], state.category)
        }
    }, [tabs.join()])

    // Found by its ID rather than its ref, because render props receive it.
    const close = (): void => {
        const element = document.getElementById(ids.panel)

        if (element?.matches(':popover-open')) {
            element.hidePopover()
        }
    }

    // The selection lasts while the panel shows the same list, so another tab or category starts without one.
    const selectionKey = `${state.filter}|${state.category}|${open}|${state.selectable}`
    const [selectedIds, setSelectedIds] = useState<readonly string[]>([])
    const [selectedKey, setSelectedKey] = useState(selectionKey)

    // Another tab or category, or closing the panel, clears the selection while rendering, so it never shows on another list.
    if (selectedKey !== selectionKey) {
        setSelectedKey(selectionKey)
        setSelectedIds([])
    }

    const selecting = items.some((item) => selectedIds.includes(item.id))

    // Another tab or category, or closing the panel, shows the held notifications in their place.
    useLayoutEffect(() => arrivals.current?.release(), [selectionKey])

    const select = (id: string, selected: boolean): void => setSelectedIds((current) => toggleSelected(current, id, selected))

    // Runs before the click reaches the notification, so a listener may prevent it.
    const onPanelClick = (event: MouseEvent<HTMLElement>): void => {
        const target = clickTarget(event.nativeEvent, state.items)

        if (target?.action) {
            onAction?.(target.item, target.action, event)
        } else if (target) {
            onItemClick?.(target.item, event)
        }
    }

    const retryButton = (retry: () => void) => (
        <>
            <p role="alert">{t('error')}</p>
            <button type="button" data-inbox-retry="" className={styles.itemSecondaryActionClass} onClick={retry}>
                {t('retry')}
            </button>
        </>
    )

    const list = listState(state, items.length)
    let content: ReactNode

    if (list === 'loading') {
        content = (
            <div role="status" className={styles.stateClass}>
                {renderLoading ? (
                    renderLoading()
                ) : (
                    <>
                        <Icon
                            name="spinner"
                            context={{ component: 'NotificationCenter', part: 'loading' }}
                            icons={icons}
                            resolver={iconResolver}
                            className={cn(styles.stateIconClass, 'motion-safe:animate-spin')}
                        />
                        <span className="sr-only">{t('loading')}</span>
                    </>
                )}
            </div>
        )
    } else if (list === 'error') {
        content = (
            <div data-inbox-error="" className={styles.stateClass}>
                {(renderError ?? (({ retry }: NotificationCenterErrorProps) => retryButton(retry)))({ more: false, retry: () => void inboxStore.load() })}
            </div>
        )
    } else if (list === 'empty') {
        content = (
            <div data-inbox-empty="" className={styles.stateClass}>
                {renderEmpty ? (
                    renderEmpty(state.filter)
                ) : (
                    <>
                        <Icon
                            name="empty"
                            context={{ component: 'NotificationCenter', part: 'empty', filter: state.filter }}
                            icons={icons}
                            resolver={iconResolver}
                            className={styles.stateIconClass}
                        />
                        <p>{emptyText}</p>
                    </>
                )}
            </div>
        )
    } else {
        content = (
            <>
                <ul role="list" data-inbox-selecting={selecting || undefined} className={cn(styles.listClass, classes.list)}>
                    {groups.map((entry) => (
                        <ItemGroup
                            key={entry.key}
                            group={entry}
                            now={now}
                            labels={allLabels}
                            icons={icons}
                            iconResolver={iconResolver}
                            classes={classes}
                            locale={locale}
                            pendingActions={state.pendingActions}
                            snooze={snooze}
                            allowedActions={state.allowedActions}
                            selected={state.selectable ? selectedIds : undefined}
                            select={state.selectable ? select : undefined}
                            renderItem={renderItem}
                        />
                    ))}
                </ul>
                {state.hasMore && state.moreFailed && (
                    <div data-inbox-more-failed="" className={styles.stateClass}>
                        {(renderError ?? (({ retry }: NotificationCenterErrorProps) => retryButton(retry)))({
                            more: true,
                            retry: () => void inboxStore.loadMore({ retry: true }),
                        })}
                    </div>
                )}
                {state.hasMore && !state.moreFailed && (
                    <div ref={sentinel} aria-hidden="true" className={styles.loadingMoreClass}>
                        {state.loadingMore && (
                            <Icon
                                name="spinner"
                                context={{ component: 'NotificationCenter', part: 'loading-more' }}
                                icons={icons}
                                resolver={iconResolver}
                                className={styles.spinnerClass}
                            />
                        )}
                    </div>
                )}
            </>
        )
    }

    return (
        <div data-inbox="" className="inline-flex">
            <button
                ref={trigger}
                type="button"
                popoverTarget={ids.panel}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-controls={ids.panel}
                aria-label={bellLabel(allLabels, badgeCount, maxCount, locale, state.pausedUntil !== null)}
                data-inbox-bell=""
                data-paused={state.pausedUntil !== null ? 'true' : undefined}
                className={cn(styles.bellClass, classes.bell)}
            >
                {renderTrigger ? (
                    renderTrigger({ open, count: badgeCount, counts: state.counts })
                ) : (
                    <>
                        <Icon
                            name={state.pausedUntil !== null ? 'paused' : 'bell'}
                            context={{ component: 'NotificationCenter', part: 'bell' }}
                            icons={icons}
                            resolver={iconResolver}
                            className="size-5"
                        />
                        {badge !== 'none' && badgeCount > 0 && renderBadge && renderBadge({ count: badgeCount, text: badgeText(badgeCount, maxCount, locale) })}
                        {badge === 'count' && badgeCount > 0 && !renderBadge && (
                            <span data-inbox-badge="" aria-hidden="true" className={cn(styles.badgeClass, classes.badge)}>
                                {badgeText(badgeCount, maxCount, locale)}
                            </span>
                        )}
                        {badge === 'dot' && badgeCount > 0 && !renderBadge && (
                            <span data-inbox-badge="" aria-hidden="true" className={cn(styles.badgeDotClass, classes.badge)} />
                        )}
                    </>
                )}
            </button>

            <div
                id={ids.panel}
                ref={panel}
                popover="auto"
                role="dialog"
                aria-labelledby={ids.title}
                tabIndex={-1}
                data-inbox-panel=""
                className={cn(styles.panelClass, classes.panel)}
                onKeyDown={(event) => handleListKeydown(event.nativeEvent, panel.current!)}
                onClickCapture={onPanelClick}
            >
                <div className={styles.panelBodyClass}>
                    <InboxHeader
                        component="NotificationCenter"
                        state={state}
                        filter={state.filter}
                        category={state.category}
                        items={state.items}
                        labels={allLabels}
                        icons={icons}
                        iconResolver={iconResolver}
                        classes={classes}
                        locale={locale}
                        maxCount={maxCount}
                        now={now}
                        panel={{ titleId: ids.title, title: t('title'), tabId: ids.tab, listId: ids.list, close }}
                        open={open}
                        renderHeader={renderHeader}
                        renderTab={renderTab}
                    />

                    <div
                        id={ids.list}
                        ref={scroller}
                        data-inbox-scroller=""
                        role={hasTabs ? 'tabpanel' : undefined}
                        aria-labelledby={hasTabs ? ids.tab(state.filter) : undefined}
                        aria-busy={state.status === 'loading' || state.loadingMore || undefined}
                        className={styles.scrollerClass}
                    >
                        <div aria-live="polite" className={styles.newPillRowClass}>
                            {held.length > 0 && (
                                <button type="button" data-inbox-show-new="" className={styles.newPillClass} onClick={() => arrivals.current?.reveal()}>
                                    {label(allLabels.showNew, { count: held.length })}
                                </button>
                            )}
                        </div>
                        {content}
                    </div>

                    <SelectionBar
                        component="NotificationCenter"
                        items={items}
                        selected={selectedIds}
                        onSelectedChange={setSelectedIds}
                        filter={state.filter}
                        allowedActions={state.allowedActions}
                        now={now}
                        labels={allLabels}
                        icons={icons}
                        iconResolver={iconResolver}
                        classes={classes}
                        locale={locale}
                        snooze={snooze}
                    />

                    {renderFooter
                        ? renderFooter({ href, close })
                        : href && (
                              <Link href={href} data-inbox-view-all="" className={styles.footerClass}>
                                  {t('viewAll')}
                              </Link>
                          )}
                </div>
            </div>
        </div>
    )
}
