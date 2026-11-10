/* Proposal-aligned product navigation and configurable agent setup. */
let discoveryView = 'templates';
let editingAgent = null;
let playCategory = "", playDomain = "";
const categoryLabel = (id) => getCapability(id)?.short_name || capabilityLabel(id);
const runtimeTypes = { chat: 'Chat', voice: 'Voice', analytics: 'Analysis', documents: 'Document', knowledge: 'Document', automation: 'Workflow', orchestration: 'Agent Team' };
const getCapability = (id) => suite.capabilities.find((item) => item.id === id);
const productLabel = (id) => getCapability(id)?.product || id;
const statusLabel = (agent) => ({ draft: 'Configuration draft', ready: 'Ready to test', demo: 'Browser demo', simulation: 'Simulation' }[agent.execution_status] || agent.status || 'Configured');
const baseLibraryPage = window.legacySuiteUI.libraryPage;
const basePlayBody = window.legacySuiteUI.playBody;
const baseBind = window.legacySuiteUI.bind;

function overview() {
  const groups = [...new Set(suite.capabilities.map((cap) => cap.group))];
  return heading('Your business. A whole suite of possibilities.', 'DeepAgents Suite brings specialist AI capabilities, business domains and configurable solutions together.') +
    `<section class="hero suite-hero"><div class="hero-copy"><span class="eyebrow">ONE PLATFORM. SPECIALIST AGENTS.</span><h2>From a conversation<br>to a complete solution.</h2><p>Chat, voice, knowledge, analytics, business automation and creative media. Choose an agent category or start with a solution template, then make it your own.</p><div class="hero-actions"><button class="primary" data-discovery="types">Explore agent types &rarr;</button><button class="secondary" data-create>Create an agent</button></div></div><img class="suite-hero-image" src="/static/images/suite-hero.png" alt="Connected specialist modules for conversations, voice, documents, analytics, creative media and workflows"></section>
    <div class="stats home-stats">${[[14, 'Agent categories', 'Reusable specialist capabilities'], [12, 'Business domains', 'Industry context and knowledge'], [17, 'Solution templates', 'Ready to customize; availability varies']].map(([number, title, detail]) => `<div class="stat"><strong>${number}</strong><b>${title}</b><small>${detail}</small></div>`).join('')}</div>
    <div class="section-heading"><div><h2>One suite. Three simple choices.</h2><p>Start with how it works, where it helps, or a complete business solution.</p></div></div>
    <div class="grid suite-layers">${[['types', '01', 'Agent categories', 'HOW it works', 'Choose DeepChat, DeepVoice, DeepAnalytics or another specialist.'], ['domains', '02', 'Business domains', 'WHERE it helps', 'Add the business context, from HR & Recruitment to IT & Enterprise Operations.'], ['templates', '03', 'Agent templates', 'WHAT it solves', 'Start with a named solution such as Employee Knowledge Assistant or Property Marketing Agent.']].map(([view, number, title, label, description]) => `<article class="card"><span class="eyebrow">${number} / ${label}</span><h3>${title}</h3><p>${description}</p><button class="text-button" data-discovery="${view}">Explore ${title.toLowerCase()} &rarr;</button></article>`).join('')}</div>
    <div class="section-heading"><div><h2>Meet the DeepAgents family</h2><p>All 14 agent categories from the suite blueprint.</p></div></div>
    <div class="family-grid">${groups.map((group, index) => `<article class="panel family-card"><span class="family-symbol" aria-hidden="true">${['&#9743;', '&#10023;', '&#8984;', '&#9672;', '&#10022;'][index]}</span><h3>${esc(group)}</h3><div class="family-products">${suite.capabilities.filter((cap) => cap.group === group).map((cap) => `<button data-capability="${cap.id}"><b>${esc(cap.product)}</b><span>${esc(cap.name)}</span><small>${esc(cap.status)}</small></button>`).join('')}</div></article>`).join('')}</div>
    <section class="panel suite-start"><div><span class="eyebrow">BUILT AROUND YOUR BUSINESS</span><h2>Your domain. Your instructions. Your knowledge.</h2><p>Write a system prompt or upload one, attach Word or PDF reference files, choose tools and integrations, then save and test your agent.</p></div><button class="primary" data-create>Build my agent &rarr;</button></section>
    <details class="panel home-activity"><summary>Explore all 12 business domains</summary><div class="domain-chips">${suite.domains.map((domain) => `<button data-builder-domain="${domain.id}">${esc(domain.name)}</button>`).join('')}</div></details>`;
}

