"use client";

import * as React from "react";
import { IoEye, IoEyeOff } from "react-icons/io5";
import { Input } from "./input";
import { Label } from "./label";
import { cn } from "./lib/utils";

interface InputFieldProps extends Omit<React.ComponentProps<"input">, "value"> {
	name: string;
	label?: React.ReactNode;
	value?: string | number;
	error?: string | null;
	description?: React.ReactNode;
}

/**
 * The rounded app input: optional label and description above, the error below, and a show/hide
 * toggle on password fields. Works controlled (`value`/`onChange`) or with react-hook-form's
 * `register` (forwarded ref).
 */
const InputField = React.forwardRef<HTMLInputElement, InputFieldProps>(
	({ name, label, type = "text", error, description, className, readOnly, id, ...props }, ref) => {
		const [view, setView] = React.useState(false);
		const inputId = id ?? name;

		return (
			<div className="space-y-2">
				{label && (
					<Label htmlFor={inputId} className="text-sm font-light">
						{label}
					</Label>
				)}
				{description && <p className="text-sm text-muted-foreground">{description}</p>}
				<div className="relative">
					<Input
						ref={ref}
						id={inputId}
						name={name}
						type={type === "password" && view ? "text" : type}
						readOnly={readOnly}
						aria-invalid={error ? true : undefined}
						className={cn(
							"h-10.75 rounded-[900px] border-neutral-light-hover bg-white px-6 text-base caret-primary shadow-none outline-none placeholder:text-sm placeholder:text-neutral-light-active focus:border-primary focus-visible:ring-1 sm:py-4 sm:text-base md:h-12",
							error && "border-accent text-accent focus-visible:ring-accent",
							readOnly && "cursor-not-allowed bg-neutral-600 font-semibold text-black",
							type === "password" && "pr-12",
							className,
						)}
						{...props}
					/>
					{type === "password" && (
						<button
							type="button"
							onClick={() => setView((v) => !v)}
							aria-label={view ? "Hide password" : "Show password"}
							className="absolute top-1/2 right-4 -translate-y-1/2 text-xl text-neutral-light-active transition-colors hover:text-neutral"
							tabIndex={-1}
						>
							{view ? <IoEyeOff /> : <IoEye />}
						</button>
					)}
				</div>
				{error && (
					<p className="mt-1 text-xs text-error-500" role="alert">
						{error}
					</p>
				)}
			</div>
		);
	},
);
InputField.displayName = "InputField";

export { InputField };
