import { addMs, HOUR, ms } from "@/mocks/clock";
import { memberPreview } from "@/mocks/dto";
import {
	activeMembers,
	firstName,
	groupById,
	intervalMs,
	membership,
	money,
	notify,
	num,
	openDefaults,
	paidThisRound,
	requiredVotes,
	roundTiming,
	RuleError,
	tickHooks,
	userById,
} from "@/mocks/engine";
import { txHash, uuid } from "@/mocks/ids";
import type { MockDb, MockGroup, MockSlotListing, MockTakeover } from "@/mocks/types";
import type {
	MySlotDto,
	SlotCheckDto,
	SlotDueDto,
	SlotGroupDto,
	SlotHistoryItemDto,
	SlotListingDto,
	SlotTakeoverDto,
	SlotTermsDto,
} from "@/lib/api/dto";

/**
 * v3 slot marketplace & takeover — the rules the backend and its Soroban contract would enforce.
 *
 * A slot is one round of a running group's payout schedule (`cycle.schedule[round]`); its owner
 * receives that round's payout. The owner may list it while their payout is still ahead and they owe
 * nothing missed. Someone outside the group requests it; every member except the owner reviews it
 * against the group's approval threshold; once approved, the incoming member signs the transfer.
 * The transfer swaps the owner in the schedule, the incoming member joins and the outgoing one
 * leaves. Contributions and payouts already recorded stay as they are (`paidThisRound` credits a
 * round the previous owner already paid). One owner per slot, one slot per person per group.
 */

const MAX_LISTING_DAYS = 30;
const BOT_REQUEST_AFTER = 30_000;
const BOT_VOTE_AFTER = 25_000;
const BOT_SIGN_AFTER = 20_000;

const isBot = (db: MockDb, id: string) => !!userById(db, id)?.bot;
const conflict = (message: string) => new RuleError(409, "CONFLICT", message);
const badRequest = (message: string) => new RuleError(400, "BAD_REQUEST", message);

// ---------------------------------------------------------------- facts about a slot

/** When round `r` is due: the current deadline, plus one interval per round after it. */
function dueAt(group: MockGroup, r: number, at: number) {
	const cycle = group.cycle!;
	return roundTiming(group, at).deadline + (r - cycle.round) * intervalMs(group);
}

/** The round `userId` collects in, if it hasn't been paid out yet. */
export function slotOf(group: MockGroup, userId: string) {
	const cycle = group.cycle;
	if (!cycle) return null;
	const round = cycle.schedule.findIndex((id, i) => id === userId && !cycle.paidOut[i]);
	return round < 0 ? null : round;
}

export function slotTerms(db: MockDb, group: MockGroup, round: number, ownerId: string, at: number): SlotTermsDto {
	const cycle = group.cycle!;
	const amount = num(group.contributionAmount);
	const schedule: SlotDueDto[] = [];
	for (let r = cycle.round; r < cycle.schedule.length; r++) {
		if (r === cycle.round && paidThisRound(db, group.id, r, ownerId)) continue;
		schedule.push({ round: r, dueAt: new Date(dueAt(group, r, at)).toISOString(), amount: money(amount), payout: r === round });
	}
	const members = activeMembers(db, group.id).length;
	return {
		contributionAmount: money(amount),
		frequency: group.frequency,
		customIntervalDays: group.customIntervalDays,
		remainingContributions: schedule.length,
		remainingAmount: money(schedule.length * amount),
		payoutAmount: money(amount * members * (1 - num(group.serviceChargePercent) / 100)),
		payoutAt: new Date(dueAt(group, round, at)).toISOString(),
		lastContributionAt: schedule.at(-1)?.dueAt ?? null,
		schedule,
	};
}

/**
 * The slot's round hasn't opened yet: no one has paid into it and its payout is still ahead. (The
 * cycle moves to the next round as soon as one pays out, before that round opens, so the current
 * round can still be ahead.)
 */
function payoutAhead(group: MockGroup, round: number, at: number) {
	const cycle = group.cycle!;
	if (cycle.paidOut[round]) return false;
	return round > cycle.round || (round === cycle.round && roundTiming(group, at).opened > at);
}

