// Renders the toasts of the `invite` type, from the Toaster's components prop. Other types keep the default markup.
import { trans, type ToastComponentProps } from '@inertiaui/notifications-react'

export default function InviteToast({ toast, dismiss, runAction }: ToastComponentProps) {
    return (
        <>
            <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-600 text-sm font-semibold text-white">
                {String(toast.data?.inviter ?? '?').charAt(0)}
            </span>
            <div data-invite-toast className="min-w-0 flex-1">
                <p className="text-sm font-medium">{toast.title}</p>
                <p className="text-iui-toast-muted-foreground mt-1 text-sm">
                    Join <strong className="font-medium">{String(toast.data?.team)}</strong> as {String(toast.data?.role)} · {String(toast.data?.members)}{' '}
                    members
                </p>
                {toast.actions.length > 0 && (
                    <div className="mt-3 flex gap-2">
                        {toast.actions.map((action, index) => (
                            <button
                                key={index}
                                type="button"
                                className="rounded-iui-toast bg-violet-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-violet-500"
                                onClick={(event) => runAction(index, event)}
                            >
                                {action.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <button
                type="button"
                aria-label={trans('toast_dismiss', { title: toast.title })}
                className="rounded-iui-toast text-iui-toast-icon hover:bg-iui-toast-control-hover -m-1 shrink-0 p-1"
                onClick={dismiss}
            >
                <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden="true">
                    <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
            </button>
        </>
    )
}
