import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vite-plus/test'

import { panelClass, toastClass } from '../vue/src/classes'
import { cn } from './cn'

describe('part classes', () => {
    it('replace the built-in classes they conflict with', () => {
        expect(cn(toastClass, 'shadow-2xl rounded-none')).not.toMatch(/\bshadow-lg\b|\brounded-iui-toast\b/)
        expect(cn(panelClass, 'bg-white')).not.toContain('bg-iui-inbox-surface')
    })

    it('replace the corners of every radius token of the theme', () => {
        const theme = readFileSync(new URL('../vue/theme.css', import.meta.url), 'utf8')
        const radii = [...theme.matchAll(/--radius-([\w-]+):/g)].map(([, name]) => name)

        expect(radii).toContain('iui-toast')
        radii.forEach((name) => expect(cn(`rounded-${name}`, 'rounded-none')).toBe('rounded-none'))
    })
})
