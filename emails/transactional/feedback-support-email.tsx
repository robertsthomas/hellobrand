/**
 * This file defines the support-facing feedback notification email template in React Email.
 * It preserves the existing feedback details while moving rendering out of the feedback domain code.
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
    maxWidth: "640px",
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
    margin: "0 0 20px",
  },
  text: {
    color: "#4a4034",
    fontSize: "15px",
    lineHeight: "1.6",
    margin: "0 0 12px",
  },
  messageBox: {
    backgroundColor: "#fcfbf9",
    border: "1px solid #e7dfd3",
    color: "#1f1a14",
    fontSize: "15px",
    lineHeight: "1.7",
    padding: "16px",
  },
  meta: {
    color: "#7f6f5a",
    fontSize: "13px",
    lineHeight: "1.6",
    margin: "20px 0 0",
  },
  metaLink: {
    color: "#7f6f5a",
    textDecoration: "underline",
  },
} as const;

export default function FeedbackSupportEmailTemplate(
  input: FeedbackSupportEmailTemplateProps
) {
  return (
    <Html lang="en">
      <Head />
      <Preview>New HelloBrand feedback from {input.userName}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.section}>
            <Heading as="h1" style={styles.heading}>
              New HelloBrand feedback
            </Heading>
            <Text style={styles.text}>
              <strong>User:</strong> {input.userName} ({input.contactEmail})
            </Text>
            <Text style={styles.text}>
              <strong>Score:</strong> {input.score}/5
            </Text>
            <Text style={styles.text}>
              <strong>App context:</strong> {input.pageTitle} ({input.pagePath})
            </Text>
            <Text style={styles.text}>
              <strong>Deal ID:</strong> {input.dealId ?? "None"}
            </Text>
            <Text style={{ ...styles.text, margin: "0 0 20px" }}>
              <strong>Requested follow-up:</strong> {input.requestedFollowUp ? "Yes" : "No"}
            </Text>
            <Section style={styles.messageBox}>
              <Text style={{ margin: 0 }}>{input.message}</Text>
            </Section>
            <Text style={styles.meta}>Feedback ID: {input.feedbackId}</Text>
            <Text style={{ ...styles.meta, margin: "8px 0 0" }}>
              <Link href={input.pageUrl} style={styles.metaLink}>
                Open page
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
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
