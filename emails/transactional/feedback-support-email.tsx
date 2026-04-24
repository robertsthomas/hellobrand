/**
 * This file defines the support-facing feedback notification email template in React Email.
 * It preserves the existing feedback details while moving rendering out of the feedback domain code.
 */
import { Link, Text } from "react-email";

import {
  EmailContent,
  EmailDetailPanel,
  EmailFooter,
  EmailHeader,
  EmailShell,
  EmailText,
  EmailTitle,
  emailSharedStyles,
} from "@/emails/shared/components";

export type FeedbackSupportEmailTemplateProps = {
  userName: string;
  contactEmail: string;
  score: number;
  pagePath: string;
  pageTitle: string;
  dealId: string | null;
  requestedFollowUp: boolean;
  message: string;
  feedbackId: string;
  pageUrl: string;
};

export default function FeedbackSupportEmailTemplate(input: FeedbackSupportEmailTemplateProps) {
  return (
    <EmailShell
      footer={<EmailFooter>Internal feedback notification for HelloBrand support.</EmailFooter>}
      maxWidth={640}
      preview={`New HelloBrand feedback from ${input.userName}`}
    >
      <EmailHeader />
      <EmailContent>
        <EmailTitle>New HelloBrand feedback</EmailTitle>
        <EmailDetailPanel
          rows={[
            { label: "User", value: `${input.userName} (${input.contactEmail})` },
            { label: "Score", value: `${input.score}/5` },
            { label: "App context", value: `${input.pageTitle} (${input.pagePath})` },
            { label: "Deal ID", value: input.dealId ?? "None" },
            { label: "Requested follow-up", value: input.requestedFollowUp ? "Yes" : "No" },
          ]}
          title="Feedback details"
          variant={input.score <= 3 ? "warning" : "neutral"}
        />
        <EmailDetailPanel title="Message" variant="neutral">
          <Text style={emailSharedStyles.noMarginText}>{input.message}</Text>
        </EmailDetailPanel>
        <EmailText muted>Feedback ID: {input.feedbackId}</EmailText>
        <EmailText muted style={{ margin: 0 }}>
          <Link href={input.pageUrl} style={emailSharedStyles.link}>
            Open page
          </Link>
        </EmailText>
      </EmailContent>
    </EmailShell>
  );
}

FeedbackSupportEmailTemplate.PreviewProps = {
  userName: "Taylor Example",
  contactEmail: "taylor@example.com",
  score: 2,
  pagePath: "/app/p/deal_123",
  pageTitle: "Partnership workspace",
  dealId: "deal_123",
  requestedFollowUp: true,
  message: "The deliverables section is confusing and I could not tell what was due next.",
  feedbackId: "feedback_preview",
  pageUrl: "http://localhost:3011/app/p/deal_123",
} satisfies FeedbackSupportEmailTemplateProps;
