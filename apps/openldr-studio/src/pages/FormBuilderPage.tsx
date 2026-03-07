import { ContentLayout } from "@/components/admin-panel/content-layout";
import { BuilderSidebar } from "@/components/forms/builder/BuilderSidebar";
import { FormPreview } from "@/components/forms/builder/FormPreview";
import { SchemaView } from "@/components/forms/builder/SchemaView";
import { Separator } from "@/components/ui/separator";
import { useAppTranslation } from "@/i18n/hooks";
import { cn } from "@/lib/utils";
import { useActiveForm } from "@/store/formBuilderStore";
import type { TabId } from "@/types/forms";
import { useState } from "react";

const TABS = [
  { id: "preview" as TabId, label: "Preview" },
  { id: "schema" as TabId, label: "Schema" },
];

function LogsPage() {
  const { t } = useAppTranslation();

  const [activeTab, setActiveTab] = useState<TabId>("preview");
  const [mobileTab, setMobileTab] = useState<"builder" | "right">("builder");
  const activeForm = useActiveForm();

  const navComponents = () => {
    return (
      <div className="flex min-h-13 max-h-13 w-full items-center pr-2 py-2">
        <h1 className="font-bold">{t("forms.title")}</h1>

        <Separator orientation="vertical" className="mx-2 min-h-6" />

        <div className="flex flex-1"></div>

        <div className="hidden md:flex items-center gap-1 bg-[#111E30] rounded-lg p-1 border border-[#1E2E42]">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeTab === tab.id
                  ? "bg-[#1A2C40] text-[#6EE7B7]"
                  : "text-[#607A94] hover:text-[#A0B4C8]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex md:hidden items-center gap-1 bg-[#111E30] rounded-lg p-1 border border-[#1E2E42]">
          <button
            onClick={() => setMobileTab("builder")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              mobileTab === "builder"
                ? "bg-[#1A2C40] text-[#6EE7B7]"
                : "text-[#607A94]"
            }`}
          >
            Builder
          </button>
          <button
            onClick={() => setMobileTab("right")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              mobileTab === "right"
                ? "bg-[#1A2C40] text-[#6EE7B7]"
                : "text-[#607A94]"
            }`}
          >
            Preview
          </button>
        </div>

        <Separator orientation="vertical" className="mx-2 min-h-6" />
      </div>
    );
  };
  return (
    <ContentLayout nav={navComponents()}>
      <div
        className={cn(
          "flex flex-row min-h-[calc(100vh-26px-56px)] max-h-[calc(100vh-26px-56px)] w-full h-full",
        )}
      >
        <aside
          className={`flex-shrink-0 w-full md:w-[320px] lg:w-[360px] border-r border-[#1E2E42] bg-[#0C1A28] overflow-hidden flex-col ${
            mobileTab === "builder" ? "flex" : "hidden"
          } md:flex`}
        >
          <BuilderSidebar />
        </aside>

        <main
          className={`flex-1 flex flex-col overflow-hidden bg-[#0A1628] ${
            mobileTab === "right" ? "flex" : "hidden"
          } md:flex`}
        >
          <div className="flex md:hidden flex-shrink-0 border-b border-[#1E2E42] px-4">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-3 text-xs font-semibold border-b-2 transition-all ${
                  activeTab === tab.id
                    ? "border-[#6EE7B7] text-[#6EE7B7]"
                    : "border-transparent text-[#607A94]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto">
            {activeTab === "preview" ? (
              <FormPreview form={activeForm} />
            ) : (
              <SchemaView form={activeForm} />
            )}
          </div>
        </main>
      </div>
    </ContentLayout>
  );
}

export default LogsPage;
