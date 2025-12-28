jest.mock("@/lib/prisma", () => ({ prisma: {} }));

import { getCurrentStreak, toDayKey } from "@/lib/dashboard/queries";

const at = (year: number, month: number, day: number, hour = 0, minute = 0, second = 0, ms = 0) =>
	new Date(year, month - 1, day, hour, minute, second, ms);

const withNow = (date: Date, run: () => void) => {
	jest.useFakeTimers();
	jest.setSystemTime(date);
	try {
		run();
	} finally {
		jest.useRealTimers();
	}
};

test("formats day keys with zero-padded month/day", () => {
	expect(toDayKey(at(2024, 2, 3, 10, 0))).toBe("2024-02-03");
});

test("returns 0 when no logs exist", () => {
	withNow(at(2024, 1, 10, 12, 0), () => {
		expect(getCurrentStreak([])).toBe(0);
	});
});

test("treats multiple logs on the same day as a single streak day", () => {
	withNow(at(2024, 1, 10, 12, 0), () => {
		const logs = [{ createdAt: at(2024, 1, 10, 0, 5) }, { createdAt: at(2024, 1, 10, 23, 59) }];

		expect(getCurrentStreak(logs)).toBe(1);
	});
});

test("counts only today when the streak is a single day", () => {
	withNow(at(2024, 1, 10, 12, 0), () => {
		const logs = [{ createdAt: at(2024, 1, 10, 8, 0) }];

		expect(getCurrentStreak(logs)).toBe(1);
	});
});

test("stops streak at the first missing day", () => {
	withNow(at(2024, 1, 10, 12, 0), () => {
		const logs = [
			{ createdAt: at(2024, 1, 10, 8, 0) },
			{ createdAt: at(2024, 1, 9, 8, 0) },
			{ createdAt: at(2024, 1, 7, 8, 0) },
		];

		expect(getCurrentStreak(logs)).toBe(2);
	});
});

test("does not count yesterday's late-night logs as today", () => {
	withNow(at(2024, 1, 10, 0, 30), () => {
		const logs = [{ createdAt: at(2024, 1, 9, 23, 59, 59) }];

		expect(getCurrentStreak(logs)).toBe(0);
	});
});

test("uses local midnight as the streak boundary", () => {
	withNow(at(2024, 1, 10, 0, 15), () => {
		const logs = [{ createdAt: at(2024, 1, 9, 23, 30) }];

		expect(getCurrentStreak(logs)).toBe(0);
	});
});
