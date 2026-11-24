import { createAnnouncer, prefersReducedMotion } from '@inertiaui/vanilla'

import { own } from './icons'
import type { ToastStore } from './toastStore'
import { formatTranslation, trans, translation, type TranslationKey, type TranslationValue } from './translations'
import { TOAST_POSITIONS, type Toast, type ToastPosition, type ToastType, type ToastTypeLabels } from './types'

export const DEFAULT_HOTKEY: readonly string[] = ['F8']

export interface ToasterSettings {
    /** The `name` of the Toaster; it shows the toasts whose `toaster` option matches. */
    name: string | undefined
    /** `KeyboardEvent.code` values and modifier names, such as `['F8']` or `['altKey', 'KeyT']`. Empty disables the shortcut. */
    hotkey: readonly string[]
    /** The Toaster's `typeLabels`, which take the place of the `toast_type_` translations. */
    typeLabels: ToastTypeLabels
    /** How many toasts show in the collapsed stack. */
    visibleToasts: number
    /** Show every toast at full height instead of stacking them. */
    expand: boolean
    /** Keep the toasts usable above modal dialogs of other libraries, such as Radix and Reka, and above dialog popovers. */
    aboveModals: boolean
}

export interface ToasterElements {
    /** The labelled landmark around the lists. */
    region: HTMLElement
    /**
     * The element the region renders into, moved into the topmost open modal dialog so toasts stay usable there. Above
     * modals, it is a popover in the top layer, which also moves into an open dialog popover.
     */
    host?: HTMLElement
    polite: HTMLElement
    assertive: HTMLElement
}

export interface ToasterController {
    /** Call after every render of the Toaster: the controller lays out and observes what it rendered. */
    update(): void
    destroy(): void
}

const modifiers = ['altKey', 'ctrlKey', 'metaKey', 'shiftKey'] as const
const modifierKeys: Record<(typeof modifiers)[number], TranslationKey> = {
    altKey: 'toaster_hotkey_alt',
    ctrlKey: 'toaster_hotkey_ctrl',
    metaKey: 'toaster_hotkey_meta',
    shiftKey: 'toaster_hotkey_shift',
}

/** The inline styles of the host while it is a popover in the top layer. */
const LAYER_STYLES: Record<string, string> = {
    width: '0',
    height: '0',
    margin: '0',
    padding: '0',
    border: '0',
    overflow: 'visible',
    background: 'none',
    color: 'inherit',
    'pointer-events': 'auto',
}

/** A swipe this far, or this fast in px/ms, dismisses the toast. */
const SWIPE_DISTANCE = 45
const SWIPE_VELOCITY = 0.11

export function hotkeyLabel(hotkey: readonly string[]): string {
    return hotkey
        .map((key) => (Object.hasOwn(modifierKeys, key) ? trans(modifierKeys[key as (typeof modifiers)[number]]) : key.replace(/^(Key|Digit)/, '')))
        .join(trans('toaster_hotkey_separator'))
}

/** The accessible name of the toast region: the Toaster's `label`, or the translation, with the shortcut. */
export function regionLabel(label: string | undefined, hotkey: readonly string[]): string {
    const name = label ?? trans('toaster_label')

    return hotkey.length > 0 ? trans('toaster_label_with_hotkey', { label: name, hotkey: hotkeyLabel(hotkey) }) : name
}

/** The accessible name of a dismiss button: the Toaster's `dismissLabel`, or the translation, with the toast's title. */
export function dismissLabel(template: TranslationValue | undefined, toast: Pick<Toast, 'title'>): string {
    return template === undefined ? trans('toast_dismiss', { title: toast.title }) : formatTranslation(template, { title: toast.title })
}

/** The word that screen readers announce before a toast's title: from the Toaster's `typeLabels`, or the `toast_type_` translation. */
export function typeLabel(type: ToastType, labels: ToastTypeLabels = {}): string {
    const value = own(labels, type) ?? translation(`toast_type_${type}`)

    return value === undefined ? '' : formatTranslation(value)
}

