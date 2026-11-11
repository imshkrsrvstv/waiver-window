// Explicit fictional UI demonstration. This is not the production allocation ledger.
const storageKey = "ww-local-demo-v3";
const now = () => new Date().toISOString();
const clone = (v) => structuredClone(v);
const id = (prefix) => prefix + "-" + crypto.randomUUID();
const plusDays = (d) => new Date(Date.now() + d * 86400000).toISOString();
function seed() {
  const scope = {
    projectKey: "PACK",
    supplier: "Nori Printworks",
    part: "SLEEVE-04",
    revision: "C",
    plant: "Pune",
    lots: ["LOT-26-A", "LOT-26-B"],
    unit: "pieces",
  };
  const waiver = {
    ...scope,
    id: "demo-waiver-01",
    title: "Gift sleeve print-tone variation",
    sourceIssueKey: "PACK-104",
    effectiveAt: plusDays(-1),
    expiresAt: plusDays(6),
    quantityLimit: 300,
    allocatedQuantity: 120,
    version: 1,
    scopeVersion: 1,
    status: "approved",
    scopeHash: "demo-scope-01",
    sourceFingerprint: "demo-source-PACK104-v1",
    approvedBy: "Local demonstration approver",
    approvedAt: plusDays(-1),
    createdBy: "demo-user",
    createdAt: plusDays(-1),
    updatedAt: plusDays(-1),
  };
  const jobs = [
    {
      ...scope,
      id: "job-PACK-211",
      issueKey: "PACK-211",
      title: "Cedar gift sleeves / lot A",
      lot: "LOT-26-A",
      quantity: 120,
      version: 1,
    },
    {
      ...scope,
      id: "job-PACK-212",
      issueKey: "PACK-212",
      title: "Maple gift sleeves / lot B",
      lot: "LOT-26-B",
      quantity: 100,
      version: 1,
    },
    {
      ...scope,
      id: "job-PACK-213",
      issueKey: "PACK-213",
      title: "Chennai packing run",
      plant: "Chennai",
      lot: "LOT-26-A",
      quantity: 80,
      version: 1,
    },
    {
      ...scope,
      id: "job-PACK-208",
      issueKey: "PACK-208",
      title: "Earlier allocation / lot A",
      lot: "LOT-26-A",
      quantity: 120,
      version: 1,
    },
  ].map(({ lots, ...j }) => j);
  const reservation = {
    id: "demo-reservation-01",
    waiverId: waiver.id,
    jobId: "job-PACK-208",
    requestId: "demo-first-allocation",
    quantity: 120,
    unit: "pieces",
    status: "reserved",
    scopeHash: waiver.scopeHash,
    jobFingerprint: "job-PACK-208-v1",
    sourceFingerprint: waiver.sourceFingerprint,
    actorId: "Local demonstration approver",
    createdAt: plusDays(-0.3),
    ledgerVersion: 1,
  };
  return {
    user: { accountId: "demo-user", canApprove: true },
    projectKey: "PACK",
    waivers: [waiver],
    jobs,
    reservations: [reservation],
    sources: { "PACK-104": waiver.sourceFingerprint },
    sourceBindings: { "PACK:PACK-104": waiver.id },
    mode: "local-demo",
  };
}
let state;
try {
  state = JSON.parse(localStorage.getItem(storageKey));
} catch {}
if (!state?.waivers) state = seed();
const persist = () => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {}
};
const fail = (message, code = "INVALID") => {
  throw Object.assign(Error(message), { code });
};
const find = (list, id) =>
  state[list].find((r) => r.id === id) ||
  fail(
    "That record is no longer available. Refresh the workspace.",
    "NOT_FOUND",
  );
