/**
 * The mock's clock: real time plus the dev panel's offset ("skip ahead a day"), so deadlines, grace
 * periods and voting windows can be crossed without waiting. The offset lives in its own storage
 * key so the screens' clock (`lib/use-now.ts`) can follow it without loading the mock.
 */
export const CLOCK_KEY = "saji-mock-clock";

export function clockOffset() {
	try {
		return Number(localStorage.getItem(CLOCK_KEY)) || 0;
	} catch {
		return 0;
	}
}

export function setClockOffset(ms: number) {
	try {
		if (ms) localStorage.setItem(CLOCK_KEY, String(ms));
		else localStorage.removeItem(CLOCK_KEY);
	} catch {
		/* storage blocked: the clock stays real */
	}
}

export const nowMs = () => Date.now() + (typeof window === "undefined" ? 0 : clockOffset());

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export const addMs = (iso: string, ms: number) => new Date(new Date(iso).getTime() + ms).toISOString();
export const ms = (iso: string) => new Date(iso).getTime();
