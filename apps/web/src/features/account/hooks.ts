"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@repo/ui/sonner";
import { getSecurity, removeAvatar, saveProfile, setPassword, updateSecurity, uploadAvatar } from "@/features/account/api";
import { errorMessage } from "@/features/auth/hooks";
import { useSession } from "@/features/auth/session";
import { toSession } from "@/lib/api/client";
import type { AccountDto, UpdateProfileDto } from "@/lib/api/dto";
import { isReauthCancelled, withIdentity } from "@/features/auth/reauth";

export { useAccount } from "@/features/auth/hooks";

/** Onboarding and Personal Info. The cached account updates before anyone navigates on. */
export function useSaveProfile(options: { onSaved?: () => void; quiet?: boolean } = {}) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: UpdateProfileDto) => saveProfile(input),
		onSuccess: (profile) => {
			queryClient.setQueryData<AccountDto>(["account"], (account) => (account ? { ...account, profile } : account));
			void queryClient.invalidateQueries({ queryKey: ["account"] });
			if (!options.quiet) toast.success("Profile saved");
			options.onSaved?.();
		},
		onError: (error) => toast.error("Could not save your profile", { description: errorMessage(error) }),
	});
}

export function useUploadAvatar() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: uploadAvatar,
		onSuccess: ({ avatarUrl }) => {
			queryClient.setQueryData<AccountDto>(["account"], (account) => (account ? { ...account, avatarUrl } : account));
			toast.success("Profile picture updated");
		},
		onError: (error) => toast.error("Upload failed", { description: errorMessage(error) }),
	});
}

export function useRemoveAvatar() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: removeAvatar,
		onSuccess: () => {
			queryClient.setQueryData<AccountDto>(["account"], (account) => (account ? { ...account, avatarUrl: null } : account));
			toast.success("Profile picture removed");
		},
		onError: (error) => toast.error("Could not remove it", { description: errorMessage(error) }),
	});
}

/** Every other session is signed out; this one carries on with the new token pair. */
export function useSetPassword(onDone?: () => void) {
	const queryClient = useQueryClient();
	return useMutation({
		// Without a current password (a Google-only account) Google confirms it's you instead.
		mutationFn: ({ newPassword, currentPassword }: { newPassword: string; currentPassword?: string }) =>
			currentPassword
				? setPassword({ currentPassword, newPassword })
				: withIdentity("Set a password to sign in with your email too.", ({ googleIdToken }) => setPassword({ newPassword, googleIdToken })),
		onSuccess: (tokens) => {
			const { method, setSession } = useSession.getState();
			setSession({ ...toSession(tokens), method: method ?? "password" });
			void queryClient.invalidateQueries({ queryKey: ["account"] });
			void queryClient.invalidateQueries({ queryKey: ["security"] });
			toast.success("Password saved", { description: "Your other devices were signed out." });
			onDone?.();
		},
		onError: (error) => !isReauthCancelled(error) && toast.error("Could not change your password", { description: errorMessage(error) }),
	});
}

export function useSecurity() {
	return useQuery({ queryKey: ["security"], queryFn: getSecurity });
}

export function useUpdateSecurity() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: updateSecurity,
		onSuccess: (settings) => {
			queryClient.setQueryData(["security"], settings);
			toast.success("Security settings saved");
		},
		onError: (error) => toast.error("Could not save", { description: errorMessage(error) }),
	});
}
