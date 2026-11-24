// Tailwind classes of the styled Toaster. Kept in each package's src directory, which the application's
// Tailwind setup scans; react/src/classes.ts is an identical copy.
import type { BuiltInToastType, ToastType } from '../../js/types'

export const toastClass =
    'iui-toast rounded-iui-toast border-iui-toast-border bg-iui-toast-surface text-iui-toast-foreground focus-visible:ring-iui-toast-ring border shadow-lg focus-visible:ring-2 focus-visible:outline-hidden'

export const bodyClass = 'flex items-start gap-3 p-4'

export const iconClass = 'flex size-5 shrink-0 items-center justify-center'

// Custom types use the `default` color.
export const typeClasses: Record<BuiltInToastType, string> & Partial<Record<ToastType, string>> = {
    default: 'text-iui-toast-default',
    info: 'text-iui-toast-info',
    success: 'text-iui-toast-success',
    warning: 'text-iui-toast-warning',
    error: 'text-iui-toast-error',
    loading: 'text-iui-toast-loading',
}

export const dotClass = 'bg-iui-toast-default size-2 rounded-full'

/** An image in place of the icon, such as the avatar of the person a notification is about. */
export const imageClass = 'size-5 rounded-full object-cover'

export const spinnerClass = 'size-5 motion-safe:animate-spin'

export const titleClass = 'text-sm font-medium wrap-break-word'

export const countClass = 'bg-iui-toast-control-hover text-iui-toast-muted-foreground ms-1.5 inline-block rounded-full px-1.5 text-xs font-medium tabular-nums'

export const descriptionClass = 'text-iui-toast-muted-foreground mt-1 text-sm wrap-break-word'

export const actionsClass = 'mt-3 flex flex-wrap gap-2'

const actionBase =
    'rounded-iui-toast focus-visible:ring-iui-toast-ring inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium focus-visible:ring-2 focus-visible:outline-hidden aria-disabled:cursor-default aria-disabled:opacity-60'

/** The first action of a toast, outlined in the action color, which tints it on hover. */
export const primaryActionClass = `${actionBase} border-iui-toast-action text-iui-toast-action hover:bg-iui-toast-action/10 border`

export const secondaryActionClass = `${actionBase} border-iui-toast-border hover:bg-iui-toast-control-hover border`

export const actionSpinnerClass = 'size-3.5 motion-safe:animate-spin'

export const dismissClass =
    'rounded-iui-toast text-iui-toast-icon hover:bg-iui-toast-control-hover hover:text-iui-toast-icon-hover focus-visible:ring-iui-toast-ring -m-1 shrink-0 p-1 focus-visible:ring-2 focus-visible:outline-hidden'

export const progressClass = 'iui-toast-progress'

/** The bar of a toast's `progress`, which fills with the type's color. */
export const progressBarClass = 'bg-iui-toast-control-hover mt-2 h-1.5 overflow-hidden rounded-full'

export const progressBarFillClass = 'h-full rounded-full bg-current transition-[width] duration-300 motion-reduce:transition-none'

// The notification center.

export const bellClass =
    'rounded-iui-inbox text-iui-inbox-icon hover:bg-iui-inbox-control-hover hover:text-iui-inbox-icon-hover focus-visible:ring-iui-inbox-ring aria-expanded:bg-iui-inbox-control-hover aria-expanded:text-iui-inbox-icon-hover relative inline-flex size-9 items-center justify-center focus-visible:ring-2 focus-visible:outline-hidden'

export const badgeClass =
    'bg-iui-inbox-badge text-iui-inbox-badge-foreground absolute -inset-e-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[0.6875rem] leading-none font-semibold tabular-nums'

export const badgeDotClass = 'bg-iui-inbox-badge absolute inset-e-1.5 top-1.5 size-2 rounded-full forced-color-adjust-none forced-colors:bg-[Highlight]'

/** theme.css sets the panel's border width and corners, which change when it is a sheet on narrow screens. */
export const panelClass = 'iui-inbox-panel border-iui-inbox-border bg-iui-inbox-surface text-iui-inbox-foreground shadow-xl focus-visible:outline-hidden'

