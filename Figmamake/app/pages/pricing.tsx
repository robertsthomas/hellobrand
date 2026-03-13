import { Link } from "react-router";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Check } from "lucide-react";

export function PricingPage() {
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="border-b border-border bg-background">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-semibold">H</span>
            </div>
            <span className="text-xl font-semibold tracking-tight">HelloBrand</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link to="/pricing" className="text-sm font-medium text-primary">
              Pricing
            </Link>
            <Link to="/help" className="text-sm font-medium hover:text-primary transition-colors">
              Help
            </Link>
            <Link to="/login">
              <Button variant="ghost">Log In</Button>
            </Link>
            <Link to="/waitlist">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Pricing Section */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-5xl font-semibold tracking-tight mb-6">
              Simple, transparent pricing
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Choose the plan that fits your creator business. Cancel anytime.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Starter Plan */}
            <Card className="p-8">
              <div className="mb-6">
                <h3 className="text-xl font-semibold mb-2">Starter</h3>
                <p className="text-sm text-muted-foreground">For solo creators just getting started</p>
              </div>
              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-semibold">$19</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </div>
              <Link to="/waitlist">
                <Button variant="outline" className="w-full mb-6">
                  Start Free Trial
                </Button>
              </Link>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-success shrink-0 mt-0.5" />
                  <p className="text-sm">5 contract reviews per month</p>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-success shrink-0 mt-0.5" />
                  <p className="text-sm">Plain English summaries</p>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-success shrink-0 mt-0.5" />
                  <p className="text-sm">Risk flag detection</p>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-success shrink-0 mt-0.5" />
                  <p className="text-sm">Basic email templates</p>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-success shrink-0 mt-0.5" />
                  <p className="text-sm">14-day free trial</p>
                </div>
              </div>
            </Card>

            {/* Pro Plan */}
            <Card className="p-8 border-2 border-primary relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-accent text-accent-foreground text-xs font-semibold px-3 py-1 rounded-bl-lg">
                POPULAR
              </div>
              <div className="mb-6">
                <h3 className="text-xl font-semibold mb-2">Pro</h3>
                <p className="text-sm text-muted-foreground">For established creators with regular deals</p>
              </div>
              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-semibold">$49</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </div>
              <Link to="/waitlist">
                <Button className="w-full mb-6">
                  Start Free Trial
                </Button>
              </Link>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-success shrink-0 mt-0.5" />
                  <p className="text-sm">Unlimited contract reviews</p>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-success shrink-0 mt-0.5" />
                  <p className="text-sm">Advanced risk analysis</p>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-success shrink-0 mt-0.5" />
                  <p className="text-sm">Custom negotiation emails</p>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-success shrink-0 mt-0.5" />
                  <p className="text-sm">Deliverables tracker</p>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-success shrink-0 mt-0.5" />
                  <p className="text-sm">Payment reminders</p>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-success shrink-0 mt-0.5" />
                  <p className="text-sm">Deal analytics</p>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-success shrink-0 mt-0.5" />
                  <p className="text-sm">Priority support</p>
                </div>
              </div>
            </Card>

            {/* Business Plan */}
            <Card className="p-8">
              <div className="mb-6">
                <h3 className="text-xl font-semibold mb-2">Business</h3>
                <p className="text-sm text-muted-foreground">For agencies and creator collectives</p>
              </div>
              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-semibold">$149</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </div>
              <Link to="/waitlist">
                <Button variant="outline" className="w-full mb-6">
                  Contact Sales
                </Button>
              </Link>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-success shrink-0 mt-0.5" />
                  <p className="text-sm">Everything in Pro</p>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-success shrink-0 mt-0.5" />
                  <p className="text-sm">Up to 5 team members</p>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-success shrink-0 mt-0.5" />
                  <p className="text-sm">Collaborative workspace</p>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-success shrink-0 mt-0.5" />
                  <p className="text-sm">Advanced analytics</p>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-success shrink-0 mt-0.5" />
                  <p className="text-sm">Custom integrations</p>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-success shrink-0 mt-0.5" />
                  <p className="text-sm">Dedicated account manager</p>
                </div>
              </div>
            </Card>
          </div>

          {/* FAQ */}
          <div className="mt-20">
            <h2 className="text-3xl font-semibold text-center mb-12">Frequently asked questions</h2>
            <div className="max-w-3xl mx-auto space-y-6">
              <Card className="p-6">
                <h4 className="font-semibold mb-2">Can I cancel anytime?</h4>
                <p className="text-muted-foreground">Yes, you can cancel your subscription at any time. You'll continue to have access until the end of your billing period.</p>
              </Card>
              <Card className="p-6">
                <h4 className="font-semibold mb-2">Is this legal advice?</h4>
                <p className="text-muted-foreground">No. HelloBrand is not a law firm and does not provide legal advice. We provide tools to help you understand contracts, but you should consult a lawyer for specific legal advice.</p>
              </Card>
              <Card className="p-6">
                <h4 className="font-semibold mb-2">What file formats do you support?</h4>
                <p className="text-muted-foreground">We support PDF, Word documents (.docx), and plain text files. Scanned contracts work best when they're clear and readable.</p>
              </Card>
              <Card className="p-6">
                <h4 className="font-semibold mb-2">How does the free trial work?</h4>
                <p className="text-muted-foreground">You get full access to all features for 14 days. No credit card required to start. If you don't upgrade, your account will be automatically downgraded to a free tier with limited features.</p>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
