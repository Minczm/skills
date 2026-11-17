(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const arr = value => Array.isArray(value) ? value : [];
  const uniq = values => [...new Set(values)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const text = value => `<p class="text">${esc(value)}</p>`;
  const valueText = value => value == null ? '未列明' : Array.isArray(value) ? value.join('、') : typeof value === 'object' ? JSON.stringify(value) : String(value);
  const anchor = (kind, id) => `${kind}-${id}`;
  const href = id => `#${encodeURIComponent(id)}`;
  const pad = n => String(n).padStart(2, '0');
  const safeUrl = value => /^(https:\/\/|#[^\s]*)/i.test(String(value || '')) ? String(value) : '';
  let D;
  try { D = JSON.parse($('dossierData').textContent); }
  catch (_) { $('main').innerHTML = '<p class="empty">报告资料无法读取。</p>'; return; }
  const meta = D.meta || {}, entities = arr(D.entities), relationships = arr(D.relationships), sources = arr(D.sources);
  const sections = arr(D.sections), archives = arr(D.archives), questions = arr(D.questions), events = arr(D.timeline);
  const E = new Map(entities.map(e => [e.id, e])), S = new Map(sources.map(s => [s.id, s])), A = new Map(arr(D.assets).map(a => [a.id, a]));
  const C = new Map(arr(D.claims).map(c => [c.id, c])), snapshots = arr(D.evidence_manifest);
  const rootId = meta.root_id, root = E.get(rootId), name = id => E.get(id)?.name || String(id || '调查主体');
  const types = {company:'公司',person:'人物',product:'产品',brand:'品牌',investor:'投资方',institution:'机构'};
  const colors = {company:'#168875',person:'#b77b57',product:'#5481ac',brand:'#9a86a2',investor:'#8d9d5c',institution:'#8c8d9f'};
  const letters = {company:'司',person:'人',product:'产',brand:'品',investor:'投',institution:'机'};
  const statuses = {current:'现行',historical:'历史',candidate:'待核',disputed:'有争议',unavailable:'无法访问',excerpt_only:'仅见摘要',superseded:'已被替代'};
  const sourceKinds = {official:'官方',registry:'登记资料',first_party:'当事方',store:'应用商店',court:'司法文书',media:'媒体',forum:'社区',user:'用户补充',archive:'存档',analysis:'分析'};
  const relationTypes = {ownership:'持股',investment:'投资',employment:'任职',partnership:'合作',creation:'创作',operation:'运营',publishing:'发行',client:'客户',domain:'域名',historical:'历史关系',candidate:'候选关系'};
  const color = id => colors[E.get(id)?.type] || '#8c9d81';
  const uncertain = edge => edge.type === 'candidate' || ['candidate','disputed'].includes(edge.status) || Boolean(edge.disputed);
  const confirmed = edge => !uncertain(edge) && E.get(edge.from)?.status !== 'candidate' && E.get(edge.to)?.status !== 'candidate';
  const styleOf = edge => uncertain(edge) ? 'candidate' : edge.nature === 'capital' || ['ownership','investment'].includes(edge.type) && edge.nature !== 'business' ? 'capital' : 'business';
  const relationMap = new Map(), adjacency = new Map(entities.map(e => [e.id, []]));
  for (const edge of relationships) {
    if (!E.has(edge.from) || !E.has(edge.to)) continue;
    adjacency.get(edge.from).push(edge);
    if (edge.to !== edge.from) adjacency.get(edge.to).push(edge);
    const key = JSON.stringify([edge.from, edge.to].sort());
    if (!relationMap.has(key)) relationMap.set(key, {key, a:edge.from, b:edge.to, records:[]});
    relationMap.get(key).records.push(edge);
  }
  const pairs = [...relationMap.values()], adj = id => adjacency.get(id) || [], other = (edge, id) => edge.from === id ? edge.to : edge.from;
  const pairKey = (a, b) => JSON.stringify([a, b].sort());
  const status = value => value ? `<span class="status ${['historical','candidate','disputed'].includes(value) ? value : ''}">${esc(statuses[value] || value)}</span>` : '';
  function refs(ids) {
    const valid = uniq(arr(ids)).filter(id => S.has(id));
    return valid.length ? `<div class="source-refs">${valid.map(id => `<a class="source-ref" href="${href(anchor('source', id))}" data-source="${esc(id)}" title="${esc(S.get(id).title)}">${esc(id)} ↗</a>`).join('')}</div>` : '';
  }
  function entityLinks(ids) {
    return arr(ids).length ? `<div class="entity-links">${uniq(ids).filter(id => E.has(id)).map(id => `<button class="entity-link" data-open-entity="${esc(id)}"><i class="dot" style="background:${color(id)}"></i>${esc(name(id))} ↗</button>`).join('')}</div>` : '';
  }
  function claimLinks(ids) {
    const valid = uniq(arr(ids)).filter(id => C.has(id));
    return valid.length ? `<button class="claim-link" data-claims="${esc(valid.join(','))}">核查依据 · ${valid.length} ↗</button>` : '';
  }
  function snapshotHtml(item) {
    const kinds = {original_file:'原文件',web_snapshot:'网页快照',screenshot:'页面截图',extracted_text:'提取文本',excerpt:'摘录'};
    return `<div class="snapshot"><strong>${esc(kinds[item.representation] || item.representation)}</strong><span>${esc(item.status === 'stored' ? '已存档' : item.status === 'unavailable' ? '访问未完成' : '已记录出处')} · ${esc(item.captured_at || '')}</span>${item.status === 'stored' ? `<code>${esc(item.path)}</code><small>${Number(item.bytes).toLocaleString()} bytes · SHA-256</small><code>${esc(item.sha256)}</code>` : item.access_note ? text(item.access_note) : ''}</div>`;
  }
  function claimHtml(claim) {
    const kinds = {fact:'公开事实',company_statement:'公司披露',user_report:'用户提供',analysis:'综合分析'};
    const dates = [['资料发布',claim.published_at],['事实生效',claim.effective_at],['事实截至',claim.as_of],['本次访问',claim.accessed_at]].filter(([,v]) => v);
    return `<article class="claim-record"><div class="claim-heading"><span class="source-id">${esc(claim.id)}</span><span>${esc(kinds[claim.kind] || claim.kind)}</span>${status(claim.status)}</div><h3>${esc(claim.text)}</h3><dl class="claim-dates">${dates.map(([k,v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>${claim.locator ? `<p class="source-locator">定位：${esc(claim.locator)}</p>` : ''}${claim.reasoning ? text(claim.reasoning) : ''}${entityLinks(claim.entity_ids)}${sourceLines(claim.source_ids)}${arr(claim.evidence).map(item => `<div class="claim-evidence"><span class="source-ref">${esc(item.source_id)}</span> ${esc(item.locator || '')}${item.published_at ? ` · 发布 ${esc(item.published_at)}` : ''}${item.accessed_at ? ` · 访问 ${esc(item.accessed_at)}` : ''}${item.snapshot_id ? snapshots.filter(s => s.id === item.snapshot_id).map(snapshotHtml).join('') : ''}</div>`).join('')}${claim.uncertainty ? `<p class="claim-context">${esc(valueText(claim.uncertainty))}</p>` : ''}${arr(claim.input_claim_ids).length ? claimLinks(claim.input_claim_ids) : ''}</article>`;
  }
  function openClaims(ids) {
    const valid = uniq(arr(ids)).filter(id => C.has(id));
    if (!valid.length) return;
    $('evidenceContent').innerHTML = valid.map(id => claimHtml(C.get(id))).join('');
    if (!$('evidenceDialog').open) $('evidenceDialog').showModal();
    $('evidenceDialog').scrollTop = 0; updateLock();
  }
  function chartHtml(chart) {
    if (!chart || !arr(chart.rows).length) return '';
    const palette = ['#126c60','#b77b57','#7194ad','#9ca276','#93809c'];
    const rows = chart.rows.map(row => ({...row,segments:arr(row.segments).filter(s => Number.isFinite(s.value) && s.value >= 0)}));
    const maximum = Math.max(1, ...rows.map(row => row.segments.reduce((n,s) => n + Number(s.value),0)));
    const labels = uniq(rows.flatMap(row => row.segments.map(s => s.name)));
    const shade = label => palette[labels.indexOf(label) % palette.length];
    const format = number => Number(number).toLocaleString('zh-CN',{maximumFractionDigits:chart.decimals ?? 1});
    return `<figure class="data-chart"><figcaption>${esc(chart.title || '')}${chart.unit ? `<small>单位：${esc(chart.unit)}</small>` : ''}</figcaption><div class="chart-legend">${labels.map(label => `<span><i style="background:${shade(label)}"></i>${esc(label)}</span>`).join('')}</div>${rows.map(row => `<div class="bar-row"><span class="bar-label">${esc(row.label)}</span><div class="bar-track">${row.segments.map(s => `<span class="bar-segment" style="width:${Number(s.value) / maximum * 100}%;background:${shade(s.name)}" title="${esc(s.name)}：${format(s.value)} ${esc(chart.unit || '')}"><span>${Number(s.value) / maximum > .13 ? format(s.value) : ''}</span></span>`).join('')}</div><strong>${format(row.segments.reduce((n,s) => n + Number(s.value),0))}</strong></div>`).join('')}<details class="chart-data"><summary>查看数值</summary><div class="table-scroll"><table><thead><tr><th>时期 / 类别</th>${labels.map(label => `<th>${esc(label)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr><th>${esc(row.label)}</th>${labels.map(label => `<td>${row.segments.some(s => s.name === label) ? format(row.segments.filter(s => s.name === label).reduce((n,s) => n + Number(s.value),0)) : '—'}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>${chart.note ? `<p class="chart-note">${esc(chart.note)}</p>` : ''}${refs(chart.sources)}${claimLinks(chart.claim_ids)}</figure>`;
  }
  function tableHtml(table) {
    return table && arr(table.headers).length ? `<div class="table-scroll"><table class="fact-table"><thead><tr>${table.headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${arr(table.rows).map(row => `<tr>${arr(row.cells || row).map(cell => `<td>${esc(valueText(cell))}</td>`).join('')}${row.sources || row.claim_ids ? `<td>${refs(row.sources)}${claimLinks(row.claim_ids)}</td>` : ''}</tr>`).join('')}</tbody></table></div>` : '';
  }
  function images(ids, hero = false) {
    return uniq(arr(ids)).map(id => A.get(id)).filter(a => a && /^data:image\/(?:png|jpe?g|gif|webp|avif|bmp|svg\+xml)(?:;[a-z0-9=+._-]+)*,/i.test(a.data_uri || '')).map(a => `<figure class="${hero ? 'hero-media' : 'evidence-image'}"><img src="${esc(a.data_uri)}" alt="${esc(a.alt || a.caption || '')}" ${hero ? '' : 'loading="lazy"'}><figcaption>${esc(a.caption || a.alt || '')}${refs(a.sources)}</figcaption></figure>`).join('');
  }
  function imageGrid(ids) { const html = images(ids); return html ? `<div class="image-grid">${html}</div>` : ''; }
  function renderBlock(block) {
    return `<article class="content-block${arr(block.steps).length || arr(block.image_ids).length || block.chart || block.table ? ' wide' : ''}">${block.title ? `<h3>${esc(block.title)}</h3>` : ''}${block.text ? text(block.text) : ''}${chartHtml(block.chart)}${tableHtml(block.table)}${arr(block.steps).length ? `<ol class="steps">${block.steps.map(step => `<li>${step.title ? `<h4>${esc(step.title)}</h4>` : ''}${step.text ? text(step.text) : ''}${refs(step.sources)}${claimLinks(step.claim_ids)}</li>`).join('')}</ol>` : ''}${imageGrid(block.image_ids)}${entityLinks(block.entity_ids)}${refs(block.sources)}${claimLinks(block.claim_ids)}</article>`;
  }
  function renderBlocks(blocks) { return arr(blocks).length ? `<div class="block-grid">${blocks.map(renderBlock).join('')}</div>` : ''; }
  function sourceLines(ids) {
    return uniq(ids).filter(id => S.has(id)).map(id => {
      const source = S.get(id);
      return `<div class="profile-source"><a href="${href(anchor('source', id))}" data-source="${esc(id)}"><span class="source-ref">${esc(id)}</span><strong>${esc(source.title)}</strong></a><small>${esc([sourceKinds[source.kind] || source.kind, source.publisher, source.published_at && `发布 ${source.published_at}`, (source.accessed_at || source.observed_at) && `访问 ${source.accessed_at || source.observed_at}`].filter(Boolean).join(' · '))}</small></div>`;
    }).join('');
  }

  // Each path is a sequence of original relationship records; traversal may go in either direction.
  const parent = new Map(), distance = new Map(), branch = new Map();
  if (root) {
    const queue = [rootId]; distance.set(rootId, 0); branch.set(rootId, rootId);
    for (let i = 0; i < queue.length; i++) {
      const id = queue[i];
      const edges = adj(id).filter(confirmed).slice().sort((a, b) => Number(a.status === 'historical') - Number(b.status === 'historical'));
      for (const edge of edges) {
        const next = other(edge, id);
        if (distance.has(next)) continue;
        parent.set(next, {id, edge}); distance.set(next, distance.get(id) + 1);
        branch.set(next, id === rootId ? next : branch.get(id)); queue.push(next);
      }
    }
  }
  function pathTo(id) {
    if (!root || !distance.has(id)) return null;
    const ids = [id], edges = []; let cursor = id;
    while (cursor !== rootId) { const step = parent.get(cursor); edges.unshift(step.edge); ids.unshift(step.id); cursor = step.id; }
    return {ids, edges};
  }
  function pathHtml(id, action = 'select-entity') {
    const path = pathTo(id), heading = `<span class="path-title">与 ${esc(name(rootId))} 的关系路径</span>`;
    if (!root) return `${heading}<p>尚未指定调查主体，无法建立关系路径。</p>`;
    if (id === rootId) return `${heading}<p>调查主体 · 网络中心</p>`;
    if (!path) {
      const hasUncertain = adj(id).some(e => uncertain(e) || E.get(other(e, id))?.status === 'candidate');
      return `${heading}<p>${hasUncertain || E.get(id)?.status === 'candidate' ? '现有资料未建立有来源的确定连接路径；待核或有争议的关系保留在图中。' : '现有资料未发现与调查主体相连的有来源路径。可查看直接关系与出处。'}</p>`;
    }
    return `${heading}<div class="path-chain">${path.ids.map((pid, i) => `${i ? `<span class="path-step"><span>${esc(path.edges[i - 1].label)}${path.edges[i - 1].status === 'historical' ? ' · 历史' : ''}</span><b aria-label="${path.edges[i - 1].from === path.ids[i - 1] ? '向右' : '向左'}">${path.edges[i - 1].from === path.ids[i - 1] ? '→' : '←'}</b></span>` : ''}<button class="path-node" data-${action}="${esc(pid)}">${esc(name(pid))}</button>`).join('')}</div>${refs(path.edges.flatMap(e => arr(e.sources)))}`;
  }
  function relationHtml(edge) {
    const metrics = [];
    if (edge.percent != null) metrics.push(`${valueText(edge.percent)}%`);
    if (edge.amount != null) metrics.push([valueText(edge.amount), edge.currency, edge.unit].filter(v => v != null && v !== '').join(' '));
    if (edge.date) metrics.push(edge.date);
    if (edge.valid_from || edge.valid_to) metrics.push(`${edge.valid_from || '起始未列明'} — ${edge.valid_to || '结束未列明'}`);
    return `<article class="edge-record${uncertain(edge) ? ' is-candidate' : ''}"><div class="edge-direction"><button data-open-entity="${esc(edge.from)}">${esc(name(edge.from))}</button> → <button data-open-entity="${esc(edge.to)}">${esc(name(edge.to))}</button></div><h4>${esc(edge.label)}</h4><div class="edge-meta"><span>${esc(relationTypes[edge.type] || edge.type)}</span>${metrics.map(m => `<span>${esc(m)}</span>`).join('')}${status(edge.disputed ? 'disputed' : edge.status || (edge.type === 'candidate' ? 'candidate' : ''))}</div>${edge.detail ? text(edge.detail) : ''}${refs(edge.sources)}${claimLinks(edge.claim_ids)}</article>`;
  }
  function entitySourceIds(entity) {
    return uniq([...arr(entity.sources), ...['fields','facts','career','sections'].flatMap(key => arr(entity[key]).flatMap(item => arr(item.sources))), ...adj(entity.id).flatMap(e => arr(e.sources)), ...uniq([...arr(entity.image_ids), ...arr(entity.sections).flatMap(s => arr(s.image_ids))]).flatMap(id => arr(A.get(id)?.sources))]);
  }
  const profileSection = (title, html) => html ? `<section class="profile-section"><h4>${esc(title)}</h4>${html}</section>` : '';
  function entityBody(id) {
    const entity = E.get(id); if (!entity) return '';
    const sectionImages = new Set(arr(entity.sections).flatMap(section => arr(section.image_ids)));
    const fieldHtml = arr(entity.fields).length ? `<dl class="field-grid">${entity.fields.map(field => `<div><dt>${esc(field.label)}</dt><dd>${esc(valueText(field.value))}${refs(field.sources)}${claimLinks(field.claim_ids)}</dd></div>`).join('')}</dl>` : '';
    const careerHtml = arr(entity.career).length ? `<div class="career">${entity.career.map(item => `<article class="career-item"><time>${esc(item.date || '')}</time><h4>${esc(item.title || '')}</h4>${item.text ? text(item.text) : ''}${refs(item.sources)}${claimLinks(item.claim_ids)}</article>`).join('')}</div>` : '';
    const factsHtml = arr(entity.facts).length ? `<ul class="facts">${entity.facts.map(fact => `<li>${fact.date ? `<span class="fact-date">${esc(fact.date)}</span>` : ''}${status(fact.status)}${esc(fact.text)}${refs(fact.sources)}${claimLinks(fact.claim_ids)}</li>`).join('')}</ul>` : '';
    const membership = archives.filter(a => arr(a.entity_ids).includes(id)).map(a => `<a class="entity-link" href="${href(anchor('archive', a.id))}" data-jump="${esc(anchor('archive', a.id))}">${esc(a.title)} ↗</a>`).join('');
    return `${profileSection('基本信息', fieldHtml)}${profileSection('履历与具体工作', careerHtml)}${profileSection('事实与记录', factsHtml)}${arr(entity.sections).map(section => profileSection(section.title || '档案记录', `${section.text ? text(section.text) : ''}${imageGrid(section.image_ids)}${refs(section.sources)}${claimLinks(section.claim_ids)}`)).join('')}${profileSection('图片与材料', imageGrid(arr(entity.image_ids).filter(imageId => !sectionImages.has(imageId))))}${profileSection('收录档案', membership ? `<div class="entity-links">${membership}</div>` : '')}${profileSection(`直接关系 · ${adj(id).length} 条`, adj(id).map(relationHtml).join(''))}${profileSection('完整来源', sourceLines(entitySourceIds(entity)))}`;
  }
  function entityIntro(id, modal = false) {
    const entity = E.get(id);
    return `<div class="inspect-type"><i class="dot" style="background:${color(id)}"></i>${esc(types[entity.type] || entity.type)} ${status(entity.status)}</div><div class="profile-heading"><div><${modal ? 'h2 id="dossierTitle"' : 'h3'}>${esc(entity.name)}</${modal ? 'h2' : 'h3'}>${entity.role ? `<div class="profile-role">${esc(entity.role)}</div>` : ''}${arr(entity.aliases).length ? `<div class="profile-alias">别名：${esc(entity.aliases.join(' · '))}</div>` : ''}</div></div><p class="${modal ? 'profile-summary' : 'inspect-summary'} text">${esc(entity.summary || '')}</p>${refs(entity.sources)}`;
  }

  const title = meta.title || `${name(rootId)}｜背景调查`;
  document.title = title; document.documentElement.lang = meta.language || 'zh-CN';
  $('reportTitle').textContent = title; $('reportSubtitle').textContent = meta.subtitle || '';
  $('mobileTitle').textContent = root?.short_name || root?.name || title;
  $('brandTitle').innerHTML = `${esc(root?.short_name || root?.name || '公司背景调查')}<small>人物 · 资本 · 业务</small>`;
  $('reportDate').textContent = meta.as_of ? `截至 ${meta.as_of}` : '';
  $('sidebarDate').textContent = meta.as_of || '公司背景调查';
  $('sidebarCounts').textContent = `${E.size} 个主体 · ${S.size} 个来源`;
  $('footerTitle').textContent = [title, meta.as_of].filter(Boolean).join(' · ');
  const heroImage = root ? images(arr(root.image_ids).slice(0, 1), true) : '';
  $('heroMedia').innerHTML = heroImage || (root ? `<div class="hero-card"><span class="type-tag"><i class="dot" style="background:${color(rootId)}"></i>${esc(types[root.type] || root.type)}</span><h3>${esc(root.name)}</h3>${root.role ? text(root.role) : ''}${refs(root.sources)}<button class="entity-link" data-open-entity="${esc(rootId)}" style="margin-top:16px">完整主体档案 ↗</button></div>` : '');
  $('judgment').innerHTML = `<span class="eyebrow">公司判断</span>${text(meta.summary || root?.summary || '现有资料尚未形成公司判断。')}`;
  $('businessMetrics').innerHTML = arr(D.metrics).map(metric => `<article class="business-metric"><span>${esc(metric.label)}</span><strong>${esc(metric.value)}</strong>${metric.detail ? `<small>${esc(metric.detail)}</small>` : ''}${refs(metric.sources)}${claimLinks(metric.claim_ids)}</article>`).join('');
  $('businessMetrics').hidden = !arr(D.metrics).length;
  $('reportStats').innerHTML = [[E.size,'个主体'],[pairs.length,'组主体连接'],[relationships.length,'条关系事实'],[S.size,'个来源']].map(([n,label]) => `<div class="stat"><strong>${n}</strong><span>${label}</span></div>`).join('');
  $('findings').innerHTML = arr(D.findings).map((finding, i) => `<article class="finding" id="${esc(anchor('finding', finding.id || i))}"><span class="item-number">${pad(i + 1)}</span><h3>${esc(finding.title)}</h3>${text(finding.text)}${entityLinks(finding.entity_ids)}${refs(finding.sources)}${claimLinks(finding.claim_ids)}</article>`).join('');
  $('readingEntries').innerHTML = sections.map((section, i) => `<a class="reading-entry" href="${href(section.id)}"><span>${pad(i + 1)}</span>${esc(section.title)}</a>`).join('');
  $('reportSections').innerHTML = sections.map((section, i) => `<section class="section" id="${esc(section.id)}" aria-labelledby="${esc(anchor('heading', section.id))}"><div class="section-head"><div><span class="eyebrow">${pad(i + 1)} · ${esc(section.kicker || '调查方向')}</span><h2 id="${esc(anchor('heading', section.id))}">${esc(section.title)}</h2></div></div>${section.intro ? `<p class="section-intro text">${esc(section.intro)}</p>` : ''}${renderBlocks(section.blocks)}</section>`).join('');
  $('questionKicker').textContent = `${questions.length} 个核心问题`;
  $('questionList').innerHTML = questions.map((q, i) => `<details class="question" id="${esc(anchor('question', q.id || i))}"${i === 0 ? ' open' : ''}><summary><span class="item-number">${pad(i + 1)}</span><span>${esc(q.question)}</span></summary><div class="question-body">${text(q.answer)}${refs(q.sources)}${claimLinks(q.claim_ids)}${q.why_it_matters ? `<div class="why"><strong>为什么重要</strong>${text(q.why_it_matters)}</div>` : ''}${arr(q.evidence).length ? `<ul class="evidence-list">${q.evidence.map(item => `<li>${esc(item.text)}${entityLinks(item.entity_ids)}${refs(item.sources)}${claimLinks(item.claim_ids)}</li>`).join('')}</ul>` : ''}</div></details>`).join('');
  const filed = new Set();
  function archiveEntities(ids) {
    return uniq(arr(ids)).filter(id => E.has(id)).map(id => {
      if (filed.has(id)) return entityLinks([id]);
      filed.add(id); const entity = E.get(id);
      return `<details class="entity-record" id="${esc(anchor('entity', id))}" data-entity-record="${esc(id)}"><summary><span class="type-tag"><i class="dot" style="background:${color(id)}"></i>${esc(types[entity.type] || entity.type)}</span><span><strong>${esc(entity.name)}</strong>${entity.role ? `<small>${esc(entity.role)}</small>` : ''}</span></summary><div class="record-body" data-entity-body="${esc(id)}"></div></details>`;
    }).join('');
  }
  $('archiveList').innerHTML = archives.map(archive => `<details class="archive" id="${esc(anchor('archive', archive.id))}"><summary><span><h3>${esc(archive.title)}</h3><small>${uniq(arr(archive.entity_ids)).filter(id => E.has(id)).length} 个主体 · ${uniq(arr(archive.source_ids)).filter(id => S.has(id)).length} 个档案来源</small></span></summary><div class="archive-body">${archive.intro ? `<p class="archive-intro text">${esc(archive.intro)}</p>` : ''}${renderBlocks(archive.blocks)}${archiveEntities(archive.entity_ids)}${refs(archive.source_ids)}</div></details>`).join('');
  const unfiled = entities.filter(e => !filed.has(e.id));
  if (unfiled.length) $('archiveList').insertAdjacentHTML('beforeend', `<details class="archive" id="other-entities"><summary><span><h3>${archives.length ? '其他主体档案' : '主体档案'}</h3><small>${unfiled.length} 个主体</small></span></summary><div class="archive-body">${archiveEntities(unfiled.map(e => e.id))}</div></details>`);
  $('archiveCount').textContent = `${E.size} 个主体 · 履历、字段、事实与直接关系`;
  $('timelineList').innerHTML = events.map((event, i) => `<article class="timeline-item" id="${esc(anchor('event', event.id || i))}"><time>${esc(event.date)}</time><h3>${esc(event.title)}</h3>${event.text ? text(event.text) : ''}${entityLinks(event.entity_ids)}${refs(event.sources)}${claimLinks(event.claim_ids)}</article>`).join('');
  function sourceHtml(source) {
    const url = safeUrl(source.url), sourceMeta = [sourceKinds[source.kind] || source.kind, source.publisher, source.published_at && `发布 ${source.published_at}`, source.effective_at && `生效 ${source.effective_at}`, source.as_of && `事实截至 ${source.as_of}`, (source.accessed_at || source.observed_at) && `访问 ${source.accessed_at || source.observed_at}`].filter(Boolean);
    return `<article class="source-card" id="${esc(anchor('source', source.id))}" data-source-card="${esc(source.id)}" tabindex="-1"><div class="source-heading"><span class="source-id">${esc(source.id)}</span><h3>${esc(source.title)}</h3>${status(source.status)}</div><div class="source-meta">${sourceMeta.map(item => `<span>${esc(item)}</span>`).join('')}</div>${source.locator ? `<p class="source-locator">定位：${esc(source.locator)}</p>` : ''}${source.excerpt ? `<p class="source-excerpt">${esc(source.excerpt)}</p>` : ''}${url && !url.startsWith('#') ? `<a class="source-url" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url)} ↗</a>` : source.url && !String(source.url).startsWith('#') ? `<span class="source-url">${esc(source.url)}</span>` : ''}${snapshots.some(s => s.source_id === source.id) ? `<details class="source-snapshots"><summary>证据存档 · ${snapshots.filter(s => s.source_id === source.id).length}</summary>${snapshots.filter(s => s.source_id === source.id).map(snapshotHtml).join('')}</details>` : ''}${source.origin_id && S.has(source.origin_id) ? `<div class="source-meta"><span>原始来源</span>${refs([source.origin_id])}</div>` : ''}</article>`;
  }
  $('sourceList').innerHTML = sources.map(sourceHtml).join('');
  $('sourceCount').textContent = `${S.size} 个来源 · ${sources.filter(s => !s.origin_id).length} 个原始来源条目`;
  $('sourceSearchCount').textContent = `${S.size} 条`;
  const autoNavItems = [{id:'overview',title:'公司判断'},{id:'network',title:'关系网络'},...sections.map(s => ({id:s.id,title:s.title})),...(questions.length ? [{id:'questions',title:'核心问题'}] : []),...(entities.length || archives.length ? [{id:'archives',title:'完整档案'}] : []),...(events.length ? [{id:'timeline',title:'时间线'}] : []),{id:'sources',title:'资料来源'}];
  const configuredNav = arr(meta.navigation).filter(item => item && typeof item.target === 'string' && $(item.target));
  const navItems = configuredNav.length ? configuredNav.map(item => ({id:item.target,title:item.label || item.target})) : autoNavItems;
  $('reportNav').innerHTML = navItems.map((item, i) => `<a href="${href(item.id)}" data-nav="${esc(item.id)}"${i === 0 ? ' class="active"' : ''}><span>${pad(i + 1)}</span>${esc(item.title)}</a>`).join('');
  $('questions').hidden = !questions.length; $('archives').hidden = !entities.length && !archives.length; $('timeline').hidden = !events.length;
  if (!questions.length) document.querySelector('.hero-actions a[href="#questions"]').hidden = true;

  // Rooted, deterministic layout. Core IDs take priority; shared path nodes keep context visible.
  const coreIds = uniq([rootId,...arr(meta.core_ids)]).filter(id => E.has(id));
  if (coreIds.length < 2 && root) coreIds.push(...uniq(adj(rootId).filter(confirmed).map(e => other(e, rootId))).sort((a, b) => (Number(E.get(b).importance) || adj(b).length) - (Number(E.get(a).importance) || adj(a).length)).slice(0, 22));
  const coreSet = new Set(coreIds);
  let selected = rootId, view = 'core', selectedPair = null, visible = [], visiblePairs = [], layout = new Map(), extra = new Set();
  let box = {x:-500,y:-350,w:1000,h:700}, fitWidth = 1000, pointer = null, expanded = false;
  const hash = string => [...String(string)].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 17);
  function viewIds() {
    let ids = view === 'all' ? entities.map(e => e.id) : view === 'near' ? [selected,...adj(selected).map(e => other(e, selected)),rootId] : [...coreIds];
    ids.push(...extra);
    for (const id of [...ids]) ids.push(...(pathTo(id)?.ids || []));
    return uniq(ids).filter(id => E.has(id));
  }
  function computeLayout() {
    const ids = viewIds(), set = new Set(ids), degrees = new Map(ids.map(id => [id, 0]));
    visiblePairs = pairs.filter(p => set.has(p.a) && set.has(p.b));
    for (const pair of visiblePairs) { degrees.set(pair.a, degrees.get(pair.a) + 1); if (pair.b !== pair.a) degrees.set(pair.b, degrees.get(pair.b) + 1); }
    const cluster = id => E.get(id)?.cluster || (branch.get(id) ? `branch:${branch.get(id)}` : `unconnected:${E.get(id)?.type}`);
    const clusters = uniq(ids.filter(id => id !== rootId).map(cluster)).sort(), clusterCounts = new Map(clusters.map(c => [c, ids.filter(id => cluster(id) === c).length]));
    const radius = Math.max(200, Math.sqrt(ids.length) * 48);
    visible = ids.map(id => {
      const group = cluster(id), groupIndex = clusters.indexOf(group), angle = -Math.PI / 2 + Math.PI * 2 * groupIndex / Math.max(1, clusters.length), spread = Math.sqrt(clusterCounts.get(group) || 1) * 29;
      const h = hash(id), depth = distance.get(id), radial = id === rootId ? 0 : radius + Math.min(4, Math.max(0, (depth || 1) - 1)) * 65 + (depth == null ? 110 : 0);
      const ax = id === rootId ? 0 : Math.cos(angle) * radial, ay = id === rootId ? 0 : Math.sin(angle) * radial;
      return {id, ax, ay, x:ax + (id === rootId ? 0 : Math.cos(h % 628 / 100) * spread), y:ay + (id === rootId ? 0 : Math.sin(h % 628 / 100) * spread), r:id === rootId ? 25 : Math.min(18, 10 + Math.sqrt(degrees.get(id) || 1) * 1.25), degree:degrees.get(id), fx:0, fy:0};
    });
    layout = new Map(visible.map(node => [node.id, node]));
    const steps = Math.min(200, Math.max(30, Math.floor(24000 / Math.max(1, visible.length))));
    for (let step = 0; step < steps; step++) {
      const alpha = 1 - step / (steps + 24);
      for (const n of visible) { n.fx = (n.ax - n.x) * .017; n.fy = (n.ay - n.y) * .017; }
      for (let i = 0; i < visible.length; i++) for (let j = i + 1; j < visible.length; j++) {
        const a = visible[i], b = visible[j]; let dx = a.x - b.x, dy = a.y - b.y;
        if (Math.abs(dx) + Math.abs(dy) < .01) { dx = .2; dy = .13; }
        const d2 = dx * dx + dy * dy, d = Math.sqrt(d2), gap = a.r + b.r + 37;
        const force = Math.min(9, 1700 / (d2 + 50)) + (d < gap ? (gap - d) * .09 : 0);
        const fx = dx / d * force, fy = dy / d * force; a.fx += fx; a.fy += fy; b.fx -= fx; b.fy -= fy;
        const labelGap = view === 'all' && !coreSet.has(a.id) && !coreSet.has(b.id) ? 82 : 130;
        if (Math.abs(dy) < 35 && Math.abs(dx) < labelGap) { const push = (labelGap - Math.abs(dx)) * .035 * (dx >= 0 ? 1 : -1); a.fx += push; b.fx -= push; }
      }
      for (const pair of visiblePairs) {
        const a = layout.get(pair.a), b = layout.get(pair.b); if (a === b) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
        const target = 108 + Math.min(65, (a.degree + b.degree) * 3), f = (d - target) * .014;
        a.fx += dx / d * f; a.fy += dy / d * f; b.fx -= dx / d * f; b.fy -= dy / d * f;
      }
      for (const n of visible) { if (n.id === rootId) continue; n.x += Math.max(-12, Math.min(12, n.fx)) * alpha; n.y += Math.max(-12, Math.min(12, n.fy)) * alpha; }
    }
    drawGraph(); fitGraph();
  }
  function edgePath(pair, offset = 0) {
    const a = layout.get(pair.a), b = layout.get(pair.b);
    if (a === b) return `M${a.x - 8},${a.y - 10} C${a.x - 65},${a.y - 85} ${a.x + 65},${a.y - 85} ${a.x + 8},${a.y - 10}`;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, bend = (hash(pair.key) % 2 ? 1 : -1) * Math.min(20, d * .055) + offset;
    return `M${a.x},${a.y} Q${(a.x + b.x) / 2 - dy / d * bend},${(a.y + b.y) / 2 + dx / d * bend} ${b.x},${b.y}`;
  }
  function graphName(id) {
    const value = E.get(id)?.short_name || name(id), limit = /[\u3400-\u9fff]/.test(value) ? 12 : 22;
    return [...value].length > limit ? [...value].slice(0, limit - 1).join('') + '…' : value;
  }
  function drawGraph() {
    $('networkLinks').innerHTML = visiblePairs.map(pair => {
      const kinds = uniq(pair.records.map(styleOf)), paths = kinds.map((kind, i) => `<path class="net-edge ${kind}" data-offset="${(i - (kinds.length - 1) / 2) * 9}" d="${edgePath(pair, (i - (kinds.length - 1) / 2) * 9)}"/>`).join('');
      return `<g class="edge-group" data-edge="${esc(pair.key)}" tabindex="0" role="button" aria-label="${esc(`${name(pair.a)}与${name(pair.b)}，${pair.records.length}条关系`)}">${paths}<path class="edge-hit" d="${edgePath(pair)}"/><title>${esc(pair.records.map(edge => `${name(edge.from)} → ${name(edge.to)}：${edge.label}`).join('\n'))}</title></g>`;
    }).join('');
    $('networkNodes').innerHTML = visible.map(node => {
      const entity = E.get(node.id), c = color(node.id), secondary = view === 'all' && !coreSet.has(node.id) && node.degree < 5;
      return `<g class="net-node" data-node="${esc(node.id)}" transform="translate(${node.x},${node.y})" tabindex="0" role="button" aria-label="${esc(`${entity.name}，${types[entity.type] || entity.type}，查看档案`)}"><circle class="halo" r="${node.r + 6}" stroke="${c}"${entity.status === 'candidate' ? ' stroke-dasharray="2 5"' : ''}/><circle class="core" r="${node.r}" fill="${node.id === rootId ? '#173c35' : c}"/><text class="type-letter" y="3.5">${node.id === rootId ? '主' : letters[entity.type] || '档'}</text><text class="${node.id === rootId ? 'root-label' : secondary ? 'secondary-label' : ''}" y="${node.r + 21}">${esc(graphName(node.id))}</text><title>${esc([entity.name, entity.role, types[entity.type]].filter(Boolean).join(' · '))}</title></g>`;
    }).join('');
    $('networkCount').textContent = `${visible.length} / ${E.size} 个主体 · ${visiblePairs.length} 组连接 · ${visiblePairs.reduce((n, pair) => n + pair.records.length, 0)} 条关系`;
    highlightGraph(); renderInspector();
  }
  function highlightGraph() {
    const path = pathTo(selected), related = new Set([selected,...adj(selected).map(e => other(e, selected)),...(path?.ids || [])]);
    const pathPairs = new Set((path?.edges || []).map(edge => pairKey(edge.from, edge.to)));
    document.querySelectorAll('#networkNodes [data-node]').forEach(el => {
      const id = el.dataset.node;
      el.classList.toggle('active', id === selected && !selectedPair); el.classList.toggle('neighbor', related.has(id));
      el.classList.toggle('dim', selectedPair ? ![relationMap.get(selectedPair)?.a, relationMap.get(selectedPair)?.b].includes(id) : selected !== rootId && !related.has(id));
    });
    document.querySelectorAll('#networkLinks [data-edge]').forEach(el => {
      const pair = relationMap.get(el.dataset.edge), active = selectedPair ? pair.key === selectedPair : selected !== rootId && (pair.a === selected || pair.b === selected);
      el.classList.toggle('active', active); el.classList.toggle('path-active', !selectedPair && pathPairs.has(pair.key));
      el.classList.toggle('dim', selectedPair ? !active : selected !== rootId && !active && !pathPairs.has(pair.key));
    });
  }
  function renderInspector() {
    if (selectedPair) {
      const pair = relationMap.get(selectedPair);
      $('networkInspector').innerHTML = `<div class="inspect-type">逐条关系 · ${pair.records.length} 条</div><h3>${esc(name(pair.a))}<br>↔ ${esc(name(pair.b))}</h3>${pair.records.map(relationHtml).join('')}${entityLinks([pair.a,pair.b])}`;
      $('networkPath').innerHTML = `<span class="path-title">${esc(name(pair.a))} ↔ ${esc(name(pair.b))}</span><p>${pair.records.length} 条关系分别保留原始方向、时间、性质与来源。</p>`;
    } else if (E.has(selected)) {
      $('networkInspector').innerHTML = `${entityIntro(selected)}<button class="primary inspect-action" data-open-entity="${esc(selected)}">完整档案 <span>↗</span></button>${entityBody(selected)}`;
      $('networkPath').innerHTML = pathHtml(selected);
    } else {
      $('networkInspector').innerHTML = '<p class="empty">尚未收录可展示的调查主体。</p>'; $('networkPath').innerHTML = '';
    }
    $('networkInspector').scrollTop = 0;
  }
  function setBox() { $('networkSvg').setAttribute('viewBox', `${box.x} ${box.y} ${box.w} ${box.h}`); }
  function fitGraph() {
    if (!visible.length) { setBox(); return; }
    const rect = $('networkViewport').getBoundingClientRect(), ratio = Math.max(1, rect.width) / Math.max(1, rect.height);
    const minX = Math.min(...visible.map(n => n.x - (n.id === rootId ? 115 : 91))), maxX = Math.max(...visible.map(n => n.x + (n.id === rootId ? 115 : 91)));
    const minY = Math.min(...visible.map(n => n.y - n.r - 28)), maxY = Math.max(...visible.map(n => n.y + n.r + 60));
    let w = Math.max(300, maxX - minX), h = Math.max(250, maxY - minY);
    if (w / h < ratio) w = h * ratio; else h = w / ratio;
    box = {x:(minX + maxX - w) / 2,y:(minY + maxY - h) / 2,w,h}; fitWidth = w; setBox();
  }
  function zoom(factor, clientX, clientY) {
    const rect = $('networkSvg').getBoundingClientRect();
    const rx = clientX == null ? .5 : (clientX - rect.left) / Math.max(1, rect.width), ry = clientY == null ? .5 : (clientY - rect.top) / Math.max(1, rect.height);
    const nextWidth = Math.min(Math.max(5000, fitWidth * 4), Math.max(170, box.w * factor)), scale = nextWidth / box.w;
    box.x += box.w * rx * (1 - scale); box.y += box.h * ry * (1 - scale); box.w *= scale; box.h *= scale; setBox();
  }
  function updatePositions() {
    document.querySelectorAll('#networkNodes [data-node]').forEach(el => { const node = layout.get(el.dataset.node); el.setAttribute('transform', `translate(${node.x},${node.y})`); });
    document.querySelectorAll('#networkLinks [data-edge]').forEach(el => { const pair = relationMap.get(el.dataset.edge); el.querySelectorAll('path').forEach(path => path.setAttribute('d', edgePath(pair, Number(path.dataset.offset) || 0))); });
  }
  function selectEntity(id) {
    if (!E.has(id)) return;
    selected = id; selectedPair = null;
    const required = [id,...(pathTo(id)?.ids || [])];
    const changed = required.some(pid => !layout.has(pid)); required.forEach(pid => extra.add(pid));
    if (changed || view === 'near') computeLayout(); else { highlightGraph(); renderInspector(); }
    if (expanded && window.matchMedia('(max-width:900px)').matches) openDossier(id);
  }
  function selectEdge(key) {
    if (!relationMap.has(key)) return;
    selectedPair = key; highlightGraph(); renderInspector();
    if (expanded && window.matchMedia('(max-width:900px)').matches) {
      const pair = relationMap.get(key);
      $('dossierContent').innerHTML = `<div class="inspect-type">逐条关系 · ${pair.records.length} 条</div><h2 id="dossierTitle">${esc(name(pair.a))} ↔ ${esc(name(pair.b))}</h2>${pair.records.map(relationHtml).join('')}`;
      showDialog();
    }
  }
  function setView(next) {
    if (!['core','all','near'].includes(next)) return;
    view = next; selectedPair = null; extra.clear();
    if (next === 'core' && !coreSet.has(selected)) selected = rootId;
    document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
    computeLayout();
  }
  function updateLock() { document.body.classList.toggle('lock-scroll', expanded || $('dossierDialog').open || $('searchDialog').open || $('evidenceDialog').open); }
  function toggleFull(force) {
    expanded = typeof force === 'boolean' ? force : !expanded;
    $('networkPanel').classList.toggle('expanded', expanded); $('networkFull').textContent = expanded ? '退出全屏 ×' : '全屏 ↗';
    $('networkFull').setAttribute('aria-pressed', String(expanded)); updateLock(); requestAnimationFrame(fitGraph);
  }
  function showDialog() { if (!$('dossierDialog').open) $('dossierDialog').showModal(); $('dossierDialog').scrollTop = 0; updateLock(); }
  function openDossier(id) {
    if (!E.has(id)) return;
    if ($('evidenceDialog').open) $('evidenceDialog').close();
    $('dossierContent').innerHTML = `<div class="network-path">${pathHtml(id, 'open-entity')}</div>${entityIntro(id, true)}<button class="secondary profile-action" data-locate="${esc(id)}" style="margin-top:18px">在关系网络中定位 ↗</button>${entityBody(id)}`;
    showDialog();
  }
  function materialize(record) {
    const body = record.querySelector('[data-entity-body]');
    if (!body || body.dataset.loaded) return;
    const id = body.dataset.entityBody, entity = E.get(id);
    body.innerHTML = `<p class="profile-summary text">${esc(entity.summary || '')}</p>${arr(entity.aliases).length ? `<p class="profile-alias">别名：${esc(entity.aliases.join(' · '))}</p>` : ''}${status(entity.status)}${refs(entity.sources)}<div class="network-path">${pathHtml(id, 'open-entity')}</div><button class="secondary profile-action" data-locate="${esc(id)}">在关系网络中定位 ↗</button>${entityBody(id)}`;
    body.dataset.loaded = 'true';
  }
  function goTo(id) {
    if ($('evidenceDialog').open) $('evidenceDialog').close();
    if ($('searchDialog').open) $('searchDialog').close();
    if ($('dossierDialog').open) $('dossierDialog').close();
    if (expanded) toggleFull(false);
    const target = $(id); if (!target) return;
    let node = target; while (node) { if (node.tagName === 'DETAILS') node.open = true; node = node.parentElement; }
    requestAnimationFrame(() => target.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth',block:'start'}));
  }
  function filterSources() {
    const query = $('sourceSearch').value.trim().toLocaleLowerCase(); let count = 0;
    document.querySelectorAll('[data-source-card]').forEach(card => {
      const s = S.get(card.dataset.sourceCard), matched = [s.id,s.title,s.publisher,s.url,s.kind,sourceKinds[s.kind],s.locator,s.excerpt].join(' ').toLocaleLowerCase().includes(query);
      card.hidden = !matched; if (matched) count++;
    });
    $('sourceSearchCount').textContent = `${count} / ${S.size} 条`;
  }
  function revealSource(id) { $('sourceSearch').value = ''; filterSources(); const key = anchor('source', id); goTo(key); $(key)?.focus({preventScroll:true}); }
  // Search highlighting is built from text nodes, so query strings never become markup.
  function appendHighlighted(container, value, query) {
    const string = String(value || ''), lower = string.toLocaleLowerCase(), needle = query.toLocaleLowerCase();
    let start = 0, at = lower.indexOf(needle);
    if (!needle || at < 0) { container.textContent = string; return; }
    while (at >= 0) {
      container.append(document.createTextNode(string.slice(start, at)));
      const mark = document.createElement('mark'); mark.textContent = string.slice(at, at + query.length); container.append(mark);
      start = at + query.length; at = lower.indexOf(needle, start);
    }
    container.append(document.createTextNode(string.slice(start)));
  }
  const blockSearchText = block => [block.title,block.text,...arr(block.steps).flatMap(step => [step.title,step.text]),...arr(block.entity_ids).map(name),...arr(block.sources),...arr(block.image_ids).flatMap(id => [A.get(id)?.alt,A.get(id)?.caption])].filter(v => v != null).join(' ');
  const searchIndex = [];
  function indexSearch(kind, id, label, heading, body, target) {
    searchIndex.push({kind,id,label,title:String(heading || ''),body:String(body || ''),target,key:[id,label,heading,body].join(' ').toLocaleLowerCase()});
  }
  indexSearch('jump', 'overview', '公司判断', title, [meta.subtitle,meta.summary].filter(Boolean).join(' '), 'overview');
  entities.forEach(entity => indexSearch('entity', entity.id, types[entity.type] || '主体', entity.name, [entity.short_name,entity.role,entity.summary,...arr(entity.aliases),...arr(entity.fields).flatMap(f => [f.label,valueText(f.value)]),...arr(entity.facts).flatMap(f => [f.date,f.text]),...arr(entity.career).flatMap(c => [c.date,c.title,c.text]),...arr(entity.sections).flatMap(s => [s.title,s.text]),...adj(entity.id).flatMap(e => [e.label,e.detail,e.date,e.percent != null ? `${e.percent}%` : '',name(other(e,entity.id))]),...entitySourceIds(entity)].filter(v => v != null).join(' ')));
  sections.forEach(section => indexSearch('jump', section.id, '章节', section.title, [section.kicker,section.intro,...arr(section.blocks).map(blockSearchText)].filter(Boolean).join(' '), section.id));
  questions.forEach((question, i) => indexSearch('jump', question.id || i, '问题', question.question, [question.answer,question.why_it_matters,...arr(question.evidence).map(blockSearchText),...arr(question.sources)].filter(Boolean).join(' '), anchor('question',question.id || i)));
  archives.forEach(archive => indexSearch('jump', archive.id, '档案', archive.title, [archive.intro,...arr(archive.blocks).map(blockSearchText),...arr(archive.entity_ids).map(name),...arr(archive.source_ids)].filter(Boolean).join(' '), anchor('archive',archive.id)));
  sources.forEach(source => indexSearch('source', source.id, '来源', source.title, [source.id,sourceKinds[source.kind],source.publisher,source.published_at,source.observed_at,source.locator,source.excerpt,source.url].filter(Boolean).join(' ')));
  arr(D.claims).forEach(claim => indexSearch('claim', claim.id, '核查依据', claim.text, [claim.kind,claim.locator,claim.reasoning,claim.as_of,...arr(claim.source_ids)].filter(Boolean).join(' ')));
  arr(D.findings).forEach((finding, i) => indexSearch('jump', finding.id || i, '关键发现', finding.title, [finding.text,...arr(finding.entity_ids).map(name),...arr(finding.sources)].filter(Boolean).join(' '), anchor('finding',finding.id || i)));
  events.forEach((event, i) => indexSearch('jump', event.id || i, '时间线', event.title, [event.date,event.text,...arr(event.entity_ids).map(name),...arr(event.sources)].filter(Boolean).join(' '), anchor('event',event.id || i)));
  function renderGlobalSearch() {
    const query = $('globalSearch').value.trim(), out = $('globalSearchResults'); out.replaceChildren();
    if (!query) {
      $('globalSearchStatus').textContent = '搜索人物、公司、产品、正文、问题、档案与来源。';
      const note = document.createElement('p'); note.className = 'site-search-empty'; note.textContent = '输入主体名称、工作内容、事件或来源编号。'; out.append(note); return;
    }
    const q = query.toLocaleLowerCase(), matches = searchIndex.map((record, index) => ({record,index})).filter(({record}) => record.key.includes(q));
    const rank = record => record.title.toLocaleLowerCase() === q ? 3 : record.title.toLocaleLowerCase().includes(q) ? 2 : String(record.id).toLocaleLowerCase() === q ? 1 : 0;
    matches.sort((a,b) => rank(b.record) - rank(a.record) || a.index - b.index);
    $('globalSearchStatus').textContent = matches.length ? `${matches.length} 个结果${matches.length > 80 ? ' · 显示前 80 个，请补充关键词' : ''}` : '没有匹配结果';
    if (!matches.length) { const note = document.createElement('p'); note.className = 'site-search-empty'; note.textContent = `没有找到与“${query}”匹配的内容。试试其他主体名称、关键词或来源编号。`; out.append(note); return; }
    matches.slice(0,80).forEach(({record,index}) => {
      const button = document.createElement('button'); button.className = 'site-search-result'; button.dataset.globalResult = String(index);
      const category = document.createElement('span'); category.className = 'site-search-kind'; category.textContent = record.label;
      const heading = document.createElement('strong'), snippet = document.createElement('span'); snippet.className = 'site-search-snippet';
      appendHighlighted(heading, record.title, query);
      const at = record.body.toLocaleLowerCase().indexOf(q), start = Math.max(0, at - 44), end = Math.min(record.body.length, start + Math.max(145, query.length + 70));
      appendHighlighted(snippet, `${start ? '…' : ''}${record.body.slice(start,end)}${end < record.body.length ? '…' : ''}`, query);
      button.append(category,heading,snippet); out.append(button);
    });
  }
  function openGlobalSearch() {
    if ($('evidenceDialog').open) $('evidenceDialog').close();
    if ($('dossierDialog').open) $('dossierDialog').close();
    renderGlobalSearch(); if (!$('searchDialog').open) $('searchDialog').showModal();
    updateLock(); $('globalSearch').focus(); $('globalSearch').select();
  }
  function chooseGlobalResult(index) {
    const record = searchIndex[Number(index)]; if (!record) return;
    $('searchDialog').close();
    if (record.kind === 'entity') openDossier(record.id);
    else if (record.kind === 'source') revealSource(record.id);
    else if (record.kind === 'claim') openClaims([record.id]);
    else {
      goTo(record.target);
      const target = $(record.target); if (target) { target.setAttribute('tabindex','-1'); target.focus({preventScroll:true}); }
    }
  }
  $('openSearch').addEventListener('click', openGlobalSearch);
  $('closeSearch').addEventListener('click', () => $('searchDialog').close());
  $('searchDialog').addEventListener('close', updateLock);
  $('searchDialog').addEventListener('cancel', event => { event.preventDefault(); $('searchDialog').close(); });
  $('searchDialog').addEventListener('click', event => { if (event.target !== $('searchDialog')) return; const r = $('searchDialog').getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) $('searchDialog').close(); });
  $('globalSearch').addEventListener('input', renderGlobalSearch);
  $('globalSearch').addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') { event.preventDefault(); $('globalSearchResults').querySelector('button')?.focus(); }
    if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); $('globalSearchResults').querySelector('button')?.click(); }
  });
  $('globalSearchResults').addEventListener('keydown', event => {
    const buttons = [...$('globalSearchResults').querySelectorAll('button')], index = buttons.indexOf(document.activeElement);
    if (event.key === 'ArrowDown') { event.preventDefault(); buttons[(index + 1) % buttons.length]?.focus(); }
    if (event.key === 'ArrowUp') { event.preventDefault(); index > 0 ? buttons[index - 1].focus() : $('globalSearch').focus(); }
  });
  $('networkSearch').addEventListener('input', () => {
    const query = $('networkSearch').value.trim(), out = $('networkResults'); out.replaceChildren();
    if (!query) { out.hidden = true; return; }
    const q = query.toLocaleLowerCase(), matches = entities.filter(entity => [entity.name,entity.short_name,...arr(entity.aliases),entity.role,entity.summary,...arr(entity.career).map(c => `${c.title} ${c.text}`)].join(' ').toLocaleLowerCase().includes(q)).sort((a, b) => Number(b.name.toLocaleLowerCase().includes(q)) - Number(a.name.toLocaleLowerCase().includes(q)) || Number(coreSet.has(b.id)) - Number(coreSet.has(a.id)));
    for (const entity of matches.slice(0, 15)) {
      const button = document.createElement('button'); button.className = 'search-result'; button.dataset.searchResult = entity.id;
      const dot = document.createElement('i'); dot.className = 'dot'; dot.style.background = color(entity.id); button.append(dot);
      const words = document.createElement('span'), heading = document.createElement('strong'), sub = document.createElement('small');
      appendHighlighted(heading, entity.name, query); appendHighlighted(sub, [types[entity.type],entity.role,arr(entity.aliases).join(' · ')].filter(Boolean).join(' · '), query);
      words.append(heading, sub); button.append(words); out.append(button);
    }
    if (!matches.length || matches.length > 15) { const note = document.createElement('div'); note.className = 'search-empty'; note.textContent = matches.length ? `显示前 15 / ${matches.length} 个结果，请补充关键词。` : '没有找到对应主体。'; out.append(note); }
    out.hidden = false;
  });
  $('networkSearch').addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') { event.preventDefault(); $('networkResults').querySelector('button')?.focus(); }
    if (event.key === 'Enter' && !$('networkResults').hidden) { event.preventDefault(); $('networkResults').querySelector('button')?.click(); }
  });
  $('networkResults').addEventListener('keydown', event => {
    const buttons = [...$('networkResults').querySelectorAll('button')], index = buttons.indexOf(document.activeElement);
    if (event.key === 'ArrowDown') { event.preventDefault(); buttons[(index + 1) % buttons.length]?.focus(); }
    if (event.key === 'ArrowUp') { event.preventDefault(); index > 0 ? buttons[index - 1].focus() : $('networkSearch').focus(); }
  });
  $('sourceSearch').addEventListener('input', filterSources);
  document.addEventListener('toggle', event => { if (event.target.matches?.('[data-entity-record]') && event.target.open) materialize(event.target); }, true);
  document.addEventListener('click', event => {
    const target = event.target.closest('button,a');
    if (target) {
      const data = target.dataset;
      if (data.globalResult !== undefined) chooseGlobalResult(data.globalResult);
      else if (data.claims !== undefined) openClaims(data.claims.split(','));
      else if (data.openEntity !== undefined) openDossier(data.openEntity);
      else if (data.selectEntity !== undefined) selectEntity(data.selectEntity);
      else if (data.view) setView(data.view);
      else if (data.searchResult !== undefined) { selectEntity(data.searchResult); $('networkResults').hidden = true; $('networkSearch').value = ''; }
      else if (data.source !== undefined) { event.preventDefault(); revealSource(data.source); }
      else if (data.jump !== undefined) { event.preventDefault(); goTo(data.jump); }
      else if (data.locate !== undefined) { if ($('dossierDialog').open) $('dossierDialog').close(); if (expanded) toggleFull(false); selectEntity(data.locate); goTo('network'); }
    }
    if (!event.target.closest('.network-search')) $('networkResults').hidden = true;
    if (event.target.closest('#reportNav a') || !$('sidebar').contains(event.target) && !event.target.closest('#menuToggle')) { $('sidebar').classList.remove('open'); $('menuToggle').setAttribute('aria-expanded', 'false'); }
  });
  $('menuToggle').addEventListener('click', () => { const open = $('sidebar').classList.toggle('open'); $('menuToggle').setAttribute('aria-expanded', String(open)); });
  $('networkFull').addEventListener('click', () => toggleFull());
  $('zoomIn').addEventListener('click', () => zoom(.8)); $('zoomOut').addEventListener('click', () => zoom(1.25));
  $('fitGraph').addEventListener('click', fitGraph); $('resetGraph').addEventListener('click', () => { selected = rootId; setView('core'); });
  $('closeEvidence').addEventListener('click', () => $('evidenceDialog').close());
  $('evidenceDialog').addEventListener('close', updateLock);
  $('evidenceDialog').addEventListener('click', event => { if (event.target !== $('evidenceDialog')) return; const r = $('evidenceDialog').getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) $('evidenceDialog').close(); });
  $('closeDossier').addEventListener('click', () => $('dossierDialog').close()); $('dossierDialog').addEventListener('close', updateLock);
  $('dossierDialog').addEventListener('click', event => { if (event.target !== $('dossierDialog')) return; const r = $('dossierDialog').getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) $('dossierDialog').close(); });
  document.addEventListener('keydown', event => {
    if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.target.closest('input,textarea,[contenteditable="true"]')) { event.preventDefault(); openGlobalSearch(); return; }
    if (event.key !== 'Escape') return;
    if ($('evidenceDialog').open) { event.preventDefault(); $('evidenceDialog').close(); return; }
    if ($('searchDialog').open) { event.preventDefault(); $('searchDialog').close(); return; }
    $('networkResults').hidden = true; $('sidebar').classList.remove('open'); $('menuToggle').setAttribute('aria-expanded', 'false');
    if (!$('dossierDialog').open && expanded) toggleFull(false);
  });
  const svg = $('networkSvg');
  svg.addEventListener('keydown', event => {
    if (!['Enter',' '].includes(event.key)) return;
    const node = event.target.closest('[data-node]'), edge = event.target.closest('[data-edge]');
    if (node || edge) { event.preventDefault(); node ? selectEntity(node.dataset.node) : selectEdge(edge.dataset.edge); }
  });
  svg.addEventListener('dblclick', event => { const node = event.target.closest('[data-node]'); if (node) openDossier(node.dataset.node); });
  svg.addEventListener('pointerdown', event => {
    if (event.button !== 0 || pointer) return;
    pointer = {id:event.pointerId,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,node:event.target.closest('[data-node]')?.dataset.node,edge:event.target.closest('[data-edge]')?.dataset.edge,moved:false};
    svg.setPointerCapture(event.pointerId);
  });
  svg.addEventListener('pointermove', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const rect = svg.getBoundingClientRect(), dx = (event.clientX - pointer.x) / Math.max(1, rect.width) * box.w, dy = (event.clientY - pointer.y) / Math.max(1, rect.height) * box.h;
    pointer.moved ||= Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > 4;
    pointer.x = event.clientX; pointer.y = event.clientY;
    if (pointer.node) { const node = layout.get(pointer.node); node.x += dx; node.y += dy; updatePositions(); }
    else { box.x -= dx; box.y -= dy; setBox(); }
  });
  svg.addEventListener('pointerup', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const old = pointer; pointer = null;
    if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
    if (!old.moved) { if (old.node) selectEntity(old.node); else if (old.edge) selectEdge(old.edge); }
  });
  svg.addEventListener('pointercancel', () => { pointer = null; }); svg.addEventListener('lostpointercapture', () => { pointer = null; });
  $('networkViewport').addEventListener('wheel', event => { if (!event.ctrlKey && !expanded) return; event.preventDefault(); zoom(event.deltaY > 0 ? 1.12 : .89, event.clientX, event.clientY); }, {passive:false});
  let resizeFrame = 0;
  if ('ResizeObserver' in window) new ResizeObserver(() => { cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(fitGraph); }).observe($('networkViewport'));
  if ('IntersectionObserver' in window) {
    const observed = new Map();
    const navObserver = new IntersectionObserver(entries => {
      for (const entry of entries) observed.set(entry.target.id, entry.isIntersecting);
      const active = navItems.find(item => observed.get(item.id));
      if (active) document.querySelectorAll('[data-nav]').forEach(link => { link.classList.toggle('active', link.dataset.nav === active.id); if (link.dataset.nav === active.id) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current'); });
    }, {rootMargin:'-10% 0px -60% 0px'});
    navItems.forEach(item => { if ($(item.id)) navObserver.observe($(item.id)); });
  }
  let printState = null;
  window.addEventListener('beforeprint', () => {
    if (printState) return;
    $('printEvidenceContent').innerHTML = [...C.values()].map(claimHtml).join('');
    printState = [...document.querySelectorAll('details')].map(el => [el,el.open]);
    document.querySelectorAll('[data-entity-record]').forEach(materialize);
    document.querySelectorAll('img').forEach(image => { image.loading = 'eager'; });
    printState.forEach(([el]) => { el.open = true; });
  });
  window.addEventListener('afterprint', () => { if (printState) printState.forEach(([el,open]) => { el.open = open; }); printState = null; $('printEvidenceContent').replaceChildren(); requestAnimationFrame(fitGraph); });
  $('printReport').addEventListener('click', () => window.print());
  $('networkSummary').textContent = `${E.size} 个主体 · ${pairs.length} 组连接 · ${relationships.length} 条关系事实`;
  $('networkLegend').innerHTML = Object.keys(types).filter(type => entities.some(e => e.type === type)).map(type => `<span><i class="dot" style="background:${colors[type]}"></i>${types[type]}</span>`).join('') + '<span><i class="legend-line"></i>资本</span><span><i class="legend-line business"></i>业务</span><span><i class="legend-line candidate"></i>待核 / 争议</span>';
  computeLayout();
  if (location.hash) { try { const target = $(decodeURIComponent(location.hash.slice(1))); let node = target; while (node) { if (node.tagName === 'DETAILS') node.open = true; node = node.parentElement; } } catch (_) {} }
})();
