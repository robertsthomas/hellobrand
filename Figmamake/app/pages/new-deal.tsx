import { Link } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Sidebar } from "../components/features/sidebar";
import { ArrowLeft } from "lucide-react";

export function NewDealPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      
      <div className="flex-1 ml-64">
        <div className="p-8">
          <div className="max-w-3xl mx-auto">
            {/* Breadcrumb */}
            <Link to="/app/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </Link>

            <div className="mb-10">
              <h1>Create a new deal</h1>
              <p className="text-muted-foreground mt-1">
                Manually enter deal details without uploading a contract. You can always add the contract later.
              </p>
            </div>

            <form className="space-y-0">
              {/* Basic Information */}
              <section className="pb-8 mb-8 border-b border-border">
                <h2 className="mb-6">Basic Information</h2>
                <div className="space-y-5">
                  <div>
                    <Label htmlFor="brand" className="text-xs mb-1.5 block">Brand Name</Label>
                    <Input id="brand" placeholder="e.g., Glossier, Nike, Sephora" className="bg-white" />
                  </div>
                  <div>
                    <Label htmlFor="campaign" className="text-xs mb-1.5 block">Campaign/Deal Name</Label>
                    <Input id="campaign" placeholder="e.g., Spring Collection Launch" className="bg-white" />
                  </div>
                  <div>
                    <Label htmlFor="description" className="text-xs mb-1.5 block">Description (optional)</Label>
                    <Textarea id="description" placeholder="Brief overview of the partnership..." rows={3} className="bg-white" />
                  </div>
                </div>
              </section>

              {/* Payment Terms */}
              <section className="pb-8 mb-8 border-b border-border">
                <h2 className="mb-6">Payment Terms</h2>
                <div className="space-y-5">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="amount" className="text-xs mb-1.5 block">Payment Amount</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                        <Input id="amount" className="pl-7 bg-white" placeholder="8,500" />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="payment-terms" className="text-xs mb-1.5 block">Payment Terms</Label>
                      <select id="payment-terms" className="w-full h-10 px-3 rounded-lg border border-input bg-white text-sm">
                        <option value="">Select terms</option>
                        <option value="net-30">Net 30</option>
                        <option value="net-60">Net 60</option>
                        <option value="net-90">Net 90</option>
                        <option value="on-completion">On completion</option>
                        <option value="50-50">50% upfront, 50% on completion</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="payment-date" className="text-xs mb-1.5 block">Expected Payment Date (optional)</Label>
                    <Input id="payment-date" type="date" className="bg-white" />
                  </div>
                </div>
              </section>

              {/* Deliverables */}
              <section className="pb-8 mb-8 border-b border-border">
                <h2 className="mb-6">Deliverables</h2>
                <div className="space-y-5">
                  <div>
                    <Label htmlFor="deliverables" className="text-xs mb-1.5 block">What do you need to create?</Label>
                    <Textarea
                      id="deliverables"
                      placeholder="e.g., 1 Instagram Reel (60-90 sec), 3 Instagram Stories, 1 YouTube video (10-15 min)"
                      rows={4}
                      className="bg-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="deadline" className="text-xs mb-1.5 block">Deadline (optional)</Label>
                    <Input id="deadline" type="date" className="bg-white" />
                  </div>
                </div>
              </section>

              {/* Usage Rights */}
              <section className="pb-8 mb-8 border-b border-border">
                <h2 className="mb-6">Usage Rights</h2>
                <div className="space-y-5">
                  <div>
                    <Label htmlFor="usage-period" className="text-xs mb-1.5 block">Usage Period</Label>
                    <select id="usage-period" className="w-full h-10 px-3 rounded-lg border border-input bg-white text-sm">
                      <option value="">Select period</option>
                      <option value="6-months">6 months</option>
                      <option value="1-year">1 year</option>
                      <option value="2-years">2 years</option>
                      <option value="perpetual">Perpetual</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="platforms" className="text-xs mb-1.5 block">Platforms/Channels</Label>
                    <Input id="platforms" placeholder="e.g., Instagram, TikTok, Brand Website" className="bg-white" />
                  </div>
                  <div>
                    <Label htmlFor="exclusivity" className="text-xs mb-1.5 block">Exclusivity Terms (optional)</Label>
                    <Textarea id="exclusivity" placeholder="e.g., No competing beauty brands for 90 days" rows={2} className="bg-white" />
                  </div>
                </div>
              </section>

              {/* Additional Notes */}
              <section className="pb-8 mb-8 border-b border-border">
                <h2 className="mb-6">Additional Notes</h2>
                <div>
                  <Label htmlFor="notes" className="text-xs mb-1.5 block">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Any other important details, red flags, or things to remember..."
                    rows={4}
                    className="bg-white"
                  />
                </div>
              </section>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <Button type="submit">Create Deal</Button>
                <Link to="/app/dashboard">
                  <Button type="button" variant="outline">Cancel</Button>
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
