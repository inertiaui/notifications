import { animate, cancelAnimations, createTooltipController, prefersReducedMotion, type TooltipController } from '@inertiaui/vanilla'

/** Whether the browser shows popovers in the top layer, where the menus and tooltips render above the panel. */
export const supportsPopover = (): boolean => typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype

export interface InboxTooltipOptions {
    reference: () => HTMLElement | null
    tooltip: () => HTMLElement | null
    onOpenChange: (open: boolean) => void
}

export interface InboxTooltip {
    /** Whether the browser shows the tooltip as a popover, in the top layer, instead of positioning it in place. */
    readonly native: boolean
    onPointerEnter: (event: PointerEvent) => void
    onPointerLeave: () => void
    onPointerDown: () => void
    onFocusIn: (event: FocusEvent) => void
    onFocusOut: (event: FocusEvent) => void
    /** Positions the tooltip once its element renders. */
    mount: () => void
    cleanup: () => void
}

let shown: TooltipController | null = null

/**
 * The behavior of a tooltip, which the Vue and React `Tooltip` share: it shows after a short delay for a pointer that
 * hovers and for keyboard focus, and hides on a press. A tap shows none, as it would show while the control runs. The
 * controller is only created on first use, as most tooltips of a list never show.
 */
export function createInboxTooltip(options: InboxTooltipOptions): InboxTooltip {
    let controller: TooltipController | null = null

    // One tooltip shows at a time, so hovering a control hides the tooltip of the focused one.
    const onOpenChange = (open: boolean): void => {
        if (open && shown !== controller) {
            void shown?.hide()
            shown = controller
        } else if (!open && shown === controller) {
            shown = null
        }

        options.onOpenChange(open)
    }

    const fade = (visible: boolean): Promise<unknown> | undefined => {
        const tooltip = options.tooltip()

        if (!tooltip) {
            return undefined
        }

        cancelAnimations(tooltip)

        return prefersReducedMotion()
            ? undefined
            : animate(tooltip, visible ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }], {
                  duration: visible ? 150 : 75,
                  easing: visible ? 'out' : 'in',
              })
    }

    const initialize = (): TooltipController =>
        (controller ??= createTooltipController({
            ...options,
            onOpenChange,
            onMount:
                ({ popover }) =>
                () =>
                    cancelAnimations(popover),
            transition: fade,
        }))

    return {
        native: supportsPopover(),
        onPointerEnter: (event) => {
            if (event.pointerType !== 'touch') {
                initialize().onMouseEnter()
            }
        },
        onPointerLeave: () => controller?.onMouseLeave(),
        onPointerDown: () => void controller?.hide(),
        onFocusIn: (event) => {
            if (event.target instanceof Element && event.target.matches(':focus-visible')) {
                initialize().onFocusIn()
            }
        },
        onFocusOut: (event) => controller?.onFocusOut(event),
        mount: () => controller?.mount(),
        cleanup: () => {
            controller?.cleanup()

            if (shown === controller) {
                shown = null
            }
        },
    }
}
