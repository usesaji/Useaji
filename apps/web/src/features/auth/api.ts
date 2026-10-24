/**
 * Auth — the only seam between the auth screens and the API (`/v1/auth/*`). Answered by the mock
 * while the API is mocked (lib/api/source.ts), with the same shapes.
 */
import { apiGet, apiPost } from "@/lib/api/client";
import type { AuthTokensDto, MeDto, OtpResentDto, PasswordResetStartedDto, SignupStartedDto } from "@/lib/api/dto";

const anonymous = { anonymous: true };

/** POST /auth/signup: emails a 4-digit code; the account is created at verify. */
export const signup = (input: { email: string; password: string }) =>
	apiPost<SignupStartedDto>("/auth/signup", { email: input.email.trim(), password: input.password }, anonymous);

export const resendSignupCode = (input: { email: string; signupToken: string }) =>
	apiPost<OtpResentDto>("/auth/signup/resend-otp", input, anonymous);

/** Creates the account and signs it in. */
export const verifySignup = (input: { email: string; signupToken: string; code: string }) =>
	apiPost<AuthTokensDto>("/auth/signup/verify", input, anonymous);

export const login = (input: { email: string; password: string }) =>
	apiPost<AuthTokensDto>("/auth/login", { email: input.email.trim(), password: input.password }, anonymous);

/** Google ID token from Google Identity Services. Creates the account on first use. */
export const googleSignIn = (idToken: string) => apiPost<AuthTokensDto>("/auth/google", { idToken }, anonymous);

/** Revokes the refresh token and its family. Best effort: signing out locally never waits on it. */
export const logout = (refreshToken: string) => apiPost<null>("/auth/logout", { refreshToken }, anonymous);

export const getMe = () => apiGet<MeDto>("/auth/me");

/**
 * Emails a reset link (`/reset-password#email=…&token=…`) when the address has a password sign-in.
 * Same answer for every address; asking again voids the previous link. 429 on cooldown (5 an hour).
 */
export const forgotPassword = (email: string) => apiPost<PasswordResetStartedDto>("/auth/password/forgot", { email: email.trim() }, anonymous);

/** Sets the new password from the emailed link (once), signs out every session and lifts a login lock. */
export const resetPassword = (input: { email: string; token: string; newPassword: string }) =>
	apiPost<null>("/auth/password/reset", input, anonymous);
