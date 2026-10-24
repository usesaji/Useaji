import { MINUTE, ms } from "@/mocks/clock";
import { accountDto } from "@/mocks/dto";
import { signupToken, uuid } from "@/mocks/ids";
import { HttpError, badRequest, conflict, route, unauthorized, validate, type Ctx, type Upload } from "@/mocks/router";
import type { MockDb, MockUser } from "@/mocks/types";

/**
 * /auth/* and /users/me/*. Mock rules: the emailed sign-up code is any 4 digits except 0000 (there
 * is no inbox); access tokens last 15 minutes so the refresh rotation is exercised; refresh tokens
 * are single use and replaying one revokes its family, as on the API.
 */

const ACCESS_TTL_S = 15 * 60;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Access tokens: `mock.<userId>.<expiresAtMs>`. */
export function userForToken(db: MockDb, token: string, at: number): MockUser | null {
	const [prefix, userId, expires] = token.split(".");
	if (prefix !== "mock" || !userId || Number(expires) < at) return null;
	return db.users.find((u) => u.id === userId) ?? null;
}

function issueTokens(db: MockDb, user: MockUser, at: number, family = uuid()) {
	const refreshToken = `mock-refresh-${uuid()}`;
	db.refreshTokens.push({ token: refreshToken, userId: user.id, family, used: false });
	return {
		accessToken: `mock.${user.id}.${at + ACCESS_TTL_S * 1000}`,
		refreshToken,
		tokenType: "Bearer" as const,
		expiresIn: ACCESS_TTL_S,
	};
}

const findByEmail = (db: MockDb, email: string) => db.users.find((u) => u.email === email.trim().toLowerCase());

// ---------------------------------------------------------------- sign up

route("POST", "/auth/signup", { auth: false, status: 202, message: "Verification code sent" }, ({ db, at, body }) => {
	const email = String(body.email ?? "")
		.trim()
		.toLowerCase();
	const password = String(body.password ?? "");
	validate([
		[EMAIL.test(email), "email must be an email"],
		[password.length >= 8, "password must be longer than or equal to 8 characters"],
	]);
	if (findByEmail(db, email)) throw conflict("An account with this email already exists.");
	const token = signupToken();
	db.signups = db.signups.filter((s) => s.email !== email);
	db.signups.push({
		email,
		password,
		signupToken: token,
		code: "",
		expiresAt: new Date(at + 10 * MINUTE).toISOString(),
		resendAt: new Date(at + MINUTE).toISOString(),
		attempts: 0,
	});
	return { signupToken: token, email, otpExpiresIn: 600, resendAvailableIn: 60 };
});

route("POST", "/auth/signup/resend-otp", { auth: false, status: 202, message: "Verification code sent" }, ({ db, at, body }) => {
	const signup = db.signups.find((s) => s.email === String(body.email ?? "").toLowerCase() && s.signupToken === body.signupToken);
	if (!signup) throw badRequest("This sign-up has ended. Please start again.");
	if (ms(signup.resendAt) > at) throw new HttpError(429, "TOO_MANY_REQUESTS", "Please wait before asking for another code.");
	signup.resendAt = new Date(at + MINUTE).toISOString();
	signup.expiresAt = new Date(at + 10 * MINUTE).toISOString();
	return { otpExpiresIn: 600, resendAvailableIn: 60 };
});

route("POST", "/auth/signup/verify", { auth: false, message: "Account created" }, ({ db, at, now, body }) => {
	const email = String(body.email ?? "").toLowerCase();
	validate([[/^\d{4}$/.test(String(body.code ?? "")), "code must match /^\\d{4}$/ regular expression"]]);
	const signup = db.signups.find((s) => s.email === email && s.signupToken === body.signupToken);
	if (!signup || ms(signup.expiresAt) < at) throw badRequest("This code has expired. Ask for a new one.");
	if (body.code === "0000") {
		signup.attempts += 1;
		if (signup.attempts >= 5) db.signups = db.signups.filter((s) => s !== signup);
		throw badRequest("That code is incorrect.");
	}
	if (findByEmail(db, email)) throw conflict("An account with this email already exists.");
	db.signups = db.signups.filter((s) => s !== signup);
	const user: MockUser = {
		id: uuid(),
		email,
		password: signup.password,
		role: "user",
		createdAt: now,
		profile: null,
		avatarUrl: null,
		signInMethods: ["password"],
		security: { loginLockout: true },
		failedLogins: 0,
		lockedUntil: null,
		wallet: null,
		destinations: [],
	};
	db.users.push(user);
	return issueTokens(db, user, at);
});

