import { Link } from "react-router";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { FileText, Shield, Zap, CheckCircle2 } from "lucide-react";

export function WaitlistPage() {
  return (
    <div className="min-h-screen flex">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <Link to="/" className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-semibold">H</span>
            </div>
            <span className="text-xl font-semibold tracking-tight">HelloBrand</span>
          </Link>

          <div className="mb-8">
            <h1 className="text-3xl font-semibold mb-3">Start your free trial</h1>
            <p className="text-muted-foreground">
              Get 14 days of full access. No credit card required.
            </p>
          </div>

          <form className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" placeholder="Sarah Miller" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="sarah@example.com" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="handle">Creator Handle (optional)</Label>
              <Input id="handle" placeholder="@sarahmiller" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="platform">Primary Platform</Label>
              <select
                id="platform"
                className="w-full h-10 px-3 rounded-lg border border-input bg-input-background"
              >
                <option value="">Select platform</option>
                <option value="youtube">YouTube</option>
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="twitch">Twitch</option>
                <option value="newsletter">Newsletter</option>
                <option value="podcast">Podcast</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="flex items-start gap-2">
              <Checkbox id="terms" className="mt-1" />
              <Label htmlFor="terms" className="text-sm font-normal leading-relaxed">
                I agree to the{" "}
                <a href="#" className="text-primary hover:underline">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="#" className="text-primary hover:underline">
                  Privacy Policy
                </a>
              </Label>
            </div>

            <Link to="/app/onboarding">
              <Button type="submit" className="w-full">
                Start Free Trial
              </Button>
            </Link>

            <p className="text-sm text-muted-foreground text-center">
              Already have an account?{" "}
              <Link to="/login" className="text-primary hover:underline font-medium">
                Log in
              </Link>
            </p>
          </form>

          <div className="mt-8 pt-8 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              This is not legal advice. HelloBrand is not a law firm.
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Visual */}
      <div className="hidden lg:block lg:w-1/2 bg-gradient-to-br from-primary via-primary/80 to-accent relative">
        <div className="absolute inset-0 flex items-center justify-center p-12">
          <div className="max-w-lg space-y-6">
            <div className="text-primary-foreground">
              <h2 className="text-3xl font-semibold mb-4">Join thousands of creators</h2>
              <p className="text-primary-foreground/90 text-lg mb-8">
                Who negotiate better brand deals and protect their work with confidence
              </p>
            </div>
            
            <div className="space-y-4">
              <Card className="p-6 bg-background/95 backdrop-blur">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6 text-success" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Plain English Summaries</h4>
                    <p className="text-sm text-muted-foreground">
                      Understand complex contracts in minutes
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-background/95 backdrop-blur">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                    <Zap className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Risk Detection</h4>
                    <p className="text-sm text-muted-foreground">
                      Spot unfair terms before you sign
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-background/95 backdrop-blur">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Shield className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Negotiation Support</h4>
                    <p className="text-sm text-muted-foreground">
                      Get better rates with AI-powered emails
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}