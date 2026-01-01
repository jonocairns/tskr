"use client";

import { PushNotificationProvider } from "@/contexts/PushNotificationContext";
import { PushNotifications } from "../PushNotifications";
import { CombinedReminderSettings } from "./CombinedReminderSettings";

type Props = {
	householdId: string;
	userId: string;
	canManage: boolean;
};

export const NotificationsCard = ({ householdId, userId, canManage }: Props) => {
	return (
		<PushNotificationProvider>
			<div className="space-y-6">
				<PushNotifications variant="section" />

				<CombinedReminderSettings householdId={householdId} userId={userId} canManage={canManage} variant="section" />
			</div>
		</PushNotificationProvider>
	);
};
