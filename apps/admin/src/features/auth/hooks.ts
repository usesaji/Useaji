"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { getMe, signIn, signOut } from "@/features/auth/api";
import { useSession } from "@/features/auth/session";
import { ApiError } from "@/lib/api/client";

export const errorMessage = (error: unknown, fallback = "Something went wrong.") =>
	error instanceof Error ? error.message || fallback : fallback;

export function useMe(enabled = true) {
	const signedIn = useSession((state) => Boolean(state.token));
	return useQuery({
		queryKey: ["me"],
		queryFn: getMe,
		enabled: enabled && signedIn,
		retry: (count, error) => !(error instanceof ApiError && (error.status === 401 || error.status === 403)) && count < 1,
		staleTime: 5 * 60 * 1000,
	});
}

export function useSignIn(next: string) {
	const router = useRouter();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ email, password }: { email: string; password: string }) => signIn(email, password),
		onSuccess: (me) => {
			queryClient.setQueryData(["me"], me);
			router.replace(next);
		},
	});
}

export function useSignOut() {
	const router = useRouter();
	const queryClient = useQueryClient();
	return async () => {
		await signOut();
		queryClient.clear();
		router.replace("/sign-in");
	};
}