/** The text that screen readers announce for a toast, such as "Error: Payment failed. Your card was declined." */
export function announcement(toast: Pick<Toast, 'type' | 'title' | 'description' | 'actions'>, typeLabels: ToastTypeLabels = {}): string {
    const label = typeLabel(toast.type, typeLabels)
    const title = label ? `${label}: ${toast.title}` : toast.title
    const sentences = [/[.!?…]$/.test(title) ? title : `${title}.`]

    if (toast.description) {
        sentences.push(toast.description)
    }

    for (const action of toast.actions) {
        if (action.altText) {
            sentences.push(action.altText)
        }
    }

    return sentences.join(' ')
}

/** Groups toasts by the position they show at, in a stable order; queued toasts are left out. */
export function toastsByPosition<T extends Pick<Toast, 'position' | 'state'>>(toasts: readonly T[], fallback: ToastPosition): Array<[ToastPosition, T[]]> {
    const groups = new Map<ToastPosition, T[]>()

    // Newest first, so keyboard users reach the newest toast first.
    for (const toast of [...toasts].reverse()) {
        if (toast.state !== 'queued') {
            const position = toast.position ?? fallback
            groups.set(position, [...(groups.get(position) ?? []), toast])
        }
    }

    return TOAST_POSITIONS.filter((position) => groups.has(position)).map((position) => [position, groups.get(position)!])
}

let controllerCounter = 0

/**
 * The behavior the Vue and React Toasters share: measuring and stacking the toasts, expanding a stack while it is
 * hovered or focused, pausing timers, swipe to dismiss, progress bars, the keyboard shortcut, Escape, moving focus
 * when a focused toast closes, following open modal dialogs, staying usable above the dialogs of other libraries, and
 * screen reader announcements.
 */
