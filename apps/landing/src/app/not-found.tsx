import { Logo } from "@repo/ui/logo";
import { LinkButton } from "@/components/LinkButton";

export default function NotFound() {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
			<Logo className="mb-8" />
			<p className="text-xs font-semibold tracking-[0.2em] text-primary">404</p>
			<h1 className="mt-2 text-xl font-semibold md:text-3xl">Page Not Found</h1>
			<p className="mt-3 max-w-sm text-sm font-light text-neutral-light-active">The page you&apos;re looking for doesn&apos;t exist or may have been moved.</p>
			<LinkButton href="/" className="mt-8">
				Back to Home
			</LinkButton>
		</div>
	);
}
