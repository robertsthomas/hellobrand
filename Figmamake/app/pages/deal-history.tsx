import { Link } from "react-router";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Sidebar } from "../components/features/sidebar";
import { Search, Filter, Download } from "lucide-react";

export function DealHistoryPage() {
  const deals = [
    {
      id: 1,
      brand: "Glossier",
      campaign: "Spring Campaign",
      amount: "$8,500",
      status: "active",
      date: "Mar 1, 2026",
      deliverables: "4 pending",
      risks: 2,
    },
    {
      id: 2,
      brand: "Nike",
      campaign: "Sneaker Launch",
      amount: "$15,000",
      status: "review",
      date: "Mar 12, 2026",
      deliverables: "Not started",
      risks: 0,
    },
    {
      id: 3,
      brand: "Sephora",
      campaign: "Product Review",
      amount: "$3,200",
      status: "completed",
      date: "Feb 1, 2026",
      deliverables: "Completed",
      risks: 0,
    },
    {
      id: 4,
      brand: "Athletic Greens",
      campaign: "Q1 Partnership",
      amount: "$5,000",
      status: "active",
      date: "Jan 15, 2026",
      deliverables: "2 pending",
      risks: 1,
    },
    {
      id: 5,
      brand: "Lululemon",
      campaign: "Athleisure Collab",
      amount: "$12,000",
      status: "completed",
      date: "Jan 10, 2026",
      deliverables: "Completed",
      risks: 0,
    },
    {
      id: 6,
      brand: "Fenty Beauty",
      campaign: "Foundation Launch",
      amount: "$10,500",
      status: "completed",
      date: "Dec 5, 2025",
      deliverables: "Completed",
      risks: 0,
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-success/10 text-success hover:bg-success/20">Active</Badge>;
      case "review":
        return <Badge className="bg-warning/10 text-warning hover:bg-warning/20">Under Review</Badge>;
      case "completed":
        return <Badge className="bg-muted text-muted-foreground hover:bg-muted">Completed</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      
      <div className="flex-1 ml-64">
        <div className="p-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-semibold mb-2">All Deals</h1>
              <p className="text-muted-foreground">
                View and manage all your brand partnerships
              </p>
            </div>

            {/* Filters */}
            <Card className="p-6 mb-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search deals by brand or campaign..."
                    className="pl-10"
                  />
                </div>
                <Button variant="outline" className="gap-2">
                  <Filter className="w-4 h-4" />
                  Filters
                </Button>
                <Button variant="outline" className="gap-2">
                  <Download className="w-4 h-4" />
                  Export
                </Button>
              </div>

              <div className="flex gap-2 mt-4">
                <Button size="sm" variant="secondary">All Deals</Button>
                <Button size="sm" variant="ghost">Active</Button>
                <Button size="sm" variant="ghost">Under Review</Button>
                <Button size="sm" variant="ghost">Completed</Button>
                <Button size="sm" variant="ghost">Archived</Button>
              </div>
            </Card>

            {/* Summary Stats */}
            <div className="grid md:grid-cols-4 gap-4 mb-6">
              <Card className="p-4">
                <p className="text-sm text-muted-foreground mb-1">Total Deals</p>
                <p className="text-2xl font-semibold">24</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground mb-1">Active</p>
                <p className="text-2xl font-semibold">12</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground mb-1">Total Earned (2026)</p>
                <p className="text-2xl font-semibold">$48,500</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground mb-1">Avg Deal Size</p>
                <p className="text-2xl font-semibold">$7,250</p>
              </Card>
            </div>

            {/* Deals Table */}
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-4 font-semibold">Brand</th>
                      <th className="text-left p-4 font-semibold">Campaign</th>
                      <th className="text-left p-4 font-semibold">Amount</th>
                      <th className="text-left p-4 font-semibold">Status</th>
                      <th className="text-left p-4 font-semibold">Date</th>
                      <th className="text-left p-4 font-semibold">Deliverables</th>
                      <th className="text-left p-4 font-semibold">Risks</th>
                      <th className="text-right p-4 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deals.map((deal) => (
                      <tr key={deal.id} className="border-b border-border hover:bg-secondary/30 transition-colors">
                        <td className="p-4 font-medium">{deal.brand}</td>
                        <td className="p-4 text-muted-foreground">{deal.campaign}</td>
                        <td className="p-4 font-semibold">{deal.amount}</td>
                        <td className="p-4">{getStatusBadge(deal.status)}</td>
                        <td className="p-4 text-sm text-muted-foreground">{deal.date}</td>
                        <td className="p-4 text-sm text-muted-foreground">{deal.deliverables}</td>
                        <td className="p-4">
                          {deal.risks > 0 ? (
                            <Badge variant="outline" className="text-accent border-accent/30">
                              {deal.risks} flag{deal.risks > 1 ? "s" : ""}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">None</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <Link to={`/app/deals/${deal.id}`}>
                            <Button size="sm" variant="ghost">View</Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-muted-foreground">
                Showing 1-6 of 24 deals
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled>Previous</Button>
                <Button size="sm" variant="outline">1</Button>
                <Button size="sm" variant="secondary">2</Button>
                <Button size="sm" variant="outline">3</Button>
                <Button size="sm" variant="outline">4</Button>
                <Button size="sm" variant="outline">Next</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}