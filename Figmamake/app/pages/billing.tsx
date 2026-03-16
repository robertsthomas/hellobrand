import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Sidebar } from "../components/features/sidebar";
import { CheckCircle2, CreditCard, Download } from "lucide-react";

export function BillingPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      
      <div className="flex-1 ml-64">
        <div className="p-8">
          <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="mb-10">
              <h1>Billing</h1>
              <p className="text-muted-foreground mt-1">Manage your subscription and payment methods</p>
            </div>

            {/* Current Plan */}
            <section className="mb-10 pb-10 border-b border-border">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2>Pro Plan</h2>
                    <Badge className="bg-primary/10 text-primary text-xs">Current Plan</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">Unlimited contract reviews and advanced features</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold tracking-tight">$49</p>
                  <p className="text-xs text-muted-foreground">/month</p>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-px bg-border rounded-xl overflow-hidden mb-6">
                <div className="bg-white p-4">
                  <p className="text-xs text-muted-foreground mb-0.5">Billing Period</p>
                  <p className="font-medium text-sm">Monthly</p>
                </div>
                <div className="bg-white p-4">
                  <p className="text-xs text-muted-foreground mb-0.5">Next Billing Date</p>
                  <p className="font-medium text-sm">April 1, 2026</p>
                </div>
                <div className="bg-white p-4">
                  <p className="text-xs text-muted-foreground mb-0.5">Status</p>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                    <p className="font-medium text-sm">Active</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm">Change Plan</Button>
                <Button variant="outline" size="sm">Cancel Subscription</Button>
              </div>
            </section>

            {/* Payment Method */}
            <section className="mb-10 pb-10 border-b border-border">
              <h2 className="mb-6">Payment Method</h2>
              <div className="flex items-center justify-between py-4 border-b border-border mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Visa ending in 4242</p>
                    <p className="text-xs text-muted-foreground">Expires 12/2027</p>
                  </div>
                </div>
                <Badge className="bg-success/10 text-success text-xs">Default</Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">Update Payment Method</Button>
                <Button variant="outline" size="sm">Add Payment Method</Button>
              </div>
            </section>

            {/* Billing History */}
            <section className="mb-10 pb-10 border-b border-border">
              <div className="flex items-center justify-between mb-6">
                <h2>Billing History</h2>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="w-4 h-4" />
                  Download All
                </Button>
              </div>

              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="text-left px-5 py-3 text-sm font-medium text-muted-foreground">Date</th>
                      <th className="text-left px-5 py-3 text-sm font-medium text-muted-foreground">Invoice</th>
                      <th className="text-left px-5 py-3 text-sm font-medium text-muted-foreground">Status</th>
                      <th className="text-right px-5 py-3 text-sm font-medium text-muted-foreground">Amount</th>
                      <th className="text-right px-5 py-3 text-sm font-medium text-muted-foreground"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-white">
                    {[
                      { date: "Mar 1, 2026", amount: "$49.00", status: "paid", invoice: "INV-2026-03" },
                      { date: "Feb 1, 2026", amount: "$49.00", status: "paid", invoice: "INV-2026-02" },
                      { date: "Jan 1, 2026", amount: "$49.00", status: "paid", invoice: "INV-2026-01" },
                      { date: "Dec 1, 2025", amount: "$49.00", status: "paid", invoice: "INV-2025-12" },
                      { date: "Nov 1, 2025", amount: "$0.00", status: "trial", invoice: "Trial Period" },
                    ].map((inv, i) => (
                      <tr key={i}>
                        <td className="px-5 py-3 text-sm">{inv.date}</td>
                        <td className="px-5 py-3 text-sm text-muted-foreground">{inv.invoice}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${inv.status === "paid" ? "bg-success" : "bg-muted-foreground"}`}></span>
                            <span className="text-sm capitalize">{inv.status}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-sm text-right font-medium">{inv.amount}</td>
                        <td className="px-5 py-3 text-right">
                          {inv.status === "paid" && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
                              <Download className="w-3 h-3" />
                              PDF
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Usage Stats */}
            <section>
              <h2 className="mb-6">Usage This Month</h2>
              <div className="grid md:grid-cols-3 gap-px bg-border rounded-xl overflow-hidden">
                <div className="bg-white p-5">
                  <p className="text-xs text-muted-foreground mb-1">Contracts Reviewed</p>
                  <p className="text-2xl font-bold tracking-tight">18</p>
                  <p className="text-xs text-muted-foreground mt-1">Unlimited on Pro plan</p>
                </div>
                <div className="bg-white p-5">
                  <p className="text-xs text-muted-foreground mb-1">Emails Generated</p>
                  <p className="text-2xl font-bold tracking-tight">42</p>
                  <p className="text-xs text-muted-foreground mt-1">Unlimited on Pro plan</p>
                </div>
                <div className="bg-white p-5">
                  <p className="text-xs text-muted-foreground mb-1">Active Deals</p>
                  <p className="text-2xl font-bold tracking-tight">12</p>
                  <p className="text-xs text-muted-foreground mt-1">Unlimited on Pro plan</p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
