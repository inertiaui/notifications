import { extendTailwindMerge } from 'tailwind-merge'

import { tailwindMergeConfig } from './tailwind'

const twMerge = extendTailwindMerge(tailwindMergeConfig)

// Joins the classes of a part, so a class from the classes prop replaces a conflicting built-in one.
export function cn(...inputs: (string | undefined | null | false)[]): string {
    return twMerge(inputs.filter(Boolean).join(' '))
}
