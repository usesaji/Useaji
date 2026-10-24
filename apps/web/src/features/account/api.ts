/** My account (`/v1/users/me/*`): profile, picture, password, security settings. */
import { apiDelete, apiForm, apiGet, apiPatch, apiPut } from "@/lib/api/client";
import type {
	AccountDto,
	AuthTokensDto,
	AvatarDto,
	ProfileDto,
	SecuritySettingsDto,
	SetPasswordDto,
	UpdateProfileDto,
	UpdateSecuritySettingsDto,
} from "@/lib/api/dto";

export const getAccount = () => apiGet<AccountDto>("/users/me");

/** Onboarding and Personal Info. Replaces every field: omitted optional fields are cleared. */
export const saveProfile = (input: UpdateProfileDto) => apiPut<ProfileDto>("/users/me/profile", input);

export function uploadAvatar(file: File) {
	const form = new FormData();
	form.append("file", file, file.name);
	return apiForm<AvatarDto>("put", "/users/me/avatar", form);
}

export const removeAvatar = () => apiDelete("/users/me/avatar");

/** Revokes every session and returns a new token pair for this one. */
/** A wrong `currentPassword` answers 401 — about the password, not the session (`credentialCheck`). */
export const setPassword = (input: SetPasswordDto) => apiPut<AuthTokensDto>("/users/me/password", input, { credentialCheck: true });

export const getSecurity = () => apiGet<SecuritySettingsDto>("/users/me/security");

export const updateSecurity = (input: UpdateSecuritySettingsDto) => apiPatch<SecuritySettingsDto>("/users/me/security", input);
