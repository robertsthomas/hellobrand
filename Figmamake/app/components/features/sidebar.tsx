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
    <div className="w-64 h-screen bg-[#F5F3F0] border-r border-[#E8E3DC] flex flex-col fixed left-0 top-0">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-[#E8E3DC]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-semibold text-lg">H</span>
          </div>
          <span className="font-semibold text-foreground">HelloBrand</span>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
              isActive(item.path)
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-secondary/50"
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-sm font-medium">{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Bottom Section */}
      <div className="px-3 pb-6 space-y-4">
        {/* Dark Mode Toggle */}
        <div className="px-3 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Moon className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Dark mode</span>
          </div>
          <div className="w-10 h-6 rounded-full bg-secondary relative cursor-pointer">
            <div className="absolute left-1 top-1 w-4 h-4 rounded-full bg-background"></div>
          </div>
        </div>

        {/* Bottom Nav Items */}
        {bottomItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
              isActive(item.path)
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-secondary/50"
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-sm font-medium">{item.label}</span>
          </Link>
        ))}

        {/* User Profile */}
        <div className="pt-4 border-t border-[#E8E3DC]">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <span className="text-primary-foreground font-semibold">DC</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">Demo Creator</p>
              <p className="text-xs text-muted-foreground truncate">@democreator</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
