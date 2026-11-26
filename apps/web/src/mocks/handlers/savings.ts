import { DAY, MINUTE, ms } from "@/mocks/clock";
import { lockOpen, planBalance, planDto } from "@/mocks/dto";
import { money, num } from "@/mocks/engine";
import { groupsOverview } from "@/mocks/handlers/groups";
import { txHash, uuid } from "@/mocks/ids";
import { badRequest, conflict, HttpError, notFound, route, validate, type Ctx } from "@/mocks/router";
import type { MockDb, MockSavingsPlan, MockUser } from "@/mocks/types";
import { buildXdr, hashOf, MOCK_TX_TTL, readSignedXdr, type MockTx } from "@/mocks/xdr";
import type { SavingsLock } from "@/lib/api/dto";

/**
 * /savings (v3): personal savings plans in the shared savings contract, and the savings dashboard,
 * as the API runs them on Stellar (docs/frontend-integration.md §4–5): every money-moving step is
 * prepare → the wallet signs → confirm. The "XDR" is the mock's own (`mocks/xdr.ts`); the simulated
 * wallet signs it. Rules the contract enforces: deposits come from the owner wallet, withdrawals
 * only ever go back to it, and the lock decides when anything may leave.
 */

/** Positive, at most 7 decimals, as the API takes amounts. */
const AMOUNT = /^\d+(\.\d{1,7})?$/;
const LOCKS: SavingsLock[] = ["flexible", "until_date", "until_target", "until_date_or_target"];
const datedLock = (lock: SavingsLock) => lock === "until_date" || lock === "until_date_or_target";
/** An ISO date with a timezone (`Z` or `±hh:mm`), as the API insists. */
const ZONED = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;

function myPlan(db: MockDb, ctx: Pick<Ctx, "user" | "params">): MockSavingsPlan {
	const plan = db.savingsPlans.find((p) => p.id === ctx.params.id);
	// Someone else's plan is "not found", as for groups you aren't in.
	if (!plan || plan.userId !== ctx.user.id) throw notFound("Savings goal not found");
	return plan;
}

const linkedWallet = (user: MockUser) => {
	if (!user.wallet) throw conflict("Link a Stellar wallet first: it will own this plan.");
	return user.wallet.publicKey;
};

/** The plan's owner wallet must be the one linked now: the API builds transactions for it. */
function ownerWallet(plan: MockSavingsPlan, user: MockUser) {
	if (user.wallet?.publicKey !== plan.ownerAddress) {
		throw conflict(`This plan belongs to wallet ${plan.ownerAddress}. Link that wallet to move its money.`);
	}
	return plan.ownerAddress;
}

function amountOf(body: Ctx["body"]) {
	const amount = String(body.amount ?? "");
	validate([[AMOUNT.test(amount) && num(amount) > 0, "amount must be a positive decimal string with at most 7 decimals"]]);
	return amount;
}

/** The signed transaction the confirm route was sent, checked against what it must do. */
function signedTx(ctx: Ctx, expected: Partial<MockTx>, wrong: string) {
	const signed = String(ctx.body.signedXdr ?? "");
	if (!signed) {
		if (ctx.body.txHash) throw badRequest("The mock can't look transactions up by hash: send signedXdr.");
		throw badRequest("signedXdr or txHash is required");
	}
	const read = readSignedXdr(signed);
	if (!read) throw badRequest("signedXdr is not a valid transaction");
	const { tx, signer } = read;
	const matches = Object.entries(expected).every(([k, v]) => tx[k as keyof MockTx] === v);
	if (!matches || signer !== tx.source) throw badRequest(wrong);
	if (ctx.at - tx.at > MOCK_TX_TTL) throw badRequest("The signed transaction expired before it reached Stellar. Try again.");
	// The same signed transaction always has the same hash: a repeat confirm is recognized.
	return { tx, hash: hashOf(signed) };
}

function lockMessage(plan: MockSavingsPlan) {
	const date = plan.unlockAt ? new Date(plan.unlockAt).toISOString() : "";
	if (plan.lock === "until_date") return `This plan is locked until ${date}`;
	if (plan.lock === "until_target") return `This plan is locked until its balance reaches ${plan.target} USDC`;
	return `This plan is locked until ${date} or until its balance reaches ${plan.target} USDC`;
}

