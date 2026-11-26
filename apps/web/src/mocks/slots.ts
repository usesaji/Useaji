import { ms } from "@/mocks/clock";
import { memberPreview } from "@/mocks/dto";
import {
	firstName,
	groupById,
	membership,
	money,
	notify,
	num,
	openDefaults,
	openSlotTransferVote,
	paidThisRound,
	recordEvent,
	roundTiming,
	RuleError,
	tickHooks,
	userById,
} from "@/mocks/engine";
import { explorerTx, txHash } from "@/mocks/ids";
import type { MockDb, MockGroup, MockSlotListing, MockSlotTransfer } from "@/mocks/types";
import { buildXdr, hashOf, readSignedXdr } from "@/mocks/xdr";
import type { EligibilityCheckDto, EligibilityDto, ListingDto, ListingGroupDto, SellerEligibilityDto, SlotTransferDto } from "@/lib/api/dto";

/**
 * v3 slot marketplace, as the API runs it (docs/frontend-integration.md §6).
 *
 * A member of an active, public group lists a future payout slot (one round of `cycle.schedule`)
 * with an asking price ("0" gives it away). People outside the group ask for it; the seller picks
 * one and that opens a `slot_transfer` proposal (every member but the seller votes, at the group's
 * threshold; the engine runs it). Once it executes, the buyer may accept until the approval
 * expires: one transaction, co-signed by Saji for ~2 minutes, pays the price to the seller and moves
 * the slot. The buyer joins at the seller's position and the seller leaves. Past contributions keep
 * their payer (`paidThisRound` credits a round the seller already paid). A listing closes by itself
 * ("invalidated") when the rules stop holding.
 */

/** A prepared accept is co-signed for about 2 minutes. */
export const ACCEPT_TTL = 2 * 60_000;
const AMOUNT = /^\d+(\.\d{1,7})?$/;
const BOT_REQUEST_AFTER = 30_000;
const BOT_SELECT_AFTER = 30_000;
const BOT_ACCEPT_AFTER = 20_000;

const isBot = (db: MockDb, id: string) => !!userById(db, id)?.bot;
const conflict = (message: string) => new RuleError(409, "CONFLICT", message);
const notFound = (message: string) => new RuleError(404, "NOT_FOUND", message);

// ---------------------------------------------------------------- facts about a slot

/** The round `userId` collects in, if it hasn't been paid out yet. */
export function slotOf(group: MockGroup, userId: string) {
	const cycle = group.cycle;
	if (!cycle) return null;
	const round = cycle.schedule.findIndex((id, i) => id === userId && !cycle.paidOut[i]);
	return round < 0 ? null : round;
}

/**
 * The slot's round hasn't opened yet. (The cycle moves to the next round as soon as one pays out,
 * before that round opens, so the current round can still be ahead.)
 */
function payoutAhead(group: MockGroup, position: number, at: number) {
	const cycle = group.cycle!;
	if (cycle.paidOut[position]) return false;
	return position > cycle.round || (position === cycle.round && roundTiming(group, at).opened > at);
}

const openListingOf = (db: MockDb, groupId: string, sellerId: string) =>
	db.slotListings.find((l) => l.groupId === groupId && l.sellerId === sellerId && l.status === "open");

const proposalOf = (db: MockDb, l: MockSlotListing) => (l.transfer ? db.proposals.find((p) => p.id === l.transfer!.proposalId) : undefined);

/** The chosen buyer may accept now: the vote executed and the approval hasn't expired. */
export function acceptable(db: MockDb, l: MockSlotListing, at: number) {
	const expires = l.transfer?.approvalExpiresAt;
	return l.status === "open" && !!expires && ms(expires) > at && proposalOf(db, l)?.status === "executed";
}

/** Rounds the buyer would still pay: the rest of the schedule, less the current round if the seller paid it. */
function roundsToPay(db: MockDb, group: MockGroup, holderId: string) {
	const cycle = group.cycle;
	if (!cycle || group.status !== "active") return 0;
	return Math.max(0, cycle.schedule.length - cycle.round - (paidThisRound(db, group.id, cycle.round, holderId) ? 1 : 0));
}

const check = (key: string, ok: boolean, message: string): EligibilityCheckDto => ({ key, ok, message });

