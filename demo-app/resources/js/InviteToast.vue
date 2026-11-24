<script setup lang="ts">
// Renders the toasts of the `invite` type, from the Toaster's components prop. Other types keep the default markup.
import { trans, type ToastComponentProps } from '@inertiaui/notifications-vue'

const props = defineProps<ToastComponentProps>()
</script>

<template>
    <span aria-hidden="true" class="flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-600 text-sm font-semibold text-white">
        {{ String(props.toast.data?.inviter ?? '?').charAt(0) }}
    </span>
    <div data-invite-toast class="min-w-0 flex-1">
        <p class="text-sm font-medium">{{ props.toast.title }}</p>
        <p class="text-iui-toast-muted-foreground mt-1 text-sm">
            Join <strong class="font-medium">{{ props.toast.data?.team }}</strong> as {{ props.toast.data?.role }} · {{ props.toast.data?.members }} members
        </p>
        <div v-if="props.toast.actions.length > 0" class="mt-3 flex gap-2">
            <button
                v-for="(action, index) in props.toast.actions"
                :key="index"
                type="button"
                class="rounded-iui-toast bg-violet-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-violet-500"
                @click="props.runAction(index, $event)"
            >
                {{ action.label }}
            </button>
        </div>
    </div>
    <button
        type="button"
        :aria-label="trans('toast_dismiss', { title: props.toast.title })"
        class="rounded-iui-toast text-iui-toast-icon hover:bg-iui-toast-control-hover -m-1 shrink-0 p-1"
        @click="props.dismiss()"
    >
        <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true">
            <path
                d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"
            />
        </svg>
    </button>
</template>
