const express = require('express');
const fetch = require('node-fetch');
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const ZENDESK_SUBDOMAIN = process.env.ZENDESK_SUBDOMAIN;
const ZENDESK_EMAIL = process.env.ZENDESK_EMAIL;
const ZENDESK_TOKEN = process.env.ZENDESK_TOKEN;

async function vertaalNaarNederlands(tekst) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5-5',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: 'Detecteer de taal van onderstaande tekst. Als de taal Nederlands is, antwoord dan alleen met het woord "NL". Als de taal niet Nederlands is, vertaal de tekst dan naar Nederlands en geef alleen de vertaling terug, zonder uitleg of toevoeging. Bewaar alle regelafbrekingen en alinea-indeling van de originele tekst exact zoals ze zijn.\n\nTekst:\n' + tekst
      }]
    })
  });
  const data = await response.json();
  return data.content[0].text.trim();
}

async function maakSamenvatting(comments) {
  const gesprek = comments.map((c, i) => {
    const rol = i === 0 ? 'Klant' : (c.via && c.via.channel === 'web' ? 'Medewerker' : 'Klant');
    return rol + ': ' + (c.body || '').slice(0, 500);
  }).join('\n\n');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5-5',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: 'Maak een korte samenvatting van dit gesprek in maximaal 5 opsommingspunten. Gebruik het formaat "- punt". Geef alleen de opsommingspunten terug, geen inleiding of afsluiting.\n\n' + gesprek
      }]
    })
  });
  const data = await response.json();
  return data.content[0].text.trim();
}

