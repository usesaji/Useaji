import type { Tone } from "@repo/ui/panel";
import type { EligibilityCheckDto, Frequency, ListingDto, ListingGroupDto, ListingStatus } from "@/lib/api/dto";
import { formatMoney } from "@/lib/format";

/** Listing states → pill label and tone. Screens never decide these themselves. */
export const LISTING_STATUS: Record<ListingStatus, { label: string; tone: Tone }> = {
	open: { label: "Open", tone: "lilac" },
	sold: { label: "Transferred", tone: "green" },
	withdrawn: { label: "Withdrawn", tone: "gray" },
	invalidated: { label: "Closed", tone: "gray" },
};

/** What an invalidated listing means, for the people in it. */
export const CLOSED_NOTE =
	"This listing closed by itself: the slot's round opened, the schedule changed, the seller missed a contribution or left, or the group finished.";

/**
 * Where the transfer the seller put to a vote stands (`ListingDto.transfer`), as one pill. The vote
 * is a governance proposal; once it executes, the buyer may accept until the approval expires.
 */
export function transferStage(l: ListingDto): { label: string; tone: Tone } | null {
	const t = l.transfer;
	if (l.status === "sold") return { label: "Transfer completed", tone: "green" };
	if (!t) return l.requested ? { label: "Request sent", tone: "yellow" } : null;
	switch (t.proposalStatus) {
		case "active":
			return { label: "Group voting", tone: "yellow" };
		case "approved":
			return { label: "Approved · being carried out", tone: "lilac" };
		case "executed":
			return t.approval?.acceptable ? { label: "Approved · ready to accept", tone: "lilac" } : { label: "Approval expired", tone: "gray" };
		case "rejected":
			return { label: "Not approved", tone: "pink" };
		case "expired":
			return { label: "Vote expired", tone: "gray" };
	}
}

/** "How takeover works" (v3 screen 03), as the API runs it. */
export const HOW_TAKEOVER_WORKS = [
	"Review the slot: what's left to pay, the payout and the asking price.",
	"Check you're eligible, then ask for the slot.",
	"The seller picks a buyer and puts them to the group's vote.",
	"Once members approve, accept: one wallet signature pays the price and moves the slot to you.",
];

/**
 * The API words each check for when it fails (`message`); passing checks read as these. Unknown
 * keys fall back to the API's message.
 */
const CHECK_OK: Record<string, string> = {
	// listing your slot
	member: "You're a member of this group",
	groupActive: "The group is running",
	groupPublic: "The group is public",
	notPaused: "The group isn't paused",
	holdsSlot: "You hold a payout slot",
	payoutAhead: "Your payout is still ahead",
	noMissedContribution: "No missed contributions to settle",
	onSlotRegistry: "Your slot is on the slot registry",
	notListed: "Your slot isn't listed yet",
	// asking for a slot
	notSeller: "It isn't your own slot",
	notBanned: "Meets the group's entry conditions",
	notMember: "You aren't in this group yet",
	noSlotInGroup: "No existing slot in this group",
	notFormerHolder: "You haven't paid into this group before",
	walletLinked: "Wallet linked",
	noMissedContributions: "No missed contributions in any group",
	notRequested: "You haven't asked for this slot yet",
};

export const checkLabel = (c: EligibilityCheckDto) => (c.ok ? (CHECK_OK[c.key] ?? c.message) : c.message);

/** "Slot 3 of 6" — positions are 0-based in the API. */
export const slotLabel = (position: number, total?: number) => `Slot ${position + 1}${total ? ` of ${total}` : ""}`;

/** "Free" for a giveaway, else "50.00 USDC". */
export const priceLabel = (price: string, asset = "USDC") => (Number(price) === 0 ? "Free" : formatMoney(price, asset));

const UNIT: Record<Frequency, string> = { daily: "day", weekly: "week", biweekly: "2 weeks", monthly: "month", custom: "period" };

/** "250.00 USDC / month" */
export const perPeriod = (group: Pick<ListingGroupDto, "contributionAmount" | "frequency" | "asset">) =>
	`${formatMoney(group.contributionAmount, group.asset)} / ${UNIT[group.frequency]}`;

/** "3 contributions" */
export const contributions = (n: number) => `${n} contribution${n === 1 ? "" : "s"}`;

/**
 * A person in a listing. They may not share a group with the viewer (a buyer from outside), so the
 * name comes from the preview itself, not the member list.
 */
export function personName(
	m: { firstName?: string | null; lastName?: string | null; tag: string | null; initials: string; userId: string },
	meId?: string | null,
) {
	if (meId && m.userId === meId) return "You";
	if (m.firstName) return `${m.firstName} ${m.lastName ?? ""}`.trim();
	return m.tag ? `@${m.tag}` : m.initials;
}

export const firstOf = (m: Parameters<typeof personName>[0], meId?: string | null) => {
	const full = personName(m, meId);
	return full.startsWith("@") ? full : full.split(" ")[0]!;
};
