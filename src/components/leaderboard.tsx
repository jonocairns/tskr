import { CrownIcon, UsersIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type LeaderboardEntry = {
  userId: string;
  name: string;
  email?: string | null;
  points: number;
  tasks: number;
  claims: number;
  lastActivity?: string | null;
};

type Props = {
  entries: LeaderboardEntry[];
};

export function Leaderboard({ entries }: Props) {
  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Leaderboard</CardTitle>
          <CardDescription>Totals for every player.</CardDescription>
        </div>
        <div className="rounded-full bg-primary/10 p-2 text-primary">
          <UsersIcon className="h-5 w-5" />
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player</TableHead>
              <TableHead className="text-right">Points</TableHead>
              <TableHead className="text-right">Tasks</TableHead>
              <TableHead className="text-right">Rewards</TableHead>
              <TableHead className="text-right">Last active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry, idx) => (
              <TableRow key={entry.userId}>
                <TableCell className="flex items-center gap-2">
                  {idx === 0 ? (
                    <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                      <CrownIcon className="mr-1 h-3 w-3" />
                      Top
                    </Badge>
                  ) : null}
                  <div className="flex flex-col">
                    <span className="font-semibold">{entry.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {entry.email ?? "—"}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {entry.points.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">{entry.tasks}</TableCell>
                <TableCell className="text-right">{entry.claims}</TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {entry.lastActivity
                    ? new Date(entry.lastActivity).toLocaleDateString()
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
