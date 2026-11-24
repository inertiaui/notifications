import { autoUpdateTopLayerPopover, isRightToLeft, positionTopLayerPopover, type Placement } from '@inertiaui/vanilla'

import {
    badgeText,
    inboxStore,
    label,
    offersFilter,
    pauseEnd,
    pauseTime,
    selectedUnread,
    snoozeOptions,
    type InboxAction,
    type InboxBatchAction,
    type InboxCounts,
    type InboxFilter,
    type InboxItem,
    type InboxLabels,
    type InboxState,
    type InboxTab,
    type PauseOption,
    type SnoozeOption,
} from './inbox'
import type { ToastAction } from './types'

export const INBOX_FILTERS: readonly InboxFilter[] = ['all', 'unread', 'snoozed', 'archived']

const EMPTY_LABELS = { all: 'empty', unread: 'emptyUnread', snoozed: 'emptySnoozed', archived: 'emptyArchived' } as const

/** The tabs of a panel without a `tabs` prop: the built-in ones, then those that the application added. */
export const defaultTabs = (tabs: Readonly<Record<string, InboxTab>>): InboxFilter[] => [...INBOX_FILTERS, ...Object.keys(tabs)]

/**
 * The tabs that the panel shows: the built-in ones, then those of the server's `inbox.tabs` config, without the Snoozed
 * and Archived tabs while the application does not offer snoozing or archiving.
 */
export const shownTabs = (state: Pick<InboxState, 'tabs' | 'allowedActions'>): InboxFilter[] =>
    defaultTabs(state.tabs).filter((filter) => offersFilter(filter, state.allowedActions))

/** The label of a tab: the translation of a built-in filter, or the label of a tab that the application added. */
export function tabLabel(filter: InboxFilter, labels: InboxLabels, tabs: Readonly<Record<string, InboxTab>>): string {
    if (Object.hasOwn(EMPTY_LABELS, filter)) {
        return label(labels[filter as keyof typeof EMPTY_LABELS])
    }

    return Object.hasOwn(tabs, filter) ? tabs[filter]!.label : filter
}

/** The text of a list without notifications, for its filter. The tabs that the application added share one. */
export const emptyText = (filter: InboxFilter, labels: InboxLabels): string =>
    label(labels[Object.hasOwn(EMPTY_LABELS, filter) ? EMPTY_LABELS[filter as keyof typeof EMPTY_LABELS] : 'empty'])

/** What each of the tabs shows, in order, as the `tab` slot and `renderTab` prop receive it. */
export const tabProps = (
    tabs: readonly InboxFilter[],
    state: Pick<InboxState, 'filter' | 'tabs' | 'counts'>,
    labels: InboxLabels,
): NotificationCenterTabProps[] =>
    tabs.map((filter) => ({
        filter,
        label: tabLabel(filter, labels, state.tabs),
        selected: state.filter === filter,
        count: filter === 'unread' ? state.counts.unread : null,
    }))

/** The notifications that the list shows: those of the store, without the ones held behind the button at the top of the list. */
export const shownItems = (items: readonly InboxItem[], held: readonly string[]): readonly InboxItem[] =>
    held.length > 0 ? items.filter((item) => !held.includes(item.id)) : items

/**
 * What the list shows for the number of notifications it shows: the spinner, the error, the empty text, or the
 * notifications. While another list loads, the notifications it is known to have show right away, and the spinner only
 * shows without any.
 */
export function listState(state: Pick<InboxState, 'status'>, shown: number): 'loading' | 'error' | 'empty' | 'items' {
    if (state.status === 'idle' || (state.status === 'loading' && shown === 0)) {
        return 'loading'
    }

    if (state.status === 'error') {
        return 'error'
    }

    return shown === 0 ? 'empty' : 'items'
}

/** Marks the notifications of the category, or of every category, as read, unless none of them is unread. */
export function markAllAsReadIfUnread(state: InboxState, category: string | null = state.category): void {
    if (selectedUnread({ ...state, category }) > 0) {
        void inboxStore.markAllAsRead({ category })
    }
}

/** Whether the panel offers to archive every notification: in the All list, while the application offers archiving. */
export const canArchiveAll = (state: Pick<InboxState, 'filter' | 'allowedActions'>): boolean =>
    state.filter === 'all' && state.allowedActions.includes('archive')

