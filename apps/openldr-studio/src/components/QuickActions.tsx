import { FileBarChart, Upload, Download, Eye } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NavLink } from "react-router-dom";

export function QuickActions() {
  return (
    <Card className="rounded-xs">
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Common AMR surveillance tasks</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <NavLink to="/reports">
            <Button
              variant="outline"
              className="w-full h-auto flex-col gap-2 py-4"
            >
              <FileBarChart className="h-5 w-5" />
              <div className="text-sm font-medium">View Reports</div>
              <div className="text-xs text-muted-foreground">
                AMR surveillance
              </div>
            </Button>
          </NavLink>

          <NavLink to="/uploads">
            <Button
              variant="outline"
              className="w-full h-auto flex-col gap-2 py-4"
            >
              <Upload className="h-5 w-5" />
              <div className="text-sm font-medium">Upload Data</div>
              <div className="text-xs text-muted-foreground">WHONET file</div>
            </Button>
          </NavLink>

          <NavLink to="/batches">
            <Button
              variant="outline"
              className="w-full h-auto flex-col gap-2 py-4"
            >
              <Eye className="h-5 w-5" />
              <div className="text-sm font-medium">View Batches</div>
              <div className="text-xs text-muted-foreground">
                Recent uploads
              </div>
            </Button>
          </NavLink>

          <Button
            variant="outline"
            className="w-full h-auto flex-col gap-2 py-4"
          >
            <Download className="h-5 w-5" />
            <div className="text-sm font-medium">Export Data</div>
            <div className="text-xs text-muted-foreground">CSV/PDF</div>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
