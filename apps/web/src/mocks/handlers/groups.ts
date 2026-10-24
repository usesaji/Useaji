import { ms } from "@/mocks/clock";
import { groupDetail, groupSummary, joinRequestDto, memberDto } from "@/mocks/dto";
import {
	activeMembers,
	amountDue,
	approveRequest,
	groupById,
	membership,
	money,
	notify,
	num,
	requestToJoin,
	totalSavedIn,
} from "@/mocks/engine";
import { inviteCode, uuid } from "@/mocks/ids";
import {
	HttpError,
	badRequest,
	conflict,
	forbidden,
	notFound,
	paginate,
	route,
	validate,
	type Ctx,
	type Upload,
} from "@/mocks/router";
import type { MockGroup } from "@/mocks/types";

/** /groups: create, edit, list, discover, invites, members (leave, remove, bans) and join requests. */

const DECIMAL = /^\d+(\.\d{1,7})?$/;
const bool = (value: unknown) => value === true || value === "true";

/** A group the viewer may see: members always, others only when it is public. */
export function visibleGroup(ctx: Ctx, id = ctx.params.id!) {
	const group = groupById(ctx.db, id);
	if (!group || (!membership(ctx.db, group.id, ctx.user.id) && !group.publicDiscovery)) throw notFound("Group not found");
	return group;
}

/** A group the viewer belongs to (404 otherwise, as the API does). */
export function memberGroup(ctx: Ctx, id = ctx.params.id!) {
	const group = groupById(ctx.db, id);
	if (!group || !membership(ctx.db, group.id, ctx.user.id)) throw notFound("Group not found or you are not a member");
	return group;
}

export function adminGroup(ctx: Ctx, id = ctx.params.id!) {
	const group = memberGroup(ctx, id);
	if (membership(ctx.db, group.id, ctx.user.id)?.role !== "admin") throw forbidden("Only group admins can do this.");
	return group;
}

route("POST", "/groups", { message: "Savings group created" }, ({ db, now, user, form }) => {
	const f = form as Record<string, string>;
	const contribution = num(f.contributionAmount);
	const fixed = f.lateFeeFixed ? num(f.lateFeeFixed) : null;
	const percent = f.lateFeePercent ? num(f.lateFeePercent) : null;
	const grace = Number(f.gracePeriodDays ?? 3);
	const custom = f.customIntervalDays ? Number(f.customIntervalDays) : null;
	validate([
		[(f.name ?? "").trim().length >= 3 && (f.name ?? "").trim().length <= 60, "name must be between 3 and 60 characters"],
		[DECIMAL.test(f.targetAmount ?? "") && num(f.targetAmount) > 0, "targetAmount must be a positive decimal string"],
		[DECIMAL.test(f.contributionAmount ?? "") && contribution > 0, "contributionAmount must be a positive decimal string"],
		[
			["daily", "weekly", "biweekly", "monthly", "custom"].includes(f.frequency ?? ""),
			"frequency must be one of the following values: daily, weekly, biweekly, monthly, custom",
		],
		[
			["random", "manual", "vote", "custom"].includes(f.payoutOrder ?? ""),
			"payoutOrder must be one of the following values: random, manual, vote, custom",
		],
		[
			f.frequency !== "custom" || (custom !== null && custom >= 1 && custom <= 365),
			"customIntervalDays is required when frequency is custom",
		],
		[f.frequency === "custom" || custom === null, "customIntervalDays is only allowed when frequency is custom"],
		[Number.isInteger(grace) && grace >= 0 && grace <= 30, "gracePeriodDays must be between 0 and 30"],
		[!(fixed !== null && percent !== null), "Send lateFeeFixed or lateFeePercent, not both"],
		[percent === null || percent <= 10, "lateFeePercent must be at most 10"],
		[
			num(f.serviceChargePercent ?? "0") >= 0 && num(f.serviceChargePercent ?? "0") <= 100,
			"serviceChargePercent must be between 0 and 100",
		],
	]);
	if (fixed !== null && fixed > contribution * 0.1 + 1e-9)
		throw badRequest("The late fee can be at most 10% of the contribution.");
	const cover = form.coverPhoto as Upload | undefined;
	if (cover && typeof cover !== "string") {
		if (!/^image\/(jpeg|png|webp)$/.test(cover.type))
			throw new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Cover photo must be JPEG, PNG or WebP.");
		if (cover.size > 5 * 1024 * 1024) throw new HttpError(413, "PAYLOAD_TOO_LARGE", "Cover photo can be at most 5 MB.");
	}
	const group: MockGroup = {
		id: uuid(),
		type: "rotating",
		name: f.name!.trim(),
		status: "forming",
		frequency: f.frequency as MockGroup["frequency"],
		customIntervalDays: custom,
		asset: "USDC",
		targetAmount: money(num(f.targetAmount)),
		contributionAmount: money(contribution),
		lateFee:
			fixed !== null
				? { kind: "fixed", value: money(fixed) }
				: percent !== null
					? { kind: "percent", value: String(percent) }
					: null,
		payoutOrder: f.payoutOrder as MockGroup["payoutOrder"],
		missedGracePolicy: (f.missedGracePolicy as MockGroup["missedGracePolicy"]) ?? "charge_late_fee",
		gracePeriodDays: grace,
		publicDiscovery: bool(f.publicDiscovery),
		contributionPrivacy: bool(f.contributionPrivacy),
		autoApproval: bool(f.autoApproval),
		serviceChargePercent: f.serviceChargePercent ?? "0",
		coverUrl: cover && typeof cover !== "string" ? cover.dataUrl : null,
		inviteCode: inviteCode(),
		createdAt: now,
		governance: { thresholdKind: "percent", thresholdValue: 51, votingPeriodHours: 72, executionWindowHours: 48 },
		cycle: null,
		simulateJoins: true,
	};
	db.groups.push(group);
	db.members.push({ groupId: group.id, userId: user.id, role: "admin", joinedAt: now, removedAt: null });
	return groupDetail(db, group, user.id);
});

