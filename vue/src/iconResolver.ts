import type { Component } from 'vue'

import { resolveIcon as sharedResolveIcon, setIconResolver as sharedSetIconResolver, type IconContext } from '../../js/iconResolver'

export type { IconContext }

/** Returns the component, or the name of a registered component, for an icon name, or `null` or `undefined` to keep the built-in icon. */
export type IconResolverFn = (icon: string, context: IconContext) => Component | string | null | undefined

/** Registers the resolver that every component asks for its icons, or clears it with `null`. */
export const setIconResolver: (resolver: IconResolverFn | null) => void = sharedSetIconResolver

/** The component that the global resolver returns for an icon name, or `null`. */
export const resolveIcon = sharedResolveIcon as (icon: string, context?: IconContext) => Component | string | null
