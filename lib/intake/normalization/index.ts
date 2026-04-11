/**
 * Compatibility barrel for intake normalization.
 * The normalization builder lives in its own file so this entry point stays small and predictable.
 */
export {
  INTAKE_NORMALIZED_VERSION,
  buildNormalizedIntakeRecord,
  createPersistedIntakeRecord
} from "./builder";
