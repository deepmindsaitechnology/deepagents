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
const domains = [
  "HR",
  "Customer Support",
  "Sales & Marketing",
  "Logistics",
  "Finance",
  "Healthcare",
  "Manufacturing",
  "Real Estate",
  "Banking & Insurance",
];
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
  const r = await fetch(
    "/api/" + path,
    body
      ? {
          method,
          ...(body instanceof FormData
            ? { body }
            : {
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
              }),
        }
      : {},
  );
  const data = await r.json();
  if (!r.ok)
    throw Error(
      typeof data.detail === "string"
        ? data.detail
        : "Please check your input and try again.",
    );
  return data;
}
function toast(text) {
  $("#toast").textContent = text;
  $("#toast").style.display = "block";
  setTimeout(() => ($("#toast").style.display = "none"), 4500);
}
const navItems = [
  ["Overview", "◫"],
  ["Agent Marketplace", "▦"],
  ["My Agents", "♧"],
  ["Domains", "◈"],
  ["Prompts", "✎"],
  ["Playground", "▷"],
  ["Knowledge Base", "▤"],
  ["Activity & Analytics", "▥"],
  ["Integrations", "⌘"],
  ["Settings", "⚙"],
];
const pageLabel = (n) =>
  ({
    "Agent Marketplace": "Foundry Agents",
    "Activity & Analytics": "Runs & Reports",
  })[n] || n;
