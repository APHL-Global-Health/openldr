import { useEffect, useState } from "react";

import {
  Star,
  Download,
  Calendar,
  Package,
  CheckCircle,
  XCircle,
  RefreshCw,
  Trash2,
  ExternalLink,
  FileText,
  Shield,
  Code,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ReactMarkdown from "react-markdown";
import * as exts from "@openldr/extensions";
import { Separator } from "@/components/ui/separator";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useKeycloakClient } from "@/components/react-keycloak-provider";
import { useExtensions } from "@/hooks/misc/useExtensions";
import useWindowSize from "@/hooks/misc/useWindowSize";
import { useSideBarContext } from "@/components/sidebar-provider";

interface ExtensionInfoPageProps {
  // manifest: exts.types.ExtensionManifest;
  extension: any;
  // onUnload?: (manifest: exts.types.ExtensionManifest) => void;
  onUnload?: (extension: any) => void;
}

const formatDate = (dateString) => {
  const date: any = new Date(dateString);
  const now: any = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
};

const renderStars = (rating) => {
  const stars: any = [];
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;

  for (let i = 0; i < 5; i++) {
    if (i < fullStars) {
      stars.push(<Star key={i} size={14} fill="#FFB900" stroke="#FFB900" />);
    } else if (i === fullStars && hasHalfStar) {
      stars.push(
        <div key={i} className="relative inline-block">
          <Star size={14} stroke="#FFB900" fill="none" />
          <div className="absolute top-0 left-0 w-1/2 overflow-hidden">
            <Star size={14} fill="#FFB900" stroke="#FFB900" />
          </div>
        </div>
      );
    } else {
      stars.push(<Star key={i} size={14} stroke="#FFB900" fill="none" />);
    }
  }
  return stars;
};

