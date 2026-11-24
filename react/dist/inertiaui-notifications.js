import { isValidElement as e, useEffect as t, useId as n, useLayoutEffect as r, useMemo as i, useRef as a, useState as o, useSyncExternalStore as s } from "react";
import { createPortal as c } from "react-dom";
import { extendTailwindMerge as l } from "tailwind-merge";
import { animate as u, autoUpdateTopLayerPopover as d, cancelAnimations as f, createAnnouncer as p, createPopoverController as m, createTooltipController as h, isRightToLeft as g, positionTopLayerPopover as _, prefersReducedMotion as v, replacePlaceholders as y } from "@inertiaui/vanilla";
import { InfiniteScroll as b, Link as x, http as S, router as C, socketId as w, usePage as T } from "@inertiajs/react";
import { Fragment as E, jsx as D, jsxs as O } from "react/jsx-runtime";
// ../js/types.ts
var k = [
	"top-left",
	"top-center",
	"top-right",
	"bottom-left",
	"bottom-center",
	"bottom-right"
], A = [
	"get",
	"post",
	"put",
	"patch",
	"delete"
], j = "inertiaui", M = "x-inertiaui-toasts", N = (e) => typeof e == "object" && !!e && !Array.isArray(e), P = (e) => typeof e == "string" ? e : null, F = (e) => typeof e == "string" && /^[a-z][a-z\d-]*$/.test(e), I = (e) => N(e) && typeof e.uuid == "string" && typeof e.title == "string" && (e.type === void 0 || F(e.type));
function L(e) {
	if (typeof e != "string") return;
	let t = /^([a-z][a-z\d+.-]*):/i.exec(e.replace(/[\u0000-\u0020]/g, ""))?.[1]?.toLowerCase();
	return t === void 0 || t === "http" || t === "https" || t === "mailto" || t === "tel" ? e : void 0;
}
function R(e) {
	return Array.isArray(e) ? e.flatMap((e) => {
		if (!N(e) || typeof e.label != "string") return [];
		let t = L(e.href);
		return t === void 0 && typeof e.event != "string" ? [] : [{
			label: e.label,
			href: t,
			method: A.includes(e.method) ? e.method : void 0,
			data: N(e.data) ? e.data : void 0,
			visit: N(e.visit) ? e.visit : void 0,
			external: e.external === !0 || void 0,
			newTab: e.newTab === !0 || void 0,
			event: typeof e.event == "string" ? e.event : void 0,
			payload: e.payload,
			keepOpen: e.keepOpen === !0 || void 0,
			altText: typeof e.altText == "string" ? e.altText : void 0,
			result: typeof e.result == "string" ? e.result : void 0
		}];
	}) : [];
}
var z = (e) => ({
	id: typeof e.id == "string" ? e.id : void 0,
	type: e.type,
	description: typeof e.description == "string" ? e.description : void 0,
	duration: typeof e.duration == "number" || e.duration === null ? e.duration : void 0,
	actions: R(e.actions),
	icon: typeof e.icon == "string" || e.icon === !1 ? e.icon : void 0,
	image: L(e.image),
	dismissible: typeof e.dismissible == "boolean" ? e.dismissible : void 0,
	position: k.includes(e.position) ? e.position : void 0,
	toaster: typeof e.toaster == "string" ? e.toaster : void 0,
	data: N(e.data) ? e.data : void 0,
	progress: typeof e.progress == "number" ? e.progress : void 0
});
function B(e) {
	let t = /* @__PURE__ */ new Set();
	return (n) => {
		if (Array.isArray(n)) for (let r of n) I(r) && (t.has(r.uuid) || (t.add(r.uuid), e(r.title, z(r))));
	};
}
function ee(e, t) {
	let n = e?.[t];
	return N(n) ? n.toasts : void 0;
}
function V(e) {
	let t = e[M];
	if (t) try {
		return JSON.parse(t);
	} catch {
		return;
	}
}
function te(e) {
	if (e.headers["x-inertia"] === "true" && (typeof e.data != "string" || e.data.includes("\"flash\":"))) try {
		let t = (typeof e.data == "string" ? JSON.parse(e.data) : e.data)?.flash;
		return N(t) ? t : void 0;
	} catch {
		return;
	}
}
// ../js/actions.ts
function H(e) {
	let t = L(e.href);
	return t !== void 0 && (e.method ?? "get") === "get" ? t : void 0;
}
function ne(e) {
	try {
		return new URL(e, window.location.href).origin === window.location.origin;
	} catch {
		return !1;
	}
}
function U(e) {
	let t = new URL(window.location.href), n = new URL(e.url, t);
	for (let e of [t, n]) e.hash = "", e.searchParams.sort();
	return n.href === t.href;
}
function re(e) {
	return e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
}
function ie(e) {
	let t = e.target;
	return typeof t?.closest == "function" && t.closest("a[href]") !== null;
}
function ae(e, t, n) {
	return !e.onClick && ie(n) && (re(n) || e.external || e.newTab || !ne(t));
}
var oe = 1500;
function se(e, t) {
	let n, r = () => {
		n !== void 0 && (clearTimeout(n), n = void 0, window.location.assign(t));
	};
	n = setTimeout(r, oe), e.then(r, r);
}
function W(e, t, n, r, i) {
	r();
	let a = i?.();
	a && !re(n) && !t.newTab && (n.preventDefault(), se(a, e));
}
var ce = (e) => typeof e?.then == "function";
function le(e, t, n, r, i) {
	e.event && window.dispatchEvent(new CustomEvent(e.event, { detail: e.payload }));
	let a = e.onClick?.(t);
	if (ce(a)) return a.then(() => {
		i?.(), r(!0);
	}, () => r(!1)), "pending";
	let o = L(e.href);
	if (o === void 0) return i?.(), "done";
	let s = e.method ?? "get";
	if (s === "get" && (e.external || e.newTab || !n || !ne(o))) {
		if (e.newTab) window.open(o, "_blank", "noopener"), i?.();
		else {
			let e = i?.();
			e ? se(e, o) : window.location.assign(o);
		}
		return "done";
	}
	if (!n) return "failed";
	let c = !1;
	return n.visit(o, {
		method: s,
		data: e.data,
		...s === "get" ? {} : {
			preserveState: U,
			preserveScroll: U
		},
		...e.visit,
		onSuccess: () => void (c = !0),
		onFinish: () => {
			c && i?.(), r(c);
		}
	}), "pending";
}
// ../js/cn.ts
var ue = l({ extend: { theme: { radius: ["iui-toast", "iui-inbox"] } } });
function G(...e) {
	return ue(e.filter(Boolean).join(" "));
}
// ../js/icons.ts
var K = (e, t) => Object.hasOwn(e, t) ? e[t] : void 0, de = {
	success: "M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z",
	info: "M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z",
	warning: "M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
	error: "M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z"
}, q = "M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z", fe = "M10 3a7 7 0 0 1 7 7", pe = ["M10 2a6 6 0 0 0-6 6c0 1.887-.454 3.665-1.257 5.234a.75.75 0 0 0 .515 1.076 32.91 32.91 0 0 0 3.256.508 3.5 3.5 0 0 0 6.972 0 32.903 32.903 0 0 0 3.256-.508.75.75 0 0 0 .515-1.076A11.448 11.448 0 0 1 16 8a6 6 0 0 0-6-6ZM8.05 14.943a33.54 33.54 0 0 0 3.9 0 2 2 0 0 1-3.9 0Z"], me = ["M4 8c0-.26.017-.517.049-.77l7.722 7.723a33.56 33.56 0 0 1-3.722-.01 2 2 0 0 0 3.862.15l1.134 1.134a3.5 3.5 0 0 1-6.53-1.409 32.91 32.91 0 0 1-3.257-.508.75.75 0 0 1-.515-1.076A11.448 11.448 0 0 0 4 8ZM17.266 13.9a.756.756 0 0 1-.068.116L6.389 3.207A6 6 0 0 1 16 8c.001 1.887.455 3.665 1.258 5.234a.75.75 0 0 1 .01.666ZM3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06L3.28 2.22Z"], he = ["M1 11.27c0-.246.033-.492.099-.73l1.523-5.521A2.75 2.75 0 0 1 5.273 3h9.454a2.75 2.75 0 0 1 2.651 2.019l1.523 5.52c.066.239.099.485.099.732V15a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-3.73Zm3.068-5.852A1.25 1.25 0 0 1 5.273 4.5h9.454a1.25 1.25 0 0 1 1.205.918l1.523 5.52c.006.02.01.041.015.062H14a1 1 0 0 0-.86.49l-.606 1.02a1 1 0 0 1-.86.49H8.236a1 1 0 0 1-.894-.553l-.448-.894A1 1 0 0 0 6 11H2.53l.015-.062 1.523-5.52Z"], ge = {
	dismiss: [q],
	bell: pe,
	notification: pe,
	read: ["M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"],
	unread: ["M3 4a2 2 0 0 0-2 2v1.161l8.441 4.221a1.25 1.25 0 0 0 1.118 0L19 7.162V6a2 2 0 0 0-2-2H3Z", "m19 8.839-7.77 3.885a2.75 2.75 0 0 1-2.46 0L1 8.839V14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.839Z"],
	archive: ["M2 3a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H2Z", "M2 7.5h16l-.811 7.71a2 2 0 0 1-1.99 1.79H4.802a2 2 0 0 1-1.99-1.79L2 7.5ZM7 11a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1Z"],
	unarchive: he,
	snooze: ["M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z"],
	unsnooze: he,
	mute: me,
	unmute: pe,
	pause: ["M2 10a8 8 0 1 1 16 0 8 8 0 0 1-16 0Zm5-2.25A.75.75 0 0 1 7.75 7h.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1-.75-.75v-4.5Zm4 0a.75.75 0 0 1 .75-.75h.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1-.75-.75v-4.5Z"],
	paused: me,
	more: ["M3 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM8.5 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM15.5 8.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"],
	delete: ["M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"],
	empty: he,
	result: ["M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"],
	announcement: ["M13.92 3.845a19.362 19.362 0 0 1-6.3 1.98C6.765 5.942 5.89 6 5 6a4 4 0 0 0-.504 7.969 15.97 15.97 0 0 0 1.271 3.34c.397.771 1.342 1 2.05.59l.867-.5c.726-.419.94-1.32.588-2.02-.166-.331-.315-.666-.448-1.004 1.8.357 3.511.963 5.096 1.78A17.964 17.964 0 0 0 15 10c0-2.162-.381-4.235-1.08-6.155ZM15.243 3.097A19.456 19.456 0 0 1 16.5 10c0 2.43-.445 4.758-1.257 6.904l-.03.077a.75.75 0 0 0 1.401.537 20.903 20.903 0 0 0 1.312-5.745 2 2 0 0 0 0-3.546 20.902 20.902 0 0 0-1.312-5.745.75.75 0 0 0-1.4.537l.029.078Z"]
}, J = null;
function _e(e) {
	J = e;
}
function ve(e, t = {}) {
	return J?.(e, t) ?? null;
}
function ye(e, t, n = {}, r) {
	let i = K(n, e) ?? (r ? r(e, t) : ve(e, t));
	return i == null || i === !1 ? void 0 : i;
}
// ../js/translations.ts
var be = {
	toaster_label: "Notifications",
	toaster_label_with_hotkey: ":label (:hotkey)",
	toaster_hotkey_alt: "Alt",
	toaster_hotkey_ctrl: "Ctrl",
	toaster_hotkey_meta: "Meta",
	toaster_hotkey_shift: "Shift",
	toaster_hotkey_separator: "+",
	toast_dismiss: "Dismiss: :title",
	toast_count: "×:count",
	toast_type_default: "",
	toast_type_success: "Success",
	toast_type_info: "Info",
	toast_type_warning: "Warning",
	toast_type_error: "Error",
	toast_type_loading: "",
	error_toast_403: "This action is unauthorized.",
	error_toast_419: "This page has expired.",
	error_toast_419_description: "Refresh the page and try again.",
	error_toast_429: "Too many requests.",
	error_toast_429_description: "Wait a moment and try again.",
	error_toast_5xx: "Something went wrong.",
	error_toast_5xx_description: "Try again later.",
	error_toast_network: "You appear to be offline.",
	error_toast_network_description: "Check your connection and try again.",
	inbox_title: "Notifications",
	inbox_bell: "Notifications",
	inbox_bell_new: "Notifications, :count new",
	inbox_bell_paused: ":label, paused",
	inbox_all: "All",
	inbox_unread: "Unread",
	inbox_archived: "Archived",
	inbox_snoozed: "Snoozed",
	inbox_mark_all_as_read: "Mark all as read",
	inbox_archive_all: "Archive all",
	inbox_more_actions: "More actions",
	inbox_item_control: ":action: :title",
	inbox_mark_as_read: "Mark as read",
	inbox_mark_as_unread: "Mark as unread",
	inbox_archive: "Archive",
	inbox_unarchive: "Move to inbox",
	inbox_snooze: "Snooze",
	inbox_unsnooze: "Unsnooze",
	inbox_mute: "Mute thread",
	inbox_unmute: "Unmute thread",
	inbox_muted: "Thread muted",
	inbox_delete: "Delete",
	inbox_select: "Select: :title",
	inbox_select_all: "Select all",
	inbox_selected: ":count selected",
	inbox_selection: "Selected notifications",
	inbox_read_selected: "Mark selected as read",
	inbox_unread_selected: "Mark selected as unread",
	inbox_snooze_selected: "Snooze selected",
	inbox_unsnooze_selected: "Unsnooze selected",
	inbox_archive_selected: "Archive selected",
	inbox_unarchive_selected: "Move selected to inbox",
	inbox_delete_selected: "Delete selected",
	inbox_clear_selection: "Clear selection",
	inbox_show_new: ":count new",
	inbox_snooze_until: "Snooze until",
	inbox_snoozed_until: "Snoozed until :time",
	inbox_snooze_later_today: "Later today",
	inbox_snooze_tomorrow: "Tomorrow",
	inbox_snooze_next_week: "Next week",
	inbox_pause: "Pause notifications",
	inbox_pause_for: "For :duration",
	inbox_pause_tomorrow: "Until tomorrow",
	inbox_paused_until: "Notifications paused until :time",
	inbox_resume: "Resume",
	inbox_show_more: "Show :count more",
	inbox_show_less: "Show less",
	inbox_unread_state: "Unread",
	inbox_actors_and_other: ":name and :other",
	inbox_actors_and_others: ":name and :count others",
	inbox_empty: "You have no notifications.",
	inbox_empty_unread: "You have no unread notifications.",
	inbox_empty_archived: "You have no archived notifications.",
	inbox_empty_snoozed: "You have no snoozed notifications.",
	inbox_error: "The notifications could not be loaded.",
	inbox_retry: "Try again",
	inbox_categories: "Categories",
	inbox_all_categories: "All categories",
	inbox_loading: "Loading notifications…",
	inbox_load_more: "Load more",
	inbox_view_all: "View all notifications",
	inbox_update_failed: "The notification could not be updated.",
	inbox_toast_view: "View",
	inbox_toast_view_alt: "Also in your notifications.",
	inbox_title_count: "(:count) :title",
	inbox_announcement: "Announcement",
	preferences_title: "Notification preferences",
	preferences_category: "Category",
	preferences_toggle: ":category: :channel",
	preferences_locked: "Always on",
	preferences_global: "All notifications",
	preferences_global_description: "Turn a channel off for every category, except those that are always on.",
	preferences_frequency: "Frequency",
	preferences_frequency_label: ":category: frequency",
	preferences_frequency_instant: "Instantly",
	preferences_frequency_hourly: "Hourly digest",
	preferences_frequency_daily: "Daily digest",
	preferences_frequency_weekly: "Weekly digest",
	preferences_push_device: "Push notifications on this device",
	preferences_push_off: "Off. Turn them on to get notifications on this device, even when the app is closed.",
	preferences_push_on: "On. This device gets the categories you chose for push notifications.",
	preferences_push_turn_on: "Turn on for this device",
	preferences_push_turn_off: "Turn off",
	preferences_push_turning_on: "Turning on…",
	preferences_push_turning_off: "Turning off…",
	preferences_push_blocked: "Notifications are blocked for this site. Allow them in your browser's site settings to turn on push notifications.",
	preferences_push_home_screen: "On iPhone and iPad, push notifications only work from the Home Screen. Tap Share, choose Add to Home Screen, and open the app from there.",
	preferences_push_insecure: "Push notifications need a secure connection. Open this site over HTTPS to turn them on.",
	preferences_push_brave: "Brave blocks push notifications until you turn on \"Use Google services for push messaging\" in its privacy settings. Turn it on, then try again.",
	preferences_push_failed: "Push notifications could not be turned on for this device.",
	preferences_push_failed_off: "Push notifications could not be turned off for this device.",
	preferences_push_retry: "Try again",
	preferences_push_devices: "Other devices with push notifications",
	preferences_push_device_name: ":browser on :platform",
	preferences_push_device_unknown: "Unknown browser",
	preferences_push_device_active: "Active :time",
	preferences_push_device_remove: "Remove",
	preferences_push_device_remove_label: "Remove :device",
	preferences_notification_hours: "Notification hours",
	preferences_notification_hours_description: "Outside these hours, emails wait and notifications arrive without a toast or a sound. Categories that are always on still send.",
	preferences_notification_hours_start: "From",
	preferences_notification_hours_end: "Until",
	preferences_notification_hours_day: "Notification hours on :day",
	preferences_notification_hours_off: "Notifications wait all day",
	preferences_notification_hours_add: "Add hours",
	preferences_notification_hours_add_label: "Add hours on :day",
	preferences_notification_hours_remove: "Remove",
	preferences_notification_hours_remove_label: "Remove :start to :end on :day",
	preferences_empty: "There are no notification preferences.",
	preferences_loading: "Loading preferences…",
	preferences_error: "The preferences could not be loaded.",
	preferences_retry: "Try again",
	preferences_save_failed: "Your preferences could not be saved.",
	preferences_push_device_remove_failed: "The device could not be removed."
}, xe = Object.assign(Object.create(null), be);
function Se(e) {
	for (let [t, n] of Object.entries(e)) n !== void 0 && (xe[t] = n);
}
var Ce = (e) => Object.hasOwn(xe, e) ? xe[e] : void 0;
function we(e, t = {}) {
	return typeof e == "function" ? e(t) : y(e, t);
}
function Te(e, t = {}) {
	let n = Ce(e);
	return n === void 0 ? e : we(n, t);
}
var Ee = (e, t) => e + t.replace(/[A-Z]/g, (e) => `_${e.toLowerCase()}`);
function De(e, t) {
	return Object.fromEntries(t.map((t) => [t, be[Ee(e, t)]]));
}
function Oe(e, t, n) {
	let r = (e) => n && Object.hasOwn(n, e) ? n[e] : void 0;
	return Object.fromEntries(t.map((t) => [t, r(t) ?? Ce(Ee(e, t)) ?? Ee(e, t)]));
}
// ../js/inbox.ts
var ke = [
	"read",
	"unread",
	"seen",
	"archive",
	"unarchive",
	"snooze",
	"unsnooze",
	"delete"
], Ae = [
	"snooze",
	"archive",
	"mute",
	"delete"
], je = [
	"snooze",
	"archive",
	"mute"
], Me = {
	archive: "archive",
	unarchive: "archive",
	snooze: "snooze",
	unsnooze: "snooze",
	delete: "delete"
}, Ne = (e, t) => (e !== "snoozed" || t.includes("snooze")) && (e !== "archived" || t.includes("archive")), Pe = 100, Fe = "inertiauiInbox", Y = (e) => e ? Date.parse(e) : NaN, Ie = ({ counts: e, category: t, categoryCounts: n }) => t === null ? e.unread : n[t] ?? 0, Le = (e) => e.expiresAt !== null && Y(e.expiresAt) <= Date.now(), Re = (e, t = Date.now()) => e.snoozedUntil !== null && Y(e.snoozedUntil) > t, ze = (e, t, n) => {
	if (t === null || n === 0) return e;
	let { [t]: r = 0, ...i } = e, a = Math.max(0, r + n);
	return a === 0 ? i : {
		...i,
		[t]: a
	};
}, Be = (e, t) => Y(e.createdAt) > Y(t.createdAt) || Y(e.createdAt) === Y(t.createdAt) && e.total > t.total, Ve = (e, t) => {
	let n = new Map(t.map((e) => [e.id, e])), r = e.filter((e) => {
		let t = n.get(e.id);
		return t === void 0 || Be(e, t);
	}), i = new Set(r.map((e) => e.id));
	return [...r, ...t.filter((e) => !i.has(e.id))];
}, He = (e, { latest: t, latestIds: n }) => t !== null && (Y(e.createdAt) < Y(t) || Y(e.createdAt) === Y(t) && n.includes(e.id)), Ue = (e) => N(e) ? {
	name: P(e.name) ?? void 0,
	avatar: L(e.avatar)
} : null;
function We(e) {
	if (!N(e) || typeof e.id != "string" || typeof e.title != "string" || typeof e.createdAt != "string") return;
	let t = Ue(e.actor), n = (Array.isArray(e.actors) ? e.actors.map(Ue) : [t]).filter((e) => e !== null);
	return {
		id: e.id,
		type: P(e.type) ?? "",
		title: e.title,
		body: P(e.body),
		icon: P(e.icon),
		image: L(e.image) ?? null,
		url: L(e.url) ?? null,
		actions: R(e.actions),
		actor: t,
		actors: n,
		actorCount: typeof e.actorCount == "number" ? e.actorCount : n.length,
		total: typeof e.total == "number" ? e.total : 1,
		category: P(e.category),
		group: P(e.group),
		toast: F(e.toast) ? e.toast : null,
		data: N(e.data) ? e.data : {},
		readAt: P(e.readAt),
		seenAt: P(e.seenAt),
		archivedAt: P(e.archivedAt),
		snoozedUntil: P(e.snoozedUntil),
		result: P(e.result),
		muted: e.muted === !0,
		...e.quiet === !0 ? { quiet: !0 } : {},
		createdAt: e.createdAt,
		revision: typeof e.revision == "number" ? e.revision : null,
		announcement: e.announcement === !0,
		expiresAt: P(e.expiresAt)
	};
}
var Ge = (e) => Array.isArray(e) ? {} : N(e) ? Object.fromEntries(Object.entries(e).filter((e) => typeof e[1] == "number")) : void 0, Ke = (e) => {
	let t = N(e) ? Ge(e.categories) : void 0;
	return N(e) && typeof e.unread == "number" && typeof e.unseen == "number" && typeof e.revision == "number" && (e.latest === null || typeof e.latest == "string") && Array.isArray(e.latestIds) && t !== void 0 ? {
		unread: e.unread,
		unseen: e.unseen,
		categories: t,
		revision: e.revision,
		counted: {
			latest: e.latest,
			latestIds: e.latestIds.filter((e) => typeof e == "string")
		},
		context: P(e.context)
	} : void 0;
}, qe = (e) => N(e) ? Object.fromEntries(Object.entries(e).filter((e) => typeof e[1] == "string")) : {}, Je = (e) => Array.isArray(e) ? e.filter((e) => e === "tomorrow" || typeof e == "number" && Number.isInteger(e) && e > 0) : dt, Ye = (e) => N(e) ? Object.fromEntries(Object.entries(e).filter((e) => N(e[1])).map(([e, t]) => [e, {
	label: P(t.label) ?? e,
	category: P(t.category),
	data: N(t.data) ? Object.fromEntries(Object.entries(t.data).filter((e) => [
		"string",
		"number",
		"boolean"
	].includes(typeof e[1]))) : {}
}])) : {}, Xe = (e, t) => t !== void 0 && (t.category === null || e.category === t.category) && Object.entries(t.data).every(([t, n]) => e.data[t] === n);
function Ze(e) {
	if (!N(e)) return;
	if (e.kind === "item") return typeof e.id == "string" ? {
		kind: "item",
		id: e.id,
		readAt: P(e.readAt),
		seenAt: P(e.seenAt),
		archivedAt: P(e.archivedAt),
		snoozedUntil: P(e.snoozedUntil),
		result: P(e.result)
	} : void 0;
	if (e.kind === "delete") return Array.isArray(e.ids) ? {
		kind: "delete",
		ids: e.ids.filter((e) => typeof e == "string")
	} : void 0;
	if (e.kind === "update") {
		let t = We(e.item);
		return t === void 0 ? void 0 : {
			kind: "update",
			item: t
		};
	}
	if (e.kind === "mute") return typeof e.group == "string" ? {
		kind: "mute",
		group: e.group,
		muted: e.muted === !0
	} : void 0;
	if (e.kind === "pause") return e.until === null || typeof e.until == "string" ? {
		kind: "pause",
		until: e.until
	} : void 0;
	if (e.kind === "items") {
		let t = ke.find((t) => t === e.action);
		if (t === void 0 || t === "delete" || !Array.isArray(e.ids) || typeof e.at != "string" || t === "snooze" && typeof e.until != "string") return;
		let n = e.ids.filter((e) => typeof e == "string");
		return t === "snooze" ? {
			kind: "items",
			action: t,
			ids: n,
			at: e.at,
			until: e.until
		} : {
			kind: "items",
			action: t,
			ids: n,
			at: e.at
		};
	}
	if (typeof e.before != "string" || Number.isNaN(Y(e.before))) return;
	let t = Array.isArray(e.ids) ? e.ids.filter((e) => typeof e == "string") : null, n = P(e.category);
	return e.kind === "archive" ? {
		kind: "archive",
		before: e.before,
		ids: t,
		category: n,
		onlyRead: e.onlyRead === !0
	} : e.kind === "read" || e.kind === "seen" ? {
		kind: e.kind,
		before: e.before,
		ids: t,
		category: n
	} : void 0;
}
var Qe = (e, t) => t.split(".").reduce((e, t) => N(e) ? e[t] : void 0, e), $e = () => ({
	unread: 0,
	unseen: 0,
	categories: {}
}), et = 2147483647, tt = (e, { before: t, ids: n, category: r }) => {
	if (r !== null && e.category !== r) return !1;
	let i = Y(e.createdAt);
	return i < Y(t) || i === Y(t) && (n === null || n.includes(e.id));
}, nt = (e, t, n) => tt(e, t) ? t.kind === "archive" ? e.archivedAt === null && (!t.onlyRead || e.readAt !== null) ? {
	...e,
	archivedAt: n
} : e : t.kind === "seen" ? e.seenAt === null ? {
	...e,
	seenAt: n
} : e : e.readAt === null && e.archivedAt === null && !Re(e) ? {
	...e,
	readAt: n,
	seenAt: e.seenAt ?? n
} : e : e, rt = (e, { action: t, ids: n, at: r, until: i }) => n.includes(e.id) ? t === "read" ? e.readAt === null ? {
	...e,
	readAt: r,
	seenAt: e.seenAt ?? r
} : e : t === "unread" ? e.readAt === null ? e : {
	...e,
	readAt: null
} : t === "seen" ? e.seenAt === null ? {
	...e,
	seenAt: r
} : e : t === "archive" ? e.archivedAt === null ? {
	...e,
	archivedAt: r
} : e : t === "unarchive" ? e.archivedAt === null ? e : {
	...e,
	archivedAt: null
} : t === "snooze" ? i === void 0 ? e : {
	...e,
	snoozedUntil: i
} : t === "unsnooze" ? e.snoozedUntil === null ? e : {
	...e,
	snoozedUntil: null
} : e : e, it = (e, t, n) => t.kind === "items" ? rt(e, t) : nt(e, t, n), at = ({ readAt: e, seenAt: t, archivedAt: n, snoozedUntil: r, result: i }) => ({
	readAt: e,
	seenAt: t,
	archivedAt: n,
	snoozedUntil: r,
	result: i
});
function ot() {
	let e, t = Fe, n, r = 0, i, a, o = null, s = null, c = je, l = !0, u = {}, d = dt, f = {}, p = null, m, h, g = {
		unread: 0,
		unseen: 0
	}, _ = {}, v = [], y = [], b = "all", x = null, S = "idle", C = !1, w = !1, T = null, E = 0, D, O = {}, k = 0, A = 0, j = /* @__PURE__ */ new Set(), M = /* @__PURE__ */ new Map(), F = [], I = [], R = /* @__PURE__ */ new Set(), z = /* @__PURE__ */ new Set(), B = /* @__PURE__ */ new Map(), ee = /* @__PURE__ */ new Map(), V = !1, te = {
		until: null,
		revision: -Infinity
	}, U = null, ie, oe = null, se = /* @__PURE__ */ new Set(), ce = /* @__PURE__ */ new Set(), ue = /* @__PURE__ */ new Set(), G = /* @__PURE__ */ new Set(), K, de = (e, t, n) => {
		let r = M.get(e);
		(!r || n > r.revision) && M.set(e, {
			state: t,
			revision: n
		});
	}, q = (e) => {
		let t = B.get(e.id), n = e.revision ?? -Infinity, r = e;
		t !== void 0 && (t.revision ?? -Infinity) > n && (r = t, n = t.revision ?? n);
		let i = r.group === null ? void 0 : ee.get(r.group);
		i !== void 0 && i.revision > n && (r = {
			...r,
			muted: i.muted
		});
		let a = M.get(e.id);
		a && a.revision > n && (r = {
			...r,
			...a.state
		}, n = a.revision);
		for (let e of F) e.revision > n && (r = it(r, e.change, e.at));
		for (let t of I) t.kind === "bulk" ? r = it(r, t.change, t.at) : t.kind === "mute" && t.group === r.group ? r = {
			...r,
			muted: t.muted
		} : t.kind === "item" && t.id === e.id && (t.createdAt === null || Y(e.createdAt) <= Y(t.createdAt)) && (r = {
			...r,
			...t.state
		});
		return r;
	}, fe = (e) => z.has(e) || I.some((t) => t.kind === "delete" && t.ids.includes(e)), pe = (e, t, n = null) => fe(e.id) || Le(e) || n !== null && e.category !== n ? !1 : t === "archived" || e.archivedAt !== null ? t === "archived" && e.archivedAt !== null : Re(e) === (t === "snoozed") ? t === "unread" ? e.readAt === null || R.has(e.id) : t === "all" || t === "snoozed" || Xe(e, Object.hasOwn(f, t) ? f[t] : void 0) : !1, me = () => {
		let e = I.reduce((e, t) => t.kind === "pause" ? t.until : e, void 0), t = e === void 0 ? te.until : e;
		return V && t !== null && Y(t) > Date.now() ? t : null;
	}, he = (e) => {
		e !== oe && (clearTimeout(ie), ie = void 0, oe = e, e !== null && (ie = setTimeout(() => {
			oe = null, me() === null ? J() : he(e);
		}, Math.min(Y(e) - Date.now(), et))));
	}, ge = (e, t) => {
		t > te.revision && (te = {
			until: e,
			revision: t
		});
	}, J = () => {
		let e = me();
		he(e), K = {
			url: a,
			user: i,
			channel: o,
			announcementsChannel: s,
			allowedActions: c,
			selectable: l,
			categoryFilter: u,
			tabs: f,
			counts: g,
			items: Ve(y, v).map(q).filter((e) => pe(e, b, x)),
			arrived: y,
			filter: b,
			category: x,
			categoryCounts: _,
			status: S,
			loadingMore: C,
			moreFailed: w,
			hasMore: T !== null,
			pendingActions: O,
			pausedUntil: e,
			canPause: V,
			pausePresets: d
		}, se.forEach((e) => e());
	};
	J();
	let _e = K, ve = (e) => {
		for (let t of e) {
			let e = Y(t.createdAt);
			D === void 0 || e > Y(D.at) ? D = {
				at: t.createdAt,
				ids: /* @__PURE__ */ new Set([t.id])
			} : e === Y(D.at) && D.ids.add(t.id), t.revision !== null && de(t.id, at(t), t.revision);
		}
	}, ye = () => (/* @__PURE__ */ new Date()).toISOString(), be = () => h !== void 0 && h.counted.latest !== null && (D === void 0 || Y(h.counted.latest) > Y(D.at)), xe = (e) => e.archivedAt === null && !Re(e), Se = (e) => xe(e) ? {
		unread: +(e.readAt === null),
		unseen: +(e.seenAt === null)
	} : {
		unread: 0,
		unseen: 0
	}, Ce = (e) => {
		let { unread: t, unseen: n } = Se(e);
		g = {
			unread: g.unread + t,
			unseen: g.unseen + n
		}, _ = ze(_, e.category, t);
	}, we = (e) => h === void 0 || !He(e, h.counted), Te = () => {
		if (!(h === void 0 || I.length > 0)) {
			g = {
				unread: h.unread,
				unseen: h.unseen
			}, _ = h.categories;
			for (let e of y) we(e) && Ce(q(e));
		}
	}, Ee = (e) => {
		let t = Ke(N(e) ? e.counts : void 0);
		!t || t.context !== p || h !== void 0 && t.revision < h.revision || (h = t, Te());
	}, De = ({ unread: e, unseen: t, categories: n }, r) => {
		g = {
			unread: Math.max(0, g.unread + r * e),
			unseen: Math.max(0, g.unseen + r * t)
		}, _ = Object.entries(n).reduce((e, [t, n]) => ze(e, t, r * n), _);
	}, Oe = (e, t) => {
		if (e.kind === "item") {
			let { kind: n, id: r, ...i } = e;
			de(r, i, t);
		} else if (e.kind === "delete") ke(e.ids);
		else if (e.kind === "update") {
			let n = {
				...e.item,
				revision: e.item.revision ?? t
			}, r = B.get(n.id);
			(r === void 0 || (r.revision ?? 0) < n.revision) && B.set(n.id, n), de(n.id, at(n), n.revision);
		} else if (e.kind === "mute") {
			let n = ee.get(e.group);
			(n === void 0 || n.revision < t) && ee.set(e.group, {
				muted: e.muted,
				revision: t
			});
		} else e.kind === "pause" ? ge(e.until, t) : F = [...F, {
			change: e,
			at: ye(),
			revision: t
		}];
	}, ke = (e) => {
		e.forEach((e) => z.add(e)), y = y.filter((e) => !z.has(e.id)), v = v.filter((e) => !z.has(e.id));
	}, Ie = () => {
		r++, E++, i = void 0, a = void 0, o = null, s = null, c = je, l = !0, u = {}, d = dt, f = {}, p = null, m = void 0, h = void 0, g = {
			unread: 0,
			unseen: 0
		}, _ = {}, v = [], y = [], b = "all", x = null, S = "idle", C = !1, w = !1, T = null, D = void 0, O = {}, M.clear(), F = [], I = [], R.clear(), z.clear(), B.clear(), ee.clear(), V = !1, te = {
			until: null,
			revision: -Infinity
		}, U = null;
	}, Ue = async (t) => {
		let n = new URLSearchParams({ filter: b });
		x !== null && n.set("category", x), t && n.set("cursor", t);
		let r = await e.request("get", `${a}?${n.toString()}`);
		return {
			items: N(r) && Array.isArray(r.items) ? r.items.map(We).filter((e) => e !== void 0) : [],
			cursor: N(r) && typeof r.nextCursor == "string" ? r.nextCursor : null,
			body: r
		};
	}, Ge = async (t, i, o) => {
		if (!e || a === void 0) return;
		let s = r;
		I = [...I, t], De(t.delta, 1), J();
		try {
			let n = await e.request("post", `${a}/${i}`, o);
			if (s !== r) return;
			let c = N(n) ? n : {}, l = Ze(c.change), u = Ke(c.counts)?.revision;
			if (!l || u === void 0) throw Error("The inbox endpoint answered without the change and the counts.");
			I = I.filter((e) => e !== t), Oe(l, u), Ee(c), G.forEach((e) => e({
				change: l,
				counts: c.counts
			}));
		} catch (e) {
			if (s !== r) return;
			I = I.filter((e) => e !== t), De(t.delta, -1), n?.(e);
		}
		Te(), J();
	}, tt = (e) => e.reduce((e, { before: t, after: n }) => {
		let r = Se(t), i = n === void 0 ? {
			unread: 0,
			unseen: 0
		} : Se(n), a = i.unread - r.unread;
		return {
			unread: e.unread + a,
			unseen: e.unseen + i.unseen - r.unseen,
			categories: t.category === null || a === 0 ? e.categories : ze(e.categories, t.category, a)
		};
	}, $e()), nt = (e, t, n) => {
		let r = t.map((e) => e.id);
		if (e === "delete") return Ge({
			kind: "delete",
			ids: r,
			delta: tt(t.map((e) => ({
				before: e,
				after: void 0
			})))
		}, "batch", {
			action: e,
			ids: r
		});
		let i = {
			kind: "items",
			action: e,
			ids: r,
			at: ye(),
			...n === void 0 ? {} : { until: n }
		}, a = tt(t.map((e) => ({
			before: e,
			after: rt(e, i)
		})));
		return e === "seen" ? Ge({
			kind: "bulk",
			change: i,
			at: i.at,
			delta: a
		}, "seen/items", { ids: r }) : Ge({
			kind: "bulk",
			change: i,
			at: i.at,
			delta: a
		}, "batch", {
			action: e,
			ids: r,
			...n === void 0 ? {} : { until: n }
		});
	}, ot = (e, t, n, r) => {
		let i = Se(e), a = Se({
			...e,
			...t
		}), o = a.unread - i.unread;
		return Ge({
			kind: "item",
			id: e.id,
			state: t,
			createdAt: e.createdAt,
			delta: {
				unread: o,
				unseen: a.unseen - i.unseen,
				categories: e.category === null ? {} : { [e.category]: o }
			}
		}, `${encodeURIComponent(e.id)}/${n}`, r);
	}, st = (e, t, n) => Ge({
		kind: "mute",
		group: t,
		muted: n,
		delta: $e()
	}, `${encodeURIComponent(e.id)}/${n ? "mute" : "unmute"}`), ct = (e, t, n, r, i) => {
		let a = D ? {
			before: D.at,
			ids: [...D.ids]
		} : {
			before: ye(),
			ids: null
		}, o = {
			...D ? a : {},
			...t === null ? {} : { category: t },
			...i
		};
		return Ge({
			kind: "bulk",
			change: {
				...e,
				...a,
				category: t
			},
			at: ye(),
			delta: n
		}, r, Object.keys(o).length > 0 ? o : void 0);
	}, lt = (e, t = null) => {
		if (t !== null) {
			let n = e ? _[t] ?? 0 : 0;
			return {
				unread: -n,
				unseen: 0,
				categories: n === 0 ? {} : { [t]: -n }
			};
		}
		return {
			unread: e ? -g.unread : 0,
			unseen: -g.unseen,
			categories: e ? Object.fromEntries(Object.entries(_).map(([e, t]) => [e, -t])) : {}
		};
	}, ut = (e) => {
		let t = y.find((t) => t.id === e) ?? v.find((t) => t.id === e);
		return t && q(t);
	}, ft = (e) => {
		let t = typeof e == "string" ? e : e.id, n = typeof e == "string" ? ut(e) : q(e), r = ye();
		return n === void 0 ? Ge({
			kind: "item",
			id: t,
			state: { readAt: r },
			delta: $e(),
			createdAt: null
		}, `${encodeURIComponent(t)}/read`) : n.readAt === null ? (R.add(t), ot(n, {
			readAt: r,
			seenAt: n.seenAt ?? r
		}, "read")) : Promise.resolve();
	}, pt = (e, t) => {
		let n = typeof e == "string" ? e : e.id, r = typeof e == "string" ? ut(e) : q(e), i = `${encodeURIComponent(n)}/complete`;
		if (r === void 0) return Ge({
			kind: "item",
			id: n,
			state: {},
			delta: $e(),
			createdAt: null
		}, i, { action: t });
		let a = r.actions[t]?.result;
		return a === void 0 ? Promise.resolve() : ot(r, { result: a }, "complete", { action: t });
	}, mt = (e, t) => {
		let n = r;
		return () => n === r ? pt(e, t) : Promise.resolve();
	}, ht = (e) => c.includes(e), X = {
		subscribe(e) {
			return se.add(e), () => se.delete(e);
		},
		getSnapshot: () => K,
		getServerSnapshot: () => _e,
		connect(r, i = {}) {
			e = r, t = i.prop ?? t, n = i.onFailure ?? n;
		},
		sync(e, n) {
			let r = Qe(e, t), h = n === "history" || n === "cached";
			if (!N(r)) {
				r === null && !h && a !== void 0 && (Ie(), J());
				return;
			}
			let g = P(r.user) ?? void 0;
			if (g !== i) {
				if (h) return;
				Ie(), i = g;
			}
			if (a = P(r.url) ?? a, o = P(r.channel), s = P(r.announcementsChannel), f = Ye(r.tabs), p = P(r.context), V = N(r.pause), !h) {
				let e = r.allowedActions;
				c = Array.isArray(e) ? Ae.filter((t) => e.includes(t)) : je, l = r.selectable !== !1, u = qe(r.categoryFilter), d = Je(N(r.pause) ? r.pause.presets : void 0);
			}
			Ne(b, c) || (b = "all", S !== "idle" && X.load()), !h && r !== m && (R.clear(), Ee({ counts: r }), U = r.push ?? null, N(r.pause) && ge(P(r.pause.until), typeof r.revision == "number" ? r.revision : 0)), m = r, J();
		},
		async load(t, n) {
			if (!e || a === void 0) return;
			let i = r, o = ++E;
			x = n === void 0 ? t === void 0 ? x : null : n, b = t ?? b, b = Ne(b, c) ? b : "all", S = "loading", C = !1, w = !1, R.clear(), J();
			try {
				let e = await Ue(null);
				i === r && o === E && (v = e.items, T = e.cursor, S = "ready", ve(e.items), Ee(e.body));
			} catch {
				i === r && o === E && (S = "error");
			}
			J();
		},
		async loadMore({ retry: t = !1 } = {}) {
			if (!e || a === void 0 || T === null || C || S !== "ready" || w && !t) return;
			let n = r, i = E;
			C = !0, w = !1, J();
			let o = await Ue(T).catch(() => void 0);
			if (n === r && i === E) {
				if (o === void 0) w = !0;
				else {
					let e = new Set(v.map((e) => e.id));
					v = [...v, ...o.items.filter((t) => !e.has(t.id))], T = o.cursor, ve(o.items);
				}
				C = !1, J();
			}
		},
		async refresh() {
			if (!e || a === void 0) return;
			let t = r;
			try {
				let n = await e.request("get", `${a}/counts`);
				t === r && (Ee(n), J());
			} catch {}
		},
		async loadArrival(t, n = null) {
			if (!e || a === void 0 || n !== null && n !== p) return;
			let i = r;
			try {
				let n = await e.request("get", `${a}/${encodeURIComponent(t)}`);
				return i === r && N(n) ? X.receive(n.item, n.counts) : void 0;
			} catch {
				return;
			}
		},
		receive(e, t) {
			let n = We(e);
			if (!n || a === void 0 || z.has(n.id) || y.some((e) => e.id === n.id && !Be(n, e))) return;
			let r = N(e) ? P(e.context) : null;
			if (p !== null && r !== null && r !== p) return;
			y = [n, ...y.filter((e) => e.id !== n.id)].sort((e, t) => Y(t.createdAt) - Y(e.createdAt)), ve([n]);
			let i = q(n);
			return Ee({ counts: t }), I.length > 0 || h === void 0 ? we(n) && Ce(i) : Te(), J(), k > 0 && S === "ready" && pe(i, b, x) && i.seenAt === null && X.markAllAsSeen(), ce.forEach((e) => e(n)), n;
		},
		onArrival(e) {
			return ce.add(e), () => ce.delete(e);
		},
		receiveChange(e) {
			let t = N(e) ? e.change : void 0, n = Ze(t), r = Ke(N(e) ? e.counts : void 0);
			if (!n || r === void 0 || a === void 0) return;
			let { revision: i } = r;
			(r.context === p || n.kind !== "read" && n.kind !== "seen" && n.kind !== "archive") && (n.kind === "item" && N(t) && N(t.item) && X.receive({
				...t.item,
				revision: t.item.revision ?? i
			}), Oe(n, i), Ee(e), J(), ue.forEach((e) => e(n)));
		},
		onChange(e) {
			return ue.add(e), () => ue.delete(e);
		},
		apply: q,
		belongs: pe,
		remember: ve,
		markAsRead: ft,
		complete: pt,
		completer: mt,
		pushSettings: () => U,
		context: () => p,
		onSaved(e) {
			return G.add(e), () => G.delete(e);
		},
		markAsUnread(e) {
			let t = q(e);
			return t.readAt === null ? Promise.resolve() : ot(t, { readAt: null }, "unread");
		},
		archive(e) {
			let t = q(e);
			return !ht("archive") || t.archivedAt !== null ? Promise.resolve() : ot(t, { archivedAt: ye() }, "archive");
		},
		unarchive(e) {
			let t = q(e);
			return !ht("archive") || t.archivedAt === null ? Promise.resolve() : ot(t, { archivedAt: null }, "unarchive");
		},
		snooze(e, t) {
			if (!ht("snooze")) return Promise.resolve();
			let n = q(e), r = new Date(t).toISOString();
			return ot(n, { snoozedUntil: r }, "snooze", { until: r });
		},
		unsnooze(e) {
			let t = q(e);
			return !ht("snooze") || t.snoozedUntil === null ? Promise.resolve() : ot(t, { snoozedUntil: null }, "unsnooze");
		},
		mute(e) {
			let t = q(e);
			return !ht("mute") || t.group === null || t.muted ? Promise.resolve() : st(t, t.group, !0);
		},
		unmute(e) {
			let t = q(e);
			return !ht("mute") || t.group === null || !t.muted ? Promise.resolve() : st(t, t.group, !1);
		},
		pause(e) {
			let t = new Date(e).toISOString();
			return V ? Ge({
				kind: "pause",
				until: t,
				delta: $e()
			}, "pause", { until: t }) : Promise.resolve();
		},
		resume() {
			return me() === null ? Promise.resolve() : Ge({
				kind: "pause",
				until: null,
				delta: $e()
			}, "resume");
		},
		batch(e, t, n) {
			let r = Me[e];
			if (e !== "seen" && !l || r !== void 0 && !ht(r)) return Promise.resolve();
			if (e === "snooze" && n === void 0) return Promise.reject(/* @__PURE__ */ TypeError("Snoozing notifications needs the time to snooze them until."));
			let i = t.map(q), a = e === "snooze" && n !== void 0 ? new Date(n).toISOString() : void 0, o = [];
			for (let t = 0; t < i.length; t += Pe) o.push(nt(e, i.slice(t, t + Pe), a));
			return Promise.all(o).then(() => void 0);
		},
		delete(e) {
			if (!ht("delete")) return Promise.resolve();
			let t = q(e), { unread: n, unseen: r } = Se(t);
			return Ge({
				kind: "delete",
				ids: [t.id],
				delta: {
					unread: -n,
					unseen: -r,
					categories: t.category === null ? {} : { [t.category]: -n }
				}
			}, `${encodeURIComponent(t.id)}/delete`);
		},
		markAllAsRead({ category: e = x } = {}) {
			return ct({ kind: "read" }, e, lt(!0, e), "read");
		},
		markAllAsSeen() {
			return g.unseen === 0 ? Promise.resolve() : ct({ kind: "seen" }, null, lt(!1), "seen");
		},
		archiveAll({ onlyRead: e = !1, category: t = x } = {}) {
			if (!ht("archive")) return Promise.resolve();
			let n = e ? $e() : lt(!0, t);
			return ct({
				kind: "archive",
				onlyRead: e
			}, t, n, "archive", { read: e });
		},
		async opened(e, { markAllAsSeen: t = !0, categories: n } = {}) {
			t && k++, A++, j.forEach((e) => e());
			let r = t ? g.unseen > 0 : be(), i = e !== void 0 && !e.includes(b) ? e[0] ?? b : b, a = n !== void 0 && x !== null && !n.includes(x) ? null : x;
			i !== b || a !== x ? await X.load(i, a) : (S !== "ready" || r) && await X.load(), t && S === "ready" && await X.markAllAsSeen();
		},
		closed({ markAllAsSeen: e = !0 } = {}) {
			e && (k = Math.max(0, k - 1)), A = Math.max(0, A - 1);
		},
		panelOpen: () => A > 0,
		onPanelOpened(e) {
			return j.add(e), () => j.delete(e);
		},
		open(t, n) {
			if (n?.defaultPrevented) return;
			ft(t);
			let r = L(t.url);
			r === void 0 || n && re(n) || (n?.preventDefault(), !ne(r) || !e ? window.location.assign(r) : e.visit(r, {}));
		},
		runAction(t, n, i) {
			let a = t.actions[n];
			if (!a || i?.defaultPrevented) return;
			let o = H(a);
			if (i && o !== void 0 && ae(a, o, i)) {
				a.event && !re(i) && window.dispatchEvent(new CustomEvent(a.event, { detail: a.payload })), W(o, a, i, () => void ft(t), a.result === void 0 ? void 0 : () => pt(t, n));
				return;
			}
			if (i?.preventDefault(), O[t.id] !== void 0) return;
			ft(t);
			let s = r, c = a.result === void 0 ? void 0 : mt(t, n);
			le(a, t, e, () => {
				if (s !== r) return;
				let { [t.id]: e, ...n } = O;
				O = n, J();
			}, c) === "pending" && (O = {
				...O,
				[t.id]: n
			}, J());
		}
	};
	return X;
}
function st(e, t, n, r = null) {
	return Ve(e.getSnapshot().arrived, t).map((t) => e.apply(t)).filter((t) => e.belongs(t, n, r));
}
function ct(e, t = !0) {
	let n = [], r = /* @__PURE__ */ new Map();
	for (let i of e) {
		let e = t ? i.group : null, a = e === null ? void 0 : r.get(e);
		if (a) a.others.push(i);
		else {
			let t = {
				key: e === null ? i.id : `group:${e}`,
				item: i,
				others: []
			};
			n.push(t), e !== null && r.set(e, t);
		}
	}
	return n;
}
function lt(e = {}, t = /* @__PURE__ */ new Date()) {
	let n = Tt(e), r = (e) => {
		let n = new Date(t);
		return n.setDate(t.getDate() + e), n.setHours(9, 0, 0, 0), n;
	}, i = new Date(t.getTime() + 108e5), a = i.getDate() === t.getDate() ? [{
		label: Z(n.snoozeLaterToday),
		until: i
	}] : [], o = (8 - t.getDay()) % 7 || 7;
	return [
		...a,
		{
			label: Z(n.snoozeTomorrow),
			until: r(1)
		},
		...o > 1 ? [{
			label: Z(n.snoozeNextWeek),
			until: r(o)
		}] : []
	];
}
function ut(e, t, n) {
	let r = new Date(e), i = new Date(t).toDateString() === r.toDateString();
	return r.toLocaleString(n, i ? {
		hour: "numeric",
		minute: "2-digit"
	} : {
		weekday: "short",
		hour: "numeric",
		minute: "2-digit"
	});
}
var dt = [
	30,
	60,
	120,
	"tomorrow"
];
function ft(e, t = /* @__PURE__ */ new Date()) {
	if (e !== "tomorrow") return new Date(t.getTime() + e * 6e4);
	let n = new Date(t);
	return n.setDate(t.getDate() + 1), n.setHours(8, 0, 0, 0), n;
}
function pt(e, t, n) {
	return e.filter((e) => e === "tomorrow" || Number.isFinite(e) && e > 0).map((e) => {
		if (e === "tomorrow") return {
			label: Z(t.pauseTomorrow),
			preset: e
		};
		let r = e % 60 == 0, i = new Intl.NumberFormat(n, {
			style: "unit",
			unit: r ? "hour" : "minute",
			unitDisplay: "long"
		});
		return {
			label: Z(t.pauseFor, {
				duration: i.format(r ? e / 60 : e),
				minutes: e
			}),
			preset: e
		};
	});
}
function mt(e, t, n) {
	let r = new Date(e);
	return r.getTime() - t < 5184e5 ? ut(r, t, n) : r.toLocaleString(n, {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit"
	});
}
var ht = ot(), X = ht, gt = {
	load: X.load,
	loadMore: X.loadMore,
	refresh: X.refresh,
	receive: X.receive,
	receiveChange: X.receiveChange,
	markAsRead: X.markAsRead,
	markAsUnread: X.markAsUnread,
	archive: X.archive,
	unarchive: X.unarchive,
	snooze: X.snooze,
	unsnooze: X.unsnooze,
	delete: X.delete,
	complete: X.complete,
	mute: X.mute,
	unmute: X.unmute,
	pause: X.pause,
	resume: X.resume,
	batch: X.batch,
	markAllAsRead: X.markAllAsRead,
	markAllAsSeen: X.markAllAsSeen,
	archiveAll: X.archiveAll,
	opened: X.opened,
	closed: X.closed,
	open: X.open,
	runAction: X.runAction
};
function _t(e) {
	X.getSnapshot().url === void 0 && X.sync(e, "initial");
}
var vt = ht;
function yt(e = 6e4) {
	let t = /* @__PURE__ */ new Set(), n = Date.now(), r, i = () => {
		n = Date.now(), t.forEach((e) => e());
	};
	return {
		subscribe(a) {
			return t.add(a), r === void 0 && (n = Date.now(), r = setInterval(i, e)), () => {
				t.delete(a), t.size === 0 && (clearInterval(r), r = void 0);
			};
		},
		getSnapshot: () => n
	};
}
var bt = yt();
function xt(e, t, n) {
	let r = (Y(e) - t) / 1e3, i = new Intl.RelativeTimeFormat(n, { numeric: "auto" });
	for (let [e, t] of [
		["year", 31536e3],
		["month", 2592e3],
		["week", 604800],
		["day", 86400],
		["hour", 3600],
		["minute", 60]
	]) if (Math.abs(r) >= t) return i.format(Math.round(r / t), e);
	return i.format(0, "second");
}
function St(e, t, n) {
	let r = new Intl.NumberFormat(n);
	return e > t ? `${r.format(t)}+` : r.format(e);
}
var Ct = /* @__PURE__ */ "title.bell.bellNew.bellPaused.all.unread.archived.snoozed.markAllAsRead.archiveAll.moreActions.itemControl.markAsRead.markAsUnread.archive.unarchive.snooze.unsnooze.mute.unmute.muted.delete.select.selectAll.selected.selection.readSelected.unreadSelected.snoozeSelected.unsnoozeSelected.archiveSelected.unarchiveSelected.deleteSelected.clearSelection.showNew.snoozeUntil.snoozedUntil.snoozeLaterToday.snoozeTomorrow.snoozeNextWeek.pause.pauseFor.pauseTomorrow.pausedUntil.resume.showMore.showLess.unreadState.actorsAndOther.actorsAndOthers.empty.emptyUnread.emptyArchived.emptySnoozed.error.retry.categories.allCategories.loading.loadMore.viewAll.announcement".split("."), wt = De("inbox_", Ct), Tt = (e) => Oe("inbox_", Ct, e), Z = we, Et = (e) => e.actors.slice(0, 3);
function Dt(e, t) {
	let [n, r] = t.actors;
	if (!(t.actorCount < 2 || !n?.name)) return t.actorCount > 2 ? Z(e.actorsAndOthers, {
		name: n.name,
		count: t.actorCount - 1
	}) : r?.name ? Z(e.actorsAndOther, {
		name: n.name,
		other: r.name
	}) : void 0;
}
// ../js/realtime.ts
var Ot = ".inertiaui.inbox.arrived", kt = ".inertiaui.inbox.changed", At = ".inertiaui.announcement.published", jt = 1e3, Mt = "inertiaui-inbox";
function Nt(e, t, n) {
	let r, i = !1, a, o, s = /* @__PURE__ */ new Set(), c = !1, l, u = () => {
		try {
			return r?.();
		} catch {
			return;
		}
	}, d = (t) => {
		let r = N(t) ? e.receive(t.item, t.counts) : void 0;
		r && n(r);
	}, f = (t) => {
		let r = e.onArrival(n);
		try {
			e.receiveChange(t);
		} finally {
			r();
		}
	}, p = (t) => {
		if (!N(t) || typeof t.id != "string") return;
		let { id: r } = t, i = typeof t.context == "string" ? t.context : null, a = setTimeout(() => {
			s.delete(a), e.loadArrival(r, i).then((e) => e && n(e));
		}, Math.random() * jt);
		s.add(a);
	}, m = () => {
		let { announcementsChannel: t } = e.getSnapshot();
		if (o && o.channel === t && o.resolve === r) return;
		o?.stop(), o = void 0;
		let n = t === null ? void 0 : u();
		if (!n || t === null || !r) return;
		let i = n.private(t);
		i.listen(At, p), o = {
			channel: t,
			resolve: r,
			stop: () => i.stopListening(At, p)
		};
	}, h = () => {
		g(), m();
	}, g = () => {
		let { channel: t } = e.getSnapshot();
		if (a && a.channel === t && a.resolve === r) return;
		a?.stop(), a = void 0;
		let n = t === null ? void 0 : u();
		if (!n || t === null || !r) return;
		let i = n.private(t);
		i.listen(Ot, d), i.listen(kt, f);
		let o = !1, s = n.connector?.onConnectionChange?.((t) => {
			t === "connected" && o && e.refresh(), o = t !== "connected";
		});
		a = {
			channel: t,
			resolve: r,
			stop() {
				i.stopListening(Ot, d), i.stopListening(kt, f), typeof s == "function" && s();
			}
		};
	}, _ = () => typeof document < "u" && document.visibilityState === "hidden", v = () => {
		clearInterval(l), l = c && !_() ? setInterval(() => void e.refresh(), c) : void 0;
	}, y = () => {
		c && !_() && e.refresh(), v();
	};
	typeof document < "u" && document.addEventListener("visibilitychange", y);
	let b = typeof BroadcastChannel == "function" ? new BroadcastChannel(Mt) : void 0;
	b?.addEventListener("message", (t) => {
		let { url: n, user: r, channel: i } = e.getSnapshot(), a = t.data;
		N(a) && n !== void 0 && a.url === n && a.user === r && a.channel === i && e.receiveChange(a);
	});
	let x = e.onSaved(({ change: t, counts: n }) => {
		let { url: r, user: i, channel: a } = e.getSnapshot();
		b?.postMessage({
			change: t,
			counts: n,
			url: r,
			user: i,
			channel: a
		});
	}), S = e.subscribe(h);
	return {
		configure(e) {
			if (e.echo !== void 0) {
				let n = e.echo;
				r = typeof n == "function" ? n : n ? () => n : void 0, r && !i && (i = !0, t.useSocketId(() => u()?.socketId()));
			}
			e.poll !== void 0 && (c = e.poll, v()), h();
		},
		destroy() {
			S(), x(), a?.stop(), a = void 0, o?.stop(), o = void 0, s.forEach((e) => clearTimeout(e)), s.clear(), clearInterval(l), b?.close(), typeof document < "u" && document.removeEventListener("visibilitychange", y);
		}
	};
}
var Pt = "inertiaui-inbox-", Ft = (e) => `${Pt}${e}`, It = (e) => e.startsWith(Pt) ? e.slice(16) : void 0;
function Lt(e, t, n) {
	let r = t === "none" || e.announcement || e.quiet === !0 || e.readAt !== null || e.archivedAt !== null ? null : e.toast ?? (t === "all" ? "default" : null);
	if (r === null) return;
	let { title: i, ...a } = Rt(e, n);
	return {
		title: i,
		options: {
			id: Ft(e.id),
			type: r,
			...a
		}
	};
}
function Rt(e, t) {
	let n = e.actions.length > 0 || e.url === null ? e.actions.map(({ onClick: e, ...t }) => t) : [{
		...t,
		href: e.url
	}];
	return {
		title: e.title,
		description: e.body ?? void 0,
		actions: n,
		icon: e.icon ?? void 0,
		image: e.actor?.avatar
	};
}
// ../js/browserAlerts.ts
var zt = "inertiaui-notifications";
function Bt(e) {
	let t = document, n = navigator.locks;
	if (!n) return {
		elected: () => t.visibilityState === "visible",
		stop: () => {}
	};
	let r = !1, i = !1, a, o = (t) => {
		a?.();
		let s = new AbortController(), c = () => {}, l = () => {
			s.abort(), c(), r = !1;
		};
		a = l, n.request(e, t ? { steal: !0 } : { signal: s.signal }, () => {
			if (a === l) return r = !0, new Promise((e) => c = e);
		}).catch(() => {
			a === l && !i && o(!1);
		});
	}, s = () => {
		t.visibilityState === "visible" && !r && o(!0);
	};
	return t.addEventListener("visibilitychange", s), o(t.visibilityState === "visible"), {
		elected: () => r,
		stop() {
			i = !0, t.removeEventListener("visibilitychange", s), a?.(), a = void 0;
		}
	};
}
async function Vt() {
	return typeof Notification == "function" ? Notification.requestPermission() : "denied";
}
var Ht;
function Ut() {
	if (typeof AudioContext != "function") return;
	Ht ??= new AudioContext();
	let e = Ht;
	for (let [t, n] of [880, 1320].entries()) {
		let r = e.currentTime + t * .15, i = e.createOscillator(), a = e.createGain();
		i.frequency.value = n, a.gain.setValueAtTime(.2, r), a.gain.exponentialRampToValueAtTime(.001, r + .4), i.connect(a).connect(e.destination), i.start(r), i.stop(r + .4);
	}
}
function Wt(e) {
	let t = !1, n = "", r, i, a, o = !1, s, c = !1, l = !1, u, d, f = () => {
		let a = document.title !== i;
		a && (n = document.title);
		let { unread: o } = e.getSnapshot().counts, s = t && o > 0 ? Te("inbox_title_count", {
			count: St(o, 99),
			number: o,
			title: n
		}) : n;
		(a || s !== r) && (r = s, document.title !== s && (document.title = s), i = document.title);
	}, p = (e) => {
		e !== t && (t = e, f(), a?.disconnect(), a = void 0, e && typeof MutationObserver == "function" && document.head && (a = new MutationObserver(f), a.observe(document.head, {
			childList: !0,
			subtree: !0,
			characterData: !0
		})));
	}, m = () => {
		let { url: t, counts: n } = e.getSnapshot(), r = o ? n.unread : 0;
		r === s || t === void 0 && s === void 0 || typeof navigator.setAppBadge != "function" || (s = r, (r > 0 ? navigator.setAppBadge(r) : navigator.clearAppBadge()).catch(() => {}));
	}, h = (e) => {
		e !== o && (o = e, m());
	}, g = () => {
		let e = c || l !== !1;
		e && !d && (d = Bt(zt)), !e && d && (d.stop(), d = void 0);
	}, _ = (t) => {
		if (typeof Notification != "function" || Notification.permission !== "granted") return;
		let n;
		try {
			n = new Notification(t.title, {
				body: t.body ?? void 0,
				icon: t.actor?.avatar,
				tag: Ft(t.id)
			});
		} catch {
			return;
		}
		n.addEventListener("click", () => {
			window.focus(), n.close(), e.open(t);
		});
	}, v = (e) => {
		navigator.userActivation?.hasBeenActive !== !1 && (e === !0 ? Ut() : (u?.getAttribute("src") !== e && (u = new Audio(e)), u.currentTime = 0, u.play().catch(() => {})));
	};
	return e.onArrival((e) => {
		d?.elected() && e.quiet !== !0 && e.readAt === null && e.archivedAt === null && (c && document.visibilityState === "hidden" && _(e), l !== !1 && v(l));
	}), e.subscribe(() => {
		t && f(), o && m();
	}), { configure(e) {
		e.titleCount !== void 0 && p(e.titleCount), e.appBadge !== void 0 && h(e.appBadge), c = e.desktopNotifications ?? c, l = e.sound ?? l, g();
	} };
}
// ../js/preferences.ts
var Gt = [
	"instant",
	"hourly",
	"daily",
	"weekly"
], Kt = [
	"monday",
	"tuesday",
	"wednesday",
	"thursday",
	"friday",
	"saturday",
	"sunday"
], qt = {
	status: "idle",
	channels: [],
	groups: [],
	categories: [],
	notificationHours: null,
	frequencies: Gt
}, Jt = (e, t) => typeof e == "string" ? e : t, Yt = (e) => Gt.includes(e), Xt = (e) => typeof e == "string" && /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/.test(e), Zt = (e) => [...e].sort(), Qt = (e) => {
	if (!N(e) || !N(e.days)) return null;
	let t = e.days;
	return {
		enabled: e.enabled === !0,
		days: Object.fromEntries(Kt.map((e) => [e, Zt(Array.isArray(t[e]) ? t[e].filter(Xt) : [])]))
	};
}, $t = (e) => {
	let t = Array.isArray(e) ? Gt.filter((t) => e.includes(t)) : [];
	return t.length > 0 ? t : Gt;
};
function en(e) {
	if (N(e) && Array.isArray(e.channels) && Array.isArray(e.categories)) return {
		channels: e.channels.filter(N).flatMap((e) => typeof e.key == "string" ? [{
			key: e.key,
			label: Jt(e.label, e.key),
			globalSwitch: e.globalSwitch === !0,
			enabled: e.enabled !== !1,
			digest: e.digest === !0,
			inbox: e.inbox === !0,
			push: e.push === !0
		}] : []),
		groups: (Array.isArray(e.groups) ? e.groups : []).filter(N).flatMap((e) => typeof e.key == "string" ? [{
			key: e.key,
			label: Jt(e.label, e.key),
			description: P(e.description)
		}] : []),
		categories: e.categories.filter(N).flatMap((e) => typeof e.key == "string" ? [{
			key: e.key,
			label: Jt(e.label, e.key),
			description: P(e.description),
			group: P(e.group),
			locked: e.locked === !0,
			channels: Object.fromEntries(Object.entries(N(e.channels) ? e.channels : {}).filter((e) => typeof e[1] == "boolean")),
			frequency: Yt(e.frequency) ? e.frequency : null
		}] : []),
		notificationHours: Qt(e.notificationHours),
		frequencies: $t(e.frequencies)
	};
}
function tn(e) {
	let t = new Set(e.groups.map(({ key: e }) => e)), n = e.categories.filter(({ group: e }) => e === null || !t.has(e)), r = e.groups.map((t) => ({
		group: t,
		categories: e.categories.filter((e) => e.group === t.key)
	}));
	return [...n.length > 0 ? [{
		group: null,
		categories: n
	}] : [], ...r.filter(({ categories: e }) => e.length > 0)];
}
var nn = (e, t) => e.locked || t.enabled && e.channels[t.key] === !0, rn = (e, t, n) => {
	let r = n.find((e) => e.inbox);
	return !t.push || r === void 0 || r.key === t.key || e.channels[r.key] === void 0 || nn(e, r);
}, an = (e, t, n) => nn(e, t) && rn(e, t, n), on = (e, t, n) => e.locked || !t.enabled || !rn(e, t, n), sn = (e, t) => e.frequency !== null && t.some((n) => n.digest && e.channels[n.key] !== void 0 && an(e, n, t)), cn = (e, t) => new Intl.DateTimeFormat(t, {
	weekday: "long",
	timeZone: "UTC"
}).format(Date.UTC(2024, 0, 1 + Kt.indexOf(e))), ln = (e) => {
	let [t = "", n = ""] = e.split("-");
	return [t, n];
}, un = (e, t) => e.days[t].length > 0 && Kt.every((n) => n === t || e.days[n].length === 0);
function dn(e, t) {
	let n = Kt.indexOf(t);
	for (let t = 1; t < Kt.length; t++) {
		let [r] = e.days[Kt[(n + Kt.length - t) % Kt.length]];
		if (r !== void 0) return r;
	}
	return "09:00-17:00";
}
var fn = 1440, pn = (e) => Number(e.slice(0, 2)) * 60 + Number(e.slice(3)), mn = (e) => [Math.floor(e / 60) % 24, e % 60].map((e) => String(e).padStart(2, "0")).join(":");
function hn(e) {
	let t = e.map((e) => ln(e).map(pn));
	if (t.length === 0 || t.some(([e, t]) => t <= e)) return;
	let n = Math.max(...t.map(([, e]) => e));
	return n + 120 <= fn ? `${mn(n + 60)}-${mn(n + 120)}` : void 0;
}
var gn = (e, t, n) => t?.day === n ? t.ranges : e?.days[n] ?? [], _n = (e, t, n) => e === null ? [] : Kt.map((r) => ({
	day: r,
	name: cn(r, n),
	ranges: gn(e, t, r).map(ln),
	locked: !e.enabled || un(e, r),
	canAdd: e.enabled && hn(e.days[r]) !== void 0
}));
function vn(e, t, n) {
	let { day: r } = n, i = gn(e, t, r), a;
	switch (n.kind) {
		case "toggle":
			if (!e?.enabled || un(e, r)) return;
			a = e.days[r].length > 0 ? [] : [dn(e, r)];
			break;
		case "time": {
			let [e, t] = ln(i[n.index] ?? ""), o = n.field === "start" ? `${n.time}-${t}` : `${e}-${n.time}`;
			return a = i.map((e, t) => t === n.index ? o : e), {
				ranges: a,
				editing: () => ({
					day: r,
					ranges: a
				})
			};
		}
		case "remove":
			a = i.filter((e, t) => t !== n.index);
			break;
		case "add": {
			let t = hn(i);
			if (!e?.enabled || t === void 0) return;
			a = [...i, t];
		}
	}
	return {
		ranges: a,
		editing: (e) => e?.day === r ? {
			day: r,
			ranges: a
		} : e
	};
}
var yn = () => {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone;
	} catch {
		return;
	}
}, bn = (e, t) => e.enabled === t.enabled && Kt.every((n) => e.days[n].join() === t.days[n].join()), xn = (e, t) => typeof e == "object" && typeof t == "object" ? bn(e, t) : e === t, Sn = "*", Cn = "*";
function wn() {
	let e, t, n, r = 0, i = 0, a = 0, o = {
		channels: [],
		categories: [],
		notificationHours: null
	}, s = /* @__PURE__ */ new Map(), c = /* @__PURE__ */ new Map(), l = /* @__PURE__ */ new Map(), u = qt, d = /* @__PURE__ */ new Set(), f = ({ category: e, channel: t }) => JSON.stringify([e, t]), p = (e, { category: t, channel: n }) => {
		if (t === null) return n === Cn ? e.notificationHours ?? void 0 : e.channels.find(({ key: e }) => e === n)?.enabled;
		let r = e.categories.find(({ key: e }) => e === t);
		return n === Sn ? r?.frequency ?? void 0 : r?.channels[n];
	}, m = (e, t, n) => t === Sn ? e.frequency !== null && Yt(n) ? {
		...e,
		frequency: n
	} : e : e.channels[t] !== void 0 && typeof n == "boolean" ? {
		...e,
		channels: {
			...e.channels,
			[t]: n
		}
	} : e, h = (e, { category: t, channel: n }, r) => t === null ? n === Cn ? e.notificationHours !== null && typeof r == "object" ? {
		...e,
		notificationHours: r
	} : e : typeof r == "boolean" ? {
		...e,
		channels: e.channels.map((e) => e.key === n ? {
			...e,
			enabled: r
		} : e)
	} : e : {
		...e,
		categories: e.categories.map((e) => e.key === t ? m(e, n, r) : e)
	}, g = ({ category: e, channel: t }, n) => e === null ? t === Cn ? {
		notificationHours: n,
		timezone: yn()
	} : { channels: { [t]: n } } : t === Sn ? {
		frequencies: { [e]: n },
		timezone: yn()
	} : { preferences: { [e]: { [t]: n } } }, _ = (e) => {
		u = {
			...u,
			...e
		}, d.forEach((e) => e());
	}, v = (e = {}) => _({
		...e,
		...[...s.values()].reduce((e, { cell: t, value: n }) => h(e, t, n), o)
	}), y = async (i, c) => {
		let u = r, d = s.get(c).value;
		try {
			let t = en(await e.request("post", `${n}/preferences`, g(i, d)));
			if (u !== r) return;
			o = h(o, i, (t && p(t, i)) ?? d), l.set(c, {
				cell: i,
				at: ++a
			});
		} catch (e) {
			if (u !== r) return;
			t?.(e);
		}
		(xn(s.get(c)?.value, d) || xn(s.get(c)?.value, p(o, i))) && s.delete(c), v(), s.has(c) && await y(i, c);
	}, b = (e, t, n) => {
		let i = {
			category: e,
			channel: t
		}, a = f(i);
		s.set(a, {
			cell: i,
			value: n
		}), v();
		let o = c.get(a);
		if (o) return o;
		let l = r, u = y(i, a).finally(() => {
			l === r && c.delete(a);
		});
		return c.set(a, u), u;
	}, x = {
		subscribe(e) {
			return d.add(e), () => d.delete(e);
		},
		getSnapshot: () => u,
		connect(n, r = {}) {
			e = n, t = r.onFailure ?? t;
		},
		async load(t) {
			let s = r, c = ++i, u = a;
			if (n = t, !e || n === void 0) _({ status: "error" });
			else {
				_({ status: "loading" });
				try {
					let t = en(await e.request("get", `${n}/preferences`));
					if (s !== r || c !== i) return;
					if (!t) {
						_({ status: "error" });
						return;
					}
					o = [...l.values()].filter(({ at: e }) => e > u).reduce((e, { cell: t }) => h(e, t, p(o, t)), {
						channels: t.channels,
						categories: t.categories,
						notificationHours: t.notificationHours
					}), v({
						status: "ready",
						groups: t.groups,
						frequencies: t.frequencies
					});
				} catch {
					s === r && c === i && _({ status: "error" });
				}
			}
		},
		set(t, r, i) {
			let a = u.categories.find(({ key: e }) => e === t), o = a?.channels[r];
			return !e || n === void 0 || !a || a.locked || o === void 0 || o === i ? Promise.resolve() : b(t, r, i);
		},
		setChannel(t, r) {
			let i = u.channels.find(({ key: e }) => e === t);
			return !e || n === void 0 || !i?.globalSwitch || i.enabled === r ? Promise.resolve() : b(null, t, r);
		},
		setFrequency(t, r) {
			let i = u.categories.find(({ key: e }) => e === t);
			return !e || n === void 0 || !i || i.frequency === null || i.frequency === r || !u.frequencies.includes(r) ? Promise.resolve() : b(t, Sn, r);
		},
		setNotificationHours(t) {
			let r = u.notificationHours;
			if (!e || n === void 0 || r === null) return Promise.resolve();
			let i = Kt.map((e) => [e, t.days?.[e] ?? r.days[e]]);
			if (!i.every(([, e]) => Array.isArray(e) && e.every(Xt)) || i.every(([, e]) => e.length === 0)) return Promise.resolve();
			let a = {
				enabled: t.enabled ?? r.enabled,
				days: Object.fromEntries(i.map(([e, t]) => [e, Zt(t)]))
			};
			return xn(a, r) ? Promise.resolve() : b(null, Cn, a);
		},
		reset(e) {
			r++, i++, o = {
				channels: [],
				categories: [],
				notificationHours: null
			}, s.clear(), c.clear(), l.clear(), n = e, _(qt), d.size > 0 && e !== void 0 && x.load(e);
		}
	};
	return x;
}
var Tn = /* @__PURE__ */ "title.category.toggle.locked.global.globalDescription.frequency.frequencyLabel.frequencyInstant.frequencyHourly.frequencyDaily.frequencyWeekly.pushDevice.pushOff.pushOn.pushTurnOn.pushTurnOff.pushTurningOn.pushTurningOff.pushBlocked.pushHomeScreen.pushInsecure.pushBrave.pushFailed.pushFailedOff.pushRetry.pushDevices.pushDeviceName.pushDeviceUnknown.pushDeviceActive.pushDeviceRemove.pushDeviceRemoveLabel.notificationHours.notificationHoursDescription.notificationHoursStart.notificationHoursEnd.notificationHoursDay.notificationHoursOff.notificationHoursAdd.notificationHoursAddLabel.notificationHoursRemove.notificationHoursRemoveLabel.empty.loading.error.retry".split("."), En = De("preferences_", Tn), Dn = {
	instant: "frequencyInstant",
	hourly: "frequencyHourly",
	daily: "frequencyDaily",
	weekly: "frequencyWeekly"
}, On = (e) => Oe("preferences_", Tn, e), kn = wn();
function An(e, t, n, r) {
	let i = t.some(({ frequency: e }) => e !== null);
	return {
		hasGlobalSwitches: e.some(({ globalSwitch: e }) => e),
		hasFrequencies: i,
		columns: e.length + (i ? 2 : 1),
		frequencyOptions: n.map((e) => ({
			value: e,
			label: we(r[Dn[e]])
		}))
	};
}
function jn(e, t, n) {
	on(e, t, n) || kn.set(e.key, t.key, !e.channels[t.key]);
}
// ../js/push.ts
var Mn = {
	available: !1,
	supported: !1,
	permission: "default",
	subscribed: !1,
	busy: !1,
	reason: null,
	request: null,
	devices: null
};
function Nn(e) {
	return !e.available || e.reason === "unsupported" ? null : e.busy ? "busy" : e.reason ?? (e.subscribed ? "on" : "off");
}
function Pn(e) {
	let t = Nn(e), n = e.request?.action ?? "subscribe", r = n === "unsubscribe";
	switch (t) {
		case null: return null;
		case "off": return {
			state: t,
			text: "pushOff",
			hint: !1,
			button: {
				label: "pushTurnOn",
				action: "subscribe",
				primary: !0
			}
		};
		case "on": return {
			state: t,
			text: "pushOn",
			hint: !1,
			button: {
				label: "pushTurnOff",
				action: "unsubscribe",
				primary: !1
			}
		};
		case "busy": return {
			state: t,
			text: r ? "pushTurningOff" : "pushTurningOn",
			hint: !1,
			button: {
				label: r ? "pushTurnOff" : "pushTurnOn",
				action: n,
				primary: !r
			}
		};
		case "blocked": return {
			state: t,
			text: "pushBlocked",
			hint: !0,
			button: null
		};
		case "home-screen": return {
			state: t,
			text: "pushHomeScreen",
			hint: !0,
			button: null
		};
		case "insecure": return {
			state: t,
			text: "pushInsecure",
			hint: !0,
			button: null
		};
		case "brave": return {
			state: t,
			text: "pushBrave",
			hint: !0,
			button: {
				label: "pushRetry",
				action: n,
				primary: !1
			}
		};
		case "failed": return {
			state: t,
			text: r ? "pushFailedOff" : "pushFailed",
			hint: !0,
			button: {
				label: "pushRetry",
				action: n,
				primary: !1
			}
		};
	}
}
function Fn(e) {
	return !N(e) || typeof e.publicKey != "string" || e.publicKey === "" || typeof e.worker != "string" || e.worker === "" ? null : {
		publicKey: e.publicKey,
		worker: e.worker,
		subscribed: e.subscribed === !0
	};
}
var In = (e) => typeof e == "string" && e !== "" ? e : null;
function Ln(e) {
	if (N(e) && Array.isArray(e.devices)) return e.devices.flatMap((e) => N(e) && typeof e.id == "number" && typeof e.activeAt == "string" ? [{
		id: e.id,
		browser: In(e.browser),
		platform: In(e.platform),
		activeAt: e.activeAt,
		current: e.current === !0
	}] : []);
}
function Rn(e) {
	let t = e.replaceAll("-", "+").replaceAll("_", "/"), n = atob(t.padEnd(t.length + (4 - t.length % 4) % 4, "="));
	return Uint8Array.from(n, (e) => e.charCodeAt(0));
}
function zn(e, t) {
	let n = e.options?.applicationServerKey;
	if (!n) return !0;
	let r = new Uint8Array(n);
	return r.length === t.length && r.every((e, n) => e === t[n]);
}
var Bn = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1, Vn = () => navigator.standalone === !0 || window.matchMedia?.("(display-mode: standalone)").matches === !0;
function Hn() {
	return window.isSecureContext ? navigator.serviceWorker !== void 0 && "PushManager" in window && typeof Notification == "function" ? null : Bn() && !Vn() ? "home-screen" : "unsupported" : "insecure";
}
var Un = () => "brave" in navigator, Wn = () => typeof Notification == "function" ? Notification.permission : "default", Gn = (e) => new URL("./", new URL(e, window.location.href)).href;
function Kn(e) {
	let t = e.installing ?? e.waiting;
	return e.active || !t ? e.active ? Promise.resolve(e) : Promise.reject(/* @__PURE__ */ Error("The service worker did not install.")) : new Promise((n, r) => {
		let i = () => {
			if (e.active || t.state === "redundant") return t.removeEventListener("statechange", i), e.active ? n(e) : r(/* @__PURE__ */ Error("The service worker did not install."));
		};
		t.addEventListener("statechange", i);
	});
}
function qn() {
	let e, t, n, r, i, a = 0, o = null, s = null, c = "unsupported", l = "default", u = !1, d, f = null, p = !1, m = Promise.resolve(), h = null, g = /* @__PURE__ */ new Set(), _ = null, v = 0, y = Mn, b = /* @__PURE__ */ new Set(), x = () => f?.status === "pending", S = () => {
		let e = s !== null, t = c === null, n = {
			available: e,
			supported: t,
			permission: l,
			subscribed: e && t && l === "granted" && u,
			busy: x(),
			reason: c ?? (l === "denied" ? "blocked" : f === null || f.status === "pending" ? null : f.status),
			request: f,
			devices: e ? _ : null
		};
		Object.keys(n).some((e) => n[e] !== y[e]) && (y = n, b.forEach((e) => e()));
	}, C = (e) => {
		let t = m.then(e);
		return m = t.catch(() => {}), t;
	}, w = () => t?.getSnapshot().url, T = async (e) => {
		let t = Gn(e.worker), n = await navigator.serviceWorker.getRegistration(t);
		return n?.scope === t ? n : void 0;
	}, E = async (e, t) => {
		let n = new URL(e.worker, window.location.href).href;
		return Kn(t?.active?.scriptURL === n ? t : await navigator.serviceWorker.register(n, { scope: Gn(e.worker) }));
	}, D = (t, n, r) => t === a ? e.request("post", `${w()}/${n}`, r) : Promise.reject(/* @__PURE__ */ Error("Another user signed in.")), O = async (e, t, n = !1) => {
		let r = await D(e, "push/subscribe", {
			...t.toJSON(),
			...n ? { refresh: !0 } : {}
		});
		if (n && N(r) && r.subscribed === !1) return !1;
		if (!N(r) || r.subscribed !== !0) throw Error("The push endpoint did not save the subscription.");
		return !0;
	}, k = async (e, t, n, r = !1) => {
		let i = Rn(n.publicKey), a, o;
		try {
			a = await t.pushManager.getSubscription(), a && !zn(a, i) && (await a.unsubscribe(), a = null), a ??= o = await t.pushManager.subscribe({
				userVisibleOnly: !0,
				applicationServerKey: i
			});
		} catch (e) {
			throw Un() ? Object.assign(/* @__PURE__ */ Error("Brave could not subscribe."), {
				brave: !0,
				cause: e
			}) : e;
		}
		try {
			if (!await O(e, a, r)) return await a.unsubscribe().catch(() => {}), !1;
		} catch (e) {
			throw await o?.unsubscribe().catch(() => {}), e;
		}
		return !0;
	}, A = (e) => N(e) && e.brave === !0 ? "brave" : "failed", j = () => {
		if (p || s === null || c !== null || l !== "granted" || !e) return;
		p = !0;
		let t = a, n = s;
		C(async () => {
			if (t !== a) return;
			let e = await T(n).catch(() => void 0);
			if (!e && !n.subscribed) return;
			let r = () => {
				t === a && (u = !1, S(), F());
			};
			try {
				let i = await E(n, e), a = await i.pushManager.getSubscription();
				if (a && zn(a, Rn(n.publicKey))) {
					n.subscribed && !await O(t, a, !0).catch(() => !0) && (await a.unsubscribe().catch(() => {}), r());
					return;
				}
				a && await a.unsubscribe(), n.subscribed && !await k(t, i, n, !0) && r();
			} catch (e) {
				t === a && n.subscribed && (u = !1, f ??= {
					action: "subscribe",
					status: A(e)
				}, S());
			}
		});
	}, M = () => {
		_ = h?.filter(({ id: e }) => !g.has(e)) ?? null, S();
	}, P = async () => {
		if (s === null || !e) return;
		let t = a, n = ++v;
		try {
			let r = Ln(await e.request("get", `${w()}/push/devices`));
			t === a && n === v && r && (h = r, M());
		} catch {}
	}, F = () => {
		h !== null && P();
	}, I = () => {
		a++, o = null, s = null, u = !1, d = void 0, f = null, p = !1, m = Promise.resolve(), h = _ = null, g.clear(), v++;
	}, R = () => {
		let e = t.getSnapshot(), n = e.url === void 0 ? void 0 : e.user ?? "";
		n !== i && (i = n, I());
		let r = t.pushSettings();
		r !== o && (o = r, s = Fn(r), s === null ? (u = !1, d = void 0, f = x() ? f : null) : s.subscribed !== d && (u = d = s.subscribed)), l = Wn(), S(), j();
	}, z = () => {
		l = Wn(), S(), j();
	}, B = (t) => {
		let r = t.data;
		if (N(r) && r.type === "inertiaui-notifications:shown") {
			let e = typeof r.tag == "string" ? It(r.tag) : void 0;
			e !== void 0 && n?.(e) && ee([Ft(e)]);
			return;
		}
		if (!N(r) || r.type !== "inertiaui-notifications:visit") return;
		let i = L(r.url);
		i !== void 0 && (t.ports[0]?.postMessage(!0), e && ne(i) ? e.visit(i, {}) : window.location.assign(i));
	}, ee = async (e, t, n = null) => {
		if (!(s === null || c !== null || e !== null && e.length === 0)) try {
			let r = await T(s);
			if (!r) return;
			let i = (e) => typeof e.timestamp != "number" || t === void 0 || e.timestamp <= t, a = (e) => {
				let t = N(e.data) ? e.data.context : void 0;
				return n === null || t === void 0 || t === n;
			};
			(e === null ? (await r.getNotifications()).filter((e) => It(e.tag) !== void 0 && i(e) && a(e)) : (await Promise.all(e.map((e) => r.getNotifications({ tag: e })))).flat()).forEach((e) => e.close());
		} catch {}
	}, V = (e) => {
		switch (e.kind) {
			case "item": return e.readAt !== null || e.archivedAt !== null ? ee([Ft(e.id)]) : Promise.resolve();
			case "items": return e.action === "read" || e.action === "archive" ? ee(e.ids.map(Ft)) : Promise.resolve();
			case "delete": return ee(e.ids.map(Ft));
			case "read":
			case "archive": return e.category === null && !(e.kind === "archive" && e.onlyRead) ? ee(null, Date.parse(e.before), t?.context() ?? null) : Promise.resolve();
			default: return Promise.resolve();
		}
	};
	return {
		subscribe(e) {
			return b.add(e), () => b.delete(e);
		},
		getSnapshot: () => y,
		connect(i, a, o, s) {
			if (e = i, t) return;
			t = a, n = o, r = s, c = Hn(), c === null && (navigator.serviceWorker.addEventListener("message", B), navigator.serviceWorker.startMessages(), navigator.permissions?.query({ name: "notifications" }).then((e) => e.addEventListener("change", z)).catch(() => {}), document.addEventListener("visibilitychange", z));
			let l = (e) => void V(e);
			a.onChange(l), a.onSaved(({ change: e }) => l(e)), a.subscribe(R), R();
		},
		async enable() {
			if (x() || s === null || c !== null || !e) return;
			let t = a, n = s;
			f = {
				action: "subscribe",
				status: "pending"
			}, S(), l = Notification.permission === "default" ? await Notification.requestPermission().catch(Wn) : Notification.permission, t === a && (l === "granted" && (p = !0, await C(async () => {
				if (t === a) try {
					await k(t, await E(n, await T(n)), n), t === a && (u = !0, F());
				} catch (e) {
					t === a && (u = !1, f = {
						action: "subscribe",
						status: A(e)
					});
				}
			})), t === a && (f = x() ? null : f, S()));
		},
		async disable() {
			if (x() || s === null || !e) return;
			let t = a, n = s;
			f = {
				action: "unsubscribe",
				status: "pending"
			}, S(), await C(async () => {
				if (t === a) try {
					let e = await (c === null ? await T(n) : void 0)?.pushManager.getSubscription();
					e && (await D(t, "push/unsubscribe", { endpoint: e.endpoint }), await e.unsubscribe().catch(() => {})), t === a && (u = !1, F());
				} catch {
					t === a && (f = {
						action: "unsubscribe",
						status: "failed"
					});
				}
			}), t === a && (f = x() ? null : f, S());
		},
		loadDevices: P,
		async removeDevice(e) {
			if (g.has(e) || !h?.some((t) => t.id === e)) return;
			let t = a;
			g.add(e), M();
			try {
				if (await D(t, `push/devices/${e}/delete`, {}), t !== a) return;
				h = h?.filter((t) => t.id !== e) ?? null, v++;
			} catch (e) {
				if (t !== a) return;
				r?.(e);
			}
			g.delete(e), M();
		},
		close: (e) => ee(e.map(Ft))
	};
}
var Jn = qn();
function Yn(e, t, n, r) {
	return (e ?? []).filter((e) => !e.current).map((e) => {
		let i = e.browser ?? we(t.pushDeviceUnknown), a = e.platform === null ? i : we(t.pushDeviceName, {
			browser: i,
			platform: e.platform
		});
		return {
			id: e.id,
			name: a,
			active: we(t.pushDeviceActive, { time: xt(e.activeAt, n, r) }),
			removeLabel: we(t.pushDeviceRemoveLabel, { device: a })
		};
	});
}
function Xn(e) {
	let t = e?.button;
	t && e?.state !== "busy" && (t.action === "subscribe" ? Jn.enable() : Jn.disable());
}
// ../js/toastStore.ts
var Zn = 1e3;
function Qn({ title: e, description: t }) {
	let n = e.length + (t?.length ?? 0);
	return Math.min(Math.max(2e3 + 60 * n, 5e3), 12e3);
}
function $n(e, t = {}) {
	return typeof t.duration == "function" ? t.duration(e) : e.type === "loading" || e.actions?.some((e) => !e.altText) || e.type === "error" && t.persistentErrors !== !1 ? null : typeof t.duration == "number" ? t.duration : e.type === "warning" ? Math.max(Qn(e), 8e3) : Qn(e);
}
function er(e) {
	return (e.type === "error" ? 0 : e.type === "warning" ? 2 : 4) + (e.actions.length > 0 ? 0 : 1);
}
var tr = (e) => e === void 0 || Number.isNaN(e) ? void 0 : Math.min(Math.max(e, 0), 1), nr = (e) => [...e.action ? [e.action] : [], ...e.actions ?? []], rr = {
	duration: !0,
	persistentErrors: !0,
	durationScale: !0,
	autoDismiss: !0,
	limit: !0,
	overflow: !0,
	dedupe: !0,
	removeDelay: !0
};
function ir(e = {}) {
	let t = {}, n = 0, r = 0, i = [], a = !1, o = /* @__PURE__ */ new Map(), s = /* @__PURE__ */ new Set(), c = /* @__PURE__ */ new Map(), l = /* @__PURE__ */ new Set(), u = [], d = () => {
		a && (a = !1, i = Array.from(o.values(), (e) => e.toast));
		for (let e of l) e();
		let e = u;
		u = [], e.forEach((e) => e());
	}, f = (e, t) => {
		e.toast = t, a = !0;
	}, p = (e, n) => {
		let r = n === void 0 ? $n(e, t) : n;
		return r === null || t.autoDismiss === !1 ? null : Math.round(r * (t.durationScale ?? 1));
	}, m = (e) => {
		e.handle !== void 0 && (clearTimeout(e.handle), e.handle = void 0, e.remaining -= Date.now() - e.startedAt);
	}, h = (e) => {
		let { timer: t } = e;
		if (!t) return;
		let n = (c.get(e.toast.toaster ?? "") ?? 0) > 0, r = e.toast.state === "visible" && s.size === 0 && e.holds.size === 0 && e.toast.pendingAction === void 0 && n;
		r && t.handle === void 0 ? (t.remaining = Math.max(t.remaining, Math.min(Zn, t.duration)), t.startedAt = Date.now(), t.handle = setTimeout(() => E(e.toast.id, "timeout"), t.remaining)) : r || m(t);
	}, g = (e) => {
		e.timer && m(e.timer);
		let { duration: t } = e.toast;
		e.timer = t === null ? void 0 : {
			duration: t,
			remaining: t,
			startedAt: 0
		}, h(e);
	}, _ = (e) => [...o.values()].filter((t) => t.toast.toaster === e.toast.toaster), v = () => Math.max(1, t.limit ?? 5), y = (e) => {
		clearTimeout(e.removal), o.delete(e.toast.id), a = !0;
		let { onRemove: t } = e.toast;
		t && u.push(t);
	}, b = (e, n) => {
		let r = e.toast.state === "queued";
		e.timer &&= (m(e.timer), void 0), f(e, {
			...e.toast,
			state: "closing",
			pendingAction: void 0
		});
		let { onClose: i } = e.toast;
		i && u.push(() => i(n)), r ? y(e) : e.removal = setTimeout(() => {
			y(e), d();
		}, t.removeDelay ?? 200);
	}, x = () => {
		let e = t.overflow === "hide" ? -1 : 1;
		for (let t of o.values()) {
			if (t.toast.state !== "queued") continue;
			let n = _(t), r = n.filter((e) => e.toast.state === "visible").length, i = n.filter((e) => e.toast.state === "queued").sort((t, n) => er(t.toast) - er(n.toast) || e * (t.sequence - n.sequence));
			for (let e of i) {
				if (r >= v()) break;
				r++, f(e, {
					...e.toast,
					state: "visible"
				}), h(e);
			}
		}
	}, S = (e) => {
		let n = _(e).filter((t) => t !== e && t.toast.state === "visible");
		if (n.length < v()) return "visible";
		if (t.overflow !== "drop-oldest" && t.overflow !== "hide") return "queued";
		let r = n.reduce((e, t) => er(t.toast) > er(e.toast) ? t : e);
		return t.overflow === "hide" ? (f(r, {
			...r.toast,
			state: "queued"
		}), h(r)) : b(r, "evicted"), "visible";
	}, C = (e, t, n, r, i) => {
		let a = {
			type: n.type ?? "default",
			title: t,
			description: n.description,
			actions: nr(n)
		};
		return {
			id: e,
			...a,
			duration: p(a, r),
			icon: n.icon,
			image: n.image,
			dismissible: n.dismissible ?? !0,
			position: n.position,
			toaster: n.toaster,
			politeness: n.politeness,
			data: n.data,
			progress: tr(n.progress),
			onClose: n.onClose,
			onRemove: n.onRemove,
			...i
		};
	}, w = (e, n) => {
		let r = n.type ?? "default";
		if (!(t.dedupe === !1 || n.id !== void 0 || r === "loading" || nr(n).length > 0 || n.data !== void 0)) return [...o.values()].find(({ toast: t }) => t.state !== "closing" && t.actions.length === 0 && t.data === void 0 && t.toaster === n.toaster && t.type === r && t.title === e && t.description === n.description);
	};
	function T(e, t = {}) {
		let i = t.id === void 0 ? void 0 : o.get(t.id);
		if (i && i.toast.state !== "closing") {
			let n = i.toast, r = C(n.id, e, t, t.duration, {
				count: 1,
				revision: n.revision,
				state: n.state
			});
			if (i.requested = t.duration, (r.type !== n.type || r.title !== n.title || r.description !== n.description) && r.revision++, f(i, r), n.onClose) {
				let { onClose: e } = n;
				u.push(() => e("replaced"));
			}
			return g(i), d(), n.id;
		}
		i && y(i);
		let a = w(e, t);
		if (a) return f(a, {
			...a.toast,
			count: a.toast.count + 1,
			revision: a.toast.revision + 1
		}), g(a), d(), a.toast.id;
		let s = t.id ?? `iui-toast-${++n}`, c = {
			toast: C(s, e, t, t.duration, {
				count: 1,
				revision: 1,
				state: "visible"
			}),
			requested: t.duration,
			holds: /* @__PURE__ */ new Set(),
			sequence: ++r
		};
		return o.set(s, c), f(c, {
			...c.toast,
			state: S(c)
		}), g(c), d(), s;
	}
	function E(e, t = "programmatic") {
		let n = e === void 0 ? [...o.values()] : [o.get(e)], r = !1;
		for (let e of n) e && e.toast.state !== "closing" && (b(e, t), r = !0);
		r && (x(), d());
	}
	function D(e, t) {
		let n = o.get(e);
		if (!n || n.toast.state === "closing") return;
		let { title: r, action: i, actions: a, ...s } = t, c = Object.fromEntries(Object.entries(s).filter(([, e]) => e !== void 0)), l = [
			"title",
			"type",
			"description",
			"duration",
			"action",
			"actions"
		].some((e) => e in t), u = {
			...n.toast,
			...c,
			title: r ?? n.toast.title
		};
		"description" in t && (u.description = t.description), t.progress !== void 0 && (u.progress = tr(t.progress)), (i !== void 0 || a !== void 0) && (u.actions = nr({
			action: i,
			actions: a
		})), "duration" in t && (n.requested = t.duration), l && (u.duration = p(u, n.requested), u.revision++);
		let m = u.toaster !== n.toast.toaster;
		f(n, u), m && u.state === "visible" && f(n, {
			...u,
			state: S(n)
		}), l ? g(n) : m && h(n), m && x(), d();
	}
	let O = {
		subscribe(e) {
			return l.add(e), () => l.delete(e);
		},
		getSnapshot: () => i,
		add: T,
		update: D,
		dismiss: E,
		pause(e = "manual", t) {
			let n = t === void 0 ? void 0 : o.get(t);
			if (t !== void 0) {
				n && !n.holds.has(e) && (n.holds.add(e), h(n), d());
				return;
			}
			let r = s.size === 0;
			s.add(e), r && (o.forEach(h), d());
		},
		resume(e = "manual", t) {
			if (t !== void 0) {
				let n = o.get(t);
				n?.holds.delete(e) && (h(n), d());
			} else s.delete(e) && s.size === 0 && (o.forEach(h), d());
		},
		timer(e) {
			let t = o.get(e)?.timer;
			if (!t) return;
			let n = t.handle !== void 0;
			return {
				duration: t.duration,
				remaining: n ? t.remaining - (Date.now() - t.startedAt) : t.remaining,
				running: n
			};
		},
		setPendingAction(e, t) {
			let n = o.get(e);
			n && n.toast.state !== "closing" && n.toast.pendingAction !== t && (f(n, {
				...n.toast,
				pendingAction: t
			}), h(n), d());
		},
		attach(e) {
			let t = e ?? "";
			c.set(t, (c.get(t) ?? 0) + 1), o.forEach(h), d();
			let n = !0;
			return () => {
				n && (n = !1, c.set(t, (c.get(t) ?? 1) - 1), o.forEach(h), d());
			};
		},
		configure(e) {
			let n = Object.entries(e).filter(([e, t]) => t !== void 0 && e in rr);
			t = {
				...t,
				...Object.fromEntries(n)
			}, e.limit !== void 0 && (x(), d());
		}
	};
	return O.configure(e), O;
}
// ../js/toast.ts
var Q = ir(), ar = 0;
Q.subscribe(() => ar++);
var or = () => ar, sr = 0;
function cr() {
	let e = `scope-${++sr}:`, t = /* @__PURE__ */ new Map();
	return {
		pause(n = "manual", r) {
			t.set(JSON.stringify([n, r ?? null]), [n, r]), Q.pause(e + n, r);
		},
		resume(n = "manual", r) {
			t.delete(JSON.stringify([n, r ?? null])), Q.resume(e + n, r);
		},
		release() {
			t.forEach(([t, n]) => Q.resume(e + t, n)), t.clear();
		}
	};
}
var lr = j, ur, dr = "requested", fr, pr, mr, hr = B((e, t) => {
	let n = t.id === void 0 ? void 0 : It(t.id);
	n !== void 0 && vt.panelOpen() ? vt.loadArrival(n).then((e) => e && Er(e)) : Q.add(e, t);
}), gr = (e) => hr(ee(e, lr)), _r = typeof window < "u", vr, yr = [
	403,
	419,
	429,
	"5xx",
	"network"
];
function br(e) {
	let t = (t) => {
		let n = e(t);
		return n === void 0 ? "" : we(n);
	};
	return Object.fromEntries(yr.map((e) => {
		let n = t(`error_toast_${e}`), r = t(`error_toast_${e}_description`);
		return [e, r === "" ? { title: n } : {
			title: n,
			description: r
		}];
	}));
}
var xr = br((e) => be[e]), Sr = () => ur && {
	...br(Ce),
	...ur
};
function Cr(e, t) {
	return (t[e] ?? (e >= 500 ? t["5xx"] : void 0)) || void 0;
}
function wr(e, t) {
	let { code: n, response: r } = e ?? {};
	if (n === "ERR_NETWORK") return t.network || void 0;
	if (n !== "ERR_HTTP_RESPONSE" || r?.status === void 0) return;
	let { status: i, headers: a } = r;
	if (!(a["x-inertia"] || a["x-inertia-location"] || i === 409 && a["x-inertia-redirect"] || a["x-inertiaui-toasts"])) return Cr(i, t);
}
var Tr = () => ({
	label: Te("inbox_toast_view"),
	altText: Te("inbox_toast_view_alt")
}), Er = (e) => {
	let t = Lt(e, dr, Tr());
	t && (typeof document < "u" && document.visibilityState === "visible" && Jn.close([e.id]), vt.panelOpen() || Q.getSnapshot().some((e) => e.id === t.options.id && e.state !== "closing") || Q.add(t.title, t.options));
}, Dr = (e) => document.visibilityState === "visible" && Q.getSnapshot().some((t) => t.id === Ft(e) && t.state !== "closing"), Or = () => Q.getSnapshot().filter((e) => It(e.id) !== void 0 && e.pendingAction === void 0).forEach((e) => Q.dismiss(e.id)), kr = (e) => {
	e.kind === "delete" ? e.ids.forEach((e) => Q.dismiss(Ft(e))) : e.kind === "update" && Q.update(Ft(e.item.id), Rt(e.item, Tr()));
}, Ar = (e) => {
	let t = It(e);
	t !== void 0 && X.markAsRead(t);
}, jr = (e, t, n) => {
	let r = It(e);
	return r === void 0 || n.result === void 0 ? void 0 : vt.completer(r, t);
};
function Mr(e, t = {}) {
	if (lr = t.flashKey ?? lr, Q.configure(t), dr = t.inbox?.arrivalToasts ?? dr, fr = t.inbox?.onArrival ?? fr, t.errorToasts !== void 0 && (ur = t.errorToasts === !1 ? void 0 : t.errorToasts === !0 ? {} : t.errorToasts), _r) {
		if (!vr) {
			vr = e;
			let t = (e) => (t) => {
				let n = Sr();
				n && wr(t, n) || Q.add(e(), { type: "error" });
			};
			X.connect(e, { onFailure: t(() => Te("inbox_update_failed")) }), kn.connect(e, { onFailure: t(() => Te("preferences_save_failed")) });
			let n = ({ url: e, user: t }) => e === void 0 ? void 0 : t ?? "", r = n(X.getSnapshot()), i = r !== void 0;
			X.subscribe(() => {
				let e = n(X.getSnapshot());
				e !== r && (i && kn.reset(X.getSnapshot().url), i ||= e !== void 0, r = e);
			}), Nr(e), X.onArrival((e) => fr?.(e)), X.onChange(kr), vt.onPanelOpened(Or), pr = Nt(vt, e, Er), mr = Wt(X), Jn.connect(e, vt, Dr, t(() => Te("preferences_push_device_remove_failed")));
		}
		X.connect(vr, { prop: t.inbox?.prop }), pr?.configure({
			echo: t.inbox?.echo,
			poll: t.inbox?.poll
		}), mr?.configure(t.inbox ?? {});
	}
}
function Nr(e) {
	e.onFlash(gr), e.onNavigate((e, t) => X.sync(e, t)), e.onRequest((e) => ne(e.url) ? {
		...e.headers,
		[M]: "1"
	} : e.headers), e.onResponse((e) => {
		gr(te(e)), hr(V(e.headers));
	}), e.onError((e) => {
		let t = e?.response;
		t?.headers && hr(V(t.headers));
		let n = Sr(), r = n && wr(e, n);
		r && Q.add(r.title, {
			type: "error",
			description: r.description
		});
	}), e.onHttpException((e) => {
		let t = Sr();
		return t && e.status !== void 0 && !e.headers["x-inertia"] && Cr(e.status, t) ? !1 : void 0;
	});
	let t = () => document.visibilityState === "hidden" ? Q.pause("hidden") : Q.resume("hidden");
	document.addEventListener("visibilitychange", t), t(), window.addEventListener("blur", () => Q.pause("blur")), window.addEventListener("focus", () => Q.resume("blur"));
}
var Pr = /* @__PURE__ */ new Map();
function Fr(e, t) {
	let n = Q.getSnapshot().find((t) => t.id === e), r = n?.actions[t];
	if (!n || !r || n.state === "closing" || n.pendingAction !== void 0) return;
	Ar(e);
	let i = jr(e, t, r), a = {}, o = () => {
		r.keepOpen ? Q.setPendingAction(e, void 0) : Q.dismiss(e, "action");
	}, s = le(r, n, vr, (n) => {
		Pr.get(e) === a && (Pr.delete(e), Q.getSnapshot().find((t) => t.id === e)?.pendingAction === t && (n ? o() : Q.setPendingAction(e, void 0)));
	}, i);
	s === "pending" ? (Pr.set(e, a), Q.setPendingAction(e, t)) : s === "done" && o();
}
function Ir(e, t, n) {
	let r = Q.getSnapshot().find((t) => t.id === e)?.actions[t];
	if (!r) return;
	let i = H(r), a = jr(e, t, r);
	if (i !== void 0 && ae(r, i, n)) {
		if (W(i, r, n, () => Ar(e), a), re(n)) return;
		r.event && window.dispatchEvent(new CustomEvent(r.event, { detail: r.payload })), r.keepOpen || Q.dismiss(e, "action");
	} else n.preventDefault(), Fr(e, t);
}
var Lr = (e, t) => _r ? Q.add(e, t) : t?.id ?? "", Rr = (e) => (t, n) => Lr(t, {
	...n,
	type: e
}), zr = (e, t, n, r) => {
	let { title: i, ...a } = typeof r == "string" ? { title: r } : r;
	return Lr(i, {
		...n,
		type: t,
		...a,
		id: e
	});
}, Br = (e, t, n, r, i) => {
	r === void 0 ? Q.getSnapshot().some((t) => t.id === e && t.type === "loading") && Q.dismiss(e) : zr(e, t, n, typeof r == "function" ? r(i) : r);
}, Vr = 0, Hr = Object.assign(Lr, {
	success: Rr("success"),
	info: Rr("info"),
	warning: Rr("warning"),
	error: Rr("error"),
	loading: Rr("loading"),
	update: (e, t) => Q.update(e, t),
	dismiss: (e) => Q.dismiss(e),
	promise(e, { loading: t, success: n, error: r, ...i }) {
		let a = zr(i.id ?? `iui-promise-${++Vr}`, "loading", i, t), o = (typeof e == "function" ? e() : e).then((e) => (typeof Response < "u" && e instanceof Response && !e.ok ? Br(a, "error", i, r, e) : Br(a, "success", i, n, e), e), (e) => {
			throw Br(a, "error", i, r, e), e;
		});
		return o.catch(() => {}), {
			id: a,
			unwrap: () => o
		};
	},
	track({ loading: e, success: t, error: n, ...r }, i) {
		let a = i ?? {}, o = r.id ?? `iui-track-${++Vr}`, s = !1;
		return {
			...i,
			onStart(t) {
				s = !1, e !== void 0 && zr(o, "loading", r, e), a.onStart?.(t);
			},
			onProgress(t) {
				let n = t?.progress;
				e !== void 0 && n !== void 0 && Q.update(o, { progress: n }), a.onProgress?.(t);
			},
			onSuccess(e) {
				s = !0, Br(o, "success", r, t, e), a.onSuccess?.(e);
			},
			onError(e) {
				s = !0, Br(o, "error", r, n, e), a.onError?.(e);
			},
			onFinish(e) {
				s || Q.dismiss(o), a.onFinish?.(e);
			}
		};
	},
	fromHeaders(e) {
		let t = e instanceof Headers ? e.get(M) : e["x-inertiaui-toasts"] ?? e["X-InertiaUI-Toasts"];
		_r && t && hr(V({ [M]: t }));
	}
}), Ur = ["F8"], Wr = [
	"altKey",
	"ctrlKey",
	"metaKey",
	"shiftKey"
], Gr = {
	altKey: "toaster_hotkey_alt",
	ctrlKey: "toaster_hotkey_ctrl",
	metaKey: "toaster_hotkey_meta",
	shiftKey: "toaster_hotkey_shift"
}, Kr = {
	width: "0",
	height: "0",
	margin: "0",
	padding: "0",
	border: "0",
	overflow: "visible",
	background: "none",
	color: "inherit",
	"pointer-events": "auto"
}, qr = 45, Jr = .11;
function Yr(e) {
	return e.map((e) => Object.hasOwn(Gr, e) ? Te(Gr[e]) : e.replace(/^(Key|Digit)/, "")).join(Te("toaster_hotkey_separator"));
}
function Xr(e, t) {
	let n = e ?? Te("toaster_label");
	return t.length > 0 ? Te("toaster_label_with_hotkey", {
		label: n,
		hotkey: Yr(t)
	}) : n;
}
function Zr(e, t) {
	return e === void 0 ? Te("toast_dismiss", { title: t.title }) : we(e, { title: t.title });
}
function Qr(e, t = {}) {
	let n = K(t, e) ?? Ce(`toast_type_${e}`);
	return n === void 0 ? "" : we(n);
}
function $r(e, t = {}) {
	let n = Qr(e.type, t), r = n ? `${n}: ${e.title}` : e.title, i = [/[.!?…]$/.test(r) ? r : `${r}.`];
	e.description && i.push(e.description);
	for (let t of e.actions) t.altText && i.push(t.altText);
	return i.join(" ");
}
function ei(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let r of [...e].reverse()) if (r.state !== "queued") {
		let e = r.position ?? t;
		n.set(e, [...n.get(e) ?? [], r]);
	}
	return k.filter((e) => n.has(e)).map((e) => [e, n.get(e)]);
}
var ti = 0;
function ni(e, t, n) {
	let { region: r, host: i } = t, a = p({
		polite: t.polite,
		assertive: t.assertive
	}), o = /* @__PURE__ */ new Map(), s = /* @__PURE__ */ new Map(), c = /* @__PURE__ */ new Map(), l = ++ti, u = {
		hover: `hover-${l}`,
		focus: `focus-${l}`,
		swipe: `swipe-${l}`
	}, d = null, f = null, m = 0, h = null, g = "pointer", _ = null, y = n().name, b = e.attach(y), x = () => e.getSnapshot().filter((e) => e.toaster === n().name && e.state !== "queued"), S = () => Array.from(r.querySelectorAll("[data-toast-list]")), C = (e) => r.querySelector(`[data-toast-id="${CSS.escape(e)}"]`), w = (e) => e instanceof Element ? e.closest("[data-toast-id]") ?? null : null, T = (e) => e.dataset.state !== "closing", E = () => x().reverse().map((e) => C(e.id)).filter((e) => e !== null && T(e)), D = (e) => (e.querySelector("[data-toast-body]")?.offsetHeight ?? e.offsetHeight) + (e.offsetHeight - e.clientHeight), O = () => {
		let { visibleToasts: e, expand: t } = n();
		for (let n of S()) {
			let r = Array.from(n.querySelectorAll(":scope > [data-toast-id]")).filter(T), i = 0;
			n.dataset.expanded = String(t || n === d || n.contains(document.activeElement)), r.forEach((t, n) => {
				let a = D(t);
				t.style.setProperty("--toast-index", String(n)), t.style.setProperty("--toast-before", `${i}px`), t.style.setProperty("--toast-height", `${a}px`), t.style.zIndex = String(r.length - n), t.dataset.front = String(n === 0), t.dataset.overflow = String(n >= e), t !== _?.item && (delete t.dataset.swipeOut, t.style.removeProperty("--toast-swipe")), i += a;
			}), n.style.setProperty("--toast-count", String(r.length)), n.style.setProperty("--toast-visible", String(Math.max(1, Math.min(r.length, e)))), n.style.setProperty("--toast-front-height", `${r[0] ? D(r[0]) : 0}px`), n.style.setProperty("--toast-heights", `${i}px`);
		}
	}, k = typeof ResizeObserver == "function" ? new ResizeObserver(() => O()) : void 0, A = /* @__PURE__ */ new WeakSet(), j = () => {
		let t = !v(), n = /* @__PURE__ */ new Set();
		for (let r of x()) {
			let i = C(r.id)?.querySelector("[data-toast-progress]"), a = e.timer(r.id);
			if (!i || !a) continue;
			n.add(r.id);
			let o = Math.max(0, a.remaining / a.duration);
			if (!t || typeof i.animate != "function") {
				c.get(r.id)?.animation?.cancel(), c.set(r.id, {
					key: "static",
					bar: i
				}), i.style.transform = `scaleX(${o})`;
				continue;
			}
			let s = a.running ? `run:${Math.round((Date.now() + a.remaining) / 50)}` : `pause:${Math.round(a.remaining)}`, l = c.get(r.id);
			if (l?.key === s && l.bar === i) continue;
			l?.animation?.cancel(), i.style.transform = `scaleX(${o})`;
			let u = a.running ? i.animate([{ transform: `scaleX(${o})` }, { transform: "scaleX(0)" }], {
				duration: a.remaining,
				easing: "linear",
				fill: "forwards"
			}) : void 0;
			c.set(r.id, {
				key: s,
				bar: i,
				animation: u
			});
		}
		for (let [e, t] of c) n.has(e) || (t.animation?.cancel(), c.delete(e));
	}, M = e.subscribe(j), N = () => {
		f = null, e.resume(u.focus);
	}, P = () => {
		let e = E(), t = g === "pointer" ? void 0 : e[Math.min(m, e.length - 1)], n = h;
		N(), t ? t.focus() : n?.isConnected && (h = null, n.focus({ preventScroll: !0 }));
	}, F = () => {
		f && (!f.isConnected || !T(f)) ? P() : r.contains(document.activeElement) || (h = null, N());
	}, I = (t) => {
		t.relatedTarget instanceof HTMLElement && !r.contains(t.relatedTarget) && (h = t.relatedTarget), f = w(t.target), m = f ? E().indexOf(f) : 0, e.pause(u.focus), O();
	}, L = () => void setTimeout(() => {
		F(), O();
	}), R = (t) => {
		g = "keyboard";
		let n = w(t.target);
		t.key === "Escape" && n?.dataset.toastId !== void 0 && n.dataset.dismissible !== "false" && (t.preventDefault(), e.dismiss(n.dataset.toastId, "escape"));
	}, z = (t) => {
		d !== t && (d = t, t ? e.pause(u.hover) : e.resume(u.hover), O());
	}, B = (e) => e instanceof Element ? e.closest("[data-toast-list]") ?? null : null, ee = (e) => {
		e.pointerType !== "touch" && z(B(e.target));
	}, V = (e) => {
		e.pointerType !== "touch" && B(e.relatedTarget) === null && z(null);
	}, te = (e) => {
		let t = e.closest("[data-toast-list]")?.dataset.position ?? "";
		return t.endsWith("right") ? "right" : t.endsWith("left") ? "left" : "both";
	}, H = (e, t) => {
		let n = te(e);
		return n === "both" || (n === "right" ? t > 0 : t < 0);
	}, ne = (e) => {
		if (g = e.pointerType === "touch" ? "touch" : "pointer", _?.active) return;
		let t = w(e.target), n = e.target instanceof Element && e.target.closest("a, button, input, select, textarea, [data-toast-no-swipe]");
		e.button === 0 && t && !n && t.dataset.dismissible !== "false" && T(t) && (_ = {
			item: t,
			pointerId: e.pointerId,
			x: e.clientX,
			time: Date.now(),
			dx: 0,
			active: !1
		});
	}, U = (t) => {
		if (!_ || t.pointerId !== _.pointerId) return;
		if (!_.active && (!(t.buttons & 1) || !_.item.isConnected || !T(_.item))) {
			_ = null;
			return;
		}
		let n = t.clientX - _.x;
		if (!_.active) {
			if (Math.abs(n) < 4) return;
			_.active = !0, _.item.dataset.swiping = "true";
			try {
				_.item.setPointerCapture(t.pointerId);
			} catch {}
			e.pause(u.swipe);
		}
		_.dx = n;
		let r = H(_.item, n) ? n : Math.sign(n) * Math.min(Math.abs(n) * .15, 8);
		_.item.style.setProperty("--toast-swipe", `${r}px`);
	}, re = (t) => {
		if (!_) return;
		let { item: n, dx: r, active: i } = _, a = n.dataset.toastId;
		_ = null, i && (delete n.dataset.swiping, e.resume(u.swipe), t && a !== void 0 ? (n.dataset.swipeOut = r > 0 ? "right" : "left", e.dismiss(a, "swipe")) : n.style.removeProperty("--toast-swipe"));
	}, ie = (e) => {
		if (!_ || e.pointerId !== _.pointerId) return;
		let t = Math.abs(_.dx) / Math.max(1, Date.now() - _.time), n = (window.getSelection?.()?.toString() ?? "") !== "";
		re(!n && H(_.item, _.dx) && (Math.abs(_.dx) >= qr || t > Jr));
	}, ae = (e) => {
		e.pointerId === _?.pointerId && re(!1);
	}, oe = (e) => {
		let t = (t) => {
			t.relatedTarget === e && t.stopImmediatePropagation();
		};
		ce && window.addEventListener("focusout", t, !0), e.focus(), window.removeEventListener("focusout", t, !0);
	}, se = (e) => {
		let { hotkey: t } = n(), i = t.length > 0 && t.every((t) => Wr.includes(t) ? e[t] : e.code === t), a = E()[0];
		i && a && (e.preventDefault(), g = "keyboard", document.activeElement instanceof HTMLElement && document.activeElement !== document.body && !r.contains(document.activeElement) && (h = document.activeElement), oe(a));
	}, W = [], ce = !1, le = (e) => e.isConnected && (e instanceof HTMLDialogElement ? e.open && e.matches(":modal") : ce && e.matches(":popover-open")), ue = (e) => e instanceof HTMLElement && e !== i && e.hasAttribute("popover") && /^(alert)?dialog$/.test(e.getAttribute("role") ?? ""), G = (e) => {
		let t = W.indexOf(e);
		t !== -1 && W.splice(t, 1);
	}, K = (e) => {
		let t = Array.from(i?.querySelectorAll("[data-toast-id]") ?? []);
		t.forEach((e) => e.style.transition = "none"), e(), i?.offsetWidth, t.forEach((e) => e.style.removeProperty("transition"));
	}, de = () => !!i?.isConnected && ce && !i.matches(":popover-open"), q = () => {
		if (i?.isConnected && ce) {
			i.matches(":popover-open") && i.hidePopover();
			try {
				i.showPopover();
			} catch {
				requestAnimationFrame(() => {
					de() && K(() => i.showPopover());
				});
			}
		}
	}, fe = () => {
		if (!i) return;
		let e = [...W].reverse().find(le) ?? document.body;
		i.parentElement === e ? de() && q() : K(() => {
			e.append(i), q();
		});
	}, pe = (e) => {
		G(e), e.open && e.matches(":modal") && W.push(e);
	}, me = (e) => {
		ue(e.target) && e.newState === "closed" && (G(e.target), fe());
	}, he = (e) => {
		ue(e.target) && e.newState === "open" && (G(e.target), W.push(e.target), fe());
	}, ge = (e) => e.stopPropagation(), J = (e) => {
		e.relatedTarget instanceof Node && r.contains(e.relatedTarget) && e.stopPropagation();
	}, _e = (e) => {
		let t = w(e.target);
		e.key === "Escape" && t && r.contains(t) && t.dataset.dismissible !== "false" && e.preventDefault();
	}, ve = (e) => {
		e.addEventListener("pointerdown", ge), e.addEventListener("focusin", ge), e.addEventListener("focusout", J), window.addEventListener("keydown", _e, !0), document.addEventListener("beforetoggle", me, !0), document.addEventListener("toggle", he, !0);
	}, ye = (e) => {
		e.removeEventListener("pointerdown", ge), e.removeEventListener("focusin", ge), e.removeEventListener("focusout", J), window.removeEventListener("keydown", _e, !0), document.removeEventListener("beforetoggle", me, !0), document.removeEventListener("toggle", he, !0);
	}, be = (e) => {
		let t = e && typeof i?.showPopover == "function";
		if (i && t !== ce) {
			if (ce = t, t) {
				ve(i), i.setAttribute("aria-live", "off"), i.setAttribute("popover", "manual"), Object.entries(Kr).forEach(([e, t]) => i.style.setProperty(e, t));
				for (let e of document.querySelectorAll("[popover]")) ue(e) && le(e) && W.push(e);
			} else ye(i), i.matches(":popover-open") && i.hidePopover(), i.removeAttribute("popover"), i.removeAttribute("aria-live"), Object.keys(Kr).forEach((e) => i.style.removeProperty(e)), W.splice(0, W.length, ...W.filter((e) => e instanceof HTMLDialogElement));
			fe();
		}
	}, xe = i && typeof MutationObserver == "function" ? new MutationObserver((e) => {
		for (let t of e) t.type === "attributes" && t.target instanceof HTMLDialogElement && pe(t.target);
		(e.some((e) => e.type === "attributes") || !i.isConnected) && fe();
	}) : void 0;
	return i && xe && (document.querySelectorAll("dialog[open]").forEach((e) => pe(e)), xe.observe(document.documentElement, {
		subtree: !0,
		childList: !0,
		attributes: !0,
		attributeFilter: ["open"]
	}), fe()), be(n().aboveModals), r.addEventListener("focusin", I), r.addEventListener("focusout", L), r.addEventListener("keydown", R), r.addEventListener("pointerdown", ne), r.addEventListener("pointermove", U), r.addEventListener("pointerup", ie), r.addEventListener("pointercancel", ae), r.addEventListener("pointerover", ee), r.addEventListener("pointerout", V), document.addEventListener("keydown", se), {
		update() {
			be(n().aboveModals), n().name !== y && (b(), y = n().name, b = e.attach(y));
			let t = x(), { typeLabels: r } = n(), i = !v();
			for (let e of t) {
				if (e.state === "closing") continue;
				o.get(e.id) !== e.revision && (o.set(e.id, e.revision), a.announce($r(e, r), e.politeness ?? (e.type === "error" ? "assertive" : "polite")));
				let t = C(e.id);
				t && i && e.count > (s.get(e.id) ?? e.count) && typeof t.animate == "function" && t.animate([
					{ scale: "1" },
					{ scale: "1.03" },
					{ scale: "1" }
				], {
					duration: 300,
					easing: "ease-out"
				}), s.set(e.id, e.count);
				let n = t?.querySelector("[data-toast-body]");
				n && k && !A.has(n) && (A.add(n), k.observe(n));
			}
			for (let e of [o, s]) for (let n of e.keys()) t.some((e) => e.id === n) || e.delete(n);
			F(), f && (m = E().indexOf(f)), _ && !_.item.isConnected && re(!1), d && !d.matches(":hover") && (d = null, e.resume(u.hover)), O(), j();
		},
		destroy() {
			r.removeEventListener("focusin", I), r.removeEventListener("focusout", L), r.removeEventListener("keydown", R), r.removeEventListener("pointerdown", ne), r.removeEventListener("pointermove", U), r.removeEventListener("pointerup", ie), r.removeEventListener("pointercancel", ae), r.removeEventListener("pointerover", ee), r.removeEventListener("pointerout", V), document.removeEventListener("keydown", se), be(!1), M(), k?.disconnect(), xe?.disconnect(), c.forEach((e) => e.animation?.cancel()), a.destroy(), e.resume(u.hover), e.resume(u.focus), e.resume(u.swipe), b();
		}
	};
}
// src/classes.ts
var ri = "iui-toast rounded-iui-toast border-iui-toast-border bg-iui-toast-surface text-iui-toast-foreground focus-visible:ring-iui-toast-ring border shadow-lg focus-visible:ring-2 focus-visible:outline-hidden", ii = "flex items-start gap-3 p-4", ai = {
	default: "text-iui-toast-default",
	info: "text-iui-toast-info",
	success: "text-iui-toast-success",
	warning: "text-iui-toast-warning",
	error: "text-iui-toast-error",
	loading: "text-iui-toast-loading"
}, oi = "bg-iui-toast-default size-2 rounded-full", si = "size-5 rounded-full object-cover", ci = "size-5 motion-safe:animate-spin", li = "text-sm font-medium wrap-break-word", ui = "rounded-iui-toast focus-visible:ring-iui-toast-ring inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium focus-visible:ring-2 focus-visible:outline-hidden aria-disabled:cursor-default aria-disabled:opacity-60";
`${ui}`, `${ui}`;
var di = "rounded-iui-inbox text-iui-inbox-icon hover:bg-iui-inbox-control-hover hover:text-iui-inbox-icon-hover focus-visible:ring-iui-inbox-ring aria-expanded:bg-iui-inbox-control-hover aria-expanded:text-iui-inbox-icon-hover relative inline-flex size-9 items-center justify-center focus-visible:ring-2 focus-visible:outline-hidden", fi = "iui-inbox-panel border-iui-inbox-border bg-iui-inbox-surface text-iui-inbox-foreground shadow-xl focus-visible:outline-hidden", pi = "iui-inbox-panel-body flex min-h-0 flex-1 flex-col", mi = "-me-1.5 flex items-center gap-1", hi = "inline-flex", gi = "text-iui-inbox-accent tabular-nums", _i = "min-h-0 flex-1 overflow-y-auto overscroll-contain", vi = "sticky top-0 z-20 flex h-0 justify-center", yi = "divide-iui-inbox-border divide-y", bi = "focus-visible:ring-iui-inbox-ring focus-visible:ring-2 focus-visible:ring-inset focus-visible:outline-hidden", xi = "group/item hover:bg-iui-inbox-control-hover/60 data-[selected=true]:bg-iui-inbox-control-hover/60 has-[[data-inbox-link]:focus-visible]:ring-iui-inbox-ring relative flex flex-wrap gap-3 px-4 py-3 has-[[data-inbox-link]:focus-visible]:ring-2 has-[[data-inbox-link]:focus-visible]:ring-inset", Si = "relative flex shrink-0 self-start", Ci = "bg-iui-inbox-control-hover text-iui-inbox-icon-hover flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-medium", wi = "text-iui-inbox-foreground text-sm wrap-break-word group-data-[read=false]/item:font-semibold", Ti = "after:absolute after:inset-0 focus-visible:outline-hidden", Ei = "text-iui-inbox-muted-foreground mt-1 block text-xs", Di = "text-iui-inbox-muted-foreground mt-1 flex items-center gap-1 text-xs", Oi = "rounded-md focus-visible:ring-iui-inbox-ring inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium focus-visible:ring-2 focus-visible:outline-hidden aria-disabled:cursor-default aria-disabled:opacity-60";
`${Oi}`;
var ki = `${Oi} border-iui-inbox-border bg-iui-inbox-surface hover:bg-iui-inbox-control-hover border`, Ai = "iui-inbox-controls border-iui-inbox-border z-10 flex shrink-0 items-center gap-0.5 rounded-md opacity-0 group-focus-within/item:opacity-100 group-hover/item:opacity-100 [@media(hover:none)]:opacity-100", ji = "border-iui-inbox-border flex shrink-0 items-center justify-between gap-3 border-t px-4 py-1.5", Mi = "text-iui-inbox-foreground flex items-center gap-2 text-sm font-medium", Ni = "accent-iui-inbox-accent size-4 cursor-pointer", Pi = "text-iui-inbox-icon hover:bg-iui-inbox-control-hover hover:text-iui-inbox-icon-hover focus-visible:ring-iui-inbox-ring rounded-md p-1.5 focus-visible:ring-2 focus-visible:outline-hidden [@media(hover:hover)]:p-1", Fi = "text-iui-inbox-muted-foreground flex flex-col items-center gap-3 px-6 py-12 text-center text-sm", Ii = "text-iui-inbox-icon size-8", Li = "text-iui-inbox-muted-foreground flex justify-center py-3", Ri = "overflow-x-auto", zi = "w-full border-collapse text-sm", Bi = "text-iui-inbox-muted-foreground px-4 py-2.5 text-start text-xs font-medium", Vi = "text-iui-inbox-muted-foreground w-20 px-2 py-2.5 text-center text-xs font-medium sm:w-24", Hi = "border-iui-inbox-border border-t", Ui = "min-w-36 px-4 py-3 text-start align-top font-normal", Wi = "text-iui-inbox-foreground me-2 font-medium", Gi = "px-2 py-3 text-center align-middle";
// ../js/inertia.ts
function Ki(e, t, n) {
	return {
		onFlash: (t) => void e.on("flash", (e) => t(e.detail.flash)),
		onRequest: (e) => void t.onRequest((t) => ({
			...t,
			headers: e(t)
		})),
		onResponse: (e) => void t.onResponse((t) => (e(t), t)),
		onError: (e) => void t.onError((t) => e(t)),
		onHttpException: (t) => void e.on("httpException", (e) => t(e.detail.response)),
		onNavigate: (t) => {
			let n;
			e.on("navigate", (e) => {
				n = e.detail.visitId, t(e.detail.page.props, e.detail.cached ? "cached" : e.detail.type);
			}), e.on("success", (e) => {
				(e.detail.visitId === void 0 || e.detail.visitId !== n) && t(e.detail.page.props, "visit");
			});
		},
		visit: (t, n) => e.visit(t, n),
		request: async (e, n, r) => {
			let i = await t.getClient().request({
				method: e,
				url: n,
				data: r === void 0 ? void 0 : JSON.stringify(r),
				headers: {
					Accept: "application/json",
					"Content-Type": "application/json",
					"X-Requested-With": "XMLHttpRequest"
				}
			});
			return i.data ? JSON.parse(i.data) : null;
		},
		useSocketId: (e) => n.resolveUsingDefault(() => e() ?? null)
	};
}
// src/notifications.ts
function qi(e) {
	Mr(Ki(C, S, w), e);
}
function Ji() {
	let e;
	try {
		e = T().flash;
	} catch {}
	r(() => {
		qi(), e && gr(e);
	}, []);
}
// src/parts.tsx
function Yi({ className: e }) {
	return /* @__PURE__ */ O("svg", {
		viewBox: "0 0 20 20",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: 2,
		"aria-hidden": "true",
		className: e,
		children: [/* @__PURE__ */ D("circle", {
			cx: "10",
			cy: "10",
			r: "7",
			opacity: "0.25"
		}), /* @__PURE__ */ D("path", {
			d: fe,
			strokeLinecap: "round"
		})]
	});
}
var Xi = (t) => typeof t == "function" || typeof t == "object" && !!t && "$$typeof" in t && !e(t);
function Zi(e, t) {
	return Xi(e) ? /* @__PURE__ */ D(e, {
		className: t,
		"aria-hidden": "true"
	}) : e;
}
function $({ name: e, context: t, icons: n, resolver: r, className: i }) {
	let a = ye(e, t, n, r);
	return a === void 0 ? e === "spinner" ? /* @__PURE__ */ D(Yi, { className: i }) : /* @__PURE__ */ D("svg", {
		viewBox: "0 0 20 20",
		fill: "currentColor",
		"aria-hidden": "true",
		className: i,
		children: K(ge, e)?.map((e) => /* @__PURE__ */ D("path", {
			fillRule: "evenodd",
			clipRule: "evenodd",
			d: e
		}, e))
	}) : Zi(a, i);
}
// src/Toaster.tsx
var Qi = [], $i = () => () => {};
function ea({ toast: t, icons: n, resolver: r }) {
	if (t.image !== void 0) return /* @__PURE__ */ D("img", {
		src: t.image,
		alt: "",
		className: si
	});
	if (e(t.icon)) return t.icon;
	let i = (e, i) => ye(e, {
		component: "Toaster",
		part: i,
		toast: t
	}, n, r), a = (typeof t.icon == "string" ? i(t.icon, "icon") : void 0) ?? i(t.type, "type");
	if (a !== void 0) return Zi(a, "size-5");
	if (t.type === "loading") return /* @__PURE__ */ D($, {
		name: "spinner",
		context: {
			component: "Toaster",
			part: "type",
			toast: t
		},
		icons: n,
		resolver: r,
		className: ci
	});
	let o = K(de, t.type);
	return o === void 0 ? /* @__PURE__ */ D("span", { className: oi }) : /* @__PURE__ */ D("svg", {
		viewBox: "0 0 20 20",
		fill: "currentColor",
		className: "size-5",
		children: /* @__PURE__ */ D("path", {
			fillRule: "evenodd",
			clipRule: "evenodd",
			d: o
		})
	});
}
function ta({ position: e = "bottom-right", name: t, label: n, dismissLabel: i, hotkey: l = Ur, typeLabels: u = {}, visibleToasts: d = 3, expand: f = !1, progress: p = !1, icons: m = {}, iconResolver: h, classes: g = {}, renderToast: _, renderIcon: v, components: y = {}, aboveModals: b = !0 }) {
	Ji();
	let x = s(Q.subscribe, Q.getSnapshot, () => Qi), S = s($i, () => !0, () => !1), [C] = o(() => typeof document > "u" ? null : Object.assign(document.createElement("div"), { className: "iui-toaster-host" })), w = a(null), T = a(null), k = a(null), A = a(null), j = a({
		name: t,
		hotkey: l,
		typeLabels: u,
		visibleToasts: d,
		expand: f,
		aboveModals: b
	});
	if (r(() => {
		j.current = {
			name: t,
			hotkey: l,
			typeLabels: u,
			visibleToasts: d,
			expand: f,
			aboveModals: b
		};
	}), r(() => {
		if (!C || !S) return;
		document.body.append(C);
		let e = ni(Q, {
			region: w.current,
			host: C,
			polite: T.current,
			assertive: k.current
		}, () => j.current);
		return A.current = e, () => {
			e.destroy(), A.current = null, C.remove();
		};
	}, [C, S]), r(() => A.current?.update()), !C || !S) return null;
	let M = ei(x.filter((e) => e.toaster === t), e), N = (e) => {
		let t = () => Q.dismiss(e.id, "user"), n = (t, n) => Ir(e.id, t, n.nativeEvent), r = K(y, e.type);
		if (r) return /* @__PURE__ */ D(r, {
			toast: e,
			dismiss: t,
			runAction: n
		});
		if (_) return _(e, {
			dismiss: t,
			runAction: n
		});
		let a = Qr(e.type, u);
		return /* @__PURE__ */ O(E, { children: [
			e.icon !== !1 && /* @__PURE__ */ D("span", {
				"aria-hidden": "true",
				className: G("flex size-5 shrink-0 items-center justify-center", K(ai, e.type) ?? ai.default, g.icon),
				children: v ? v(e) : /* @__PURE__ */ D(ea, {
					toast: e,
					icons: m,
					resolver: h
				})
			}),
			/* @__PURE__ */ O("div", {
				className: "min-w-0 flex-1",
				children: [
					/* @__PURE__ */ O("p", {
						className: G(li, g.title),
						children: [
							a && /* @__PURE__ */ O("span", {
								className: "sr-only",
								children: [a, ": "]
							}),
							e.title,
							e.count > 1 && /* @__PURE__ */ D("span", {
								"data-toast-count": !0,
								"aria-hidden": "true",
								className: "bg-iui-toast-control-hover text-iui-toast-muted-foreground ms-1.5 inline-block rounded-full px-1.5 text-xs font-medium tabular-nums",
								children: Te("toast_count", { count: e.count })
							})
						]
					}),
					e.description && /* @__PURE__ */ D("p", {
						className: G("text-iui-toast-muted-foreground mt-1 text-sm wrap-break-word", g.description),
						children: e.description
					}),
					e.progress !== void 0 && /* @__PURE__ */ D("div", {
						role: "progressbar",
						"aria-label": e.title,
						"aria-valuemin": 0,
						"aria-valuemax": 100,
						"aria-valuenow": Math.round(e.progress * 100),
						"data-toast-progressbar": "",
						className: "bg-iui-toast-control-hover mt-2 h-1.5 overflow-hidden rounded-full",
						children: /* @__PURE__ */ D("div", {
							className: G("h-full rounded-full bg-current transition-[width] duration-300 motion-reduce:transition-none", K(ai, e.type) ?? ai.default),
							style: { width: `${e.progress * 100}%` }
						})
					}),
					e.actions.length > 0 && /* @__PURE__ */ D("div", {
						className: G("mt-3 flex flex-wrap gap-2", g.actions),
						children: e.actions.map((t, r) => {
							let i = H(t), a = {
								"aria-disabled": e.pendingAction !== void 0 || void 0,
								"aria-busy": e.pendingAction === r || void 0,
								"data-toast-action": "",
								className: G(r === 0 ? "rounded-iui-toast focus-visible:ring-iui-toast-ring inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium focus-visible:ring-2 focus-visible:outline-hidden aria-disabled:cursor-default aria-disabled:opacity-60 border-iui-toast-action text-iui-toast-action hover:bg-iui-toast-action/10 border" : "rounded-iui-toast focus-visible:ring-iui-toast-ring inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium focus-visible:ring-2 focus-visible:outline-hidden aria-disabled:cursor-default aria-disabled:opacity-60 border-iui-toast-border hover:bg-iui-toast-control-hover border", g.action),
								onClick: (e) => n(r, e)
							}, o = /* @__PURE__ */ O(E, { children: [e.pendingAction === r && /* @__PURE__ */ D($, {
								name: "spinner",
								context: {
									component: "Toaster",
									part: "action",
									toast: e,
									action: t
								},
								icons: m,
								resolver: h,
								className: "size-3.5 motion-safe:animate-spin"
							}), t.label] });
							return i === void 0 ? /* @__PURE__ */ D("button", {
								type: "button",
								...a,
								children: o
							}, r) : /* @__PURE__ */ D("a", {
								href: i,
								target: t.newTab ? "_blank" : void 0,
								rel: t.newTab ? "noopener noreferrer" : void 0,
								...a,
								children: o
							}, r);
						})
					})
				]
			}),
			e.dismissible && /* @__PURE__ */ D("button", {
				type: "button",
				"aria-label": Zr(i, e),
				className: G("rounded-iui-toast text-iui-toast-icon hover:bg-iui-toast-control-hover hover:text-iui-toast-icon-hover focus-visible:ring-iui-toast-ring -m-1 shrink-0 p-1 focus-visible:ring-2 focus-visible:outline-hidden", g.dismiss),
				onClick: t,
				children: /* @__PURE__ */ D($, {
					name: "dismiss",
					context: {
						component: "Toaster",
						part: "dismiss",
						toast: e
					},
					icons: m,
					resolver: h,
					className: "size-4"
				})
			})
		] });
	};
	return c(/* @__PURE__ */ O("section", {
		ref: w,
		"aria-label": Xr(n, l),
		tabIndex: -1,
		className: "iui-toaster outline-none",
		"data-toaster": t,
		children: [
			M.map(([e, t]) => /* @__PURE__ */ D("ol", {
				role: "list",
				"data-toast-list": "",
				"data-position": e,
				className: "iui-toast-list",
				children: t.map((e) => /* @__PURE__ */ O("li", {
					"data-toast-id": e.id,
					"data-type": e.type,
					"data-state": e.state,
					"data-dismissible": String(e.dismissible),
					"aria-busy": e.type === "loading" || void 0,
					tabIndex: 0,
					className: G(ri, g.toast),
					children: [/* @__PURE__ */ D("div", {
						"data-toast-body": "",
						className: ii,
						children: N(e)
					}), p && e.duration !== null && /* @__PURE__ */ D("div", {
						"data-toast-progress": "",
						"aria-hidden": "true",
						className: G("iui-toast-progress", K(ai, e.type) ?? ai.default, g.progress)
					})]
				}, e.id))
			}, e)),
			/* @__PURE__ */ D("div", {
				ref: T,
				role: "status",
				"aria-live": "polite",
				"aria-atomic": "true",
				className: "sr-only"
			}),
			/* @__PURE__ */ D("div", {
				ref: k,
				"aria-live": "assertive",
				"aria-atomic": "true",
				className: "sr-only"
			})
		]
	}), C);
}
// ../js/notificationCenter.ts
var na = [
	"all",
	"unread",
	"snoozed",
	"archived"
], ra = {
	all: "empty",
	unread: "emptyUnread",
	snoozed: "emptySnoozed",
	archived: "emptyArchived"
}, ia = (e) => [...na, ...Object.keys(e)], aa = (e) => ia(e.tabs).filter((t) => Ne(t, e.allowedActions));
function oa(e, t, n) {
	return Object.hasOwn(ra, e) ? Z(t[e]) : Object.hasOwn(n, e) ? n[e].label : e;
}
var sa = (e, t) => Z(t[Object.hasOwn(ra, e) ? ra[e] : "empty"]), ca = (e, t, n) => e.map((e) => ({
	filter: e,
	label: oa(e, n, t.tabs),
	selected: t.filter === e,
	count: e === "unread" ? t.counts.unread : null
})), la = (e, t) => t.length > 0 ? e.filter((e) => !t.includes(e.id)) : e;
function ua(e, t) {
	return e.status === "idle" || e.status === "loading" && t === 0 ? "loading" : e.status === "error" ? "error" : t === 0 ? "empty" : "items";
}
function da(e, t = e.category) {
	Ie({
		...e,
		category: t
	}) > 0 && X.markAllAsRead({ category: t });
}
var fa = (e) => e.filter === "all" && e.allowedActions.includes("archive");
function pa(e, t) {
	e.length > 0 && X.archiveAll({ category: t });
}
function ma(e, t, n, r) {
	let i = new URL(e, "http://localhost"), a = i.searchParams;
	return a.delete("filter"), a.delete("category"), r !== void 0 && a.delete(r), t !== "all" && a.set("filter", t), n !== null && a.set("category", n), `${i.pathname}${i.search}`;
}
function ha(e, t, n, r) {
	let i = new URL(e, "http://localhost").searchParams, a = i.get("filter");
	return {
		filter: n ?? (a !== null && aa(t).includes(a) ? a : "all"),
		category: r === void 0 ? i.get("category") || null : r
	};
}
var ga = (e, t, n, r) => Z(e.pausedUntil, { time: mt(t, n, r) }), _a = (e, t, n) => mt(ft(e.preset, new Date(t)), t, n);
function va(e, t) {
	let n = !t.includes("snooze") || e === "archived" ? [] : [e === "snoozed" ? {
		action: "unsnooze",
		icon: "unsnooze",
		label: "unsnoozeSelected"
	} : {
		action: "snooze",
		icon: "snooze",
		label: "snoozeSelected"
	}], r = t.includes("archive") ? [e === "archived" ? {
		action: "unarchive",
		icon: "unarchive",
		label: "unarchiveSelected"
	} : {
		action: "archive",
		icon: "archive",
		label: "archiveSelected"
	}] : [], i = t.includes("delete") ? [{
		action: "delete",
		icon: "delete",
		label: "deleteSelected"
	}] : [];
	return [
		{
			action: "read",
			icon: "read",
			label: "readSelected"
		},
		{
			action: "unread",
			icon: "unread",
			label: "unreadSelected"
		},
		...n,
		...r,
		...i
	];
}
var ya = (e, t, n = /* @__PURE__ */ new Date()) => e ? e(n) : lt(t, n);
function ba(e, t, n) {
	let r = e.filter((e) => e !== t);
	return n ? [...r, t] : r;
}
function xa(e, t, { scroller: n, listed: r }) {
	let i = [], a = (e) => {
		i = e, t(e);
	}, o = n ?? window, s = () => n ? n.scrollTop > 0 : e.getBoundingClientRect().top < 0, c = X.onArrival((t) => {
		let n = e.querySelector(`[data-inbox-id="${CSS.escape(t.id)}"]`) !== null;
		s() && r(t.id) && !n && !i.includes(t.id) && a([...i, t.id]);
	}), l = X.subscribe(() => {
		let e = i.filter(r);
		e.length < i.length && a(e);
	}), u = () => {
		!s() && i.length > 0 && a([]);
	};
	return o.addEventListener("scroll", u, { passive: !0 }), {
		reveal() {
			n ? n.scrollTop = 0 : window.scrollBy({ top: e.getBoundingClientRect().top }), a([]), requestAnimationFrame(() => e.querySelector("[data-inbox-item]")?.focus({ preventScroll: !0 }));
		},
		release() {
			n && (n.scrollTop = 0), i.length > 0 && a([]);
		},
		destroy() {
			c(), l(), o.removeEventListener("scroll", u);
		}
	};
}
var Sa = 1e3, Ca = 250;
function wa(e, t, n = e) {
	let r = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Set(), a = [], o, s = () => {
		o = void 0;
		let e = a, n = t().filter((t) => e.includes(t.id));
		a = [], n.length > 0 && X.batch("seen", n);
	}, c = (e) => {
		clearTimeout(r.get(e)), r.delete(e);
	}, l = (e) => {
		r.delete(e);
		let t = e.dataset.inboxId;
		t !== void 0 && e.dataset.seen === "false" && e.isConnected && (u.unobserve(e), i.delete(e), a.push(t), o ??= setTimeout(s, Ca));
	}, u = new IntersectionObserver((e) => {
		for (let t of e) {
			let e = t.target, n = t.rootBounds !== null && t.intersectionRect.height >= t.rootBounds.height / 2;
			t.isIntersecting && (t.intersectionRatio >= .5 || n) ? r.set(e, r.get(e) ?? setTimeout(() => l(e), Sa)) : c(e);
		}
	}, {
		root: n,
		threshold: [
			0,
			.5,
			1
		]
	}), d = () => {
		for (let e of i) e.isConnected && e.dataset.seen === "false" || (u.unobserve(e), i.delete(e), c(e));
		for (let t of e.querySelectorAll("[data-inbox-item][data-seen=\"false\"]")) i.has(t) || (i.add(t), u.observe(t));
	}, f = new MutationObserver(d);
	return f.observe(e, {
		childList: !0,
		subtree: !0,
		attributes: !0,
		attributeFilter: ["data-seen"]
	}), d(), { destroy() {
		f.disconnect(), u.disconnect(), r.forEach((e) => clearTimeout(e)), o !== void 0 && (clearTimeout(o), s());
	} };
}
function Ta(e, t) {
	let n = (e.target instanceof Element ? e.target : null)?.closest("[data-inbox-link], [data-inbox-action]"), r = n?.closest("[data-inbox-item]")?.dataset.inboxId, i = r === void 0 ? void 0 : t.find((e) => e.id === r);
	if (!n || !i) return;
	if (!n.hasAttribute("data-inbox-action")) return { item: i };
	let a = n.getAttribute("data-inbox-action"), o = a ? i.actions[Number(a)] : void 0;
	return o ? {
		item: i,
		action: o
	} : void 0;
}
var Ea = 160, Da = [
	"position",
	"box-sizing",
	"inset",
	"top",
	"right",
	"bottom",
	"left",
	"margin",
	"max-width",
	"max-height",
	"height",
	"overflow-x",
	"overflow-y",
	"overscroll-behavior"
];
function Oa(e, t, n) {
	let r, i = null, a, o = t.querySelector("[data-inbox-scroller]"), s = o !== null && typeof ResizeObserver == "function" ? new ResizeObserver(() => {
		o.offsetHeight > 0 && o.querySelector(":scope > [role=\"status\"]") === null && t.style.setProperty("--inbox-list-height", `${o.offsetHeight}px`);
	}) : void 0;
	o !== null && s?.observe(o);
	let c = (e, n) => {
		let r = Number.parseFloat(getComputedStyle(t).getPropertyValue(e));
		return Number.isFinite(r) ? r : n;
	}, l = () => {
		if (!t.matches(":popover-open")) return;
		if (getComputedStyle(t).getPropertyValue("--inbox-layout").trim() === "sheet") {
			a?.(), a = void 0, Da.forEach((e) => t.style.removeProperty(e)), delete t.dataset.side;
			return;
		}
		let { placement: r } = _(e, t, {
			placement: n.placement(),
			offset: c("--inbox-gap", 8),
			viewportMargin: c("--inbox-offset", 8),
			anchorPositioning: !1
		});
		t.dataset.side = r.split("-")[0], a ??= d(e, t, l);
	}, u = () => void (a === void 0 && l()), f = (e) => {
		e.newState === "open" && requestAnimationFrame(() => a === void 0 && l());
	}, p = (r) => {
		let i = r.newState === "open";
		i ? (a === void 0 && l(), window.addEventListener("resize", u), t.contains(document.activeElement) || t.focus({ preventScroll: !0 })) : (a?.(), a = void 0, window.removeEventListener("resize", u)), e.setAttribute("aria-expanded", String(i)), n.onToggle(i);
	}, m = (n) => {
		let r = n.relatedTarget;
		r instanceof Node && !t.contains(r) && !e.contains(r) && t.matches(":popover-open") && t.hidePopover();
	};
	return t.addEventListener("beforetoggle", f), t.addEventListener("toggle", p), t.addEventListener("focusout", m), {
		observe(e) {
			let t = e?.closest("[data-inbox-scroller]") ?? null;
			r && t === i || (r?.disconnect(), i = t, r = typeof IntersectionObserver == "function" ? new IntersectionObserver((e) => {
				e.some((e) => e.isIntersecting) && n.onEndReached();
			}, {
				root: t,
				rootMargin: `0px 0px ${Ea}px 0px`
			}) : void 0), r?.disconnect(), e && r?.observe(e);
		},
		place: l,
		close() {
			t.matches(":popover-open") && t.hidePopover();
		},
		destroy() {
			r?.disconnect(), s?.disconnect(), a?.(), t.removeEventListener("beforetoggle", f), t.removeEventListener("toggle", p), t.removeEventListener("focusout", m), window.removeEventListener("resize", u);
		}
	};
}
var ka = {
	j: "next",
	arrowdown: "next",
	k: "previous",
	arrowup: "previous",
	u: "read",
	e: "archive",
	h: "snooze",
	x: "select",
	enter: "open"
}, Aa = {
	read: "[data-inbox-toggle-read]",
	archive: "[data-inbox-toggle-archive]",
	snooze: "[data-inbox-snooze]",
	select: "[data-inbox-select]",
	open: "[data-inbox-link]"
};
function ja(e, t) {
	let n = ka[e.key.toLowerCase()], r = e.target instanceof HTMLElement ? e.target : null;
	if (!n || !r || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || r.closest("input:not([type=\"checkbox\"]), textarea, select, [contenteditable]:not([contenteditable=\"false\"]), [role=\"tab\"]")) return;
	let i = [...t.querySelectorAll("[data-inbox-item]")], a = r.closest("[data-inbox-item]"), o = a ? i.indexOf(a) : -1;
	if ((n === "open" || e.key.startsWith("Arrow")) && r !== a && r !== t) return;
	if (n === "next" || n === "previous") {
		let t = i[n === "next" ? o + 1 : o - 1];
		t && (e.preventDefault(), t.focus());
		return;
	}
	let s = a?.querySelector(Aa[n]);
	a && s && (e.preventDefault(), s.click());
}
function Ma(e, t = () => e) {
	let n, r = (t) => e.querySelector(`[data-inbox-item][data-inbox-id="${CSS.escape(t)}"]`), i = () => Array.from(e.querySelectorAll("[data-inbox-item]"), (e) => e.dataset.inboxId ?? ""), a = () => {
		let t = document.activeElement, r = t instanceof HTMLElement && e.contains(t) ? t.closest("[data-inbox-item]")?.dataset.inboxId : void 0;
		n = r === void 0 ? void 0 : {
			id: r,
			order: i()
		};
	}, o = (t) => {
		let r = t.target;
		t.relatedTarget instanceof Node && e.contains(t.relatedTarget) || queueMicrotask(() => {
			r.isConnected && !e.contains(document.activeElement) && (n = void 0);
		});
	}, s = typeof MutationObserver == "function" ? new MutationObserver(() => {
		let e = document.activeElement;
		if (n && (e === null || e === document.body)) {
			let { id: e, order: i } = n, a = i.indexOf(e), o = [
				e,
				...i.slice(a + 1),
				...i.slice(0, a).reverse()
			].map(r).find((e) => e !== null);
			(o ?? t())?.focus({ preventScroll: o === void 0 });
		}
		a();
	}) : void 0;
	return e.addEventListener("focusin", a), e.addEventListener("focusout", o), s?.observe(e, {
		childList: !0,
		subtree: !0
	}), () => {
		e.removeEventListener("focusin", a), e.removeEventListener("focusout", o), s?.disconnect();
	};
}
function Na(e, t, n, r, i = !1) {
	let a = t > 0 ? Z(e.bellNew, {
		count: St(t, n, r),
		number: t
	}) : Z(e.bell);
	return i ? Z(e.bellPaused, { label: a }) : a;
}
function Pa(e) {
	return e.trim().split(/\s+/).slice(0, 2).map((e) => Array.from(e)[0]?.toLocaleUpperCase() ?? "").join("");
}
function Fa(e, t, n, r = !1) {
	let i = n.indexOf(t), a = {
		ArrowRight: r ? -1 : 1,
		ArrowLeft: r ? 1 : -1
	}[e];
	return a === void 0 ? e === "Home" ? n[0] : e === "End" ? n.at(-1) : void 0 : n[(i + a + n.length) % n.length];
}
// ../js/overlay.ts
var Ia = () => typeof HTMLElement < "u" && "showPopover" in HTMLElement.prototype, La = null;
function Ra(e) {
	let t = null, n = (n) => {
		n && La !== t ? (La?.hide(), La = t) : !n && La === t && (La = null), e.onOpenChange(n);
	}, r = (t) => {
		let n = e.tooltip();
		if (n) return f(n), v() ? void 0 : u(n, t ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }], {
			duration: t ? 150 : 75,
			easing: t ? "out" : "in"
		});
	}, i = () => t ??= h({
		...e,
		onOpenChange: n,
		onMount: ({ popover: e }) => () => f(e),
		transition: r
	});
	return {
		native: Ia(),
		onPointerEnter: (e) => {
			e.pointerType !== "touch" && i().onMouseEnter();
		},
		onPointerLeave: () => t?.onMouseLeave(),
		onPointerDown: () => void t?.hide(),
		onFocusIn: (e) => {
			e.target instanceof Element && e.target.matches(":focus-visible") && i().onFocusIn();
		},
		onFocusOut: (e) => t?.onFocusOut(e),
		mount: () => t?.mount(),
		cleanup: () => {
			t?.cleanup(), La === t && (La = null);
		}
	};
}
// src/Tooltip.tsx
function za({ text: e, shortcut: t, children: n }) {
	let [i, s] = o(!1), c = a(null), l = a(null), u = a(null), d = () => u.current ??= Ra({
		reference: () => c.current,
		tooltip: () => l.current,
		onOpenChange: s
	});
	return r(() => () => u.current?.cleanup(), []), r(() => {
		i && u.current?.mount();
	}, [i]), /* @__PURE__ */ O("span", {
		ref: c,
		className: hi,
		onPointerEnter: (e) => d().onPointerEnter(e.nativeEvent),
		onPointerLeave: () => d().onPointerLeave(),
		onPointerDown: () => d().onPointerDown(),
		onFocus: (e) => d().onFocusIn(e.nativeEvent),
		onBlur: (e) => d().onFocusOut(e.nativeEvent),
		children: [n, i && /* @__PURE__ */ O("span", {
			ref: l,
			role: "tooltip",
			popover: Ia() ? "manual" : void 0,
			"data-inbox-tooltip": "",
			className: "bg-iui-inbox-tooltip text-iui-inbox-tooltip-foreground pointer-events-none m-0 flex w-max max-w-xs items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium shadow-md",
			children: [e, t && /* @__PURE__ */ D("kbd", {
				className: "inline-block h-4 min-w-4 content-center rounded border border-current/30 px-1 text-center font-sans text-[0.625rem] leading-none opacity-80 [text-box:trim-both_cap_alphabetic]",
				children: t
			})]
		})]
	});
}
// src/InboxHeader.tsx
function Ba({ component: e, state: i, filter: s, category: c, items: l, labels: u, icons: d, iconResolver: f, classes: p, locale: h, maxCount: _ = 99, now: v, panel: y, href: b, open: S = !0, renderHeader: C, renderTab: w }) {
	let T = n(), k = n(), A = (e) => Z(u[e]), j = aa(i), M = [[null, A("allCategories")], ...Object.entries(i.categoryFilter)], N = M.length > 1, P = Ie({
		...i,
		category: c
	}), F = fa({
		filter: s,
		allowedActions: i.allowedActions
	}), I = s === "all" || s === "unread", L = F || i.canPause, R = I || L, z = (t) => ({
		component: e,
		part: t
	}), B = a(null), ee = a(null), [V, te] = o(!1), H = pt(i.pausePresets, u, h), ne = a(null), U = () => ne.current ??= m({
		reference: () => B.current,
		popover: () => ee.current,
		position: {
			placement: "bottom-end",
			offset: 4
		},
		menu: !0,
		onOpenChange: te
	});
	r(() => {
		let e = ne.current;
		if (V && e) return e.mount(), () => e.cleanup();
	}, [V]), t(() => ne.current?.close(!1), [S]);
	let re = (e) => void X.pause(ft(e.preset)), ie = (e) => {
		let t = e.currentTarget.closest("[data-inbox-panel], [data-inbox-list]");
		X.resume(), (B.current ?? t)?.focus();
	}, ae = () => da(i, c), oe = () => pa(l, c), se = (e, t) => void X.load(e, t), W = (e) => {
		let t = g(e.currentTarget), n = Fa(e.key, s, j, t);
		n !== void 0 && y && (e.preventDefault(), se(n, c), document.getElementById(y.tabId(n))?.focus());
	}, ce = (e) => w ? w(e) : /* @__PURE__ */ O(E, { children: [
		e.label,
		" ",
		e.count !== null && e.count > 0 && /* @__PURE__ */ D("span", {
			className: "bg-iui-inbox-accent-subtle text-iui-inbox-accent rounded-full px-1.5 text-xs/5 tabular-nums",
			children: St(e.count, _, h)
		})
	] }), le = (e) => j.length > 1 && b && /* @__PURE__ */ D("div", {
		className: e,
		children: ca(j, {
			...i,
			filter: s
		}, u).map((e) => /* @__PURE__ */ D(x, {
			href: b(e.filter, c),
			"aria-current": e.selected ? "page" : void 0,
			"data-inbox-tab": e.filter,
			className: "text-iui-inbox-muted-foreground hover:text-iui-inbox-foreground focus-visible:ring-iui-inbox-ring aria-selected:border-iui-inbox-accent aria-selected:text-iui-inbox-accent aria-[current=page]:border-iui-inbox-accent aria-[current=page]:text-iui-inbox-accent -mb-px inline-flex items-center gap-1.5 rounded-t-md border-b-2 border-transparent px-1.5 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:outline-hidden focus-visible:ring-inset",
			children: ce(e)
		}, e.filter))
	}), ue = (e, t) => /* @__PURE__ */ O(E, { children: [
		t,
		" ",
		e !== null && i.categoryCounts[e] ? /* @__PURE__ */ D("span", {
			className: gi,
			children: St(i.categoryCounts[e], _, h)
		}) : null
	] });
	return /* @__PURE__ */ O(E, { children: [
		C ? C({
			...y && {
				titleId: y.titleId,
				title: y.title,
				close: y.close
			},
			filter: s,
			category: c,
			unread: P,
			markAllAsRead: ae,
			canArchiveAll: F,
			archiveAll: oe,
			allowedActions: i.allowedActions,
			canPause: i.canPause,
			pausedUntil: i.pausedUntil,
			pauseOptions: H,
			pause: re,
			resume: () => void X.resume()
		}) : /* @__PURE__ */ D(E, { children: (y || j.length > 1 || R) && /* @__PURE__ */ O("div", {
			className: y ? "flex items-center justify-between gap-3 px-4 pt-3 pb-1" : "border-iui-inbox-border flex flex-wrap-reverse items-stretch border-b pe-4",
			children: [
				y && /* @__PURE__ */ D("h2", {
					id: y.titleId,
					className: "text-base font-semibold",
					children: y.title
				}),
				le("iui-inbox-fade border-iui-inbox-border -mb-px flex min-w-0 flex-auto gap-1 overflow-x-auto border-b ps-2.5 pe-8 scrollbar-none"),
				R && /* @__PURE__ */ O("div", {
					className: y ? "-me-1.5 flex items-center gap-1" : "-me-1.5 flex shrink-0 items-center gap-1 py-2 ps-2.5",
					children: [I && /* @__PURE__ */ D("button", {
						type: "button",
						"data-inbox-read-all": "",
						"aria-disabled": P === 0 || void 0,
						className: "text-iui-inbox-muted-foreground hover:text-iui-inbox-foreground focus-visible:ring-iui-inbox-ring rounded-md px-1.5 py-1 text-xs font-medium focus-visible:ring-2 focus-visible:outline-hidden aria-disabled:pointer-events-none aria-disabled:opacity-50",
						onClick: ae,
						children: A("markAllAsRead")
					}), L && /* @__PURE__ */ O(E, { children: [/* @__PURE__ */ D(za, {
						text: A("moreActions"),
						children: /* @__PURE__ */ D("button", {
							ref: B,
							type: "button",
							"data-inbox-menu-button": "",
							"aria-haspopup": "menu",
							"aria-label": A("moreActions"),
							"aria-expanded": V,
							"aria-controls": V ? T : void 0,
							className: G("text-iui-inbox-icon hover:bg-iui-inbox-control-hover hover:text-iui-inbox-icon-hover focus-visible:ring-iui-inbox-ring rounded-md p-1.5 focus-visible:ring-2 focus-visible:outline-hidden [@media(hover:hover)]:p-1", p.control),
							onClick: (e) => U().toggle(e.nativeEvent),
							onPointerDown: () => U().onPointerDown(),
							onKeyDown: (e) => U().onKeydown(e.nativeEvent),
							onBlur: (e) => U().onFocusOut(e.nativeEvent),
							children: /* @__PURE__ */ D($, {
								name: "more",
								context: z("more-actions"),
								icons: d,
								resolver: f,
								className: "size-4"
							})
						})
					}), V && /* @__PURE__ */ O("div", {
						id: T,
						ref: ee,
						role: "menu",
						"aria-label": A("moreActions"),
						popover: Ia() ? "auto" : void 0,
						"data-inbox-menu": "",
						className: "border-iui-inbox-border bg-iui-inbox-surface text-iui-inbox-foreground rounded-iui-inbox m-0 w-max min-w-48 border p-1 shadow-lg",
						children: [
							F && /* @__PURE__ */ O("button", {
								type: "button",
								role: "menuitem",
								"data-inbox-archive-all": "",
								"aria-disabled": l.length === 0 || void 0,
								className: "hover:bg-iui-inbox-control-hover focus-visible:bg-iui-inbox-control-hover flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm outline-hidden aria-disabled:pointer-events-none aria-disabled:opacity-50",
								onClick: oe,
								children: [/* @__PURE__ */ D($, {
									name: "archive",
									context: z("archive-all"),
									icons: d,
									resolver: f,
									className: "text-iui-inbox-icon size-4 shrink-0"
								}), A("archiveAll")]
							}),
							F && i.canPause && /* @__PURE__ */ D("div", {
								role: "separator",
								className: "bg-iui-inbox-border -mx-1 my-1 h-px"
							}),
							i.canPause && /* @__PURE__ */ O("div", {
								role: "group",
								"aria-labelledby": k,
								children: [/* @__PURE__ */ O("div", {
									id: k,
									className: "text-iui-inbox-muted-foreground flex items-center gap-2 px-2 pt-1.5 pb-1 text-xs font-medium",
									children: [/* @__PURE__ */ D($, {
										name: "pause",
										context: z("pause"),
										icons: d,
										resolver: f,
										className: "text-iui-inbox-icon size-4 shrink-0"
									}), A("pause")]
								}), H.map((e) => /* @__PURE__ */ O("button", {
									type: "button",
									role: "menuitem",
									"data-inbox-pause-option": "",
									className: "hover:bg-iui-inbox-control-hover focus-visible:bg-iui-inbox-control-hover flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm outline-hidden aria-disabled:pointer-events-none aria-disabled:opacity-50 ps-8",
									onClick: () => re(e),
									children: [
										e.label,
										" ",
										/* @__PURE__ */ D("span", {
											className: "text-iui-inbox-muted-foreground ms-auto ps-6 tabular-nums",
											children: _a(e, v, h)
										})
									]
								}, e.label))]
							})
						]
					})] })]
				})
			]
		}) }),
		/* @__PURE__ */ D("div", {
			"aria-live": "polite",
			children: i.pausedUntil !== null && /* @__PURE__ */ O("p", {
				"data-inbox-paused": "",
				className: "bg-iui-inbox-control-hover text-iui-inbox-foreground mx-4 mt-1 mb-2 flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs",
				children: [
					/* @__PURE__ */ D($, {
						name: "paused",
						context: z("paused"),
						icons: d,
						resolver: f,
						className: "text-iui-inbox-icon size-4 shrink-0"
					}),
					/* @__PURE__ */ D("span", {
						className: "min-w-0 flex-1",
						children: ga(u, i.pausedUntil, v, h)
					}),
					/* @__PURE__ */ D("button", {
						type: "button",
						"data-inbox-resume": "",
						className: "text-iui-inbox-foreground hover:bg-iui-inbox-surface focus-visible:ring-iui-inbox-ring -my-1 -me-1.5 shrink-0 rounded-md px-2 py-1 font-semibold focus-visible:ring-2 focus-visible:outline-hidden",
						onClick: ie,
						children: A("resume")
					})
				]
			})
		}),
		C && le("iui-inbox-fade border-iui-inbox-border flex shrink-0 gap-1 overflow-x-auto border-b ps-2.5 pe-8 scrollbar-none"),
		j.length > 1 && !b && y && /* @__PURE__ */ D("div", {
			role: "tablist",
			"aria-labelledby": y.titleId,
			className: "iui-inbox-fade border-iui-inbox-border flex shrink-0 gap-1 overflow-x-auto border-b ps-2.5 pe-8 scrollbar-none",
			onKeyDown: W,
			children: ca(j, {
				...i,
				filter: s
			}, u).map((e) => /* @__PURE__ */ D("button", {
				id: y.tabId(e.filter),
				type: "button",
				role: "tab",
				"aria-selected": e.selected,
				"aria-controls": y.listId,
				tabIndex: e.selected ? 0 : -1,
				"data-inbox-tab": e.filter,
				className: "text-iui-inbox-muted-foreground hover:text-iui-inbox-foreground focus-visible:ring-iui-inbox-ring aria-selected:border-iui-inbox-accent aria-selected:text-iui-inbox-accent aria-[current=page]:border-iui-inbox-accent aria-[current=page]:text-iui-inbox-accent -mb-px inline-flex items-center gap-1.5 rounded-t-md border-b-2 border-transparent px-1.5 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:outline-hidden focus-visible:ring-inset",
				onClick: () => se(e.filter, c),
				children: ce(e)
			}, e.filter))
		}),
		N && /* @__PURE__ */ D("div", {
			role: "group",
			"aria-label": A("categories"),
			className: "iui-inbox-fade border-iui-inbox-border flex shrink-0 gap-1.5 overflow-x-auto border-b ps-4 pe-8 py-2 scrollbar-none",
			children: M.map(([e, t]) => b ? /* @__PURE__ */ D(x, {
				href: b(s, e),
				"data-inbox-category": e ?? "",
				"aria-current": c === e ? "page" : void 0,
				className: "border-iui-inbox-border text-iui-inbox-muted-foreground hover:bg-iui-inbox-control-hover hover:text-iui-inbox-foreground focus-visible:ring-iui-inbox-ring aria-pressed:border-iui-inbox-accent aria-pressed:bg-iui-inbox-accent-subtle aria-pressed:text-iui-inbox-accent aria-[current=page]:border-iui-inbox-accent aria-[current=page]:bg-iui-inbox-accent-subtle aria-[current=page]:text-iui-inbox-accent inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium focus-visible:ring-2 focus-visible:outline-hidden",
				children: ue(e, t)
			}, e ?? "") : /* @__PURE__ */ D("button", {
				type: "button",
				"data-inbox-category": e ?? "",
				"aria-pressed": c === e,
				className: "border-iui-inbox-border text-iui-inbox-muted-foreground hover:bg-iui-inbox-control-hover hover:text-iui-inbox-foreground focus-visible:ring-iui-inbox-ring aria-pressed:border-iui-inbox-accent aria-pressed:bg-iui-inbox-accent-subtle aria-pressed:text-iui-inbox-accent aria-[current=page]:border-iui-inbox-accent aria-[current=page]:bg-iui-inbox-accent-subtle aria-[current=page]:text-iui-inbox-accent inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium focus-visible:ring-2 focus-visible:outline-hidden",
				onClick: () => se(s, e),
				children: ue(e, t)
			}, e ?? ""))
		})
	] });
}
// src/NotificationItem.tsx
var Va = [
	"snooze",
	"archive",
	"mute"
];
function Ha({ item: e, now: r, labels: i = Tt(), icons: s = {}, iconResolver: c, classes: l = {}, locale: u, pendingAction: d, snooze: f, allowedActions: p = Va, selected: m = !1, onSelectedChange: h }) {
	let g = e.readAt === null, _ = e.archivedAt !== null, v = Re(e, r), y = Dt(i, e), b = Et(e), x = (e) => p.includes(e), S = (t) => Z(i.itemControl, {
		action: Z(t),
		title: e.title
	}), C = x("snooze"), w = n(), [T, k] = o(null), A = a(null);
	T && !C && k(null), t(() => {
		T && A.current?.querySelector("button")?.focus();
	}, [T]);
	let j = () => {
		if (v) X.unsnooze(e);
		else if (T) k(null);
		else {
			let e = /* @__PURE__ */ new Date();
			k(f ? f(e) : lt(i, e));
		}
	}, M = (t) => ({
		component: "NotificationItem",
		part: t,
		item: e
	}), N = e.icon ? ye(e.icon, M("media"), s, c) : void 0, P = new Date(e.createdAt).toLocaleString(u, {
		dateStyle: "medium",
		timeStyle: "short"
	}), F = /* @__PURE__ */ D($, {
		name: e.announcement ? "announcement" : "notification",
		context: M("media"),
		icons: s,
		resolver: c,
		className: "size-5"
	});
	e.actor?.avatar ? F = /* @__PURE__ */ D("img", {
		src: e.actor.avatar,
		alt: "",
		className: "size-full object-cover"
	}) : N === void 0 ? e.actor?.name && (F = Pa(e.actor.name)) : F = Zi(N, "size-5");
	let I = h ? "label" : "span";
	return /* @__PURE__ */ O("div", {
		"data-read": String(!g),
		"data-archived": String(_),
		"data-selected": h ? String(m) : void 0,
		className: G(xi, l.item),
		children: [
			/* @__PURE__ */ O(I, {
				className: G(Si, h && "z-10 cursor-pointer"),
				children: [
					/* @__PURE__ */ D("span", {
						"aria-hidden": "true",
						className: G(Ci, l.media),
						children: F
					}),
					h && /* @__PURE__ */ D("span", {
						className: "bg-iui-inbox-control-hover absolute inset-0 flex items-center justify-center rounded-full opacity-0 group-hover/item:opacity-100 group-data-[selected=true]/item:opacity-100 in-data-inbox-selecting:opacity-100 has-focus-visible:opacity-100 motion-safe:transition-opacity",
						children: /* @__PURE__ */ D("input", {
							type: "checkbox",
							"data-inbox-select": "",
							"aria-keyshortcuts": "X",
							checked: m,
							"aria-label": Z(i.select, { title: e.title }),
							className: "accent-iui-inbox-accent size-4 cursor-pointer",
							onChange: (e) => h(e.target.checked)
						})
					}),
					g && /* @__PURE__ */ D("span", {
						"aria-hidden": "true",
						className: "bg-iui-inbox-unread ring-iui-inbox-surface absolute end-0 top-0 size-2.5 rounded-full ring-2 forced-color-adjust-none forced-colors:bg-[Highlight]"
					})
				]
			}),
			/* @__PURE__ */ O("div", {
				className: "min-w-0 flex-1",
				children: [
					/* @__PURE__ */ O("p", {
						className: G(wi, l.title),
						children: [
							g && /* @__PURE__ */ O("span", {
								className: "sr-only",
								children: [Z(i.unreadState), ": "]
							}),
							e.announcement && /* @__PURE__ */ O("span", {
								className: "sr-only",
								children: [Z(i.announcement), ": "]
							}),
							e.url ? /* @__PURE__ */ D("a", {
								"data-inbox-link": "",
								href: e.url,
								className: Ti,
								onClick: (t) => X.open(e, t.nativeEvent),
								children: e.title
							}) : e.title
						]
					}),
					e.body && /* @__PURE__ */ D("p", {
						className: G("text-iui-inbox-muted-foreground mt-0.5 line-clamp-3 text-sm wrap-break-word", l.body),
						children: e.body
					}),
					e.image && /* @__PURE__ */ D("img", {
						src: e.image,
						alt: "",
						className: "border-iui-inbox-border mt-2 max-h-40 rounded-md border object-cover"
					}),
					y && /* @__PURE__ */ O("p", {
						"data-inbox-actors": "",
						className: G("text-iui-inbox-muted-foreground mt-1.5 flex items-center gap-1.5 text-xs", l.actors),
						children: [/* @__PURE__ */ D("span", {
							"aria-hidden": "true",
							className: "isolate flex",
							children: b.map((e, t) => /* @__PURE__ */ D("span", {
								style: { zIndex: b.length - t },
								className: "bg-iui-inbox-control-hover text-iui-inbox-icon-hover ring-iui-inbox-surface relative flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full text-[0.625rem] font-medium ring-2 not-first:-ms-0.5",
								children: e.avatar ? /* @__PURE__ */ D("img", {
									src: e.avatar,
									alt: "",
									className: "size-full object-cover"
								}) : e.name && Pa(e.name)
							}, t))
						}), y]
					}),
					v && e.snoozedUntil ? /* @__PURE__ */ O("p", {
						"data-inbox-snoozed-until": "",
						suppressHydrationWarning: !0,
						className: G(Di, l.time),
						children: [/* @__PURE__ */ D($, {
							name: "snooze",
							context: M("snoozed-until"),
							icons: s,
							resolver: c,
							className: "size-3.5"
						}), Z(i.snoozedUntil, { time: ut(e.snoozedUntil, r, u) })]
					}) : /* @__PURE__ */ D("time", {
						dateTime: e.createdAt,
						title: P,
						suppressHydrationWarning: !0,
						className: G(Ei, l.time),
						children: xt(e.createdAt, r, u)
					}),
					e.muted && /* @__PURE__ */ O("p", {
						"data-inbox-muted": "",
						className: G("text-iui-inbox-muted-foreground mt-1 flex items-center gap-1 text-xs", l.time),
						children: [/* @__PURE__ */ D($, {
							name: "mute",
							context: M("muted"),
							icons: s,
							resolver: c,
							className: "size-3.5"
						}), Z(i.muted)]
					}),
					e.result !== null && /* @__PURE__ */ O("p", {
						"data-inbox-result": "",
						className: G("text-iui-inbox-muted-foreground mt-2 flex items-center gap-1.5 text-xs font-medium", l.result),
						children: [/* @__PURE__ */ D($, {
							name: "result",
							context: M("result"),
							icons: s,
							resolver: c,
							className: "size-3.5"
						}), e.result]
					}),
					e.result === null && e.actions.length > 0 && /* @__PURE__ */ D("div", {
						className: "relative z-10 mt-2 flex flex-wrap gap-2",
						children: e.actions.map((t, n) => {
							let r = H(t), i = {
								"aria-disabled": d !== void 0 || void 0,
								"aria-busy": d === n || void 0,
								"data-inbox-action": String(n),
								className: G(n === 0 ? "rounded-md focus-visible:ring-iui-inbox-ring inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium focus-visible:ring-2 focus-visible:outline-hidden aria-disabled:cursor-default aria-disabled:opacity-60 border-iui-inbox-accent text-iui-inbox-accent hover:bg-iui-inbox-accent-subtle border" : "rounded-md focus-visible:ring-iui-inbox-ring inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium focus-visible:ring-2 focus-visible:outline-hidden aria-disabled:cursor-default aria-disabled:opacity-60 border-iui-inbox-border bg-iui-inbox-surface hover:bg-iui-inbox-control-hover border", l.action),
								onClick: (t) => X.runAction(e, n, t.nativeEvent)
							}, a = /* @__PURE__ */ O(E, { children: [d === n && /* @__PURE__ */ D($, {
								name: "spinner",
								context: {
									...M("action"),
									action: t
								},
								icons: s,
								resolver: c,
								className: "size-3.5 motion-safe:animate-spin"
							}), t.label] });
							return r === void 0 ? /* @__PURE__ */ D("button", {
								type: "button",
								...i,
								children: a
							}, n) : /* @__PURE__ */ D("a", {
								href: r,
								target: t.newTab ? "_blank" : void 0,
								rel: t.newTab ? "noopener noreferrer" : void 0,
								...i,
								children: a
							}, n);
						})
					}),
					T && /* @__PURE__ */ D("div", {
						id: w,
						ref: A,
						role: "group",
						"aria-label": Z(i.snoozeUntil),
						"data-inbox-snooze-options": "",
						className: "relative z-10 mt-2 flex flex-wrap gap-2",
						children: T.map((t) => /* @__PURE__ */ O("button", {
							type: "button",
							"data-inbox-snooze-option": "",
							className: G("rounded-md focus-visible:ring-iui-inbox-ring inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium focus-visible:ring-2 focus-visible:outline-hidden aria-disabled:cursor-default aria-disabled:opacity-60 border-iui-inbox-border bg-iui-inbox-surface hover:bg-iui-inbox-control-hover border", l.action),
							onClick: () => {
								k(null), X.snooze(e, t.until);
							},
							children: [
								t.label,
								" ",
								/* @__PURE__ */ D("span", {
									className: "text-iui-inbox-muted-foreground font-normal",
									children: ut(t.until, r, u)
								})
							]
						}, t.label))
					})
				]
			}),
			/* @__PURE__ */ O("div", {
				className: Ai,
				children: [
					/* @__PURE__ */ D(za, {
						text: Z(g ? i.markAsRead : i.markAsUnread),
						shortcut: "U",
						children: /* @__PURE__ */ D("button", {
							type: "button",
							"data-inbox-toggle-read": "",
							"aria-keyshortcuts": "U",
							"aria-label": S(g ? i.markAsRead : i.markAsUnread),
							className: G(Pi, l.control),
							onClick: () => void (g ? X.markAsRead(e) : X.markAsUnread(e)),
							children: /* @__PURE__ */ D($, {
								name: g ? "read" : "unread",
								context: M("toggle-read"),
								icons: s,
								resolver: c,
								className: "size-4"
							})
						})
					}),
					C && !_ && /* @__PURE__ */ D(za, {
						text: Z(v ? i.unsnooze : i.snooze),
						shortcut: "H",
						children: /* @__PURE__ */ D("button", {
							type: "button",
							"data-inbox-snooze": "",
							"aria-keyshortcuts": "H",
							"aria-label": S(v ? i.unsnooze : i.snooze),
							"aria-expanded": v ? void 0 : T !== null,
							"aria-controls": v || !T ? void 0 : w,
							className: G("text-iui-inbox-icon hover:bg-iui-inbox-control-hover hover:text-iui-inbox-icon-hover focus-visible:ring-iui-inbox-ring rounded-md p-1.5 focus-visible:ring-2 focus-visible:outline-hidden [@media(hover:hover)]:p-1", l.control),
							onClick: j,
							children: /* @__PURE__ */ D($, {
								name: v ? "unsnooze" : "snooze",
								context: M("snooze"),
								icons: s,
								resolver: c,
								className: "size-4"
							})
						})
					}),
					e.group !== null && x("mute") && /* @__PURE__ */ D(za, {
						text: Z(e.muted ? i.unmute : i.mute),
						children: /* @__PURE__ */ D("button", {
							type: "button",
							"data-inbox-mute": "",
							"aria-label": S(e.muted ? i.unmute : i.mute),
							className: G("text-iui-inbox-icon hover:bg-iui-inbox-control-hover hover:text-iui-inbox-icon-hover focus-visible:ring-iui-inbox-ring rounded-md p-1.5 focus-visible:ring-2 focus-visible:outline-hidden [@media(hover:hover)]:p-1", l.control),
							onClick: () => void (e.muted ? X.unmute(e) : X.mute(e)),
							children: /* @__PURE__ */ D($, {
								name: e.muted ? "unmute" : "mute",
								context: M("mute"),
								icons: s,
								resolver: c,
								className: "size-4"
							})
						})
					}),
					x("archive") && /* @__PURE__ */ D(za, {
						text: Z(_ ? i.unarchive : i.archive),
						shortcut: "E",
						children: /* @__PURE__ */ D("button", {
							type: "button",
							"data-inbox-toggle-archive": "",
							"aria-keyshortcuts": "E",
							"aria-label": S(_ ? i.unarchive : i.archive),
							className: G("text-iui-inbox-icon hover:bg-iui-inbox-control-hover hover:text-iui-inbox-icon-hover focus-visible:ring-iui-inbox-ring rounded-md p-1.5 focus-visible:ring-2 focus-visible:outline-hidden [@media(hover:hover)]:p-1", l.control),
							onClick: () => void (_ ? X.unarchive(e) : X.archive(e)),
							children: /* @__PURE__ */ D($, {
								name: _ ? "unarchive" : "archive",
								context: M("archive"),
								icons: s,
								resolver: c,
								className: "size-4"
							})
						})
					}),
					x("delete") && /* @__PURE__ */ D(za, {
						text: Z(i.delete),
						children: /* @__PURE__ */ D("button", {
							type: "button",
							"data-inbox-delete": "",
							"aria-label": S(i.delete),
							className: G("text-iui-inbox-icon hover:bg-iui-inbox-control-hover hover:text-iui-inbox-icon-hover focus-visible:ring-iui-inbox-ring rounded-md p-1.5 focus-visible:ring-2 focus-visible:outline-hidden [@media(hover:hover)]:p-1", l.control),
							onClick: () => void X.delete(e),
							children: /* @__PURE__ */ D($, {
								name: "delete",
								context: M("delete"),
								icons: s,
								resolver: c,
								className: "size-4"
							})
						})
					})
				]
			})
		]
	});
}
// src/ItemGroup.tsx
function Ua({ group: e, now: t, labels: r, icons: i, iconResolver: a, classes: s, locale: c, pendingActions: l, snooze: u, allowedActions: d, selected: f, select: p, renderItem: m }) {
	let [h, g] = o(!1), _ = n();
	h && e.others.length === 0 && g(!1);
	let v = (e, n) => {
		let o = {
			item: e,
			now: t,
			labels: r,
			icons: i,
			iconResolver: a,
			classes: s,
			locale: c,
			pendingAction: l[e.id],
			snooze: u,
			allowedActions: d,
			selected: f?.includes(e.id) ?? !1,
			onSelectedChange: p ? (t) => p(e.id, t) : void 0
		};
		return /* @__PURE__ */ O("li", {
			tabIndex: -1,
			"data-inbox-item": "",
			"data-inbox-id": e.id,
			"data-read": String(e.readAt !== null),
			"data-seen": String(e.seenAt !== null),
			"data-archived": String(e.archivedAt !== null),
			"data-announcement": e.announcement ? "true" : void 0,
			className: bi,
			children: [m ? m(e, t, o) : /* @__PURE__ */ D(Ha, { ...o }), n]
		}, e.id);
	};
	return v(e.item, e.others.length > 0 && /* @__PURE__ */ O(E, { children: [/* @__PURE__ */ D("button", {
		type: "button",
		"data-inbox-group-toggle": "",
		"aria-expanded": h,
		"aria-controls": h ? _ : void 0,
		className: "text-iui-inbox-muted-foreground hover:text-iui-inbox-foreground focus-visible:ring-iui-inbox-ring ms-15 -mt-2 mb-2.5 rounded-md px-1 py-0.5 text-xs font-medium focus-visible:ring-2 focus-visible:outline-hidden",
		onClick: () => g(!h),
		children: h ? Z(r.showLess) : Z(r.showMore, { count: e.others.length })
	}), h && /* @__PURE__ */ D("ul", {
		id: _,
		role: "list",
		className: "divide-iui-inbox-border border-iui-inbox-border ms-12 divide-y border-s",
		children: e.others.map((e) => v(e))
	})] }));
}
// src/SelectionBar.tsx
function Wa({ component: e, items: r, selected: i, onSelectedChange: s, filter: c, allowedActions: l, now: u, labels: d, icons: f, iconResolver: p, classes: m, locale: h, snooze: g }) {
	let _ = n(), v = (e) => Z(d[e]), y = r.filter((e) => i.includes(e.id)), b = y.length === r.length, x = a(null), [S, C] = o(null);
	S !== null && y.length === 0 && C(null), t(() => {
		S && x.current?.querySelector("button")?.focus();
	}, [S]);
	let w = (e, t) => {
		s([]), X.batch(e, y, t);
	};
	return y.length === 0 ? null : /* @__PURE__ */ O(E, { children: [/* @__PURE__ */ O("div", {
		role: "group",
		"aria-label": v("selection"),
		"data-inbox-selection": "",
		className: ji,
		children: [/* @__PURE__ */ O("div", {
			className: Mi,
			children: [/* @__PURE__ */ D("input", {
				type: "checkbox",
				"data-inbox-select-all": "",
				ref: (e) => {
					e && (e.indeterminate = !b);
				},
				checked: b,
				"aria-label": v("selectAll"),
				className: Ni,
				onChange: () => s(b ? [] : r.map((e) => e.id))
			}), /* @__PURE__ */ D("span", {
				"aria-live": "polite",
				children: Z(d.selected, { count: y.length })
			})]
		}), /* @__PURE__ */ O("div", {
			className: mi,
			children: [va(c, l).map((t) => /* @__PURE__ */ D("button", {
				type: "button",
				"data-inbox-batch": t.action,
				"aria-label": v(t.label),
				title: v(t.label),
				"aria-expanded": t.action === "snooze" ? S !== null : void 0,
				"aria-controls": t.action === "snooze" && S ? _ : void 0,
				className: G(Pi, m.control),
				onClick: () => t.action === "snooze" ? C(S ? null : ya(g, d)) : w(t.action),
				children: /* @__PURE__ */ D($, {
					name: t.icon,
					context: {
						component: e,
						part: "selection",
						action: t.action
					},
					icons: f,
					resolver: p,
					className: "size-4"
				})
			}, t.action)), /* @__PURE__ */ D("button", {
				type: "button",
				"data-inbox-clear-selection": "",
				"aria-label": v("clearSelection"),
				title: v("clearSelection"),
				className: G(Pi, m.control),
				onClick: () => s([]),
				children: /* @__PURE__ */ D($, {
					name: "dismiss",
					context: {
						component: e,
						part: "clear-selection"
					},
					icons: f,
					resolver: p,
					className: "size-4"
				})
			})]
		})]
	}), S && /* @__PURE__ */ D("div", {
		id: _,
		ref: x,
		role: "group",
		"aria-label": v("snoozeUntil"),
		"data-inbox-batch-snooze-options": "",
		className: "flex shrink-0 flex-wrap gap-2 px-4 pt-1 pb-2",
		children: S.map((e) => /* @__PURE__ */ O("button", {
			type: "button",
			"data-inbox-batch-snooze-option": "",
			className: G("rounded-md focus-visible:ring-iui-inbox-ring inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium focus-visible:ring-2 focus-visible:outline-hidden aria-disabled:cursor-default aria-disabled:opacity-60 border-iui-inbox-border bg-iui-inbox-surface hover:bg-iui-inbox-control-hover border", m.action),
			onClick: () => {
				C(null), w("snooze", e.until);
			},
			children: [
				e.label,
				" ",
				/* @__PURE__ */ D("span", {
					className: "text-iui-inbox-muted-foreground font-normal",
					children: ut(e.until, u, h)
				})
			]
		}, e.label))
	})] });
}
// src/NotificationCenter.tsx
var Ga = () => () => {};
function Ka({ labels: e, badge: t = "count", count: i = "unseen", maxCount: c = 99, href: l, icons: u = {}, iconResolver: d, classes: f = {}, locale: p, renderItem: m, renderEmpty: h, group: g = !0, snooze: _, placement: v = "bottom-end", open: y, onOpenChange: b, onItemClick: S, onAction: w, renderTrigger: k, renderBadge: A, renderHeader: j, renderTab: M, renderLoading: N, renderError: P, renderFooter: F }) {
	let { props: I } = T(), L = n(), R = {
		panel: `${L}-panel`,
		title: `${L}-title`,
		list: `${L}-list`,
		tab: (e) => `${L}-tab-${e}`
	}, z = s(X.subscribe, X.getSnapshot, X.getServerSnapshot), [B, ee] = o(!1), [V] = o(Date.now), te = s(B ? bt.subscribe : Ga, bt.getSnapshot, () => V), H = Tt(e), ne = (e) => Z(H[e]), U = z.counts[i], re = sa(z.filter, H), ie = aa(z), ae = z.categoryFilter, [oe, se] = o([]), W = la(z.items, oe), ce = ct(W, g), le = ie.length > 1, ue = a(null), K = a(null), de = a(null), q = a(null), fe = a(null), pe = a(null), me = a(ie), he = a(ae), ge = a(v), J = a(b);
	r(() => {
		qi(), _t(I);
		let e, t = !1, n = Ma(K.current), r = xa(q.current, se, {
			scroller: q.current,
			listed: (e) => X.getSnapshot().items.some((t) => t.id === e)
		});
		fe.current = r;
		let i = wa(q.current, () => X.getSnapshot().items), a = Oa(ue.current, K.current, {
			onToggle(n) {
				ee(n), t = n, J.current?.(n), n ? (e = window.location.href, X.opened(me.current, {
					markAllAsSeen: !1,
					categories: Object.keys(he.current)
				})) : X.closed({ markAllAsSeen: !1 });
			},
			onEndReached: () => void X.loadMore(),
			placement: () => ge.current
		});
		pe.current = a;
		let o = C.on("navigate", () => {
			window.location.href !== e && a.close();
		});
		return () => {
			t && X.closed({ markAllAsSeen: !1 }), o(), n(), r.destroy(), i.destroy(), a.destroy(), pe.current = null;
		};
	}, []), r(() => pe.current?.observe(B ? de.current : null), [
		z,
		B,
		W.length > 0
	]), r(() => {
		J.current = b, me.current = ie, he.current = ae;
	}), r(() => {
		let e = K.current?.matches(":popover-open") ?? !1;
		y === !0 && !e ? K.current?.showPopover() : y === !1 && e && pe.current?.close();
	}, [y]), r(() => {
		ge.current = v, pe.current?.place();
	}, [v]), r(() => {
		B && ie.length > 0 && !ie.includes(z.filter) && X.load(ie[0], z.category);
	}, [ie.join()]);
	let _e = () => {
		let e = document.getElementById(R.panel);
		e?.matches(":popover-open") && e.hidePopover();
	}, ve = `${z.filter}|${z.category}|${B}|${z.selectable}`, [ye, be] = o([]), [xe, Se] = o(ve);
	xe !== ve && (Se(ve), be([]));
	let Ce = W.some((e) => ye.includes(e.id));
	r(() => fe.current?.release(), [ve]);
	let we = (e, t) => be((n) => ba(n, e, t)), Te = (e) => {
		let t = Ta(e.nativeEvent, z.items);
		t?.action ? w?.(t.item, t.action, e) : t && S?.(t.item, e);
	}, Ee = (e) => /* @__PURE__ */ O(E, { children: [/* @__PURE__ */ D("p", {
		role: "alert",
		children: ne("error")
	}), /* @__PURE__ */ D("button", {
		type: "button",
		"data-inbox-retry": "",
		className: ki,
		onClick: e,
		children: ne("retry")
	})] }), De = ua(z, W.length), Oe;
	return Oe = De === "loading" ? /* @__PURE__ */ D("div", {
		role: "status",
		className: Fi,
		children: N ? N() : /* @__PURE__ */ O(E, { children: [/* @__PURE__ */ D($, {
			name: "spinner",
			context: {
				component: "NotificationCenter",
				part: "loading"
			},
			icons: u,
			resolver: d,
			className: G(Ii, "motion-safe:animate-spin")
		}), /* @__PURE__ */ D("span", {
			className: "sr-only",
			children: ne("loading")
		})] })
	}) : De === "error" ? /* @__PURE__ */ D("div", {
		"data-inbox-error": "",
		className: Fi,
		children: (P ?? (({ retry: e }) => Ee(e)))({
			more: !1,
			retry: () => void X.load()
		})
	}) : De === "empty" ? /* @__PURE__ */ D("div", {
		"data-inbox-empty": "",
		className: Fi,
		children: h ? h(z.filter) : /* @__PURE__ */ O(E, { children: [/* @__PURE__ */ D($, {
			name: "empty",
			context: {
				component: "NotificationCenter",
				part: "empty",
				filter: z.filter
			},
			icons: u,
			resolver: d,
			className: Ii
		}), /* @__PURE__ */ D("p", { children: re })] })
	}) : /* @__PURE__ */ O(E, { children: [
		/* @__PURE__ */ D("ul", {
			role: "list",
			"data-inbox-selecting": Ce || void 0,
			className: G(yi, f.list),
			children: ce.map((e) => /* @__PURE__ */ D(Ua, {
				group: e,
				now: te,
				labels: H,
				icons: u,
				iconResolver: d,
				classes: f,
				locale: p,
				pendingActions: z.pendingActions,
				snooze: _,
				allowedActions: z.allowedActions,
				selected: z.selectable ? ye : void 0,
				select: z.selectable ? we : void 0,
				renderItem: m
			}, e.key))
		}),
		z.hasMore && z.moreFailed && /* @__PURE__ */ D("div", {
			"data-inbox-more-failed": "",
			className: "text-iui-inbox-muted-foreground flex flex-col items-center gap-3 px-6 py-12 text-center text-sm",
			children: (P ?? (({ retry: e }) => Ee(e)))({
				more: !0,
				retry: () => void X.loadMore({ retry: !0 })
			})
		}),
		z.hasMore && !z.moreFailed && /* @__PURE__ */ D("div", {
			ref: de,
			"aria-hidden": "true",
			className: "text-iui-inbox-muted-foreground flex justify-center py-3",
			children: z.loadingMore && /* @__PURE__ */ D($, {
				name: "spinner",
				context: {
					component: "NotificationCenter",
					part: "loading-more"
				},
				icons: u,
				resolver: d,
				className: "size-5 motion-safe:animate-spin"
			})
		})
	] }), /* @__PURE__ */ O("div", {
		"data-inbox": "",
		className: "inline-flex",
		children: [/* @__PURE__ */ D("button", {
			ref: ue,
			type: "button",
			popoverTarget: R.panel,
			"aria-haspopup": "dialog",
			"aria-expanded": B,
			"aria-controls": R.panel,
			"aria-label": Na(H, U, c, p, z.pausedUntil !== null),
			"data-inbox-bell": "",
			"data-paused": z.pausedUntil === null ? void 0 : "true",
			className: G(di, f.bell),
			children: k ? k({
				open: B,
				count: U,
				counts: z.counts
			}) : /* @__PURE__ */ O(E, { children: [
				/* @__PURE__ */ D($, {
					name: z.pausedUntil === null ? "bell" : "paused",
					context: {
						component: "NotificationCenter",
						part: "bell"
					},
					icons: u,
					resolver: d,
					className: "size-5"
				}),
				t !== "none" && U > 0 && A && A({
					count: U,
					text: St(U, c, p)
				}),
				t === "count" && U > 0 && !A && /* @__PURE__ */ D("span", {
					"data-inbox-badge": "",
					"aria-hidden": "true",
					className: G("bg-iui-inbox-badge text-iui-inbox-badge-foreground absolute -inset-e-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[0.6875rem] leading-none font-semibold tabular-nums", f.badge),
					children: St(U, c, p)
				}),
				t === "dot" && U > 0 && !A && /* @__PURE__ */ D("span", {
					"data-inbox-badge": "",
					"aria-hidden": "true",
					className: G("bg-iui-inbox-badge absolute inset-e-1.5 top-1.5 size-2 rounded-full forced-color-adjust-none forced-colors:bg-[Highlight]", f.badge)
				})
			] })
		}), /* @__PURE__ */ D("div", {
			id: R.panel,
			ref: K,
			popover: "auto",
			role: "dialog",
			"aria-labelledby": R.title,
			tabIndex: -1,
			"data-inbox-panel": "",
			className: G(fi, f.panel),
			onKeyDown: (e) => ja(e.nativeEvent, K.current),
			onClickCapture: Te,
			children: /* @__PURE__ */ O("div", {
				className: pi,
				children: [
					/* @__PURE__ */ D(Ba, {
						component: "NotificationCenter",
						state: z,
						filter: z.filter,
						category: z.category,
						items: z.items,
						labels: H,
						icons: u,
						iconResolver: d,
						classes: f,
						locale: p,
						maxCount: c,
						now: te,
						panel: {
							titleId: R.title,
							title: ne("title"),
							tabId: R.tab,
							listId: R.list,
							close: _e
						},
						open: B,
						renderHeader: j,
						renderTab: M
					}),
					/* @__PURE__ */ O("div", {
						id: R.list,
						ref: q,
						"data-inbox-scroller": "",
						role: le ? "tabpanel" : void 0,
						"aria-labelledby": le ? R.tab(z.filter) : void 0,
						"aria-busy": z.status === "loading" || z.loadingMore || void 0,
						className: _i,
						children: [/* @__PURE__ */ D("div", {
							"aria-live": "polite",
							className: vi,
							children: oe.length > 0 && /* @__PURE__ */ D("button", {
								type: "button",
								"data-inbox-show-new": "",
								className: "border-iui-inbox-accent bg-iui-inbox-surface text-iui-inbox-accent focus-visible:ring-iui-inbox-ring mt-2 h-fit rounded-full border px-3 py-1 text-xs font-medium shadow-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden",
								onClick: () => fe.current?.reveal(),
								children: Z(H.showNew, { count: oe.length })
							})
						}), Oe]
					}),
					/* @__PURE__ */ D(Wa, {
						component: "NotificationCenter",
						items: W,
						selected: ye,
						onSelectedChange: be,
						filter: z.filter,
						allowedActions: z.allowedActions,
						now: te,
						labels: H,
						icons: u,
						iconResolver: d,
						classes: f,
						locale: p,
						snooze: _
					}),
					F ? F({
						href: l,
						close: _e
					}) : l && /* @__PURE__ */ D(x, {
						href: l,
						"data-inbox-view-all": "",
						className: "border-iui-inbox-border text-iui-inbox-accent hover:bg-iui-inbox-control-hover focus-visible:ring-iui-inbox-ring block border-t px-4 py-2.5 text-center text-sm font-medium focus-visible:ring-2 focus-visible:outline-hidden focus-visible:ring-inset",
						children: ne("viewAll")
					})
				]
			})
		})]
	});
}
// src/NotificationList.tsx
function qa({ data: e, filter: t, labels: n, icons: c = {}, iconResolver: l, classes: u = {}, locale: d, buffer: f = 250, manual: p = !1, preserveUrl: m = !1, renderItem: h, renderEmpty: g, category: _, group: v = !0, snooze: y, maxCount: x = 99, renderHeader: S, renderTab: C, onItemClick: w, onAction: k }) {
	let A = T(), j = s(X.subscribe, X.getSnapshot, X.getServerSnapshot), [M] = o(Date.now), N = s(bt.subscribe, bt.getSnapshot, () => M), { filter: P, category: F } = ha(A.url, j, t, _), I = Tt(n), L = sa(P, I), R = a(null), z = A.props[e]?.data, B = i(() => Array.isArray(z) ? z.map(We).filter((e) => e !== void 0) : [], [z]), ee = i(() => st(X, B, P, F), [
		B,
		P,
		F,
		j
	]), [V, te] = o([]), H = la(ee, V), ne = ct(H, v), U = !!A.scrollProps?.[e]?.nextPage, re = a(null), ie = a(H), ae = a({
		loaded: B,
		filter: P,
		category: F
	});
	r(() => {
		ie.current = H, ae.current = {
			loaded: B,
			filter: P,
			category: F
		};
	});
	let oe = (t, n) => ma(A.url, t, n, A.scrollProps?.[e]?.pageName), se = `${P}|${F}|${j.selectable}`, [W, ce] = o([]), [le, ue] = o(se);
	le !== se && (ue(se), ce([]));
	let K = H.some((e) => W.includes(e.id));
	r(() => re.current?.release(), [se]);
	let de = (e, t) => ce((n) => ba(n, e, t));
	return r(() => {
		qi(), _t(A.props);
	}, []), r(() => X.remember(B), [B]), r(() => Ma(R.current), []), r(() => {
		let e = xa(R.current, te, { listed: (e) => st(X, ae.current.loaded, ae.current.filter, ae.current.category).some((t) => t.id === e) });
		re.current = e;
		let t = wa(R.current, () => ie.current, null);
		return () => {
			e.destroy(), t.destroy(), re.current = null;
		};
	}, []), /* @__PURE__ */ O("div", {
		ref: R,
		"data-inbox-list": "",
		tabIndex: -1,
		onKeyDown: (e) => ja(e.nativeEvent, R.current),
		onClickCapture: (e) => {
			let t = Ta(e.nativeEvent, H);
			t?.action ? k?.(t.item, t.action, e) : t && w?.(t.item, e);
		},
		children: [
			/* @__PURE__ */ D(Ba, {
				component: "NotificationList",
				state: j,
				filter: P,
				category: F,
				items: H,
				labels: I,
				icons: c,
				iconResolver: l,
				classes: u,
				locale: d,
				maxCount: x,
				now: N,
				href: oe,
				renderHeader: S,
				renderTab: C
			}),
			/* @__PURE__ */ D("div", {
				"aria-live": "polite",
				className: vi,
				children: V.length > 0 && /* @__PURE__ */ D("button", {
					type: "button",
					"data-inbox-show-new": "",
					className: "border-iui-inbox-accent bg-iui-inbox-surface text-iui-inbox-accent focus-visible:ring-iui-inbox-ring mt-2 h-fit rounded-full border px-3 py-1 text-xs font-medium shadow-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden",
					onClick: () => re.current?.reveal(),
					children: Z(I.showNew, { count: V.length })
				})
			}),
			/* @__PURE__ */ D(b, {
				data: e,
				buffer: f,
				manual: p,
				preserveUrl: m,
				as: "ul",
				role: "list",
				hidden: H.length === 0 || void 0,
				"data-inbox-selecting": K || void 0,
				className: G(yi, u.list),
				loading: /* @__PURE__ */ O("div", {
					role: "status",
					className: Li,
					children: [/* @__PURE__ */ D($, {
						name: "spinner",
						context: {
							component: "NotificationList",
							part: "loading-more"
						},
						icons: c,
						resolver: l,
						className: ci
					}), /* @__PURE__ */ D("span", {
						className: "sr-only",
						children: Z(I.loading)
					})]
				}),
				next: p ? ({ fetch: e, hasMore: t, loading: n }) => t && /* @__PURE__ */ D("div", {
					className: "text-iui-inbox-muted-foreground flex justify-center py-3",
					children: /* @__PURE__ */ D("button", {
						type: "button",
						"data-inbox-load-more": "",
						"aria-busy": n || void 0,
						className: "rounded-md focus-visible:ring-iui-inbox-ring inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium focus-visible:ring-2 focus-visible:outline-hidden aria-disabled:cursor-default aria-disabled:opacity-60 border-iui-inbox-border bg-iui-inbox-surface hover:bg-iui-inbox-control-hover border",
						onClick: e,
						children: Z(I.loadMore)
					})
				}) : void 0,
				children: ne.map((e) => /* @__PURE__ */ D(Ua, {
					group: e,
					now: N,
					labels: I,
					icons: c,
					iconResolver: l,
					classes: u,
					locale: d,
					pendingActions: j.pendingActions,
					snooze: y,
					allowedActions: j.allowedActions,
					selected: j.selectable ? W : void 0,
					select: j.selectable ? de : void 0,
					renderItem: h
				}, e.key))
			}),
			H.length === 0 && !U && /* @__PURE__ */ D("div", {
				"data-inbox-empty": "",
				className: "text-iui-inbox-muted-foreground flex flex-col items-center gap-3 px-6 py-12 text-center text-sm",
				children: g ? g(P) : /* @__PURE__ */ O(E, { children: [/* @__PURE__ */ D($, {
					name: "empty",
					context: {
						component: "NotificationList",
						part: "empty",
						filter: P
					},
					icons: c,
					resolver: l,
					className: "text-iui-inbox-icon size-8"
				}), /* @__PURE__ */ D("p", { children: L })] })
			}),
			K && /* @__PURE__ */ D("div", {
				className: "bg-iui-inbox-surface sticky bottom-0 z-20",
				children: /* @__PURE__ */ D(Wa, {
					component: "NotificationList",
					items: H,
					selected: W,
					onSelectedChange: ce,
					filter: P,
					allowedActions: j.allowedActions,
					now: N,
					labels: I,
					icons: c,
					iconResolver: l,
					classes: u,
					locale: d,
					snooze: y
				})
			})
		]
	});
}
// src/usePreferences.ts
var Ja = () => kn.load(X.getSnapshot().url);
function Ya() {
	let { props: e } = T(), t = s(kn.subscribe, kn.getSnapshot, () => qt), n = i(() => tn(t), [t]);
	return r(() => {
		qi(), _t(e), Ja();
	}, []), {
		...t,
		sections: n,
		load: Ja,
		set: kn.set,
		setChannel: kn.setChannel,
		setFrequency: kn.setFrequency,
		setNotificationHours: kn.setNotificationHours,
		receives: (e, n) => an(e, n, t.channels),
		frequencyApplies: sn,
		isDisabled: (e, n) => on(e, n, t.channels)
	};
}
// src/usePush.ts
var Xa = () => Mn;
function Za() {
	let { props: e } = T(), t = s(Jn.subscribe, Jn.getSnapshot, Xa);
	return r(() => {
		qi(), _t(e);
	}, []), {
		...t,
		deviceState: Nn(t),
		subscribe: Jn.enable,
		unsubscribe: Jn.disable,
		loadDevices: Jn.loadDevices,
		removeDevice: Jn.removeDevice
	};
}
// src/NotificationPreferences.tsx
function Qa({ labels: e, classes: r = {}, locale: i, renderCategory: a, renderGroup: c, renderChannel: l, renderEmpty: u }) {
	let { status: d, channels: f, categories: p, sections: m, notificationHours: h, frequencies: g, load: _, setChannel: v, setFrequency: y, setNotificationHours: b, receives: x, frequencyApplies: S, isDisabled: C } = Ya(), w = Za(), [T, k] = o(null), A = On(e), j = (e) => Z(A[e]), M = An(f, p, g, A), N = f.some((e) => e.push) ? Pn(w) : null, [P] = o(Date.now), F = s(bt.subscribe, bt.getSnapshot, () => P), I = Yn(w.devices, A, F, i), L = n(), R = N !== null;
	t(() => {
		R && Jn.loadDevices();
	}, [R]);
	let z = (e) => {
		let t = vn(h, T, e);
		t && (k(t.editing), b({ days: { [e.day]: t.ranges } }));
	};
	return d === "error" ? /* @__PURE__ */ D("div", {
		"data-inbox-preferences": "",
		children: /* @__PURE__ */ O("div", {
			"data-inbox-preferences-error": "",
			className: Fi,
			children: [/* @__PURE__ */ D("p", { children: j("error") }), /* @__PURE__ */ D("button", {
				type: "button",
				className: ki,
				onClick: () => void _(),
				children: j("retry")
			})]
		})
	}) : p.length === 0 ? /* @__PURE__ */ D("div", {
		"data-inbox-preferences": "",
		children: d === "ready" ? /* @__PURE__ */ D("div", {
			"data-inbox-preferences-empty": "",
			className: Fi,
			children: u ? u() : /* @__PURE__ */ D("p", { children: j("empty") })
		}) : /* @__PURE__ */ O("div", {
			role: "status",
			className: Fi,
			children: [/* @__PURE__ */ D($, {
				name: "spinner",
				context: {
					component: "NotificationPreferences",
					part: "loading"
				},
				className: ci
			}), /* @__PURE__ */ D("span", {
				className: "sr-only",
				children: j("loading")
			})]
		})
	}) : /* @__PURE__ */ O("div", {
		"data-inbox-preferences": "",
		children: [
			/* @__PURE__ */ D("div", {
				className: Ri,
				children: /* @__PURE__ */ O("table", {
					className: G(zi, r.table),
					children: [
						/* @__PURE__ */ D("caption", {
							className: "sr-only",
							children: j("title")
						}),
						/* @__PURE__ */ D("thead", { children: /* @__PURE__ */ O("tr", { children: [
							/* @__PURE__ */ D("th", {
								scope: "col",
								className: G(Bi, r.head),
								children: j("category")
							}),
							f.map((e) => /* @__PURE__ */ D("th", {
								scope: "col",
								className: G(Vi, r.head),
								children: l ? l(e) : e.label
							}, e.key)),
							M.hasFrequencies && /* @__PURE__ */ D("th", {
								scope: "col",
								className: G("text-iui-inbox-muted-foreground w-40 px-4 py-2.5 text-start text-xs font-medium", r.head),
								children: j("frequency")
							})
						] }) }),
						M.hasGlobalSwitches && /* @__PURE__ */ D("tbody", {
							"data-inbox-preferences-global": "",
							children: /* @__PURE__ */ O("tr", {
								className: G("border-iui-inbox-border border-t", r.row),
								children: [
									/* @__PURE__ */ O("th", {
										scope: "row",
										className: "min-w-36 px-4 py-3 text-start align-top font-normal",
										children: [/* @__PURE__ */ D("span", {
											className: G("text-iui-inbox-foreground font-medium", r.label),
											children: j("global")
										}), /* @__PURE__ */ D("span", {
											className: G("text-iui-inbox-muted-foreground mt-0.5 block", r.description),
											children: j("globalDescription")
										})]
									}),
									f.map((e) => /* @__PURE__ */ D("td", {
										className: "px-2 py-3 text-center align-middle",
										children: e.globalSwitch && /* @__PURE__ */ D("button", {
											type: "button",
											role: "switch",
											"aria-checked": e.enabled,
											"aria-label": Z(A.toggle, {
												category: j("global"),
												channel: e.label
											}),
											"data-inbox-preference-channel": e.key,
											className: G("group/switch bg-iui-inbox-icon aria-checked:bg-iui-inbox-accent focus-visible:ring-iui-inbox-ring focus-visible:ring-offset-iui-inbox-surface relative inline-flex h-5 w-9 shrink-0 items-center rounded-full focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden aria-disabled:cursor-default aria-disabled:opacity-50 forced-colors:border motion-safe:transition-colors", r.switch),
											onClick: () => void v(e.key, !e.enabled),
											children: /* @__PURE__ */ D("span", {
												"aria-hidden": "true",
												className: "bg-iui-inbox-surface ms-0.5 size-4 rounded-full shadow-sm forced-color-adjust-none group-aria-checked/switch:translate-x-4 forced-colors:bg-[ButtonText] forced-colors:group-aria-checked/switch:bg-[Highlight] motion-safe:transition-transform rtl:group-aria-checked/switch:-translate-x-4"
											})
										})
									}, e.key)),
									M.hasFrequencies && /* @__PURE__ */ D("td", {})
								]
							})
						}),
						m.map((e) => /* @__PURE__ */ O("tbody", {
							"data-inbox-preference-group": e.group?.key,
							children: [e.group && /* @__PURE__ */ D("tr", {
								className: "border-iui-inbox-border border-t",
								children: /* @__PURE__ */ D("th", {
									scope: "rowgroup",
									colSpan: M.columns,
									className: G("bg-iui-inbox-control-hover/50 px-4 pt-4 pb-2 text-start font-normal", r.group),
									children: c ? c(e.group) : /* @__PURE__ */ O(E, { children: [/* @__PURE__ */ D("span", {
										className: "text-iui-inbox-foreground font-semibold",
										children: e.group.label
									}), e.group.description && /* @__PURE__ */ D("span", {
										className: G("text-iui-inbox-muted-foreground mt-0.5 block", r.description),
										children: e.group.description
									})] })
								})
							}), e.categories.map((e) => /* @__PURE__ */ O("tr", {
								"data-inbox-preference-category": e.key,
								className: G(Hi, r.row),
								children: [
									/* @__PURE__ */ D("th", {
										scope: "row",
										className: Ui,
										children: a ? a(e) : /* @__PURE__ */ O(E, { children: [
											/* @__PURE__ */ D("span", {
												className: G(Wi, r.label),
												children: e.label
											}),
											e.locked && /* @__PURE__ */ D("span", {
												className: G("bg-iui-inbox-control-hover text-iui-inbox-muted-foreground inline-block rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", r.badge),
												children: j("locked")
											}),
											e.description && /* @__PURE__ */ D("span", {
												className: G("text-iui-inbox-muted-foreground mt-0.5 block", r.description),
												children: e.description
											})
										] })
									}),
									f.map((t) => /* @__PURE__ */ D("td", {
										className: Gi,
										children: e.channels[t.key] !== void 0 && /* @__PURE__ */ D("button", {
											type: "button",
											role: "switch",
											"aria-checked": x(e, t),
											"aria-disabled": C(e, t) || void 0,
											"aria-label": Z(A.toggle, {
												category: e.label,
												channel: t.label
											}),
											"data-inbox-preference": `${e.key}.${t.key}`,
											className: G("group/switch bg-iui-inbox-icon aria-checked:bg-iui-inbox-accent focus-visible:ring-iui-inbox-ring focus-visible:ring-offset-iui-inbox-surface relative inline-flex h-5 w-9 shrink-0 items-center rounded-full focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden aria-disabled:cursor-default aria-disabled:opacity-50 forced-colors:border motion-safe:transition-colors", r.switch),
											onClick: () => jn(e, t, f),
											children: /* @__PURE__ */ D("span", {
												"aria-hidden": "true",
												className: "bg-iui-inbox-surface ms-0.5 size-4 rounded-full shadow-sm forced-color-adjust-none group-aria-checked/switch:translate-x-4 forced-colors:bg-[ButtonText] forced-colors:group-aria-checked/switch:bg-[Highlight] motion-safe:transition-transform rtl:group-aria-checked/switch:-translate-x-4"
											})
										})
									}, t.key)),
									M.hasFrequencies && /* @__PURE__ */ D("td", {
										className: "px-4 py-3 text-start align-middle",
										children: e.frequency !== null && /* @__PURE__ */ D("select", {
											value: e.frequency,
											disabled: !S(e, f),
											"aria-label": Z(A.frequencyLabel, { category: e.label }),
											"data-inbox-preference-frequency": e.key,
											className: G("rounded-iui-inbox border-iui-inbox-border bg-iui-inbox-surface text-iui-inbox-foreground focus-visible:ring-iui-inbox-ring min-w-full border px-2 py-1 text-sm focus-visible:ring-2 focus-visible:outline-hidden disabled:cursor-default disabled:opacity-50", r.select),
											onChange: (t) => void y(e.key, t.target.value),
											children: M.frequencyOptions.map((e) => /* @__PURE__ */ D("option", {
												value: e.value,
												children: e.label
											}, e.value))
										})
									})
								]
							}, e.key))]
						}, e.group?.key ?? ""))
					]
				})
			}),
			N !== null && /* @__PURE__ */ O("div", {
				"data-inbox-push-device": "",
				"data-state": N.state,
				"aria-busy": N.state === "busy" || void 0,
				className: "border-iui-inbox-border border-t px-4 py-3 text-sm",
				children: [/* @__PURE__ */ O("div", {
					className: "flex flex-wrap items-start justify-between gap-x-6 gap-y-3",
					children: [/* @__PURE__ */ O("div", {
						className: "min-w-0 grow basis-64",
						children: [/* @__PURE__ */ D("span", {
							className: G("text-iui-inbox-foreground font-medium", r.label),
							children: j("pushDevice")
						}), /* @__PURE__ */ D("div", {
							"aria-live": "polite",
							"data-inbox-push-device-status": "",
							children: N.hint ? /* @__PURE__ */ D("p", {
								className: G("bg-iui-inbox-control-hover text-iui-inbox-foreground mt-2 rounded-md px-3 py-2", r.description),
								children: j(N.text)
							}) : /* @__PURE__ */ D("span", {
								className: G("text-iui-inbox-muted-foreground mt-0.5 block", r.description),
								children: j(N.text)
							})
						})]
					}), N.button && /* @__PURE__ */ O("button", {
						type: "button",
						"aria-disabled": N.state === "busy" || void 0,
						"data-inbox-push-device-button": "",
						className: G(N.button.primary ? "rounded-md focus-visible:ring-iui-inbox-ring inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium focus-visible:ring-2 focus-visible:outline-hidden aria-disabled:cursor-default aria-disabled:opacity-60 border-iui-inbox-accent text-iui-inbox-accent hover:bg-iui-inbox-accent-subtle border" : "rounded-md focus-visible:ring-iui-inbox-ring inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium focus-visible:ring-2 focus-visible:outline-hidden aria-disabled:cursor-default aria-disabled:opacity-60 border-iui-inbox-border bg-iui-inbox-surface hover:bg-iui-inbox-control-hover border", "shrink-0 whitespace-nowrap"),
						onClick: () => Xn(N),
						children: [N.state === "busy" && /* @__PURE__ */ D($, {
							name: "spinner",
							context: {
								component: "NotificationPreferences",
								part: "push-busy"
							},
							className: "size-3.5 motion-safe:animate-spin"
						}), j(N.button.label)]
					})]
				}), I.length > 0 && /* @__PURE__ */ O("div", {
					"data-inbox-push-other-devices": "",
					className: "mt-4",
					children: [/* @__PURE__ */ D("p", {
						id: L,
						className: "text-iui-inbox-muted-foreground text-xs font-medium",
						children: j("pushDevices")
					}), /* @__PURE__ */ D("ul", {
						"aria-labelledby": L,
						className: "divide-iui-inbox-border border-iui-inbox-border mt-2 divide-y rounded-md border",
						children: I.map((e) => /* @__PURE__ */ O("li", {
							"data-inbox-push-other-device": "",
							className: "flex items-center justify-between gap-4 px-3 py-2",
							children: [/* @__PURE__ */ O("div", {
								className: "min-w-0 grow",
								children: [/* @__PURE__ */ D("span", {
									className: G("text-iui-inbox-foreground font-medium", r.label),
									children: e.name
								}), /* @__PURE__ */ D("span", {
									className: G("text-iui-inbox-muted-foreground mt-0.5 block", r.description),
									children: e.active
								})]
							}), /* @__PURE__ */ D("button", {
								type: "button",
								"aria-label": e.removeLabel,
								"data-inbox-push-other-device-remove": "",
								className: G("rounded-md focus-visible:ring-iui-inbox-ring inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium focus-visible:ring-2 focus-visible:outline-hidden aria-disabled:cursor-default aria-disabled:opacity-60 border-iui-inbox-border bg-iui-inbox-surface hover:bg-iui-inbox-control-hover border", "shrink-0 whitespace-nowrap"),
								onClick: () => void Jn.removeDevice(e.id),
								children: j("pushDeviceRemove")
							})]
						}, e.id))
					})]
				})]
			}),
			h !== null && /* @__PURE__ */ O("div", {
				"data-inbox-preferences-notification-hours": "",
				className: "border-iui-inbox-border border-t px-4 py-3 text-sm",
				children: [/* @__PURE__ */ O("div", {
					className: "flex items-start gap-3",
					children: [/* @__PURE__ */ D("button", {
						type: "button",
						role: "switch",
						"aria-checked": h.enabled,
						"aria-label": j("notificationHours"),
						"data-inbox-notification-hours": "",
						className: G("group/switch bg-iui-inbox-icon aria-checked:bg-iui-inbox-accent focus-visible:ring-iui-inbox-ring focus-visible:ring-offset-iui-inbox-surface relative inline-flex h-5 w-9 shrink-0 items-center rounded-full focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden aria-disabled:cursor-default aria-disabled:opacity-50 forced-colors:border motion-safe:transition-colors", r.switch),
						onClick: () => void b({ enabled: !h.enabled }),
						children: /* @__PURE__ */ D("span", {
							"aria-hidden": "true",
							className: "bg-iui-inbox-surface ms-0.5 size-4 rounded-full shadow-sm forced-color-adjust-none group-aria-checked/switch:translate-x-4 forced-colors:bg-[ButtonText] forced-colors:group-aria-checked/switch:bg-[Highlight] motion-safe:transition-transform rtl:group-aria-checked/switch:-translate-x-4"
						})
					}), /* @__PURE__ */ O("div", { children: [/* @__PURE__ */ D("span", {
						className: G("text-iui-inbox-foreground font-medium", r.label),
						children: j("notificationHours")
					}), /* @__PURE__ */ D("span", {
						className: G("text-iui-inbox-muted-foreground mt-0.5 block", r.description),
						children: j("notificationHoursDescription")
					})] })]
				}), /* @__PURE__ */ D("div", {
					className: "mt-3 flex flex-col gap-3 sm:gap-2",
					children: _n(h, T, i).map(({ day: e, name: t, ranges: n, locked: i, canAdd: a }) => /* @__PURE__ */ O("div", {
						role: "group",
						"aria-label": t,
						"data-inbox-notification-hours-day": e,
						className: "flex flex-wrap items-start gap-x-4 gap-y-2",
						onBlur: (e) => {
							e.currentTarget.contains(e.relatedTarget) || k(null);
						},
						children: [/* @__PURE__ */ O("div", {
							className: "text-iui-inbox-foreground flex h-8 w-36 shrink-0 items-center gap-3 font-medium",
							children: [/* @__PURE__ */ D("button", {
								type: "button",
								role: "switch",
								"aria-checked": n.length > 0,
								"aria-disabled": i || void 0,
								"aria-label": Z(A.notificationHoursDay, { day: t }),
								"data-inbox-notification-hours-day-switch": "",
								className: G("group/switch bg-iui-inbox-icon aria-checked:bg-iui-inbox-accent focus-visible:ring-iui-inbox-ring focus-visible:ring-offset-iui-inbox-surface relative inline-flex h-5 w-9 shrink-0 items-center rounded-full focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden aria-disabled:cursor-default aria-disabled:opacity-50 forced-colors:border motion-safe:transition-colors", r.switch),
								onClick: () => z({
									kind: "toggle",
									day: e
								}),
								children: /* @__PURE__ */ D("span", {
									"aria-hidden": "true",
									className: "bg-iui-inbox-surface ms-0.5 size-4 rounded-full shadow-sm forced-color-adjust-none group-aria-checked/switch:translate-x-4 forced-colors:bg-[ButtonText] forced-colors:group-aria-checked/switch:bg-[Highlight] motion-safe:transition-transform rtl:group-aria-checked/switch:-translate-x-4"
								})
							}), /* @__PURE__ */ D("span", { children: t })]
						}), n.length > 0 ? /* @__PURE__ */ D("div", {
							className: "flex min-w-0 grow basis-60 flex-col items-start gap-2",
							children: n.map(([i, o], s) => /* @__PURE__ */ O("div", {
								className: "flex flex-wrap items-center gap-x-3 gap-y-2",
								children: [
									/* @__PURE__ */ O("label", {
										className: "text-iui-inbox-muted-foreground flex items-center gap-2 text-xs font-medium",
										children: [/* @__PURE__ */ D("span", {
											className: "sr-only",
											children: j("notificationHoursStart")
										}), /* @__PURE__ */ D("input", {
											type: "time",
											required: !0,
											value: i,
											disabled: !h.enabled,
											"data-inbox-notification-hours-start": "",
											className: G("rounded-iui-inbox border-iui-inbox-border bg-iui-inbox-surface text-iui-inbox-foreground focus-visible:ring-iui-inbox-ring border px-2 py-1 text-sm focus-visible:ring-2 focus-visible:outline-hidden disabled:cursor-default disabled:opacity-50", r.time),
											onChange: (t) => z({
												kind: "time",
												day: e,
												index: s,
												field: "start",
												time: t.target.value
											})
										})]
									}),
									/* @__PURE__ */ D("span", {
										"aria-hidden": "true",
										className: "text-iui-inbox-muted-foreground flex items-center gap-2 text-xs font-medium",
										children: "–"
									}),
									/* @__PURE__ */ O("label", {
										className: "text-iui-inbox-muted-foreground flex items-center gap-2 text-xs font-medium",
										children: [/* @__PURE__ */ D("span", {
											className: "sr-only",
											children: j("notificationHoursEnd")
										}), /* @__PURE__ */ D("input", {
											type: "time",
											required: !0,
											value: o,
											disabled: !h.enabled,
											"data-inbox-notification-hours-end": "",
											className: G("rounded-iui-inbox border-iui-inbox-border bg-iui-inbox-surface text-iui-inbox-foreground focus-visible:ring-iui-inbox-ring border px-2 py-1 text-sm focus-visible:ring-2 focus-visible:outline-hidden disabled:cursor-default disabled:opacity-50", r.time),
											onChange: (t) => z({
												kind: "time",
												day: e,
												index: s,
												field: "end",
												time: t.target.value
											})
										})]
									}),
									n.length > 1 && /* @__PURE__ */ D("button", {
										type: "button",
										disabled: !h.enabled,
										"aria-label": Z(A.notificationHoursRemoveLabel, {
											start: i,
											end: o,
											day: t
										}),
										"data-inbox-notification-hours-remove": "",
										className: "text-iui-inbox-muted-foreground -ms-2 hover:bg-iui-inbox-control-hover hover:text-iui-inbox-foreground focus-visible:ring-iui-inbox-ring rounded-md px-2 py-1 text-xs font-medium focus-visible:ring-2 focus-visible:outline-hidden disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-iui-inbox-muted-foreground",
										onClick: () => z({
											kind: "remove",
											day: e,
											index: s
										}),
										children: j("notificationHoursRemove")
									}),
									s === n.length - 1 && /* @__PURE__ */ D("button", {
										type: "button",
										disabled: !a,
										"aria-label": Z(A.notificationHoursAddLabel, { day: t }),
										"data-inbox-notification-hours-add": "",
										className: "text-iui-inbox-muted-foreground -ms-2 hover:bg-iui-inbox-control-hover hover:text-iui-inbox-foreground focus-visible:ring-iui-inbox-ring rounded-md px-2 py-1 text-xs font-medium focus-visible:ring-2 focus-visible:outline-hidden disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-iui-inbox-muted-foreground",
										onClick: () => z({
											kind: "add",
											day: e
										}),
										children: j("notificationHoursAdd")
									})
								]
							}, s))
						}) : /* @__PURE__ */ D("p", {
							className: "text-iui-inbox-muted-foreground flex h-8 items-center",
							children: j("notificationHoursOff")
						})]
					}, e))
				})]
			})
		]
	});
}
// src/useNotifications.ts
function $a() {
	let { props: e } = T(), t = s(X.subscribe, X.getSnapshot, X.getServerSnapshot);
	return r(() => {
		qi(), _t(e);
	}, []), {
		...t,
		...gt,
		toast: Hr
	};
}
// src/useToasts.ts
var eo = [], to = (e, t, n) => n ? Ir(e, t, n.nativeEvent) : Fr(e, t);
function no(e) {
	Ji();
	let t = s(Q.subscribe, Q.getSnapshot, () => eo);
	s(Q.subscribe, or, () => 0);
	let n = i(() => t.filter((t) => t.toaster === e), [t, e]), [a] = o(cr);
	return r(() => Q.attach(e), [e]), r(() => a.release, []), {
		toasts: n,
		toast: Hr,
		update: Q.update,
		dismiss: Q.dismiss,
		pause: a.pause,
		resume: a.resume,
		timer: Q.timer,
		runAction: to
	};
}
// src/iconResolver.ts
var ro = _e, io = ve;
export { xr as DEFAULT_ERROR_MESSAGES, wt as DEFAULT_INBOX_LABELS, En as DEFAULT_PREFERENCES_LABELS, Ka as NotificationCenter, Ha as NotificationItem, qa as NotificationList, Qa as NotificationPreferences, ta as Toaster, ct as groupItems, X as inboxStore, qi as initNotifications, Re as isSnoozed, ft as pauseEnd, mt as pauseTime, kn as preferencesStore, xt as relativeTime, Vt as requestNotificationPermission, io as resolveIcon, ro as setIconResolver, Se as setTranslations, lt as snoozeOptions, Hr as toast, Te as trans, $a as useNotifications, Ya as usePreferences, Za as usePush, no as useToasts };
