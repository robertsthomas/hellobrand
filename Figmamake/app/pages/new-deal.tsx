import { Link } from "react-router";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Sidebar } from "../components/features/sidebar";

export function NewDealPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      
      <div className="flex-1 ml-64">
        <div className="p-8">
          <div className="max-w-3xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-semibold mb-2">Create a new deal</h1>
              <p className="text-muted-foreground">
                Manually enter deal details without uploading a contract. You can always add the contract later.
              </p>
            </div>

            <form className="space-y-8">
              {/* Basic Information */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-6">Basic Information</h3>
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="brand">Brand Name</Label>
                    <Input id="brand" placeholder="e.g., Glossier, Nike, Sephora" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="campaign">Campaign/Deal Name</Label>
                    <Input id="campaign" placeholder="e.g., Spring Collection Launch" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description (optional)</Label>
                    <Textarea
                      id="description"
                      placeholder="Brief overview of the partnership..."
                      rows={3}
                    />
                  </div>
                </div>
              </Card>

              {/* Payment Terms */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-6">Payment Terms</h3>
                <div className="space-y-5">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="amount">Payment Amount</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                        <Input id="amount" className="pl-7" placeholder="8,500" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="payment-terms">Payment Terms</Label>
                      <select
                        id="payment-terms"
                        className="w-full h-10 px-3 rounded-lg border border-input bg-input-background"
                      >
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

                  <div className="space-y-2">
                    <Label htmlFor="payment-date">Expected Payment Date (optional)</Label>
                    <Input id="payment-date" type="date" />
                  </div>
                </div>
              </Card>

              {/* Deliverables */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-6">Deliverables</h3>
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="deliverables">What do you need to create?</Label>
                    <Textarea
                      id="deliverables"
                      placeholder="e.g., 1 Instagram Reel (60-90 sec), 3 Instagram Stories, 1 YouTube video (10-15 min)"
                      rows={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="deadline">Deadline (optional)</Label>
                    <Input id="deadline" type="date" />
                  </div>
                </div>
              </Card>

              {/* Usage Rights */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-6">Usage Rights</h3>
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="usage-period">Usage Period</Label>
                    <select
                      id="usage-period"
                      className="w-full h-10 px-3 rounded-lg border border-input bg-input-background"
                    >
                      <option value="">Select period</option>
                      <option value="6-months">6 months</option>
                      <option value="1-year">1 year</option>
                      <option value="2-years">2 years</option>
                      <option value="perpetual">Perpetual</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="platforms">Platforms/Channels</Label>
                    <Input
                      id="platforms"
                      placeholder="e.g., Instagram, TikTok, Brand Website"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="exclusivity">Exclusivity Terms (optional)</Label>
                    <Textarea
                      id="exclusivity"
                      placeholder="e.g., No competing beauty brands for 90 days"
                      rows={2}
                    />
                  </div>
                </div>
              </Card>

              {/* Additional Notes */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-6">Additional Notes</h3>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Any other important details, red flags, or things to remember..."
                    rows={4}
                  />
                </div>
              </Card>

              {/* Actions */}
              <div className="flex items-center gap-4">
                <Button type="submit" size="lg">Create Deal</Button>
                <Link to="/app">
                  <Button type="button" variant="outline" size="lg">Cancel</Button>
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}