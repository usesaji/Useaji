"use client";

import { useAccount } from "@/features/auth/hooks";
import { useMembers } from "@/features/groups/hooks";
import type { MemberPreviewDto } from "@/lib/api/dto";

/**
 * Display names inside a group: the name on the `MemberPreviewDto` itself (cycles, proposals, defaults,
 * history), else the member list (`GET /groups/{id}/members`), else the @tag.
 */
type Preview = Pick<MemberPreviewDto, "userId" | "tag" | "initials"> & Partial<Pick<MemberPreviewDto, "firstName" | "lastName">>;

export function useMemberNames(groupId: string, enabled = true) {
	const { data: members } = useMembers(groupId, enabled);
	const { data: account } = useAccount();
	const byId = new Map((members ?? []).map((m) => [m.userId, m]));

	/** "Tunde Bakare", "You", or "@tunde". */
	const name = (member: Preview | null | undefined, opts: { you?: boolean } = {}) => {
		if (!member) return "A member";
		if (opts.you !== false && account?.id === member.userId) return "You";
		if (member.firstName) return `${member.firstName} ${member.lastName ?? ""}`.trim();
		const row = byId.get(member.userId);
		if (row?.firstName) return `${row.firstName} ${row.lastName ?? ""}`.trim();
		return member.tag ? `@${member.tag}` : member.initials;
	};
	/** "Tunde" */
	const first = (member: Preview | null | undefined, opts: { you?: boolean } = {}) => {
		const full = name(member, opts);
		return full.startsWith("@") ? full : full.split(" ")[0]!;
	};
	return { name, first, me: account?.id ?? null, members: members ?? [] };
}