// ---------------------------------------------------------------- sign in

route("POST", "/auth/login", { auth: false, status: 200, message: "Signed in" }, ({ db, at, body }) => {
	const user = findByEmail(db, String(body.email ?? ""));
	if (user?.lockedUntil && ms(user.lockedUntil) > at) {
		throw new HttpError(423, "LOCKED", "Too many wrong passwords. Your account is locked for 15 minutes.");
	}
	if (!user || !user.password || user.password !== body.password) {
		if (user && user.security.loginLockout) {
			user.failedLogins += 1;
			if (user.failedLogins >= 5) {
				user.lockedUntil = new Date(at + 15 * MINUTE).toISOString();
				user.failedLogins = 0;
			}
		}
		throw unauthorized("Incorrect email or password.");
	}
	user.failedLogins = 0;
	user.lockedUntil = null;
	return issueTokens(db, user, at);
});

// ---------------------------------------------------------------- forgot / reset password

/**
 * There's no inbox: the link is logged to the console and kept in `db.passwordResets` (the dev
 * panel shows the latest one). Same answer for every address; asking again voids the previous link.
 */
route(
	"POST",
	"/auth/password/forgot",
	{ auth: false, status: 202, message: "If the email has an account, a reset link was sent" },
	({ db, at, body }) => {
		const email = String(body.email ?? "")
			.trim()
			.toLowerCase();
		validate([[EMAIL.test(email), "email must be an email"]]);
		const user = findByEmail(db, email);
		if (user?.password) {
			const token = signupToken();
			db.passwordResets = db.passwordResets.filter((r) => r.email !== email);
			db.passwordResets.push({ email, token, expiresAt: new Date(at + 30 * MINUTE).toISOString() });
			console.info(`[mock] reset link: /reset-password#email=${encodeURIComponent(email)}&token=${token}`);
		}
		return { expiresIn: 1800, resendAvailableIn: 60 };
	},
);

route(
	"POST",
	"/auth/password/reset",
	{ auth: false, status: 200, message: "Password reset. Sign in with your new password" },
	({ db, at, body }) => {
		const email = String(body.email ?? "")
			.trim()
			.toLowerCase();
		validate([[String(body.newPassword ?? "").length >= 8, "newPassword must be longer than or equal to 8 characters"]]);
		const reset = db.passwordResets.find((r) => r.email === email && r.token === body.token);
		const user = findByEmail(db, email);
		if (!reset || !user || ms(reset.expiresAt) < at) throw badRequest("This reset link is invalid, used or expired.");
		db.passwordResets = db.passwordResets.filter((r) => r !== reset);
		user.password = String(body.newPassword);
		user.lockedUntil = null;
		user.failedLogins = 0;
		db.refreshTokens = db.refreshTokens.filter((t) => t.userId !== user.id);
		return null;
	},
);

/** Mock Google: the ID token isn't checked; it signs into (or creates) the demo Google account. */
route("POST", "/auth/google", { auth: false, status: 200, message: "Signed in" }, ({ db, at, now, body }) => {
	if (String(body.idToken ?? "").length < 20) throw unauthorized("Google sign-in failed.");
	let user = findByEmail(db, "google.user@usesaji.com");
	if (!user) {
		user = {
			id: uuid(),
			email: "google.user@usesaji.com",
			password: null,
			role: "user",
			createdAt: now,
			profile: null,
			avatarUrl: null,
			signInMethods: ["google"],
			security: { loginLockout: true },
			failedLogins: 0,
			lockedUntil: null,
			wallet: null,
			destinations: [],
		};
		db.users.push(user);
	}
	return issueTokens(db, user, at);
});

route("POST", "/auth/refresh", { auth: false, status: 200, message: "Session refreshed" }, ({ db, at, body }) => {
	const row = db.refreshTokens.find((t) => t.token === body.refreshToken);
	if (!row) throw unauthorized("Your session has expired.");
	if (row.used) {
		// A spent token came back: someone may have copied it. End the whole session.
		db.refreshTokens = db.refreshTokens.filter((t) => t.family !== row.family);
		throw unauthorized("Your session has expired.");
	}
	row.used = true;
	const user = db.users.find((u) => u.id === row.userId);
	if (!user) throw unauthorized("Your session has expired.");
	return issueTokens(db, user, at, row.family);
});

