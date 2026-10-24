"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "@repo/ui/sonner";
import { forgotPassword, googleSignIn, login, logout, resendSignupCode, resetPassword, signup, verifySignup } from "@/features/auth/api";
import { getAccount } from "@/features/account/api";
import { signupSession } from "@/features/auth/signup-session";
import { useSession } from "@/features/auth/session";
import { ApiError, toSession } from "@/lib/api/client";
import { currentNextPath, withNext } from "@/lib/next-path";
import { pageRoutes } from "@/lib/routes";
import { currentTime } from "@/lib/use-now";

export const errorMessage = (error: unknown, fallback = "Something went wrong.") =>
	error instanceof ApiError || error instanceof Error ? error.message || fallback : fallback;

/** Where to go once signed in: back to what was asked for, else the dashboard. */
const afterSignIn = () => currentNextPath() ?? pageRoutes.dashboardRoutes.OVERVIEW;

/** The signed-in account (`GET /users/me`): profile, picture, sign-in methods, linked wallet. */
export function useAccount(enabled = true) {
	const signedIn = useSession((state) => Boolean(state.token));
	return useQuery({
		queryKey: ["account"],
		queryFn: getAccount,
		enabled: enabled && signedIn,
		retry: (count, error) => !(error instanceof ApiError && error.status === 401) && count < 1,
		staleTime: 5 * 60 * 1000,
	});
}

export function useRegister() {
	const router = useRouter();
	return useMutation({
		mutationFn: signup,
		onSuccess: (sent) => {
			signupSession.set({ email: sent.email, signupToken: sent.signupToken, resendAt: currentTime() + sent.resendAvailableIn * 1000 });
			toast.success("Check your email", { description: `We sent a 4-digit code to ${sent.email}.` });
			router.push(withNext(pageRoutes.authRoutes.OTP(sent.email)));
		},
		onError: (error) => toast.error("Could not sign you up", { description: errorMessage(error) }),
	});
}

/** Verifying creates the account and signs it in; Create Profile comes next. */
export function useVerifySignup() {
	const router = useRouter();
	const setSession = useSession((state) => state.setSession);
	return useMutation({
		mutationFn: (code: string) => {
			const pending = signupSession.get();
			if (!pending) throw new ApiError("This sign-up has ended. Please start again.", 400, "SIGNUP_EXPIRED");
			return verifySignup({ email: pending.email, signupToken: pending.signupToken, code });
		},
		onSuccess: (tokens) => {
			signupSession.clear();
			setSession({ ...toSession(tokens), method: "password" });
			toast.success("Email verified", { description: "Now tell us a little about yourself." });
			router.push(withNext(pageRoutes.authRoutes.CREATE_PROFILE));
		},
		onError: (error) => {
			toast.error("Verification failed", { description: errorMessage(error) });
			if (error instanceof ApiError && error.code === "SIGNUP_EXPIRED") router.replace(pageRoutes.authRoutes.REGISTER);
		},
	});
}

export function useResendSignupCode() {
	return useMutation({
		mutationFn: () => {
			const pending = signupSession.get();
			if (!pending) throw new ApiError("This sign-up has ended. Please start again.", 400, "SIGNUP_EXPIRED");
			return resendSignupCode({ email: pending.email, signupToken: pending.signupToken });
		},
		onSuccess: (sent) => {
			const pending = signupSession.get();
			if (pending) signupSession.set({ ...pending, resendAt: currentTime() + sent.resendAvailableIn * 1000 });
			toast.success("Code resent", { description: "Check your email for the new code." });
		},
		onError: (error) => toast.error("Could not resend the code", { description: errorMessage(error) }),
	});
}

/** After sign-in: a new account (no profile yet) goes to Create Profile, everyone else onward. */
function useSignedIn(method: "password" | "google") {
	const router = useRouter();
	const queryClient = useQueryClient();
	const setSession = useSession((state) => state.setSession);
	return async (tokens: Parameters<typeof toSession>[0]) => {
		setSession({ ...toSession(tokens), method });
		const account = await queryClient.fetchQuery({ queryKey: ["account"], queryFn: getAccount });
		if (!account.profile) router.push(withNext(pageRoutes.authRoutes.CREATE_PROFILE));
		else {
			toast.success(`Welcome back, ${account.profile.firstName}`);
			router.push(afterSignIn());
		}
	};
}

export function useLogin() {
	const signedIn = useSignedIn("password");
	return useMutation({
		mutationFn: login,
		onSuccess: signedIn,
		onError: (error) => toast.error("Login failed", { description: errorMessage(error) }),
	});
}

/** "Forgot password": the answer is the same whether or not the email has an account. */
export function useForgotPassword() {
	return useMutation({
		mutationFn: forgotPassword,
		onError: (error) => toast.error("Could not send the link", { description: errorMessage(error) }),
	});
}

/** Sets the new password from the emailed link. Every session ends, so the next step is signing in. */
export function useResetPassword() {
	return useMutation({ mutationFn: resetPassword });
}

/** Google sign-in / sign-up with the ID token Google's button hands back. */
export function useGoogleSignIn() {
	const signedIn = useSignedIn("google");
	return useMutation({
		mutationFn: googleSignIn,
		onSuccess: signedIn,
		onError: (error) => toast.error("Google sign-in failed", { description: errorMessage(error) }),
	});
}

/** Revokes the refresh token (best effort), clears the session and every cached query, then goes to log in. */
export function useLogout() {
	const router = useRouter();
	const queryClient = useQueryClient();
	return () => {
		const { refreshToken, clear } = useSession.getState();
		if (refreshToken) void logout(refreshToken).catch(() => undefined);
		clear();
		queryClient.clear();
		router.replace(pageRoutes.authRoutes.LOGIN);
	};
}
