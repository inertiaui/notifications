import { Link } from '@inertiajs/react'
import { createPopoverController, isRightToLeft, type PopoverController } from '@inertiaui/vanilla'
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'

import { cn } from '../../js/cn'
import {
    badgeText,
    inboxStore,
    label,
    pauseEnd,
    pauseOptions as pauseOptionsFor,
    selectedUnread,
    type InboxClasses,
    type InboxFilter,
    type InboxItem,
    type InboxLabels,
    type InboxState,
    type PauseOption,
} from '../../js/inbox'
import {
    archiveAllIfAny,
    canArchiveAll,
    markAllAsReadIfUnread,
    pausedText,
    pauseOptionTime,
    shownTabs,
    tabForKey,
    tabProps,
    type NotificationCenterHeaderProps,
    type NotificationCenterTabProps,
} from '../../js/notificationCenter'
import { supportsPopover } from '../../js/overlay'
import * as styles from './classes'
import type { IconResolverFn } from './iconResolver'
import { Icon } from './parts'
import Tooltip from './Tooltip'

export interface InboxHeaderProps {
    component: 'NotificationCenter' | 'NotificationList'
    state: InboxState
    filter: InboxFilter
    category: string | null
    /** The notifications that the list shows, which Archive all archives. */
    items: readonly InboxItem[]
    labels: InboxLabels
    icons: Record<string, ReactNode>
    iconResolver?: IconResolverFn | null
    classes: InboxClasses
    locale?: string
    maxCount?: number
    now: number
    /** The panel's title, which names its dialog and tabs, and the ID of the tabs and of the list they control. */
    panel?: { titleId: string; title: string; tabId: (filter: InboxFilter) => string; listId: string; close: () => void }
    /** The URL of another filter and category, which the tabs and categories of a page link to. */
    href?: (filter: InboxFilter, category: string | null) => string
    /** Whether the list shows, so the menu closes with the panel. */
    open?: boolean
    /** The panel's `renderHeader`, or the list's, which receives the same props without the panel's title and `close()`. */
    renderHeader?: (props: NotificationCenterHeaderProps) => ReactNode
    renderTab?: (props: NotificationCenterTabProps) => ReactNode
}

/**
 * The top of a list of notifications, which the panel and the `NotificationList` share: Mark all as read, the menu with
 * Archive all and the pause presets, the paused line, the tabs, and the category buttons. In the panel, the tabs and categories
 * show another list in place. On a page, they link to it, as the page loads its list with `Inbox::scroll()`.
 */
