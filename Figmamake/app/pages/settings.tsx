import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Sidebar } from "../components/features/sidebar";

export function SettingsPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      
      <div className="flex-1 ml-64">
        <div className="p-8">
          <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="mb-10">
              <h1>Settings</h1>
              <p className="text-muted-foreground mt-1">Manage your account preferences and notifications</p>
            </div>

            {/* Notifications */}
            <section className="mb-10">
              <h2 className="mb-6">Notifications</h2>
              <div className="divide-y divide-border">
                {[
                  { title: "Payment Reminders", desc: "Get notified when payments are overdue", checked: true },
                  { title: "Deadline Alerts", desc: "Receive alerts for upcoming deliverable deadlines", checked: true },
                  { title: "Risk Flag Notifications", desc: "Get notified when contracts have risk flags", checked: true },
                  { title: "Weekly Summary Email", desc: "Receive a weekly summary of your deals and payments", checked: false },
                  { title: "Product Updates", desc: "Stay informed about new features and improvements", checked: true },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-4">
                    <div>
                      <p className="font-medium text-sm">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                    </div>
                    <Switch defaultChecked={item.checked} />
                  </div>
                ))}
              </div>
            </section>

            {/* Contract Processing */}
            <section className="mb-10 border-t border-border pt-10">
              <h2 className="mb-6">Contract Processing</h2>
              <div className="divide-y divide-border">
                {[
                  { title: "Auto-detect Payment Terms", desc: "Automatically extract payment amounts and schedules", checked: true },
                  { title: "Flag Exclusivity Clauses", desc: "Highlight exclusivity terms in contracts", checked: true },
                  { title: "Identify Usage Rights", desc: "Detect content usage rights and licensing terms", checked: true },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-4">
                    <div>
                      <p className="font-medium text-sm">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                    </div>
                    <Switch defaultChecked={item.checked} />
                  </div>
                ))}
                <div className="py-4">
                  <Label className="text-sm font-medium">Default Payment Terms</Label>
                  <select className="mt-2 w-full h-10 px-3 rounded-lg border border-input bg-white text-sm">
                    <option value="net-30">Net 30</option>
                    <option value="net-60">Net 60</option>
                    <option value="net-90">Net 90</option>
                    <option value="on-completion">On completion</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1.5">Used as default when creating new deals manually</p>
                </div>
              </div>
            </section>

            {/* Email Templates */}
            <section className="mb-10 border-t border-border pt-10">
              <h2 className="mb-6">Email Templates</h2>
              <div className="divide-y divide-border">
                <div className="py-4">
                  <Label htmlFor="email-signature" className="text-sm font-medium">Email Signature</Label>
                  <Input id="email-signature" defaultValue="Best,\nSarah Miller\n@sarahmiller" className="mt-2 bg-white" />
                  <p className="text-xs text-muted-foreground mt-1.5">This will be added to all generated email drafts</p>
                </div>
                {[
                  { title: "Include Brand Logo in Emails", desc: "Add your personal branding to email templates", checked: false },
                  { title: "Formal Tone", desc: "Use more formal language in generated emails", checked: false },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-4">
                    <div>
                      <p className="font-medium text-sm">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                    </div>
                    <Switch defaultChecked={item.checked} />
                  </div>
                ))}
              </div>
            </section>

            {/* Data & Privacy */}
            <section className="mb-10 border-t border-border pt-10">
              <h2 className="mb-6">Data & Privacy</h2>
              <div className="space-y-3">
                <Button variant="outline" className="w-full justify-start text-sm h-10">Download All Data</Button>
                <Button variant="outline" className="w-full justify-start text-sm h-10">Export Contracts as PDF</Button>
              </div>
              <div className="mt-6 pt-6 border-t border-border">
                <Button variant="destructive" className="w-full text-sm h-10">Delete Account</Button>
                <p className="text-xs text-muted-foreground mt-2">
                  This will permanently delete your account and all associated data. This action cannot be undone.
                </p>
              </div>
            </section>

            {/* Save */}
            <div className="flex gap-3 pt-6 border-t border-border">
              <Button>Save Changes</Button>
              <Button variant="outline">Cancel</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
