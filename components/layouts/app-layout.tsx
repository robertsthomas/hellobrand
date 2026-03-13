import { Outlet, Link, useLocation } from "react-router";
import { Bell, FileText, Home, Settings, BarChart3, Archive, HelpCircle, User } from "lucide-react";
import { Button } from "../ui/button";
import { Avatar, AvatarFallback } from "../ui/avatar";

export function AppLayout() {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/app" && location.pathname === "/app") return true;
    if (path !== "/app" && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-secondary/30 flex flex-col">
        <div className="p-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-semibold">H</span>
            </div>
            <span className="text-xl font-semibold tracking-tight">HelloBrand</span>
          </Link>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          <Link to="/app">
            <Button
              variant={isActive("/app") ? "secondary" : "ghost"}
              className="w-full justify-start"
            >
              <Home className="w-4 h-4 mr-3" />
              Dashboard
            </Button>
          </Link>
          <Link to="/app/deals/history">
            <Button
              variant={isActive("/app/deals/history") ? "secondary" : "ghost"}
              className="w-full justify-start"
            >
              <Archive className="w-4 h-4 mr-3" />
              All Deals
            </Button>
          </Link>
          <Link to="/app/analytics">
            <Button
              variant={isActive("/app/analytics") ? "secondary" : "ghost"}
              className="w-full justify-start"
            >
              <BarChart3 className="w-4 h-4 mr-3" />
              Analytics
            </Button>
          </Link>
          <Link to="/app/notifications">
            <Button
              variant={isActive("/app/notifications") ? "secondary" : "ghost"}
              className="w-full justify-start"
            >
              <Bell className="w-4 h-4 mr-3" />
              Notifications
            </Button>
          </Link>
          <Link to="/app/help">
            <Button
              variant={isActive("/app/help") ? "secondary" : "ghost"}
              className="w-full justify-start"
            >
              <HelpCircle className="w-4 h-4 mr-3" />
              Help
            </Button>
          </Link>
        </nav>

        <div className="p-3 space-y-1 border-t border-border">
          <Link to="/app/profile">
            <Button
              variant={isActive("/app/profile") ? "secondary" : "ghost"}
              className="w-full justify-start"
            >
              <User className="w-4 h-4 mr-3" />
              Profile
            </Button>
          </Link>
          <Link to="/app/settings">
            <Button
              variant={isActive("/app/settings") ? "secondary" : "ghost"}
              className="w-full justify-start"
            >
              <Settings className="w-4 h-4 mr-3" />
              Settings
            </Button>
          </Link>
        </div>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback className="bg-primary text-primary-foreground">
                SM
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">Sarah Miller</p>
              <p className="text-xs text-muted-foreground truncate">@sarahmiller</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
