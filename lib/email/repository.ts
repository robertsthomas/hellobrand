/**
 * This file is the stable entry point for email repository calls.
 * It re-exports the smaller repository modules so the rest of the app can keep using one import path while the internals stay organized.
 */
export * from "./repository/accounts";
export * from "./repository/threads";
export * from "./repository/candidates";
