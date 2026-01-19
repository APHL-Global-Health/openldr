import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export function SettingsStorage() {
  return (
    <div className="flex w-full h-full justify-center overflow-y-auto py-8">
      <Card className="w-3xl h-55 rounded-sm">
        <CardHeader>
          <CardTitle>Storage</CardTitle>
          <CardDescription></CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="flex py-4">
          <div className="flex flex-1 flex-row justify-between space-x-4"></div>
        </CardContent>
      </Card>
    </div>
  );
}
