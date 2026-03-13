import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Sidebar } from "../components/features/sidebar";
import { Bell, CheckCircle2, AlertTriangle, DollarSign, FileText, Calendar, Settings } from "lucide-react";

export function NotificationsPage() {
  const notifications = [
    {
      id: 1,
      type: "payment",
      title: "Payment Overdue",
      message: "Glossier payment is 7 days overdue ($4,250)",
      time: "2 hours ago",
      read: false,
      icon: DollarSign,
      iconColor: "text-accent",
      iconBg: "bg-accent/10",
    },
    {
      id: 2,
      type: "deadline",
      title: "Upcoming Deadline",
      message: "Instagram Reel for Glossier due in 3 days",
      time: "5 hours ago",
      read: false,
      icon: Calendar,
      iconColor: "text-warning",
      iconBg: "bg-warning/10",
    },
    {
      id: 3,
      type: "risk",
      title: "Contract Risk Detected",
      message: "Nike contract has 2 risk flags to review",
      time: "1 day ago",
      read: false,
      icon: AlertTriangle,
      iconColor: "text-accent",
      iconBg: "bg-accent/10",
    },
    {
      id: 4,
      type: "success",
      title: "Deliverable Approved",
      message: "Your Instagram Stories were approved by Glossier",
      time: "2 days ago",
      read: true,
      icon: CheckCircle2,
      iconColor: "text-success",
      iconBg: "bg-success/10",
    },
    {
      id: 5,
      type: "contract",
      title: "New Contract Uploaded",
      message: "Nike Sneaker Launch contract processing complete",
      time: "2 days ago",
      read: true,
      icon: FileText,
      iconColor: "text-primary",
      iconBg: "bg-primary/10",
    },
    {
      id: 6,
      type: "payment",
      title: "Payment Received",
      message: "Athletic Greens paid $2,500 (50% upfront)",
      time: "3 days ago",
      read: true,
      icon: DollarSign,
      iconColor: "text-success",
      iconBg: "bg-success/10",
    },
  ];

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      
      <div className="flex-1 ml-64">
        <div className="p-8">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-semibold mb-2">Notifications</h1>
                <p className="text-muted-foreground">
                  Stay updated on your deals and contracts
                </p>
              </div>
              <Button variant="outline" size="sm" className="gap-2">
                <Settings className="w-4 h-4" />
                Settings
              </Button>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mb-6">
              <Button size="sm" variant="outline">Mark All as Read</Button>
              <Button size="sm" variant="outline">Clear Read</Button>
            </div>

            {/* Filters */}
            <div className="flex gap-2 mb-6">
              <Button size="sm" variant="secondary">All</Button>
              <Button size="sm" variant="ghost">Unread</Button>
              <Button size="sm" variant="ghost">Payments</Button>
              <Button size="sm" variant="ghost">Deadlines</Button>
              <Button size="sm" variant="ghost">Risks</Button>
            </div>

            {/* Notifications List */}
            <div className="space-y-3">
              {notifications.map((notification) => {
                const Icon = notification.icon;
                return (
                  <Card
                    key={notification.id}
                    className={`p-6 hover:shadow-md transition-shadow ${
                      !notification.read ? "border-primary/30 bg-primary/5" : ""
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-lg ${notification.iconBg} flex items-center justify-center shrink-0`}>
                        <Icon className={`w-6 h-6 ${notification.iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold">{notification.title}</h4>
                              {!notification.read && (
                                <div className="w-2 h-2 rounded-full bg-primary"></div>
                              )}
                            </div>
                            <p className="text-muted-foreground">{notification.message}</p>
                          </div>
                          <span className="text-sm text-muted-foreground whitespace-nowrap">
                            {notification.time}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">View Details</Button>
                          {!notification.read && (
                            <Button size="sm" variant="ghost">Mark as Read</Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Empty State (hidden when there are notifications) */}
            {notifications.length === 0 && (
              <Card className="p-12 text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-secondary mb-6">
                  <Bell className="w-10 h-10 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">You're all caught up!</h3>
                <p className="text-muted-foreground">
                  No new notifications at this time.
                </p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}