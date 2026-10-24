"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { HiArrowsUpDown, HiXMark } from "react-icons/hi2";
import { Button } from "@repo/ui/button";
import { Avatar } from "@repo/ui/avatar";
import { LinkButton } from "@/components/LinkButton";
import { PageHeader } from "@/components/PageHeader";
import { QueryState } from "@repo/ui/query-state";
import { useStartGroup } from "@/features/circle/hooks";
import { useGroup, useMembers } from "@/features/groups/hooks";
import type { MemberDto } from "@/lib/api/dto";
import { pageRoutes } from "@/lib/routes";
import { BodyPortal } from "@repo/ui/body-portal";

/** Fisher–Yates, on a copy. */
function shuffle<T>(list: T[]) {
	const next = [...list];
	for (let i = next.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[next[i], next[j]] = [next[j]!, next[i]!];
	}
	return next;
}

const nameOf = (m: MemberDto) => (m.firstName ? `${m.firstName} ${m.lastName ?? ""}`.trim() : m.tag ? `@${m.tag}` : m.initials);

/**
 * "Who gets paid first?" — the admin drags members into the payout order (manual / custom groups),
 * then starts the cycle with it: the API takes the order in `POST /groups/{id}/start`, with no way
 * to save it beforehand (docs/BACKEND-GAPS.md), so the arrangement lives here until Start.
 */
export default function PayoutOrderPage() {
	const { groupId } = useParams<{ groupId: string }>();
	const router = useRouter();
	const { data: group } = useGroup(groupId);
	const members = useMembers(groupId);
	const start = useStartGroup(groupId);
	const [arranged, setArranged] = useState<string[] | null>(null);
	const [dragIndex, setDragIndex] = useState<number | null>(null);
	const [showRandomized, setShowRandomized] = useState(false);

	const byId = new Map((members.data ?? []).map((m) => [m.userId, m]));
	const order = (arranged ?? (members.data ?? []).map((m) => m.userId)).filter((id) => byId.has(id));

	const onDrop = (index: number) => {
		if (dragIndex === null || dragIndex === index) return;
		const next = [...order];
		const [moved] = next.splice(dragIndex, 1);
		next.splice(index, 0, moved!);
		setArranged(next);
		setDragIndex(null);
	};
	const move = (index: number, by: number) => {
		const to = index + by;
		if (to < 0 || to >= order.length) return;
		const next = [...order];
		[next[index], next[to]] = [next[to]!, next[index]!];
		setArranged(next);
	};
	const randomize = () => {
		setArranged(shuffle(order));
		setShowRandomized(true);
	};

	const startable = group?.myRole === "admin" && group.status === "forming";

	return (
		<div className="w-full max-w-4xl pb-10">
			<PageHeader
				title="Who gets paid first?"
				subtitle="Drag members into the payout order. The person at the top receives the first payout."
				back
				backHref={pageRoutes.dashboardRoutes.GROUP(groupId)}
			/>

			{group && !startable && (
				<p className="mt-6 text-sm text-ink-muted">
					The payout order is set when the admin starts the cycle. It can change later only by a group vote.
				</p>
			)}
			<QueryState isLoading={members.isLoading} error={members.error} onRetry={() => void members.refetch()} className="mt-6" />

			{startable && members.data && (
				<>
					<ol className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
						{order.map((id, i) => {
							const m = byId.get(id)!;
							return (
								<li
									key={id}
									draggable
									onDragStart={() => setDragIndex(i)}
									onDragOver={(e) => e.preventDefault()}
									onDrop={() => onDrop(i)}
									className={`flex cursor-grab items-center justify-between gap-3 rounded-xl bg-panel px-3 py-2.5 active:cursor-grabbing ${dragIndex === i ? "opacity-50" : ""}`}
								>
									<div className="flex min-w-0 items-center gap-2">
										<Avatar src={m.avatarUrl} initials={m.initials} label={nameOf(m)} />
										<span className="truncate text-sm font-medium">{nameOf(m)}</span>
									</div>
									<div className="flex shrink-0 items-center gap-1">
										<button
											type="button"
											onClick={() => move(i, -1)}
											disabled={i === 0}
											aria-label={`Move ${nameOf(m)} up`}
											className="rounded-full px-1.5 text-ink-muted disabled:opacity-30"
										>
											↑
										</button>
										<button
											type="button"
											onClick={() => move(i, 1)}
											disabled={i === order.length - 1}
											aria-label={`Move ${nameOf(m)} down`}
											className="rounded-full px-1.5 text-ink-muted disabled:opacity-30"
										>
											↓
										</button>
										<span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">#{i + 1}</span>
									</div>
								</li>
							);
						})}
					</ol>

					<button
						type="button"
						onClick={randomize}
						className="mt-3 flex w-full items-center justify-between rounded-xl bg-[#efeaff] px-4 py-3 text-primary"
					>
						<div className="text-left">
							<p className="text-sm font-medium">Randomize Order</p>
							<p className="text-xs font-light">Shuffle the payout sequence.</p>
						</div>
						<span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white">
							<HiArrowsUpDown />
						</span>
					</button>

					<div className="mt-6 flex gap-3">
						<LinkButton variant="outline" className="flex-1" href={pageRoutes.dashboardRoutes.GROUP(groupId)}>
							Back to group
						</LinkButton>
						<Button
							className="flex-1"
							isLoading={start.isPending}
							disabled={order.length < 2}
							onClick={() => start.mutate(order, { onSuccess: () => router.push(pageRoutes.dashboardRoutes.CIRCLE(groupId)) })}
						>
							Start Cycle
						</Button>
					</div>
					<p className="mt-3 text-xs font-light text-ink-muted">
						Starting fixes this order, opens round 1 and closes the group to new members.
					</p>
				</>
			)}

			{showRandomized && (
				<BodyPortal lockScroll>
					<div className="fixed inset-0 z-1002 flex items-center justify-center bg-black/40 p-4">
						<div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-2xl bg-white p-6 text-center">
							<div className="flex justify-end">
								<button type="button" onClick={() => setShowRandomized(false)} className="text-lg" aria-label="Close">
									<HiXMark />
								</button>
							</div>
							<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white">
								<HiArrowsUpDown className="text-2xl" />
							</div>
							<h3 className="mt-4 text-lg font-medium">Order Randomized</h3>
							<p className="mt-2 text-sm text-ink-muted">
								The payout sequence has been shuffled. You can still drag to fine-tune it before starting.
							</p>
							<Button className="mt-5 w-full" onClick={() => setShowRandomized(false)}>
								Got it
							</Button>
						</div>
					</div>
				</BodyPortal>
			)}
		</div>
	);
}
