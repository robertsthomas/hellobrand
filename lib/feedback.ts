import { createElement, type ReactElement } from "react";

import { renderEmailText } from "@/emails/shared/render";
import FeedbackFollowUpEmailTemplate from "@/emails/transactional/feedback-follow-up-email";
import FeedbackSupportEmailTemplate from "@/emails/transactional/feedback-support-email";
import { getProfileForViewer } from "@/lib/profile";
import { getAppBaseUrl } from "@/lib/email/config";
import {
  canSendNotificationEmailInCurrentMode,
  getNotificationEmailConfig,
} from "@/lib/notification-email";
import { captureHandledError } from "@/lib/monitoring/sentry";
import { capturePostHogServerEvent } from "@/lib/posthog/server";
import { prisma } from "@/lib/prisma";
import { createResendClient } from "@/lib/resend-client";
import type { Viewer } from "@/lib/types";

const SUPPORT_EMAIL = "support@hellobrand.com";
const LOW_SCORE_SUPPORT_THRESHOLD = 3;

type FeedbackSubmissionInput = {
  score: number;
  message: string | null;
  pagePath: string;
  pageTitle: string;
  dealId?: string | null;
  requestedFollowUp?: boolean;
};

function normalizeNullableString(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveFeedbackPageGroup(pagePath: string) {
  if (pagePath === "/app" || pagePath === "/app/dashboard") {
    return "dashboard";
  }

  if (pagePath.startsWith("/app/p/")) {
    return "workspace";
  }

  if (pagePath.startsWith("/app/inbox")) {
    return "inbox";
  }

  if (pagePath.startsWith("/app/payments")) {
    return "payments";
  }

  if (pagePath.startsWith("/app/settings")) {
    return "settings";
  }

  if (pagePath.startsWith("/app/help")) {
    return "help";
  }

  if (pagePath.startsWith("/app/search")) {
    return "search";
  }

  if (pagePath.startsWith("/app/intake")) {
    return "intake";
  }

  return "other";
}

type SendEmailResult = {
  messageId: string | null;
  sentAt: Date | null;
};

async function sendFeedbackEmail(input: {
  to: string;
  subject: string;
  react: ReactElement;
  text: string;
  replyTo?: string;
}) {
  const config = getNotificationEmailConfig();
  if (!config.apiKey) {
    return { messageId: null, sentAt: null } satisfies SendEmailResult;
  }

  if (
    !canSendNotificationEmailInCurrentMode({
      fromEmail: config.fromEmail,
      testToEmail: config.testToEmail,
      recipientEmail: input.to,
    })
  ) {
    return { messageId: null, sentAt: null } satisfies SendEmailResult;
  }

  const resend = await createResendClient(config.apiKey);
  const response = await resend.emails.send({
    from: config.fromEmail,
    to: [input.to],
    subject: input.subject,
    react: input.react,
    text: input.text,
    ...(input.replyTo ? { replyTo: input.replyTo } : {}),
  });

  if (response.error) {
    throw new Error(response.error.message);
  }

  return {
    messageId: response.data?.id ?? null,
    sentAt: new Date(),
  } satisfies SendEmailResult;
}

async function buildSupportEmail(input: {
  feedbackId: string;
  viewer: Viewer;
  contactEmail: string;
  score: number;
  message: string | null;
  pagePath: string;
  pageTitle: string;
  dealId: string | null;
  requestedFollowUp: boolean;
}) {
  const messageText = input.message ?? "No additional context provided.";
  const pageUrl = new URL(input.pagePath, `${getAppBaseUrl()}/`).toString();
  const react = createElement(FeedbackSupportEmailTemplate, {
    userName: input.viewer.displayName,
    contactEmail: input.contactEmail,
    score: input.score,
    pagePath: input.pagePath,
    pageTitle: input.pageTitle,
    dealId: input.dealId,
    requestedFollowUp: input.requestedFollowUp,
    message: messageText,
    feedbackId: input.feedbackId,
    pageUrl,
  });
  const text = await renderEmailText(react);

  return {
    subject: `Product feedback from ${input.viewer.displayName} (${input.score}/5)`,
    react,
    text,
  };
}

async function buildFollowUpEmail(input: { viewer: Viewer; score: number; pageTitle: string }) {
  const tone =
    input.score <= LOW_SCORE_SUPPORT_THRESHOLD
      ? "Thanks for flagging that something felt off."
      : "Thanks for taking the time to tell us what is working and what is not.";
  const react = createElement(FeedbackFollowUpEmailTemplate, {
    displayName: input.viewer.displayName,
    tone,
    supportEmail: SUPPORT_EMAIL,
  });
  const text = await renderEmailText(react);

  return {
    subject: "Thanks for your HelloBrand feedback",
    react,
    text,
  };
}

export async function createFeedbackSubmission(viewer: Viewer, input: FeedbackSubmissionInput) {
  const profile = await getProfileForViewer(viewer);
  const contactEmail = normalizeNullableString(profile.contactEmail) ?? viewer.email;
  const message = normalizeNullableString(input.message);
  const requestedFollowUp = Boolean(input.requestedFollowUp);
  const dealId = normalizeNullableString(input.dealId);

  const submission = await prisma.feedbackSubmission.create({
    data: {
      userId: viewer.id,
      score: input.score,
      message,
      pagePath: input.pagePath,
      pageTitle: input.pageTitle,
      dealId,
      requestedFollowUp,
      contactEmail,
    },
  });

  const shouldNotifySupport = requestedFollowUp || input.score <= LOW_SCORE_SUPPORT_THRESHOLD;

  if (shouldNotifySupport) {
    const supportEmail = await buildSupportEmail({
      feedbackId: submission.id,
      viewer,
      contactEmail,
      score: input.score,
      message,
      pagePath: input.pagePath,
      pageTitle: input.pageTitle,
      dealId,
      requestedFollowUp,
    });

    try {
      const result = await sendFeedbackEmail({
        to: SUPPORT_EMAIL,
        subject: supportEmail.subject,
        react: supportEmail.react,
        text: supportEmail.text,
        replyTo: contactEmail,
      });

      if (result.sentAt) {
        await prisma.feedbackSubmission.update({
          where: { id: submission.id },
          data: {
            supportEmailMessageId: result.messageId,
            supportEmailSentAt: result.sentAt,
          },
        });
      }
    } catch (error) {
      captureHandledError(error, {
        area: "feedback",
        name: "send_support_email",
        viewerId: viewer.id,
        captureExpected: true,
        extras: {
          feedbackId: submission.id,
          score: input.score,
          requestedFollowUp,
        },
      });
    }
  }

  if (requestedFollowUp) {
    const followUpEmail = await buildFollowUpEmail({
      viewer,
      score: input.score,
      pageTitle: input.pageTitle,
    });

    try {
      const result = await sendFeedbackEmail({
        to: contactEmail,
        subject: followUpEmail.subject,
        react: followUpEmail.react,
        text: followUpEmail.text,
        replyTo: SUPPORT_EMAIL,
      });

      if (result.sentAt) {
        await prisma.feedbackSubmission.update({
          where: { id: submission.id },
          data: {
            userFollowUpEmailMessageId: result.messageId,
            userFollowUpEmailSentAt: result.sentAt,
          },
        });
      }
    } catch (error) {
      captureHandledError(error, {
        area: "feedback",
        name: "send_follow_up_email",
        viewerId: viewer.id,
        captureExpected: true,
        extras: {
          feedbackId: submission.id,
          score: input.score,
        },
      });
    }
  }

  void capturePostHogServerEvent({
    distinctId: viewer.id,
    event: "feedback_submitted",
    properties: {
      feedbackId: submission.id,
      score: input.score,
      pagePath: input.pagePath,
      pageTitle: input.pageTitle,
      pageGroup: resolveFeedbackPageGroup(input.pagePath),
      hasDeal: Boolean(dealId),
      requestedFollowUp,
      messageProvided: Boolean(message),
    },
  }).catch((error) => {
    captureHandledError(error, {
      area: "feedback",
      name: "capture_feedback_submitted",
      viewerId: viewer.id,
      captureExpected: true,
      extras: {
        feedbackId: submission.id,
      },
    });
  });

  return {
    id: submission.id,
  };
}