/** Everything inside the panel; theme.css caps its height at --inbox-max-height. */
export const panelBodyClass = 'iui-inbox-panel-body flex min-h-0 flex-1 flex-col'

export const panelHeaderClass = 'flex items-center justify-between gap-3 px-4 pt-3 pb-1'

/**
 * The top row of a `NotificationList`, which has the page's heading instead of a title: the tabs, then the bulk actions
 * and the pause button. The tabs grow to push the actions to the end; on narrow screens, the actions wrap above the tabs
 * and start where the tabs start.
 */
export const listToolbarClass = 'border-iui-inbox-border flex flex-wrap-reverse items-stretch border-b pe-4'

/** The tabs of a `NotificationList`, whose border lies over the row's, so the selected tab's line sits on it as in the panel. */
export const listTabListClass = 'iui-inbox-fade border-iui-inbox-border -mb-px flex min-w-0 flex-auto gap-1 overflow-x-auto border-b ps-2.5 pe-8 scrollbar-none'

export const listActionsClass = '-me-1.5 flex shrink-0 items-center gap-1 py-2 ps-2.5'

export const panelTitleClass = 'text-base font-semibold'

/** The buttons in the header, whose text lines up with the panel's padding. */
export const panelActionsClass = '-me-1.5 flex items-center gap-1'

export const textButtonClass =
    'text-iui-inbox-muted-foreground hover:text-iui-inbox-foreground focus-visible:ring-iui-inbox-ring rounded-md px-1.5 py-1 text-xs font-medium focus-visible:ring-2 focus-visible:outline-hidden aria-disabled:pointer-events-none aria-disabled:opacity-50'

/** The menu of the header's More actions button, with Archive all and the presets that pause notifications. */
export const menuClass = 'border-iui-inbox-border bg-iui-inbox-surface text-iui-inbox-foreground rounded-iui-inbox m-0 w-max min-w-48 border p-1 shadow-lg'

export const menuItemClass =
    'hover:bg-iui-inbox-control-hover focus-visible:bg-iui-inbox-control-hover flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm outline-hidden aria-disabled:pointer-events-none aria-disabled:opacity-50'

/** A pause preset, indented to line up with the text of the items that have an icon. */
export const menuPresetClass = `${menuItemClass} ps-8`

/** The name of the pause presets, above them. */
export const menuLabelClass = 'text-iui-inbox-muted-foreground flex items-center gap-2 px-2 pt-1.5 pb-1 text-xs font-medium'

export const menuIconClass = 'text-iui-inbox-icon size-4 shrink-0'

export const menuSeparatorClass = 'bg-iui-inbox-border -mx-1 my-1 h-px'

/** The time a pause preset ends, at the end of its item. */
export const pauseTimeClass = 'text-iui-inbox-muted-foreground ms-auto ps-6 tabular-nums'

/** The element around a control with a tooltip. */
export const tooltipTriggerClass = 'inline-flex'

export const tooltipClass =
    'bg-iui-inbox-tooltip text-iui-inbox-tooltip-foreground pointer-events-none m-0 flex w-max max-w-xs items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium shadow-md'

/**
 * The keyboard shortcut of a control, after the text of its tooltip, in a square. Its line is trimmed to the capital and
 * centered, as the room the font leaves for descenders would otherwise push the letter up.
 */
export const tooltipShortcutClass =
    'inline-block h-4 min-w-4 content-center rounded border border-current/30 px-1 text-center font-sans text-[0.625rem] leading-none opacity-80 [text-box:trim-both_cap_alphabetic]'

/** The line at the top of the panel while notifications are paused, with the Resume button at its end. */
export const pausedClass = 'bg-iui-inbox-control-hover text-iui-inbox-foreground mx-4 mt-1 mb-2 flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs'

export const pausedIconClass = 'text-iui-inbox-icon size-4 shrink-0'

export const resumeClass =
    'text-iui-inbox-foreground hover:bg-iui-inbox-surface focus-visible:ring-iui-inbox-ring -my-1 -me-1.5 shrink-0 rounded-md px-2 py-1 font-semibold focus-visible:ring-2 focus-visible:outline-hidden'

