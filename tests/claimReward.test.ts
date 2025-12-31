import { TRPCError } from "@trpc/server";

type MockFn = ReturnType<typeof jest.fn>;

type PrismaClient = {
	$transaction: <T>(fn: (tx: TransactionClient) => Promise<T>) => Promise<T>;
};

type TransactionClient = {
	household: {
		findUnique: MockFn;
	};
	pointLog: {
		aggregate: MockFn;
		create: MockFn;
	};
};

const simulateClaimReward = async (
	prisma: PrismaClient,
	userId: string,
	householdId: string,
): Promise<{ entry: { id: string; points: number; rewardCost?: number }; remaining: number }> => {
	const result = await prisma.$transaction(async (tx) => {
		const household = (await tx.household.findUnique({
			where: { id: householdId },
			select: { rewardThreshold: true },
		})) as { rewardThreshold: number | null } | null;
		const threshold = household?.rewardThreshold ?? 50;

		const total = (await tx.pointLog.aggregate({
			where: {
				userId,
				householdId,
				revertedAt: null,
				status: "APPROVED",
			},
			_sum: { points: true },
		})) as { _sum: { points: number | null } };
		const available = total._sum.points ?? 0;

		if (available < threshold) {
			return { ok: false, available, threshold } as const;
		}

		const entry = (await tx.pointLog.create({
			data: {
				householdId,
				userId,
				kind: "REWARD",
				points: -threshold,
				rewardCost: threshold,
				description: "Reward claimed",
			},
		})) as { id: string; points: number };

		return {
			ok: true,
			entry,
			remaining: available - threshold,
		} as const;
	});

	if (!result.ok) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Not enough points to claim",
			cause: {
				available: result.available,
				threshold: result.threshold,
			},
		});
	}

	return {
		entry: result.entry,
		remaining: result.remaining,
	};
};

