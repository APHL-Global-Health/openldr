import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Building2,
  MapPin,
  Users,
  Database,
  Search,
  Eye,
  Edit,
  Trash2,
  Plus,
  Loader2,
} from "lucide-react";
import { formatBytes } from "@/lib/utils";

const ENV = import.meta.env;
const apiUrl = ENV.VITE_API_BASE_URL || "";

interface Lab {
  id: string;
  labCode: string;
  labName: string;
  labType: string;
  province: string;
  region: string;
  district: string;
  status: string;
  minioBucket: string;
  userCount: number;
  activeUsers: number;
  batchCount: number;
  isolateCount: number;
  storage?: {
    objectCount: number;
    totalSize: number;
  };
}

const labTypeColors: Record<string, string> = {
  national:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  regional: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  district: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  hospital:
    "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  private: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  research:
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
};

export function LabList({ onSelectLab }: { onSelectLab?: (lab: Lab) => void }) {
  const [labs, setLabs] = useState<Lab[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");

  useEffect(() => {
    fetchLabs();
  }, []);

  const fetchLabs = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/v1/labs`);
      const data = await response.json();

      if (data.success) {
        setLabs(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch labs:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLabs = labs.filter((lab) => {
    const matchesSearch =
      lab.labCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lab.labName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lab.province.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = filterType === "all" || lab.labType === filterType;

    return matchesSearch && matchesType;
  });

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <CardTitle>Registered Laboratories</CardTitle>
            </div>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Laboratory
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by code, name, or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              className="px-3 py-2 border rounded-md"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="national">National</option>
              <option value="regional">Regional</option>
              <option value="district">District</option>
              <option value="hospital">Hospital</option>
              <option value="private">Private</option>
              <option value="research">Research</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Lab Cards */}
      {filteredLabs.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">No laboratories found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredLabs.map((lab) => (
            <Card key={lab.id} className="hover:bg-accent/50 transition-colors">
              <CardContent className="p-6">
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{lab.labCode}</h3>
                        <Badge
                          variant={
                            lab.status === "active" ? "default" : "secondary"
                          }
                        >
                          {lab.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {lab.labName}
                      </p>
                    </div>
                    <Badge className={labTypeColors[lab.labType]}>
                      {lab.labType}
                    </Badge>
                  </div>

                  {/* Location */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>
                      {lab.district}, {lab.region}
                    </span>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" />
                        Users
                      </div>
                      <p className="text-lg font-semibold">
                        {lab.activeUsers || 0}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Database className="h-3 w-3" />
                        Batches
                      </div>
                      <p className="text-lg font-semibold">
                        {lab.batchCount || 0}
                      </p>
                    </div>
                  </div>

                  {/* Storage */}
                  {lab.storage && (
                    <div className="pt-3 border-t">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Storage</span>
                        <span className="font-medium">
                          {formatBytes(lab.storage.totalSize)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs mt-1">
                        <span className="text-muted-foreground">Files</span>
                        <span className="font-medium">
                          {lab.storage.objectCount}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => onSelectLab?.(lab)}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </Button>
                    <Button size="sm" variant="outline">
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="outline">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
