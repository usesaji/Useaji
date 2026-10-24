"use client";

import { useState } from "react";
import { IoClose } from "react-icons/io5";
import { Avatar } from "@repo/ui/avatar";
import { SectionHeader } from "@/components/SectionHeader";
import { useDecideRequest } from "@/features/groups/hooks";
import type { JoinRequestDto } from "@/lib/api/dto";
import { relative } from "@/lib/format";
import { pageRoutes } from "@/lib/routes";
import { useNow } from "@/lib/use-now";

const requestName = (r: JoinRequestDto) => (r.firstName ? `${r.firstName} ${r.lastName ?? ""}`.trim() : r.tag ? `@${r.tag}` : r.initials);

/**
 * Pending join requests for an admin (`GET /groups/{id}/join-requests`), approve or decline each.
 * Inline on the group page (capped) and on the full Requests page.
 */
export function PendingRequests({ groupId, requests, limit, showViewAll = false }: { groupId: string; requests: JoinRequestDto[]; limit?: number; showViewAll?: boolean }) {
	const decide = useDecideRequest(groupId);
	const now = useNow();
	const shown = limit ? requests.slice(0, limit) : requests;
	if (requests.length === 0) return null;

	return (
		<section>
			<SectionHeader
				title={
					<span className="flex items-center gap-2 text-base md:text-lg">
						Pending Requests
						<span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-error-400 px-1 text-[10px] text-white">{requests.length}</span>
					</span>
				}
				href={showViewAll && requests.length > (limit ?? 0) ? pageRoutes.dashboardRoutes.GROUP_REQUESTS(groupId) : undefined}
			/>
			<ul className="stagger mt-3 space-y-3">
				{shown.map((r) => {
					const name = requestName(r);
					const busy = decide.isPending && decide.variables?.userId === r.userId;
					return (
						<li key={r.userId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
							{/* On a narrow screen the buttons drop under the name instead of squeezing it. */}
							<div className="flex min-w-0 flex-1 basis-52 items-center gap-3">
								<Avatar src={r.avatarUrl} initials={r.initials} label={name} className="h-11 w-11" textClassName="text-sm" />
								<div className="min-w-0">
									<p className="truncate text-sm">{name}</p>
									<p className="text-[11px] font-light">
										{r.tag ? `@${r.tag} · ` : ""}Requested {now ? relative(r.requestedAt, now) : ""}
									</p>
								</div>
							</div>
							<div className="flex shrink-0 gap-2 max-sm:ml-14">
								<button
									type="button"
									disabled={busy}
									onClick={() => decide.mutate({ userId: r.userId, approve: false, name })}
									className="rounded-full bg-accent px-4 py-2 text-xs text-white transition hover:bg-accent-hover disabled:opacity-60"
								>
									Decline
								</button>
								<button
									type="button"
									disabled={busy}
									onClick={() => decide.mutate({ userId: r.userId, approve: true, name })}
									className="rounded-full bg-primary px-4 py-2 text-xs text-white transition hover:bg-primary-hover disabled:opacity-60"
								>
									Approve
								</button>
							</div>
						</li>
					);
				})}
			</ul>
		</section>
	);
}

const DISMISSED_KEY = "saji_dismissed_join_alerts";

function readDismissed(): string[] {
	try {
		return JSON.parse(window.sessionStorage.getItem(DISMISSED_KEY) ?? "[]") as string[];
	} catch {
		return [];
	}
}

/**
 * The admin's heads-up for a new join request, with Approve / Decline in place. Closing it only
 * hides the alert for this session; the request stays in Pending Requests.
 */
export function JoinRequestAlert({ groupId, groupName, requests }: { groupId: string; groupName: string; requests: JoinRequestDto[] }) {
	const [hidden, setHidden] = useState<string[]>(() => (typeof window === "undefined" ? [] : readDismissed()));
	const decide = useDecideRequest(groupId);
	const request = requests.find((r) => !hidden.includes(r.userId));
	if (!request) return null;
	const name = requestName(request);

	const close = () => {
		const next = [...hidden, request.userId];
		try {
			window.sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
		} catch {
			/* storage off — it will show again next visit */
		}
		setHidden(next);
	};

	return (
		<div className="fixed inset-x-0 top-24 z-1050 mx-auto w-full max-w-md px-4 md:top-28">
			<div key={request.userId} role="alert" className="animate-drop relative rounded-[15px] bg-primary-light px-5 py-4 shadow-lg">
				<button type="button" onClick={close} aria-label="Dismiss" className="absolute top-3 right-3.5 text-primary-darker">
					<IoClose />
				</button>
				<p className="text-[10px] font-light text-primary-darker">Notifications</p>
				<p className="mt-1 pr-6 text-base text-primary-darker">{name} requested to join</p>
				<p className="text-xs font-light text-primary-darker">
					{name} asked to join {groupName}.
				</p>
				<div className="mt-3 flex gap-2">
					<button
						type="button"
						disabled={decide.isPending}
						onClick={() => decide.mutate({ userId: request.userId, approve: false, name }, { onSuccess: close })}
						className="rounded-full bg-accent px-5 py-2 text-xs text-white disabled:opacity-60"
					>
						Decline
					</button>
					<button
						type="button"
						disabled={decide.isPending}
						onClick={() => decide.mutate({ userId: request.userId, approve: true, name }, { onSuccess: close })}
						className="rounded-full bg-primary px-5 py-2 text-xs text-white disabled:opacity-60"
					>
						Approve
					</button>
				</div>
			</div>
		</div>
	);
}
