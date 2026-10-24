import { AuthHeader } from "@/components/layouts/AuthHeader";

/**
 * Auth pages sit centred in the space below the fixed header (its height is the top padding), so the
 * form and its illustration line up in the middle of the screen; taller content simply scrolls.
 */
export default function Layout({ children }: LayoutProps<"/auth">) {
	return (
		<div className="flex min-h-svh flex-col">
			<AuthHeader />
			<main className="flex flex-1 flex-col justify-center pt-24 pb-10 sm:pt-32 lg:px-10 lg:pb-6 xl:px-20">{children}</main>
		</div>
	);
}