const liveListing = (db: MockDb, groupId: string, round: number) =>
	db.slotListings.find((l) => l.groupId === groupId && l.round === round && (l.status === "open" || l.status === "pending"));

/** Can `userId` list their slot? Each condition, so the screen can show what holds. */
export function listingChecks(
	db: MockDb,
	group: MockGroup,
	userId: string,
	at: number,
): { round: number | null; checks: SlotCheckDto[] } {
	const cycle = group.cycle;
	const round = slotOf(group, userId);
	const running = group.status === "active" && !!cycle && !cycle.paused;
	const owesNothing = !openDefaults(db, group.id).some((d) => d.userId === userId);
	const ahead = round !== null && !!cycle && payoutAhead(group, round, at);
	return {
		round,
		checks: [
			{ label: running ? "The group is running" : "The group isn't running (paused or finished)", ok: running },
			{
				label: owesNothing ? "All contributions paid so far" : "You have a missed contribution to settle first",
				ok: owesNothing,
			},
			{ label: ahead ? "Payout has not been received" : "Your payout round has already started", ok: ahead },
			{
				label:
					round !== null && liveListing(db, group.id, round)
						? "This slot is already listed"
						: "No active listing or transfer for this slot",
				ok: round === null || !liveListing(db, group.id, round),
			},
		],
	};
}

/** Can `userId` request this listing? `except`: their own request being reviewed (it doesn't count against them). */
export function requestChecks(db: MockDb, listing: MockSlotListing, userId: string, except?: string): SlotCheckDto[] {
	const group = groupById(db, listing.groupId)!;
	const user = userById(db, userId);
	const wallet = user?.wallet?.publicKey;
	const outsider = !membership(db, group.id, userId);
	const busy = db.slotTakeovers.some(
		(t) => t.id !== except && t.toId === userId && t.groupId === group.id && (t.status === "voting" || t.status === "approved"),
	);
	const allowed = !(group.bans ?? []).includes(userId) && listing.sellerId !== userId;
	return [
		{
			label: wallet ? `Wallet connected · ${wallet.slice(0, 5)}…${wallet.slice(-4)}` : "Link a Stellar wallet to request a slot",
			ok: !!wallet,
		},
		{ label: outsider ? `No existing slot in ${group.name}` : `You already hold a slot in ${group.name}`, ok: outsider },
		{ label: busy ? "You already have a request open in this group" : "No other request open in this group", ok: !busy },
		{ label: allowed ? "Meets the group's entry conditions" : "Doesn't meet the group's entry conditions", ok: allowed },
	];
}

// ---------------------------------------------------------------- actions

export function createListing(
	db: MockDb,
	group: MockGroup,
	userId: string,
	input: { expiresAt?: string; reason?: string },
	at: string,
) {
	if (!membership(db, group.id, userId)) throw new RuleError(404, "NOT_FOUND", "Group not found.");
	const { round, checks } = listingChecks(db, group, userId, ms(at));
	if (round === null) throw conflict("You have no slot left to list in this group.");
	const failed = checks.find((c) => !c.ok);
	if (failed) throw conflict(failed.label + ".");
	const expires = input.expiresAt ? ms(input.expiresAt) : NaN;
	const roundOpens = dueAt(group, round, ms(at)) - intervalMs(group);
	if (Number.isNaN(expires) || expires <= ms(at)) throw badRequest("expiresAt must be a date in the future");
	if (expires > ms(at) + MAX_LISTING_DAYS * 24 * HOUR) throw badRequest(`A listing can run for at most ${MAX_LISTING_DAYS} days`);
	if (expires >= roundOpens) throw badRequest("The listing must end before your payout round opens");
	const reason = input.reason?.trim() || null;
	if (reason && reason.length > 280) throw badRequest("reason must be shorter than or equal to 280 characters");
	const listing: MockSlotListing = {
		id: uuid(),
		groupId: group.id,
		round,
		sellerId: userId,
		reason,
		createdAt: at,
		expiresAt: new Date(expires).toISOString(),
		status: "open",
	};
	db.slotListings.push(listing);
	return listing;
}

