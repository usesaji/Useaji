import type { Tone } from "@repo/ui/panel";

export const dateTime = (iso: string) =>
	new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
export const longDate = (iso: string) =>
	new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
export const shortId = (id: string) => `${id.slice(0, 8)}…`;

/** The actions the API writes (`AuditLogDto.action`). New ones may appear; they show as their verb. */
const LABELS: Record<string, string> = {
	"auth.register": "Signed up",
	"auth.login": "Signed in",
	"auth.login_failed": "Sign-in failed",
	"auth.logout": "Signed out",
	"auth.refresh": "Session refreshed",
	"auth.refresh_reuse_detected": "Stolen session blocked",
	"auth.google_linked": "Google linked",
	"auth.password_set": "Password set",
	"auth.password_changed": "Password changed",
	"auth.password_reset": "Password reset",
	"security.settings_updated": "Security settings changed",
	"profile.update": "Profile updated",
	"wallet.linked": "Wallet linked",
	"wallet.disconnected": "Wallet disconnected",
	"wallet.destination_added": "Payout address added",
	"wallet.destination_primary": "Primary payout address changed",
	"wallet.destination_removed": "Payout address removed",
	"group.created": "Group created",
	"group.updated": "Group settings changed",
	"group.cover_updated": "Group cover changed",
	"group.invite_rotated": "Invite link replaced",
	"group.join_requested": "Asked to join a group",
	"group.join_approved": "Join request approved",
	"group.join_rejected": "Join request declined",
	"group.joined": "Joined a group",
	"group.left": "Left a group",
	"group.member_removed": "Member removed",
	"group.ban_lifted": "Ban lifted",
	"group.governance_updated": "Approval rules changed",
	"group.started": "Group started",
};

/** "auth.login_failed" → "Sign-in failed"; an unknown action reads as its verb ("thing.did_x" → "Did x"). */
export function actionLabel(action: string) {
	if (LABELS[action]) return LABELS[action];
	const verb = (action.split(".").pop() ?? action).replace(/_/g, " ");
	return verb.charAt(0).toUpperCase() + verb.slice(1);
}

/** The pill an audit action gets: failures and blocks pink, money settings yellow, groups lilac, wallets green. */
export function actionTone(action: string): Tone {
	if (/failed|reuse_detected|rejected|removed|disconnected/.test(action)) return "pink";
	if (/password|security|google|destination_primary/.test(action)) return "yellow";
	if (action.startsWith("wallet.")) return "green";
	if (action.startsWith("group.")) return "lilac";
	return "gray";
}

/** The actions the audit filter offers (the API doesn't publish its list; unknown ones still show). */
export const KNOWN_ACTIONS = Object.keys(LABELS).sort();

/** "ada.obi@example.com" → "AO". */
export function initials(email: string) {
	const name = email.split("@")[0] ?? "";
	const parts = name.split(/[._-]+/).filter(Boolean);
	return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "")).toUpperCase();
}

/** How long ago `iso` was, measured from `now` (a query's `dataUpdatedAt`, so render stays pure). */
export function ago(iso: string, now: number) {
	const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
	if (s < 60) return "just now";
	if (s < 3600) return `${Math.floor(s / 60)} min ago`;
	if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
	return `${Math.floor(s / 86_400)} d ago`;
}