/** The tabs and the categories scroll sideways and fade out at their edges (iui-inbox-fade in theme.css). */
export const tabListClass = 'iui-inbox-fade border-iui-inbox-border flex shrink-0 gap-1 overflow-x-auto border-b ps-2.5 pe-8 scrollbar-none'

export const tabClass =
    'text-iui-inbox-muted-foreground hover:text-iui-inbox-foreground focus-visible:ring-iui-inbox-ring aria-selected:border-iui-inbox-accent aria-selected:text-iui-inbox-accent aria-[current=page]:border-iui-inbox-accent aria-[current=page]:text-iui-inbox-accent -mb-px inline-flex items-center gap-1.5 rounded-t-md border-b-2 border-transparent px-1.5 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:outline-hidden focus-visible:ring-inset'

export const categoryListClass = 'iui-inbox-fade border-iui-inbox-border flex shrink-0 gap-1.5 overflow-x-auto border-b ps-4 pe-8 py-2 scrollbar-none'

export const categoryClass =
    'border-iui-inbox-border text-iui-inbox-muted-foreground hover:bg-iui-inbox-control-hover hover:text-iui-inbox-foreground focus-visible:ring-iui-inbox-ring aria-pressed:border-iui-inbox-accent aria-pressed:bg-iui-inbox-accent-subtle aria-pressed:text-iui-inbox-accent aria-[current=page]:border-iui-inbox-accent aria-[current=page]:bg-iui-inbox-accent-subtle aria-[current=page]:text-iui-inbox-accent inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium focus-visible:ring-2 focus-visible:outline-hidden'

export const categoryCountClass = 'text-iui-inbox-accent tabular-nums'

export const tabCountClass = 'bg-iui-inbox-accent-subtle text-iui-inbox-accent rounded-full px-1.5 text-xs/5 tabular-nums'

export const scrollerClass = 'min-h-0 flex-1 overflow-y-auto overscroll-contain'

/** Keeps the button of the held notifications at the top of the scrolled list, without taking room in it. */
export const newPillRowClass = 'sticky top-0 z-20 flex h-0 justify-center'

export const newPillClass =
    'border-iui-inbox-accent bg-iui-inbox-surface text-iui-inbox-accent focus-visible:ring-iui-inbox-ring mt-2 h-fit rounded-full border px-3 py-1 text-xs font-medium shadow-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden'

export const listClass = 'divide-iui-inbox-border divide-y'

/** A list item, focused by the J and K shortcuts. */
export const listItemClass = 'focus-visible:ring-iui-inbox-ring focus-visible:ring-2 focus-visible:ring-inset focus-visible:outline-hidden'

/** The button that shows the other notifications of a group, aligned with the text of the notification. */
export const groupToggleClass =
    'text-iui-inbox-muted-foreground hover:text-iui-inbox-foreground focus-visible:ring-iui-inbox-ring ms-15 -mt-2 mb-2.5 rounded-md px-1 py-0.5 text-xs font-medium focus-visible:ring-2 focus-visible:outline-hidden'

export const groupListClass = 'divide-iui-inbox-border border-iui-inbox-border ms-12 divide-y border-s'

export const itemClass =
    'group/item hover:bg-iui-inbox-control-hover/60 data-[selected=true]:bg-iui-inbox-control-hover/60 has-[[data-inbox-link]:focus-visible]:ring-iui-inbox-ring relative flex flex-wrap gap-3 px-4 py-3 has-[[data-inbox-link]:focus-visible]:ring-2 has-[[data-inbox-link]:focus-visible]:ring-inset'

/** The start of a notification: its avatar or icon, with the unread dot on its top end. */
export const leadingClass = 'relative flex shrink-0 self-start'

/** The start of a notification that users may select: a label above the item's link, so a click on the avatar selects it. */
export const selectableLeadingClass = 'z-10 cursor-pointer'

/** The unread dot, a badge half over the avatar's top end, cut out of it by a ring like the stacked avatars. */
export const unreadDotClass =
    'bg-iui-inbox-unread ring-iui-inbox-surface absolute end-0 top-0 size-2.5 rounded-full ring-2 forced-color-adjust-none forced-colors:bg-[Highlight]'

