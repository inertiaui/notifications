import type { ComponentType, ReactElement, SVGProps } from 'react'

import { resolveIcon as sharedResolveIcon, setIconResolver as sharedSetIconResolver, type IconContext } from '../../js/iconResolver'

export type { IconContext }

/** A component that renders an icon, such as one of Heroicons or Lucide. It receives the `className` of the built-in icon. */
export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>

/** Returns the component or element for an icon name, or `null` or `undefined` to keep the built-in icon. */
export type IconResolverFn = (icon: string, context: IconContext) => IconComponent | ReactElement | null | undefined

/** Registers the resolver that every component asks for its icons, or clears it with `null`. */
export const setIconResolver: (resolver: IconResolverFn | null) => void = sharedSetIconResolver

/** The component or element that the global resolver returns for an icon name, or `null`. */
export const resolveIcon = sharedResolveIcon as (icon: string, context?: IconContext) => IconComponent | ReactElement | null
