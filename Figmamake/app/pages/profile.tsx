import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Sidebar } from "../components/features/sidebar";
import { Upload, Youtube, Instagram, Twitter } from "lucide-react";

export function ProfilePage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      
      <div className="flex-1 ml-64">
        <div className="p-8">
          <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="mb-10">
              <h1>Profile</h1>
              <p className="text-muted-foreground mt-1">Manage your public profile and creator information</p>
            </div>

            {/* Profile Picture */}
            <section className="mb-10 pb-10 border-b border-border">
              <div className="flex items-center gap-6">
                <Avatar className="w-20 h-20">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xl">SM</AvatarFallback>
                </Avatar>
                <div>
                  <Button size="sm" className="gap-2 mb-2">
                    <Upload className="w-4 h-4" />
                    Upload Photo
                  </Button>
                  <p className="text-xs text-muted-foreground">JPG, PNG or GIF. Max size 2MB.</p>
                </div>
              </div>
            </section>

            {/* Basic Information */}
            <section className="mb-10 pb-10 border-b border-border">
              <h2 className="mb-6">Basic Information</h2>
              <div className="space-y-5">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="first-name" className="text-xs mb-1.5 block">First Name</Label>
                    <Input id="first-name" defaultValue="Sarah" className="bg-white" />
                  </div>
                  <div>
                    <Label htmlFor="last-name" className="text-xs mb-1.5 block">Last Name</Label>
                    <Input id="last-name" defaultValue="Miller" className="bg-white" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="email" className="text-xs mb-1.5 block">Email</Label>
                  <Input id="email" type="email" defaultValue="sarah@example.com" className="bg-white" />
                </div>
                <div>
                  <Label htmlFor="bio" className="text-xs mb-1.5 block">Bio</Label>
                  <Textarea
                    id="bio"
                    rows={3}
                    className="bg-white"
                    defaultValue="Lifestyle and beauty creator sharing honest reviews, skincare routines, and daily vlogs. Passionate about sustainable beauty and wellness."
                  />
                </div>
              </div>
            </section>

            {/* Social Media */}
            <section className="mb-10 pb-10 border-b border-border">
              <h2 className="mb-6">Social Media Channels</h2>
              <div className="space-y-4">
                {[
                  { id: "instagram", label: "Instagram", icon: Instagram, handle: "@sarahmiller", followers: "245K" },
                  { id: "youtube", label: "YouTube", icon: Youtube, handle: "@SarahMillerVlogs", followers: "580K" },
                  { id: "tiktok", label: "TikTok", icon: null, handle: "@sarahmiller", followers: "1.2M" },
                  { id: "twitter", label: "Twitter/X", icon: Twitter, handle: "", followers: null },
                ].map((social) => (
                  <div key={social.id} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                      {social.icon ? <social.icon className="w-4 h-4" /> : <span className="font-medium text-xs">TT</span>}
                    </div>
                    <div className="flex-1">
                      <Label htmlFor={social.id} className="text-xs mb-1 block">{social.label}</Label>
                      <Input id={social.id} defaultValue={social.handle} placeholder={`@handle`} className="bg-white" />
                    </div>
                    {social.followers && (
                      <Badge className="bg-success/10 text-success text-xs shrink-0 mt-5">{social.followers}</Badge>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Creator Details */}
            <section className="mb-10 pb-10 border-b border-border">
              <h2 className="mb-6">Creator Details</h2>
              <div className="space-y-5">
                <div>
                  <Label htmlFor="primary-platform" className="text-xs mb-1.5 block">Primary Platform</Label>
                  <select id="primary-platform" className="w-full h-10 px-3 rounded-lg border border-input bg-white text-sm">
                    <option value="instagram">Instagram</option>
                    <option value="youtube">YouTube</option>
                    <option value="tiktok">TikTok</option>
                    <option value="twitch">Twitch</option>
                    <option value="newsletter">Newsletter</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="content-category" className="text-xs mb-1.5 block">Content Category</Label>
                  <select id="content-category" className="w-full h-10 px-3 rounded-lg border border-input bg-white text-sm">
                    <option value="beauty">Beauty & Skincare</option>
                    <option value="lifestyle">Lifestyle</option>
                    <option value="fashion">Fashion</option>
                    <option value="fitness">Fitness & Wellness</option>
                    <option value="food">Food & Cooking</option>
                    <option value="tech">Tech Reviews</option>
                    <option value="travel">Travel</option>
                    <option value="gaming">Gaming</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="location" className="text-xs mb-1.5 block">Location</Label>
                  <Input id="location" defaultValue="Los Angeles, CA" className="bg-white" />
                </div>
              </div>
            </section>

            {/* Business Information */}
            <section className="mb-10">
              <h2 className="mb-6">Business Information</h2>
              <div className="space-y-5">
                <div>
                  <Label htmlFor="business-name" className="text-xs mb-1.5 block">Business Name (Optional)</Label>
                  <Input id="business-name" placeholder="Sarah Miller Media LLC" className="bg-white" />
                </div>
                <div>
                  <Label htmlFor="tax-id" className="text-xs mb-1.5 block">Tax ID / EIN (Optional)</Label>
                  <Input id="tax-id" placeholder="XX-XXXXXXX" className="bg-white" />
                  <p className="text-xs text-muted-foreground mt-1">For invoicing and payment purposes</p>
                </div>
                <div>
                  <Label htmlFor="rate-card" className="text-xs mb-1.5 block">Standard Rate Card Link (Optional)</Label>
                  <Input id="rate-card" placeholder="https://sarahmiller.com/rates" className="bg-white" />
                </div>
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