/** `GET /groups/{id}/slots/eligibility`: can `userId` list their slot? Non-members get 404 (the route). */
export function sellerEligibility(db: MockDb, group: MockGroup, userId: string, at: number): SellerEligibilityDto {
	const cycle = group.cycle;
	const position = slotOf(group, userId);
	const checks = [
		check("member", !!membership(db, group.id, userId), "You aren't a member of this group."),
		check("groupActive", group.status === "active" && !!cycle, "Slots can only be listed while the group is running."),
		check("groupPublic", group.publicDiscovery, "Only public groups can list slots."),
		check("notPaused", !cycle?.paused, "The group is paused."),
		check("holdsSlot", position !== null, "You have no payout slot left in this group."),
		check(
			"payoutAhead",
			position !== null && !!cycle && payoutAhead(group, position, at),
			"Your slot's payout round has already started.",
		),
		check(
			"noMissedContribution",
			!openDefaults(db, group.id).some((d) => d.userId === userId),
			"Settle your missed contribution before listing your slot.",
		),
		check("onSlotRegistry", true, "Your slot isn't on the slot registry yet. Try again in a few minutes."),
		check("notListed", !openListingOf(db, group.id, userId), "Your slot is already listed."),
	];
	return { eligible: checks.every((c) => c.ok), position, checks };
}

/** Can `userId` ask for this listing now? Null for the seller and for closed listings. */
export function buyerEligibility(db: MockDb, l: MockSlotListing, userId: string): EligibilityDto | null {
	if (l.sellerId === userId || l.status !== "open") return null;
	const group = groupById(db, l.groupId)!;
	const user = userById(db, userId);
	const member = !!membership(db, group.id, userId);
	const checks = [
		check("notSeller", true, "You can't take over your own slot."),
		check("notBanned", !(group.bans ?? []).includes(userId), "An admin removed you from this group."),
		check("notMember", !member, "You're already a member of this group."),
		check("noSlotInGroup", slotOf(group, userId) === null, "You already hold a slot in this group."),
		check(
			"notFormerHolder",
			!db.contributions.some((c) => c.groupId === group.id && c.userId === userId),
			"You've paid into this group before, so you can't buy back in.",
		),
		check("walletLinked", !!user?.wallet, "Link a Stellar wallet first: the slot moves to it."),
		check(
			"noMissedContributions",
			!db.defaults.some((d) => d.userId === userId && !d.resolution),
			"Settle your missed contributions before taking over a slot.",
		),
		check("notRequested", !l.requests.some((r) => r.buyerId === userId), "You've already asked for this slot."),
	];
	return { eligible: checks.every((c) => c.ok), checks };
}

/** What still blocks a transfer from going through now (re-checked at accept). */
function transferBlocker(db: MockDb, l: MockSlotListing, buyerId: string, at: number): string | null {
	const group = groupById(db, l.groupId)!;
	const cycle = group.cycle;
	if (!cycle || group.status !== "active") return "The group isn't running any more.";
	if (cycle.paused) return "The group is paused.";
	if (cycle.schedule[l.position] !== l.sellerId) return "The schedule changed since this slot was listed.";
	if (!payoutAhead(group, l.position, at)) return "The slot's payout round has started.";
	if (openDefaults(db, group.id).some((d) => d.userId === l.sellerId)) return "The seller has a missed contribution to settle.";
	if (membership(db, group.id, buyerId)) return "You're already a member of this group.";
	return null;
}

// ---------------------------------------------------------------- actions

export function createListing(db: MockDb, group: MockGroup, userId: string, askingPrice: string, at: string) {
	if (!membership(db, group.id, userId)) throw notFound("Group not found.");
	const price = String(askingPrice ?? "");
	if (!AMOUNT.test(price)) throw new RuleError(400, "BAD_REQUEST", "askingPrice must be a decimal string like 10 or 0");
	const { checks, position } = sellerEligibility(db, group, userId, ms(at));
	const failed = checks.find((c) => !c.ok);
	if (failed || position === null) throw conflict(failed?.message ?? "You have no payout slot left in this group.");
	const listing: MockSlotListing = {
		id: crypto.randomUUID(),
		groupId: group.id,
		sellerId: userId,
		position,
		askingPrice: money(num(price)),
		status: "open",
		createdAt: at,
		closedAt: null,
		closeReason: null,
		requests: [],
		transfer: null,
		everRequested: [],
		soldTo: null,
	};
	db.slotListings.push(listing);
	recordEvent(db, group.id, "slot_listed", at, userId, { listingId: listing.id, position, askingPrice: listing.askingPrice });
	return listing;
}

export function withdrawListing(db: MockDb, group: MockGroup, userId: string, at: string) {
	const listing = openListingOf(db, group.id, userId);
	if (!listing) throw notFound("You have no open listing in this group.");
	close(db, listing, "withdrawn", "withdrawn by the seller", at);
}

