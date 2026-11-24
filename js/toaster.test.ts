import { describe, expect, it } from 'vite-plus/test'

import { own, toastIcons } from './icons'
import { announcement } from './toaster'

describe('custom toast types', () => {
    it('shows a custom type named like an object property as a default toast, unless the app gives it a label and icon', () => {
        const toast = { type: 'constructor', title: 'Deployed', actions: [] }

        expect(announcement(toast)).toBe('Deployed.')
        expect(own(toastIcons, 'constructor')).toBeUndefined()
        expect(own({}, 'toString')).toBeUndefined()

        expect(announcement(toast, { constructor: 'Build' })).toBe('Build: Deployed.')
        expect(own({ constructor: 'rocket' }, 'constructor')).toBe('rocket')
    })
})
