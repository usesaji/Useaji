"use client";

/**
 * Google Identity Services ("Sign in with Google"). The button Google renders
 * hands back an ID token, which `/auth/google` verifies. Only the public client
 * id belongs in the app — never the OAuth client secret. Its authorised
 * JavaScript origins (Google Cloud console) must list every origin the app runs on.
 */
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

interface GoogleIdentity {
	accounts: {
		id: {
			initialize(config: {
				client_id: string;
				callback: (response: { credential: string }) => void;
				ux_mode?: "popup";
				auto_select?: boolean;
			}): void;
			renderButton(
				parent: HTMLElement,
				options: {
					theme: "outline" | "filled_blue" | "filled_black";
					size: "large" | "medium" | "small";
					text?: "signin_with" | "signup_with" | "continue_with" | "signin";
					shape?: "pill" | "rectangular" | "circle" | "square";
					logo_alignment?: "left" | "center";
					/** Pixels; Google caps it at 400. */
					width?: number;
				},
			): void;
		};
	};
}

declare global {
	interface Window {
		google?: GoogleIdentity;
	}
}

let loading: Promise<GoogleIdentity> | null = null;
/** The mounted button's handler: GIS takes one callback per page, set once at initialize. */
let onCredential: ((idToken: string) => void) | null = null;

export function setGoogleCredentialHandler(handler: ((idToken: string) => void) | null) {
	onCredential = handler;
}

/** Loads the GIS script once and initializes it. Rejects if it can't load (offline, blocked). */
export function loadGoogleIdentity(): Promise<GoogleIdentity> {
	loading ??= new Promise<GoogleIdentity>((resolve, reject) => {
		const script = document.createElement("script");
		script.src = "https://accounts.google.com/gsi/client";
		script.async = true;
		script.onload = () => {
			const google = window.google;
			if (!google) return reject(new Error("Google Identity Services didn’t load."));
			google.accounts.id.initialize({
				client_id: GOOGLE_CLIENT_ID,
				callback: ({ credential }) => onCredential?.(credential),
				ux_mode: "popup",
				auto_select: false,
			});
			resolve(google);
		};
		script.onerror = () => reject(new Error("Google Identity Services didn’t load."));
		document.head.appendChild(script);
	}).catch((error) => {
		loading = null; // let a later mount try again
		throw error;
	});
	return loading;
}