export function cancelListing(db: MockDb, listing: MockSlotListing, userId: string) {
	if (listing.sellerId !== userId) throw new RuleError(403, "FORBIDDEN", "Only the slot's owner can cancel the listing.");
	if (listing.status === "pending") throw conflict("A takeover request is under review. It has to be decided first.");
	if (listing.status !== "open") throw conflict("This listing is no longer open.");
	listing.status = "cancelled";
}

export function requestTakeover(db: MockDb, listing: MockSlotListing, userId: string, at: string) {
	if (listing.status === "pending") {
		const mine = db.slotTakeovers.some(
			(t) => t.listingId === listing.id && t.toId === userId && (t.status === "voting" || t.status === "approved"),
		);
		throw conflict(mine ? "You've already asked for this slot." : "Someone else's request for this slot is under review.");
	}
	if (listing.status !== "open") throw conflict("This slot is no longer available.");
	if (listing.sellerId === userId) throw conflict("This is your own slot.");
	const failed = requestChecks(db, listing, userId).find((c) => !c.ok);
	if (failed) throw conflict(failed.label + ".");
	const group = groupById(db, listing.groupId)!;
	const electorate = activeMembers(db, group.id)
		.map((m) => m.userId)
		.filter((id) => id !== listing.sellerId);
	const threshold = { kind: group.governance.thresholdKind, value: group.governance.thresholdValue };
	const takeover: MockTakeover = {
		id: uuid(),
		listingId: listing.id,
		groupId: group.id,
		round: listing.round,
		fromId: listing.sellerId,
		toId: userId,
		toWallet: userById(db, userId)!.wallet!.publicKey,
		requestedAt: at,
		electorate,
		required: requiredVotes(threshold, electorate.length),
		votes: [],
		votingEndsAt: listing.expiresAt,
		status: "voting",
		approvedAt: null,
		signBy: null,
		transferredAt: null,
		txHash: null,
	};
	db.slotTakeovers.push(takeover);
	listing.status = "pending";
	const who = firstName(userById(db, userId));
	const data = { groupId: group.id, takeoverId: takeover.id };
	notify(
		db,
		electorate,
		"proposal_created",
		at,
		`Slot takeover in ${group.name}`,
		`${who} asked to take over slot #${listing.round + 1}. Review it.`,
		data,
	);
	notify(
		db,
		[listing.sellerId],
		"proposal_created",
		at,
		"Someone wants your slot",
		`${who} asked to take over your slot in ${group.name}.`,
		data,
	);
	if (electorate.length === 0) approve(db, takeover, at);
	return takeover;
}

export function voteOnTakeover(db: MockDb, t: MockTakeover, userId: string, choice: "yes" | "no", at: string) {
	if (t.status !== "voting") throw conflict("Voting on this request has closed.");
	if (!t.electorate.includes(userId)) throw new RuleError(403, "FORBIDDEN", "You can't review this request.");
	if (t.votes.some((v) => v.userId === userId)) throw conflict("You have already voted. Votes are final.");
	t.votes.push({ userId, choice, at });
	const yes = t.votes.filter((v) => v.choice === "yes").length;
	const remaining = t.electorate.length - t.votes.length;
	if (yes >= t.required) approve(db, t, at);
	else if (yes + remaining < t.required) close(db, t, "rejected", at);
}

function approve(db: MockDb, t: MockTakeover, at: string) {
	const group = groupById(db, t.groupId)!;
	t.status = "approved";
	t.approvedAt = at;
	t.signBy = addMs(at, group.governance.executionWindowHours * HOUR);
	notify(
		db,
		[t.toId],
		"proposal_approved",
		at,
		"Takeover approved",
		`Sign the transfer to take over slot #${t.round + 1} in ${group.name}.`,
		{
			groupId: group.id,
			takeoverId: t.id,
		},
	);
}

/** Ends a request without a transfer; the listing reopens while it still has time. */
function close(db: MockDb, t: MockTakeover, status: "rejected" | "expired" | "withdrawn", at: string) {
	t.status = status;
	const listing = db.slotListings.find((l) => l.id === t.listingId)!;
	if (listing.status === "pending") listing.status = ms(listing.expiresAt) > ms(at) ? "open" : "expired";
	if (status === "rejected") {
		const group = groupById(db, t.groupId)!;
		notify(
			db,
			[t.toId, t.fromId],
			"proposal_rejected",
			at,
			"Takeover not approved",
			`The group didn't approve the takeover of slot #${t.round + 1} in ${group.name}.`,
			{
				groupId: group.id,
				takeoverId: t.id,
			},
		);
	}
}

