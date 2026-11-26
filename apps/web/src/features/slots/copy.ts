import type { Tone } from "@repo/ui/panel";
import type { Frequency, SlotListingStatus, SlotTakeoverStatus, SlotTermsDto } from "@/lib/api/dto";
import { formatMoney } from "@/lib/format";

/** Slot listing and takeover states → pill label and tone. Screens never decide these themselves. */
export const LISTING_STATUS: Record<SlotListingStatus, { label: string; tone: Tone }> = {
	open: { label: "Open", tone: "lilac" },
	pending: { label: "Request under review", tone: "yellow" },
	transferred: { label: "Transferred", tone: "green" },
	cancelled: { label: "Cancelled", tone: "gray" },
	expired: { label: "Expired", tone: "gray" },
};

export const TAKEOVER_STATUS: Record<SlotTakeoverStatus, { label: string; tone: Tone }> = {
	voting: { label: "Awaiting group approval", tone: "yellow" },
	approved: { label: "Approved · awaiting signature", tone: "lilac" },
	transferred: { label: "Transfer completed", tone: "green" },
	rejected: { label: "Not approved", tone: "pink" },
	expired: { label: "Expired", tone: "gray" },
	withdrawn: { label: "Withdrawn", tone: "gray" },
};

/** "How takeover works" (v3 screen 03). */
export const HOW_TAKEOVER_WORKS = [
	"Review the full contribution schedule.",
	"Connect your wallet and check eligibility.",
	"Request takeover and await group approval.",
	"Sign the transfer after approval.",
];

const UNIT: Record<Frequency, string> = { daily: "day", weekly: "week", biweekly: "2 weeks", monthly: "month", custom: "period" };

/** "250.00 USDC / month" */
export function perPeriod(terms: Pick<SlotTermsDto, "contributionAmount" | "frequency" | "customIntervalDays">, asset = "USDC") {
	const unit =
		terms.frequency === "custom" && terms.customIntervalDays ? `${terms.customIntervalDays} days` : UNIT[terms.frequency];
	return `${formatMoney(terms.contributionAmount, asset)} / ${unit}`;
}

/** "3 contributions" */
export const contributions = (n: number) => `${n} contribution${n === 1 ? "" : "s"}`;

/** "3 contributions left" */
export const contributionsLeft = (n: number) => `${contributions(n)} left`;

/**
 * A person in a slot listing or takeover. They may not share a group with the viewer (a requester
 * from outside), so the name comes from the preview itself, not the member list.
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