const walletUsdc = (db: MockDb, address: string) => num(db.walletBalances[address] ?? "0");
const moveWallet = (db: MockDb, address: string, delta: number) => {
	db.walletBalances[address] = money(walletUsdc(db, address) + delta);
};

route("GET", "/savings/overview", { message: "Savings dashboard retrieved" }, ({ db, at, user }) => {
	const groups = groupsOverview(db, user.id, at);
	const plans = db.savingsPlans.filter((p) => p.userId === user.id);
	const balance = plans.reduce((s, p) => s + planBalance(db, p.id), 0);
	return {
		groups,
		personal: {
			asset: "USDC",
			plans: plans.length,
			balance: money(balance),
			target: money(plans.reduce((s, p) => s + num(p.target), 0)),
		},
		totalSaved: money(num(groups.totalSaved) + balance),
	};
});

route("GET", "/savings/plans", { message: "Savings goals retrieved" }, ({ db, at, user }) =>
	db.savingsPlans
		.filter((p) => p.userId === user.id)
		.sort((a, b) => ms(b.createdAt) - ms(a.createdAt))
		.map((p) => planDto(db, p, at)),
);

route("POST", "/savings/plans", { status: 201, message: "Savings goal prepared" }, ({ at, user, body }) => {
	const name = String(body.name ?? "").trim();
	const target = String(body.target ?? "");
	const lock = body.lock as SavingsLock;
	const unlockAt = body.unlockAt === undefined || body.unlockAt === null ? null : String(body.unlockAt);
	const unlockMs = unlockAt ? ms(unlockAt) : NaN;
	validate([
		[name.length >= 2 && name.length <= 60, "name must be between 2 and 60 characters"],
		[AMOUNT.test(target) && num(target) > 0, "target must be a positive decimal string with at most 7 decimals"],
		[LOCKS.includes(lock), `lock must be one of the following values: ${LOCKS.join(", ")}`],
	]);
	if (datedLock(lock)) {
		validate([
			[unlockAt !== null, "unlockAt is required for this lock"],
			[unlockAt === null || ZONED.test(unlockAt), "unlockAt must include a timezone, e.g. 2027-01-01T00:00:00Z"],
			[Number.isNaN(unlockMs) || unlockMs >= at + MINUTE, "unlockAt must be at least a minute in the future"],
			[Number.isNaN(unlockMs) || unlockMs <= at + 10 * 365 * DAY, "unlockAt must be at most 10 years ahead"],
		]);
	} else {
		validate([[unlockAt === null, "unlockAt must be omitted for this lock"]]);
	}
	const source = linkedWallet(user);
	const planId = uuid();
	const tx: MockTx = {
		op: "create_plan",
		source,
		planId,
		at,
		plan: { userId: user.id, name, target, lock, unlockAt: unlockAt ? new Date(unlockMs).toISOString() : null },
	};
	return { planId, xdr: buildXdr(tx), plan: null };
});

route("POST", "/savings/plans/:id/confirm", { message: "Savings goal created" }, (ctx) => {
	const { db, at, now, user, params } = ctx;
	const existing = db.savingsPlans.find((p) => p.id === params.id);
	if (existing) {
		if (existing.userId !== user.id) throw notFound("Savings goal not found");
		return planDto(db, existing, at); // confirming twice returns the same plan
	}
	const { tx, hash } = signedTx(ctx, { op: "create_plan", planId: params.id }, "The transaction did not create this plan for your wallet");
	if (!tx.plan || tx.plan.userId !== user.id) throw notFound("Savings goal not found");
	if (user.wallet?.publicKey !== tx.source) throw badRequest("The transaction did not create this plan for your wallet");
	const plan: MockSavingsPlan = {
		id: params.id,
		userId: user.id,
		name: tx.plan.name,
		lock: tx.plan.lock,
		target: money(num(tx.plan.target)),
		unlockAt: tx.plan.unlockAt,
		ownerAddress: tx.source,
		txHash: hash,
		createdAt: now,
	};
	db.savingsPlans.push(plan);
	return planDto(db, plan, at);
});

