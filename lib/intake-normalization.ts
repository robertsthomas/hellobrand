/**
 * Thin barrel re-exporting intake normalization.
 * The full implementation now lives in lib/intake/normalization/index.ts.
 */
export {
  INTAKE_NORMALIZED_VERSION,
  buildNormalizedIntakeRecord,
  createPersistedIntakeRecord,
} from "./intake/normalization";