function close(db: MockDb, l: MockSlotListing, status: "withdrawn" | "invalidated", reason: string, at: string) {
	l.status = status;
	l.closedAt = at;
	l.closeReason = reason;
	l.requests = [];
	recordEvent(db, l.groupId, "slot_listing_closed", at, null, { listingId: l.id, reason });
}

export function requestTakeover(db: MockDb, l: MockSlotListing, userId: string, at: string) {
	if (l.status !== "open") throw notFound("This listing isn't open.");
	if (l.sellerId === userId) throw new RuleError(400, "BAD_REQUEST", "You can't take over your own slot.");
	const checks = buyerEligibility(db, l, userId)!.checks;
	if (!checks.find((c) => c.key === "notRequested")!.ok) return; // repeating it is a no-op
	const failed = checks.find((c) => !c.ok);
	if (failed) throw new RuleError(failed.key === "notBanned" ? 403 : 409, failed.key === "notBanned" ? "FORBIDDEN" : "CONFLICT", failed.message);
	l.requests.push({ buyerId: userId, requestedAt: at });
	if (!l.everRequested.includes(userId)) l.everRequested.push(userId);
	const group = groupById(db, l.groupId)!;
	recordEvent(db, group.id, "slot_takeover_requested", at, userId, { listingId: l.id, buyerId: userId });
	notify(
		db,
		[l.sellerId],
		"slot_takeover_requested",
		at,
		"Someone wants your slot",
		`${firstName(userById(db, userId))} asked to take over your slot in ${group.name}.`,
		{ groupId: group.id, listingId: l.id, userId },
	);
}

export function withdrawRequest(db: MockDb, l: MockSlotListing, userId: string) {
	const index = l.requests.findIndex((r) => r.buyerId === userId);
	if (index < 0) throw notFound("You have no request on this listing.");
	l.requests.splice(index, 1);
}

/** The seller puts one requester to the group's vote. */
export function selectBuyer(db: MockDb, l: MockSlotListing, sellerId: string, buyerId: string, at: string) {
	if (l.sellerId !== sellerId) throw new RuleError(403, "FORBIDDEN", "Only the seller can choose a buyer.");
	if (l.status !== "open") throw notFound("This listing isn't open.");
	const request = l.requests.find((r) => r.buyerId === buyerId);
	if (!request) throw notFound("No pending request from this person.");
	if (proposalOf(db, l)?.status === "active") throw conflict("A vote on this listing is already open.");
	if (acceptable(db, l, ms(at))) throw conflict("An approved buyer can still accept this slot.");
	const failed = buyerEligibility(db, l, buyerId)!.checks.find((c) => !c.ok && c.key !== "notRequested");
	if (failed) throw conflict(`This buyer can't take the slot now: ${failed.message}`);
	l.requests = l.requests.filter((r) => r.buyerId !== buyerId);
	openSlotTransferVote(db, groupById(db, l.groupId)!, l, buyerId, at);
}

/** `…/accept/prepare`: the buyer's transaction, co-signed by Saji (about 2 minutes to sign it). */
export function prepareAccept(db: MockDb, l: MockSlotListing, userId: string, at: number) {
	if (l.status !== "open" || l.transfer?.buyerId !== userId || proposalOf(db, l)?.status !== "executed")
		throw notFound("There's no approved takeover of this slot for you.");
	if (!acceptable(db, l, at)) throw conflict("The approval expired. Ask the seller to put you to a vote again.");
	const blocker = transferBlocker(db, l, userId, at);
	if (blocker) throw conflict(blocker);
	const wallet = userById(db, userId)!.wallet;
	if (!wallet) throw conflict("Link a Stellar wallet first: the slot moves to it.");
	if (num(db.walletBalances[wallet.publicKey] ?? "0") + 1e-9 < num(l.askingPrice))
		throw new RuleError(400, "BAD_REQUEST", "Not enough USDC in your wallet to pay the asking price.");
	return buildXdr({ op: "accept_slot", source: wallet.publicKey, listingId: l.id, amount: l.askingPrice, at });
}

/** `…/accept`: the signed transaction lands. Repeating it with the same transaction returns the same result. */
export function acceptListing(db: MockDb, l: MockSlotListing, userId: string, signedXdr: string, at: string) {
	const read = readSignedXdr(signedXdr);
	const wallet = userById(db, userId)?.wallet?.publicKey;
	if (!read || read.tx.op !== "accept_slot" || read.tx.listingId !== l.id || read.signer !== read.tx.source || read.tx.source !== wallet)
		throw new RuleError(400, "BAD_REQUEST", "The transaction did not transfer this slot to your wallet.");
	const hash = hashOf(signedXdr);
	if (l.status === "sold" && db.slotTransfers.some((t) => t.listingId === l.id && t.txHash === hash)) return;
	if (ms(at) - read.tx.at > ACCEPT_TTL)
		throw new RuleError(400, "BAD_REQUEST", "This signed transaction can no longer be submitted; prepare and sign it again.");
	prepareAccept(db, l, userId, ms(at)); // every rule again
	completeTransfer(db, l, userId, at, hash);
}

