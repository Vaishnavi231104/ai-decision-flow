"use client";

import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";

import { cn } from "@/lib/utils";
import type { Branch } from "@/lib/graph";
import type { EdgeVisualState } from "@/lib/run-view";

export type BranchEdgeData = { state?: EdgeVisualState };
export type BranchFlowEdge = Edge<BranchEdgeData, Branch>;

const COLORS: Record<Branch, string> = {
  yes: "var(--yes)",
  no: "var(--no)",
};

/**
 * One component registered under two edge types ("yes" and "no"). The type
 * decides colour and label, and it is also what the executor follows at runtime.
 */
function BranchEdgeImpl(props: EdgeProps<BranchFlowEdge>) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, type, data, selected } = props;
  const branch: Branch = type === "no" ? "no" : "yes";
  const state = data?.state ?? "idle";

  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        className={cn(state === "active" && "edge-active")}
        style={{
          stroke: COLORS[branch],
          strokeWidth: state === "idle" ? (selected ? 3 : 2) : 3.5,
          opacity: state === "idle" ? 0.8 : 1,
        }}
        markerEnd={`url(#arrow-${branch})`}
      />
      <EdgeLabelRenderer>
        <div
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          className={cn(
            "nodrag nopan pointer-events-none absolute rounded-full border bg-card px-1.5 py-px text-[10px] font-bold shadow-sm",
            branch === "yes" ? "border-yes/40 text-yes" : "border-no/40 text-no",
            state !== "idle" && "scale-110"
          )}
        >
          {branch.toUpperCase()}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const BranchEdge = memo(BranchEdgeImpl);

/** Arrowhead markers referenced by the edge component. Render once inside the canvas. */
export function EdgeMarkers() {
  return (
    <svg className="absolute size-0" aria-hidden>
      <defs>
        {(["yes", "no"] as const).map((b) => (
          <marker
            key={b}
            id={`arrow-${b}`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={COLORS[b]} />
          </marker>
        ))}
      </defs>
    </svg>
  );
}
