"use client";

import { useState } from "react";
import { create } from "zustand";
import { Button } from "@repo/ui/button";
import { BodyPortal } from "@repo/ui/body-portal";
import { InputField } from "@repo/ui/input-field";
import { GOOGLE_CLIENT_ID } from "@/features/auth/google";
import { GoogleIdentityButton, StyledButton } from "@/features/auth/components/GoogleButton";
import { useSecurity } from "@/features/account/hooks";
import { ApiError } from "@/lib/api/client";
import type { ReauthDto } from "@/lib/api/dto";

/**
 * "Confirm it's you" before changes to where money goes: linking or disconnecting a wallet, adding a
 * withdraw destination or choosing the primary one. The API wants `currentPassword` — or, for
 * Google-only accounts, a fresh `googleIdToken` — in the request body (`ReauthDto`).
 *
 * `withIdentity(reason, run)` opens the dialog and calls `run(proof)` when the person confirms. A
 * wrong password is shown in the dialog (it stays open); anything else closes it and rejects. Closing
 * it rejects with `ReauthCancelled`. `<ReauthDialog />` is mounted once, in the dashboard layout.
 */

export class ReauthCancelled extends Error {
	constructor() {
		super("Cancelled");
	}
}

interface Request {
	reason: string;
	run: (proof: ReauthDto) => Promise<unknown>;
	resolve: (value: unknown) => void;
	reject: (error: unknown) => void;
}

const useReauth = create<{ request: Request | null }>(() => ({ request: null }));

export function withIdentity<T>(reason: string, run: (proof: ReauthDto) => Promise<T>): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		useReauth.getState().request?.reject(new ReauthCancelled());
		useReauth.setState({ request: { reason, run, resolve: resolve as (value: unknown) => void, reject } });
	});
}

export const isReauthCancelled = (error: unknown) => error instanceof ReauthCancelled;

export function ReauthDialog() {
	const request = useReauth((s) => s.request);
	if (!request) return null;
	// Keyed by request so each opening starts with an empty field.
	return <Dialog key={request.reason + String(request.run)} request={request} />;
}

function Dialog({ request }: { request: Request }) {
	const security = useSecurity();
	const [password, setPassword] = useState("");
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const googleOnly = security.data ? !security.data.hasPassword : false;

	const close = (result?: { value: unknown } | { error: unknown }) => {
		useReauth.setState({ request: null });
		if (!result) request.reject(new ReauthCancelled());
		else if ("value" in result) request.resolve(result.value);
		else request.reject(result.error);
	};

	const submit = async (proof: ReauthDto) => {
		setPending(true);
		setError(null);
		try {
			close({ value: await request.run(proof) });
		} catch (e) {
			// 401: the password (or Google account) didn't match — let them try again.
			if (e instanceof ApiError && e.status === 401) {
				setError(googleOnly ? "That Google account doesn't match this one." : "That password isn't right.");
				setPending(false);
			} else close({ error: e });
		}
	};

	return (
		<BodyPortal lockScroll>
			<div className="fixed inset-0 z-1150 flex items-center justify-center bg-black/40 p-4" onClick={(e) => e.target === e.currentTarget && !pending && close()}>
				<div role="dialog" aria-modal="true" aria-labelledby="reauth-title" className="animate-pop w-full max-w-sm rounded-2xl bg-white p-5 md:p-6">
					<h3 id="reauth-title" className="text-lg font-medium">
						Confirm it&apos;s you
					</h3>
					<p className="mt-1 text-sm font-light text-ink-muted">{request.reason} We&apos;ll email you about it too.</p>
					{googleOnly ? (
						<div className="mt-5 space-y-3">
							<p className="text-xs font-light">You sign in with Google — confirm with the same Google account.</p>
							{GOOGLE_CLIENT_ID ? (
								<GoogleIdentityButton onCredential={(googleIdToken) => void submit({ googleIdToken })} signingIn={pending} />
							) : (
								<StyledButton loading={pending} onClick={() => void submit({ googleIdToken: "mock-google-id-token-for-the-demo" })} />
							)}
						</div>
					) : (
						<form
							noValidate
							className="mt-5"
							onSubmit={(e) => {
								e.preventDefault();
								if (password) void submit({ currentPassword: password });
							}}
						>
							<InputField
								name="current_password"
								label="Your password"
								type="password"
								autoComplete="current-password"
								autoFocus
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								error={error}
							/>
							<div className="mt-5 flex justify-end gap-2">
								<Button type="button" variant="outline" size="sm" onClick={() => close()} disabled={pending}>
									Cancel
								</Button>
								<Button type="submit" size="sm" isLoading={pending} disabled={!password}>
									Confirm
								</Button>
							</div>
						</form>
					)}
					{googleOnly && error && (
						<p role="alert" className="mt-3 text-xs text-error-500">
							{error}
						</p>
					)}
					{googleOnly && (
						<button type="button" onClick={() => close()} disabled={pending} className="mt-4 w-full text-center text-xs text-ink-muted underline">
							Cancel
						</button>
					)}
				</div>
			</div>
		</BodyPortal>
	);
}
