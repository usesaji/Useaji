import { DAY, HOUR, MINUTE } from "@/mocks/clock";
import { castVote, createProposal, startCycle, tick } from "@/mocks/engine";
import { inviteCode, stellarAccount, uuid } from "@/mocks/ids";
import type { MockBot, MockDb, MockGroup, MockUser } from "@/mocks/types";

/**
 * Demo data. Sign in as demo@usesaji.com / Password1 (Ada Okafor). Everything else is a simulated
 * member who pays, votes and asks to join on their own.
 *
 * The history is replayed through the engine (cycles started weeks ago, rounds paid out, a
 * default detected, a pause voted through), so the state is what the rules would produce:
 *
 * - Lagos Market Ajo: active, round 3 of 6, Ada owes this round; a payout-order change waits on
 *   Ada's deciding vote.
 * - Family Esusu (Ada is admin): Tunde missed round 1 → in recovery, no recovery proposal yet.
 * - Office Thrift: paused by a vote two days ago.
 * - Campus Savers (Ada is admin): forming, two join requests to review.
 * - Wedding Fund: completed; Ada's payout is in her Saji balance.
 * - Abuja Tech Savers, Ikeja Traders Circle: public groups to discover and join.
 */

export const DEMO_EMAIL = "demo@usesaji.com";
export const DEMO_PASSWORD = "Password1";