route("GET", "/savings/plans/:id", { message: "Savings goal retrieved" }, (ctx) => planDto(ctx.db, myPlan(ctx.db, ctx), ctx.at, true));

route("POST", "/savings/plans/:id/deposits/prepare", { message: "Transaction prepared" }, (ctx) => {
	const { db, at, user, body } = ctx;
	const plan = myPlan(db, ctx);
	const amount = amountOf(body);
	const source = ownerWallet(plan, user);
	if (num(amount) > walletUsdc(db, source) + 1e-9) throw badRequest("Not enough USDC in the wallet");
	return { xdr: buildXdr({ op: "deposit", source, planId: plan.id, amount, at }) };
});

route("POST", "/savings/plans/:id/deposits", { message: "Deposit recorded" }, (ctx) => {
	const { db, at, now } = ctx;
	const plan = myPlan(db, ctx);
	const { tx, hash } = signedTx(
		ctx,
		{ op: "deposit", planId: plan.id, source: plan.ownerAddress },
		"The transaction did not deposit into this plan",
	);
	if (!db.savingsTransactions.some((t) => t.txHash === hash)) {
		const amount = num(tx.amount);
		if (amount > walletUsdc(db, plan.ownerAddress) + 1e-9) throw badRequest("Not enough USDC in the wallet");
		moveWallet(db, plan.ownerAddress, -amount);
		db.savingsTransactions.push({ id: uuid(), planId: plan.id, kind: "deposit", amount: money(amount), txHash: hash, createdAt: now });
	}
	return planDto(db, plan, at);
});

route("POST", "/savings/plans/:id/withdrawals/prepare", { message: "Transaction prepared" }, (ctx) => {
	const { db, at, user, body } = ctx;
	const plan = myPlan(db, ctx);
	const amount = amountOf(body);
	const source = ownerWallet(plan, user);
	if (!lockOpen(db, plan, at)) throw conflict(lockMessage(plan));
	if (num(amount) > planBalance(db, plan.id) + 1e-9) throw conflict("The amount is more than this plan's balance");
	return { xdr: buildXdr({ op: "withdraw", source, planId: plan.id, amount, at }) };
});

route("POST", "/savings/plans/:id/withdrawals", { message: "Withdrawal recorded" }, (ctx) => {
	const { db, at, now } = ctx;
	const plan = myPlan(db, ctx);
	const { tx, hash } = signedTx(
		ctx,
		{ op: "withdraw", planId: plan.id, source: plan.ownerAddress },
		"The transaction did not withdraw from this plan",
	);
	if (!db.savingsTransactions.some((t) => t.txHash === hash)) {
		const amount = num(tx.amount);
		// The contract checks again when the transaction lands.
		if (!lockOpen(db, plan, at)) throw conflict(lockMessage(plan));
		if (amount > planBalance(db, plan.id) + 1e-9) throw conflict("The amount is more than this plan's balance");
		// Released to the owner wallet, never anywhere else.
		moveWallet(db, plan.ownerAddress, amount);
		db.savingsTransactions.push({ id: uuid(), planId: plan.id, kind: "withdrawal", amount: money(amount), txHash: hash, createdAt: now });
	}
	return planDto(db, plan, at);
});

// ---------------------------------------------------------------- test USDC faucet (testnet)

const FAUCET_AMOUNT = "1000";
const HOUR_MS = 60 * MINUTE;

route("POST", "/faucet/trustline/prepare", { message: "Transaction prepared" }, ({ user }) => {
	linkedWallet(user);
	// The simulated wallet holds USDC from the start.
	throw conflict("This wallet already trusts USDC");
});

route("POST", "/faucet/usdc", { message: "Test USDC sent" }, ({ db, at, now, user }) => {
	const address = linkedWallet(user);
	const last = db.faucetGrants[address];
	if (last && at - ms(last) < HOUR_MS) {
		throw new HttpError(429, "TOO_MANY_REQUESTS", "This wallet already got test USDC in the last hour. Try again later.");
	}
	db.faucetGrants[address] = now;
	moveWallet(db, address, num(FAUCET_AMOUNT));
	return { txHash: txHash(), amount: FAUCET_AMOUNT };
});
