import { Link } from "react-router";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Sidebar } from "../components/features/sidebar";
import { Upload, Plus, FileText, DollarSign, AlertTriangle, CheckCircle2, Clock, TrendingUp, Calendar, BarChart3 } from "lucide-react";

export function DashboardPage() {
  // Toggle this to show empty state
  const hasDeals = true;

  if (!hasDeals) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 ml-64 flex items-center justify-center p-8">
          <div className="max-w-md text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-secondary mb-6">
              <FileText className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-semibold mb-3">No contracts yet</h2>
            <p className="text-muted-foreground mb-8">
              Upload your first brand deal to get started. We'll help you understand the terms and negotiate with confidence.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/app/deals/upload">
                <Button className="gap-2 rounded-full">
                  <Upload className="w-4 h-4" />
                  Upload Contract
                </Button>
              </Link>
              <Link to="/app/deals/new">
                <Button variant="outline" className="gap-2 rounded-full">
                  <Plus className="w-4 h-4" />
                  Create Deal Manually
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      
      <div className="flex-1 ml-64">
        <div className="p-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-semibold mb-2">Dashboard</h1>
                <p className="text-muted-foreground">
                  Welcome back, Sarah. Here's what's happening with your deals.
                </p>
              </div>
              <Link to="/app/deals/upload">
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  New Deal
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="grid md:grid-cols-4 gap-6 mb-8">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">Active Deals</p>
                  <FileText className="w-4 h-4 text-muted-foreground" />
                </div>
                <p className="text-3xl font-semibold">12</p>
                <p className="text-xs text-success mt-1">+3 this month</p>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                </div>
                <p className="text-3xl font-semibold">$48,500</p>
                <p className="text-xs text-success mt-1">+12% vs last month</p>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">Pending Payments</p>
                  <Clock className="w-4 h-4 text-muted-foreground" />
                </div>
                <p className="text-3xl font-semibold">$12,000</p>
                <p className="text-xs text-warning mt-1">3 invoices overdue</p>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">Risk Alerts</p>
                  <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                </div>
                <p className="text-3xl font-semibold">2</p>
                <p className="text-xs text-muted-foreground mt-1">Review recommended</p>
              </Card>
            </div>

            {/* Tabbed Workspace */}
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="mb-6">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="deals">Active Deals</TabsTrigger>
                <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview">
                <div className="space-y-6">
                  {/* Recent Deals */}
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-semibold">Recent Deals</h2>
                      <Link to="/app/deals/history">
                        <Button variant="ghost" size="sm">View All</Button>
                      </Link>
                    </div>

                    <div className="space-y-3">
                      <Link to="/app/deals/1">
                        <Card className="p-6 hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="font-semibold">Glossier Spring Campaign</h3>
                                <Badge className="bg-success/10 text-success hover:bg-success/20">Active</Badge>
                                <Badge variant="outline" className="text-accent border-accent/30">2 Risk Flags</Badge>
                              </div>
                              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                                <span>Payment: $8,500</span>
                                <span>Due: Mar 25, 2026</span>
                                <span>4 deliverables pending</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium text-muted-foreground mb-1">Progress</p>
                              <div className="flex items-center gap-2">
                                <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden">
                                  <div className="h-full bg-primary" style={{ width: '60%' }}></div>
                                </div>
                                <span className="text-sm text-muted-foreground">60%</span>
                              </div>
                            </div>
                          </div>
                        </Card>
                      </Link>

                      <Link to="/app/deals/2">
                        <Card className="p-6 hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="font-semibold">Nike Sneaker Launch</h3>
                                <Badge className="bg-warning/10 text-warning hover:bg-warning/20">Under Review</Badge>
                              </div>
                              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                                <span>Payment: $15,000</span>
                                <span>Contract uploaded today</span>
                                <span>Processing complete</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium text-muted-foreground mb-1">Status</p>
                              <p className="text-sm">Awaiting signature</p>
                            </div>
                          </div>
                        </Card>
                      </Link>

                      <Link to="/app/deals/3">
                        <Card className="p-6 hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="font-semibold">Sephora Product Review</h3>
                                <Badge className="bg-muted text-muted-foreground hover:bg-muted">Completed</Badge>
                              </div>
                              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                                <span>Payment: $3,200</span>
                                <span>Completed: Feb 28, 2026</span>
                                <span>Payment received</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <CheckCircle2 className="w-5 h-5 text-success" />
                            </div>
                          </div>
                        </Card>
                      </Link>
                    </div>
                  </div>

                  {/* Bottom Grid */}
                  <div className="grid lg:grid-cols-2 gap-6">
                    <Card className="p-6">
                      <h2 className="text-xl font-semibold mb-6">Upcoming Deliverables</h2>
                      <div className="space-y-4">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5 text-accent" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium mb-1">Instagram Reel + Story</h4>
                            <p className="text-sm text-muted-foreground mb-2">Glossier Spring Campaign</p>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">Due Mar 15</Badge>
                              <span className="text-xs text-muted-foreground">In 3 days</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium mb-1">YouTube Video (10-15 min)</h4>
                            <p className="text-sm text-muted-foreground mb-2">Nike Sneaker Launch</p>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">Due Mar 20</Badge>
                              <span className="text-xs text-muted-foreground">In 8 days</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5 text-success" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium mb-1">TikTok Series (3 videos)</h4>
                            <p className="text-sm text-muted-foreground mb-2">Athletic Greens Partnership</p>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">Due Mar 31</Badge>
                              <span className="text-xs text-muted-foreground">In 19 days</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>

                    <Card className="p-6">
                      <h2 className="text-xl font-semibold mb-6">Action Items</h2>
                      <div className="space-y-4">
                        <div className="flex items-start gap-4 p-4 rounded-lg bg-accent/5 border border-accent/20">
                          <AlertTriangle className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <h4 className="font-medium mb-1 text-accent">Payment Overdue</h4>
                            <p className="text-sm text-muted-foreground mb-2">
                              Glossier invoice is 7 days overdue. Consider sending a payment reminder.
                            </p>
                            <Button size="sm" variant="outline" className="text-xs">
                              Send Reminder Email
                            </Button>
                          </div>
                        </div>

                        <div className="flex items-start gap-4 p-4 rounded-lg bg-warning/5 border border-warning/20">
                          <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <h4 className="font-medium mb-1 text-warning">Review Contract</h4>
                            <p className="text-sm text-muted-foreground mb-2">
                              Nike contract has perpetual usage rights clause. Review before signing.
                            </p>
                            <Button size="sm" variant="outline" className="text-xs">
                              Review Now
                            </Button>
                          </div>
                        </div>

                        <div className="flex items-start gap-4 p-4 rounded-lg bg-success/5 border border-success/20">
                          <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <h4 className="font-medium mb-1 text-success">Ready to Invoice</h4>
                            <p className="text-sm text-muted-foreground mb-2">
                              Athletic Greens deliverables completed. Send invoice for $5,000.
                            </p>
                            <Button size="sm" variant="outline" className="text-xs">
                              Send Invoice
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              {/* Active Deals Tab */}
              <TabsContent value="deals">
                <div className="space-y-3">
                  {[
                    {
                      id: 1,
                      title: "Glossier Spring Campaign",
                      status: "Active",
                      statusColor: "success",
                      payment: "$8,500",
                      due: "Mar 25, 2026",
                      deliverables: "4 deliverables pending",
                      progress: 60,
                      riskFlags: 2
                    },
                    {
                      id: 2,
                      title: "Nike Sneaker Launch",
                      status: "Under Review",
                      statusColor: "warning",
                      payment: "$15,000",
                      due: "Contract uploaded today",
                      deliverables: "Processing complete",
                      progress: 0,
                      riskFlags: 1
                    },
                    {
                      id: 4,
                      title: "Athletic Greens Partnership",
                      status: "Active",
                      statusColor: "success",
                      payment: "$5,000",
                      due: "Mar 31, 2026",
                      deliverables: "3 deliverables remaining",
                      progress: 75,
                      riskFlags: 0
                    },
                    {
                      id: 5,
                      title: "Fenty Beauty Collab",
                      status: "Active",
                      statusColor: "success",
                      payment: "$12,000",
                      due: "Apr 5, 2026",
                      deliverables: "2 deliverables pending",
                      progress: 40,
                      riskFlags: 1
                    },
                    {
                      id: 6,
                      title: "Dyson Product Review",
                      status: "Negotiating",
                      statusColor: "warning",
                      payment: "$6,500",
                      due: "Terms under review",
                      deliverables: "Not started",
                      progress: 0,
                      riskFlags: 3
                    }
                  ].map((deal) => (
                    <Link key={deal.id} to={`/app/deals/${deal.id}`}>
                      <Card className="p-6 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold">{deal.title}</h3>
                              <Badge className={`bg-${deal.statusColor}/10 text-${deal.statusColor} hover:bg-${deal.statusColor}/20`}>
                                {deal.status}
                              </Badge>
                              {deal.riskFlags > 0 && (
                                <Badge variant="outline" className="text-accent border-accent/30">
                                  {deal.riskFlags} Risk Flag{deal.riskFlags > 1 ? 's' : ''}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-6 text-sm text-muted-foreground">
                              <span>Payment: {deal.payment}</span>
                              <span>Due: {deal.due}</span>
                              <span>{deal.deliverables}</span>
                            </div>
                          </div>
                          {deal.progress > 0 && (
                            <div className="text-right">
                              <p className="text-sm font-medium text-muted-foreground mb-1">Progress</p>
                              <div className="flex items-center gap-2">
                                <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden">
                                  <div className="h-full bg-primary" style={{ width: `${deal.progress}%` }}></div>
                                </div>
                                <span className="text-sm text-muted-foreground">{deal.progress}%</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </TabsContent>

              {/* Deliverables Tab */}
              <TabsContent value="deliverables">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-accent" />
                      Overdue (2)
                    </h3>
                    <div className="space-y-3">
                      <Card className="p-6 border-l-4 border-l-accent">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold mb-1">Instagram Reel + Story</h4>
                            <p className="text-sm text-muted-foreground mb-2">Glossier Spring Campaign</p>
                            <div className="flex items-center gap-2">
                              <Badge className="bg-accent/10 text-accent">Overdue by 2 days</Badge>
                              <span className="text-xs text-muted-foreground">Due: Mar 10, 2026</span>
                            </div>
                          </div>
                          <Button size="sm">Mark Complete</Button>
                        </div>
                      </Card>

                      <Card className="p-6 border-l-4 border-l-accent">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold mb-1">Blog Post (800 words)</h4>
                            <p className="text-sm text-muted-foreground mb-2">Athletic Greens Partnership</p>
                            <div className="flex items-center gap-2">
                              <Badge className="bg-accent/10 text-accent">Overdue by 5 days</Badge>
                              <span className="text-xs text-muted-foreground">Due: Mar 7, 2026</span>
                            </div>
                          </div>
                          <Button size="sm">Mark Complete</Button>
                        </div>
                      </Card>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-warning" />
                      Due This Week (5)
                    </h3>
                    <div className="space-y-3">
                      {[
                        { title: "YouTube Video (10-15 min)", deal: "Nike Sneaker Launch", due: "Mar 15", days: 3 },
                        { title: "TikTok Series (3 videos)", deal: "Fenty Beauty Collab", due: "Mar 16", days: 4 },
                        { title: "Product Photography", deal: "Dyson Product Review", due: "Mar 17", days: 5 },
                        { title: "Instagram Story Takeover", deal: "Glossier Spring Campaign", due: "Mar 18", days: 6 },
                        { title: "Email Newsletter Feature", deal: "Athletic Greens Partnership", due: "Mar 19", days: 7 }
                      ].map((item, i) => (
                        <Card key={i} className="p-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-semibold mb-1">{item.title}</h4>
                              <p className="text-sm text-muted-foreground mb-2">{item.deal}</p>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">Due {item.due}</Badge>
                                <span className="text-xs text-muted-foreground">In {item.days} days</span>
                              </div>
                            </div>
                            <Button size="sm" variant="outline">Mark Complete</Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-success" />
                      Recently Completed (3)
                    </h3>
                    <div className="space-y-3">
                      {[
                        { title: "Product Unboxing Video", deal: "Sephora Product Review", completed: "Mar 8, 2026" },
                        { title: "Instagram Post + Carousel", deal: "Glossier Spring Campaign", completed: "Mar 5, 2026" },
                        { title: "Twitter Thread", deal: "Athletic Greens Partnership", completed: "Mar 2, 2026" }
                      ].map((item, i) => (
                        <Card key={i} className="p-6 bg-success/5">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold">{item.title}</h4>
                                <CheckCircle2 className="w-4 h-4 text-success" />
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">{item.deal}</p>
                              <span className="text-xs text-muted-foreground">Completed: {item.completed}</span>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Analytics Tab */}
              <TabsContent value="analytics">
                <div className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <Card className="p-6">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <TrendingUp className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold">Revenue Trend</h3>
                          <p className="text-sm text-muted-foreground">Last 6 months</p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        {[
                          { month: "Oct 2025", amount: "$12,000", percent: 40 },
                          { month: "Nov 2025", amount: "$18,500", percent: 60 },
                          { month: "Dec 2025", amount: "$25,000", percent: 80 },
                          { month: "Jan 2026", amount: "$32,000", percent: 100 },
                          { month: "Feb 2026", amount: "$28,000", percent: 90 },
                          { month: "Mar 2026", amount: "$48,500", percent: 100 }
                        ].map((item, i) => (
                          <div key={i}>
                            <div className="flex items-center justify-between text-sm mb-2">
                              <span className="text-muted-foreground">{item.month}</span>
                              <span className="font-semibold">{item.amount}</span>
                            </div>
                            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                              <div className="h-full bg-primary transition-all" style={{ width: `${item.percent}%` }}></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>

                    <Card className="p-6">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                          <BarChart3 className="w-5 h-5 text-accent" />
                        </div>
                        <div>
                          <h3 className="font-semibold">Deal Performance</h3>
                          <p className="text-sm text-muted-foreground">This year</p>
                        </div>
                      </div>
                      <div className="space-y-6">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-muted-foreground">Completed on time</span>
                            <span className="text-sm font-semibold">85%</span>
                          </div>
                          <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                            <div className="h-full bg-success" style={{ width: '85%' }}></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-muted-foreground">Average deal value</span>
                            <span className="text-sm font-semibold">$8,750</span>
                          </div>
                          <p className="text-xs text-success">+18% vs last year</p>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-muted-foreground">Total deals closed</span>
                            <span className="text-sm font-semibold">24</span>
                          </div>
                          <p className="text-xs text-success">+6 vs last year</p>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-muted-foreground">Payment collection rate</span>
                            <span className="text-sm font-semibold">92%</span>
                          </div>
                          <p className="text-xs text-muted-foreground">3 invoices pending</p>
                        </div>
                      </div>
                    </Card>
                  </div>

                  <Card className="p-6">
                    <h3 className="font-semibold mb-6">Top Brand Partners</h3>
                    <div className="space-y-4">
                      {[
                        { brand: "Glossier", deals: 8, revenue: "$42,000", growth: "+12%" },
                        { brand: "Nike", deals: 5, revenue: "$38,500", growth: "+25%" },
                        { brand: "Sephora", deals: 12, revenue: "$35,200", growth: "+8%" },
                        { brand: "Fenty Beauty", deals: 6, revenue: "$28,000", growth: "+15%" },
                        { brand: "Athletic Greens", deals: 10, revenue: "$22,500", growth: "+20%" }
                      ].map((partner, i) => (
                        <div key={i} className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-primary/30 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-semibold">
                              {partner.brand[0]}
                            </div>
                            <div>
                              <h4 className="font-semibold">{partner.brand}</h4>
                              <p className="text-sm text-muted-foreground">{partner.deals} deals</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{partner.revenue}</p>
                            <p className="text-sm text-success">{partner.growth}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}