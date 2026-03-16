import { Button } from "../components/ui/button";
import { Sidebar } from "../components/features/sidebar";
import { Bell, CheckCircle2, AlertTriangle, DollarSign, FileText, Calendar, Settings } from "lucide-react";

export function NotificationsPage() {
  const notifications = [
    { id: 1, type: "payment", title: "Payment Overdue", message: "Glossier payment is 7 days overdue ($4,250)", time: "2 hours ago", read: false, icon: DollarSign, dotColor: "bg-accent" },
    { id: 2, type: "deadline", title: "Upcoming Deadline", message: "Instagram Reel for Glossier due in 3 days", time: "5 hours ago", read: false, icon: Calendar, dotColor: "bg-warning" },
    { id: 3, type: "risk", title: "Contract Risk Detected", message: "Nike contract has 2 risk flags to review", time: "1 day ago", read: false, icon: AlertTriangle, dotColor: "bg-accent" },
    { id: 4, type: "success", title: "Deliverable Approved", message: "Your Instagram Stories were approved by Glossier", time: "2 days ago", read: true, icon: CheckCircle2, dotColor: "bg-success" },
    { id: 5, type: "contract", title: "New Contract Uploaded", message: "Nike Sneaker Launch contract processing complete", time: "2 days ago", read: true, icon: FileText, dotColor: "bg-primary" },
    { id: 6, type: "payment", title: "Payment Received", message: "Athletic Greens paid $2,500 (50% upfront)", time: "3 days ago", read: true, icon: DollarSign, dotColor: "bg-success" },
  ];

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      
      <div className="flex-1 ml-64">
        <div className="p-8">
          <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1>Notifications</h1>
                <p className="text-muted-foreground mt-1">Stay updated on your deals and contracts</p>
              </div>
              <Button variant="outline" size="sm" className="gap-2">
                <Settings className="w-4 h-4" />
                Settings
              </Button>
            </div>

            {/* Actions & Filters */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
              <div className="flex gap-1">
                <Button size="sm" variant="secondary" className="rounded-full h-8 text-xs">All</Button>
                <Button size="sm" variant="ghost" className="rounded-full h-8 text-xs">Unread</Button>
                <Button size="sm" variant="ghost" className="rounded-full h-8 text-xs">Payments</Button>
                <Button size="sm" variant="ghost" className="rounded-full h-8 text-xs">Deadlines</Button>
                <Button size="sm" variant="ghost" className="rounded-full h-8 text-xs">Risks</Button>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" className="text-xs h-7">Mark All Read</Button>
                <Button size="sm" variant="ghost" className="text-xs h-7">Clear Read</Button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="divide-y divide-border">
              {notifications.map((notification) => {
                const Icon = notification.icon;
                return (
                  <div
                    key={notification.id}
                    className={`flex items-start gap-4 py-5 ${!notification.read ? "bg-primary/[0.02]" : ""}`}
                  >
                    <div className="relative shrink-0">
                      <div className={`w-9 h-9 rounded-lg bg-secondary flex items-center justify-center`}>
                        <Icon className="w-4 h-4 text-muted-foreground" />
                      </div>
                      {!notification.read && (
                        <div className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${notification.dotColor} border-2 border-background`}></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className={`font-medium text-sm ${!notification.read ? "text-foreground" : "text-muted-foreground"}`}>
                            {notification.title}
                          </p>
                          <p className="text-sm text-muted-foreground mt-0.5">{notification.message}</p>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{notification.time}</span>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" variant="outline" className="h-7 text-xs">View Details</Button>
                        {!notification.read && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs">Mark Read</Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {notifications.length === 0 && (
              <div className="py-16 text-center">
                <Bell className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
                <h3>You're all caught up!</h3>
                <p className="text-sm text-muted-foreground mt-1">No new notifications at this time.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
