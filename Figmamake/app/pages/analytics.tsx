import { Button } from "../components/ui/button";
import { Sidebar } from "../components/features/sidebar";
import { TrendingUp, DollarSign, Download } from "lucide-react";

export function AnalyticsPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      
      <div className="flex-1 ml-64">
        <div className="p-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-10">
              <div>
                <h1>Analytics</h1>
                <p className="text-muted-foreground mt-1">Track your creator business performance</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">Last 30 days</Button>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="w-4 h-4" />
                  Export
                </Button>
              </div>
            </div>

            {/* Key Metrics */}
            <div className="grid md:grid-cols-4 gap-px bg-border rounded-xl overflow-hidden mb-10">
              <div className="bg-white p-6">
                <p className="text-sm text-muted-foreground mb-1">Total Revenue</p>
                <p className="text-3xl font-bold tracking-tight">$48,500</p>
                <div className="flex items-center gap-1.5 mt-2">
                  <TrendingUp className="w-3.5 h-3.5 text-success" />
                  <span className="text-xs text-success">+12% vs last month</span>
                </div>
              </div>
              <div className="bg-white p-6">
                <p className="text-sm text-muted-foreground mb-1">Active Deals</p>
                <p className="text-3xl font-bold tracking-tight">12</p>
                <div className="flex items-center gap-1.5 mt-2">
                  <TrendingUp className="w-3.5 h-3.5 text-success" />
                  <span className="text-xs text-success">+3 this month</span>
                </div>
              </div>
              <div className="bg-white p-6">
                <p className="text-sm text-muted-foreground mb-1">Avg Deal Size</p>
                <p className="text-3xl font-bold tracking-tight">$7,250</p>
                <div className="flex items-center gap-1.5 mt-2">
                  <TrendingUp className="w-3.5 h-3.5 text-success" />
                  <span className="text-xs text-success">+8% vs last month</span>
                </div>
              </div>
              <div className="bg-white p-6">
                <p className="text-sm text-muted-foreground mb-1">Pending Payments</p>
                <p className="text-3xl font-bold tracking-tight">$12,000</p>
                <p className="text-xs text-muted-foreground mt-2">3 invoices overdue</p>
              </div>
            </div>

            {/* Revenue Bar Chart */}
            <div className="mb-10">
              <h2 className="mb-6">Revenue Over Time</h2>
              <div className="border border-border rounded-xl bg-white p-6">
                <div className="h-56 flex items-end gap-6">
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
                        <div className="text-xs font-medium text-muted-foreground">${(data.amount / 1000).toFixed(0)}k</div>
                        <div
                          className="w-full bg-primary rounded-md hover:bg-primary/80 transition-colors cursor-pointer"
                          style={{ height: `${height}%` }}
                        ></div>
                        <div className="text-xs text-muted-foreground">{data.month}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-8 mb-10">
              {/* Top Brands */}
              <div>
                <h2 className="mb-4">Top Brands by Revenue</h2>
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        <th className="text-left px-5 py-3 text-sm font-medium text-muted-foreground">Brand</th>
                        <th className="text-right px-5 py-3 text-sm font-medium text-muted-foreground">Revenue</th>
                        <th className="text-right px-5 py-3 text-sm font-medium text-muted-foreground">Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-white">
                      {[
                        { brand: "Nike", amount: "$15,000", pct: 31 },
                        { brand: "Lululemon", amount: "$12,000", pct: 25 },
                        { brand: "Fenty Beauty", amount: "$10,500", pct: 22 },
                        { brand: "Glossier", amount: "$8,500", pct: 17 },
                        { brand: "Sephora", amount: "$3,200", pct: 7 },
                      ].map((brand, i) => (
                        <tr key={i}>
                          <td className="px-5 py-3 font-medium text-sm">{brand.brand}</td>
                          <td className="px-5 py-3 text-sm text-right">{brand.amount}</td>
                          <td className="px-5 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full" style={{ width: `${brand.pct}%` }}></div>
                              </div>
                              <span className="text-xs text-muted-foreground w-8 text-right">{brand.pct}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Deal Status */}
              <div>
                <h2 className="mb-4">Deal Status Breakdown</h2>
                <div className="border border-border rounded-xl overflow-hidden bg-white divide-y divide-border">
                  <div className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full bg-success"></span>
                      <div>
                        <p className="font-medium text-sm">Active Deals</p>
                        <p className="text-xs text-muted-foreground">Currently in progress</p>
                      </div>
                    </div>
                    <p className="text-2xl font-bold">12</p>
                  </div>
                  <div className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full bg-warning"></span>
                      <div>
                        <p className="font-medium text-sm">Under Review</p>
                        <p className="text-xs text-muted-foreground">Awaiting approval</p>
                      </div>
                    </div>
                    <p className="text-2xl font-bold">3</p>
                  </div>
                  <div className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full bg-muted-foreground"></span>
                      <div>
                        <p className="font-medium text-sm">Completed</p>
                        <p className="text-xs text-muted-foreground">Finished this quarter</p>
                      </div>
                    </div>
                    <p className="text-2xl font-bold">9</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Upcoming Payments */}
            <div>
              <h2 className="mb-4">Upcoming Payments</h2>
              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Brand</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Due Date</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Status</th>
                      <th className="text-right px-6 py-3 text-sm font-medium text-muted-foreground">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-white">
                    {[
                      { brand: "Nike", amount: "$7,500", date: "Mar 20, 2026", status: "pending" },
                      { brand: "Athletic Greens", amount: "$2,500", date: "Mar 25, 2026", status: "pending" },
                      { brand: "Glossier", amount: "$4,250", date: "Apr 5, 2026", status: "overdue" },
                      { brand: "Lululemon", amount: "$6,000", date: "Apr 15, 2026", status: "scheduled" },
                    ].map((payment, i) => (
                      <tr key={i}>
                        <td className="px-6 py-3.5 font-medium text-sm">{payment.brand}</td>
                        <td className="px-6 py-3.5 text-sm text-muted-foreground">{payment.date}</td>
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${
                              payment.status === "overdue" ? "bg-accent" :
                              payment.status === "pending" ? "bg-warning" : "bg-muted-foreground"
                            }`}></span>
                            <span className="text-sm capitalize">{payment.status}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-sm text-right font-medium">{payment.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
