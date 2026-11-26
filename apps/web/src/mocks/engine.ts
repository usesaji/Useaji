import { addMs, DAY, HOUR, ms } from "@/mocks/clock";
import { anchorHash, stellarAccount, txHash, uuid } from "@/mocks/ids";
import type { MockDb, MockDefault, MockGroup, MockMember, MockProposal, MockUser } from "@/mocks/types";
import type { CreateProposalDto, GroupEventKind, NotificationKind, RecoveryAction } from "@/lib/api/dto";

/**
 * The savings-cycle and governance rules, as the Railway API describes them (docs/openapi.json):
 *
 * - A round's deadline is one interval after it opens; contributions are accepted with the late fee
 *   until the grace period ends. The round's recipient doesn't pay into their own pot.
 * - Once everyone who owes has paid, the pot (less the service charge) goes to the recipient and
 *   the next round opens on schedule. After the last round the group completes.
 * - After the grace period, every member who hasn't paid gets an on-chain default and the group is
 *   in recovery: payouts wait for the group's decision.
 * - Proposals: `pause`, `resume`, `update_schedule`, `recovery`. The electorate is fixed at creation
 *   (members in default can't vote on recovery). Reaching the threshold approves and executes at
 *   once; when no outcome can change any more it is rejected; it expires after the voting period,
 *   or after the execution window if it never executed.
 *
 * Every function takes the time it acts at (`at`), so the seed can replay history and the dev
 * panel can skip ahead.
 */

// ---------------------------------------------------------------- money

export const money = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
export const num = (s: string | null | undefined) => Number(s ?? 0);

// ---------------------------------------------------------------- lookups

export const userById = (db: MockDb, id: string) => db.users.find((u) => u.id === id);

export function displayName(user: MockUser | undefined) {
	if (!user) return "A member";
	return user.profile ? `${user.profile.firstName} ${user.profile.lastName}` : user.email.split("@")[0]!;
}

export const firstName = (user: MockUser | undefined) => user?.profile?.firstName ?? displayName(user).split(" ")[0]!;

export const groupById = (db: MockDb, id: string) => db.groups.find((g) => g.id === id);

/** Members still in the group (removed members drop out). */
export const activeMembers = (db: MockDb, groupId: string) =>
	db.members.filter((m) => m.groupId === groupId && !m.removedAt).sort((a, b) => ms(a.joinedAt) - ms(b.joinedAt));

export const membership = (db: MockDb, groupId: string, userId: string): MockMember | undefined =>
	db.members.find((m) => m.groupId === groupId && m.userId === userId && !m.removedAt);

export const admins = (db: MockDb, groupId: string) =>
	activeMembers(db, groupId)
		.filter((m) => m.role === "admin")
		.map((m) => m.userId);

export function intervalMs(group: MockGroup) {
	switch (group.frequency) {
		case "daily":
			return DAY;
		case "weekly":
			return 7 * DAY;
		case "biweekly":
			return 14 * DAY;
		case "monthly":
			return 30 * DAY;
		default:
			return (group.customIntervalDays ?? 7) * DAY;
	}
}

/** The late fee on one contribution. */
export function lateFee(group: MockGroup) {
	if (!group.lateFee) return 0;
	return group.lateFee.kind === "fixed"
		? num(group.lateFee.value)
		: (num(group.contributionAmount) * num(group.lateFee.value)) / 100;
}

/** Current round timing. While paused, the clock stops: deadlines move out by the time paused. */
export function roundTiming(group: MockGroup, at: number) {
	const cycle = group.cycle!;
	const pausedFor = cycle.paused ? Math.max(0, at - ms(cycle.paused.since)) : 0;
	const opened = ms(cycle.roundStartedAt) + pausedFor;
	const deadline = opened + intervalMs(group);
	// `start_recovery` groups have no grace: recovery begins at the deadline (as `CycleDto.graceEndsAt`).
	const graceEndsAt = group.missedGracePolicy === "start_recovery" ? deadline : deadline + group.gracePeriodDays * DAY;
	return { opened, deadline, graceEndsAt };
}

export const recipientOf = (group: MockGroup, round: number) => group.cycle?.schedule[round] ?? null;

export const openDefaults = (db: MockDb, groupId: string) => db.defaults.filter((d) => d.groupId === groupId && !d.resolution);

/**
 * Whether `userId`'s slot has paid `round`. A slot taken over keeps its payments: what the previous
 * owner paid this round counts for the new one (v3 slot transfers), so nobody pays a round twice.
 */
export const paidThisRound = (db: MockDb, groupId: string, round: number, userId: string) =>
	db.contributions.some(
		(c) =>
			c.groupId === groupId &&
			c.round === round &&
			(c.userId === userId ||
				db.slotTakeovers.some(
					(t) => t.groupId === groupId && t.status === "transferred" && t.toId === userId && t.fromId === c.userId,
				)),
	);

