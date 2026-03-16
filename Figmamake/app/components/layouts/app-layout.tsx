import { Outlet } from "react-router";

export function AppLayout() {
  return (
    <div className="min-h-screen">
      <Outlet />
    </div>
  );
}
