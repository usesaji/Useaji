import { DAY, ms } from "@/mocks/clock";
import { totalPaidOut, totalSaved } from "@/mocks/dto";
import { intervalMs, membership, money, num, roundTiming } from "@/mocks/engine";
import { uuid } from "@/mocks/ids";
import { badRequest, conflict, forbidden, notFound, route, unauthorized, validate } from "@/mocks/router";
import type { MockDb, MockUser } from "@/mocks/types";

/**
 * /wallet: the linked Stellar wallet, where payouts go (`payoutAddress`: the primary destination, else
 * the wallet — SAJI holds no balance), withdraw destinations. Changes to where money goes re-check
 * the password (or a Google ID token for Google-only accounts), as on the API.
 */

const STELLAR_ACCOUNT = /^G[A-Z2-7]{55}$/;

/** Challenges waiting for a signature (5 minutes), per user. In memory, like a cache. */
const challenges = new Map<string, { publicKey: string; message: string; expires: number }>();

/** `currentPassword` / `googleIdToken` in the body: 400 when missing, 401 when wrong. */
function checkProof(user: MockUser, body: Record<string, unknown>) {
	if (user.password) {
		if (typeof body.currentPassword !== "string" || !body.currentPassword)
			throw badRequest("currentPassword or googleIdToken missing");
		if (body.currentPassword !== user.password) throw unauthorized("Current password is incorrect");
	} else if (String(body.googleIdToken ?? "").length < 20) throw badRequest("currentPassword or googleIdToken missing");
}

function nextPayout(db: MockDb, user: MockUser, at: number) {
	let soonest: number | null = null;
	for (const g of db.groups) {
		if (g.status !== "active" || !g.cycle || !membership(db, g.id, user.id)) continue;
		const round = g.cycle.schedule.findIndex((id, i) => id === user.id && !g.cycle!.paidOut[i] && i >= g.cycle!.round);
		if (round < 0) continue;
		// Rounds pay out around their deadline, one interval apart.
		const when = roundTiming(g, at).deadline + (round - g.cycle.round) * intervalMs(g);
		soonest = soonest === null ? when : Math.min(soonest, when);
	}
	return soonest === null ? null : new Date(soonest).toISOString();
}

route("GET", "/wallet", { message: "Wallet retrieved" }, ({ db, at, user }) => {
	const since = at - 30 * DAY;
	return {
		wallet: user.wallet,
		asset: "USDC",
		totalGroupSavings: money(totalSaved(db, user.id)),
		totalPaidOut: money(totalPaidOut(db, user.id)),
		payoutAddress: (() => {
			const primary = user.destinations.find((d) => d.isPrimary);
			if (primary) return { source: "destination" as const, address: primary.address };
			return user.wallet ? { source: "wallet" as const, address: user.wallet.publicKey } : null;
		})(),
		insights: {
			nextPayout: nextPayout(db, user, at),
			savingsGrowth: money(
				db.contributions.filter((c) => c.userId === user.id && ms(c.paidAt) >= since).reduce((s, c) => s + num(c.amount), 0),
			),
			activeGroups: db.groups.filter((g) => (g.status === "active" || g.status === "forming") && membership(db, g.id, user.id))
				.length,
		},
	};
});

route("DELETE", "/wallet", { message: "Wallet disconnected" }, ({ db, user, body }) => {
	if (!user.wallet) throw notFound("No wallet is linked");
	checkProof(user, body);
	db.users.find((u) => u.id === user.id)!.wallet = null;
	return null;
});

route("POST", "/wallet/challenge", { message: "Challenge created" }, ({ at, user, body }) => {
	const publicKey = String(body.publicKey ?? "");
	validate([[STELLAR_ACCOUNT.test(publicKey), "publicKey must be a Stellar account id"]]);
	const message = `Saji wants you to link ${publicKey} to ${user.email}.\nNonce: ${uuid()}`;
	challenges.set(user.id, { publicKey, message, expires: at + 5 * 60_000 });
	return { message, expiresIn: 300 };
});

route("POST", "/wallet/link", { message: "Wallet linked" }, ({ db, at, now, user, body }) => {
	const challenge = challenges.get(user.id);
	if (!challenge || challenge.expires < at || challenge.publicKey !== body.publicKey) {
		throw badRequest("The signature request expired. Try linking again.");
	}
	// The mock can't check an ed25519 signature; it only insists one was sent.
	if (String(body.signature ?? "").length < 20) throw badRequest("The wallet signature is invalid.");
	if (user.wallet) throw conflict("Disconnect the current wallet first");
	checkProof(user, body);
	if (db.users.some((u) => u.id !== user.id && u.wallet?.publicKey === body.publicKey)) {
		throw conflict("This wallet is linked to another Saji account.");
	}
	challenges.delete(user.id);
	const wallet = { publicKey: challenge.publicKey, linkedAt: now };
	db.users.find((u) => u.id === user.id)!.wallet = wallet;
	db.walletBalances[wallet.publicKey] ??= "500.00";
	return wallet;
});

// ---------------------------------------------------------------- withdraw destinations

const me = (db: MockDb, user: MockUser) => db.users.find((u) => u.id === user.id)!;

route("GET", "/wallet/destinations", { message: "Destinations retrieved" }, ({ user }) => user.destinations);

route("POST", "/wallet/destinations", { message: "Destination added" }, ({ db, now, user, body }) => {
	const address = String(body.address ?? "").trim();
	validate([
		[STELLAR_ACCOUNT.test(address), "address must be a valid Stellar account (G…)"],
		[String(body.label ?? "").length <= 60, "label must be shorter than or equal to 60 characters"],
	]);
	checkProof(user, body);
	const row = me(db, user);
	if (row.destinations.some((d) => d.address === address)) throw conflict("You already added this address.");
	const destination = {
		id: uuid(),
		address,
		label: body.label?.trim() || null,
		isPrimary: row.destinations.length === 0,
		createdAt: now,
	};
	row.destinations.push(destination);
	return destination;
});

route("PUT", "/wallet/destinations/:id/primary", { message: "Primary destination set" }, ({ db, user, params, body }) => {
	checkProof(user, body);
	const row = me(db, user);
	if (!row.destinations.some((d) => d.id === params.id)) throw notFound("Destination not found");
	for (const d of row.destinations) d.isPrimary = d.id === params.id;
	return row.destinations;
});

route("DELETE", "/wallet/destinations/:id", { message: "Destination removed" }, ({ db, user, params }) => {
	const row = me(db, user);
	const removed = row.destinations.find((d) => d.id === params.id);
	if (!removed) throw notFound("Destination not found");
	row.destinations = row.destinations.filter((d) => d.id !== params.id);
	if (removed.isPrimary && row.destinations[0]) row.destinations[0].isPrimary = true;
	return row.destinations;
});

/** Used by the simulated wallet (mocks/wallet.ts) to move test USDC to a group's escrow. */
export function payFromWallet(db: MockDb, publicKey: string, amount: number) {
	const balance = num(db.walletBalances[publicKey] ?? "0");
	if (amount > balance + 1e-9) throw forbidden("Not enough USDC in your wallet.");
	db.walletBalances[publicKey] = money(balance - amount);
}
