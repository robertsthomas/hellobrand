import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Sidebar } from "../components/features/sidebar";
import { TrendingUp, DollarSign, FileText, Calendar, Download } from "lucide-react";

export function AnalyticsPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      
      <div className="flex-1 ml-64">
        <div className="p-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-semibold mb-2">Analytics</h1>
                <p className="text-muted-foreground">
                  Track your creator business performance
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  Last 30 days
                </Button>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="w-4 h-4" />
                  Export
                </Button>
              </div>
            </div>

            {/* Key Metrics */}
            <div className="grid md:grid-cols-4 gap-6 mb-8">
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-success" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Revenue</p>
                    <p className="text-2xl font-semibold">$48,500</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <TrendingUp className="w-4 h-4 text-success" />
                  <span className="text-success">+12%</span>
                  <span className="text-muted-foreground">vs last month</span>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active Deals</p>
                    <p className="text-2xl font-semibold">12</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <TrendingUp className="w-4 h-4 text-success" />
                  <span className="text-success">+3</span>
                  <span className="text-muted-foreground">this month</span>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Deal Size</p>
                    <p className="text-2xl font-semibold">$7,250</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <TrendingUp className="w-4 h-4 text-success" />
                  <span className="text-success">+8%</span>
                  <span className="text-muted-foreground">vs last month</span>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-warning" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pending Payments</p>
                    <p className="text-2xl font-semibold">$12,000</p>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  3 invoices overdue
                </div>
              </Card>
            </div>

            {/* Revenue Over Time */}
            <Card className="p-6 mb-8">
              <h2 className="text-xl font-semibold mb-6">Revenue Over Time</h2>
              <div className="h-64 flex items-end gap-4">
                {[
                  { month: "Jan", amount: 12000 },
                  { month: "Feb", amount: 18500 },
                  { month: "Mar", amount: 15200 },
                  { month: "Apr", amount: 22800 },
                  { month: "May", amount: 19600 },
                  { month: "Jun", amount: 28400 },
                ].map((data, i) => {
                  const maxAmount = 30000;
                  const height = (data.amount / maxAmount) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2">
                      <div className="text-sm font-semibold">${(data.amount / 1000).toFixed(0)}k</div>
                      <div
                        className="w-full bg-primary rounded-t-lg hover:bg-primary/80 transition-colors cursor-pointer"
                        style={{ height: `${height}%` }}
                      ></div>
                      <div className="text-sm text-muted-foreground">{data.month}</div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Top Brands & Deal Status */}
            <div className="grid lg:grid-cols-2 gap-6 mb-8">
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-6">Top Brands by Revenue</h2>
                <div className="space-y-4">
                  {[
                    { brand: "Nike", amount: "$15,000", percentage: 31 },
                    { brand: "Glossier", amount: "$8,500", percentage: 17 },
                    { brand: "Lululemon", amount: "$12,000", percentage: 25 },
                    { brand: "Fenty Beauty", amount: "$10,500", percentage: 22 },
                    { brand: "Sephora", amount: "$3,200", percentage: 7 },
                  ].map((brand, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{brand.brand}</span>
                        <span className="text-sm text-muted-foreground">{brand.amount}</span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${brand.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-6">Deal Status Breakdown</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-success/5 border border-success/20">
                    <div>
                      <p className="font-semibold">Active Deals</p>
                      <p className="text-sm text-muted-foreground">Currently in progress</p>
                    </div>
                    <p className="text-3xl font-semibold">12</p>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-warning/5 border border-warning/20">
                    <div>
                      <p className="font-semibold">Under Review</p>
                      <p className="text-sm text-muted-foreground">Awaiting approval</p>
                    </div>
                    <p className="text-3xl font-semibold">3</p>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                    <div>
                      <p className="font-semibold">Completed</p>
                      <p className="text-sm text-muted-foreground">Finished this quarter</p>
                    </div>
                    <p className="text-3xl font-semibold">9</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Payment Timeline */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-6">Upcoming Payments</h2>
              <div className="space-y-4">
                {[
                  { brand: "Nike", amount: "$7,500", date: "Mar 20, 2026", status: "pending" },
                  { brand: "Athletic Greens", amount: "$2,500", date: "Mar 25, 2026", status: "pending" },
                  { brand: "Glossier", amount: "$4,250", date: "Apr 5, 2026", status: "overdue" },
                  { brand: "Lululemon", amount: "$6,000", date: "Apr 15, 2026", status: "scheduled" },
                ].map((payment, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-secondary/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-2 h-12 rounded-full bg-primary"></div>
                      <div>
                        <p className="font-semibold">{payment.brand}</p>
                        <p className="text-sm text-muted-foreground">{payment.date}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold">{payment.amount}</p>
                      {payment.status === "overdue" && (
                        <p className="text-sm text-accent">Overdue</p>
                      )}
                      {payment.status === "pending" && (
                        <p className="text-sm text-warning">Pending</p>
                      )}
                      {payment.status === "scheduled" && (
                        <p className="text-sm text-muted-foreground">Scheduled</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}