function cards(items) {
  return `<div class="grid">${items.map((agent) => `<article class="card"><div class="card-top"><span class="agent-icon">${icons[agent.type] || '&#10023;'}</span><span class="badge">${esc(statusLabel(agent))}</span></div><h3>${esc(agent.name)}</h3><p>${esc(agent.description || 'Your configured specialist agent, with its own prompt and reference sources.')}</p><div class="capability-tags">${(agent.capabilities || []).map((id) => `<span title="${esc(capabilityLabel(id))}">${esc(productLabel(id))}</span>`).join('')}</div><div class="card-bottom"><span>${esc(domainLabel(agent))}</span><button data-open="${esc(agent.id ? `id:${agent.id}` : agent.name)}">${agent.execution_status === 'draft' ? 'Review' : 'Test'} &rarr;</button></div>${agent.id ? `<button class="template-use" data-configure="${agent.id}">Tools & integrations &rarr;</button>` : `<button class="template-use" data-template="${esc(agent.template_id)}">Customize this template &rarr;</button>`}</article>`).join('')}</div>`;
}

function libraryPage(source) {
  if (source === 'user') return baseLibraryPage(source);
  const tabs = `<div class="discovery-tabs" role="group" aria-label="Explore the suite">${[['types', 'Agent categories', 14], ['domains', 'Business domains', 12], ['templates', 'Agent templates', 17]].map(([view, label, count]) => `<button class="${view === discoveryView ? 'selected' : ''}" data-discovery="${view}" aria-pressed="${view === discoveryView}">${label} <span>${count}</span></button>`).join('')}</div>`;
  const title = { types: 'Choose how your agent works', domains: 'Choose your business domain', templates: 'Choose a solution template' }[discoveryView];
  let content;
  if (discoveryView === 'types') {
    content = `<div class="grid">${suite.capabilities.map((cap) => `<article class="card"><div class="card-top"><span class="agent-icon">${icons[runtimeTypes[cap.id]] || '&#10023;'}</span><span class="badge">${esc(cap.status)}</span></div><span class="eyebrow">${esc(cap.group)}</span><h3>${esc(cap.product)}</h3><b class="category-name">${esc(cap.name)}</b><p>${esc(cap.scope)}</p><div class="card-bottom"><span>Reusable across domains</span><button data-capability="${cap.id}">Configure &rarr;</button></div></article>`).join('')}</div>`;
  } else if (discoveryView === 'domains') {
    content = `<div class="grid">${suite.domains.map((domain) => `<article class="card"><span class="agent-icon">&#9672;</span><h3>${esc(domain.name)}</h3><p>${templates.filter((t) => t.domain_id === domain.id).map((t) => t.name).map(esc).join(' · ')}</p><div class="card-bottom"><button class="text-button" data-domain-templates="${domain.id}">View templates</button><button data-builder-domain="${domain.id}">Create agent &rarr;</button></div></article>`).join('')}</div>`;
  } else {
    content = `<div class="catalog-filters"><label class="catalog-search">Search templates<input class="search" id="search" type="search" placeholder="Find a solution..."></label><label>Business domain<select id="domain-filter"><option value="">All 12 domains</option>${suite.domains.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}</select></label><label>Agent category<select id="capability-filter"><option value="">All 14 categories</option>${suite.capabilities.map((cap) => `<option value="${cap.id}">${esc(cap.short_name)} - ${esc(cap.product)}</option>`).join('')}</select></label></div><div class="catalog-status"><span id="catalog-count" aria-live="polite"></span><button class="text-button" id="clear-filters" hidden>Clear filters</button></div><div id="catalog">${cards(templates.slice(0, catalogLimit))}</div><div class="catalog-more"><button class="secondary" id="show-more">Show more templates</button></div>`;
  }
  return heading(title, 'Agent categories define how. Domains provide context. Templates combine them into business solutions.', createButton()) + tabs + content;
}

