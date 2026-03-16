import { Link } from "react-router";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Sidebar } from "../components/features/sidebar";
import { Upload, Plus, FileText, DollarSign, AlertTriangle, CheckCircle2, Clock, TrendingUp, Calendar, BarChart3 } from "lucide-react";

export function DashboardPage() {
  const hasDeals = true;

  if (!hasDeals) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 ml-64 flex items-center justify-center p-8">
          <div className="max-w-md text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-secondary mb-6">
              <FileText className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2>No contracts yet</h2>
            <p className="text-muted-foreground mt-2 mb-8">
              Upload your first brand deal to get started. We'll help you understand the terms and negotiate with confidence.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/app/deals/upload">
                <Button className="gap-2">
                  <Upload className="w-4 h-4" />
                  Upload Contract
                </Button>
              </Link>
              <Link to="/app/deals/new">
                <Button variant="outline" className="gap-2">
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
            <div className="flex items-center justify-between mb-10">
              <div>
                <h1>Dashboard</h1>
                <p className="text-muted-foreground mt-1">
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

            {/* Stats Row */}
            <div className="grid md:grid-cols-4 gap-8 mb-12">
              <div className="border-b border-border pb-4">
                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Active Deals</p>
                <p className="text-4xl font-bold tracking-tight">12</p>
                <p className="text-xs text-success mt-2">+3 this month</p>
              </div>
              <div className="border-b border-border pb-4">
                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Total Revenue</p>
                <p className="text-4xl font-bold tracking-tight">$48,500</p>
                <p className="text-xs text-success mt-2">+12% vs last month</p>
              </div>
              <div className="border-b border-border pb-4">
                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Pending Payments</p>
                <p className="text-4xl font-bold tracking-tight">$12,000</p>
                <p className="text-xs text-warning mt-2">3 invoices overdue</p>
              </div>
              <div className="border-b border-border pb-4">
                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Risk Alerts</p>
                <p className="text-4xl font-bold tracking-tight">2</p>
                <p className="text-xs text-muted-foreground mt-2">Review recommended</p>
              </div>
            </div>

            {/* Tabbed Workspace */}
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="mb-8">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="deals">Active Deals</TabsTrigger>
                <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview">
                <div className="space-y-10">
                  {/* Recent Deals */}
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h2>Recent Deals</h2>
                      <Link to="/app/deals/history">
                        <Button variant="ghost" size="sm">View All</Button>
                      </Link>
                    </div>

                    <div className="border-t border-border">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left px-0 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Deal</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Payment</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Due Date</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Progress</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          <tr className="hover:bg-secondary/30 transition-colors cursor-pointer" onClick={() => window.location.href = '/app/deals/1'}>
                            <td className="px-0 py-4">
                              <p className="font-medium text-sm">Glossier Spring Campaign</p>
                              <p className="text-xs text-muted-foreground mt-0.5">4 deliverables pending</p>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-success"></span>
                                <span className="text-xs">Active</span>
                                <Badge variant="outline" className="text-xs text-accent border-accent/30">2 Risks</Badge>
                              </div>
                            </td>
                            <td className="px-4 py-4 font-medium text-sm">$8,500</td>
                            <td className="px-4 py-4 text-xs text-muted-foreground">Mar 25, 2026</td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <div className="w-20 h-1 bg-secondary overflow-hidden">
                                  <div className="h-full bg-primary" style={{ width: '60%' }}></div>
                                </div>
                                <span className="text-xs text-muted-foreground">60%</span>
                              </div>
                            </td>
                          </tr>

                          <tr className="hover:bg-secondary/30 transition-colors cursor-pointer" onClick={() => window.location.href = '/app/deals/2'}>
                            <td className="px-0 py-4">
                              <p className="font-medium text-sm">Nike Sneaker Launch</p>
                              <p className="text-xs text-muted-foreground mt-0.5">Processing complete</p>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-warning"></span>
                                <span className="text-xs">Under Review</span>
                              </div>
                            </td>
                            <td className="px-4 py-4 font-medium text-sm">$15,000</td>
                            <td className="px-4 py-4 text-xs text-muted-foreground">Awaiting signature</td>
                            <td className="px-4 py-4 text-xs text-muted-foreground">—</td>
                          </tr>

                          <tr className="hover:bg-secondary/30 transition-colors cursor-pointer" onClick={() => window.location.href = '/app/deals/3'}>
                            <td className="px-0 py-4">
                              <p className="font-medium text-sm">Sephora Product Review</p>
                              <p className="text-xs text-muted-foreground mt-0.5">Payment received</p>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-muted-foreground"></span>
                                <span className="text-xs">Completed</span>
                                <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                              </div>
                            </td>
                            <td className="px-4 py-4 font-medium text-sm">$3,200</td>
                            <td className="px-4 py-4 text-xs text-muted-foreground">Feb 28, 2026</td>
                            <td className="px-4 py-4 text-xs text-muted-foreground">—</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Bottom Grid */}
                  <div className="grid lg:grid-cols-2 gap-12">
                    {/* Upcoming Deliverables */}
                    <div>
                      <h2 className="mb-6">Upcoming Deliverables</h2>
                      <div className="divide-y divide-border border-t border-border">
                        {[
                          { title: "Instagram Reel + Story", deal: "Glossier Spring Campaign", due: "Mar 15", days: 3, color: "bg-accent" },
                          { title: "YouTube Video (10-15 min)", deal: "Nike Sneaker Launch", due: "Mar 20", days: 8, color: "bg-primary" },
                          { title: "TikTok Series (3 videos)", deal: "Athletic Greens Partnership", due: "Mar 31", days: 19, color: "bg-success" },
                        ].map((item, i) => (
                          <div key={i} className="flex items-center justify-between py-4 hover:bg-secondary/20 transition-colors">
                            <div className="flex items-center gap-4">
                              <div className={`w-1 h-12 ${item.color}`}></div>
                              <div>
                                <p className="font-medium text-sm">{item.title}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{item.deal}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-medium">Due {item.due}</p>
                              <p className="text-xs text-muted-foreground">In {item.days} days</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Action Items */}
                    <div>
                      <h2 className="mb-6">Action Items</h2>
                      <div className="divide-y divide-border border-t border-border">
                        <div className="py-4 border-l-2 border-l-accent pl-4 hover:bg-accent/5 transition-colors">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="font-medium text-sm text-accent">Payment Overdue</p>
                              <p className="text-xs text-muted-foreground mt-1">Glossier invoice is 7 days overdue.</p>
                              <Button size="sm" variant="outline" className="mt-3 text-xs h-7">Send Reminder</Button>
                            </div>
                          </div>
                        </div>

                        <div className="py-4 border-l-2 border-l-warning pl-4 hover:bg-warning/5 transition-colors">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="font-medium text-sm text-warning">Review Contract</p>
                              <p className="text-xs text-muted-foreground mt-1">Nike contract has perpetual usage rights clause.</p>
                              <Button size="sm" variant="outline" className="mt-3 text-xs h-7">Review Now</Button>
                            </div>
                          </div>
                        </div>

                        <div className="py-4 border-l-2 border-l-success pl-4 hover:bg-success/5 transition-colors">
                          <div className="flex items-start gap-3">
                            <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="font-medium text-sm text-success">Ready to Invoice</p>
                              <p className="text-xs text-muted-foreground mt-1">Athletic Greens deliverables completed. Invoice for $5,000.</p>
                              <Button size="sm" variant="outline" className="mt-3 text-xs h-7">Send Invoice</Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Active Deals Tab */}
              <TabsContent value="deals">
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Deal</th>
                        <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Status</th>
                        <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Payment</th>
                        <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Due</th>
                        <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Risks</th>
                        <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Progress</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-white">
                      {[
                        { id: 1, title: "Glossier Spring Campaign", status: "Active", statusColor: "bg-success", payment: "$8,500", due: "Mar 25, 2026", progress: 60, riskFlags: 2 },
                        { id: 2, title: "Nike Sneaker Launch", status: "Under Review", statusColor: "bg-warning", payment: "$15,000", due: "Pending", progress: 0, riskFlags: 1 },
                        { id: 4, title: "Athletic Greens Partnership", status: "Active", statusColor: "bg-success", payment: "$5,000", due: "Mar 31, 2026", progress: 75, riskFlags: 0 },
                        { id: 5, title: "Fenty Beauty Collab", status: "Active", statusColor: "bg-success", payment: "$12,000", due: "Apr 5, 2026", progress: 40, riskFlags: 1 },
                        { id: 6, title: "Dyson Product Review", status: "Negotiating", statusColor: "bg-warning", payment: "$6,500", due: "TBD", progress: 0, riskFlags: 3 },
                      ].map((deal) => (
                        <tr key={deal.id} className="hover:bg-secondary/20 transition-colors cursor-pointer" onClick={() => window.location.href = `/app/deals/${deal.id}`}>
                          <td className="px-6 py-4 font-medium">{deal.title}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${deal.statusColor}`}></span>
                              <span className="text-sm">{deal.status}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-medium">{deal.payment}</td>
                          <td className="px-6 py-4 text-sm text-muted-foreground">{deal.due}</td>
                          <td className="px-6 py-4">
                            {deal.riskFlags > 0 ? (
                              <Badge variant="outline" className="text-xs text-accent border-accent/30">
                                {deal.riskFlags} flag{deal.riskFlags > 1 ? 's' : ''}
                              </Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">None</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {deal.progress > 0 ? (
                              <div className="flex items-center gap-2">
                                <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
                                  <div className="h-full bg-primary rounded-full" style={{ width: `${deal.progress}%` }}></div>
                                </div>
                                <span className="text-sm text-muted-foreground">{deal.progress}%</span>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              {/* Deliverables Tab */}
              <TabsContent value="deliverables">
                <div className="space-y-8">
                  {/* Overdue */}
                  <div>
                    <h3 className="flex items-center gap-2 mb-4">
                      <span className="w-2 h-2 rounded-full bg-accent"></span>
                      Overdue (2)
                    </h3>
                    <div className="border border-border rounded-xl overflow-hidden bg-white divide-y divide-border">
                      {[
                        { title: "Instagram Reel + Story", deal: "Glossier Spring Campaign", overdue: "2 days", due: "Mar 10, 2026" },
                        { title: "Blog Post (800 words)", deal: "Athletic Greens Partnership", overdue: "5 days", due: "Mar 7, 2026" },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between px-6 py-4 border-l-3 border-l-accent">
                          <div>
                            <p className="font-medium text-sm">{item.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{item.deal} · Due: {item.due}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge className="bg-accent/10 text-accent text-xs">Overdue by {item.overdue}</Badge>
                            <Button size="sm" className="h-7 text-xs">Mark Complete</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Due This Week */}
                  <div>
                    <h3 className="flex items-center gap-2 mb-4">
                      <span className="w-2 h-2 rounded-full bg-warning"></span>
                      Due This Week (5)
                    </h3>
                    <div className="border border-border rounded-xl overflow-hidden bg-white divide-y divide-border">
                      {[
                        { title: "YouTube Video (10-15 min)", deal: "Nike Sneaker Launch", due: "Mar 15", days: 3 },
                        { title: "TikTok Series (3 videos)", deal: "Fenty Beauty Collab", due: "Mar 16", days: 4 },
                        { title: "Product Photography", deal: "Dyson Product Review", due: "Mar 17", days: 5 },
                        { title: "Instagram Story Takeover", deal: "Glossier Spring Campaign", due: "Mar 18", days: 6 },
                        { title: "Email Newsletter Feature", deal: "Athletic Greens Partnership", due: "Mar 19", days: 7 },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between px-6 py-4">
                          <div>
                            <p className="font-medium text-sm">{item.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{item.deal}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground">Due {item.due} · In {item.days} days</span>
                            <Button size="sm" variant="outline" className="h-7 text-xs">Mark Complete</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recently Completed */}
                  <div>
                    <h3 className="flex items-center gap-2 mb-4">
                      <span className="w-2 h-2 rounded-full bg-success"></span>
                      Recently Completed (3)
                    </h3>
                    <div className="border border-border rounded-xl overflow-hidden bg-white divide-y divide-border">
                      {[
                        { title: "Product Unboxing Video", deal: "Sephora Product Review", completed: "Mar 8, 2026" },
                        { title: "Instagram Post + Carousel", deal: "Glossier Spring Campaign", completed: "Mar 5, 2026" },
                        { title: "Twitter Thread", deal: "Athletic Greens Partnership", completed: "Mar 2, 2026" },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between px-6 py-4">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-success" />
                            <div>
                              <p className="font-medium text-sm">{item.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{item.deal}</p>
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground">Completed {item.completed}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Analytics Tab */}
              <TabsContent value="analytics">
                <div className="space-y-8">
                  <div className="grid md:grid-cols-3 gap-px bg-border rounded-xl overflow-hidden">
                    <div className="bg-white p-6">
                      <p className="text-sm text-muted-foreground mb-1">Revenue This Month</p>
                      <p className="text-2xl font-bold tracking-tight">$48,500</p>
                      <div className="flex items-center gap-1.5 mt-2">
                        <TrendingUp className="w-3.5 h-3.5 text-success" />
                        <span className="text-xs text-success">+12% vs last month</span>
                      </div>
                    </div>
                    <div className="bg-white p-6">
                      <p className="text-sm text-muted-foreground mb-1">Avg Deal Size</p>
                      <p className="text-2xl font-bold tracking-tight">$7,250</p>
                      <div className="flex items-center gap-1.5 mt-2">
                        <TrendingUp className="w-3.5 h-3.5 text-success" />
                        <span className="text-xs text-success">+8% vs last month</span>
                      </div>
                    </div>
                    <div className="bg-white p-6">
                      <p className="text-sm text-muted-foreground mb-1">Completion Rate</p>
                      <p className="text-2xl font-bold tracking-tight">87%</p>
                      <p className="text-xs text-muted-foreground mt-2">21 of 24 deliverables</p>
                    </div>
                  </div>

                  <div>
                    <h2 className="mb-4">Top Brands by Revenue</h2>
                    <div className="border border-border rounded-xl overflow-hidden">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border bg-secondary/30">
                            <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Brand</th>
                            <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Revenue</th>
                            <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Deals</th>
                            <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Share</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border bg-white">
                          {[
                            { brand: "Nike", amount: "$15,000", deals: 2, pct: 31 },
                            { brand: "Lululemon", amount: "$12,000", deals: 1, pct: 25 },
                            { brand: "Fenty Beauty", amount: "$10,500", deals: 1, pct: 22 },
                            { brand: "Glossier", amount: "$8,500", deals: 1, pct: 17 },
                            { brand: "Sephora", amount: "$3,200", deals: 1, pct: 7 },
                          ].map((brand, i) => (
                            <tr key={i}>
                              <td className="px-6 py-3.5 font-medium text-sm">{brand.brand}</td>
                              <td className="px-6 py-3.5 text-sm">{brand.amount}</td>
                              <td className="px-6 py-3.5 text-sm text-muted-foreground">{brand.deals}</td>
                              <td className="px-6 py-3.5">
                                <div className="flex items-center gap-2">
                                  <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                                    <div className="h-full bg-primary rounded-full" style={{ width: `${brand.pct}%` }}></div>
                                  </div>
                                  <span className="text-xs text-muted-foreground">{brand.pct}%</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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