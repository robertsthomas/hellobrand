import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion";
import { Sidebar } from "../components/features/sidebar";
import { Search, BookOpen, MessageCircle, Mail, FileText, Shield, DollarSign, AlertTriangle } from "lucide-react";

export function HelpPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      
      <div className="flex-1 ml-64">
        <div className="p-8">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="text-center mb-12">
              <h1 className="text-4xl font-semibold mb-4">How can we help?</h1>
              <p className="text-xl text-muted-foreground mb-8">
                Search our knowledge base or browse common topics
              </p>
              <div className="max-w-2xl mx-auto relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="Search for help..."
                  className="pl-12 h-12"
                />
              </div>
            </div>

            {/* Quick Links */}
            <div className="grid md:grid-cols-4 gap-4 mb-12">
              <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Upload Contracts</h3>
                <p className="text-sm text-muted-foreground">
                  Learn how to upload and analyze contracts
                </p>
              </Card>

              <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                  <AlertTriangle className="w-6 h-6 text-accent" />
                </div>
                <h3 className="font-semibold mb-2">Risk Flags</h3>
                <p className="text-sm text-muted-foreground">
                  Understanding contract risk alerts
                </p>
              </Card>

              <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer">
                <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center mb-4">
                  <DollarSign className="w-6 h-6 text-success" />
                </div>
                <h3 className="font-semibold mb-2">Payment Terms</h3>
                <p className="text-sm text-muted-foreground">
                  Track payments and send reminders
                </p>
              </Card>

              <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer">
                <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-warning" />
                </div>
                <h3 className="font-semibold mb-2">Privacy & Security</h3>
                <p className="text-sm text-muted-foreground">
                  How we protect your data
                </p>
              </Card>
            </div>

            {/* FAQs */}
            <Card className="p-6 mb-8">
              <h2 className="text-2xl font-semibold mb-6">Frequently Asked Questions</h2>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1">
                  <AccordionTrigger>What file formats do you support?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-muted-foreground leading-relaxed">
                      We support PDF, Word documents (.docx), and plain text files. For best results, use text-based PDFs rather than scanned images. If you have a scanned contract, make sure it's clear and high-resolution.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-2">
                  <AccordionTrigger>Is this legal advice?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-muted-foreground leading-relaxed mb-3">
                      No. HelloBrand is not a law firm and does not provide legal advice. We provide tools to help you understand contracts and identify common issues, but you should always consult a qualified attorney for specific legal guidance.
                    </p>
                    <p className="text-muted-foreground leading-relaxed">
                      Think of us as a helpful assistant that helps you spot important terms and ask better questions—but we're not a replacement for professional legal counsel.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-3">
                  <AccordionTrigger>How accurate is the contract analysis?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-muted-foreground leading-relaxed">
                      Our AI is trained on thousands of creator-brand contracts and is highly accurate at extracting standard terms like payment amounts, deliverables, and usage rights. However, contract language can be complex and nuanced, so we recommend reviewing the extracted information yourself and consulting a lawyer for important decisions.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-4">
                  <AccordionTrigger>Is my contract data secure and private?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-muted-foreground leading-relaxed mb-3">
                      Yes. We take privacy and security very seriously:
                    </p>
                    <ul className="text-muted-foreground space-y-2 ml-4">
                      <li>• All contracts are encrypted in transit and at rest</li>
                      <li>• We never share your contracts with third parties</li>
                      <li>• Your data is not used to train AI models for other users</li>
                      <li>• You can delete your contracts and account at any time</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-5">
                  <AccordionTrigger>Can I negotiate better rates using HelloBrand?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-muted-foreground leading-relaxed">
                      Many creators have successfully negotiated better terms using our email templates and risk flag insights. We help you identify where brands might be asking for more than industry standard (like paid advertising rights without extra compensation), and provide professional email templates to request adjustments.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-6">
                  <AccordionTrigger>What if the contract processing fails?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-muted-foreground leading-relaxed mb-3">
                      If we can't process your contract (usually due to poor scan quality or password protection), you have a few options:
                    </p>
                    <ul className="text-muted-foreground space-y-2 ml-4">
                      <li>• Try uploading a clearer version or text-based PDF</li>
                      <li>• Manually enter the key terms using our "Create Deal" form</li>
                      <li>• Contact support and we'll help you troubleshoot</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-7">
                  <AccordionTrigger>How do payment reminders work?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-muted-foreground leading-relaxed">
                      When you track a deal with payment terms, HelloBrand will automatically monitor the payment schedule and notify you when payments are overdue. You can then use our email templates to send professional payment reminder emails to brands. We'll help you follow up politely but firmly.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-8">
                  <AccordionTrigger>Can I cancel my subscription anytime?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-muted-foreground leading-relaxed">
                      Yes! You can cancel your subscription at any time from the Billing page. You'll continue to have access to your plan until the end of your current billing period. No refunds for partial months, but you won't be charged again.
                    </p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </Card>

            {/* Contact Support */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="p-6">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <MessageCircle className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Live Chat</h3>
                <p className="text-muted-foreground mb-4">
                  Get instant help from our support team
                </p>
                <Button className="w-full">Start Chat</Button>
              </Card>

              <Card className="p-6">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                  <Mail className="w-6 h-6 text-accent" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Email Support</h3>
                <p className="text-muted-foreground mb-4">
                  We'll respond within 24 hours
                </p>
                <Button variant="outline" className="w-full">Send Email</Button>
              </Card>
            </div>

            {/* Additional Resources */}
            <Card className="p-6 mt-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
                  <BookOpen className="w-6 h-6 text-success" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Creator Resources</h3>
                  <p className="text-muted-foreground mb-4">
                    Check out our blog for guides on negotiating brand deals, understanding contract terms, and growing your creator business.
                  </p>
                  <Button variant="outline">Visit Blog</Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}