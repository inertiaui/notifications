import type { DurationOptions, StoreOptions, Toast, ToastAction, ToastCloseReason, ToastContent, ToastOptions, ToastState, ToastUpdate } from './types'

export interface ToastTimer {
    duration: number
    /** Milliseconds left, counted down while the timer runs. */
    remaining: number
    running: boolean
}

export interface ToastStore {
    /** Subscribe to changes; compatible with React's `useSyncExternalStore`. Also called when timers pause or resume. */
    subscribe(listener: () => void): () => void
    /** Every toast in the order it was added, including queued and closing toasts. */
    getSnapshot(): readonly Toast[]
    /** Adds a toast and returns its ID. With the ID of an open toast, replaces that toast in place. */
    add(title: string, options?: ToastOptions): string
    /** Changes an open or queued toast; omitted fields keep their value. Content changes restart its timer. */
    update(id: string, changes: ToastUpdate): void
    /** Closes one toast, or every toast when no ID is given. */
    dismiss(id?: string, reason?: ToastCloseReason): void
    /**
     * Stops close timers for the given reason: every timer, or only the timer of one toast. Timers run again
     * once every reason is resumed.
     */
    pause(reason?: string, id?: string): void
    /** Removes a pause reason. Each toast continues with the time it had left, but at least a second. */
    resume(reason?: string, id?: string): void
    timer(id: string): ToastTimer | undefined
    /** Marks the action that is running, which also stops the toast's timer. */
    setPendingAction(id: string, index: number | undefined): void
    /** Changes the defaults of toasts added from now on, and the limit. */
    configure(options: StoreOptions): void
    /**
     * Records a mounted Toaster that shows the toasts of the given name, or the unnamed toasts, and returns how to record
     * that it unmounted. A toast's timer runs only while a Toaster of its name is mounted.
     */
    attach(toaster: string | undefined): () => void
}

interface Timer {
    duration: number
    remaining: number
    startedAt: number
    handle?: ReturnType<typeof setTimeout>
}

interface Entry {
    toast: Toast
    /** The duration the caller asked for; `undefined` uses the default for the toast's type and length. */
    requested: number | null | undefined
    timer?: Timer
    /** Pause reasons that apply to this toast only. */
    holds: Set<string>
    /** Insertion order, to queue toasts of the same priority first in, first out. */
    sequence: number
    removal?: ReturnType<typeof setTimeout>
}

/** A resumed toast stays open at least this long, so it does not vanish the moment the pointer leaves. */
export const MIN_REMAINING = 1000

/** Time to read a toast: 2 seconds plus 60 ms per character, between 5 and 12 seconds. */
export function readingDuration({ title, description }: ToastContent): number {
    const characters = title.length + (description?.length ?? 0)

    return Math.min(Math.max(2000 + 60 * characters, 5000), 12_000)
}

export function defaultDuration(toast: ToastContent, options: DurationOptions = {}): number | null {
    if (typeof options.duration === 'function') {
        return options.duration(toast)
    }

    // Loading toasts wait to be replaced; toasts with actions wait for the user, who may need time to reach them,
    // unless the `altText` of each action tells where else to do the same.
    if (toast.type === 'loading' || toast.actions?.some((action) => !action.altText)) {
        return null
    }

    if (toast.type === 'error' && options.persistentErrors !== false) {
        return null
    }

    if (typeof options.duration === 'number') {
        return options.duration
    }

    return toast.type === 'warning' ? Math.max(readingDuration(toast), 8000) : readingDuration(toast)
}

/** Lower is more important: errors, then warnings, then the rest; toasts with actions before those without. */
export function toastPriority(toast: Pick<Toast, 'type' | 'actions'>): number {
    const base = toast.type === 'error' ? 0 : toast.type === 'warning' ? 2 : 4

    return base + (toast.actions.length > 0 ? 0 : 1)
}

/** A progress between 0 and 1, or `undefined` for none. */
const fraction = (progress: number | undefined): number | undefined =>
    progress === undefined || Number.isNaN(progress) ? undefined : Math.min(Math.max(progress, 0), 1)

const actionsOf = (options: Pick<ToastOptions, 'action' | 'actions'>): readonly ToastAction[] => [
    ...(options.action ? [options.action] : []),
    ...(options.actions ?? []),
]

