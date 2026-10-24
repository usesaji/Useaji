"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { IoNotifications } from "react-icons/io5";
import { notificationHref, useMarkRead, useNotifications, useUnreadCount } from "@/features/activity/hooks";
import { relative } from "@/lib/format";
import { pageRoutes } from "@/lib/routes";
import { useNow } from "@/lib/use-now";

/** The bell: unread count plus a dropdown of recent notifications. */
export function NotificationBell() {
	const [open, setOpen] = useState(false);
	const { data: count } = useUnreadCount();
	const { data: page } = useNotifications({ limit: 8 }, open);
	const markRead = useMarkRead();
	const now = useNow();
	const wrapper = useRef<HTMLDivElement>(null);
	const unread = count?.unread ?? 0;

	// Close on outside click and on Escape.
	useEffect(() => {
		if (!open) return;
		const onPointerDown = (event: MouseEvent) => {
			if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") setOpen(false);
		};
		document.addEventListener("mousedown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("mousedown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [open]);

	const rows = page?.results ?? [];

	return (
		<div ref={wrapper} className="relative">
			<button
				type="button"
				onClick={() => setOpen((value) => !value)}
				aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
				aria-expanded={open}
				className="relative block"
			>
				<IoNotifications className="text-2xl md:text-3xl" />
				{unread > 0 && (
					<span key={unread} aria-hidden className="animate-pop absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-error-500 px-1 text-[10px] font-medium text-white">
						{unread > 9 ? "9+" : unread}
					</span>
				)}
			</button>

			{open && (
				<div className="absolute right-0 z-1100 mt-2 w-80 overflow-hidden rounded-2xl border border-[#eee] bg-white shadow-lg max-sm:-right-12">
					<div className="flex items-center justify-between border-b border-[#f0f0f0] px-4 py-3">
						<span className="text-sm font-medium">Notifications</span>
						{unread > 0 && (
							<button type="button" onClick={() => markRead.mutate(undefined)} className="text-xs font-medium text-primary">
								Mark all read
							</button>
						)}
					</div>
					<div className="max-h-96 overflow-y-auto">
						{rows.length === 0 ? (
							<p className="px-4 py-8 text-center text-sm text-ink-muted">Nothing yet. We&apos;ll tell you the moment something happens.</p>
						) : (
							rows.map((row) => {
								const href = notificationHref(row);
								const onActivate = () => {
									if (!row.readAt) markRead.mutate(row.id);
									setOpen(false);
								};
								const content = (
									<span className="flex items-start gap-2">
										{!row.readAt && <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
										<span className={row.readAt ? "pl-4" : ""}>
											<span className="block text-sm font-medium">{row.title}</span>
											<span className="mt-0.5 block text-xs text-ink-muted">{row.body}</span>
											<span className="mt-1 block text-[11px] text-ink-muted">{now ? relative(row.createdAt, now) : ""}</span>
										</span>
									</span>
								);
								const className = "block w-full border-b border-[#f6f6f6] px-4 py-3 text-left transition-colors last:border-0 hover:bg-[#faf9ff]";
								return href ? (
									<Link key={row.id} href={href} onClick={onActivate} className={className}>
										{content}
									</Link>
								) : (
									<button key={row.id} type="button" onClick={onActivate} className={className}>
										{content}
									</button>
								);
							})
						)}
					</div>
					<Link
						href={pageRoutes.dashboardRoutes.NOTIFICATIONS}
						onClick={() => setOpen(false)}
						className="block border-t border-[#f0f0f0] px-4 py-3 text-center text-sm font-medium text-primary"
					>
						See all notifications
					</Link>
				</div>
			)}
		</div>
	);
}
