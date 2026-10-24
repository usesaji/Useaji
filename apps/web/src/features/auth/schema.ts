import { z } from "zod";

export const SignInSchema = z.object({
	email: z.string().nonempty("Email is required").email("Invalid email address"),
	password: z.string().nonempty("Password is required"),
});
export type SignInValues = z.infer<typeof SignInSchema>;

/** The API asks for at least 8 characters; the rest keeps passwords from being trivially weak. */
const password = z
	.string()
	.min(8, "Password must be at least 8 characters")
	.max(128, "Password is too long")
	.refine((v) => /[A-Za-z]/.test(v), "Must contain a letter")
	.refine((v) => /[\d@$!%*?&.,_\-+=#]/.test(v), "Must contain a number or symbol");

export const SignUpSchema = z
	.object({
		email: z.string().nonempty("Email is required").email("Invalid email address"),
		password,
		confirmPassword: z.string().nonempty("Please confirm your password"),
	})
	.refine((data) => data.password === data.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });
export type SignUpValues = z.infer<typeof SignUpSchema>;

export const ForgotPasswordSchema = z.object({
	email: z.string().nonempty("Email is required").email("Invalid email address"),
});
export type ForgotPasswordValues = z.infer<typeof ForgotPasswordSchema>;

export const ResetPasswordSchema = z
	.object({ password, confirmPassword: z.string().nonempty("Please confirm your password") })
	.refine((data) => data.password === data.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });
export type ResetPasswordValues = z.infer<typeof ResetPasswordSchema>;

export const VerifyOtpSchema = z.object({
	otp: z.string().length(4, "The code is 4 digits").regex(/^\d+$/, "The code is numbers only"),
});
export type VerifyOtpValues = z.infer<typeof VerifyOtpSchema>;

/** PUT /users/me/profile: names and the public tag (3–20 of a-z, 0-9, _). */
export const ProfileSchema = z.object({
	firstName: z.string().trim().nonempty("First name is required").max(60, "First name is too long"),
	lastName: z.string().trim().nonempty("Last name is required").max(60, "Last name is too long"),
	tag: z
		.string()
		.trim()
		.transform((v) => v.replace(/^@/, "").toLowerCase())
		.pipe(z.string().regex(/^[a-z0-9_]{3,20}$/, "3–20 letters, numbers or _")),
	gender: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional(),
	dateOfBirth: z.string().optional(),
	address: z.string().max(300, "Address is too long").optional(),
});
export type ProfileInput = z.input<typeof ProfileSchema>;
export type ProfileValues = z.output<typeof ProfileSchema>;

export const PasswordSchema = z
	.object({
		currentPassword: z.string().optional(),
		newPassword: password,
		confirmPassword: z.string().nonempty("Please confirm your password"),
	})
	.refine((data) => data.newPassword === data.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });
export type PasswordValues = z.infer<typeof PasswordSchema>;
