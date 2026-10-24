import Link from "next/link";
import { Logo } from "@repo/ui/logo";

export default function NotFound() {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
			<Logo className="mb-8" />
			<p className="text-xs font-semibold tracking-[0.2em] text-primary">404</p>
			<h1 className="mt-2 text-xl font-semibold md:text-3xl">Page Not Found</h1>
			<Link href="/" className="mt-8 rounded-full bg-primary px-6 py-3 text-sm text-white">
				Back to the console
			</Link>
		</div>
	);
}