route("GET", "/groups", { message: "Groups retrieved" }, ({ db, user, query }) => {
	const search = (query.search ?? "").toLowerCase();
	const mine = db.groups
		.filter((g) => membership(db, g.id, user.id))
		.filter((g) => !query.status || g.status === query.status)
		.filter((g) => !query.type || g.type === query.type)
		.filter((g) => !search || g.name.toLowerCase().includes(search))
		.sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
	return paginate(
		mine.map((g) => groupSummary(db, g, user.id)),
		query,
	);
});

route("GET", "/groups/overview", { message: "Overview retrieved" }, ({ db, at, user }) => {
	const mine = db.groups.filter((g) => membership(db, g.id, user.id));
	const pending = mine.reduce((sum, g) => sum + (amountDue(db, g, user.id, at) ?? 0), 0);
	return {
		totalPending: money(pending),
		asset: "USDC",
		totalSaved: money(mine.filter((g) => g.status !== "completed").reduce((sum, g) => sum + totalSavedIn(db, g.id, user.id), 0)),
		activeGroups: mine.filter((g) => g.status === "forming" || g.status === "active").length,
	};
});

route("GET", "/groups/discover", { message: "Groups retrieved" }, ({ db, user, query }) => {
	const search = (query.search ?? "").toLowerCase();
	const found = db.groups
		.filter((g) => g.publicDiscovery && g.status === "forming" && !membership(db, g.id, user.id))
		.filter((g) => !query.type || g.type === query.type)
		.filter((g) => !search || g.name.toLowerCase().includes(search))
		.sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
	return paginate(
		found.map((g) => groupSummary(db, g, user.id)),
		query,
	);
});

const byInvite = (ctx: Ctx) => {
	const code = String(ctx.body.inviteCode ?? "");
	validate([[/^[0-9a-f]{32}$/.test(code), "inviteCode must match /^[0-9a-f]{32}$/ regular expression"]]);
	const group = ctx.db.groups.find((g) => g.inviteCode === code);
	if (!group) throw notFound("This invite link is no longer valid.");
	return group;
};

route("POST", "/groups/invites/preview", { status: 200, message: "Group retrieved" }, (ctx) =>
	groupDetail(ctx.db, byInvite(ctx), ctx.user.id),
);

/** Removed while forming: no rejoining by invite or request until an admin lifts the ban. */
const notBanned = (ctx: Ctx, group: MockGroup) => {
	if (group.bans?.includes(ctx.user.id)) throw forbidden("An admin removed you from this group");
	return group;
};

route("POST", "/groups/invites/join", { status: 200, message: "Join request sent" }, (ctx) => {
	const group = notBanned(ctx, byInvite(ctx));
	return { status: requestToJoin(ctx.db, group, ctx.user.id, ctx.now), groupId: group.id };
});

