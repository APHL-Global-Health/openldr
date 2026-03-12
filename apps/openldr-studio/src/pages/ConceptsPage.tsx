import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import { useKeycloakClient } from "@/components/react-keycloak-provider";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { CodingSystemList } from "@/components/concepts/CodingSystemList";
import { ConceptsTable } from "@/components/concepts/ConceptsTable";
import { ConceptDetailSheet } from "@/components/concepts/ConceptDetailSheet";
import { CodingSystemDialog } from "@/components/concepts/CodingSystemDialog";
import { MappingFormDialog } from "@/components/concepts/MappingFormDialog";

import {
  getCodingSystems,
  getConcepts,
  getConcept,
  getConceptClasses,
  getConceptMappings,
  createCodingSystem,
  updateCodingSystem,
  deleteCodingSystem as deleteCodingSystemApi,
  createConcept,
  updateConcept,
  deleteConcept as deleteConceptApi,
  createConceptMapping,
  updateConceptMapping,
  deleteConceptMapping,
  searchConcepts,
  type CodingSystem,
  type Concept,
  type ConceptMapping,
} from "@/lib/restClients/conceptRestClient";

function ConceptsPage() {
  const client = useKeycloakClient();
  const queryClient = useQueryClient();
  const token = client.kc.token;

  // ── State ───────────────────────────────────────────────────────────
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null);
  const [selectedConcept, setSelectedConcept] = useState<Concept | null>(null);
  const [conceptSheetOpen, setConceptSheetOpen] = useState(false);
  const [isNewConcept, setIsNewConcept] = useState(false);
  const [conceptSearch, setConceptSearch] = useState("");
  const [conceptClassFilter, setConceptClassFilter] = useState("all");
  const [conceptPage, setConceptPage] = useState(1);

  // Coding system dialog
  const [systemDialogOpen, setSystemDialogOpen] = useState(false);
  const [editingSystem, setEditingSystem] = useState<CodingSystem | null>(null);

  // Mapping dialog
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<ConceptMapping | null>(null);

  const [isSaving, setIsSaving] = useState(false);

  // ── Queries ─────────────────────────────────────────────────────────
  const systemsQuery = useQuery({
    queryKey: ["coding-systems"],
    queryFn: () => getCodingSystems(token, { include_stats: true }),
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const conceptsQuery = useQuery({
    queryKey: ["concepts", selectedSystemId, conceptSearch, conceptClassFilter, conceptPage],
    queryFn: () =>
      getConcepts(token, selectedSystemId!, {
        search: conceptSearch || undefined,
        concept_class: conceptClassFilter !== "all" ? conceptClassFilter : undefined,
        page: conceptPage,
        limit: 50,
      }),
    enabled: !!selectedSystemId,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const classesQuery = useQuery({
    queryKey: ["concept-classes", selectedSystemId],
    queryFn: () => getConceptClasses(token, selectedSystemId!),
    enabled: !!selectedSystemId,
    refetchOnWindowFocus: false,
  });

  const mappingsQuery = useQuery({
    queryKey: ["concept-mappings", selectedConcept?.id],
    queryFn: () => getConceptMappings(token, selectedConcept!.id),
    enabled: !!selectedConcept?.id && conceptSheetOpen,
    refetchOnWindowFocus: false,
  });

  // ── Handlers ────────────────────────────────────────────────────────

  const handleSelectSystem = (id: string) => {
    setSelectedSystemId(id);
    setConceptSearch("");
    setConceptClassFilter("all");
    setConceptPage(1);
  };

  // Coding System CRUD
  const handleAddSystem = () => {
    setEditingSystem(null);
    setSystemDialogOpen(true);
  };

  const handleEditSystem = (system: CodingSystem) => {
    setEditingSystem(system);
    setSystemDialogOpen(true);
  };

  const handleDeleteSystem = async (system: CodingSystem) => {
    try {
      await deleteCodingSystemApi(token, system.id);
      toast.success(`Deactivated coding system: ${system.system_code}`);
      queryClient.invalidateQueries({ queryKey: ["coding-systems"] });
      if (selectedSystemId === system.id) {
        setSelectedSystemId(null);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to deactivate coding system");
    }
  };

  const handleSaveSystem = async (data: Partial<CodingSystem>) => {
    setIsSaving(true);
    try {
      if (editingSystem) {
        await updateCodingSystem(token, editingSystem.id, data);
        toast.success("Coding system updated");
      } else {
        await createCodingSystem(token, data);
        toast.success("Coding system created");
      }
      queryClient.invalidateQueries({ queryKey: ["coding-systems"] });
      setSystemDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save coding system");
    } finally {
      setIsSaving(false);
    }
  };

  // Concept CRUD
  const handleAddConcept = () => {
    setSelectedConcept(null);
    setIsNewConcept(true);
    setConceptSheetOpen(true);
  };

  const handleSelectConcept = async (concept: Concept) => {
    try {
      const full = await getConcept(token, concept.id);
      setSelectedConcept(full);
    } catch {
      setSelectedConcept(concept);
    }
    setIsNewConcept(false);
    setConceptSheetOpen(true);
  };

  const handleSaveConcept = async (data: Partial<Concept>) => {
    setIsSaving(true);
    try {
      if (isNewConcept) {
        await createConcept(token, data);
        toast.success("Concept created");
      } else if (selectedConcept) {
        await updateConcept(token, selectedConcept.id, data);
        toast.success("Concept updated");
      }
      queryClient.invalidateQueries({ queryKey: ["concepts"] });
      queryClient.invalidateQueries({ queryKey: ["coding-systems"] });
      setConceptSheetOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save concept");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConcept = async () => {
    if (!selectedConcept) return;
    try {
      await deleteConceptApi(token, selectedConcept.id);
      toast.success(`Deactivated concept: ${selectedConcept.concept_code}`);
      queryClient.invalidateQueries({ queryKey: ["concepts"] });
      queryClient.invalidateQueries({ queryKey: ["coding-systems"] });
      setConceptSheetOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to deactivate concept");
    }
  };

  // Mapping CRUD
  const handleAddMapping = () => {
    setEditingMapping(null);
    setMappingDialogOpen(true);
  };

  const handleEditMapping = (mapping: ConceptMapping) => {
    setEditingMapping(mapping);
    setMappingDialogOpen(true);
  };

  const handleDeleteMapping = async (id: string) => {
    try {
      await deleteConceptMapping(token, id);
      toast.success("Mapping deleted");
      queryClient.invalidateQueries({ queryKey: ["concept-mappings"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to delete mapping");
    }
  };

  const handleSaveMapping = async (data: Partial<ConceptMapping>) => {
    setIsSaving(true);
    try {
      if (editingMapping) {
        await updateConceptMapping(token, editingMapping.id, data);
        toast.success("Mapping updated");
      } else {
        await createConceptMapping(token, data);
        toast.success("Mapping created");
      }
      queryClient.invalidateQueries({ queryKey: ["concept-mappings"] });
      setMappingDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save mapping");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSearchConcepts = useCallback(
    async (query: string) => {
      return searchConcepts(token, query, { limit: 20 });
    },
    [token],
  );

  // ── Render ──────────────────────────────────────────────────────────

  const navComponents = () => {
    return <h1 className="font-bold">Concepts</h1>;
  };

  return (
    <ContentLayout nav={navComponents()}>
      <div
        className={cn(
          "flex min-h-[calc(100vh-26px-56px)] max-h-[calc(100vh-26px-56px)] w-full h-full",
        )}
      >
        {/* Left Sidebar: Coding Systems */}
        <div className="w-55 min-w-55 h-full">
          <CodingSystemList
            systems={systemsQuery.data ?? []}
            selectedSystemId={selectedSystemId}
            onSelect={handleSelectSystem}
            onAdd={handleAddSystem}
            onEdit={handleEditSystem}
            onDelete={handleDeleteSystem}
            isLoading={systemsQuery.isLoading}
          />
        </div>

        {/* Main Area: Concepts Table */}
        <div className="flex-1 h-full overflow-hidden">
          {selectedSystemId ? (
            <ConceptsTable
              concepts={conceptsQuery.data?.data ?? []}
              total={conceptsQuery.data?.total ?? 0}
              page={conceptsQuery.data?.page ?? 1}
              limit={conceptsQuery.data?.limit ?? 50}
              search={conceptSearch}
              conceptClass={conceptClassFilter}
              conceptClasses={classesQuery.data ?? []}
              isLoading={conceptsQuery.isLoading}
              onSearchChange={(s) => {
                setConceptSearch(s);
                setConceptPage(1);
              }}
              onClassChange={(cls) => {
                setConceptClassFilter(cls);
                setConceptPage(1);
              }}
              onPageChange={setConceptPage}
              onSelect={handleSelectConcept}
              onAdd={handleAddConcept}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Select a coding system to view its concepts
            </div>
          )}
        </div>
      </div>

      {/* Concept Detail Sheet */}
      <ConceptDetailSheet
        open={conceptSheetOpen}
        onOpenChange={setConceptSheetOpen}
        concept={selectedConcept}
        mappings={mappingsQuery.data ?? null}
        conceptClasses={classesQuery.data ?? []}
        isNew={isNewConcept}
        systemId={selectedSystemId ?? ""}
        onSave={handleSaveConcept}
        onDelete={handleDeleteConcept}
        onAddMapping={handleAddMapping}
        onEditMapping={handleEditMapping}
        onDeleteMapping={handleDeleteMapping}
        isSaving={isSaving}
      />

      {/* Coding System Dialog */}
      <CodingSystemDialog
        open={systemDialogOpen}
        onOpenChange={setSystemDialogOpen}
        system={editingSystem}
        onSave={handleSaveSystem}
        isSaving={isSaving}
      />

      {/* Mapping Form Dialog */}
      <MappingFormDialog
        open={mappingDialogOpen}
        onOpenChange={setMappingDialogOpen}
        mapping={editingMapping}
        fromConceptId={selectedConcept?.id ?? ""}
        fromConceptCode={selectedConcept?.concept_code ?? ""}
        fromConceptName={selectedConcept?.display_name ?? ""}
        onSave={handleSaveMapping}
        onSearch={handleSearchConcepts}
        isSaving={isSaving}
      />
    </ContentLayout>
  );
}

export default ConceptsPage;
