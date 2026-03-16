import { Link } from "react-router";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Check, Upload, FileText, Sparkles } from "lucide-react";

export function OnboardingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-secondary/30">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-semibold mb-3">Welcome to HelloBrand!</h1>
          <p className="text-xl text-muted-foreground">
            Let's get you set up in 3 simple steps
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card className="p-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground mb-4">
              1
            </div>
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Upload className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">Upload your first contract</h3>
            <p className="text-sm text-muted-foreground">
              Drag and drop any sponsorship agreement to get started
            </p>
          </Card>

          <Card className="p-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted text-muted-foreground mb-4">
              2
            </div>
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-6 h-6 text-accent" />
            </div>
            <h3 className="font-semibold mb-2">Review the summary</h3>
            <p className="text-sm text-muted-foreground">
              Get an instant breakdown of terms, risks, and opportunities
            </p>
          </Card>

          <Card className="p-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted text-muted-foreground mb-4">
              3
            </div>
            <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center mx-auto mb-4">
              <Check className="w-6 h-6 text-success" />
            </div>
            <h3 className="font-semibold mb-2">Take action</h3>
            <p className="text-sm text-muted-foreground">
              Use AI-generated emails to negotiate or track deliverables
            </p>
          </Card>
        </div>

        <Card className="p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold mb-2">Quick tips to get the most from HelloBrand</h2>
            <p className="text-muted-foreground">
              Here's what you should know before uploading your first contract
            </p>
          </div>

          <div className="space-y-4 mb-8">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h4 className="font-medium mb-1">We support PDF, Word, and text files</h4>
                <p className="text-sm text-muted-foreground">
                  Make sure scanned contracts are clear and readable for best results
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h4 className="font-medium mb-1">Processing takes 30-60 seconds</h4>
                <p className="text-sm text-muted-foreground">
                  Our AI carefully analyzes each clause to give you accurate insights
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h4 className="font-medium mb-1">This is not legal advice</h4>
                <p className="text-sm text-muted-foreground">
                  HelloBrand helps you understand contracts, but consult a lawyer for specific legal advice
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h4 className="font-medium mb-1">Your data is private and secure</h4>
                <p className="text-sm text-muted-foreground">
                  We encrypt all contracts and never share your information with third parties
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <Link to="/app/deals/upload" className="flex-1">
              <Button className="w-full">
                Upload Your First Contract
              </Button>
            </Link>
            <Link to="/app" className="flex-1">
              <Button variant="outline" className="w-full">
                Skip and Explore
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
