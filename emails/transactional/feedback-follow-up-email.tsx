/**
 * This file defines the user-facing feedback follow-up email template in React Email.
 * It keeps the follow-up response copy in a reusable template for Resend sends and previews.
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

export type FeedbackFollowUpEmailTemplateProps = {
  displayName: string;
  tone: string;
  supportEmail: string;
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
    padding: "32px",
  },
  heading: {
    color: "#1f1a14",
    fontSize: "24px",
    fontWeight: "700",
    lineHeight: "1.2",
    margin: "0 0 12px",
  },
  text: {
    color: "#4a4034",
    fontSize: "15px",
    lineHeight: "1.6",
    margin: "0 0 16px",
  },
  link: {
    color: "#4a4034",
    textDecoration: "underline",
  },
} as const;

export default function FeedbackFollowUpEmailTemplate(
  input: FeedbackFollowUpEmailTemplateProps
) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Thanks for your HelloBrand feedback.</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.section}>
            <Heading as="h1" style={styles.heading}>
              Thanks for the feedback
            </Heading>
            <Text style={styles.text}>Hi {input.displayName},</Text>
            <Text style={styles.text}>{input.tone}</Text>
            <Text style={styles.text}>
              If you want to add more detail about your experience with HelloBrand, reply
              to this email and our team will pick it up.
            </Text>
            <Text style={{ ...styles.text, margin: 0 }}>
              You can also reach us anytime at{" "}
              <Link href={`mailto:${input.supportEmail}`} style={styles.link}>
                {input.supportEmail}
              </Link>
              .
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

FeedbackFollowUpEmailTemplate.PreviewProps = {
  displayName: "Taylor",
  tone: "Thanks for flagging that something felt off.",
  supportEmail: "support@hellobrand.com",
} satisfies FeedbackFollowUpEmailTemplateProps;
