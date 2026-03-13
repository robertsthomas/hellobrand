import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Sidebar } from "../components/features/sidebar";
import {
  FileText,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Download,
  Share2,
  DollarSign,
  Calendar,
  Clock,
  Globe,
  Shield,
  Mail,
} from "lucide-react";

export function DealDetailPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      
      {/* Main Content */}
      <div className="flex-1 ml-64">
        <div className="p-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-3xl font-semibold">Glossier Spring Campaign</h1>
                    <Badge className="bg-success/10 text-success hover:bg-success/20">Active</Badge>
                  </div>
                  <p className="text-muted-foreground">
                    Contract uploaded on March 1, 2026 • Reviewed by HelloBrand AI
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

              {/* Quick Stats */}
              <div className="grid md:grid-cols-4 gap-4">
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-success" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Payment</p>
                      <p className="text-lg font-semibold">$8,500</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-warning" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Due Date</p>
                      <p className="text-lg font-semibold">Mar 25, 2026</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Deliverables</p>
                      <p className="text-lg font-semibold">4 pending</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Risk Flags</p>
                      <p className="text-lg font-semibold">2 flagged</p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>

            {/* Tabbed Workspace */}
            <Tabs defaultValue="summary" className="w-full">
              <TabsList className="mb-6 bg-secondary">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="terms">Key Terms</TabsTrigger>
                <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
                <TabsTrigger value="risks">Risk Flags</TabsTrigger>
                <TabsTrigger value="emails">Email Drafts</TabsTrigger>
              </TabsList>

              {/* Summary Tab */}
              <TabsContent value="summary" className="space-y-6">
                <Card className="p-6">
                  <h2 className="text-xl font-semibold mb-4">Contract Summary</h2>
                  <div className="prose prose-sm max-w-none">
                    <p className="text-muted-foreground leading-relaxed mb-4">
                      This is a brand partnership agreement between you and Glossier Inc. for their Spring 2026 campaign. You'll be creating Instagram and YouTube content featuring their new skincare line.
                    </p>
                    
                    <h4 className="font-semibold mb-2 text-base">What you'll get paid:</h4>
                    <p className="text-muted-foreground leading-relaxed mb-4">
                      Total compensation is <strong>$8,500</strong>. Payment will be made in two installments: 50% ($4,250) upfront upon contract signing, and 50% ($4,250) within 30 days after all deliverables are approved. Payment terms are Net 30.
                    </p>

                    <h4 className="font-semibold mb-2 text-base">What you need to create:</h4>
                    <ul className="text-muted-foreground space-y-1 mb-4">
                      <li>• 1 Instagram Reel (60-90 seconds) featuring product demo</li>
                      <li>• 3 Instagram Stories showing daily skincare routine</li>
                      <li>• 1 YouTube video (10-15 minutes) in-depth review</li>
                      <li>• Behind-the-scenes content for brand's social media</li>
                    </ul>

                    <h4 className="font-semibold mb-2 text-base">Timeline:</h4>
                    <p className="text-muted-foreground leading-relaxed mb-4">
                      All content must be submitted for approval by <strong>March 25, 2026</strong>. Glossier has 5 business days to review and request revisions. Up to 2 rounds of revisions are included. Final content must go live by April 5, 2026.
                    </p>

                    <h4 className="font-semibold mb-2 text-base">How they can use your content:</h4>
                    <p className="text-muted-foreground leading-relaxed">
                      Glossier can repurpose your content on their Instagram, TikTok, website, and email marketing for <strong>12 months</strong> from the campaign launch date. This includes paid advertising on social media platforms.
                    </p>
                  </div>
                </Card>
              </TabsContent>

              {/* Key Terms Tab */}
              <TabsContent value="terms" className="space-y-6">
                <Card className="p-6">
                  <h2 className="text-xl font-semibold mb-6">Payment Terms</h2>
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-secondary/50">
                        <p className="text-sm text-muted-foreground mb-1">Total Amount</p>
                        <p className="text-2xl font-semibold">$8,500</p>
                      </div>
                      <div className="p-4 rounded-lg bg-secondary/50">
                        <p className="text-sm text-muted-foreground mb-1">Payment Structure</p>
                        <p className="font-medium">50% upfront, 50% on completion</p>
                      </div>
                    </div>
                    
                    <div className="p-4 rounded-lg bg-secondary/50">
                      <p className="text-sm text-muted-foreground mb-2">Payment Schedule</p>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Upfront payment</span>
                          <span className="font-medium">$4,250</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Completion payment (Net 30)</span>
                          <span className="font-medium">$4,250</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <h2 className="text-xl font-semibold mb-6">Usage Rights</h2>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-secondary/50">
                      <Clock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium mb-1">Duration</p>
                        <p className="text-sm text-muted-foreground">
                          12 months from campaign launch (April 1, 2026 - April 1, 2027)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 rounded-lg bg-secondary/50">
                      <Globe className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium mb-1">Platforms</p>
                        <p className="text-sm text-muted-foreground">
                          Instagram, TikTok, Glossier.com, email marketing, paid social advertising
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 rounded-lg bg-secondary/50">
                      <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium mb-1">Exclusivity</p>
                        <p className="text-sm text-muted-foreground">
                          No competing skincare brands for 90 days (March 1 - May 30, 2026)
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <h2 className="text-xl font-semibold mb-6">Revision & Approval</h2>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">2 rounds of revisions included</p>
                        <p className="text-sm text-muted-foreground">
                          Additional revisions charged at $500 per round
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">5 business days for approval</p>
                        <p className="text-sm text-muted-foreground">
                          Glossier will review and provide feedback within 5 business days
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              </TabsContent>

              {/* Deliverables Tab */}
              <TabsContent value="deliverables" className="space-y-6">
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold">Progress Tracker</h2>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Overall Progress</p>
                      <p className="text-2xl font-semibold">60%</p>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-secondary rounded-full overflow-hidden mb-6">
                    <div className="h-full bg-primary" style={{ width: '60%' }}></div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    2 of 4 deliverables completed • 13 days until deadline
                  </p>
                </Card>

                <div className="space-y-4">
                  {/* Completed */}
                  <Card className="p-6 border-success/30">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-6 h-6 text-success" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold">Instagram Reel (60-90 sec)</h4>
                          <Badge className="bg-success/10 text-success hover:bg-success/20">Completed</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          Product demo featuring the new skincare line
                        </p>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground">Submitted: Mar 5, 2026</span>
                          <span className="text-success">Approved: Mar 7, 2026</span>
                        </div>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-6 border-success/30">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-6 h-6 text-success" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold">Instagram Stories (3 stories)</h4>
                          <Badge className="bg-success/10 text-success hover:bg-success/20">Completed</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          Daily skincare routine featuring Glossier products
                        </p>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground">Submitted: Mar 8, 2026</span>
                          <span className="text-success">Approved: Mar 9, 2026</span>
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* In Progress */}
                  <Card className="p-6 border-primary/30">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Clock className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold">YouTube Video (10-15 min)</h4>
                          <Badge className="bg-primary/10 text-primary hover:bg-primary/20">In Progress</Badge>
                          <Badge variant="outline" className="text-accent border-accent/30">Due in 13 days</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          In-depth review and tutorial of the skincare line
                        </p>
                        <div className="mb-3">
                          <div className="w-full h-2 bg-secondary rounded-full overflow-hidden mb-1">
                            <div className="h-full bg-primary" style={{ width: '75%' }}></div>
                          </div>
                          <p className="text-xs text-muted-foreground">75% complete</p>
                        </div>
                        <Button size="sm" variant="outline">Update Progress</Button>
                      </div>
                    </div>
                  </Card>

                  {/* Not Started */}
                  <Card className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <FileText className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold">Behind-the-Scenes Content</h4>
                          <Badge variant="outline">Not Started</Badge>
                          <Badge variant="outline" className="text-accent border-accent/30">Due in 13 days</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          B-roll and behind-the-scenes footage for brand's social media
                        </p>
                        <Button size="sm">Start Working</Button>
                      </div>
                    </div>
                  </Card>
                </div>
              </TabsContent>

              {/* Risk Flags Tab */}
              <TabsContent value="risks" className="space-y-6">
                <Card className="p-6 border-accent/30 bg-accent/5">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-accent flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-6 h-6 text-accent-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">Paid Advertising Usage</h3>
                        <Badge className="bg-accent text-accent-foreground">Medium Risk</Badge>
                      </div>
                      <p className="text-muted-foreground mb-4 leading-relaxed">
                        The contract allows Glossier to use your content in <strong>paid advertising</strong> on social media platforms without additional compensation. This is typically worth an extra 20-40% on top of your base rate.
                      </p>
                      <div className="p-4 rounded-lg bg-background mb-4">
                        <p className="text-sm font-medium mb-2">What this means:</p>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          <li>• Your content can be used in Instagram/Facebook ads</li>
                          <li>• No additional payment for ad usage</li>
                          <li>• Industry standard is +30% for paid media rights</li>
                        </ul>
                      </div>
                      <div className="flex gap-3">
                        <Button size="sm" className="gap-2">
                          <Mail className="w-4 h-4" />
                          Request Negotiation
                        </Button>
                        <Button size="sm" variant="outline">Mark as Reviewed</Button>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="p-6 border-warning/30 bg-warning/5">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-warning flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-6 h-6 text-warning-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">90-Day Exclusivity Clause</h3>
                        <Badge className="bg-warning text-warning-foreground">Low Risk</Badge>
                      </div>
                      <p className="text-muted-foreground mb-4 leading-relaxed">
                        You cannot work with competing skincare brands for <strong>90 days</strong> (March 1 - May 30, 2026). Make sure you don't have any existing commitments that conflict with this.
                      </p>
                      <div className="p-4 rounded-lg bg-background mb-4">
                        <p className="text-sm font-medium mb-2">Competing categories defined as:</p>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          <li>• Skincare products and brands</li>
                          <li>• Beauty subscription boxes featuring skincare</li>
                          <li>• Does NOT include makeup, haircare, or wellness</li>
                        </ul>
                      </div>
                      <div className="flex gap-3">
                        <Button size="sm" variant="outline">Mark as Reviewed</Button>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="p-6 border-success/30 bg-success/5">
                  <div className="flex items-start gap-4">
                    <CheckCircle2 className="w-12 h-12 text-success shrink-0" />
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Everything else looks good!</h3>
                      <p className="text-muted-foreground">
                        No other major risks detected. The payment terms, deliverables, and timeline are all reasonable and industry-standard.
                      </p>
                    </div>
                  </div>
                </Card>
              </TabsContent>

              {/* Email Drafts Tab */}
              <TabsContent value="emails" className="space-y-6">
                <Card className="p-6">
                  <div className="flex items-start gap-4 mb-6">
                    <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                      <Mail className="w-6 h-6 text-accent" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Negotiate Paid Media Rights</h3>
                      <p className="text-sm text-muted-foreground">
                        Professionally request additional compensation for paid advertising usage
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="subject1" className="text-sm font-medium mb-2 block">
                        Subject Line
                      </Label>
                      <Input
                        id="subject1"
                        defaultValue="Glossier Spring Campaign - Usage Rights Discussion"
                      />
                    </div>

                    <div>
                      <Label htmlFor="body1" className="text-sm font-medium mb-2 block">
                        Email Body
                      </Label>
                      <Textarea
                        id="body1"
                        rows={12}
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

                    <div className="flex gap-3">
                      <Button className="gap-2">
                        <Mail className="w-4 h-4" />
                        Copy to Clipboard
                      </Button>
                      <Button variant="outline">Customize</Button>
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="flex items-start gap-4 mb-6">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Mail className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Payment Reminder</h3>
                      <p className="text-sm text-muted-foreground">
                        Polite follow-up for overdue payment (currently 7 days late)
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="subject2" className="text-sm font-medium mb-2 block">
                        Subject Line
                      </Label>
                      <Input
                        id="subject2"
                        defaultValue="Following Up: Glossier Spring Campaign - Invoice #1234"
                      />
                    </div>

                    <div>
                      <Label htmlFor="body2" className="text-sm font-medium mb-2 block">
                        Email Body
                      </Label>
                      <Textarea
                        id="body2"
                        rows={10}
                        defaultValue={`Hi [Brand Contact Name],

I hope you're doing well! I wanted to follow up on the payment for the Glossier Spring Campaign completion milestone.

According to our agreement, the final payment of $4,250 was due on March 5, 2026 (Net 30 from February 3rd approval). I haven't received this payment yet, so I wanted to check in and see if there's any issue on my end that needs to be resolved.

Could you please confirm the status of this payment? If there's any additional information or documentation you need from me, I'm happy to provide it.

Thank you for your attention to this matter!

Best regards,
Sarah`}
                      />
                    </div>

                    <div className="flex gap-3">
                      <Button className="gap-2">
                        <Mail className="w-4 h-4" />
                        Copy to Clipboard
                      </Button>
                      <Button variant="outline">Customize</Button>
                    </div>
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
