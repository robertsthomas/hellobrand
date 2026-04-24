/**
 * This file defines the waitlist confirmation email template in React Email.
 * It is the source of truth for previewing locally and uploading the template to Resend.
 */
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "react-email";

export type WaitlistConfirmationEmailTemplateProps = {
  unsubscribeUrl: string;
};

const styles = {
  body: {
    backgroundColor: "#f6f3ee",
    fontFamily: "Arial, sans-serif",
    padding: "32px 0",
  },
  container: {
    backgroundColor: "#ffffff",
    border: "1px solid #e7dfd3",
    margin: "0 auto",
    maxWidth: "560px",
    width: "100%",
  },
  section: {
    borderTop: "2px solid #1f1a14",
    padding: "32px",
  },
  heading: {
    color: "#1f1a14",
    fontSize: "24px",
    fontWeight: "700",
    lineHeight: "1.2",
    margin: "0 0 12px",
  },
  bodyText: {
    color: "#4a4034",
    fontSize: "15px",
    lineHeight: "1.6",
    margin: "0 0 24px",
  },
  closing: {
    color: "#7f6f5a",
    fontSize: "14px",
    lineHeight: "1.6",
    margin: "0",
  },
  unsubscribe: {
    color: "#7f6f5a",
    fontSize: "12px",
    lineHeight: "1.6",
    margin: "24px 0 0",
  },
  link: {
    color: "#7f6f5a",
    textDecoration: "underline",
  },
} as const;

export default function WaitlistConfirmationEmailTemplate(
  input: WaitlistConfirmationEmailTemplateProps
) {
  return (
    <Html lang="en">
      <Head />
      <Preview>You&apos;re on the HelloBrand waitlist.</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.section}>
            <Heading as="h1" style={styles.heading}>
              You&apos;re on the list!
            </Heading>
            <Text style={styles.bodyText}>
              Thanks for joining the HelloBrand waitlist. We&apos;re building the
              operating layer for creator partnerships, and we&apos;ll let you know
              as soon as we&apos;re ready to welcome you in.
            </Text>
            <Text style={styles.closing}>Stay tuned, we&apos;ll be in touch soon.</Text>
            <Text style={styles.unsubscribe}>
              Prefer not to get future HelloBrand product updates?{" "}
              <Link href={input.unsubscribeUrl} style={styles.link}>
                Unsubscribe
              </Link>
              .
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

WaitlistConfirmationEmailTemplate.PreviewProps = {
  unsubscribeUrl: "http://localhost:3011/api/email/unsubscribe?token=preview",
} satisfies WaitlistConfirmationEmailTemplateProps;