app.get('/ticket/:id', async (req, res) => {
  const ticketId = req.params.id;
  const agentId = req.query.agent_id || '';

  const response = await fetch(`https://${ZENDESK_SUBDOMAIN}.zendesk.com/api/v2/tickets/${ticketId}.json`, {
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${ZENDESK_EMAIL}/token:${ZENDESK_TOKEN}`).toString('base64')
    }
  });
  const data = await response.json();
  if (!data.ticket) {
    return res.status(500).send(`
      <h2 style="font-family:sans-serif;padding:2rem">Fout bij ophalen ticket</h2>
      <pre style="padding:2rem;background:#f5f5f5">${JSON.stringify(data, null, 2)}</pre>
    `);
  }
  const ticket = data.ticket;

  const commentsResponse = await fetch(`https://${ZENDESK_SUBDOMAIN}.zendesk.com/api/v2/tickets/${ticketId}/comments.json`, {
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${ZENDESK_EMAIL}/token:${ZENDESK_TOKEN}`).toString('base64')
    }
  });
  const commentsData = await commentsResponse.json();
  const publiciekeComments = (commentsData.comments || []).filter(c => c.public);
  const heeftMeerdereReacties = publiciekeComments.length > 3;
  const laatsteBericht = publiciekeComments.length > 0 ? publiciekeComments[publiciekeComments.length - 1].body || '' : ticket.description || '';

  const conceptTekst = decodeURIComponent(req.query.concept || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '');

  // Stap 1: taaldetectie + samenvatting parallel
  const [vertaling, samenvatting] = await Promise.all([
    vertaalNaarNederlands(laatsteBericht),
    heeftMeerdereReacties ? maakSamenvatting(publiciekeComments) : Promise.resolve('')
  ]);

  const toonVertaling = vertaling !== 'NL';
  const samenvattingHtml = samenvatting.split('\n').filter(r => r.trim()).map(r => `<li>${r.replace(/^- /, '')}</li>`).join('');

  // Stap 2: conceptvertaling alleen als taal niet-NL is (voorkomt onnodige call bij NL tickets)
  let conceptVertaling = '';
  if (toonVertaling && conceptTekst) {
    const cv = await vertaalNaarNederlands(conceptTekst);
    if (cv !== 'NL') conceptVertaling = cv;
  }

  res.send(`<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ticket #${ticket.id} — Claude Review</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --green-dark: #1C3D2E;
      --green-mid: #2D5C44;
      --green-light: #E8F2EC;
      --green-border: #C2DDC9;
      --bg: #F4F5F3;
      --surface: #FFFFFF;
      --border: #E3E4E0;
      --text: #1A1A18;
      --text-soft: #6B6B65;
      --text-xsoft: #9E9E96;
      --blue-light: #EEF3FF;
      --blue-border: #C5D4F5;
      --blue-text: #2B4EAB;
      --red-light: #FEF2F2;
      --red-text: #991B1B;
    }

    html, body {
      height: 100%;
      font-size: 14px;
      font-family: 'Inter', -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      overflow: hidden;
    }

    /* ── Hoofdstructuur: topbar + 2 kolommen ── */
    .app {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }

    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 18px;
      background: var(--green-dark);
      color: #fff;
      flex-shrink: 0;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }

    .topbar-left { display: flex; flex-direction: column; gap: 1px; }

    .topbar-ref {
      font-size: 11px;
      font-weight: 500;
      opacity: 0.6;
      letter-spacing: 0.02em;
    }

    .topbar-subject {
      font-size: 14px;
      font-weight: 600;
      line-height: 1.3;
    }

    .topbar-badge {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      font-weight: 500;
      background: rgba(255,255,255,0.12);
      border-radius: 20px;
      padding: 4px 10px;
      white-space: nowrap;
      opacity: 0.85;
    }

    .columns {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    /* ── Linkerkolom ── */
    .col-left {
      width: 38%;
      min-width: 280px;
      display: flex;
      flex-direction: column;
      border-right: 1px solid var(--border);
      background: var(--surface);
      overflow: hidden;
    }

    .col-section {
      padding: 14px 16px;
    }

    .col-section + .col-section {
      border-top: 1px solid var(--border);
    }

    .section-label {
      font-size: 10.5px;
      font-weight: 600;
      color: var(--text-xsoft);
      letter-spacing: 0.07em;
      text-transform: uppercase;
      margin-bottom: 8px;
    }

    /* Bericht neemt alle vrije ruimte */
    .bericht-sectie {
      flex: 1;
      overflow-y: auto;
      padding: 14px 16px;
      border-bottom: 1px solid var(--border);
    }

    .bericht-tekst {
      font-size: 13.5px;
      color: var(--text);
      line-height: 1.7;
      white-space: pre-wrap;
    }

    .vertaling-blok {
      margin-top: 12px;
      padding: 10px 12px;
      background: var(--blue-light);
      border: 1px solid var(--blue-border);
      border-radius: 7px;
    }

    .vertaling-label {
      font-size: 10.5px;
      font-weight: 600;
      color: var(--blue-text);
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 4px;
    }

    .vertaling-tekst {
      font-size: 13px;
      color: #1e3a8a;
      line-height: 1.6;
    }

    .divider {
      height: 1px;
      background: var(--border);
      margin: 10px 0;
    }

    .samenvatting-lijst {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .samenvatting-lijst li {
      font-size: 13px;
      color: var(--text);
      line-height: 1.5;
      padding-left: 14px;
      position: relative;
    }

    .samenvatting-lijst li::before {
      content: '';
      position: absolute;
      left: 0;
      top: 7px;
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--green-mid);
    }

    /* Instructie-sectie: vastzittend onderaan linkerkolom */
    .instructie-sectie {
      flex-shrink: 0;
      padding: 12px 16px;
      border-top: 1px solid var(--border);
      background: var(--surface);
    }

    textarea {
      width: 100%;
      font-family: 'Inter', -apple-system, sans-serif;
      font-size: 13px;
      color: var(--text);
      line-height: 1.6;
      border: 1.5px solid var(--border);
      border-radius: 7px;
      padding: 8px 10px;
      resize: none;
      background: var(--bg);
      transition: border-color 0.15s;
    }

    textarea:focus {
      outline: none;
      border-color: var(--green-mid);
      background: var(--surface);
    }

    #instructie { height: 62px; }

    .instructie-rij {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
    }

    /* ── Rechterkolom ── */
    .col-right {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: var(--bg);
    }

    .concept-header {
      padding: 12px 16px 10px;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
      background: var(--surface);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    #reply {
      flex: 1;
      border: none;
      border-radius: 0;
      padding: 14px 16px;
      background: var(--surface);
      font-size: 13.5px;
      line-height: 1.75;
      resize: none;
      height: 100%;
    }

    #reply:focus {
      border: none;
      background: var(--surface);
    }

    .actierij {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      border-top: 1px solid var(--border);
      background: var(--surface);
      flex-shrink: 0;
    }

    /* ── Knoppen ── */
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      font-weight: 500;
      border-radius: 7px;
      padding: 7px 13px;
      cursor: pointer;
      border: 1.5px solid transparent;
      transition: background 0.12s, opacity 0.12s;
      white-space: nowrap;
    }

    .btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .btn-aanpassen {
      background: var(--surface);
      border-color: var(--border);
      color: var(--text);
    }
    .btn-aanpassen:hover:not(:disabled) { background: var(--bg); }

    .btn-verstuur {
      background: var(--green-dark);
      color: #fff;
      padding: 9px 18px;
      font-size: 13.5px;
    }
    .btn-verstuur:hover:not(:disabled) { background: var(--green-mid); }

    .btn-sla {
      background: transparent;
      border-color: var(--border);
      color: var(--text-soft);
    }
    .btn-sla:hover:not(:disabled) { background: var(--bg); }

    .laden-tekst {
      display: none;
      font-size: 12px;
      color: var(--text-xsoft);
    }

    /* Concept vertaling */
    .concept-vertaling {
      padding: 10px 16px;
      background: var(--blue-light);
      border-top: 1px solid var(--blue-border);
      flex-shrink: 0;
    }
    .concept-vertaling-label {
      font-size: 10.5px;
      font-weight: 600;
      color: var(--blue-text);
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    .concept-vertaling-tekst {
      font-size: 13px;
      color: #1e3a8a;
      line-height: 1.65;
      white-space: pre-wrap;
    }
    .concept-vertaling-laden {
      font-size: 12px;
      color: var(--blue-text);
      opacity: 0.7;
    }

    /* Feedback */
    .feedback {
      display: none;
      padding: 8px 14px;
      border-radius: 7px;
      font-size: 13px;
      margin-left: auto;
    }
    .feedback-ok {
      background: var(--green-light);
      border: 1px solid var(--green-border);
      color: var(--green-dark);
      font-weight: 500;
    }
    .feedback-fout {
      background: var(--red-light);
      color: var(--red-text);
    }

    /* Spinner */
    .spinner {
      width: 13px; height: 13px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
      display: none;
    }
    .spinner-dark {
      border-color: rgba(0,0,0,0.15);
      border-top-color: var(--text);
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="app">

    <!-- Topbar -->
    <div class="topbar">
      <div class="topbar-left">
        <div class="topbar-ref">Ticket #${ticket.id}</div>
        <div class="topbar-subject">${ticket.subject}</div>
      </div>
      <div class="topbar-badge">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="rgba(255,255,255,0.7)"/>
        </svg>
        Concept door Claude
      </div>
    </div>

    <!-- Twee kolommen -->
    <div class="columns">

      <!-- Links: bericht + instructie -->
      <div class="col-left">

        <!-- Bericht (scrollt intern) -->
        <div class="bericht-sectie">
          <div class="section-label">Laatste bericht</div>
          <div class="bericht-tekst">${laatsteBericht.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
          ${toonVertaling ? `
          <div class="vertaling-blok">
            <div class="vertaling-label">Vertaling</div>
            <div class="vertaling-tekst">${vertaling.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</div>
          </div>` : ''}
          ${heeftMeerdereReacties && samenvattingHtml ? `
          <div class="divider"></div>
          <div class="section-label">Gespreksoverzicht</div>
          <ul class="samenvatting-lijst">${samenvattingHtml}</ul>
          ` : ''}
        </div>

        <!-- Instructie (vast onderaan) -->
        <div class="instructie-sectie">
          <div class="section-label">Instructie voor Claude</div>
          <textarea id="instructie" placeholder="Bijv: formeler, kortere reactie, voeg levertijd toe…"></textarea>
          <div class="instructie-rij">
            <button class="btn btn-aanpassen" onclick="aanpassen()" id="btn-aanpassen">
              <span id="spinner-aanpassen" class="spinner spinner-dark"></span>
              Pas concept aan
            </button>
            <span class="laden-tekst" id="laden">Claude past aan…</span>
          </div>
        </div>

      </div>

      <!-- Rechts: concept + verzendknop -->
      <div class="col-right">

        <div class="concept-header">
          <div class="section-label" style="margin:0">Concept antwoord</div>
        </div>

        <textarea id="reply" spellcheck="true">${conceptTekst}</textarea>

        ${toonVertaling ? `
        <div class="concept-vertaling" id="concept-vertaling-blok" ${conceptVertaling ? '' : 'style="display:none"'}>
          <div class="concept-vertaling-label">Vertaling concept (NL)</div>
          <div class="concept-vertaling-tekst" id="concept-vertaling-tekst">${conceptVertaling.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        </div>` : ''}

        <div class="actierij">
          <button class="btn btn-verstuur" onclick="verstuur()" id="btn-verstuur">
            <span id="spinner-verstuur" class="spinner"></span>
            Verstuur naar klant
          </button>
          <button class="btn btn-sla" onclick="sla()">Overslaan</button>
          <div class="feedback feedback-ok" id="success">Antwoord verstuurd.</div>
          <div class="feedback feedback-fout" id="error">Er ging iets mis. Probeer opnieuw.</div>
        </div>

      </div>

    </div>
  </div>

  <script>
    async function vertaalConcept(tekst) {
      const blok = document.getElementById('concept-vertaling-blok');
      const el = document.getElementById('concept-vertaling-tekst');
      if (!blok || !el) return;
      blok.style.display = 'block';
      el.textContent = 'Vertaling laden…';
      try {
        const res = await fetch('/vertaal-concept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tekst })
        });
        const data = await res.json();
        if (data.vertaling) {
          el.textContent = data.vertaling;
        } else {
          blok.style.display = 'none';
        }
      } catch(e) { blok.style.display = 'none'; }
    }

    async function aanpassen() {
      const instructie = document.getElementById('instructie').value.trim();
      const huidigAntwoord = document.getElementById('reply').value;
      if (!instructie) {
        document.getElementById('instructie').focus();
        return;
      }
      const btn = document.getElementById('btn-aanpassen');
      const spinner = document.getElementById('spinner-aanpassen');
      const laden = document.getElementById('laden');
      btn.disabled = true;
      spinner.style.display = 'inline-block';
      laden.style.display = 'inline';

      try {
        const res = await fetch('/aanpassen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticketId: '${ticketId}',
            huidigAntwoord: huidigAntwoord,
            instructie: instructie
          })
        });
        const data = await res.json();
        if (data.antwoord) {
          document.getElementById('reply').value = data.antwoord;
          document.getElementById('instructie').value = '';
          vertaalConcept(data.antwoord);
        }
      } catch(e) {}

      btn.disabled = false;
      spinner.style.display = 'none';
      laden.style.display = 'none';
    }

    async function verstuur() {
      const reply = document.getElementById('reply').value.trim();
      if (!reply) return;

      const btn = document.getElementById('btn-verstuur');
      const spinner = document.getElementById('spinner-verstuur');
      btn.disabled = true;
      spinner.style.display = 'inline-block';
      btn.childNodes[btn.childNodes.length - 1].textContent = ' Bezig…';

      const res = await fetch('/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: '${ticketId}', reply, agentId: '${agentId}' })
      });

      spinner.style.display = 'none';

      if (res.ok) {
        document.getElementById('success').style.display = 'block';
        document.querySelectorAll('.btn').forEach(b => b.disabled = true);
      } else {
        document.getElementById('error').style.display = 'block';
        btn.disabled = false;
        btn.childNodes[btn.childNodes.length - 1].textContent = ' Verstuur naar klant';
      }
    }

    function sla() {
      if (confirm('Dit ticket overslaan?')) {
        document.querySelectorAll('.btn').forEach(b => b.disabled = true);
      }
    }
  </script>
