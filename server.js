const express = require('express');
const fetch = require('node-fetch');
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const ZENDESK_SUBDOMAIN = process.env.ZENDESK_SUBDOMAIN;
const ZENDESK_EMAIL = process.env.ZENDESK_EMAIL;
const ZENDESK_TOKEN = process.env.ZENDESK_TOKEN;

app.get('/ticket/:id', async (req, res) => {
  const ticketId = req.params.id;
  
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

  res.send(`<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ticket review #${ticketId}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; color: #111; padding: 2rem; }
    .container { max-width: 700px; margin: 0 auto; }
    h1 { font-size: 20px; font-weight: 600; margin-bottom: 1.5rem; }
    .card { background: white; border-radius: 10px; border: 1px solid #e5e5e5; padding: 1.25rem; margin-bottom: 1rem; }
    .label { font-size: 12px; color: #888; margin-bottom: 4px; }
    .subject { font-size: 15px; font-weight: 600; margin-bottom: 0.75rem; }
    .body { font-size: 14px; color: #444; line-height: 1.6; }
    .badge { display: inline-block; font-size: 11px; background: #e8f0fe; color: #1a56db; border-radius: 20px; padding: 2px 10px; margin-bottom: 8px; }
    textarea { width: 100%; border: 1px solid #ddd; border-radius: 8px; padding: 12px; font-size: 14px; font-family: inherit; resize: vertical; min-height: 160px; line-height: 1.6; }
    textarea:focus { outline: none; border-color: #888; }
    .actions { display: flex; gap: 10px; margin-top: 1rem; }
    button { padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; border: 1px solid #ddd; background: white; }
    .btn-primary { background: #111; color: white; border-color: transparent; }
    .btn-danger { color: #c0392b; }
    .success { display: none; margin-top: 1rem; padding: 12px; background: #f0fdf4; border-radius: 8px; color: #166534; font-size: 14px; }
    .error { display: none; margin-top: 1rem; padding: 12px; background: #fef2f2; border-radius: 8px; color: #991b1b; font-size: 14px; }
    .meta { display: flex; gap: 1.5rem; margin-bottom: 1rem; }
    .meta-item { font-size: 12px; color: #888; }
    .meta-item span { color: #111; font-weight: 500; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Ticket review</h1>

    <div class="card">
      <div class="meta">
        <div class="meta-item">Ticket <span>#${ticket.id}</span></div>
        <div class="meta-item">Van <span>${ticket.requester_id}</span></div>
      </div>
      <div class="label">Onderwerp</div>
      <div class="subject">${ticket.subject}</div>
      <hr style="border: none; border-top: 1px solid #f0f0f0; margin: 0.75rem 0;">
      <div class="label">Bericht van klant</div>
      <div class="body">${ticket.description}</div>
    </div>

    <div class="badge">Gegenereerd door Claude</div>
  <textarea id="reply">${decodeURIComponent(req.query.concept || '').replace(/<[^>]*>/g, '')}</textarea>

    <div class="actions">
      <button class="btn-primary" onclick="verstuur()">Goedkeuren & versturen</button>
      <button onclick="sla()">Overslaan</button>
    </div>
    <div class="success" id="success">Antwoord verstuurd naar de klant!</div>
    <div class="error" id="error">Er ging iets mis. Probeer het opnieuw.</div>
  </div>

  <script>
    async function verstuur() {
      const reply = document.getElementById('reply').value;
      const res = await fetch('/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: '${ticketId}', reply })
      });
      if (res.ok) {
        document.getElementById('success').style.display = 'block';
        document.querySelectorAll('button').forEach(b => b.disabled = true);
      } else {
        document.getElementById('error').style.display = 'block';
      }
    }
    function sla() {
      if (confirm('Weet je zeker dat je dit ticket wilt overslaan?')) {
        document.querySelectorAll('button').forEach(b => b.disabled = true);
      }
    }
  </script>
</body>
</html>`);
});

app.post('/reply', async (req, res) => {
  const { ticketId, reply } = req.body;

  const response = await fetch(`https://${ZENDESK_SUBDOMAIN}.zendesk.com/api/v2/tickets/${ticketId}.json`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + Buffer.from(`${ZENDESK_EMAIL}/token:${ZENDESK_TOKEN}`).toString('base64')
    },
    body: JSON.stringify({
      ticket: {
        comment: { body: reply, public: true },
        status: 'pending'
      }
    })
  });

  if (response.ok) {
    res.sendStatus(200);
  } else {
    res.sendStatus(500);
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log('Server draait!');
});
