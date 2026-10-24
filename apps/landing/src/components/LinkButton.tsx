import { Button } from "@repo/ui/button";

/**
 * `@repo/ui`'s Button as a plain <a>: the landing's buttons go to the app (another host) or to a
 * section on this page, so there's no client-side routing to do.
 */
export function LinkButton({ href, children, ...props }: Omit<React.ComponentProps<typeof Button>, "asChild"> & { href: string }) {
	return (
		<Button asChild {...props}>
			<a href={href}>{children}</a>
		</Button>
	);
}
