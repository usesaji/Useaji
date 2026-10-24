"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { HiArrowLongLeft } from "react-icons/hi2";

/** A plain "← Back" for pages whose title lives further down. */
export function GoBack({ href }: { href?: string }) {
	const router = useRouter();
	const body = (
		<>
			<HiArrowLongLeft className="text-2xl" />
			Back
		</>
	);
	return href ? (
		<Link href={href} className="flex w-fit items-center gap-2.5 text-sm md:text-base">
			{body}
		</Link>
	) : (
		<button type="button" onClick={() => router.back()} className="flex w-fit items-center gap-2.5 text-sm md:text-base">
			{body}
		</button>
	);
}