function check(w, j) {
  const checks = [];
  const add = (key, label, expected, actual, pass, reason) =>
    checks.push({
      key,
      label,
      expected,
      actual,
      status: pass ? "pass" : "fail",
      reason,
    });
  add(
    "status",
    "Human approval",
    "approved",
    w.status,
    w.status === "approved",
    w.status === "approved"
      ? "This scope has a recorded approval."
      : "Only an approved, current scope can cover a job.",
  );
  for (const [key, label] of [
    ["supplier", "Supplier"],
    ["part", "Part"],
    ["revision", "Revision"],
    ["plant", "Plant"],
    ["unit", "Unit"],
  ])
    add(
      key,
      label,
      w[key],
      j[key],
      w[key] === j[key],
      w[key] === j[key]
        ? "Exact identifier match."
        : "This job differs from the approved scope.",
    );
  add(
    "lot",
    "Lot",
    w.lots.join(", "),
    j.lot,
    w.lots.includes(j.lot),
    w.lots.includes(j.lot)
      ? "This lot is listed in the scope."
      : "This lot is outside the approved list.",
  );
  const active =
    Date.now() >= Date.parse(w.effectiveAt) &&
    Date.now() < Date.parse(w.expiresAt);
  add(
    "window",
    "Effective window",
    `${w.effectiveAt} → ${w.expiresAt}`,
    now(),
    active,
    active
      ? "The current time is within the effective window."
      : "The exception is not currently effective.",
  );
  const available = w.quantityLimit - w.allocatedQuantity;
  add(
    "allowance",
    "Available allowance",
    `${available} ${w.unit}`,
    `${j.quantity} ${j.unit}`,
    available >= j.quantity,
    available >= j.quantity
      ? "The requested app allocation fits."
      : "The requested quantity exceeds the remaining app allowance.",
  );
  const source = state.sources[w.sourceIssueKey] || null;
  add(
    "source",
    "Approval source",
    w.sourceFingerprint,
    source,
    !!source && source === w.sourceFingerprint,
    "The current source must match the source captured at approval.",
  );
  const status = checks.every((c) => c.status === "pass")
    ? "covered"
    : checks.some((c) => c.key === "source" && c.status === "fail")
      ? "needs-review"
      : "not-covered";
  return {
    status,
    checks,
    available,
    requested: j.quantity,
    waiverVersion: w.version,
    scopeHash: w.scopeHash,
    jobFingerprint: j.id + "-v" + j.version,
    summary:
      status === "covered"
        ? "This job matches the recorded scope and fits the remaining allowance."
        : "This job cannot be allocated against the current exception.",
  };
}
function clean(payload, type) {
  const required =
    type === "waiver"
      ? [
          "title",
          "sourceIssueKey",
          "projectKey",
          "supplier",
          "part",
          "revision",
          "plant",
          "unit",
          "effectiveAt",
          "expiresAt",
        ]
      : [
          "title",
          "issueKey",
          "projectKey",
          "supplier",
          "part",
          "revision",
          "plant",
          "lot",
          "unit",
        ];
  const out = {};
  for (const k of required) {
    out[k] = String(payload[k] ?? "").trim();
    if (!out[k]) fail(`${k} is required.`);
  }
  if (type === "waiver") {
    out.lots = payload.lots?.map((v) => String(v).trim()).filter(Boolean);
    if (!out.lots?.length) fail("List at least one exact lot.");
    if (!(Date.parse(out.expiresAt) > Date.parse(out.effectiveAt)))
      fail("Expiry must follow the effective date.");
  }
  const amount = type === "waiver" ? "quantityLimit" : "quantity";
  out[amount] = Number(payload[amount]);
  if (!Number.isSafeInteger(out[amount]) || out[amount] <= 0)
    fail("Quantity must be a positive whole number.");
  return out;
}
// Persist the first approved owner even after revocation or a scope revision.
state.sourceBindings ||= Object.fromEntries(
  state.waivers
    .filter(
      (w) => w.approvedAt || w.status === "approved" || w.status === "revoked",
    )
    .map((w) => [`${w.projectKey}:${w.sourceIssueKey}`, w.id]),
);
export async function invokeDemo(name, p = {}) {
  await new Promise((r) => setTimeout(r, 160));
  try {
    let data;
    if (name === "bootstrap") data = state;
    else if (name === "checkCoverage")
      data = check(find("waivers", p.waiverId), find("jobs", p.jobId));
    else if (name === "saveWaiver") {
      const draft = clean(p.waiver, "waiver");
      const old = p.waiver.id ? find("waivers", p.waiver.id) : null;
      if (old && old.version !== p.expectedVersion)
        fail("This exception changed. Refresh before saving.", "CONFLICT");
      if (
        old &&
        (draft.sourceIssueKey !== old.sourceIssueKey ||
          draft.projectKey !== old.projectKey)
      )
        fail("The source issue and project cannot be changed.");
      const scopeChanged =
        !!old &&
        Object.keys(draft)
          .filter((k) => k !== "title")
          .some((k) => JSON.stringify(draft[k]) !== JSON.stringify(old[k]));
      if (old && scopeChanged && old.allocatedQuantity > 0)
        fail(
          "Cancel active allocations before changing the scope.",
          "ACTIVE_ALLOCATIONS",
        );
      data = {
        ...old,
        ...draft,
        id: old?.id || id("waiver"),
        status: "draft",
        version: (old?.version || 0) + 1,
        scopeVersion: (old?.scopeVersion || 0) + 1,
        allocatedQuantity: old?.allocatedQuantity || 0,
        createdBy: old?.createdBy || state.user.accountId,
        createdAt: old?.createdAt || now(),
        updatedAt: now(),
        approvedBy: null,
        approvedAt: null,
        sourceFingerprint: "demo-source-" + draft.sourceIssueKey,
        scopeHash: id("demo-scope"),
      };
      state.sources[draft.sourceIssueKey] ||=
        "demo-source-" + draft.sourceIssueKey;
      if (old && !scopeChanged)
        data = {
          ...old,
          title: draft.title,
          version: old.version + 1,
          updatedAt: now(),
        };
      state.waivers = old
        ? state.waivers.map((w) => (w.id === old.id ? data : w))
        : [data, ...state.waivers];
    } else if (
      name === "approveWaiver" ||
      name === "revokeWaiver" ||
      name === "renewApproval"
    ) {
      const w = find("waivers", p.id);
      if (w.version !== p.expectedVersion)
        fail("This exception changed. Refresh before deciding.", "CONFLICT");
      if (name === "approveWaiver" || name === "renewApproval") {
        if (
          name === "renewApproval" &&
          (w.status !== "approved" ||
            w.allocatedQuantity !== 0 ||
            w.sourceFingerprint === state.sources[w.sourceIssueKey])
        )
          fail(
            "Renewal needs a changed source, approved scope, and no active allocations.",
          );
        if (!state.user.canApprove)
          fail("Approval requires an authorized reviewer.", "FORBIDDEN");
        const sourceKey = `${w.projectKey}:${w.sourceIssueKey}`;
        const owner = state.sourceBindings[sourceKey];
        if (owner && owner !== w.id) {
          fail(
            "This Jira source is already assigned to another exception. Use the original exception or a separately authorized source.",
            "SOURCE_ALREADY_BOUND",
          );
        }
        state.sourceBindings[sourceKey] = w.id;
        w.status = "approved";
        w.approvedBy = state.user.accountId;
        w.approvedAt = now();
        w.sourceFingerprint = state.sources[w.sourceIssueKey];
      } else {
        if (!p.reason?.trim()) fail("Give a reason for revocation.");
        w.status = "revoked";
        w.revocationReason = p.reason;
      }
      w.version++;
      w.updatedAt = now();
      data = w;
    } else if (name === "saveJob") {
      const job = clean(p.job, "job"),
        old = p.job.id ? find("jobs", p.job.id) : null;
      if (old && old.version !== p.expectedVersion)
        fail("This job changed. Refresh before saving.", "CONFLICT");
      if (!old && state.jobs.some((j) => j.issueKey === job.issueKey))
        fail(
          "This Jira work item already has a job record. Edit that job instead.",
          "CONFLICT",
        );
      data = {
        ...job,
        id: old?.id || "job-" + job.issueKey,
        version: (old?.version || 0) + 1,
      };
      state.jobs = old
        ? state.jobs.map((j) => (j.id === old.id ? data : j))
        : [data, ...state.jobs];
    } else if (name === "reserve") {
      const w = find("waivers", p.waiverId),
        j = find("jobs", p.jobId),
        prior = state.reservations.find((r) => r.requestId === p.requestId);
      if (prior) {
        if (prior.waiverId !== w.id || prior.jobId !== j.id)
          fail(
            "This request ID belongs to a different allocation.",
            "CONFLICT",
          );
        data = { reservation: prior, coverage: check(w, j), idempotent: true };
      } else {
        if (
          state.reservations.some(
            (r) =>
              r.waiverId === w.id &&
              r.jobId === j.id &&
              r.status === "reserved",
          )
        )
          fail(
            "This job already has an active allocation.",
            "ALREADY_RESERVED",
          );
        const coverage = check(w, j);
        if (coverage.status !== "covered")
          fail(coverage.summary, "NOT_COVERED");
        const r = {
          id: id("allocation"),
          waiverId: w.id,
          jobId: j.id,
          requestId: p.requestId,
          quantity: j.quantity,
          unit: j.unit,
          status: "reserved",
          scopeHash: w.scopeHash,
          jobFingerprint: coverage.jobFingerprint,
          sourceFingerprint: w.sourceFingerprint,
          actorId: state.user.accountId,
          createdAt: now(),
          ledgerVersion: w.version + 1,
        };
        w.allocatedQuantity += j.quantity;
        w.version++;
        state.reservations.unshift(r);
        data = { reservation: r, coverage, idempotent: false };
      }
    } else if (name === "cancelReservation") {
      const r = find("reservations", p.id);
      if (!p.reason?.trim()) fail("Give a cancellation reason.");
      const idempotent = r.status === "cancelled";
      if (!idempotent) {
        const w = find("waivers", r.waiverId);
        w.allocatedQuantity -= r.quantity;
        w.version++;
        r.status = "cancelled";
        r.cancelledAt = now();
        r.cancelledReason = p.reason;
      }
      data = { reservation: r, idempotent };
    } else if (name === "explainReservation") {
      const reservation = find("reservations", p.id),
        waiver = find("waivers", reservation.waiverId),
        job = find("jobs", reservation.jobId);
      data = { reservation, waiver, job, coverage: check(waiver, job) };
    } else
      fail(
        "This action is not implemented in the local demonstration.",
        "UNKNOWN_ACTION",
      );
    persist();
    return { ok: true, data: clone(data) };
  } catch (e) {
    return {
      ok: false,
      error: { code: e.code || "INVALID", message: e.message },
    };
  }
}
export function resetDemo() {
  state = seed();
  persist();
}
