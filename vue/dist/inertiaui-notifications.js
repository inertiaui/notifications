import { Fragment as e, Teleport as t, computed as n, createBlock as r, createCommentVNode as i, createElementBlock as a, createElementVNode as o, createSlots as s, createTextVNode as c, createVNode as l, defineComponent as u, guardReactiveProps as d, mergeModels as f, mergeProps as p, nextTick as m, normalizeClass as h, normalizeProps as g, normalizeStyle as _, onBeforeUnmount as v, onMounted as y, onUnmounted as b, onUpdated as x, openBlock as S, ref as C, renderList as w, renderSlot as T, resolveDynamicComponent as E, shallowRef as D, toDisplayString as O, toValue as k, unref as A, useId as j, useModel as M, watch as N, withCtx as P } from "vue";
import { InfiniteScroll as F, Link as I, http as L, router as R, socketId as z, usePage as B } from "@inertiajs/vue3";
import { extendTailwindMerge as ee } from "tailwind-merge";
import { animate as V, autoUpdateTopLayerPopover as H, cancelAnimations as te, createAnnouncer as ne, createPopoverController as re, createTooltipController as ie, isRightToLeft as ae, positionTopLayerPopover as oe, prefersReducedMotion as U, replacePlaceholders as se } from "@inertiaui/vanilla";
// ../js/types.ts
var W = [
	"top-left",
	"top-center",
	"top-right",
	"bottom-left",
	"bottom-center",
	"bottom-right"
], ce = [
	"get",
	"post",
	"put",
	"patch",
	"delete"
], le = "inertiaui", ue = "x-inertiaui-toasts", G = (e) => typeof e == "object" && !!e && !Array.isArray(e), K = (e) => typeof e == "string" ? e : null, q = (e) => typeof e == "string" && /^[a-z][a-z\d-]*$/.test(e), de = (e) => G(e) && typeof e.uuid == "string" && typeof e.title == "string" && (e.type === void 0 || q(e.type));
function fe(e) {
	if (typeof e != "string") return;
	let t = /^([a-z][a-z\d+.-]*):/i.exec(e.replace(/[\u0000-\u0020]/g, ""))?.[1]?.toLowerCase();
	return t === void 0 || t === "http" || t === "https" || t === "mailto" || t === "tel" ? e : void 0;
}
function pe(e) {
	return Array.isArray(e) ? e.flatMap((e) => {
		if (!G(e) || typeof e.label != "string") return [];
		let t = fe(e.href);
		return t === void 0 && typeof e.event != "string" ? [] : [{
			label: e.label,
			href: t,
			method: ce.includes(e.method) ? e.method : void 0,
			data: G(e.data) ? e.data : void 0,
			visit: G(e.visit) ? e.visit : void 0,
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
var me = (e) => ({
	id: typeof e.id == "string" ? e.id : void 0,
	type: e.type,
	description: typeof e.description == "string" ? e.description : void 0,
	duration: typeof e.duration == "number" || e.duration === null ? e.duration : void 0,
	actions: pe(e.actions),
	icon: typeof e.icon == "string" || e.icon === !1 ? e.icon : void 0,
	image: fe(e.image),
	dismissible: typeof e.dismissible == "boolean" ? e.dismissible : void 0,
	position: W.includes(e.position) ? e.position : void 0,
	toaster: typeof e.toaster == "string" ? e.toaster : void 0,
	data: G(e.data) ? e.data : void 0,
	progress: typeof e.progress == "number" ? e.progress : void 0
});
function he(e) {
	let t = /* @__PURE__ */ new Set();
	return (n) => {
		if (Array.isArray(n)) for (let r of n) de(r) && (t.has(r.uuid) || (t.add(r.uuid), e(r.title, me(r))));
	};
}
function ge(e, t) {
	let n = e?.[t];
	return G(n) ? n.toasts : void 0;
}
function _e(e) {
	let t = e[ue];
	if (t) try {
		return JSON.parse(t);
	} catch {
		return;
	}
}
function ve(e) {
	if (e.headers["x-inertia"] === "true" && (typeof e.data != "string" || e.data.includes("\"flash\":"))) try {
		let t = (typeof e.data == "string" ? JSON.parse(e.data) : e.data)?.flash;
		return G(t) ? t : void 0;
	} catch {
		return;
	}
}
// ../js/actions.ts
function ye(e) {
	let t = fe(e.href);
	return t !== void 0 && (e.method ?? "get") === "get" ? t : void 0;
}
function be(e) {
	try {
		return new URL(e, window.location.href).origin === window.location.origin;
	} catch {
		return !1;
	}
}
function xe(e) {
	let t = new URL(window.location.href), n = new URL(e.url, t);
	for (let e of [t, n]) e.hash = "", e.searchParams.sort();
	return n.href === t.href;
}
function Se(e) {
	return e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
}
function Ce(e) {
	let t = e.target;
	return typeof t?.closest == "function" && t.closest("a[href]") !== null;
}
function we(e, t, n) {
	return !e.onClick && Ce(n) && (Se(n) || e.external || e.newTab || !be(t));
}
var Te = 1500;
function Ee(e, t) {
	let n, r = () => {
		n !== void 0 && (clearTimeout(n), n = void 0, window.location.assign(t));
	};
	n = setTimeout(r, Te), e.then(r, r);
}
function De(e, t, n, r, i) {
	r();
	let a = i?.();
	a && !Se(n) && !t.newTab && (n.preventDefault(), Ee(a, e));
}
var Oe = (e) => typeof e?.then == "function";
function ke(e, t, n, r, i) {
	e.event && window.dispatchEvent(new CustomEvent(e.event, { detail: e.payload }));
	let a = e.onClick?.(t);
	if (Oe(a)) return a.then(() => {
		i?.(), r(!0);
	}, () => r(!1)), "pending";
	let o = fe(e.href);
	if (o === void 0) return i?.(), "done";
	let s = e.method ?? "get";
	if (s === "get" && (e.external || e.newTab || !n || !be(o))) {
		if (e.newTab) window.open(o, "_blank", "noopener"), i?.();
		else {
			let e = i?.();
			e ? Ee(e, o) : window.location.assign(o);
		}
		return "done";
	}
	if (!n) return "failed";
	let c = !1;
	return n.visit(o, {
		method: s,
		data: e.data,
		...s === "get" ? {} : {
			preserveState: xe,
			preserveScroll: xe
		},
		...e.visit,
		onSuccess: () => void (c = !0),
		onFinish: () => {
			c && i?.(), r(c);
		}
	}), "pending";
}
// ../js/cn.ts
var Ae = ee({ extend: { theme: { radius: ["iui-toast", "iui-inbox"] } } });
function J(...e) {
	return Ae(e.filter(Boolean).join(" "));
}
// ../js/icons.ts
var je = (e, t) => Object.hasOwn(e, t) ? e[t] : void 0, Me = {
	success: "M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z",
	info: "M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z",
	warning: "M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
	error: "M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z"
}, Ne = "M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z", Pe = "M10 3a7 7 0 0 1 7 7", Fe = ["M10 2a6 6 0 0 0-6 6c0 1.887-.454 3.665-1.257 5.234a.75.75 0 0 0 .515 1.076 32.91 32.91 0 0 0 3.256.508 3.5 3.5 0 0 0 6.972 0 32.903 32.903 0 0 0 3.256-.508.75.75 0 0 0 .515-1.076A11.448 11.448 0 0 1 16 8a6 6 0 0 0-6-6ZM8.05 14.943a33.54 33.54 0 0 0 3.9 0 2 2 0 0 1-3.9 0Z"], Ie = ["M4 8c0-.26.017-.517.049-.77l7.722 7.723a33.56 33.56 0 0 1-3.722-.01 2 2 0 0 0 3.862.15l1.134 1.134a3.5 3.5 0 0 1-6.53-1.409 32.91 32.91 0 0 1-3.257-.508.75.75 0 0 1-.515-1.076A11.448 11.448 0 0 0 4 8ZM17.266 13.9a.756.756 0 0 1-.068.116L6.389 3.207A6 6 0 0 1 16 8c.001 1.887.455 3.665 1.258 5.234a.75.75 0 0 1 .01.666ZM3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06L3.28 2.22Z"], Le = ["M1 11.27c0-.246.033-.492.099-.73l1.523-5.521A2.75 2.75 0 0 1 5.273 3h9.454a2.75 2.75 0 0 1 2.651 2.019l1.523 5.52c.066.239.099.485.099.732V15a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-3.73Zm3.068-5.852A1.25 1.25 0 0 1 5.273 4.5h9.454a1.25 1.25 0 0 1 1.205.918l1.523 5.52c.006.02.01.041.015.062H14a1 1 0 0 0-.86.49l-.606 1.02a1 1 0 0 1-.86.49H8.236a1 1 0 0 1-.894-.553l-.448-.894A1 1 0 0 0 6 11H2.53l.015-.062 1.523-5.52Z"], Re = {
	dismiss: [Ne],
	bell: Fe,
	notification: Fe,
	read: ["M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"],
	unread: ["M3 4a2 2 0 0 0-2 2v1.161l8.441 4.221a1.25 1.25 0 0 0 1.118 0L19 7.162V6a2 2 0 0 0-2-2H3Z", "m19 8.839-7.77 3.885a2.75 2.75 0 0 1-2.46 0L1 8.839V14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.839Z"],
	archive: ["M2 3a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H2Z", "M2 7.5h16l-.811 7.71a2 2 0 0 1-1.99 1.79H4.802a2 2 0 0 1-1.99-1.79L2 7.5ZM7 11a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1Z"],
	unarchive: Le,
	snooze: ["M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z"],
	unsnooze: Le,
	mute: Ie,
	unmute: Fe,
	pause: ["M2 10a8 8 0 1 1 16 0 8 8 0 0 1-16 0Zm5-2.25A.75.75 0 0 1 7.75 7h.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1-.75-.75v-4.5Zm4 0a.75.75 0 0 1 .75-.75h.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1-.75-.75v-4.5Z"],
	paused: Ie,
	more: ["M3 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM8.5 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM15.5 8.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"],
	delete: ["M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"],
	empty: Le,
	result: ["M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"],
	announcement: ["M13.92 3.845a19.362 19.362 0 0 1-6.3 1.98C6.765 5.942 5.89 6 5 6a4 4 0 0 0-.504 7.969 15.97 15.97 0 0 0 1.271 3.34c.397.771 1.342 1 2.05.59l.867-.5c.726-.419.94-1.32.588-2.02-.166-.331-.315-.666-.448-1.004 1.8.357 3.511.963 5.096 1.78A17.964 17.964 0 0 0 15 10c0-2.162-.381-4.235-1.08-6.155ZM15.243 3.097A19.456 19.456 0 0 1 16.5 10c0 2.43-.445 4.758-1.257 6.904l-.03.077a.75.75 0 0 0 1.401.537 20.903 20.903 0 0 0 1.312-5.745 2 2 0 0 0 0-3.546 20.902 20.902 0 0 0-1.312-5.745.75.75 0 0 0-1.4.537l.029.078Z"]
}, ze = null;
function Be(e) {
	ze = e;
}
function Ve(e, t = {}) {
	return ze?.(e, t) ?? null;
}
function He(e, t, n = {}, r) {
	let i = je(n, e) ?? (r ? r(e, t) : Ve(e, t));
	return i == null || i === !1 ? void 0 : i;
}
// ../js/translations.ts
var Ue = {
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
}, We = Object.assign(Object.create(null), Ue);
function Ge(e) {
	for (let [t, n] of Object.entries(e)) n !== void 0 && (We[t] = n);
}
var Ke = (e) => Object.hasOwn(We, e) ? We[e] : void 0;
function qe(e, t = {}) {
	return typeof e == "function" ? e(t) : se(e, t);
}
function Je(e, t = {}) {
	let n = Ke(e);
	return n === void 0 ? e : qe(n, t);
}
var Ye = (e, t) => e + t.replace(/[A-Z]/g, (e) => `_${e.toLowerCase()}`);
function Xe(e, t) {
	return Object.fromEntries(t.map((t) => [t, Ue[Ye(e, t)]]));
}
function Ze(e, t, n) {
	let r = (e) => n && Object.hasOwn(n, e) ? n[e] : void 0;
	return Object.fromEntries(t.map((t) => [t, r(t) ?? Ke(Ye(e, t)) ?? Ye(e, t)]));
}
// ../js/inbox.ts
var Qe = [
	"read",
	"unread",
	"seen",
	"archive",
	"unarchive",
	"snooze",
	"unsnooze",
	"delete"
], $e = [
	"snooze",
	"archive",
	"mute",
	"delete"
], et = [
	"snooze",
	"archive",
	"mute"
], tt = {
	archive: "archive",
	unarchive: "archive",
	snooze: "snooze",
	unsnooze: "snooze",
	delete: "delete"
}, nt = (e, t) => (e !== "snoozed" || t.includes("snooze")) && (e !== "archived" || t.includes("archive")), rt = 100, it = "inertiauiInbox", Y = (e) => e ? Date.parse(e) : NaN, at = ({ counts: e, category: t, categoryCounts: n }) => t === null ? e.unread : n[t] ?? 0, ot = (e) => e.expiresAt !== null && Y(e.expiresAt) <= Date.now(), st = (e, t = Date.now()) => e.snoozedUntil !== null && Y(e.snoozedUntil) > t, ct = (e, t, n) => {
	if (t === null || n === 0) return e;
	let { [t]: r = 0, ...i } = e, a = Math.max(0, r + n);
	return a === 0 ? i : {
		...i,
		[t]: a
	};
}, lt = (e, t) => Y(e.createdAt) > Y(t.createdAt) || Y(e.createdAt) === Y(t.createdAt) && e.total > t.total, ut = (e, t) => {
	let n = new Map(t.map((e) => [e.id, e])), r = e.filter((e) => {
		let t = n.get(e.id);
		return t === void 0 || lt(e, t);
	}), i = new Set(r.map((e) => e.id));
	return [...r, ...t.filter((e) => !i.has(e.id))];
}, dt = (e, { latest: t, latestIds: n }) => t !== null && (Y(e.createdAt) < Y(t) || Y(e.createdAt) === Y(t) && n.includes(e.id)), ft = (e) => G(e) ? {
	name: K(e.name) ?? void 0,
	avatar: fe(e.avatar)
} : null;
function pt(e) {
	if (!G(e) || typeof e.id != "string" || typeof e.title != "string" || typeof e.createdAt != "string") return;
	let t = ft(e.actor), n = (Array.isArray(e.actors) ? e.actors.map(ft) : [t]).filter((e) => e !== null);
	return {
		id: e.id,
		type: K(e.type) ?? "",
		title: e.title,
		body: K(e.body),
		icon: K(e.icon),
		image: fe(e.image) ?? null,
		url: fe(e.url) ?? null,
		actions: pe(e.actions),
		actor: t,
		actors: n,
		actorCount: typeof e.actorCount == "number" ? e.actorCount : n.length,
		total: typeof e.total == "number" ? e.total : 1,
		category: K(e.category),
		group: K(e.group),
		toast: q(e.toast) ? e.toast : null,
		data: G(e.data) ? e.data : {},
		readAt: K(e.readAt),
		seenAt: K(e.seenAt),
		archivedAt: K(e.archivedAt),
		snoozedUntil: K(e.snoozedUntil),
		result: K(e.result),
		muted: e.muted === !0,
		...e.quiet === !0 ? { quiet: !0 } : {},
		createdAt: e.createdAt,
		revision: typeof e.revision == "number" ? e.revision : null,
		announcement: e.announcement === !0,
		expiresAt: K(e.expiresAt)
	};
}
var mt = (e) => Array.isArray(e) ? {} : G(e) ? Object.fromEntries(Object.entries(e).filter((e) => typeof e[1] == "number")) : void 0, ht = (e) => {
	let t = G(e) ? mt(e.categories) : void 0;
	return G(e) && typeof e.unread == "number" && typeof e.unseen == "number" && typeof e.revision == "number" && (e.latest === null || typeof e.latest == "string") && Array.isArray(e.latestIds) && t !== void 0 ? {
		unread: e.unread,
		unseen: e.unseen,
		categories: t,
		revision: e.revision,
		counted: {
			latest: e.latest,
			latestIds: e.latestIds.filter((e) => typeof e == "string")
		},
		context: K(e.context)
	} : void 0;
}, gt = (e) => G(e) ? Object.fromEntries(Object.entries(e).filter((e) => typeof e[1] == "string")) : {}, _t = (e) => Array.isArray(e) ? e.filter((e) => e === "tomorrow" || typeof e == "number" && Number.isInteger(e) && e > 0) : Pt, vt = (e) => G(e) ? Object.fromEntries(Object.entries(e).filter((e) => G(e[1])).map(([e, t]) => [e, {
	label: K(t.label) ?? e,
	category: K(t.category),
	data: G(t.data) ? Object.fromEntries(Object.entries(t.data).filter((e) => [
		"string",
		"number",
		"boolean"
	].includes(typeof e[1]))) : {}
}])) : {}, yt = (e, t) => t !== void 0 && (t.category === null || e.category === t.category) && Object.entries(t.data).every(([t, n]) => e.data[t] === n);
function bt(e) {
	if (!G(e)) return;
	if (e.kind === "item") return typeof e.id == "string" ? {
		kind: "item",
		id: e.id,
		readAt: K(e.readAt),
		seenAt: K(e.seenAt),
		archivedAt: K(e.archivedAt),
		snoozedUntil: K(e.snoozedUntil),
		result: K(e.result)
	} : void 0;
	if (e.kind === "delete") return Array.isArray(e.ids) ? {
		kind: "delete",
		ids: e.ids.filter((e) => typeof e == "string")
	} : void 0;
	if (e.kind === "update") {
		let t = pt(e.item);
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
		let t = Qe.find((t) => t === e.action);
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
	let t = Array.isArray(e.ids) ? e.ids.filter((e) => typeof e == "string") : null, n = K(e.category);
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
var xt = (e, t) => t.split(".").reduce((e, t) => G(e) ? e[t] : void 0, e), St = () => ({
	unread: 0,
	unseen: 0,
	categories: {}
}), Ct = 2147483647, wt = (e, { before: t, ids: n, category: r }) => {
	if (r !== null && e.category !== r) return !1;
	let i = Y(e.createdAt);
	return i < Y(t) || i === Y(t) && (n === null || n.includes(e.id));
}, Tt = (e, t, n) => wt(e, t) ? t.kind === "archive" ? e.archivedAt === null && (!t.onlyRead || e.readAt !== null) ? {
	...e,
	archivedAt: n
} : e : t.kind === "seen" ? e.seenAt === null ? {
	...e,
	seenAt: n
} : e : e.readAt === null && e.archivedAt === null && !st(e) ? {
	...e,
	readAt: n,
	seenAt: e.seenAt ?? n
} : e : e, Et = (e, { action: t, ids: n, at: r, until: i }) => n.includes(e.id) ? t === "read" ? e.readAt === null ? {
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
} : e : e, Dt = (e, t, n) => t.kind === "items" ? Et(e, t) : Tt(e, t, n), Ot = ({ readAt: e, seenAt: t, archivedAt: n, snoozedUntil: r, result: i }) => ({
	readAt: e,
	seenAt: t,
	archivedAt: n,
	snoozedUntil: r,
	result: i
});
function kt() {
	let e, t = it, n, r = 0, i, a, o = null, s = null, c = et, l = !0, u = {}, d = Pt, f = {}, p = null, m, h, g = {
		unread: 0,
		unseen: 0
	}, _ = {}, v = [], y = [], b = "all", x = null, S = "idle", C = !1, w = !1, T = null, E = 0, D, O = {}, k = 0, A = 0, j = /* @__PURE__ */ new Set(), M = /* @__PURE__ */ new Map(), N = [], P = [], F = /* @__PURE__ */ new Set(), I = /* @__PURE__ */ new Set(), L = /* @__PURE__ */ new Map(), R = /* @__PURE__ */ new Map(), z = !1, B = {
		until: null,
		revision: -Infinity
	}, ee = null, V, H = null, te = /* @__PURE__ */ new Set(), ne = /* @__PURE__ */ new Set(), re = /* @__PURE__ */ new Set(), ie = /* @__PURE__ */ new Set(), ae, oe = (e, t, n) => {
		let r = M.get(e);
		(!r || n > r.revision) && M.set(e, {
			state: t,
			revision: n
		});
	}, U = (e) => {
		let t = L.get(e.id), n = e.revision ?? -Infinity, r = e;
		t !== void 0 && (t.revision ?? -Infinity) > n && (r = t, n = t.revision ?? n);
		let i = r.group === null ? void 0 : R.get(r.group);
		i !== void 0 && i.revision > n && (r = {
			...r,
			muted: i.muted
		});
		let a = M.get(e.id);
		a && a.revision > n && (r = {
			...r,
			...a.state
		}, n = a.revision);
		for (let e of N) e.revision > n && (r = Dt(r, e.change, e.at));
		for (let t of P) t.kind === "bulk" ? r = Dt(r, t.change, t.at) : t.kind === "mute" && t.group === r.group ? r = {
			...r,
			muted: t.muted
		} : t.kind === "item" && t.id === e.id && (t.createdAt === null || Y(e.createdAt) <= Y(t.createdAt)) && (r = {
			...r,
			...t.state
		});
		return r;
	}, se = (e) => I.has(e) || P.some((t) => t.kind === "delete" && t.ids.includes(e)), W = (e, t, n = null) => se(e.id) || ot(e) || n !== null && e.category !== n ? !1 : t === "archived" || e.archivedAt !== null ? t === "archived" && e.archivedAt !== null : st(e) === (t === "snoozed") ? t === "unread" ? e.readAt === null || F.has(e.id) : t === "all" || t === "snoozed" || yt(e, Object.hasOwn(f, t) ? f[t] : void 0) : !1, ce = () => {
		let e = P.reduce((e, t) => t.kind === "pause" ? t.until : e, void 0), t = e === void 0 ? B.until : e;
		return z && t !== null && Y(t) > Date.now() ? t : null;
	}, le = (e) => {
		e !== H && (clearTimeout(V), V = void 0, H = e, e !== null && (V = setTimeout(() => {
			H = null, ce() === null ? q() : le(e);
		}, Math.min(Y(e) - Date.now(), Ct))));
	}, ue = (e, t) => {
		t > B.revision && (B = {
			until: e,
			revision: t
		});
	}, q = () => {
		let e = ce();
		le(e), ae = {
			url: a,
			user: i,
			channel: o,
			announcementsChannel: s,
			allowedActions: c,
			selectable: l,
			categoryFilter: u,
			tabs: f,
			counts: g,
			items: ut(y, v).map(U).filter((e) => W(e, b, x)),
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
			canPause: z,
			pausePresets: d
		}, te.forEach((e) => e());
	};
	q();
	let de = ae, pe = (e) => {
		for (let t of e) {
			let e = Y(t.createdAt);
			D === void 0 || e > Y(D.at) ? D = {
				at: t.createdAt,
				ids: /* @__PURE__ */ new Set([t.id])
			} : e === Y(D.at) && D.ids.add(t.id), t.revision !== null && oe(t.id, Ot(t), t.revision);
		}
	}, me = () => (/* @__PURE__ */ new Date()).toISOString(), he = () => h !== void 0 && h.counted.latest !== null && (D === void 0 || Y(h.counted.latest) > Y(D.at)), ge = (e) => e.archivedAt === null && !st(e), _e = (e) => ge(e) ? {
		unread: +(e.readAt === null),
		unseen: +(e.seenAt === null)
	} : {
		unread: 0,
		unseen: 0
	}, ve = (e) => {
		let { unread: t, unseen: n } = _e(e);
		g = {
			unread: g.unread + t,
			unseen: g.unseen + n
		}, _ = ct(_, e.category, t);
	}, xe = (e) => h === void 0 || !dt(e, h.counted), Ce = () => {
		if (!(h === void 0 || P.length > 0)) {
			g = {
				unread: h.unread,
				unseen: h.unseen
			}, _ = h.categories;
			for (let e of y) xe(e) && ve(U(e));
		}
	}, Te = (e) => {
		let t = ht(G(e) ? e.counts : void 0);
		!t || t.context !== p || h !== void 0 && t.revision < h.revision || (h = t, Ce());
	}, Ee = ({ unread: e, unseen: t, categories: n }, r) => {
		g = {
			unread: Math.max(0, g.unread + r * e),
			unseen: Math.max(0, g.unseen + r * t)
		}, _ = Object.entries(n).reduce((e, [t, n]) => ct(e, t, r * n), _);
	}, Oe = (e, t) => {
		if (e.kind === "item") {
			let { kind: n, id: r, ...i } = e;
			oe(r, i, t);
		} else if (e.kind === "delete") Ae(e.ids);
		else if (e.kind === "update") {
			let n = {
				...e.item,
				revision: e.item.revision ?? t
			}, r = L.get(n.id);
			(r === void 0 || (r.revision ?? 0) < n.revision) && L.set(n.id, n), oe(n.id, Ot(n), n.revision);
		} else if (e.kind === "mute") {
			let n = R.get(e.group);
			(n === void 0 || n.revision < t) && R.set(e.group, {
				muted: e.muted,
				revision: t
			});
		} else e.kind === "pause" ? ue(e.until, t) : N = [...N, {
			change: e,
			at: me(),
			revision: t
		}];
	}, Ae = (e) => {
		e.forEach((e) => I.add(e)), y = y.filter((e) => !I.has(e.id)), v = v.filter((e) => !I.has(e.id));
	}, J = () => {
		r++, E++, i = void 0, a = void 0, o = null, s = null, c = et, l = !0, u = {}, d = Pt, f = {}, p = null, m = void 0, h = void 0, g = {
			unread: 0,
			unseen: 0
		}, _ = {}, v = [], y = [], b = "all", x = null, S = "idle", C = !1, w = !1, T = null, D = void 0, O = {}, M.clear(), N = [], P = [], F.clear(), I.clear(), L.clear(), R.clear(), z = !1, B = {
			until: null,
			revision: -Infinity
		}, ee = null;
	}, je = async (t) => {
		let n = new URLSearchParams({ filter: b });
		x !== null && n.set("category", x), t && n.set("cursor", t);
		let r = await e.request("get", `${a}?${n.toString()}`);
		return {
			items: G(r) && Array.isArray(r.items) ? r.items.map(pt).filter((e) => e !== void 0) : [],
			cursor: G(r) && typeof r.nextCursor == "string" ? r.nextCursor : null,
			body: r
		};
	}, Me = async (t, i, o) => {
		if (!e || a === void 0) return;
		let s = r;
		P = [...P, t], Ee(t.delta, 1), q();
		try {
			let n = await e.request("post", `${a}/${i}`, o);
			if (s !== r) return;
			let c = G(n) ? n : {}, l = bt(c.change), u = ht(c.counts)?.revision;
			if (!l || u === void 0) throw Error("The inbox endpoint answered without the change and the counts.");
			P = P.filter((e) => e !== t), Oe(l, u), Te(c), ie.forEach((e) => e({
				change: l,
				counts: c.counts
			}));
		} catch (e) {
			if (s !== r) return;
			P = P.filter((e) => e !== t), Ee(t.delta, -1), n?.(e);
		}
		Ce(), q();
	}, Ne = (e) => e.reduce((e, { before: t, after: n }) => {
		let r = _e(t), i = n === void 0 ? {
			unread: 0,
			unseen: 0
		} : _e(n), a = i.unread - r.unread;
		return {
			unread: e.unread + a,
			unseen: e.unseen + i.unseen - r.unseen,
			categories: t.category === null || a === 0 ? e.categories : ct(e.categories, t.category, a)
		};
	}, St()), Pe = (e, t, n) => {
		let r = t.map((e) => e.id);
		if (e === "delete") return Me({
			kind: "delete",
			ids: r,
			delta: Ne(t.map((e) => ({
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
			at: me(),
			...n === void 0 ? {} : { until: n }
		}, a = Ne(t.map((e) => ({
			before: e,
			after: Et(e, i)
		})));
		return e === "seen" ? Me({
			kind: "bulk",
			change: i,
			at: i.at,
			delta: a
		}, "seen/items", { ids: r }) : Me({
			kind: "bulk",
			change: i,
			at: i.at,
			delta: a
		}, "batch", {
			action: e,
			ids: r,
			...n === void 0 ? {} : { until: n }
		});
	}, Fe = (e, t, n, r) => {
		let i = _e(e), a = _e({
			...e,
			...t
		}), o = a.unread - i.unread;
		return Me({
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
	}, Ie = (e, t, n) => Me({
		kind: "mute",
		group: t,
		muted: n,
		delta: St()
	}, `${encodeURIComponent(e.id)}/${n ? "mute" : "unmute"}`), Le = (e, t, n, r, i) => {
		let a = D ? {
			before: D.at,
			ids: [...D.ids]
		} : {
			before: me(),
			ids: null
		}, o = {
			...D ? a : {},
			...t === null ? {} : { category: t },
			...i
		};
		return Me({
			kind: "bulk",
			change: {
				...e,
				...a,
				category: t
			},
			at: me(),
			delta: n
		}, r, Object.keys(o).length > 0 ? o : void 0);
	}, Re = (e, t = null) => {
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
	}, ze = (e) => {
		let t = y.find((t) => t.id === e) ?? v.find((t) => t.id === e);
		return t && U(t);
	}, Be = (e) => {
		let t = typeof e == "string" ? e : e.id, n = typeof e == "string" ? ze(e) : U(e), r = me();
		return n === void 0 ? Me({
			kind: "item",
			id: t,
			state: { readAt: r },
			delta: St(),
			createdAt: null
		}, `${encodeURIComponent(t)}/read`) : n.readAt === null ? (F.add(t), Fe(n, {
			readAt: r,
			seenAt: n.seenAt ?? r
		}, "read")) : Promise.resolve();
	}, Ve = (e, t) => {
		let n = typeof e == "string" ? e : e.id, r = typeof e == "string" ? ze(e) : U(e), i = `${encodeURIComponent(n)}/complete`;
		if (r === void 0) return Me({
			kind: "item",
			id: n,
			state: {},
			delta: St(),
			createdAt: null
		}, i, { action: t });
		let a = r.actions[t]?.result;
		return a === void 0 ? Promise.resolve() : Fe(r, { result: a }, "complete", { action: t });
	}, He = (e, t) => {
		let n = r;
		return () => n === r ? Ve(e, t) : Promise.resolve();
	}, Ue = (e) => c.includes(e), We = {
		subscribe(e) {
			return te.add(e), () => te.delete(e);
		},
		getSnapshot: () => ae,
		getServerSnapshot: () => de,
		connect(r, i = {}) {
			e = r, t = i.prop ?? t, n = i.onFailure ?? n;
		},
		sync(e, n) {
			let r = xt(e, t), h = n === "history" || n === "cached";
			if (!G(r)) {
				r === null && !h && a !== void 0 && (J(), q());
				return;
			}
			let g = K(r.user) ?? void 0;
			if (g !== i) {
				if (h) return;
				J(), i = g;
			}
			if (a = K(r.url) ?? a, o = K(r.channel), s = K(r.announcementsChannel), f = vt(r.tabs), p = K(r.context), z = G(r.pause), !h) {
				let e = r.allowedActions;
				c = Array.isArray(e) ? $e.filter((t) => e.includes(t)) : et, l = r.selectable !== !1, u = gt(r.categoryFilter), d = _t(G(r.pause) ? r.pause.presets : void 0);
			}
			nt(b, c) || (b = "all", S !== "idle" && We.load()), !h && r !== m && (F.clear(), Te({ counts: r }), ee = r.push ?? null, G(r.pause) && ue(K(r.pause.until), typeof r.revision == "number" ? r.revision : 0)), m = r, q();
		},
		async load(t, n) {
			if (!e || a === void 0) return;
			let i = r, o = ++E;
			x = n === void 0 ? t === void 0 ? x : null : n, b = t ?? b, b = nt(b, c) ? b : "all", S = "loading", C = !1, w = !1, F.clear(), q();
			try {
				let e = await je(null);
				i === r && o === E && (v = e.items, T = e.cursor, S = "ready", pe(e.items), Te(e.body));
			} catch {
				i === r && o === E && (S = "error");
			}
			q();
		},
		async loadMore({ retry: t = !1 } = {}) {
			if (!e || a === void 0 || T === null || C || S !== "ready" || w && !t) return;
			let n = r, i = E;
			C = !0, w = !1, q();
			let o = await je(T).catch(() => void 0);
			if (n === r && i === E) {
				if (o === void 0) w = !0;
				else {
					let e = new Set(v.map((e) => e.id));
					v = [...v, ...o.items.filter((t) => !e.has(t.id))], T = o.cursor, pe(o.items);
				}
				C = !1, q();
			}
		},
		async refresh() {
			if (!e || a === void 0) return;
			let t = r;
			try {
				let n = await e.request("get", `${a}/counts`);
				t === r && (Te(n), q());
			} catch {}
		},
		async loadArrival(t, n = null) {
			if (!e || a === void 0 || n !== null && n !== p) return;
			let i = r;
			try {
				let n = await e.request("get", `${a}/${encodeURIComponent(t)}`);
				return i === r && G(n) ? We.receive(n.item, n.counts) : void 0;
			} catch {
				return;
			}
		},
		receive(e, t) {
			let n = pt(e);
			if (!n || a === void 0 || I.has(n.id) || y.some((e) => e.id === n.id && !lt(n, e))) return;
			let r = G(e) ? K(e.context) : null;
			if (p !== null && r !== null && r !== p) return;
			y = [n, ...y.filter((e) => e.id !== n.id)].sort((e, t) => Y(t.createdAt) - Y(e.createdAt)), pe([n]);
			let i = U(n);
			return Te({ counts: t }), P.length > 0 || h === void 0 ? xe(n) && ve(i) : Ce(), q(), k > 0 && S === "ready" && W(i, b, x) && i.seenAt === null && We.markAllAsSeen(), ne.forEach((e) => e(n)), n;
		},
		onArrival(e) {
			return ne.add(e), () => ne.delete(e);
		},
		receiveChange(e) {
			let t = G(e) ? e.change : void 0, n = bt(t), r = ht(G(e) ? e.counts : void 0);
			if (!n || r === void 0 || a === void 0) return;
			let { revision: i } = r;
			(r.context === p || n.kind !== "read" && n.kind !== "seen" && n.kind !== "archive") && (n.kind === "item" && G(t) && G(t.item) && We.receive({
				...t.item,
				revision: t.item.revision ?? i
			}), Oe(n, i), Te(e), q(), re.forEach((e) => e(n)));
		},
		onChange(e) {
			return re.add(e), () => re.delete(e);
		},
		apply: U,
		belongs: W,
		remember: pe,
		markAsRead: Be,
		complete: Ve,
		completer: He,
		pushSettings: () => ee,
		context: () => p,
		onSaved(e) {
			return ie.add(e), () => ie.delete(e);
		},
		markAsUnread(e) {
			let t = U(e);
			return t.readAt === null ? Promise.resolve() : Fe(t, { readAt: null }, "unread");
		},
		archive(e) {
			let t = U(e);
			return !Ue("archive") || t.archivedAt !== null ? Promise.resolve() : Fe(t, { archivedAt: me() }, "archive");
		},
		unarchive(e) {
			let t = U(e);
			return !Ue("archive") || t.archivedAt === null ? Promise.resolve() : Fe(t, { archivedAt: null }, "unarchive");
		},
		snooze(e, t) {
			if (!Ue("snooze")) return Promise.resolve();
			let n = U(e), r = new Date(t).toISOString();
			return Fe(n, { snoozedUntil: r }, "snooze", { until: r });
		},
		unsnooze(e) {
			let t = U(e);
			return !Ue("snooze") || t.snoozedUntil === null ? Promise.resolve() : Fe(t, { snoozedUntil: null }, "unsnooze");
		},
		mute(e) {
			let t = U(e);
			return !Ue("mute") || t.group === null || t.muted ? Promise.resolve() : Ie(t, t.group, !0);
		},
		unmute(e) {
			let t = U(e);
			return !Ue("mute") || t.group === null || !t.muted ? Promise.resolve() : Ie(t, t.group, !1);
		},
		pause(e) {
			let t = new Date(e).toISOString();
			return z ? Me({
				kind: "pause",
				until: t,
				delta: St()
			}, "pause", { until: t }) : Promise.resolve();
		},
		resume() {
			return ce() === null ? Promise.resolve() : Me({
				kind: "pause",
				until: null,
				delta: St()
			}, "resume");
		},
		batch(e, t, n) {
			let r = tt[e];
			if (e !== "seen" && !l || r !== void 0 && !Ue(r)) return Promise.resolve();
			if (e === "snooze" && n === void 0) return Promise.reject(/* @__PURE__ */ TypeError("Snoozing notifications needs the time to snooze them until."));
			let i = t.map(U), a = e === "snooze" && n !== void 0 ? new Date(n).toISOString() : void 0, o = [];
			for (let t = 0; t < i.length; t += rt) o.push(Pe(e, i.slice(t, t + rt), a));
			return Promise.all(o).then(() => void 0);
		},
		delete(e) {
			if (!Ue("delete")) return Promise.resolve();
			let t = U(e), { unread: n, unseen: r } = _e(t);
			return Me({
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
			return Le({ kind: "read" }, e, Re(!0, e), "read");
		},
		markAllAsSeen() {
			return g.unseen === 0 ? Promise.resolve() : Le({ kind: "seen" }, null, Re(!1), "seen");
		},
		archiveAll({ onlyRead: e = !1, category: t = x } = {}) {
			if (!Ue("archive")) return Promise.resolve();
			let n = e ? St() : Re(!0, t);
			return Le({
				kind: "archive",
				onlyRead: e
			}, t, n, "archive", { read: e });
		},
		async opened(e, { markAllAsSeen: t = !0, categories: n } = {}) {
			t && k++, A++, j.forEach((e) => e());
			let r = t ? g.unseen > 0 : he(), i = e !== void 0 && !e.includes(b) ? e[0] ?? b : b, a = n !== void 0 && x !== null && !n.includes(x) ? null : x;
			i !== b || a !== x ? await We.load(i, a) : (S !== "ready" || r) && await We.load(), t && S === "ready" && await We.markAllAsSeen();
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
			Be(t);
			let r = fe(t.url);
			r === void 0 || n && Se(n) || (n?.preventDefault(), !be(r) || !e ? window.location.assign(r) : e.visit(r, {}));
		},
		runAction(t, n, i) {
			let a = t.actions[n];
			if (!a || i?.defaultPrevented) return;
			let o = ye(a);
			if (i && o !== void 0 && we(a, o, i)) {
				a.event && !Se(i) && window.dispatchEvent(new CustomEvent(a.event, { detail: a.payload })), De(o, a, i, () => void Be(t), a.result === void 0 ? void 0 : () => Ve(t, n));
				return;
			}
			if (i?.preventDefault(), O[t.id] !== void 0) return;
			Be(t);
			let s = r, c = a.result === void 0 ? void 0 : He(t, n);
			ke(a, t, e, () => {
				if (s !== r) return;
				let { [t.id]: e, ...n } = O;
				O = n, q();
			}, c) === "pending" && (O = {
				...O,
				[t.id]: n
			}, q());
		}
	};
	return We;
}
function At(e, t, n, r = null) {
	return ut(e.getSnapshot().arrived, t).map((t) => e.apply(t)).filter((t) => e.belongs(t, n, r));
}
function jt(e, t = !0) {
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
function Mt(e = {}, t = /* @__PURE__ */ new Date()) {
	let n = Jt(e), r = (e) => {
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
function Nt(e, t, n) {
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
var Pt = [
	30,
	60,
	120,
	"tomorrow"
];
function Ft(e, t = /* @__PURE__ */ new Date()) {
	if (e !== "tomorrow") return new Date(t.getTime() + e * 6e4);
	let n = new Date(t);
	return n.setDate(t.getDate() + 1), n.setHours(8, 0, 0, 0), n;
}
function It(e, t, n) {
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
function Lt(e, t, n) {
	let r = new Date(e);
	return r.getTime() - t < 5184e5 ? Nt(r, t, n) : r.toLocaleString(n, {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit"
	});
}
var Rt = kt(), X = Rt, zt = {
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
function Bt(e) {
	X.getSnapshot().url === void 0 && X.sync(e, "initial");
}
var Vt = Rt;
function Ht(e = 6e4) {
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
var Ut = Ht();
function Wt(e, t, n) {
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
function Gt(e, t, n) {
	let r = new Intl.NumberFormat(n);
	return e > t ? `${r.format(t)}+` : r.format(e);
}
var Kt = /* @__PURE__ */ "title.bell.bellNew.bellPaused.all.unread.archived.snoozed.markAllAsRead.archiveAll.moreActions.itemControl.markAsRead.markAsUnread.archive.unarchive.snooze.unsnooze.mute.unmute.muted.delete.select.selectAll.selected.selection.readSelected.unreadSelected.snoozeSelected.unsnoozeSelected.archiveSelected.unarchiveSelected.deleteSelected.clearSelection.showNew.snoozeUntil.snoozedUntil.snoozeLaterToday.snoozeTomorrow.snoozeNextWeek.pause.pauseFor.pauseTomorrow.pausedUntil.resume.showMore.showLess.unreadState.actorsAndOther.actorsAndOthers.empty.emptyUnread.emptyArchived.emptySnoozed.error.retry.categories.allCategories.loading.loadMore.viewAll.announcement".split("."), qt = Xe("inbox_", Kt), Jt = (e) => Ze("inbox_", Kt, e), Z = qe, Yt = (e) => e.actors.slice(0, 3);
function Xt(e, t) {
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
var Zt = ".inertiaui.inbox.arrived", Qt = ".inertiaui.inbox.changed", $t = ".inertiaui.announcement.published", en = 1e3, tn = "inertiaui-inbox";
function nn(e, t, n) {
	let r, i = !1, a, o, s = /* @__PURE__ */ new Set(), c = !1, l, u = () => {
		try {
			return r?.();
		} catch {
			return;
		}
	}, d = (t) => {
		let r = G(t) ? e.receive(t.item, t.counts) : void 0;
		r && n(r);
	}, f = (t) => {
		let r = e.onArrival(n);
		try {
			e.receiveChange(t);
		} finally {
			r();
		}
	}, p = (t) => {
		if (!G(t) || typeof t.id != "string") return;
		let { id: r } = t, i = typeof t.context == "string" ? t.context : null, a = setTimeout(() => {
			s.delete(a), e.loadArrival(r, i).then((e) => e && n(e));
		}, Math.random() * en);
		s.add(a);
	}, m = () => {
		let { announcementsChannel: t } = e.getSnapshot();
		if (o && o.channel === t && o.resolve === r) return;
		o?.stop(), o = void 0;
		let n = t === null ? void 0 : u();
		if (!n || t === null || !r) return;
		let i = n.private(t);
		i.listen($t, p), o = {
			channel: t,
			resolve: r,
			stop: () => i.stopListening($t, p)
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
		i.listen(Zt, d), i.listen(Qt, f);
		let o = !1, s = n.connector?.onConnectionChange?.((t) => {
			t === "connected" && o && e.refresh(), o = t !== "connected";
		});
		a = {
			channel: t,
			resolve: r,
			stop() {
				i.stopListening(Zt, d), i.stopListening(Qt, f), typeof s == "function" && s();
			}
		};
	}, _ = () => typeof document < "u" && document.visibilityState === "hidden", v = () => {
		clearInterval(l), l = c && !_() ? setInterval(() => void e.refresh(), c) : void 0;
	}, y = () => {
		c && !_() && e.refresh(), v();
	};
	typeof document < "u" && document.addEventListener("visibilitychange", y);
	let b = typeof BroadcastChannel == "function" ? new BroadcastChannel(tn) : void 0;
	b?.addEventListener("message", (t) => {
		let { url: n, user: r, channel: i } = e.getSnapshot(), a = t.data;
		G(a) && n !== void 0 && a.url === n && a.user === r && a.channel === i && e.receiveChange(a);
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
var rn = "inertiaui-inbox-", an = (e) => `${rn}${e}`, on = (e) => e.startsWith(rn) ? e.slice(16) : void 0;
function sn(e, t, n) {
	let r = t === "none" || e.announcement || e.quiet === !0 || e.readAt !== null || e.archivedAt !== null ? null : e.toast ?? (t === "all" ? "default" : null);
	if (r === null) return;
	let { title: i, ...a } = cn(e, n);
	return {
		title: i,
		options: {
			id: an(e.id),
			type: r,
			...a
		}
	};
}
function cn(e, t) {
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
var ln = "inertiaui-notifications";
function un(e) {
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
async function dn() {
	return typeof Notification == "function" ? Notification.requestPermission() : "denied";
}
var fn;
function pn() {
	if (typeof AudioContext != "function") return;
	fn ??= new AudioContext();
	let e = fn;
	for (let [t, n] of [880, 1320].entries()) {
		let r = e.currentTime + t * .15, i = e.createOscillator(), a = e.createGain();
		i.frequency.value = n, a.gain.setValueAtTime(.2, r), a.gain.exponentialRampToValueAtTime(.001, r + .4), i.connect(a).connect(e.destination), i.start(r), i.stop(r + .4);
	}
}
function mn(e) {
	let t = !1, n = "", r, i, a, o = !1, s, c = !1, l = !1, u, d, f = () => {
		let a = document.title !== i;
		a && (n = document.title);
		let { unread: o } = e.getSnapshot().counts, s = t && o > 0 ? Je("inbox_title_count", {
			count: Gt(o, 99),
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
		e && !d && (d = un(ln)), !e && d && (d.stop(), d = void 0);
	}, _ = (t) => {
		if (typeof Notification != "function" || Notification.permission !== "granted") return;
		let n;
		try {
			n = new Notification(t.title, {
				body: t.body ?? void 0,
				icon: t.actor?.avatar,
				tag: an(t.id)
			});
		} catch {
			return;
		}
		n.addEventListener("click", () => {
			window.focus(), n.close(), e.open(t);
		});
	}, v = (e) => {
		navigator.userActivation?.hasBeenActive !== !1 && (e === !0 ? pn() : (u?.getAttribute("src") !== e && (u = new Audio(e)), u.currentTime = 0, u.play().catch(() => {})));
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
var hn = [
	"instant",
	"hourly",
	"daily",
	"weekly"
], gn = [
	"monday",
	"tuesday",
	"wednesday",
	"thursday",
	"friday",
	"saturday",
	"sunday"
], _n = {
	status: "idle",
	channels: [],
	groups: [],
	categories: [],
	notificationHours: null,
	frequencies: hn
}, vn = (e, t) => typeof e == "string" ? e : t, yn = (e) => hn.includes(e), bn = (e) => typeof e == "string" && /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/.test(e), xn = (e) => [...e].sort(), Sn = (e) => {
	if (!G(e) || !G(e.days)) return null;
	let t = e.days;
	return {
		enabled: e.enabled === !0,
		days: Object.fromEntries(gn.map((e) => [e, xn(Array.isArray(t[e]) ? t[e].filter(bn) : [])]))
	};
}, Cn = (e) => {
	let t = Array.isArray(e) ? hn.filter((t) => e.includes(t)) : [];
	return t.length > 0 ? t : hn;
};
function wn(e) {
	if (G(e) && Array.isArray(e.channels) && Array.isArray(e.categories)) return {
		channels: e.channels.filter(G).flatMap((e) => typeof e.key == "string" ? [{
			key: e.key,
			label: vn(e.label, e.key),
			globalSwitch: e.globalSwitch === !0,
			enabled: e.enabled !== !1,
			digest: e.digest === !0,
			inbox: e.inbox === !0,
			push: e.push === !0
		}] : []),
		groups: (Array.isArray(e.groups) ? e.groups : []).filter(G).flatMap((e) => typeof e.key == "string" ? [{
			key: e.key,
			label: vn(e.label, e.key),
			description: K(e.description)
		}] : []),
		categories: e.categories.filter(G).flatMap((e) => typeof e.key == "string" ? [{
			key: e.key,
			label: vn(e.label, e.key),
			description: K(e.description),
			group: K(e.group),
			locked: e.locked === !0,
			channels: Object.fromEntries(Object.entries(G(e.channels) ? e.channels : {}).filter((e) => typeof e[1] == "boolean")),
			frequency: yn(e.frequency) ? e.frequency : null
		}] : []),
		notificationHours: Sn(e.notificationHours),
		frequencies: Cn(e.frequencies)
	};
}
function Tn(e) {
	let t = new Set(e.groups.map(({ key: e }) => e)), n = e.categories.filter(({ group: e }) => e === null || !t.has(e)), r = e.groups.map((t) => ({
		group: t,
		categories: e.categories.filter((e) => e.group === t.key)
	}));
	return [...n.length > 0 ? [{
		group: null,
		categories: n
	}] : [], ...r.filter(({ categories: e }) => e.length > 0)];
}
var En = (e, t) => e.locked || t.enabled && e.channels[t.key] === !0, Dn = (e, t, n) => {
	let r = n.find((e) => e.inbox);
	return !t.push || r === void 0 || r.key === t.key || e.channels[r.key] === void 0 || En(e, r);
}, On = (e, t, n) => En(e, t) && Dn(e, t, n), kn = (e, t, n) => e.locked || !t.enabled || !Dn(e, t, n), An = (e, t) => e.frequency !== null && t.some((n) => n.digest && e.channels[n.key] !== void 0 && On(e, n, t)), jn = (e, t) => new Intl.DateTimeFormat(t, {
	weekday: "long",
	timeZone: "UTC"
}).format(Date.UTC(2024, 0, 1 + gn.indexOf(e))), Mn = (e) => {
	let [t = "", n = ""] = e.split("-");
	return [t, n];
}, Nn = (e, t) => e.days[t].length > 0 && gn.every((n) => n === t || e.days[n].length === 0);
function Pn(e, t) {
	let n = gn.indexOf(t);
	for (let t = 1; t < gn.length; t++) {
		let [r] = e.days[gn[(n + gn.length - t) % gn.length]];
		if (r !== void 0) return r;
	}
	return "09:00-17:00";
}
var Fn = 1440, In = (e) => Number(e.slice(0, 2)) * 60 + Number(e.slice(3)), Ln = (e) => [Math.floor(e / 60) % 24, e % 60].map((e) => String(e).padStart(2, "0")).join(":");
function Rn(e) {
	let t = e.map((e) => Mn(e).map(In));
	if (t.length === 0 || t.some(([e, t]) => t <= e)) return;
	let n = Math.max(...t.map(([, e]) => e));
	return n + 120 <= Fn ? `${Ln(n + 60)}-${Ln(n + 120)}` : void 0;
}
var zn = (e, t, n) => t?.day === n ? t.ranges : e?.days[n] ?? [], Bn = (e, t, n) => e === null ? [] : gn.map((r) => ({
	day: r,
	name: jn(r, n),
	ranges: zn(e, t, r).map(Mn),
	locked: !e.enabled || Nn(e, r),
	canAdd: e.enabled && Rn(e.days[r]) !== void 0
}));
function Vn(e, t, n) {
	let { day: r } = n, i = zn(e, t, r), a;
	switch (n.kind) {
		case "toggle":
			if (!e?.enabled || Nn(e, r)) return;
			a = e.days[r].length > 0 ? [] : [Pn(e, r)];
			break;
		case "time": {
			let [e, t] = Mn(i[n.index] ?? ""), o = n.field === "start" ? `${n.time}-${t}` : `${e}-${n.time}`;
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
			let t = Rn(i);
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
var Hn = () => {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone;
	} catch {
		return;
	}
}, Un = (e, t) => e.enabled === t.enabled && gn.every((n) => e.days[n].join() === t.days[n].join()), Wn = (e, t) => typeof e == "object" && typeof t == "object" ? Un(e, t) : e === t, Gn = "*", Kn = "*";
function qn() {
	let e, t, n, r = 0, i = 0, a = 0, o = {
		channels: [],
		categories: [],
		notificationHours: null
	}, s = /* @__PURE__ */ new Map(), c = /* @__PURE__ */ new Map(), l = /* @__PURE__ */ new Map(), u = _n, d = /* @__PURE__ */ new Set(), f = ({ category: e, channel: t }) => JSON.stringify([e, t]), p = (e, { category: t, channel: n }) => {
		if (t === null) return n === Kn ? e.notificationHours ?? void 0 : e.channels.find(({ key: e }) => e === n)?.enabled;
		let r = e.categories.find(({ key: e }) => e === t);
		return n === Gn ? r?.frequency ?? void 0 : r?.channels[n];
	}, m = (e, t, n) => t === Gn ? e.frequency !== null && yn(n) ? {
		...e,
		frequency: n
	} : e : e.channels[t] !== void 0 && typeof n == "boolean" ? {
		...e,
		channels: {
			...e.channels,
			[t]: n
		}
	} : e, h = (e, { category: t, channel: n }, r) => t === null ? n === Kn ? e.notificationHours !== null && typeof r == "object" ? {
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
	}, g = ({ category: e, channel: t }, n) => e === null ? t === Kn ? {
		notificationHours: n,
		timezone: Hn()
	} : { channels: { [t]: n } } : t === Gn ? {
		frequencies: { [e]: n },
		timezone: Hn()
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
			let t = wn(await e.request("post", `${n}/preferences`, g(i, d)));
			if (u !== r) return;
			o = h(o, i, (t && p(t, i)) ?? d), l.set(c, {
				cell: i,
				at: ++a
			});
		} catch (e) {
			if (u !== r) return;
			t?.(e);
		}
		(Wn(s.get(c)?.value, d) || Wn(s.get(c)?.value, p(o, i))) && s.delete(c), v(), s.has(c) && await y(i, c);
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
					let t = wn(await e.request("get", `${n}/preferences`));
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
			return !e || n === void 0 || !i || i.frequency === null || i.frequency === r || !u.frequencies.includes(r) ? Promise.resolve() : b(t, Gn, r);
		},
		setNotificationHours(t) {
			let r = u.notificationHours;
			if (!e || n === void 0 || r === null) return Promise.resolve();
			let i = gn.map((e) => [e, t.days?.[e] ?? r.days[e]]);
			if (!i.every(([, e]) => Array.isArray(e) && e.every(bn)) || i.every(([, e]) => e.length === 0)) return Promise.resolve();
			let a = {
				enabled: t.enabled ?? r.enabled,
				days: Object.fromEntries(i.map(([e, t]) => [e, xn(t)]))
			};
			return Wn(a, r) ? Promise.resolve() : b(null, Kn, a);
		},
		reset(e) {
			r++, i++, o = {
				channels: [],
				categories: [],
				notificationHours: null
			}, s.clear(), c.clear(), l.clear(), n = e, _(_n), d.size > 0 && e !== void 0 && x.load(e);
		}
	};
	return x;
}
var Jn = /* @__PURE__ */ "title.category.toggle.locked.global.globalDescription.frequency.frequencyLabel.frequencyInstant.frequencyHourly.frequencyDaily.frequencyWeekly.pushDevice.pushOff.pushOn.pushTurnOn.pushTurnOff.pushTurningOn.pushTurningOff.pushBlocked.pushHomeScreen.pushInsecure.pushBrave.pushFailed.pushFailedOff.pushRetry.pushDevices.pushDeviceName.pushDeviceUnknown.pushDeviceActive.pushDeviceRemove.pushDeviceRemoveLabel.notificationHours.notificationHoursDescription.notificationHoursStart.notificationHoursEnd.notificationHoursDay.notificationHoursOff.notificationHoursAdd.notificationHoursAddLabel.notificationHoursRemove.notificationHoursRemoveLabel.empty.loading.error.retry".split("."), Yn = Xe("preferences_", Jn), Xn = {
	instant: "frequencyInstant",
	hourly: "frequencyHourly",
	daily: "frequencyDaily",
	weekly: "frequencyWeekly"
}, Zn = (e) => Ze("preferences_", Jn, e), Qn = qn();
function $n(e, t, n, r) {
	let i = t.some(({ frequency: e }) => e !== null);
	return {
		hasGlobalSwitches: e.some(({ globalSwitch: e }) => e),
		hasFrequencies: i,
		columns: e.length + (i ? 2 : 1),
		frequencyOptions: n.map((e) => ({
			value: e,
			label: qe(r[Xn[e]])
		}))
	};
}
function er(e, t, n) {
	kn(e, t, n) || Qn.set(e.key, t.key, !e.channels[t.key]);
}
// ../js/push.ts
var tr = {
	available: !1,
	supported: !1,
	permission: "default",
	subscribed: !1,
	busy: !1,
	reason: null,
	request: null,
	devices: null
};
function nr(e) {
	return !e.available || e.reason === "unsupported" ? null : e.busy ? "busy" : e.reason ?? (e.subscribed ? "on" : "off");
}
function rr(e) {
	let t = nr(e), n = e.request?.action ?? "subscribe", r = n === "unsubscribe";
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
function ir(e) {
	return !G(e) || typeof e.publicKey != "string" || e.publicKey === "" || typeof e.worker != "string" || e.worker === "" ? null : {
		publicKey: e.publicKey,
		worker: e.worker,
		subscribed: e.subscribed === !0
	};
}
var ar = (e) => typeof e == "string" && e !== "" ? e : null;
function or(e) {
	if (G(e) && Array.isArray(e.devices)) return e.devices.flatMap((e) => G(e) && typeof e.id == "number" && typeof e.activeAt == "string" ? [{
		id: e.id,
		browser: ar(e.browser),
		platform: ar(e.platform),
		activeAt: e.activeAt,
		current: e.current === !0
	}] : []);
}
function sr(e) {
	let t = e.replaceAll("-", "+").replaceAll("_", "/"), n = atob(t.padEnd(t.length + (4 - t.length % 4) % 4, "="));
	return Uint8Array.from(n, (e) => e.charCodeAt(0));
}
function cr(e, t) {
	let n = e.options?.applicationServerKey;
	if (!n) return !0;
	let r = new Uint8Array(n);
	return r.length === t.length && r.every((e, n) => e === t[n]);
}
var lr = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1, ur = () => navigator.standalone === !0 || window.matchMedia?.("(display-mode: standalone)").matches === !0;
function dr() {
	return window.isSecureContext ? navigator.serviceWorker !== void 0 && "PushManager" in window && typeof Notification == "function" ? null : lr() && !ur() ? "home-screen" : "unsupported" : "insecure";
}
var fr = () => "brave" in navigator, pr = () => typeof Notification == "function" ? Notification.permission : "default", mr = (e) => new URL("./", new URL(e, window.location.href)).href;
function hr(e) {
	let t = e.installing ?? e.waiting;
	return e.active || !t ? e.active ? Promise.resolve(e) : Promise.reject(/* @__PURE__ */ Error("The service worker did not install.")) : new Promise((n, r) => {
		let i = () => {
			if (e.active || t.state === "redundant") return t.removeEventListener("statechange", i), e.active ? n(e) : r(/* @__PURE__ */ Error("The service worker did not install."));
		};
		t.addEventListener("statechange", i);
	});
}
function gr() {
	let e, t, n, r, i, a = 0, o = null, s = null, c = "unsupported", l = "default", u = !1, d, f = null, p = !1, m = Promise.resolve(), h = null, g = /* @__PURE__ */ new Set(), _ = null, v = 0, y = tr, b = /* @__PURE__ */ new Set(), x = () => f?.status === "pending", S = () => {
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
		let t = mr(e.worker), n = await navigator.serviceWorker.getRegistration(t);
		return n?.scope === t ? n : void 0;
	}, E = async (e, t) => {
		let n = new URL(e.worker, window.location.href).href;
		return hr(t?.active?.scriptURL === n ? t : await navigator.serviceWorker.register(n, { scope: mr(e.worker) }));
	}, D = (t, n, r) => t === a ? e.request("post", `${w()}/${n}`, r) : Promise.reject(/* @__PURE__ */ Error("Another user signed in.")), O = async (e, t, n = !1) => {
		let r = await D(e, "push/subscribe", {
			...t.toJSON(),
			...n ? { refresh: !0 } : {}
		});
		if (n && G(r) && r.subscribed === !1) return !1;
		if (!G(r) || r.subscribed !== !0) throw Error("The push endpoint did not save the subscription.");
		return !0;
	}, k = async (e, t, n, r = !1) => {
		let i = sr(n.publicKey), a, o;
		try {
			a = await t.pushManager.getSubscription(), a && !cr(a, i) && (await a.unsubscribe(), a = null), a ??= o = await t.pushManager.subscribe({
				userVisibleOnly: !0,
				applicationServerKey: i
			});
		} catch (e) {
			throw fr() ? Object.assign(/* @__PURE__ */ Error("Brave could not subscribe."), {
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
	}, A = (e) => G(e) && e.brave === !0 ? "brave" : "failed", j = () => {
		if (p || s === null || c !== null || l !== "granted" || !e) return;
		p = !0;
		let t = a, n = s;
		C(async () => {
			if (t !== a) return;
			let e = await T(n).catch(() => void 0);
			if (!e && !n.subscribed) return;
			let r = () => {
				t === a && (u = !1, S(), P());
			};
			try {
				let i = await E(n, e), a = await i.pushManager.getSubscription();
				if (a && cr(a, sr(n.publicKey))) {
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
	}, N = async () => {
		if (s === null || !e) return;
		let t = a, n = ++v;
		try {
			let r = or(await e.request("get", `${w()}/push/devices`));
			t === a && n === v && r && (h = r, M());
		} catch {}
	}, P = () => {
		h !== null && N();
	}, F = () => {
		a++, o = null, s = null, u = !1, d = void 0, f = null, p = !1, m = Promise.resolve(), h = _ = null, g.clear(), v++;
	}, I = () => {
		let e = t.getSnapshot(), n = e.url === void 0 ? void 0 : e.user ?? "";
		n !== i && (i = n, F());
		let r = t.pushSettings();
		r !== o && (o = r, s = ir(r), s === null ? (u = !1, d = void 0, f = x() ? f : null) : s.subscribed !== d && (u = d = s.subscribed)), l = pr(), S(), j();
	}, L = () => {
		l = pr(), S(), j();
	}, R = (t) => {
		let r = t.data;
		if (G(r) && r.type === "inertiaui-notifications:shown") {
			let e = typeof r.tag == "string" ? on(r.tag) : void 0;
			e !== void 0 && n?.(e) && z([an(e)]);
			return;
		}
		if (!G(r) || r.type !== "inertiaui-notifications:visit") return;
		let i = fe(r.url);
		i !== void 0 && (t.ports[0]?.postMessage(!0), e && be(i) ? e.visit(i, {}) : window.location.assign(i));
	}, z = async (e, t, n = null) => {
		if (!(s === null || c !== null || e !== null && e.length === 0)) try {
			let r = await T(s);
			if (!r) return;
			let i = (e) => typeof e.timestamp != "number" || t === void 0 || e.timestamp <= t, a = (e) => {
				let t = G(e.data) ? e.data.context : void 0;
				return n === null || t === void 0 || t === n;
			};
			(e === null ? (await r.getNotifications()).filter((e) => on(e.tag) !== void 0 && i(e) && a(e)) : (await Promise.all(e.map((e) => r.getNotifications({ tag: e })))).flat()).forEach((e) => e.close());
		} catch {}
	}, B = (e) => {
		switch (e.kind) {
			case "item": return e.readAt !== null || e.archivedAt !== null ? z([an(e.id)]) : Promise.resolve();
			case "items": return e.action === "read" || e.action === "archive" ? z(e.ids.map(an)) : Promise.resolve();
			case "delete": return z(e.ids.map(an));
			case "read":
			case "archive": return e.category === null && !(e.kind === "archive" && e.onlyRead) ? z(null, Date.parse(e.before), t?.context() ?? null) : Promise.resolve();
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
			t = a, n = o, r = s, c = dr(), c === null && (navigator.serviceWorker.addEventListener("message", R), navigator.serviceWorker.startMessages(), navigator.permissions?.query({ name: "notifications" }).then((e) => e.addEventListener("change", L)).catch(() => {}), document.addEventListener("visibilitychange", L));
			let l = (e) => void B(e);
			a.onChange(l), a.onSaved(({ change: e }) => l(e)), a.subscribe(I), I();
		},
		async enable() {
			if (x() || s === null || c !== null || !e) return;
			let t = a, n = s;
			f = {
				action: "subscribe",
				status: "pending"
			}, S(), l = Notification.permission === "default" ? await Notification.requestPermission().catch(pr) : Notification.permission, t === a && (l === "granted" && (p = !0, await C(async () => {
				if (t === a) try {
					await k(t, await E(n, await T(n)), n), t === a && (u = !0, P());
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
					e && (await D(t, "push/unsubscribe", { endpoint: e.endpoint }), await e.unsubscribe().catch(() => {})), t === a && (u = !1, P());
				} catch {
					t === a && (f = {
						action: "unsubscribe",
						status: "failed"
					});
				}
			}), t === a && (f = x() ? null : f, S());
		},
		loadDevices: N,
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
		close: (e) => z(e.map(an))
	};
}
var _r = gr();
function vr(e, t, n, r) {
	return (e ?? []).filter((e) => !e.current).map((e) => {
		let i = e.browser ?? qe(t.pushDeviceUnknown), a = e.platform === null ? i : qe(t.pushDeviceName, {
			browser: i,
			platform: e.platform
		});
		return {
			id: e.id,
			name: a,
			active: qe(t.pushDeviceActive, { time: Wt(e.activeAt, n, r) }),
			removeLabel: qe(t.pushDeviceRemoveLabel, { device: a })
		};
	});
}
function yr(e) {
	let t = e?.button;
	t && e?.state !== "busy" && (t.action === "subscribe" ? _r.enable() : _r.disable());
}
// ../js/toastStore.ts
var br = 1e3;
function xr({ title: e, description: t }) {
	let n = e.length + (t?.length ?? 0);
	return Math.min(Math.max(2e3 + 60 * n, 5e3), 12e3);
}
function Sr(e, t = {}) {
	return typeof t.duration == "function" ? t.duration(e) : e.type === "loading" || e.actions?.some((e) => !e.altText) || e.type === "error" && t.persistentErrors !== !1 ? null : typeof t.duration == "number" ? t.duration : e.type === "warning" ? Math.max(xr(e), 8e3) : xr(e);
}
function Cr(e) {
	return (e.type === "error" ? 0 : e.type === "warning" ? 2 : 4) + (e.actions.length > 0 ? 0 : 1);
}
var wr = (e) => e === void 0 || Number.isNaN(e) ? void 0 : Math.min(Math.max(e, 0), 1), Tr = (e) => [...e.action ? [e.action] : [], ...e.actions ?? []], Er = {
	duration: !0,
	persistentErrors: !0,
	durationScale: !0,
	autoDismiss: !0,
	limit: !0,
	overflow: !0,
	dedupe: !0,
	removeDelay: !0
};
function Dr(e = {}) {
	let t = {}, n = 0, r = 0, i = [], a = !1, o = /* @__PURE__ */ new Map(), s = /* @__PURE__ */ new Set(), c = /* @__PURE__ */ new Map(), l = /* @__PURE__ */ new Set(), u = [], d = () => {
		a && (a = !1, i = Array.from(o.values(), (e) => e.toast));
		for (let e of l) e();
		let e = u;
		u = [], e.forEach((e) => e());
	}, f = (e, t) => {
		e.toast = t, a = !0;
	}, p = (e, n) => {
		let r = n === void 0 ? Sr(e, t) : n;
		return r === null || t.autoDismiss === !1 ? null : Math.round(r * (t.durationScale ?? 1));
	}, m = (e) => {
		e.handle !== void 0 && (clearTimeout(e.handle), e.handle = void 0, e.remaining -= Date.now() - e.startedAt);
	}, h = (e) => {
		let { timer: t } = e;
		if (!t) return;
		let n = (c.get(e.toast.toaster ?? "") ?? 0) > 0, r = e.toast.state === "visible" && s.size === 0 && e.holds.size === 0 && e.toast.pendingAction === void 0 && n;
		r && t.handle === void 0 ? (t.remaining = Math.max(t.remaining, Math.min(br, t.duration)), t.startedAt = Date.now(), t.handle = setTimeout(() => E(e.toast.id, "timeout"), t.remaining)) : r || m(t);
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
			let n = _(t), r = n.filter((e) => e.toast.state === "visible").length, i = n.filter((e) => e.toast.state === "queued").sort((t, n) => Cr(t.toast) - Cr(n.toast) || e * (t.sequence - n.sequence));
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
		let r = n.reduce((e, t) => Cr(t.toast) > Cr(e.toast) ? t : e);
		return t.overflow === "hide" ? (f(r, {
			...r.toast,
			state: "queued"
		}), h(r)) : b(r, "evicted"), "visible";
	}, C = (e, t, n, r, i) => {
		let a = {
			type: n.type ?? "default",
			title: t,
			description: n.description,
			actions: Tr(n)
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
			progress: wr(n.progress),
			onClose: n.onClose,
			onRemove: n.onRemove,
			...i
		};
	}, w = (e, n) => {
		let r = n.type ?? "default";
		if (!(t.dedupe === !1 || n.id !== void 0 || r === "loading" || Tr(n).length > 0 || n.data !== void 0)) return [...o.values()].find(({ toast: t }) => t.state !== "closing" && t.actions.length === 0 && t.data === void 0 && t.toaster === n.toaster && t.type === r && t.title === e && t.description === n.description);
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
		"description" in t && (u.description = t.description), t.progress !== void 0 && (u.progress = wr(t.progress)), (i !== void 0 || a !== void 0) && (u.actions = Tr({
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
			let n = Object.entries(e).filter(([e, t]) => t !== void 0 && e in Er);
			t = {
				...t,
				...Object.fromEntries(n)
			}, e.limit !== void 0 && (x(), d());
		}
	};
	return O.configure(e), O;
}
// ../js/toast.ts
var Q = Dr(), Or = 0;
Q.subscribe(() => Or++);
var kr = () => Or, Ar = 0;
function jr() {
	let e = `scope-${++Ar}:`, t = /* @__PURE__ */ new Map();
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
var Mr = le, Nr, Pr = "requested", Fr, Ir, Lr, Rr = he((e, t) => {
	let n = t.id === void 0 ? void 0 : on(t.id);
	n !== void 0 && Vt.panelOpen() ? Vt.loadArrival(n).then((e) => e && Yr(e)) : Q.add(e, t);
}), zr = (e) => Rr(ge(e, Mr)), Br = typeof window < "u", Vr, Hr = [
	403,
	419,
	429,
	"5xx",
	"network"
];
function Ur(e) {
	let t = (t) => {
		let n = e(t);
		return n === void 0 ? "" : qe(n);
	};
	return Object.fromEntries(Hr.map((e) => {
		let n = t(`error_toast_${e}`), r = t(`error_toast_${e}_description`);
		return [e, r === "" ? { title: n } : {
			title: n,
			description: r
		}];
	}));
}
var Wr = Ur((e) => Ue[e]), Gr = () => Nr && {
	...Ur(Ke),
	...Nr
};
function Kr(e, t) {
	return (t[e] ?? (e >= 500 ? t["5xx"] : void 0)) || void 0;
}
function qr(e, t) {
	let { code: n, response: r } = e ?? {};
	if (n === "ERR_NETWORK") return t.network || void 0;
	if (n !== "ERR_HTTP_RESPONSE" || r?.status === void 0) return;
	let { status: i, headers: a } = r;
	if (!(a["x-inertia"] || a["x-inertia-location"] || i === 409 && a["x-inertia-redirect"] || a["x-inertiaui-toasts"])) return Kr(i, t);
}
var Jr = () => ({
	label: Je("inbox_toast_view"),
	altText: Je("inbox_toast_view_alt")
}), Yr = (e) => {
	let t = sn(e, Pr, Jr());
	t && (typeof document < "u" && document.visibilityState === "visible" && _r.close([e.id]), Vt.panelOpen() || Q.getSnapshot().some((e) => e.id === t.options.id && e.state !== "closing") || Q.add(t.title, t.options));
}, Xr = (e) => document.visibilityState === "visible" && Q.getSnapshot().some((t) => t.id === an(e) && t.state !== "closing"), Zr = () => Q.getSnapshot().filter((e) => on(e.id) !== void 0 && e.pendingAction === void 0).forEach((e) => Q.dismiss(e.id)), Qr = (e) => {
	e.kind === "delete" ? e.ids.forEach((e) => Q.dismiss(an(e))) : e.kind === "update" && Q.update(an(e.item.id), cn(e.item, Jr()));
}, $r = (e) => {
	let t = on(e);
	t !== void 0 && X.markAsRead(t);
}, ei = (e, t, n) => {
	let r = on(e);
	return r === void 0 || n.result === void 0 ? void 0 : Vt.completer(r, t);
};
function ti(e, t = {}) {
	if (Mr = t.flashKey ?? Mr, Q.configure(t), Pr = t.inbox?.arrivalToasts ?? Pr, Fr = t.inbox?.onArrival ?? Fr, t.errorToasts !== void 0 && (Nr = t.errorToasts === !1 ? void 0 : t.errorToasts === !0 ? {} : t.errorToasts), Br) {
		if (!Vr) {
			Vr = e;
			let t = (e) => (t) => {
				let n = Gr();
				n && qr(t, n) || Q.add(e(), { type: "error" });
			};
			X.connect(e, { onFailure: t(() => Je("inbox_update_failed")) }), Qn.connect(e, { onFailure: t(() => Je("preferences_save_failed")) });
			let n = ({ url: e, user: t }) => e === void 0 ? void 0 : t ?? "", r = n(X.getSnapshot()), i = r !== void 0;
			X.subscribe(() => {
				let e = n(X.getSnapshot());
				e !== r && (i && Qn.reset(X.getSnapshot().url), i ||= e !== void 0, r = e);
			}), ni(e), X.onArrival((e) => Fr?.(e)), X.onChange(Qr), Vt.onPanelOpened(Zr), Ir = nn(Vt, e, Yr), Lr = mn(X), _r.connect(e, Vt, Xr, t(() => Je("preferences_push_device_remove_failed")));
		}
		X.connect(Vr, { prop: t.inbox?.prop }), Ir?.configure({
			echo: t.inbox?.echo,
			poll: t.inbox?.poll
		}), Lr?.configure(t.inbox ?? {});
	}
}
function ni(e) {
	e.onFlash(zr), e.onNavigate((e, t) => X.sync(e, t)), e.onRequest((e) => be(e.url) ? {
		...e.headers,
		[ue]: "1"
	} : e.headers), e.onResponse((e) => {
		zr(ve(e)), Rr(_e(e.headers));
	}), e.onError((e) => {
		let t = e?.response;
		t?.headers && Rr(_e(t.headers));
		let n = Gr(), r = n && qr(e, n);
		r && Q.add(r.title, {
			type: "error",
			description: r.description
		});
	}), e.onHttpException((e) => {
		let t = Gr();
		return t && e.status !== void 0 && !e.headers["x-inertia"] && Kr(e.status, t) ? !1 : void 0;
	});
	let t = () => document.visibilityState === "hidden" ? Q.pause("hidden") : Q.resume("hidden");
	document.addEventListener("visibilitychange", t), t(), window.addEventListener("blur", () => Q.pause("blur")), window.addEventListener("focus", () => Q.resume("blur"));
}
var ri = /* @__PURE__ */ new Map();
function ii(e, t) {
	let n = Q.getSnapshot().find((t) => t.id === e), r = n?.actions[t];
	if (!n || !r || n.state === "closing" || n.pendingAction !== void 0) return;
	$r(e);
	let i = ei(e, t, r), a = {}, o = () => {
		r.keepOpen ? Q.setPendingAction(e, void 0) : Q.dismiss(e, "action");
	}, s = ke(r, n, Vr, (n) => {
		ri.get(e) === a && (ri.delete(e), Q.getSnapshot().find((t) => t.id === e)?.pendingAction === t && (n ? o() : Q.setPendingAction(e, void 0)));
	}, i);
	s === "pending" ? (ri.set(e, a), Q.setPendingAction(e, t)) : s === "done" && o();
}
function ai(e, t, n) {
	let r = Q.getSnapshot().find((t) => t.id === e)?.actions[t];
	if (!r) return;
	let i = ye(r), a = ei(e, t, r);
	if (i !== void 0 && we(r, i, n)) {
		if (De(i, r, n, () => $r(e), a), Se(n)) return;
		r.event && window.dispatchEvent(new CustomEvent(r.event, { detail: r.payload })), r.keepOpen || Q.dismiss(e, "action");
	} else n.preventDefault(), ii(e, t);
}
var oi = (e, t) => Br ? Q.add(e, t) : t?.id ?? "", si = (e) => (t, n) => oi(t, {
	...n,
	type: e
}), ci = (e, t, n, r) => {
	let { title: i, ...a } = typeof r == "string" ? { title: r } : r;
	return oi(i, {
		...n,
		type: t,
		...a,
		id: e
	});
}, li = (e, t, n, r, i) => {
	r === void 0 ? Q.getSnapshot().some((t) => t.id === e && t.type === "loading") && Q.dismiss(e) : ci(e, t, n, typeof r == "function" ? r(i) : r);
}, ui = 0, di = Object.assign(oi, {
	success: si("success"),
	info: si("info"),
	warning: si("warning"),
	error: si("error"),
	loading: si("loading"),
	update: (e, t) => Q.update(e, t),
	dismiss: (e) => Q.dismiss(e),
	promise(e, { loading: t, success: n, error: r, ...i }) {
		let a = ci(i.id ?? `iui-promise-${++ui}`, "loading", i, t), o = (typeof e == "function" ? e() : e).then((e) => (typeof Response < "u" && e instanceof Response && !e.ok ? li(a, "error", i, r, e) : li(a, "success", i, n, e), e), (e) => {
			throw li(a, "error", i, r, e), e;
		});
		return o.catch(() => {}), {
			id: a,
			unwrap: () => o
		};
	},
	track({ loading: e, success: t, error: n, ...r }, i) {
		let a = i ?? {}, o = r.id ?? `iui-track-${++ui}`, s = !1;
		return {
			...i,
			onStart(t) {
				s = !1, e !== void 0 && ci(o, "loading", r, e), a.onStart?.(t);
			},
			onProgress(t) {
				let n = t?.progress;
				e !== void 0 && n !== void 0 && Q.update(o, { progress: n }), a.onProgress?.(t);
			},
			onSuccess(e) {
				s = !0, li(o, "success", r, t, e), a.onSuccess?.(e);
			},
			onError(e) {
				s = !0, li(o, "error", r, n, e), a.onError?.(e);
			},
			onFinish(e) {
				s || Q.dismiss(o), a.onFinish?.(e);
			}
		};
	},
	fromHeaders(e) {
		let t = e instanceof Headers ? e.get(ue) : e["x-inertiaui-toasts"] ?? e["X-InertiaUI-Toasts"];
		Br && t && Rr(_e({ [ue]: t }));
	}
}), fi = ["F8"], pi = [
	"altKey",
	"ctrlKey",
	"metaKey",
	"shiftKey"
], mi = {
	altKey: "toaster_hotkey_alt",
	ctrlKey: "toaster_hotkey_ctrl",
	metaKey: "toaster_hotkey_meta",
	shiftKey: "toaster_hotkey_shift"
}, hi = {
	width: "0",
	height: "0",
	margin: "0",
	padding: "0",
	border: "0",
	overflow: "visible",
	background: "none",
	color: "inherit",
	"pointer-events": "auto"
}, gi = 45, _i = .11;
function vi(e) {
	return e.map((e) => Object.hasOwn(mi, e) ? Je(mi[e]) : e.replace(/^(Key|Digit)/, "")).join(Je("toaster_hotkey_separator"));
}
function yi(e, t) {
	let n = e ?? Je("toaster_label");
	return t.length > 0 ? Je("toaster_label_with_hotkey", {
		label: n,
		hotkey: vi(t)
	}) : n;
}
function bi(e, t) {
	return e === void 0 ? Je("toast_dismiss", { title: t.title }) : qe(e, { title: t.title });
}
function xi(e, t = {}) {
	let n = je(t, e) ?? Ke(`toast_type_${e}`);
	return n === void 0 ? "" : qe(n);
}
function Si(e, t = {}) {
	let n = xi(e.type, t), r = n ? `${n}: ${e.title}` : e.title, i = [/[.!?…]$/.test(r) ? r : `${r}.`];
	e.description && i.push(e.description);
	for (let t of e.actions) t.altText && i.push(t.altText);
	return i.join(" ");
}
function Ci(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let r of [...e].reverse()) if (r.state !== "queued") {
		let e = r.position ?? t;
		n.set(e, [...n.get(e) ?? [], r]);
	}
	return W.filter((e) => n.has(e)).map((e) => [e, n.get(e)]);
}
var wi = 0;
function Ti(e, t, n) {
	let { region: r, host: i } = t, a = ne({
		polite: t.polite,
		assertive: t.assertive
	}), o = /* @__PURE__ */ new Map(), s = /* @__PURE__ */ new Map(), c = /* @__PURE__ */ new Map(), l = ++wi, u = {
		hover: `hover-${l}`,
		focus: `focus-${l}`,
		swipe: `swipe-${l}`
	}, d = null, f = null, p = 0, m = null, h = "pointer", g = null, _ = n().name, v = e.attach(_), y = () => e.getSnapshot().filter((e) => e.toaster === n().name && e.state !== "queued"), b = () => Array.from(r.querySelectorAll("[data-toast-list]")), x = (e) => r.querySelector(`[data-toast-id="${CSS.escape(e)}"]`), S = (e) => e instanceof Element ? e.closest("[data-toast-id]") ?? null : null, C = (e) => e.dataset.state !== "closing", w = () => y().reverse().map((e) => x(e.id)).filter((e) => e !== null && C(e)), T = (e) => (e.querySelector("[data-toast-body]")?.offsetHeight ?? e.offsetHeight) + (e.offsetHeight - e.clientHeight), E = () => {
		let { visibleToasts: e, expand: t } = n();
		for (let n of b()) {
			let r = Array.from(n.querySelectorAll(":scope > [data-toast-id]")).filter(C), i = 0;
			n.dataset.expanded = String(t || n === d || n.contains(document.activeElement)), r.forEach((t, n) => {
				let a = T(t);
				t.style.setProperty("--toast-index", String(n)), t.style.setProperty("--toast-before", `${i}px`), t.style.setProperty("--toast-height", `${a}px`), t.style.zIndex = String(r.length - n), t.dataset.front = String(n === 0), t.dataset.overflow = String(n >= e), t !== g?.item && (delete t.dataset.swipeOut, t.style.removeProperty("--toast-swipe")), i += a;
			}), n.style.setProperty("--toast-count", String(r.length)), n.style.setProperty("--toast-visible", String(Math.max(1, Math.min(r.length, e)))), n.style.setProperty("--toast-front-height", `${r[0] ? T(r[0]) : 0}px`), n.style.setProperty("--toast-heights", `${i}px`);
		}
	}, D = typeof ResizeObserver == "function" ? new ResizeObserver(() => E()) : void 0, O = /* @__PURE__ */ new WeakSet(), k = () => {
		let t = !U(), n = /* @__PURE__ */ new Set();
		for (let r of y()) {
			let i = x(r.id)?.querySelector("[data-toast-progress]"), a = e.timer(r.id);
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
	}, A = e.subscribe(k), j = () => {
		f = null, e.resume(u.focus);
	}, M = () => {
		let e = w(), t = h === "pointer" ? void 0 : e[Math.min(p, e.length - 1)], n = m;
		j(), t ? t.focus() : n?.isConnected && (m = null, n.focus({ preventScroll: !0 }));
	}, N = () => {
		f && (!f.isConnected || !C(f)) ? M() : r.contains(document.activeElement) || (m = null, j());
	}, P = (t) => {
		t.relatedTarget instanceof HTMLElement && !r.contains(t.relatedTarget) && (m = t.relatedTarget), f = S(t.target), p = f ? w().indexOf(f) : 0, e.pause(u.focus), E();
	}, F = () => void setTimeout(() => {
		N(), E();
	}), I = (t) => {
		h = "keyboard";
		let n = S(t.target);
		t.key === "Escape" && n?.dataset.toastId !== void 0 && n.dataset.dismissible !== "false" && (t.preventDefault(), e.dismiss(n.dataset.toastId, "escape"));
	}, L = (t) => {
		d !== t && (d = t, t ? e.pause(u.hover) : e.resume(u.hover), E());
	}, R = (e) => e instanceof Element ? e.closest("[data-toast-list]") ?? null : null, z = (e) => {
		e.pointerType !== "touch" && L(R(e.target));
	}, B = (e) => {
		e.pointerType !== "touch" && R(e.relatedTarget) === null && L(null);
	}, ee = (e) => {
		let t = e.closest("[data-toast-list]")?.dataset.position ?? "";
		return t.endsWith("right") ? "right" : t.endsWith("left") ? "left" : "both";
	}, V = (e, t) => {
		let n = ee(e);
		return n === "both" || (n === "right" ? t > 0 : t < 0);
	}, H = (e) => {
		if (h = e.pointerType === "touch" ? "touch" : "pointer", g?.active) return;
		let t = S(e.target), n = e.target instanceof Element && e.target.closest("a, button, input, select, textarea, [data-toast-no-swipe]");
		e.button === 0 && t && !n && t.dataset.dismissible !== "false" && C(t) && (g = {
			item: t,
			pointerId: e.pointerId,
			x: e.clientX,
			time: Date.now(),
			dx: 0,
			active: !1
		});
	}, te = (t) => {
		if (!g || t.pointerId !== g.pointerId) return;
		if (!g.active && (!(t.buttons & 1) || !g.item.isConnected || !C(g.item))) {
			g = null;
			return;
		}
		let n = t.clientX - g.x;
		if (!g.active) {
			if (Math.abs(n) < 4) return;
			g.active = !0, g.item.dataset.swiping = "true";
			try {
				g.item.setPointerCapture(t.pointerId);
			} catch {}
			e.pause(u.swipe);
		}
		g.dx = n;
		let r = V(g.item, n) ? n : Math.sign(n) * Math.min(Math.abs(n) * .15, 8);
		g.item.style.setProperty("--toast-swipe", `${r}px`);
	}, re = (t) => {
		if (!g) return;
		let { item: n, dx: r, active: i } = g, a = n.dataset.toastId;
		g = null, i && (delete n.dataset.swiping, e.resume(u.swipe), t && a !== void 0 ? (n.dataset.swipeOut = r > 0 ? "right" : "left", e.dismiss(a, "swipe")) : n.style.removeProperty("--toast-swipe"));
	}, ie = (e) => {
		if (!g || e.pointerId !== g.pointerId) return;
		let t = Math.abs(g.dx) / Math.max(1, Date.now() - g.time), n = (window.getSelection?.()?.toString() ?? "") !== "";
		re(!n && V(g.item, g.dx) && (Math.abs(g.dx) >= gi || t > _i));
	}, ae = (e) => {
		e.pointerId === g?.pointerId && re(!1);
	}, oe = (e) => {
		let t = (t) => {
			t.relatedTarget === e && t.stopImmediatePropagation();
		};
		ce && window.addEventListener("focusout", t, !0), e.focus(), window.removeEventListener("focusout", t, !0);
	}, se = (e) => {
		let { hotkey: t } = n(), i = t.length > 0 && t.every((t) => pi.includes(t) ? e[t] : e.code === t), a = w()[0];
		i && a && (e.preventDefault(), h = "keyboard", document.activeElement instanceof HTMLElement && document.activeElement !== document.body && !r.contains(document.activeElement) && (m = document.activeElement), oe(a));
	}, W = [], ce = !1, le = (e) => e.isConnected && (e instanceof HTMLDialogElement ? e.open && e.matches(":modal") : ce && e.matches(":popover-open")), ue = (e) => e instanceof HTMLElement && e !== i && e.hasAttribute("popover") && /^(alert)?dialog$/.test(e.getAttribute("role") ?? ""), G = (e) => {
		let t = W.indexOf(e);
		t !== -1 && W.splice(t, 1);
	}, K = (e) => {
		let t = Array.from(i?.querySelectorAll("[data-toast-id]") ?? []);
		t.forEach((e) => e.style.transition = "none"), e(), i?.offsetWidth, t.forEach((e) => e.style.removeProperty("transition"));
	}, q = () => !!i?.isConnected && ce && !i.matches(":popover-open"), de = () => {
		if (i?.isConnected && ce) {
			i.matches(":popover-open") && i.hidePopover();
			try {
				i.showPopover();
			} catch {
				requestAnimationFrame(() => {
					q() && K(() => i.showPopover());
				});
			}
		}
	}, fe = () => {
		if (!i) return;
		let e = [...W].reverse().find(le) ?? document.body;
		i.parentElement === e ? q() && de() : K(() => {
			e.append(i), de();
		});
	}, pe = (e) => {
		G(e), e.open && e.matches(":modal") && W.push(e);
	}, me = (e) => {
		ue(e.target) && e.newState === "closed" && (G(e.target), fe());
	}, he = (e) => {
		ue(e.target) && e.newState === "open" && (G(e.target), W.push(e.target), fe());
	}, ge = (e) => e.stopPropagation(), _e = (e) => {
		e.relatedTarget instanceof Node && r.contains(e.relatedTarget) && e.stopPropagation();
	}, ve = (e) => {
		let t = S(e.target);
		e.key === "Escape" && t && r.contains(t) && t.dataset.dismissible !== "false" && e.preventDefault();
	}, ye = (e) => {
		e.addEventListener("pointerdown", ge), e.addEventListener("focusin", ge), e.addEventListener("focusout", _e), window.addEventListener("keydown", ve, !0), document.addEventListener("beforetoggle", me, !0), document.addEventListener("toggle", he, !0);
	}, be = (e) => {
		e.removeEventListener("pointerdown", ge), e.removeEventListener("focusin", ge), e.removeEventListener("focusout", _e), window.removeEventListener("keydown", ve, !0), document.removeEventListener("beforetoggle", me, !0), document.removeEventListener("toggle", he, !0);
	}, xe = (e) => {
		let t = e && typeof i?.showPopover == "function";
		if (i && t !== ce) {
			if (ce = t, t) {
				ye(i), i.setAttribute("aria-live", "off"), i.setAttribute("popover", "manual"), Object.entries(hi).forEach(([e, t]) => i.style.setProperty(e, t));
				for (let e of document.querySelectorAll("[popover]")) ue(e) && le(e) && W.push(e);
			} else be(i), i.matches(":popover-open") && i.hidePopover(), i.removeAttribute("popover"), i.removeAttribute("aria-live"), Object.keys(hi).forEach((e) => i.style.removeProperty(e)), W.splice(0, W.length, ...W.filter((e) => e instanceof HTMLDialogElement));
			fe();
		}
	}, Se = i && typeof MutationObserver == "function" ? new MutationObserver((e) => {
		for (let t of e) t.type === "attributes" && t.target instanceof HTMLDialogElement && pe(t.target);
		(e.some((e) => e.type === "attributes") || !i.isConnected) && fe();
	}) : void 0;
	return i && Se && (document.querySelectorAll("dialog[open]").forEach((e) => pe(e)), Se.observe(document.documentElement, {
		subtree: !0,
		childList: !0,
		attributes: !0,
		attributeFilter: ["open"]
	}), fe()), xe(n().aboveModals), r.addEventListener("focusin", P), r.addEventListener("focusout", F), r.addEventListener("keydown", I), r.addEventListener("pointerdown", H), r.addEventListener("pointermove", te), r.addEventListener("pointerup", ie), r.addEventListener("pointercancel", ae), r.addEventListener("pointerover", z), r.addEventListener("pointerout", B), document.addEventListener("keydown", se), {
		update() {
			xe(n().aboveModals), n().name !== _ && (v(), _ = n().name, v = e.attach(_));
			let t = y(), { typeLabels: r } = n(), i = !U();
			for (let e of t) {
				if (e.state === "closing") continue;
				o.get(e.id) !== e.revision && (o.set(e.id, e.revision), a.announce(Si(e, r), e.politeness ?? (e.type === "error" ? "assertive" : "polite")));
				let t = x(e.id);
				t && i && e.count > (s.get(e.id) ?? e.count) && typeof t.animate == "function" && t.animate([
					{ scale: "1" },
					{ scale: "1.03" },
					{ scale: "1" }
				], {
					duration: 300,
					easing: "ease-out"
				}), s.set(e.id, e.count);
				let n = t?.querySelector("[data-toast-body]");
				n && D && !O.has(n) && (O.add(n), D.observe(n));
			}
			for (let e of [o, s]) for (let n of e.keys()) t.some((e) => e.id === n) || e.delete(n);
			N(), f && (p = w().indexOf(f)), g && !g.item.isConnected && re(!1), d && !d.matches(":hover") && (d = null, e.resume(u.hover)), E(), k();
		},
		destroy() {
			r.removeEventListener("focusin", P), r.removeEventListener("focusout", F), r.removeEventListener("keydown", I), r.removeEventListener("pointerdown", H), r.removeEventListener("pointermove", te), r.removeEventListener("pointerup", ie), r.removeEventListener("pointercancel", ae), r.removeEventListener("pointerover", z), r.removeEventListener("pointerout", B), document.removeEventListener("keydown", se), xe(!1), A(), D?.disconnect(), Se?.disconnect(), c.forEach((e) => e.animation?.cancel()), a.destroy(), e.resume(u.hover), e.resume(u.focus), e.resume(u.swipe), v();
		}
	};
}
// src/classes.ts
var Ei = "iui-toast rounded-iui-toast border-iui-toast-border bg-iui-toast-surface text-iui-toast-foreground focus-visible:ring-iui-toast-ring border shadow-lg focus-visible:ring-2 focus-visible:outline-hidden", Di = "flex items-start gap-3 p-4", Oi = "flex size-5 shrink-0 items-center justify-center", ki = {
	default: "text-iui-toast-default",
	info: "text-iui-toast-info",
	success: "text-iui-toast-success",
	warning: "text-iui-toast-warning",
	error: "text-iui-toast-error",
	loading: "text-iui-toast-loading"
}, Ai = "bg-iui-toast-default size-2 rounded-full", ji = "size-5 rounded-full object-cover", Mi = "size-5 motion-safe:animate-spin", Ni = "text-sm font-medium wrap-break-word", Pi = "bg-iui-toast-control-hover text-iui-toast-muted-foreground ms-1.5 inline-block rounded-full px-1.5 text-xs font-medium tabular-nums", Fi = "text-iui-toast-muted-foreground mt-1 text-sm wrap-break-word", Ii = "mt-3 flex flex-wrap gap-2", Li = "rounded-iui-toast focus-visible:ring-iui-toast-ring inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium focus-visible:ring-2 focus-visible:outline-hidden aria-disabled:cursor-default aria-disabled:opacity-60", Ri = `${Li} border-iui-toast-action text-iui-toast-action hover:bg-iui-toast-action/10 border`, zi = `${Li} border-iui-toast-border hover:bg-iui-toast-control-hover border`, Bi = "size-3.5 motion-safe:animate-spin", Vi = "rounded-iui-toast text-iui-toast-icon hover:bg-iui-toast-control-hover hover:text-iui-toast-icon-hover focus-visible:ring-iui-toast-ring -m-1 shrink-0 p-1 focus-visible:ring-2 focus-visible:outline-hidden", Hi = "iui-toast-progress", Ui = "bg-iui-toast-control-hover mt-2 h-1.5 overflow-hidden rounded-full", Wi = "h-full rounded-full bg-current transition-[width] duration-300 motion-reduce:transition-none", Gi = "rounded-iui-inbox text-iui-inbox-icon hover:bg-iui-inbox-control-hover hover:text-iui-inbox-icon-hover focus-visible:ring-iui-inbox-ring aria-expanded:bg-iui-inbox-control-hover aria-expanded:text-iui-inbox-icon-hover relative inline-flex size-9 items-center justify-center focus-visible:ring-2 focus-visible:outline-hidden", Ki = "bg-iui-inbox-badge text-iui-inbox-badge-foreground absolute -inset-e-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[0.6875rem] leading-none font-semibold tabular-nums", qi = "bg-iui-inbox-badge absolute inset-e-1.5 top-1.5 size-2 rounded-full forced-color-adjust-none forced-colors:bg-[Highlight]", Ji = "iui-inbox-panel border-iui-inbox-border bg-iui-inbox-surface text-iui-inbox-foreground shadow-xl focus-visible:outline-hidden", Yi = "iui-inbox-panel-body flex min-h-0 flex-1 flex-col", Xi = "flex items-center justify-between gap-3 px-4 pt-3 pb-1", Zi = "border-iui-inbox-border flex flex-wrap-reverse items-stretch border-b pe-4", Qi = "iui-inbox-fade border-iui-inbox-border -mb-px flex min-w-0 flex-auto gap-1 overflow-x-auto border-b ps-2.5 pe-8 scrollbar-none", $i = "-me-1.5 flex shrink-0 items-center gap-1 py-2 ps-2.5", ea = "text-base font-semibold", ta = "-me-1.5 flex items-center gap-1", na = "text-iui-inbox-muted-foreground hover:text-iui-inbox-foreground focus-visible:ring-iui-inbox-ring rounded-md px-1.5 py-1 text-xs font-medium focus-visible:ring-2 focus-visible:outline-hidden aria-disabled:pointer-events-none aria-disabled:opacity-50", ra = "border-iui-inbox-border bg-iui-inbox-surface text-iui-inbox-foreground rounded-iui-inbox m-0 w-max min-w-48 border p-1 shadow-lg", ia = "hover:bg-iui-inbox-control-hover focus-visible:bg-iui-inbox-control-hover flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm outline-hidden aria-disabled:pointer-events-none aria-disabled:opacity-50", aa = `${ia} ps-8`, oa = "text-iui-inbox-muted-foreground flex items-center gap-2 px-2 pt-1.5 pb-1 text-xs font-medium", sa = "text-iui-inbox-icon size-4 shrink-0", ca = "bg-iui-inbox-border -mx-1 my-1 h-px", la = "text-iui-inbox-muted-foreground ms-auto ps-6 tabular-nums", ua = "inline-flex", da = "bg-iui-inbox-tooltip text-iui-inbox-tooltip-foreground pointer-events-none m-0 flex w-max max-w-xs items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium shadow-md", fa = "inline-block h-4 min-w-4 content-center rounded border border-current/30 px-1 text-center font-sans text-[0.625rem] leading-none opacity-80 [text-box:trim-both_cap_alphabetic]", pa = "bg-iui-inbox-control-hover text-iui-inbox-foreground mx-4 mt-1 mb-2 flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs", ma = "text-iui-inbox-icon size-4 shrink-0", ha = "text-iui-inbox-foreground hover:bg-iui-inbox-surface focus-visible:ring-iui-inbox-ring -my-1 -me-1.5 shrink-0 rounded-md px-2 py-1 font-semibold focus-visible:ring-2 focus-visible:outline-hidden", ga = "iui-inbox-fade border-iui-inbox-border flex shrink-0 gap-1 overflow-x-auto border-b ps-2.5 pe-8 scrollbar-none", _a = "text-iui-inbox-muted-foreground hover:text-iui-inbox-foreground focus-visible:ring-iui-inbox-ring aria-selected:border-iui-inbox-accent aria-selected:text-iui-inbox-accent aria-[current=page]:border-iui-inbox-accent aria-[current=page]:text-iui-inbox-accent -mb-px inline-flex items-center gap-1.5 rounded-t-md border-b-2 border-transparent px-1.5 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:outline-hidden focus-visible:ring-inset", va = "iui-inbox-fade border-iui-inbox-border flex shrink-0 gap-1.5 overflow-x-auto border-b ps-4 pe-8 py-2 scrollbar-none", ya = "border-iui-inbox-border text-iui-inbox-muted-foreground hover:bg-iui-inbox-control-hover hover:text-iui-inbox-foreground focus-visible:ring-iui-inbox-ring aria-pressed:border-iui-inbox-accent aria-pressed:bg-iui-inbox-accent-subtle aria-pressed:text-iui-inbox-accent aria-[current=page]:border-iui-inbox-accent aria-[current=page]:bg-iui-inbox-accent-subtle aria-[current=page]:text-iui-inbox-accent inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium focus-visible:ring-2 focus-visible:outline-hidden", ba = "text-iui-inbox-accent tabular-nums", xa = "bg-iui-inbox-accent-subtle text-iui-inbox-accent rounded-full px-1.5 text-xs/5 tabular-nums", Sa = "min-h-0 flex-1 overflow-y-auto overscroll-contain", Ca = "sticky top-0 z-20 flex h-0 justify-center", wa = "border-iui-inbox-accent bg-iui-inbox-surface text-iui-inbox-accent focus-visible:ring-iui-inbox-ring mt-2 h-fit rounded-full border px-3 py-1 text-xs font-medium shadow-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden", Ta = "divide-iui-inbox-border divide-y", Ea = "focus-visible:ring-iui-inbox-ring focus-visible:ring-2 focus-visible:ring-inset focus-visible:outline-hidden", Da = "text-iui-inbox-muted-foreground hover:text-iui-inbox-foreground focus-visible:ring-iui-inbox-ring ms-15 -mt-2 mb-2.5 rounded-md px-1 py-0.5 text-xs font-medium focus-visible:ring-2 focus-visible:outline-hidden", Oa = "divide-iui-inbox-border border-iui-inbox-border ms-12 divide-y border-s", ka = "group/item hover:bg-iui-inbox-control-hover/60 data-[selected=true]:bg-iui-inbox-control-hover/60 has-[[data-inbox-link]:focus-visible]:ring-iui-inbox-ring relative flex flex-wrap gap-3 px-4 py-3 has-[[data-inbox-link]:focus-visible]:ring-2 has-[[data-inbox-link]:focus-visible]:ring-inset", Aa = "relative flex shrink-0 self-start", ja = "bg-iui-inbox-unread ring-iui-inbox-surface absolute end-0 top-0 size-2.5 rounded-full ring-2 forced-color-adjust-none forced-colors:bg-[Highlight]", Ma = "bg-iui-inbox-control-hover text-iui-inbox-icon-hover flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-medium", Na = "text-iui-inbox-foreground text-sm wrap-break-word group-data-[read=false]/item:font-semibold", Pa = "after:absolute after:inset-0 focus-visible:outline-hidden", Fa = "text-iui-inbox-muted-foreground mt-0.5 line-clamp-3 text-sm wrap-break-word", Ia = "border-iui-inbox-border mt-2 max-h-40 rounded-md border object-cover", La = "text-iui-inbox-muted-foreground mt-1 block text-xs", Ra = "text-iui-inbox-muted-foreground mt-1 flex items-center gap-1 text-xs", za = "text-iui-inbox-muted-foreground mt-1 flex items-center gap-1 text-xs", Ba = "text-iui-inbox-muted-foreground font-normal", Va = "relative z-10 mt-2 flex flex-wrap gap-2", Ha = "text-iui-inbox-muted-foreground mt-1.5 flex items-center gap-1.5 text-xs", Ua = "isolate flex", Wa = "bg-iui-inbox-control-hover text-iui-inbox-icon-hover ring-iui-inbox-surface relative flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full text-[0.625rem] font-medium ring-2 not-first:-ms-0.5", Ga = "text-iui-inbox-muted-foreground mt-2 flex items-center gap-1.5 text-xs font-medium", Ka = "rounded-md focus-visible:ring-iui-inbox-ring inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium focus-visible:ring-2 focus-visible:outline-hidden aria-disabled:cursor-default aria-disabled:opacity-60", qa = `${Ka} border-iui-inbox-accent text-iui-inbox-accent hover:bg-iui-inbox-accent-subtle border`, Ja = `${Ka} border-iui-inbox-border bg-iui-inbox-surface hover:bg-iui-inbox-control-hover border`, Ya = "iui-inbox-controls border-iui-inbox-border z-10 flex shrink-0 items-center gap-0.5 rounded-md opacity-0 group-focus-within/item:opacity-100 group-hover/item:opacity-100 [@media(hover:none)]:opacity-100", Xa = "bg-iui-inbox-control-hover absolute inset-0 flex items-center justify-center rounded-full opacity-0 group-hover/item:opacity-100 group-data-[selected=true]/item:opacity-100 in-data-inbox-selecting:opacity-100 has-focus-visible:opacity-100 motion-safe:transition-opacity", Za = "accent-iui-inbox-accent size-4 cursor-pointer", Qa = "border-iui-inbox-border flex shrink-0 items-center justify-between gap-3 border-t px-4 py-1.5", $a = "bg-iui-inbox-surface sticky bottom-0 z-20", eo = "text-iui-inbox-foreground flex items-center gap-2 text-sm font-medium", to = "accent-iui-inbox-accent size-4 cursor-pointer", no = "flex shrink-0 flex-wrap gap-2 px-4 pt-1 pb-2", ro = "text-iui-inbox-icon hover:bg-iui-inbox-control-hover hover:text-iui-inbox-icon-hover focus-visible:ring-iui-inbox-ring rounded-md p-1.5 focus-visible:ring-2 focus-visible:outline-hidden [@media(hover:hover)]:p-1", io = "text-iui-inbox-muted-foreground flex flex-col items-center gap-3 px-6 py-12 text-center text-sm", ao = "text-iui-inbox-icon size-8", oo = "text-iui-inbox-muted-foreground flex justify-center py-3", so = "overflow-x-auto", co = "w-full border-collapse text-sm", lo = "text-iui-inbox-muted-foreground px-4 py-2.5 text-start text-xs font-medium", uo = "text-iui-inbox-muted-foreground w-20 px-2 py-2.5 text-center text-xs font-medium sm:w-24", fo = "border-iui-inbox-border border-t", po = "bg-iui-inbox-control-hover/50 px-4 pt-4 pb-2 text-start font-normal", mo = "text-iui-inbox-foreground font-semibold", ho = "min-w-36 px-4 py-3 text-start align-top font-normal", go = "text-iui-inbox-foreground font-medium", _o = "text-iui-inbox-foreground me-2 font-medium", vo = "bg-iui-inbox-control-hover text-iui-inbox-muted-foreground inline-block rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", yo = "text-iui-inbox-muted-foreground mt-0.5 block", bo = "px-2 py-3 text-center align-middle", xo = "text-iui-inbox-muted-foreground w-40 px-4 py-2.5 text-start text-xs font-medium", So = "px-4 py-3 text-start align-middle", Co = "border-iui-inbox-border border-t px-4 py-3 text-sm", wo = "min-w-0 grow", To = "flex flex-wrap items-start justify-between gap-x-6 gap-y-3", Eo = "min-w-0 grow basis-64", Do = "bg-iui-inbox-control-hover text-iui-inbox-foreground mt-2 rounded-md px-3 py-2", Oo = "shrink-0 whitespace-nowrap", ko = "mt-4", Ao = "text-iui-inbox-muted-foreground text-xs font-medium", jo = "divide-iui-inbox-border border-iui-inbox-border mt-2 divide-y rounded-md border", Mo = "flex items-center justify-between gap-4 px-3 py-2", No = "border-iui-inbox-border border-t px-4 py-3 text-sm", Po = "flex items-start gap-3", Fo = "mt-3 flex flex-col gap-3 sm:gap-2", Io = "flex flex-wrap items-start gap-x-4 gap-y-2", Lo = "text-iui-inbox-foreground flex h-8 w-36 shrink-0 items-center gap-3 font-medium", Ro = "flex min-w-0 grow basis-60 flex-col items-start gap-2", zo = "flex flex-wrap items-center gap-x-3 gap-y-2", Bo = "text-iui-inbox-muted-foreground flex h-8 items-center", Vo = "text-iui-inbox-muted-foreground -ms-2 hover:bg-iui-inbox-control-hover hover:text-iui-inbox-foreground focus-visible:ring-iui-inbox-ring rounded-md px-2 py-1 text-xs font-medium focus-visible:ring-2 focus-visible:outline-hidden disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-iui-inbox-muted-foreground", Ho = "text-iui-inbox-muted-foreground flex items-center gap-2 text-xs font-medium", Uo = "rounded-iui-inbox border-iui-inbox-border bg-iui-inbox-surface text-iui-inbox-foreground focus-visible:ring-iui-inbox-ring border px-2 py-1 text-sm focus-visible:ring-2 focus-visible:outline-hidden disabled:cursor-default disabled:opacity-50", Wo = "rounded-iui-inbox border-iui-inbox-border bg-iui-inbox-surface text-iui-inbox-foreground focus-visible:ring-iui-inbox-ring min-w-full border px-2 py-1 text-sm focus-visible:ring-2 focus-visible:outline-hidden disabled:cursor-default disabled:opacity-50", Go = "group/switch bg-iui-inbox-icon aria-checked:bg-iui-inbox-accent focus-visible:ring-iui-inbox-ring focus-visible:ring-offset-iui-inbox-surface relative inline-flex h-5 w-9 shrink-0 items-center rounded-full focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden aria-disabled:cursor-default aria-disabled:opacity-50 forced-colors:border motion-safe:transition-colors", Ko = "bg-iui-inbox-surface ms-0.5 size-4 rounded-full shadow-sm forced-color-adjust-none group-aria-checked/switch:translate-x-4 forced-colors:bg-[ButtonText] forced-colors:group-aria-checked/switch:bg-[Highlight] motion-safe:transition-transform rtl:group-aria-checked/switch:-translate-x-4", qo = "border-iui-inbox-border text-iui-inbox-accent hover:bg-iui-inbox-control-hover focus-visible:ring-iui-inbox-ring block border-t px-4 py-2.5 text-center text-sm font-medium focus-visible:ring-2 focus-visible:outline-hidden focus-visible:ring-inset", Jo = {
	key: 1,
	viewBox: "0 0 20 20",
	fill: "none",
	stroke: "currentColor",
	"stroke-width": "2",
	"aria-hidden": "true"
}, Yo = ["d"], Xo = {
	key: 2,
	viewBox: "0 0 20 20",
	fill: "currentColor",
	"aria-hidden": "true"
}, Zo = ["d"], $ = /* @__PURE__ */ u({
	__name: "Icon",
	props: {
		name: {},
		context: {},
		icons: { default: () => ({}) },
		resolver: {
			type: [Function, null],
			default: void 0
		}
	},
	setup(t) {
		let i = t, s = n(() => He(i.name, i.context, i.icons, i.resolver));
		return (t, n) => s.value ? (S(), r(E(s.value), {
			key: 0,
			"aria-hidden": "true"
		})) : i.name === "spinner" ? (S(), a("svg", Jo, [n[0] ||= o("circle", {
			cx: "10",
			cy: "10",
			r: "7",
			opacity: "0.25"
		}, null, -1), o("path", {
			d: A(Pe),
			"stroke-linecap": "round"
		}, null, 8, Yo)])) : (S(), a("svg", Xo, [(S(!0), a(e, null, w(A(je)(A(Re), i.name), (e) => (S(), a("path", {
			key: e,
			"fill-rule": "evenodd",
			"clip-rule": "evenodd",
			d: e
		}, null, 8, Zo))), 128))]));
	}
});
// ../js/inertia.ts
function Qo(e, t, n) {
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
function $o(e) {
	ti(Qo(R, L, z), e);
}
// src/Toaster.vue?vue&type=script&setup=true&lang.ts
var es = ["aria-label", "data-toaster"], ts = ["data-position"], ns = [
	"data-toast-id",
	"data-type",
	"data-state",
	"data-dismissible",
	"aria-busy"
], rs = ["src"], is = {
	key: 3,
	viewBox: "0 0 20 20",
	fill: "currentColor",
	class: "size-5"
}, as = ["d"], os = { class: "min-w-0 flex-1" }, ss = {
	key: 0,
	class: "sr-only"
}, cs = ["aria-label", "aria-valuenow"], ls = ["aria-label", "onClick"], us = /* @__PURE__ */ u({
	__name: "Toaster",
	props: {
		position: { default: "bottom-right" },
		name: { default: void 0 },
		label: { default: void 0 },
		dismissLabel: {
			type: [String, Function],
			default: void 0
		},
		hotkey: { default: () => fi },
		typeLabels: { default: () => ({}) },
		visibleToasts: { default: 3 },
		expand: {
			type: Boolean,
			default: !1
		},
		progress: {
			type: Boolean,
			default: !1
		},
		icons: { default: () => ({}) },
		iconResolver: {
			type: [Function, null],
			default: void 0
		},
		classes: { default: () => ({}) },
		components: { default: () => ({}) },
		aboveModals: {
			type: Boolean,
			default: !0
		}
	},
	setup(s) {
		let u = s, d = B(), f = D(Q.getSnapshot()), p = n(() => Ci(f.value.filter((e) => e.toaster === u.name), u.position)), m = D(), g = C(), k = C(), j = C(), M, F, I = (e) => {
			if (typeof e.icon == "object" || typeof e.icon == "function") return e.icon;
			let t = (t, n) => He(t, {
				component: "Toaster",
				part: n,
				toast: e
			}, u.icons, u.iconResolver);
			return (typeof e.icon == "string" ? t(e.icon, "icon") : void 0) ?? t(e.type, "type");
		}, L = (e) => Q.dismiss(e.id, "user"), R = (e, t, n) => ai(e.id, t, n);
		return y(() => {
			$o(), F = Q.subscribe(() => f.value = Q.getSnapshot()), zr(d.flash), f.value = Q.getSnapshot();
			let e = document.createElement("div");
			e.className = "iui-toaster-host", document.body.append(e), m.value = e;
		}), N(g, (e) => {
			e && !M && (M = Ti(Q, {
				region: e,
				host: m.value,
				polite: k.value,
				assertive: j.value
			}, () => ({
				name: u.name,
				hotkey: u.hotkey,
				typeLabels: u.typeLabels,
				visibleToasts: u.visibleToasts,
				expand: u.expand,
				aboveModals: u.aboveModals
			})), M.update());
		}, { flush: "post" }), x(() => M?.update()), v(() => {
			F?.(), M?.destroy();
		}), b(() => m.value?.remove()), (n, s) => m.value ? (S(), r(t, {
			key: 0,
			to: m.value
		}, [o("section", {
			ref_key: "region",
			ref: g,
			"aria-label": A(yi)(u.label, u.hotkey),
			tabindex: "-1",
			class: "iui-toaster outline-none",
			"data-toaster": u.name
		}, [
			(S(!0), a(e, null, w(p.value, ([t, s]) => (S(), a("ol", {
				key: t,
				role: "list",
				"data-toast-list": "",
				"data-position": t,
				class: "iui-toast-list"
			}, [(S(!0), a(e, null, w(s, (t) => (S(), a("li", {
				key: t.id,
				"data-toast-id": t.id,
				"data-type": t.type,
				"data-state": t.state,
				"data-dismissible": String(t.dismissible),
				"aria-busy": t.type === "loading" || void 0,
				tabindex: "0",
				class: h(A(J)(Ei, u.classes.toast))
			}, [o("div", {
				"data-toast-body": "",
				class: h(Di)
			}, [A(je)(u.components, t.type) ? (S(), r(E(A(je)(u.components, t.type)), {
				key: 0,
				toast: t,
				dismiss: () => L(t),
				"run-action": (e, n) => R(t, e, n)
			}, null, 8, [
				"toast",
				"dismiss",
				"run-action"
			])) : T(n.$slots, "toast", {
				toast: t,
				dismiss: () => L(t),
				runAction: (e, n) => R(t, e, n)
			}, () => [
				t.icon === !1 ? i("", !0) : (S(), a("span", {
					key: 0,
					"aria-hidden": "true",
					class: h(A(J)(Oi, A(je)(ki, t.type) ?? ki.default, u.classes.icon))
				}, [T(n.$slots, "icon", { toast: t }, () => [t.image ? (S(), a("img", {
					key: 0,
					src: t.image,
					alt: "",
					class: h(ji)
				}, null, 10, rs)) : I(t) ? (S(), r(E(I(t)), {
					key: 1,
					class: "size-5"
				})) : t.type === "loading" ? (S(), r($, {
					key: 2,
					name: "spinner",
					context: {
						component: "Toaster",
						part: "type",
						toast: t
					},
					icons: u.icons,
					resolver: u.iconResolver,
					class: h(Mi)
				}, null, 8, [
					"context",
					"icons",
					"resolver",
					"class"
				])) : A(je)(A(Me), t.type) ? (S(), a("svg", is, [o("path", {
					"fill-rule": "evenodd",
					"clip-rule": "evenodd",
					d: A(je)(A(Me), t.type)
				}, null, 8, as)])) : (S(), a("span", {
					key: 4,
					class: h(Ai)
				}, null, 2))])], 2)),
				o("div", os, [
					o("p", { class: h(A(J)(Ni, u.classes.title)) }, [
						A(xi)(t.type, u.typeLabels) ? (S(), a("span", ss, O(A(xi)(t.type, u.typeLabels)) + ": ", 1)) : i("", !0),
						c(O(t.title), 1),
						t.count > 1 ? (S(), a("span", {
							key: 1,
							"data-toast-count": "",
							"aria-hidden": "true",
							class: h(Pi)
						}, O(A(Je)("toast_count", { count: t.count })), 3)) : i("", !0)
					], 2),
					t.description ? (S(), a("p", {
						key: 0,
						class: h(A(J)(Fi, u.classes.description))
					}, O(t.description), 3)) : i("", !0),
					t.progress === void 0 ? i("", !0) : (S(), a("div", {
						key: 1,
						role: "progressbar",
						"aria-label": t.title,
						"aria-valuemin": "0",
						"aria-valuemax": "100",
						"aria-valuenow": Math.round(t.progress * 100),
						"data-toast-progressbar": "",
						class: h(Ui)
					}, [o("div", {
						class: h(A(J)(Wi, A(je)(ki, t.type) ?? ki.default)),
						style: _({ width: `${t.progress * 100}%` })
					}, null, 6)], 10, cs)),
					t.actions.length > 0 ? (S(), a("div", {
						key: 2,
						class: h(A(J)(Ii, u.classes.actions))
					}, [(S(!0), a(e, null, w(t.actions, (e, n) => (S(), r(E(A(ye)(e) === void 0 ? "button" : "a"), {
						key: n,
						type: A(ye)(e) === void 0 ? "button" : void 0,
						href: A(ye)(e),
						target: e.newTab ? "_blank" : void 0,
						rel: e.newTab ? "noopener noreferrer" : void 0,
						"aria-disabled": t.pendingAction !== void 0 || void 0,
						"aria-busy": t.pendingAction === n || void 0,
						"data-toast-action": "",
						class: h(A(J)(n === 0 ? Ri : zi, u.classes.action)),
						onClick: (e) => R(t, n, e)
					}, {
						default: P(() => [t.pendingAction === n ? (S(), r($, {
							key: 0,
							name: "spinner",
							context: {
								component: "Toaster",
								part: "action",
								toast: t,
								action: e
							},
							icons: u.icons,
							resolver: u.iconResolver,
							class: h(Bi)
						}, null, 8, [
							"context",
							"icons",
							"resolver",
							"class"
						])) : i("", !0), c(" " + O(e.label), 1)]),
						_: 2
					}, 1032, [
						"type",
						"href",
						"target",
						"rel",
						"aria-disabled",
						"aria-busy",
						"class",
						"onClick"
					]))), 128))], 2)) : i("", !0)
				]),
				t.dismissible ? (S(), a("button", {
					key: 1,
					type: "button",
					"aria-label": A(bi)(u.dismissLabel, t),
					class: h(A(J)(Vi, u.classes.dismiss)),
					onClick: (e) => L(t)
				}, [l($, {
					name: "dismiss",
					context: {
						component: "Toaster",
						part: "dismiss",
						toast: t
					},
					icons: u.icons,
					resolver: u.iconResolver,
					class: "size-4"
				}, null, 8, [
					"context",
					"icons",
					"resolver"
				])], 10, ls)) : i("", !0)
			], void 0, 1)], 2), u.progress && t.duration !== null ? (S(), a("div", {
				key: 0,
				"data-toast-progress": "",
				"aria-hidden": "true",
				class: h(A(J)(Hi, A(je)(ki, t.type) ?? ki.default, u.classes.progress))
			}, null, 2)) : i("", !0)], 10, ns))), 128))], 8, ts))), 128)),
			o("div", {
				ref_key: "polite",
				ref: k,
				role: "status",
				"aria-live": "polite",
				"aria-atomic": "true",
				class: "sr-only"
			}, null, 512),
			o("div", {
				ref_key: "assertive",
				ref: j,
				"aria-live": "assertive",
				"aria-atomic": "true",
				class: "sr-only"
			}, null, 512)
		], 8, es)], 8, ["to"])) : i("", !0);
	}
}), ds = [
	"all",
	"unread",
	"snoozed",
	"archived"
], fs = {
	all: "empty",
	unread: "emptyUnread",
	snoozed: "emptySnoozed",
	archived: "emptyArchived"
}, ps = (e) => [...ds, ...Object.keys(e)], ms = (e) => ps(e.tabs).filter((t) => nt(t, e.allowedActions));
function hs(e, t, n) {
	return Object.hasOwn(fs, e) ? Z(t[e]) : Object.hasOwn(n, e) ? n[e].label : e;
}
var gs = (e, t) => Z(t[Object.hasOwn(fs, e) ? fs[e] : "empty"]), _s = (e, t, n) => e.map((e) => ({
	filter: e,
	label: hs(e, n, t.tabs),
	selected: t.filter === e,
	count: e === "unread" ? t.counts.unread : null
})), vs = (e, t) => t.length > 0 ? e.filter((e) => !t.includes(e.id)) : e;
function ys(e, t) {
	return e.status === "idle" || e.status === "loading" && t === 0 ? "loading" : e.status === "error" ? "error" : t === 0 ? "empty" : "items";
}
function bs(e, t = e.category) {
	at({
		...e,
		category: t
	}) > 0 && X.markAllAsRead({ category: t });
}
var xs = (e) => e.filter === "all" && e.allowedActions.includes("archive");
function Ss(e, t) {
	e.length > 0 && X.archiveAll({ category: t });
}
function Cs(e, t, n, r) {
	let i = new URL(e, "http://localhost"), a = i.searchParams;
	return a.delete("filter"), a.delete("category"), r !== void 0 && a.delete(r), t !== "all" && a.set("filter", t), n !== null && a.set("category", n), `${i.pathname}${i.search}`;
}
function ws(e, t, n, r) {
	let i = new URL(e, "http://localhost").searchParams, a = i.get("filter");
	return {
		filter: n ?? (a !== null && ms(t).includes(a) ? a : "all"),
		category: r === void 0 ? i.get("category") || null : r
	};
}
var Ts = (e, t, n, r) => Z(e.pausedUntil, { time: Lt(t, n, r) }), Es = (e, t, n) => Lt(Ft(e.preset, new Date(t)), t, n);
function Ds(e, t) {
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
var Os = (e, t, n = /* @__PURE__ */ new Date()) => e ? e(n) : Mt(t, n);
function ks(e, t, n) {
	let r = e.filter((e) => e !== t);
	return n ? [...r, t] : r;
}
function As(e, t, { scroller: n, listed: r }) {
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
var js = 1e3, Ms = 250;
function Ns(e, t, n = e) {
	let r = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Set(), a = [], o, s = () => {
		o = void 0;
		let e = a, n = t().filter((t) => e.includes(t.id));
		a = [], n.length > 0 && X.batch("seen", n);
	}, c = (e) => {
		clearTimeout(r.get(e)), r.delete(e);
	}, l = (e) => {
		r.delete(e);
		let t = e.dataset.inboxId;
		t !== void 0 && e.dataset.seen === "false" && e.isConnected && (u.unobserve(e), i.delete(e), a.push(t), o ??= setTimeout(s, Ms));
	}, u = new IntersectionObserver((e) => {
		for (let t of e) {
			let e = t.target, n = t.rootBounds !== null && t.intersectionRect.height >= t.rootBounds.height / 2;
			t.isIntersecting && (t.intersectionRatio >= .5 || n) ? r.set(e, r.get(e) ?? setTimeout(() => l(e), js)) : c(e);
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
function Ps(e, t) {
	let n = (e.target instanceof Element ? e.target : null)?.closest("[data-inbox-link], [data-inbox-action]"), r = n?.closest("[data-inbox-item]")?.dataset.inboxId, i = r === void 0 ? void 0 : t.find((e) => e.id === r);
	if (!n || !i) return;
	if (!n.hasAttribute("data-inbox-action")) return { item: i };
	let a = n.getAttribute("data-inbox-action"), o = a ? i.actions[Number(a)] : void 0;
	return o ? {
		item: i,
		action: o
	} : void 0;
}
var Fs = 160, Is = [
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
function Ls(e, t, n) {
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
			a?.(), a = void 0, Is.forEach((e) => t.style.removeProperty(e)), delete t.dataset.side;
			return;
		}
		let { placement: r } = oe(e, t, {
			placement: n.placement(),
			offset: c("--inbox-gap", 8),
			viewportMargin: c("--inbox-offset", 8),
			anchorPositioning: !1
		});
		t.dataset.side = r.split("-")[0], a ??= H(e, t, l);
	}, u = () => void (a === void 0 && l()), d = (e) => {
		e.newState === "open" && requestAnimationFrame(() => a === void 0 && l());
	}, f = (r) => {
		let i = r.newState === "open";
		i ? (a === void 0 && l(), window.addEventListener("resize", u), t.contains(document.activeElement) || t.focus({ preventScroll: !0 })) : (a?.(), a = void 0, window.removeEventListener("resize", u)), e.setAttribute("aria-expanded", String(i)), n.onToggle(i);
	}, p = (n) => {
		let r = n.relatedTarget;
		r instanceof Node && !t.contains(r) && !e.contains(r) && t.matches(":popover-open") && t.hidePopover();
	};
	return t.addEventListener("beforetoggle", d), t.addEventListener("toggle", f), t.addEventListener("focusout", p), {
		observe(e) {
			let t = e?.closest("[data-inbox-scroller]") ?? null;
			r && t === i || (r?.disconnect(), i = t, r = typeof IntersectionObserver == "function" ? new IntersectionObserver((e) => {
				e.some((e) => e.isIntersecting) && n.onEndReached();
			}, {
				root: t,
				rootMargin: `0px 0px ${Fs}px 0px`
			}) : void 0), r?.disconnect(), e && r?.observe(e);
		},
		place: l,
		close() {
			t.matches(":popover-open") && t.hidePopover();
		},
		destroy() {
			r?.disconnect(), s?.disconnect(), a?.(), t.removeEventListener("beforetoggle", d), t.removeEventListener("toggle", f), t.removeEventListener("focusout", p), window.removeEventListener("resize", u);
		}
	};
}
var Rs = {
	j: "next",
	arrowdown: "next",
	k: "previous",
	arrowup: "previous",
	u: "read",
	e: "archive",
	h: "snooze",
	x: "select",
	enter: "open"
}, zs = {
	read: "[data-inbox-toggle-read]",
	archive: "[data-inbox-toggle-archive]",
	snooze: "[data-inbox-snooze]",
	select: "[data-inbox-select]",
	open: "[data-inbox-link]"
};
function Bs(e, t) {
	let n = Rs[e.key.toLowerCase()], r = e.target instanceof HTMLElement ? e.target : null;
	if (!n || !r || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || r.closest("input:not([type=\"checkbox\"]), textarea, select, [contenteditable]:not([contenteditable=\"false\"]), [role=\"tab\"]")) return;
	let i = [...t.querySelectorAll("[data-inbox-item]")], a = r.closest("[data-inbox-item]"), o = a ? i.indexOf(a) : -1;
	if ((n === "open" || e.key.startsWith("Arrow")) && r !== a && r !== t) return;
	if (n === "next" || n === "previous") {
		let t = i[n === "next" ? o + 1 : o - 1];
		t && (e.preventDefault(), t.focus());
		return;
	}
	let s = a?.querySelector(zs[n]);
	a && s && (e.preventDefault(), s.click());
}
function Vs(e, t = () => e) {
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
function Hs(e, t, n, r, i = !1) {
	let a = t > 0 ? Z(e.bellNew, {
		count: Gt(t, n, r),
		number: t
	}) : Z(e.bell);
	return i ? Z(e.bellPaused, { label: a }) : a;
}
function Us(e) {
	return e.trim().split(/\s+/).slice(0, 2).map((e) => Array.from(e)[0]?.toLocaleUpperCase() ?? "").join("");
}
function Ws(e, t, n, r = !1) {
	let i = n.indexOf(t), a = {
		ArrowRight: r ? -1 : 1,
		ArrowLeft: r ? 1 : -1
	}[e];
	return a === void 0 ? e === "Home" ? n[0] : e === "End" ? n.at(-1) : void 0 : n[(i + a + n.length) % n.length];
}
// ../js/overlay.ts
var Gs = () => typeof HTMLElement < "u" && "showPopover" in HTMLElement.prototype, Ks = null;
function qs(e) {
	let t = null, n = (n) => {
		n && Ks !== t ? (Ks?.hide(), Ks = t) : !n && Ks === t && (Ks = null), e.onOpenChange(n);
	}, r = (t) => {
		let n = e.tooltip();
		if (n) return te(n), U() ? void 0 : V(n, t ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }], {
			duration: t ? 150 : 75,
			easing: t ? "out" : "in"
		});
	}, i = () => t ??= ie({
		...e,
		onOpenChange: n,
		onMount: ({ popover: e }) => () => te(e),
		transition: r
	});
	return {
		native: Gs(),
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
			t?.cleanup(), Ks === t && (Ks = null);
		}
	};
}
// src/Tooltip.vue?vue&type=script&setup=true&lang.ts
var Js = ["popover"], Ys = /* @__PURE__ */ u({
	__name: "Tooltip",
	props: {
		text: {},
		shortcut: {}
	},
	setup(e) {
		let t = C(!1), n = C(), r = C(), o = qs({
			reference: () => n.value ?? null,
			tooltip: () => r.value ?? null,
			onOpenChange: (e) => t.value = e
		});
		return N(t, async (e) => {
			e && (await m(), o.mount());
		}), v(o.cleanup), (s, l) => (S(), a("span", {
			ref_key: "trigger",
			ref: n,
			class: h(ua),
			onPointerenter: l[0] ||= (...e) => A(o).onPointerEnter && A(o).onPointerEnter(...e),
			onPointerleave: l[1] ||= (...e) => A(o).onPointerLeave && A(o).onPointerLeave(...e),
			onPointerdown: l[2] ||= (...e) => A(o).onPointerDown && A(o).onPointerDown(...e),
			onFocusin: l[3] ||= (...e) => A(o).onFocusIn && A(o).onFocusIn(...e),
			onFocusout: l[4] ||= (...e) => A(o).onFocusOut && A(o).onFocusOut(...e)
		}, [T(s.$slots, "default"), t.value ? (S(), a("span", {
			key: 0,
			ref_key: "panel",
			ref: r,
			role: "tooltip",
			popover: A(o).native ? "manual" : void 0,
			"data-inbox-tooltip": "",
			class: h(da)
		}, [c(O(e.text) + " ", 1), e.shortcut ? (S(), a("kbd", {
			key: 0,
			class: h(fa)
		}, O(e.shortcut), 3)) : i("", !0)], 10, Js)) : i("", !0)], 34));
	}
}), Xs = ["id"], Zs = ["aria-disabled"], Qs = [
	"aria-label",
	"aria-expanded",
	"aria-controls"
], $s = [
	"id",
	"aria-label",
	"popover"
], ec = ["aria-disabled"], tc = ["aria-labelledby"], nc = ["id"], rc = ["onClick"], ic = { "aria-live": "polite" }, ac = { class: "min-w-0 flex-1" }, oc = ["aria-labelledby"], sc = [
	"id",
	"aria-selected",
	"aria-controls",
	"tabindex",
	"data-inbox-tab",
	"onClick"
], cc = ["aria-label"], lc = [
	"data-inbox-category",
	"aria-pressed",
	"onClick"
], uc = /* @__PURE__ */ u({
	__name: "InboxHeader",
	props: {
		component: {},
		state: {},
		filter: {},
		category: {},
		items: {},
		labels: {},
		icons: {},
		iconResolver: {
			type: [Function, null],
			default: void 0
		},
		classes: {},
		locale: { default: void 0 },
		maxCount: { default: 99 },
		now: {},
		panel: { default: void 0 },
		href: {
			type: Function,
			default: void 0
		},
		open: {
			type: Boolean,
			default: !0
		}
	},
	setup(t) {
		let s = t, u = j(), f = j(), _ = (e) => Z(s.labels[e]), y = n(() => ms(s.state)), b = n(() => _s(y.value, {
			...s.state,
			filter: s.filter
		}, s.labels)), x = n(() => Object.entries(s.state.categoryFilter)), E = n(() => at({
			...s.state,
			category: s.category
		})), D = n(() => xs({
			filter: s.filter,
			allowedActions: s.state.allowedActions
		})), k = n(() => s.filter === "all" || s.filter === "unread"), M = n(() => D.value || s.state.canPause), F = n(() => k.value || M.value), L = (e) => ({
			component: s.component,
			part: e
		}), R = C(), z = C(), B = C(!1), ee = n(() => It(s.state.pausePresets, s.labels, s.locale)), V = re({
			reference: () => R.value ?? null,
			popover: () => z.value ?? null,
			position: {
				placement: "bottom-end",
				offset: 4
			},
			menu: !0,
			onOpenChange: (e) => B.value = e
		});
		N(B, async (e) => {
			e && (await m(), V.mount());
		}), N(() => s.open, () => V.close(!1)), v(V.cleanup);
		let H = (e) => void X.pause(Ft(e.preset)), te = (e) => {
			let t = e.currentTarget.closest("[data-inbox-panel], [data-inbox-list]");
			X.resume(), (R.value ?? t)?.focus();
		}, ne = () => bs(s.state, s.category), ie = () => Ss(s.items, s.category), oe = (e, t) => void X.load(e, t), U = (e) => {
			let t = ae(e.currentTarget), n = Ws(e.key, s.filter, y.value, t);
			n !== void 0 && s.panel && (e.preventDefault(), oe(n, s.category), document.getElementById(s.panel.tabId(n))?.focus());
		}, se = n(() => ({
			...s.panel && {
				titleId: s.panel.titleId,
				title: s.panel.title,
				close: s.panel.close
			},
			filter: s.filter,
			category: s.category,
			unread: E.value,
			markAllAsRead: ne,
			canArchiveAll: D.value,
			archiveAll: ie,
			allowedActions: s.state.allowedActions,
			canPause: s.state.canPause,
			pausedUntil: s.state.pausedUntil,
			pauseOptions: ee.value,
			pause: H,
			resume: () => void X.resume()
		}));
		return (n, s) => (S(), a(e, null, [
			T(n.$slots, "header", g(d(se.value)), () => [t.panel || y.value.length > 1 || F.value ? (S(), a("div", {
				key: 0,
				class: h(t.panel ? Xi : Zi)
			}, [
				t.panel ? (S(), a("h2", {
					key: 0,
					id: t.panel.titleId,
					class: h(ea)
				}, O(t.panel.title), 11, Xs)) : i("", !0),
				t.href && y.value.length > 1 ? (S(), a("div", {
					key: 1,
					class: h(Qi)
				}, [(S(!0), a(e, null, w(b.value, (e) => (S(), r(A(I), {
					key: e.filter,
					href: t.href(e.filter, t.category),
					"aria-current": e.selected ? "page" : void 0,
					"data-inbox-tab": e.filter,
					class: h(_a)
				}, {
					default: P(() => [T(n.$slots, "tab", p({ ref_for: !0 }, e), () => [c(O(e.label) + " ", 1), e.count !== null && e.count > 0 ? (S(), a("span", {
						key: 0,
						class: h(xa)
					}, O(A(Gt)(e.count, t.maxCount, t.locale)), 3)) : i("", !0)])]),
					_: 2
				}, 1032, [
					"href",
					"aria-current",
					"data-inbox-tab",
					"class"
				]))), 128))], 2)) : i("", !0),
				F.value ? (S(), a("div", {
					key: 2,
					class: h(t.panel ? ta : $i)
				}, [k.value ? (S(), a("button", {
					key: 0,
					type: "button",
					"data-inbox-read-all": "",
					"aria-disabled": E.value === 0 || void 0,
					class: h(na),
					onClick: ne
				}, O(_("markAllAsRead")), 11, Zs)) : i("", !0), M.value ? (S(), a(e, { key: 1 }, [l(Ys, { text: _("moreActions") }, {
					default: P(() => [o("button", {
						ref_key: "menuButton",
						ref: R,
						type: "button",
						"data-inbox-menu-button": "",
						"aria-haspopup": "menu",
						"aria-label": _("moreActions"),
						"aria-expanded": B.value ? "true" : "false",
						"aria-controls": B.value ? A(u) : void 0,
						class: h(A(J)(ro, t.classes.control)),
						onClick: s[0] ||= (...e) => A(V).toggle && A(V).toggle(...e),
						onPointerdown: s[1] ||= (...e) => A(V).onPointerDown && A(V).onPointerDown(...e),
						onKeydown: s[2] ||= (...e) => A(V).onKeydown && A(V).onKeydown(...e),
						onFocusout: s[3] ||= (...e) => A(V).onFocusOut && A(V).onFocusOut(...e)
					}, [l($, {
						name: "more",
						context: L("more-actions"),
						icons: t.icons,
						resolver: t.iconResolver,
						class: "size-4"
					}, null, 8, [
						"context",
						"icons",
						"resolver"
					])], 42, Qs)]),
					_: 1
				}, 8, ["text"]), B.value ? (S(), a("div", {
					key: 0,
					id: A(u),
					ref_key: "menuElement",
					ref: z,
					role: "menu",
					"aria-label": _("moreActions"),
					popover: A(V).native ? "auto" : void 0,
					"data-inbox-menu": "",
					class: h(ra)
				}, [
					D.value ? (S(), a("button", {
						key: 0,
						type: "button",
						role: "menuitem",
						"data-inbox-archive-all": "",
						"aria-disabled": t.items.length === 0 || void 0,
						class: h(ia),
						onClick: ie
					}, [l($, {
						name: "archive",
						context: L("archive-all"),
						icons: t.icons,
						resolver: t.iconResolver,
						class: h(sa)
					}, null, 8, [
						"context",
						"icons",
						"resolver",
						"class"
					]), c(" " + O(_("archiveAll")), 1)], 10, ec)) : i("", !0),
					D.value && t.state.canPause ? (S(), a("div", {
						key: 1,
						role: "separator",
						class: h(ca)
					}, null, 2)) : i("", !0),
					t.state.canPause ? (S(), a("div", {
						key: 2,
						role: "group",
						"aria-labelledby": A(f)
					}, [o("div", {
						id: A(f),
						class: h(oa)
					}, [l($, {
						name: "pause",
						context: L("pause"),
						icons: t.icons,
						resolver: t.iconResolver,
						class: h(sa)
					}, null, 8, [
						"context",
						"icons",
						"resolver",
						"class"
					]), c(" " + O(_("pause")), 1)], 10, nc), (S(!0), a(e, null, w(ee.value, (e) => (S(), a("button", {
						key: e.label,
						type: "button",
						role: "menuitem",
						"data-inbox-pause-option": "",
						class: h(aa),
						onClick: (t) => H(e)
					}, [c(O(e.label) + " ", 1), o("span", { class: h(la) }, O(A(Es)(e, t.now, t.locale)), 3)], 10, rc))), 128))], 8, tc)) : i("", !0)
				], 10, $s)) : i("", !0)], 64)) : i("", !0)], 2)) : i("", !0)
			], 2)) : i("", !0)]),
			o("div", ic, [t.state.pausedUntil === null ? i("", !0) : (S(), a("p", {
				key: 0,
				"data-inbox-paused": "",
				class: h(pa)
			}, [
				l($, {
					name: "paused",
					context: L("paused"),
					icons: t.icons,
					resolver: t.iconResolver,
					class: h(ma)
				}, null, 8, [
					"context",
					"icons",
					"resolver",
					"class"
				]),
				o("span", ac, O(A(Ts)(t.labels, t.state.pausedUntil, t.now, t.locale)), 1),
				o("button", {
					type: "button",
					"data-inbox-resume": "",
					class: h(ha),
					onClick: te
				}, O(_("resume")), 3)
			], 2))]),
			y.value.length > 1 ? (S(), a(e, { key: 0 }, [t.href && n.$slots.header ? (S(), a("div", {
				key: 0,
				class: h(ga)
			}, [(S(!0), a(e, null, w(b.value, (e) => (S(), r(A(I), {
				key: e.filter,
				href: t.href(e.filter, t.category),
				"aria-current": e.selected ? "page" : void 0,
				"data-inbox-tab": e.filter,
				class: h(_a)
			}, {
				default: P(() => [T(n.$slots, "tab", p({ ref_for: !0 }, e), () => [c(O(e.label) + " ", 1), e.count !== null && e.count > 0 ? (S(), a("span", {
					key: 0,
					class: h(xa)
				}, O(A(Gt)(e.count, t.maxCount, t.locale)), 3)) : i("", !0)])]),
				_: 2
			}, 1032, [
				"href",
				"aria-current",
				"data-inbox-tab",
				"class"
			]))), 128))], 2)) : t.panel ? (S(), a("div", {
				key: 1,
				role: "tablist",
				"aria-labelledby": t.panel.titleId,
				class: h(ga),
				onKeydown: U
			}, [(S(!0), a(e, null, w(b.value, (e) => (S(), a("button", {
				id: t.panel.tabId(e.filter),
				key: e.filter,
				type: "button",
				role: "tab",
				"aria-selected": e.selected ? "true" : "false",
				"aria-controls": t.panel.listId,
				tabindex: e.selected ? 0 : -1,
				"data-inbox-tab": e.filter,
				class: h(_a),
				onClick: (n) => oe(e.filter, t.category)
			}, [T(n.$slots, "tab", p({ ref_for: !0 }, e), () => [c(O(e.label) + " ", 1), e.count !== null && e.count > 0 ? (S(), a("span", {
				key: 0,
				class: h(xa)
			}, O(A(Gt)(e.count, t.maxCount, t.locale)), 3)) : i("", !0)])], 10, sc))), 128))], 42, oc)) : i("", !0)], 64)) : i("", !0),
			x.value.length > 0 ? (S(), a("div", {
				key: 1,
				role: "group",
				"aria-label": _("categories"),
				class: h(va)
			}, [(S(!0), a(e, null, w([[null, _("allCategories")], ...x.value], ([n, o]) => (S(), a(e, { key: n ?? "" }, [t.href ? (S(), r(A(I), {
				key: 0,
				href: t.href(t.filter, n),
				"data-inbox-category": n ?? "",
				"aria-current": t.category === n ? "page" : void 0,
				class: h(ya)
			}, {
				default: P(() => [c(O(o) + " ", 1), n !== null && t.state.categoryCounts[n] ? (S(), a("span", {
					key: 0,
					class: h(ba)
				}, O(A(Gt)(t.state.categoryCounts[n], t.maxCount, t.locale)), 3)) : i("", !0)]),
				_: 2
			}, 1032, [
				"href",
				"data-inbox-category",
				"aria-current",
				"class"
			])) : (S(), a("button", {
				key: 1,
				type: "button",
				"data-inbox-category": n ?? "",
				"aria-pressed": t.category === n ? "true" : "false",
				class: h(ya),
				onClick: (e) => oe(t.filter, n)
			}, [c(O(o) + " ", 1), n !== null && t.state.categoryCounts[n] ? (S(), a("span", {
				key: 0,
				class: h(ba)
			}, O(A(Gt)(t.state.categoryCounts[n], t.maxCount, t.locale)), 3)) : i("", !0)], 10, lc))], 64))), 128))], 10, cc)) : i("", !0)
		], 64));
	}
}), dc = [
	"data-read",
	"data-archived",
	"data-selected"
], fc = ["src"], pc = ["checked", "aria-label"], mc = { class: "min-w-0 flex-1" }, hc = {
	key: 0,
	class: "sr-only"
}, gc = {
	key: 1,
	class: "sr-only"
}, _c = ["href"], vc = ["src"], yc = ["src"], bc = ["datetime", "title"], xc = ["id", "aria-label"], Sc = ["onClick"], Cc = ["aria-label"], wc = [
	"aria-label",
	"aria-expanded",
	"aria-controls"
], Tc = ["aria-label"], Ec = ["aria-label"], Dc = ["aria-label"], Oc = /* @__PURE__ */ u({
	__name: "NotificationItem",
	props: {
		item: {},
		now: {},
		labels: { default: () => Jt() },
		icons: { default: () => ({}) },
		iconResolver: {
			type: [Function, null],
			default: void 0
		},
		classes: { default: () => ({}) },
		locale: { default: void 0 },
		pendingAction: { default: void 0 },
		snooze: {
			type: Function,
			default: void 0
		},
		allowedActions: { default: () => [
			"snooze",
			"archive",
			"mute"
		] },
		selected: {
			type: Boolean,
			default: !1
		},
		onSelectedChange: {
			type: Function,
			default: void 0
		}
	},
	setup(t) {
		let s = t, u = (e) => ({
			component: "NotificationItem",
			part: e,
			item: s.item
		}), d = n(() => s.item.readAt === null), f = n(() => s.item.archivedAt !== null), p = n(() => s.item.icon ? He(s.item.icon, u("media"), s.icons, s.iconResolver) : void 0), g = n(() => new Date(s.item.createdAt).toLocaleString(s.locale, {
			dateStyle: "medium",
			timeStyle: "short"
		})), v = n(() => st(s.item, s.now)), y = n(() => Xt(s.labels, s.item)), b = n(() => Yt(s.item)), x = () => d.value ? X.markAsRead(s.item) : X.markAsUnread(s.item), T = () => f.value ? X.unarchive(s.item) : X.archive(s.item), k = () => s.item.muted ? X.unmute(s.item) : X.mute(s.item), M = (e) => s.allowedActions.includes(e), F = (e) => Z(s.labels.itemControl, {
			action: Z(e),
			title: s.item.title
		}), I = n(() => M("snooze")), L = j(), R = C(!1), z = D([]), B = C();
		N(I, (e) => {
			e || (R.value = !1);
		});
		let ee = async () => {
			if (v.value) X.unsnooze(s.item);
			else if (R.value = !R.value, R.value) {
				let e = /* @__PURE__ */ new Date();
				z.value = s.snooze ? s.snooze(e) : Mt(s.labels, e), await m(), B.value?.querySelector("button")?.focus();
			}
		}, V = (e) => {
			R.value = !1, X.snooze(s.item, e);
		};
		return (n, s) => (S(), a("div", {
			"data-read": String(!d.value),
			"data-archived": String(f.value),
			"data-selected": t.onSelectedChange ? String(t.selected) : void 0,
			class: h(A(J)(ka, t.classes.item))
		}, [
			(S(), r(E(t.onSelectedChange ? "label" : "span"), { class: h(A(J)(Aa, t.onSelectedChange && "z-10 cursor-pointer")) }, {
				default: P(() => [
					o("span", {
						"aria-hidden": "true",
						class: h(A(J)(Ma, t.classes.media))
					}, [t.item.actor?.avatar ? (S(), a("img", {
						key: 0,
						src: t.item.actor.avatar,
						alt: "",
						class: "size-full object-cover"
					}, null, 8, fc)) : p.value ? (S(), r(E(p.value), {
						key: 1,
						class: "size-5"
					})) : t.item.actor?.name ? (S(), a(e, { key: 2 }, [c(O(A(Us)(t.item.actor.name)), 1)], 64)) : (S(), r($, {
						key: 3,
						name: t.item.announcement ? "announcement" : "notification",
						context: u("media"),
						icons: t.icons,
						resolver: t.iconResolver,
						class: "size-5"
					}, null, 8, [
						"name",
						"context",
						"icons",
						"resolver"
					]))], 2),
					t.onSelectedChange ? (S(), a("span", {
						key: 0,
						class: h(Xa)
					}, [o("input", {
						type: "checkbox",
						"data-inbox-select": "",
						"aria-keyshortcuts": "X",
						checked: t.selected,
						"aria-label": A(Z)(t.labels.select, { title: t.item.title }),
						class: h(Za),
						onChange: s[0] ||= (e) => t.onSelectedChange(e.target.checked)
					}, null, 42, pc)], 2)) : i("", !0),
					d.value ? (S(), a("span", {
						key: 1,
						"aria-hidden": "true",
						class: h(ja)
					}, null, 2)) : i("", !0)
				]),
				_: 1
			}, 8, ["class"])),
			o("div", mc, [
				o("p", { class: h(A(J)(Na, t.classes.title)) }, [
					d.value ? (S(), a("span", hc, O(A(Z)(t.labels.unreadState)) + ": ", 1)) : i("", !0),
					t.item.announcement ? (S(), a("span", gc, O(A(Z)(t.labels.announcement)) + ": ", 1)) : i("", !0),
					t.item.url ? (S(), a("a", {
						key: 2,
						"data-inbox-link": "",
						href: t.item.url,
						class: h(Pa),
						onClick: s[1] ||= (e) => A(X).open(t.item, e)
					}, O(t.item.title), 11, _c)) : (S(), a(e, { key: 3 }, [c(O(t.item.title), 1)], 64))
				], 2),
				t.item.body ? (S(), a("p", {
					key: 0,
					class: h(A(J)(Fa, t.classes.body))
				}, O(t.item.body), 3)) : i("", !0),
				t.item.image ? (S(), a("img", {
					key: 1,
					src: t.item.image,
					alt: "",
					class: h(Ia)
				}, null, 10, vc)) : i("", !0),
				y.value ? (S(), a("p", {
					key: 2,
					"data-inbox-actors": "",
					class: h(A(J)(Ha, t.classes.actors))
				}, [o("span", {
					"aria-hidden": "true",
					class: h(Ua)
				}, [(S(!0), a(e, null, w(b.value, (t, n) => (S(), a("span", {
					key: n,
					style: _({ zIndex: b.value.length - n }),
					class: h(Wa)
				}, [t.avatar ? (S(), a("img", {
					key: 0,
					src: t.avatar,
					alt: "",
					class: "size-full object-cover"
				}, null, 8, yc)) : t.name ? (S(), a(e, { key: 1 }, [c(O(A(Us)(t.name)), 1)], 64)) : i("", !0)], 6))), 128))], 2), c(" " + O(y.value), 1)], 2)) : i("", !0),
				v.value && t.item.snoozedUntil ? (S(), a("p", {
					key: 3,
					"data-inbox-snoozed-until": "",
					"data-allow-mismatch": "",
					class: h(A(J)(Ra, t.classes.time))
				}, [l($, {
					name: "snooze",
					context: u("snoozed-until"),
					icons: t.icons,
					resolver: t.iconResolver,
					class: "size-3.5"
				}, null, 8, [
					"context",
					"icons",
					"resolver"
				]), c(" " + O(A(Z)(t.labels.snoozedUntil, { time: A(Nt)(t.item.snoozedUntil, t.now, t.locale) })), 1)], 2)) : (S(), a("time", {
					key: 4,
					datetime: t.item.createdAt,
					title: g.value,
					"data-allow-mismatch": "",
					class: h(A(J)(La, t.classes.time))
				}, O(A(Wt)(t.item.createdAt, t.now, t.locale)), 11, bc)),
				t.item.muted ? (S(), a("p", {
					key: 5,
					"data-inbox-muted": "",
					class: h(A(J)(za, t.classes.time))
				}, [l($, {
					name: "mute",
					context: u("muted"),
					icons: t.icons,
					resolver: t.iconResolver,
					class: "size-3.5"
				}, null, 8, [
					"context",
					"icons",
					"resolver"
				]), c(" " + O(A(Z)(t.labels.muted)), 1)], 2)) : i("", !0),
				t.item.result === null ? t.item.actions.length > 0 ? (S(), a("div", {
					key: 7,
					class: h(Va)
				}, [(S(!0), a(e, null, w(t.item.actions, (e, n) => (S(), r(E(A(ye)(e) === void 0 ? "button" : "a"), {
					key: n,
					type: A(ye)(e) === void 0 ? "button" : void 0,
					href: A(ye)(e),
					target: e.newTab ? "_blank" : void 0,
					rel: e.newTab ? "noopener noreferrer" : void 0,
					"aria-disabled": t.pendingAction !== void 0 || void 0,
					"aria-busy": t.pendingAction === n || void 0,
					"data-inbox-action": n,
					class: h(A(J)(n === 0 ? qa : Ja, t.classes.action)),
					onClick: (e) => A(X).runAction(t.item, n, e)
				}, {
					default: P(() => [t.pendingAction === n ? (S(), r($, {
						key: 0,
						name: "spinner",
						context: {
							...u("action"),
							action: e
						},
						icons: t.icons,
						resolver: t.iconResolver,
						class: h(Bi)
					}, null, 8, [
						"context",
						"icons",
						"resolver",
						"class"
					])) : i("", !0), c(" " + O(e.label), 1)]),
					_: 2
				}, 1032, [
					"type",
					"href",
					"target",
					"rel",
					"aria-disabled",
					"aria-busy",
					"data-inbox-action",
					"class",
					"onClick"
				]))), 128))], 2)) : i("", !0) : (S(), a("p", {
					key: 6,
					"data-inbox-result": "",
					class: h(A(J)(Ga, t.classes.result))
				}, [l($, {
					name: "result",
					context: u("result"),
					icons: t.icons,
					resolver: t.iconResolver,
					class: "size-3.5"
				}, null, 8, [
					"context",
					"icons",
					"resolver"
				]), c(" " + O(t.item.result), 1)], 2)),
				R.value && I.value ? (S(), a("div", {
					key: 8,
					id: A(L),
					ref_key: "optionsElement",
					ref: B,
					role: "group",
					"aria-label": A(Z)(t.labels.snoozeUntil),
					"data-inbox-snooze-options": "",
					class: h(Va)
				}, [(S(!0), a(e, null, w(z.value, (e) => (S(), a("button", {
					key: e.label,
					type: "button",
					"data-inbox-snooze-option": "",
					class: h(A(J)(Ja, t.classes.action)),
					onClick: (t) => V(e.until)
				}, [c(O(e.label) + " ", 1), o("span", { class: h(Ba) }, O(A(Nt)(e.until, t.now, t.locale)), 3)], 10, Sc))), 128))], 10, xc)) : i("", !0)
			]),
			o("div", { class: h(Ya) }, [
				l(Ys, {
					text: A(Z)(d.value ? t.labels.markAsRead : t.labels.markAsUnread),
					shortcut: "U"
				}, {
					default: P(() => [o("button", {
						type: "button",
						"data-inbox-toggle-read": "",
						"aria-keyshortcuts": "U",
						"aria-label": F(d.value ? t.labels.markAsRead : t.labels.markAsUnread),
						class: h(A(J)(ro, t.classes.control)),
						onClick: x
					}, [l($, {
						name: d.value ? "read" : "unread",
						context: u("toggle-read"),
						icons: t.icons,
						resolver: t.iconResolver,
						class: "size-4"
					}, null, 8, [
						"name",
						"context",
						"icons",
						"resolver"
					])], 10, Cc)]),
					_: 1
				}, 8, ["text"]),
				I.value && !f.value ? (S(), r(Ys, {
					key: 0,
					text: A(Z)(v.value ? t.labels.unsnooze : t.labels.snooze),
					shortcut: "H"
				}, {
					default: P(() => [o("button", {
						type: "button",
						"data-inbox-snooze": "",
						"aria-keyshortcuts": "H",
						"aria-label": F(v.value ? t.labels.unsnooze : t.labels.snooze),
						"aria-expanded": v.value ? void 0 : R.value ? "true" : "false",
						"aria-controls": v.value || !R.value ? void 0 : A(L),
						class: h(A(J)(ro, t.classes.control)),
						onClick: ee
					}, [l($, {
						name: v.value ? "unsnooze" : "snooze",
						context: u("snooze"),
						icons: t.icons,
						resolver: t.iconResolver,
						class: "size-4"
					}, null, 8, [
						"name",
						"context",
						"icons",
						"resolver"
					])], 10, wc)]),
					_: 1
				}, 8, ["text"])) : i("", !0),
				t.item.group !== null && M("mute") ? (S(), r(Ys, {
					key: 1,
					text: A(Z)(t.item.muted ? t.labels.unmute : t.labels.mute)
				}, {
					default: P(() => [o("button", {
						type: "button",
						"data-inbox-mute": "",
						"aria-label": F(t.item.muted ? t.labels.unmute : t.labels.mute),
						class: h(A(J)(ro, t.classes.control)),
						onClick: k
					}, [l($, {
						name: t.item.muted ? "unmute" : "mute",
						context: u("mute"),
						icons: t.icons,
						resolver: t.iconResolver,
						class: "size-4"
					}, null, 8, [
						"name",
						"context",
						"icons",
						"resolver"
					])], 10, Tc)]),
					_: 1
				}, 8, ["text"])) : i("", !0),
				M("archive") ? (S(), r(Ys, {
					key: 2,
					text: A(Z)(f.value ? t.labels.unarchive : t.labels.archive),
					shortcut: "E"
				}, {
					default: P(() => [o("button", {
						type: "button",
						"data-inbox-toggle-archive": "",
						"aria-keyshortcuts": "E",
						"aria-label": F(f.value ? t.labels.unarchive : t.labels.archive),
						class: h(A(J)(ro, t.classes.control)),
						onClick: T
					}, [l($, {
						name: f.value ? "unarchive" : "archive",
						context: u("archive"),
						icons: t.icons,
						resolver: t.iconResolver,
						class: "size-4"
					}, null, 8, [
						"name",
						"context",
						"icons",
						"resolver"
					])], 10, Ec)]),
					_: 1
				}, 8, ["text"])) : i("", !0),
				M("delete") ? (S(), r(Ys, {
					key: 3,
					text: A(Z)(t.labels.delete)
				}, {
					default: P(() => [o("button", {
						type: "button",
						"data-inbox-delete": "",
						"aria-label": F(t.labels.delete),
						class: h(A(J)(ro, t.classes.control)),
						onClick: s[2] ||= (e) => A(X).delete(t.item)
					}, [l($, {
						name: "delete",
						context: u("delete"),
						icons: t.icons,
						resolver: t.iconResolver,
						class: "size-4"
					}, null, 8, [
						"context",
						"icons",
						"resolver"
					])], 10, Dc)]),
					_: 1
				}, 8, ["text"])) : i("", !0)
			], 2)
		], 10, dc));
	}
}), kc = [
	"data-inbox-id",
	"data-read",
	"data-seen",
	"data-archived",
	"data-announcement"
], Ac = ["aria-expanded", "aria-controls"], jc = ["id"], Mc = [
	"data-inbox-id",
	"data-read",
	"data-seen",
	"data-archived",
	"data-announcement"
], Nc = /* @__PURE__ */ u({
	__name: "ItemGroup",
	props: {
		group: {},
		now: {},
		labels: {},
		icons: {},
		iconResolver: { type: [Function, null] },
		classes: {},
		locale: {},
		pendingActions: {},
		snooze: { type: Function },
		allowedActions: {},
		selected: {},
		select: { type: Function }
	},
	setup(t) {
		let n = t, r = (e) => ({
			item: e,
			now: n.now,
			labels: n.labels,
			icons: n.icons,
			iconResolver: n.iconResolver,
			classes: n.classes,
			locale: n.locale,
			pendingAction: n.pendingActions[e.id],
			snooze: n.snooze,
			allowedActions: n.allowedActions,
			selected: n.selected?.includes(e.id) ?? !1,
			onSelectedChange: n.select ? (t) => n.select(e.id, t) : void 0
		}), s = C(!1), c = j();
		return N(() => n.group.others.length === 0, (e) => {
			e && (s.value = !1);
		}), (t, u) => (S(), a("li", {
			key: n.group.item.id,
			tabindex: "-1",
			"data-inbox-item": "",
			"data-inbox-id": n.group.item.id,
			"data-read": String(n.group.item.readAt !== null),
			"data-seen": String(n.group.item.seenAt !== null),
			"data-archived": String(n.group.item.archivedAt !== null),
			"data-announcement": n.group.item.announcement ? "true" : void 0,
			class: h(Ea)
		}, [T(t.$slots, "item", g(d(r(n.group.item))), () => [l(Oc, g(d(r(n.group.item))), null, 16)]), n.group.others.length > 0 ? (S(), a(e, { key: 0 }, [o("button", {
			type: "button",
			"data-inbox-group-toggle": "",
			"aria-expanded": s.value ? "true" : "false",
			"aria-controls": s.value ? A(c) : void 0,
			class: h(Da),
			onClick: u[0] ||= (e) => s.value = !s.value
		}, O(s.value ? A(Z)(n.labels.showLess) : A(Z)(n.labels.showMore, { count: n.group.others.length })), 11, Ac), s.value ? (S(), a("ul", {
			key: 0,
			id: A(c),
			role: "list",
			class: h(Oa)
		}, [(S(!0), a(e, null, w(n.group.others, (e) => (S(), a("li", {
			key: e.id,
			tabindex: "-1",
			"data-inbox-item": "",
			"data-inbox-id": e.id,
			"data-read": String(e.readAt !== null),
			"data-seen": String(e.seenAt !== null),
			"data-archived": String(e.archivedAt !== null),
			"data-announcement": e.announcement ? "true" : void 0,
			class: h(Ea)
		}, [T(t.$slots, "item", p({ ref_for: !0 }, r(e)), () => [l(Oc, p({ ref_for: !0 }, r(e)), null, 16)])], 10, Mc))), 128))], 10, jc)) : i("", !0)], 64)) : i("", !0)], 10, kc));
	}
}), Pc = ["aria-label"], Fc = [
	"checked",
	"indeterminate",
	"aria-label"
], Ic = { "aria-live": "polite" }, Lc = [
	"data-inbox-batch",
	"aria-label",
	"title",
	"aria-expanded",
	"aria-controls",
	"onClick"
], Rc = ["aria-label", "title"], zc = ["id", "aria-label"], Bc = ["onClick"], Vc = /* @__PURE__ */ u({
	__name: "SelectionBar",
	props: /*@__PURE__*/ f({
		component: {},
		items: {},
		filter: {},
		allowedActions: {},
		now: {},
		labels: {},
		icons: {},
		iconResolver: { type: [Function, null] },
		classes: {},
		locale: {},
		snooze: { type: Function }
	}, {
		selected: { required: !0 },
		selectedModifiers: {}
	}),
	emits: ["update:selected"],
	setup(t) {
		let r = t, s = M(t, "selected"), u = j(), d = (e) => Z(r.labels[e]), f = n(() => r.items.filter((e) => s.value.includes(e.id))), p = n(() => f.value.length === r.items.length), g = n(() => Ds(r.filter, r.allowedActions)), _ = D(null), v = C();
		N(() => f.value.length === 0, (e) => {
			e && (_.value = null);
		});
		let y = (e, t) => {
			let n = f.value;
			s.value = [], X.batch(e, n, t);
		}, b = async () => {
			_.value = _.value ? null : Os(r.snooze, r.labels), _.value && (await m(), v.value?.querySelector("button")?.focus());
		}, x = (e) => {
			_.value = null, y("snooze", e);
		};
		return (n, r) => (S(), a(e, null, [f.value.length > 0 ? (S(), a("div", {
			key: 0,
			role: "group",
			"aria-label": d("selection"),
			"data-inbox-selection": "",
			class: h(Qa)
		}, [o("div", { class: h(eo) }, [o("input", {
			type: "checkbox",
			"data-inbox-select-all": "",
			checked: p.value,
			indeterminate: !p.value,
			"aria-label": d("selectAll"),
			class: h(to),
			onChange: r[0] ||= (e) => s.value = p.value ? [] : t.items.map((e) => e.id)
		}, null, 42, Fc), o("span", Ic, O(A(Z)(t.labels.selected, { count: f.value.length })), 1)], 2), o("div", { class: h(ta) }, [(S(!0), a(e, null, w(g.value, (e) => (S(), a("button", {
			key: e.action,
			type: "button",
			"data-inbox-batch": e.action,
			"aria-label": d(e.label),
			title: d(e.label),
			"aria-expanded": e.action === "snooze" ? _.value ? "true" : "false" : void 0,
			"aria-controls": e.action === "snooze" && _.value ? A(u) : void 0,
			class: h(A(J)(ro, t.classes.control)),
			onClick: (t) => e.action === "snooze" ? b() : y(e.action)
		}, [l($, {
			name: e.icon,
			context: {
				component: t.component,
				part: "selection",
				action: e.action
			},
			icons: t.icons,
			resolver: t.iconResolver,
			class: "size-4"
		}, null, 8, [
			"name",
			"context",
			"icons",
			"resolver"
		])], 10, Lc))), 128)), o("button", {
			type: "button",
			"data-inbox-clear-selection": "",
			"aria-label": d("clearSelection"),
			title: d("clearSelection"),
			class: h(A(J)(ro, t.classes.control)),
			onClick: r[1] ||= (e) => s.value = []
		}, [l($, {
			name: "dismiss",
			context: {
				component: t.component,
				part: "clear-selection"
			},
			icons: t.icons,
			resolver: t.iconResolver,
			class: "size-4"
		}, null, 8, [
			"context",
			"icons",
			"resolver"
		])], 10, Rc)], 2)], 10, Pc)) : i("", !0), _.value ? (S(), a("div", {
			key: 1,
			id: A(u),
			ref_key: "choicesElement",
			ref: v,
			role: "group",
			"aria-label": d("snoozeUntil"),
			"data-inbox-batch-snooze-options": "",
			class: h(no)
		}, [(S(!0), a(e, null, w(_.value, (e) => (S(), a("button", {
			key: e.label,
			type: "button",
			"data-inbox-batch-snooze-option": "",
			class: h(A(J)(Ja, t.classes.action)),
			onClick: (t) => x(e.until)
		}, [c(O(e.label) + " ", 1), o("span", { class: h(Ba) }, O(A(Nt)(e.until, t.now, t.locale)), 3)], 10, Bc))), 128))], 10, zc)) : i("", !0)], 64));
	}
}), Hc = {
	"data-inbox": "",
	class: "inline-flex"
}, Uc = [
	"popovertarget",
	"aria-expanded",
	"aria-controls",
	"aria-label",
	"data-paused"
], Wc = ["id", "aria-labelledby"], Gc = [
	"id",
	"role",
	"aria-labelledby",
	"aria-busy"
], Kc = { class: "sr-only" }, qc = { role: "alert" }, Jc = ["data-inbox-selecting"], Yc = { role: "alert" }, Xc = /* @__PURE__ */ u({
	__name: "NotificationCenter",
	props: /*@__PURE__*/ f({
		labels: { default: () => ({}) },
		badge: { default: "count" },
		count: { default: "unseen" },
		maxCount: { default: 99 },
		href: { default: void 0 },
		icons: { default: () => ({}) },
		iconResolver: {
			type: [Function, null],
			default: void 0
		},
		classes: { default: () => ({}) },
		locale: { default: void 0 },
		group: {
			type: Boolean,
			default: !0
		},
		snooze: {
			type: Function,
			default: void 0
		},
		placement: { default: "bottom-end" }
	}, {
		open: {
			type: Boolean,
			default: !1
		},
		openModifiers: {}
	}),
	emits: /*@__PURE__*/ f(["itemClick", "action"], ["update:open"]),
	setup(t, { emit: u }) {
		let f = t, m = M(t, "open"), _ = u, b = B(), x = j(), E = {
			panel: `${x}-panel`,
			title: `${x}-title`,
			list: `${x}-list`,
			tab: (e) => `${x}-tab-${e}`
		}, k = D(X.getServerSnapshot()), F = C(Date.now()), L = n(() => Jt(f.labels)), z = (e) => Z(L.value[e]), ee = n(() => k.value.counts[f.count]), V = n(() => gs(k.value.filter, L.value)), H = n(() => ms(k.value)), te = D([]), ne = n(() => vs(k.value.items, te.value)), re = n(() => ys(k.value, ne.value.length)), ie = n(() => jt(ne.value, f.group)), ae = C(), oe = C(), U = C(), se = C(), W, ce, le = [], ue, G;
		y(() => {
			$o(), le.push(X.subscribe(() => k.value = X.getSnapshot())), Bt(b.props), k.value = X.getSnapshot(), le.push(Vs(oe.value)), ce = As(se.value, (e) => te.value = e, {
				scroller: se.value,
				listed: (e) => X.getSnapshot().items.some((t) => t.id === e)
			}), le.push(() => ce?.destroy());
			let e = Ns(se.value, () => X.getSnapshot().items);
			le.push(() => e.destroy()), W = Ls(ae.value, oe.value, {
				onToggle(e) {
					m.value = e, ue?.(), ue = void 0, e ? (G = window.location.href, ue = Ut.subscribe(() => F.value = Ut.getSnapshot()), F.value = Ut.getSnapshot(), X.opened(H.value, {
						markAllAsSeen: !1,
						categories: Object.keys(k.value.categoryFilter)
					})) : X.closed({ markAllAsSeen: !1 });
				},
				onEndReached: () => void X.loadMore(),
				placement: () => f.placement
			}), le.push(R.on("navigate", () => window.location.href !== G && W?.close())), K(m.value);
		});
		let K = (e) => {
			let t = oe.value?.matches(":popover-open") ?? !1;
			e && !t ? oe.value?.showPopover() : !e && t && W?.close();
		};
		N(m, K), N([
			k,
			m,
			U
		], () => W?.observe(m.value ? U.value ?? null : null), { flush: "post" }), N(() => f.placement, () => W?.place()), N(() => H.value.join(), () => {
			m.value && H.value.length > 0 && !H.value.includes(k.value.filter) && X.load(H.value[0], k.value.category);
		}), v(() => {
			m.value && X.closed({ markAllAsSeen: !1 }), le.forEach((e) => e()), ue?.(), W?.destroy();
		});
		let q = (e) => Bs(e, oe.value), de = () => W?.close(), fe = n(() => ({
			titleId: E.title,
			title: z("title"),
			tabId: E.tab,
			listId: E.list,
			close: de
		})), pe = D([]), me = n(() => ne.value.some((e) => pe.value.includes(e.id)));
		N(() => `${k.value.filter}|${k.value.category}|${m.value}|${k.value.selectable}`, () => {
			pe.value = [], ce?.release();
		});
		let he = (e, t) => {
			pe.value = ks(pe.value, e, t);
		}, ge = (e) => {
			let t = Ps(e, k.value.items);
			t?.action ? _("action", t.item, t.action, e) : t && _("itemClick", t.item, e);
		};
		return (t, n) => (S(), a("div", Hc, [o("button", {
			ref_key: "trigger",
			ref: ae,
			type: "button",
			popovertarget: E.panel,
			"aria-haspopup": "dialog",
			"aria-expanded": m.value ? "true" : "false",
			"aria-controls": E.panel,
			"aria-label": A(Hs)(L.value, ee.value, f.maxCount, f.locale, k.value.pausedUntil !== null),
			"data-inbox-bell": "",
			"data-paused": k.value.pausedUntil === null ? void 0 : "true",
			class: h(A(J)(Gi, f.classes.bell))
		}, [T(t.$slots, "trigger", {
			open: m.value,
			count: ee.value,
			counts: k.value.counts
		}, () => [l($, {
			name: k.value.pausedUntil === null ? "bell" : "paused",
			context: {
				component: "NotificationCenter",
				part: "bell"
			},
			icons: f.icons,
			resolver: f.iconResolver,
			class: "size-5"
		}, null, 8, [
			"name",
			"icons",
			"resolver"
		]), f.badge !== "none" && ee.value > 0 ? T(t.$slots, "badge", {
			count: ee.value,
			text: A(Gt)(ee.value, f.maxCount, f.locale)
		}, () => [f.badge === "count" ? (S(), a("span", {
			key: 0,
			"data-inbox-badge": "",
			"aria-hidden": "true",
			class: h(A(J)(Ki, f.classes.badge))
		}, O(A(Gt)(ee.value, f.maxCount, f.locale)), 3)) : (S(), a("span", {
			key: 1,
			"data-inbox-badge": "",
			"aria-hidden": "true",
			class: h(A(J)(qi, f.classes.badge))
		}, null, 2))], void 0, 0) : i("", !0)])], 10, Uc), o("div", {
			id: E.panel,
			ref_key: "panel",
			ref: oe,
			popover: "auto",
			role: "dialog",
			"aria-labelledby": E.title,
			tabindex: "-1",
			"data-inbox-panel": "",
			class: h(A(J)(Ji, f.classes.panel)),
			onKeydown: q,
			onClickCapture: ge
		}, [o("div", { class: h(Yi) }, [
			l(uc, {
				component: "NotificationCenter",
				state: k.value,
				filter: k.value.filter,
				category: k.value.category,
				items: k.value.items,
				labels: L.value,
				icons: f.icons,
				"icon-resolver": f.iconResolver,
				classes: f.classes,
				locale: f.locale,
				"max-count": f.maxCount,
				now: F.value,
				panel: fe.value,
				open: m.value
			}, s({ _: 2 }, [t.$slots.header ? {
				name: "header",
				fn: P((e) => [T(t.$slots, "header", g(d(e)))]),
				key: "0"
			} : void 0, t.$slots.tab ? {
				name: "tab",
				fn: P((e) => [T(t.$slots, "tab", g(d(e)))]),
				key: "1"
			} : void 0]), 1032, [
				"state",
				"filter",
				"category",
				"items",
				"labels",
				"icons",
				"icon-resolver",
				"classes",
				"locale",
				"max-count",
				"now",
				"panel",
				"open"
			]),
			o("div", {
				id: E.list,
				ref_key: "scroller",
				ref: se,
				"data-inbox-scroller": "",
				role: H.value.length > 1 ? "tabpanel" : void 0,
				"aria-labelledby": H.value.length > 1 ? E.tab(k.value.filter) : void 0,
				"aria-busy": k.value.status === "loading" || k.value.loadingMore || void 0,
				class: h(Sa)
			}, [o("div", {
				"aria-live": "polite",
				class: h(Ca)
			}, [te.value.length > 0 ? (S(), a("button", {
				key: 0,
				type: "button",
				"data-inbox-show-new": "",
				class: h(wa),
				onClick: n[0] ||= (e) => A(ce)?.reveal()
			}, O(A(Z)(L.value.showNew, { count: te.value.length })), 3)) : i("", !0)], 2), re.value === "loading" ? (S(), a("div", {
				key: 0,
				role: "status",
				class: h(io)
			}, [T(t.$slots, "loading", {}, () => [l($, {
				name: "spinner",
				context: {
					component: "NotificationCenter",
					part: "loading"
				},
				icons: f.icons,
				resolver: f.iconResolver,
				class: h([ao, "motion-safe:animate-spin"])
			}, null, 8, [
				"icons",
				"resolver",
				"class"
			]), o("span", Kc, O(z("loading")), 1)])], 2)) : re.value === "error" ? (S(), a("div", {
				key: 1,
				"data-inbox-error": "",
				class: h(io)
			}, [T(t.$slots, "error", {
				more: !1,
				retry: () => void A(X).load()
			}, () => [o("p", qc, O(z("error")), 1), o("button", {
				type: "button",
				"data-inbox-retry": "",
				class: h(Ja),
				onClick: n[1] ||= (e) => A(X).load()
			}, O(z("retry")), 3)])], 2)) : re.value === "empty" ? (S(), a("div", {
				key: 2,
				"data-inbox-empty": "",
				class: h(io)
			}, [T(t.$slots, "empty", { filter: k.value.filter }, () => [l($, {
				name: "empty",
				context: {
					component: "NotificationCenter",
					part: "empty",
					filter: k.value.filter
				},
				icons: f.icons,
				resolver: f.iconResolver,
				class: h(ao)
			}, null, 8, [
				"context",
				"icons",
				"resolver",
				"class"
			]), o("p", null, O(V.value), 1)])], 2)) : (S(), a(e, { key: 3 }, [o("ul", {
				role: "list",
				"data-inbox-selecting": me.value || void 0,
				class: h(A(J)(Ta, f.classes.list))
			}, [(S(!0), a(e, null, w(ie.value, (e) => (S(), r(Nc, {
				key: e.key,
				group: e,
				now: F.value,
				labels: L.value,
				icons: f.icons,
				"icon-resolver": f.iconResolver,
				classes: f.classes,
				locale: f.locale,
				"pending-actions": k.value.pendingActions,
				snooze: f.snooze,
				"allowed-actions": k.value.allowedActions,
				selected: k.value.selectable ? pe.value : void 0,
				select: k.value.selectable ? he : void 0
			}, s({ _: 2 }, [t.$slots.item ? {
				name: "item",
				fn: P((e) => [T(t.$slots, "item", p({ ref_for: !0 }, e))]),
				key: "0"
			} : void 0]), 1032, [
				"group",
				"now",
				"labels",
				"icons",
				"icon-resolver",
				"classes",
				"locale",
				"pending-actions",
				"snooze",
				"allowed-actions",
				"selected",
				"select"
			]))), 128))], 10, Jc), k.value.hasMore && k.value.moreFailed ? (S(), a("div", {
				key: 0,
				"data-inbox-more-failed": "",
				class: h(io)
			}, [T(t.$slots, "error", {
				more: !0,
				retry: () => void A(X).loadMore({ retry: !0 })
			}, () => [o("p", Yc, O(z("error")), 1), o("button", {
				type: "button",
				"data-inbox-retry": "",
				class: h(Ja),
				onClick: n[2] ||= (e) => A(X).loadMore({ retry: !0 })
			}, O(z("retry")), 3)])], 2)) : k.value.hasMore ? (S(), a("div", {
				key: 1,
				ref_key: "sentinel",
				ref: U,
				"aria-hidden": "true",
				class: h(oo)
			}, [k.value.loadingMore ? (S(), r($, {
				key: 0,
				name: "spinner",
				context: {
					component: "NotificationCenter",
					part: "loading-more"
				},
				icons: f.icons,
				resolver: f.iconResolver,
				class: h(Mi)
			}, null, 8, [
				"icons",
				"resolver",
				"class"
			])) : i("", !0)], 2)) : i("", !0)], 64))], 10, Gc),
			l(Vc, {
				selected: pe.value,
				"onUpdate:selected": n[3] ||= (e) => pe.value = e,
				component: "NotificationCenter",
				items: ne.value,
				filter: k.value.filter,
				"allowed-actions": k.value.allowedActions,
				now: F.value,
				labels: L.value,
				icons: f.icons,
				"icon-resolver": f.iconResolver,
				classes: f.classes,
				locale: f.locale,
				snooze: f.snooze
			}, null, 8, [
				"selected",
				"items",
				"filter",
				"allowed-actions",
				"now",
				"labels",
				"icons",
				"icon-resolver",
				"classes",
				"locale",
				"snooze"
			]),
			t.$slots.footer || f.href ? T(t.$slots, "footer", {
				href: f.href,
				close: de
			}, () => [l(A(I), {
				href: f.href,
				"data-inbox-view-all": "",
				class: h(qo)
			}, {
				default: P(() => [c(O(z("viewAll")), 1)]),
				_: 1
			}, 8, ["href", "class"])], void 0, 0) : i("", !0)
		], 2)], 42, Wc)]));
	}
}), Zc = { class: "sr-only" }, Qc = ["aria-busy", "onClick"], $c = /* @__PURE__ */ u({
	__name: "NotificationList",
	props: {
		data: {},
		filter: { default: void 0 },
		labels: { default: () => ({}) },
		icons: { default: () => ({}) },
		iconResolver: {
			type: [Function, null],
			default: void 0
		},
		classes: { default: () => ({}) },
		locale: { default: void 0 },
		buffer: { default: 250 },
		manual: {
			type: Boolean,
			default: !1
		},
		preserveUrl: {
			type: Boolean,
			default: !1
		},
		category: { default: void 0 },
		group: {
			type: Boolean,
			default: !0
		},
		snooze: {
			type: Function,
			default: void 0
		},
		maxCount: { default: 99 }
	},
	emits: ["itemClick", "action"],
	setup(t, { emit: c }) {
		let u = t, f = c, m = B(), _ = D(X.getServerSnapshot()), b = C(Date.now()), x = n(() => Jt(u.labels)), E = n(() => ws(m.url, _.value, u.filter, u.category)), k = n(() => gs(E.value.filter, x.value)), j = C(), M = n(() => {
			let e = m.props[u.data];
			return Array.isArray(e?.data) ? e.data.map(pt).filter((e) => e !== void 0) : [];
		}), I = () => At(X, M.value, E.value.filter, E.value.category), L = D([]), R = n(() => (_.value, vs(I(), L.value))), z = n(() => jt(R.value, u.group)), ee = n(() => !!m.scrollProps?.[u.data]?.nextPage), V = (e, t) => Cs(m.url, e, t, m.scrollProps?.[u.data]?.pageName), H = D([]), te = n(() => R.value.some((e) => H.value.includes(e.id))), ne = (e, t) => {
			H.value = ks(H.value, e, t);
		}, re, ie = [];
		N(() => `${E.value.filter}|${E.value.category}|${_.value.selectable}`, () => {
			H.value = [], re?.release();
		});
		let ae = (e) => {
			let t = Ps(e, R.value);
			t?.action ? f("action", t.item, t.action, e) : t && f("itemClick", t.item, e);
		};
		return y(() => {
			$o(), ie.push(X.subscribe(() => _.value = X.getSnapshot())), ie.push(Ut.subscribe(() => b.value = Ut.getSnapshot())), Bt(m.props), X.remember(M.value), ie.push(N(M, (e) => X.remember(e))), _.value = X.getSnapshot(), b.value = Ut.getSnapshot(), ie.push(Vs(j.value)), re = As(j.value, (e) => L.value = e, { listed: (e) => I().some((t) => t.id === e) }), ie.push(() => re?.destroy());
			let e = Ns(j.value, () => R.value, null);
			ie.push(() => e.destroy());
		}), v(() => ie.forEach((e) => e())), (t, n) => (S(), a("div", {
			ref_key: "root",
			ref: j,
			"data-inbox-list": "",
			tabindex: "-1",
			onKeydown: n[2] ||= (e) => A(Bs)(e, j.value),
			onClickCapture: ae
		}, [
			l(uc, {
				component: "NotificationList",
				state: _.value,
				filter: E.value.filter,
				category: E.value.category,
				items: R.value,
				labels: x.value,
				icons: u.icons,
				"icon-resolver": u.iconResolver,
				classes: u.classes,
				locale: u.locale,
				"max-count": u.maxCount,
				now: b.value,
				href: V
			}, s({ _: 2 }, [t.$slots.header ? {
				name: "header",
				fn: P((e) => [T(t.$slots, "header", g(d(e)))]),
				key: "0"
			} : void 0, t.$slots.tab ? {
				name: "tab",
				fn: P((e) => [T(t.$slots, "tab", g(d(e)))]),
				key: "1"
			} : void 0]), 1032, [
				"state",
				"filter",
				"category",
				"items",
				"labels",
				"icons",
				"icon-resolver",
				"classes",
				"locale",
				"max-count",
				"now"
			]),
			o("div", {
				"aria-live": "polite",
				class: h(Ca)
			}, [L.value.length > 0 ? (S(), a("button", {
				key: 0,
				type: "button",
				"data-inbox-show-new": "",
				class: h(wa),
				onClick: n[0] ||= (e) => A(re)?.reveal()
			}, O(A(Z)(x.value.showNew, { count: L.value.length })), 3)) : i("", !0)], 2),
			l(A(F), {
				data: u.data,
				buffer: u.buffer,
				manual: u.manual,
				"preserve-url": u.preserveUrl,
				as: "ul",
				role: "list",
				hidden: R.value.length === 0 || void 0,
				"data-inbox-selecting": te.value || void 0,
				class: h(A(J)(Ta, u.classes.list))
			}, s({
				loading: P(() => [o("div", {
					role: "status",
					class: h(oo)
				}, [l($, {
					name: "spinner",
					context: {
						component: "NotificationList",
						part: "loading-more"
					},
					icons: u.icons,
					resolver: u.iconResolver,
					class: h(Mi)
				}, null, 8, [
					"icons",
					"resolver",
					"class"
				]), o("span", Zc, O(A(Z)(x.value.loading)), 1)], 2)]),
				default: P(() => [(S(!0), a(e, null, w(z.value, (e) => (S(), r(Nc, {
					key: e.key,
					group: e,
					now: b.value,
					labels: x.value,
					icons: u.icons,
					"icon-resolver": u.iconResolver,
					classes: u.classes,
					locale: u.locale,
					"pending-actions": _.value.pendingActions,
					snooze: u.snooze,
					"allowed-actions": _.value.allowedActions,
					selected: _.value.selectable ? H.value : void 0,
					select: _.value.selectable ? ne : void 0
				}, s({ _: 2 }, [t.$slots.item ? {
					name: "item",
					fn: P((e) => [T(t.$slots, "item", p({ ref_for: !0 }, e))]),
					key: "0"
				} : void 0]), 1032, [
					"group",
					"now",
					"labels",
					"icons",
					"icon-resolver",
					"classes",
					"locale",
					"pending-actions",
					"snooze",
					"allowed-actions",
					"selected",
					"select"
				]))), 128))]),
				_: 2
			}, [u.manual ? {
				name: "next",
				fn: P(({ fetch: e, hasMore: t, loading: n }) => [t ? (S(), a("div", {
					key: 0,
					class: h(oo)
				}, [o("button", {
					type: "button",
					"data-inbox-load-more": "",
					"aria-busy": n || void 0,
					class: h(Ja),
					onClick: e
				}, O(A(Z)(x.value.loadMore)), 11, Qc)], 2)) : i("", !0)]),
				key: "0"
			} : void 0]), 1032, [
				"data",
				"buffer",
				"manual",
				"preserve-url",
				"hidden",
				"data-inbox-selecting",
				"class"
			]),
			R.value.length === 0 && !ee.value ? (S(), a("div", {
				key: 0,
				"data-inbox-empty": "",
				class: h(io)
			}, [T(t.$slots, "empty", { filter: E.value.filter }, () => [l($, {
				name: "empty",
				context: {
					component: "NotificationList",
					part: "empty",
					filter: E.value.filter
				},
				icons: u.icons,
				resolver: u.iconResolver,
				class: h(ao)
			}, null, 8, [
				"context",
				"icons",
				"resolver",
				"class"
			]), o("p", null, O(k.value), 1)])], 2)) : i("", !0),
			te.value ? (S(), a("div", {
				key: 1,
				class: h($a)
			}, [l(Vc, {
				selected: H.value,
				"onUpdate:selected": n[1] ||= (e) => H.value = e,
				component: "NotificationList",
				items: R.value,
				filter: E.value.filter,
				"allowed-actions": _.value.allowedActions,
				now: b.value,
				labels: x.value,
				icons: u.icons,
				"icon-resolver": u.iconResolver,
				classes: u.classes,
				locale: u.locale,
				snooze: u.snooze
			}, null, 8, [
				"selected",
				"items",
				"filter",
				"allowed-actions",
				"now",
				"labels",
				"icons",
				"icon-resolver",
				"classes",
				"locale",
				"snooze"
			])], 2)) : i("", !0)
		], 544));
	}
});
// src/usePreferences.ts
function el() {
	let e = B(), t = D(_n), r, i = () => Qn.load(X.getSnapshot().url);
	y(() => {
		$o(), r = Qn.subscribe(() => t.value = Qn.getSnapshot()), Bt(e.props), t.value = Qn.getSnapshot(), i();
	}), v(() => r?.());
	let a = (e) => n(() => t.value[e]);
	return {
		status: a("status"),
		channels: a("channels"),
		groups: a("groups"),
		categories: a("categories"),
		notificationHours: a("notificationHours"),
		frequencies: a("frequencies"),
		sections: n(() => Tn(t.value)),
		load: i,
		set: Qn.set,
		setChannel: Qn.setChannel,
		setFrequency: Qn.setFrequency,
		setNotificationHours: Qn.setNotificationHours,
		receives: (e, n) => On(e, n, t.value.channels),
		frequencyApplies: An,
		isDisabled: (e, n) => kn(e, n, t.value.channels)
	};
}
// src/usePush.ts
function tl() {
	let e = B(), t = D(tr), r;
	y(() => {
		$o(), r = _r.subscribe(() => t.value = _r.getSnapshot()), Bt(e.props), t.value = _r.getSnapshot();
	}), v(() => r?.());
	let i = (e) => n(() => t.value[e]);
	return {
		available: i("available"),
		supported: i("supported"),
		permission: i("permission"),
		subscribed: i("subscribed"),
		busy: i("busy"),
		reason: i("reason"),
		request: i("request"),
		devices: i("devices"),
		deviceState: n(() => nr(t.value)),
		subscribe: _r.enable,
		unsubscribe: _r.disable,
		loadDevices: _r.loadDevices,
		removeDevice: _r.removeDevice
	};
}
// src/NotificationPreferences.vue?vue&type=script&setup=true&lang.ts
var nl = { "data-inbox-preferences": "" }, rl = { class: "sr-only" }, il = { class: "sr-only" }, al = {
	key: 0,
	"data-inbox-preferences-global": ""
}, ol = [
	"aria-checked",
	"aria-label",
	"data-inbox-preference-channel",
	"onClick"
], sl = { key: 0 }, cl = ["data-inbox-preference-group"], ll = ["colspan"], ul = ["data-inbox-preference-category"], dl = [
	"aria-checked",
	"aria-disabled",
	"aria-label",
	"data-inbox-preference",
	"onClick"
], fl = [
	"value",
	"disabled",
	"aria-label",
	"data-inbox-preference-frequency",
	"onChange"
], pl = ["value"], ml = ["data-state", "aria-busy"], hl = {
	"aria-live": "polite",
	"data-inbox-push-device-status": ""
}, gl = ["aria-disabled"], _l = ["id"], vl = ["aria-labelledby"], yl = ["aria-label", "onClick"], bl = ["aria-checked", "aria-label"], xl = ["aria-label", "data-inbox-notification-hours-day"], Sl = [
	"aria-checked",
	"aria-disabled",
	"aria-label",
	"onClick"
], Cl = { class: "sr-only" }, wl = [
	"value",
	"disabled",
	"onChange"
], Tl = { class: "sr-only" }, El = [
	"value",
	"disabled",
	"onChange"
], Dl = [
	"disabled",
	"aria-label",
	"onClick"
], Ol = [
	"disabled",
	"aria-label",
	"onClick"
], kl = /* @__PURE__ */ u({
	__name: "NotificationPreferences",
	props: {
		labels: { default: () => ({}) },
		classes: { default: () => ({}) },
		locale: { default: void 0 }
	},
	setup(t) {
		let s = t, { status: u, channels: d, categories: f, sections: p, notificationHours: m, frequencies: g, load: _, setChannel: b, setFrequency: x, setNotificationHours: C, receives: E, frequencyApplies: k, isDisabled: M } = el(), P = tl(), F = n(() => Zn(s.labels)), I = n(() => $n(d.value, f.value, g.value, F.value)), L = (e) => Z(F.value[e]), R = n(() => d.value.some((e) => e.push) ? rr({
			available: P.available.value,
			supported: P.supported.value,
			permission: P.permission.value,
			subscribed: P.subscribed.value,
			busy: P.busy.value,
			reason: P.reason.value,
			request: P.request.value
		}) : null), z = D(0), B = n(() => vr(P.devices.value, F.value, z.value, s.locale)), ee = j(), V;
		y(() => {
			V = Ut.subscribe(() => z.value = Ut.getSnapshot()), z.value = Ut.getSnapshot();
		}), v(() => V?.()), N(() => R.value !== null, (e) => {
			e && P.loadDevices();
		}, { immediate: !0 });
		let H = (e, t) => {
			x(e.key, t.target.value);
		}, te = D(null), ne = n(() => Bn(m.value, te.value, s.locale)), re = (e) => {
			e.currentTarget.contains(e.relatedTarget) || (te.value = null);
		}, ie = (e) => {
			let t = Vn(m.value, te.value, e);
			t && (te.value = t.editing(te.value), C({ days: { [e.day]: t.ranges } }));
		}, ae = (e, t, n, r) => ie({
			kind: "time",
			day: e,
			index: t,
			field: n,
			time: r.target.value
		});
		return (t, n) => (S(), a("div", nl, [
			A(u) === "error" ? (S(), a("div", {
				key: 0,
				"data-inbox-preferences-error": "",
				class: h(io)
			}, [o("p", null, O(L("error")), 1), o("button", {
				type: "button",
				class: h(Ja),
				onClick: n[0] ||= (...e) => A(_) && A(_)(...e)
			}, O(L("retry")), 3)], 2)) : A(u) !== "ready" && A(f).length === 0 ? (S(), a("div", {
				key: 1,
				role: "status",
				class: h(io)
			}, [l($, {
				name: "spinner",
				context: {
					component: "NotificationPreferences",
					part: "loading"
				},
				class: h(Mi)
			}, null, 8, ["class"]), o("span", rl, O(L("loading")), 1)], 2)) : A(f).length === 0 ? (S(), a("div", {
				key: 2,
				"data-inbox-preferences-empty": "",
				class: h(io)
			}, [T(t.$slots, "empty", {}, () => [o("p", null, O(L("empty")), 1)])], 2)) : (S(), a("div", {
				key: 3,
				class: h(so)
			}, [o("table", { class: h(A(J)(co, s.classes.table)) }, [
				o("caption", il, O(L("title")), 1),
				o("thead", null, [o("tr", null, [
					o("th", {
						scope: "col",
						class: h(A(J)(lo, s.classes.head))
					}, O(L("category")), 3),
					(S(!0), a(e, null, w(A(d), (e) => (S(), a("th", {
						key: e.key,
						scope: "col",
						class: h(A(J)(uo, s.classes.head))
					}, [T(t.$slots, "channel", { channel: e }, () => [c(O(e.label), 1)])], 2))), 128)),
					I.value.hasFrequencies ? (S(), a("th", {
						key: 0,
						scope: "col",
						class: h(A(J)(xo, s.classes.head))
					}, O(L("frequency")), 3)) : i("", !0)
				])]),
				I.value.hasGlobalSwitches ? (S(), a("tbody", al, [o("tr", { class: h(A(J)(fo, s.classes.row)) }, [
					o("th", {
						scope: "row",
						class: h(ho)
					}, [o("span", { class: h(A(J)(go, s.classes.label)) }, O(L("global")), 3), o("span", { class: h(A(J)(yo, s.classes.description)) }, O(L("globalDescription")), 3)], 2),
					(S(!0), a(e, null, w(A(d), (e) => (S(), a("td", {
						key: e.key,
						class: h(bo)
					}, [e.globalSwitch ? (S(), a("button", {
						key: 0,
						type: "button",
						role: "switch",
						"aria-checked": e.enabled ? "true" : "false",
						"aria-label": A(Z)(F.value.toggle, {
							category: L("global"),
							channel: e.label
						}),
						"data-inbox-preference-channel": e.key,
						class: h(A(J)(Go, s.classes.switch)),
						onClick: (t) => A(b)(e.key, !e.enabled)
					}, [o("span", {
						"aria-hidden": "true",
						class: h(Ko)
					}, null, 2)], 10, ol)) : i("", !0)], 2))), 128)),
					I.value.hasFrequencies ? (S(), a("td", sl)) : i("", !0)
				], 2)])) : i("", !0),
				(S(!0), a(e, null, w(A(p), (n) => (S(), a("tbody", {
					key: n.group?.key ?? "",
					"data-inbox-preference-group": n.group?.key
				}, [n.group ? (S(), a("tr", {
					key: 0,
					class: h(fo)
				}, [o("th", {
					scope: "rowgroup",
					colspan: I.value.columns,
					class: h(A(J)(po, s.classes.group))
				}, [T(t.$slots, "group", { group: n.group }, () => [o("span", { class: h(mo) }, O(n.group.label), 3), n.group.description ? (S(), a("span", {
					key: 0,
					class: h(A(J)(yo, s.classes.description))
				}, O(n.group.description), 3)) : i("", !0)])], 10, ll)], 2)) : i("", !0), (S(!0), a(e, null, w(n.categories, (n) => (S(), a("tr", {
					key: n.key,
					"data-inbox-preference-category": n.key,
					class: h(A(J)(fo, s.classes.row))
				}, [
					o("th", {
						scope: "row",
						class: h(ho)
					}, [T(t.$slots, "category", { category: n }, () => [
						o("span", { class: h(A(J)(_o, s.classes.label)) }, O(n.label), 3),
						n.locked ? (S(), a("span", {
							key: 0,
							class: h(A(J)(vo, s.classes.badge))
						}, O(L("locked")), 3)) : i("", !0),
						n.description ? (S(), a("span", {
							key: 1,
							class: h(A(J)(yo, s.classes.description))
						}, O(n.description), 3)) : i("", !0)
					])], 2),
					(S(!0), a(e, null, w(A(d), (e) => (S(), a("td", {
						key: e.key,
						class: h(bo)
					}, [n.channels[e.key] === void 0 ? i("", !0) : (S(), a("button", {
						key: 0,
						type: "button",
						role: "switch",
						"aria-checked": A(E)(n, e) ? "true" : "false",
						"aria-disabled": A(M)(n, e) || void 0,
						"aria-label": A(Z)(F.value.toggle, {
							category: n.label,
							channel: e.label
						}),
						"data-inbox-preference": `${n.key}.${e.key}`,
						class: h(A(J)(Go, s.classes.switch)),
						onClick: (t) => A(er)(n, e, A(d))
					}, [o("span", {
						"aria-hidden": "true",
						class: h(Ko)
					}, null, 2)], 10, dl))], 2))), 128)),
					I.value.hasFrequencies ? (S(), a("td", {
						key: 0,
						class: h(So)
					}, [n.frequency === null ? i("", !0) : (S(), a("select", {
						key: 0,
						value: n.frequency,
						disabled: !A(k)(n, A(d)),
						"aria-label": A(Z)(F.value.frequencyLabel, { category: n.label }),
						"data-inbox-preference-frequency": n.key,
						class: h(A(J)(Wo, s.classes.select)),
						onChange: (e) => H(n, e)
					}, [(S(!0), a(e, null, w(I.value.frequencyOptions, (e) => (S(), a("option", {
						key: e.value,
						value: e.value
					}, O(e.label), 9, pl))), 128))], 42, fl))], 2)) : i("", !0)
				], 10, ul))), 128))], 8, cl))), 128))
			], 2)], 2)),
			R.value !== null && A(u) !== "error" && A(f).length > 0 ? (S(), a("div", {
				key: 4,
				"data-inbox-push-device": "",
				"data-state": R.value.state,
				"aria-busy": R.value.state === "busy" ? "true" : void 0,
				class: h(Co)
			}, [o("div", { class: h(To) }, [o("div", { class: h(Eo) }, [o("span", { class: h(A(J)(go, s.classes.label)) }, O(L("pushDevice")), 3), o("div", hl, [R.value.hint ? (S(), a("p", {
				key: 0,
				class: h(A(J)(Do, s.classes.description))
			}, O(L(R.value.text)), 3)) : (S(), a("span", {
				key: 1,
				class: h(A(J)(yo, s.classes.description))
			}, O(L(R.value.text)), 3))])], 2), R.value.button ? (S(), a("button", {
				key: 0,
				type: "button",
				"aria-disabled": R.value.state === "busy" || void 0,
				"data-inbox-push-device-button": "",
				class: h(A(J)(R.value.button.primary ? qa : Ja, Oo)),
				onClick: n[1] ||= (e) => A(yr)(R.value)
			}, [R.value.state === "busy" ? (S(), r($, {
				key: 0,
				name: "spinner",
				context: {
					component: "NotificationPreferences",
					part: "push-busy"
				},
				class: h(Bi)
			}, null, 8, ["class"])) : i("", !0), c(" " + O(L(R.value.button.label)), 1)], 10, gl)) : i("", !0)], 2), B.value.length > 0 ? (S(), a("div", {
				key: 0,
				"data-inbox-push-other-devices": "",
				class: h(ko)
			}, [o("p", {
				id: A(ee),
				class: h(Ao)
			}, O(L("pushDevices")), 11, _l), o("ul", {
				"aria-labelledby": A(ee),
				class: h(jo)
			}, [(S(!0), a(e, null, w(B.value, (e) => (S(), a("li", {
				key: e.id,
				"data-inbox-push-other-device": "",
				class: h(Mo)
			}, [o("div", { class: h(wo) }, [o("span", { class: h(A(J)(go, s.classes.label)) }, O(e.name), 3), o("span", { class: h(A(J)(yo, s.classes.description)) }, O(e.active), 3)], 2), o("button", {
				type: "button",
				"aria-label": e.removeLabel,
				"data-inbox-push-other-device-remove": "",
				class: h(A(J)(Ja, Oo)),
				onClick: (t) => A(P).removeDevice(e.id)
			}, O(L("pushDeviceRemove")), 11, yl)], 2))), 128))], 10, vl)], 2)) : i("", !0)], 10, ml)) : i("", !0),
			A(m) !== null && A(u) !== "error" && A(f).length > 0 ? (S(), a("div", {
				key: 5,
				"data-inbox-preferences-notification-hours": "",
				class: h(No)
			}, [o("div", { class: h(Po) }, [o("button", {
				type: "button",
				role: "switch",
				"aria-checked": A(m).enabled ? "true" : "false",
				"aria-label": L("notificationHours"),
				"data-inbox-notification-hours": "",
				class: h(A(J)(Go, s.classes.switch)),
				onClick: n[2] ||= (e) => A(C)({ enabled: !A(m).enabled })
			}, [o("span", {
				"aria-hidden": "true",
				class: h(Ko)
			}, null, 2)], 10, bl), o("div", null, [o("span", { class: h(A(J)(go, s.classes.label)) }, O(L("notificationHours")), 3), o("span", { class: h(A(J)(yo, s.classes.description)) }, O(L("notificationHoursDescription")), 3)])], 2), o("div", { class: h(Fo) }, [(S(!0), a(e, null, w(ne.value, (t) => (S(), a("div", {
				key: t.day,
				role: "group",
				"aria-label": t.name,
				"data-inbox-notification-hours-day": t.day,
				class: h(Io),
				onFocusout: re
			}, [o("div", { class: h(Lo) }, [o("button", {
				type: "button",
				role: "switch",
				"aria-checked": t.ranges.length > 0 ? "true" : "false",
				"aria-disabled": t.locked || void 0,
				"aria-label": A(Z)(F.value.notificationHoursDay, { day: t.name }),
				"data-inbox-notification-hours-day-switch": "",
				class: h(A(J)(Go, s.classes.switch)),
				onClick: (e) => ie({
					kind: "toggle",
					day: t.day
				})
			}, [o("span", {
				"aria-hidden": "true",
				class: h(Ko)
			}, null, 2)], 10, Sl), o("span", null, O(t.name), 1)], 2), t.ranges.length > 0 ? (S(), a("div", {
				key: 0,
				class: h(Ro)
			}, [(S(!0), a(e, null, w(t.ranges, ([e, n], r) => (S(), a("div", {
				key: r,
				class: h(zo)
			}, [
				o("label", { class: h(Ho) }, [o("span", Cl, O(L("notificationHoursStart")), 1), o("input", {
					type: "time",
					required: "",
					value: e,
					disabled: !A(m).enabled,
					"data-inbox-notification-hours-start": "",
					class: h(A(J)(Uo, s.classes.time)),
					onChange: (e) => ae(t.day, r, "start", e)
				}, null, 42, wl)], 2),
				o("span", {
					"aria-hidden": "true",
					class: h(Ho)
				}, "–", 2),
				o("label", { class: h(Ho) }, [o("span", Tl, O(L("notificationHoursEnd")), 1), o("input", {
					type: "time",
					required: "",
					value: n,
					disabled: !A(m).enabled,
					"data-inbox-notification-hours-end": "",
					class: h(A(J)(Uo, s.classes.time)),
					onChange: (e) => ae(t.day, r, "end", e)
				}, null, 42, El)], 2),
				t.ranges.length > 1 ? (S(), a("button", {
					key: 0,
					type: "button",
					disabled: !A(m).enabled,
					"aria-label": A(Z)(F.value.notificationHoursRemoveLabel, {
						start: e,
						end: n,
						day: t.name
					}),
					"data-inbox-notification-hours-remove": "",
					class: h(Vo),
					onClick: (e) => ie({
						kind: "remove",
						day: t.day,
						index: r
					})
				}, O(L("notificationHoursRemove")), 11, Dl)) : i("", !0),
				r === t.ranges.length - 1 ? (S(), a("button", {
					key: 1,
					type: "button",
					disabled: !t.canAdd,
					"aria-label": A(Z)(F.value.notificationHoursAddLabel, { day: t.name }),
					"data-inbox-notification-hours-add": "",
					class: h(Vo),
					onClick: (e) => ie({
						kind: "add",
						day: t.day
					})
				}, O(L("notificationHoursAdd")), 11, Ol)) : i("", !0)
			], 2))), 128))], 2)) : (S(), a("p", {
				key: 1,
				class: h(Bo)
			}, O(L("notificationHoursOff")), 3))], 42, xl))), 128))], 2)], 2)) : i("", !0)
		]));
	}
});
// src/useNotifications.ts
function Al() {
	let e = B(), t = D(X.getServerSnapshot()), r;
	y(() => {
		$o(), r = X.subscribe(() => t.value = X.getSnapshot()), Bt(e.props), t.value = X.getSnapshot();
	}), v(() => r?.());
	let i = (e) => n(() => t.value[e]);
	return {
		url: i("url"),
		user: i("user"),
		channel: i("channel"),
		announcementsChannel: i("announcementsChannel"),
		allowedActions: i("allowedActions"),
		selectable: i("selectable"),
		categoryFilter: i("categoryFilter"),
		tabs: i("tabs"),
		counts: i("counts"),
		items: i("items"),
		arrived: i("arrived"),
		filter: i("filter"),
		category: i("category"),
		categoryCounts: i("categoryCounts"),
		status: i("status"),
		loadingMore: i("loadingMore"),
		moreFailed: i("moreFailed"),
		hasMore: i("hasMore"),
		pendingActions: i("pendingActions"),
		pausedUntil: i("pausedUntil"),
		canPause: i("canPause"),
		pausePresets: i("pausePresets"),
		...zt,
		toast: di
	};
}
// src/useToasts.ts
var jl = [];
function Ml(e) {
	let t = B(), r = D(jl), i = D(kr()), a = jr(), o, s;
	return y(() => {
		$o(), o = Q.subscribe(() => {
			r.value = Q.getSnapshot(), i.value = kr();
		}), s = N(() => k(e), (e, t, n) => n(Q.attach(e)), { immediate: !0 }), zr(t.flash), r.value = Q.getSnapshot(), i.value = kr();
	}), v(() => {
		o?.(), s?.(), a.release();
	}), {
		toasts: n(() => r.value.filter((t) => t.toaster === k(e))),
		toast: di,
		update: Q.update,
		dismiss: Q.dismiss,
		pause: a.pause,
		resume: a.resume,
		timer: (e) => (i.value, Q.timer(e)),
		runAction: (e, t, n) => n ? ai(e, t, n) : ii(e, t)
	};
}
// src/iconResolver.ts
var Nl = Be, Pl = Ve;
export { Wr as DEFAULT_ERROR_MESSAGES, qt as DEFAULT_INBOX_LABELS, Yn as DEFAULT_PREFERENCES_LABELS, Xc as NotificationCenter, Oc as NotificationItem, $c as NotificationList, kl as NotificationPreferences, us as Toaster, jt as groupItems, X as inboxStore, $o as initNotifications, st as isSnoozed, Ft as pauseEnd, Lt as pauseTime, Qn as preferencesStore, Wt as relativeTime, dn as requestNotificationPermission, Pl as resolveIcon, Nl as setIconResolver, Ge as setTranslations, Mt as snoozeOptions, di as toast, Je as trans, Al as useNotifications, el as usePreferences, tl as usePush, Ml as useToasts };