/** What `userId` has paid into one group. */
export const totalSavedIn = (db: MockDb, groupId: string, userId: string) =>
	db.contributions.filter((c) => c.groupId === groupId && c.userId === userId).reduce((sum, c) => sum + num(c.amount), 0);

/** Who owes the current round: active members except the recipient. */
/** Everyone owes every round, the round's recipient included (the pot is the sum of what was paid). */
export function payersOf(db: MockDb, group: MockGroup, round: number) {
	void round;
	return activeMembers(db, group.id).map((m) => m.userId);
}

/** What `userId` owes this round right now, or null (paid, in default, not due). */
export function amountDue(db: MockDb, group: MockGroup, userId: string, at: number): number | null {
	const cycle = group.cycle;
	if (!cycle || group.status !== "active" || cycle.paused) return null;
	if (!payersOf(db, group, cycle.round).includes(userId)) return null;
	if (paidThisRound(db, group.id, cycle.round, userId)) return null;
	if (db.defaults.some((d) => d.groupId === group.id && d.round === cycle.round && d.userId === userId)) return null;
	const { deadline, graceEndsAt } = roundTiming(group, at);
	if (at > graceEndsAt) return null;
	return num(group.contributionAmount) + (at > deadline ? lateFee(group) : 0);
}

// ---------------------------------------------------------------- records

export function recordEvent(
	db: MockDb,
	groupId: string,
	kind: GroupEventKind,
	at: string,
	actorId: string | null,
	data: Record<string, unknown> = {},
	payment?: string,
) {
	db.events.push({
		id: uuid(),
		groupId,
		kind,
		actorId,
		data,
		// Payments are their own transaction; everything else is anchored by a memo-hash transaction.
		txHash: payment ?? txHash(),
		anchorHash: payment ? null : anchorHash(),
		createdAt: at,
	});
}

export function notify(
	db: MockDb,
	userIds: string[],
	kind: NotificationKind,
	at: string,
	title: string,
	body: string,
	data: Record<string, unknown>,
) {
	for (const userId of new Set(userIds)) {
		db.notifications.push({ id: uuid(), userId, kind, title, body, data, readAt: null, createdAt: at });
	}
}

const memberIds = (db: MockDb, groupId: string) => activeMembers(db, groupId).map((m) => m.userId);

// ---------------------------------------------------------------- cycle

export class RuleError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
		message: string,
	) {
		super(message);
	}
}

/** POST /groups/{id}/start */
export function startCycle(db: MockDb, group: MockGroup, actorId: string, at: string, schedule?: string[]) {
	if (group.status !== "forming") throw new RuleError(409, "CONFLICT", "The savings cycle has already started.");
	const members = memberIds(db, group.id);
	if (members.length < 2) throw new RuleError(409, "CONFLICT", "You need at least 2 members to start.");
	let order: string[];
	if (group.payoutOrder === "manual" || group.payoutOrder === "custom") {
		if (!schedule) throw new RuleError(400, "BAD_REQUEST", "Choose the payout order first.");
		const same = schedule.length === members.length && members.every((id) => schedule.includes(id));
		if (!same) throw new RuleError(400, "BAD_REQUEST", "The payout order must list every member exactly once.");
		order = schedule;
	} else if (group.payoutOrder === "random") {
		order = [...members].sort(() => Math.random() - 0.5);
	} else {
		order = members; // vote: join order, changeable by proposal
	}
	group.status = "active";
	group.cycle = {
		startedAt: at,
		round: 0,
		roundStartedAt: at,
		schedule: order,
		paidOut: order.map(() => false),
		paused: null,
		stateVersion: 1,
		escrowAccount: stellarAccount(),
	};
	db.joinRequests = db.joinRequests.filter((r) => r.groupId !== group.id);
	recordEvent(db, group.id, "group_started", at, actorId, {
		rounds: order.length,
		schedule: order,
		firstDeadline: new Date(roundTiming(group, ms(at)).deadline).toISOString(),
	});
	notify(
		db,
		members,
		"group_started",
		at,
		`${group.name} has started`,
		"The savings cycle is live. Round 1 is open for contributions.",
		{
			groupId: group.id,
		},
	);
}

