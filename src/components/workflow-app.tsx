"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { BrainCircuit, Flag, History, Library, MousePointerClick, Plus, ScrollText, Workflow } from "lucide-react";

import { BranchEdge, EdgeMarkers, type BranchFlowEdge } from "@/components/flow/branch-edge";
import { WorkflowNode, type WorkflowFlowNode } from "@/components/flow/workflow-node";
import { HistoryPanel } from "@/components/panels/history-panel";
import { InspectorPanel } from "@/components/panels/inspector-panel";
import { LibraryPanel, type SavedWorkflow } from "@/components/panels/library-panel";
import { LogsPanel } from "@/components/panels/logs-panel";
import { RunPanel } from "@/components/panels/run-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { readStorage, writeStorage } from "@/hooks/use-local-storage";
import { flowToGraph, graphToFlow } from "@/lib/flow-convert";
import {
  exampleGraph,
  graphSchema,
  resolveStartNodeId,
  uid,
  validateGraph,
  type Branch,
  type NodeKind,
  type WorkflowGraph,
} from "@/lib/graph";
import type { RunRecord, RunSummary } from "@/lib/run-types";
import { deriveRunView } from "@/lib/run-view";

const CURRENT_KEY = "ai-flow:current";
const SAVED_KEY = "ai-flow:saved";
const INPUT_KEY = "ai-flow:input";

const nodeTypes = { decision: WorkflowNode, outcome: WorkflowNode };
const edgeTypes = { yes: BranchEdge, no: BranchEdge };

interface StoredWorkflow extends SavedWorkflow {
  graph: WorkflowGraph;
}

interface Health {
  llm: "openai" | "mock";
  model: string;
  inngestReachable: boolean;
}