const ExtensionInfoPage: React.FC<ExtensionInfoPageProps> = ({
  extension,
  onUnload,
}) => {
  const client = useKeycloakClient();
  const extensionsHook = useExtensions(client.kc.token);

  const windowSize = useWindowSize();
  const sideBarContext = useSideBarContext();
  const isCollapsed = sideBarContext?.isCollapsed ?? false;

  // const [isInstalled, setIsInstalled] = useState(extension?.installed || false);
  // const [isEnabled, setIsEnabled] = useState(extension?.enabled || false);

  // Check if we have loaded user extensions at least once
  const hasLoadedUserExtensions =
    !extensionsHook.loading || extensionsHook.userExtensions.length > 0;

  // Get the user extension data from the hook
  const userExtension = extensionsHook.getUserExtension(extension.extensionId);

  // Derive state from userExtensions data - but only after we've loaded
  const isInstalled = hasLoadedUserExtensions
    ? extensionsHook.isInstalled(extension.extensionId)
    : false;
  const isEnabled = userExtension?.status === "enabled";

  let latestVersion: any = null;
  if (extension.versions && extension.versions.length > 0) {
    latestVersion = extension.versions[0];
  }

  const handleInstall = async () => {
    if (extension && latestVersion) {
      await extensionsHook.install(
        extension.extensionId,
        latestVersion.versionId
      );
      // setIsInstalled(true);
      // setIsEnabled(true);
    }
  };

  const handleUninstall = async () => {
    if (extension && latestVersion) {
      await extensionsHook.uninstall(extension.extensionId);
      // setIsInstalled(false);
      // setIsEnabled(false);
    }
  };

  const handleToggleEnable = async () => {
    if (extension && latestVersion) {
      if (!isEnabled) {
        await extensionsHook.enable(extension.extensionId);
      } else {
        await extensionsHook.disable(extension.extensionId);
      }

      // setIsEnabled(!isEnabled);
    }
  };

  const unloadExtension = async () => {
    try {
      if (extension) {
        await exts.runtime.extensionLoader.extensionLoader.unloadExtension(
          extension.packageId
        );
        if (onUnload) {
          onUnload(extension);
        }
      }
    } catch (err) {
      console.error("Failed to unload extension:", err);
    }
  };

  return (
    <>
      {/* Main Content */}
      <div
        className="flex-1 flex  flex-col overflow-hidden"
        style={{
          maxWidth: `${windowSize.width - (isCollapsed ? 300 + 256 + 48 : 300 + 256 + 196)}px`,
        }}
      >
        {/* Header */}
        <div className="p-5 border-b border-border">
          {/* Extension Title */}
          <div className="flex items-center gap-4 mb-3">
            <img
              src={extension.iconUrl}
              alt={extension.name}
              className="w-8 h-8 max-w-8 max-h-8 flex items-center justify-center text-[16px] font-bold text-background shrink-0"
            />
            <div className="min-w-0 flex-1">
              {" "}
              {/* Changed from w-full to min-w-0 flex-1 */}
              <div className="min-w-0">
                {" "}
                {/* Changed from flex-1 to min-w-0 */}
                <h1 className="text-2xl font-normal text-foreground mb-1">
                  <p className="truncate">{extension.name}</p>
                </h1>
                <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <p className="truncate">{extension.author}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-foreground leading-relaxed truncate mb-1">
            {extension.description}
          </p>

          {/* Stats */}
          <div className="flex gap-5 text-sm mb-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              {renderStars(extension.rating)}
              <span className="ml-1 text-muted-foreground">
                ({extension.ratingCount})
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar size={14} />
              <span>Updated {formatDate(extension.lastUpdated)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 items-center">
            {!hasLoadedUserExtensions ? (
              <div className="h-6 w-24 bg-muted animate-pulse rounded-sm" />
            ) : !isInstalled ? (
              <Button onClick={handleInstall} size="sm" className="rounded-xs">
                <Download size={14} />
                Install
              </Button>
            ) : (
              <>
                <Button
                  onClick={handleToggleEnable}
                  variant={isEnabled ? "secondary" : "default"}
                  size="sm"
                  className="rounded-xs"
                >
                  {isEnabled ? (
                    <>
                      <XCircle size={14} />
                      Disable
                    </>
                  ) : (
                    <>
                      <CheckCircle size={14} />
                      Enable
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleUninstall}
                  variant="outline"
                  size="sm"
                  className="rounded-xs"
                >
                  <Trash2 size={14} />
                  Uninstall
                </Button>
              </>
            )}
            <div className="ml-auto">
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Settings size={14} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-40" align="end">
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      onSelect={() => {
                        unloadExtension();
                      }}
                    >
                      Unload
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              {/* <Button variant="outline" size="icon">
                <Settings size={14} />
              </Button> */}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs
          defaultValue="details"
          className="flex-1 flex flex-col bg-transparent overflow-hidden "
        >
          <TabsList className="bg-background rounded-none border-b w-full p-0">
            <TabsTrigger
              value="details"
              disabled={!extension.readme}
              className="gap-1.5 bg-background data-[state=active]:border-primary dark:data-[state=active]:border-primary h-full rounded-none border-0 border-b-2 border-transparent data-[state=active]:shadow-none"
            >
              <FileText size={14} />
              Details
            </TabsTrigger>
            <TabsTrigger
              value="features"
              disabled={!extension.features}
              className="gap-1.5 bg-background data-[state=active]:border-primary dark:data-[state=active]:border-primary h-full rounded-none border-0 border-b-2 border-transparent data-[state=active]:shadow-none"
            >
              <Package size={14} />
              Features
            </TabsTrigger>
            <TabsTrigger
              value="changelog"
              disabled={!extension.changelog}
              className="gap-1.5 bg-background data-[state=active]:border-primary dark:data-[state=active]:border-primary h-full rounded-none border-0 border-b-2 border-transparent data-[state=active]:shadow-none"
            >
              <RefreshCw size={14} />
              Changelog
            </TabsTrigger>
          </TabsList>

          {/* Content */}
          <div className="flex-1 overflow-auto p-6  scrollbar-vscode">
            <TabsContent value="details" className="mt-0">
              <div className="max-w-225 markdown-body">
                <ReactMarkdown>{extension.readme}</ReactMarkdown>
              </div>
            </TabsContent>

            <TabsContent value="changelog" className="mt-0">
              <div className="max-w-225 markdown-body">
                <ReactMarkdown>{extension.changelog}</ReactMarkdown>
              </div>
            </TabsContent>

            <TabsContent value="features" className="mt-0">
              <div className="max-w-225 markdown-body">
                <ReactMarkdown>{extension.features}</ReactMarkdown>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Sidebar */}
      <div className="w-75 max-w-75 border-l border-border p-5 overflow-auto text-sm scrollbar-vscode">
        <h3 className="text-[13px] font-semibold  uppercase tracking-wider mb-4">
          More Info
        </h3>

        {latestVersion && (
          <div className="mb-5">
            <div className="text-muted-foreground mb-1">Version</div>
            <div className="text-foreground">{latestVersion.version}</div>
          </div>
        )}

        <div className="mb-5">
          <div className="text-muted-foreground mb-1">License</div>
          <div className="text-foreground">{extension.license}</div>
        </div>

        <div className="mb-5">
          <div className="text-muted-foreground mb-1">Categories</div>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {(extension.categories || []).map((cat) => (
              <Badge key={cat} variant="outline">
                {cat}
              </Badge>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <div className="text-muted-foreground mb-1">Tags</div>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {(extension.tags || []).map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        <Separator className="my-6" />

        <h3 className="text-[13px] font-semibold text-white uppercase tracking-wider mb-4">
          Resources
        </h3>

        <div className="flex flex-col gap-3">
          <a
            href={extension.repositoryUrl}
            className="text-muted-foreground no-underline flex items-center gap-1.5 hover:underline"
          >
            <Code size={14} />
            Repository
            <ExternalLink size={12} className="ml-auto" />
          </a>
          <a
            href="#"
            className="text-muted-foreground no-underline flex items-center gap-1.5 hover:underline"
          >
            <Shield size={14} />
            License
            <ExternalLink size={12} className="ml-auto" />
          </a>
        </div>
      </div>
    </>
  );
};

export default ExtensionInfoPage;
