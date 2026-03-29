import { Link } from "react-router";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Sidebar } from "../components/features/sidebar";
import { Search, Filter, Download, Plus } from "lucide-react";

export function DealHistoryPage() {
  const deals = [
    { id: 1, brand: "Glossier", campaign: "Spring Campaign", amount: "$8,500", status: "active", date: "Mar 1, 2026", deliverables: "4 pending", risks: 2 },
    { id: 2, brand: "Nike", campaign: "Sneaker Launch", amount: "$15,000", status: "review", date: "Mar 12, 2026", deliverables: "Not started", risks: 0 },
    { id: 3, brand: "Sephora", campaign: "Product Review", amount: "$3,200", status: "completed", date: "Feb 1, 2026", deliverables: "Completed", risks: 0 },
    { id: 4, brand: "Athletic Greens", campaign: "Q1 Partnership", amount: "$5,000", status: "active", date: "Jan 15, 2026", deliverables: "2 pending", risks: 1 },
    { id: 5, brand: "Lululemon", campaign: "Athleisure Collab", amount: "$12,000", status: "completed", date: "Jan 10, 2026", deliverables: "Completed", risks: 0 },
    { id: 6, brand: "Fenty Beauty", campaign: "Foundation Launch", amount: "$10,500", status: "completed", date: "Dec 5, 2025", deliverables: "Completed", risks: 0 },
  ];

  const getStatusDot = (status: string) => {
    switch (status) {
      case "active": return "bg-success";
      case "review": return "bg-warning";
      case "completed": return "bg-muted-foreground";
      default: return "bg-muted";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active": return "Active";
      case "review": return "Under Review";
      case "completed": return "Completed";
      default: return status;
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      
      <div className="flex-1 ml-64">
        <div className="p-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1>All Deals</h1>
                <p className="text-muted-foreground mt-1">View and manage all your brand partnerships</p>
              </div>
              <Link to="/app/p/upload">
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  New Deal
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="grid md:grid-cols-4 gap-px bg-border rounded-xl overflow-hidden mb-8">
              <div className="bg-white p-5">
                <p className="text-sm text-muted-foreground mb-1">Total Deals</p>
                <p className="text-2xl font-bold tracking-tight">24</p>
              </div>
              <div className="bg-white p-5">
                <p className="text-sm text-muted-foreground mb-1">Active</p>
                <p className="text-2xl font-bold tracking-tight">12</p>
              </div>
              <div className="bg-white p-5">
                <p className="text-sm text-muted-foreground mb-1">Total Earned (2026)</p>
                <p className="text-2xl font-bold tracking-tight">$48,500</p>
              </div>
              <div className="bg-white p-5">
                <p className="text-sm text-muted-foreground mb-1">Avg Deal Size</p>
                <p className="text-2xl font-bold tracking-tight">$7,250</p>
              </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search deals by brand or campaign..." className="pl-10 bg-white" />
              </div>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="w-4 h-4" />
                Filters
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="w-4 h-4" />
                Export
              </Button>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1 mb-6 border-b border-border pb-3">
              <Button size="sm" variant="secondary" className="rounded-full h-8 text-xs">All Deals</Button>
              <Button size="sm" variant="ghost" className="rounded-full h-8 text-xs">Active</Button>
              <Button size="sm" variant="ghost" className="rounded-full h-8 text-xs">Under Review</Button>
              <Button size="sm" variant="ghost" className="rounded-full h-8 text-xs">Completed</Button>
              <Button size="sm" variant="ghost" className="rounded-full h-8 text-xs">Archived</Button>
            </div>

            {/* Table */}
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Brand</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Campaign</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Amount</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Deliverables</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Risks</th>
                    <th className="text-right px-6 py-3 text-sm font-medium text-muted-foreground"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-white">
                  {deals.map((deal) => (
                    <tr key={deal.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-6 py-4 font-medium text-sm">{deal.brand}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{deal.campaign}</td>
                      <td className="px-6 py-4 font-medium text-sm">{deal.amount}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${getStatusDot(deal.status)}`}></span>
                          <span className="text-sm">{getStatusLabel(deal.status)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{deal.date}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{deal.deliverables}</td>
                      <td className="px-6 py-4">
                        {deal.risks > 0 ? (
                          <Badge variant="outline" className="text-xs text-accent border-accent/30">
                            {deal.risks} flag{deal.risks > 1 ? "s" : ""}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link to={`/app/p/${deal.id}`}>
                          <Button size="sm" variant="ghost" className="text-xs h-7">View</Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-muted-foreground">Showing 1-6 of 24 deals</p>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" disabled className="h-8 text-xs">Previous</Button>
                <Button size="sm" variant="secondary" className="h-8 w-8 text-xs p-0">1</Button>
                <Button size="sm" variant="outline" className="h-8 w-8 text-xs p-0">2</Button>
                <Button size="sm" variant="outline" className="h-8 w-8 text-xs p-0">3</Button>
                <Button size="sm" variant="outline" className="h-8 text-xs">Next</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
