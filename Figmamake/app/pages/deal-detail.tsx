import { Link } from "react-router";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Sidebar } from "../components/features/sidebar";
import {
  FileText, Download, Share2, DollarSign, Calendar, Clock,
  Globe, Shield, Mail, CheckCircle2, AlertTriangle, ArrowLeft,
} from "lucide-react";

export function DealDetailPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      
      <div className="flex-1 ml-64">
        <div className="p-8">
          <div className="max-w-6xl mx-auto">
            {/* Breadcrumb */}
            <Link to="/app/deals/history" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
              <ArrowLeft className="w-4 h-4" />
              All Deals
            </Link>

            {/* Header */}
            <div className="flex items-start justify-between mb-8 pb-8 border-b border-border">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1>Glossier Spring Campaign</h1>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-success"></span>
                    <span className="text-sm font-medium">Active</span>
                  </div>
                </div>
                <p className="text-muted-foreground">
                  Contract uploaded on March 1, 2026 · Reviewed by HelloBrand AI
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="w-4 h-4" />
                  Download
                </Button>
                <Button variant="outline" size="sm" className="gap-2">
                  <Share2 className="w-4 h-4" />
                  Share
                </Button>
              </div>
            </div>

            {/* Quick Stats - Invoice style row */}
            <div className="grid md:grid-cols-4 gap-8 mb-12">
              <div className="border-b border-border pb-3">
                <p className="text-xs text-muted-foreground mb-1.5 uppercase tracking-wide">Payment</p>
                <p className="text-2xl font-bold tracking-tight">$8,500</p>
              </div>
              <div className="border-b border-border pb-3">
                <p className="text-xs text-muted-foreground mb-1.5 uppercase tracking-wide">Due Date</p>
                <p className="text-2xl font-bold tracking-tight">Mar 25, 2026</p>
              </div>
              <div className="border-b border-border pb-3">
                <p className="text-xs text-muted-foreground mb-1.5 uppercase tracking-wide">Deliverables</p>
                <p className="text-2xl font-bold tracking-tight">4 pending</p>
              </div>
              <div className="border-b border-border pb-3">
                <p className="text-xs text-muted-foreground mb-1.5 uppercase tracking-wide">Risk Flags</p>
                <p className="text-2xl font-bold tracking-tight text-accent">2 flagged</p>
              </div>
            </div>

            {/* Tabbed Workspace */}
            <Tabs defaultValue="summary" className="w-full">
              <TabsList className="mb-8">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="terms">Key Terms</TabsTrigger>
                <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
                <TabsTrigger value="risks">Risk Flags</TabsTrigger>
                <TabsTrigger value="emails">Email Drafts</TabsTrigger>
              </TabsList>

              {/* Summary Tab - Document style */}
              <TabsContent value="summary">
                <div className="max-w-3xl">
                  <div className="space-y-8">
                    <div>
                      <h2 className="mb-4">Contract Summary</h2>
                      <p className="text-muted-foreground leading-relaxed">
                        This is a brand partnership agreement between you and Glossier Inc. for their Spring 2026 campaign. You'll be creating Instagram and YouTube content featuring their new skincare line.
                      </p>
                    </div>

                    <div className="border-t border-border pt-6">
                      <h3 className="mb-3">What you'll get paid</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        Total compensation is <strong className="text-foreground">$8,500</strong>. Payment will be made in two installments: 50% ($4,250) upfront upon contract signing, and 50% ($4,250) within 30 days after all deliverables are approved. Payment terms are Net 30.
                      </p>
                    </div>

                    <div className="border-t border-border pt-6">
                      <h3 className="mb-3">What you need to create</h3>
                      <ul className="text-muted-foreground space-y-2">
                        <li className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0"></span>
                          1 Instagram Reel (60-90 seconds) featuring product demo
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0"></span>
                          3 Instagram Stories showing daily skincare routine
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0"></span>
                          1 YouTube video (10-15 minutes) in-depth review
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0"></span>
                          Behind-the-scenes content for brand's social media
                        </li>
                      </ul>
                    </div>

                    <div className="border-t border-border pt-6">
                      <h3 className="mb-3">Timeline</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        All content must be submitted for approval by <strong className="text-foreground">March 25, 2026</strong>. Glossier has 5 business days to review and request revisions. Up to 2 rounds of revisions are included. Final content must go live by April 5, 2026.
                      </p>
                    </div>

                    <div className="border-t border-border pt-6">
                      <h3 className="mb-3">How they can use your content</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        Glossier can repurpose your content on their Instagram, TikTok, website, and email marketing for <strong className="text-foreground">12 months</strong> from the campaign launch date. This includes paid advertising on social media platforms.
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Key Terms Tab - Invoice/document style */}
              <TabsContent value="terms">
                <div className="max-w-3xl space-y-10">
                  {/* Payment Terms */}
                  <div>
                    <h2 className="mb-6">Payment Terms</h2>
                    <div className="border-t border-border">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left px-0 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Description</th>
                            <th className="text-right px-0 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          <tr>
                            <td className="px-0 py-3 text-sm">Upfront payment (on signing)</td>
                            <td className="px-0 py-3 text-sm text-right font-medium">$4,250</td>
                          </tr>
                          <tr>
                            <td className="px-0 py-3 text-sm">Completion payment (Net 30)</td>
                            <td className="px-0 py-3 text-sm text-right font-medium">$4,250</td>
                          </tr>
                          <tr className="bg-secondary/20">
                            <td className="px-0 py-3 text-sm font-bold">Total Amount</td>
                            <td className="px-0 py-3 text-sm text-right font-bold">$8,500</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Usage Rights */}
                  <div className="border-t border-border pt-10">
                    <h2 className="mb-6">Usage Rights</h2>
                    <div className="space-y-4">
                      <div className="flex items-start gap-4 py-3 border-b border-border">
                        <Clock className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-medium text-sm">Duration</p>
                          <p className="text-sm text-muted-foreground mt-0.5">12 months from campaign launch (April 1, 2026 - April 1, 2027)</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4 py-3 border-b border-border">
                        <Globe className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-medium text-sm">Platforms</p>
                          <p className="text-sm text-muted-foreground mt-0.5">Instagram, TikTok, Glossier.com, email marketing, paid social advertising</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4 py-3">
                        <Shield className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-medium text-sm">Exclusivity</p>
                          <p className="text-sm text-muted-foreground mt-0.5">No competing skincare brands for 90 days (March 1 - May 30, 2026)</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Revision & Approval */}
                  <div className="border-t border-border pt-10">
                    <h2 className="mb-6">Revision & Approval</h2>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-sm">2 rounds of revisions included</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Additional revisions charged at $500 per round</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-sm">5 business days for approval</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Glossier will review and provide feedback within 5 business days</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Deliverables Tab */}
              <TabsContent value="deliverables">
                <div className="max-w-3xl">
                  {/* Progress overview */}
                  <div className="flex items-center justify-between mb-6 pb-6 border-b border-border">
                    <div>
                      <h2>Progress Tracker</h2>
                      <p className="text-sm text-muted-foreground mt-1">2 of 4 deliverables completed · 13 days until deadline</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-32 h-2 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: '60%' }}></div>
                      </div>
                      <span className="text-sm font-bold">60%</span>
                    </div>
                  </div>

                  {/* Deliverables list */}
                  <div className="divide-y divide-border">
                    {/* Completed */}
                    <div className="py-5">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">Instagram Reel (60-90 sec)</p>
                            <span className="text-xs text-success">Completed</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">Product demo featuring the new skincare line</p>
                          <p className="text-xs text-muted-foreground mt-1">Submitted: Mar 5 · Approved: Mar 7</p>
                        </div>
                      </div>
                    </div>

                    <div className="py-5">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">Instagram Stories (3 stories)</p>
                            <span className="text-xs text-success">Completed</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">Daily skincare routine featuring Glossier products</p>
                          <p className="text-xs text-muted-foreground mt-1">Submitted: Mar 8 · Approved: Mar 9</p>
                        </div>
                      </div>
                    </div>

                    {/* In Progress */}
                    <div className="py-5">
                      <div className="flex items-start gap-3">
                        <Clock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">YouTube Video (10-15 min)</p>
                            <span className="text-xs text-primary">In Progress</span>
                            <span className="text-xs text-accent">Due in 13 days</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">In-depth review and tutorial of the skincare line</p>
                          <div className="flex items-center gap-2 mt-2">
                            <div className="w-24 h-1.5 bg-secondary rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: '75%' }}></div>
                            </div>
                            <span className="text-xs text-muted-foreground">75%</span>
                          </div>
                          <Button size="sm" variant="outline" className="mt-3 h-7 text-xs">Update Progress</Button>
                        </div>
                      </div>
                    </div>

                    {/* Not Started */}
                    <div className="py-5">
                      <div className="flex items-start gap-3">
                        <FileText className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">Behind-the-Scenes Content</p>
                            <span className="text-xs text-muted-foreground">Not Started</span>
                            <span className="text-xs text-accent">Due in 13 days</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">B-roll and behind-the-scenes footage for brand's social media</p>
                          <Button size="sm" className="mt-3 h-7 text-xs">Start Working</Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Risk Flags Tab */}
              <TabsContent value="risks">
                <div className="max-w-3xl space-y-6">
                  <div className="border-l-3 border-l-accent pl-6 py-4">
                    <div className="flex items-center gap-2 mb-2">
                      <h3>Paid Advertising Usage</h3>
                      <Badge className="bg-accent/10 text-accent text-xs">Medium Risk</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                      The contract allows Glossier to use your content in <strong className="text-foreground">paid advertising</strong> on social media platforms without additional compensation. This is typically worth an extra 20-40% on top of your base rate.
                    </p>
                    <div className="bg-secondary/50 rounded-lg p-4 mb-4">
                      <p className="text-xs font-medium mb-2">What this means:</p>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        <li>· Your content can be used in Instagram/Facebook ads</li>
                        <li>· No additional payment for ad usage</li>
                        <li>· Industry standard is +30% for paid media rights</li>
                      </ul>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="gap-2 h-8 text-xs">
                        <Mail className="w-3.5 h-3.5" />
                        Request Negotiation
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 text-xs">Mark as Reviewed</Button>
                    </div>
                  </div>

                  <div className="border-t border-border pt-6">
                    <div className="border-l-3 border-l-warning pl-6 py-4">
                      <div className="flex items-center gap-2 mb-2">
                        <h3>90-Day Exclusivity Clause</h3>
                        <Badge className="bg-warning/10 text-warning text-xs">Low Risk</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                        You cannot work with competing skincare brands for <strong className="text-foreground">90 days</strong> (March 1 - May 30, 2026). Make sure you don't have any existing commitments that conflict.
                      </p>
                      <div className="bg-secondary/50 rounded-lg p-4 mb-4">
                        <p className="text-xs font-medium mb-2">Competing categories defined as:</p>
                        <ul className="text-xs text-muted-foreground space-y-1">
                          <li>· Skincare products and brands</li>
                          <li>· Beauty subscription boxes featuring skincare</li>
                          <li>· Does NOT include makeup, haircare, or wellness</li>
                        </ul>
                      </div>
                      <Button size="sm" variant="outline" className="h-8 text-xs">Mark as Reviewed</Button>
                    </div>
                  </div>

                  <div className="border-t border-border pt-6">
                    <div className="flex items-start gap-3 py-4">
                      <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                      <div>
                        <h3 className="mb-1">Everything else looks good!</h3>
                        <p className="text-sm text-muted-foreground">
                          No other major risks detected. The payment terms, deliverables, and timeline are all reasonable and industry-standard.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Email Drafts Tab */}
              <TabsContent value="emails">
                <div className="max-w-3xl space-y-8">
                  <div className="pb-8 border-b border-border">
                    <div className="flex items-center gap-3 mb-1">
                      <Mail className="w-5 h-5 text-accent" />
                      <h3>Negotiate Paid Media Rights</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-6 ml-8">
                      Professionally request additional compensation for paid advertising usage
                    </p>
                    <div className="space-y-4 ml-8">
                      <div>
                        <Label htmlFor="subject1" className="text-xs mb-1.5 block">Subject Line</Label>
                        <Input id="subject1" defaultValue="Glossier Spring Campaign - Usage Rights Discussion" className="bg-white" />
                      </div>
                      <div>
                        <Label htmlFor="body1" className="text-xs mb-1.5 block">Email Body</Label>
                        <Textarea
                          id="body1"
                          rows={12}
                          className="bg-white"
                          defaultValue={`Hi [Brand Contact Name],

I hope this email finds you well! I'm really excited about the Glossier Spring Campaign and the creative direction we've discussed.

I wanted to touch base about the usage rights outlined in the contract. I noticed the agreement includes rights for paid advertising on social media platforms. While I'm absolutely open to this, my standard rate structure includes an additional fee for paid media usage, as it typically drives significant value for brand partners.

Industry standard for paid advertising rights is typically 30-40% above the base creative fee. For this campaign, I'd propose adding $2,550 (30%) to cover the paid media rights, bringing the total to $11,050.

I'm confident this partnership will be amazing, and I want to make sure we're both set up for success. Would you be open to discussing this adjustment?

Looking forward to hearing from you!

Best,
Sarah`}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="gap-2 h-8 text-xs">
                          <Mail className="w-3.5 h-3.5" />
                          Copy to Clipboard
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 text-xs">Customize</Button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <Mail className="w-5 h-5 text-primary" />
                      <h3>Payment Reminder</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-6 ml-8">
                      Polite follow-up for overdue payment (currently 7 days late)
                    </p>
                    <div className="space-y-4 ml-8">
                      <div>
                        <Label htmlFor="subject2" className="text-xs mb-1.5 block">Subject Line</Label>
                        <Input id="subject2" defaultValue="Following Up: Glossier Spring Campaign - Invoice #1234" className="bg-white" />
                      </div>
                      <div>
                        <Label htmlFor="body2" className="text-xs mb-1.5 block">Email Body</Label>
                        <Textarea
                          id="body2"
                          rows={10}
                          className="bg-white"
                          defaultValue={`Hi [Brand Contact Name],

I hope you're doing well! I wanted to follow up on the payment for the Glossier Spring Campaign completion milestone.

According to our agreement, the final payment of $4,250 was due on March 5, 2026 (Net 30 from February 3rd approval). I haven't received this payment yet, so I wanted to check in and see if there's any issue on my end that needs to be resolved.

Could you please confirm the status of this payment? If there's any additional information or documentation you need from me, I'm happy to provide it.

Thank you for your attention to this matter!

Best regards,
Sarah`}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="gap-2 h-8 text-xs">
                          <Mail className="w-3.5 h-3.5" />
                          Copy to Clipboard
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 text-xs">Customize</Button>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}