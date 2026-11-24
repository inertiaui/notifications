import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { createToastStore, defaultDuration, toastPriority } from './toastStore'
import type { StoreOptions, ToastContent } from './types'

type Store = ReturnType<typeof createToastStore>

/** A store with a mounted unnamed Toaster, which runs the timers of the toasts without a `toaster` option. */
const mountedStore = (options?: StoreOptions): Store => {
    const store = createToastStore(options)
    store.attach(undefined)

    return store
}

/** Titles of the toasts that are not closing. */
const open = (store: Store) =>
    store
        .getSnapshot()
        .filter((toast) => toast.state !== 'closing')
        .map((toast) => toast.title)
const visible = (store: Store) =>
    store
        .getSnapshot()
        .filter((toast) => toast.state === 'visible')
        .map((toast) => toast.title)
const find = (store: Store, title: string) => store.getSnapshot().find((toast) => toast.title === title)!

describe('toast store', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('closes a toast after its duration, keeps it rendered for the exit animation, then removes it', () => {
        const store = mountedStore({ duration: 1000, removeDelay: 200 })
        store.add('Timed')
        store.add('Persistent', { duration: null })

        vi.advanceTimersByTime(999)
        expect(open(store)).toEqual(['Timed', 'Persistent'])

        vi.advanceTimersByTime(1)
        expect(open(store)).toEqual(['Persistent'])
        expect(find(store, 'Timed').state).toBe('closing')

        vi.advanceTimersByTime(200)
        expect(store.getSnapshot().map((toast) => toast.title)).toEqual(['Persistent'])

        vi.advanceTimersByTime(60_000)
        expect(open(store)).toEqual(['Persistent'])
    })

    it('resumes each toast with the time it had left, but at least a second', () => {
        const store = mountedStore()
        store.add('Early', { duration: 3000 })
        store.add('Almost gone', { duration: 2000 })
        vi.advanceTimersByTime(1800)

        store.pause()
        store.add('Added while paused', { duration: 500 })
        vi.advanceTimersByTime(10_000)
        expect(open(store)).toEqual(['Early', 'Almost gone', 'Added while paused'])

        store.resume()

        // "Almost gone" had 200 ms left and gets a full second; "Added while paused" keeps its own shorter duration.
        vi.advanceTimersByTime(500)
        expect(open(store)).toEqual(['Early', 'Almost gone'])

        vi.advanceTimersByTime(500)
        expect(open(store)).toEqual(['Early'])

        vi.advanceTimersByTime(199)
        expect(open(store)).toEqual(['Early'])

        vi.advanceTimersByTime(1)
        expect(open(store)).toEqual([])
    })

    it('keeps timers stopped until every pause reason is resumed, for all toasts or one', () => {
        const store = mountedStore({ duration: 1000 })
        const saved = store.add('Saved')
        store.add('Other')

        store.pause('hover')
        store.pause('hidden')
        store.resume('hover')
        store.resume('focus')
        vi.advanceTimersByTime(5000)
        expect(open(store)).toEqual(['Saved', 'Other'])

        store.pause('swipe', saved)
        store.resume('hidden')
        vi.advanceTimersByTime(1000)
        expect(open(store)).toEqual(['Saved'])

        store.resume('swipe', saved)
        vi.advanceTimersByTime(1000)
        expect(open(store)).toEqual([])
    })

    it('replaces an open toast with the same ID in place, restarts its timer, and reports the replaced toast', () => {
        const onClose = vi.fn()
        const store = mountedStore({ duration: 1000 })
        const id = store.add('Uploading', { type: 'loading', onClose })
        store.add('Other', { duration: null })
        vi.advanceTimersByTime(800)

        expect(store.add('Uploaded', { id, type: 'success' })).toBe(id)
        expect(store.getSnapshot()).toMatchObject([{ id, title: 'Uploaded', type: 'success', revision: 2, duration: 1000 }, { title: 'Other' }])
        expect(onClose).toHaveBeenCalledWith('replaced')

        vi.advanceTimersByTime(999)
        expect(open(store)).toEqual(['Uploaded', 'Other'])

        vi.advanceTimersByTime(1)
        expect(open(store)).toEqual(['Other'])
    })

    it('announces a replaced toast again only when its text changed', () => {
        const store = createToastStore()
        store.add('Deployment finished', { id: 'deploy', type: 'success' })

        store.add('Deployment finished', { id: 'deploy', type: 'success', actions: [{ label: 'View', href: '/' }] })
        expect(store.getSnapshot()).toMatchObject([{ revision: 1, actions: [{ label: 'View' }] }])

        store.add('Deployment finished', { id: 'deploy', type: 'success', description: 'Version 2.1 is live.' })
        expect(store.getSnapshot()).toMatchObject([{ revision: 2 }])
    })

    it('adds a fresh toast for the ID of a toast that is closing', () => {
        const store = createToastStore({ duration: 1000 })
        store.add('Uploading', { id: 'upload' })
        store.dismiss('upload')

        store.add('Uploading again', { id: 'upload' })

        expect(store.getSnapshot()).toMatchObject([{ id: 'upload', title: 'Uploading again', state: 'visible', revision: 1 }])
    })

    it('reports why each toast closed, then removes it', () => {
        const events: string[] = []
        const store = mountedStore({ duration: 1000, removeDelay: 100 })
        const track = (title: string) => ({
            onClose: (reason: string) => events.push(`${title} closed: ${reason}`),
            onRemove: () => events.push(`${title} removed`),
        })

        store.add('Timed', track('Timed'))
        const swiped = store.add('Swiped', { ...track('Swiped'), duration: null })
        store.add('Rest', { ...track('Rest'), duration: null })

        store.dismiss(swiped, 'swipe')
        vi.advanceTimersByTime(1000)
        store.dismiss()
        vi.advanceTimersByTime(100)

        expect(events).toEqual([
            'Swiped closed: swipe',
            'Swiped removed',
            'Timed closed: timeout',
            'Rest closed: programmatic',
            'Timed removed',
            'Rest removed',
        ])
    })

    it('queues toasts beyond the limit, shows the most important first, and starts timers only when visible', () => {
        const store = mountedStore({ limit: 2, duration: 1000 })
        store.add('First', { duration: null })
        const second = store.add('Second', { duration: null })
        store.add('Info', { type: 'info' })
        store.add('Error', { type: 'error' })
        store.add('Undo', { action: { label: 'Undo', onClick: () => {} } })

        expect(visible(store)).toEqual(['First', 'Second'])

        // The queued info toast's timer has not started.
        vi.advanceTimersByTime(5000)
        expect(open(store)).toEqual(['First', 'Second', 'Info', 'Error', 'Undo'])

        store.dismiss(second)
        expect(visible(store)).toEqual(['First', 'Error'])

        store.dismiss('missing')
        store.dismiss(store.getSnapshot().find((toast) => toast.title === 'Error')!.id)
        expect(visible(store)).toEqual(['First', 'Undo'])

        store.dismiss(store.getSnapshot().find((toast) => toast.title === 'Undo')!.id)
        expect(visible(store)).toEqual(['First', 'Info'])

        vi.advanceTimersByTime(999)
        expect(open(store)).toEqual(['First', 'Info'])
        vi.advanceTimersByTime(1)
        expect(open(store)).toEqual(['First'])
    })

    it('updates a queued toast without showing it early', () => {
        const store = createToastStore({ limit: 1 })
        store.add('Visible', { duration: null })
        const queued = store.add('Uploading', { type: 'loading' })

        store.add('Uploaded', { id: queued, type: 'success' })
        store.update(queued, { description: '3 files' })

        expect(find(store, 'Uploaded')).toMatchObject({ state: 'queued', description: '3 files', revision: 3 })
    })

    it('counts limits per toaster', () => {
        const store = createToastStore({ limit: 1 })
        store.add('Main', { duration: null })
        store.add('Sidebar', { toaster: 'sidebar', duration: null })
        store.add('Main queued', { duration: null })

        expect(visible(store)).toEqual(['Main', 'Sidebar'])
    })

    it('closes the least important visible toast when the overflow drops toasts', () => {
        const onClose = vi.fn()
        const store = createToastStore({ limit: 2, overflow: 'drop-oldest' })
        store.add('Error', { type: 'error' })
        store.add('Older info', { type: 'info', duration: null, onClose })
        store.add('Newer info', { type: 'info', duration: null })

        expect(open(store)).toEqual(['Error', 'Newer info'])
        expect(onClose).toHaveBeenCalledWith('evicted')
    })

    it('hides the least important visible toast when the overflow hides toasts, and shows it again with the time it had left', () => {
        const onClose = vi.fn()
        const store = mountedStore({ limit: 2, overflow: 'hide' })
        store.add('Error', { type: 'error', duration: null })
        store.add('First', { duration: 3000, onClose })
        vi.advanceTimersByTime(1000)
        const second = store.add('Second', { duration: null })

        expect(visible(store)).toEqual(['Error', 'Second'])
        expect(open(store)).toEqual(['Error', 'First', 'Second'])

        const third = store.add('Third', { duration: null })
        expect(visible(store)).toEqual(['Error', 'Third'])

        // A hidden toast's timer stops.
        vi.advanceTimersByTime(10_000)
        expect(onClose).not.toHaveBeenCalled()

        // The toast that hid last shows first.
        store.dismiss(third)
        expect(visible(store)).toEqual(['Error', 'Second'])
        store.dismiss(second)
        expect(visible(store)).toEqual(['Error', 'First'])

        expect(store.timer(find(store, 'First').id)).toMatchObject({ remaining: 2000, running: true })
        vi.advanceTimersByTime(2000)
        expect(onClose).toHaveBeenCalledWith('timeout')
    })

    it('counts a toast shown again while it is open instead of adding it twice', () => {
        const store = mountedStore({ duration: 1000 })
        const id = store.add('Copied', { type: 'success' })
        vi.advanceTimersByTime(900)

        expect(store.add('Copied', { type: 'success' })).toBe(id)
        expect(store.add('Copied', { type: 'info' })).not.toBe(id)
        expect(find(store, 'Copied')).toMatchObject({ count: 2, revision: 2 })

        // Showing it again restarts the timer.
        vi.advanceTimersByTime(999)
        expect(open(store)).toContain('Copied')

        const unique = createToastStore({ dedupe: false })
        unique.add('Copied')
        unique.add('Copied')
        expect(open(unique)).toEqual(['Copied', 'Copied'])
    })

    it('keeps the data of each toast, and never counts toasts with data as the same toast', () => {
        const store = createToastStore()
        store.add('You were invited', { type: 'invite', data: { team: 'Acme' } })
        store.add('You were invited', { type: 'invite' })
        store.add('You were invited', { type: 'invite', data: { team: 'Apollo' } })

        expect(store.getSnapshot().map((toast) => [toast.data, toast.count])).toEqual([
            [{ team: 'Acme' }, 1],
            [undefined, 1],
            [{ team: 'Apollo' }, 1],
        ])

        const id = store.getSnapshot()[0]!.id
        store.update(id, { data: { team: 'Atlas' } })

        expect(store.getSnapshot()[0]).toMatchObject({ data: { team: 'Atlas' }, revision: 1 })
    })

    it('keeps the progress of a toast between 0 and 1, and updates it without announcing the toast again', () => {
        const store = mountedStore({ duration: 1000 })
        const id = store.add('Uploading', { progress: 1.5 })
        vi.advanceTimersByTime(900)

        expect(find(store, 'Uploading').progress).toBe(1)

        store.update(id, { progress: 0.4 })
        expect(find(store, 'Uploading')).toMatchObject({ progress: 0.4, revision: 1 })

        store.update(id, { progress: -1 })
        expect(find(store, 'Uploading').progress).toBe(0)

        // A progress update is not a change of the content, so the timer keeps running.
        vi.advanceTimersByTime(100)
        expect(open(store)).toEqual([])

        store.add('Uploading', { id: 'upload', progress: 0.5 })
        store.add('Uploaded', { id: 'upload', type: 'success' })
        expect(find(store, 'Uploaded').progress).toBeUndefined()
    })

    it('changes only the given fields on update, and restarts the timer when the content changes', () => {
        const store = mountedStore({ duration: 1000 })
        const id = store.add('Uploading', { description: '1 of 3 files', icon: 'upload' })
        vi.advanceTimersByTime(900)

        store.update(id, { icon: 'cloud' })
        expect(find(store, 'Uploading')).toMatchObject({ icon: 'cloud', revision: 1 })

        store.update(id, { description: undefined, type: 'warning' })
        expect(find(store, 'Uploading')).toMatchObject({ description: undefined, type: 'warning', revision: 2, duration: 1000 })

        vi.advanceTimersByTime(999)
        expect(open(store)).toEqual(['Uploading'])
        vi.advanceTimersByTime(1)
        expect(open(store)).toEqual([])
    })

    it('keeps the image of a toast when it is updated', () => {
        const store = createToastStore()
        const id = store.add('Sophie Martin commented', { image: 'https://example.com/sophie.jpg' })

        store.update(id, { description: 'Looks great!' })

        expect(find(store, 'Sophie Martin commented').image).toBe('https://example.com/sophie.jpg')
    })

    it('stops the timer while an action runs, and not for a toast that replaced it', () => {
        const store = mountedStore()
        const id = store.add('Archived', { duration: 1000, action: { label: 'Undo', onClick: () => {} } })

        store.setPendingAction(id, 0)
        vi.advanceTimersByTime(5000)
        expect(find(store, 'Archived').pendingAction).toBe(0)

        store.setPendingAction(id, undefined)
        vi.advanceTimersByTime(1000)
        expect(open(store)).toEqual([])

        store.add('Exporting', { id: 'export-1', duration: 1000, action: { label: 'Cancel', onClick: () => {} } })
        store.setPendingAction('export-1', 0)
        store.add('Export ready', { id: 'export-1', duration: 1000 })
        vi.advanceTimersByTime(1000)
        expect(open(store)).toEqual([])
    })

    it('runs the timer of a toast only while a Toaster of its name is mounted', () => {
        const store = createToastStore()
        store.add('Unnamed', { duration: 5000 })
        store.add('Sidebar', { duration: 5000, toaster: 'sidebar' })

        // Toasts that arrive before a Toaster mounts keep their full time.
        vi.advanceTimersByTime(10_000)
        expect(open(store)).toEqual(['Unnamed', 'Sidebar'])
        expect(store.timer(find(store, 'Unnamed').id)).toEqual({ duration: 5000, remaining: 5000, running: false })

        const detachDefault = store.attach(undefined)
        expect(store.timer(find(store, 'Unnamed').id)!.running).toBe(true)
        expect(store.timer(find(store, 'Sidebar').id)!.running).toBe(false)

        vi.advanceTimersByTime(5000)
        expect(open(store)).toEqual(['Sidebar'])

        const detachSidebar = store.attach('sidebar')
        vi.advanceTimersByTime(4000)
        detachSidebar()
        vi.advanceTimersByTime(10_000)
        expect(open(store)).toEqual(['Sidebar'])
        expect(store.timer(find(store, 'Sidebar').id)!.remaining).toBe(1000)

        // The timers stop once the last Toaster of their name unmounts.
        const detachOther = store.attach(undefined)
        const later = store.add('Later', { duration: 5000 })
        vi.advanceTimersByTime(1000)
        detachDefault()
        vi.advanceTimersByTime(1000)
        expect(store.timer(later)).toEqual({ duration: 5000, remaining: 3000, running: true })

        detachOther()
        vi.advanceTimersByTime(10_000)
        expect(open(store)).toEqual(['Sidebar', 'Later'])
        expect(store.timer(later)).toEqual({ duration: 5000, remaining: 3000, running: false })
    })

    it('runs the timer of a toast that moves to another Toaster only while that Toaster is mounted, with the time it had left', () => {
        const store = mountedStore()
        store.attach('sidebar')
        const id = store.add('Uploading', { duration: 5000 })
        vi.advanceTimersByTime(2000)

        store.update(id, { toaster: 'uploads' })
        vi.advanceTimersByTime(10_000)
        expect(open(store)).toEqual(['Uploading'])
        expect(store.timer(id)).toEqual({ duration: 5000, remaining: 3000, running: false })

        store.update(id, { toaster: 'sidebar' })
        expect(store.timer(id)!.running).toBe(true)

        vi.advanceTimersByTime(2999)
        expect(open(store)).toEqual(['Uploading'])
        vi.advanceTimersByTime(1)
        expect(open(store)).toEqual([])
    })

    it('shows the next queued toast of a Toaster that a toast moved away from', () => {
        const store = mountedStore({ limit: 1 })
        const id = store.add('Uploading', { duration: null })
        store.add('Saved', { duration: 1000 })
        expect(visible(store)).toEqual(['Uploading'])

        store.update(id, { toaster: 'uploads' })
        expect(visible(store)).toEqual(['Uploading', 'Saved'])

        vi.advanceTimersByTime(1000)
        expect(open(store)).toEqual(['Uploading'])
    })

    it('applies the overflow to a visible toast that moves to a full Toaster, as to a toast added there', () => {
        // The moved toast waits without its timer, and the Toaster it left shows its next queued toast.
        const queue = createToastStore({ limit: 1 })
        queue.attach('sidebar')
        const waiting = queue.add('Uploading', { duration: 5000 })
        queue.add('Saved', { duration: null })
        queue.add('Sidebar', { toaster: 'sidebar', duration: null })

        queue.update(waiting, { toaster: 'sidebar' })
        expect(visible(queue)).toEqual(['Saved', 'Sidebar'])
        expect(queue.timer(waiting)!.running).toBe(false)

        const drop = createToastStore({ limit: 1, overflow: 'drop-oldest' })
        const dropping = drop.add('Uploading', { duration: null })
        drop.add('Sidebar', { toaster: 'sidebar', duration: null })

        drop.update(dropping, { toaster: 'sidebar' })
        expect(open(drop)).toEqual(['Uploading'])

        const hide = createToastStore({ limit: 1, overflow: 'hide' })
        hide.add('Saved', { duration: null })
        const hiding = hide.add('Uploading', { duration: null })
        hide.add('Sidebar', { toaster: 'sidebar', duration: null })

        hide.update(hiding, { toaster: 'sidebar' })
        expect(visible(hide)).toEqual(['Saved', 'Uploading'])
        expect(open(hide)).toEqual(['Saved', 'Uploading', 'Sidebar'])
    })

    it('notifies subscribers once per change', () => {
        const store = createToastStore()
        const listener = vi.fn()
        store.subscribe(listener)

        const first = store.add('First')
        store.add('Second')
        listener.mockClear()

        store.dismiss(first)
        store.dismiss('missing')
        store.dismiss(first)
        expect(listener).toHaveBeenCalledTimes(1)
    })

    it('applies the duration scale and the auto-dismiss switch to toasts added afterwards', () => {
        const store = createToastStore({ duration: 1000 })
        const before = store.add('Before')

        store.configure({ durationScale: 3 })
        const scaled = store.add('Scaled')
        const explicit = store.add('Explicit', { duration: 2000 })

        store.configure({ autoDismiss: false })
        const kept = store.add('Kept', { duration: 2000 })

        const durations = Object.fromEntries(store.getSnapshot().map((toast) => [toast.id, toast.duration]))
        expect([durations[before], durations[scaled], durations[explicit], durations[kept]]).toEqual([1000, 3000, 6000, null])
    })

    it('shows queued toasts when the limit is raised', () => {
        const store = createToastStore({ limit: 1 })
        store.add('First', { duration: null })
        store.add('Second', { duration: null })

        store.configure({ limit: 2 })

        expect(visible(store)).toEqual(['First', 'Second'])
    })
})

