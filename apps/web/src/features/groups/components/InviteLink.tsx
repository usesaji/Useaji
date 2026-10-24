"use client";

import { useState } from "react";
import { HiArrowPath, HiCheck, HiOutlineClipboardDocument } from "react-icons/hi2";
import { useRotateInvite } from "@/features/groups/hooks";
import type { InviteDto } from "@/lib/api/dto";

/** The admin's shareable invite link (`GroupDetailDto.invite`), with copy and "replace link". */
export function InviteLink({ groupId, invite }: { groupId: string; invite: InviteDto }) {
	const [copied, setCopied] = useState(false);
	const rotate = useRotateInvite(groupId);

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(invite.url);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			/* clipboard blocked — the text can still be selected */
		}
	};

	return (
		<section className="mt-8 rounded-2xl bg-[#f7f7f7] p-4 md:p-6">
			<div className="flex items-start justify-between gap-3">
				<div>
					<h3 className="md:text-xl">Invite members</h3>
					<p className="mt-1 text-xs font-light text-ink-muted">Share this link. Anyone who opens it can request to join.</p>
				</div>
				<button
					type="button"
					onClick={() => rotate.mutate()}
					disabled={rotate.isPending}
					className="flex shrink-0 items-center gap-1 text-xs text-primary disabled:opacity-50"
					title="The old link stops working"
				>
					<HiArrowPath className={rotate.isPending ? "animate-spin" : ""} /> New link
				</button>
			</div>
			<div className="mt-3 flex items-center gap-2">
				<input
					readOnly
					value={invite.url}
					onFocus={(e) => e.currentTarget.select()}
					aria-label="Invite link"
					className="min-w-0 flex-1 truncate rounded-full border border-neutral-light-hover bg-white px-4 py-2.5 text-sm"
				/>
				<button type="button" onClick={copy} className="flex shrink-0 items-center gap-1 rounded-full bg-primary px-4 py-2.5 text-sm text-white transition hover:bg-primary-hover">
					{copied ? (
						<>
							<HiCheck className="text-base" /> Copied
						</>
					) : (
						<>
							<HiOutlineClipboardDocument className="text-base" /> Copy
						</>
					)}
				</button>
			</div>
		</section>
	);
}
