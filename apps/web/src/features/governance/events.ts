import type { GroupEventDto, GroupEventKind, MemberPreviewDto } from "@/lib/api/dto";
import { formatMoney, labelize } from "@/lib/format";

type Name = (m: MemberPreviewDto | null | undefined, opts?: { you?: boolean }) => string;

/** Which tab of the history an event belongs to. */
export type EventKind = "governance" | "recovery" | "savings";

export const EVENT_GROUP: Record<GroupEventKind, EventKind> = {
	group_started: "savings",
	contribution_made: "savings",
	payout_made: "savings",
	group_completed: "savings",
	default_recorded: "recovery",
	recovery_started: "recovery",
	default_resolved: "recovery",
	recovery_resolved: "recovery",
	member_removed: "recovery",
	proposal_created: "governance",
	vote_cast: "governance",
	proposal_approved: "governance",
	proposal_rejected: "governance",
	proposal_expired: "governance",
	proposal_executed: "governance",
	group_paused: "governance",
	group_resumed: "governance",
	schedule_updated: "governance",
	slot_listed: "savings",
	slot_listing_closed: "savings",
	slot_takeover_requested: "savings",
	slot_transferred: "savings",
};

const str = (v: unknown) => (typeof v === "string" ? v : undefined);
const num = (v: unknown) => (typeof v === "number" ? v : undefined);

/**
 * A history event as words, from the `data` keys the API documents per `kind` (`GroupEventDto.data`).
 * Older events may lack a key, so every read has a fallback.
 */
export function describeEvent(e: GroupEventDto, name: Name, asset = "USDC"): { title: string; body: string } {
	const d = e.data as Record<string, unknown>;
	const round = num(d.round);
	const r = round !== undefined ? `round ${round + 1}` : "this round";
	const who = e.actor ? name(e.actor) : "Saji";
	const proposal = num(d.number) ? `Proposal #${d.number}` : "A proposal";
	switch (e.kind) {
		case "group_started":
			return { title: "Cycle started", body: `The savings cycle began with ${num(d.rounds) ?? "its"} rounds.` };
		case "contribution_made":
			return { title: "Contribution", body: `${who} paid ${formatMoney(str(d.amount), asset)} for ${r}${d.late === true ? ", late" : ""}.` };
		case "payout_made":
			return { title: "Payout", body: `${r.charAt(0).toUpperCase() + r.slice(1)}'s pot of ${formatMoney(str(d.amount), asset)} was paid out.` };
		case "group_completed":
			return { title: "Cycle completed", body: "Every member has been paid. The group is complete." };
		case "default_recorded":
			return { title: "Missed contribution recorded", body: `A ${r} contribution${str(d.amount) ? ` of ${formatMoney(str(d.amount), asset)}` : ""} was missed and recorded on Stellar.` };
		case "recovery_started":
			return { title: "Recovery started", body: "Payouts are on hold until members agree how to resolve the missed contribution." };
		case "default_resolved":
			return { title: "Missed contribution resolved", body: `Resolved: ${labelize(str(d.resolution) ?? "settled")}.` };
		case "recovery_resolved":
			return { title: "Recovery complete", body: "The group is saving again." };
		case "member_removed":
			return { title: "Member removed", body: "A member was removed by a group vote." };
		case "proposal_created":
			return { title: "Proposal created", body: `${who} proposed ${labelize(str(d.type) ?? "a change").toLowerCase()} (#${d.number ?? "?"}).` };
		case "vote_cast":
			return { title: "Vote recorded", body: `${who} voted ${d.choice === "yes" ? "For" : "Against"} proposal #${d.number ?? "?"}.` };
		case "proposal_approved":
			return { title: "Proposal approved", body: `${proposal} reached its threshold (${num(d.yes) ?? "?"} of ${num(d.required) ?? "?"}).` };
		case "proposal_rejected":
			return { title: "Proposal rejected", body: `${proposal} can no longer reach its threshold.` };
		case "proposal_expired":
			return { title: "Proposal expired", body: `${proposal} closed without being carried out${str(d.reason) ? ` (${str(d.reason)})` : ""}.` };
		case "proposal_executed":
			return { title: "Decision carried out", body: `${proposal} was executed on Stellar.` };
		case "group_paused":
			return { title: "Group paused", body: "Contributions and payouts are on hold." };
		case "group_resumed":
			return { title: "Group resumed", body: "Contributions and payouts are back on schedule." };
		case "schedule_updated":
			return { title: "Payout order changed", body: `The order changed from round ${(num(d.fromRound) ?? 0) + 1}.` };
		case "slot_listed": {
			const price = str(d.askingPrice);
			return {
				title: "Slot listed",
				body: `${who} listed payout slot #${(num(d.position) ?? 0) + 1}${price ? ` for ${Number(price) === 0 ? "free" : formatMoney(price, asset)}` : ""}.`,
			};
		}
		case "slot_listing_closed":
			return { title: "Slot listing closed", body: `A slot listing closed${str(d.reason) ? ` (${labelize(str(d.reason)!).toLowerCase()})` : ""}.` };
		case "slot_takeover_requested":
			return { title: "Takeover requested", body: `${who} asked to take over a listed slot.` };
		case "slot_transferred":
			return {
				title: "Slot transferred",
				body: `Payout slot #${(num(d.position) ?? 0) + 1} changed hands${str(d.price) && Number(d.price) > 0 ? ` for ${formatMoney(str(d.price)!, asset)}` : ""}.`,
			};
	}
}
