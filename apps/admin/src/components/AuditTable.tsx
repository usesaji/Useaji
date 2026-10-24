"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { HiChevronDown } from "react-icons/hi2";
import { StatusPill } from "@repo/ui/panel";
import { cn } from "@repo/ui/lib/utils";
import { actionLabel, actionTone, dateTime, shortId } from "@/features/admin/format";
import type { AuditLogDto } from "@/lib/api/dto";

/** The audit log as a table; a row opens to show where it came from and its metadata. */
export function AuditTable({ rows, showActor = true }: { rows: AuditLogDto[]; showActor?: boolean }) {
	const [open, setOpen] = useState<number | null>(null);
	if (rows.length === 0)
		return (
			<p className="animate-fade rounded-[20px] bg-panel p-8 text-center text-sm font-light text-ink-muted">No events match.</p>
		);

	return (
		<div className="relative overflow-x-auto rounded-[20px] bg-panel">
			<table className="w-full min-w-160 text-left text-sm">
				<thead>
					<tr className="border-b border-neutral-light text-[11px] tracking-wide text-ink-muted uppercase">
						<th scope="col" className="px-5 py-3.5 font-normal">
							Event
						</th>
						{showActor && (
							<th scope="col" className="px-5 py-3.5 font-normal">
								Who
							</th>
						)}
						<th scope="col" className="px-5 py-3.5 font-normal">
							Target
						</th>
						<th scope="col" className="px-5 py-3.5 font-normal">
							When
						</th>
						<th scope="col" className="w-10 px-3 py-3.5">
							<span className="sr-only">Details</span>
						</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((e, i) => {
						const expanded = open === e.id;
						return (
							<Fragment key={e.id}>
								<tr
									onClick={() => setOpen(expanded ? null : e.id)}
									className={cn(
										"animate-fade cursor-pointer border-b border-neutral-light transition-colors hover:bg-white",
										expanded && "bg-white",
									)}
									style={{ "--i": Math.min(i, 12) } as React.CSSProperties}
								>
									<td className="px-5 py-3">
										<StatusPill tone={actionTone(e.action)}>{actionLabel(e.action)}</StatusPill>
									</td>
									{showActor && (
										<td className="max-w-56 truncate px-5 py-3 font-light">
											{e.actorId ? (
												<Link href={`/users/${e.actorId}`} onClick={(ev) => ev.stopPropagation()} className="hover:text-primary">
													{e.actorEmail ?? shortId(e.actorId)}
												</Link>
											) : (
												<span className="text-ink-muted">System</span>
											)}
										</td>
									)}
									<td className="px-5 py-3 font-light text-ink-muted">
										{e.resourceType ? `${e.resourceType} ${e.resourceId ? shortId(e.resourceId) : ""}` : "—"}
									</td>
									<td className="px-5 py-3 font-light whitespace-nowrap">{dateTime(e.createdAt)}</td>
									<td className="px-3 py-3">
										<button
											type="button"
											aria-expanded={expanded}
											aria-label={expanded ? "Hide details" : "Show details"}
											onClick={(ev) => {
												ev.stopPropagation();
												setOpen(expanded ? null : e.id);
											}}
											className="rounded-full p-1 text-ink-muted hover:bg-neutral-comment"
										>
											<HiChevronDown className={cn("transition-transform duration-200", expanded && "rotate-180")} />
										</button>
									</td>
								</tr>
								{expanded && (
									<tr className="border-b border-neutral-light bg-white">
										<td colSpan={showActor ? 5 : 4} className="px-5 pb-4">
											<dl className="animate-drop grid gap-x-6 gap-y-2 pt-1 text-xs sm:grid-cols-[auto_1fr]">
												<dt className="text-ink-muted">Action</dt>
												<dd className="font-mono">{e.action}</dd>
												<dt className="text-ink-muted">Event ID</dt>
												<dd className="font-mono break-all">{e.id}</dd>
												{e.resourceId && (
													<>
														<dt className="text-ink-muted">Target</dt>
														<dd className="font-mono break-all">
															{e.resourceType} {e.resourceId}
														</dd>
													</>
												)}
												<dt className="text-ink-muted">From</dt>
												<dd className="break-all">{e.ip ?? "—"}</dd>
												<dt className="text-ink-muted">Request</dt>
												<dd className="font-mono break-all">
													{e.requestId ?? "—"}
													{e.traceId && <span className="text-ink-muted"> · trace {e.traceId}</span>}
												</dd>
												<dt className="text-ink-muted">Metadata</dt>
												<dd>
													{Object.keys(e.metadata).length ? (
														<pre className="overflow-x-auto rounded-lg bg-panel p-3 font-mono text-[11px] leading-relaxed">
															{JSON.stringify(e.metadata, null, 2)}
														</pre>
													) : (
														"—"
													)}
												</dd>
											</dl>
										</td>
									</tr>
								)}
							</Fragment>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
