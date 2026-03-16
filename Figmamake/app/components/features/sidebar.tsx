import { Link, useLocation } from "react-router";
import { LayoutDashboard, Briefcase, BarChart3, Bell, HelpCircle, User, Settings, Moon } from "lucide-react";

export function Sidebar() {
  const location = useLocation();
  
  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/app/dashboard" },
    { icon: Briefcase, label: "All deals", path: "/app/deals/history" },
    { icon: BarChart3, label: "Analytics", path: "/app/analytics" },
    { icon: Bell, label: "Notifications", path: "/app/notifications" },
    { icon: HelpCircle, label: "Help", path: "/app/help" },
  ];

  const bottomItems = [
    { icon: User, label: "Profile", path: "/app/profile" },
    { icon: Settings, label: "Settings", path: "/app/settings" },
  ];

  const isActive = (path: string) => {
    if (path === "/app/dashboard") {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="w-64 h-screen bg-white border-r border-border flex flex-col fixed left-0 top-0">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-xs">H</span>
          </div>
          <span className="font-bold text-foreground tracking-tight text-sm">HelloBrand</span>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-3 px-3 py-2 transition-colors ${
              isActive(item.path)
                ? "bg-secondary/50 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <item.icon className="w-4 h-4" />
            <span className="text-sm">{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Bottom Section */}
      <div className="px-4 pb-6 space-y-1 border-t border-border pt-4">
        {/* Bottom Nav Items */}
        {bottomItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-3 px-3 py-2 transition-colors ${
              isActive(item.path)
                ? "bg-secondary/50 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <item.icon className="w-4 h-4" />
            <span className="text-sm">{item.label}</span>
          </Link>
        ))}

        {/* User Profile */}
        <div className="pt-4 mt-3 border-t border-border">
          <div className="flex items-center gap-2.5 px-3 py-2">
            <div className="w-7 h-7 bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-xs font-medium">SM</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">Sarah Miller</p>
              <p className="text-xs text-muted-foreground truncate">@sarahmiller</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}