"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@repo/ui/sonner";
import {
	approveJoinRequest,
	createGroup,
	discoverGroups,
	getGroup,
	getOverview,
	joinByInvite,
	leaveGroup,
	liftBan,
	listGroups,
	listJoinRequests,
	listMembers,
	previewInvite,
	rejectJoinRequest,
	removeMember,
	requestToJoin,
	rotateInvite,
	updateGroup,
	uploadCover,
	type GroupsQuery,
} from "@/features/groups/api";
import { errorMessage } from "@/features/auth/hooks";
import type { UpdateGroupDto } from "@/lib/api/dto";
import { pageRoutes } from "@/lib/routes";
import { useRouter } from "next/navigation";

export function useGroups(query: GroupsQuery = {}) {
	return useQuery({ queryKey: ["groups", "list", query], queryFn: () => listGroups(query), placeholderData: keepPreviousData });
}

export function useOverview() {
	return useQuery({ queryKey: ["groups", "overview"], queryFn: getOverview });
}

export function useDiscover(query: Omit<GroupsQuery, "status"> = {}) {
	return useQuery({ queryKey: ["groups", "discover", query], queryFn: () => discoverGroups(query), placeholderData: keepPreviousData });
}

export function useGroup(id: string) {
	return useQuery({ queryKey: ["group", id], queryFn: () => getGroup(id) });
}

export function useMembers(id: string, enabled = true) {
	return useQuery({ queryKey: ["group", id, "members"], queryFn: () => listMembers(id), enabled });
}

export function useJoinRequests(id: string, enabled = true) {
	return useQuery({ queryKey: ["group", id, "requests"], queryFn: () => listJoinRequests(id), enabled, refetchInterval: 20_000 });
}

export function useInvitePreview(code: string) {
	return useQuery({ queryKey: ["invite", code], queryFn: () => previewInvite(code), retry: false });
}

export function useCreateGroup() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: createGroup,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["groups"] }),
		onError: (error) => toast.error("Could not create the group", { description: errorMessage(error) }),
	});
}

/** Joining by invite or from Discover: `joined` at once when the group auto-approves, else `requested`. */
export function useJoin() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: { inviteCode: string } | { groupId: string }) =>
			"inviteCode" in input ? joinByInvite(input.inviteCode) : requestToJoin(input.groupId),
		onSuccess: (result) => {
			void queryClient.invalidateQueries({ queryKey: ["groups"] });
			void queryClient.invalidateQueries({ queryKey: ["group", result.groupId] });
			void queryClient.invalidateQueries({ queryKey: ["notifications"] });
			if (result.status === "joined") toast.success("You're in!", { description: "You joined the group." });
			else toast.success("Request sent", { description: "The admin will review your request." });
		},
		onError: (error) => toast.error("Could not join", { description: errorMessage(error) }),
	});
}

export function useDecideRequest(groupId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ userId, approve }: { userId: string; approve: boolean; name: string }) =>
			approve ? approveJoinRequest(groupId, userId) : rejectJoinRequest(groupId, userId),
		onSuccess: (_, { approve, name }) => {
			void queryClient.invalidateQueries({ queryKey: ["group", groupId] });
			void queryClient.invalidateQueries({ queryKey: ["notifications"] });
			toast.success(approve ? "Member approved" : "Request declined", { description: approve ? `${name} is now a member.` : undefined });
		},
		onError: (error) => toast.error("Could not update the request", { description: errorMessage(error) }),
	});
}

export function useRotateInvite(groupId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () => rotateInvite(groupId),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["group", groupId] });
			toast.success("New invite link", { description: "The old link no longer works." });
		},
		onError: (error) => toast.error("Could not replace the link", { description: errorMessage(error) }),
	});
}

export function useUploadCover(groupId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (file: File) => uploadCover(groupId, file),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["group", groupId] });
			void queryClient.invalidateQueries({ queryKey: ["groups"] });
			toast.success("Cover photo updated");
		},
		onError: (error) => toast.error("Upload failed", { description: errorMessage(error) }),
	});
}

/** Edit a forming group's settings (the form also jumps to the step a rejected field is on). */
export function useUpdateGroup(groupId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: UpdateGroupDto) => updateGroup(groupId, input),
		onSuccess: (group) => {
			queryClient.setQueryData(["group", groupId], group);
			void queryClient.invalidateQueries({ queryKey: ["groups"] });
		},
		onError: (error) => toast.error("Could not save the changes", { description: errorMessage(error) }),
	});
}

/** Leave a forming group, then go back to the group list. */
export function useLeaveGroup(groupId: string) {
	const queryClient = useQueryClient();
	const router = useRouter();
	return useMutation({
		mutationFn: () => leaveGroup(groupId),
		onSuccess: () => {
			queryClient.removeQueries({ queryKey: ["group", groupId] });
			void queryClient.invalidateQueries({ queryKey: ["groups"] });
			toast.success("You left the group");
			router.push(pageRoutes.dashboardRoutes.GROUPS);
		},
		onError: (error) => toast.error("Could not leave the group", { description: errorMessage(error) }),
	});
}

/** Remove a member while forming. They can't rejoin until the ban is lifted — the toast offers that. */
export function useRemoveMember(groupId: string) {
	const queryClient = useQueryClient();
	const lift = useMutation({
		mutationFn: ({ userId }: { userId: string; name: string }) => liftBan(groupId, userId),
		onSuccess: (_, { name }) => toast.success(`${name} can ask to join again`),
		onError: (error) => toast.error("Could not lift the ban", { description: errorMessage(error) }),
	});
	return useMutation({
		mutationFn: ({ userId }: { userId: string; name: string }) => removeMember(groupId, userId),
		onSuccess: (members, { userId, name }) => {
			queryClient.setQueryData(["group", groupId, "members"], members);
			void queryClient.invalidateQueries({ queryKey: ["group", groupId] });
			toast.success(`${name} was removed`, {
				description: "They can't rejoin by invite or request.",
				action: { label: "Let them rejoin", onClick: () => lift.mutate({ userId, name }) },
			});
		},
		onError: (error) => toast.error("Could not remove the member", { description: errorMessage(error) }),
	});
}