export const mediaClass =
    'bg-iui-inbox-control-hover text-iui-inbox-icon-hover flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-medium'

export const itemTitleClass = 'text-iui-inbox-foreground text-sm wrap-break-word group-data-[read=false]/item:font-semibold'

export const linkClass = 'after:absolute after:inset-0 focus-visible:outline-hidden'

export const itemBodyClass = 'text-iui-inbox-muted-foreground mt-0.5 line-clamp-3 text-sm wrap-break-word'

export const itemImageClass = 'border-iui-inbox-border mt-2 max-h-40 rounded-md border object-cover'

export const timeClass = 'text-iui-inbox-muted-foreground mt-1 block text-xs'

export const snoozedUntilClass = 'text-iui-inbox-muted-foreground mt-1 flex items-center gap-1 text-xs'

/** The note below a notification whose thread the user muted. */
export const mutedClass = 'text-iui-inbox-muted-foreground mt-1 flex items-center gap-1 text-xs'

export const snoozeTimeClass = 'text-iui-inbox-muted-foreground font-normal'

export const itemActionsClass = 'relative z-10 mt-2 flex flex-wrap gap-2'

/** The actors of a notification that later ones collapsed into: their stacked avatars, and "Sophie and 3 others". */
export const itemActorsClass = 'text-iui-inbox-muted-foreground mt-1.5 flex items-center gap-1.5 text-xs'

export const actorStackClass = 'isolate flex'

/** An avatar of the stack, which overlaps the next one, so the newest actor shows on top. */
export const stackedAvatarClass =
    'bg-iui-inbox-control-hover text-iui-inbox-icon-hover ring-iui-inbox-surface relative flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full text-[0.625rem] font-medium ring-2 not-first:-ms-0.5'

/** The result of an action that ran, such as "Approved", in place of the actions. */
export const itemResultClass = 'text-iui-inbox-muted-foreground mt-2 flex items-center gap-1.5 text-xs font-medium'

const itemActionBase =
    'rounded-md focus-visible:ring-iui-inbox-ring inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium focus-visible:ring-2 focus-visible:outline-hidden aria-disabled:cursor-default aria-disabled:opacity-60'

/** The first action of a notification, outlined in the accent color. */
export const itemPrimaryActionClass = `${itemActionBase} border-iui-inbox-accent text-iui-inbox-accent hover:bg-iui-inbox-accent-subtle border`

export const itemSecondaryActionClass = `${itemActionBase} border-iui-inbox-border bg-iui-inbox-surface hover:bg-iui-inbox-control-hover border`

/**
 * The read, snooze, mute, archive, and delete buttons, shown on hover and focus. theme.css places them
 * (iui-inbox-controls): over the item's top end on devices that hover, so the text keeps the full width, and below the
 * text on touch screens, where they always show.
 */
export const controlsClass =
    'iui-inbox-controls border-iui-inbox-border z-10 flex shrink-0 items-center gap-0.5 rounded-md opacity-0 group-focus-within/item:opacity-100 group-hover/item:opacity-100 [@media(hover:none)]:opacity-100'

/**
 * The checkbox that selects a notification, in place of its avatar: on hover and keyboard focus, and on every item
 * while some are selected. Until then, a tap on the avatar of a touch screen selects the notification.
 */
export const checkboxOverlayClass =
    'bg-iui-inbox-control-hover absolute inset-0 flex items-center justify-center rounded-full opacity-0 group-hover/item:opacity-100 group-data-[selected=true]/item:opacity-100 in-data-inbox-selecting:opacity-100 has-focus-visible:opacity-100 motion-safe:transition-opacity'

export const checkboxClass = 'accent-iui-inbox-accent size-4 cursor-pointer'

/** The bar at the bottom of the panel with the actions for the selected notifications. */
export const selectionBarClass = 'border-iui-inbox-border flex shrink-0 items-center justify-between gap-3 border-t px-4 py-1.5'

/** Keeps the selection bar of a `NotificationList` at the bottom of the window while the page scrolls. */
export const listSelectionClass = 'bg-iui-inbox-surface sticky bottom-0 z-20'