route("GET", "/groups/:id", { message: "Group retrieved" }, (ctx) => groupDetail(ctx.db, visibleGroup(ctx), ctx.user.id));

route("GET", "/groups/:id/members", { message: "Members retrieved" }, (ctx) => {
	const group = memberGroup(ctx);
	return activeMembers(ctx.db, group.id).map((m) => memberDto(ctx.db, group.id, m.userId));
});

route("POST", "/groups/:id/join-requests", { status: 200, message: "Join request sent" }, (ctx) => {
	const group = notBanned(ctx, visibleGroup(ctx));
	return { status: requestToJoin(ctx.db, group, ctx.user.id, ctx.now), groupId: group.id };
});

route("GET", "/groups/:id/join-requests", { message: "Join requests retrieved" }, (ctx) => {
	const group = adminGroup(ctx);
	return ctx.db.joinRequests
		.filter((r) => r.groupId === group.id)
		.sort((a, b) => ms(a.requestedAt) - ms(b.requestedAt))
		.map((r) => joinRequestDto(ctx.db, group.id, r.userId));
});

route("POST", "/groups/:id/join-requests/:userId/approve", { status: 200, message: "Join request approved" }, (ctx) => {
	const group = adminGroup(ctx);
	approveRequest(ctx.db, group, ctx.params.userId!, ctx.user.id, ctx.now);
	return activeMembers(ctx.db, group.id).map((m) => memberDto(ctx.db, group.id, m.userId));
});

route("POST", "/groups/:id/join-requests/:userId/reject", { status: 200, message: "Join request declined" }, (ctx) => {
	const group = adminGroup(ctx);
	const before = ctx.db.joinRequests.length;
	ctx.db.joinRequests = ctx.db.joinRequests.filter((r) => !(r.groupId === group.id && r.userId === ctx.params.userId));
	if (ctx.db.joinRequests.length === before) throw notFound("No pending request from this person.");
	notify(
		ctx.db,
		[ctx.params.userId!],
		"group_join_rejected",
		ctx.now,
		`Your request to join ${group.name} was declined`,
		"You can ask the admin for an invite link.",
		{
			groupId: group.id,
		},
	);
	return null;
});

route("POST", "/groups/:id/invite/rotate", { status: 200, message: "Invite link replaced" }, (ctx) => {
	const group = adminGroup(ctx);
	group.inviteCode = inviteCode();
	return groupDetail(ctx.db, group, ctx.user.id).invite;
});

route("PUT", "/groups/:id/cover", { message: "Cover photo saved" }, (ctx) => {
	const group = adminGroup(ctx);
	const file = ctx.form.file as Upload | undefined;
	if (!file || typeof file === "string") throw badRequest("Choose a picture to upload.");
	if (!/^image\/(jpeg|png|webp)$/.test(file.type))
		throw new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Use a JPEG, PNG or WebP picture.");
	if (file.size > 5 * 1024 * 1024) throw new HttpError(413, "PAYLOAD_TOO_LARGE", "Pictures can be at most 5 MB.");
	group.coverUrl = file.dataUrl;
	return { coverUrl: file.dataUrl };
});

// ---------------------------------------------------------------- edit, leave, remove (while forming)

const forming = (group: MockGroup) => {
	if (group.status !== "forming") throw conflict("The cycle has started");
	return group;
};

