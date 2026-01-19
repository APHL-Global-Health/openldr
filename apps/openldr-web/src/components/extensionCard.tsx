import React from "react";

interface ExtensionCardProps {
  extension: {
    id: string;
    name: string;
    description: string;
    author: string;
    version: string;
    downloadCount: number;
    rating: number;
    iconUrl?: string;
  };
  onInstall: (extensionId: string) => void;
  installed: boolean;
}

export const ExtensionCard: React.FC<ExtensionCardProps> = ({
  extension,
  onInstall,
  installed,
}) => {
  return (
    <div className="border rounded-lg p-4 hover:shadow-lg transition-shadow">
      <div className="flex items-start gap-4">
        {extension.iconUrl ? (
          <img
            src={extension.iconUrl}
            alt={extension.name}
            className="w-16 h-16 rounded"
          />
        ) : (
          <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center">
            <span className="text-2xl">📦</span>
          </div>
        )}

        <div className="flex-1">
          <h3 className="text-lg font-semibold">{extension.name}</h3>
          <p className="text-sm text-gray-600">{extension.author}</p>
          <p className="text-sm mt-2">{extension.description}</p>

          <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
            <span>{extension.rating.toFixed(1)}</span>
            <span>⬇{extension.downloadCount.toLocaleString()}</span>
            <span>v{extension.version}</span>
          </div>
        </div>

        <button
          onClick={() => onInstall(extension.id)}
          disabled={installed}
          className={`px-4 py-2 rounded ${
            installed
              ? "bg-gray-300 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          {installed ? "Installed" : "Install"}
        </button>
      </div>
    </div>
  );
};
