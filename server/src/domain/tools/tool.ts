import { orderStatusTool } from "./order-status.tool.js";

// A capability the model can call for data the knowledge base can't answer.
// `parameters` is the JSON Schema shown to the model; `execute` gets the parsed
// args and returns a string result that's fed back to the model.
export interface Tool {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
  execute(args: Record<string, unknown>): Promise<string>;
}

// Add a tool by implementing Tool and listing it here.
export const tools: Tool[] = [orderStatusTool];