function playground() {
  const all = [...templates, ...saved];
  const matches = all.filter((agent) => (!playCategory || agent.capabilities?.includes(playCategory)) && (!playDomain || agent.domain_id === playDomain));
  if (matches.length && !matches.includes(chosen)) { chosen = matches[0]; history = []; analysisReport = null; }
  return heading('Select and test an agent', 'Choose an agent category, business domain, and a solution template or saved agent.', createButton()) +
    `<div class="catalog-filters play-selection"><label>Agent category<select id="play-category-filter"><option value="">All 14 agent categories</option>${suite.capabilities.map((cap) => `<option value="${cap.id}" ${cap.id === playCategory ? 'selected' : ''}>${esc(cap.short_name)}</option>`).join('')}</select></label><label>Business domain<select id="play-domain-filter"><option value="">All 12 business domains</option>${suite.domains.map((domain) => `<option value="${domain.id}" ${domain.id === playDomain ? 'selected' : ''}>${esc(domain.name)}</option>`).join('')}</select></label></div>
    ${matches.length ? `<div class="play-toolbar"><label>Agent template or my agent<select id="agent-select">${matches.map((agent) => `<option value="${all.indexOf(agent)}" ${agent === chosen ? 'selected' : ''}>${esc(agent.name)} / ${agent.id ? 'My agent' : 'Template'} / ${esc(statusLabel(agent))}</option>`).join('')}</select></label><button class="secondary" id="reset-chat">Reset conversation</button></div><details class="agent-context"><summary>About this agent / ${esc(categoryLabel(chosen.primary_capability || chosen.capabilities?.[0]))} / ${esc(domainLabel(chosen))}</summary><p>${esc(chosen.description || 'Your private agent configuration.')}</p>${!chosen.id ? `<button class="text-button" data-template="${chosen.template_id}">Customize this template</button>` : ''}</details><div class="panel" id="play-body">${playBody()}</div>` : `<div class="panel empty"><h2>Create a ${esc(playCategory ? categoryLabel(playCategory) : 'custom')} agent</h2><p>No template or saved agent matches this combination yet. All categories and domains can be used when creating your own agent.</p><button class="primary" id="create-from-selection">Create an agent with this selection</button><button class="text-button" id="clear-play-selection">Show all 17 templates</button></div>`}`;
}

function playBody() {
  if (chosen.execution_status === 'draft') return `<div class="configuration-summary"><span class="eyebrow">SAVED CONFIGURATION</span><h2>${esc(chosen.name)}</h2><p>This solution needs services that are not connected yet. You can configure its prompt, private knowledge, tools and channels now.</p><div class="capability-tags">${(chosen.capabilities || []).map((id) => `<span>${esc(productLabel(id))}</span>`).join('')}</div><p><b>Tools:</b> ${(chosen.tools || []).map(connectionName).map(esc).join(', ') || 'None selected'}</p><p><b>Integrations:</b> ${(chosen.integrations || []).map(connectionName).map(esc).join(', ') || 'None selected'}</p><p><b>Channels:</b> ${(chosen.channels || []).map(esc).join(', ') || 'Not selected'}</p>${chosen.id ? `<button class="primary" data-configure="${chosen.id}">Edit tools & integrations</button>` : `<button class="primary" data-template="${chosen.template_id}">Customize this template</button>`}</div>`;
  return basePlayBody();
}