/** Archives the notifications of the category, or of every category, unless the list shows none. */
export function archiveAllIfAny(items: readonly InboxItem[], category: string | null): void {
    if (items.length > 0) {
        void inboxStore.archiveAll({ category })
    }
}

/**
 * The URL of the current page with another filter and category of its `NotificationList`, which the list's tabs and
 * category buttons link to, as the `filter` and `category` query parameters. It leaves out the cursor of the infinite
 * scroll, named `pageName`, so the list starts at its newest notifications.
 */
export function listHref(url: string, filter: InboxFilter, category: string | null, pageName?: string): string {
    const target = new URL(url, 'http://localhost')
    const query = target.searchParams

    query.delete('filter')
    query.delete('category')

    if (pageName !== undefined) {
        query.delete(pageName)
    }

    if (filter !== 'all') {
        query.set('filter', filter)
    }

    if (category !== null) {
        query.set('category', category)
    }

    return `${target.pathname}${target.search}`
}

/**
 * The filter and category that a `NotificationList` was loaded with: its `filter` and `category` props, or without them,
 * the `filter` and `category` query parameters of the URL, which its tabs and category buttons link to. A filter that the
 * list does not offer lists every notification, like `Inbox::page()` on the server.
 */
export function listScope(
    url: string,
    state: Pick<InboxState, 'tabs' | 'allowedActions'>,
    filter?: InboxFilter,
    category?: string | null,
): { filter: InboxFilter; category: string | null } {
    const query = new URL(url, 'http://localhost').searchParams
    const queried = query.get('filter')

    return {
        filter: filter ?? (queried !== null && shownTabs(state).includes(queried) ? queried : 'all'),
        category: category === undefined ? query.get('category') || null : category,
    }
}

/** The text of the line that shows while notifications are paused, with the end of the pause. */
export const pausedText = (labels: Pick<InboxLabels, 'pausedUntil'>, until: string, now: number, locale?: string): string =>
    label(labels.pausedUntil, { time: pauseTime(until, now, locale) })

/** The end of a time of the pause button by the panel's clock, which shows next to its label. A click counts from its own time. */
export const pauseOptionTime = (option: PauseOption, now: number, locale?: string): string => pauseTime(pauseEnd(option.preset, new Date(now)), now, locale)

/** What the `trigger` slot and `renderTrigger` prop receive: the content of the bell button. */
export interface NotificationCenterTriggerProps {
    open: boolean
    /** The count the badge shows, as chosen with the `count` prop. */
    count: number
    counts: InboxCounts
}

/** What the `badge` slot and `renderBadge` prop receive. They render only while the count is above zero. */
export interface NotificationCenterBadgeProps {
    count: number
    /** The count as the built-in badge shows it, such as "99+". */
    text: string
}

/** What the `header` slot and `renderHeader` prop receive: the top of the panel, with the title, the bulk actions, and the pause button. */
export interface NotificationCenterHeaderProps {
    /** The ID that names the panel. Give it to your heading, so the panel keeps its accessible name. */
    titleId: string
    title: string
    filter: InboxFilter
    category: string | null
    /** The unread notifications of the selected category, or of every category, which `markAllAsRead()` changes. */
    unread: number
    markAllAsRead(): void
    /** Whether the built-in header shows the **Archive all** button: the All list shows, and the application offers archiving. */
    canArchiveAll: boolean
    /** Archives the notifications of the selected category, or of every category. Does nothing while the application does not offer archiving. */
    archiveAll(): void
    /** What the user may do with notifications besides reading them, from the server's `inbox.actions` config. */
    allowedActions: readonly InboxAction[]
    close(): void
    /** Whether the built-in header shows the pause button: the application offers pausing. */
    canPause: boolean
    /** The end of the pause, or `null` while notifications are not paused. */
    pausedUntil: string | null
    /** The times of the pause button, from the server's `pause.presets` config. */
    pauseOptions: readonly PauseOption[]
    /** Pauses notifications for one of `pauseOptions`, counted from the call, like a click on a time of the pause button. */
    pause(option: PauseOption): void
    resume(): void
}

/** What the `header` slot and `renderHeader` prop of the `NotificationList` receive: the bulk actions and the pause button above the list. */
export type NotificationListHeaderProps = Omit<NotificationCenterHeaderProps, 'titleId' | 'title' | 'close'>

/** What the `tab` slot and `renderTab` prop receive: the content of each tab. */
export interface NotificationCenterTabProps {
    filter: InboxFilter
    label: string
    selected: boolean
    /** The unread count on the Unread tab, or `null` on the other tabs. */
    count: number | null
}

