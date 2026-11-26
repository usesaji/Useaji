import { ms, nowMs } from "@/mocks/clock";
import {
	activeMembers,
	amountDue,
	availableActions,
	displayName,
	groupById,
	membership,
	money,
	num,
	openDefaults,
	payersOf,
	recipientOf,
	roundTiming,
	userById,
} from "@/mocks/engine";
import { explorerTx } from "@/mocks/ids";
import { USDC_ISSUER } from "@/lib/stellar/config";
import type {
	MockDb,
	MockDefault,
	MockEvent,
	MockGroup,
	MockProposal,
	MockSavingsPlan,
	MockUser,
} from "@/mocks/types";
import type {
	AccountDto,
	CycleDto,
	DefaultDto,
	GroupDetailDto,
	GroupEventDto,
	GroupSummaryDto,
	JoinRequestDto,
	MemberDto,
	MemberPreviewDto,
	ProposalDto,
	MovementDto,
	PlanDto,
} from "@/lib/api/dto";

/** Mock rows → the Railway API's DTOs (docs/openapi.json), field for field. */

const APP_ORIGIN = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

export function initialsOf(user: MockUser | undefined) {
	const parts = displayName(user).trim().split(/\s+/);
	return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")).toUpperCase();
}

export function memberPreview(db: MockDb, userId: string): MemberPreviewDto {
	const user = userById(db, userId);
	return {
		userId,
		firstName: user?.profile?.firstName ?? null,
		lastName: user?.profile?.lastName ?? null,
		tag: user?.profile?.tag ?? null,
		avatarUrl: user?.avatarUrl ?? null,
		initials: initialsOf(user),
	};
}

export function accountDto(user: MockUser): AccountDto {
	return {
		id: user.id,
		email: user.email,
		role: user.role,
		createdAt: user.createdAt,
		profile: user.profile,
		avatarUrl: user.avatarUrl,
		signInMethods: user.signInMethods,
		wallet: user.wallet,
	};
}

/** The memo the escrow expects for a round's payment (contributions and missed ones alike). */
const roundMemo = (g: MockGroup, round: number) => `saji-${g.id.slice(0, 8)}-r${round + 1}`;

/** Round, deadline and what `viewerId` owes: null before start, and for non-members (round also once completed). */
function viewerState(db: MockDb, g: MockGroup, viewerId: string, at: number) {
	const cycle = g.cycle;
	const member = !!membership(db, g.id, viewerId);
	if (!cycle || !member)
		return { round: null, totalRounds: null, deadline: null, myAmountDue: null, paused: false, inRecovery: false };
	const done = g.status === "completed";
	const due = done ? null : amountDue(db, g, viewerId, at);
	return {
		round: done ? null : Math.min(cycle.round, cycle.schedule.length - 1),
		totalRounds: cycle.schedule.length,
		deadline: done ? null : new Date(roundTiming(g, at).deadline).toISOString(),
		myAmountDue: due === null ? null : money(due),
		paused: !!cycle.paused,
		inRecovery: openDefaults(db, g.id).length > 0,
	};
}

export function groupSummary(db: MockDb, g: MockGroup, viewerId: string, at = nowMs()): GroupSummaryDto {
	return {
		...viewerState(db, g, viewerId, at),
		membersPreview: activeMembers(db, g.id)
			.slice(0, 8)
			.map((m) => memberPreview(db, m.userId)),
		id: g.id,
		type: g.type,
		status: g.status,
		frequency: g.frequency,
		coverUrl: g.coverUrl,
		myRole: membership(db, g.id, viewerId)?.role ?? null,
		name: g.name,
		asset: g.asset,
		targetAmount: g.targetAmount,
		contributionAmount: g.contributionAmount,
		memberCount: activeMembers(db, g.id).length,
		isLive: g.status !== "forming",
		createdAt: g.createdAt,
	};
}

