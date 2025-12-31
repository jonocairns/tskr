import "server-only";

import { router } from "@/server/trpc";
import { householdCoreRouter } from "./core";
import { householdInvitesRouter } from "./invites";
import { householdJoiningRouter } from "./joining";
import { householdMembersRouter } from "./members";
import { householdSwitchingRouter } from "./switching";

export const householdsRouter = router({
	getCurrent: householdCoreRouter.getCurrent,
	updateCurrent: householdCoreRouter.updateCurrent,
	deleteCurrent: householdCoreRouter.deleteCurrent,
	list: householdSwitchingRouter.list,
	create: householdSwitchingRouter.create,
	select: householdSwitchingRouter.select,
	join: householdJoiningRouter.join,
	getMembers: householdMembersRouter.getMembers,
	updateMember: householdMembersRouter.updateMember,
	getInvites: householdInvitesRouter.getInvites,
	createInvite: householdInvitesRouter.createInvite,
	manageInvite: householdInvitesRouter.manageInvite,
});