export function withdrawTakeover(db: MockDb, t: MockTakeover, userId: string, at: string) {
	if (t.toId !== userId) throw new RuleError(403, "FORBIDDEN", "Only the person who asked can withdraw the request.");
	if (t.status !== "voting" && t.status !== "approved") throw conflict("This request is already closed.");
	close(db, t, "withdrawn", at);
}

/**
 * The incoming member signs the Soroban transfer. Everything is checked again against the group as
 * it is now: the slot must still belong to the outgoing owner, its payout still ahead, the outgoing
 * owner must owe nothing missed, and the incoming member must still hold no slot in the group.
 */
export function signTakeover(db: MockDb, t: MockTakeover, userId: string, at: string) {
	if (t.toId !== userId) throw new RuleError(403, "FORBIDDEN", "Only the incoming member signs the transfer.");
	if (t.status === "transferred") throw conflict("This slot has already been transferred.");
	if (t.status !== "approved") throw conflict("The group hasn't approved this request.");
	if (t.signBy && ms(at) > ms(t.signBy)) throw conflict("The time to sign has passed.");
	const group = groupById(db, t.groupId)!;
	const cycle = group.cycle;
	const changed = (why: string) => conflict(`The transfer can't go through: ${why}.`);
	if (!cycle || group.status !== "active") throw changed("the group isn't running");
	if (cycle.schedule[t.round] !== t.fromId) throw changed("the slot changed owner");
	if (!payoutAhead(group, t.round, ms(at))) throw changed("the slot's payout round has started");
	if (membership(db, group.id, t.toId)) throw changed("you already hold a slot in this group");
	if (openDefaults(db, group.id).some((d) => d.userId === t.fromId))
		throw changed("the current owner has a missed contribution to settle");

	cycle.schedule[t.round] = t.toId;
	cycle.stateVersion += 1;
	const seller = membership(db, group.id, t.fromId);
	if (seller) seller.removedAt = at;
	db.members.push({ groupId: group.id, userId: t.toId, role: "member", joinedAt: at, removedAt: null });
	t.status = "transferred";
	t.transferredAt = at;
	t.txHash = txHash();
	db.slotListings.find((l) => l.id === t.listingId)!.status = "transferred";
	const who = `${firstName(userById(db, t.fromId))} → ${firstName(userById(db, t.toId))}`;
	notify(
		db,
		[...activeMembers(db, group.id).map((m) => m.userId), t.fromId],
		"proposal_executed",
		at,
		"Slot transferred",
		`Slot #${t.round + 1} in ${group.name} moved ${who}. Its contribution and payout records stay with the slot.`,
		{ groupId: group.id, takeoverId: t.id },
	);
}

// ---------------------------------------------------------------- the passage of time