/** POST /groups/{id}/contributions — and a bot paying. Returns the contribution id. */
export function contribute(db: MockDb, group: MockGroup, userId: string, at: string, hash: string) {
	const cycle = group.cycle;
	if (!cycle || group.status !== "active") throw new RuleError(409, "CONFLICT", "This group is not active.");
	if (cycle.paused) throw new RuleError(409, "CONFLICT", "The group is paused. Contributions restart when it resumes.");
	const due = amountDue(db, group, userId, ms(at));
	if (paidThisRound(db, group.id, cycle.round, userId)) throw new RuleError(409, "CONFLICT", "You have already paid this round.");
	if (due === null) throw new RuleError(409, "CONFLICT", "Nothing is due from you this round, or the grace period is over.");
	const { deadline } = roundTiming(group, ms(at));
	const id = uuid();
	db.contributions.push({
		id,
		groupId: group.id,
		round: cycle.round,
		userId,
		amount: money(due),
		paidAt: at,
		late: ms(at) > deadline,
		txHash: hash,
	});
	cycle.stateVersion += 1;
	recordEvent(
		db,
		group.id,
		"contribution_made",
		at,
		userId,
		{ round: cycle.round, amount: money(due), late: ms(at) > deadline },
		hash,
	);
	tryPayout(db, group, at);
	return id;
}

/** Pays the round out once nobody owes it any more. */
export function tryPayout(db: MockDb, group: MockGroup, at: string) {
	const cycle = group.cycle;
	if (!cycle || group.status !== "active" || cycle.paused) return false;
	if (cycle.paidOut[cycle.round]) return false;
	// Payouts wait for the group's decision while any default is open.
	if (openDefaults(db, group.id).length > 0) return false;
	const round = cycle.round;
	const owing = payersOf(db, group, round).filter(
		(id) =>
			!paidThisRound(db, group.id, round, id) &&
			// a resolved default (written off, member removed) no longer holds the round
			!db.defaults.some((d) => d.groupId === group.id && d.round === round && d.userId === id && d.resolution),
	);
	if (owing.length > 0) return false;
	const recipient = recipientOf(group, round)!;
	const pot = db.contributions
		.filter((c) => c.groupId === group.id && c.round === round)
		.reduce((sum, c) => sum + num(c.amount), 0);
	const amount = pot * (1 - num(group.serviceChargePercent) / 100);
	const hash = txHash();
	db.payouts.push({ id: uuid(), groupId: group.id, round, userId: recipient, amount: money(amount), paidAt: at, txHash: hash });
	cycle.paidOut[round] = true;
	cycle.stateVersion += 1;
	recordEvent(db, group.id, "payout_made", at, null, { round, amount: money(amount), recipientId: recipient }, hash);
	notify(
		db,
		[recipient],
		"payout_received",
		at,
		"You received a payout",
		`${money(amount)} ${group.asset} from ${group.name} was sent to your payout address.`,
		{
			groupId: group.id,
			round,
		},
	);
	if (round >= cycle.schedule.length - 1) {
		group.status = "completed";
		recordEvent(db, group.id, "group_completed", at, null, { rounds: cycle.schedule.length });
	} else {
		cycle.round = round + 1;
		// The next round opens on schedule (or now, if that time has passed).
		cycle.roundStartedAt = new Date(Math.max(ms(cycle.roundStartedAt) + intervalMs(group), ms(at))).toISOString();
	}
	return true;
}

/** POST /groups/{id}/defaults/detect — and the scanner. Returns how many were recorded. */
export function detectDefaults(db: MockDb, group: MockGroup, at: number) {
	const cycle = group.cycle;
	if (!cycle || group.status !== "active" || cycle.paused) return 0;
	const { graceEndsAt } = roundTiming(group, at);
	if (at <= graceEndsAt) return 0;
	const when = new Date(graceEndsAt).toISOString();
	const wasInRecovery = openDefaults(db, group.id).length > 0;
	let recorded = 0;
	for (const userId of payersOf(db, group, cycle.round)) {
		if (paidThisRound(db, group.id, cycle.round, userId)) continue;
		if (db.defaults.some((d) => d.groupId === group.id && d.round === cycle.round && d.userId === userId)) continue;
		const id = uuid();
		const amount = money(num(group.contributionAmount) + lateFee(group));
		db.defaults.push({
			id,
			groupId: group.id,
			round: cycle.round,
			userId,
			amount,
			deadline: when,
			detectedAt: when,
			txHash: txHash(),
			graceUntil: null,
			resolution: null,
		});
		recordEvent(db, group.id, "default_recorded", when, null, { defaultId: id, round: cycle.round, userId, amount });
		const who = displayName(userById(db, userId));
		notify(
			db,
			[userId],
			"contribution_missed",
			when,
			"You missed a contribution",
			`Your round ${cycle.round + 1} contribution to ${group.name} is overdue. Pay it to end the recovery.`,
			{
				groupId: group.id,
				defaultId: id,
			},
		);
		notify(
			db,
			memberIds(db, group.id).filter((m) => m !== userId),
			"contribution_missed",
			when,
			`${who} missed a contribution`,
			`${group.name} is in recovery until the group decides what to do.`,
			{ groupId: group.id, defaultId: id },
		);
		recorded += 1;
	}
	if (recorded > 0) {
		cycle.stateVersion += 1;
		if (!wasInRecovery) {
			recordEvent(db, group.id, "recovery_started", when, null, { round: cycle.round });
			notify(
				db,
				memberIds(db, group.id),
				"recovery_started",
				when,
				`${group.name} is in recovery`,
				"Payouts wait until members agree how to resolve the missed contribution.",
				{
					groupId: group.id,
				},
			);
		}
	}
	return recorded;
}