export function createToasterController(store: ToastStore, elements: ToasterElements, settings: () => ToasterSettings): ToasterController {
    const { region, host } = elements
    const announcer = createAnnouncer({ polite: elements.polite, assertive: elements.assertive })
    const announced = new Map<string, number>()
    const counts = new Map<string, number>()
    const progress = new Map<string, { key: string; bar: HTMLElement; animation?: Animation }>()
    const id = ++controllerCounter
    const reasons = { hover: `hover-${id}`, focus: `focus-${id}`, swipe: `swipe-${id}` }

    let hovered: HTMLElement | null = null
    let focusedItem: HTMLElement | null = null
    let focusedIndex = 0
    let returnFocus: HTMLElement | null = null
    let modality: 'keyboard' | 'pointer' | 'touch' = 'pointer'
    let swipe: { item: HTMLElement; pointerId: number; x: number; time: number; dx: number; active: boolean } | null = null

    // Toasts of this Toaster that arrived before it was mounted start their timers now, and toasts of Toasters that are
    // not mounted keep their time.
    let attached = settings().name
    let detach = store.attach(attached)

    const ownToasts = (): Toast[] => store.getSnapshot().filter((toast) => toast.toaster === settings().name && toast.state !== 'queued')
    const lists = (): HTMLElement[] => Array.from(region.querySelectorAll<HTMLElement>('[data-toast-list]'))
    const elementOf = (toastId: string): HTMLElement | null => region.querySelector<HTMLElement>(`[data-toast-id="${CSS.escape(toastId)}"]`)
    const itemOf = (target: EventTarget | null): HTMLElement | null =>
        target instanceof Element ? (target.closest<HTMLElement>('[data-toast-id]') ?? null) : null
    const isOpen = (item: HTMLElement): boolean => item.dataset.state !== 'closing'

    /** Open toasts, newest first across every position. */
    const items = (): HTMLElement[] =>
        ownToasts()
            .reverse()
            .map((toast) => elementOf(toast.id))
            .filter((item): item is HTMLElement => item !== null && isOpen(item))

    // The body holds the content at its natural height, while a toast behind the front one takes the front one's height.
    const heightOf = (item: HTMLElement): number => {
        const body = item.querySelector<HTMLElement>('[data-toast-body]')

        return (body?.offsetHeight ?? item.offsetHeight) + (item.offsetHeight - item.clientHeight)
    }

    const layout = (): void => {
        const { visibleToasts, expand } = settings()

        for (const list of lists()) {
            const open = Array.from(list.querySelectorAll<HTMLElement>(':scope > [data-toast-id]')).filter(isOpen)
            let before = 0

            list.dataset.expanded = String(expand || list === hovered || list.contains(document.activeElement))

            open.forEach((item, index) => {
                const height = heightOf(item)

                item.style.setProperty('--toast-index', String(index))
                item.style.setProperty('--toast-before', `${before}px`)
                item.style.setProperty('--toast-height', `${height}px`)
                item.style.zIndex = String(open.length - index)
                item.dataset.front = String(index === 0)
                item.dataset.overflow = String(index >= visibleToasts)

                // An element reused for a toast that came back after a swipe starts in place.
                if (item !== swipe?.item) {
                    delete item.dataset.swipeOut
                    item.style.removeProperty('--toast-swipe')
                }

                before += height
            })

            list.style.setProperty('--toast-count', String(open.length))
            list.style.setProperty('--toast-visible', String(Math.max(1, Math.min(open.length, visibleToasts))))
            list.style.setProperty('--toast-front-height', `${open[0] ? heightOf(open[0]) : 0}px`)
            list.style.setProperty('--toast-heights', `${before}px`)
        }
    }

    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(() => layout()) : undefined
    const observed = new WeakSet<Element>()

    const syncProgress = (): void => {
        const animate = !prefersReducedMotion()
        const seen = new Set<string>()

        for (const toast of ownToasts()) {
            const bar = elementOf(toast.id)?.querySelector<HTMLElement>('[data-toast-progress]')
            const timer = store.timer(toast.id)

            if (!bar || !timer) {
                continue
            }

            seen.add(toast.id)

            const fraction = Math.max(0, timer.remaining / timer.duration)

            // Without motion, the bar shows the time left whenever the toast changes, pauses, or resumes.
            if (!animate || typeof bar.animate !== 'function') {
                progress.get(toast.id)?.animation?.cancel()
                progress.set(toast.id, { key: 'static', bar })
                bar.style.transform = `scaleX(${fraction})`

                continue
            }
            // A running timer keeps the same end time until it is paused or restarted.
            const key = timer.running ? `run:${Math.round((Date.now() + timer.remaining) / 50)}` : `pause:${Math.round(timer.remaining)}`
            const current = progress.get(toast.id)

            if (current?.key === key && current.bar === bar) {
                continue
            }

            current?.animation?.cancel()
            bar.style.transform = `scaleX(${fraction})`

            const animation = timer.running
                ? bar.animate([{ transform: `scaleX(${fraction})` }, { transform: 'scaleX(0)' }], {
                      duration: timer.remaining,
                      easing: 'linear',
                      fill: 'forwards',
                  })
                : undefined

            progress.set(toast.id, { key, bar, animation })
        }

        for (const [toastId, entry] of progress) {
            if (!seen.has(toastId)) {
                entry.animation?.cancel()
                progress.delete(toastId)
            }
        }
    }

    const unsubscribe = store.subscribe(syncProgress)

    const focusLeft = (): void => {
        focusedItem = null
        store.resume(reasons.focus)
    }

    // The focused toast closed: focus the toast that took its place, or go back to where the user was. A mouse keeps the
    // stack expanded by hovering it, but a finger only through focus, so after a tap focus stays in the stack.
    const restoreFocus = (): void => {
        const remaining = items()
        const next = modality === 'pointer' ? undefined : remaining[Math.min(focusedIndex, remaining.length - 1)]
        const target = returnFocus

        focusLeft()

        if (next) {
            next.focus()
        } else if (target?.isConnected) {
            returnFocus = null
            target.focus({ preventScroll: true })
        }
    }

    const checkFocus = (): void => {
        if (focusedItem && (!focusedItem.isConnected || !isOpen(focusedItem))) {
            restoreFocus()
        } else if (!region.contains(document.activeElement)) {
            // The user moved focus elsewhere, so a toast that closes later does not send it back.
            returnFocus = null
            focusLeft()
        }
    }

    const onFocusIn = (event: FocusEvent): void => {
        if (event.relatedTarget instanceof HTMLElement && !region.contains(event.relatedTarget)) {
            returnFocus = event.relatedTarget
        }

        focusedItem = itemOf(event.target)
        focusedIndex = focusedItem ? items().indexOf(focusedItem) : 0
        store.pause(reasons.focus)
        layout()
    }

    // A removed element may or may not fire focusout, and the new focus is only known afterwards.
    const onFocusOut = (): void =>
        void setTimeout(() => {
            checkFocus()
            layout()
        })

    const onKeyDown = (event: KeyboardEvent): void => {
        modality = 'keyboard'

        const item = itemOf(event.target)

        if (event.key === 'Escape' && item?.dataset.toastId !== undefined && item.dataset.dismissible !== 'false') {
            event.preventDefault()
            store.dismiss(item.dataset.toastId, 'escape')
        }
    }

    const setHovered = (list: HTMLElement | null): void => {
        if (hovered === list) {
            return
        }

        hovered = list

        if (list) {
            store.pause(reasons.hover)
        } else {
            store.resume(reasons.hover)
        }

        layout()
    }

    const listOf = (target: EventTarget | null): HTMLElement | null =>
        target instanceof Element ? (target.closest<HTMLElement>('[data-toast-list]') ?? null) : null

    // A finger does not hover. Expanding the stack when it lands shows the toasts behind the front one, and Safari on iOS
    // takes a tap that shows content for a hover and drops its click, so the dismiss button of a stacked toast never
    // fires. A tap expands the stack by focusing the toast instead.
    const onPointerOver = (event: PointerEvent): void => {
        if (event.pointerType !== 'touch') {
            setHovered(listOf(event.target))
        }
    }

    const onPointerOut = (event: PointerEvent): void => {
        if (event.pointerType !== 'touch' && listOf(event.relatedTarget) === null) {
            setHovered(null)
        }
    }

    const swipeDirection = (item: HTMLElement): 'left' | 'right' | 'both' => {
        const position = item.closest<HTMLElement>('[data-toast-list]')?.dataset.position ?? ''

        return position.endsWith('right') ? 'right' : position.endsWith('left') ? 'left' : 'both'
    }

    const allowed = (item: HTMLElement, dx: number): boolean => {
        const direction = swipeDirection(item)

        return direction === 'both' || (direction === 'right' ? dx > 0 : dx < 0)
    }

    const onPointerDown = (event: PointerEvent): void => {
        modality = event.pointerType === 'touch' ? 'touch' : 'pointer'

        // One pointer drags at a time, so a second finger on another toast does not take over the swipe. A swipe that
        // never started moving has no pointer capture and may have missed its pointerup, so a new press replaces it.
        if (swipe?.active) {
            return
        }

        const item = itemOf(event.target)
        const interactive = event.target instanceof Element && event.target.closest('a, button, input, select, textarea, [data-toast-no-swipe]')

        if (event.button !== 0 || !item || interactive || item.dataset.dismissible === 'false' || !isOpen(item)) {
            return
        }

        swipe = { item, pointerId: event.pointerId, x: event.clientX, time: Date.now(), dx: 0, active: false }
    }

    const onPointerMove = (event: PointerEvent): void => {
        if (!swipe || event.pointerId !== swipe.pointerId) {
            return
        }

        // A press whose button went up where the toasts did not hear it, such as outside them, or whose toast closed, ends
        // before it becomes a drag.
        if (!swipe.active && ((event.buttons & 1) === 0 || !swipe.item.isConnected || !isOpen(swipe.item))) {
            swipe = null

            return
        }

        const dx = event.clientX - swipe.x

        if (!swipe.active) {
            if (Math.abs(dx) < 4) {
                return
            }

            swipe.active = true
            swipe.item.dataset.swiping = 'true'
            // Capture fails for pointers that are no longer active; the swipe still works without it.
            try {
                swipe.item.setPointerCapture(event.pointerId)
            } catch {}
            store.pause(reasons.swipe)
        }

        swipe.dx = dx

        // Dragging the wrong way moves the toast a little, so it does not feel stuck.
        const offset = allowed(swipe.item, dx) ? dx : Math.sign(dx) * Math.min(Math.abs(dx) * 0.15, 8)
        swipe.item.style.setProperty('--toast-swipe', `${offset}px`)
    }

    const endSwipe = (dismiss: boolean): void => {
        if (!swipe) {
            return
        }

        const { item, dx, active } = swipe
        const toastId = item.dataset.toastId
        swipe = null

        if (!active) {
            return
        }

        delete item.dataset.swiping
        store.resume(reasons.swipe)

        if (dismiss && toastId !== undefined) {
            item.dataset.swipeOut = dx > 0 ? 'right' : 'left'
            store.dismiss(toastId, 'swipe')
        } else {
            item.style.removeProperty('--toast-swipe')
        }
    }

    const onPointerUp = (event: PointerEvent): void => {
        if (!swipe || event.pointerId !== swipe.pointerId) {
            return
        }

        const velocity = Math.abs(swipe.dx) / Math.max(1, Date.now() - swipe.time)
        const selecting = (window.getSelection?.()?.toString() ?? '') !== ''

        endSwipe(!selecting && allowed(swipe.item, swipe.dx) && (Math.abs(swipe.dx) >= SWIPE_DISTANCE || velocity > SWIPE_VELOCITY))
    }

    const onPointerCancel = (event: PointerEvent): void => {
        if (event.pointerId === swipe?.pointerId) {
            endSwipe(false)
        }
    }

    // Above modals, the toasts are in the top layer but outside the dialogs of other libraries, such as Radix and Reka.
    // Those dialogs move focus back when a focusout event tells them it left, so the shortcut hides that event.
    const focusItem = (item: HTMLElement): void => {
        const hide = (event: FocusEvent): void => {
            if (event.relatedTarget === item) {
                event.stopImmediatePropagation()
            }
        }

        if (layered) {
            window.addEventListener('focusout', hide, true)
        }

        item.focus()
        window.removeEventListener('focusout', hide, true)
    }

    const onHotkey = (event: KeyboardEvent): void => {
        const { hotkey } = settings()
        const pressed =
            hotkey.length > 0 && hotkey.every((key) => (modifiers.includes(key as never) ? event[key as (typeof modifiers)[number]] : event.code === key))
        const newest = items()[0]

        if (!pressed || !newest) {
            return
        }

        event.preventDefault()
        modality = 'keyboard'

        if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body && !region.contains(document.activeElement)) {
            returnFocus = document.activeElement
        }

        focusItem(newest)
    }

    // A modal dialog makes everything outside it inert, so the toasts move into the topmost one while it is open. Above
    // modals, they also move into an open dialog popover, such as the notification center's panel, which the browser
    // would close when the user presses a toast outside it.
    const surfaces: HTMLElement[] = []
    let layered = false

    const isOpenSurface = (surface: HTMLElement): boolean =>
        surface.isConnected && (surface instanceof HTMLDialogElement ? surface.open && surface.matches(':modal') : layered && surface.matches(':popover-open'))

    const isDialogPopover = (target: EventTarget | null): target is HTMLElement =>
        target instanceof HTMLElement && target !== host && target.hasAttribute('popover') && /^(alert)?dialog$/.test(target.getAttribute('role') ?? '')

    const forget = (surface: HTMLElement): void => {
        const index = surfaces.indexOf(surface)

        if (index !== -1) {
            surfaces.splice(index, 1)
        }
    }

    // Toasts that enter the page again, or show again, would replay their entry transition.
    const withoutTransitions = (callback: () => void): void => {
        const items = Array.from(host?.querySelectorAll<HTMLElement>('[data-toast-id]') ?? [])

        items.forEach((item) => (item.style.transition = 'none'))
        callback()
        void host?.offsetWidth
        items.forEach((item) => item.style.removeProperty('transition'))
    }

    /** Whether the toasts should be in the top layer but are not. */
    const hidden = (): boolean => !!host?.isConnected && layered && !host.matches(':popover-open')

    // The element that entered the top layer last shows above the others, so the toasts enter it again.
    const raise = (): void => {
        if (!host?.isConnected || !layered) {
            return
        }

        if (host.matches(':popover-open')) {
            host.hidePopover()
        }

        try {
            host.showPopover()
        } catch {
            // The browser shows no popover while another one closes, such as during the panel's beforetoggle event, so
            // the toasts show again before the next frame.
            requestAnimationFrame(() => {
                if (hidden()) {
                    withoutTransitions(() => host.showPopover())
                }
            })
        }
    }

    const placeHost = (): void => {
        if (!host) {
            return
        }

        const top = [...surfaces].reverse().find(isOpenSurface)
        const parent = top ?? document.body

        if (host.parentElement !== parent) {
            withoutTransitions(() => {
                parent.append(host)
                raise()
            })
        } else if (hidden()) {
            raise()
        }
    }

    const trackDialog = (dialog: HTMLDialogElement): void => {
        forget(dialog)

        if (dialog.open && dialog.matches(':modal')) {
            surfaces.push(dialog)
        }
    }

    // A dialog popover that closes would take the toasts with it, so they leave before the browser hides it.
    const onBeforeToggle = (event: Event): void => {
        if (isDialogPopover(event.target) && (event as ToggleEvent).newState === 'closed') {
            forget(event.target)
            placeHost()
        }
    }

    const onToggle = (event: Event): void => {
        if (isDialogPopover(event.target) && (event as ToggleEvent).newState === 'open') {
            forget(event.target)
            surfaces.push(event.target)
            placeHost()
        }
    }

    // The dialogs of other libraries close when the user presses outside them, and move focus back into them, from
    // listeners on the document. The pointer and focus events of the toasts stop at their element instead.
    const stopPropagation = (event: Event): void => event.stopPropagation()

    const containFocusOut = (event: FocusEvent): void => {
        if (event.relatedTarget instanceof Node && region.contains(event.relatedTarget)) {
            event.stopPropagation()
        }
    }

    // Escape in a toast closes the toast, also when a dialog of another library listens for it before the toast does.
    const claimEscape = (event: KeyboardEvent): void => {
        const item = itemOf(event.target)

        if (event.key === 'Escape' && item && region.contains(item) && item.dataset.dismissible !== 'false') {
            event.preventDefault()
        }
    }

    const listenAboveModals = (element: HTMLElement): void => {
        element.addEventListener('pointerdown', stopPropagation)
        element.addEventListener('focusin', stopPropagation)
        element.addEventListener('focusout', containFocusOut)
        window.addEventListener('keydown', claimEscape, true)
        document.addEventListener('beforetoggle', onBeforeToggle, true)
        document.addEventListener('toggle', onToggle, true)
    }

    const stopListeningAboveModals = (element: HTMLElement): void => {
        element.removeEventListener('pointerdown', stopPropagation)
        element.removeEventListener('focusin', stopPropagation)
        element.removeEventListener('focusout', containFocusOut)
        window.removeEventListener('keydown', claimEscape, true)
        document.removeEventListener('beforetoggle', onBeforeToggle, true)
        document.removeEventListener('toggle', onToggle, true)
    }

    const setLayered = (next: boolean): void => {
        const enabled = next && typeof host?.showPopover === 'function'

        if (!host || enabled === layered) {
            return
        }

        layered = enabled

        if (enabled) {
            listenAboveModals(host)
            // Libraries that hide the rest of the page from screen readers with `aria-hidden`, such as Radix and Reka,
            // leave live regions alone. The value `off` makes the element one without announcing anything.
            host.setAttribute('aria-live', 'off')
            host.setAttribute('popover', 'manual')
            // The browser shows a popover as a box in the middle of the page, and a dialog may turn off pointer events on
            // the body, which the host inherits. The host takes no room, and the toasts take pointer events.
            Object.entries(LAYER_STYLES).forEach(([property, value]) => host.style.setProperty(property, value))

            for (const popover of document.querySelectorAll<HTMLElement>('[popover]')) {
                if (isDialogPopover(popover) && isOpenSurface(popover)) {
                    surfaces.push(popover)
                }
            }
        } else {
            stopListeningAboveModals(host)

            if (host.matches(':popover-open')) {
                host.hidePopover()
            }

            host.removeAttribute('popover')
            host.removeAttribute('aria-live')
            Object.keys(LAYER_STYLES).forEach((property) => host.style.removeProperty(property))
            surfaces.splice(0, surfaces.length, ...surfaces.filter((surface) => surface instanceof HTMLDialogElement))
        }

        placeHost()
    }

    const dialogObserver =
        host && typeof MutationObserver === 'function'
            ? new MutationObserver((records) => {
                  for (const record of records) {
                      if (record.type === 'attributes' && record.target instanceof HTMLDialogElement) {
                          trackDialog(record.target)
                      }
                  }

                  // An open dialog that was removed takes the host with it.
                  if (records.some((record) => record.type === 'attributes') || !host.isConnected) {
                      placeHost()
                  }
              })
            : undefined

    if (host && dialogObserver) {
        document.querySelectorAll('dialog[open]').forEach((dialog) => trackDialog(dialog as HTMLDialogElement))
        dialogObserver.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] })
        placeHost()
    }

    setLayered(settings().aboveModals)

    region.addEventListener('focusin', onFocusIn)
    region.addEventListener('focusout', onFocusOut)
    region.addEventListener('keydown', onKeyDown)
    region.addEventListener('pointerdown', onPointerDown)
    region.addEventListener('pointermove', onPointerMove)
    region.addEventListener('pointerup', onPointerUp)
    region.addEventListener('pointercancel', onPointerCancel)
    region.addEventListener('pointerover', onPointerOver)
    region.addEventListener('pointerout', onPointerOut)
    document.addEventListener('keydown', onHotkey)

    return {
        update() {
            setLayered(settings().aboveModals)

            // A Toaster that changed its name runs the timers of the toasts with its new name.
            if (settings().name !== attached) {
                detach()
                attached = settings().name
                detach = store.attach(attached)
            }

            const toasts = ownToasts()
            const { typeLabels } = settings()
            const animate = !prefersReducedMotion()

            for (const toast of toasts) {
                if (toast.state === 'closing') {
                    continue
                }

                if (announced.get(toast.id) !== toast.revision) {
                    announced.set(toast.id, toast.revision)
                    announcer.announce(announcement(toast, typeLabels), toast.politeness ?? (toast.type === 'error' ? 'assertive' : 'polite'))
                }

                const element = elementOf(toast.id)

                // Showing the same toast again bumps its counter and pulses it.
                if (element && animate && toast.count > (counts.get(toast.id) ?? toast.count) && typeof element.animate === 'function') {
                    element.animate([{ scale: '1' }, { scale: '1.03' }, { scale: '1' }], { duration: 300, easing: 'ease-out' })
                }

                counts.set(toast.id, toast.count)

                const body = element?.querySelector('[data-toast-body]')

                if (body && resizeObserver && !observed.has(body)) {
                    observed.add(body)
                    resizeObserver.observe(body)
                }
            }

            for (const map of [announced, counts]) {
                for (const toastId of map.keys()) {
                    if (!toasts.some((toast) => toast.id === toastId)) {
                        map.delete(toastId)
                    }
                }
            }

            checkFocus()

            if (focusedItem) {
                focusedIndex = items().indexOf(focusedItem)
            }

            // The pointer events of a pressed or dragged toast that left the page no longer reach the region.
            if (swipe && !swipe.item.isConnected) {
                endSwipe(false)
            }

            // The toast under the pointer may close without a pointerout event.
            if (hovered && !hovered.matches(':hover')) {
                hovered = null
                store.resume(reasons.hover)
            }

            layout()
            syncProgress()
        },
        destroy() {
            region.removeEventListener('focusin', onFocusIn)
            region.removeEventListener('focusout', onFocusOut)
            region.removeEventListener('keydown', onKeyDown)
            region.removeEventListener('pointerdown', onPointerDown)
            region.removeEventListener('pointermove', onPointerMove)
            region.removeEventListener('pointerup', onPointerUp)
            region.removeEventListener('pointercancel', onPointerCancel)
            region.removeEventListener('pointerover', onPointerOver)
            region.removeEventListener('pointerout', onPointerOut)
            document.removeEventListener('keydown', onHotkey)
            setLayered(false)
            unsubscribe()
            resizeObserver?.disconnect()
            dialogObserver?.disconnect()
            progress.forEach((entry) => entry.animation?.cancel())
            announcer.destroy()
            store.resume(reasons.hover)
            store.resume(reasons.focus)
            store.resume(reasons.swipe)
            detach()
        },
    }
}
