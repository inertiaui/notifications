import { afterEach, describe, expect, it } from 'vite-plus/test'

import { DEFAULT_INBOX_LABELS, inboxLabels, label, snoozeOptions } from './inbox'
import { bellLabel } from './notificationCenter'
import { DEFAULT_PREFERENCES_LABELS, preferencesLabels } from './preferences'
import { announcement, dismissLabel, hotkeyLabel, regionLabel, typeLabel } from './toaster'
import { DEFAULT_TRANSLATIONS, setTranslations, trans } from './translations'

afterEach(() => setTranslations(DEFAULT_TRANSLATIONS))

describe('translations', () => {
    it('renders the English default, and a key without a translation as the key', () => {
        expect(trans('inbox_mark_all_as_read')).toBe('Mark all as read')
        expect(trans('inbox_show_more', { count: 3 })).toBe('Show 3 more')
        expect(trans('inbox_missing')).toBe('inbox_missing')
    })

    it('replaces the defaults with the global translations, and keeps the keys that are left out', () => {
        setTranslations({ inbox_show_more: 'Nog :count tonen' })
        setTranslations({ inbox_show_less: 'Minder tonen', custom_key: 'Eigen tekst' })

        expect(trans('inbox_show_more', { count: 3 })).toBe('Nog 3 tonen')
        expect(trans('inbox_show_less')).toBe('Minder tonen')
        expect(trans('inbox_mark_all_as_read')).toBe('Mark all as read')
        expect(trans('custom_key')).toBe('Eigen tekst')
    })

    it('calls function values with the parameters, such as for plurals', () => {
        setTranslations({ inbox_show_more: ({ count }) => (count === 1 ? 'Show 1 more reply' : `Show ${count} more replies`) })

        expect(trans('inbox_show_more', { count: 1 })).toBe('Show 1 more reply')
        expect(trans('inbox_show_more', { count: 4 })).toBe('Show 4 more replies')
    })

    it('stores a __proto__ key like any other key', () => {
        setTranslations(JSON.parse('{"__proto__": "Prototype"}'))

        expect(trans('__proto__')).toBe('Prototype')
        expect(trans('toString')).toBe('toString')
    })
})

describe('component labels', () => {
    it('use the default, then the global translation, then the label prop of the component', () => {
        expect(inboxLabels().archiveAll).toBe('Archive all')

        setTranslations({ inbox_archive_all: 'Alles archiveren', inbox_title: 'Meldingen' })
        expect(inboxLabels().archiveAll).toBe('Alles archiveren')

        const labels = inboxLabels({ archiveAll: 'Archive everything' })
        expect(labels.archiveAll).toBe('Archive everything')
        expect(labels.title).toBe('Meldingen')
        expect(labels.markAllAsRead).toBe('Mark all as read')
    })

    it('ignores an undefined label prop and keeps the exported defaults in English', () => {
        setTranslations({ preferences_locked: 'Altijd aan' })

        expect(preferencesLabels({ locked: undefined }).locked).toBe('Altijd aan')
        expect(preferencesLabels({ locked: 'Required' }).locked).toBe('Required')
        expect(DEFAULT_PREFERENCES_LABELS.locked).toBe('Always on')
        expect(DEFAULT_INBOX_LABELS.archiveAll).toBe('Archive all')
    })

    it('accept function values from the prop and from the global translations', () => {
        setTranslations({ inbox_mark_as_read: ({ title }) => `Gelezen: ${title}` })
        const labels = inboxLabels({ showMore: ({ count }) => `+${count}` })

        expect(label(labels.markAsRead, { title: 'Invoice paid' })).toBe('Gelezen: Invoice paid')
        expect(label(labels.showMore, { count: 2 })).toBe('+2')
    })

    it('pass the badge text and the number to the bell label, so a function can pluralize', () => {
        setTranslations({ inbox_bell_new: ({ count, number }) => `Notifications, ${count} new ${number === 1 ? 'message' : 'messages'}` })
        const labels = inboxLabels()

        expect(bellLabel(labels, 0, 99, 'en')).toBe('Notifications')
        expect(bellLabel(labels, 1, 99, 'en')).toBe('Notifications, 1 new message')
        expect(bellLabel(labels, 140, 99, 'en')).toBe('Notifications, 99+ new messages')
        expect(bellLabel({ ...labels, bell: 'Inbox' }, 0, 99, 'en')).toBe('Inbox')
    })

    it('name the default snooze times with the translations, or the labels that are given', () => {
        const morning = new Date(2026, 10, 12, 8, 0)

        setTranslations({ inbox_snooze_tomorrow: 'Morgen' })
        expect(snoozeOptions({}, morning).map((option) => option.label)).toEqual(['Later today', 'Morgen', 'Next week'])
        expect(snoozeOptions({ snoozeLaterToday: 'Vanmiddag' }, morning).map((option) => option.label)).toEqual(['Vanmiddag', 'Morgen', 'Next week'])
        expect(snoozeOptions(DEFAULT_INBOX_LABELS, morning).map((option) => option.label)).toEqual(['Later today', 'Tomorrow', 'Next week'])
    })
})

describe('Toaster text', () => {
    const toast = { type: 'error', title: 'Payment failed', description: 'Your card was declined.', actions: [] }

    it('names the region with the label and the shortcut, in the translated format', () => {
        expect(regionLabel(undefined, ['F8'])).toBe('Notifications (F8)')
        expect(regionLabel(undefined, [])).toBe('Notifications')
        expect(hotkeyLabel(['altKey', 'shiftKey', 'KeyT'])).toBe('Alt+Shift+T')

        setTranslations({ toaster_label: 'Meldingen', toaster_label_with_hotkey: ':label, sneltoets :hotkey', toaster_hotkey_shift: 'Shift ⇧' })
        expect(regionLabel(undefined, ['shiftKey', 'Digit1'])).toBe('Meldingen, sneltoets Shift ⇧+1')
        expect(regionLabel('Toasts', ['F8'])).toBe('Toasts, sneltoets F8')
    })

    it('names the dismiss button with the prop, the translation, or the default', () => {
        expect(dismissLabel(undefined, toast)).toBe('Dismiss: Payment failed')

        setTranslations({ toast_dismiss: 'Sluiten: :title' })
        expect(dismissLabel(undefined, toast)).toBe('Sluiten: Payment failed')
        expect(dismissLabel('Close :title', toast)).toBe('Close Payment failed')
        expect(dismissLabel(({ title }) => `Close “${title}”`, toast)).toBe('Close “Payment failed”')
    })

    it('announces the type with the prop, the translation, or the default', () => {
        expect(announcement(toast)).toBe('Error: Payment failed. Your card was declined.')
        expect(typeLabel('default')).toBe('')
        expect(typeLabel('deployment')).toBe('')

        setTranslations({ toast_type_error: 'Fout', toast_type_deployment: 'Uitrol' })
        expect(announcement(toast)).toBe('Fout: Payment failed. Your card was declined.')
        expect(typeLabel('deployment')).toBe('Uitrol')
        expect(announcement(toast, { error: 'Problem' })).toBe('Problem: Payment failed. Your card was declined.')
    })
})
