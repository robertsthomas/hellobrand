export const FEEDBACK_DELAY_MS = 24 * 60 * 60 * 1000;
export const FEEDBACK_LOCAL_HOUR = 10;

export function getNextFeedbackEligibilityTime(loginAtMs: number) {
  const firstEligibleMoment = loginAtMs + FEEDBACK_DELAY_MS;
  const eligibleDate = new Date(firstEligibleMoment);
  const tenAmLocal = new Date(
    eligibleDate.getFullYear(),
    eligibleDate.getMonth(),
    eligibleDate.getDate(),
    FEEDBACK_LOCAL_HOUR,
    0,
    0,
    0
  ).getTime();

  if (firstEligibleMoment <= tenAmLocal) {
    return tenAmLocal;
  }

  return new Date(
    eligibleDate.getFullYear(),
    eligibleDate.getMonth(),
    eligibleDate.getDate() + 1,
    FEEDBACK_LOCAL_HOUR,
    0,
    0,
    0
  ).getTime();
}
