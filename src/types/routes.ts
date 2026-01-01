/**
 * Route parameter types for Next.js dynamic routes
 *
 * These types define the structure of dynamic route parameters
 * used throughout the application for type-safe routing.
 */

/**
 * Base household route parameters used in all household-scoped pages.
 * Pattern: /[householdId]/*
 */
export type HouseholdRouteParams = {
	householdId: string;
};

/**
 * Assignments page route parameters.
 * Pattern: /[householdId]/assignments
 */
export type AssignmentsRouteParams = HouseholdRouteParams;

/**
 * Household settings page route parameters.
 * Pattern: /[householdId]/household
 */
export type HouseholdSettingsRouteParams = HouseholdRouteParams;
