import { Link } from "react-router";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { CheckCircle2, Shield, Zap, FileText, Mail, AlertTriangle, ArrowRight } from "lucide-react";

export function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-semibold">H</span>
            </div>
            <span className="text-xl font-semibold tracking-tight">HelloBrand</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link to="/pricing" className="text-sm font-medium hover:text-primary transition-colors">
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

      {/* Hero Section */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-sm font-medium mb-6">
                <Zap className="w-4 h-4" />
                Understand your brand deals before you sign
              </div>
              <h1 className="text-5xl font-semibold tracking-tight mb-6">
                Contract clarity for creators
              </h1>
              <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
                Upload sponsorship contracts, understand them in plain English, and negotiate with confidence. Built for influencers, YouTubers, and solo creators.
              </p>
              <div className="flex items-center gap-4">
                <Link to="/waitlist">
                  <Button size="lg" className="gap-2">
                    Start Free Trial
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link to="/pricing">
                  <Button size="lg" variant="outline">
                    View Pricing
                  </Button>
                </Link>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                No credit card required • 14-day free trial
              </p>
            </div>
            <div className="relative">
              <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-gradient-to-br from-primary via-primary/80 to-accent p-12 shadow-2xl flex items-center justify-center">
                <div className="grid grid-cols-2 gap-6">
                  <Card className="p-6 bg-background/95 backdrop-blur">
                    <FileText className="w-8 h-8 text-primary mb-3" />
                    <div className="h-2 bg-muted rounded mb-2"></div>
                    <div className="h-2 bg-muted rounded w-3/4"></div>
                  </Card>
                  <Card className="p-6 bg-background/95 backdrop-blur">
                    <CheckCircle2 className="w-8 h-8 text-success mb-3" />
                    <div className="h-2 bg-muted rounded mb-2"></div>
                    <div className="h-2 bg-muted rounded w-2/3"></div>
                  </Card>
                  <Card className="p-6 bg-background/95 backdrop-blur">
                    <AlertTriangle className="w-8 h-8 text-accent mb-3" />
                    <div className="h-2 bg-muted rounded mb-2"></div>
                    <div className="h-2 bg-muted rounded w-4/5"></div>
                  </Card>
                  <Card className="p-6 bg-background/95 backdrop-blur">
                    <Mail className="w-8 h-8 text-primary mb-3" />
                    <div className="h-2 bg-muted rounded mb-2"></div>
                    <div className="h-2 bg-muted rounded w-3/5"></div>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 bg-secondary/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-semibold mb-4">Everything you need to review brand deals</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              AI-powered contract intelligence designed specifically for creator partnerships
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="p-8 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Plain English Summaries</h3>
              <p className="text-muted-foreground leading-relaxed">
                Upload any sponsorship contract and get an instant breakdown of key terms, payment schedules, and deliverables.
              </p>
            </Card>

            <Card className="p-8 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Risk Flags</h3>
              <p className="text-muted-foreground leading-relaxed">
                Automatically identifies exclusivity traps, perpetual licensing, delayed payments, and vague deliverables.
              </p>
            </Card>

            <Card className="p-8 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center mb-4">
                <Mail className="w-6 h-6 text-success" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Negotiation Emails</h3>
              <p className="text-muted-foreground leading-relaxed">
                Generate polished, professional emails to negotiate better terms with brands—without sounding pushy.
              </p>
            </Card>

            <Card className="p-8 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-6 h-6 text-warning" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Deliverables Tracker</h3>
              <p className="text-muted-foreground leading-relaxed">
                Keep track of what you've promised, when it's due, and what's already been delivered.
              </p>
            </Card>

            <Card className="p-8 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Usage Rights Inspector</h3>
              <p className="text-muted-foreground leading-relaxed">
                Understand exactly how brands can use your content, for how long, and across which platforms.
              </p>
            </Card>

            <Card className="p-8 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Payment Reminders</h3>
              <p className="text-muted-foreground leading-relaxed">
                Automatically draft payment reminder emails when invoices are overdue or milestones are met.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-semibold mb-4">Trusted by creators</h2>
            <p className="text-xl text-muted-foreground">
              Join thousands of influencers who negotiate better brand deals
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                quote: "HelloBrand helped me catch an exclusivity clause that would have blocked me from working with other fitness brands for a year. Worth every penny.",
                author: "Jessica Chen",
                role: "Fitness YouTuber, 245K subscribers",
              },
              {
                quote: "I used to just sign contracts without really understanding them. Now I feel confident asking for better payment terms and usage rights.",
                author: "Marcus Rodriguez",
                role: "Tech Reviewer, 580K followers",
              },
              {
                quote: "The negotiation email templates are gold. I've gotten better rates on my last three brand deals just by using their suggested language.",
                author: "Priya Sharma",
                role: "Lifestyle Creator, 120K followers",
              },
            ].map((testimonial, i) => (
              <Card key={i} className="p-8">
                <p className="text-muted-foreground leading-relaxed mb-6">
                  "{testimonial.quote}"
                </p>
                <div>
                  <p className="font-semibold">{testimonial.author}</p>
                  <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-semibold mb-6">
            Start reviewing contracts with confidence
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Join creators who negotiate better deals and protect their work
          </p>
          <Link to="/waitlist">
            <Button size="lg" variant="secondary" className="gap-2">
              Get Started Free
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <p className="text-sm mt-4 opacity-75">
            This is not legal advice. HelloBrand is not a law firm.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-semibold">H</span>
                </div>
                <span className="text-xl font-semibold">HelloBrand</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Contract clarity for creators
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link></li>
                <li><Link to="/waitlist" className="hover:text-foreground transition-colors">Sign Up</Link></li>
                <li><Link to="/login" className="hover:text-foreground transition-colors">Log In</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Resources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/help" className="hover:text-foreground transition-colors">Help Center</Link></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Guides</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Cookie Policy</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border mt-8 pt-8 text-center text-sm text-muted-foreground">
            <p>© 2026 HelloBrand. All rights reserved. This is not legal advice.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}