/** Actions a recovery proposal may choose for this default now. */
export function availableActions(db: MockDb, d: MockDefault, at: number): RecoveryAction[] {
	if (d.resolution) return [];
	// A grace extension is running: wait for the member to pay before choosing again.
	if (d.graceUntil && ms(d.graceUntil) > at) return [];
	const group = groupById(db, d.groupId);
	const stillMember = !!membership(db, d.groupId, d.userId);
	const actions: RecoveryAction[] = ["grace_extension", "write_off"];
	// Removing needs someone left to save with.
	if (stillMember && group && activeMembers(db, group.id).length > 2) actions.push("remove_member");
	return actions;
}

/** Resolves a default and, when it was the last open one, ends the recovery. */
function resolveDefault(
	db: MockDb,
	group: MockGroup,
	d: MockDefault,
	kind: "settled" | "written_off" | "member_removed",
	at: string,
	proposalId: string | null,
	hash: string,
) {
	d.resolution = { kind, proposalId, txHash: hash, resolvedAt: at };
	recordEvent(db, group.id, "default_resolved", at, null, {
		defaultId: d.id,
		resolution: kind,
		...(kind === "settled" ? { round: d.round } : {}),
		...(proposalId ? { proposalId } : {}),
	});
	if (openDefaults(db, group.id).length === 0) {
		recordEvent(db, group.id, "recovery_resolved", at, null, { round: d.round });
		notify(
			db,
			memberIds(db, group.id),
			"recovery_resolved",
			at,
			`${group.name} is saving again`,
			"The missed contribution was resolved and the cycle has resumed.",
			{
				groupId: group.id,
			},
		);
	}
	group.cycle!.stateVersion += 1;
}

/** POST /groups/{id}/defaults/{defaultId}/settle — the member in default pays what they owe. */
export function settleDefault(db: MockDb, group: MockGroup, d: MockDefault, userId: string, at: string, hash: string) {
	if (d.userId !== userId) throw new RuleError(403, "FORBIDDEN", "Only the member in default can pay it.");
	if (d.resolution) throw new RuleError(409, "CONFLICT", "This missed contribution is already resolved.");
	db.contributions.push({
		id: uuid(),
		groupId: group.id,
		round: d.round,
		userId,
		amount: d.amount,
		paidAt: at,
		late: true,
		txHash: hash,
	});
	recordEvent(db, group.id, "contribution_made", at, userId, { round: d.round, amount: d.amount, late: true }, hash);
	resolveDefault(db, group, d, "settled", at, null, hash);
	tryPayout(db, group, at);
}

// ---------------------------------------------------------------- governance

export function requiredVotes(threshold: { kind: "percent" | "count"; value: number }, eligible: number) {
	if (eligible === 0) return 0;
	return threshold.kind === "percent"
		? Math.max(1, Math.ceil((eligible * threshold.value) / 100))
		: Math.min(threshold.value, eligible);
}

const SIMILAR_OPEN = (p: MockProposal) => p.status === "active" || p.status === "approved";