function Editor() {
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<BranchFlowEdge>([]);
  const [name, setName] = useState("Untitled workflow");
  const [startNodeId, setStartNodeId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [tab, setTab] = useState("edit");

  const [input, setInput] = useState("");
  const [run, setRun] = useState<RunRecord | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [history, setHistory] = useState<RunSummary[]>([]);
  const [saved, setSaved] = useState<StoredWorkflow[]>([]);
  const [health, setHealth] = useState<Health | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView } = useReactFlow();

  /* ---------- load / persist the graph locally ---------- */

  const loadGraph = useCallback(
    (graph: WorkflowGraph) => {
      const flow = graphToFlow(graph);
      setNodes(flow.nodes);
      setEdges(flow.edges);
      setName(graph.name);
      setStartNodeId(graph.startNodeId);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setRun(null);
      setActiveRunId(null);
      setRunError(null);
      setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 50);
    },
    [setNodes, setEdges, fitView]
  );

  useEffect(() => {
    const stored = graphSchema.safeParse(readStorage<unknown>(CURRENT_KEY, null));
    const graph = stored.success && stored.data.nodes.length > 0 ? stored.data : exampleGraph();
    const flow = graphToFlow(graph);
    setNodes(flow.nodes);
    setEdges(flow.edges);
    setName(graph.name);
    setStartNodeId(graph.startNodeId);
    setSaved(readStorage<StoredWorkflow[]>(SAVED_KEY, []));
    setInput(readStorage<string>(INPUT_KEY, "My dashboard keeps crashing whenever I upload a CSV, and my whole team is blocked."));
    setHydrated(true);
  }, [setNodes, setEdges]);

  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => writeStorage(CURRENT_KEY, flowToGraph({ name, startNodeId, nodes, edges })), 300);
    return () => clearTimeout(t);
  }, [hydrated, name, startNodeId, nodes, edges]);

  useEffect(() => {
    if (hydrated) writeStorage(INPUT_KEY, input);
  }, [hydrated, input]);

  /* ---------- derived values ---------- */

  const graph = useMemo(() => flowToGraph({ name, startNodeId, nodes, edges }), [name, startNodeId, nodes, edges]);
  const effectiveStart = useMemo(() => resolveStartNodeId(graph), [graph]);
  const issues = useMemo(() => validateGraph(graph), [graph]);
  const view = useMemo(() => deriveRunView(run), [run]);

  const renderNodes = useMemo(
    () => nodes.map((n) => ({ ...n, data: { ...n.data, isStart: n.id === effectiveStart, run: view.nodes[n.id] } })),
    [nodes, effectiveStart, view]
  );
  const renderEdges = useMemo(
    () => edges.map((e) => ({ ...e, data: { state: view.edges[e.id] ?? "idle" } })),
    [edges, view]
  );

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId) ?? null;

  /* ---------- editing ---------- */

  const addNode = useCallback(
    (kind: NodeKind) => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      const base = rect
        ? screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
        : { x: 0, y: 0 };
      const jitter = () => Math.round((Math.random() - 0.5) * 120);
      const id = uid("n");
      setNodes((ns) => [
        ...ns.map((n) => ({ ...n, selected: false })),
        {
          id,
          type: kind,
          position: { x: base.x - 115 + jitter(), y: base.y - 40 + jitter() },
          selected: true,
          data: { label: kind === "decision" ? "New decision" : "New outcome", prompt: "" },
        },
      ]);
      setStartNodeId((s) => s ?? (kind === "decision" ? id : s));
      setSelectedNodeId(id);
      setSelectedEdgeId(null);
      setTab("edit");
    },
    [screenToFlowPosition, setNodes]
  );

  const onConnect = useCallback(
    (conn: Connection) => {
      const branch = conn.sourceHandle as Branch;
      // One edge per branch: connecting again from the same handle replaces the old target.
      setEdges((eds) => [
        ...eds.filter((e) => !(e.source === conn.source && e.type === branch)),
        { id: uid("e"), source: conn.source, target: conn.target, sourceHandle: branch, type: branch, data: {} },
      ]);
    },
    [setEdges]
  );

  const isValidConnection = useCallback(
    (c: { source: string; target: string; sourceHandle?: string | null }) =>
      c.source !== c.target && (c.sourceHandle === "yes" || c.sourceHandle === "no"),
    []
  );

  const updateNode = useCallback(
    (id: string, patch: { label?: string; prompt?: string }) =>
      setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n))),
    [setNodes]
  );

  const deleteNode = useCallback(
    (id: string) => {
      setNodes((ns) => ns.filter((n) => n.id !== id));
      setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
      setSelectedNodeId(null);
    },
    [setNodes, setEdges]
  );

  const deleteEdge = useCallback(
    (id: string) => {
      setEdges((es) => es.filter((e) => e.id !== id));
      setSelectedEdgeId(null);
    },
    [setEdges]
  );

  const onSelectionChange = useCallback(
    ({ nodes: ns, edges: es }: { nodes: { id: string }[]; edges: { id: string }[] }) => {
      const n = ns[0]?.id ?? null;
      const e = n ? null : (es[0]?.id ?? null);
      setSelectedNodeId(n);
      setSelectedEdgeId(e);
      if (n || e) setTab((t) => (t === "run" || t === "logs" || t === "history" || t === "library" ? "edit" : t));
    },
    []
  );

  /* ---------- running ---------- */

  const refreshHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/runs", { cache: "no-store" });
      if (res.ok) setHistory((await res.json()).runs);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  // Poll the run record while it executes. Inngest runs in the background, so this is how the canvas animates.
  useEffect(() => {
    if (!activeRunId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const res = await fetch(`/api/runs/${activeRunId}`, { cache: "no-store" });
        if (res.ok) {
          const { run: r } = (await res.json()) as { run: RunRecord };
          if (stopped) return;
          setRun(r);
          if (r.status === "completed" || r.status === "failed") {
            void refreshHistory();
            return;
          }
        }
      } catch {
        /* transient, try again */
      }
      if (!stopped) timer = setTimeout(tick, 500);
    };
    void tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [activeRunId, refreshHistory]);

  const startRun = useCallback(
    async (opts?: { startNodeId?: string; retryOf?: string }) => {
      setStarting(true);
      setRunError(null);
      try {
        const res = await fetch("/api/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ graph, input, startNodeId: opts?.startNodeId, retryOf: opts?.retryOf }),
        });
        const json = await res.json();
        if (!res.ok) {
          setRunError(json.error ?? "Could not start the run");
          if (json.runId) setActiveRunId(json.runId);
          return;
        }
        setRun(null);
        setActiveRunId(json.runId);
        setTab("run");
      } catch (err) {
        setRunError((err as Error).message);
      } finally {
        setStarting(false);
      }
    },
    [graph, input]
  );

  const openHistoryRun = useCallback(async (id: string) => {
    const res = await fetch(`/api/runs/${id}`, { cache: "no-store" });
    if (!res.ok) return;
    const { run: r } = (await res.json()) as { run: RunRecord };
    setRun(r);
    setInput(r.input);
    setActiveRunId(r.status === "completed" || r.status === "failed" ? null : r.id);
    setTab("run");
  }, []);

  const clearHistory = useCallback(async () => {
    await fetch("/api/runs", { method: "DELETE" });
    setHistory([]);
    setRun(null);
    setActiveRunId(null);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        if (res.ok) setHealth(await res.json());
      } catch {
        /* ignore */
      }
    };
    void load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  /* ---------- library: save / load / import / export ---------- */

  const saveCurrent = useCallback(() => {
    const g = flowToGraph({ name, startNodeId, nodes, edges });
    setSaved((prev) => {
      const existing = prev.find((s) => s.name === g.name);
      const entry: StoredWorkflow = {
        id: existing?.id ?? uid("wf"),
        name: g.name,
        savedAt: new Date().toISOString(),
        nodeCount: g.nodes.length,
        graph: g,
      };
      const next = [entry, ...prev.filter((s) => s.id !== entry.id)];
      writeStorage(SAVED_KEY, next);
      return next;
    });
  }, [name, startNodeId, nodes, edges]);

  const deleteSaved = useCallback((id: string) => {
    setSaved((prev) => {
      const next = prev.filter((s) => s.id !== id);
      writeStorage(SAVED_KEY, next);
      return next;
    });
  }, []);

  const exportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(graph, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${graph.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workflow"}.workflow.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [graph]);

  const importJson = useCallback(
    (text: string): string | null => {
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        return "That is not valid JSON.";
      }
      const parsed = graphSchema.safeParse(raw);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        return `Not a valid workflow: ${first.path.join(".") || "root"}: ${first.message}`;
      }
      loadGraph(parsed.data);
      setTab("edit");
      return null;
    },
    [loadGraph]
  );

  /* ---------- render ---------- */

  const running = run?.status === "queued" || run?.status === "running";

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-card px-4">
        <div className="flex items-center gap-2 font-semibold">
          <Workflow className="size-5 text-primary" />
          AI Decision Flow
        </div>
        <span className="hidden truncate text-sm text-muted-foreground sm:block">/ {name}</span>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant={health?.llm === "openai" ? "yes" : "secondary"} title={health ? `Model: ${health.model}` : ""}>
            <BrainCircuit /> {health ? (health.llm === "openai" ? health.model : "Mock LLM (no API key)") : "…"}
          </Badge>
          <Badge variant={health?.inngestReachable ? "yes" : "destructive"}>
            <span className={`size-1.5 rounded-full ${health?.inngestReachable ? "bg-yes" : "bg-destructive"}`} />
            {health?.inngestReachable ? "Inngest connected" : "Inngest offline"}
          </Badge>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div ref={wrapperRef} className="relative min-w-0 flex-1">
          <div className="absolute top-3 left-3 z-10 flex gap-2 rounded-lg border bg-card p-1.5 shadow-sm">
            <Button size="sm" variant="ghost" onClick={() => addNode("decision")}>
              <Plus /> <BrainCircuit /> Decision
            </Button>
            <Button size="sm" variant="ghost" onClick={() => addNode("outcome")}>
              <Plus /> <Flag /> Outcome
            </Button>
          </div>

          {running && (
            <div className="absolute top-3 left-1/2 z-10 -translate-x-1/2 rounded-full border bg-card px-3 py-1 text-xs font-medium shadow-sm">
              Running… <span className="text-muted-foreground">{run?.steps.length ?? 0} step(s) so far</span>
            </div>
          )}

          {hydrated && nodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
              <div className="rounded-xl border border-dashed bg-card/80 p-6 text-center text-sm text-muted-foreground">
                <MousePointerClick className="mx-auto mb-2 size-6" />
                Empty canvas. Add a Decision node to start.
              </div>
            </div>
          )}

          <EdgeMarkers />
          <ReactFlow
            nodes={renderNodes}
            edges={renderEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            onSelectionChange={onSelectionChange}
            deleteKeyCode={["Backspace", "Delete"]}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.2}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={20} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable className="!bg-card" />
          </ReactFlow>
        </div>

        <aside className="flex w-[380px] shrink-0 flex-col border-l bg-card">
          <Tabs value={tab} onValueChange={setTab} className="min-h-0 flex-1 p-3">
            <TabsList>
              <TabsTrigger value="edit">
                <BrainCircuit /> Edit
              </TabsTrigger>
              <TabsTrigger value="run">Run</TabsTrigger>
              <TabsTrigger value="logs">
                <ScrollText /> Logs
              </TabsTrigger>
              <TabsTrigger value="history">
                <History /> History
              </TabsTrigger>
              <TabsTrigger value="library">
                <Library /> Library
              </TabsTrigger>
            </TabsList>

            <TabsContent value="edit" className="overflow-auto pt-1">
              <InspectorPanel
                node={selectedNode}
                edge={selectedEdge}
                isStart={selectedNode?.id === effectiveStart}
                nodeRun={selectedNode ? view.nodes[selectedNode.id] : undefined}
                onChange={updateNode}
                onSetStart={setStartNodeId}
                onDeleteNode={deleteNode}
                onDeleteEdge={deleteEdge}
              />
            </TabsContent>
            <TabsContent value="run" className="overflow-auto pt-1">
              <RunPanel
                input={input}
                onInputChange={setInput}
                onRun={() => startRun()}
                onRetryFrom={(nodeId) => startRun({ startNodeId: nodeId, retryOf: run?.id })}
                starting={starting}
                run={run}
                issues={issues}
                error={runError}
              />
            </TabsContent>
            <TabsContent value="logs" className="flex flex-col pt-1">
              <LogsPanel run={run} />
            </TabsContent>
            <TabsContent value="history" className="overflow-auto pt-1">
              <HistoryPanel runs={history} activeId={run?.id ?? null} onSelect={openHistoryRun} onClear={clearHistory} />
            </TabsContent>
            <TabsContent value="library" className="overflow-auto pt-1">
              <LibraryPanel
                name={name}
                onNameChange={setName}
                saved={saved}
                onSave={saveCurrent}
                onLoad={(id) => {
                  const wf = saved.find((s) => s.id === id);
                  if (wf) {
                    loadGraph(wf.graph);
                    setTab("edit");
                  }
                }}
                onDelete={deleteSaved}
                onExport={exportJson}
                onImport={importJson}
                onExample={() => {
                  loadGraph(exampleGraph());
                  setTab("run");
                }}
                onNew={() => loadGraph({ version: 1, name: "Untitled workflow", startNodeId: null, nodes: [], edges: [] })}
              />
            </TabsContent>
          </Tabs>
        </aside>
      </div>
    </div>
  );
}

export function WorkflowApp() {
  return (
    <ReactFlowProvider>
      <Editor />
    </ReactFlowProvider>
  );
}
