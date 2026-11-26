import { DAY, ms } from "@/mocks/clock";
import { planBalance, planWithdrawable, savingsPlanDto, savingsTxDto } from "@/mocks/dto";
import { money, num } from "@/mocks/engine";
import { contractId, txHash, uuid } from "@/mocks/ids";
import { badRequest, conflict, forbidden, notFound, paginate, route, validate, type Ctx } from "@/mocks/router";
import type { MockDb, MockSavingsPlan } from "@/mocks/types";

/**
 * /savings (v3, provisional): personal savings plans, each held by its own savings contract on
 * Stellar Testnet. Not in the API yet: every route is `notInApi`, and the shapes are the app's
 * proposal (SavingsPlanDto & co. in lib/api/dto.ts). Rules the contract would enforce:
 * deposits come from the owner wallet; withdrawals are signed by it and only ever go back to it;
 * a locked plan releases nothing before its date — reaching the target early doesn't unlock it.
 */

const AMOUNT = /^\d+(\.\d{1,2})?$/;
const MAX_TARGET = 1_000_000;

function myPlan(db: MockDb, ctx: Pick<Ctx, "user" | "params">): MockSavingsPlan {
	const plan = db.savingsPlans.find((p) => p.id === ctx.params.id);
	// Someone else's plan is "not found", as the API does for groups you aren't in.
	if (!plan || plan.userId !== ctx.user.id) throw notFound("Savings plan not found");
	return plan;
}

const mine = (db: MockDb, userId: string) => db.savingsPlans.filter((p) => p.userId === userId);

route(
	"GET",
	"/savings/summary",
	{
		message: "Savings summary retrieved",
		notInApi: "v3 personal savings, not in the API yet (BACKEND-GAPS.md, Personal savings)",
	},
	({ db, at, user }) => {
		const plans = mine(db, user.id);
		return {
			asset: "USDC",
			totalSaved: money(plans.reduce((s, p) => s + planBalance(db, p.id), 0)),
			withdrawable: money(plans.reduce((s, p) => s + planWithdrawable(db, p, at), 0)),
			activePlans: plans.length,
		};
	},
);

route(
	"GET",
	"/savings/plans",
	{ message: "Savings plans retrieved", notInApi: "v3 personal savings, not in the API yet (BACKEND-GAPS.md, Personal savings)" },
	({ db, at, user, query }) => {
		const plans = mine(db, user.id).sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
		return paginate(
			plans.map((p) => savingsPlanDto(db, p, at)),
			query,
		);
	},
);

route(
	"POST",
	"/savings/plans",
	{ message: "Savings plan created", notInApi: "v3 personal savings, not in the API yet (BACKEND-GAPS.md, Personal savings)" },
	({ db, at, now, user, body }) => {
		const name = String(body.name ?? "").trim();
		const kind = body.kind;
		const target = String(body.targetAmount ?? "");
		const date = body.targetDate ? String(body.targetDate) : null;
		const dateMs = date ? ms(date) : NaN;
		validate([
			[name.length >= 1 && name.length <= 60, "name must be between 1 and 60 characters"],
			[kind === "flexible" || kind === "locked", "kind must be one of the following values: flexible, locked"],
			[
				AMOUNT.test(target) && num(target) > 0 && num(target) <= MAX_TARGET,
				"targetAmount must be a positive amount with at most 2 decimals",
			],
			[kind !== "locked" || date !== null, "targetDate is required for a locked plan"],
			[date === null || (!Number.isNaN(dateMs) && dateMs > at), "targetDate must be a date in the future"],
			[date === null || Number.isNaN(dateMs) || dateMs <= at + 5 * 365 * DAY, "targetDate must be within 5 years"],
		]);
		if (!user.wallet) throw forbidden("Link a Stellar wallet first: it will own this plan.");
		if (mine(db, user.id).some((p) => p.name.toLowerCase() === name.toLowerCase()))
			throw conflict("You already have a plan with this name.");
		const plan: MockSavingsPlan = {
			id: uuid(),
			userId: user.id,
			name,
			kind,
			targetAmount: money(num(target)),
			targetDate: date ? new Date(dateMs).toISOString() : null,
			ownerWallet: user.wallet.publicKey,
			contractId: contractId(),
			createdAt: now,
		};
		db.savingsPlans.push(plan);
		return savingsPlanDto(db, plan, at);
	},
);

route(
	"GET",
	"/savings/plans/:id",
	{ message: "Savings plan retrieved", notInApi: "v3 personal savings, not in the API yet (BACKEND-GAPS.md, Personal savings)" },
	(ctx) => savingsPlanDto(ctx.db, myPlan(ctx.db, ctx), ctx.at),
);

route(
	"GET",
	"/savings/plans/:id/transactions",
	{
		message: "Savings transactions retrieved",
		notInApi: "v3 personal savings, not in the API yet (BACKEND-GAPS.md, Personal savings)",
	},
	(ctx) => {
		const plan = myPlan(ctx.db, ctx);
		const rows = ctx.db.savingsTransactions.filter((t) => t.planId === plan.id).sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
		return paginate(rows.map(savingsTxDto), ctx.query);
	},
);

route(
	"POST",
	"/savings/plans/:id/deposits",
	{ message: "Deposit recorded", notInApi: "v3 personal savings, not in the API yet (BACKEND-GAPS.md, Personal savings)" },
	(ctx) => {
		const { db, now, body } = ctx;
		const plan = myPlan(db, ctx);
		const amount = String(body.amount ?? "");
		const hash = String(body.txHash ?? "");
		validate([
			[AMOUNT.test(amount) && num(amount) > 0, "amount must be a positive amount with at most 2 decimals"],
			[/^[0-9a-f]{64}$/.test(hash), "txHash must be a Stellar transaction hash"],
		]);
		if (db.savingsTransactions.some((t) => t.txHash === hash)) throw conflict("This transaction was already recorded.");
		const tx = {
			id: uuid(),
			planId: plan.id,
			kind: "deposit" as const,
			amount: money(num(amount)),
			txHash: hash,
			createdAt: now,
		};
		db.savingsTransactions.push(tx);
		return savingsTxDto(tx);
	},
);

route(
	"POST",
	"/savings/plans/:id/withdrawals",
	{ message: "Withdrawal sent", notInApi: "v3 personal savings, not in the API yet (BACKEND-GAPS.md, Personal savings)" },
	(ctx) => {
		const { db, at, now, body } = ctx;
		const plan = myPlan(db, ctx);
		const amount = String(body.amount ?? "");
		validate([
			[AMOUNT.test(amount) && num(amount) > 0, "amount must be a positive amount with at most 2 decimals"],
			// The mock can't verify the owner wallet's signature; it only insists one was sent.
			[String(body.signature ?? "").length >= 20, "signature from the owner wallet is required"],
		]);
		if (plan.kind === "locked" && plan.targetDate && ms(plan.targetDate) > at) {
			throw forbidden(`This plan is locked until ${new Date(plan.targetDate).toDateString().slice(4)}.`);
		}
		if (num(amount) > planWithdrawable(db, plan, at) + 1e-9) throw badRequest("Amount is more than the available balance.");
		const tx = {
			id: uuid(),
			planId: plan.id,
			kind: "withdrawal" as const,
			amount: money(num(amount)),
			txHash: txHash(),
			createdAt: now,
		};
		db.savingsTransactions.push(tx);
		// The contract releases to the owner wallet, never anywhere else.
		db.walletBalances[plan.ownerWallet] = money(num(db.walletBalances[plan.ownerWallet] ?? "0") + num(amount));
		return savingsTxDto(tx);
	},
);
