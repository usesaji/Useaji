"use client";

import { useState } from "react";
import { Avatar } from "@repo/ui/avatar";
import type { MemberDto } from "@/lib/api/dto";

const nameOf = (m: MemberDto) => (m.firstName ? `${m.firstName} ${m.lastName ?? ""}`.trim() : m.tag ? `@${m.tag}` : m.initials);

/**
 * The group's members (`GET /groups/{id}/members`), oldest first. With `onRemove` (an admin, while the
 * group is forming) other non-admin members get a Remove that asks once more before it acts.
 */
export function MembersList({
	members,
	meId,
	onRemove,
	removingId,
}: {
	members: MemberDto[];
	meId?: string | null;
	onRemove?: (member: MemberDto, name: string) => void;
	removingId?: string | null;
}) {
	const [confirming, setConfirming] = useState<string | null>(null);
	return (
		<ul className="stagger mt-2 space-y-2">
			{members.map((m) => {
				const name = nameOf(m);
				const removable = !!onRemove && m.role !== "admin" && m.userId !== meId;
				return (
					<li key={m.userId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-3 py-2">
						<div className="flex min-w-0 items-center gap-3">
							<Avatar src={m.avatarUrl} initials={m.initials} label={name} />
							<div className="min-w-0">
								<p className="truncate text-sm font-medium">
									{name}
									{m.userId === meId && <span className="ml-1 text-xs font-light text-ink-muted">(you)</span>}
								</p>
								<p className="truncate text-xs text-ink-muted">{m.tag ? `@${m.tag}` : "No tag yet"}</p>
							</div>
						</div>
						{m.role === "admin" && <span className="shrink-0 rounded-full bg-primary-light px-3 py-1 text-[11px] text-primary">Admin</span>}
						{removable &&
							(confirming === m.userId ? (
								<span className="animate-fade flex shrink-0 items-center gap-2 text-xs">
									<span className="text-ink-muted">Remove {m.firstName ?? name}?</span>
									<button
										type="button"
										onClick={() => {
											onRemove(m, name);
											setConfirming(null);
										}}
										className="rounded-full bg-accent px-3 py-1 text-white"
									>
										Remove
									</button>
									<button type="button" onClick={() => setConfirming(null)} className="text-ink-muted underline">
										Cancel
									</button>
								</span>
							) : (
								<button
									type="button"
									onClick={() => setConfirming(m.userId)}
									disabled={removingId === m.userId}
									className="shrink-0 text-xs text-accent underline-offset-4 hover:underline disabled:opacity-50"
								>
									{removingId === m.userId ? "Removing…" : "Remove"}
								</button>
							))}
					</li>
				);
			})}
		</ul>
	);
}