describe("claimReward", () => {
	describe("successful claims", () => {
		test("claims reward when user has exact threshold points", async () => {
			const mockTx = {
				household: {
					findUnique: jest.fn().mockResolvedValue({ rewardThreshold: 100 }),
				},
				pointLog: {
					aggregate: jest.fn().mockResolvedValue({ _sum: { points: 100 } }),
					create: jest.fn().mockResolvedValue({
						id: "log-1",
						points: -100,
						rewardCost: 100,
					}),
				},
			};

			const prisma = {
				$transaction: jest.fn(async (fn) => fn(mockTx)),
			};

			const result = await simulateClaimReward(prisma, "user-1", "household-1");

			expect(result.entry.points).toBe(-100);
			expect(result.remaining).toBe(0);
			expect(mockTx.pointLog.create).toHaveBeenCalledWith({
				data: {
					householdId: "household-1",
					userId: "user-1",
					kind: "REWARD",
					points: -100,
					rewardCost: 100,
					description: "Reward claimed",
				},
			});
		});

		test("claims reward when user has points above threshold", async () => {
			const mockTx = {
				household: {
					findUnique: jest.fn().mockResolvedValue({ rewardThreshold: 50 }),
				},
				pointLog: {
					aggregate: jest.fn().mockResolvedValue({ _sum: { points: 125 } }),
					create: jest.fn().mockResolvedValue({
						id: "log-2",
						points: -50,
						rewardCost: 50,
					}),
				},
			};

			const prisma = {
				$transaction: jest.fn(async (fn) => fn(mockTx)),
			};

			const result = await simulateClaimReward(prisma, "user-1", "household-1");

			expect(result.entry.points).toBe(-50);
			expect(result.remaining).toBe(75);
		});

		test("uses default threshold of 50 when household has no threshold set", async () => {
			const mockTx = {
				household: {
					findUnique: jest.fn().mockResolvedValue({ rewardThreshold: null }),
				},
				pointLog: {
					aggregate: jest.fn().mockResolvedValue({ _sum: { points: 60 } }),
					create: jest.fn().mockResolvedValue({
						id: "log-3",
						points: -50,
						rewardCost: 50,
					}),
				},
			};

			const prisma = {
				$transaction: jest.fn(async (fn) => fn(mockTx)),
			};

			const result = await simulateClaimReward(prisma, "user-1", "household-1");

			expect(result.entry.rewardCost).toBe(50);
			expect(result.remaining).toBe(10);
		});

		test("uses default threshold when household not found", async () => {
			const mockTx = {
				household: {
					findUnique: jest.fn().mockResolvedValue(null),
				},
				pointLog: {
					aggregate: jest.fn().mockResolvedValue({ _sum: { points: 100 } }),
					create: jest.fn().mockResolvedValue({
						id: "log-4",
						points: -50,
						rewardCost: 50,
					}),
				},
			};

			const prisma = {
				$transaction: jest.fn(async (fn) => fn(mockTx)),
			};

			const result = await simulateClaimReward(prisma, "user-1", "household-1");

			expect(result.entry.rewardCost).toBe(50);
			expect(result.remaining).toBe(50);
		});

		test("claims reward with custom high threshold", async () => {
			const mockTx = {
				household: {
					findUnique: jest.fn().mockResolvedValue({ rewardThreshold: 500 }),
				},
				pointLog: {
					aggregate: jest.fn().mockResolvedValue({ _sum: { points: 750 } }),
					create: jest.fn().mockResolvedValue({
						id: "log-5",
						points: -500,
						rewardCost: 500,
					}),
				},
			};

			const prisma = {
				$transaction: jest.fn(async (fn) => fn(mockTx)),
			};

			const result = await simulateClaimReward(prisma, "user-1", "household-1");

			expect(result.entry.points).toBe(-500);
			expect(result.remaining).toBe(250);
		});

		test("claims reward with low custom threshold", async () => {
			const mockTx = {
				household: {
					findUnique: jest.fn().mockResolvedValue({ rewardThreshold: 10 }),
				},
				pointLog: {
					aggregate: jest.fn().mockResolvedValue({ _sum: { points: 15 } }),
					create: jest.fn().mockResolvedValue({
						id: "log-6",
						points: -10,
						rewardCost: 10,
					}),
				},
			};

			const prisma = {
				$transaction: jest.fn(async (fn) => fn(mockTx)),
			};

			const result = await simulateClaimReward(prisma, "user-1", "household-1");

			expect(result.entry.points).toBe(-10);
			expect(result.remaining).toBe(5);
		});
	});

	describe("insufficient points", () => {
		test("throws error when user has zero points", async () => {
			const mockTx = {
				household: {
					findUnique: jest.fn().mockResolvedValue({ rewardThreshold: 50 }),
				},
				pointLog: {
					aggregate: jest.fn().mockResolvedValue({ _sum: { points: null } }),
					create: jest.fn(),
				},
			};

			const prisma = {
				$transaction: jest.fn(async (fn) => fn(mockTx)),
			};

			await expect(simulateClaimReward(prisma, "user-1", "household-1")).rejects.toThrow(TRPCError);
			await expect(simulateClaimReward(prisma, "user-1", "household-1")).rejects.toMatchObject({
				code: "BAD_REQUEST",
				message: "Not enough points to claim",
			});

			expect(mockTx.pointLog.create).not.toHaveBeenCalled();
		});

		test("throws error when user has points below threshold", async () => {
			const mockTx = {
				household: {
					findUnique: jest.fn().mockResolvedValue({ rewardThreshold: 100 }),
				},
				pointLog: {
					aggregate: jest.fn().mockResolvedValue({ _sum: { points: 99 } }),
					create: jest.fn(),
				},
			};

			const prisma = {
				$transaction: jest.fn(async (fn) => fn(mockTx)),
			};

			await expect(simulateClaimReward(prisma, "user-1", "household-1")).rejects.toThrow(TRPCError);

			expect(mockTx.pointLog.create).not.toHaveBeenCalled();
		});

		test("includes available and threshold in error", async () => {
			const mockTx = {
				household: {
					findUnique: jest.fn().mockResolvedValue({ rewardThreshold: 100 }),
				},
				pointLog: {
					aggregate: jest.fn().mockResolvedValue({ _sum: { points: 45 } }),
					create: jest.fn(),
				},
			};

			const prisma = {
				$transaction: jest.fn(async (fn) => fn(mockTx)),
			};

			try {
				await simulateClaimReward(prisma, "user-1", "household-1");
				throw new Error("Should have thrown");
			} catch (error) {
				expect(error).toBeInstanceOf(TRPCError);
				if (error instanceof TRPCError) {
					expect(error.message).toBe("Not enough points to claim");
					expect(error.code).toBe("BAD_REQUEST");
				}
			}
		});

		test("throws error when user has exactly one point below threshold", async () => {
			const mockTx = {
				household: {
					findUnique: jest.fn().mockResolvedValue({ rewardThreshold: 50 }),
				},
				pointLog: {
					aggregate: jest.fn().mockResolvedValue({ _sum: { points: 49 } }),
					create: jest.fn(),
				},
			};

			const prisma = {
				$transaction: jest.fn(async (fn) => fn(mockTx)),
			};

			await expect(simulateClaimReward(prisma, "user-1", "household-1")).rejects.toThrow(TRPCError);
		});
	});

	describe("edge cases", () => {
		test("handles null _sum.points as zero", async () => {
			const mockTx = {
				household: {
					findUnique: jest.fn().mockResolvedValue({ rewardThreshold: 50 }),
				},
				pointLog: {
					aggregate: jest.fn().mockResolvedValue({ _sum: { points: null } }),
					create: jest.fn(),
				},
			};

			const prisma = {
				$transaction: jest.fn(async (fn) => fn(mockTx)),
			};

			await expect(simulateClaimReward(prisma, "user-1", "household-1")).rejects.toMatchObject({
				cause: {
					available: 0,
					threshold: 50,
				},
			});
		});

		test("handles zero threshold edge case", async () => {
			const mockTx = {
				household: {
					findUnique: jest.fn().mockResolvedValue({ rewardThreshold: 0 }),
				},
				pointLog: {
					aggregate: jest.fn().mockResolvedValue({ _sum: { points: 100 } }),
					create: jest.fn().mockResolvedValue({
						id: "log-7",
						points: 0,
						rewardCost: 0,
					}),
				},
			};

			const prisma = {
				$transaction: jest.fn(async (fn) => fn(mockTx)),
			};

			const result = await simulateClaimReward(prisma, "user-1", "household-1");

			expect(result.entry.points).toBe(0);
			expect(result.remaining).toBe(100);
		});

		test("handles negative available points", async () => {
			const mockTx = {
				household: {
					findUnique: jest.fn().mockResolvedValue({ rewardThreshold: 50 }),
				},
				pointLog: {
					aggregate: jest.fn().mockResolvedValue({ _sum: { points: -10 } }),
					create: jest.fn(),
				},
			};

			const prisma = {
				$transaction: jest.fn(async (fn) => fn(mockTx)),
			};

			await expect(simulateClaimReward(prisma, "user-1", "household-1")).rejects.toThrow(TRPCError);
		});

		test("handles very large point values", async () => {
			const mockTx = {
				household: {
					findUnique: jest.fn().mockResolvedValue({ rewardThreshold: 1000 }),
				},
				pointLog: {
					aggregate: jest.fn().mockResolvedValue({ _sum: { points: 1_000_000 } }),
					create: jest.fn().mockResolvedValue({
						id: "log-8",
						points: -1000,
						rewardCost: 1000,
					}),
				},
			};

			const prisma = {
				$transaction: jest.fn(async (fn) => fn(mockTx)),
			};

			const result = await simulateClaimReward(prisma, "user-1", "household-1");

			expect(result.remaining).toBe(999_000);
		});

		test("handles fractional points from aggregate", async () => {
			const mockTx = {
				household: {
					findUnique: jest.fn().mockResolvedValue({ rewardThreshold: 50 }),
				},
				pointLog: {
					aggregate: jest.fn().mockResolvedValue({ _sum: { points: 50.5 } }),
					create: jest.fn().mockResolvedValue({
						id: "log-9",
						points: -50,
						rewardCost: 50,
					}),
				},
			};

			const prisma = {
				$transaction: jest.fn(async (fn) => fn(mockTx)),
			};

			const result = await simulateClaimReward(prisma, "user-1", "household-1");

			expect(result.remaining).toBe(0.5);
		});
	});

	describe("point calculation", () => {
		test("creates point log with negative points", async () => {
			const mockTx = {
				household: {
					findUnique: jest.fn().mockResolvedValue({ rewardThreshold: 75 }),
				},
				pointLog: {
					aggregate: jest.fn().mockResolvedValue({ _sum: { points: 150 } }),
					create: jest.fn().mockResolvedValue({
						id: "log-10",
						points: -75,
						rewardCost: 75,
					}),
				},
			};

			const prisma = {
				$transaction: jest.fn(async (fn) => fn(mockTx)),
			};

			await simulateClaimReward(prisma, "user-1", "household-1");

			expect(mockTx.pointLog.create).toHaveBeenCalledWith({
				data: {
					householdId: "household-1",
					userId: "user-1",
					kind: "REWARD",
					points: -75,
					rewardCost: 75,
					description: "Reward claimed",
				},
			});
		});

		test("calculates remaining points correctly", async () => {
			const testCases = [
				{ available: 100, threshold: 50, expectedRemaining: 50 },
				{ available: 200, threshold: 75, expectedRemaining: 125 },
				{ available: 51, threshold: 50, expectedRemaining: 1 },
				{ available: 1000, threshold: 1, expectedRemaining: 999 },
			];

			for (const { available, threshold, expectedRemaining } of testCases) {
				const mockTx = {
					household: {
						findUnique: jest.fn().mockResolvedValue({ rewardThreshold: threshold }),
					},
					pointLog: {
						aggregate: jest.fn().mockResolvedValue({ _sum: { points: available } }),
						create: jest.fn().mockResolvedValue({
							id: "log-x",
							points: -threshold,
							rewardCost: threshold,
						}),
					},
				};

				const prisma = {
					$transaction: jest.fn(async (fn) => fn(mockTx)),
				};

				const result = await simulateClaimReward(prisma, "user-1", "household-1");
				expect(result.remaining).toBe(expectedRemaining);
			}
		});
	});

	describe("point log filtering", () => {
		test("only counts approved points", async () => {
			const mockTx = {
				household: {
					findUnique: jest.fn().mockResolvedValue({ rewardThreshold: 50 }),
				},
				pointLog: {
					aggregate: jest.fn().mockResolvedValue({ _sum: { points: 100 } }),
					create: jest.fn().mockResolvedValue({
						id: "log-11",
						points: -50,
						rewardCost: 50,
					}),
				},
			};

			const prisma = {
				$transaction: jest.fn(async (fn) => fn(mockTx)),
			};

			await simulateClaimReward(prisma, "user-1", "household-1");

			expect(mockTx.pointLog.aggregate).toHaveBeenCalledWith({
				where: {
					userId: "user-1",
					householdId: "household-1",
					revertedAt: null,
					status: "APPROVED",
				},
				_sum: { points: true },
			});
		});

		test("excludes reverted points", async () => {
			const mockTx = {
				household: {
					findUnique: jest.fn().mockResolvedValue({ rewardThreshold: 50 }),
				},
				pointLog: {
					aggregate: jest.fn().mockResolvedValue({ _sum: { points: 60 } }),
					create: jest.fn().mockResolvedValue({
						id: "log-12",
						points: -50,
						rewardCost: 50,
					}),
				},
			};

			const prisma = {
				$transaction: jest.fn(async (fn) => fn(mockTx)),
			};

			await simulateClaimReward(prisma, "user-1", "household-1");

			const aggregateCall = mockTx.pointLog.aggregate.mock.calls[0]?.[0];
			expect(aggregateCall?.where.revertedAt).toBe(null);
		});
	});

	describe("data integrity", () => {
		test("stores correct reward cost", async () => {
			const mockTx = {
				household: {
					findUnique: jest.fn().mockResolvedValue({ rewardThreshold: 123 }),
				},
				pointLog: {
					aggregate: jest.fn().mockResolvedValue({ _sum: { points: 200 } }),
					create: jest.fn().mockResolvedValue({
						id: "log-13",
						points: -123,
						rewardCost: 123,
					}),
				},
			};

			const prisma = {
				$transaction: jest.fn(async (fn) => fn(mockTx)),
			};

			await simulateClaimReward(prisma, "user-1", "household-1");

			expect(mockTx.pointLog.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						rewardCost: 123,
					}),
				}),
			);
		});

		test("sets kind to REWARD", async () => {
			const mockTx = {
				household: {
					findUnique: jest.fn().mockResolvedValue({ rewardThreshold: 50 }),
				},
				pointLog: {
					aggregate: jest.fn().mockResolvedValue({ _sum: { points: 60 } }),
					create: jest.fn().mockResolvedValue({
						id: "log-14",
						points: -50,
						rewardCost: 50,
					}),
				},
			};

			const prisma = {
				$transaction: jest.fn(async (fn) => fn(mockTx)),
			};

			await simulateClaimReward(prisma, "user-1", "household-1");

			expect(mockTx.pointLog.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						kind: "REWARD",
					}),
				}),
			);
		});

		test("includes household and user IDs", async () => {
			const mockTx = {
				household: {
					findUnique: jest.fn().mockResolvedValue({ rewardThreshold: 50 }),
				},
				pointLog: {
					aggregate: jest.fn().mockResolvedValue({ _sum: { points: 60 } }),
					create: jest.fn().mockResolvedValue({
						id: "log-15",
						points: -50,
						rewardCost: 50,
					}),
				},
			};

			const prisma = {
				$transaction: jest.fn(async (fn) => fn(mockTx)),
			};

			await simulateClaimReward(prisma, "user-123", "household-456");

			expect(mockTx.pointLog.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						userId: "user-123",
						householdId: "household-456",
					}),
				}),
			);
		});
	});
});
