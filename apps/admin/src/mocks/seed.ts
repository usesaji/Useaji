import type { AuditLogDto, Role } from "@/lib/api/dto";

/**
 * The console's demo data: the same people as the app's demo (Ada, Chioma, Tunde…) plus enough
 * extra sign-ups to page through, and a month of audit history. Admin: admin@usesaji.com /
 * Password1. demo@usesaji.com is a member, so the console refuses it.
 */

export interface MockAdminUser {
	id: string;
	email: string;
	password: string;
	role: Role;
	createdAt: string;
}

export interface MockAdminDb {
	version: number;
	users: MockAdminUser[];
	auditLogs: AuditLogDto[];
	refreshTokens: { token: string; userId: string; family: string; used: boolean }[];
	/** Health the mock reports; the dev panel can break Redis to see the console react. */
	health: { database: "up" | "down"; redis: "up" | "down" };
}

const DAY = 86_400_000;

/** A small seeded PRNG, so the demo history is the same on every reset. */
function prng(seed: number) {
	let s = seed;
	return () => {
		s = (s * 1664525 + 1013904223) % 4294967296;
		return s / 4294967296;
	};
}

const NAMED = [
	["admin@usesaji.com", "admin", 420],
	["demo@usesaji.com", "user", 400],
	["chioma.eze@example.com", "user", 210],
	["ibrahim.musa@example.com", "user", 205],
	["ngozi.obi@example.com", "user", 200],
	["kemi.adeyemi@example.com", "user", 190],
	["emeka.nwosu@example.com", "user", 185],
	["tunde.bakare@example.com", "user", 120],
	["fatima.bello@example.com", "user", 118],
	["segun.ojo@example.com", "user", 117],
	["amaka.uche@example.com", "user", 90],
	["yusuf.abdullahi@example.com", "user", 60],
	["zainab.lawal@example.com", "user", 30],
	["bola.tinubu@example.com", "user", 20],
	["ops@usesaji.com", "admin", 300],
] as const;

const FIRST = [
	"Funmi",
	"Kunle",
	"Bisi",
	"Chidi",
	"Halima",
	"Musa",
	"Ifeoma",
	"Tobi",
	"Sade",
	"Obinna",
	"Hauwa",
	"Dayo",
	"Uche",
	"Femi",
	"Aisha",
	"Nnamdi",
	"Lola",
	"Seyi",
	"Adaeze",
	"Gbenga",
	"Rukayat",
	"Kelechi",
	"Toyin",
	"Ebuka",
	"Maryam",
	"Wale",
	"Ngozika",
	"Bashir",
];

/** Actions the API writes, weighted by how often they happen; `resource` is what they act on. */
const ACTIONS: { action: string; resource: string | null; weight: number }[] = [
	{ action: "auth.login", resource: null, weight: 30 },
	{ action: "auth.refresh", resource: "refresh_token_family", weight: 12 },
	{ action: "auth.login_failed", resource: null, weight: 6 },
	{ action: "auth.logout", resource: "refresh_token_family", weight: 6 },
	{ action: "profile.update", resource: "user", weight: 4 },
	{ action: "auth.password_changed", resource: "user", weight: 2 },
	{ action: "security.settings_updated", resource: "user", weight: 1 },
	{ action: "wallet.linked", resource: "user", weight: 3 },
	{ action: "wallet.disconnected", resource: "user", weight: 1 },
	{ action: "wallet.destination_added", resource: "user", weight: 2 },
	{ action: "wallet.destination_primary", resource: "user", weight: 1 },
	{ action: "group.created", resource: "group", weight: 3 },
	{ action: "group.updated", resource: "group", weight: 2 },
	{ action: "group.join_requested", resource: "group", weight: 4 },
	{ action: "group.join_approved", resource: "group", weight: 3 },
	{ action: "group.left", resource: "group", weight: 1 },
	{ action: "group.governance_updated", resource: "group", weight: 1 },
	{ action: "group.started", resource: "group", weight: 2 },
];

