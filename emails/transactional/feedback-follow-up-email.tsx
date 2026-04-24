/**
 * This file defines the user-facing feedback follow-up email template in React Email.
 * It keeps the follow-up response copy in a reusable template for Resend sends and previews.
 */
import { Link } from "react-email";

import {
  EmailContent,
  EmailFooter,
  EmailHeader,
  EmailShell,
  EmailText,
  EmailTitle,
  emailSharedStyles,
} from "@/emails/shared/components";

export type FeedbackFollowUpEmailTemplateProps = {
  displayName: string;
  tone: string;
  supportEmail: string;
};

export default function FeedbackFollowUpEmailTemplate(input: FeedbackFollowUpEmailTemplateProps) {
  return (
    <EmailShell
      footer={<EmailFooter supportHref={`mailto:${input.supportEmail}`} />}
      preview="Thanks for your HelloBrand feedback."
    >
      <EmailHeader />
      <EmailContent>
        <EmailTitle>Thanks for the feedback</EmailTitle>
        <EmailText>Hi {input.displayName},</EmailText>
        <EmailText>{input.tone}</EmailText>
        <EmailText>
          If you want to add more detail about your experience with HelloBrand, reply to this email
          and our team will pick it up.
        </EmailText>
        <EmailText style={{ margin: 0 }}>
          You can also reach us anytime at{" "}
          <Link href={`mailto:${input.supportEmail}`} style={emailSharedStyles.link}>
            {input.supportEmail}
          </Link>
          .
        </EmailText>
      </EmailContent>
    </EmailShell>
  );
}

FeedbackFollowUpEmailTemplate.PreviewProps = {
  displayName: "Taylor",
  tone: "Thanks for flagging that something felt off.",
  supportEmail: "support@hellobrand.com",
} satisfies FeedbackFollowUpEmailTemplateProps;
