"use client";

import { useState } from "react";
import { HiOutlineArrowDownTray, HiOutlineDocumentText } from "react-icons/hi2";
import { toast } from "@repo/ui/sonner";
import { InputField } from "@repo/ui/input-field";
import { PageHeader } from "@/components/PageHeader";
import { getStatement } from "@/features/activity/api";
import { errorMessage } from "@/features/auth/hooks";
import type { StatementDto } from "@/lib/api/dto";
import { pageRoutes } from "@/lib/routes";
import { currentTime } from "@/lib/use-now";

/** yyyy-mm-dd (UTC — the API's dates are UTC and inclusive). */
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

const PRESETS: { label: string; range: () => [string, string] }[] = [
	{ label: "Last 30 days", range: () => [isoDay(currentTime() - 29 * 86_400_000), isoDay(currentTime())] },
	{ label: "Last 3 months", range: () => [isoDay(currentTime() - 91 * 86_400_000), isoDay(currentTime())] },
	{ label: "This year", range: () => [`${new Date(currentTime()).getUTCFullYear()}-01-01`, isoDay(currentTime())] },
	{ label: "All time", range: () => ["", ""] },
];

/** The statement as CSV (the API returns the rows; the screen builds the file). */
function toCsv(s: StatementDto) {
	const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
	const lines = [
		["Saji statement"],
		["Name", s.fullName ?? ""],
		["Email", s.email],
		["Period", `${s.from ?? "start"} to ${s.to}`],
		["Generated", s.generatedAt],
		[],
		["Date", "Type", "Group", "Amount", "Asset", "Stellar transaction"],
		...s.transactions.map((t) => [t.createdAt, t.kind, t.group?.name ?? "", t.amount, t.asset, t.txHash]),
		[],
		["Total contributions", s.totals.contributions],
		["Total payouts", s.totals.payouts],
		["Total withdrawals", s.totals.withdrawals],
		...(s.truncated ? [["Note", "More than 10,000 rows: narrow the dates for the rest."]] : []),
	];
	return lines.map((row) => row.map(cell).join(",")).join("\n");
}

/** Generate Statement: every contribution and payout in a period (`GET /statements`), as a CSV download. */
export default function StatementPage() {
	const [start, setStart] = useState("");
	const [end, setEnd] = useState("");
	const [preset, setPreset] = useState<string | null>("All time");
	const [downloading, setDownloading] = useState(false);
	const rangeError = start && end && end < start ? "The end date must be on or after the start date." : null;

	const download = async () => {
		setDownloading(true);
		try {
			const statement = await getStatement({ from: start || undefined, to: end || undefined });
			const url = URL.createObjectURL(new Blob([toCsv(statement)], { type: "text/csv" }));
			const link = document.createElement("a");
			link.href = url;
			link.download = `saji-statement${start ? `-${start}` : ""}${end ? `-to-${end}` : ""}.csv`;
			document.body.appendChild(link);
			link.click();
			link.remove();
			URL.revokeObjectURL(url);
			toast.success("Statement downloaded", { description: `${statement.transactions.length} transactions. Open it in Excel, Google Sheets or Numbers.` });
		} catch (err) {
			toast.error("Download failed", { description: errorMessage(err) });
		} finally {
			setDownloading(false);
		}
	};

	return (
		<div className="w-full max-w-2xl space-y-6 pb-10">
			<PageHeader title="Generate Statement" subtitle="Every contribution and payout on your account." back backHref={pageRoutes.dashboardRoutes.ME} />
			<section className="space-y-6 rounded-[20px] bg-panel p-6 md:p-7">
				<div>
					<p className="text-sm font-light">Period</p>
					<div className="mt-3 flex flex-wrap gap-2">
						{PRESETS.map(({ label, range }) => (
							<button
								key={label}
								type="button"
								aria-pressed={preset === label}
								onClick={() => {
									const [from, to] = range();
									setStart(from);
									setEnd(to);
									setPreset(label);
								}}
								className={`rounded-full px-4 py-2 text-xs transition md:text-sm ${preset === label ? "bg-primary text-white" : "bg-white text-neutral-dark hover:bg-primary-light"}`}
							>
								{label}
							</button>
						))}
					</div>
				</div>
				<div className="grid gap-4 sm:grid-cols-2">
					<InputField name="start_date" label="Start Date" type="date" value={start} onChange={(e) => (setStart(e.target.value), setPreset(null))} />
					<InputField name="end_date" label="End Date" type="date" value={end} onChange={(e) => (setEnd(e.target.value), setPreset(null))} error={rangeError} />
				</div>
				<div className="flex items-center gap-3 rounded-[14px] bg-white px-4 py-3">
					<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-light text-lg text-primary">
						<HiOutlineDocumentText />
					</span>
					<div>
						<p className="text-sm">CSV file</p>
						<p className="text-xs font-light">Opens in Excel, Google Sheets or Numbers.</p>
					</div>
				</div>
			</section>
			<button
				type="button"
				onClick={download}
				disabled={downloading || Boolean(rangeError)}
				className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary-dark text-sm text-white transition hover:bg-primary-dark-hover disabled:cursor-not-allowed disabled:bg-neutral-light-hover disabled:text-neutral-light-active md:h-14 md:text-base"
			>
				<HiOutlineArrowDownTray className="text-lg" />
				{downloading ? "Preparing…" : "Download Statement"}
			</button>
		</div>
	);
}
