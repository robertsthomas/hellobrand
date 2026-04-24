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
} from "@/emails/shared/components";

export type WaitlistConfirmationEmailTemplateProps = {
  unsubscribeUrl: string;
};

export default function WaitlistConfirmationEmailTemplate(
  input: WaitlistConfirmationEmailTemplateProps
) {
  return (
    <EmailShell
      footer={<EmailFooter unsubscribeHref={input.unsubscribeUrl} />}
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
          Stay tuned, we&apos;ll be in touch soon.
        </EmailText>
      </EmailContent>
    </EmailShell>
  );
}

WaitlistConfirmationEmailTemplate.PreviewProps = {
  unsubscribeUrl: "http://localhost:3011/api/email/unsubscribe?token=preview",
} satisfies WaitlistConfirmationEmailTemplateProps;
