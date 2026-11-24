import { InfiniteScroll, usePage } from '@inertiajs/react'
import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type MouseEvent, type ReactNode } from 'react'

import { cn } from '../../js/cn'
import {
    clock,
    groupItems,
    inboxLabels,
    inboxStore,
    label,
    listItems,
    parseInboxItem,
    syncFirstPage,
    type InboxClasses,
    type InboxFilter,
    type InboxItem,
    type InboxLabels,
    type SnoozeOption,
} from '../../js/inbox'
import {
    clickTarget,
    emptyText as emptyTextFor,
    handleListKeydown,
    holdArrivals,
    keepFocus,
    listHref,
    listScope,
    shownItems,
    toggleSelected,
    trackSeen,
    type ArrivalHold,
    type NotificationCenterTabProps,
    type NotificationListHeaderProps,
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

export interface NotificationListProps {
    /** The name of the page prop that holds `Inbox::scroll()`. */
    data: string
    /** The filter the page prop was loaded with, in place of the URL's `filter` query parameter; notifications that no longer match, such as archived ones in `all`, are hidden. */
    filter?: InboxFilter
    /** Text of the list, in place of the `inbox_` translations; `:count` and `:title` are replaced. */
    labels?: Partial<InboxLabels>
    /** Icons for the icon names that notifications refer to, and for the built-in icons, such as `empty`. */
    icons?: Record<string, ReactNode>
    /** Resolves the icons that `icons` does not have, in place of the global resolver of `setIconResolver()`. */
    iconResolver?: IconResolverFn | null
    classes?: InboxClasses
    locale?: string
    /** How far from the end of the list, in pixels, the next page starts loading. */
    buffer?: number
    /** Load the next page with a button instead of when the end of the list scrolls into view. */
    manual?: boolean
    /** Keep the URL when a page loads, instead of adding its cursor. */
    preserveUrl?: boolean
    /** Replaces the content of each notification. It receives the props of the built-in `NotificationItem`. */
    renderItem?: (item: InboxItem, now: number, props: NotificationItemProps) => ReactNode
    /** Replaces the text shown when there are no notifications. */
    renderEmpty?: (filter: InboxFilter) => ReactNode
    /** The category the page prop was loaded with, in place of the URL's `category` query parameter; notifications of other categories that arrive are hidden. */
    category?: string | null
    /** Show notifications with the same `InboxMessage::group()` key as one, with a button that shows the others. */
    group?: boolean
    /** The snooze times to offer, from the current time, in place of the built-in ones. */
    snooze?: (now: Date) => SnoozeOption[]
    /** The highest number the tabs and categories show; larger counts show as this number with a plus, such as 99+. */
    maxCount?: number
    /** Replaces the top of the list, with the bulk actions and the pause button. */
    renderHeader?: (props: NotificationListHeaderProps) => ReactNode
    /** Replaces the content of each tab. */
    renderTab?: (props: NotificationCenterTabProps) => ReactNode
    /** The link of a notification was clicked. Call `event.preventDefault()` to keep the list from opening it. */
    onItemClick?: (item: InboxItem, event: MouseEvent<HTMLElement>) => void
    /** An action of a notification was clicked. Call `event.preventDefault()` to keep the list from running it. */
    onAction?: (item: InboxItem, action: ToastAction<InboxItem>, event: MouseEvent<HTMLElement>) => void
}

export default function NotificationList({
    data,
    filter: filterProp,
    labels,
    icons = {},
    iconResolver,
    classes = {},
    locale,
    buffer = 250,
    manual = false,
    preserveUrl = false,
    renderItem,
    renderEmpty,
    category: categoryProp,
    group = true,
    snooze,
    maxCount = 99,
    renderHeader,
    renderTab,
    onItemClick,
    onAction,
}: NotificationListProps) {
    const page = usePage()
    const state = useSyncExternalStore(inboxStore.subscribe, inboxStore.getSnapshot, inboxStore.getServerSnapshot)
    const [mountedAt] = useState(Date.now)
    const now = useSyncExternalStore(clock.subscribe, clock.getSnapshot, () => mountedAt)

    // Without the filter and category props, the list shows those of the URL, which its tabs and category buttons link to.
    const { filter, category } = listScope(page.url, state, filterProp, categoryProp)
    const allLabels = inboxLabels(labels)
    const emptyText = emptyTextFor(filter, allLabels)
    const root = useRef<HTMLDivElement>(null)

    const value = (page.props as Record<string, unknown>)[data] as { data?: unknown } | undefined
    const raw = value?.data
    const loaded = useMemo(() => (Array.isArray(raw) ? raw.map(parseInboxItem).filter((item) => item !== undefined) : []), [raw])

    // Notifications that arrive in real time show first, and the user's changes, such as marking as read in the
    // notification center, apply to the page's notifications too. `state` changes with every change, so the list recomputes.
    const listed = useMemo(() => listItems(inboxStore, loaded, filter, category), [loaded, filter, category, state])
    // Those that arrived while the reader scrolled down the page wait behind the button at the top of the list.
    const [held, setHeld] = useState<readonly string[]>([])
    const items = shownItems(listed, held)
    const groups = groupItems(items, group)
    const hasMore = Boolean(page.scrollProps?.[data]?.nextPage)
    const arrivals = useRef<ArrivalHold | null>(null)
    // What the list of the latest render shows, and what it was loaded with, which the arrival hold and the seen tracking read.
    const itemsRef = useRef(items)
    const scope = useRef({ loaded, filter, category })

    useLayoutEffect(() => {
        itemsRef.current = items
        scope.current = { loaded, filter, category }
    })

    // The tabs and categories link to the same page with another filter and category, from its newest notifications.
    const href = (nextFilter: InboxFilter, nextCategory: string | null): string =>
        listHref(page.url, nextFilter, nextCategory, page.scrollProps?.[data]?.pageName)

    // The selection lasts while the page shows the same list.
    const selectionKey = `${filter}|${category}|${state.selectable}`
    const [selectedIds, setSelectedIds] = useState<readonly string[]>([])
    const [selectedKey, setSelectedKey] = useState(selectionKey)

    if (selectedKey !== selectionKey) {
        setSelectedKey(selectionKey)
        setSelectedIds([])
    }

    const selecting = items.some((item) => selectedIds.includes(item.id))

    // Another filter or category shows the held notifications in their place.
    useLayoutEffect(() => arrivals.current?.release(), [selectionKey])

    const select = (id: string, selected: boolean): void => setSelectedIds((current) => toggleSelected(current, id, selected))

    // Runs before the click reaches the notification, so a listener may prevent it.
    const onClick = (event: MouseEvent<HTMLElement>): void => {
        const target = clickTarget(event.nativeEvent, items)

        if (target?.action) {
            onAction?.(target.item, target.action, event)
        } else if (target) {
            onItemClick?.(target.item, event)
        }
    }

    useLayoutEffect(() => {
        initNotifications()

        syncFirstPage(page.props)
    }, [])

    useLayoutEffect(() => inboxStore.remember(loaded), [loaded])

    useLayoutEffect(() => keepFocus(root.current!), [])

    useLayoutEffect(() => {
        // A notification that just arrived is in the store before the list renders it.
        const listedNow = (id: string): boolean =>
            listItems(inboxStore, scope.current.loaded, scope.current.filter, scope.current.category).some((item) => item.id === id)
        const hold = holdArrivals(root.current!, setHeld, { listed: listedNow })
        arrivals.current = hold
        // Like the panel, the list marks the notifications that the user saw on the page as seen.
        const seen = trackSeen(root.current!, () => itemsRef.current, null)

        return () => {
            hold.destroy()
            seen.destroy()
            arrivals.current = null
        }
    }, [])

    return (
        <div ref={root} data-inbox-list="" tabIndex={-1} onKeyDown={(event) => handleListKeydown(event.nativeEvent, root.current!)} onClickCapture={onClick}>
            <InboxHeader
                component="NotificationList"
                state={state}
                filter={filter}
                category={category}
                items={items}
                labels={allLabels}
                icons={icons}
                iconResolver={iconResolver}
                classes={classes}
                locale={locale}
                maxCount={maxCount}
                now={now}
                href={href}
                renderHeader={renderHeader}
                renderTab={renderTab}
            />

            <div aria-live="polite" className={styles.newPillRowClass}>
                {held.length > 0 && (
                    <button type="button" data-inbox-show-new="" className={styles.newPillClass} onClick={() => arrivals.current?.reveal()}>
                        {label(allLabels.showNew, { count: held.length })}
                    </button>
                )}
            </div>

            <InfiniteScroll
                data={data}
                buffer={buffer}
                manual={manual}
                preserveUrl={preserveUrl}
                as="ul"
                role="list"
                hidden={items.length === 0 || undefined}
                data-inbox-selecting={selecting || undefined}
                className={cn(styles.listClass, classes.list)}
                loading={
                    <div role="status" className={styles.loadingMoreClass}>
                        <Icon
                            name="spinner"
                            context={{ component: 'NotificationList', part: 'loading-more' }}
                            icons={icons}
                            resolver={iconResolver}
                            className={styles.spinnerClass}
                        />
                        <span className="sr-only">{label(allLabels.loading)}</span>
                    </div>
                }
                next={
                    manual
                        ? ({ fetch, hasMore: more, loading }) =>
                              more && (
                                  <div className={styles.loadingMoreClass}>
                                      <button
                                          type="button"
                                          data-inbox-load-more=""
                                          aria-busy={loading || undefined}
                                          className={styles.itemSecondaryActionClass}
                                          onClick={fetch}
                                      >
                                          {label(allLabels.loadMore)}
                                      </button>
                                  </div>
                              )
                        : undefined
                }
            >
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
            </InfiniteScroll>

            {items.length === 0 && !hasMore && (
                <div data-inbox-empty="" className={styles.stateClass}>
                    {renderEmpty ? (
                        renderEmpty(filter)
                    ) : (
                        <>
                            <Icon
                                name="empty"
                                context={{ component: 'NotificationList', part: 'empty', filter }}
                                icons={icons}
                                resolver={iconResolver}
                                className={styles.stateIconClass}
                            />
                            <p>{emptyText}</p>
                        </>
                    )}
                </div>
            )}

            {selecting && (
                <div className={styles.listSelectionClass}>
                    <SelectionBar
                        component="NotificationList"
                        items={items}
                        selected={selectedIds}
                        onSelectedChange={setSelectedIds}
                        filter={filter}
                        allowedActions={state.allowedActions}
                        now={now}
                        labels={allLabels}
                        icons={icons}
                        iconResolver={iconResolver}
                        classes={classes}
                        locale={locale}
                        snooze={snooze}
                    />
                </div>
            )}
        </div>
    )
}
