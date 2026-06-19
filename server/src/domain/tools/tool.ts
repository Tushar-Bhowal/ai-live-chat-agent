/**
 * A capability the agent can call to fetch live data or take an action — for
 * example, looking up an order's status. A tool is just a name, a description
 * the model can reason about, and an `execute` function.
 *
 * To add one: implement this interface and register it in `tools`. The agent
 * consults the registry while composing a reply (see agent.service.ts).
 */
export interface Tool<Input = unknown, Output = unknown> {
  readonly name: string;
  readonly description: string;
  execute(input: Input): Promise<Output>;
}

/** No tools are wired up yet; this is the extension point. */
export const tools: Tool[] = [];
