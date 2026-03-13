import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
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
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-semibold mb-2">Profile</h1>
              <p className="text-muted-foreground">
                Manage your public profile and creator information
              </p>
            </div>

            {/* Profile Picture */}
            <Card className="p-6 mb-6">
              <h2 className="text-xl font-semibold mb-6">Profile Picture</h2>
              <div className="flex items-center gap-6">
                <Avatar className="w-24 h-24">
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                    SM
                  </AvatarFallback>
                </Avatar>
                <div>
                  <Button className="gap-2 mb-2">
                    <Upload className="w-4 h-4" />
                    Upload Photo
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    JPG, PNG or GIF. Max size 2MB.
                  </p>
                </div>
              </div>
            </Card>

            {/* Basic Information */}
            <Card className="p-6 mb-6">
              <h2 className="text-xl font-semibold mb-6">Basic Information</h2>
              <div className="space-y-5">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first-name">First Name</Label>
                    <Input id="first-name" defaultValue="Sarah" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last-name">Last Name</Label>
                    <Input id="last-name" defaultValue="Miller" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" defaultValue="sarah@example.com" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    rows={4}
                    defaultValue="Lifestyle and beauty creator sharing honest reviews, skincare routines, and daily vlogs. Passionate about sustainable beauty and wellness."
                  />
                  <p className="text-sm text-muted-foreground">
                    Brief description for your profile
                  </p>
                </div>
              </div>
            </Card>

            {/* Social Media */}
            <Card className="p-6 mb-6">
              <h2 className="text-xl font-semibold mb-6">Social Media Channels</h2>
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="instagram">Instagram</Label>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                      <Instagram className="w-5 h-5" />
                    </div>
                    <Input id="instagram" placeholder="@sarahmiller" defaultValue="@sarahmiller" />
                    <Badge className="bg-success/10 text-success hover:bg-success/20">245K</Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="youtube">YouTube</Label>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                      <Youtube className="w-5 h-5" />
                    </div>
                    <Input id="youtube" placeholder="@SarahMillerVlogs" defaultValue="@SarahMillerVlogs" />
                    <Badge className="bg-success/10 text-success hover:bg-success/20">580K</Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tiktok">TikTok</Label>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                      <span className="font-semibold text-sm">TT</span>
                    </div>
                    <Input id="tiktok" placeholder="@sarahmiller" defaultValue="@sarahmiller" />
                    <Badge className="bg-success/10 text-success hover:bg-success/20">1.2M</Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="twitter">Twitter/X</Label>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                      <Twitter className="w-5 h-5" />
                    </div>
                    <Input id="twitter" placeholder="@sarahmiller" />
                  </div>
                </div>
              </div>
            </Card>

            {/* Creator Details */}
            <Card className="p-6 mb-6">
              <h2 className="text-xl font-semibold mb-6">Creator Details</h2>
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="primary-platform">Primary Platform</Label>
                  <select
                    id="primary-platform"
                    className="w-full h-10 px-3 rounded-lg border border-input bg-input-background"
                  >
                    <option value="instagram">Instagram</option>
                    <option value="youtube">YouTube</option>
                    <option value="tiktok">TikTok</option>
                    <option value="twitch">Twitch</option>
                    <option value="newsletter">Newsletter</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content-category">Content Category</Label>
                  <select
                    id="content-category"
                    className="w-full h-10 px-3 rounded-lg border border-input bg-input-background"
                  >
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

                <div className="space-y-2">
                  <Label htmlFor="audience-size">Total Audience Size</Label>
                  <select
                    id="audience-size"
                    className="w-full h-10 px-3 rounded-lg border border-input bg-input-background"
                  >
                    <option value="10k-50k">10K - 50K</option>
                    <option value="50k-100k">50K - 100K</option>
                    <option value="100k-500k">100K - 500K</option>
                    <option value="500k-1m">500K - 1M</option>
                    <option value="1m+">1M+</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input id="location" placeholder="Los Angeles, CA" defaultValue="Los Angeles, CA" />
                </div>
              </div>
            </Card>

            {/* Business Information */}
            <Card className="p-6 mb-6">
              <h2 className="text-xl font-semibold mb-6">Business Information</h2>
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="business-name">Business Name (Optional)</Label>
                  <Input id="business-name" placeholder="Sarah Miller Media LLC" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tax-id">Tax ID / EIN (Optional)</Label>
                  <Input id="tax-id" placeholder="XX-XXXXXXX" />
                  <p className="text-sm text-muted-foreground">
                    For invoicing and payment purposes
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rate-card">Standard Rate Card Link (Optional)</Label>
                  <Input id="rate-card" placeholder="https://sarahmiller.com/rates" />
                  <p className="text-sm text-muted-foreground">
                    Share your standard pricing with brands
                  </p>
                </div>
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