const storeOptionKeys: Record<keyof StoreOptions, true> = {
    duration: true,
    persistentErrors: true,
    durationScale: true,
    autoDismiss: true,
    limit: true,
    overflow: true,
    dedupe: true,
    removeDelay: true,
}

export function createToastStore(initialOptions: StoreOptions = {}): ToastStore {
    let options: StoreOptions = {}
    let counter = 0
    let sequence = 0
    let snapshot: readonly Toast[] = []
    let dirty = false
    const entries = new Map<string, Entry>()
    const pauses = new Set<string>()
    // The mounted Toasters by name, `''` for the unnamed one.
    const toasters = new Map<string, number>()
    const listeners = new Set<() => void>()
    // User callbacks run after the store is consistent and listeners were notified, so a throwing callback cannot corrupt it.
    let callbacks: Array<() => void> = []

    const emit = (): void => {
        if (dirty) {
            dirty = false
            snapshot = Array.from(entries.values(), (entry) => entry.toast)
        }

        for (const listener of listeners) {
            listener()
        }

        const pending = callbacks
        callbacks = []
        pending.forEach((callback) => callback())
    }

    const set = (entry: Entry, toast: Toast): void => {
        entry.toast = toast
        dirty = true
    }

    const resolveDuration = (content: ToastContent, requested: number | null | undefined): number | null => {
        const duration = requested === undefined ? defaultDuration(content, options) : requested

        if (duration === null || options.autoDismiss === false) {
            return null
        }

        return Math.round(duration * (options.durationScale ?? 1))
    }

    const stop = (timer: Timer): void => {
        if (timer.handle !== undefined) {
            clearTimeout(timer.handle)
            timer.handle = undefined
            timer.remaining -= Date.now() - timer.startedAt
        }
    }

    // A timer runs while a mounted Toaster shows its toast and nothing pauses it, so toasts that arrive before their
    // Toaster mounts keep their full time.
    const sync = (entry: Entry): void => {
        const { timer } = entry

        if (!timer) {
            return
        }

        const shown = (toasters.get(entry.toast.toaster ?? '') ?? 0) > 0
        // A running action holds its toast open, and a toast that replaced it by its ID starts without one.
        const runnable = entry.toast.state === 'visible' && pauses.size === 0 && entry.holds.size === 0 && entry.toast.pendingAction === undefined && shown

        if (runnable && timer.handle === undefined) {
            timer.remaining = Math.max(timer.remaining, Math.min(MIN_REMAINING, timer.duration))
            timer.startedAt = Date.now()
            timer.handle = setTimeout(() => dismiss(entry.toast.id, 'timeout'), timer.remaining)
        } else if (!runnable) {
            stop(timer)
        }
    }

    const restartTimer = (entry: Entry): void => {
        if (entry.timer) {
            stop(entry.timer)
        }

        const { duration } = entry.toast
        entry.timer = duration === null ? undefined : { duration, remaining: duration, startedAt: 0 }
        sync(entry)
    }

    const group = (entry: Entry): Entry[] => [...entries.values()].filter((other) => other.toast.toaster === entry.toast.toaster)
    const limit = (): number => Math.max(1, options.limit ?? 5)

    const remove = (entry: Entry): void => {
        clearTimeout(entry.removal)
        entries.delete(entry.toast.id)
        dirty = true

        const { onRemove } = entry.toast
        if (onRemove) {
            callbacks.push(onRemove)
        }
    }

    const close = (entry: Entry, reason: ToastCloseReason): void => {
        const queued = entry.toast.state === 'queued'

        if (entry.timer) {
            stop(entry.timer)
            entry.timer = undefined
        }

        set(entry, { ...entry.toast, state: 'closing', pendingAction: undefined })

        const { onClose } = entry.toast
        if (onClose) {
            callbacks.push(() => onClose(reason))
        }

        // A queued toast was never shown, so it has no exit animation.
        if (queued) {
            remove(entry)
        } else {
            entry.removal = setTimeout(() => {
                remove(entry)
                emit()
            }, options.removeDelay ?? 200)
        }
    }

    // Show queued toasts while there is room, most important first: the first added among equals, or with `hide` the last
    // added.
    const promote = (): void => {
        const order = options.overflow === 'hide' ? -1 : 1

        for (const entry of entries.values()) {
            if (entry.toast.state !== 'queued') {
                continue
            }

            const members = group(entry)
            let visible = members.filter((member) => member.toast.state === 'visible').length
            const queued = members
                .filter((member) => member.toast.state === 'queued')
                .sort((a, b) => toastPriority(a.toast) - toastPriority(b.toast) || order * (a.sequence - b.sequence))

            for (const next of queued) {
                if (visible >= limit()) {
                    break
                }

                visible++
                set(next, { ...next.toast, state: 'visible' })
                sync(next)
            }
        }
    }

    const initialState = (entry: Entry): ToastState => {
        const visible = group(entry).filter((member) => member !== entry && member.toast.state === 'visible')

        if (visible.length < limit()) {
            return 'visible'
        }

        if (options.overflow !== 'drop-oldest' && options.overflow !== 'hide') {
            return 'queued'
        }

        // The least important toast makes way, the oldest among equals.
        const victim = visible.reduce((least, candidate) => (toastPriority(candidate.toast) > toastPriority(least.toast) ? candidate : least))

        if (options.overflow === 'hide') {
            set(victim, { ...victim.toast, state: 'queued' })
            sync(victim)
        } else {
            close(victim, 'evicted')
        }

        return 'visible'
    }

    const build = (
        id: string,
        title: string,
        toastOptions: ToastOptions,
        requested: number | null | undefined,
        extra: Pick<Toast, 'count' | 'revision' | 'state'>,
    ): Toast => {
        const content = { type: toastOptions.type ?? 'default', title, description: toastOptions.description, actions: actionsOf(toastOptions) }

        return {
            id,
            ...content,
            duration: resolveDuration(content, requested),
            icon: toastOptions.icon,
            image: toastOptions.image,
            dismissible: toastOptions.dismissible ?? true,
            position: toastOptions.position,
            toaster: toastOptions.toaster,
            politeness: toastOptions.politeness,
            data: toastOptions.data,
            progress: fraction(toastOptions.progress),
            onClose: toastOptions.onClose,
            onRemove: toastOptions.onRemove,
            ...extra,
        }
    }

    const findDuplicate = (title: string, toastOptions: ToastOptions): Entry | undefined => {
        const type = toastOptions.type ?? 'default'

        // Loading toasts stand for separate pieces of work, actions may differ in their callbacks, and data in what a
        // component of the toast's type shows.
        if (
            options.dedupe === false ||
            toastOptions.id !== undefined ||
            type === 'loading' ||
            actionsOf(toastOptions).length > 0 ||
            toastOptions.data !== undefined
        ) {
            return undefined
        }

        return [...entries.values()].find(
            ({ toast }) =>
                toast.state !== 'closing' &&
                toast.actions.length === 0 &&
                toast.data === undefined &&
                toast.toaster === toastOptions.toaster &&
                toast.type === type &&
                toast.title === title &&
                toast.description === toastOptions.description,
        )
    }

    function add(title: string, toastOptions: ToastOptions = {}): string {
        const existing = toastOptions.id === undefined ? undefined : entries.get(toastOptions.id)

        if (existing && existing.toast.state !== 'closing') {
            const previous = existing.toast
            const next = build(previous.id, title, toastOptions, toastOptions.duration, { count: 1, revision: previous.revision, state: previous.state })
            existing.requested = toastOptions.duration

            // Screen readers announce the toast again only when its text changed.
            if (next.type !== previous.type || next.title !== previous.title || next.description !== previous.description) {
                next.revision++
            }

            set(existing, next)

            if (previous.onClose) {
                const { onClose } = previous
                callbacks.push(() => onClose('replaced'))
            }

            restartTimer(existing)
            emit()

            return previous.id
        }

        // A toast that is still playing its exit animation makes way for the new one.
        if (existing) {
            remove(existing)
        }

        const duplicate = findDuplicate(title, toastOptions)

        if (duplicate) {
            set(duplicate, { ...duplicate.toast, count: duplicate.toast.count + 1, revision: duplicate.toast.revision + 1 })
            restartTimer(duplicate)
            emit()

            return duplicate.toast.id
        }

        // A counter, not crypto.randomUUID(), which is missing outside secure contexts.
        const id = toastOptions.id ?? `iui-toast-${++counter}`
        const entry: Entry = {
            toast: build(id, title, toastOptions, toastOptions.duration, { count: 1, revision: 1, state: 'visible' }),
            requested: toastOptions.duration,
            holds: new Set(),
            sequence: ++sequence,
        }

        entries.set(id, entry)
        set(entry, { ...entry.toast, state: initialState(entry) })
        restartTimer(entry)
        emit()

        return id
    }

    function dismiss(id?: string, reason: ToastCloseReason = 'programmatic'): void {
        const targets = id === undefined ? [...entries.values()] : [entries.get(id)]
        let changed = false

        for (const entry of targets) {
            if (entry && entry.toast.state !== 'closing') {
                close(entry, reason)
                changed = true
            }
        }

        if (changed) {
            promote()
            emit()
        }
    }

    function update(id: string, changes: ToastUpdate): void {
        const entry = entries.get(id)

        if (!entry || entry.toast.state === 'closing') {
            return
        }

        const { title, action, actions, ...rest } = changes
        const defined = Object.fromEntries(Object.entries(rest).filter(([, value]) => value !== undefined))
        const contentChanged = ['title', 'type', 'description', 'duration', 'action', 'actions'].some((key) => key in changes)
        const next: Toast = { ...entry.toast, ...defined, title: title ?? entry.toast.title }

        if ('description' in changes) {
            next.description = changes.description
        }

        if (changes.progress !== undefined) {
            next.progress = fraction(changes.progress)
        }

        if (action !== undefined || actions !== undefined) {
            next.actions = actionsOf({ action, actions })
        }

        if ('duration' in changes) {
            entry.requested = changes.duration
        }

        if (contentChanged) {
            next.duration = resolveDuration(next, entry.requested)
            next.revision++
        }

        const moved = next.toaster !== entry.toast.toaster

        set(entry, next)

        // A visible toast that moves to another Toaster meets that Toaster's limit as a toast added there would, while a
        // queued one waits for its turn by priority.
        if (moved && next.state === 'visible') {
            set(entry, { ...next, state: initialState(entry) })
        }

        // A toast that moves to another Toaster keeps the time it had left, which runs while that Toaster is mounted, and
        // leaves room for a queued toast of the Toaster it left.
        if (contentChanged) {
            restartTimer(entry)
        } else if (moved) {
            sync(entry)
        }

        if (moved) {
            promote()
        }

        emit()
    }

    const store: ToastStore = {
        subscribe(listener) {
            listeners.add(listener)

            return () => listeners.delete(listener)
        },
        getSnapshot: () => snapshot,
        add,
        update,
        dismiss,
        pause(reason = 'manual', id) {
            const target = id === undefined ? undefined : entries.get(id)

            if (id !== undefined) {
                if (target && !target.holds.has(reason)) {
                    target.holds.add(reason)
                    sync(target)
                    emit()
                }

                return
            }

            const wasRunning = pauses.size === 0
            pauses.add(reason)

            if (wasRunning) {
                entries.forEach(sync)
                emit()
            }
        },
        resume(reason = 'manual', id) {
            if (id !== undefined) {
                const target = entries.get(id)

                if (target?.holds.delete(reason)) {
                    sync(target)
                    emit()
                }

                return
            }

            if (pauses.delete(reason) && pauses.size === 0) {
                entries.forEach(sync)
                emit()
            }
        },
        timer(id) {
            const timer = entries.get(id)?.timer

            if (!timer) {
                return undefined
            }

            const running = timer.handle !== undefined

            return { duration: timer.duration, remaining: running ? timer.remaining - (Date.now() - timer.startedAt) : timer.remaining, running }
        },
        setPendingAction(id, index) {
            const entry = entries.get(id)

            if (!entry || entry.toast.state === 'closing' || entry.toast.pendingAction === index) {
                return
            }

            set(entry, { ...entry.toast, pendingAction: index })
            sync(entry)
            emit()
        },
        attach(toaster) {
            const name = toaster ?? ''
            toasters.set(name, (toasters.get(name) ?? 0) + 1)
            entries.forEach(sync)
            emit()

            let attached = true

            return () => {
                if (attached) {
                    attached = false
                    toasters.set(name, (toasters.get(name) ?? 1) - 1)
                    entries.forEach(sync)
                    emit()
                }
            }
        },
        configure(changes) {
            const defined = Object.entries(changes).filter(([key, value]) => value !== undefined && key in storeOptionKeys)
            options = { ...options, ...Object.fromEntries(defined) }

            if (changes.limit !== undefined) {
                promote()
                emit()
            }
        },
    }

    store.configure(initialOptions)

    return store
}
