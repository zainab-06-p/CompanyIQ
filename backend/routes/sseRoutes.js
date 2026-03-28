import express from 'express';
export const router = express.Router();

let clients = [];

export function sendAgentEvent(companyId, agent, msg) {
  const eventString = `data: ${JSON.stringify({ agent, msg, time: new Date().toLocaleTimeString() })}\n\n`;
  clients.forEach(client => {
    if(client.companyId === companyId) client.res.write(eventString);
  });
}

router.get('/stream/:companyId', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  const client = { id: Date.now(), companyId: req.params.companyId, res };
  clients.push(client);

  req.on('close', () => {
    clients = clients.filter(c => c.id !== client.id);
  });
});