/** Moves the slot: the schedule entry, the memberships, the price, and the record. */
function completeTransfer(db: MockDb, l: MockSlotListing, buyerId: string, at: string, hash: string) {
	const group = groupById(db, l.groupId)!;
	const cycle = group.cycle!;
	const coveredRound = paidThisRound(db, group.id, cycle.round, l.sellerId) ? cycle.round : null;
	cycle.schedule[l.position] = buyerId;
	cycle.stateVersion += 1;
	const seller = membership(db, group.id, l.sellerId);
	if (seller) seller.removedAt = at;
	db.members.push({ groupId: group.id, userId: buyerId, role: "member", joinedAt: at, removedAt: null });
	const from = userById(db, buyerId)?.wallet?.publicKey;
	const to = userById(db, l.sellerId)?.wallet?.publicKey;
	const price = num(l.askingPrice);
	if (from && price > 0) db.walletBalances[from] = money(num(db.walletBalances[from] ?? "0") - price);
	if (to && price > 0) db.walletBalances[to] = money(num(db.walletBalances[to] ?? "0") + price);
	const record: MockSlotTransfer = {
		id: crypto.randomUUID(),
		groupId: group.id,
		listingId: l.id,
		proposalId: l.transfer!.proposalId,
		fromId: l.sellerId,
		toId: buyerId,
		position: l.position,
		price: l.askingPrice,
		effectiveRound: cycle.round,
		txHash: hash,
		at,
	};
	db.slotTransfers.push(record);
	l.status = "sold";
	l.soldTo = buyerId;
	l.closedAt = at;
	l.requests = [];
	recordEvent(
		db,
		group.id,
		"slot_transferred",
		at,
		null,
		{
			listingId: l.id,
			proposalId: record.proposalId,
			fromUserId: l.sellerId,
			toUserId: buyerId,
			position: l.position,
			price: l.askingPrice,
			coveredRound,
		},
		hash,
	);
	notify(
		db,
		[buyerId, l.sellerId],
		"slot_transferred",
		at,
		"Slot transferred",
		`Slot ${l.position + 1} in ${group.name} moved from ${firstName(userById(db, l.sellerId))} to ${firstName(userById(db, buyerId))}.`,
		{ groupId: group.id, listingId: l.id },
	);
}

// ---------------------------------------------------------------- the passage of time

/** Listings that close by themselves, and what simulated people do: ask, choose a buyer, accept. */
function tickSlots(db: MockDb, at: number): boolean {
	let changed = false;
	const iso = (t: number) => new Date(Math.min(t, at)).toISOString();

	for (const l of db.slotListings.filter((x) => x.status === "open")) {
		const group = groupById(db, l.groupId)!;
		const cycle = group.cycle;
		const reason =
			group.status === "completed" || !cycle
				? "group completed"
				: !membership(db, group.id, l.sellerId)
					? "seller removed"
					: cycle.schedule[l.position] !== l.sellerId
						? "schedule changed"
						: openDefaults(db, group.id).some((d) => d.userId === l.sellerId)
							? "seller missed a contribution"
							: !payoutAhead(group, l.position, at)
								? "slot round opened"
								: null;
		if (reason) {
			close(db, l, "invalidated", reason, new Date(at).toISOString());
			changed = true;
		}
	}

	for (const l of db.slotListings.filter((x) => x.status === "open")) {
		// A simulated outsider asks for a slot a person listed, so the seller sees the flow through.
		if (!isBot(db, l.sellerId) && l.requests.length === 0 && !l.transfer && ms(l.createdAt) + BOT_REQUEST_AFTER <= at) {
			const bot = db.users.find((u) => u.bot && u.wallet && buyerEligibility(db, l, u.id)?.eligible);
			if (bot) {
				requestTakeover(db, l, bot.id, iso(ms(l.createdAt) + BOT_REQUEST_AFTER));
				changed = true;
			}
		}
		// A simulated seller puts the first requester to a vote.
		const proposal = proposalOf(db, l);
		const free = !proposal || proposal.status === "rejected" || proposal.status === "expired" || (!acceptable(db, l, at) && proposal.status === "executed");
		const first = l.requests[0];
		if (isBot(db, l.sellerId) && free && first) {
			const when = ms(first.requestedAt) + BOT_SELECT_AFTER;
			if (when <= at) {
				try {
					selectBuyer(db, l, l.sellerId, first.buyerId, iso(when));
				} catch {
					l.requests.shift(); // that buyer can't take it any more
				}
				changed = true;
			}
		}
		// A simulated buyer accepts once approved.
		const buyer = l.transfer?.buyerId;
		if (buyer && isBot(db, buyer) && acceptable(db, l, at)) {
			const when = ms(proposal?.executedAt ?? new Date(at).toISOString()) + BOT_ACCEPT_AFTER;
			if (when <= at) {
				if (transferBlocker(db, l, buyer, when)) l.transfer!.approvalExpiresAt = iso(when);
				else completeTransfer(db, l, buyer, iso(when), txHash());
				changed = true;
			}
		}
	}
	return changed;
}

