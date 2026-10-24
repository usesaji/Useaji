"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@repo/ui/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { Pager } from "@repo/ui/pager";
import { QueryState } from "@repo/ui/query-state";
import { notificationHref, useMarkRead, useNotifications } from "@/features/activity/hooks";
import { dateTime } from "@/lib/format";

/** Every notification (`GET /notifications`), All / Unread, with Mark all read. */
export default function NotificationsPage() {
	const [unreadOnly, setUnreadOnly] = useState(false);
	const [page, setPage] = useState(1);
	const { data, isLoading, error, refetch } = useNotifications({ unreadOnly, page, limit: 15 });
	const markRead = useMarkRead();
	const rows = data?.results ?? [];

	return (
		<div className="w-full max-w-3xl space-y-6 pb-10">
			<PageHeader
				title="Notifications"
				back
				actions={
					<button type="button" onClick={() => markRead.mutate(undefined)} className="rounded-full bg-neutral-comment px-4 py-2 text-xs hover:bg-primary-light md:text-sm">
						Mark all read
					</button>
				}
			/>
			<div className="flex gap-2" role="tablist">
				{[
					{ value: false, label: "All" },
					{ value: true, label: "Unread" },
				].map((tab) => (
					<button
						key={tab.label}
						type="button"
						role="tab"
						aria-selected={unreadOnly === tab.value}
						onClick={() => {
							setUnreadOnly(tab.value);
							setPage(1);
						}}
						className={cn("rounded-full px-5 py-2 text-sm transition", unreadOnly === tab.value ? "bg-primary text-white" : "bg-neutral-comment hover:bg-primary-light")}
					>
						{tab.label}
					</button>
				))}
			</div>
			<QueryState isLoading={isLoading} error={error} onRetry={() => void refetch()} />
			{data && rows.length === 0 && <p className="rounded-[20px] bg-panel p-6 text-sm">{unreadOnly ? "You're all caught up." : "Nothing yet."}</p>}
			<ul className="stagger divide-y divide-neutral-light rounded-[20px] bg-panel px-4">
				{rows.map((n) => {
					const href = notificationHref(n);
					const body = (
						<span className="flex items-start gap-3 py-4">
							<span aria-hidden className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-primary")} />
							<span className="min-w-0 flex-1">
								<span className="flex items-baseline justify-between gap-3">
									<span className="text-sm font-medium">{n.title}</span>
									<span className="shrink-0 text-[11px] font-light">{dateTime(n.createdAt)}</span>
								</span>
								<span className="mt-0.5 block text-xs text-ink-muted">{n.body}</span>
							</span>
						</span>
					);
					const onOpen = () => !n.readAt && markRead.mutate(n.id);
					return (
						<li key={n.id}>
							{href ? (
								<Link href={href} onClick={onOpen} className="block hover:opacity-80">
									{body}
								</Link>
							) : (
								<button type="button" onClick={onOpen} className="block w-full text-left">
									{body}
								</button>
							)}
						</li>
					);
				})}
			</ul>
			<Pager meta={data?.paginationMeta} onPageChange={setPage} />
		</div>
	);
}
