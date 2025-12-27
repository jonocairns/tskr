"use client";

import { useState } from "react";

import { CreateUserDialog } from "@/components/admin/CreateUserCard";
import {
	type RowState,
	type UserRow,
	UsersTable,
} from "@/components/admin/UsersTable";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/Card";

type Props = {
	users: UserRow[];
	currentUserId?: string;
};

const toRowState = (user: UserRow): RowState => ({
	...user,
	isSaving: false,
	isDeleting: false,
	isResetting: false,
	isClearingReset: false,
	resetUrl: "",
	resetExpiresAt: "",
});

export const UsersCard = ({ users, currentUserId }: Props) => {
	const [rows, setRows] = useState<RowState[]>(() =>
		users.map((user) => toRowState(user)),
	);

	const handleUserCreated = (user: UserRow) => {
		setRows((current) => {
			if (current.some((row) => row.id === user.id)) {
				return current;
			}
			return [...current, toRowState(user)];
		});
	};

	return (
		<Card>
			<CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
				<div className="space-y-1.5">
					<CardTitle>Users</CardTitle>
					<CardDescription>
						Manage users and generate password reset links.
					</CardDescription>
				</div>
				<CreateUserDialog onCreated={handleUserCreated} />
			</CardHeader>
			<CardContent>
				<UsersTable
					rows={rows}
					setRows={setRows}
					currentUserId={currentUserId}
				/>
			</CardContent>
		</Card>
	);
};
