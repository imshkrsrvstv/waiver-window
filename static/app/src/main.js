import "./style.css";
import { call, isLocalDemo, openIssue } from "./adapter.js";
const root = document.querySelector("#app");
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const num = (v) =>
  new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(
    Number(v) || 0,
  );
const date = (v) => {
  const d = new Date(v);
  return Number.isNaN(d.valueOf())
    ? "Not recorded"
    : d.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
};
const datetime = (v) => {
  const d = new Date(v);
  return Number.isNaN(d.valueOf())
    ? "Not recorded"
    : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};
const value = (v) =>
  Array.isArray(v)
    ? v.join(", ")
    : typeof v === "object"
      ? JSON.stringify(v)
      : (v ?? "Not recorded");
const short = (v) => (v ? String(v).slice(0, 16) + "…" : "Not recorded");
const icons = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4L19 5"/>',
  moon: '<path d="M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="m5 12 14 0m-5-5 5 5-5 5"/>',
  check: '<path d="m5 12 4 4 10-10"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  external: '<path d="M14 4h6v6m-9 3 9-9M9 4H4v16h16v-5"/>',
  refresh:
    '<path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  file: '<path d="M5 3h10l4 4v14H5Zm10 0v5h4M8 12h8M8 16h6"/>',
};
const icon = (name, cls = "") =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.file}</svg>`;
let state = {
  data: null,
  waiverId: null,
  jobId: null,
  coverage: null,
  tab: "coverage",
  busy: false,
  notice: null,
  fatal: null,
};
let dialogReturnFocus = null;
const waiver = () => state.data?.waivers?.find((w) => w.id === state.waiverId);
const job = () => state.data?.jobs?.find((j) => j.id === state.jobId);
const reservations = () =>
  state.data?.reservations?.filter((r) => r.waiverId === state.waiverId) || [];
const activeReservation = () =>
  reservations().find(
    (r) => r.jobId === state.jobId && r.status === "reserved",
  );
function badge(status) {
  const labels = {
    approved: "Approved",
    draft: "Draft",
    revoked: "Revoked",
    reserved: "Allocated",
    cancelled: "Cancelled",
    covered: "Within scope",
    "not-covered": "Outside scope",
    "needs-review": "Needs review",
  };
  return `<span class="badge ${esc(status)}"><i aria-hidden="true"></i>${labels[status] || esc(status)}</span>`;
}
function shell(content) {
  return `<a class="skip-link" href="#main">Skip to workspace</a><header class="app-header"><a class="brand" href="#" aria-label="Waiver Window home"><span class="brand-symbol" aria-hidden="true"><i></i><i></i><i></i></span><span>Waiver<span class="brand-light">Window</span></span></a><nav aria-label="Workspace"><button data-tab="coverage" ${state.tab === "coverage" ? 'aria-current="page"' : ""}>Coverage desk</button><button data-tab="history" ${state.tab === "history" ? 'aria-current="page"' : ""}>Allocation history</button></nav><div class="header-actions">${isLocalDemo ? '<span class="demo-label">Local demo</span>' : ""}<button class="icon-button" id="theme-toggle" aria-label="Switch to ${document.documentElement.dataset.theme === "dark" ? "light" : "dark"} theme">${icon(document.documentElement.dataset.theme === "dark" ? "sun" : "moon")}</button></div></header>${isLocalDemo ? '<div class="demo-strip"><span>Fictional packaging records. Isolated local demonstration; no Jira or Forge connection.</span><button id="reset-demo">Reset demo</button></div>' : ""}${content}<footer class="app-footer"><span>Scope is exact. Approval is human. Allowance is finite.</span><span>App allocations only — no inventory or shipment control.</span></footer><div id="dialog-root"></div>`;
}
function render() {
  if (!state.data) {
    root.innerHTML = shell(
      `<main id="main" class="empty-workspace">${state.fatal ? `<span class="empty-symbol">!</span><h1>The workspace could not open.</h1><p>${esc(state.fatal)}</p><button class="primary" id="retry">Try again</button>${!isLocalDemo ? '<p class="fine">Open this application from its installed Jira project. Local example records are never loaded here.</p>' : ""}` : '<span class="spinner" aria-hidden="true"></span><h1>Opening the approval desk…</h1><p role="status">Reading the records you can access.</p>'}</main>`,
    );
    bind();
    return;
  }
  const w = waiver();
  root.innerHTML = shell(
    `<main id="main" class="workspace" aria-busy="${state.busy}"><div class="page-heading"><div><p class="project-label"><span class="project-dot"></span>${esc(state.data.projectKey || "Your project")} / Temporary exceptions</p><h1>Scope before allocation.</h1><p class="page-intro">Check one job against one human-approved exception.</p></div><button class="subtle" id="refresh" ${state.busy ? "disabled" : ""}>${icon("refresh")}Refresh records</button></div>${state.notice ? `<div class="notice ${state.notice.kind}" role="${state.notice.kind === "error" ? "alert" : "status"}"><span>${esc(state.notice.text)}</span><button class="icon-button" id="dismiss-notice" aria-label="Dismiss message">${icon("close")}</button></div>` : ""}${state.data.discovery?.truncated ? '<p class="discovery-note" role="status">Showing recent records; older records may not appear.</p>' : ""}<div class="scope-bar"><label for="waiver-select">Temporary exception<select id="waiver-select" ${!state.data.waivers.length ? "disabled" : ""}>${state.data.waivers.length ? state.data.waivers.map((v) => `<option value="${esc(v.id)}" ${v.id === state.waiverId ? "selected" : ""}>${esc(v.sourceIssueKey)} · ${esc(v.title)}</option>`).join("") : "<option>No exceptions yet</option>"}</select></label><button class="secondary" id="new-waiver">${icon("plus")}New exception</button></div>${!w ? `<section class="empty-workspace inner"><span class="empty-symbol">${icon("file")}</span><h2>Start with a documented exception.</h2><p>Create a draft linked to a Jira work item. An authorized reviewer must approve its exact scope before any job can be allocated.</p><button class="primary" id="first-waiver">Create a draft</button></section>` : state.tab === "history" ? historyView(w) : `${ruler(w)}<div class="desk-grid">${permit(w)}${coverageView(w)}</div>`}</main>`,
  );
  bind();
}
function ruler(w) {
  const existing = activeReservation();
  const available = Math.max(0, w.quantityLimit - w.allocatedQuantity);
  const proposed = existing ? 0 : job()?.quantity || 0;
  const fits = proposed <= available;
  const allocatedPct = Math.min(
    100,
    (w.allocatedQuantity / w.quantityLimit) * 100,
  );
  const previewPct = Math.min(
    100 - allocatedPct,
    (proposed / w.quantityLimit) * 100,
  );
  return `<section class="allowance-section" aria-labelledby="allowance-heading"><div class="allowance-top"><div><h2 id="allowance-heading">The allowance has a limit.</h2><p>${num(w.quantityLimit)} ${esc(w.unit)} ${w.status === "approved" ? "in the approved allowance" : w.status === "draft" ? "proposed · human approval required" : "recorded limit · approval revoked"}</p></div><div class="remaining"><strong>${num(available)}</strong><span>${esc(w.unit)} ${w.status === "approved" ? "available" : "unallocated"}</span></div></div><div class="allocation-ruler" role="img" aria-label="${num(w.allocatedQuantity)} of ${num(w.quantityLimit)} ${esc(w.unit)} allocated. ${proposed ? num(proposed) + " requested." : ""} ${num(available)} available."><div class="ruler-fill" data-amount="${allocatedPct}"></div>${proposed ? `<div class="ruler-preview ${fits ? "" : "overflow"}" data-start="${allocatedPct}" data-amount="${previewPct}"></div>` : ""}<div class="ruler-ticks" aria-hidden="true">${Array.from({ length: 31 }, (_, i) => `<i class="${i % 5 === 0 ? "major" : ""}"></i>`).join("")}</div><span class="ruler-zero">0</span><span class="ruler-end">${num(w.quantityLimit)}</span></div><div class="allocation-legend"><span><i class="allocated-dot"></i>${num(w.allocatedQuantity)} allocated</span>${proposed ? `<span><i class="proposed-dot ${fits ? "" : "overflow"}"></i>${num(proposed)} proposed${fits ? "" : ` · ${num(proposed - available)} over allowance`}</span>` : "<span>No additional quantity selected</span>"}<span class="legend-right">${existing ? "This job already has an allocation" : fits ? num(Math.max(0, available - proposed)) + " would remain" : "Reduce the quantity or select another exception"}</span></div></section>`;
}
function sourceButton(key) {
  return `<button class="source-link" data-source="${esc(key)}">${icon("external")}${esc(key)}${isLocalDemo ? "<small>Demo source</small>" : ""}</button>`;
}
function toolIdentifier(label, id, name) {
  return `<div class="tool-identifier"><label for="${name}">${label}</label><div><input id="${name}" value="${esc(id)}" readonly spellcheck="false"><button class="secondary small-button" data-copy-id="${name}" aria-label="Copy ${label.toLowerCase()}">Copy</button></div><span class="copy-status" role="status"></span></div>`;
}
function permit(w) {
  const sourceChanged = state.coverage?.checks?.some(
    (c) => c.key === "source" && c.status === "fail",
  );
  return `<section class="permit" aria-labelledby="permit-title"><div class="section-cap"><span>${w.status === "approved" ? "Approved scope" : w.status === "draft" ? "Draft scope" : "Revoked scope"}</span>${badge(w.status)}</div><div class="permit-heading"><span class="permit-notch" aria-hidden="true"></span>${sourceButton(w.sourceIssueKey)}<h2 id="permit-title">${esc(w.title)}</h2></div><dl class="scope-list">${[
    ["Supplier", w.supplier],
    ["Part", w.part],
    ["Revision", w.revision],
    ["Plant", w.plant],
    ["Lots", w.lots?.join(", ")],
    ["Unit", w.unit],
  ]
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`)
    .join(
      "",
    )}</dl><div class="effective-window">${icon("clock")}<div><span>Effective window</span><strong>${date(w.effectiveAt)} <span class="date-arrow">to</span> ${date(w.expiresAt)}</strong><small>Expires ${datetime(w.expiresAt)} · your local time</small></div></div><div class="approval-note"><span class="approval-stamp" aria-hidden="true">${w.status === "approved" ? icon("check") : icon("file")}</span><div><strong>${w.status === "approved" ? "Human approval recorded" : w.status === "draft" ? "Awaiting a human decision" : "Approval withdrawn"}</strong><p>${w.status === "approved" ? `Approved ${date(w.approvedAt)}. Scope revision ${num(w.scopeVersion || w.version)}.` : w.status === "draft" ? "A draft cannot cover or allocate a job." : esc(w.revocationReason || "Existing allocations remain in the historical record.")}</p></div></div>${sourceChanged && w.status === "approved" ? `<div class="source-renewal"><strong>The approval source has changed.</strong><p>${w.allocatedQuantity > 0 ? "Cancel active allocations before reviewing and renewing approval." : "Review the current linked work item before renewing this approval."}</p>${state.data.user.canApprove && w.allocatedQuantity === 0 ? '<button class="secondary" id="renew-approval">Review source & renew approval</button>' : ""}</div>` : ""}<div class="permit-actions"><button class="secondary" id="edit-waiver">Edit scope</button>${w.status === "draft" && state.data.user.canApprove ? '<button class="primary" id="approve-waiver">Review & approve</button>' : ""}${w.status === "approved" && state.data.user.canApprove ? '<button class="text-danger" id="revoke-waiver">Revoke approval</button>' : ""}</div>${!state.data.user.canApprove && w.status === "draft" ? '<p class="fine">An authorized reviewer must approve this draft.</p>' : ""}<details class="provenance"><summary>Source & approval provenance</summary><div class="tool-identifiers">${toolIdentifier("Permit ID for tools", w.id, "tool-permit-id")}${job() ? toolIdentifier("Selected job ID for tools", job().id, "tool-job-id") : ""}</div><dl><div><dt>Source work item</dt><dd>${esc(w.sourceIssueKey)}</dd></div><div><dt>Source fingerprint</dt><dd><code>${esc(short(w.sourceFingerprint))}</code></dd></div><div><dt>Scope fingerprint</dt><dd><code>${esc(short(w.scopeHash))}</code></dd></div><div><dt>Recorded approver</dt><dd>${esc(w.approvedBy || "Not approved")}</dd></div><div><dt>Record version</dt><dd>${num(w.version)}</dd></div></dl><p>Fingerprints identify the recorded source and scope. Coverage checks determine whether they still apply.</p></details></section>`;
}
function coverageView(w) {
  const j = job(),
    c = state.coverage,
    existing = activeReservation();
  const disabled = state.busy || !j;
  return `<section class="job-panel" aria-labelledby="job-heading"><div class="section-cap"><h2 id="job-heading">Check a job</h2><button class="text-button" id="new-job">${icon("plus")}New job</button></div><div class="job-body"><label class="select-label" for="job-select">Job to allocate<select id="job-select" ${!state.data.jobs.length ? "disabled" : ""}>${state.data.jobs.length ? state.data.jobs.map((v) => `<option value="${esc(v.id)}" ${v.id === state.jobId ? "selected" : ""}>${esc(v.issueKey)} · ${esc(v.title)}</option>`).join("") : "<option>No jobs yet</option>"}</select></label>${j ? `<div class="job-summary"><div>${sourceButton(j.issueKey)}<strong>${esc(j.title)}</strong><p>${esc(j.part)} / rev ${esc(j.revision)} / ${esc(j.plant)} / ${esc(j.lot)}</p></div><div class="job-quantity"><strong>${num(j.quantity)}</strong><span>${esc(j.unit)}</span></div></div><div class="job-toolbar"><button class="primary" id="check-coverage" ${disabled ? "disabled" : ""}>${state.busy ? '<span class="spinner small"></span>Checking…' : "Check coverage" + icon("arrow")}</button><button class="subtle" id="edit-job">Edit job</button></div>` : '<div class="empty-check"><h3>Bring a job to the desk.</h3><p>Record its exact part, revision, plant, lot and quantity. The approved exception is never treated as a wildcard.</p></div>'}${existing ? `<div class="existing-allocation">${icon("check")}<div><strong>This job has ${num(existing.quantity)} ${esc(existing.unit)} allocated.</strong><p>The receipt preserves the source and scope at allocation time.</p><button class="text-button" data-receipt="${esc(existing.id)}">View allocation receipt</button></div></div>` : ""}${c ? `<div class="coverage-result ${esc(c.status)}" tabindex="-1" id="coverage-result"><div class="result-heading"><span class="result-symbol">${c.status === "covered" ? icon("check") : c.status === "needs-review" ? "?" : "!"}</span><div><h3>${c.status === "covered" ? "This job fits the window." : c.status === "needs-review" ? "A source needs review." : "This job is outside the window."}</h3><p>${esc(c.summary)}</p></div></div><div class="checks-heading"><span>Exact coverage conditions</span><span>${c.checks.filter((x) => x.status === "pass").length}/${c.checks.length} pass</span></div><div class="checks-list">${c.checks.map(checkRow).join("")}</div><div class="coverage-foot"><span>Checked against scope version ${num(c.waiverVersion)}</span><span>${num(c.available)} ${esc(w.unit)} available</span></div></div>` : j && !existing ? `<div class="empty-check"><span class="scope-crosshair" aria-hidden="true">${icon("file")}</span><h3>Exact scope. No assumptions.</h3><p>Compare the supplier, part, revision, plant, lot, effective window and available quantity before allocating.</p><div class="check-preview"><span>Scope</span><i></i><span>Time</span><i></i><span>Allowance</span></div></div>` : ""}</div><div class="allocation-action"><div><strong>${existing ? "Allocation already recorded" : c?.status === "covered" ? "Ready for your allocation decision" : "Check the job before allocating"}</strong><p>Allocation reserves app allowance. It does not release a physical shipment.</p></div><button class="primary copper" id="reserve" ${state.busy || existing || c?.status !== "covered" ? "disabled" : ""}>Allocate ${j ? num(j.quantity) : ""} ${j ? esc(j.unit) : ""}</button></div></section>`;
}
function checkRow(c) {
  return `<details class="check-row ${esc(c.status)}"><summary><span class="check-status" aria-label="${esc(c.status)}">${c.status === "pass" ? "✓" : c.status === "fail" ? "!" : "?"}</span><strong>${esc(c.label)}</strong><span class="check-value">${esc(value(c.actual))}</span><span class="chevron" aria-hidden="true">⌄</span></summary><div class="check-detail"><dl><div><dt>Required</dt><dd>${esc(value(c.expected))}</dd></div><div><dt>This job / current state</dt><dd>${esc(value(c.actual))}</dd></div></dl><p>${esc(c.reason)}</p></div></details>`;
}
function historyView(w) {
  const rows = reservations();
  return `${ruler(w)}<section class="history-section"><div class="history-heading"><div><h2>Every allocation leaves a receipt.</h2><p>Historical records stay visible when scope changes or approval is revoked.</p></div><span>${rows.length} ${rows.length === 1 ? "record" : "records"}</span></div>${
    rows.length
      ? `<div class="table-scroll"><table><caption class="sr-only">Allocation history for ${esc(w.title)}</caption><thead><tr><th>Job</th><th>Quantity</th><th>Status</th><th>Recorded</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${rows
          .map((r) => {
            const j = state.data.jobs.find((j) => j.id === r.jobId);
            return `<tr><td><strong>${esc(j?.issueKey || r.jobId)}</strong><span>${esc(j?.title || "Job unavailable")}</span></td><td class="quantity-cell">${num(r.quantity)} <small>${esc(r.unit)}</small></td><td>${badge(r.status)}</td><td>${datetime(r.createdAt)}</td><td><button class="secondary small-button" data-receipt="${esc(r.id)}">View receipt</button></td></tr>`;
          })
          .join("")}</tbody></table></div>`
      : '<div class="empty-check"><h3>No allocations recorded.</h3><p>Check a job against this exception, then explicitly allocate its quantity.</p><button class="secondary" data-tab="coverage">Go to coverage desk</button></div>'
  }</section>`;
}
async function load({ keepNotice = false } = {}) {
  try {
    state.busy = true;
    render();
    const data = await call("bootstrap");
    state.data = data;
    state.fatal = null;
    if (!data.waivers.some((w) => w.id === state.waiverId))
      state.waiverId = data.waivers[0]?.id;
    if (!data.jobs.some((j) => j.id === state.jobId))
      state.jobId = data.jobs[0]?.id;
    state.coverage = null;
    if (!keepNotice) state.notice = null;
  } catch (e) {
    if (!state.data) state.fatal = e.message;
    else state.notice = { kind: "error", text: e.message };
  } finally {
    state.busy = false;
    render();
  }
}
function notify(text, kind = "success") {
  state.notice = { text, kind };
}
function bind() {
  // Set individual style properties through the DOM; no inline CSS text or CSP exception.
  document.querySelectorAll("[data-amount]").forEach((element) => {
    element.style.setProperty(
      "--amount",
      `${Number(element.dataset.amount) || 0}%`,
    );
    if (element.dataset.start !== undefined) {
      element.style.setProperty(
        "--start",
        `${Number(element.dataset.start) || 0}%`,
      );
    }
  });
  if (state.busy)
    document
      .querySelectorAll("main button,main select")
      .forEach((el) => (el.disabled = true));
  document.querySelector("#theme-toggle")?.addEventListener("click", () => {
    const theme =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.classList.add("theme-changing");
    document.documentElement.dataset.theme = theme;
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        document.documentElement.classList.remove("theme-changing"),
      ),
    );
    try {
      localStorage.setItem("ww-theme", theme);
    } catch {}
    const b = document.querySelector("#theme-toggle");
    b.innerHTML = icon(theme === "dark" ? "sun" : "moon");
    b.setAttribute(
      "aria-label",
      `Switch to ${theme === "dark" ? "light" : "dark"} theme`,
    );
  });
  document.querySelector(".brand")?.addEventListener("click", (e) => {
    e.preventDefault();
    state.tab = "coverage";
    render();
  });
  document.querySelectorAll("[data-tab]").forEach((b) =>
    b.addEventListener("click", () => {
      state.tab = b.dataset.tab;
      render();
    }),
  );
  document.querySelector("#refresh")?.addEventListener("click", () => load());
  document.querySelector("#retry")?.addEventListener("click", () => load());
  document.querySelector("#dismiss-notice")?.addEventListener("click", () => {
    state.notice = null;
    render();
  });
  document.querySelector("#waiver-select")?.addEventListener("change", (e) => {
    state.waiverId = e.target.value;
    state.coverage = null;
    state.notice = null;
    render();
  });
  document.querySelector("#job-select")?.addEventListener("change", (e) => {
    state.jobId = e.target.value;
    state.coverage = null;
    state.notice = null;
    render();
  });
  for (const selector of ["#new-waiver", "#first-waiver"])
    document
      .querySelector(selector)
      ?.addEventListener("click", () => waiverDialog());
  document
    .querySelector("#edit-waiver")
    ?.addEventListener("click", () => waiverDialog(waiver()));
  document
    .querySelector("#new-job")
    ?.addEventListener("click", () => jobDialog());
  document
    .querySelector("#edit-job")
    ?.addEventListener("click", () => jobDialog(job()));
  document
    .querySelector("#check-coverage")
    ?.addEventListener("click", async () => {
      state.busy = true;
      state.notice = null;
      render();
      try {
        state.coverage = await call("checkCoverage", {
          waiverId: state.waiverId,
          jobId: state.jobId,
        });
      } catch (e) {
        state.coverage = null;
        notify(e.message, "error");
      } finally {
        state.busy = false;
        render();
        document
          .querySelector("#coverage-result")
          ?.focus({ preventScroll: true });
      }
    });
  document
    .querySelector("#approve-waiver")
    ?.addEventListener("click", approveDialog);
  document
    .querySelector("#renew-approval")
    ?.addEventListener("click", renewDialog);
  document
    .querySelector("#revoke-waiver")
    ?.addEventListener("click", () => reasonDialog("revoke"));
  document.querySelector("#reserve")?.addEventListener("click", reserveDialog);
  document
    .querySelectorAll("[data-receipt]")
    .forEach((b) =>
      b.addEventListener("click", () => showReceipt(b.dataset.receipt)),
    );
  document.querySelectorAll("[data-source]").forEach((b) =>
    b.addEventListener("click", async () => {
      try {
        if (!(await openIssue(b.dataset.source))) {
          notify(
            "This is a fictional source in the local demonstration. No Jira work item is opened.",
            "info",
          );
          render();
        }
      } catch (e) {
        notify(e.message, "error");
        render();
      }
    }),
  );
  document.querySelectorAll("[data-copy-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const input = document.getElementById(button.dataset.copyId);
      const status = button
        .closest(".tool-identifier")
        .querySelector(".copy-status");
      try {
        await navigator.clipboard.writeText(input.value);
        status.textContent = "Copied.";
      } catch {
        input.focus();
        input.select();
        status.textContent =
          "Select and copy this ID with your keyboard or touch menu.";
      }
    });
  });
  if (__LOCAL_DEMO__)
    document
      .querySelector("#reset-demo")
      ?.addEventListener("click", async () => {
        (await import("./demo-adapter.js")).resetDemo();
        state.waiverId = null;
        state.jobId = null;
        await load();
      });
}
function modal(title, body, { wide = false } = {}) {
  dialogReturnFocus = document.activeElement;
  document.querySelector("#dialog-root").innerHTML =
    `<dialog class="modal ${wide ? "wide-modal" : ""}" aria-labelledby="dialog-title"><header><div><p>Waiver Window</p><h2 id="dialog-title">${esc(title)}</h2></div><button class="icon-button" id="close-dialog" aria-label="Close dialog">${icon("close")}</button></header><div class="modal-content">${body}</div></dialog>`;
  const d = document.querySelector("dialog");
  d.showModal();
  d.querySelector("button")?.focus({ preventScroll: true });
  d.addEventListener("close", () => {
    d.remove();
    dialogReturnFocus?.isConnected && dialogReturnFocus.focus();
  });
  document.querySelector("#close-dialog").onclick = () => d.close();
  return d;
}
const field = (label, name, val = "", type = "text", extra = "") =>
  `<label>${label}<input type="${type}" name="${name}" value="${esc(val)}" required ${extra}></label>`;