tickHooks.push(tickSlots);

// ---------------------------------------------------------------- DTOs

function groupDto(group: MockGroup, at: number): ListingGroupDto {
	const cycle = group.cycle;
	return {
		id: group.id,
		name: group.name,
		contributionAmount: group.contributionAmount,
		asset: "USDC",
		frequency: group.frequency,
		totalRounds: cycle?.schedule.length ?? 0,
		currentRound: cycle?.round ?? 0,
		roundDeadline: new Date(cycle ? roundTiming(group, at).deadline : ms(group.createdAt)).toISOString(),
	};
}

/** Private groups' listings are hidden from outsiders (404), as the API does. */
export const canSeeListing = (db: MockDb, l: MockSlotListing, userId: string) => {
	const group = groupById(db, l.groupId)!;
	return group.publicDiscovery || !!membership(db, group.id, userId) || l.sellerId === userId || l.everRequested.includes(userId);
};

export function listingDto(db: MockDb, l: MockSlotListing, viewerId: string, at: number): ListingDto {
	const group = groupById(db, l.groupId)!;
	const mine = l.sellerId === viewerId;
	const holder = l.soldTo ?? l.sellerId;
	const rounds = l.status === "open" ? roundsToPay(db, group, holder) : 0;
	const contribution = num(group.contributionAmount);
	const proposal = proposalOf(db, l);
	const seesTransfer = mine || l.transfer?.buyerId === viewerId || !!membership(db, group.id, viewerId);
	return {
		id: l.id,
		group: groupDto(group, at),
		seller: memberPreview(db, l.sellerId),
		position: l.position,
		askingPrice: l.askingPrice,
		roundsToPay: rounds,
		remainingObligation: money(rounds * contribution),
		expectedPayout: money(contribution * (group.cycle?.schedule.length ?? 0)),
		status: l.status,
		createdAt: l.createdAt,
		mine,
		requested: l.requests.some((r) => r.buyerId === viewerId),
		requests: mine ? l.requests.map((r) => ({ buyer: memberPreview(db, r.buyerId), requestedAt: r.requestedAt })) : null,
		transfer:
			l.transfer && proposal && seesTransfer
				? {
						proposalId: proposal.id,
						buyer: memberPreview(db, l.transfer.buyerId),
						proposalStatus: proposal.status,
						approval: l.transfer.approvalExpiresAt
							? { expiresAt: l.transfer.approvalExpiresAt, acceptable: acceptable(db, l, at) }
							: null,
					}
				: null,
		buyerEligibility: buyerEligibility(db, l, viewerId),
	};
}

export function transferDto(db: MockDb, t: MockSlotTransfer): SlotTransferDto {
	const paid = db.contributions.filter((c) => c.groupId === t.groupId && c.userId === t.fromId && ms(c.paidAt) <= ms(t.at));
	const payout = db.payouts.find((p) => p.groupId === t.groupId && p.round === t.position);
	return {
		id: t.id,
		from: memberPreview(db, t.fromId),
		to: memberPreview(db, t.toId),
		position: t.position,
		price: t.price,
		effectiveRound: t.effectiveRound,
		txHash: t.txHash,
		txUrl: explorerTx(t.txHash),
		transferredAt: t.at,
		paidBySeller: { rounds: paid.length, amount: money(paid.reduce((s, c) => s + num(c.amount), 0)) },
		payout: payout
			? {
					round: payout.round,
					recipient: memberPreview(db, payout.userId),
					amount: payout.amount,
					paidAt: payout.paidAt,
					txUrl: explorerTx(payout.txHash),
				}
			: null,
	};
}

