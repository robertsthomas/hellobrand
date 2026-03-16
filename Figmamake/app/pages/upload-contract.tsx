import { Link } from "react-router";
import { Button } from "../components/ui/button";
import { Sidebar } from "../components/features/sidebar";
import { Upload, FileText, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";

export function UploadContractPage() {
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
              <h1>Upload a contract</h1>
              <p className="text-muted-foreground mt-1">
                Upload your sponsorship contract to get an instant breakdown of terms, risks, and opportunities.
              </p>
            </div>

            {/* Upload Area */}
            <div className="border-2 border-dashed border-border hover:border-primary/40 transition-colors rounded-xl p-12 mb-10 bg-white cursor-pointer">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-4">
                  <Upload className="w-7 h-7 text-primary" />
                </div>
                <h3 className="mb-2">Drag and drop your contract here</h3>
                <p className="text-sm text-muted-foreground mb-4">or click to browse your files</p>
                <Button>Choose File</Button>
                <p className="text-xs text-muted-foreground mt-3">
                  Supports PDF, Word (.docx), and text files up to 10MB
                </p>
              </div>
            </div>

            {/* Feature cards */}
            <div className="grid md:grid-cols-3 gap-px bg-border rounded-xl overflow-hidden mb-10">
              <div className="bg-white p-5">
                <FileText className="w-5 h-5 text-primary mb-2" />
                <p className="font-medium text-sm mb-1">Instant Analysis</p>
                <p className="text-xs text-muted-foreground">Get a plain English summary of all key terms in 30-60 seconds</p>
              </div>
              <div className="bg-white p-5">
                <AlertCircle className="w-5 h-5 text-accent mb-2" />
                <p className="font-medium text-sm mb-1">Risk Detection</p>
                <p className="text-xs text-muted-foreground">Automatically flag risky clauses like exclusivity or perpetual rights</p>
              </div>
              <div className="bg-white p-5">
                <CheckCircle2 className="w-5 h-5 text-success mb-2" />
                <p className="font-medium text-sm mb-1">Private & Secure</p>
                <p className="text-xs text-muted-foreground">Your contracts are encrypted and never shared with anyone</p>
              </div>
            </div>

            {/* What we look for */}
            <div className="mb-10">
              <h3 className="mb-4">What we look for in your contract</h3>
              <div className="grid md:grid-cols-2 gap-x-8 gap-y-2">
                {[
                  "Payment amounts and terms",
                  "Deliverables and deadlines",
                  "Usage rights and licensing",
                  "Exclusivity clauses",
                  "Revision and approval processes",
                  "Termination conditions",
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0"></span>
                    <span className="text-sm text-muted-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Legal Disclaimer */}
            <div className="flex items-start gap-3 py-5 border-t border-border">
              <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm mb-0.5">Legal Disclaimer</p>
                <p className="text-xs text-muted-foreground">
                  HelloBrand is not a law firm and does not provide legal advice. The information provided is for educational purposes only. Please consult a qualified attorney for specific legal guidance.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