const localInput = (v) => {
  const d = new Date(v || Date.now());
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
const formError = (form, e) => {
  const el = form.querySelector(".form-error");
  el.textContent = e.message;
  el.hidden = false;
  el.focus();
};
async function submitForm(form, operation) {
  const button = form.querySelector("[type=submit]");
  button.disabled = true;
  button.dataset.original = button.textContent;
  button.textContent = "Saving…";
  try {
    await operation();
  } catch (e) {
    formError(form, e);
  } finally {
    if (button.isConnected) {
      button.disabled = false;
      button.textContent = button.dataset.original;
    }
  }
}
function scopeFields(v = {}) {
  return `<div class="form-grid">${field("Supplier identifier", "supplier", v.supplier)}${field("Part identifier", "part", v.part)}${field("Revision", "revision", v.revision)}${field("Plant", "plant", v.plant)}${field("Unit", "unit", v.unit || "pieces")}${field("Project key", "projectKey", v.projectKey || state.data.projectKey, "text", 'pattern="[A-Z][A-Z0-9_]*"')}</div>`;
}
function waiverDialog(w) {
  const d = modal(
    w ? "Edit the exact scope" : "Draft a temporary exception",
    `<form id="waiver-form">${w?.allocatedQuantity > 0 ? '<div class="form-callout">This exception has active allocations. You may edit its title. Cancel those allocations before changing the scope or allowance.</div>' : w?.status === "approved" ? '<div class="form-callout">Changing the scope removes its approval. The revised draft needs a fresh human decision. A title-only change preserves approval.</div>' : '<p class="form-intro">Use the exact identifiers from the source work item. Blank values never mean “any”.</p><p class="fine">Drafts may share a source work item, but only one exception can be approved. The first approval permanently links that source to its exception.</p>'}<div class="form-grid full-first">${field("Exception title", "title", w?.title, "text", 'maxlength="180"')}${field("Source Jira work item", "sourceIssueKey", w?.sourceIssueKey, "text", 'placeholder="PACK-104" pattern="[A-Z][A-Z0-9_]*-[0-9]+"')}</div>${scopeFields(w)}<label>Allowed lots <span class="field-note">Separate exact identifiers with commas</span><input name="lots" value="${esc(w?.lots?.join(", "))}" required placeholder="LOT-26-A, LOT-26-B"></label><div class="form-grid">${field("Total quantity allowance", "quantityLimit", w?.quantityLimit || "", "number", 'min="1" max="9007199254740991" step="1"')}${field("Effective from", "effectiveAt", localInput(w?.effectiveAt), "datetime-local")}${field("Expires at", "expiresAt", localInput(w?.expiresAt || Date.now() + 7 * 86400000), "datetime-local")}</div><p class="fine">Dates use your local time. Expiry is exclusive: coverage ends at the recorded expiry time.</p><p class="form-error" role="alert" tabindex="-1" hidden></p><div class="dialog-actions"><button type="button" class="secondary" data-close>Cancel</button><button type="submit" class="primary">${w ? "Save changes" : "Save draft"}</button></div></form>`,
    { wide: true },
  );
  d.querySelector("[data-close]").onclick = () => d.close();
  const form = d.querySelector("form");
  if (w) {
    form.elements.sourceIssueKey.readOnly = true;
    form.elements.projectKey.readOnly = true;
    if (w.allocatedQuantity > 0)
      for (const input of form.querySelectorAll("input"))
        if (input.name !== "title") input.readOnly = true;
  }
  form.onsubmit = (e) => {
    e.preventDefault();
    submitForm(form, async () => {
      const f = Object.fromEntries(new FormData(form));
      const data = await call("saveWaiver", {
        waiver: {
          ...f,
          ...(w ? { id: w.id } : {}),
          quantityLimit: Number(f.quantityLimit),
          lots: f.lots
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean),
          effectiveAt:
            w && f.effectiveAt === localInput(w.effectiveAt)
              ? w.effectiveAt
              : new Date(f.effectiveAt).toISOString(),
          expiresAt:
            w && f.expiresAt === localInput(w.expiresAt)
              ? w.expiresAt
              : new Date(f.expiresAt).toISOString(),
        },
        ...(w ? { expectedVersion: w.version } : {}),
      });
      state.waiverId = data.id;
      notify(
        data.status === "approved"
          ? "Title updated. The approved scope is unchanged."
          : data.status === "revoked"
            ? "Title updated. Approval remains revoked."
            : "Draft saved. Its exact scope needs human approval.",
      );
      d.close();
      await load({ keepNotice: true });
    });
  };
}
function jobDialog(j) {
  const base = j || waiver() || {};
  const d = modal(
    j ? "Edit the job" : "Record a job",
    `<form id="job-form"><p class="form-intro">Record the job’s actual scope. Editing a job never changes an earlier allocation receipt.</p><div class="form-grid full-first">${field("Job title", "title", j?.title, "text", 'maxlength="180"')}${field("Jira work item", "issueKey", j?.issueKey, "text", 'placeholder="PACK-211" pattern="[A-Z][A-Z0-9_]*-[0-9]+"')}</div>${scopeFields(base)}<div class="form-grid">${field("Exact lot", "lot", j?.lot || base.lots?.[0])}${field("Quantity to allocate", "quantity", j?.quantity || "", "number", 'min="1" max="9007199254740991" step="1"')}</div><p class="form-error" role="alert" tabindex="-1" hidden></p><div class="dialog-actions"><button type="button" class="secondary" data-close>Cancel</button><button type="submit" class="primary">Save job</button></div></form>`,
    { wide: true },
  );
  d.querySelector("[data-close]").onclick = () => d.close();
  const form = d.querySelector("form");
  form.onsubmit = (e) => {
    e.preventDefault();
    submitForm(form, async () => {
      const f = Object.fromEntries(new FormData(form));
      const data = await call("saveJob", {
        job: { ...f, ...(j ? { id: j.id } : {}), quantity: Number(f.quantity) },
        ...(j ? { expectedVersion: j.version } : {}),
      });
      state.jobId = data.id;
      notify("Job saved. Check its current coverage before allocating.");
      d.close();
      await load({ keepNotice: true });
    });
  };
}
function approveDialog() {
  const w = waiver();
  const d = modal(
    "Approve this exact exception",
    `<form id="approve-form"><p class="form-intro">You are approving the recorded scope and finite allowance below. The server verifies your reviewer access and source freshness.</p><div class="form-callout">This approval permanently links ${esc(w.sourceIssueKey)} to this exception. Other drafts using the same source cannot be approved, including after revocation.</div><div class="confirmation-card"><h3>${esc(w.title)}</h3><p>${esc(w.supplier)} / ${esc(w.part)} / rev ${esc(w.revision)} / ${esc(w.plant)}</p><strong>${num(w.quantityLimit)} ${esc(w.unit)}</strong><p>${date(w.effectiveAt)} to ${date(w.expiresAt)}</p><small>Source ${esc(w.sourceIssueKey)} · scope revision ${num(w.scopeVersion || w.version)}</small></div><label class="confirm-label"><input type="checkbox" required>I reviewed the source and authorize this exact temporary exception.</label><p class="form-error" role="alert" tabindex="-1" hidden></p><div class="dialog-actions"><button type="button" class="secondary" data-close>Back</button><button type="submit" class="primary">Approve exception</button></div></form>`,
  );
  d.querySelector("[data-close]").onclick = () => d.close();
  const form = d.querySelector("form");
  form.onsubmit = (e) => {
    e.preventDefault();
    submitForm(form, async () => {
      await call("approveWaiver", { id: w.id, expectedVersion: w.version });
      notify(
        "The exact scope is approved. Jobs still need an individual coverage check.",
      );
      d.close();
      await load({ keepNotice: true });
    });
  };
}
function renewDialog() {
  const w = waiver();
  const d = modal(
    "Review the changed approval source",
    `<form id="renew-form"><p class="form-intro">The linked source changed after this approval. Review its current content before deciding whether the same exact scope is still authorized.</p><div class="confirmation-card"><h3>${esc(w.title)}</h3><p>Current source: <button type="button" class="source-link" id="renew-source">${esc(w.sourceIssueKey)} ${icon("external")}</button></p><strong>${num(w.quantityLimit)} ${esc(w.unit)}</strong><p>${esc(w.supplier)} / ${esc(w.part)} / rev ${esc(w.revision)} / ${esc(w.plant)}</p></div><label class="confirm-label"><input type="checkbox" required>I reviewed the current source and renew approval for this exact scope.</label><p class="fine">Earlier receipts keep their original source snapshot. They do not inherit this renewed approval. No active allocations may remain.</p><p class="form-error" role="alert" tabindex="-1" hidden></p><div class="dialog-actions"><button type="button" class="secondary" data-close>Back</button><button type="submit" class="primary">Renew approval</button></div></form>`,
  );
  d.querySelector("[data-close]").onclick = () => d.close();
  d.querySelector("#renew-source").onclick = async () => {
    try {
      if (!(await openIssue(w.sourceIssueKey)))
        formError(
          d.querySelector("form"),
          Error("This is a fictional source in the local demonstration."),
        );
    } catch (e) {
      formError(d.querySelector("form"), e);
    }
  };
  const form = d.querySelector("form");
  form.onsubmit = (e) => {
    e.preventDefault();
    submitForm(form, async () => {
      await call("renewApproval", { id: w.id, expectedVersion: w.version });
      d.close();
      notify(
        "Approval renewed against the current source. Check job coverage again.",
      );
      await load({ keepNotice: true });
    });
  };
}
function reserveDialog() {
  const w = waiver(),
    j = job();
  if (state.coverage?.status !== "covered" || !w || !j || activeReservation())
    return;
  const requestId = crypto.randomUUID();
  const d = modal(
    "Allocate from this allowance",
    `<form id="reserve-form"><p class="form-intro">The server will check the current scope and available allowance again before recording this allocation.</p><div class="allocation-confirm"><span>${esc(j.issueKey)}</span><strong>${num(j.quantity)} <small>${esc(j.unit)}</small></strong><p>${esc(j.title)}</p><div><span>Available now</span><b>${num(state.coverage.available)}</b></div><div><span>Would remain</span><b>${num(state.coverage.available - j.quantity)}</b></div></div><label class="confirm-label"><input type="checkbox" required>Record this app allocation against ${esc(w.sourceIssueKey)}.</label><p class="fine">This action does not authorize or record a physical shipment.</p><p class="form-error" role="alert" tabindex="-1" hidden></p><div class="dialog-actions"><button type="button" class="secondary" data-close>Back</button><button type="submit" class="primary">Confirm allocation</button></div></form>`,
  );
  d.querySelector("[data-close]").onclick = () => d.close();
  const form = d.querySelector("form");
  form.onsubmit = (e) => {
    e.preventDefault();
    submitForm(form, async () => {
      const result = await call("reserve", {
        waiverId: w.id,
        jobId: j.id,
        requestId,
      });
      const reservation = result.reservation || result;
      d.close();
      notify(
        reservation.status === "cancelled"
          ? "The original request was already cancelled. No new allocation was made."
          : result.idempotent
            ? "This allocation was already recorded. Its existing receipt is shown."
            : "Allocation recorded. Its receipt preserves the exact scope and job.",
        reservation.status === "cancelled" ? "info" : "success",
      );
      await load({ keepNotice: true });
      await showReceipt(reservation.id);
    });
  };
}
function reasonDialog(kind, id) {
  const w = waiver();
  const revoke = kind === "revoke";
  const d = modal(
    revoke ? "Revoke this approval" : "Cancel this allocation",
    `<form id="reason-form"><p class="form-intro">${revoke ? "Revocation stops new allocations under this approval. Existing receipts remain historical." : "Cancellation restores this app allowance once. It does not change physical inventory or delete the receipt."}</p><label>Reason<textarea name="reason" required minlength="3" maxlength="1000" rows="4" placeholder="Explain the change for the record"></textarea></label><p class="form-error" role="alert" tabindex="-1" hidden></p><div class="dialog-actions"><button type="button" class="secondary" data-close>Back</button><button type="submit" class="danger">${revoke ? "Revoke approval" : "Cancel allocation"}</button></div></form>`,
  );
  d.querySelector("[data-close]").onclick = () => d.close();
  const form = d.querySelector("form");
  form.onsubmit = (e) => {
    e.preventDefault();
    submitForm(form, async () => {
      const reason = new FormData(form).get("reason");
      await call(
        revoke ? "revokeWaiver" : "cancelReservation",
        revoke
          ? { id: w.id, expectedVersion: w.version, reason }
          : { id, reason },
      );
      d.close();
      notify(
        revoke
          ? "Approval revoked. New allocations are no longer covered."
          : "Allocation cancelled. Its allowance was restored once.",
      );
      await load({ keepNotice: true });
    });
  };
}
async function showReceipt(id) {
  try {
    const report = await call("explainReservation", { id });
    const r = report.reservation || report,
      j = report.job || state.data.jobs.find((j) => j.id === r.jobId),
      w = report.waiver || state.data.waivers.find((w) => w.id === r.waiverId);
    const d = modal(
      "Allocation receipt",
      `<div class="receipt-sheet"><div class="receipt-top">${badge(r.status)}<span>${isLocalDemo ? "Local demonstration" : "App allocation"}</span></div><h3>${num(r.quantity)} <span>${esc(r.unit)}</span></h3><p>${esc(j?.title || r.jobId)}</p>${report.coverage?.jobFingerprint && report.coverage.jobFingerprint !== r.jobFingerprint ? '<div class="form-callout receipt-mismatch">This job has changed since the allocation. This receipt covers only the recorded snapshot, not the current job.</div>' : ""}<dl><div><dt>Job</dt><dd>${esc(j?.issueKey || r.jobId)}</dd></div><div><dt>Exception</dt><dd>${esc(w?.sourceIssueKey || r.waiverId)}</dd></div><div><dt>Recorded</dt><dd>${datetime(r.createdAt)}</dd></div><div><dt>Recorded actor</dt><dd>${esc(r.actorId)}</dd></div><div><dt>Ledger version</dt><dd>${num(r.ledgerVersion)}</dd></div>${r.cancelledAt ? `<div><dt>Cancelled</dt><dd>${datetime(r.cancelledAt)}</dd></div>` : ""}</dl><div class="receipt-provenance"><p>Scope <code>${esc(short(r.scopeHash))}</code></p><p>Job <code>${esc(short(r.jobFingerprint))}</code></p><p>Source <code>${esc(short(r.sourceFingerprint))}</code></p></div><p class="receipt-footnote">This immutable snapshot describes the allocation when recorded. Later scope or job changes do not grant retroactive coverage.</p></div><div class="dialog-actions"><button class="secondary" id="download-receipt">Download receipt</button>${r.status === "reserved" ? '<button class="text-danger" id="cancel-allocation">Cancel allocation</button>' : ""}</div>`,
    );
    d.querySelector("#download-receipt").onclick = () => {
      const blob = new Blob([JSON.stringify(report, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = `waiver-window-${r.id}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    d.querySelector("#cancel-allocation")?.addEventListener("click", () => {
      d.close();
      reasonDialog("cancel", r.id);
    });
  } catch (e) {
    notify(e.message, "error");
    render();
  }
}
render();
load();
