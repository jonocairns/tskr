import type { NextAuthOptions } from "next-auth";

import { getProfileEmail, getProfileImage, getProfileName } from "@/lib/authProfile";
import { prisma } from "../prisma";

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const linkAccount: NonNullable<NextAuthOptions["events"]>["linkAccount"] = async ({
	user,
	account,
	profile,
}) => {
	if (account?.provider !== "google") {
		return;
	}

	const profileEmail = getProfileEmail(profile);
	const profileName = getProfileName(profile);
	const profileImage = getProfileImage(profile);
	if (!profileEmail && !profileName && !profileImage) {
		return;
	}

	const updates: { email?: string; name?: string | null; image?: string } = {};

	if (profileEmail) {
		const normalizedEmail = normalizeEmail(profileEmail);
		if (normalizedEmail && user.email?.toLowerCase() !== normalizedEmail) {
			const existing = await prisma.user.findUnique({
				where: { email: normalizedEmail },
				select: { id: true },
			});

			if (existing && existing.id !== user.id) {
				console.warn("Skipping Google email sync because the email is already in use.");
			} else {
				updates.email = normalizedEmail;
			}
		}
	}

	if (profileName && profileName !== user.name) {
		updates.name = profileName;
	}

	if (profileImage && profileImage !== user.image) {
		updates.image = profileImage;
	}

	if (Object.keys(updates).length === 0) {
		return;
	}

	await prisma.user.update({
		where: { id: user.id },
		data: updates,
	});
};
