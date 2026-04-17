import { Resend } from "resend";

import { getProfileForViewer } from "@/lib/profile";
import { getAppBaseUrl } from "@/lib/email/config";
import {
  canSendNotificationEmailInCurrentMode,
  getNotificationEmailConfig
} from "@/lib/notification-email";
import { captureHandledError } from "@/lib/monitoring/sentry";
import { capturePostHogServerEvent } from "@/lib/posthog/server";
import { prisma } from "@/lib/prisma";
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

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
  html: string;
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
      recipientEmail: input.to
    })
  ) {
    return { messageId: null, sentAt: null } satisfies SendEmailResult;
  }

  const resend = new Resend(config.apiKey);
  const response = await resend.emails.send({
    from: config.fromEmail,
    to: [input.to],
    subject: input.subject,
    html: input.html,
    text: input.text,
    ...(input.replyTo ? { replyTo: input.replyTo } : {})
  });

  if (response.error) {
    throw new Error(response.error.message);
  }

  return {
    messageId: response.data?.id ?? null,
    sentAt: new Date()
  } satisfies SendEmailResult;
}

function buildSupportEmail(input: {
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
  const escapedMessage = escapeHtml(messageText).replaceAll("\n", "<br />");
  const pageUrl = new URL(input.pagePath, `${getAppBaseUrl()}/`).toString();

  return {
    subject: `Product feedback from ${input.viewer.displayName} (${input.score}/5)`,
    html: `
      <div style="font-family: Arial, sans-serif; background: #f6f3ee; padding: 32px;">
        <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border: 1px solid #e7dfd3;">
          <div style="padding: 32px;">
            <h1 style="margin: 0 0 20px; font-size: 24px; line-height: 1.2; color: #1f1a14;">New HelloBrand feedback</h1>
            <p style="margin: 0 0 12px; font-size: 15px; line-height: 1.6; color: #4a4034;"><strong>User:</strong> ${escapeHtml(input.viewer.displayName)} (${escapeHtml(input.contactEmail)})</p>
            <p style="margin: 0 0 12px; font-size: 15px; line-height: 1.6; color: #4a4034;"><strong>Score:</strong> ${input.score}/5</p>
            <p style="margin: 0 0 12px; font-size: 15px; line-height: 1.6; color: #4a4034;"><strong>App context:</strong> ${escapeHtml(input.pageTitle)} (${escapeHtml(input.pagePath)})</p>
            <p style="margin: 0 0 12px; font-size: 15px; line-height: 1.6; color: #4a4034;"><strong>Deal ID:</strong> ${escapeHtml(input.dealId ?? "None")}</p>
            <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #4a4034;"><strong>Requested follow-up:</strong> ${input.requestedFollowUp ? "Yes" : "No"}</p>
            <div style="border: 1px solid #e7dfd3; padding: 16px; background: #fcfbf9; color: #1f1a14; font-size: 15px; line-height: 1.7;">
              ${escapedMessage}
            </div>
            <p style="margin: 20px 0 0; font-size: 13px; line-height: 1.6; color: #7f6f5a;">Feedback ID: ${escapeHtml(input.feedbackId)}</p>
            <p style="margin: 8px 0 0; font-size: 13px; line-height: 1.6; color: #7f6f5a;"><a href="${pageUrl}" style="color: #7f6f5a;">Open page</a></p>
          </div>
        </div>
      </div>
    `.trim(),
    text: [
      "New HelloBrand feedback",
      "",
      `User: ${input.viewer.displayName} (${input.contactEmail})`,
      `Score: ${input.score}/5`,
      `App context: ${input.pageTitle} (${input.pagePath})`,
      `Deal ID: ${input.dealId ?? "None"}`,
      `Requested follow-up: ${input.requestedFollowUp ? "Yes" : "No"}`,
      `Feedback ID: ${input.feedbackId}`,
      "",
      messageText,
      "",
      `Open page: ${pageUrl}`
    ].join("\n")
  };
}

function buildFollowUpEmail(input: {
  viewer: Viewer;
  score: number;
  pageTitle: string;
}) {
  const tone =
    input.score <= LOW_SCORE_SUPPORT_THRESHOLD
      ? "Thanks for flagging that something felt off."
      : "Thanks for taking the time to tell us what is working and what is not.";

  return {
    subject: "Thanks for your HelloBrand feedback",
    html: `
      <div style="font-family: Arial, sans-serif; background: #f6f3ee; padding: 32px;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e7dfd3;">
          <div style="padding: 32px;">
            <h1 style="margin: 0 0 12px; font-size: 24px; line-height: 1.2; color: #1f1a14;">Thanks for the feedback</h1>
            <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #4a4034;">Hi ${escapeHtml(input.viewer.displayName)},</p>
            <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #4a4034;">${escapeHtml(tone)}</p>
            <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #4a4034;">If you want to add more detail about your experience with HelloBrand, reply to this email and our team will pick it up.</p>
            <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #4a4034;">You can also reach us anytime at <a href="mailto:${SUPPORT_EMAIL}" style="color: #4a4034;">${SUPPORT_EMAIL}</a>.</p>
          </div>
        </div>
      </div>
    `.trim(),
    text: [
      `Hi ${input.viewer.displayName},`,
      "",
      tone,
      "",
      "If you want to add more detail about your experience with HelloBrand, reply to this email and our team will pick it up.",
      "",
      `You can also reach us anytime at ${SUPPORT_EMAIL}.`
    ].join("\n")
  };
}

export async function createFeedbackSubmission(
  viewer: Viewer,
  input: FeedbackSubmissionInput
) {
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
      contactEmail
    }
  });

  const shouldNotifySupport =
    requestedFollowUp || input.score <= LOW_SCORE_SUPPORT_THRESHOLD;

  if (shouldNotifySupport) {
    const supportEmail = buildSupportEmail({
      feedbackId: submission.id,
      viewer,
      contactEmail,
      score: input.score,
      message,
      pagePath: input.pagePath,
      pageTitle: input.pageTitle,
      dealId,
      requestedFollowUp
    });

    try {
      const result = await sendFeedbackEmail({
        to: SUPPORT_EMAIL,
        subject: supportEmail.subject,
        html: supportEmail.html,
        text: supportEmail.text,
        replyTo: contactEmail
      });

      if (result.sentAt) {
        await prisma.feedbackSubmission.update({
          where: { id: submission.id },
          data: {
            supportEmailMessageId: result.messageId,
            supportEmailSentAt: result.sentAt
          }
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
          requestedFollowUp
        }
      });
    }
  }

  if (requestedFollowUp) {
    const followUpEmail = buildFollowUpEmail({
      viewer,
      score: input.score,
      pageTitle: input.pageTitle
    });

    try {
      const result = await sendFeedbackEmail({
        to: contactEmail,
        subject: followUpEmail.subject,
        html: followUpEmail.html,
        text: followUpEmail.text,
        replyTo: SUPPORT_EMAIL
      });

      if (result.sentAt) {
        await prisma.feedbackSubmission.update({
          where: { id: submission.id },
          data: {
            userFollowUpEmailMessageId: result.messageId,
            userFollowUpEmailSentAt: result.sentAt
          }
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
          score: input.score
        }
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
      messageProvided: Boolean(message)
    }
  }).catch((error) => {
    captureHandledError(error, {
      area: "feedback",
      name: "capture_feedback_submitted",
      viewerId: viewer.id,
      captureExpected: true,
      extras: {
        feedbackId: submission.id
      }
    });
  });

  return {
    id: submission.id
  };
}
