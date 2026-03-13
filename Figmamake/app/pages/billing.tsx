import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Sidebar } from "../components/features/sidebar";
import { CheckCircle2, CreditCard, Download, AlertCircle } from "lucide-react";

export function BillingPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      
      <div className="flex-1 ml-64">
        <div className="p-8">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-semibold mb-2">Billing</h1>
              <p className="text-muted-foreground">
                Manage your subscription and payment methods
              </p>
            </div>

            {/* Current Plan */}
            <Card className="p-6 mb-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-xl font-semibold">Pro Plan</h2>
                    <Badge className="bg-primary/10 text-primary">Current Plan</Badge>
                  </div>
                  <p className="text-muted-foreground">
                    Unlimited contract reviews and advanced features
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-semibold">$49</p>
                  <p className="text-sm text-muted-foreground">/month</p>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 rounded-lg bg-secondary/50">
                  <p className="text-sm text-muted-foreground mb-1">Billing Period</p>
                  <p className="font-medium">Monthly</p>
                </div>
                <div className="p-4 rounded-lg bg-secondary/50">
                  <p className="text-sm text-muted-foreground mb-1">Next Billing Date</p>
                  <p className="font-medium">April 1, 2026</p>
                </div>
                <div className="p-4 rounded-lg bg-secondary/50">
                  <p className="text-sm text-muted-foreground mb-1">Status</p>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-success" />
                    <p className="font-medium">Active</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline">Change Plan</Button>
                <Button variant="outline">Cancel Subscription</Button>
              </div>
            </Card>

            {/* Payment Method */}
            <Card className="p-6 mb-6">
              <h2 className="text-xl font-semibold mb-6">Payment Method</h2>
              <div className="flex items-center justify-between p-4 rounded-lg border border-border mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-medium">Visa ending in 4242</p>
                    <p className="text-sm text-muted-foreground">Expires 12/2027</p>
                  </div>
                </div>
                <Badge className="bg-success/10 text-success hover:bg-success/20">Default</Badge>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" size="sm">Update Payment Method</Button>
                <Button variant="outline" size="sm">Add Payment Method</Button>
              </div>
            </Card>

            {/* Billing History */}
            <Card className="p-6 mb-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Billing History</h2>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="w-4 h-4" />
                  Download All
                </Button>
              </div>

              <div className="space-y-3">
                {[
                  { date: "Mar 1, 2026", amount: "$49.00", status: "paid", invoice: "INV-2026-03" },
                  { date: "Feb 1, 2026", amount: "$49.00", status: "paid", invoice: "INV-2026-02" },
                  { date: "Jan 1, 2026", amount: "$49.00", status: "paid", invoice: "INV-2026-01" },
                  { date: "Dec 1, 2025", amount: "$49.00", status: "paid", invoice: "INV-2025-12" },
                  { date: "Nov 1, 2025", amount: "$0.00", status: "trial", invoice: "Trial Period" },
                ].map((invoice, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-secondary/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="font-medium">{invoice.date}</p>
                        <p className="text-sm text-muted-foreground">{invoice.invoice}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="font-semibold">{invoice.amount}</p>
                      {invoice.status === "paid" && (
                        <Badge className="bg-success/10 text-success hover:bg-success/20">Paid</Badge>
                      )}
                      {invoice.status === "trial" && (
                        <Badge variant="outline">Trial</Badge>
                      )}
                      {invoice.status === "paid" && (
                        <Button size="sm" variant="ghost" className="gap-2">
                          <Download className="w-4 h-4" />
                          PDF
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Usage Stats */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-6">Usage This Month</h2>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-secondary/50">
                  <p className="text-sm text-muted-foreground mb-1">Contracts Reviewed</p>
                  <p className="text-2xl font-semibold">18</p>
                  <p className="text-xs text-muted-foreground mt-1">Unlimited on Pro plan</p>
                </div>
                <div className="p-4 rounded-lg bg-secondary/50">
                  <p className="text-sm text-muted-foreground mb-1">Emails Generated</p>
                  <p className="text-2xl font-semibold">42</p>
                  <p className="text-xs text-muted-foreground mt-1">Unlimited on Pro plan</p>
                </div>
                <div className="p-4 rounded-lg bg-secondary/50">
                  <p className="text-sm text-muted-foreground mb-1">Active Deals</p>
                  <p className="text-2xl font-semibold">12</p>
                  <p className="text-xs text-muted-foreground mt-1">Unlimited on Pro plan</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}