/** What the `error` slot and `renderError` prop receive: loading the list failed, or with `more`, its next page. */
export interface NotificationCenterErrorProps {
    more: boolean
    retry(): void
}

/** What the `footer` slot and `renderFooter` prop receive: the bottom of the panel. */
export interface NotificationCenterFooterProps {
    href: string | undefined
    close(): void
}

/**
 * A button of the bar that shows while notifications are selected: what it does, its icon, and its label. The `snooze`
 * button shows the snooze times rather than running right away.
 */
export interface SelectionAction {
    action: InboxBatchAction
    icon: string
    label: keyof InboxLabels
}

/**
 * The buttons of the selection bar in a list of the given filter: read, unread, and those of the allowed actions:
 * snooze or unsnooze, archive or unarchive, and delete. Archived notifications cannot be snoozed.
 */
export function selectionActions(filter: InboxFilter, allowedActions: readonly InboxAction[]): SelectionAction[] {
    const snoozing: SelectionAction[] =
        !allowedActions.includes('snooze') || filter === 'archived'
            ? []
            : [
                  filter === 'snoozed'
                      ? { action: 'unsnooze', icon: 'unsnooze', label: 'unsnoozeSelected' }
                      : { action: 'snooze', icon: 'snooze', label: 'snoozeSelected' },
              ]
    const archiving: SelectionAction[] = !allowedActions.includes('archive')
        ? []
        : [
              filter === 'archived'
                  ? { action: 'unarchive', icon: 'unarchive', label: 'unarchiveSelected' }
                  : { action: 'archive', icon: 'archive', label: 'archiveSelected' },
          ]
    const deleting: SelectionAction[] = allowedActions.includes('delete') ? [{ action: 'delete', icon: 'delete', label: 'deleteSelected' }] : []

    return [
        { action: 'read', icon: 'read', label: 'readSelected' },
        { action: 'unread', icon: 'unread', label: 'unreadSelected' },
        ...snoozing,
        ...archiving,
        ...deleting,
    ]
}

/** The snooze times to offer from `now`: those of the `snooze` prop, or else the built-in ones. */
export const snoozeChoices = (snooze: ((now: Date) => SnoozeOption[]) | undefined, labels: InboxLabels, now = new Date()): SnoozeOption[] =>
    snooze ? snooze(now) : snoozeOptions(labels, now)

/** The IDs of the selected notifications after the checkbox of one of them changed: it moves to the end, or leaves. */
export function toggleSelected(selected: readonly string[], id: string, checked: boolean): string[] {
    const others = selected.filter((other) => other !== id)

    return checked ? [...others, id] : others
}

export interface ArrivalHold {
    /** Shows the held notifications at the top of the list, scrolls to them, and focuses the first one. */
    reveal(): void
    /** Forgets the held notifications and scrolls back to the top, such as when another list shows. */
    release(): void
    destroy(): void
}

/**
 * Holds the notifications that arrive while the reader has scrolled down the `list`, so it does not move under them:
 * the `scroller` around the list, or without one, the page. `onChange` receives the IDs of the held notifications,
 * which the list leaves out and counts on a button. Scrolling back to the top shows them too. Notifications that the
 * list already shows are not held, and neither are those that `listed` leaves out, such as those of another tab or
 * category. A held notification that leaves the list, such as one that another session archived, is no longer held.
 */
export function holdArrivals(
    list: HTMLElement,
    onChange: (held: readonly string[]) => void,
    { scroller, listed }: { scroller?: HTMLElement; listed: (id: string) => boolean },
): ArrivalHold {
    let held: string[] = []

    const update = (next: string[]): void => {
        held = next
        onChange(next)
    }

    const target: HTMLElement | Window = scroller ?? window
    const scrolled = (): boolean => (scroller ? scroller.scrollTop > 0 : list.getBoundingClientRect().top < 0)

    // A hidden panel has no scroll position, so only an open list that was scrolled down holds notifications.
    const stopListening = inboxStore.onArrival((item) => {
        const shown = list.querySelector(`[data-inbox-id="${CSS.escape(item.id)}"]`) !== null

        if (scrolled() && listed(item.id) && !shown && !held.includes(item.id)) {
            update([...held, item.id])
        }
    })

    // The list leaves the held notifications out of the page, so the store tells which ones it still has.
    const stopWatching = inboxStore.subscribe(() => {
        const next = held.filter(listed)

        if (next.length < held.length) {
            update(next)
        }
    })

    const onScroll = (): void => {
        if (!scrolled() && held.length > 0) {
            update([])
        }
    }

    target.addEventListener('scroll', onScroll, { passive: true })

    return {
        reveal() {
            if (scroller) {
                scroller.scrollTop = 0
            } else {
                window.scrollBy({ top: list.getBoundingClientRect().top })
            }

            update([])
            requestAnimationFrame(() => list.querySelector<HTMLElement>('[data-inbox-item]')?.focus({ preventScroll: true }))
        },
        release() {
            // The panel starts another list at its top. A page shows another list on a visit of its own.
            if (scroller) {
                scroller.scrollTop = 0
            }

            if (held.length > 0) {
                update([])
            }
        },
        destroy() {
            stopListening()
            stopWatching()
            target.removeEventListener('scroll', onScroll)
        },
    }
}