describe('default duration', () => {
    const toast = (type: ToastContent['type'], title: string, description?: string): ToastContent => ({ type, title, description })

    it('grows with the length of the toast, between 5 and 12 seconds', () => {
        expect(defaultDuration(toast('success', 'Saved'))).toBe(5000)
        // 2000 + 60 × (30 + 50) characters
        expect(defaultDuration(toast('info', 'a'.repeat(30), 'b'.repeat(50)))).toBe(6800)
        expect(defaultDuration(toast('default', 'a'.repeat(400)))).toBe(12_000)
    })

    it('gives warnings at least 8 seconds and keeps errors, loading toasts, and toasts with actions open', () => {
        expect(defaultDuration(toast('warning', 'Storage almost full'))).toBe(8000)
        expect(defaultDuration(toast('warning', 'a'.repeat(150)))).toBe(11_000)
        expect(defaultDuration(toast('error', 'Payment failed'))).toBeNull()
        expect(defaultDuration(toast('error', 'Payment failed'), { persistentErrors: false })).toBe(5000)
        expect(defaultDuration(toast('error', 'Payment failed'), { duration: 4000 })).toBeNull()
        expect(defaultDuration(toast('loading', 'Uploading'), { duration: 4000 })).toBeNull()
        expect(defaultDuration({ ...toast('success', 'Archived'), actions: [{ label: 'Undo' }] }, { duration: 4000 })).toBeNull()
        expect(defaultDuration(toast('success', 'Saved'), { duration: 4000 })).toBe(4000)

        // An action that tells where else to do the same does not keep the toast open, but one without among them does.
        const view = { label: 'View', altText: 'Also in your notifications.' }
        expect(defaultDuration({ ...toast('info', 'Sam mentioned you'), actions: [view] }, { duration: 4000 })).toBe(4000)
        expect(defaultDuration({ ...toast('info', 'Sam mentioned you'), actions: [view, { label: 'Reply' }] }, { duration: 4000 })).toBeNull()
        expect(defaultDuration({ ...toast('error', 'Deploy failed'), actions: [view] })).toBeNull()
        expect(defaultDuration(toast('error', 'Payment failed'), { duration: () => 7000 })).toBe(7000)
    })
})

describe('toast priority', () => {
    it('ranks errors, then warnings, then the rest, with actions before none', () => {
        const action = [{ label: 'Retry' }]
        const ranked = [
            { type: 'info', actions: [] },
            { type: 'error', actions: [] },
            { type: 'warning', actions: action },
            { type: 'success', actions: action },
            { type: 'error', actions: action },
            { type: 'warning', actions: [] },
        ] as const

        expect([...ranked].sort((a, b) => toastPriority(a) - toastPriority(b))).toEqual([
            { type: 'error', actions: action },
            { type: 'error', actions: [] },
            { type: 'warning', actions: action },
            { type: 'warning', actions: [] },
            { type: 'success', actions: action },
            { type: 'info', actions: [] },
        ])
    })
})