export function groupDetail(db: MockDb, g: MockGroup, viewerId: string): GroupDetailDto {
	const summary = groupSummary(db, g, viewerId);
	const isAdmin = summary.myRole === "admin";
	return {
		...summary,
		customIntervalDays: g.customIntervalDays,
		lateFee: g.lateFee,
		payoutOrder: g.payoutOrder,
		missedGracePolicy: g.missedGracePolicy,
		invite: isAdmin ? { code: g.inviteCode, url: `${APP_ORIGIN}/groups/join/${g.inviteCode}` } : null,
		gracePeriodDays: g.gracePeriodDays,
		publicDiscovery: g.publicDiscovery,
		contributionPrivacy: g.contributionPrivacy,
		autoApproval: g.autoApproval,
		serviceChargePercent: g.serviceChargePercent,
		pendingRequests: isAdmin ? db.joinRequests.filter((r) => r.groupId === g.id).length : 0,
		requestPending: db.joinRequests.some((r) => r.groupId === g.id && r.userId === viewerId),
	};
}

export function memberDto(db: MockDb, groupId: string, userId: string): MemberDto {
	const user = userById(db, userId);
	const row = db.members.find((m) => m.groupId === groupId && m.userId === userId)!;
	return {
		...memberPreview(db, userId),
		firstName: user?.profile?.firstName ?? null,
		lastName: user?.profile?.lastName ?? null,
		role: row.role,
		joinedAt: row.joinedAt,
	};
}

export function joinRequestDto(db: MockDb, groupId: string, userId: string): JoinRequestDto {
	const user = userById(db, userId);
	const row = db.joinRequests.find((r) => r.groupId === groupId && r.userId === userId)!;
	return {
		...memberPreview(db, userId),
		firstName: user?.profile?.firstName ?? null,
		lastName: user?.profile?.lastName ?? null,
		requestedAt: row.requestedAt,
	};
}

export function defaultDto(db: MockDb, d: MockDefault, at: number, viewerId?: string): DefaultDto {
	const g = groupById(db, d.groupId);
	const proposal = db.proposals.find((p) => p.recovery?.defaultId === d.id && (p.status === "active" || p.status === "approved"));
	const payer = !d.resolution && viewerId === d.userId && g?.cycle;
	return {
		proposalId: proposal?.id ?? null,
		payment:
			payer && g?.cycle
				? {
						destination: g.cycle.escrowAccount,
						assetCode: g.asset,
						assetIssuer: USDC_ISSUER,
						amount: d.amount,
						memo: roundMemo(g, d.round),
					}
				: null,
		id: d.id,
		round: d.round,
		member: memberPreview(db, d.userId),
		amount: d.amount,
		deadline: d.deadline,
		detectedAt: d.detectedAt,
		txHash: d.txHash,
		graceUntil: d.graceUntil,
		resolution: d.resolution,
		availableActions: availableActions(db, d, at),
	};
}

