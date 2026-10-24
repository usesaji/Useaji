/**
 * Carries the in-flight sign-up between Register and Verify: the email and the `signupToken` the API
 * returned, which only this client holds and verify / resend need. sessionStorage, so it dies with
 * the tab rather than lingering on a shared machine; cleared once the account exists.
 */

const KEY = "saji-signup";

interface PendingSignup {
	email: string;
	signupToken: string;
	/** When "Resend code" works again (ms since epoch). */
	resendAt: number;
}

export const signupSession = {
	get(): PendingSignup | null {
		if (typeof window === "undefined") return null;
		try {
			return JSON.parse(window.sessionStorage.getItem(KEY) ?? "null") as PendingSignup | null;
		} catch {
			return null;
		}
	},
	set(value: PendingSignup) {
		window.sessionStorage.setItem(KEY, JSON.stringify(value));
	},
	clear() {
		if (typeof window !== "undefined") window.sessionStorage.removeItem(KEY);
	},
};
