const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
let domains = [];
const types = [
  "Chat",
  "Voice",
  "Analysis",
  "Document",
  "Workflow",
  "Agent Team",
];
const icons = {
  Chat: "☏",
  Voice: "≋",
  Analysis: "▥",
  Document: "▤",
  Workflow: "⌘",
  "Agent Team": "✧",
};
let suite = { capabilities: [], domains: [], template_concepts: [], phases: [] };
let catalogLimit = 6, builderStep = 0;
let templates = [],
  currentUser = null,
  authSettings = {},
  storageInfo = null,
  reports = [];
let analysisReport = null;
let page = "Overview",
  saved = [],
  runs = [],
  provider = "Demo",
  chosen = null,
  history = [],
  busy = false;
async function api(path, body, method = "POST") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), path === "chat" ? 25000 : 40000);
  try {
    const r = await fetch(
      "/api/" + path,
      body
        ? {
            method,
            signal: controller.signal,
            cache: "no-store",
            ...(body instanceof FormData
              ? { body }
              : {
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(body),
                }),
          }
        : { cache: "no-store", signal: controller.signal },
    );
    const data = await r.json();
    if (!r.ok)
      throw Error(
        typeof data.detail === "string"
          ? data.detail
          : "Please check your input and try again.",
      );
    return data;
  } catch (error) {
    if (error.name === "AbortError") throw Error("The request took too long. Please try again.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
function toast(text) {
  $("#toast").textContent = text;
  $("#toast").style.display = "block";
  setTimeout(() => ($("#toast").style.display = "none"), 4500);
}
const navItems = [
  ["Overview", "◫"], ["Agent Marketplace", "▦"], ["My Agents", "♧"],
  ["Playground", "◈"], ["Knowledge Base", "▤"],
  ["Integrations", "⌘"], ["Activity & Analytics", "▥"],
  ["Suite roadmap", "✧"], ["Settings", "⚙"],
];
const pageLabel = (name) => ({
  Overview: "Home", "Agent Marketplace": "Marketplace", Playground: "Test an agent",
  "Knowledge Base": "Knowledge & data", Integrations: "Integration hub",
}[name] || name);
const navButton = ([name, icon]) => `<button data-page="${name}"><span aria-hidden="true">${icon}</span>${pageLabel(name)}</button>`;
$("#nav").innerHTML = navItems.slice(0, 5).map(navButton).join("") +
  `<details id="workspace-tools"><summary>Manage workspace</summary><div class="secondary-nav">${navItems.slice(5).map(navButton).join("")}</div></details>`;
$("#nav").onclick = (e) => {
  const b = e.target.closest("[data-page]");
  if (b) navigate(b.dataset.page);
};
function navigate(name) {
  if (busy) {
    toast("Please wait for the current request to finish.");
    return;
  }
  page = name;
  catalogLimit = 6;
  if (navItems.slice(5).some(([n]) => n === name)) $("#workspace-tools").open = true;
  else if (window.matchMedia("(max-width: 700px)").matches) $("#workspace-tools").open = false;
  render();
  window.scrollTo(0, 0);
}
function heading(title, sub, action = "") {
  return `<div class="page-heading"><div><h1>${title}</h1><p>${sub}</p></div>${action}</div>`;
}
function createButton() {
  return '<button class="primary" data-create>＋ Create agent</button>';
}
const domainLabel = (agent) => suite.domains.find((d) => d.id === agent.domain_id)?.name || agent.domain;
const capabilityLabel = (id) => suite.capabilities.find((c) => c.id === id)?.name || id;
function cards(items) {
  return `<div class="grid">${items.map((a) => `<article class="card"><div class="card-top"><span class="agent-icon">${icons[a.type] || "\u2727"}</span><span class="badge ${a.status === "Working" ? "live" : ""}">${esc(a.status || "Configured")}</span></div><h3>${esc(a.name)}</h3><p>${esc(a.description || "Your custom agent, ready to test.")}</p><div class="capability-tags">${(a.capabilities || []).map((id) => `<span>${esc(capabilityLabel(id))}</span>`).join("")}</div><div class="card-bottom"><span>${esc(domainLabel(a))}</span><button data-open="${esc(a.id ? `id:${a.id}` : a.name)}">Test &rarr;</button></div>${!a.id ? `<button class="template-use" data-template="${esc(a.template_id)}">Use this template &rarr;</button>` : ""}</article>`).join("")}</div>`;
}
function overview() {
  const recent = saved.slice(0, 3);
  return heading("A little intelligence. A lot of possibility.",
    "Choose a solution, make it yours, and put it to work.") +
    `<section class="hero"><div class="hero-copy"><span class="eyebrow">DEEPAGENTS SUITE</span><h2>Great work starts<br>with the right agents.</h2><p>Start with a ready-made solution for your business.</p><button class="primary" data-go="Agent Marketplace">Find an agent &rarr;</button></div><div class="orb" aria-hidden="true">&#10035;</div></section>
    <div class="stats home-stats">${[
      ["Your agents", saved.length, "Saved in your workspace"],
      ["Templates to try", templates.length, "Including demos & simulations"],
      ["Completed runs", runs.length, "Recorded workspace activity"],
    ].map(([title, value, hint]) => `<div class="stat"><div class="stat-top"><span>${title}</span></div><strong>${value}</strong><small>${hint}</small></div>`).join("")}</div>
    <div class="section-heading"><div><h2>${recent.length ? "Pick up where you left off" : "A good place to start"}</h2><p>${recent.length ? "Your most recently created agents." : "Try a conversation, a document assistant, or an analysis."}</p></div><button class="text-button" data-go="${recent.length ? "My Agents" : "Agent Marketplace"}">View all &rarr;</button></div>
    ${cards(recent.length ? recent : [templates[0], templates.find((a) => a.type === "Document"), templates.find((a) => a.type === "Analysis")].filter(Boolean))}
    <details class="panel home-activity"><summary>Recent activity <span class="muted">${runs.length ? "\u00b7 " + runs.length + " runs" : "\u00b7 No runs yet"}</span></summary>${runs.slice(0, 3).map((r) => `<div class="activity"><span class="agent-icon">&#10023;</span><span>${esc(r.agent)}<small>${new Date(r.created).toLocaleString()}</small></span><span class="badge">${esc(r.mode)}</span></div>`).join("") || '<p class="muted">Test an agent to see its activity here.</p>'}<button class="text-button" data-go="Activity & Analytics">All activity &rarr;</button></details>`;
}
function libraryPage(source) {
  const mine = source === "user", items = mine ? saved : templates;
  const usedDomains = suite.domains;
  return heading(mine ? "Your agents" : "Find your next teammate",
    mine ? "Your own prompts, knowledge, and agent configurations." : "Choose a business solution. Each template brings the capabilities it needs.", createButton()) +
    `<div class="library-toolbar"><div class="scope-tabs"><button class="${mine ? "" : "selected"}" data-go="Agent Marketplace">Templates <span>${templates.length}</span></button><button class="${mine ? "selected" : ""}" data-go="My Agents">My agents <span>${saved.length}</span></button></div></div>
    <div class="catalog-filters"><label class="catalog-search">Search<input class="search" id="search" placeholder="Find an agent..." type="search"></label><label>Business domain<select id="domain-filter"><option value="">All domains</option>${usedDomains.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join("")}${items.some((a) => !a.domain_id) ? '<option value="other">Other domains</option>' : ''}</select></label><label>Capability<select id="capability-filter"><option value="">All capabilities</option>${suite.capabilities.map((c) => `<option value="${c.id}">${esc(c.short_name || c.name)}</option>`).join("")}</select></label></div>
    <div class="catalog-status"><span id="catalog-count" aria-live="polite"></span><button class="text-button" id="clear-filters" hidden>Clear filters</button></div>
    <div id="catalog">${cards(items.slice(0, catalogLimit))}</div><div class="catalog-more"><button class="secondary" id="show-more" ${items.length <= catalogLimit ? "hidden" : ""}>Show more agents</button></div>
    ${!mine ? '<div class="suite-link"><span>Looking for WhatsApp, creative tools, or more business solutions?</span><button class="text-button" data-go="Suite roadmap">Explore the suite roadmap &rarr;</button></div>' : ""}`;
}
function marketplace() {
  return libraryPage("foundry");
}
function playground() {
  return (
    heading("The playground", "A space to try, refine, and find what works.") +
    `<div class="play-toolbar"><label>Choose an agent<select id="agent-select">${[...templates, ...saved].map((a, i) => `<option value="${i}" ${(a.id ? a.id === chosen.id : !chosen.id && a.name === chosen.name) ? "selected" : ""}>${esc(a.name)}${a.id ? " \u00b7 My agent" : " \u00b7 Template"}</option>`).join("")}</select></label><button class="secondary" id="reset-chat">Reset</button></div><details class="agent-context"><summary>About this agent &middot; ${esc(chosen.type)} &middot; ${esc(domainLabel(chosen))}</summary><p>${esc(chosen.description || "Your custom agent configuration.")}</p><p class="muted">${provider === "Groq" ? "Groq is configured for generated answers." : "Demo mode provides reference lookup. Configure Groq in Settings for generated answers."}</p>${!chosen.id ? `<button class="text-button" data-template="${esc(chosen.template_id)}">Create my version &rarr;</button>` : ""}</details><div class="panel" id="play-body">${playBody()}</div>`
  );
}
function playBody() {
  if (chosen.type === "Analysis")
    return `<span class="eyebrow">CALCULATED FROM YOUR DATA</span><h2>From spreadsheets to clear insights.</h2><p class="muted">Upload CSV or Excel XLSX for numeric statistics, missing values, and unique counts. Reports cover every populated worksheet and can be downloaded.</p>${chosen.dataset ? `<div class="notice">Attached dataset: <b>${esc(chosen.dataset)}</b> <button class="text-button" id="analyze-attached">Analyze attached data →</button></div>` : ""}<div class="upload"><label>Upload CSV or Excel<input type="file" id="csv-file" accept=".csv,.xlsx"></label><p class="muted">5 MB maximum. For saved agents, this replaces the attached dataset after successful analysis.</p></div><button class="secondary" id="sample-csv">Try sample sales data ↗</button><p class="form-error" id="analysis-error" role="alert"></p><div id="analysis-result" aria-live="polite">${analysisReport ? analysisMarkup(analysisReport) : ""}</div>`;
  if (["Workflow", "Agent Team"].includes(chosen.type))
    return `<span class="eyebrow">INTERACTIVE SIMULATION</span><h2>${chosen.type === "Workflow" ? "A clear path from trigger to outcome." : "Good work is a team effort."}</h2><p class="muted">This preview demonstrates handoffs. It does not execute external actions or run multiple models.</p><div id="workflow-steps">${(chosen.type === "Workflow" ? ["Receive request", "Classify & check context", "Human reviews proposed action", "Complete & record outcome"] : ["Researcher gathers references", "Analyst prepares findings", "Reviewer checks evidence", "Human approves final output"]).map((s, i) => `<div class="activity"><span class="agent-icon">${i + 1}</span><span>${s}</span><span class="badge" id="step-${i}">Waiting</span></div>`).join("")}</div><button class="primary" id="simulate" style="margin-top:20px">Start simulation →</button><p id="simulation-status" class="muted" aria-live="polite"></p>`;
  return `${chosen.documents?.length ? `<div class="notice">Knowledge ready: ${chosen.documents.map((d) => `${esc(d.filename)} (${d.chunks} chunks)`).join(", ")}. Answers retrieve only this agent’s documents.</div>` : ""}${chosen.type === "Document" && !chosen.documents?.length ? '<label>Reference knowledge<textarea id="knowledge" rows="4" placeholder="Paste reference text here (up to 20,000 characters)." maxlength="20000"></textarea></label><p class="muted">For agents without uploaded files, paste reference text here. Saved agents use their indexed documents when present.</p>' : ""}${chosen.type === "Voice" ? '<div class="notice">Browser voice demo: dictation and read-aloud depend on browser support and microphone permission. No telephone calls are connected.</div><button class="secondary" id="dictate">🎙 Dictate a message</button><label style="display:inline;margin-left:12px"><input type="checkbox" id="speak" style="width:auto"> Read answers aloud</label>' : ""}<div class="messages" id="messages" aria-live="polite"><div class="message"><small>✳ ${esc(chosen.name)}</small>Hello! What would you like to explore today?</div></div><form class="chat-input" id="chat-form"><input id="chat-message" required maxlength="6000" placeholder="Ask your agent a question…" aria-label="Message"><button class="primary" id="send">Send ↗</button></form>`;
}
function knowledge() {
  const agents = saved.filter((a) => a.documents?.length || a.dataset);
  return heading("Knowledge & data", "Each agent keeps its own documents and analysis data.", createButton()) +
    (agents.length ? `<div class="grid">${agents.map((a) => `<article class="card"><span class="agent-icon">&#10023;</span><h3>${esc(a.name)}</h3><p>${a.documents?.length || 0} knowledge document(s)${a.dataset ? " \u00b7 Analysis data attached" : ""}</p><details><summary>View files</summary>${(a.documents || []).map((d) => `<p><a class="document-link" href="/api/agents/${a.id}/documents/${d.id}">${esc(d.filename)} ?</a><small>${d.chunks} indexed chunks</small></p>`).join("")}${a.dataset ? `<p>Dataset: ${esc(a.dataset)}</p>` : ""}</details><div class="card-bottom"><span>Private to this agent</span><button data-open="id:${a.id}">Open agent &rarr;</button></div></article>`).join("")}</div>` : '<div class="panel empty"><h2>Give your agents useful context</h2><p>Add PDF, DOCX, text files, or analysis spreadsheets when creating an agent.</p><button class="primary" data-create>Create an agent</button></div>') +
    '<details class="panel home-activity"><summary>How knowledge works</summary><p class="muted">Documents are retrieved separately for each account and agent using local TF-IDF matching. Groq can answer from the selected excerpts. Scanned PDFs need OCR before upload. Analysis agents use CSV/XLSX files.</p></details>';
}
function integrations() {
  const planned = [["WhatsApp Business", "Customer messaging and approved campaigns"], ["VAPI / Telephony", "Inbound and outbound phone calls"], ["n8n", "Connected business workflows"], ["CRM / ERP", "Business records and approved updates"], ["Database sources", "Relational data and Text2SQL"], ["Image & video providers", "Branded creative and media generation"], ["Email / SMS", "Business notifications and follow-ups"]];
  return heading("Integration hub", "Manage current connections. Explore future channels when you need them.") +
    `<div class="grid"><article class="card"><div class="card-top"><span class="agent-icon">&#10023;</span><span class="badge">${provider === "Groq" ? "Configured \u00b7 unverified" : "Setup needed"}</span></div><h3>Groq</h3><p>Language generation for conversations and document answers.</p><div class="card-bottom"><span>AI provider</span><button data-go="Settings">Setup details &rarr;</button></div></article><article class="card"><div class="card-top"><span class="agent-icon">&#10023;</span><span class="badge">${authSettings.google_configured ? "Configured" : "Setup needed"}</span></div><h3>Google sign-in</h3><p>Sign-in and private account workspaces.</p><div class="card-bottom"><span>Identity</span><button data-go="Settings">Setup details &rarr;</button></div></article></div>
    <details class="panel home-activity"><summary>Planned integrations <span class="muted">&middot; ${planned.length} categories</span></summary><p class="muted">These connections are part of the proposal and are not active.</p><div class="integration-list">${planned.map(([name, scope]) => `<div><b>${name}</b><p>${scope}</p><span class="badge">Planned</span></div>`).join("")}</div></details>`;
}
function suiteRoadmap() {
  return heading("One suite. Built in stages.", "The proposal's capabilities, business domains, and solution templates, organized separately.") +
    `<div class="notice">Roadmap concepts describe future scope. Use the marketplace to test current agents.</div>
    ${suite.phases.map((phase) => `<details class="panel roadmap-phase" ${phase.id === 1 ? "open" : ""}><summary><span class="phase-number">${phase.id}</span><span>${esc(phase.name)}</span><span class="badge">${phase.id === 1 ? "Current foundation" : "Planned"}</span></summary><p class="muted">${esc(phase.description)}</p><div class="capability-list">${suite.capabilities.filter((c) => c.phase === phase.id).map((c) => `<div><b>${esc(c.product)}</b><span class="badge">${esc(c.status)}</span><p>${esc(c.scope)}</p></div>`).join("")}</div></details>`).join("")}
    <details class="panel roadmap-phase"><summary>12 business domains</summary><div class="domain-chips">${suite.domains.map((d) => `<span>${esc(d.name)}</span>`).join("")}</div></details>
    <details class="panel roadmap-phase"><summary>17 proposed solution templates</summary><label>Business domain<select id="roadmap-domain"><option value="">All domains</option>${suite.domains.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join("")}</select></label><div id="roadmap-concepts">${roadmapConcepts("")}</div></details>
    <details class="panel roadmap-phase"><summary>Shared platform services</summary><p class="muted">Chat, Knowledge, and Research share retrieval infrastructure. Multi-agent coordination is a shared service. The proposal also calls for tenant roles, provider tools, approval execution, database and object storage adapters, background jobs, monitoring, and billing. These enterprise services remain planned.</p></details>`;
}
function roadmapConcepts(domain) {
  return suite.template_concepts.filter((t) => !domain || t.domain_id === domain).map((t) => `<div class="concept-row"><div><b>${esc(t.name)}</b><small>${esc(suite.domains.find((d) => d.id === t.domain_id)?.name)} &middot; ${t.capabilities.map(capabilityLabel).map(esc).join(" + ")}</small></div><span class="badge">Phase ${t.phase} &middot; Planned</span></div>`).join("");
}
function analytics() {
  return (
    heading(
      "Every run tells a story",
      "Actual activity recorded by this POC. No synthetic usage metrics.",
    ) +
    `<div class="panel"><h2>Run history</h2>${runs.length ? `<div class="table-wrap"><table><thead><tr><th>AGENT</th><th>EXECUTION MODE</th><th>TIME</th></tr></thead><tbody>${runs.map((r) => `<tr><td>${esc(r.agent)}</td><td>${esc(r.mode)}</td><td>${new Date(r.created).toLocaleString()}</td></tr>`).join("")}</tbody></table></div>` : '<p class="empty">No runs yet. Try a conversation or analyze a CSV.</p>'}</div>`
  );
}
function settings() {
  return heading("Make it your workspace", "Provider setup, account access, and local storage.") +
    `<details class="panel roadmap-phase" open><summary>AI provider <span class="badge">${esc(provider)}</span></summary><p class="muted">For generated answers, set GROQ_API_KEY in the root .env file and restart. GROQ_MODEL selects a model available to your account. Existing server environment variables take precedence.</p><p class="muted">Groq powers language generation. Image and video generation need separate providers.</p></details>
    <details class="panel roadmap-phase"><summary>Account & sign-in</summary><p class="muted">${authSettings.google_configured ? "Google sign-in is configured. Each account has a private workspace." : "The local demo uses a shared evaluation account. Configure Google sign-in for separate account workspaces."}</p><p class="muted">Google sign-in uses GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and SESSION_SECRET in .env. See docs/google-login.md for setup.</p></details>
    <details class="panel roadmap-phase"><summary>Storage & saved data</summary><p class="muted">Agent records, document indexes, datasets, reports, and run history are stored in the local Excel workbook. Each agent has its own folder for code, prompts, and original knowledge files. Keep the workbook closed in Excel while the app saves changes.</p><p class="muted">Chat conversation history and temporary pasted reference text stay in browser memory.</p><a class="download" href="/api/storage/export">Download my workspace tables</a></details>
    <details class="panel roadmap-phase"><summary>Voice</summary><p class="muted">Current voice support uses browser dictation and read-aloud. It depends on browser support and microphone permission. Telephone calling is planned.</p></details>
    <details class="panel roadmap-phase"><summary>Platform roadmap</summary><p class="muted">Company roles, semantic embeddings, OCR, connected workflows, media generation, campaigns, and billing are planned.</p><button class="text-button" data-go="Suite roadmap">View the suite roadmap &rarr;</button></details>`;
}
function render() {
  if (busy) return;
  $("#crumb").textContent = pageLabel(page);
  document
    .querySelectorAll("[data-page]")
    .forEach((button) => {
      const active = button.dataset.page === page;
      button.classList.toggle("active", active);
      if (active) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current");
    });
  $("#content").innerHTML =
    page === "Overview"
      ? overview()
      : page === "Agent Marketplace"
        ? marketplace()
        : page === "My Agents"
          ? libraryPage("user")
          : page === "Playground"
            ? playground()
            : page === "Knowledge Base"
              ? knowledge()
              : page === "Integrations"
                ? integrations()
                : page === "Activity & Analytics"
                  ? analytics()
                  : page === "Suite roadmap"
                    ? suiteRoadmap()
                    : settings();
  bind();
}
function bindTemplateButtons() {
  document.querySelectorAll("[data-template]").forEach((button) => {
    button.onclick = () => openBuilder(button.dataset.template);
  });
}
function bind() {
  bindTemplateButtons();
  if ($("#roadmap-domain")) $("#roadmap-domain").onchange = (event) => {
    $("#roadmap-concepts").innerHTML = roadmapConcepts(event.target.value);
  };
  document
    .querySelectorAll("[data-create]")
    .forEach((b) => (b.onclick = openBuilder));
  document
    .querySelectorAll("[data-go]")
    .forEach((b) => (b.onclick = () => navigate(b.dataset.go)));
  document.querySelectorAll("[data-open]").forEach(
    (b) =>
      (b.onclick = () => {
        chosen = resolveAgent(b.dataset.open);
        history = [];
        analysisReport = null;
        navigate("Playground");
      }),
  );
  if ($("#search")) {
    const resetLimitAndFilter = () => { catalogLimit = 6; filterCatalog(); };
    $("#search").oninput = resetLimitAndFilter;
    $("#domain-filter").onchange = resetLimitAndFilter;
    $("#capability-filter").onchange = resetLimitAndFilter;
    $("#clear-filters").onclick = () => {
      $("#search").value = ""; $("#domain-filter").value = ""; $("#capability-filter").value = "";
      resetLimitAndFilter();
    };
    $("#show-more").onclick = () => { catalogLimit += 6; filterCatalog(); };
    filterCatalog();
  }
  if ($("#agent-select")) {
    $("#agent-select").onchange = (e) => {
      chosen = [...templates, ...saved][+e.target.value];
      history = [];
      analysisReport = null;
      render();
    };
    $("#reset-chat").onclick = () => {
      history = [];
      render();
    };
  }
  if ($("#chat-form")) $("#chat-form").onsubmit = sendChat;
  if ($("#sample-csv"))
    $("#sample-csv").onclick = () =>
      analyze(
        "Month,Revenue,Orders\nJanuary,12000,120\nFebruary,15000,145\nMarch,18000,170",
      );
  if ($("#csv-file"))
    $("#csv-file").onchange = async (e) => {
      const file = e.target.files[0];
      if (file) await analyzeFile(file);
    };
  if ($("#analyze-attached")) $("#analyze-attached").onclick = analyzeAttached;
  if ($("#simulate")) $("#simulate").onclick = simulate;
  if ($("#dictate")) $("#dictate").onclick = dictate;
}
function filterCatalog() {
  const query = $("#search").value.trim().toLowerCase(), domain = $("#domain-filter").value,
    capability = $("#capability-filter").value;
  const list = (page === "My Agents" ? saved : templates).filter((agent) =>
    [agent.name, domainLabel(agent), agent.description || "", ...(agent.capabilities || []).map(capabilityLabel)].join(" ").toLowerCase().includes(query) &&
    (!domain || (domain === "other" ? !agent.domain_id : agent.domain_id === domain)) &&
    (!capability || agent.capabilities?.includes(capability)));
  $("#catalog").innerHTML = list.length ? cards(list.slice(0, catalogLimit)) : '<div class="panel empty">No agents match. Try another search or clear the filters.</div>';
  $("#catalog-count").textContent = `Showing ${Math.min(catalogLimit, list.length)} of ${list.length} agents`;
  $("#clear-filters").hidden = !(query || domain || capability);
  $("#show-more").hidden = list.length <= catalogLimit;
  document.querySelectorAll("#catalog [data-open]").forEach((button) => {
    button.onclick = () => { chosen = resolveAgent(button.dataset.open); history = []; analysisReport = null; navigate("Playground"); };
  });
  bindTemplateButtons();
}
async function sendChat(e) {
  e.preventDefault();
  const message = $("#chat-message").value.trim();
  if (!message || busy) return;
  const knowledge = $("#knowledge")?.value || "",
    speak = $("#speak")?.checked;
  busy = true;
  $("#send").disabled = true;
  $("#chat-message").value = "";
  const box = $("#messages");
  box.insertAdjacentHTML(
    "beforeend",
    `<div class="message user">${esc(message)}</div><div class="message" id="pending">Thinking…</div>`,
  );
  box.scrollTop = box.scrollHeight;
  try {
    const r = await api("chat", {
      message,
      agent_id: chosen.id || null,
      template_id: chosen.template_id || null,
      agent: chosen.name,
      domain: chosen.domain,
      instructions: chosen.instructions || "",
      knowledge,
      history,
    });
    $("#pending").innerHTML =
      `<small>${esc(r.mode)} · ${esc(chosen.name)}</small>${esc(r.answer)}${r.sources?.length ? `<div class="source-list"><b>Retrieved sources</b>${r.sources.map((source, i) => `<div>[${i + 1}] ${esc(source.source)} · ${esc(source.location)}<details><summary>View excerpt</summary>${esc(source.text)}</details></div>`).join("")}</div>` : ""}`;
    history.push(
      { role: "user", content: message },
      { role: "assistant", content: r.answer },
    );
    history = history.slice(-12);
    if (speak && "speechSynthesis" in window) {
      speechSynthesis.cancel();
      speechSynthesis.speak(new SpeechSynthesisUtterance(r.answer));
    }
    refreshActivity().catch(() => {});
  } catch (error) {
    $("#pending").textContent = error.message;
  } finally {
    busy = false;
    $("#send").disabled = false;
    box.scrollTop = box.scrollHeight;
  }
}
function analysisMarkup(report) {
  return `<div class="analysis-heading"><div><h2>${esc(report.filename)}</h2><p class="muted">${report.sheets.length} worksheet(s) · generated ${new Date(report.created).toLocaleString()}</p></div><div class="report-downloads"><a class="download" href="/api/reports/${report.report_id}/download">↓ Excel report</a><a class="download" href="/api/reports/${report.report_id}/download?format=json">↓ JSON</a></div></div>${report.warnings.map((w) => `<p class="notice">${esc(w)}</p>`).join("")}${report.sheets.map((sheet) => `<section class="sheet-result"><h3>${esc(sheet.name)} · ${sheet.rows.toLocaleString()} rows · ${sheet.columns.length} columns</h3>${sheet.metrics.length ? `<div class="table-wrap"><table><thead><tr><th>COLUMN</th><th>COUNT</th><th>TOTAL</th><th>AVERAGE</th><th>MEDIAN</th><th>MIN</th><th>MAX</th></tr></thead><tbody>${sheet.metrics.map((m) => `<tr><td>${esc(m.column)}</td>${["count", "sum", "average", "median", "min", "max"].map((k) => `<td>${Number(m[k]).toLocaleString()}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : '<p class="muted">No fully numeric columns found.</p>'}<details><summary>Data quality</summary><div class="table-wrap"><table><thead><tr><th>COLUMN</th><th>MISSING</th><th>UNIQUE NONEMPTY</th></tr></thead><tbody>${sheet.quality.map((q) => `<tr><td>${esc(q.column)}</td><td>${q.missing}</td><td>${q.unique}</td></tr>`).join("")}</tbody></table></div></details><h3>Preview (first 8 rows)</h3><div class="table-wrap"><table><thead><tr>${sheet.columns.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${sheet.preview.map((row) => `<tr>${sheet.columns.map((c) => `<td>${esc(row[c])}</td>`).join("")}</tr>`).join("")}</tbody></table></div></section>`).join("")}`;
}
async function runAnalysis(action) {
  if (busy) return;
  busy = true;
  $("#analysis-error").textContent = "";
  const buttons = ["#sample-csv", "#analyze-attached", "#csv-file"]
    .map((s) => $(s))
    .filter(Boolean);
  buttons.forEach((b) => (b.disabled = true));
  $("#analysis-result").innerHTML =
    '<p class="muted">Analyzing your dataset…</p>';
  try {
    analysisReport = await action();
    $("#analysis-result").innerHTML = analysisMarkup(analysisReport);
    await refreshActivity();
  } catch (e) {
    $("#analysis-result").innerHTML = "";
    $("#analysis-error").textContent = e.message;
  } finally {
    busy = false;
    buttons.forEach((b) => (b.disabled = false));
  }
}
async function analyze(content) {
  await runAnalysis(() => api("analyze", { content }));
}
async function analyzeAttached() {
  await runAnalysis(() => api(`agents/${chosen.id}/analyze`, {}));
}
async function analyzeFile(file) {
  if (file.size > 5 * 1024 * 1024)
    return toast("Please choose a file smaller than 5 MB.");
  const data = new FormData();
  data.append("file", file);
  if (chosen.id) data.append("agent_id", chosen.id);
  await runAnalysis(async () => {
    const report = await api("analyze/upload", data);
    if (chosen.id) {
      chosen.dataset = file.name;
      saved = await api("agents");
    }
    return report;
  });
}
function resolveAgent(value) {
  return (
    [...templates, ...saved].find((a) =>
      a.id ? `id:${a.id}` === value : a.name === value,
    ) || templates[0]
  );
}
async function simulate() {
  $("#simulate").disabled = true;
  let preview;
  try {
    preview = await api("preview", {
      message: "Preview",
      agent_id: chosen.id || null,
      template_id: chosen.template_id || null,
    });
    $("#workflow-steps").innerHTML = preview.steps
      .map(
        (label, i) =>
          `<div class="activity"><span class="agent-icon">${i + 1}</span><span>${esc(label)}</span><span class="badge" id="step-${i}">Waiting</span></div>`,
      )
      .join("");
  } catch (error) {
    if ($("#simulation-status"))
      $("#simulation-status").textContent = error.message;
    if ($("#simulate")) $("#simulate").disabled = false;
    return;
  }
  let step = 0;
  $("#simulate").disabled = true;
  const advance = () => {
    const el = $(`#step-${step}`);
    if (!el) return;
    el.textContent = step === 2 ? "Human approval required" : "Simulated";
    el.classList.add("live");
    if (step === 2) {
      $("#simulation-status").textContent =
        "Review this fictional proposal: proceed with the sample outcome? No external action will occur.";
      $("#simulate").textContent = "Approve simulated outcome";
      $("#simulate").disabled = false;
      $("#simulate").onclick = () => {
        step++;
        advance();
      };
      return;
    }
    step++;
    if (step < preview.steps.length) setTimeout(advance, 500);
    else {
      $("#simulation-status").textContent =
        "Simulation complete. No external systems were changed.";
      $("#simulate").textContent = "Run again";
      $("#simulate").disabled = false;
      $("#simulate").onclick = () => {
        $("#play-body").innerHTML = playBody();
        bind();
        simulate();
      };
    }
  };
  advance();
}
function dictate() {
  const Recognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition)
    return toast(
      "Dictation is not supported in this browser. You can type a message instead.",
    );
  const r = new Recognition();
  r.lang = "en-US";
  r.onresult = (e) => {
    $("#chat-message").value = e.results[0][0].transcript;
    toast("Dictation captured. Review the message, then send.");
  };
  r.onerror = () =>
    toast(
      "Microphone unavailable. Check browser permissions or type your message.",
    );
  try {
    r.start();
  } catch {
    toast("Unable to start the microphone.");
  }
}
function syncBuilder() {
  const analysis = $("#type-options").value === "Analysis";
  $("#dataset-fields").hidden = !analysis;
  $("#dataset-fields input").disabled = !analysis;
  $("#knowledge-fields").hidden = analysis;
  $("#knowledge-fields input").disabled = analysis;
}
function showBuilderStep(step) {
  builderStep = step;
  document.querySelectorAll("[data-builder-step]").forEach((element) => { element.hidden = +element.dataset.builderStep !== step; });
  document.querySelectorAll(".builder-step-label").forEach((element, index) => {
    element.classList.toggle("current", index === step);
    if (index === step) element.setAttribute("aria-current", "step"); else element.removeAttribute("aria-current");
  });
  $("#builder-back").hidden = step === 0;
  $("#builder-next").hidden = step === 2;
  $("#builder-submit").hidden = step !== 2;
  $("#builder-error").textContent = "";
  if (step === 2) $("#builder-review").textContent = `${$("#builder-form [name=name]").value} \u00b7 ${$("#domain-options").value} \u00b7 ${$("#type-options").value}`;
  $("#builder").scrollTop = 0;
  document.querySelector(`[data-builder-step="${step}"] input, [data-builder-step="${step}"] textarea`)?.focus();
}
function nextBuilderStep() {
  if (builderStep === 0) {
    const input = $("#builder-form [name=name]");
    if (!input.value.trim()) { input.setCustomValidity("Give your agent a name."); input.reportValidity(); input.setCustomValidity(""); return; }
    if (!input.reportValidity()) return;
  }
  showBuilderStep(Math.min(2, builderStep + 1));
}
function chooseBuilderTemplate() {
  const template = templates.find((t) => t.template_id === $("#template-options").value);
  if (template) {
    $("#builder-form [name=name]").value = template.name;
    $("#domain-options").value = domainLabel(template);
    $("#type-options").value = template.type;
    $("#builder-form [name=instructions]").value = template.instructions;
  }
  syncBuilder();
}
function openBuilder(templateId = "") {
  $("#builder-form").reset();
  $("#template-options").innerHTML = '<option value="">Start from scratch</option>' + templates.map((t) => `<option value="${esc(t.template_id)}">${esc(t.name)}</option>`).join("");
  $("#template-options").value = typeof templateId === "string" ? templateId : "";
  if ($("#template-options").value) chooseBuilderTemplate();
  else syncBuilder();
  $("#builder").showModal();
  showBuilderStep(0);
}
function populateBuilderDomains() {
  $("#domain-options").innerHTML = domains.map((domain) => `<option>${esc(domain)}</option>`).join("");
}
populateBuilderDomains();
const typeLabels = { Voice: "Voice (browser demo)", Analysis: "Analysis (CSV / Excel)", Document: "Document & RAG", Workflow: "Workflow (simulation)", "Agent Team": "Agent team (simulation)" };
$("#type-options").innerHTML = types.map((type) => `<option value="${type}">${typeLabels[type] || type}</option>`).join("");
$("#type-options").onchange = () => {
  const template = templates.find((t) => t.template_id === $("#template-options").value);
  if (template && template.type !== $("#type-options").value) $("#template-options").value = "";
  syncBuilder();
};
$("#template-options").onchange = chooseBuilderTemplate;
$("#builder-next").onclick = nextBuilderStep;
$("#builder-back").onclick = () => showBuilderStep(Math.max(0, builderStep - 1));
$("#side-create").onclick = () => openBuilder();
$("#close-builder").onclick = () => $("#builder").close();
$("#builder").addEventListener("cancel", (event) => { if ($("#builder-submit").disabled) event.preventDefault(); });
$("#builder-form").onsubmit = async (e) => {
  e.preventDefault();
  if (builderStep < 2) { nextBuilderStep(); return; }
  const button = e.target.querySelector("[type=submit]");
  const form = new FormData(e.target);
  for (const [key, value] of [...form.entries()]) {
    if (value instanceof File && !value.name) form.delete(key);
  }
  const files = [...form.values()].filter((v) => v instanceof File);
  if (files.some((f) => f.size > 5 * 1024 * 1024)) {
    $("#builder-error").textContent = "Each file must be 5 MB or smaller.";
    return;
  }
  if (form.getAll("knowledge_files").length > 5) {
    $("#builder-error").textContent =
      "Attach at most five knowledge documents.";
    return;
  }
  button.disabled = true;
  $("#close-builder").disabled = true;
  $("#builder-back").disabled = true;
  button.textContent = "Reading files & preparing agent…";
  $("#builder-error").textContent = "";
  try {
    const created = await api("agents/upload", form);
    saved = await api("agents");
    await refreshActivity();
    chosen = saved.find((a) => a.id === created.id);
    history = [];
    analysisReport = null;
    $("#builder").close();
    e.target.reset();
    navigate("Playground");
    toast("Agent and attachments saved. Ready to test.");
  } catch (error) {
    $("#builder-error").textContent = error.message;
  } finally {
    button.disabled = false;
    $("#close-builder").disabled = false;
    $("#builder-back").disabled = false;
    button.textContent = "Create agent & test";
  }
};
async function refreshActivity() {
  const [r, p, storage] = await Promise.all([
    api("runs"),
    api("reports"),
    api("storage"),
  ]);
  runs = r;
  reports = p;
  storageInfo = storage;
}
function showLogin() {
  currentUser = null;
  $("#workspace-shell").hidden = true;
  $("#login-screen").hidden = false;
  $("#google-signin").disabled = !authSettings.google_configured;
  $("#google-setup").hidden = !!authSettings.google_configured;
  $("#demo-login").hidden = !authSettings.demo_allowed;
  const error = new URLSearchParams(location.search).get("auth_error");
  if (error)
    $("#login-error").textContent =
      error === "origin"
        ? "Use the same hostname as GOOGLE_REDIRECT_URI to sign in."
        : "Google sign-in was cancelled or could not be verified. Please retry.";
}
async function loadWorkspace() {
  const [a, r, s, c, p, storage, taxonomy] = await Promise.all([
    api("agents"),
    api("runs"),
    api("status"),
    api("catalog"),
    api("reports"),
    api("storage"),
    api("suite"),
  ]);
  suite = taxonomy;
  domains = suite.domains.map((domain) => domain.name);
  populateBuilderDomains();
  saved = a;
  runs = r;
  templates = c;
  reports = p;
  storageInfo = storage;
  provider = s.provider;
  chosen = templates[0];
  $("#provider").textContent = "● " + provider + " mode";
  const initials = currentUser.name
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  $("#workspace-shell .workspace").innerHTML = `${esc(initials)} <span>${currentUser.id === "demo" ? "Demo workspace" : "My workspace"}<small>Personal workspace</small></span>`;
  $("#profile-avatar").textContent = initials;
  $("#header-avatar").textContent = initials;
  $("#profile-name").innerHTML =
    `${esc(currentUser.name)}<small>${esc(currentUser.email)}</small>`;
  $("#login-screen").hidden = true;
  $("#workspace-shell").hidden = false;
  render();
}
$("#google-signin").onclick = () => {
  location.href = "/api/auth/google";
};
$("#demo-login").onclick = async () => {
  try {
    await api("auth/demo", {});
    const session = await api("auth/me");
    currentUser = session.user;
    await loadWorkspace();
  } catch (e) {
    $("#login-error").textContent = e.message;
  }
};
$("#logout").onclick = async () => {
  if (busy) return toast("Wait for the current request to finish.");
  await api("auth/logout", {});
  saved = [];
  runs = [];
  reports = [];
  history = [];
  analysisReport = null;
  page = "Overview";
  showLogin();
};
(async () => {
  try {
    authSettings = await api("auth/me");
    if (authSettings.user) {
      currentUser = authSettings.user;
      await loadWorkspace();
    } else if (authSettings.demo_allowed) {
      await api("auth/demo", {});
      currentUser = (await api("auth/me")).user;
      await loadWorkspace();
    } else showLogin();
  } catch (e) {
    $("#login-screen").hidden = false;
    $("#login-error").textContent =
      "Could not load the workspace: " + e.message;
  }
})();

window.legacySuiteUI = { libraryPage, playBody, bind, filterCatalog };