/** GET /groups/{id}/cycle, from `viewerId`'s side. */
export function cycleDto(db: MockDb, g: MockGroup, viewerId: string, at: number): CycleDto {
	const cycle = g.cycle;
	const live = g.status !== "forming";
	if (!cycle) {
		return {
			status: g.status,
			round: null,
			deadline: null,
			graceEndsAt: null,
			paused: null,
			openDefaults: [],
			contributions: [],
			schedule: [],
			recipient: null,
			myAmountDue: null,
			escrowAccount: null,
			payment: null,
			chainSync: null,
			roundOpensAt: null,
			totalContributed: "0",
			totalPaidOut: "0",
			totalRounds: activeMembers(db, g.id).length,
			inRecovery: false,
			actionRequired: false,
			stateVersion: 0,
			isLive: false,
		};
	}
	const round = Math.min(cycle.round, cycle.schedule.length - 1);
	const { deadline, graceEndsAt } = roundTiming(g, at);
	const defaults = openDefaults(db, g.id);
	const due = amountDue(db, g, viewerId, at);
	const recipient = recipientOf(g, round);
	const hideOthers = g.contributionPrivacy;
	const openRecovery = db.proposals.some(
		(p) => p.groupId === g.id && p.type === "recovery" && (p.status === "active" || p.status === "approved"),
	);
	const done = g.status === "completed";
	return {
		status: g.status,
		round,
		deadline: done ? null : new Date(deadline).toISOString(),
		graceEndsAt: done ? null : new Date(graceEndsAt).toISOString(),
		paused: cycle.paused,
		openDefaults: defaults.map((d) => defaultDto(db, d, at, viewerId)),
		contributions: payersOf(db, g, round).map((userId) => {
			const own = db.contributions.find((c) => c.groupId === g.id && c.round === round && c.userId === userId);
			// Took the slot over after its previous holder paid this round: that payment counts.
			const previous = own
				? undefined
				: db.contributions.find(
						(c) =>
							c.groupId === g.id &&
							c.round === round &&
							db.slotTransfers.some((t) => t.groupId === g.id && t.toId === userId && t.fromId === c.userId),
					);
			const paid = own ?? previous;
			const hidden = hideOthers && userId !== viewerId;
			return {
				member: memberPreview(db, userId),
				coveredByPreviousHolder: !!previous,
				paid: !!paid,
				late: paid?.late ?? false,
				paidAt: paid?.paidAt ?? null,
				amount: paid && !hidden ? paid.amount : null,
			};
		}),
		schedule: cycle.schedule.map((userId, i) => ({
			round: i,
			member: memberPreview(db, userId),
			paidOut: cycle.paidOut[i] ?? false,
		})),
		recipient: done || !recipient ? null : memberPreview(db, recipient),
		myAmountDue: due === null ? null : money(due),
		escrowAccount: cycle.escrowAccount,
		payment:
			due === null
				? null
				: {
						destination: cycle.escrowAccount,
						assetCode: g.asset,
						assetIssuer: USDC_ISSUER,
						amount: money(due),
						memo: roundMemo(g, round),
					},
		chainSync: { pending: false, lastError: null },
		roundOpensAt: done ? null : cycle.roundStartedAt,
		totalContributed: money(db.contributions.filter((c) => c.groupId === g.id).reduce((sum, c) => sum + num(c.amount), 0)),
		totalPaidOut: money(db.payouts.filter((p) => p.groupId === g.id).reduce((sum, p) => sum + num(p.amount), 0)),
		totalRounds: cycle.schedule.length,
		inRecovery: defaults.length > 0,
		actionRequired: defaults.some((d) => availableActions(db, d, at).length > 0) && !openRecovery,
		stateVersion: cycle.stateVersion,
		isLive: live,
	};
}

export function proposalDto(db: MockDb, p: MockProposal, viewerId: string, at: number): ProposalDto {
	const mine = p.votes.find((v) => v.userId === viewerId);
	const d = p.recovery ? db.defaults.find((x) => x.id === p.recovery!.defaultId) : undefined;
	const created = db.events.find((e) => e.kind === "proposal_created" && e.data.proposalId === p.id)?.txHash ?? null;
	return {
		creationTxHash: created,
		creationTxUrl: created ? explorerTx(created) : null,
		slotTransfer: (() => {
			const listing = p.slotTransfer && db.slotListings.find((l) => l.id === p.slotTransfer!.listingId);
			return listing
				? {
						listingId: listing.id,
						seller: memberPreview(db, listing.sellerId),
						position: listing.position,
						buyer: memberPreview(db, p.slotTransfer!.buyerId),
						price: listing.askingPrice,
					}
				: null;
		})(),
		id: p.id,
		number: p.number,
		type: p.type,
		status: p.status,
		description: p.description,
		proposer: memberPreview(db, p.proposerId),
		threshold: p.threshold,
		required: p.required,
		eligible: p.electorate.length,
		yes: p.votes.filter((v) => v.choice === "yes").length,
		no: p.votes.filter((v) => v.choice === "no").length,
		myVote: mine?.choice ?? null,
		canVote: p.status === "active" && p.electorate.includes(viewerId) && !mine && ms(p.votingEndsAt) > at,
		createdAt: p.createdAt,
		votingEndsAt: p.votingEndsAt,
		executeBy: p.executeBy,
		executedAt: p.executedAt,
		executionTxHash: p.executionTxHash,
		scheduleChange: p.scheduleChange
			? { fromRound: p.scheduleChange.fromRound, recipients: p.scheduleChange.recipients.map((id) => memberPreview(db, id)) }
			: null,
		recovery:
			p.recovery && d
				? { default: defaultDto(db, d, at, viewerId), action: p.recovery.action, graceUntil: p.recovery.graceUntil }
				: null,
	};
}

