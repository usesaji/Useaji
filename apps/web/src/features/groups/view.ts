import type { CycleDto, GroupDetailDto, GroupSummaryDto } from "@/lib/api/dto";
import { pageRoutes } from "@/lib/routes";

/** One mapping for every group badge and link, so screens never decide them on their own. */

export const GROUP_PLACEHOLDER = "/images/group-placeholder.png";

export const coverOf = (group: Pick<GroupSummaryDto, "coverUrl">) => group.coverUrl ?? GROUP_PLACEHOLDER;

/** Where a group opens: the savings cycle once it has started, the forming page before. */
export const groupHref = (group: Pick<GroupSummaryDto, "id" | "status">) =>
	group.status === "forming" ? pageRoutes.dashboardRoutes.GROUP(group.id) : pageRoutes.dashboardRoutes.CIRCLE(group.id);

export type Badge = { label: string; tone: string };

const TONES = {
	lilac: "bg-primary-light text-primary",
	yellow: "bg-warning-100 text-warning-800",
	pink: "bg-accent-light text-accent",
	green: "bg-success-50 text-success-700",
	grey: "bg-neutral-comment text-neutral-900",
};

/**
 * The card badge answers "do I owe money right now?", from the viewer's state on the group summary
 * (`myAmountDue`, `deadline`, `paused`, `inRecovery`).
 */
export function groupBadge(group: Pick<GroupSummaryDto, "status" | "inRecovery" | "paused" | "myAmountDue" | "deadline">, now = 0): Badge {
	if (group.status === "forming") return { label: "FORMING", tone: TONES.grey };
	if (group.status === "completed") return { label: "COMPLETED", tone: TONES.lilac };
	if (group.inRecovery) return { label: "RECOVERY", tone: TONES.pink };
	if (group.paused) return { label: "PAUSED", tone: TONES.yellow };
	if (group.myAmountDue === null) return { label: "PAID", tone: TONES.lilac };
	if (now && group.deadline && new Date(group.deadline).getTime() < now) return { label: "OVERDUE", tone: TONES.pink };
	return { label: "PENDING", tone: TONES.yellow };
}

/** "Active" / "Paused" / "In recovery" / "Forming" / "Completed", for the savings card. */
export function circleStatus(group: Pick<GroupDetailDto, "status">, cycle?: CycleDto | null): Badge {
	if (group.status === "completed") return { label: "Completed", tone: TONES.lilac };
	if (group.status === "forming") return { label: "Forming", tone: TONES.grey };
	if (cycle?.inRecovery) return { label: "In recovery", tone: TONES.pink };
	if (cycle?.paused) return { label: "Paused", tone: TONES.yellow };
	return { label: "Active", tone: TONES.green };
}

/** Rounds paid out over the rotation, as a percentage (from the cycle's schedule). */
export function roundsProgress(cycle: CycleDto | null | undefined) {
	if (!cycle || cycle.totalRounds === 0) return { done: 0, total: cycle?.totalRounds ?? 0, percent: 0 };
	const done = cycle.schedule.filter((s) => s.paidOut).length;
	return { done, total: cycle.totalRounds, percent: Math.round((done / cycle.totalRounds) * 100) };
}

/** The same from a list card: rounds before the current one have paid out (`round` is 0-based). */
export function summaryProgress(group: Pick<GroupSummaryDto, "status" | "round" | "totalRounds">) {
	const total = group.totalRounds ?? 0;
	if (total === 0) return { done: 0, total, percent: 0 };
	const done = group.status === "completed" ? total : Math.min(group.round ?? 0, total);
	return { done, total, percent: Math.round((done / total) * 100) };
}
