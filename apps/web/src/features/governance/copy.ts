import type { ProposalDto, ProposalStatus, ProposalType, RecoveryAction } from "@/lib/api/dto";
import { longDate } from "@/lib/format";

/** Labels and plain-language effects for each governance action the API supports. */
export const ACTIONS: Record<
	Exclude<ProposalType, "recovery">,
	{ label: string; subtitle: string; effect: string; voteFor: string; voteAgainst: string; placeholder: string }
> = {
	pause: {
		label: "Pause group",
		subtitle: "Temporarily stop contributions and payouts.",
		effect: "No contributions or payouts until members approve a resume proposal. Deadlines stop counting while paused.",
		voteFor: "I agree to pause the group.",
		voteAgainst: "I want the group to continue as scheduled.",
		placeholder: "e.g. Pause until after the end-of-year audit",
	},
	resume: {
		label: "Resume group",
		subtitle: "Restart a group that is currently paused.",
		effect: "Contributions and payouts restart. The round picks up with the time it had left.",
		voteFor: "I agree to restart the group.",
		voteAgainst: "I want the group to stay paused.",
		placeholder: "e.g. The audit is done — let's resume",
	},
	update_schedule: {
		label: "Change future payout order",
		subtitle: "Reorder who collects in upcoming rounds; past payouts stay unchanged.",
		effect: "Upcoming rounds pay out in the new order. Nobody's amount changes, and anyone already paid stays paid.",
		voteFor: "I agree to the new payout order.",
		voteAgainst: "Keep the current order.",
		placeholder: "e.g. Swap Kemi and Emeka — Kemi's rent is due first",
	},
};

/** The API's recovery actions (`DefaultDto.availableActions`). */
export const RECOVERY_ACTIONS: Record<
	RecoveryAction,
	{ label: (name: string) => string; subtitle: (name: string) => string; voteFor: (name: string) => string; voteAgainst: string; outcome: (name: string) => string }
> = {
	grace_extension: {
		label: (name) => `Give ${name} more time`,
		subtitle: (name) => `Set a new deadline for ${name} to pay what they owe. Payouts wait until they do.`,
		voteFor: (name) => `Give ${name} until the new deadline to pay.`,
		voteAgainst: "Don't extend the deadline.",
		outcome: (name) => `${name} has until the new deadline to pay. The round pays out as soon as they do.`,
	},
	write_off: {
		label: () => "Write off the missed contribution",
		subtitle: (name) => `Forgive ${name}'s contribution for this round. The round pays out without it.`,
		voteFor: (name) => `Write off ${name}'s missed contribution and continue.`,
		voteAgainst: "Don't write it off.",
		outcome: () => "The missed contribution was written off and the round paid out without it.",
	},
	remove_member: {
		label: (name) => `Remove ${name} from the group`,
		subtitle: (name) => `${name} leaves the group and every round they haven't been paid for.`,
		voteFor: (name) => `Remove ${name} and carry on without them.`,
		voteAgainst: "Keep them in the group.",
		outcome: (name) => `${name} was removed from the group and its remaining rounds.`,
	},
};

/** "Pause group" / "Recovery" — the small caption above a proposal title. */
export const actionCaption = (p: Pick<ProposalDto, "type">) => (p.type === "recovery" ? "Recovery" : ACTIONS[p.type].label);

/**
 * A proposal's headline. The API has no title (only `description`, the proposer's reason), so it is
 * built from the action: "Pause the group", "Give Tunde more time" (see BACKEND-GAPS.md).
 */
export function proposalTitle(p: ProposalDto, firstName: (m: ProposalDto["proposer"]) => string) {
	switch (p.type) {
		case "pause":
			return "Pause the group";
		case "resume":
			return "Resume the group";
		case "update_schedule":
			return `Change the payout order from round ${(p.scheduleChange?.fromRound ?? 0) + 1}`;
		default: {
			const r = p.recovery;
			if (!r) return "Recovery";
			const who = firstName(r.default.member);
			return r.action === "grace_extension"
				? `Give ${who} until ${longDate(r.graceUntil)}`
				: RECOVERY_ACTIONS[r.action].label(who);
		}
	}
}

/** What a vote For / Against means on this proposal. */
export function voteCopy(p: ProposalDto, firstName: (m: ProposalDto["proposer"]) => string) {
	if (p.type === "recovery" && p.recovery) {
		const who = firstName(p.recovery.default.member);
		return { voteFor: RECOVERY_ACTIONS[p.recovery.action].voteFor(who), voteAgainst: RECOVERY_ACTIONS[p.recovery.action].voteAgainst };
	}
	if (p.type === "recovery") return { voteFor: "Approve this plan.", voteAgainst: "Reject this plan." };
	return { voteFor: ACTIONS[p.type].voteFor, voteAgainst: ACTIONS[p.type].voteAgainst };
}

/** Headline for an executed proposal. */
export function resultHeadline(p: ProposalDto, groupName: string, firstName: (m: ProposalDto["proposer"]) => string) {
	switch (p.type) {
		case "pause":
			return { title: `${groupName} is paused`, body: "The approved decision was carried out. No contributions or payouts are collected while paused." };
		case "resume":
			return { title: `${groupName} has resumed`, body: "The approved decision was carried out. Contributions and payouts are back on schedule." };
		case "update_schedule":
			return { title: "Payout order updated", body: "The approved change was carried out. Past payouts are unchanged." };
		default: {
			const who = p.recovery ? firstName(p.recovery.default.member) : "The member";
			return { title: "Recovery complete", body: p.recovery ? RECOVERY_ACTIONS[p.recovery.action].outcome(who) : "The approved action was carried out." };
		}
	}
}

export type { Tone } from "@repo/ui/panel";
import type { Tone } from "@repo/ui/panel";

/** The pill a proposal shows for its state (the API's five statuses). */
export function proposalPill(status: ProposalStatus): { tone: Tone; label: string } {
	switch (status) {
		case "active":
			return { tone: "lilac", label: "Voting" };
		case "approved":
			return { tone: "yellow", label: "Approved" };
		case "executed":
			return { tone: "green", label: "Executed" };
		case "rejected":
			return { tone: "pink", label: "Rejected" };
		default:
			return { tone: "gray", label: "Expired" };
	}
}

/** "Approval: 51% of members" / "Approval: 4 members". */
export const thresholdLabel = (t: ProposalDto["threshold"]) => (t.kind === "percent" ? `${t.value}% of members` : `${t.value} member${t.value === 1 ? "" : "s"}`);
