import { disconnectPrisma, getPrisma, hashPassword } from "./support/db";
import { PASSWORD, USERS } from "./support/env";

// Runs after the web server has started; the server command has already
// recreated and migrated the throwaway database, so only accounts are seeded here.
const globalSetup = async () => {
	const prisma = getPrisma();
	const passwordHash = await hashPassword(PASSWORD);
	try {
		for (const { email, name } of Object.values(USERS)) {
			await prisma.user.upsert({
				where: { email },
				create: { email, name, passwordHash, passwordResetRequired: false },
				update: { name, passwordHash, passwordResetRequired: false },
			});
		}
	} finally {
		await disconnectPrisma();
	}
};

export default globalSetup;