export function eventDto(db: MockDb, e: MockEvent): GroupEventDto {
	return {
		id: e.id,
		kind: e.kind,
		actor: e.actorId ? memberPreview(db, e.actorId) : null,
		data: e.data,
		txHash: e.txHash,
		txUrl: e.txHash ? explorerTx(e.txHash) : null,
		anchorHash: e.anchorHash,
		createdAt: e.createdAt,
	};
}

/** Money still in play for `userId`: contributions in groups that haven't completed. */
export function totalSaved(db: MockDb, userId: string) {
	return db.contributions
		.filter((c) => c.userId === userId && groupById(db, c.groupId)?.status !== "completed")
		.reduce((sum, c) => sum + num(c.amount), 0);
}

/** Every payout recorded for `userId` (each went straight to their payout address). */
export function totalPaidOut(db: MockDb, userId: string) {
	return db.payouts.filter((p) => p.userId === userId).reduce((sum, p) => sum + num(p.amount), 0);
}

// ---------------------------------------------------------------- personal savings (v3)

/** Deposits minus withdrawals (the contract's balance for the plan). */
export function planBalance(db: MockDb, planId: string) {
	return db.savingsTransactions
		.filter((t) => t.planId === planId)
		.reduce((sum, t) => sum + (t.kind === "deposit" ? num(t.amount) : -num(t.amount)), 0);
}

/**
 * Whether the plan's lock lets money out now. `until_target` holds while the balance is below the
 * target (a withdrawal that drops it below locks the plan again); `until_date_or_target`: either.
 */
export function lockOpen(db: MockDb, p: MockSavingsPlan, at: number) {
	const dateOpen = !!p.unlockAt && ms(p.unlockAt) <= at;
	const targetOpen = planBalance(db, p.id) + 1e-9 >= num(p.target);
	switch (p.lock) {
		case "flexible":
			return true;
		case "until_date":
			return dateOpen;
		case "until_target":
			return targetOpen;
		case "until_date_or_target":
			return dateOpen || targetOpen;
	}
}

/** `movements` only on `GET /savings/plans/{id}` (the last 100, newest first). */
export function planDto(db: MockDb, p: MockSavingsPlan, at: number, withMovements = false): PlanDto {
	const balance = planBalance(db, p.id);
	let running = 0;
	const movements = db.savingsTransactions
		.filter((t) => t.planId === p.id)
		.sort((a, b) => ms(a.createdAt) - ms(b.createdAt))
		.map((t): MovementDto => {
			running += t.kind === "deposit" ? num(t.amount) : -num(t.amount);
			return {
				id: t.id,
				kind: t.kind,
				amount: t.amount,
				balanceAfter: money(running),
				txHash: t.txHash,
				txUrl: explorerTx(t.txHash),
				createdAt: t.createdAt,
			};
		})
		.reverse()
		.slice(0, 100);
	return {
		id: p.id,
		name: p.name,
		target: p.target,
		asset: "USDC",
		lock: p.lock,
		unlockAt: p.unlockAt,
		balance: money(balance),
		progressPercent: Math.min(100, Math.round((balance / Math.max(num(p.target), 0.01)) * 10_000) / 100),
		canWithdraw: balance > 0 && lockOpen(db, p, at),
		ownerAddress: p.ownerAddress,
		txHash: p.txHash,
		txUrl: explorerTx(p.txHash),
		createdAt: p.createdAt,
		movements: withMovements ? movements : null,
	};
}