function person(
	first: string,
	last: string,
	opts: { bot?: MockBot; email?: string; createdDaysAgo?: number; wallet?: boolean } = {},
): MockUser {
	const now = Date.now();
	return {
		id: uuid(),
		email: opts.email ?? `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
		password: "Password1",
		role: "user",
		createdAt: new Date(now - (opts.createdDaysAgo ?? 200) * DAY).toISOString(),
		profile: {
			firstName: first,
			lastName: last,
			tag: `${first}${last.slice(0, 1)}`.toLowerCase(),
			gender: null,
			dateOfBirth: null,
			address: null,
		},
		avatarUrl: null,
		signInMethods: ["password"],
		security: { loginLockout: true },
		failedLogins: 0,
		lockedUntil: null,
		wallet: opts.wallet === false ? null : { publicKey: stellarAccount(), linkedAt: new Date(now - 150 * DAY).toISOString() },
		destinations: [],
		bot: opts.bot,
	};
}

function group(name: string, adminCreatedAt: number, fields: Partial<MockGroup>): MockGroup {
	return {
		id: uuid(),
		type: "rotating",
		name,
		status: "forming",
		frequency: "weekly",
		customIntervalDays: null,
		asset: "USDC",
		targetAmount: "300.00",
		contributionAmount: "50.00",
		lateFee: { kind: "percent", value: "5" },
		payoutOrder: "manual",
		missedGracePolicy: "start_recovery",
		gracePeriodDays: 2,
		publicDiscovery: false,
		contributionPrivacy: false,
		autoApproval: false,
		serviceChargePercent: "1",
		coverUrl: null,
		inviteCode: inviteCode(),
		createdAt: new Date(adminCreatedAt).toISOString(),
		governance: { thresholdKind: "percent", thresholdValue: 51, votingPeriodHours: 72, executionWindowHours: 48 },
		cycle: null,
		...fields,
	};
}

export function seed(version: number): MockDb {
	const now = Date.now();
	const yes: MockBot = { pays: true, votes: "yes" };

	const ada = person("Ada", "Okafor", { email: DEMO_EMAIL, createdDaysAgo: 400 });
	ada.destinations = [
		{
			id: uuid(),
			address: stellarAccount(),
			label: "My LOBSTR wallet",
			isPrimary: true,
			createdAt: new Date(now - 120 * DAY).toISOString(),
		},
	];
	// Ada pays like a bot while her history is replayed, then becomes herself (see the timeline).
	ada.bot = yes;

	const chioma = person("Chioma", "Eze", { bot: yes });
	const ibrahim = person("Ibrahim", "Musa", { bot: yes });
	const ngozi = person("Ngozi", "Obi", { bot: { pays: true, votes: "no" } });
	const kemi = person("Kemi", "Adeyemi", { bot: yes });
	const emeka = person("Emeka", "Nwosu", { bot: yes });
	const tunde = person("Tunde", "Bakare", { bot: { pays: false, votes: "yes" } });
	const fatima = person("Fatima", "Bello", { bot: yes });
	const segun = person("Segun", "Ojo", { bot: yes });
	const amaka = person("Amaka", "Uche", { bot: { pays: true, votes: "no" } });
	const yusuf = person("Yusuf", "Abdullahi", { bot: yes });
	const zainab = person("Zainab", "Lawal", { bot: yes });
	const bola = person("Bola", "Tinubu", { bot: yes });
	const admin = person("Saji", "Admin", { email: "admin@usesaji.com", wallet: false });
	admin.role = "admin";

	const users = [ada, chioma, ibrahim, ngozi, kemi, emeka, tunde, fatima, segun, amaka, yusuf, zainab, bola, admin];

	const db: MockDb = {
		version,
		users,
		signups: [],
		passwordResets: [],
		refreshTokens: [],
		groups: [],
		members: [],
		joinRequests: [],
		contributions: [],
		payouts: [],
		defaults: [],
		proposals: [],
		events: [],
		notifications: [],
		walletBalances: Object.fromEntries(users.filter((u) => u.wallet).map((u) => [u.wallet!.publicKey, "500.00"])),
	};

	const join = (g: MockGroup, people: MockUser[], adminUser: MockUser) => {
		db.groups.push(g);
		for (const [i, u] of people.entries()) {
			db.members.push({
				groupId: g.id,
				userId: u.id,
				role: u === adminUser ? "admin" : "member",
				joinedAt: new Date(new Date(g.createdAt).getTime() + i * HOUR).toISOString(),
				removedAt: null,
			});
		}
	};

	const wedding = group("Wedding Fund 2025", now - 105 * DAY, {
		frequency: "monthly",
		contributionAmount: "200.00",
		targetAmount: "600.00",
	});
	join(wedding, [ngozi, ada, fatima], ngozi);

	const office = group("Office Thrift", now - 24 * DAY, {
		frequency: "biweekly",
		contributionAmount: "75.00",
		targetAmount: "375.00",
		lateFee: { kind: "fixed", value: "5.00" },
	});
	join(office, [ibrahim, ada, amaka, yusuf, chioma], ibrahim);

	const lagos = group("Lagos Market Ajo", now - 18 * DAY, { contributionAmount: "50.00", targetAmount: "300.00" });
	join(lagos, [chioma, ibrahim, ngozi, ada, kemi, emeka], chioma);

	const family = group("Family Esusu", now - 12 * DAY, {
		contributionAmount: "100.00",
		targetAmount: "400.00",
		lateFee: { kind: "fixed", value: "5.00" },
	});
	join(family, [ada, fatima, segun, tunde], ada);

	const campus = group("Campus Savers", now - 2 * DAY, {
		frequency: "monthly",
		contributionAmount: "25.00",
		targetAmount: "150.00",
		payoutOrder: "vote",
	});
	join(campus, [ada, kemi], ada);
	db.joinRequests.push(
		{ groupId: campus.id, userId: yusuf.id, requestedAt: new Date(now - 20 * HOUR).toISOString() },
		{ groupId: campus.id, userId: emeka.id, requestedAt: new Date(now - 3 * HOUR).toISOString() },
	);

	const abuja = group("Abuja Tech Savers", now - 3 * DAY, {
		publicDiscovery: true,
		contributionAmount: "40.00",
		targetAmount: "200.00",
	});
	join(abuja, [yusuf, segun, zainab], yusuf);

	const ikeja = group("Ikeja Traders Circle", now - 1 * DAY, {
		publicDiscovery: true,
		autoApproval: true,
		frequency: "daily",
		contributionAmount: "10.00",
		targetAmount: "60.00",
		payoutOrder: "random",
	});
	join(ikeja, [bola, chioma], bola);

	// The timeline, oldest first. The engine ticks forward to each moment, then it happens.
	const timeline: [number, () => void][] = [
		[now - 100 * DAY, () => startCycle(db, wedding, ngozi.id, iso(now - 100 * DAY), [ngozi.id, ada.id, fatima.id])],
		[
			now - 20 * DAY,
			() => startCycle(db, office, ibrahim.id, iso(now - 20 * DAY), [ibrahim.id, amaka.id, ada.id, yusuf.id, chioma.id]),
		],
		[
			now - 15 * DAY,
			() => startCycle(db, lagos, chioma.id, iso(now - 15 * DAY), [chioma.id, ibrahim.id, ngozi.id, ada.id, kemi.id, emeka.id]),
		],
		[now - 10 * DAY, () => startCycle(db, family, ada.id, iso(now - 10 * DAY), [fatima.id, ada.id, segun.id, tunde.id])],
		[
			now - 2 * DAY,
			() => {
				const p = createProposal(
					db,
					office,
					ibrahim.id,
					{ type: "pause", description: "Pause until after the end-of-year audit, when salaries are late." },
					iso(now - 2 * DAY),
				);
				castVote(db, p, ada.id, "yes", iso(now - 2 * DAY + 10 * MINUTE));
			},
		],
		// From here on Ada acts for herself: she hasn't paid Lagos round 3 or voted on anything new.
		[now - 1 * DAY - MINUTE, () => delete db.users.find((u) => u.id === ada.id)!.bot],
		[
			now - 2 * HOUR,
			() =>
				createProposal(
					db,
					lagos,
					kemi.id,
					{
						type: "update_schedule",
						description: "Swap Kemi and Emeka: Kemi's shop rent is due before Emeka's.",
						fromRound: 4,
						recipients: [emeka.id, kemi.id],
					},
					iso(now - 2 * HOUR),
				),
		],
	];

	for (const [at, happen] of timeline) {
		for (let t = at - 30 * DAY; t < at; t += DAY) tick(db, Math.max(t, 0));
		tick(db, at);
		happen();
	}
	tick(db, now);

	// Old news is already read.
	for (const n of db.notifications) if (new Date(n.createdAt).getTime() < now - 3 * DAY) n.readAt = n.createdAt;

	return db;
}

const iso = (t: number) => new Date(t).toISOString();