function connectionName(id) { return suite.integrations.find((entry) => entry.id === id)?.name || id; }
function integrations() {
  return heading('Tools & integrations', 'Choose connections while creating an agent, or update them from My Agents.', createButton()) +
    `<div class="notice">Built-in tools are available now. Provider entries marked Planned can be saved in agent configurations; their execution adapters are not connected yet.</div>` +
    ['tool', 'integration'].map((kind) => `<section class="agent-group"><div class="section-heading"><h2>${kind === 'tool' ? 'Agent tools' : 'Provider integrations'}</h2></div><div class="grid">${suite.integrations.filter((entry) => entry.kind === kind).map((entry) => `<article class="card"><div class="card-top"><span class="agent-icon">&#8984;</span><span class="badge">${esc(entry.status)}</span></div><h3>${esc(entry.name)}</h3><p>${esc(entry.description)}</p><div class="card-bottom"><span>${saved.filter((agent) => [...agent.tools, ...agent.integrations].includes(entry.id)).length} agent configuration(s)</span><button data-connection-preset="${entry.id}">Use in an agent &rarr;</button></div></article>`).join('')}</div></section>`).join('');
}
function primarySelection() { return $('#primary-options').value || 'chat'; }
function selectedCapabilities() { return [...new Set([primarySelection(), ...[...document.querySelectorAll('#additional-capabilities input:checked')].map((input) => input.value)])]; }
function mandatoryConnections(primary, capabilities) {
  const result = [];
  if (['chat', 'voice', 'documents', 'knowledge'].includes(primary)) result.push('groq');
  if (capabilities.some((id) => ['documents', 'knowledge'].includes(id))) result.push('knowledge_lookup');
  if (primary === 'analytics') result.push('spreadsheet_analysis');
  if (primary === 'voice') result.push('browser_voice');
  return result;
}
function renderConnections(container, selected = [], mandatory = []) {
  const option = (entry, kind) => `<label class="connection-option"><input type="checkbox" value="${entry.id}" data-kind="${kind}" ${(selected.includes(entry.id) || mandatory.includes(entry.id)) ? 'checked' : ''} ${mandatory.includes(entry.id) ? 'disabled' : ''}><span><b>${esc(entry.name)}</b><small>${esc(entry.description)}</small></span><span class="badge">${esc(entry.status)}</span></label>`;
  container.innerHTML = ['tool', 'integration'].map((kind) => {
    const entries = suite.integrations.filter((entry) => entry.kind === kind);
    const current = entries.filter((entry) => ['Available', 'Browser demo'].includes(entry.status));
    const planned = entries.filter((entry) => !current.includes(entry));
    return `<section class="connection-section"><h3>${kind === 'tool' ? 'Agent tools' : 'Provider integrations'}</h3><div class="connection-options">${current.map((entry) => option(entry, kind)).join('')}</div><details class="planned-connections" ${planned.some((entry) => selected.includes(entry.id)) ? 'open' : ''}><summary>More ${kind === 'tool' ? 'tools' : 'providers'} for future setup <span class="muted">(${planned.length})</span></summary><div class="connection-options planned-options">${planned.map((entry) => option(entry, kind)).join('')}</div></details></section>`;
  }).join('');
}
function renderChannels(container, selected = ['web']) {
  container.innerHTML = [['web', 'Web portal'], ['phone', 'Telephone'], ['whatsapp', 'WhatsApp'], ['instagram', 'Instagram'], ['email', 'Email'], ['sms', 'SMS']].map(([id, name]) => `<label class="check-option"><input type="checkbox" value="${id}" ${selected.includes(id) ? 'checked' : ''}>${name}${id !== 'web' ? ' (planned)' : ''}</label>`).join('');
}
function readConnections(container, channels, approval) {
  return { tools: [...container.querySelectorAll('[data-kind=tool]:checked')].map((input) => input.value), integrations: [...container.querySelectorAll('[data-kind=integration]:checked')].map((input) => input.value), channels: [...channels.querySelectorAll('input:checked')].map((input) => input.value), approval_required: approval.checked };
}
function capabilityChoices(selected) {
  $('#additional-capabilities').innerHTML = suite.capabilities.map((cap) => `<label class="check-option"><input type="checkbox" value="${cap.id}" ${selected.includes(cap.id) ? 'checked' : ''} ${cap.id === primarySelection() ? 'disabled' : ''}><span><b>${esc(cap.product)}</b><small>${esc(cap.name)}</small></span></label>`).join('');
}
function syncBuilder() {
  const primary = primarySelection();
  $('#type-options').value = runtimeTypes[primary] || 'Chat';
  $('#category-description').textContent = `${getCapability(primary)?.product || ''}: ${getCapability(primary)?.scope || ''}`;
  $('#dataset-fields').hidden = primary !== 'analytics';
  $('#dataset-fields input').disabled = primary !== 'analytics';
  $('#knowledge-fields').hidden = false;
  $('#knowledge-fields input').disabled = false;
}
function showBuilderStep(step) {
  builderStep = step;
  document.querySelectorAll('[data-builder-step]').forEach((element) => { element.hidden = +element.dataset.builderStep !== step; });
  document.querySelectorAll('.builder-step-label').forEach((element, index) => { element.classList.toggle('current', index === step); if (index === step) element.setAttribute('aria-current', 'step'); else element.removeAttribute('aria-current'); });
  $('#builder-back').hidden = step === 0;
  $('#builder-next').hidden = step === 3;
  $('#builder-submit').hidden = step !== 3;
  $('#builder-error').textContent = '';
  if (step === 3) {
    const mandatory = mandatoryConnections(primarySelection(), selectedCapabilities());
    for (const input of document.querySelectorAll('#builder-connections input')) {
      input.disabled = mandatory.includes(input.value);
      if (input.disabled) input.checked = true;
    }
    $('#builder-review').textContent = `${$('#builder-form [name=name]').value} / ${$('#domain-options').value} / ${selectedCapabilities().map(productLabel).join(' + ')}`;
  }
  $('#builder').scrollTop = 0;
  document.querySelector(`[data-builder-step="${step}"] input:not([type=hidden]), [data-builder-step="${step}"] textarea`)?.focus();
}
function nextBuilderStep() {
  if (builderStep === 0) {
    const input = $('#builder-form [name=name]');
    if (!input.value.trim()) { input.setCustomValidity('Give your agent a name.'); input.reportValidity(); input.setCustomValidity(''); return; }
    if (!input.reportValidity()) return;
  }
  if (builderStep === 1) {
    const instructions = $('#builder-form [name=instructions]');
    if (!instructions.reportValidity()) return;
  }
  showBuilderStep(Math.min(3, builderStep + 1));
}
function chooseBuilderTemplate() {
  const template = templates.find((entry) => entry.template_id === $('#template-options').value);
  if (template) {
    $('#builder-form [name=name]').value = template.name;
    $('#domain-options').value = domainLabel(template);
    $('#primary-options').value = template.primary_capability;
    $('#builder-form [name=instructions]').value = template.instructions;
    capabilityChoices(template.capabilities);
    renderConnections($('#builder-connections'), [...(template.tools || []), ...(template.integrations || [])], mandatoryConnections(template.primary_capability, template.capabilities));
    renderChannels($('#builder-channels'), template.channels?.length ? template.channels : ['web']);
  }
  syncBuilder();
}
function openBuilder(preset = {}) {
  if (typeof preset === 'string') preset = { template: preset };
  if (!preset || preset instanceof Event) preset = {};
  $('#builder-form').reset();
  $('#primary-options').innerHTML = suite.capabilities.map((cap) => `<option value="${cap.id}">${esc(cap.short_name)} - ${esc(cap.product)}</option>`).join('');
  $('#template-options').innerHTML = '<option value="">Build a custom agent</option>' + templates.map((template) => `<option value="${template.template_id}">${esc(template.name)}</option>`).join('');
  $('#template-options').value = preset.template || '';
  $('#primary-options').value = preset.capability || 'chat';
  capabilityChoices([primarySelection()]);
  renderConnections($('#builder-connections'), getCapability(primarySelection())?.suggested_connections || [], mandatoryConnections(primarySelection(), selectedCapabilities()));
  renderChannels($('#builder-channels'));
  if (preset.template) chooseBuilderTemplate();
  if (preset.domain) $('#domain-options').value = suite.domains.find((domain) => domain.id === preset.domain)?.name || domains[0];
  if (preset.connection) {
    const input = document.querySelector(`#builder-connections input[value="${CSS.escape(preset.connection)}"]`);
    if (input) input.checked = true;
  }
  syncBuilder();
  $('#builder').showModal();
  showBuilderStep(0);
}

function bind() {
  baseBind();
  if ($('#play-category-filter')) $('#play-category-filter').onchange = (event) => { playCategory = event.target.value; render(); };
  if ($('#play-domain-filter')) $('#play-domain-filter').onchange = (event) => { playDomain = event.target.value; render(); };
  if ($('#create-from-selection')) $('#create-from-selection').onclick = () => openBuilder({ capability: playCategory || 'chat', domain: playDomain || undefined });
  if ($('#clear-play-selection')) $('#clear-play-selection').onclick = () => { playCategory = ''; playDomain = ''; render(); };
  document.querySelectorAll('[data-discovery]').forEach((button) => { button.onclick = () => { discoveryView = button.dataset.discovery; navigate('Agent Marketplace'); }; });
  document.querySelectorAll('[data-capability]').forEach((button) => { button.onclick = () => openBuilder({ capability: button.dataset.capability }); });
  document.querySelectorAll('[data-builder-domain]').forEach((button) => { button.onclick = () => openBuilder({ domain: button.dataset.builderDomain }); });
  document.querySelectorAll('[data-domain-templates]').forEach((button) => { button.onclick = () => { discoveryView = 'templates'; navigate('Agent Marketplace'); $('#domain-filter').value = button.dataset.domainTemplates; filterCatalog(); }; });
  document.querySelectorAll('[data-connection-preset]').forEach((button) => { button.onclick = () => openBuilder({ connection: button.dataset.connectionPreset, capability: ({ spreadsheet_analysis: 'analytics', knowledge_lookup: 'knowledge', browser_voice: 'voice' })[button.dataset.connectionPreset] || 'chat' }); });
  bindConfigurationButtons();
}
const baseFilterCatalog = window.legacySuiteUI.filterCatalog;
function filterCatalog() { baseFilterCatalog(); bindConfigurationButtons(); }
function bindConfigurationButtons() {
  document.querySelectorAll('[data-open]').forEach((button) => {
    button.onclick = () => { playCategory = ''; playDomain = ''; chosen = resolveAgent(button.dataset.open); history = []; analysisReport = null; navigate('Playground'); };
  });
  document.querySelectorAll('[data-configure]').forEach((button) => { button.onclick = () => openConnections(+button.dataset.configure); }); }
function openConnections(id) {
  editingAgent = saved.find((agent) => agent.id === id);
  if (!editingAgent) return;
  $('#agent-config-title').textContent = `${editingAgent.name}: connections`;
  renderConnections($('#edit-connections'), [...editingAgent.tools, ...editingAgent.integrations], mandatoryConnections(editingAgent.primary_capability, editingAgent.capabilities));
  renderChannels($('#edit-channels'), editingAgent.channels);
  $('#edit-approval').checked = editingAgent.approval_required;
  $('#agent-config-error').textContent = '';
  $('#agent-config').showModal();
}
$('#close-agent-config').onclick = () => $('#agent-config').close();
$('#agent-config-form').onsubmit = async (event) => {
  event.preventDefault();
  const button = event.target.querySelector('[type=submit]');
  button.disabled = true;
  try {
    const updated = await api(`agents/${editingAgent.id}/connections`, readConnections($('#edit-connections'), $('#edit-channels'), $('#edit-approval')), 'PUT');
    saved = saved.map((agent) => agent.id === updated.id ? updated : agent);
    if (chosen?.id === updated.id) chosen = updated;
    $('#agent-config').close(); render(); toast('Agent configuration saved.');
  } catch (error) { $('#agent-config-error').textContent = error.message; }
  finally { button.disabled = false; }
};
$('#primary-options').onchange = () => {
  $('#template-options').value = '';
  capabilityChoices([primarySelection()]);
  renderConnections($('#builder-connections'), getCapability(primarySelection())?.suggested_connections || [], mandatoryConnections(primarySelection(), selectedCapabilities()));
  syncBuilder();
};
$('#template-options').onchange = chooseBuilderTemplate;
$('#builder-next').onclick = nextBuilderStep;
$('#builder-back').onclick = () => showBuilderStep(Math.max(0, builderStep - 1));
$('#side-create').onclick = () => openBuilder();
$('#builder-form').onsubmit = async (event) => {
  event.preventDefault();
  if (builderStep < 3) { nextBuilderStep(); return; }
  const form = new FormData(event.target);
  const configuration = { ...readConnections($('#builder-connections'), $('#builder-channels'), $('#approval-required')), primary_capability: primarySelection(), capabilities: selectedCapabilities() };
  form.set('configuration', JSON.stringify(configuration));
  for (const [key, value] of [...form.entries()]) if (value instanceof File && !value.name) form.delete(key);
  if ([...form.values()].some((value) => value instanceof File && value.size > 5 * 1024 * 1024)) { $('#builder-error').textContent = 'Each file must be 5 MB or smaller.'; return; }
  if (form.getAll('knowledge_files').length > 5) { $('#builder-error').textContent = 'Attach at most five knowledge documents.'; return; }
  const buttons = ['#builder-submit', '#builder-back', '#close-builder'].map((selector) => $(selector));
  buttons.forEach((button) => { button.disabled = true; });
  $('#builder-submit').textContent = 'Preparing your agent...';
  $('#builder-error').textContent = '';
  try {
    const created = await api('agents/upload', form);
    saved = await api('agents');
    chosen = saved.find((agent) => agent.id === created.id);
    playCategory = ""; playDomain = "";
    history = []; analysisReport = null;
    $('#builder').close();
    navigate('Playground');
    toast(created.execution_status === 'draft' ? 'Configuration saved as a draft. Provider setup is still needed.' : 'Agent saved. Ready to test.');
  } catch (error) { $('#builder-error').textContent = error.message; }
  finally { buttons.forEach((button) => { button.disabled = false; }); $('#builder-submit').textContent = 'Create agent'; }
};

if (currentUser && suite.capabilities.length && !$("#workspace-shell").hidden) render();
