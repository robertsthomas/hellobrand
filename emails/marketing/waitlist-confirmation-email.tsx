/**
 * This file defines the waitlist confirmation email template in React Email.
 * It is the source of truth for previewing locally and uploading the template to Resend.
 */
import {
  EmailContent,
  EmailFooter,
  EmailHeader,
  EmailShell,
  EmailText,
  EmailTitle,
  emailSharedStyles,
} from "@/emails/shared/components";
import { Link } from "react-email";

export type WaitlistConfirmationEmailTemplateProps = {
  unsubscribeUrl: string;
};

export default function WaitlistConfirmationEmailTemplate(
  input: WaitlistConfirmationEmailTemplateProps
) {
  return (
    <EmailShell
      footer={
        <EmailFooter>
          Prefer not to get future HelloBrand product updates?{" "}
          <Link href={input.unsubscribeUrl} style={emailSharedStyles.link}>
            Unsubscribe
          </Link>
          .
        </EmailFooter>
      }
      preview="You're on the HelloBrand waitlist."
    >
      <EmailHeader />
      <EmailContent>
        <EmailTitle>You&apos;re on the list!</EmailTitle>
        <EmailText>
          Thanks for joining the HelloBrand waitlist. We&apos;re building the operating layer for
          creator partnerships, and we&apos;ll let you know as soon as we&apos;re ready to welcome
          you in.
        </EmailText>
        <EmailText muted style={{ margin: 0 }}>
          We&apos;ll email you when access opens.
        </EmailText>
      </EmailContent>
    </EmailShell>
  );
}

WaitlistConfirmationEmailTemplate.PreviewProps = {
  unsubscribeUrl: "http://localhost:3011/api/email/unsubscribe?token=preview",
} satisfies WaitlistConfirmationEmailTemplateProps;
