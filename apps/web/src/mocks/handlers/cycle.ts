import { ms } from "@/mocks/clock";
import { cycleDto, defaultDto, eventDto, proposalDto } from "@/mocks/dto";
import { castVote, contribute, createProposal, detectDefaults, execute, settleDefault, startCycle } from "@/mocks/engine";
import { adminGroup, memberGroup } from "@/mocks/handlers/groups";
import { badRequest, conflict, notFound, paginate, route, validate, type Ctx } from "@/mocks/router";
import type { GroupEventKind } from "@/lib/api/dto";

/** Savings cycle & recovery, and governance: /groups/{id}/start, /cycle, /contributions, /defaults, /governance, /proposals, /history. */

const UUID = /^[0-9a-f-]{36}$/i;

/** A live group needs the Stellar payment's hash; the API reads the chain before recording it. */
/** The API checks the payment on Horizon (sender, escrow, asset, amount, memo): a reused hash never matches. */
function requireTxHash(ctx: Ctx) {
	const hash = String(ctx.body.txHash ?? "");
	if (!hash) throw badRequest("Stellar does not show a matching payment");
	validate([[hash.length <= 128, "txHash must be shorter than or equal to 128 characters"]]);
	if (ctx.db.contributions.some((c) => c.txHash === hash)) throw badRequest("Stellar does not show a matching payment");
	return hash;
}

route("POST", "/groups/:id/start", { status: 200, message: "Savings cycle started" }, (ctx) => {
	const group = adminGroup(ctx);
	const schedule = ctx.body.schedule as string[] | undefined;
	validate([
		[!schedule || (Array.isArray(schedule) && schedule.every((id) => UUID.test(id))), "each value in schedule must be a UUID"],
	]);
	startCycle(ctx.db, group, ctx.user.id, ctx.now, schedule);
	return cycleDto(ctx.db, group, ctx.user.id, ctx.at);
});

route("GET", "/groups/:id/cycle", { message: "Cycle retrieved" }, (ctx) =>
	cycleDto(ctx.db, memberGroup(ctx), ctx.user.id, ctx.at),
);

route("POST", "/groups/:id/contributions", { message: "Contribution recorded" }, (ctx) => {
	const group = memberGroup(ctx);
	contribute(ctx.db, group, ctx.user.id, ctx.now, requireTxHash(ctx));
	return cycleDto(ctx.db, group, ctx.user.id, ctx.at);
});

route("GET", "/groups/:id/defaults", { message: "Defaults retrieved" }, (ctx) => {
	const group = memberGroup(ctx);
	return ctx.db.defaults
		.filter((d) => d.groupId === group.id)
		.filter((d) => !ctx.query.status || (ctx.query.status === "open" ? !d.resolution : !!d.resolution))
		.sort((a, b) => ms(b.detectedAt) - ms(a.detectedAt))
		.map((d) => defaultDto(ctx.db, d, ctx.at));
});

route("POST", "/groups/:id/defaults/detect", { status: 200, message: "Missed contributions checked" }, (ctx) => ({
	recorded: detectDefaults(ctx.db, memberGroup(ctx), ctx.at),
}));

route("POST", "/groups/:id/defaults/:defaultId/settle", { status: 200, message: "Missed contribution paid" }, (ctx) => {
	const group = memberGroup(ctx);
	const d = ctx.db.defaults.find((x) => x.id === ctx.params.defaultId && x.groupId === group.id);
	if (!d) throw notFound("Missed contribution not found");
	settleDefault(ctx.db, group, d, ctx.user.id, ctx.now, requireTxHash(ctx));
	return ctx.db.defaults.filter((x) => x.groupId === group.id && !x.resolution).map((x) => defaultDto(ctx.db, x, ctx.at));
});

// ---------------------------------------------------------------- governance

route("GET", "/groups/:id/governance", { message: "Approval rules retrieved" }, (ctx) => memberGroup(ctx).governance);