/** PATCH: only the fields sent; the result must pass the same rules as creation. */
route("PATCH", "/groups/:id", { message: "Group updated" }, (ctx) => {
	const group = forming(adminGroup(ctx));
	const b = ctx.body as Record<string, unknown>;
	const str = (v: unknown) => (v === undefined || v === null ? undefined : String(v));
	if ("lateFeeFixed" in b && "lateFeePercent" in b) throw badRequest("Send lateFeeFixed or lateFeePercent, not both");
	const next = { ...group };
	if (b.name !== undefined) next.name = String(b.name).trim();
	if (b.targetAmount !== undefined) next.targetAmount = String(b.targetAmount);
	if (b.contributionAmount !== undefined) next.contributionAmount = String(b.contributionAmount);
	if (b.frequency !== undefined) next.frequency = b.frequency as MockGroup["frequency"];
	if (b.customIntervalDays !== undefined) next.customIntervalDays = Number(b.customIntervalDays);
	if (next.frequency !== "custom") next.customIntervalDays = null;
	if (b.payoutOrder !== undefined) next.payoutOrder = b.payoutOrder as MockGroup["payoutOrder"];
	if (b.missedGracePolicy !== undefined) next.missedGracePolicy = b.missedGracePolicy as MockGroup["missedGracePolicy"];
	if (b.gracePeriodDays !== undefined) next.gracePeriodDays = Number(b.gracePeriodDays);
	for (const key of ["publicDiscovery", "contributionPrivacy", "autoApproval"] as const)
		if (b[key] !== undefined) next[key] = bool(b[key]);
	if (b.serviceChargePercent !== undefined) next.serviceChargePercent = String(b.serviceChargePercent);
	const fixed = str(b.lateFeeFixed);
	const percent = str(b.lateFeePercent);
	validate([
		[next.name.length >= 3 && next.name.length <= 60, "name must be longer than or equal to 3 characters"],
		[
			DECIMAL.test(next.targetAmount) && num(next.targetAmount) > 0,
			"targetAmount must be a positive amount with at most 7 decimals",
		],
		[
			DECIMAL.test(next.contributionAmount) && num(next.contributionAmount) > 0,
			"contributionAmount must be a positive amount with at most 7 decimals",
		],
		[
			next.frequency !== "custom" ||
				(next.customIntervalDays !== null && next.customIntervalDays >= 1 && next.customIntervalDays <= 365),
			"customIntervalDays is required when frequency is custom",
		],
		[
			Number.isInteger(next.gracePeriodDays) && next.gracePeriodDays >= 0 && next.gracePeriodDays <= 30,
			"gracePeriodDays must be between 0 and 30",
		],
		[fixed === undefined || DECIMAL.test(fixed), "lateFeeFixed must be an amount with at most 7 decimals"],
		[percent === undefined || (DECIMAL.test(percent) && num(percent) <= 10), "lateFeePercent must be at most 10"],
	]);
	if (fixed !== undefined) next.lateFee = num(fixed) > 0 ? { kind: "fixed", value: money(num(fixed)) } : null;
	if (percent !== undefined) next.lateFee = num(percent) > 0 ? { kind: "percent", value: String(num(percent)) } : null;
	if (next.lateFee?.kind === "fixed" && num(next.lateFee.value) > num(next.contributionAmount) * 0.1 + 1e-9) {
		throw badRequest("The late fee can be at most 10% of the contribution.");
	}
	Object.assign(group, next);
	return groupDetail(ctx.db, group, ctx.user.id);
});

route("POST", "/groups/:id/leave", { status: 200, message: "You left the group" }, (ctx) => {
	const group = memberGroup(ctx);
	forming(group);
	const members = activeMembers(ctx.db, group.id);
	if (members.length === 1) throw conflict("You are the only member");
	const row = ctx.db.members.find((m) => m.groupId === group.id && m.userId === ctx.user.id && !m.removedAt)!;
	row.removedAt = ctx.now;
	// The last admin leaving hands the group to the longest-standing member.
	const rest = activeMembers(ctx.db, group.id);
	if (row.role === "admin" && !rest.some((m) => m.role === "admin")) {
		const next = [...rest].sort((a, b) => ms(a.joinedAt) - ms(b.joinedAt))[0];
		if (next) next.role = "admin";
	}
	return null;
});

route("DELETE", "/groups/:id/members/:userId", { status: 200, message: "Member removed" }, (ctx) => {
	const group = forming(adminGroup(ctx));
	const userId = ctx.params.userId!;
	if (userId === ctx.user.id) throw badRequest("You can't remove yourself — leave the group instead.");
	const row = ctx.db.members.find((m) => m.groupId === group.id && m.userId === userId && !m.removedAt);
	if (!row) throw notFound("Member not found");
	if (row.role === "admin") throw forbidden("Admins can't be removed");
	row.removedAt = ctx.now;
	group.bans = [...new Set([...(group.bans ?? []), userId])];
	return activeMembers(ctx.db, group.id).map((m) => memberDto(ctx.db, group.id, m.userId));
});

route("DELETE", "/groups/:id/bans/:userId", { status: 200, message: "Ban lifted" }, (ctx) => {
	const group = adminGroup(ctx);
	if (!group.bans?.includes(ctx.params.userId!)) throw notFound("This user is not banned");
	group.bans = group.bans.filter((id) => id !== ctx.params.userId);
	return null;
});
