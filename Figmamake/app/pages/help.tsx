import { Button } from "../components/ui/button";
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
          <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="mb-10">
              <h1 className="mb-2">How can we help?</h1>
              <p className="text-muted-foreground mb-6">Search our knowledge base or browse common topics</p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search for help..." className="pl-10 bg-white h-11" />
              </div>
            </div>

            {/* Quick Links */}
            <div className="grid grid-cols-4 gap-px bg-border rounded-xl overflow-hidden mb-10">
              {[
                { icon: FileText, label: "Upload Contracts", color: "text-primary" },
                { icon: AlertTriangle, label: "Risk Flags", color: "text-accent" },
                { icon: DollarSign, label: "Payment Terms", color: "text-success" },
                { icon: Shield, label: "Privacy & Security", color: "text-warning" },
              ].map((item, i) => (
                <div key={i} className="bg-white p-5 cursor-pointer hover:bg-secondary/20 transition-colors">
                  <item.icon className={`w-5 h-5 ${item.color} mb-2`} />
                  <p className="font-medium text-sm">{item.label}</p>
                </div>
              ))}
            </div>

            {/* FAQs */}
            <section className="mb-10">
              <h2 className="mb-6">Frequently Asked Questions</h2>
              <Accordion type="single" collapsible className="w-full">
                {[
                  { q: "What file formats do you support?", a: "We support PDF, Word documents (.docx), and plain text files. For best results, use text-based PDFs rather than scanned images. If you have a scanned contract, make sure it's clear and high-resolution." },
                  { q: "Is this legal advice?", a: "No. HelloBrand is not a law firm and does not provide legal advice. We provide tools to help you understand contracts and identify common issues, but you should always consult a qualified attorney for specific legal guidance." },
                  { q: "How accurate is the contract analysis?", a: "Our AI is trained on thousands of creator-brand contracts and is highly accurate at extracting standard terms like payment amounts, deliverables, and usage rights. However, contract language can be complex, so we recommend reviewing the extracted information yourself." },
                  { q: "Is my contract data secure and private?", a: "Yes. All contracts are encrypted in transit and at rest. We never share your contracts with third parties. Your data is not used to train AI models for other users. You can delete your contracts and account at any time." },
                  { q: "Can I negotiate better rates using HelloBrand?", a: "Many creators have successfully negotiated better terms using our email templates and risk flag insights. We help you identify where brands might be asking for more than industry standard, and provide professional email templates to request adjustments." },
                  { q: "What if the contract processing fails?", a: "If we can't process your contract (usually due to poor scan quality or password protection), try uploading a clearer version, manually enter terms using the Create Deal form, or contact support for help." },
                  { q: "How do payment reminders work?", a: "When you track a deal with payment terms, HelloBrand will automatically monitor the payment schedule and notify you when payments are overdue. You can then use our email templates to send professional payment reminder emails." },
                  { q: "Can I cancel my subscription anytime?", a: "Yes! You can cancel your subscription at any time from the Billing page. You'll continue to have access until the end of your current billing period." },
                ].map((faq, i) => (
                  <AccordionItem key={i} value={`item-${i}`}>
                    <AccordionTrigger className="text-sm font-medium">{faq.q}</AccordionTrigger>
                    <AccordionContent>
                      <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>

            {/* Contact */}
            <section className="border-t border-border pt-10">
              <h2 className="mb-6">Get in Touch</h2>
              <div className="grid md:grid-cols-2 gap-px bg-border rounded-xl overflow-hidden mb-6">
                <div className="bg-white p-6">
                  <MessageCircle className="w-5 h-5 text-primary mb-3" />
                  <h3 className="mb-1">Live Chat</h3>
                  <p className="text-xs text-muted-foreground mb-4">Get instant help from our support team</p>
                  <Button size="sm" className="w-full">Start Chat</Button>
                </div>
                <div className="bg-white p-6">
                  <Mail className="w-5 h-5 text-accent mb-3" />
                  <h3 className="mb-1">Email Support</h3>
                  <p className="text-xs text-muted-foreground mb-4">We'll respond within 24 hours</p>
                  <Button size="sm" variant="outline" className="w-full">Send Email</Button>
                </div>
              </div>

              <div className="flex items-start gap-4 py-5 border-t border-border">
                <BookOpen className="w-5 h-5 text-success shrink-0 mt-0.5" />
                <div>
                  <h3 className="mb-1">Creator Resources</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Check out our blog for guides on negotiating brand deals, understanding contract terms, and growing your creator business.
                  </p>
                  <Button variant="outline" size="sm">Visit Blog</Button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
