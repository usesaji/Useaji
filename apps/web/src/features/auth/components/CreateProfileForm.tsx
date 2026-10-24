"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@repo/ui/button";
import { Form, FormControl, FormField, FormItem } from "@repo/ui/form";
import { InputField } from "@repo/ui/input-field";
import { useSaveProfile } from "@/features/account/hooks";
import { ProfileSchema, type ProfileInput, type ProfileValues } from "@/features/auth/schema";
import { currentNextPath } from "@/lib/next-path";
import { pageRoutes } from "@/lib/routes";

/** Step 3 of 3: names and the public tag (`PUT /users/me/profile`). Signed in already. */
export function CreateProfileForm() {
	const router = useRouter();
	const save = useSaveProfile({
		quiet: true,
		onSaved: () => router.push(currentNextPath() ?? pageRoutes.dashboardRoutes.OVERVIEW),
	});
	const form = useForm<ProfileInput, unknown, ProfileValues>({
		resolver: zodResolver(ProfileSchema),
		mode: "onChange",
		defaultValues: { firstName: "", lastName: "", tag: "" },
	});

	return (
		<div className="pt-6">
			<div className="mb-5 lg:text-center">
				<h2 className="text-[20px] lg:text-[30px]">Create Profile</h2>
				<p className="text-sm font-light">Your tag is how members find and recognise you.</p>
			</div>

			<Form {...form}>
				<form
					noValidate
					onSubmit={form.handleSubmit(({ firstName, lastName, tag }) => save.mutate({ firstName, lastName, tag }))}
					className="my-5 space-y-5"
				>
					<div className="grid gap-5 sm:grid-cols-2">
						<FormField
							control={form.control}
							name="firstName"
							render={({ field, fieldState }) => (
								<FormItem>
									<FormControl>
										<InputField {...field} label="First Name" placeholder="Ada" autoComplete="given-name" error={fieldState.error?.message} />
									</FormControl>
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="lastName"
							render={({ field, fieldState }) => (
								<FormItem>
									<FormControl>
										<InputField {...field} label="Last Name" placeholder="Okafor" autoComplete="family-name" error={fieldState.error?.message} />
									</FormControl>
								</FormItem>
							)}
						/>
					</div>
					<FormField
						control={form.control}
						name="tag"
						render={({ field, fieldState }) => (
							<FormItem>
								<FormControl>
									<InputField {...field} label="Tag Name" placeholder="@______" autoComplete="username" error={fieldState.error?.message} />
								</FormControl>
							</FormItem>
						)}
					/>
					<Button type="submit" isLoading={save.isPending} disabled={!form.formState.isValid} className="mt-5 w-full">
						Continue
					</Button>
				</form>
			</Form>
		</div>
	);
}
