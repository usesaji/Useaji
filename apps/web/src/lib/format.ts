import type { Frequency, MemberPreviewDto } from "@/lib/api/dto";

/**
 * Display helpers. Amounts arrive as decimal strings in the group's asset; dates as ISO instants.
 */

/** "2450.8" → "2,450.80 USDC"; tiny amounts keep up to 7 dp so a real balance never shows as 0. */
export function formatMoney(amount: string | number | null | undefined, asset?: string) {
	if (amount === null || amount === undefined || amount === "") return "—";
	const n = typeof amount === "number" ? amount : Number(amount);
	if (Number.isNaN(n)) return "—";
	const text = n.toLocaleString(undefined, {
		minimumFractionDigits: 2,
		maximumFractionDigits: n !== 0 && Math.abs(n) < 0.01 ? 7 : 2,
	});
	return asset ? `${text} ${asset}` : text;
}

export const shortDate = (iso: string | null | undefined) =>
	iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—";

export const longDate = (iso: string | null | undefined) =>
	iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";

export const dateTime = (iso: string | null | undefined) =>
	iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

/** "in 3 days" / "in 5 hours" / "2 days ago", from `now` (pass `useNow()` so render stays pure). */
export function relative(iso: string, now: number) {
	const diff = new Date(iso).getTime() - now;
	const abs = Math.abs(diff);
	const [value, unit] =
		abs < 3_600_000
			? [Math.max(1, Math.round(abs / 60_000)), "minute"]
			: abs < 86_400_000
				? [Math.round(abs / 3_600_000), "hour"]
				: [Math.round(abs / 86_400_000), "day"];
	const text = `${value} ${unit}${value === 1 ? "" : "s"}`;
	return diff >= 0 ? `in ${text}` : `${text} ago`;
}

/** Seconds → "2d 4h" / "3h 12m" / "4m 09s". */
export function formatCountdown(seconds: number) {
	const s = Math.max(0, Math.floor(seconds));
	const d = Math.floor(s / 86_400);
	const h = Math.floor((s % 86_400) / 3600);
	const m = Math.floor((s % 3600) / 60);
	if (d > 0) return `${d}d ${h}h`;
	if (h > 0) return `${h}h ${m}m`;
	return `${m}m ${String(s % 60).padStart(2, "0")}s`;
}

const FREQUENCY: Record<Frequency, string> = {
	daily: "Daily",
	weekly: "Weekly",
	biweekly: "Bi-weekly",
	monthly: "Monthly",
	custom: "Custom",
};

export function frequencyLabel(frequency: Frequency, customDays?: number | null) {
	return frequency === "custom" && customDays ? `Every ${customDays} day${customDays === 1 ? "" : "s"}` : FREQUENCY[frequency];
}

/** "monthly_contribution" → "Monthly contribution" */
export const labelize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");

/**
 * A member's name for display. `MemberPreviewDto` carries only the tag and initials (no name; see
 * docs/BACKEND-GAPS.md), so this shows "@tag", or the initials when there is no tag yet.
 */
export function memberName(member: Pick<MemberPreviewDto, "tag" | "initials"> | null | undefined, meId?: string | null, userId?: string) {
	if (!member) return "A member";
	if (meId && userId && meId === userId) return "You";
	return member.tag ? `@${member.tag}` : member.initials;
}

/** "Ada Okafor" → "AO" */
export function initials(name: string | null | undefined) {
	const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "?";
	return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")).toUpperCase();
}
