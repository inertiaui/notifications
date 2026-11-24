import { afterEach, describe, expect, it } from 'vite-plus/test'

import { customIcon, resolveIcon, setIconResolver, type IconContext } from './iconResolver'

afterEach(() => setIconResolver(null))

describe('icon resolver', () => {
    const bell = { component: 'NotificationCenter', part: 'bell' }

    it('keeps the built-in icon without a resolver or an icons prop', () => {
        expect(resolveIcon('bell')).toBeNull()
        expect(customIcon('bell', bell)).toBeUndefined()
    })

    it('asks the global resolver with the name and where the icon renders, and keeps the built-in icon for names it leaves out', () => {
        const calls: Array<[string, IconContext]> = []

        setIconResolver((icon, context) => {
            calls.push([icon, context])

            return icon === 'bell' ? 'BellAlertIcon' : undefined
        })

        expect(customIcon('bell', bell)).toBe('BellAlertIcon')
        expect(customIcon('archive', { component: 'NotificationItem', part: 'archive' })).toBeUndefined()
        expect(resolveIcon('bell', bell)).toBe('BellAlertIcon')
        expect(calls).toEqual([
            ['bell', bell],
            ['archive', { component: 'NotificationItem', part: 'archive' }],
            ['bell', bell],
        ])

        setIconResolver(() => null)
        expect(customIcon('bell', bell)).toBeUndefined()
    })

    it('lets the iconResolver prop take the place of the global resolver, and the icons prop win over both', () => {
        setIconResolver(() => 'GlobalIcon')

        expect(customIcon('bell', bell)).toBe('GlobalIcon')
        expect(customIcon('bell', bell, {}, (icon) => (icon === 'bell' ? 'LocalIcon' : null))).toBe('LocalIcon')
        // A component's resolver that leaves a name out keeps the built-in icon, like the resolver props of Forms and Table.
        expect(customIcon('archive', bell, {}, () => null)).toBeUndefined()
        expect(customIcon('bell', bell, { bell: 'PropIcon' }, () => 'LocalIcon')).toBe('PropIcon')
        expect(customIcon('bell', bell, { bell: 'PropIcon' })).toBe('PropIcon')
    })

    it('ignores names that an icons prop only inherits, such as constructor', () => {
        expect(customIcon('constructor', { part: 'type' }, {})).toBeUndefined()
    })
})