</body>
</html>`);
});

app.post('/vertaal-concept', async (req, res) => {
  const { tekst } = req.body;
  if (!tekst) return res.json({ vertaling: '' });
  const vertaling = await vertaalNaarNederlands(tekst);
  res.json({ vertaling: vertaling === 'NL' ? '' : vertaling });
});

app.post('/aanpassen', async (req, res) => {
  const { ticketId, huidigAntwoord, instructie } = req.body;

  const ticketResponse = await fetch(`https://${ZENDESK_SUBDOMAIN}.zendesk.com/api/v2/tickets/${ticketId}.json`, {
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${ZENDESK_EMAIL}/token:${ZENDESK_TOKEN}`).toString('base64')
    }
  });
  const ticketData = await ticketResponse.json();
  const ticket = ticketData.ticket;

  const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5-5',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Dit is het originele ticket:\nOnderwerp: ${ticket.subject}\n\n${ticket.description}\n\nDit is het huidige conceptantwoord:\n${huidigAntwoord}\n\nPas het antwoord aan op basis van deze instructie: ${instructie}\n\nGeef alleen het aangepaste antwoord terug, zonder uitleg.`
      }]
    })
  });

  const claudeData = await claudeResponse.json();
  const antwoord = claudeData.content[0].text;

  res.json({ antwoord });
});