/** POST /groups/{id}/proposals */
export function createProposal(db: MockDb, group: MockGroup, proposerId: string, input: CreateProposalDto, at: string) {
	const cycle = group.cycle;
	if (!membership(db, group.id, proposerId)) throw new RuleError(404, "NOT_FOUND", "Group not found.");
	if (!cycle || group.status !== "active")
		throw new RuleError(400, "BAD_REQUEST", "Proposals open once the savings cycle has started.");
	const open = db.proposals.filter((p) => p.groupId === group.id && SIMILAR_OPEN(p));
	let electorate = memberIds(db, group.id);
	let recovery: MockProposal["recovery"] = null;
	let scheduleChange: MockProposal["scheduleChange"] = null;

	switch (input.type) {
		case "pause":
			if (cycle.paused) throw new RuleError(409, "CONFLICT", "The group is already paused.");
			if (open.some((p) => p.type === "pause")) throw new RuleError(409, "CONFLICT", "A pause proposal is already open.");
			break;
		case "resume":
			if (!cycle.paused) throw new RuleError(409, "CONFLICT", "The group isn't paused.");
			if (open.some((p) => p.type === "resume")) throw new RuleError(409, "CONFLICT", "A resume proposal is already open.");
			break;
		case "update_schedule": {
			if (open.some((p) => p.type === "update_schedule"))
				throw new RuleError(409, "CONFLICT", "A schedule change is already open.");
			const from = input.fromRound;
			if (from === undefined || from <= cycle.round || from >= cycle.schedule.length) {
				throw new RuleError(400, "BAD_REQUEST", "fromRound must be a future round.");
			}
			const current = cycle.schedule.slice(from);
			const next = input.recipients ?? [];
			const same = next.length === current.length && [...next].sort().join() === [...current].sort().join();
			if (!same) throw new RuleError(400, "BAD_REQUEST", "recipients must reorder the members due from fromRound onward.");
			if (next.every((id, i) => id === current[i])) throw new RuleError(400, "BAD_REQUEST", "That is the current order.");
			scheduleChange = { fromRound: from, recipients: next };
			break;
		}
		case "recovery": {
			const d = db.defaults.find((x) => x.id === input.defaultId && x.groupId === group.id);
			if (!d || d.resolution) throw new RuleError(400, "BAD_REQUEST", "Choose an open missed contribution.");
			if (!input.recoveryAction || !availableActions(db, d, ms(at)).includes(input.recoveryAction)) {
				throw new RuleError(409, "CONFLICT", "That recovery action does not apply now.");
			}
			if (open.some((p) => p.type === "recovery" && p.recovery?.defaultId === d.id)) {
				throw new RuleError(409, "CONFLICT", "A recovery proposal for this missed contribution is already open.");
			}
			let graceUntil: string | null = null;
			if (input.recoveryAction === "grace_extension") {
				if (!input.graceUntil || ms(input.graceUntil) <= ms(at))
					throw new RuleError(400, "BAD_REQUEST", "graceUntil must be in the future.");
				graceUntil = new Date(input.graceUntil).toISOString();
			}
			recovery = { defaultId: d.id, action: input.recoveryAction, graceUntil };
			// Members in default can't vote on recovery.
			const inDefault = new Set(openDefaults(db, group.id).map((x) => x.userId));
			electorate = electorate.filter((id) => !inDefault.has(id));
			break;
		}
	}

	const threshold = { kind: group.governance.thresholdKind, value: group.governance.thresholdValue };
	const proposal: MockProposal = {
		id: uuid(),
		groupId: group.id,
		number: db.proposals.filter((p) => p.groupId === group.id).length + 1,
		type: input.type,
		description: input.description,
		proposerId,
		threshold,
		required: requiredVotes(threshold, electorate.length),
		electorate,
		votes: [],
		status: "active",
		createdAt: at,
		votingEndsAt: addMs(at, group.governance.votingPeriodHours * HOUR),
		executeBy: null,
		executedAt: null,
		executionTxHash: null,
		scheduleChange,
		recovery,
	};
	db.proposals.push(proposal);
	recordEvent(db, group.id, "proposal_created", at, proposerId, {
		proposalId: proposal.id,
		number: proposal.number,
		type: proposal.type,
	});
	notify(
		db,
		electorate.filter((id) => id !== proposerId),
		"proposal_created",
		at,
		`New proposal in ${group.name}`,
		`${firstName(userById(db, proposerId))} proposed: ${input.description}`,
		{
			groupId: group.id,
			proposalId: proposal.id,
		},
	);
	return proposal;
}

/** POST …/proposals/{id}/votes — and a bot voting. */
export function castVote(db: MockDb, p: MockProposal, userId: string, choice: "yes" | "no", at: string) {
	if (p.status !== "active") throw new RuleError(409, "CONFLICT", "Voting on this proposal has closed.");
	if (!p.electorate.includes(userId)) throw new RuleError(403, "FORBIDDEN", "You can't vote on this proposal.");
	if (p.votes.some((v) => v.userId === userId)) throw new RuleError(409, "CONFLICT", "You have already voted. Votes are final.");
	p.votes.push({ userId, choice, at });
	recordEvent(db, p.groupId, "vote_cast", at, userId, {
		proposalId: p.id,
		number: p.number,
		choice,
		yes: p.votes.filter((v) => v.choice === "yes").length,
		no: p.votes.filter((v) => v.choice === "no").length,
	});
	evaluate(db, p, at);
}

