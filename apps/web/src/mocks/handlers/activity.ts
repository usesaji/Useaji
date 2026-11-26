import { ms } from "@/mocks/clock";
import { displayName, groupById, num, money } from "@/mocks/engine";
import { explorerTx } from "@/mocks/ids";
import { badRequest, notFound, paginate, route, type Ctx } from "@/mocks/router";
import type { ActivityItemDto } from "@/lib/api/dto";

/** /activity, /statements and /notifications. */

function myActivity({ db, user }: Ctx): ActivityItemDto[] {
	const group = (id: string) => {
		const g = groupById(db, id);
		return g ? { id: g.id, name: g.name } : null;
	};
	return [
		...db.contributions
			.filter((c) => c.userId === user.id)
			.map((c) => ({
				kind: "contribution" as const,
				id: c.id,
				amount: c.amount,
				asset: "USDC",
				txHash: c.txHash,
				txUrl: explorerTx(c.txHash),
				createdAt: c.paidAt,
				group: group(c.groupId),
				plan: null,
			})),
		...db.payouts
			.filter((p) => p.userId === user.id)
			.map((p) => ({
				kind: "payout" as const,
				id: p.id,
				amount: p.amount,
				asset: "USDC",
				txHash: p.txHash,
				txUrl: explorerTx(p.txHash),
				createdAt: p.paidAt,
				group: group(p.groupId),
				plan: null,
			})),
		...db.savingsTransactions
			.map((t) => ({ t, plan: db.savingsPlans.find((p) => p.id === t.planId) }))
			.filter(({ plan }) => plan?.userId === user.id)
			.map(({ t, plan }) => ({
				kind: t.kind === "deposit" ? ("savings_deposit" as const) : ("savings_withdrawal" as const),
				id: t.id,
				amount: t.amount,
				asset: "USDC",
				txHash: t.txHash,
				txUrl: explorerTx(t.txHash),
				createdAt: t.createdAt,
				group: null,
				plan: { id: plan!.id, name: plan!.name },
			})),
		// Paid slot transfers: the buyer paid the asking price, the seller received it (free ones make no rows).
		...db.slotTransfers
			.filter((t) => num(t.price) > 0 && (t.toId === user.id || t.fromId === user.id))
			.map((t) => ({
				kind: t.toId === user.id ? ("slot_purchase" as const) : ("slot_sale" as const),
				id: `${t.id}-${t.toId === user.id ? "buy" : "sell"}`,
				amount: t.price,
				asset: "USDC",
				txHash: t.txHash,
				txUrl: explorerTx(t.txHash),
				createdAt: t.at,
				group: group(t.groupId),
				plan: null,
			})),
	].sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
}

route("GET", "/activity", { message: "Activity retrieved" }, (ctx) => {
	const items = myActivity(ctx)
		.filter((a) => !ctx.query.type || a.kind === ctx.query.type)
		.filter((a) => !ctx.query.groupId || a.group?.id === ctx.query.groupId);
	return paginate(items, ctx.query);
});

route("GET", "/activity/:id", { message: "Transaction retrieved" }, (ctx) => {
	const item = myActivity(ctx).find((a) => a.id === ctx.params.id);
	if (!item) throw notFound("Transaction not found");
	return item;
});

const DATE = /^\d{4}-\d{2}-\d{2}$/;

route("GET", "/statements", { message: "Statement generated" }, (ctx) => {
	const { from, to } = ctx.query;
	if ((from && !DATE.test(from)) || (to && !DATE.test(to))) throw badRequest("Dates must look like 2026-01-31.");
	if (from && to && from > to) throw badRequest("The start date is after the end date.");
	const start = from ? ms(`${from}T00:00:00Z`) : 0;
	const end = to ? ms(`${to}T23:59:59.999Z`) : ctx.at;
	const transactions = myActivity(ctx)
		.filter((a) => ms(a.createdAt) >= start && ms(a.createdAt) <= end)
		.reverse();
	const total = (kind: ActivityItemDto["kind"]) =>
		money(transactions.filter((t) => t.kind === kind).reduce((s, t) => s + num(t.amount), 0));
	return {
		from: from ?? null,
		to: to ?? new Date(ctx.at).toISOString().slice(0, 10),
		generatedAt: ctx.now,
		fullName: ctx.user.profile ? displayName(ctx.user) : null,
		email: ctx.user.email,
		transactions,
		totals: {
			contributions: total("contribution"),
			payouts: total("payout"),
			withdrawals: total("withdrawal"),
			savingsDeposits: total("savings_deposit"),
			savingsWithdrawals: total("savings_withdrawal"),
			slotPurchases: total("slot_purchase"),
			slotSales: total("slot_sale"),
		},
		truncated: false,
	};
});

// ---------------------------------------------------------------- notifications

const mine = ({ db, user }: Ctx) =>
	db.notifications.filter((n) => n.userId === user.id).sort((a, b) => ms(b.createdAt) - ms(a.createdAt));

route("GET", "/notifications", { message: "Notifications retrieved" }, (ctx) => {
	const list = mine(ctx)
		.filter((n) => ctx.query.unreadOnly !== "true" || !n.readAt)
		.map(({ id, kind, title, body, data, readAt, createdAt }) => ({ id, kind, title, body, data, readAt, createdAt }));
	return paginate(list, ctx.query);
});

route("GET", "/notifications/unread-count", { message: "Unread count retrieved" }, (ctx) => ({
	unread: mine(ctx).filter((n) => !n.readAt).length,
}));

route("POST", "/notifications/read-all", { status: 200, message: "Notifications marked read" }, (ctx) => {
	let updated = 0;
	for (const n of ctx.db.notifications) {
		if (n.userId === ctx.user.id && !n.readAt) {
			n.readAt = ctx.now;
			updated += 1;
		}
	}
	return { updated };
});

route("POST", "/notifications/:id/read", { status: 200, message: "Notification marked read" }, (ctx) => {
	const n = ctx.db.notifications.find((x) => x.id === ctx.params.id && x.userId === ctx.user.id);
	if (!n) throw notFound("Notification not found");
	n.readAt ??= ctx.now;
	return null;
});
