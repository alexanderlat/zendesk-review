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
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: 'Detecteer de taal van onderstaande tekst. Als de taal Nederlands is, antwoord dan alleen met het woord "NL". Als de taal niet Nederlands is, vertaal de tekst dan naar Nederlands en geef alleen de vertaling terug, zonder uitleg of toevoeging.\n\nTekst:\n' + tekst
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
      model: 'claude-sonnet-4-6',
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
  const heeftMeerdereReacties = publiciekeComments.length > 1;
  const laatsteBericht = publiciekeComments.length > 0 ? publiciekeComments[publiciekeComments.length - 1].body || '' : ticket.description || '';

  const vertaling = await vertaalNaarNederlands(laatsteBericht);
  const toonVertaling = vertaling !== 'NL';

  const samenvatting = heeftMeerdereReacties ? await maakSamenvatting(publiciekeComments) : '';
  const samenvattingHtml = samenvatting.split('\n').filter(r => r.trim()).map(r => `<li>${r.replace(/^- /, '')}</li>`).join('');

  const conceptTekst = decodeURIComponent(req.query.concept || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '');

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
      --bg: #FAFAF8;
      --surface: #FFFFFF;
      --border: #E8E8E4;
      --text: #1A1A18;
      --text-soft: #6B6B65;
      --text-xsoft: #9E9E96;
      --blue-light: #EEF3FF;
      --blue-border: #C5D4F5;
      --blue-text: #2B4EAB;
      --red-light: #FEF2F2;
      --red-text: #991B1B;
    }

    html { font-size: 14px; }

    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      min-height: 100vh;
    }

    .layout {
      max-width: 680px;
      margin: 0 auto;
      padding: 1.75rem 1.25rem 3rem;
    }

    /* Header */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.5rem;
    }

    .ticket-ref {
      font-size: 12px;
      font-weight: 500;
      color: var(--text-xsoft);
      letter-spacing: 0.02em;
    }

    .ticket-subject {
      font-size: 17px;
      font-weight: 600;
      color: var(--text);
      margin-top: 2px;
    }

    .claude-badge {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      font-weight: 500;
      color: var(--text-soft);
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 4px 10px;
      white-space: nowrap;
    }

    .claude-badge svg { flex-shrink: 0; }

    /* Cards */
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1.125rem 1.25rem;
      margin-bottom: 0.875rem;
    }

    .card-label {
      font-size: 11px;
      font-weight: 500;
      color: var(--text-xsoft);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 0.5rem;
    }

    .bericht-tekst {
      font-size: 13.5px;
      color: var(--text);
      line-height: 1.65;
      white-space: pre-wrap;
    }

    .vertaling-blok {
      margin-top: 0.875rem;
      padding: 0.75rem 1rem;
      background: var(--blue-light);
      border: 1px solid var(--blue-border);
      border-radius: 7px;
    }

    .vertaling-label {
      font-size: 11px;
      font-weight: 500;
      color: var(--blue-text);
      margin-bottom: 4px;
    }

    .vertaling-tekst {
      font-size: 13px;
      color: #1e3a8a;
      line-height: 1.6;
      font-style: italic;
    }

    .samenvatting-lijst {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .samenvatting-lijst li {
      font-size: 13.5px;
      color: var(--text);
      line-height: 1.55;
      padding-left: 1rem;
      position: relative;
    }

    .samenvatting-lijst li::before {
      content: '';
      position: absolute;
      left: 0;
      top: 8px;
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--green-mid);
    }

    /* Divider */
    .divider {
      height: 1px;
      background: var(--border);
      margin: 0.875rem 0;
    }

    /* Werkzone */
    .werkzone {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
      margin-bottom: 0.875rem;
    }

    .werkzone-sectie {
      padding: 1rem 1.25rem;
    }

    .werkzone-sectie + .werkzone-sectie {
      border-top: 1px solid var(--border);
    }

    .werkzone-label {
      font-size: 11px;
      font-weight: 500;
      color: var(--text-xsoft);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 0.625rem;
    }

    textarea {
      width: 100%;
      font-family: 'Inter', -apple-system, sans-serif;
      font-size: 13.5px;
      color: var(--text);
      line-height: 1.65;
      border: 1.5px solid var(--border);
      border-radius: 7px;
      padding: 0.75rem 0.875rem;
      resize: vertical;
      background: var(--bg);
      transition: border-color 0.15s;
    }

    textarea:focus {
      outline: none;
      border-color: var(--green-mid);
      background: var(--surface);
    }

    #instructie {
      min-height: 68px;
    }

    #reply {
      min-height: 220px;
    }

    .instructie-rij {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 0.625rem;
    }

    /* Knoppen */
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      font-weight: 500;
      border-radius: 7px;
      padding: 8px 14px;
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
      padding: 10px 20px;
      font-size: 14px;
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

    /* Actierij */
    .actierij {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* Feedback */
    .feedback {
      display: none;
      padding: 12px 14px;
      border-radius: 8px;
      font-size: 13px;
      margin-top: 0.75rem;
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
      width: 13px;
      height: 13px;
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

    @media (max-width: 480px) {
      .header { flex-direction: column; align-items: flex-start; gap: 8px; }
      .actierij { flex-direction: column; align-items: stretch; }
      .btn-verstuur { justify-content: center; }
    }
  </style>
</head>
<body>
  <div class="layout">

    <div class="header">
      <div>
        <div class="ticket-ref">Ticket #${ticket.id}</div>
        <div class="ticket-subject">${ticket.subject}</div>
      </div>
      <div class="claude-badge">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="#6B6B65"/>
        </svg>
        Concept door Claude
      </div>
    </div>

    <!-- Ticket info -->
    <div class="card">
      <div class="card-label">Laatste bericht</div>
      <div class="bericht-tekst">${laatsteBericht.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
      ${toonVertaling ? `
      <div class="vertaling-blok">
        <div class="vertaling-label">Vertaling</div>
        <div class="vertaling-tekst">${vertaling.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
      </div>` : ''}
      ${heeftMeerdereReacties && samenvattingHtml ? `
      <div class="divider"></div>
      <div class="card-label">Gespreksoverzicht</div>
      <ul class="samenvatting-lijst">${samenvattingHtml}</ul>
      ` : ''}
    </div>

    <!-- Werkzone -->
    <div class="werkzone">

      <!-- Instructies -->
      <div class="werkzone-sectie">
        <div class="werkzone-label">Instructies voor Claude</div>
        <textarea id="instructie" placeholder="Bijv: schrijf formeler, voeg levertijd toe, kortere reactie…"></textarea>
        <div class="instructie-rij">
          <button class="btn btn-aanpassen" onclick="aanpassen()" id="btn-aanpassen">
            <span id="spinner-aanpassen" class="spinner spinner-dark"></span>
            Pas concept aan
          </button>
          <span class="laden-tekst" id="laden">Claude past aan…</span>
        </div>
      </div>

      <!-- Concept -->
      <div class="werkzone-sectie">
        <div class="werkzone-label">Concept antwoord</div>
        <textarea id="reply">${conceptTekst}</textarea>
      </div>

    </div>

    <!-- Acties -->
    <div class="actierij">
      <button class="btn btn-verstuur" onclick="verstuur()" id="btn-verstuur">
        <span id="spinner-verstuur" class="spinner"></span>
        Verstuur naar klant
      </button>
      <button class="btn btn-sla" onclick="sla()">Overslaan</button>
    </div>

    <div class="feedback feedback-ok" id="success">
      Antwoord verstuurd naar de klant.
    </div>
    <div class="feedback feedback-fout" id="error">
      Er ging iets mis. Probeer het opnieuw.
    </div>

  </div>

  <script>
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
      model: 'claude-sonnet-4-6',
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