/** Checks the threshold after a vote. */
function evaluate(db: MockDb, p: MockProposal, at: string) {
	const yes = p.votes.filter((v) => v.choice === "yes").length;
	const remaining = p.electorate.length - p.votes.length;
	const group = groupById(db, p.groupId)!;
	if (yes >= p.required) {
		p.status = "approved";
		p.executeBy = addMs(at, group.governance.executionWindowHours * HOUR);
		recordEvent(db, p.groupId, "proposal_approved", at, null, {
			proposalId: p.id,
			number: p.number,
			yes,
			no: p.votes.length - yes,
			required: p.required,
		});
		notify(
			db,
			memberIds(db, group.id),
			"proposal_approved",
			at,
			"Proposal approved",
			`${proposalTitle(db, p)} reached its threshold.`,
			{
				groupId: group.id,
				proposalId: p.id,
			},
		);
		try {
			execute(db, p, at);
		} catch {
			// Stays approved: any member can retry with POST …/execute until executeBy.
		}
	} else if (yes + remaining < p.required) {
		p.status = "rejected";
		recordEvent(db, p.groupId, "proposal_rejected", at, null, {
			proposalId: p.id,
			number: p.number,
			yes,
			no: p.votes.length - yes,
			required: p.required,
		});
		notify(
			db,
			memberIds(db, group.id),
			"proposal_rejected",
			at,
			"Proposal rejected",
			`${proposalTitle(db, p)} can no longer reach its threshold.`,
			{
				groupId: group.id,
				proposalId: p.id,
			},
		);
	}
}

/** Carries out an approved proposal. Re-checks the action against the group's current state. */
export function execute(db: MockDb, p: MockProposal, at: string) {
	if (p.status !== "approved") throw new RuleError(409, "CONFLICT", "Only an approved proposal can execute.");
	if (p.executeBy && ms(at) > ms(p.executeBy)) throw new RuleError(409, "CONFLICT", "The execution window has passed.");
	const group = groupById(db, p.groupId)!;
	const cycle = group.cycle!;
	const changed = () => new RuleError(409, "CONFLICT", "The group changed since this was proposed, so it can no longer execute.");
	const hash = txHash();

	switch (p.type) {
		case "pause":
			if (cycle.paused || group.status !== "active") throw changed();
			cycle.paused = { since: at, proposalId: p.id };
			recordEvent(db, group.id, "group_paused", at, null, { proposalId: p.id });
			break;
		case "resume": {
			if (!cycle.paused) throw changed();
			// The clock stopped while paused: the round reopens with its time intact.
			cycle.roundStartedAt = addMs(cycle.roundStartedAt, Math.max(0, ms(at) - ms(cycle.paused.since)));
			cycle.paused = null;
			recordEvent(db, group.id, "group_resumed", at, null, {
				proposalId: p.id,
				newDeadline: new Date(roundTiming(group, ms(at)).deadline).toISOString(),
			});
			break;
		}
		case "update_schedule": {
			const change = p.scheduleChange!;
			if (change.fromRound <= cycle.round) throw changed();
			const current = cycle.schedule.slice(change.fromRound);
			if ([...current].sort().join() !== [...change.recipients].sort().join()) throw changed();
			cycle.schedule = [...cycle.schedule.slice(0, change.fromRound), ...change.recipients];
			recordEvent(db, group.id, "schedule_updated", at, null, {
				proposalId: p.id,
				fromRound: change.fromRound,
				recipients: change.recipients,
			});
			break;
		}
		case "recovery": {
			const r = p.recovery!;
			const d = db.defaults.find((x) => x.id === r.defaultId);
			if (!d || d.resolution) throw changed();
			if (r.action === "grace_extension") {
				d.graceUntil = r.graceUntil;
				cycle.stateVersion += 1;
			} else if (r.action === "write_off") {
				resolveDefault(db, group, d, "written_off", at, p.id, hash);
			} else {
				removeMember(db, group, d.userId, at, p.id);
				resolveDefault(db, group, d, "member_removed", at, p.id, hash);
			}
			break;
		}
	}
	p.status = "executed";
	p.executedAt = at;
	p.executionTxHash = hash;
	cycle.stateVersion += 1;
	recordEvent(db, group.id, "proposal_executed", at, null, { proposalId: p.id, number: p.number, type: p.type }, undefined);
	notify(
		db,
		memberIds(db, group.id),
		"proposal_executed",
		at,
		"Decision carried out",
		`${proposalTitle(db, p)} was executed on Stellar.`,
		{
			groupId: group.id,
			proposalId: p.id,
		},
	);
	tryPayout(db, group, at);
}

/** Removal by a recovery vote: out of the group and out of every round they haven't been paid. */
function removeMember(db: MockDb, group: MockGroup, userId: string, at: string, proposalId: string) {
	const row = membership(db, group.id, userId);
	if (row) row.removedAt = at;
	const cycle = group.cycle!;
	const keep = cycle.schedule.map((id, i) => i <= cycle.round || id !== userId || cycle.paidOut[i]);
	cycle.schedule = cycle.schedule.filter((_, i) => keep[i]);
	cycle.paidOut = cycle.paidOut.filter((_, i) => keep[i]);
	recordEvent(db, group.id, "member_removed", at, null, { userId, proposalId });
}

