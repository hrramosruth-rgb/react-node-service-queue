import React, {useCallback, useEffect, useRef, useState} from 'react';

async function api(path, options = {}) {
  const response = await fetch('/api' + path, {...options, headers: {'Content-Type': 'application/json'}});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'The queue could not be updated.');
  return data;
}

export default function App() {
  const [tickets, setTickets] = useState([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('active');
  const pending = useRef(false);
  const generation = useRef(0);
  const refresh = useCallback(async (signal) => {
    const current = ++generation.current;
    try {
      const data = await api('/tickets', {signal});
      if (current === generation.current && !signal?.aborted) { setTickets(data); setError(''); }
    } catch (failure) {
      if (failure.name !== 'AbortError' && current === generation.current) setError('Queue unavailable. Start the API server, then retry.');
    } finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    refresh(controller.signal);
    const interval = setInterval(() => refresh(controller.signal), 5000);
    return () => {controller.abort(); clearInterval(interval);};
  }, [refresh]);

  async function mutate(path, payload, method, message) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const ticket = await api(path, {method, body: JSON.stringify(payload)});
      if (method === 'POST') setName('');
      setNotice(message + ' ' + ticket.ticket);
      await refresh();
    } catch (failure) {setError(failure.message || 'Could not connect to the queue.');}
    finally {pending.current = false; setBusy(false);}
  }
  const waiting = tickets.filter(ticket => ticket.status === 'waiting');
  const serving = tickets.find(ticket => ticket.status === 'serving');
  const finished = tickets.filter(ticket => ['completed', 'cancelled'].includes(ticket.status));
  const visible = view === 'active' ? tickets.filter(ticket => ['waiting', 'serving'].includes(ticket.status)) : finished;

  return <div className="shell">
    <aside><a className="brand" href="#main"><span className="brand-mark">d.</span> desk</a><p className="workspace-label">SERVICE WORKSPACE</p><div className="nav-item">◫ &nbsp; Queue overview</div><div className="aside-note"><span className="live-dot" /> One desk. A calmer day.<p>A local service queue demonstration.</p></div></aside>
    <main id="main">
      <header><span className="eyebrow">RECEPTION / LIVE QUEUE</span><span className="demo-badge">LOCAL DEMO</span></header>
      <div className="page-heading"><div><h1>Make room for<br />a better welcome.</h1><p>Check people in, call the next ticket, and keep the day moving.</p></div><div className="date-card"><span>Service desk</span><strong>{serving ? 'In service' : 'Ready for the next'}</strong><span>Queue refreshes every 5 seconds</span></div></div>
      <section className="metrics" aria-label="Queue summary"><div><span>Waiting</span><strong>{waiting.length.toString().padStart(2, '0')}</strong><small>in the queue</small></div><div><span>Now serving</span><strong>{serving?.ticket || '—'}</strong><small>{serving?.name || 'Desk is available'}</small></div><div><span>Completed</span><strong>{tickets.filter(ticket => ticket.status === 'completed').length.toString().padStart(2, '0')}</strong><small>this demo session</small></div></section>
      <section className="check-in"><div><span className="eyebrow">A WARM WELCOME</span><h2>Check someone in</h2></div><form onSubmit={event => {event.preventDefault(); mutate('/tickets', {name}, 'POST', 'Checked in');}}><label className="sr-only" htmlFor="guest-name">Guest name</label><input id="guest-name" value={name} onChange={event => setName(event.target.value)} placeholder="Guest’s name" required maxLength={60} disabled={busy} autoComplete="off" /><button disabled={busy || !name.trim()}>{busy ? 'Saving…' : 'Create ticket +'} </button></form></section>
      {error && <div className="error" role="alert">{error} <button className="text-button" onClick={() => refresh()}>Retry</button></div>}
      {notice && <p className="notice" role="status">{notice}</p>}
      <section className="queue-section"><div className="section-heading"><h2>Your queue</h2><div className="tabs" role="group" aria-label="Queue view"><button aria-pressed={view === 'active'} onClick={() => setView('active')}>Active {waiting.length + Number(Boolean(serving))}</button><button aria-pressed={view === 'history'} onClick={() => setView('history')}>History {finished.length}</button></div></div>
        {loading ? <p role="status">Loading the queue…</p> : visible.length === 0 ? <div className="empty"><span>↗</span><h3>{view === 'active' ? 'Your desk is ready.' : 'A fresh start.'}</h3><p>{view === 'active' ? 'Check in your first guest to begin the queue.' : 'Completed and cancelled tickets will appear here.'}</p></div> : <div className="ticket-list">{visible.map(ticket => <article className={'ticket ' + ticket.status} key={ticket.id}><span className="ticket-number">{ticket.ticket}</span><div className="ticket-info"><h3>{ticket.name}</h3><span>Checked in {new Date(ticket.createdAt).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</span></div><span className={'status ' + ticket.status}>{ticket.status}</span><div className="ticket-actions">{ticket.status === 'waiting' && <button disabled={busy || Boolean(serving)} onClick={() => mutate('/tickets/' + ticket.id, {status: 'serving'}, 'PATCH', 'Now serving')}>Call next ↗</button>}{ticket.status === 'serving' && <button disabled={busy} onClick={() => mutate('/tickets/' + ticket.id, {status: 'completed'}, 'PATCH', 'Completed')}>Complete ✓</button>}{['waiting', 'serving'].includes(ticket.status) && <button className="text-button" disabled={busy} onClick={() => mutate('/tickets/' + ticket.id, {status: 'cancelled'}, 'PATCH', 'Cancelled')}>Cancel</button>}</div></article>)}</div>}
      </section><footer>Built for a thoughtful first impression. <span>React + Node.js portfolio demo</span></footer>
    </main>
  </div>;
}
