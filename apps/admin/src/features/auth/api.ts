/** Admin sign-in: the same `/v1/auth` login as the app, then only `role: admin` gets in. */
import { useSession } from "@/features/auth/session";
import { ApiError, apiGet, apiPost, toSession } from "@/lib/api/client";
import type { AuthTokensDto, MeDto } from "@/lib/api/dto";

export const getMe = () => apiGet<MeDto>("/auth/me");

export async function signIn(email: string, password: string) {
	const tokens = await apiPost<AuthTokensDto>("/auth/login", { email: email.trim(), password }, { anonymous: true });
	useSession.getState().setSession({ ...toSession(tokens), method: "password" });
	const me = await getMe();
	if (me.role !== "admin") {
		await signOut();
		throw new ApiError("This account doesn’t have admin access.", 403, "NOT_ADMIN");
	}
	return me;
}

/** Revokes the refresh token (best effort) and forgets the session. */
export async function signOut() {
	const refreshToken = useSession.getState().refreshToken;
	useSession.getState().clear();
	if (refreshToken) await apiPost("/auth/logout", { refreshToken }, { anonymous: true }).catch(() => undefined);
}
