import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Separator } from "../components/ui/separator";
import { Sidebar } from "../components/features/sidebar";

export function SettingsPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      
      <div className="flex-1 ml-64">
        <div className="p-8">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-semibold mb-2">Settings</h1>
              <p className="text-muted-foreground">
                Manage your account preferences and notifications
              </p>
            </div>

            {/* Notifications */}
            <Card className="p-6 mb-6">
              <h2 className="text-xl font-semibold mb-6">Notifications</h2>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Payment Reminders</p>
                    <p className="text-sm text-muted-foreground">
                      Get notified when payments are overdue
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Deadline Alerts</p>
                    <p className="text-sm text-muted-foreground">
                      Receive alerts for upcoming deliverable deadlines
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Risk Flag Notifications</p>
                    <p className="text-sm text-muted-foreground">
                      Get notified when contracts have risk flags
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Weekly Summary Email</p>
                    <p className="text-sm text-muted-foreground">
                      Receive a weekly summary of your deals and payments
                    </p>
                  </div>
                  <Switch />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Product Updates</p>
                    <p className="text-sm text-muted-foreground">
                      Stay informed about new features and improvements
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </Card>

            {/* Contract Processing */}
            <Card className="p-6 mb-6">
              <h2 className="text-xl font-semibold mb-6">Contract Processing</h2>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Auto-detect Payment Terms</p>
                    <p className="text-sm text-muted-foreground">
                      Automatically extract payment amounts and schedules
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Flag Exclusivity Clauses</p>
                    <p className="text-sm text-muted-foreground">
                      Highlight exclusivity terms in contracts
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Identify Usage Rights</p>
                    <p className="text-sm text-muted-foreground">
                      Detect content usage rights and licensing terms
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Default Payment Terms</Label>
                  <select className="w-full h-10 px-3 rounded-lg border border-input bg-input-background">
                    <option value="net-30">Net 30</option>
                    <option value="net-60">Net 60</option>
                    <option value="net-90">Net 90</option>
                    <option value="on-completion">On completion</option>
                  </select>
                  <p className="text-sm text-muted-foreground">
                    Used as default when creating new deals manually
                  </p>
                </div>
              </div>
            </Card>

            {/* Email Templates */}
            <Card className="p-6 mb-6">
              <h2 className="text-xl font-semibold mb-6">Email Templates</h2>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email-signature">Email Signature</Label>
                  <Input
                    id="email-signature"
                    defaultValue="Best,\nSarah Miller\n@sarahmiller"
                  />
                  <p className="text-sm text-muted-foreground">
                    This will be added to all generated email drafts
                  </p>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Include Brand Logo in Emails</p>
                    <p className="text-sm text-muted-foreground">
                      Add your personal branding to email templates
                    </p>
                  </div>
                  <Switch />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Formal Tone</p>
                    <p className="text-sm text-muted-foreground">
                      Use more formal language in generated emails
                    </p>
                  </div>
                  <Switch />
                </div>
              </div>
            </Card>

            {/* Data & Privacy */}
            <Card className="p-6 mb-6">
              <h2 className="text-xl font-semibold mb-6">Data & Privacy</h2>
              <div className="space-y-4">
                <Button variant="outline" className="w-full justify-start">
                  Download All Data
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  Export Contracts as PDF
                </Button>
                <Separator />
                <Button variant="destructive" className="w-full">
                  Delete Account
                </Button>
                <p className="text-xs text-muted-foreground">
                  This will permanently delete your account and all associated data. This action cannot be undone.
                </p>
              </div>
            </Card>

            {/* Save Changes */}
            <div className="flex gap-3">
              <Button>Save Changes</Button>
              <Button variant="outline">Cancel</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}