/** "Pause group" / "Resume group" / "Change payout order" / "Recovery: extend Tunde's deadline" */
export function proposalTitle(db: MockDb, p: MockProposal) {
	switch (p.type) {
		case "pause":
			return "Pause the group";
		case "resume":
			return "Resume the group";
		case "update_schedule":
			return "Change the payout order";
		default: {
			const d = db.defaults.find((x) => x.id === p.recovery?.defaultId);
			const who = firstName(userById(db, d?.userId ?? ""));
			return p.recovery?.action === "grace_extension"
				? `Give ${who} more time`
				: p.recovery?.action === "write_off"
					? `Write off ${who}'s missed contribution`
					: `Remove ${who} from the group`;
		}
	}
}

// ---------------------------------------------------------------- the passage of time

/** Bots act this long after the thing they react to, one after another. */
const BOT_PAY_AFTER = 40_000;
const BOT_VOTE_AFTER = 25_000;
const BOT_JOIN_AFTER = 20_000;
const BOT_SETTLE_AFTER = 60_000;
const BOT_APPROVE_AFTER = 30_000;

const isBot = (db: MockDb, id: string) => !!userById(db, id)?.bot;

/**
 * Everything the backend's scanner and the other members would have done up to `at`: expire
 * proposals, bots vote / pay / settle / ask to join, defaults get detected, rounds pay out. Runs
 * before every mock request, so the app always sees the state "now".
 */
export function tick(db: MockDb, at: number) {
	for (let pass = 0; pass < 40; pass++) {
		const changed = step(db, at);
		const hooked = tickHooks.map((hook) => hook(db, at)).some(Boolean);
		if (!changed && !hooked) return;
	}
}

/**
 * More rules that react to time, registered by their own module (v3 slot transfers: mocks/slots.ts),
 * so the engine doesn't import them. Each returns true when it changed something.
 */
export const tickHooks: ((db: MockDb, at: number) => boolean)[] = [];