/** Expiries, and what simulated members do: request people's listings, review requests, sign. */
function tickSlots(db: MockDb, at: number): boolean {
	let changed = false;
	const iso = (t: number) => new Date(Math.min(t, at)).toISOString();

	for (const t of db.slotTakeovers) {
		if (t.status === "voting" && ms(t.votingEndsAt) <= at) {
			close(db, t, "expired", t.votingEndsAt);
			changed = true;
		} else if (t.status === "approved" && t.signBy && ms(t.signBy) <= at) {
			close(db, t, "expired", t.signBy);
			changed = true;
		}
	}
	for (const l of db.slotListings) {
		if (l.status === "open" && ms(l.expiresAt) <= at) {
			l.status = "expired";
			changed = true;
		}
	}

	// A simulated outsider asks for a slot a person listed, so the seller sees the flow through.
	for (const l of db.slotListings.filter((x) => x.status === "open" && !isBot(db, x.sellerId))) {
		const when = ms(l.createdAt) + BOT_REQUEST_AFTER;
		if (when > at) continue;
		const bot = db.users.find((u) => u.bot && u.wallet && requestChecks(db, l, u.id).every((c) => c.ok));
		if (!bot) continue;
		requestTakeover(db, l, bot.id, iso(when));
		changed = true;
	}

	// Simulated reviewers vote; yes-voters stop one short while a person still has to decide.
	for (const t of db.slotTakeovers.filter((x) => x.status === "voting")) {
		const people = t.electorate.filter((id) => !isBot(db, id) && !t.votes.some((v) => v.userId === id));
		const bots = t.electorate.filter((id) => isBot(db, id) && !t.votes.some((v) => v.userId === id));
		for (const [i, botId] of bots.entries()) {
			const when = ms(t.requestedAt) + (t.votes.length + i + 1) * BOT_VOTE_AFTER;
			if (when > at || t.status !== "voting") break;
			const choice = userById(db, botId)!.bot!.votes;
			const yes = t.votes.filter((v) => v.choice === "yes").length;
			if (choice === "yes" && people.length > 0 && yes + 1 >= t.required) continue;
			voteOnTakeover(db, t, botId, choice, iso(when));
			changed = true;
		}
	}

	// A simulated incoming member signs once approved.
	for (const t of db.slotTakeovers.filter((x) => x.status === "approved" && isBot(db, x.toId))) {
		const when = ms(t.approvedAt!) + BOT_SIGN_AFTER;
		if (when > at) continue;
		try {
			signTakeover(db, t, t.toId, iso(when));
		} catch {
			close(db, t, "expired", iso(when));
		}
		changed = true;
	}
	return changed;
}

tickHooks.push(tickSlots);

// ---------------------------------------------------------------- DTOs

function groupDto(db: MockDb, group: MockGroup): SlotGroupDto {
	return {
		id: group.id,
		name: group.name,
		memberCount: activeMembers(db, group.id).length,
		totalRounds: group.cycle?.schedule.length ?? 0,
		asset: "USDC",
	};
}

/** Everyone who has owned slot `round`, first owner first. */
function owners(db: MockDb, group: MockGroup, round: number) {
	const moves = db.slotTakeovers
		.filter((t) => t.groupId === group.id && t.round === round && t.status === "transferred")
		.sort((a, b) => ms(a.transferredAt!) - ms(b.transferredAt!));
	const current = group.cycle!.schedule[round]!;
	return moves.length ? [moves[0]!.fromId, ...moves.map((m) => m.toId)] : [current];
}

/** The slot's preserved history: what each of its owners paid in, and its payout (made or scheduled). */
function slotHistory(db: MockDb, group: MockGroup, round: number, at: number): SlotHistoryItemDto[] {
	const ids = new Set(owners(db, group, round));
	const items: SlotHistoryItemDto[] = db.contributions
		.filter((c) => c.groupId === group.id && ids.has(c.userId))
		.map((c) => ({
			kind: "contribution",
			member: memberPreview(db, c.userId),
			amount: c.amount,
			at: c.paidAt,
			scheduled: false,
			txHash: c.txHash,
		}));
	const payout = db.payouts.find((p) => p.groupId === group.id && p.round === round);
	if (payout) {
		items.push({
			kind: "payout",
			member: memberPreview(db, payout.userId),
			amount: payout.amount,
			at: payout.paidAt,
			scheduled: false,
			txHash: payout.txHash,
		});
	} else if (group.status === "active") {
		const terms = slotTerms(db, group, round, group.cycle!.schedule[round]!, at);
		items.push({
			kind: "payout",
			member: memberPreview(db, group.cycle!.schedule[round]!),
			amount: terms.payoutAmount,
			at: terms.payoutAt,
			scheduled: true,
			txHash: null,
		});
	}
	return items.sort((a, b) => ms(a.at) - ms(b.at));
}