route("POST", "/auth/logout", { auth: false, status: 200, message: "Signed out" }, ({ db, body }) => {
	const row = db.refreshTokens.find((t) => t.token === body.refreshToken);
	if (row) db.refreshTokens = db.refreshTokens.filter((t) => t.family !== row.family);
	return null;
});

route("GET", "/auth/me", { message: "User retrieved" }, ({ user }) => ({
	id: user.id,
	email: user.email,
	role: user.role,
	createdAt: user.createdAt,
}));

// ---------------------------------------------------------------- account

route("GET", "/users/me", { message: "Account retrieved" }, ({ user }) => accountDto(user));

route("PUT", "/users/me/profile", { message: "Profile saved" }, ({ db, user, body }) => {
	const tag = String(body.tag ?? "").toLowerCase();
	validate([
		[String(body.firstName ?? "").trim().length > 0, "firstName must be longer than or equal to 1 characters"],
		[String(body.lastName ?? "").trim().length > 0, "lastName must be longer than or equal to 1 characters"],
		[/^[a-z0-9_]{3,20}$/.test(tag), "tag must match /^[a-z0-9_]{3,20}$/ regular expression"],
	]);
	if (db.users.some((u) => u.id !== user.id && u.profile?.tag === tag)) throw conflict("That tag is taken.");
	const row = db.users.find((u) => u.id === user.id)!;
	// Replaces every field: omitted optional fields are cleared.
	row.profile = {
		firstName: String(body.firstName).trim(),
		lastName: String(body.lastName).trim(),
		tag,
		gender: body.gender ?? null,
		dateOfBirth: body.dateOfBirth ?? null,
		address: body.address ?? null,
	};
	return row.profile;
});

route("PUT", "/users/me/avatar", { message: "Profile picture saved" }, ({ db, user, form }) => {
	const file = form.file as Upload | undefined;
	if (!file || typeof file === "string") throw badRequest("Choose a picture to upload.");
	if (!/^image\/(jpeg|png|webp)$/.test(file.type))
		throw new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Use a JPEG, PNG or WebP picture.");
	if (file.size > 5 * 1024 * 1024) throw new HttpError(413, "PAYLOAD_TOO_LARGE", "Pictures can be at most 5 MB.");
	db.users.find((u) => u.id === user.id)!.avatarUrl = file.dataUrl;
	return { avatarUrl: file.dataUrl };
});

route("DELETE", "/users/me/avatar", { message: "Profile picture removed" }, ({ db, user }) => {
	db.users.find((u) => u.id === user.id)!.avatarUrl = null;
	return null;
});

route("PUT", "/users/me/password", { message: "Password saved" }, ({ db, at, user, body }) => {
	validate([[String(body.newPassword ?? "").length >= 8, "newPassword must be longer than or equal to 8 characters"]]);
	const row = db.users.find((u) => u.id === user.id)!;
	if (row.password && row.password !== body.currentPassword) throw unauthorized("Your current password is incorrect.");
	if (!row.password && String(body.googleIdToken ?? "").length < 20)
		throw badRequest("Confirm with Google to set your first password.");
	row.password = body.newPassword;
	if (!row.signInMethods.includes("password")) row.signInMethods.push("password");
	// Every session is revoked; this one continues with a fresh pair.
	db.refreshTokens = db.refreshTokens.filter((t) => t.userId !== row.id);
	return issueTokens(db, row, at);
});

const securityDto = (user: MockUser) => ({
	hasPassword: !!user.password,
	loginLockout: user.security.loginLockout,
	lockoutMaxFailures: 5,
	lockoutMinutes: 15,
});

route("GET", "/users/me/security", { message: "Security settings retrieved" }, ({ user }) => securityDto(user));

route("PATCH", "/users/me/security", { message: "Security settings saved" }, ({ db, user, body }: Ctx) => {
	const row = db.users.find((u) => u.id === user.id)!;
	if (typeof body.loginLockout === "boolean") row.security.loginLockout = body.loginLockout;
	return securityDto(row);
});
