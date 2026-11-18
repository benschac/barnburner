import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { allAnalystPlans } from '../.content-collections/generated/index.js'
import design from '../design/contract.json' with { type: 'json' }

export const renderAnalystPlan = async () => {
const root = new URL('../../../', import.meta.url)
if (allAnalystPlans.length !== 1) throw new Error('Expected exactly one generated analyst plan')
const [data] = allAnalystPlans
if (!data) throw new Error('Generated analyst plan is missing')
const scales = { space: design.space, radius: design.radius, fontSize: design.fontSize, lineHeight: design.lineHeight, size: design.size }
const variables = Object.entries(design.themes.dark).map(([key, value]) => '--' + key + ':' + value + ';').join('') + Object.entries(scales).map(([name, scale]) => Object.entries(scale).map(([key, value]) => '--' + name + '-' + key.replaceAll('.', '_') + ':' + value + 'px;').join('')).join('')
const html = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<title>RinkSide / Analyst agent plan</title>
<style>
:root{${variables}font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--color);background:var(--background);font-size:var(--fontSize-body);line-height:var(--lineHeight-detail);color-scheme:dark}
*{box-sizing:border-box}body{margin:0}button,input,select{font:inherit}button,a,input,select{touch-action:manipulation}button{cursor:pointer}button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:2px solid var(--bright);outline-offset:var(--space-1)}button{color:inherit}a{color:var(--bright);text-underline-offset:var(--space-1)}[hidden]{display:none!important}h1,h2,h3,p{margin:0}h1,h2,h3{color:var(--bright)}h2{font-size:var(--fontSize-title);line-height:var(--lineHeight-title);font-weight:500}h3{font-size:var(--fontSize-detail);line-height:var(--lineHeight-detail);font-weight:500}code,pre,.mono{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}code{overflow-wrap:anywhere}small,.small{font-size:var(--fontSize-caption);line-height:var(--lineHeight-caption)}.muted{color:var(--muted)}.eyebrow{font-size:var(--fontSize-caption);line-height:var(--lineHeight-caption);letter-spacing:1px;text-transform:uppercase}.shell{max-width:calc(var(--size-poster) + var(--space-24));margin:auto;padding:0 var(--space-8)}.masthead{display:flex;justify-content:space-between;align-items:center;gap:var(--space-4);padding:var(--space-6) 0;border-bottom:1px solid var(--rule)}.wordmark{font-weight:700;font-size:var(--fontSize-label);letter-spacing:1px;color:var(--bright)}.wordmark span{color:var(--brand)}.masthead .eyebrow{text-align:right}.hero{padding:var(--space-16) 0 var(--space-12);display:grid;grid-template-columns:minmax(0,1fr) auto;gap:var(--space-8);align-items:end}.hero h1{font-size:var(--fontSize-hero);line-height:var(--lineHeight-hero);font-weight:500;letter-spacing:0;max-width:var(--size-drawer)}.hero h1 span{color:var(--muted)}.hero .eyebrow{margin-bottom:var(--space-4);color:var(--gold)}.hero p{max-width:var(--size-drawer);margin-top:var(--space-6);font-size:var(--fontSize-detail);line-height:var(--lineHeight-label);color:var(--muted)}.totals{display:flex;flex-wrap:wrap;gap:var(--space-8);padding-bottom:var(--space-1)}.total strong{display:block;font-weight:400;font-size:var(--fontSize-score);line-height:var(--lineHeight-score);color:var(--bright)}.total span{display:block;margin-top:var(--space-1);font-size:var(--fontSize-caption);white-space:nowrap;color:var(--muted)}.tabs{display:flex;gap:var(--space-8);border-bottom:1px solid var(--rule);flex-wrap:wrap}.tab{border:0;border-bottom:2px solid transparent;background:none;padding:var(--space-4) 0;color:var(--muted)}.tab[aria-pressed=true]{border-color:var(--brand);color:var(--bright)}.view{padding:var(--space-8) 0 var(--space-16)}.intro{display:flex;gap:var(--space-6);justify-content:space-between;align-items:start;margin-bottom:var(--space-6)}.intro p{max-width:var(--size-drawer);color:var(--muted);margin-top:var(--space-2)}.tag{font-size:var(--fontSize-caption);line-height:var(--lineHeight-caption);padding:var(--space-1) var(--space-2);border:1px solid var(--rule);border-radius:var(--radius-sm);white-space:nowrap;color:var(--muted)}.controls{display:flex;align-items:end;gap:var(--space-3);flex-wrap:wrap;margin-bottom:var(--space-6)}label{display:grid;gap:var(--space-2);font-size:var(--fontSize-caption);color:var(--muted)}.search-label{flex:1;min-width:var(--size-hero)}input,select{background:var(--surface);color:var(--color);border:1px solid var(--rule);border-radius:var(--radius-sm);padding:var(--space-3) var(--space-4);min-height:var(--space-12);max-width:100%}input{width:100%}.quiet{background:transparent;color:var(--color);border:1px solid var(--rule);border-radius:var(--radius-sm);padding:var(--space-3) var(--space-4);min-height:var(--space-12)}.quiet:hover{background:var(--surface)}.roadmap-layout{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:var(--space-8);align-items:start}.roadmap{min-width:0}.wave{display:grid;grid-template-columns:var(--space-16) minmax(0,1fr);gap:var(--space-4);padding-bottom:var(--space-8)}.wave-index{border-left:1px solid var(--rule);padding-left:var(--space-3);padding-top:var(--space-1);color:var(--muted);font-size:var(--fontSize-caption)}.wave-index strong{display:block;color:var(--bright);font-size:var(--fontSize-title);line-height:var(--lineHeight-title);font-weight:400}.wave-heading{display:flex;justify-content:space-between;align-items:baseline;gap:var(--space-2);margin-bottom:var(--space-3)}.wave-heading span{white-space:nowrap;color:var(--muted);font-size:var(--fontSize-caption)}.task-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--space-2)}.task{display:flex;flex-direction:column;text-align:left;gap:var(--space-2);padding:var(--space-4);background:var(--surface);border:1px solid var(--rule);border-radius:var(--radius-sm);min-width:0}.task:hover{border-color:var(--muted)}.task[aria-pressed=true]{background:var(--highlight);border-color:var(--brand)}.task-top{display:flex;justify-content:space-between;gap:var(--space-2);align-items:baseline}.task-id{font-weight:600;color:var(--bright)}.task-model{font-size:var(--fontSize-caption);color:var(--muted)}.task-title{font-size:var(--fontSize-caption);line-height:var(--lineHeight-body);overflow-wrap:anywhere}.task-stack{font-size:var(--fontSize-caption);color:var(--gold)}.milestone{border-left:2px solid var(--gold);padding:var(--space-3) var(--space-4);margin-top:var(--space-3);background:var(--surface);font-size:var(--fontSize-caption)}.milestone strong{color:var(--gold)}.detail{position:sticky;top:var(--space-6);border-top:2px solid var(--brand);padding-top:var(--space-6);min-width:0;max-height:calc(100vh - var(--space-12));overflow:auto;scrollbar-width:thin}.detail-head{display:flex;justify-content:space-between;gap:var(--space-3);align-items:baseline;margin-bottom:var(--space-3)}.detail-head .mono{font-size:var(--fontSize-label);color:var(--gold)}.detail h2{font-size:var(--fontSize-title);line-height:var(--lineHeight-title);margin-bottom:var(--space-4)}.detail-meta{display:flex;flex-wrap:wrap;gap:var(--space-2);margin-bottom:var(--space-4)}.branch{font-size:var(--fontSize-caption);color:var(--muted);margin-bottom:var(--space-4);overflow-wrap:anywhere}.task-body{font-size:var(--fontSize-caption);line-height:var(--lineHeight-detail);overflow-wrap:anywhere}.task-body .paragraph{margin:var(--space-3) 0}.task-body .bullet{padding-left:var(--space-3);border-left:1px solid var(--rule);margin:var(--space-2) 0}.task-body .nested{margin-left:var(--space-3)}.task-body strong{font-weight:600;color:var(--bright)}.task-body code{color:var(--bright)}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:var(--fontSize-caption);line-height:var(--lineHeight-detail);margin:var(--space-4) 0;color:var(--color)}.stack-links{display:flex;gap:var(--space-2);flex-wrap:wrap;margin:var(--space-4) 0}.link-button{padding:var(--space-2) 0;border:0;background:none;color:var(--gold);text-align:left;text-decoration:underline;text-underline-offset:var(--space-1);font-size:var(--fontSize-caption)}details{border-top:1px solid var(--rule);padding:var(--space-4) 0;margin-top:var(--space-3)}summary{cursor:pointer;color:var(--bright);overflow-wrap:anywhere}.empty{padding:var(--space-12) 0;color:var(--muted)}.stack-note{font-size:var(--fontSize-caption);color:var(--muted);padding-bottom:var(--space-6);border-bottom:1px solid var(--rule);margin-bottom:var(--space-6)}.gate-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--space-6);margin-top:var(--space-8)}.gate{border-top:1px solid var(--rule);padding-top:var(--space-4)}.gate p{margin-top:var(--space-2);color:var(--muted);font-size:var(--fontSize-caption);line-height:var(--lineHeight-detail)}.section-heading{margin-top:var(--space-12);margin-bottom:var(--space-4)}.caveats{font-size:var(--fontSize-caption);color:var(--muted);line-height:var(--lineHeight-detail)}.caveats li+li{margin-top:var(--space-2)}.pipeline{list-style:none;margin:var(--space-8) 0;padding:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--space-8) var(--space-6);counter-reset:stage}.stage{counter-increment:stage;border-top:1px solid var(--rule);padding-top:var(--space-4);min-width:0}.stage:before{content:counter(stage,decimal-leading-zero);display:block;font-size:var(--fontSize-caption);color:var(--gold);margin-bottom:var(--space-3)}.stage p{color:var(--muted);font-size:var(--fontSize-caption);line-height:var(--lineHeight-detail);margin-top:var(--space-3)}.stage-links{display:flex;gap:var(--space-3);flex-wrap:wrap;margin-top:var(--space-2)}.stage.review{border-top:2px solid var(--brand)}.status-flow{display:flex;align-items:center;gap:var(--space-3);flex-wrap:wrap;margin:var(--space-6) 0}.status-flow .approved{color:var(--win)}.status-flow .stale{color:var(--gold)}.status-flow .rejected{color:var(--loss)}.pipeline-note{max-width:var(--size-drawer);color:var(--muted);margin-top:var(--space-4)}.reference-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:var(--space-12)}.decision{display:grid;grid-template-columns:var(--space-10) minmax(0,1fr);gap:var(--space-3);padding:var(--space-6) 0;border-top:1px solid var(--rule)}.decision .mono{color:var(--gold);font-size:var(--fontSize-caption)}.decision p{font-size:var(--fontSize-caption);line-height:var(--lineHeight-detail);overflow-wrap:anywhere}.decision .reason{color:var(--muted);margin-top:var(--space-3)}.reference-grid h2{margin-bottom:var(--space-6)}.reference-details{margin-top:var(--space-8)}footer{padding:var(--space-6) 0;border-top:1px solid var(--rule);display:flex;justify-content:space-between;gap:var(--space-6);flex-wrap:wrap;font-size:var(--fontSize-caption);line-height:var(--lineHeight-detail);color:var(--muted)}footer code{color:var(--color)}.source-note{font-size:var(--fontSize-caption);color:var(--muted);margin-top:var(--space-4)}.skip{position:absolute;left:var(--space-4);top:var(--space-4);transform:translateY(-200%);background:var(--surface);padding:var(--space-3);z-index:2}.skip:focus{transform:none}
.diagram-heading{display:flex;justify-content:space-between;gap:var(--space-4);align-items:baseline;flex-wrap:wrap;margin:var(--space-6) 0 var(--space-4)}.diagram-heading a{font-size:var(--fontSize-caption);color:var(--muted)}.pele-diagram{--pele-bg:var(--background);--pele-fg:var(--color);--pele-muted:var(--muted);--pele-line:var(--muted);--pele-surface:var(--surface);--pele-surface-alt:var(--highlight);--pele-border:var(--rule);--pele-accent:var(--brand);--pele-font:ui-monospace,SFMono-Regular,monospace;max-width:100%;overflow:auto;margin:var(--space-6) 0;min-height:var(--space-24)}.pele-diagram svg{display:block;max-width:100%;height:auto;margin:auto}.pele-diagram pre{color:var(--muted)}.diagram-error{font-size:var(--fontSize-caption);color:var(--gold)}
@media(max-width:1100px){.hero{grid-template-columns:1fr}.hero h1{font-size:var(--fontSize-score);line-height:var(--lineHeight-score)}.totals{gap:var(--space-8)}.pipeline{grid-template-columns:repeat(2,minmax(0,1fr))}.roadmap-layout{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.task-list{grid-template-columns:1fr}}
@media(max-width:720px){.shell{padding:0 var(--space-4)}.masthead{padding:var(--space-4) 0}.masthead .eyebrow{max-width:var(--size-hero)}.hero{padding:var(--space-10) 0 var(--space-8);gap:var(--space-6)}.hero h1{font-size:var(--fontSize-stat);line-height:var(--lineHeight-stat)}.hero p{font-size:var(--fontSize-body);line-height:var(--lineHeight-detail)}.total strong{font-size:var(--fontSize-title);line-height:var(--lineHeight-title)}.tabs{gap:var(--space-6)}.tab{font-size:var(--fontSize-caption);padding:var(--space-4) 0}.roadmap-layout{display:flex;flex-direction:column}.roadmap{width:100%}.detail{position:static;max-height:none;overflow:visible;width:100%;order:-1;margin-bottom:var(--space-6)}.task-list{grid-template-columns:repeat(2,minmax(0,1fr))}.wave{grid-template-columns:var(--space-12) minmax(0,1fr);gap:var(--space-3)}.task{padding:var(--space-3)}.task-top{flex-wrap:wrap}.reference-grid{grid-template-columns:1fr;gap:var(--space-8)}.gate-list{grid-template-columns:1fr;gap:var(--space-4)}.intro{flex-wrap:wrap}.totals{gap:var(--space-6)}.pipeline{gap:var(--space-6)}.controls{align-items:stretch}.controls label{flex:1}.quiet{align-self:end}.view{padding-top:var(--space-6)}}
@media(max-width:380px){.task-list,.pipeline{grid-template-columns:1fr}.tabs{gap:var(--space-3)}.tab{font-size:var(--fontSize-caption)}.totals{gap:var(--space-4)}}
@media(prefers-reduced-motion:no-preference){button{transition:background-color .15s,border-color .15s}}
.task-body p{margin:var(--space-3) 0}.task-body ul,.task-body ol{padding-left:var(--space-6)}.task-body li{margin:var(--space-2) 0}.task-body table{display:block;overflow-x:auto;border-collapse:collapse;max-width:100%;margin:var(--space-4) 0}.task-body th,.task-body td{text-align:left;padding:var(--space-2);border-bottom:1px solid var(--rule);vertical-align:top}.task-body th{color:var(--bright);font-weight:500}.decision p{margin:0}</style>
</head>
<body>
<a class="skip" href="#views">Skip to plan</a>
<div class="shell">
<header class="masthead"><div class="wordmark">RINK<span>SIDE</span></div><div class="eyebrow muted">Analyst agent / implementation plan</div></header>
<section class="hero" aria-labelledby="page-title"><div><div class="eyebrow">The build, at a glance</div><h1 id="page-title">From box scores<br><span>to verified insights.</span></h1><p>Explore the dependencies, the task contracts, and the path from public NHL data to a human-approved card.</p></div><div class="totals" id="totals"></div></section>
<nav class="tabs" aria-label="Plan views"><button class="tab" type="button" id="tab-roadmap" aria-controls="roadmap-view" aria-pressed="true">Build roadmap</button><button class="tab" type="button" id="tab-pipeline" aria-controls="pipeline-view" aria-pressed="false">Runtime pipeline</button><button class="tab" type="button" id="tab-reference" aria-controls="reference-view" aria-pressed="false">Contracts & decisions</button></nav>
<main id="views">
<section class="view" id="roadmap-view" aria-labelledby="tab-roadmap">
<div class="intro"><div><h2>Small tasks. Explicit dependencies.</h2><p>A task becomes ready when its Needs are merged to main. Select a task to inspect its inputs, direct dependents, and exact scope.</p></div><span class="tag">Source ledger snapshot</span></div>
<div class="diagram-heading"><h3 id="dependency-title">A1 dependencies</h3><a href="https://pele.run/" target="_blank" rel="noreferrer">Rendered with Pele 1.6.0</a></div><div class="pele-diagram" id="dependency-diagram" role="group" aria-label="Selected task dependencies"></div><p class="small muted">Solid arrows are declared Needs. Dashed arrows are explicit Stack on relationships. This shows one task's immediate neighborhood.</p><details><summary>Dependency Mermaid source</summary><pre id="dependency-source"></pre></details>
<div class="controls"><label class="search-label">Find a task<input id="search" type="search" placeholder="Search task ID, title, or scope" autocomplete="off"></label><label>Builder model<select id="model"><option value="all">All models</option><option>Sonnet</option><option>Haiku</option><option>Opus</option><option>Codex</option><option value="you">You / prerequisites</option></select></label><button class="quiet" type="button" id="reset">Reset</button></div>
<p id="result-count" class="small muted" aria-live="polite"></p>
<div class="roadmap-layout"><div class="roadmap"><p class="stack-note">These are source-card workstreams, not sequential waves. Ready tasks can land independently. Only DEP1 &rarr; DEP2 and N2 &rarr; N3 are explicitly stacked.</p><div id="waves"></div></div><aside class="detail" id="task-detail" aria-label="Selected task"></aside></div>
<h2 class="section-heading">Phase exits</h2><div class="gate-list"><div class="gate"><h3>P0 / Eval CLI</h3><p>E6b prints an evaluation score.</p></div><div class="gate"><h3>P1 / Real generation PR</h3><p>CI1 opens a PR with pending cards for 32 teams.</p></div><div class="gate"><h3>P2 / Approved cards live</h3><p>Data rights settled, a card approved, and one refresh confirms it survives.</p></div></div>
<h2 class="section-heading">Approval gates</h2><div class="gate-list" id="gates"></div>
<p class="source-note">Statuses come from the Markdown ledger. This page does not inspect branches, pull requests, or live implementation progress.</p>
</section>
<section class="view" id="pipeline-view" aria-labelledby="tab-pipeline" hidden>
<div class="intro"><div><h2>Every claim has a query.</h2><p>A conceptual runtime flow, separate from the build schedule. Select a task ID to inspect its implementation card.</p></div><span class="tag">Conceptual flow</span></div>
<div class="pele-diagram" id="pipeline-diagram" role="group" aria-label="Runtime pipeline from snapshots to approved cards and staleness checks"></div><details><summary>Runtime Mermaid source</summary><pre id="pipeline-source"></pre></details>
<ol class="pipeline" id="pipeline"></ol>
<h2 class="section-heading">Approval owns publication</h2><div class="status-flow"><span class="tag">pending</span><span aria-hidden="true">&rarr;</span><span>Human review</span><span aria-hidden="true">&rarr;</span><span class="tag approved">approved</span><span class="muted">or</span><span class="tag rejected">rejected</span></div><p class="pipeline-note">The generator adds pending cards. Only human-approved cards reach the API and poster. After a refresh, the recheck keeps valid cards approved and re-renders changed values when the assertion still holds. A false assertion or query error makes the card <span class="stale">stale</span>.</p>
<details><summary>Runtime model choices are provisional</summary><div class="task-body" id="runtime-models"></div></details><p class="source-note">P3, the public live Ask box, is not planned. Plan it after P2 using approval-rate data.</p>
</section>
<section class="view" id="reference-view" aria-labelledby="tab-reference" hidden><div class="intro"><div><h2>The shared rules</h2><p>Source contracts and decisions, together in one place.</p></div></div><div class="reference-grid"><section><h2>Contracts</h2><div id="contracts"></div></section><section><h2>Decisions</h2><div id="decisions"></div></section></div><div class="reference-details"><details><summary>System of record</summary><div class="task-body" id="record"></div></details><details><summary>Builder model routing</summary><div class="task-body" id="routing"></div></details></div></section>
</main>
<footer><div><a href="analyst-agent-plan.md">Markdown source</a> &middot; <span id="source-hash"></span><br><span id="source-status"></span></div><div>Content Collections + MDX<br>Rebuild this snapshot<br><code>bun run docs:plan</code></div></footer>
</div>
<script id="plan-data" type="application/json">${JSON.stringify(data).replaceAll('<', '\u003c')}</script>
<script>
const plan = JSON.parse(document.getElementById('plan-data').textContent);
const byId = new Map(plan.tasks.map(function(task) { return [task.id, task]; }));
const state = { selected: 'A1', search: '', model: 'all', view: 'roadmap' };
const escapeHtml = function(value) { return String(value).replace(/[&<>"']/g, function(character) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]; }); };
function taskLink(id, label) { return '<button class="link-button" type="button" data-task-link="' + escapeHtml(id) + '">' + escapeHtml(label || id) + '</button>'; }
function setView(view) {
  state.view = view;
  ['roadmap', 'pipeline', 'reference'].forEach(function(name) {
    document.getElementById(name + '-view').hidden = name !== view;
    document.getElementById('tab-' + name).setAttribute('aria-pressed', String(name === view));
  });
  if (view === 'pipeline') renderDiagram('pipeline-diagram', plan.pipelineDiagram);
}
const mountedDiagrams = new Map();
function renderDiagram(id, source) {
  const container = document.getElementById(id);
  const previous = mountedDiagrams.get(id);
  if (previous && previous.source === source) return;
  if (previous && previous.handle && typeof previous.handle.destroy === 'function') previous.handle.destroy();
  container.replaceChildren();
  if (!window.pele) {
    const message = document.createElement('p'); message.className = 'diagram-error'; message.textContent = window.peleLoadFailed ? 'Pele could not load from the CDN. The task explorer and Mermaid source remain available.' : 'Loading Pele diagram…';
    const fallback = document.createElement('pre'); fallback.textContent = source;
    container.append(message, fallback); return;
  }
  function logDiagramError(error) {
    const log = document.createElement('p');
    log.setAttribute('role', 'log');
    log.className = 'diagram-error';
    log.textContent = 'Diagram could not render. ' + String(error);
    const fallback = document.createElement('pre');
    fallback.textContent = source;
    container.replaceChildren(log, fallback);
  }
  try {
    const handle = window.pele.mount(container, source, { links: false, images: false, onError: logDiagramError });
    mountedDiagrams.set(id, { source: source, handle: handle });
  } catch (error) {
    logDiagramError(error);
  }
}
function renderDependency() {
  const source = plan.dependencyDiagrams[state.selected];
  document.getElementById('dependency-title').textContent = state.selected + ' / declared dependencies';
  document.getElementById('dependency-source').textContent = source;
  document.getElementById('dependency-diagram').setAttribute('aria-label', 'Declared dependencies and direct dependents of ' + state.selected);
  renderDiagram('dependency-diagram', source);
}
function renderDetail() {
  const task = byId.get(state.selected);
  if (!task) return;
  const links = plan.stacks.filter(function(stack) { return stack.includes(task.id); }).map(function(stack) {
    return taskLink(stack[0] === task.id ? stack[1] : stack[0], stack[0] + ' → ' + stack[1]);
  }).join('');
  document.getElementById('task-detail').innerHTML = '<div class="detail-head"><span class="mono">' + escapeHtml(task.id) + '</span><span class="small muted">Selected task</span></div><h2 id="detail-title" tabindex="-1">' + escapeHtml(task.title) + '</h2><div class="detail-meta"><span class="tag">' + escapeHtml(task.category) + '</span><span class="tag">' + escapeHtml(task.model === 'you' ? 'You' : task.model) + '</span><span class="tag">Ledger: ' + escapeHtml(task.status) + '</span></div><p class="branch">Branch from ledger<br><code>' + escapeHtml(task.branch) + '</code></p><div class="stack-links">' + task.needs.map(function(id) { return taskLink(id, 'Needs ' + id); }).join('') + links + '</div>' + (task.group !== task.id ? '<p class="small muted">Shared source card for ' + escapeHtml(task.group) + '.</p>' : '') + '<div class="task-body">' + task.bodyHtml + '</div><details><summary>Task card, verbatim</summary><pre>' + escapeHtml((task.model === 'you' ? '### ' : '#### ') + task.heading + '\n\n' + task.body) + '</pre></details>';
}
function renderRoadmap() {
  const needle = state.search.trim().toLowerCase();
  const visible = plan.tasks.filter(function(task) {
    return (state.model === 'all' || task.model === state.model) && (!needle || [task.id, task.title, task.body, task.branch, task.model].join(' ').toLowerCase().includes(needle));
  });
  document.getElementById('result-count').textContent = visible.length + ' of ' + plan.tasks.length + ' tasks shown. ' + (visible.some(function(task) { return task.id === state.selected; }) ? '' : 'Selected task remains open.');
  document.getElementById('waves').innerHTML = visible.length ? plan.groups.map(function(wave) {
    const tasks = visible.filter(function(task) { return task.category === wave.title; });
    if (!tasks.length) return '';
    return '<section class="wave" aria-label="' + escapeHtml(wave.title) + '"><div class="wave-index">Group<strong>' + String(wave.number + 1).padStart(2, '0') + '</strong></div><div><div class="wave-heading"><h3>' + escapeHtml(wave.title) + '</h3><span>' + tasks.length + ' task' + (tasks.length === 1 ? '' : 's') + '</span></div><div class="task-list">' + tasks.map(function(task) {
      return '<button class="task" type="button" data-task="' + escapeHtml(task.id) + '" aria-pressed="' + String(task.id === state.selected) + '"><span class="task-top"><span class="mono task-id">' + escapeHtml(task.id) + '</span><span class="task-model">' + escapeHtml(task.model === 'you' ? 'You' : task.model) + '</span></span><span class="task-title">' + escapeHtml(task.title) + '</span>' + (task.parent ? '<span class="task-stack">' + escapeHtml(task.parent) + ' → ' + escapeHtml(task.id) + '</span>' : '') + '</button>';
    }).join('') + '</div>' + (wave.milestone ? '<div class="milestone"><strong>' + escapeHtml(wave.milestone.id) + ' exit</strong> · ' + escapeHtml(wave.milestone.text) + '</div>' : '') + '</div></section>';
  }).join('') : '<p class="empty">No tasks match these filters. Clear the search or choose another model.</p>';
}
function selectTask(id, navigate) {
  if (!byId.has(id)) return;
  state.selected = id;
  if (navigate) {
    state.search = ''; state.model = 'all';
    document.getElementById('search').value = '';
    document.getElementById('model').value = 'all';
    setView('roadmap');
  }
  if (navigate) renderRoadmap();
  else document.querySelectorAll('[data-task]').forEach(function(button) { button.setAttribute('aria-pressed', String(button.dataset.task === id)); });
  renderDetail(); renderDependency();
  if (navigate || matchMedia('(max-width:720px)').matches) {
    document.getElementById('detail-title').focus({ preventScroll: true });
    document.getElementById('task-detail').scrollIntoView({ block: 'start', behavior: 'instant' });
  }
}
document.getElementById('totals').innerHTML = [[plan.tasks.filter(function(task) { return task.model !== 'you'; }).length, 'implementation tasks'], [plan.tasks.filter(function(task) { return task.model === 'you'; }).length, 'owner prerequisites'], [3, 'phase exits']].map(function(total) { return '<div class="total"><strong>' + total[0] + '</strong><span>' + total[1] + '</span></div>'; }).join('');
const gates = [
  ['Commit the plan', 'P-plan', 'Commit the plan and spec, then initialise Graphite with main as trunk.'],
  ['Approve dependencies', 'P-deps', 'DEP1 and DEP2 need approval for DuckDB and the AI SDK.'],
  ['Provide a capped key', 'P-key', 'Live-model tasks need the local AI Gateway key and run one at a time.'],
  ['Enable CI pull requests', 'P-pr', 'CI1 needs the repository setting and the gateway secret. The CI change also needs explicit approval.'],
  ['Confirm data rights', 'P-rights', 'No card may be approved on main before this is settled. Empty web UI can land earlier.'],
  ['Review every public card', 'R1', 'A human approves cards before they reach the API and poster.']
];
document.getElementById('gates').innerHTML = gates.map(function(gate) { return '<div class="gate"><h3>' + gate[0] + '</h3><p>' + gate[2] + '</p>' + taskLink(gate[1]) + '</div>'; }).join('');
const stages = [
  ['Source snapshots', 'Games, archived box scores, and standings remain authoritative. Coverage is explicit.', ['DATA1']],
  ['Read-only DuckDB', 'Load five derived tables up front, then disable external access and lock configuration. Canonical queries use ORDER BY ALL.', ['DEP1', 'DB1', 'DB2', 'V1', 'V2a', 'V2b', 'V3', 'V4', 'C3']],
  ['Find candidate insights', 'Hand-written detectors set a baseline. The generator uses guarded tools; the system fills evidence, game IDs, and coverage.', ['X1', 'X2', 'X3', 'G3', 'G5b']],
  ['Verify the evidence', 'Check schema, guarded SQL, template bindings, recomputed coverage and game IDs, exact canonical reruns, and assertions.', ['C1', 'C2', 'C4']],
  ['Rank & store pending', 'Deduplicate and rank the verified cards. Merge new pending cards without overwriting reviewed cards.', ['G6', 'G7', 'G8']],
  ['Human review', 'Show the rendered card, query, and result table. A reviewer approves, rejects, or edits it.', ['R1']],
  ['Approved API & poster', 'Load only approved cards. Show at most three Notes cards and their source queries and linked games.', ['N1a', 'N1b', 'N2', 'N3']],
  ['Recheck after refresh', 'Re-run evidence and assertions. Update valid values, or mark a card stale when its assertion fails or query errors.', ['S1']]
];
document.getElementById('pipeline').innerHTML = stages.map(function(stage, index) { return '<li class="stage' + (index === 5 ? ' review' : '') + '"><h3>' + stage[0] + '</h3><p>' + stage[1] + '</p><div class="stage-links">' + stage[2].map(function(id) { return taskLink(id); }).join('') + '</div></li>'; }).join('');
document.getElementById('contracts').innerHTML = plan.contracts.filter(function(contract) { return contract.title !== 'Runtime models'; }).map(function(contract) { return '<details><summary>' + escapeHtml(contract.title) + '</summary><div class="task-body">' + contract.bodyHtml + '</div></details>'; }).join('');
document.getElementById('decisions').innerHTML = plan.decisions.map(function(decision) { return '<article class="decision"><span class="mono">' + escapeHtml(decision.id) + '</span><div><div>' + decision.decisionHtml + '</div><div class="reason">' + decision.reasonHtml + '</div></div></article>'; }).join('');
document.getElementById('runtime-models').innerHTML = plan.contracts.find(function(contract) { return contract.title === 'Runtime models'; })?.bodyHtml || 'See the source plan.';
document.getElementById('record').innerHTML = plan.recordHtml;
document.getElementById('routing').innerHTML = plan.routingHtml;
document.getElementById('source-hash').textContent = 'SHA-256 ' + plan.hash;
document.getElementById('source-status').textContent = plan.status;
document.getElementById('search').addEventListener('input', function(event) { state.search = event.target.value; renderRoadmap(); });
document.getElementById('model').addEventListener('change', function(event) { state.model = event.target.value; renderRoadmap(); });
document.getElementById('reset').addEventListener('click', function() { state.search = ''; state.model = 'all'; document.getElementById('search').value = ''; document.getElementById('model').value = 'all'; renderRoadmap(); });
document.addEventListener('click', function(event) {
  const task = event.target.closest('[data-task]');
  const link = event.target.closest('[data-task-link]');
  if (task) selectTask(task.dataset.task, false);
  if (link) selectTask(link.dataset.taskLink, true);
});
['roadmap', 'pipeline', 'reference'].forEach(function(view) { document.getElementById('tab-' + view).addEventListener('click', function() { setView(view); }); });
document.getElementById('pipeline-source').textContent = plan.pipelineDiagram;
window.onPeleReady = function() { renderDependency(); if (state.view === 'pipeline') renderDiagram('pipeline-diagram', plan.pipelineDiagram); };
window.onPeleFailed = function() { window.peleLoadFailed = true; window.onPeleReady(); };
renderRoadmap(); renderDetail(); renderDependency();
</script>
<script src="https://cdn.jsdelivr.net/npm/pele@1.6.0/dist/pele.global.js" integrity="sha384-4lHoXtKDt+x/E+htiTc83bpFWyREQzJCMudNQHirqKiCTW7Mx790I/5Q7criNZ1G" crossorigin="anonymous" onload="onPeleReady()" onerror="onPeleFailed()"></script>
</body>
</html>
`
const output = new URL('docs/analyst-agent-plan.html', root)
const source = await readFile(new URL('docs/analyst-agent-plan.md', root))
if (createHash('sha256').update(source).digest('hex') !== data.sourceHash) throw new Error('Plan source changed during generation. Rebuild before publishing the snapshot.')
await writeFile(output, html)
process.stdout.write('Generated ' + fileURLToPath(output) + ' (' + data.tasks.length + ' tasks, ' + data.groups.length + ' workstreams, source ' + data.hash + ')\n')
}