$("#nav").innerHTML = navItems
  .map(
    ([n, i]) =>
      `<button data-page="${n}"><span>${i}</span>${pageLabel(n)}</button>`,
  )
  .join("");
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
  render();
  window.scrollTo(0, 0);
}
function heading(title, sub, action = "") {
  return `<div class="page-heading"><div><h1>${title}</h1><p>${sub}</p></div>${action}</div>`;
}
function createButton() {
  return '<button class="primary" data-create>＋ Create agent</button>';
}
function cards(items) {
  return `<div class="grid">${items.map((a) => `<article class="card"><div class="card-top"><span class="agent-icon">${icons[a.type] || "✧"}</span><span class="badge ${a.status === "Working" ? "live" : ""}">${esc(a.source === "user" ? "My agent" : a.status || "Foundry")}</span></div><h3>${esc(a.name)}</h3><div class="agent-tags"><span>${a.source === "user" ? "Your workspace" : "Foundry template"}</span>${a.documents?.length ? `<span>▤ ${a.documents.length} document(s)</span>` : ""}</div><p>${esc(a.description || (a.instructions || "Your custom agent, ready to explore.").slice(0, 150))}</p><div class="card-bottom"><span>${esc(a.domain)} <span style="color:#ccd4cc"> / </span> ${esc(a.type)}</span><button data-open="${esc(a.id ? `id:${a.id}` : a.name)}">Explore ↗</button></div></article>`).join("")}</div>`;
}
function overview() {
  return (
    heading(
      "A little intelligence. A lot of possibility.",
      `Welcome, ${esc(currentUser?.name?.split(" ")[0] || "there")}. Find the right agent for the work ahead.`,
      createButton(),
    ) +
    `<section class="hero"><div class="hero-copy"><span class="eyebrow">ONE PLATFORM. YOUR ENTIRE TEAM.</span><h2>Great work starts<br>with the right agents.</h2><p>From the first conversation to the next big insight. Build your AI workforce, all in one place.</p><button class="primary" data-go="Agent Marketplace">Explore Foundry Agents ↗</button></div><div class="orb" aria-hidden="true">✳</div></section><div class="stats">${[
      ["Configured agents", saved.length, "Locally saved configurations"],
      ["Agent capabilities", "06", "Chat, voice, analysis & more"],
      ["Business domains", "09", "Reusable industry templates"],
      ["Completed runs", runs.length, "Actual runs in this workspace"],
    ]
      .map(
        ([t, n, s]) =>
          `<div class="stat"><div class="stat-top"><span>${t}</span><span>↗</span></div><strong>${n}</strong><small>${s}</small></div>`,
      )
      .join(
        "",
      )}</div><div class="section-heading"><div><h2>Meet your next teammates</h2><p>A curated starting point. Customize a template or create your own.</p></div><button class="text-button" data-go="Agent Marketplace">View all agents →</button></div>${cards(templates.slice(0, 6))}<div class="lower"><section><div class="section-heading"><h2>Built for your world</h2><span class="muted">9 domains</span></div><div class="panel"><div class="domain-chips">${domains.map((d) => `<button data-domain="${d}">${d} ↗</button>`).join("")}</div></div></section><section><div class="section-heading"><h2>Workspace activity</h2><button class="text-button" data-go="Activity & Analytics">View all →</button></div><div class="panel">${
      runs.length
        ? runs
            .slice(0, 3)
            .map(
              (r) =>
                `<div class="activity"><span class="agent-icon">✧</span><span>${esc(r.agent)}<small>${new Date(r.created).toLocaleString()}</small></span><span class="badge live">${esc(r.mode)}</span></div>`,
            )
            .join("")
        : '<p class="muted">Your story starts here. Try an agent to see real activity appear.</p><button class="text-button" data-go="Playground">Open playground →</button>'
    }</div></section></div>`
  );
}
function groupedCards(items) {
  return types
    .map((type) => {
      const group = items.filter((a) => a.type === type);
      return group.length
        ? `<section class="agent-group"><div class="section-heading"><h2>${icons[type]} ${type === "Agent Team" ? "Agent teams" : type + " agents"}</h2><span class="count-pill">${group.length}</span></div>${cards(group)}</section>`
        : "";
    })
    .join("");
}
function libraryPage(source) {
  const mine = source === "user",
    items = mine ? saved : templates;
  return (
    heading(
      mine ? "My Agents" : "Foundry Agents",
      mine
        ? "Your agents, organized by capability. Every agent has its own code, prompt, and knowledge folder."
        : "Explore curated templates by capability and business domain.",
      createButton(),
    ) +
    `<div class="library-toolbar"><div class="scope-tabs"><button class="${mine ? "" : "selected"}" data-go="Agent Marketplace">Foundry templates <span>${templates.length}</span></button><button class="${mine ? "selected" : ""}" data-go="My Agents">My agents <span>${saved.length}</span></button></div><div class="library-search"><input class="search" id="search" placeholder="Search agents…" aria-label="Search agents"><select id="domain-filter" aria-label="Filter by domain"><option>All domains</option>${domains.map((d) => `<option>${d}</option>`).join("")}</select></div></div><div class="filters" id="type-filter">${["All agents", ...types].map((t, i) => `<button class="${i ? "" : "selected"}" data-type="${t}">${t}</button>`).join("")}</div><div id="catalog">${items.length ? groupedCards(items) : '<div class="panel empty">Create your first agent to start organizing your workspace.</div>'}</div>`
  );
}
function marketplace() {
  return libraryPage("foundry");
}
function domainPage() {
  return (
    heading(
      "A workspace for every domain.",
      "Find agents that fit the way your team works.",
    ) +
    `<div class="grid domain-grid">${domains
      .map((domain, i) => {
        const foundry = templates.filter((a) => a.domain === domain).length,
          mine = saved.filter((a) => a.domain === domain).length;
        return `<article class="card domain-card"><span class="agent-icon">${["♧", "☏", "↗", "⌘", "▥", "✚", "⚙", "⌂", "◇"][i]}</span><h3>${domain}</h3><p>${foundry} Foundry template(s) · ${mine} of your agents</p><div class="card-bottom"><button data-domain="${domain}">Browse Foundry →</button><button data-user-domain="${domain}">My agents →</button></div></article>`;
      })
      .join("")}</div>`
  );
}
function promptsPage() {
  return (
    heading(
      "The instructions behind the intelligence.",
      "Foundry prompts are curated. Your prompts are editable and kept in named files.",
    ) +
    `<div class="section-heading"><h2>Your agent prompts</h2><span class="count-pill">${saved.length}</span></div>${saved.length ? `<div class="panel prompt-list">${saved.map((a) => `<div class="prompt-row"><span class="agent-icon">✎</span><div><b>${esc(a.name)}</b><small>${esc(a.domain)} · ${esc(a.type)}</small><code>${esc(a.prompt_path)}</code></div><button class="secondary" data-prompt="user:${a.id}">Edit prompt</button></div>`).join("")}</div>` : '<div class="panel empty">Create an agent to add your first prompt.</div>'}<div class="section-heading"><h2>Foundry prompts</h2><span class="count-pill">${templates.length}</span></div><div class="panel prompt-list">${templates.map((a) => `<div class="prompt-row"><span class="agent-icon">✧</span><div><b>${esc(a.name)}</b><small>${esc(a.domain)} · ${esc(a.type)}</small><code>${esc(a.prompt_path)}</code></div><button class="secondary" data-prompt="foundry:${a.template_id}">View prompt</button></div>`).join("")}</div>`
  );
}
function playground() {
  return (
    heading("The playground", "A space to try, refine, and find what works.") +
    `<div class="notice">${provider === "Groq" ? "Groq is configured. Requests use your server-side key." : "Demo mode: responses are scripted or reference lookups. Add GROQ_API_KEY to your .env file and restart for generated conversations."} Signed in to your workspace · Excel-backed prototype. Use sample data while evaluating.</div><div class="play-layout"><div class="panel control"><label>Choose your agent<select id="agent-select">${[...templates, ...saved].map((a, i) => `<option value="${i}" ${(a.id ? a.id === chosen.id : !chosen.id && a.name === chosen.name) ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select></label><label>Capability<input readonly value="${esc(chosen.type)}"></label><label>Domain<input readonly value="${esc(chosen.domain)}"></label><p class="muted">${esc(chosen.description || chosen.instructions || "Custom agent configuration")}</p><button class="secondary" id="reset-chat">Reset conversation</button></div><div class="panel" id="play-body">${playBody()}</div></div>`
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
  const agents = saved.filter((a) => a.documents?.length);
  return (
    heading(
      "Knowledge, organized by agent.",
      "Original files, extracted text, and account-specific indexes live together.",
      createButton(),
    ) +
    `<div class="notice">Knowledge files live in knowledge_base/user_agents/account/agent/. Chunk text and TF-IDF vectors are stored in Excel. Retrieval matches terms, not semantic paraphrases. Scanned PDFs need OCR.</div><div class="section-heading"><h2>Your knowledge collections</h2><span class="count-pill">${agents.length} agents</span></div>${agents.length ? `<div class="grid">${agents.map((a) => `<article class="card"><div class="card-top"><span class="agent-icon">▤</span><span class="badge">${esc(a.domain)}</span></div><h3>${esc(a.name)}</h3><p class="file-path">${esc(a.knowledge_path)}</p>${a.documents.map((d) => `<div class="document-row"><span>${esc(d.filename)}<small>${d.chunks} indexed chunks</small></span>${d.file_path ? `<a href="/api/agents/${a.id}/documents/${d.id}" title="Download original document">↓</a>` : "<small>Extracted text retained</small>"}</div>`).join("")}<div class="card-bottom"><span>Private to your account</span><button data-open="id:${a.id}">Ask this agent ↗</button></div></article>`).join("")}</div>` : '<div class="panel empty">No knowledge files yet. Attach PDF, Word DOCX, or text while creating an agent.</div>'}<div class="section-heading"><h2>Foundry samples</h2></div><div class="panel"><h3>Fictional HR policy</h3><p class="muted">A sample policy for the HR Policy Assistant. Foundry samples are separate from your account’s documents.</p><code>knowledge_base/foundry/hr_policy_assistant/</code></div>`
  );
}
function integrations() {
  return (
    heading(
      "Connect the dots",
      "The tools your agents could work with, all in one place.",
    ) +
    `<div class="notice">Only Groq has a backend integration in this POC. Other cards show the planned integration catalog.</div><div class="grid">${[
      [
        "Groq",
        "LLM inference",
        provider === "Groq" ? "Configured · unverified" : "Key needed",
      ],
      ["Salesforce", "CRM & sales", "Planned"],
      ["Slack", "Team communication", "Planned"],
      ["Google Drive", "Documents & knowledge", "Planned"],
      ["Twilio / Vapi", "Telephone voice", "Planned"],
      ["n8n", "Workflow automation", "Planned"],
      ["SAP", "Enterprise operations", "Planned"],
      ["HRMS", "People & payroll", "Planned"],
      ["Shipment APIs", "Logistics tracking", "Planned"],
    ]
      .map(
        ([n, d, s]) =>
          `<article class="card"><div class="card-top"><span class="agent-icon">⌘</span><span class="badge">${s}</span></div><h3>${n}</h3><p>${d}</p><div class="card-bottom"><span>${n === "Groq" ? "Server-side connection" : "Future integration"}</span><button data-integration="${n}">${n === "Groq" ? "Setup guide" : "View scope"} ↗</button></div></article>`,
      )
      .join("")}</div>`
  );
}
function analytics() {
  return (
    heading(
      "Runs & Reports",
      "Your execution history and downloadable analysis in one place.",
    ) +
    `<div class="section-heading"><h2>Analysis reports</h2><span class="count-pill">${reports.length}</span></div><div class="panel">${reports.length ? `<div class="table-wrap"><table><thead><tr><th>REPORT</th><th>CREATED</th><th>DOWNLOAD</th></tr></thead><tbody>${reports.map((r) => `<tr><td>${esc(r.filename)}</td><td>${new Date(r.created).toLocaleString()}</td><td><a class="download" href="/api/reports/${r.id}/download">Excel ↓</a> <a class="download" href="/api/reports/${r.id}/download?format=json">JSON ↓</a></td></tr>`).join("")}</tbody></table></div>` : '<p class="empty">Analyze a dataset to create your first report.</p>'}</div><div class="section-heading"><h2>Run history</h2></div><div class="panel">${runs.length ? `<div class="table-wrap"><table><thead><tr><th>AGENT</th><th>MODE</th><th>TIME</th></tr></thead><tbody>${runs.map((r) => `<tr><td>${esc(r.agent)}</td><td>${esc(r.mode)}</td><td>${new Date(r.created).toLocaleString()}</td></tr>`).join("")}</tbody></table></div>` : '<p class="empty">No runs yet. Try a conversation or analyze a file.</p>'}</div>`
  );
}
function settings() {
  return (
    heading("Workspace settings", "Your account, connections, and storage.") +
    `<div class="panel"><h2>Your account</h2><p>${esc(currentUser?.name)} · ${esc(currentUser?.email)}</p><p class="muted">${currentUser?.id === "demo" ? "Local demo workspace. Configure Google OAuth to create individual account workspaces." : "Verified Google account. Your agents, documents, runs, and report downloads are scoped to this account."}</p><h2>Groq connection</h2><p class="muted">Mode: ${provider}. Set GROQ_API_KEY and GROQ_MODEL in .env; restart after changes. Keep credentials out of prompts and frontend files.</p><h2>Excel storage</h2><p class="muted">All application tables are stored as worksheets in data/platform.xlsx (or DEEPAGENT_WORKBOOK). Large values are split losslessly into the _long_values sheet. Close the workbook in Excel before making changes through the app. One server worker is recommended.</p><a class="download" href="/api/storage/export">↓ Export my workspace tables</a><div class="table-wrap"><table><thead><tr><th>TABLE</th><th>YOUR ROWS</th></tr></thead><tbody>${Object.entries(
      storageInfo?.tables || {},
    )
      .map(([t, n]) => `<tr><td>${t}</td><td>${n}</td></tr>`)
      .join(
        "",
      )}</tbody></table></div><h2>Repository organization</h2><div class="repo-tree"><code>foundry_agents/ · built-in capability implementations<br>foundry_prompts/ · one named prompt per template<br>user_agents/account/agent/ · agent manifest &amp; editable Python<br>user_prompts/account/ · one named prompt per agent<br>knowledge_base/foundry/ · sample reference documents<br>knowledge_base/user_agents/account/agent/ · documents &amp; datasets<br>data/platform.xlsx · application tables</code></div><h2>Prototype limits</h2><p class="muted">Excel is for local or small-scale evaluation, not concurrent production use. Company-level administration, billing, neural embeddings, OCR, and telephone integrations remain future work. Local developers can access the workbook and trusted Python extensions.</p></div>`
  );
}
function render() {
  if (busy) return;
  $("#crumb").textContent = pageLabel(page);
  document
    .querySelectorAll("[data-page]")
    .forEach((b) => b.classList.toggle("active", b.dataset.page === page));
  $("#content").innerHTML =
    page === "Overview"
      ? overview()
      : page === "Agent Marketplace"
        ? marketplace()
        : page === "My Agents"
          ? libraryPage("user")
          : page === "Domains"
            ? domainPage()
            : page === "Prompts"
              ? promptsPage()
              : page === "Playground"
                ? playground()
                : page === "Knowledge Base"
                  ? knowledge()
                  : page === "Integrations"
                    ? integrations()
                    : page === "Activity & Analytics"
                      ? analytics()
                      : settings();
  bind();
  bindOrganization();
}
function bind() {
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
  document.querySelectorAll("[data-domain]").forEach(
    (b) =>
      (b.onclick = () => {
        navigate("Agent Marketplace");
        $("#domain-filter").value = b.dataset.domain;
        filterCatalog();
      }),
  );
  document
    .querySelectorAll("[data-integration]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          b.dataset.integration === "Groq"
            ? navigate("Settings")
            : toast(
                `${b.dataset.integration} is planned. No connection is active.`,
              )),
    );
  if ($("#search")) {
    $("#search").oninput = filterCatalog;
    $("#domain-filter").onchange = filterCatalog;
    $("#type-filter").onclick = (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      $("#type-filter .selected").classList.remove("selected");
      b.classList.add("selected");
      filterCatalog();
    };
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
  const q = $("#search").value.toLowerCase(),
    d = $("#domain-filter").value,
    t = $("#type-filter .selected").dataset.type;
  const list = (page === "My Agents" ? saved : templates).filter(
    (a) =>
      (a.name + " " + a.domain + " " + a.description)
        .toLowerCase()
        .includes(q) &&
      (d === "All domains" || a.domain === d) &&
      (t === "All agents" || a.type === t),
  );
  $("#catalog").innerHTML = list.length
    ? groupedCards(list)
    : '<p class="empty">No templates match these filters.</p>';
  document.querySelectorAll("#catalog [data-open]").forEach(
    (b) =>
      (b.onclick = () => {
        chosen = resolveAgent(b.dataset.open);
        history = [];
        navigate("Playground");
      }),
  );
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
    await refreshActivity();
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
function openBuilder() {
  $("#builder-error").textContent = "";
  syncBuilder();
  $("#builder").showModal();
}
$("#domain-options").innerHTML = domains
  .map((d) => `<option>${d}</option>`)
  .join("");
$("#type-options").innerHTML = types
  .map((t) => `<option>${t}</option>`)
  .join("");
$("#type-options").onchange = syncBuilder;
$("#side-create").onclick = openBuilder;
$("#close-builder").onclick = () => $("#builder").close();
$("#builder-form").onsubmit = async (e) => {
  e.preventDefault();
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
    button.textContent = "Create agent & prepare files ↗";
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
function bindOrganization() {
  document.querySelectorAll("[data-user-domain]").forEach(
    (b) =>
      (b.onclick = () => {
        navigate("My Agents");
        $("#domain-filter").value = b.dataset.userDomain;
        filterCatalog();
      }),
  );
  document
    .querySelectorAll("[data-prompt]")
    .forEach((b) => (b.onclick = () => openPrompt(b.dataset.prompt)));
}
let editingPrompt = null;
function openPrompt(value) {
  const [scope, id] = value.split(":");
  const agent =
    scope === "user"
      ? saved.find((a) => a.id === +id)
      : templates.find((a) => a.template_id === id);
  if (!agent) return;
  editingPrompt = scope === "user" ? agent : null;
  $("#prompt-title").textContent = agent.name;
  $("#prompt-path").textContent = agent.prompt_path;
  $("#prompt-text").value = agent.instructions || "";
  $("#prompt-text").readOnly = !editingPrompt;
  $("#save-prompt").hidden = !editingPrompt;
  $("#prompt-error").textContent = "";
  $("#prompt-dialog").showModal();
}
$("#close-prompt").onclick = () => $("#prompt-dialog").close();
$("#prompt-form").onsubmit = async (e) => {
  e.preventDefault();
  if (!editingPrompt) return;
  $("#save-prompt").disabled = true;
  try {
    await api(
      `agents/${editingPrompt.id}/prompt`,
      { instructions: $("#prompt-text").value },
      "PUT",
    );
    saved = await api("agents");
    if (chosen?.id === editingPrompt.id)
      chosen = saved.find((a) => a.id === chosen.id);
    $("#prompt-dialog").close();
    render();
    toast("Prompt file and workbook updated.");
  } catch (error) {
    $("#prompt-error").textContent = error.message;
  } finally {
    $("#save-prompt").disabled = false;
  }
};
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
  const [a, r, s, c, p, storage] = await Promise.all([
    api("agents"),
    api("runs"),
    api("status"),
    api("catalog"),
    api("reports"),
    api("storage"),
  ]);
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
    } else showLogin();
  } catch (e) {
    $("#login-screen").hidden = false;
    $("#login-error").textContent =
      "Could not load the workspace: " + e.message;
  }
})();
