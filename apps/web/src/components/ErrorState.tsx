import { Button } from "@repo/ui/button";
import { Logo } from "@repo/ui/logo";
import { LinkButton } from "@/components/LinkButton";

interface ErrorAction {
	label: string;
	href?: string;
	onClick?: () => void;
}

/** Full-page error / not-found: logo, icon, code, heading and up to two actions. */
export function ErrorState({
	icon,
	code,
	heading,
	description,
	primaryAction,
	secondaryAction,
}: {
	icon: React.ReactNode;
	code?: string;
	heading: string;
	description: string;
	primaryAction: ErrorAction;
	secondaryAction?: ErrorAction;
}) {
	const action = (a: ErrorAction, variant?: "outline") =>
		a.href ? (
			<LinkButton href={a.href} variant={variant}>
				{a.label}
			</LinkButton>
		) : (
			<Button onClick={a.onClick} variant={variant}>
				{a.label}
			</Button>
		);

	return (
		<div className="flex min-h-screen w-full flex-col items-center justify-center px-4 py-10 text-center">
			<Logo className="mb-8" />
			<span className="flex size-20 items-center justify-center rounded-full bg-primary-light text-3xl text-primary md:size-24 md:text-4xl">{icon}</span>
			{code && <p className="mt-6 text-xs font-semibold tracking-[0.2em] text-primary">{code}</p>}
			<h1 className="mt-2 max-w-md text-xl font-semibold text-neutral-dark md:text-3xl">{heading}</h1>
			<p className="mt-3 max-w-sm text-sm leading-relaxed font-light text-neutral-light-active">{description}</p>
			<div className="mt-8 flex flex-wrap items-center justify-center gap-3">
				{action(primaryAction)}
				{secondaryAction && action(secondaryAction, "outline")}
			</div>
		</div>
	);
}
