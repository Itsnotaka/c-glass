import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

import { setPaperMcpStatus } from "./paper-mcp-status";

const PAPER_MCP_URL = "http://127.0.0.1:29979/mcp";

interface McpRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

async function callMcpTool<T = unknown>(
  method: string,
  params?: Record<string, unknown>,
): Promise<T> {
  const request: McpRequest = {
    jsonrpc: "2.0",
    id: Date.now(),
    method,
    ...(params ? { params } : {}),
  };

  const response = await fetch(PAPER_MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Paper MCP request failed: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  const lines = text.split("\n");
  for (const line of lines) {
    if (line.startsWith("data:")) {
      const data = JSON.parse(line.slice(5));
      if (data.error) {
        throw new Error(`Paper MCP error: ${data.error.message}`);
      }
      return data.result as T;
    }
  }

  throw new Error("No result from Paper MCP");
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async () => {
    try {
      await callMcpTool("tools/list");
      setPaperMcpStatus(true);
    } catch {
      setPaperMcpStatus(false, "Paper Desktop is not running or Paper MCP is unreachable.");
    }
  });

  // Read Tools

  pi.registerTool({
    name: "paper_get_basic_info",
    label: "Paper: Get Basic Info",
    description:
      "Get essential context about the current design: file name, page name, node count, list of artboards with their dimensions, and font families used",
    promptSnippet: "Get Paper design file basic info",
    parameters: Type.Object({}),
    async execute() {
      const result = await callMcpTool("tools/call", {
        name: "get_basic_info",
        arguments: {},
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        details: result,
      };
    },
  });

  pi.registerTool({
    name: "paper_get_selection",
    label: "Paper: Get Selection",
    description:
      "Get details about the currently selected nodes (IDs, names, types, size, artboard)",
    promptSnippet: "Get Paper selection",
    parameters: Type.Object({}),
    async execute() {
      const result = await callMcpTool("tools/call", {
        name: "get_selection",
        arguments: {},
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        details: result,
      };
    },
  });

  pi.registerTool({
    name: "paper_get_node_info",
    label: "Paper: Get Node Info",
    description:
      "Get details for a node by ID (size, visibility, lock, parent, children, text content)",
    parameters: Type.Object({
      nodeId: Type.String({ description: "The ID of the node to inspect" }),
    }),
    async execute(_toolCallId, params) {
      const result = await callMcpTool("tools/call", {
        name: "get_node_info",
        arguments: { nodeId: params.nodeId },
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        details: result,
      };
    },
  });

  pi.registerTool({
    name: "paper_get_children",
    label: "Paper: Get Children",
    description: "Get direct children of a node (IDs, names, types, child counts)",
    parameters: Type.Object({
      nodeId: Type.String({ description: "The ID of the parent node to get children from" }),
    }),
    async execute(_toolCallId, params) {
      const result = await callMcpTool("tools/call", {
        name: "get_children",
        arguments: { nodeId: params.nodeId },
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        details: result,
      };
    },
  });

  pi.registerTool({
    name: "paper_get_tree_summary",
    label: "Paper: Get Tree Summary",
    description: "Get a compact text summary of a node's subtree hierarchy",
    parameters: Type.Object({
      nodeId: Type.String({ description: "The ID of the root node to summarize" }),
      depth: Type.Optional(
        Type.Number({ description: "Maximum depth to traverse (default 3, max 10)" }),
      ),
    }),
    async execute(_toolCallId, params) {
      const result = await callMcpTool("tools/call", {
        name: "get_tree_summary",
        arguments: { nodeId: params.nodeId, depth: params.depth },
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        details: result,
      };
    },
  });

  pi.registerTool({
    name: "paper_get_screenshot",
    label: "Paper: Get Screenshot",
    description: "Capture a screenshot of a node by ID (base64 image)",
    parameters: Type.Object({
      nodeId: Type.String({ description: "The ID of the node to capture" }),
      scale: Type.Optional(Type.Number({ description: "Render scale factor (1 or 2, default 1)" })),
      transparent: Type.Optional(
        Type.Boolean({ description: "Use transparent background (PNG) instead of opaque (JPEG)" }),
      ),
    }),
    async execute(_toolCallId, params) {
      const result = await callMcpTool<{ content?: Array<{ type: string; data?: string }> }>(
        "tools/call",
        {
          name: "get_screenshot",
          arguments: {
            nodeId: params.nodeId,
            scale: params.scale,
            transparent: params.transparent,
          },
        },
      );
      const imageContent = result?.content?.find((c) => c.type === "image");
      if (imageContent?.data) {
        return {
          content: [
            {
              type: "image",
              data: imageContent.data,
              mimeType: params.transparent ? "image/png" : "image/jpeg",
            },
            { type: "text", text: "Screenshot captured" },
          ],
          details: result,
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        details: result,
      };
    },
  });

  pi.registerTool({
    name: "paper_get_jsx",
    label: "Paper: Get JSX",
    description: "Get JSX code representation of a node (Tailwind or inline-styles format)",
    parameters: Type.Object({
      nodeId: Type.String({ description: "The ID of the node to generate JSX from" }),
      format: Type.Optional(
        Type.Union([Type.Literal("tailwind"), Type.Literal("inline-styles")], {
          description: "Style format: 'tailwind' or 'inline-styles'",
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      const result = await callMcpTool<{ content?: Array<{ type: string; text?: string }> }>(
        "tools/call",
        {
          name: "get_jsx",
          arguments: { nodeId: params.nodeId, format: params.format ?? "tailwind" },
        },
      );
      const textContent = result?.content?.find((c) => c.type === "text");
      return {
        content: [
          {
            type: "text",
            text:
              typeof textContent?.text === "string"
                ? textContent.text
                : JSON.stringify(result, null, 2),
          },
        ],
        details: result,
      };
    },
  });

  pi.registerTool({
    name: "paper_get_computed_styles",
    label: "Paper: Get Computed Styles",
    description: "Get computed CSS styles for one or more nodes (batch)",
    parameters: Type.Object({
      nodeIds: Type.Array(Type.String(), { description: "Array of node IDs to get styles from" }),
    }),
    async execute(_toolCallId, params) {
      const result = await callMcpTool("tools/call", {
        name: "get_computed_styles",
        arguments: { nodeIds: params.nodeIds },
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        details: result,
      };
    },
  });

  pi.registerTool({
    name: "paper_get_fill_image",
    label: "Paper: Get Fill Image",
    description: "Extract image data from a node with an image fill (base64 JPEG)",
    parameters: Type.Object({
      nodeId: Type.String({ description: "The ID of the node containing an image fill" }),
    }),
    async execute(_toolCallId, params) {
      const result = await callMcpTool<{ content?: Array<{ type: string; data?: string }> }>(
        "tools/call",
        {
          name: "get_fill_image",
          arguments: { nodeId: params.nodeId },
        },
      );
      const imageContent = result?.content?.find((c) => c.type === "image");
      if (imageContent?.data) {
        return {
          content: [
            { type: "image", data: imageContent.data, mimeType: "image/jpeg" },
            { type: "text", text: "Image extracted" },
          ],
          details: result,
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        details: result,
      };
    },
  });

  pi.registerTool({
    name: "paper_get_font_family_info",
    label: "Paper: Get Font Family Info",
    description: "Look up font family availability and weight/style info",
    parameters: Type.Object({
      familyNames: Type.Array(Type.String(), {
        description: "Names of the font families to look up",
      }),
    }),
    async execute(_toolCallId, params) {
      const result = await callMcpTool("tools/call", {
        name: "get_font_family_info",
        arguments: { familyNames: params.familyNames },
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        details: result,
      };
    },
  });

  pi.registerTool({
    name: "paper_get_guide",
    label: "Paper: Get Guide",
    description: "Get guided workflows (e.g. figma-import for Figma import steps)",
    parameters: Type.Object({
      topic: Type.Union([Type.Literal("figma-import")], {
        description: "The guide topic: 'figma-import'",
      }),
    }),
    async execute(_toolCallId, params) {
      const result = await callMcpTool<{ content?: Array<{ type: string; text?: string }> }>(
        "tools/call",
        {
          name: "get_guide",
          arguments: { topic: params.topic },
        },
      );
      const textContent = result?.content?.find((c) => c.type === "text");
      return {
        content: [
          {
            type: "text",
            text:
              typeof textContent?.text === "string"
                ? textContent.text
                : JSON.stringify(result, null, 2),
          },
        ],
        details: result,
      };
    },
  });

  // Write Tools

  pi.registerTool({
    name: "paper_create_artboard",
    label: "Paper: Create Artboard",
    description: "Create a new artboard with name and styles",
    parameters: Type.Object({
      name: Type.String({ description: "Name for the artboard (shown in layer tree)" }),
      styles: Type.Object(
        {
          width: Type.String({ description: "Width (e.g. '1440px')" }),
          height: Type.String({ description: "Height (e.g. '900px')" }),
        },
        { description: "CSS styles for the artboard" },
      ),
    }),
    async execute(_toolCallId, params) {
      const result = await callMcpTool("tools/call", {
        name: "create_artboard",
        arguments: { name: params.name, styles: params.styles },
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        details: result,
      };
    },
  });

  pi.registerTool({
    name: "paper_write_html",
    label: "Paper: Write HTML",
    description: "Parse HTML and add/replace nodes in the design",
    parameters: Type.Object({
      html: Type.String({ description: "HTML string to parse into design nodes" }),
      targetNodeId: Type.String({ description: "The target node ID" }),
      mode: Type.Union([Type.Literal("insert-children"), Type.Literal("replace")], {
        description: "'insert-children' or 'replace'",
      }),
    }),
    async execute(_toolCallId, params) {
      const result = await callMcpTool("tools/call", {
        name: "write_html",
        arguments: { html: params.html, targetNodeId: params.targetNodeId, mode: params.mode },
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        details: result,
      };
    },
  });

  pi.registerTool({
    name: "paper_set_text_content",
    label: "Paper: Set Text Content",
    description: "Set text content of one or more Text nodes (batch)",
    parameters: Type.Object({
      updates: Type.Array(
        Type.Object({
          nodeId: Type.String({ description: "The ID of the Text node to update" }),
          textContent: Type.String({ description: "The new text content" }),
        }),
        { description: "Array of text updates" },
      ),
    }),
    async execute(_toolCallId, params) {
      const result = await callMcpTool("tools/call", {
        name: "set_text_content",
        arguments: { updates: params.updates },
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        details: result,
      };
    },
  });

  pi.registerTool({
    name: "paper_rename_nodes",
    label: "Paper: Rename Nodes",
    description: "Rename one or more layers (batch)",
    parameters: Type.Object({
      updates: Type.Array(
        Type.Object({
          nodeId: Type.String({ description: "The ID of the node to rename" }),
          name: Type.String({ description: "The new display name" }),
        }),
        { description: "Array of rename updates" },
      ),
    }),
    async execute(_toolCallId, params) {
      const result = await callMcpTool("tools/call", {
        name: "rename_nodes",
        arguments: { updates: params.updates },
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        details: result,
      };
    },
  });

  pi.registerTool({
    name: "paper_duplicate_nodes",
    label: "Paper: Duplicate Nodes",
    description: "Deep-clone nodes; returns new IDs and descendant ID map",
    parameters: Type.Object({
      nodes: Type.Array(
        Type.Object({
          id: Type.String({ description: "The ID of the node to duplicate" }),
          parentId: Type.Optional(
            Type.String({ description: "Optional parent ID for the duplicate" }),
          ),
        }),
        { description: "Array of nodes to duplicate" },
      ),
    }),
    async execute(_toolCallId, params) {
      const result = await callMcpTool("tools/call", {
        name: "duplicate_nodes",
        arguments: { nodes: params.nodes },
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        details: result,
      };
    },
  });

  pi.registerTool({
    name: "paper_update_styles",
    label: "Paper: Update Styles",
    description: "Update CSS styles on one or more nodes (batch)",
    parameters: Type.Object({
      updates: Type.Array(
        Type.Object({
          nodeIds: Type.Array(Type.String(), { description: "Node IDs to update" }),
          styles: Type.Record(Type.String(), Type.Union([Type.String(), Type.Number()]), {
            description: "CSS styles (camelCase)",
          }),
        }),
        { description: "Array of style updates" },
      ),
    }),
    async execute(_toolCallId, params) {
      const result = await callMcpTool("tools/call", {
        name: "update_styles",
        arguments: { updates: params.updates },
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        details: result,
      };
    },
  });

  pi.registerTool({
    name: "paper_delete_nodes",
    label: "Paper: Delete Nodes",
    description: "Delete one or more nodes and all descendants",
    parameters: Type.Object({
      nodeIds: Type.Array(Type.String(), { description: "Array of node IDs to delete" }),
    }),
    async execute(_toolCallId, params) {
      const result = await callMcpTool("tools/call", {
        name: "delete_nodes",
        arguments: { nodeIds: params.nodeIds },
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        details: result,
      };
    },
  });

  pi.registerTool({
    name: "paper_finish_working_on_nodes",
    label: "Paper: Finish Working",
    description: "Clear the working indicator from artboards",
    parameters: Type.Object({
      nodeIds: Type.Optional(
        Type.Array(Type.String(), {
          description: "Specific node IDs to release (omit to release all)",
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      const result = await callMcpTool("tools/call", {
        name: "finish_working_on_nodes",
        arguments: params.nodeIds ? { nodeIds: params.nodeIds } : {},
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        details: result,
      };
    },
  });
}