export const selectAllClass = 'text-iui-inbox-foreground flex items-center gap-2 text-sm font-medium'

export const selectAllCheckboxClass = 'accent-iui-inbox-accent size-4 cursor-pointer'

/** The snooze times of the selection bar, below it. */
export const selectionSnoozeOptionsClass = 'flex shrink-0 flex-wrap gap-2 px-4 pt-1 pb-2'

export const controlClass =
    'text-iui-inbox-icon hover:bg-iui-inbox-control-hover hover:text-iui-inbox-icon-hover focus-visible:ring-iui-inbox-ring rounded-md p-1.5 focus-visible:ring-2 focus-visible:outline-hidden [@media(hover:hover)]:p-1'

export const stateClass = 'text-iui-inbox-muted-foreground flex flex-col items-center gap-3 px-6 py-12 text-center text-sm'

export const stateIconClass = 'text-iui-inbox-icon size-8'

export const loadingMoreClass = 'text-iui-inbox-muted-foreground flex justify-center py-3'

// Notification preferences.

/** The container of the table, which scrolls sideways when the table is wider than the component, such as on phones. */
export const preferencesTableScrollClass = 'overflow-x-auto'

export const preferencesTableClass = 'w-full border-collapse text-sm'

export const preferencesHeadClass = 'text-iui-inbox-muted-foreground px-4 py-2.5 text-start text-xs font-medium'

export const preferencesChannelHeadClass = 'text-iui-inbox-muted-foreground w-20 px-2 py-2.5 text-center text-xs font-medium sm:w-24'

export const preferencesRowClass = 'border-iui-inbox-border border-t'

/** The heading of a group, above its categories. */
export const preferencesGroupClass = 'bg-iui-inbox-control-hover/50 px-4 pt-4 pb-2 text-start font-normal'

export const preferencesGroupLabelClass = 'text-iui-inbox-foreground font-semibold'

/** The label of each category and of the switches of every category, wide enough to read on phones, where the table scrolls sideways. */
export const preferencesCategoryClass = 'min-w-36 px-4 py-3 text-start align-top font-normal'

export const preferencesLabelClass = 'text-iui-inbox-foreground font-medium'

/** The label of a category, with room before its badge, which lines up with the label when it wraps below it. */
export const preferencesCategoryLabelClass = 'text-iui-inbox-foreground me-2 font-medium'

export const preferencesLockedClass =
    'bg-iui-inbox-control-hover text-iui-inbox-muted-foreground inline-block rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap'

export const preferencesDescriptionClass = 'text-iui-inbox-muted-foreground mt-0.5 block'

export const preferencesCellClass = 'px-2 py-3 text-center align-middle'

/** The header of the frequency column, and its cells. */
export const preferencesFrequencyHeadClass = 'text-iui-inbox-muted-foreground w-40 px-4 py-2.5 text-start text-xs font-medium'

export const preferencesFrequencyCellClass = 'px-4 py-3 text-start align-middle'

/** The device control of web push, below the table, with the user's other devices below it. */
export const preferencesPushClass = 'border-iui-inbox-border border-t px-4 py-3 text-sm'

/** The name of each other device and when it was last active, which take the room before its button. */
export const preferencesPushBodyClass = 'min-w-0 grow'

/** The label and text of the device control, and its button, which wraps below them on narrow screens. */
export const preferencesPushHeaderClass = 'flex flex-wrap items-start justify-between gap-x-6 gap-y-3'

export const preferencesPushTextClass = 'min-w-0 grow basis-64'

/** The text of a state that tells why push cannot turn on and what to do, in place of the description. */
export const preferencesPushHintClass = 'bg-iui-inbox-control-hover text-iui-inbox-foreground mt-2 rounded-md px-3 py-2'

/** The button of the device control, sized like the actions of a notification. */
export const preferencesPushButtonClass = 'shrink-0 whitespace-nowrap'

/** The list of the user's other devices below the device control. */
export const preferencesPushDevicesClass = 'mt-4'

export const preferencesPushDevicesHeadingClass = 'text-iui-inbox-muted-foreground text-xs font-medium'