export function takeoverDto(db: MockDb, t: MockTakeover, viewerId: string, at: number): SlotTakeoverDto {
	const group = groupById(db, t.groupId)!;
	const listing = db.slotListings.find((l) => l.id === t.listingId)!;
	const yes = t.votes.filter((v) => v.choice === "yes").length;
	const owner = t.status === "transferred" ? t.toId : t.fromId;
	return {
		id: t.id,
		listingId: t.listingId,
		status: t.status,
		group: groupDto(db, group),
		round: t.round,
		slotNumber: t.round + 1,
		from: memberPreview(db, t.fromId),
		to: memberPreview(db, t.toId),
		toWallet: t.toWallet,
		requestedAt: t.requestedAt,
		votingEndsAt: t.votingEndsAt,
		required: t.required,
		eligible: t.electorate.length,
		yes,
		no: t.votes.length - yes,
		myVote: t.votes.find((v) => v.userId === viewerId)?.choice ?? null,
		canVote: t.status === "voting" && t.electorate.includes(viewerId) && !t.votes.some((v) => v.userId === viewerId),
		canSign: t.status === "approved" && t.toId === viewerId && (!t.signBy || ms(t.signBy) > at),
		canWithdraw: (t.status === "voting" || t.status === "approved") && t.toId === viewerId,
		checks:
			t.status === "voting" || t.status === "approved"
				? requestChecks(db, listing, t.toId, t.id)
				: [
						{ label: `Connected wallet · ${t.toWallet.slice(0, 5)}…${t.toWallet.slice(-4)}`, ok: true },
						{ label: "No duplicate ownership in this group", ok: true },
						{ label: "Group eligibility conditions satisfied", ok: true },
					],
		approvedAt: t.approvedAt,
		signBy: t.signBy,
		transferredAt: t.transferredAt,
		txHash: t.txHash,
		terms: group.cycle && group.status === "active" ? slotTerms(db, group, t.round, owner, at) : emptyTerms(group),
		history: group.cycle ? slotHistory(db, group, t.round, at) : [],
	};
}

function emptyTerms(group: MockGroup): SlotTermsDto {
	return {
		contributionAmount: group.contributionAmount,
		frequency: group.frequency,
		customIntervalDays: group.customIntervalDays,
		remainingContributions: 0,
		remainingAmount: "0.00",
		payoutAmount: "0.00",
		payoutAt: group.createdAt,
		lastContributionAt: null,
		schedule: [],
	};
}

/** Who may see a takeover: the two people in it, and the group's members. */
export const canSeeTakeover = (db: MockDb, t: MockTakeover, userId: string) =>
	t.toId === userId || t.fromId === userId || !!membership(db, t.groupId, userId);

export function listingDto(db: MockDb, l: MockSlotListing, viewerId: string, at: number): SlotListingDto {
	const group = groupById(db, l.groupId)!;
	const live = db.slotTakeovers.find(
		(t) => t.listingId === l.id && (t.status === "voting" || t.status === "approved" || t.status === "transferred"),
	);
	const mine = l.sellerId === viewerId;
	const running = group.cycle && group.status === "active";
	return {
		id: l.id,
		status: l.status,
		group: groupDto(db, group),
		round: l.round,
		slotNumber: l.round + 1,
		seller: memberPreview(db, l.sellerId),
		reason: l.reason,
		createdAt: l.createdAt,
		expiresAt: l.expiresAt,
		terms: running ? slotTerms(db, group, l.round, l.sellerId, at) : emptyTerms(group),
		mine,
		approval: (() => {
			const eligible = activeMembers(db, group.id).filter((m) => m.userId !== l.sellerId).length;
			return {
				eligible,
				required: requiredVotes({ kind: group.governance.thresholdKind, value: group.governance.thresholdValue }, eligible),
			};
		})(),
		eligibility: mine
			? null
			: (() => {
					const checks = requestChecks(db, l, viewerId);
					return { canRequest: l.status === "open" && checks.every((c) => c.ok), checks };
				})(),
		takeover: live && canSeeTakeover(db, live, viewerId) ? takeoverDto(db, live, viewerId, at) : null,
	};
}

export function mySlotDto(db: MockDb, group: MockGroup, userId: string, at: number): MySlotDto | null {
	const { round, checks } = listingChecks(db, group, userId, at);
	if (round === null || !group.cycle) return null;
	const listing = liveListing(db, group.id, round);
	return {
		round,
		slotNumber: round + 1,
		totalRounds: group.cycle.schedule.length,
		paidOut: group.cycle.paidOut[round] ?? false,
		terms: slotTerms(db, group, round, userId, at),
		canList: checks.every((c) => c.ok),
		checks,
		listing: listing ? listingDto(db, listing, userId, at) : null,
	};
}
