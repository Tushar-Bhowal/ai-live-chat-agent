import { orderStatusTool } from "./order-status.tool.js";

/**
 * A capability the agent can call to fetch live data or take an action that the
 * static knowledge base can't answer — for example, looking up an order.
 *
 * `parameters` is a JSON Schema describing the arguments, which is what the
 * model is shown so it can decide when and how to call the tool. `execute`
 * receives the parsed arguments and returns a string result (JSON is fine) that
 * is fed back to the model.
 */
export interface Tool {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
  execute(args: Record<string, unknown>): Promise<string>;
}

/** Tools available to the agent. Add a tool by implementing Tool and listing it here. */
export const tools: Tool[] = [orderStatusTool];