/** One round of reactions. Returns true when something changed (so another pass may react to it). */
function step(db: MockDb, at: number): boolean {
	let changed = false;
	const iso = (t: number) => new Date(Math.min(t, at)).toISOString();

	for (const p of db.proposals) {
		if (p.status === "active" && ms(p.votingEndsAt) <= at) {
			p.status = "expired";
			recordEvent(db, p.groupId, "proposal_expired", p.votingEndsAt, null, {
				proposalId: p.id,
				number: p.number,
				reason: "voting ended",
			});
			changed = true;
		} else if (p.status === "approved" && p.executeBy && ms(p.executeBy) <= at) {
			p.status = "expired";
			recordEvent(db, p.groupId, "proposal_expired", p.executeBy, null, {
				proposalId: p.id,
				number: p.number,
				reason: "not executed in time",
			});
			changed = true;
		}
	}

	// Bots vote: yes-voters stop one short of the threshold while a person still has to vote, so the
	// person's vote is the one that decides (and they get to see it execute).
	for (const p of db.proposals.filter((x) => x.status === "active")) {
		const people = p.electorate.filter((id) => !isBot(db, id) && !p.votes.some((v) => v.userId === id));
		const bots = p.electorate.filter((id) => isBot(db, id) && id !== p.proposerId && !p.votes.some((v) => v.userId === id));
		for (const [i, botId] of bots.entries()) {
			const when = ms(p.createdAt) + (p.votes.length + i + 1) * BOT_VOTE_AFTER;
			if (when > at || p.status !== "active") break;
			const choice = userById(db, botId)!.bot!.votes;
			const yes = p.votes.filter((v) => v.choice === "yes").length;
			if (choice === "yes" && people.length > 0 && yes + 1 >= p.required) continue;
			castVote(db, p, botId, choice, iso(when));
			changed = true;
		}
		// The proposer votes for their own idea, after the others (bots only).
		if (
			p.status === "active" &&
			isBot(db, p.proposerId) &&
			p.electorate.includes(p.proposerId) &&
			!p.votes.some((v) => v.userId === p.proposerId)
		) {
			const yes = p.votes.filter((v) => v.choice === "yes").length;
			const when = ms(p.createdAt) + BOT_VOTE_AFTER / 2;
			if (when <= at && !(people.length > 0 && yes + 1 >= p.required)) {
				castVote(db, p, p.proposerId, "yes", iso(when));
				changed = true;
			}
		}
	}

	for (const group of db.groups) {
		const cycle = group.cycle;

		// Bots ask to join groups made in the app (and are admitted at once when auto-approval is on).
		if (group.status === "forming" && group.simulateJoins) {
			const asked = new Set([
				...db.joinRequests.filter((r) => r.groupId === group.id).map((r) => r.userId),
				...db.members.filter((m) => m.groupId === group.id).map((m) => m.userId),
			]);
			const candidates = db.users.filter((u) => u.bot && !asked.has(u.id));
			const already =
				db.members.filter((m) => m.groupId === group.id).length -
				1 +
				db.joinRequests.filter((r) => r.groupId === group.id).length;
			const next = candidates[0];
			const when = ms(group.createdAt) + (already + 1) * BOT_JOIN_AFTER;
			if (next && already < 4 && when <= at) {
				requestToJoin(db, group, next.id, iso(when));
				changed = true;
			}
		}

		// A bot admin approves people who asked to join their group.
		if (group.status === "forming") {
			for (const request of db.joinRequests.filter((r) => r.groupId === group.id)) {
				const adminId = admins(db, group.id)[0];
				if (!adminId || !isBot(db, adminId)) continue;
				const when = ms(request.requestedAt) + BOT_APPROVE_AFTER;
				if (when > at) continue;
				approveRequest(db, group, request.userId, adminId, iso(when));
				changed = true;
			}
		}

		if (!cycle || group.status !== "active") continue;

		// Bots pay each round shortly after it opens (unless they're the one who misses it). All of
		// them, round after round, before the scanner below looks for missed contributions: catching
		// up on a long gap must not record a default for someone who paid on time.
		while (group.status === "active" && !cycle.paused) {
			const { opened } = roundTiming(group, at);
			const next = payersOf(db, group, cycle.round)
				.map((userId, i) => ({ userId, when: opened + (i + 1) * BOT_PAY_AFTER }))
				.find(
					({ userId, when }) =>
						userById(db, userId)?.bot?.pays &&
						!paidThisRound(db, group.id, cycle.round, userId) &&
						when <= at &&
						amountDue(db, group, userId, when) !== null,
				);
			if (!next) break;
			contribute(db, group, next.userId, iso(next.when), txHash());
			changed = true;
		}

		// A bot given more time pays its missed contribution.
		for (const d of openDefaults(db, group.id)) {
			if (!d.graceUntil || !isBot(db, d.userId)) continue;
			const extended = db.proposals.find((p) => p.recovery?.defaultId === d.id && p.status === "executed");
			const when = ms(extended?.executedAt ?? d.detectedAt) + BOT_SETTLE_AFTER;
			if (when > at) continue;
			settleDefault(db, group, d, d.userId, iso(when), txHash());
			changed = true;
		}

		if (detectDefaults(db, group, at) > 0) changed = true;
		if (tryPayout(db, group, new Date(at).toISOString())) changed = true;
	}
	return changed;
}

// ---------------------------------------------------------------- membership

export function requestToJoin(db: MockDb, group: MockGroup, userId: string, at: string): "joined" | "requested" {
	if (group.status !== "forming") throw new RuleError(409, "CONFLICT", "This group has already started.");
	if (membership(db, group.id, userId)) throw new RuleError(409, "CONFLICT", "You are already a member.");
	const name = displayName(userById(db, userId));
	if (group.autoApproval) {
		db.members.push({ groupId: group.id, userId, role: "member", joinedAt: at, removedAt: null });
		notify(
			db,
			admins(db, group.id),
			"group_member_joined",
			at,
			`${name} joined ${group.name}`,
			"They joined with your invite link.",
			{ groupId: group.id },
		);
		return "joined";
	}
	if (!db.joinRequests.some((r) => r.groupId === group.id && r.userId === userId)) {
		db.joinRequests.push({ groupId: group.id, userId, requestedAt: at });
		notify(
			db,
			admins(db, group.id),
			"group_join_requested",
			at,
			`${name} wants to join ${group.name}`,
			"Review the request to let them in.",
			{
				groupId: group.id,
				userId,
			},
		);
	}
	return "requested";
}

export function approveRequest(db: MockDb, group: MockGroup, userId: string, adminId: string, at: string) {
	const index = db.joinRequests.findIndex((r) => r.groupId === group.id && r.userId === userId);
	if (index < 0) throw new RuleError(404, "NOT_FOUND", "No pending request from this person.");
	if (group.status !== "forming") throw new RuleError(409, "CONFLICT", "Members can only be added while the group is forming.");
	db.joinRequests.splice(index, 1);
	db.members.push({ groupId: group.id, userId, role: "member", joinedAt: at, removedAt: null });
	notify(
		db,
		[userId],
		"group_join_approved",
		at,
		`You're in ${group.name}`,
		`${firstName(userById(db, adminId))} approved your request.`,
		{ groupId: group.id },
	);
}
