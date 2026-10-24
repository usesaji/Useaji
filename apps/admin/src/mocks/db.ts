import { seed, type MockAdminDb } from "@/mocks/seed";

/** The console's mock backend: one JSON document in localStorage. Reads are copies; writes go through `updateDb`. */

const KEY = "saji-admin-mock-db";
const VERSION = 2;

let memory: MockAdminDb | null = null;

function load(): MockAdminDb {
	if (memory) return memory;
	try {
		const parsed = JSON.parse(localStorage.getItem(KEY) ?? "null") as MockAdminDb | null;
		memory = parsed && parsed.version === VERSION ? parsed : seed(VERSION);
	} catch {
		memory = seed(VERSION);
	}
	return memory;
}

function save(db: MockAdminDb) {
	try {
		localStorage.setItem(KEY, JSON.stringify(db));
	} catch {
		/* storage blocked: memory only */
	}
	memory = db;
}

export function updateDb<T>(change: (db: MockAdminDb) => T): T {
	const db = structuredClone(load());
	const result = change(db);
	save(db);
	return structuredClone(result);
}

export function readDb(): MockAdminDb {
	return structuredClone(load());
}

export function resetMockDb() {
	save(seed(VERSION));
}