export default function InboxHeader({
    component,
    state,
    filter,
    category,
    items,
    labels,
    icons,
    iconResolver,
    classes,
    locale,
    maxCount = 99,
    now,
    panel,
    href,
    open = true,
    renderHeader,
    renderTab,
}: InboxHeaderProps) {
    const menuId = useId()
    const pauseLabelId = useId()
    const t = (name: keyof InboxLabels): string => label(labels[name])
    const tabs = shownTabs(state)
    const categoryEntries: Array<[string | null, string]> = [[null, t('allCategories')], ...Object.entries(state.categoryFilter)]
    const hasCategories = categoryEntries.length > 1
    const unread = selectedUnread({ ...state, category })
    const archivable = canArchiveAll({ filter, allowedActions: state.allowedActions })
    const readable = filter === 'all' || filter === 'unread'
    const hasMenu = archivable || state.canPause
    const hasActions = readable || hasMenu
    const context = (part: string) => ({ component, part })

    const menuButton = useRef<HTMLButtonElement>(null)
    const menuElement = useRef<HTMLDivElement>(null)
    const [menuOpen, setMenuOpen] = useState(false)
    // Its presets show their end by the list's clock, and a click counts from its own time.
    const pauseMenu = pauseOptionsFor(state.pausePresets, labels, locale)

    // A menu button: arrow keys move between the items, and choosing one or pressing Escape closes it and focuses the button.
    const menuController = useRef<PopoverController | null>(null)
    const menu = (): PopoverController =>
        (menuController.current ??= createPopoverController({
            reference: () => menuButton.current,
            popover: () => menuElement.current,
            position: { placement: 'bottom-end', offset: 4 },
            menu: true,
            onOpenChange: setMenuOpen,
        }))

    useLayoutEffect(() => {
        const controller = menuController.current

        if (!menuOpen || !controller) {
            return
        }

        controller.mount()

        return () => controller.cleanup()
    }, [menuOpen])

    // The menu closes with the panel.
    useEffect(() => menuController.current?.close(false), [open])

    const pause = (option: PauseOption): void => void inboxStore.pause(pauseEnd(option.preset))

    // The paused line leaves with the Resume button, so focus moves to the menu button, or else to the panel or list.
    const resume = (event: MouseEvent<HTMLButtonElement>): void => {
        const fallback = event.currentTarget.closest<HTMLElement>('[data-inbox-panel], [data-inbox-list]')

        void inboxStore.resume()
        ;(menuButton.current ?? fallback)?.focus()
    }

    const markAllAsRead = (): void => markAllAsReadIfUnread(state, category)
    const archiveAll = (): void => archiveAllIfAny(items, category)
    const select = (nextFilter: InboxFilter, nextCategory: string | null): void => void inboxStore.load(nextFilter, nextCategory)

    const onTabKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
        const rtl = isRightToLeft(event.currentTarget)
        const next = tabForKey(event.key, filter, tabs, rtl)

        if (next !== undefined && panel) {
            event.preventDefault()
            select(next, category)
            document.getElementById(panel.tabId(next))?.focus()
        }
    }

    const tabContent = (tab: NotificationCenterTabProps): ReactNode =>
        renderTab ? (
            renderTab(tab)
        ) : (
            <>
                {tab.label} {tab.count !== null && tab.count > 0 && <span className={styles.tabCountClass}>{badgeText(tab.count, maxCount, locale)}</span>}
            </>
        )

    const tabLinks = (className: string): ReactNode =>
        tabs.length > 1 &&
        href && (
            <div className={className}>
                {tabProps(tabs, { ...state, filter }, labels).map((tab) => (
                    <Link
                        key={tab.filter}
                        href={href(tab.filter, category)}
                        aria-current={tab.selected ? 'page' : undefined}
                        data-inbox-tab={tab.filter}
                        className={styles.tabClass}
                    >
                        {tabContent(tab)}
                    </Link>
                ))}
            </div>
        )

    const categoryContent = (key: string | null, name: string): ReactNode => (
        <>
            {name}{' '}
            {key !== null && state.categoryCounts[key] ? (
                <span className={styles.categoryCountClass}>{badgeText(state.categoryCounts[key], maxCount, locale)}</span>
            ) : null}
        </>
    )

    return (
        <>
            {renderHeader ? (
                renderHeader({
                    ...(panel && { titleId: panel.titleId, title: panel.title, close: panel.close }),
                    filter,
                    category,
                    unread,
                    markAllAsRead,
                    canArchiveAll: archivable,
                    archiveAll,
                    allowedActions: state.allowedActions,
                    canPause: state.canPause,
                    pausedUntil: state.pausedUntil,
                    pauseOptions: pauseMenu,
                    pause,
                    resume: () => void inboxStore.resume(),
                } as NotificationCenterHeaderProps)
            ) : (
                <>
                    {(panel || tabs.length > 1 || hasActions) && (
                        <div className={panel ? styles.panelHeaderClass : styles.listToolbarClass}>
                            {panel && (
                                <h2 id={panel.titleId} className={styles.panelTitleClass}>
                                    {panel.title}
                                </h2>
                            )}
                            {tabLinks(styles.listTabListClass)}
                            {hasActions && (
                                <div className={panel ? styles.panelActionsClass : styles.listActionsClass}>
                                    {readable && (
                                        <button
                                            type="button"
                                            data-inbox-read-all=""
                                            aria-disabled={unread === 0 || undefined}
                                            className={styles.textButtonClass}
                                            onClick={markAllAsRead}
                                        >
                                            {t('markAllAsRead')}
                                        </button>
                                    )}
                                    {hasMenu && (
                                        <>
                                            <Tooltip text={t('moreActions')}>
                                                <button
                                                    ref={menuButton}
                                                    type="button"
                                                    data-inbox-menu-button=""
                                                    aria-haspopup="menu"
                                                    aria-label={t('moreActions')}
                                                    aria-expanded={menuOpen}
                                                    aria-controls={menuOpen ? menuId : undefined}
                                                    className={cn(styles.controlClass, classes.control)}
                                                    onClick={(event) => menu().toggle(event.nativeEvent)}
                                                    onPointerDown={() => menu().onPointerDown()}
                                                    onKeyDown={(event) => menu().onKeydown(event.nativeEvent)}
                                                    onBlur={(event) => menu().onFocusOut(event.nativeEvent)}
                                                >
                                                    <Icon
                                                        name="more"
                                                        context={context('more-actions')}
                                                        icons={icons}
                                                        resolver={iconResolver}
                                                        className="size-4"
                                                    />
                                                </button>
                                            </Tooltip>
                                            {menuOpen && (
                                                <div
                                                    id={menuId}
                                                    ref={menuElement}
                                                    role="menu"
                                                    aria-label={t('moreActions')}
                                                    popover={supportsPopover() ? 'auto' : undefined}
                                                    data-inbox-menu=""
                                                    className={styles.menuClass}
                                                >
                                                    {archivable && (
                                                        <button
                                                            type="button"
                                                            role="menuitem"
                                                            data-inbox-archive-all=""
                                                            aria-disabled={items.length === 0 || undefined}
                                                            className={styles.menuItemClass}
                                                            onClick={archiveAll}
                                                        >
                                                            <Icon
                                                                name="archive"
                                                                context={context('archive-all')}
                                                                icons={icons}
                                                                resolver={iconResolver}
                                                                className={styles.menuIconClass}
                                                            />
                                                            {t('archiveAll')}
                                                        </button>
                                                    )}
                                                    {archivable && state.canPause && <div role="separator" className={styles.menuSeparatorClass} />}
                                                    {state.canPause && (
                                                        <div role="group" aria-labelledby={pauseLabelId}>
                                                            <div id={pauseLabelId} className={styles.menuLabelClass}>
                                                                <Icon
                                                                    name="pause"
                                                                    context={context('pause')}
                                                                    icons={icons}
                                                                    resolver={iconResolver}
                                                                    className={styles.menuIconClass}
                                                                />
                                                                {t('pause')}
                                                            </div>
                                                            {pauseMenu.map((option) => (
                                                                <button
                                                                    key={option.label}
                                                                    type="button"
                                                                    role="menuitem"
                                                                    data-inbox-pause-option=""
                                                                    className={styles.menuPresetClass}
                                                                    onClick={() => pause(option)}
                                                                >
                                                                    {option.label}{' '}
                                                                    <span className={styles.pauseTimeClass}>{pauseOptionTime(option, now, locale)}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            <div aria-live="polite">
                {state.pausedUntil !== null && (
                    <p data-inbox-paused="" className={styles.pausedClass}>
                        <Icon name="paused" context={context('paused')} icons={icons} resolver={iconResolver} className={styles.pausedIconClass} />
                        <span className="min-w-0 flex-1">{pausedText(labels, state.pausedUntil, now, locale)}</span>
                        <button type="button" data-inbox-resume="" className={styles.resumeClass} onClick={resume}>
                            {t('resume')}
                        </button>
                    </p>
                )}
            </div>

            {/* The list's tabs share a row with its actions, unless a custom header takes their place. */}
            {renderHeader && tabLinks(styles.tabListClass)}

            {tabs.length > 1 && !href && panel && (
                <div role="tablist" aria-labelledby={panel.titleId} className={styles.tabListClass} onKeyDown={onTabKeyDown}>
                    {tabProps(tabs, { ...state, filter }, labels).map((tab) => (
                        <button
                            key={tab.filter}
                            id={panel.tabId(tab.filter)}
                            type="button"
                            role="tab"
                            aria-selected={tab.selected}
                            aria-controls={panel.listId}
                            tabIndex={tab.selected ? 0 : -1}
                            data-inbox-tab={tab.filter}
                            className={styles.tabClass}
                            onClick={() => select(tab.filter, category)}
                        >
                            {tabContent(tab)}
                        </button>
                    ))}
                </div>
            )}

            {hasCategories && (
                <div role="group" aria-label={t('categories')} className={styles.categoryListClass}>
                    {categoryEntries.map(([key, name]) =>
                        href ? (
                            <Link
                                key={key ?? ''}
                                href={href(filter, key)}
                                data-inbox-category={key ?? ''}
                                aria-current={category === key ? 'page' : undefined}
                                className={styles.categoryClass}
                            >
                                {categoryContent(key, name)}
                            </Link>
                        ) : (
                            <button
                                key={key ?? ''}
                                type="button"
                                data-inbox-category={key ?? ''}
                                aria-pressed={category === key}
                                className={styles.categoryClass}
                                onClick={() => select(filter, key)}
                            >
                                {categoryContent(key, name)}
                            </button>
                        ),
                    )}
                </div>
            )}
        </>
    )
}
