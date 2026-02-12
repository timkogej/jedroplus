import { supabase } from "@/lib/supabaseClient";

// Enforce frontend read-only access; Supabase RLS should still deny anon writes.

const blockWrite = () => {
  throw new Error(
    "Frontend write blocked: use n8n workflow (callN8nAction) instead."
  );
};

const wrapQuery = (query: Record<string, unknown>) =>
  new Proxy(query, {
    get(target, prop) {
      if (
        prop === "insert" ||
        prop === "update" ||
        prop === "delete" ||
        prop === "upsert" ||
        prop === "rpc"
      ) {
        return blockWrite;
      }
      const value = target[prop as keyof typeof target];
      if (typeof value === "function") {
        return value.bind(target);
      }
      return value;
    },
  });

export const supabaseReadOnly = new Proxy(supabase, {
  get(target, prop) {
    if (prop === "from") {
      return (...args: unknown[]) => {
        const query = (target as typeof supabase).from(...(args as [string]));
        return wrapQuery(query as unknown as Record<string, unknown>);
      };
    }
    const value = target[prop as keyof typeof target];
    if (typeof value === "function") {
      return value.bind(target);
    }
    return value;
  },
});
