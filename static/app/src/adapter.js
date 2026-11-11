// Demo selection is compile-time only. A missing Forge host never loads fixtures.
let bridge;
export const isLocalDemo = __LOCAL_DEMO__;
export async function call(name, payload = {}) {
  const result = isLocalDemo
    ? await (await import("./demo-adapter.js")).invokeDemo(name, payload)
    : await (bridge ||= import("@forge/bridge")).then((b) =>
        b.invoke(name, payload),
      );
  if (!result || result.ok !== true) {
    const problem = result?.error;
    const error = new Error(
      problem?.message ||
        "The workspace did not return a usable response. Refresh and try again.",
    );
    error.code = problem?.code || "UNAVAILABLE";
    error.details = problem?.details;
    throw error;
  }
  return result.data;
}
export async function openIssue(key) {
  if (isLocalDemo) return false;
  if (!/^[A-Z][A-Z0-9_]*-\d+$/.test(key))
    throw Error("This source has no valid Jira work item key.");
  await (bridge ||= import("@forge/bridge")).then((b) =>
    b.router.open("/browse/" + encodeURIComponent(key)),
  );
  return true;
}