export const preferencesPushDevicesListClass = 'divide-iui-inbox-border border-iui-inbox-border mt-2 divide-y rounded-md border'

/** Each other device: its name and when it was last active, and its remove button at the end. */
export const preferencesPushDeviceClass = 'flex items-center justify-between gap-4 px-3 py-2'

/** The row of the notification hours, below the table, with their switch and a line per day. */
export const preferencesNotificationHoursClass = 'border-iui-inbox-border border-t px-4 py-3 text-sm'

/** The switch of the notification hours, in line with the switch of each day, and their label and description. */
export const preferencesNotificationHoursHeaderClass = 'flex items-start gap-3'

export const preferencesNotificationHoursDaysClass = 'mt-3 flex flex-col gap-3 sm:gap-2'

/** The line of a day: its switch and name, then its ranges, which wrap below the name on narrow screens. */
export const preferencesNotificationHoursDayClass = 'flex flex-wrap items-start gap-x-4 gap-y-2'

export const preferencesNotificationHoursDayNameClass = 'text-iui-inbox-foreground flex h-8 w-36 shrink-0 items-center gap-3 font-medium'

export const preferencesNotificationHoursRangesClass = 'flex min-w-0 grow basis-60 flex-col items-start gap-2'

/** A range of a day: its two time fields and the button that removes it. */
export const preferencesNotificationHoursRangeClass = 'flex flex-wrap items-center gap-x-3 gap-y-2'

/** The text of a day without notification hours, in place of its ranges. */
export const preferencesNotificationHoursOffClass = 'text-iui-inbox-muted-foreground flex h-8 items-center'

/** The buttons that add a range to a day and remove one, whose text lines up with the time fields when it wraps below them. */
export const preferencesNotificationHoursButtonClass =
    'text-iui-inbox-muted-foreground -ms-2 hover:bg-iui-inbox-control-hover hover:text-iui-inbox-foreground focus-visible:ring-iui-inbox-ring rounded-md px-2 py-1 text-xs font-medium focus-visible:ring-2 focus-visible:outline-hidden disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-iui-inbox-muted-foreground'

export const preferencesTimeLabelClass = 'text-iui-inbox-muted-foreground flex items-center gap-2 text-xs font-medium'

/** A time field of the notification hours. */
export const preferencesTimeClass =
    'rounded-iui-inbox border-iui-inbox-border bg-iui-inbox-surface text-iui-inbox-foreground focus-visible:ring-iui-inbox-ring border px-2 py-1 text-sm focus-visible:ring-2 focus-visible:outline-hidden disabled:cursor-default disabled:opacity-50'

/** The frequency menu of a category, which fills its column and is never narrower than its longest option. */
export const preferencesSelectClass =
    'rounded-iui-inbox border-iui-inbox-border bg-iui-inbox-surface text-iui-inbox-foreground focus-visible:ring-iui-inbox-ring min-w-full border px-2 py-1 text-sm focus-visible:ring-2 focus-visible:outline-hidden disabled:cursor-default disabled:opacity-50'

/** A switch; the thumb moves to the end when it is on. */
export const switchClass =
    'group/switch bg-iui-inbox-icon aria-checked:bg-iui-inbox-accent focus-visible:ring-iui-inbox-ring focus-visible:ring-offset-iui-inbox-surface relative inline-flex h-5 w-9 shrink-0 items-center rounded-full focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden aria-disabled:cursor-default aria-disabled:opacity-50 forced-colors:border motion-safe:transition-colors'

export const switchThumbClass =
    'bg-iui-inbox-surface ms-0.5 size-4 rounded-full shadow-sm forced-color-adjust-none group-aria-checked/switch:translate-x-4 forced-colors:bg-[ButtonText] forced-colors:group-aria-checked/switch:bg-[Highlight] motion-safe:transition-transform rtl:group-aria-checked/switch:-translate-x-4'

export const footerClass =
    'border-iui-inbox-border text-iui-inbox-accent hover:bg-iui-inbox-control-hover focus-visible:ring-iui-inbox-ring block border-t px-4 py-2.5 text-center text-sm font-medium focus-visible:ring-2 focus-visible:outline-hidden focus-visible:ring-inset'
