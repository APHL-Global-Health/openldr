import React, { useEffect, useState } from "react";
import * as exts from "@openldr/extensions";

interface PermissionRequest {
  extensionId: string;
  permission: exts.types.Permission;
  reason?: string;
  resolve: (granted: boolean) => void;
}

export const PermissionDialog: React.FC = () => {
  const [request, setRequest] = useState<PermissionRequest | null>(null);

  useEffect(() => {
    const handlePermissionRequest = (event: CustomEvent<PermissionRequest>) => {
      setRequest(event.detail);
    };

    window.addEventListener(
      "extension:permission-request" as any,
      handlePermissionRequest
    );

    return () => {
      window.removeEventListener(
        "extension:permission-request" as any,
        handlePermissionRequest
      );
    };
  }, []);

  if (!request) return null;

  const handleGrant = () => {
    request.resolve(true);
    setRequest(null);
  };

  const handleDeny = () => {
    request.resolve(false);
    setRequest(null);
  };

  const permissionDescriptions: Record<exts.types.Permission, string> = {
    [exts.types.Permission.FILE_READ]: "Read files from your workspace",
    [exts.types.Permission.FILE_WRITE]:
      "Write and modify files in your workspace",
    [exts.types.Permission.NETWORK_HTTP]:
      "Make HTTP requests to external servers",
    [exts.types.Permission.NETWORK_WEBSOCKET]:
      "Establish WebSocket connections",
    [exts.types.Permission.STORAGE_LOCAL]: "Store data locally on your device",
    [exts.types.Permission.STORAGE_SYNC]: "Sync data across devices",
    [exts.types.Permission.UI_SIDEBAR]: "Add components to the sidebar",
    [exts.types.Permission.UI_PANEL]: "Add panels to the interface",
    [exts.types.Permission.UI_TOOLBAR]: "Add buttons to the toolbar",
    [exts.types.Permission.UI_MODAL]: "Show modal dialogs",
    [exts.types.Permission.UI_STATUSBAR]: "Add items to the status bar",
    [exts.types.Permission.UI_NOTIFICATIONS]: "Show notifications",
    [exts.types.Permission.COMMANDS_EXECUTE]: "Execute application commands",
    [exts.types.Permission.COMMANDS_REGISTER]: "Register new commands",
    [exts.types.Permission.CLIPBOARD_READ]: "Read from clipboard",
    [exts.types.Permission.CLIPBOARD_WRITE]: "Write to clipboard",
    [exts.types.Permission.WORKSPACE_READ]: "Read workspace configuration",
    [exts.types.Permission.WORKSPACE_WRITE]: "Modify workspace configuration",
    [exts.types.Permission.SETTINGS_READ]: "Read application settings",
    [exts.types.Permission.SETTINGS_WRITE]: "Modify application settings",
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
        <h2 className="text-xl font-bold mb-4">Permission Request</h2>

        <div className="mb-4">
          <p className="text-gray-700 mb-2">
            Extension <strong>{request.extensionId}</strong> is requesting
            permission to:
          </p>
          <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
            <p className="font-medium text-yellow-900">
              {permissionDescriptions[request.permission]}
            </p>
          </div>
        </div>

        {request.reason && (
          <div className="mb-4">
            <p className="text-sm text-gray-600">
              <strong>Reason:</strong> {request.reason}
            </p>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            onClick={handleDeny}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
          >
            Deny
          </button>
          <button
            onClick={handleGrant}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  );
};
