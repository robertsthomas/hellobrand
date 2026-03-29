import { createBrowserRouter } from "react-router";
import { RootLayout } from "./components/layouts/root-layout";
import { AppLayout } from "./components/layouts/app-layout";
import { LandingPage } from "./pages/landing";
import { PricingPage } from "./pages/pricing";
import { WaitlistPage } from "./pages/waitlist";
import { LoginPage } from "./pages/login";
import { OnboardingPage } from "./pages/onboarding";
import { DashboardPage } from "./pages/dashboard";
import { NewDealPage } from "./pages/new-deal";
import { UploadContractPage } from "./pages/upload-contract";
import { DealDetailPage } from "./pages/deal-detail";
import { SettingsPage } from "./pages/settings";
import { ProfilePage } from "./pages/profile";
import { BillingPage } from "./pages/billing";
import { HelpPage } from "./pages/help";
import { DealHistoryPage } from "./pages/deal-history";
import { NotificationsPage } from "./pages/notifications";
import { AnalyticsPage } from "./pages/analytics";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      { index: true, Component: LandingPage },
      { path: "pricing", Component: PricingPage },
      { path: "waitlist", Component: WaitlistPage },
      { path: "login", Component: LoginPage },
    ],
  },
  {
    path: "/app",
    Component: AppLayout,
    children: [
      { path: "dashboard", Component: DashboardPage },
      { index: true, Component: DashboardPage },
      { path: "onboarding", Component: OnboardingPage },
      { path: "p/new", Component: NewDealPage },
      { path: "p/upload", Component: UploadContractPage },
      { path: "p/:id", Component: DealDetailPage },
      { path: "p/history", Component: DealHistoryPage },
      { path: "notifications", Component: NotificationsPage },
      { path: "analytics", Component: AnalyticsPage },
      { path: "settings", Component: SettingsPage },
      { path: "profile", Component: ProfilePage },
      { path: "billing", Component: BillingPage },
      { path: "help", Component: HelpPage },
    ],
  },
]);