route("PUT", "/groups/:id/governance", { message: "Approval rules saved" }, (ctx) => {
	const group = adminGroup(ctx);
	if (group.status !== "forming") throw conflict("Approval rules are fixed once the cycle starts.");
	const b = ctx.body;
	validate([
		[
			b.thresholdKind === "percent" || b.thresholdKind === "count",
			"thresholdKind must be one of the following values: percent, count",
		],
		[
			Number.isFinite(b.thresholdValue) &&
				b.thresholdValue >= 1 &&
				b.thresholdValue <= (b.thresholdKind === "percent" ? 100 : 1000),
			"thresholdValue is out of range",
		],
		[
			Number.isFinite(b.votingPeriodHours) && b.votingPeriodHours >= 1 && b.votingPeriodHours <= 720,
			"votingPeriodHours must be between 1 and 720",
		],
		[
			Number.isFinite(b.executionWindowHours) && b.executionWindowHours >= 1 && b.executionWindowHours <= 720,
			"executionWindowHours must be between 1 and 720",
		],
	]);
	group.governance = {
		thresholdKind: b.thresholdKind,
		thresholdValue: b.thresholdValue,
		votingPeriodHours: b.votingPeriodHours,
		executionWindowHours: b.executionWindowHours,
	};
	return group.governance;
});

route("POST", "/groups/:id/proposals", { message: "Proposal created" }, (ctx) => {
	const group = memberGroup(ctx);
	const b = ctx.body;
	validate([
		[
			["pause", "resume", "update_schedule", "recovery"].includes(b.type),
			"type must be one of the following values: pause, resume, update_schedule, recovery",
		],
		[
			typeof b.description === "string" && b.description.trim().length >= 3 && b.description.length <= 1000,
			"description must be between 3 and 1000 characters",
		],
	]);
	const p = createProposal(ctx.db, group, ctx.user.id, { ...b, description: b.description.trim() }, ctx.now);
	return proposalDto(ctx.db, p, ctx.user.id, ctx.at);
});

route("GET", "/groups/:id/proposals", { message: "Proposals retrieved" }, (ctx) => {
	const group = memberGroup(ctx);
	const status = ctx.query.status;
	const list = ctx.db.proposals
		.filter((p) => p.groupId === group.id)
		.filter((p) =>
			!status
				? true
				: status === "open"
					? p.status === "active" || p.status === "approved"
					: status === "closed"
						? p.status !== "active" && p.status !== "approved"
						: p.status === status,
		)
		.sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
	return paginate(
		list.map((p) => proposalDto(ctx.db, p, ctx.user.id, ctx.at)),
		ctx.query,
	);
});

function findProposal(ctx: Ctx) {
	const group = memberGroup(ctx);
	const p = ctx.db.proposals.find((x) => x.id === ctx.params.proposalId && x.groupId === group.id);
	if (!p) throw notFound("Proposal not found");
	return p;
}

route("GET", "/groups/:id/proposals/:proposalId", { message: "Proposal retrieved" }, (ctx) =>
	proposalDto(ctx.db, findProposal(ctx), ctx.user.id, ctx.at),
);

route("POST", "/groups/:id/proposals/:proposalId/votes", { message: "Vote recorded" }, (ctx) => {
	const p = findProposal(ctx);
	validate([[ctx.body.choice === "yes" || ctx.body.choice === "no", "choice must be one of the following values: yes, no"]]);
	castVote(ctx.db, p, ctx.user.id, ctx.body.choice, ctx.now);
	return proposalDto(ctx.db, p, ctx.user.id, ctx.at);
});

route("POST", "/groups/:id/proposals/:proposalId/execute", { status: 200, message: "Proposal executed" }, (ctx) => {
	const p = findProposal(ctx);
	execute(ctx.db, p, ctx.now);
	return proposalDto(ctx.db, p, ctx.user.id, ctx.at);
});

/** The history tabs (`?category=`), as the API groups the event kinds. */
const CATEGORY: Record<GroupEventKind, "governance" | "recovery" | "savings"> = {
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

route("GET", "/groups/:id/history", { message: "History retrieved" }, (ctx) => {
	const group = memberGroup(ctx);
	const kinds = ctx.query.kind ? ctx.query.kind.split(",").map((k) => k.trim()) : null;
	const category = ctx.query.category;
	const events = ctx.db.events
		.filter((e) => e.groupId === group.id && (!kinds || kinds.includes(e.kind)) && (!category || CATEGORY[e.kind] === category))
		.sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
	return paginate(
		events.map((e) => eventDto(ctx.db, e)),
		ctx.query,
		30,
	);
});
