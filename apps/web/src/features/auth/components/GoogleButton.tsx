"use client";

import { useEffect, useRef, useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { Button } from "@repo/ui/button";
import { GOOGLE_CLIENT_ID, loadGoogleIdentity, setGoogleCredentialHandler } from "@/features/auth/google";
import { useGoogleSignIn } from "@/features/auth/hooks";
import { USE_MOCK_API } from "@/lib/api/source";

/** Google's button is rendered at its widest (Google caps it at 400px), large size, then stretched over ours. */
const GOOGLE_WIDTH = 400;
const GOOGLE_HEIGHT = 40;

/**
 * "Continue with Google". With a client id, the click goes to Google's own button (Google Identity
 * Services), which hands back the ID token `POST /auth/google` takes. It lives in Google's iframe, can't
 * be restyled and is at most 400px wide, so it sits invisibly over ours, stretched to fill it: the user
 * sees our full-width button and clicks Google's. Without a client id it signs straight into the mock's
 * Google account, or (live) isn't shown.
 */
export function GoogleButton() {
	const { mutate, isPending } = useGoogleSignIn();

	if (!GOOGLE_CLIENT_ID) {
		if (!USE_MOCK_API) return null;
		return <StyledButton loading={isPending} onClick={() => mutate("mock-google-id-token-for-the-demo")} />;
	}
	return <GoogleIdentityButton onCredential={mutate} signingIn={isPending} />;
}

/** Google's own button; `onCredential` gets the ID token (sign-in, or re-confirming a Google-only account). */
export function GoogleIdentityButton({
	onCredential,
	signingIn,
}: {
	onCredential: (idToken: string) => void;
	signingIn: boolean;
}) {
	const boxRef = useRef<HTMLDivElement>(null);
	const slotRef = useRef<HTMLDivElement>(null);
	const [ready, setReady] = useState(false);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		setGoogleCredentialHandler(onCredential);
		let cancelled = false;
		loadGoogleIdentity()
			.then((google) => {
				if (cancelled || !slotRef.current) return;
				google.accounts.id.renderButton(slotRef.current, {
					theme: "outline",
					size: "large",
					text: "continue_with",
					shape: "pill",
					logo_alignment: "center",
					width: GOOGLE_WIDTH,
				});
				setReady(true);
			})
			.catch(() => !cancelled && setFailed(true));
		return () => {
			cancelled = true;
			setGoogleCredentialHandler(null);
		};
	}, [onCredential]);

	// Stretch Google's button over ours, and keep it fitted as the form resizes.
	useEffect(() => {
		const box = boxRef.current;
		const slot = slotRef.current;
		if (!box || !slot) return;
		const fit = () => {
			slot.style.transform = `translate(-50%, -50%) scale(${box.offsetWidth / GOOGLE_WIDTH}, ${box.offsetHeight / GOOGLE_HEIGHT})`;
		};
		const observer = new ResizeObserver(fit);
		observer.observe(box);
		return () => observer.disconnect();
	}, [failed]);

	if (failed)
		return <p className="text-center text-xs font-light text-ink-muted">Google sign-in couldn’t load. Use your email for now.</p>;
	return (
		<div
			ref={boxRef}
			className="group relative w-full rounded-[40px] focus-within:ring-[3px] focus-within:ring-ring/50 lg:rounded-[66px]"
		>
			<StyledButton loading={signingIn} disabled={!ready} tabIndex={-1} className="group-hover:bg-neutral-light" />
			<div
				className={`absolute inset-0 overflow-hidden ${ready && !signingIn ? "" : "pointer-events-none"}`}
				style={{ opacity: 0.01 }}
				aria-hidden={!ready}
			>
				<div ref={slotRef} className="absolute top-1/2 left-1/2" style={{ width: GOOGLE_WIDTH, height: GOOGLE_HEIGHT }} />
			</div>
		</div>
	);
}

export function StyledButton({
	loading,
	disabled,
	onClick,
	tabIndex,
	className = "",
}: {
	loading: boolean;
	disabled?: boolean;
	onClick?: () => void;
	tabIndex?: number;
	className?: string;
}) {
	return (
		<Button
			type="button"
			onClick={onClick}
			isLoading={loading}
			disabled={disabled}
			tabIndex={tabIndex}
			className={`w-full bg-[#f5f5f5] font-normal text-black hover:bg-neutral-light ${className}`}
		>
			<FcGoogle size={22} />
			<span>Continue with Google</span>
		</Button>
	);
}
