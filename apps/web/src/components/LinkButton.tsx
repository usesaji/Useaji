import Link from "next/link";
import { Button } from "@repo/ui/button";

/** `@repo/ui`'s Button as a Next <Link> (the UI package stays free of next/*). */
export function LinkButton({
	href,
	children,
	...props
}: Omit<React.ComponentProps<typeof Button>, "asChild"> & { href: string }) {
	return (
		<Button asChild {...props}>
			<Link href={href}>{children}</Link>
		</Button>
	);
}
