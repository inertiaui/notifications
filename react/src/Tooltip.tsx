import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

import { createInboxTooltip, supportsPopover, type InboxTooltip } from '../../js/overlay'
import * as styles from './classes'

/**
 * Shows the name of the control among its children, such as the archive button of a notification, with its keyboard
 * shortcut. The control's accessible name already holds the text, so no element refers to the tooltip.
 */
export default function Tooltip({ text, shortcut, children }: { text: string; shortcut?: string; children: ReactNode }) {
    const [open, setOpen] = useState(false)
    const trigger = useRef<HTMLSpanElement>(null)
    const panel = useRef<HTMLSpanElement>(null)
    const controller = useRef<InboxTooltip | null>(null)
    const tooltip = (): InboxTooltip =>
        (controller.current ??= createInboxTooltip({
            reference: () => trigger.current,
            tooltip: () => panel.current,
            onOpenChange: setOpen,
        }))

    useLayoutEffect(() => () => controller.current?.cleanup(), [])

    useLayoutEffect(() => {
        if (open) {
            controller.current?.mount()
        }
    }, [open])

    return (
        <span
            ref={trigger}
            className={styles.tooltipTriggerClass}
            onPointerEnter={(event) => tooltip().onPointerEnter(event.nativeEvent)}
            onPointerLeave={() => tooltip().onPointerLeave()}
            onPointerDown={() => tooltip().onPointerDown()}
            onFocus={(event) => tooltip().onFocusIn(event.nativeEvent)}
            onBlur={(event) => tooltip().onFocusOut(event.nativeEvent)}
        >
            {children}
            {open && (
                <span ref={panel} role="tooltip" popover={supportsPopover() ? 'manual' : undefined} data-inbox-tooltip="" className={styles.tooltipClass}>
                    {text}
                    {shortcut && <kbd className={styles.tooltipShortcutClass}>{shortcut}</kbd>}
                </span>
            )}
        </span>
    )
}