/** How long a notification stays at least half visible before it counts as seen, in milliseconds. */
const SEEN_AFTER = 1000

/** How long to collect seen notifications before reporting them together, in milliseconds. */
const SEEN_BATCH_DELAY = 250

/**
 * Marks the notifications in `list` that the user saw as seen: each `[data-inbox-item]` with `data-seen="false"`
 * that stayed at least half visible in `root`, the list's scroller or with `null` the page, or filled at least half of
 * it, for a second. `items` returns the notifications that the list shows, which are saved together in batches. A
 * hidden list, such as in a closed panel, shows nothing, so nothing in it counts as seen.
 */
export function trackSeen(list: HTMLElement, items: () => readonly InboxItem[], root: HTMLElement | null = list): { destroy(): void } {
    const timers = new Map<HTMLElement, ReturnType<typeof setTimeout>>()
    const observed = new Set<HTMLElement>()
    let pending: string[] = []
    let batch: ReturnType<typeof setTimeout> | undefined

    const report = (): void => {
        batch = undefined

        const ids = pending
        const seenItems = items().filter((item) => ids.includes(item.id))

        pending = []

        if (seenItems.length > 0) {
            void inboxStore.batch('seen', seenItems)
        }
    }

    const stopTiming = (element: HTMLElement): void => {
        clearTimeout(timers.get(element))
        timers.delete(element)
    }

    const seen = (element: HTMLElement): void => {
        timers.delete(element)

        const id = element.dataset.inboxId

        if (id === undefined || element.dataset.seen !== 'false' || !element.isConnected) {
            return
        }

        visibility.unobserve(element)
        observed.delete(element)
        pending.push(id)
        batch ??= setTimeout(report, SEEN_BATCH_DELAY)
    }

    const visibility = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                const element = entry.target as HTMLElement
                const fillsHalf = entry.rootBounds !== null && entry.intersectionRect.height >= entry.rootBounds.height / 2

                if (entry.isIntersecting && (entry.intersectionRatio >= 0.5 || fillsHalf)) {
                    timers.set(element, timers.get(element) ?? setTimeout(() => seen(element), SEEN_AFTER))
                } else {
                    stopTiming(element)
                }
            }
        },
        { root, threshold: [0, 0.5, 1] },
    )

    // Watches the unseen notifications that the list renders, and stops watching those that left or were seen.
    const sync = (): void => {
        for (const element of observed) {
            if (!element.isConnected || element.dataset.seen !== 'false') {
                visibility.unobserve(element)
                observed.delete(element)
                stopTiming(element)
            }
        }

        for (const element of list.querySelectorAll<HTMLElement>('[data-inbox-item][data-seen="false"]')) {
            if (!observed.has(element)) {
                observed.add(element)
                visibility.observe(element)
            }
        }
    }

    const changes = new MutationObserver(sync)

    changes.observe(list, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-seen'] })
    sync()

    return {
        destroy() {
            changes.disconnect()
            visibility.disconnect()
            timers.forEach((timer) => clearTimeout(timer))

            if (batch !== undefined) {
                clearTimeout(batch)
                report()
            }
        },
    }
}

/**
 * The notification and its action that a click in the panel opens or runs: a click on the link of a notification, or
 * on one of its actions. Notifications are found by the `data-inbox-id` of their list item, so custom items count too.
 */