const hex = (rand: () => number, n: number) => Array.from({ length: n }, () => Math.floor(rand() * 16).toString(16)).join("");
const uuidFrom = (rand: () => number) => `${hex(rand, 8)}-${hex(rand, 4)}-4${hex(rand, 3)}-a${hex(rand, 3)}-${hex(rand, 12)}`;

export function seed(version: number): MockAdminDb {
	const rand = prng(20261021);
	const now = Date.now();
	const users: MockAdminUser[] = [
		...NAMED.map(([email, role, days]) => ({
			id: uuidFrom(rand),
			email,
			password: "Password1",
			role,
			createdAt: new Date(now - days * DAY).toISOString(),
		})),
		...FIRST.map((first, i) => ({
			id: uuidFrom(rand),
			email: `${first.toLowerCase()}${i % 3 === 0 ? ".saves" : ""}@example.com`,
			password: "Password1",
			role: "user" as const,
			createdAt: new Date(now - Math.floor(rand() * 45 * DAY)).toISOString(),
		})),
	].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

	const pick = () => {
		const total = ACTIONS.reduce((s, a) => s + a.weight, 0);
		let r = rand() * total;
		for (const a of ACTIONS) if ((r -= a.weight) <= 0) return a;
		return ACTIONS[0]!;
	};

	const auditLogs: AuditLogDto[] = [];
	const ids = () => ({ requestId: uuidFrom(rand), traceId: hex(rand, 32) });
	const ip = () => `102.${Math.floor(rand() * 255)}.${Math.floor(rand() * 255)}.${Math.floor(rand() * 255)}`;
	for (const user of users) {
		auditLogs.push({
			id: 0,
			action: "auth.register",
			actorId: user.id,
			actorEmail: user.email,
			resourceType: "user",
			resourceId: user.id,
			ip: ip(),
			...ids(),
			metadata: {},
			createdAt: user.createdAt,
		});
	}
	for (let i = 0; i < 320; i++) {
		const { action, resource } = pick();
		const user = users[Math.floor(rand() * users.length)]!;
		const at = now - Math.floor(rand() * 30 * DAY);
		if (at < new Date(user.createdAt).getTime()) continue;
		const anonymous = action === "auth.login_failed";
		auditLogs.push({
			id: 0,
			action,
			actorId: anonymous ? null : user.id,
			actorEmail: anonymous ? null : user.email,
			resourceType: resource,
			resourceId: resource === "user" ? user.id : resource ? uuidFrom(rand) : null,
			ip: ip(),
			...ids(),
			metadata:
				action === "auth.login_failed"
					? { email: user.email }
					: action === "auth.login" && rand() > 0.8
						? { method: "google" }
						: action === "group.updated"
							? { fields: ["contributionAmount", "name"].slice(0, 1 + Math.floor(rand() * 2)) }
							: action === "security.settings_updated"
								? { loginLockout: rand() > 0.3 }
								: {},
			createdAt: new Date(at).toISOString(),
		});
	}
	// Someone was locked out this week: five failed sign-ins in a row.
	const locked = users.find((u) => u.email.startsWith("tunde"))!;
	for (let i = 0; i < 5; i++) {
		auditLogs.push({
			id: 0,
			action: "auth.login_failed",
			actorId: null,
			actorEmail: null,
			resourceType: null,
			resourceId: null,
			ip: ip(),
			...ids(),
			metadata: { email: locked.email },
			createdAt: new Date(now - 2 * DAY + i * 40_000).toISOString(),
		});
	}
	// Increasing ids, oldest first (as the API numbers them); listed newest first.
	auditLogs.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).forEach((e, i) => (e.id = i + 1));
	auditLogs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

	return { version, users, auditLogs, refreshTokens: [], health: { database: "up", redis: "up" } };
}
