"use client";

import { useState } from "react";
import { Button } from "@repo/ui/button";
import { useDestinationActions } from "@/features/wallet/hooks";
import type { DestinationDto } from "@/lib/api/dto";
import { BodyPortal } from "@repo/ui/body-portal";

const STELLAR_ADDRESS = /^G[A-Z2-7]{55}$/;

/** Add a payout address (`POST /wallet/destinations`): a Stellar address and an optional label. Saving asks for the password. */
export function AddDestinationModal({ onClose, onAdded }: { onClose: () => void; onAdded?: (d: DestinationDto) => void }) {
	const [address, setAddress] = useState("");
	const [label, setLabel] = useState("");
	const { add } = useDestinationActions();
	const valid = STELLAR_ADDRESS.test(address.trim());

	return (
		<BodyPortal lockScroll>
			<div
				className="fixed inset-0 z-1002 flex items-center justify-center bg-black/40 p-4"
				onClick={(e) => e.target === e.currentTarget && onClose()}
			>
				<div
					role="dialog"
					aria-modal="true"
					aria-labelledby="add-destination-title"
					className="w-full max-w-sm rounded-2xl bg-white p-5"
				>
					<h3 id="add-destination-title" className="text-lg font-medium">
						Add payout address
					</h3>
					<p className="mt-1 text-xs font-light text-ink-muted">
						A Stellar wallet that can receive your payouts. Exchange addresses that need a memo aren&apos;t supported. The first one you add becomes primary.
					</p>
					<label htmlFor="destination-label" className="mt-4 block text-sm font-light">
						Label (optional)
					</label>
					<input
						id="destination-label"
						value={label}
						maxLength={60}
						onChange={(e) => setLabel(e.target.value)}
						placeholder="e.g. My LOBSTR wallet"
						className="mt-1 w-full rounded-full border border-neutral-light-hover px-4 py-2.5 text-sm outline-none focus:border-primary"
					/>
					<label htmlFor="destination-address" className="mt-3 block text-sm font-light">
						Stellar address
					</label>
					<input
						id="destination-address"
						value={address}
						onChange={(e) => setAddress(e.target.value.toUpperCase())}
						placeholder="G…"
						spellCheck={false}
						className={`mt-1 w-full rounded-full border px-4 py-2.5 font-mono text-xs outline-none ${address && !valid ? "border-error-500" : "border-neutral-light-hover focus:border-primary"}`}
					/>
					{address && !valid && (
						<p className="mt-1 text-xs text-error-500">That doesn&apos;t look like a Stellar address (G… and 56 characters).</p>
					)}
					<div className="mt-5 flex justify-end gap-2">
						<Button variant="outline" size="sm" onClick={onClose}>
							Cancel
						</Button>
						<Button
							size="sm"
							isLoading={add.isPending}
							disabled={!valid}
							onClick={() =>
								add.mutate(
									{ address: address.trim(), label: label.trim() || undefined },
									{ onSuccess: (d) => (onAdded?.(d), onClose()) },
								)
							}
						>
							Save
						</Button>
					</div>
				</div>
			</div>
		</BodyPortal>
	);
}
