import { own } from './icons'

/** Where an icon renders, such as `{ component: 'NotificationCenter', part: 'bell' }`, passed as the second argument of a resolver. */
export type IconContext = Record<string, unknown>

/** Returns the component for an icon name, or `null` or `undefined` for a name it does not support. */
export type IconResolverFn = (icon: string, context: IconContext) => unknown

let globalResolver: IconResolverFn | null = null

/** Registers the resolver that every component asks for its icons, or clears it with `null`. */
export function setIconResolver(resolver: IconResolverFn | null): void {
    globalResolver = resolver
}

/** The component that the global resolver returns for an icon name, or `null`. */
export function resolveIcon(icon: string, context: IconContext = {}): unknown {
    return globalResolver?.(icon, context) ?? null
}

/**
 * The icon a component shows for a name: from its `icons` prop, then from its `iconResolver` prop, which takes the
 * place of the global resolver. `undefined` leaves the built-in icon.
 */
export function customIcon<T>(
    name: string,
    context: IconContext,
    icons: Readonly<Partial<Record<string, T>>> = {},
    resolver?: IconResolverFn | null,
): T | undefined {
    const icon = own(icons, name) ?? (resolver ? resolver(name, context) : resolveIcon(name, context))

    return icon === null || icon === undefined || icon === false ? undefined : (icon as T)
}
