/** Savings groups (`/v1/groups/*`): create, edit, list, discover, invites, members, join requests. */
import { apiDelete, apiForm, apiGet, apiPatch, apiPost, type Page } from "@/lib/api/client";
import type {
	CoverDto,
	CreateGroupInput,
	GroupDetailDto,
	GroupStatus,
	GroupSummaryDto,
	GroupsOverviewDto,
	InviteDto,
	JoinRequestDto,
	JoinResultDto,
	MemberDto,
	UpdateGroupDto,
} from "@/lib/api/dto";

/** POST /groups is multipart: the settings as fields, plus an optional `coverPhoto`. */
export function createGroup(input: CreateGroupInput) {
	const form = new FormData();
	for (const [key, value] of Object.entries(input)) {
		if (value === undefined || value === null || value === "") continue;
		if (value instanceof File) form.append(key, value, value.name);
		else form.append(key, String(value));
	}
	return apiForm<GroupDetailDto>("post", "/groups", form);
}

export interface GroupsQuery {
	status?: GroupStatus;
	type?: "rotating" | "challenge";
	search?: string;
	page?: number;
	limit?: number;
}

export const listGroups = (query: GroupsQuery = {}) => apiGet<Page<GroupSummaryDto>>("/groups", query);

export const getOverview = () => apiGet<GroupsOverviewDto>("/groups/overview");

/** Forming public groups you haven't joined. */
export const discoverGroups = (query: Omit<GroupsQuery, "status"> = {}) => apiGet<Page<GroupSummaryDto>>("/groups/discover", query);

/** The code travels in the body so it stays out of the API's access logs. */
export const previewInvite = (inviteCode: string) => apiPost<GroupDetailDto>("/groups/invites/preview", { inviteCode });

export const joinByInvite = (inviteCode: string) => apiPost<JoinResultDto>("/groups/invites/join", { inviteCode });

export const getGroup = (id: string) => apiGet<GroupDetailDto>(`/groups/${id}`);

export const listMembers = (id: string) => apiGet<MemberDto[]>(`/groups/${id}/members`);

/** Admins only, while forming: only the fields that change (cover and approval rules have their own routes). */
export const updateGroup = (id: string, input: UpdateGroupDto) => apiPatch<GroupDetailDto>(`/groups/${id}`, input);

/** While forming only. If the last admin leaves, the longest-standing member becomes admin. */
export const leaveGroup = (id: string) => apiPost<null>(`/groups/${id}/leave`);

/** Admins only, while forming; admins can't be removed. The person can't rejoin until `liftBan`. */
export const removeMember = (id: string, userId: string) => apiDelete<MemberDto[]>(`/groups/${id}/members/${userId}`);

/** Lets a removed person request to join again. */
export const liftBan = (id: string, userId: string) => apiDelete<null>(`/groups/${id}/bans/${userId}`);

/** For groups found through Discover. */
export const requestToJoin = (id: string) => apiPost<JoinResultDto>(`/groups/${id}/join-requests`);

export const listJoinRequests = (id: string) => apiGet<JoinRequestDto[]>(`/groups/${id}/join-requests`);

export const approveJoinRequest = (id: string, userId: string) => apiPost<MemberDto[]>(`/groups/${id}/join-requests/${userId}/approve`);

export const rejectJoinRequest = (id: string, userId: string) => apiPost<null>(`/groups/${id}/join-requests/${userId}/reject`);

export const rotateInvite = (id: string) => apiPost<InviteDto>(`/groups/${id}/invite/rotate`);

export function uploadCover(id: string, file: File) {
	const form = new FormData();
	form.append("file", file, file.name);
	return apiForm<CoverDto>("put", `/groups/${id}/cover`, form);
}
