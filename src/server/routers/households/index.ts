import "server-only";

import { router } from "@/server/trpc";
import { householdCoreRouter } from "./core";
import { householdInvitesRouter } from "./invites";
import { householdJoiningRouter } from "./joining";
import { householdMembersRouter } from "./members";
import { householdSwitchingRouter } from "./switching";

/**
 * Main households router combining all household-related functionality.
 *
 * Organized into logical sub-routers:
 * - Core: Get, update, and delete current household
 * - Switching: List, create, and select households
 * - Joining: Join households via invite codes (with rate limiting)
 * - Members: Manage household members
 * - Invites: Create and manage household invites
 */
export const householdsRouter = router({
	// Core household operations
	getCurrent: householdCoreRouter.getCurrent,
	updateCurrent: householdCoreRouter.updateCurrent,
	deleteCurrent: householdCoreRouter.deleteCurrent,

	// Household switching
	list: householdSwitchingRouter.list,
	create: householdSwitchingRouter.create,
	select: householdSwitchingRouter.select,

	// Joining households
	join: householdJoiningRouter.join,

	// Member management
	getMembers: householdMembersRouter.getMembers,
	updateMember: householdMembersRouter.updateMember,

	// Invite management
	getInvites: householdInvitesRouter.getInvites,
	createInvite: householdInvitesRouter.createInvite,
	manageInvite: householdInvitesRouter.manageInvite,
});