app.post('/reply', async (req, res) => {
  const { ticketId, reply, agentId } = req.body;

  const commentBody = {
    body: reply,
    public: true
  };

  if (agentId) {
    commentBody.author_id = parseInt(agentId);
  }

  const zendeskResponse = await fetch(`https://${ZENDESK_SUBDOMAIN}.zendesk.com/api/v2/tickets/${ticketId}.json`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + Buffer.from(`${ZENDESK_EMAIL}/token:${ZENDESK_TOKEN}`).toString('base64')
    },
    body: JSON.stringify({
      ticket: {
        comment: commentBody,
        status: 'pending'
      }
    })
  });

  if (!zendeskResponse.ok) {
    return res.sendStatus(500);
  }

  const ticketResponse = await fetch(`https://${ZENDESK_SUBDOMAIN}.zendesk.com/api/v2/tickets/${ticketId}.json`, {
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${ZENDESK_EMAIL}/token:${ZENDESK_TOKEN}`).toString('base64')
    }
  });

  const ticketData = await ticketResponse.json();
  const ticket = ticketData.ticket;

  const openaiResponse = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: ('Onderwerp: ' + (ticket.subject || '') + ' ' + (ticket.description || '')).slice(0, 8000)
    })
  });

  const openaiData = await openaiResponse.json();
  const embedding = openaiData.data[0].embedding;

  await fetch(`${process.env.SUPABASE_URL}/tickets`, {
    method: 'POST',
    headers: {
      'apikey': process.env.SUPABASE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      zendesk_id: String(ticketId),
      subject: ticket.subject || '',
      vraag: (ticket.description || '').slice(0, 1000),
      antwoord: reply.slice(0, 1000),
      embedding: embedding
    })
  });

  res.sendStatus(200);
});

app.listen(process.env.PORT || 3000, () => {
  console.log('Server draait!');
});