export function clickTarget(event: Pick<Event, 'target'>, items: readonly InboxItem[]): { item: InboxItem; action?: ToastAction<InboxItem> } | undefined {
    const target = event.target instanceof Element ? event.target : null
    const control = target?.closest('[data-inbox-link], [data-inbox-action]')
    const id = control?.closest<HTMLElement>('[data-inbox-item]')?.dataset.inboxId
    const item = id === undefined ? undefined : items.find((candidate) => candidate.id === id)

    if (!control || !item) {
        return undefined
    }

    if (!control.hasAttribute('data-inbox-action')) {
        return { item }
    }

    // Custom items may leave out the index of the action.
    const index = control.getAttribute('data-inbox-action')
    const action = index ? item.actions[Number(index)] : undefined

    return action ? { item, action } : undefined
}

export interface NotificationCenterCallbacks {
    /** Runs after the panel opened or closed. */
    onToggle(open: boolean): void
    /** Runs when the end of the list scrolls into view. */
    onEndReached(): void
    /** Where the panel opens next to the bell, such as `bottom-end`. It moves to the other side when there is no room. */
    placement(): Placement
}

export interface NotificationCenterController {
    /**
     * Watches the element at the end of the list, inside the element with `data-inbox-scroller`. Call again after
     * the list changed, because a sentinel that stays in view does not report again.
     */
    observe(sentinel: Element | null): void
    /** Places the open panel again, such as after its placement changed. */
    place(): void
    close(): void
    destroy(): void
}

/** Distance in pixels from the end of the list at which the next page starts loading. */
const LOAD_MARGIN = 160

/** The inline styles that placing the panel sets, which the sheet layout of theme.css replaces. */
const PLACEMENT_STYLES = [
    'position',
    'box-sizing',
    'inset',
    'top',
    'right',
    'bottom',
    'left',
    'margin',
    'max-width',
    'max-height',
    'height',
    'overflow-x',
    'overflow-y',
    'overscroll-behavior',
]

/**
 * Wires a bell button and the panel it opens, a popover with `popover="auto"` that the browser closes on Escape and
 * outside clicks. Places the panel next to the button, moves focus into it when it opens, closes it when focus
 * leaves, and reports when the end of the list scrolls into view.
 */
