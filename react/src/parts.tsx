import { isValidElement, type ReactNode } from 'react'

import { customIcon, type IconContext } from '../../js/iconResolver'
import { builtInIcons, own, spinnerArc } from '../../js/icons'
import type { IconComponent, IconResolverFn } from './iconResolver'

function Spinner({ className }: { className: string }) {
    return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" className={className}>
            <circle cx="10" cy="10" r="7" opacity="0.25" />
            <path d={spinnerArc} strokeLinecap="round" />
        </svg>
    )
}

const isComponent = (value: unknown): value is IconComponent =>
    typeof value === 'function' || (typeof value === 'object' && value !== null && '$$typeof' in value && !isValidElement(value))

/** Renders an icon from an `icons` prop or a resolver: an element as it is, or a component with the class of the built-in icon. */
export function renderIcon(icon: ReactNode | IconComponent, className: string): ReactNode {
    if (!isComponent(icon)) {
        return icon
    }

    const Component = icon

    return <Component className={className} aria-hidden="true" />
}

/** A built-in icon, which the component's `icons` prop, its `iconResolver` prop, or the global resolver may replace. */
export function Icon({
    name,
    context,
    icons,
    resolver,
    className,
}: {
    /** The name of a built-in icon, such as `bell` or `spinner`. */
    name: string
    context: IconContext
    icons?: Record<string, ReactNode>
    resolver?: IconResolverFn | null
    className: string
}) {
    const custom = customIcon<ReactNode | IconComponent>(name, context, icons, resolver)

    if (custom !== undefined) {
        return renderIcon(custom, className)
    }

    if (name === 'spinner') {
        return <Spinner className={className} />
    }

    return (
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className={className}>
            {own(builtInIcons, name)?.map((path) => (
                <path key={path} fillRule="evenodd" clipRule="evenodd" d={path} />
            ))}
        </svg>
    )
}
