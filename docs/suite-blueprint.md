# DeepAgents Suite: proposal alignment

Source: **DeepAgents Proposal doc.pdf**, supplied with this project. The document describes the target product; its proposed integrations and commercial capabilities are not evidence of implemented services.

## Permanent product model

Keep these three layers separate:

1. **Capabilities** describe what an agent can do. The product catalog records all 14 DeepChat through DeepOrchestrator capabilities, with current availability and scope.
2. **Business domains** describe where it is applied. The catalog records the proposal's 12 domains and maps older domain labels for existing agents.
3. **Solution templates** combine a business purpose, domain, capabilities, instructions, knowledge and eventually tools, channels and policies. The marketplace uses the exact 17 solution names from the proposal. Every solution can be customized and saved; services without execution adapters remain configuration drafts. The older 11 template IDs remain available through `legacy_catalog.json` for existing clients, but are not mixed into the new UI.

`foundry_agents/suite.json` is the product taxonomy. `GET /api/suite` exposes it to authenticated users. `foundry_agents/catalog.json` contains the current runnable/demo template registry. Each Foundry folder retains its own manifest, implementation, system prompt and knowledge sources.

Templates can declare multiple capabilities. The current execution registry still dispatches through a primary capability. Metadata does not activate multiple engines or connected workflows. DeepOrchestrator remains a future shared execution service; the existing Agent Team screen is explicitly a simulation.

## User experience implemented

The existing green palette, fonts, rounded cards, hero artwork, sidebar and overall visual language remain. Information is revealed in context:

| Area | Organization |
| --- | --- |
| Home | Suite overview with a generated illustration, the three product layers, all 14 capability families and expandable business domains. |
| Marketplace | Separate Agent categories, Business domains and Agent templates views. Template search includes all 12 domains and all 14 category options; results are paginated. |
| My Agents | The same discovery controls, scoped to the current account. |
| Agent builder | Four steps: choose an agent category/domain or template, write or attach a system prompt, attach private knowledge/data, then configure tools/integrations/channels. |
| Test an agent | Agent selection and task area first; configuration details are expandable. |
| Knowledge & data | Files grouped by owning agent, with expandable file lists and original-document downloads. Analysis datasets are included. |
| Integration hub | 18 configurable tool/provider entries. Current built-in tools are distinguished from planned execution adapters. Credentials remain server-side. |
| Suite roadmap | Four development stages, 14 capabilities with accurate status, 12 domains and 17 filterable solution concepts. |
| Settings | Separate expandable sections for providers, sign-in, storage, voice and roadmap. |

The sidebar keeps five daily destinations visible. Integration hub, activity, suite roadmap and settings sit under **Manage workspace**. Mobile navigation wraps and closes that secondary group when returning to a daily task.

Starting from a template creates an independent prompt and records `template_id`, `domain_id` and `capabilities` in both the workbook and user manifest. Users attach their own private knowledge; shared template documents are not silently copied. System prompt text and prompt-file text are combined, while the original prompt upload remains separate from RAG documents. Tool IDs, integration IDs, channels and the approval preference are validated and stored in the workbook and per-agent manifest. Existing agents can update these connections through My Agents. Existing agents without these metadata fields remain readable. Workbook headers upgrade by appending the new fields without moving old data columns.

## Current boundaries

| Product area | Current behavior |
| --- | --- |
| DeepChat | Groq language generation when configured; local excerpt lookup otherwise. |
| DeepVoice | Browser dictation and read-aloud, not telephone calling. |
| DeepAnalytics | Calculated CSV/XLSX statistics and downloadable reports, not Text2SQL or arbitrary analysis code. |
| DeepDocs / DeepKnowledge | Text extraction and per-agent TF-IDF retrieval; no OCR or neural embeddings. |
| DeepFlow / DeepOrchestrator | Explicit simulations; no connected actions or multi-agent model execution. |
| Remaining capabilities | Product definitions and roadmap concepts; no active providers. |
| Identity | Google account isolation or shared local demo; no company tenants, roles or billing. |
| Database | Excel repository and optional legacy SQLite import; no PostgreSQL runtime yet. |

## Development stages and completion criteria

### 1. Core platform

Continue the current agent configuration, account isolation, retrieval and analysis foundation. Add telephone voice through a separately configured provider when that integration is implemented. Completion means users can create, test and run supported basic agents, with truthful execution status and per-account storage.

### 2. Connected business workflows

Implement provider adapters and webhook handling for telephone voice, WhatsApp, email and workflow execution. Add durable action state, review/approval handling, delivery status and lead records. Completion means configured providers carry out authorized actions and the platform records actual outcomes and failures. Showing a planned integration card is not completion.

### 3. Creative studio

Add image and video provider adapters, stored media assets, background jobs and a review workflow before publishing. Then connect campaigns to supported channels. Completion means users can generate, inspect, approve and retrieve real media, with job status and provider failures handled. Groq chat alone does not supply these capabilities.

### 4. Enterprise services

Add company tenant membership and roles, database/object-storage adapters, shared orchestration, monitoring, prediction, usage records and billing. Completion requires tenant-scoped execution and data access, real audit records, durable jobs and verified isolation across the new services.

## Technical continuity

The current FastAPI backend and static frontend remain in place; no framework migration is required for this organization pass. The proposal's React/Next.js, PostgreSQL/pgvector, object storage, job queue and orchestration stack are future architecture decisions, not installed dependencies.

Keep provider credentials outside agent configuration. Keep prompts separate from reference documents. Preserve authenticated ownership checks, runtime file isolation and the separation between product metadata and executable capability handlers as new adapters are added.

## Configuration and execution availability

All 14 agent categories and 17 proposed templates can be saved as configurations. A configuration is ready, a browser demo, a simulation, or a draft, based on its selected capabilities, tools and channels. Unsupported multi-engine combinations and planned providers are blocked from chat, workflow previews and saved-agent analysis with HTTP 409. Saving a provider selection does not install an adapter, validate credentials or execute a business action.

`PUT /api/agents/{id}/connections` updates only the authenticated owner's agent. Workbook and manifest edits compensate on save failure. Built-in knowledge, spreadsheet and browser-voice tools are added when required by the selected capability. No credentials are accepted in agent configuration. Google sign-in is platform identity, not a business-agent tool.

The home image is in `frontend/static/images/suite-hero.png`. Generation details are in [home artwork notes](home-artwork.md).
