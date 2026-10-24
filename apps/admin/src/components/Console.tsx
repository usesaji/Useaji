"use client";

import Link from "next/link";
import { AnimatedNumber } from "@repo/ui/animated-number";
import { cn } from "@repo/ui/lib/utils";

/** Pieces the console's pages share: page titles, stat tiles, tables. */

export function PageTitle({
	title,
	subtitle,
	actions,
}: {
	title: React.ReactNode;
	subtitle?: React.ReactNode;
	actions?: React.ReactNode;
}) {
	return (
		<div className="flex flex-wrap items-end justify-between gap-4">
			<div className="min-w-0">
				<h1 className="truncate text-[26px] font-light md:text-[34px] md:font-normal">{title}</h1>
				{subtitle && <p className="mt-1 text-xs font-light text-ink-muted md:text-sm">{subtitle}</p>}
			</div>
			{actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
		</div>
	);
}

const TILE = {
	primary: "bg-primary text-white",
	accent: "bg-accent text-white",
	secondary: "bg-secondary-dark text-white",
	panel: "bg-panel text-neutral-dark",
};

/** A headline number (Saji's coloured stat tiles), counting up when it loads. */
export function StatTile({
	label,
	value,
	hint,
	tone = "panel",
	href,
	index = 0,
}: {
	label: string;
	value: number | null | undefined;
	hint?: string;
	tone?: keyof typeof TILE;
	href?: string;
	index?: number;
}) {
	const body = (
		<>
			<p className="text-sm font-light opacity-90">{label}</p>
			<p className="mt-1 text-3xl md:text-[34px]">
				{value === null || value === undefined ? (
					"—"
				) : (
					<AnimatedNumber value={value} format={(n) => Math.round(n).toLocaleString()} />
				)}
			</p>
			{hint && <p className="mt-1 text-[11px] font-light opacity-80">{hint}</p>}
		</>
	);
	const className = cn("animate-rise block rounded-[14px] px-5 py-5 md:px-6", TILE[tone], href && "hover-lift");
	return href ? (
		<Link href={href} className={className} style={{ "--i": index } as React.CSSProperties}>
			{body}
		</Link>
	) : (
		<div className={className} style={{ "--i": index } as React.CSSProperties}>
			{body}
		</div>
	);
}

export interface Column<T> {
	header: string;
	cell: (row: T) => React.ReactNode;
	className?: string;
}

/**
 * A table in a rounded panel. Rows fade in one after another (a short stagger, capped, so long
 * pages don't wait). `href` makes a row a link.
 */
export function DataTable<T>({
	columns,
	rows,
	rowKey,
	href,
	empty = "Nothing here yet.",
}: {
	columns: Column<T>[];
	rows: T[];
	rowKey: (row: T) => string;
	href?: (row: T) => string;
	empty?: string;
}) {
	if (rows.length === 0)
		return <p className="animate-fade rounded-[20px] bg-panel p-8 text-center text-sm font-light text-ink-muted">{empty}</p>;
	return (
		<div className="relative overflow-x-auto rounded-[20px] bg-panel">
			<table className="w-full min-w-[640px] text-left text-sm">
				<thead>
					<tr className="border-b border-neutral-light text-[11px] tracking-wide text-ink-muted uppercase">
						{columns.map((c) => (
							<th key={c.header} scope="col" className={cn("px-5 py-3.5 font-normal", c.className)}>
								{c.header}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((row, i) => {
						const link = href?.(row);
						return (
							<tr
								key={rowKey(row)}
								className={cn(
									"animate-fade border-b border-neutral-light last:border-0",
									link && "cursor-pointer transition-colors hover:bg-white",
								)}
								style={{ "--i": Math.min(i, 12) } as React.CSSProperties}
							>
								{columns.map((c, ci) => (
									<td key={c.header} className={cn("px-5 py-3.5 align-middle", c.className)}>
										{link && ci === 0 ? (
											<Link href={link} className="hover:text-primary">
												{c.cell(row)}
											</Link>
										) : (
											c.cell(row)
										)}
									</td>
								))}
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}

/** The filter pills above a table. */
export function FilterPills<V extends string>({
	value,
	options,
	onChange,
}: {
	value: V;
	options: { value: V; label: string }[];
	onChange: (v: V) => void;
}) {
	return (
		<div className="flex flex-wrap gap-1.5" role="tablist">
			{options.map((o) => (
				<button
					key={o.value}
					type="button"
					role="tab"
					aria-selected={value === o.value}
					onClick={() => onChange(o.value)}
					className={cn(
						"rounded-full px-4 py-1.5 text-xs transition md:text-sm",
						value === o.value ? "bg-primary text-white" : "bg-neutral-comment hover:bg-primary-light",
					)}
				>
					{o.label}
				</button>
			))}
		</div>
	);
}
