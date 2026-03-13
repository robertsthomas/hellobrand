import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Sidebar } from "../components/features/sidebar";
import { Upload, FileText, CheckCircle2, AlertCircle } from "lucide-react";

export function UploadContractPage() {
  // Toggle these to show different states
  const isProcessing = false;
  const hasError = false;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      
      <div className="flex-1 ml-64">
        <div className="p-8">
          <div className="max-w-3xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-semibold mb-2">Upload a contract</h1>
              <p className="text-muted-foreground">
                Upload your sponsorship contract to get an instant breakdown of terms, risks, and opportunities.
              </p>
            </div>

            <Card className="p-12 border-2 border-dashed border-border hover:border-primary/50 transition-colors">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6">
                  <Upload className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Drag and drop your contract here</h3>
                <p className="text-muted-foreground mb-6">
                  or click to browse your files
                </p>
                <Button size="lg">Choose File</Button>
                <p className="text-sm text-muted-foreground mt-4">
                  Supports PDF, Word (.docx), and text files up to 10MB
                </p>
              </div>
            </Card>

            <div className="mt-8 grid md:grid-cols-3 gap-6">
              <Card className="p-6">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <h4 className="font-semibold mb-2">Instant Analysis</h4>
                <p className="text-sm text-muted-foreground">
                  Get a plain English summary of all key terms in 30-60 seconds
                </p>
              </Card>

              <Card className="p-6">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                  <AlertCircle className="w-5 h-5 text-accent" />
                </div>
                <h4 className="font-semibold mb-2">Risk Detection</h4>
                <p className="text-sm text-muted-foreground">
                  Automatically flag risky clauses like exclusivity or perpetual rights
                </p>
              </Card>

              <Card className="p-6">
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                </div>
                <h4 className="font-semibold mb-2">Private & Secure</h4>
                <p className="text-sm text-muted-foreground">
                  Your contracts are encrypted and never shared with anyone
                </p>
              </Card>
            </div>

            <Card className="mt-8 p-6 bg-muted/30">
              <h4 className="font-semibold mb-3">What we look for in your contract:</h4>
              <ul className="grid md:grid-cols-2 gap-3 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                  Payment amounts and terms
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                  Deliverables and deadlines
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                  Usage rights and licensing
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                  Exclusivity clauses
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                  Revision and approval processes
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                  Termination conditions
                </li>
              </ul>
            </Card>

            <div className="mt-8 p-6 rounded-lg bg-warning/5 border border-warning/20">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold mb-1">Legal Disclaimer</h4>
                  <p className="text-sm text-muted-foreground">
                    HelloBrand is not a law firm and does not provide legal advice. The information provided is for educational purposes only. Please consult a qualified attorney for specific legal guidance.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}