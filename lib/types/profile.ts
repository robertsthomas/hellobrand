/**
 * Profile, onboarding, guide state, and notification delivery record types.
 * Keep user-facing form logic and persistence adapters out of this module.
 */

export interface ProfileRecord {
  id: string;
  userId: string;
  displayName: string | null;
  creatorLegalName: string | null;
  businessName: string | null;
  contactEmail: string | null;
  timeZone: string | null;
  preferredSignature: string | null;
  payoutDetails: string | null;
  defaultCurrency: string | null;
  reminderLeadDays: number | null;
  conflictAlertsEnabled: boolean;
  paymentRemindersEnabled: boolean;
  emailNotificationsEnabled: boolean;
  accentColor: string | null;
  createdAt: string;
  updatedAt: string;
}

interface NotificationEmailDeliveryRecord {
  id: string;
  appNotificationId: string;
  userId: string;
  recipientEmail: string;
  provider: string;
  providerMessageId: string | null;
  status: "pending" | "sent" | "failed" | "skipped";
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductGuideState {
  dismissedStepIds: string[];
  completedStepIds: string[];
  hasEverCreatedWorkspace: boolean;
}

export interface OnboardingStateRecord {
  id: string;
  userId: string;
  profileOnboardingCompletedAt: string | null;
  profileOnboardingVersion: number;
  profileOnboardingStateJson: unknown;
  productGuideVersion: number;
  productGuideStateJson: ProductGuideState;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileAuditRecord {
  id: string;
  profileId: string;
  actorUserId: string;
  changedFields: string[];
  snapshot: Record<string, { before: unknown; after: unknown }>;
  createdAt: string;
}
