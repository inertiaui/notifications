import { isValidElement, useLayoutEffect, useRef, useState, useSyncExternalStore, type ComponentType, type MouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { actionHref } from '../../js/actions'
import { cn } from '../../js/cn'
import { customIcon } from '../../js/iconResolver'
import { own, toastIcons } from '../../js/icons'
import { handleActionClick, toastStore } from '../../js/toast'
import {
    DEFAULT_HOTKEY,
    createToasterController,
    dismissLabel as formatDismissLabel,
    regionLabel,
    toastsByPosition,
    typeLabel,
    type ToasterSettings,
} from '../../js/toaster'
import { trans, type TranslationValue } from '../../js/translations'
import type { Toast, ToastClasses, ToastPosition, ToastTypeLabels } from '../../js/types'
import * as styles from './classes'
import type { IconComponent, IconResolverFn } from './iconResolver'
import { useFlashedToasts } from './notifications'
import { Icon, renderIcon } from './parts'

export interface ToastRenderHelpers {
    dismiss: () => void
    runAction: (index: number, event: MouseEvent) => void
}

/** The props of a component in the Toaster's `components` prop, which renders the toasts of one type. */
export interface ToastComponentProps extends ToastRenderHelpers {
    toast: Toast
}

export interface ToasterProps {
    position?: ToastPosition
    /** Shows only the toasts whose `toaster` option has this name. */
    name?: string
    /** The accessible name of the toast region, in place of the `toaster_label` translation; the shortcut is added to it. */
    label?: string
    /** The accessible name of each dismiss button, in place of the `toast_dismiss` translation; `:title` is replaced with the toast's title. */
    dismissLabel?: TranslationValue
    /** `KeyboardEvent.code` values and modifier names that focus the newest toast. Pass `[]` to disable. */
    hotkey?: readonly string[]
    /** The words that screen readers announce before a toast's title, in place of the `toast_type_` translations. */
    typeLabels?: ToastTypeLabels
    /** How many toasts show in the collapsed stack. */
    visibleToasts?: number
    /** Show every toast at full height instead of stacking them. */
    expand?: boolean
    /** Show a bar that counts down the time left on timed toasts. */
    progress?: boolean
    /** Icons for icon names that toasts refer to, for toast types, and for the built-in icons, such as `dismiss`. */
    icons?: Record<string, ReactNode>
    /** Resolves the icons that `icons` does not have, in place of the global resolver of `setIconResolver()`. */
    iconResolver?: IconResolverFn | null
    /** Class names added to the parts of each toast. */
    classes?: ToastClasses
    /** Replaces the content of each toast. */
    renderToast?: (toast: Toast, helpers: ToastRenderHelpers) => ReactNode
    /** Replaces the icon of each toast. */
    renderIcon?: (toast: Toast) => ReactNode
    /** Components that render the toasts of a type in place of the default markup, keyed by the type, such as `{ invite: InviteToast }`. */
    components?: Record<string, ComponentType<ToastComponentProps>>
    /** Keep the toasts usable above modal dialogs of other libraries, such as Radix and Reka, and above the notification center's panel. */
    aboveModals?: boolean
}

const serverSnapshot: readonly Toast[] = []
const subscribeNothing = () => () => {}

function TypeIcon({ toast, icons, resolver }: { toast: Toast; icons: Record<string, ReactNode>; resolver?: IconResolverFn | null }) {
    if (toast.image !== undefined) {
        return <img src={toast.image} alt="" className={styles.imageClass} />
    }

    if (isValidElement(toast.icon)) {
        return toast.icon
    }

    // The toast's own icon, or the icon of its type, from the props or a resolver.
    const icon = (name: string, part: string) => customIcon<ReactNode | IconComponent>(name, { component: 'Toaster', part, toast }, icons, resolver)
    const custom = (typeof toast.icon === 'string' ? icon(toast.icon, 'icon') : undefined) ?? icon(toast.type, 'type')

    if (custom !== undefined) {
        return renderIcon(custom, 'size-5')
    }

    if (toast.type === 'loading') {
        return <Icon name="spinner" context={{ component: 'Toaster', part: 'type', toast }} icons={icons} resolver={resolver} className={styles.spinnerClass} />
    }

    const path = own(toastIcons, toast.type)

    // The default type, and custom types without an icon.
    if (path === undefined) {
        return <span className={styles.dotClass} />
    }

    return (
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-5">
            <path fillRule="evenodd" clipRule="evenodd" d={path} />
        </svg>
    )
}

export default function Toaster({
    position = 'bottom-right',
    name,
    label,
    dismissLabel,
    hotkey = DEFAULT_HOTKEY,
    typeLabels = {},
    visibleToasts = 3,
    expand = false,
    progress = false,
    icons = {},
    iconResolver,
    classes = {},
    renderToast,
    renderIcon: renderToastIcon,
    components = {},
    aboveModals = true,
}: ToasterProps) {
    useFlashedToasts()
    const toasts = useSyncExternalStore(toastStore.subscribe, toastStore.getSnapshot, () => serverSnapshot)
    // The toasts render into an element of their own, which can move into an open modal dialog. Rendering starts after
    // hydration, since the server renders no toasts.
    const hydrated = useSyncExternalStore(
        subscribeNothing,
        () => true,
        () => false,
    )
    const [host] = useState(() => (typeof document === 'undefined' ? null : Object.assign(document.createElement('div'), { className: 'iui-toaster-host' })))

    const region = useRef<HTMLElement>(null)
    const polite = useRef<HTMLDivElement>(null)
    const assertive = useRef<HTMLDivElement>(null)
    const controller = useRef<ReturnType<typeof createToasterController> | null>(null)
    const settings = useRef<ToasterSettings>({ name, hotkey, typeLabels, visibleToasts, expand, aboveModals })

    // The controller reads the latest props when it handles a key press or announces a toast.
    useLayoutEffect(() => {
        settings.current = { name, hotkey, typeLabels, visibleToasts, expand, aboveModals }
    })

    useLayoutEffect(() => {
        if (!host || !hydrated) {
            return
        }

        document.body.append(host)

        const instance = createToasterController(
            toastStore,
            { region: region.current!, host, polite: polite.current!, assertive: assertive.current! },
            () => settings.current,
        )
        controller.current = instance

        return () => {
            instance.destroy()
            controller.current = null
            host.remove()
        }
    }, [host, hydrated])

    // The controller lays out and observes what this component rendered, so it updates after every render.
    useLayoutEffect(() => controller.current?.update())

    if (!host || !hydrated) {
        return null
    }

    const groups = toastsByPosition(
        toasts.filter((toast) => toast.toaster === name),
        position,
    )

    const content = (toast: Toast) => {
        const dismiss = (): void => toastStore.dismiss(toast.id, 'user')
        const runAction = (index: number, event: MouseEvent): void => handleActionClick(toast.id, index, event.nativeEvent)
        const TypeComponent = own(components, toast.type)

        if (TypeComponent) {
            return <TypeComponent toast={toast} dismiss={dismiss} runAction={runAction} />
        }

        if (renderToast) {
            return renderToast(toast, { dismiss, runAction })
        }

        const typeName = typeLabel(toast.type, typeLabels)

        return (
            <>
                {toast.icon !== false && (
                    <span aria-hidden="true" className={cn(styles.iconClass, own(styles.typeClasses, toast.type) ?? styles.typeClasses.default, classes.icon)}>
                        {renderToastIcon ? renderToastIcon(toast) : <TypeIcon toast={toast} icons={icons} resolver={iconResolver} />}
                    </span>
                )}
                <div className="min-w-0 flex-1">
                    <p className={cn(styles.titleClass, classes.title)}>
                        {typeName && <span className="sr-only">{typeName}: </span>}
                        {toast.title}
                        {toast.count > 1 && (
                            <span data-toast-count aria-hidden="true" className={styles.countClass}>
                                {trans('toast_count', { count: toast.count })}
                            </span>
                        )}
                    </p>
                    {toast.description && <p className={cn(styles.descriptionClass, classes.description)}>{toast.description}</p>}
                    {toast.progress !== undefined && (
                        <div
                            role="progressbar"
                            aria-label={toast.title}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(toast.progress * 100)}
                            data-toast-progressbar=""
                            className={styles.progressBarClass}
                        >
                            <div
                                className={cn(styles.progressBarFillClass, own(styles.typeClasses, toast.type) ?? styles.typeClasses.default)}
                                style={{ width: `${toast.progress * 100}%` }}
                            />
                        </div>
                    )}
                    {toast.actions.length > 0 && (
                        <div className={cn(styles.actionsClass, classes.actions)}>
                            {toast.actions.map((action, index) => {
                                const href = actionHref(action)
                                const props = {
                                    'aria-disabled': toast.pendingAction !== undefined || undefined,
                                    'aria-busy': toast.pendingAction === index || undefined,
                                    'data-toast-action': '',
                                    className: cn(index === 0 ? styles.primaryActionClass : styles.secondaryActionClass, classes.action),
                                    onClick: (event: MouseEvent) => runAction(index, event),
                                }
                                const children = (
                                    <>
                                        {toast.pendingAction === index && (
                                            <Icon
                                                name="spinner"
                                                context={{ component: 'Toaster', part: 'action', toast, action }}
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
                </div>
                {toast.dismissible && (
                    <button
                        type="button"
                        aria-label={formatDismissLabel(dismissLabel, toast)}
                        className={cn(styles.dismissClass, classes.dismiss)}
                        onClick={dismiss}
                    >
                        <Icon
                            name="dismiss"
                            context={{ component: 'Toaster', part: 'dismiss', toast }}
                            icons={icons}
                            resolver={iconResolver}
                            className="size-4"
                        />
                    </button>
                )}
            </>
        )
    }

    return createPortal(
        <section ref={region} aria-label={regionLabel(label, hotkey)} tabIndex={-1} className="iui-toaster outline-none" data-toaster={name}>
            {groups.map(([listPosition, items]) => (
                <ol key={listPosition} role="list" data-toast-list="" data-position={listPosition} className="iui-toast-list">
                    {items.map((toast) => (
                        <li
                            key={toast.id}
                            data-toast-id={toast.id}
                            data-type={toast.type}
                            data-state={toast.state}
                            data-dismissible={String(toast.dismissible)}
                            aria-busy={toast.type === 'loading' || undefined}
                            tabIndex={0}
                            className={cn(styles.toastClass, classes.toast)}
                        >
                            <div data-toast-body="" className={styles.bodyClass}>
                                {content(toast)}
                            </div>
                            {progress && toast.duration !== null && (
                                <div
                                    data-toast-progress=""
                                    aria-hidden="true"
                                    className={cn(styles.progressClass, own(styles.typeClasses, toast.type) ?? styles.typeClasses.default, classes.progress)}
                                />
                            )}
                        </li>
                    ))}
                </ol>
            ))}
            <div ref={polite} role="status" aria-live="polite" aria-atomic="true" className="sr-only" />
            <div ref={assertive} aria-live="assertive" aria-atomic="true" className="sr-only" />
        </section>,
        host,
    )
}