export function createNotificationCenterController(
    trigger: HTMLElement,
    panel: HTMLElement,
    callbacks: NotificationCenterCallbacks,
): NotificationCenterController {
    let observer: IntersectionObserver | undefined
    let observedRoot: Element | null = null
    let stopFollowing: (() => void) | undefined

    // The height of the list, which theme.css gives the spinner while another list loads, so the panel keeps its size. A
    // hidden panel has no height, so it keeps the height it had when it closed.
    const scroller = panel.querySelector<HTMLElement>('[data-inbox-scroller]')
    const listSize =
        scroller !== null && typeof ResizeObserver === 'function'
            ? new ResizeObserver(() => {
                  if (scroller.offsetHeight > 0 && scroller.querySelector(':scope > [role="status"]') === null) {
                      panel.style.setProperty('--inbox-list-height', `${scroller.offsetHeight}px`)
                  }
              })
            : undefined

    if (scroller !== null) {
        listSize?.observe(scroller)
    }

    // A length from theme.css, which registers these variables as lengths, so they compute to pixels.
    const length = (name: string, fallback: number): number => {
        const value = Number.parseFloat(getComputedStyle(panel).getPropertyValue(name))

        return Number.isFinite(value) ? value : fallback
    }

    const follow = (): void => {
        if (!panel.matches(':popover-open')) {
            return
        }

        // On narrow screens, theme.css shows the panel as a sheet at the bottom of the screen instead.
        if (getComputedStyle(panel).getPropertyValue('--inbox-layout').trim() === 'sheet') {
            stopFollowing?.()
            stopFollowing = undefined
            PLACEMENT_STYLES.forEach((property) => panel.style.removeProperty(property))
            delete panel.dataset.side

            return
        }

        // Placed with numbers rather than CSS anchors, so the panel keeps its place while it fades out.
        const { placement } = positionTopLayerPopover(trigger, panel, {
            placement: callbacks.placement(),
            offset: length('--inbox-gap', 8),
            viewportMargin: length('--inbox-offset', 8),
            anchorPositioning: false,
        })

        panel.dataset.side = placement.split('-')[0]
        stopFollowing ??= autoUpdateTopLayerPopover(trigger, panel, follow)
    }

    // A resize may move a sheet back next to the bell, which a panel that follows the bell notices by itself.
    const onResize = (): void => void (stopFollowing === undefined && follow())

    // The toggle event may come after the first frame of the open panel, so the panel is also placed before that frame.
    const onBeforeToggle = (event: Event): void => {
        if ((event as ToggleEvent).newState === 'open') {
            requestAnimationFrame(() => stopFollowing === undefined && follow())
        }
    }

    const onToggle = (event: Event): void => {
        const open = (event as ToggleEvent).newState === 'open'

        if (open) {
            if (stopFollowing === undefined) {
                follow()
            }

            window.addEventListener('resize', onResize)

            // The panel's accessible name is announced; the first control is not focused, so a stray Enter does nothing.
            if (!panel.contains(document.activeElement)) {
                panel.focus({ preventScroll: true })
            }
        } else {
            stopFollowing?.()
            stopFollowing = undefined
            window.removeEventListener('resize', onResize)
        }

        trigger.setAttribute('aria-expanded', String(open))
        callbacks.onToggle(open)
    }

    // A non-modal panel closes when keyboard focus moves on to the rest of the page.
    const onFocusOut = (event: FocusEvent): void => {
        const next = event.relatedTarget

        if (next instanceof Node && !panel.contains(next) && !trigger.contains(next) && panel.matches(':popover-open')) {
            panel.hidePopover()
        }
    }

    panel.addEventListener('beforetoggle', onBeforeToggle)
    panel.addEventListener('toggle', onToggle)
    panel.addEventListener('focusout', onFocusOut)

    return {
        observe(sentinel) {
            const root = sentinel?.closest('[data-inbox-scroller]') ?? null

            if (!observer || root !== observedRoot) {
                observer?.disconnect()
                observedRoot = root
                observer =
                    typeof IntersectionObserver === 'function'
                        ? new IntersectionObserver(
                              (entries) => {
                                  if (entries.some((entry) => entry.isIntersecting)) {
                                      callbacks.onEndReached()
                                  }
                              },
                              { root, rootMargin: `0px 0px ${LOAD_MARGIN}px 0px` },
                          )
                        : undefined
            }

            observer?.disconnect()

            if (sentinel) {
                observer?.observe(sentinel)
            }
        },
        place: follow,
        close() {
            if (panel.matches(':popover-open')) {
                panel.hidePopover()
            }
        },
        destroy() {
            observer?.disconnect()
            listSize?.disconnect()
            stopFollowing?.()
            panel.removeEventListener('beforetoggle', onBeforeToggle)
            panel.removeEventListener('toggle', onToggle)
            panel.removeEventListener('focusout', onFocusOut)
            window.removeEventListener('resize', onResize)
        },
    }
}

const SHORTCUTS: Record<string, 'next' | 'previous' | 'read' | 'archive' | 'snooze' | 'select' | 'open'> = {
    j: 'next',
    arrowdown: 'next',
    k: 'previous',
    arrowup: 'previous',
    u: 'read',
    e: 'archive',
    h: 'snooze',
    x: 'select',
    enter: 'open',
}

const CONTROLS = {
    read: '[data-inbox-toggle-read]',
    archive: '[data-inbox-toggle-archive]',
    snooze: '[data-inbox-snooze]',
    select: '[data-inbox-select]',
    open: '[data-inbox-link]',
}

/**
 * Keyboard triage in the notifications inside `root`: J and K, or the arrow keys on a notification, move between
 * notifications. On the focused notification, U marks it as read or unread, E archives it, H snoozes it, X selects
 * it, and Enter opens it. Keys typed into fields, keys on tabs, and keys with Ctrl, Alt, or Meta are left alone. Use `keepFocus()`
 * on the same element, so focus moves on when a notification leaves.
 */
export function handleListKeydown(event: KeyboardEvent, root: HTMLElement): void {
    const shortcut = SHORTCUTS[event.key.toLowerCase()]
    const target = event.target instanceof HTMLElement ? event.target : null

    if (
        !shortcut ||
        !target ||
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        target.closest('input:not([type="checkbox"]), textarea, select, [contenteditable]:not([contenteditable="false"]), [role="tab"]')
    ) {
        return
    }

    const items = [...root.querySelectorAll<HTMLElement>('[data-inbox-item]')]
    const current = target.closest<HTMLElement>('[data-inbox-item]')
    const index = current ? items.indexOf(current) : -1

    // Enter and the arrow keys keep their usual meaning on buttons and links.
    if ((shortcut === 'open' || event.key.startsWith('Arrow')) && target !== current && target !== root) {
        return
    }

    if (shortcut === 'next' || shortcut === 'previous') {
        const next = items[shortcut === 'next' ? index + 1 : index - 1]

        if (next) {
            event.preventDefault()
            next.focus()
        }

        return
    }

    const control = current?.querySelector<HTMLElement>(CONTROLS[shortcut])

    if (!current || !control) {
        return
    }

    event.preventDefault()
    control.click()
}

