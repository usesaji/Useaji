/* eslint-disable @next/next/no-img-element */
import { cn } from "@repo/ui/lib/utils";
import type { MemberPreviewDto } from "@/lib/api/dto";

/**
 * Stacked member avatars with a real overflow count: the API sends up to 8 faces
 * (`membersPreview`), the member count is the total. Initials when there is no picture.
 */
export function MemberAvatars({
	members,
	total,
	size = "md",
	borderClassName = "border-white",
	overflowClassName = "bg-neutral-900 text-white",
}: {
	members: Pick<MemberPreviewDto, "userId" | "avatarUrl" | "initials" | "tag">[];
	total: number;
	size?: "sm" | "md" | "lg";
	/** Ring around each face, so the stack reads on any background. */
	borderClassName?: string;
	/** Colours of the "+N" bubble. */
	overflowClassName?: string;
}) {
	const box = {
		sm: "h-4 w-4 text-[7px]",
		md: "h-8.5 w-8.5 text-xs",
		lg: "h-9 w-9 text-xs md:h-12 md:w-12 md:text-sm",
	}[size];
	const overflow = Math.max(0, total - members.length);
	if (members.length === 0) return null;

	return (
		<div className="flex items-center">
			{members.map((member) => (
				<div
					key={member.userId}
					className={cn(box, "-ml-2 shrink-0 overflow-hidden rounded-full border bg-[#efeaff] first:ml-0", borderClassName)}
					title={member.tag ? `@${member.tag}` : member.initials}
				>
					{member.avatarUrl ? (
						<img src={member.avatarUrl} alt="" className="h-full w-full object-cover" />
					) : (
						<span className="flex h-full w-full items-center justify-center font-medium text-primary">{member.initials.slice(0, size === "sm" ? 1 : 2)}</span>
					)}
				</div>
			))}
			{overflow > 0 && (
				<div className={cn(box, "-ml-2 shrink-0 rounded-full border", borderClassName, overflowClassName)}>
					<span className="flex h-full w-full items-center justify-center font-medium">+{overflow}</span>
				</div>
			)}
		</div>
	);
}