/**
 * Keeps keyboard focus in a list of notifications when the focused element leaves the page, however it left: archived
 * or snoozed with a shortcut or a button, or changed in another session. Focus moves to the same notification when it
 * rendered anew, else to the next one, the previous one, or `fallback`. Focus elsewhere on the page stays where it is.
 * Returns a function that stops it.
 */
export function keepFocus(root: HTMLElement, fallback: () => HTMLElement | null = () => root): () => void {
    // The focused notification, and the order of the notifications around it.
    let focused: { id: string; order: string[] } | undefined

    // Found by ID, because a group renders anew when its first notification leaves.
    const itemOf = (id: string): HTMLElement | null => root.querySelector<HTMLElement>(`[data-inbox-item][data-inbox-id="${CSS.escape(id)}"]`)
    const ids = (): string[] => Array.from(root.querySelectorAll<HTMLElement>('[data-inbox-item]'), (item) => item.dataset.inboxId ?? '')

    const track = (): void => {
        const active = document.activeElement
        const id = active instanceof HTMLElement && root.contains(active) ? active.closest<HTMLElement>('[data-inbox-item]')?.dataset.inboxId : undefined

        focused = id === undefined ? undefined : { id, order: ids() }
    }

    const onFocusOut = (event: FocusEvent): void => {
        const target = event.target as Node

        // The user moved focus out of the list, rather than its notification leaving the page.
        if (!(event.relatedTarget instanceof Node && root.contains(event.relatedTarget))) {
            queueMicrotask(() => {
                if (target.isConnected && !root.contains(document.activeElement)) {
                    focused = undefined
                }
            })
        }
    }

    const observer =
        typeof MutationObserver === 'function'
            ? new MutationObserver(() => {
                  const active = document.activeElement

                  if (focused && (active === null || active === document.body)) {
                      // The same notification when it rendered anew, such as in another group, else its neighbors.
                      const { id, order } = focused
                      const index = order.indexOf(id)
                      const next = [id, ...order.slice(index + 1), ...order.slice(0, index).reverse()].map(itemOf).find((item) => item !== null)

                      ;(next ?? fallback())?.focus({ preventScroll: next === undefined })
                  }

                  track()
              })
            : undefined

    root.addEventListener('focusin', track)
    root.addEventListener('focusout', onFocusOut)
    observer?.observe(root, { childList: true, subtree: true })

    return () => {
        root.removeEventListener('focusin', track)
        root.removeEventListener('focusout', onFocusOut)
        observer?.disconnect()
    }
}

/**
 * The accessible name of the bell, with the count when there are new notifications: `count` as the badge shows it,
 * such as "99+", and `number`, the count itself, such as for plurals. While notifications are paused, the `bellPaused`
 * label wraps it as `label`, such as "Notifications, 3 new, paused".
 */
export function bellLabel(labels: Pick<InboxLabels, 'bell' | 'bellNew' | 'bellPaused'>, count: number, max: number, locale?: string, paused = false): string {
    const name = count > 0 ? label(labels.bellNew, { count: badgeText(count, max, locale), number: count }) : label(labels.bell)

    return paused ? label(labels.bellPaused, { label: name }) : name
}

/** Up to two initials of a name, such as "SM" for "Sophie Martin", shown when an actor has no avatar. */
export function initials(name: string): string {
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => Array.from(word)[0]?.toLocaleUpperCase() ?? '')
        .join('')
}

/**
 * The tab that a key press on a tab list selects: the arrow keys move to the previous or next tab and wrap around,
 * Home and End move to the first and last. Returns `undefined` for other keys.
 */
export function tabForKey<T>(key: string, current: T, tabs: readonly T[], rtl = false): T | undefined {
    const index = tabs.indexOf(current)
    const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[key]

    if (step !== undefined) {
        return tabs[(index + step + tabs.length) % tabs.length]
    }

    if (key === 'Home') {
        return tabs[0]
    }

    return key === 'End' ? tabs.at(-1) : undefined
}
