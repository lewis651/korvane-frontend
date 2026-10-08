import { useEffect, useState } from 'react';
import { apiRequest } from './api.js';
import { ChatConversation } from './ChatWidget.jsx';

const statuses = ['Processing', 'In Transit', 'At Customs', 'Out for Delivery', 'Delayed', 'Delivered'];
const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-sky-500';
const buttonClass = 'rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60';

function AdminLogin({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await apiRequest('/api/admin/login', {
        method: 'POST',
        body: { username, password },
      });
      onLogin(result.token, result.admin);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-lg px-5 py-16 md:py-24">
      <div className="rounded-3xl bg-white p-7 shadow-xl ring-1 ring-slate-200 md:p-10">
        <p className="text-sm font-semibold uppercase tracking-widest text-sky-700">Korvane operations</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Admin sign in</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Sign in with the administrator account configured for this logistics system.</p>
        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Username
            <input autoComplete="username" required maxLength="100" value={username} onChange={e => setUsername(e.target.value)} className={`${inputClass} mt-1.5`} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Password
            <input autoComplete="current-password" required type="password" value={password} onChange={e => setPassword(e.target.value)} className={`${inputClass} mt-1.5`} />
          </label>
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          <button disabled={busy} className={`${buttonClass} w-full bg-sky-700 hover:bg-sky-800`}>{busy ? 'Signing in…' : 'Sign in securely'}</button>
        </form>
      </div>
    </section>
  );
}

function NewShipmentForm({ token, onCreated }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const body = Object.fromEntries(fields.entries());
    body.total_hours = Number(body.total_hours);
    setBusy(true);
    setError('');
    try {
      await apiRequest('/api/shipments', { method: 'POST', body, token });
      form.reset();
      onCreated('Shipment created.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 md:p-6">
      <h2 className="text-xl font-bold text-slate-900">Create new shipment</h2>
      <p className="mt-1 text-sm text-slate-600">Enter sender and receiver details. Their addresses are used to place the route pins on the tracking map.</p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">Tracking number
          <input required name="tracking_number" maxLength="50" placeholder="e.g. KV-10482" className={`${inputClass} mt-1.5`} />
        </label>
        <label className="text-sm font-medium text-slate-700">Transit duration (hours)
          <input required name="total_hours" type="number" min="0.1" max="8760" step="any" placeholder="Estimated transit time" className={`${inputClass} mt-1.5`} />
        </label>

        <div className="rounded-xl bg-sky-50 p-4 md:col-span-2">
          <h3 className="font-semibold text-slate-900">Sender</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">Sender name
              <input required name="sender_name" maxLength="255" className={`${inputClass} mt-1.5`} />
            </label>
            <label className="text-sm font-medium text-slate-700">Origin location
              <input required name="start_location" maxLength="255" placeholder="City, port, or facility" className={`${inputClass} mt-1.5`} />
            </label>
            <label className="text-sm font-medium text-slate-700 md:col-span-2">Sender address
              <input required name="sender_address" maxLength="1000" autoComplete="street-address" placeholder="Full street address, city, country" className={`${inputClass} mt-1.5`} />
            </label>
          </div>
        </div>

        <div className="rounded-xl bg-amber-50 p-4 md:col-span-2">
          <h3 className="font-semibold text-slate-900">Receiver</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">Receiver name
              <input required name="receiver_name" maxLength="255" className={`${inputClass} mt-1.5`} />
            </label>
            <label className="text-sm font-medium text-slate-700">Destination location
              <input required name="end_location" maxLength="255" placeholder="City, port, or facility" className={`${inputClass} mt-1.5`} />
            </label>
            <label className="text-sm font-medium text-slate-700 md:col-span-2">Receiver address
              <input required name="receiver_address" maxLength="1000" autoComplete="street-address" placeholder="Full street address, city, country" className={`${inputClass} mt-1.5`} />
            </label>
          </div>
        </div>

        <label className="text-sm font-medium text-slate-700">Weight
          <input required name="weight" maxLength="50" placeholder="e.g. 250 kg" className={`${inputClass} mt-1.5`} />
        </label>
        <label className="text-sm font-medium text-slate-700">Package type
          <select required name="package_type" defaultValue="" className={`${inputClass} mt-1.5`}>
            <option value="" disabled>Select package type</option>
            {['FCL Container', 'LCL Container', 'Air Cargo', 'Pallet', 'Crate', 'Parcel', 'Bulk Cargo'].map(type => <option key={type}>{type}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700 md:col-span-2">Description / notes
          <textarea name="description" maxLength="5000" rows="3" placeholder="Cargo description or handling instructions (optional)" className={`${inputClass} mt-1.5`} />
        </label>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex justify-end gap-3">
        <button type="button" disabled={busy} onClick={event => { event.currentTarget.form.reset(); setError(''); }} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">Cancel</button>
        <button disabled={busy} className={`${buttonClass} bg-sky-700 hover:bg-sky-800`}>{busy ? 'Creating…' : 'Create shipment'}</button>
      </div>
    </form>
  );
}

function AdminDashboard({ token, admin, onLogout }) {
  const [shipments, setShipments] = useState([]);
  const [messages, setMessages] = useState([]);
  const [chatSessions, setChatSessions] = useState([]);
  const [selectedChat, setSelectedChat] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest('/api/shipments', { token }),
      apiRequest('/api/contact', { token }),
    ]).then(([shipmentRows, contactRows]) => {
      if (!active) return;
      setShipments(shipmentRows);
      setMessages(contactRows);
      setError('');
    }).catch(requestError => {
      if (!active) return;
      setError(requestError.message);
      if (requestError.message.includes('authentication token') || requestError.message.includes('Unauthorized')) {
        onLogout();
      }
    });
    return () => { active = false; };
  }, [token, revision, onLogout]);

  useEffect(() => {
    let active = true;
    const refreshChats = async () => {
      try {
        const chatRows = await apiRequest('/api/chats', { token });
        if (active) setChatSessions(chatRows);
      } catch (requestError) {
        if (!active) return;
        setError(requestError.message);
        if (requestError.message.includes('authentication token') || requestError.message.includes('Unauthorized')) onLogout();
      }
    };
    refreshChats();
    const timer = window.setInterval(refreshChats, 10000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [token, onLogout]);

  async function updateShipment(trackingNumber, update) {
    setBusyId(trackingNumber);
    setError('');
    setNotice('');
    try {
      await apiRequest(`/api/shipments/${encodeURIComponent(trackingNumber)}`, {
        method: 'PUT',
        token,
        body: update,
      });
      setNotice(`Shipment ${trackingNumber} updated.`);
      setRevision(value => value + 1);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId('');
    }
  }

  async function deleteShipment(trackingNumber) {
    if (!window.confirm(`Delete shipment ${trackingNumber}? This cannot be undone.`)) return;
    setBusyId(trackingNumber);
    setError('');
    setNotice('');
    try {
      await apiRequest(`/api/shipments/${encodeURIComponent(trackingNumber)}`, { method: 'DELETE', token });
      setNotice(`Shipment ${trackingNumber} deleted.`);
      setRevision(value => value + 1);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId('');
    }
  }

  return (
    <section className="mx-auto max-w-7xl space-y-8 px-5 py-10 md:px-10">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-slate-900 p-6 text-white">
        <div>
          <p className="text-sm text-sky-200">Korvane operations portal</p>
          <h1 className="mt-1 text-3xl font-bold">Welcome, {admin.username}</h1>
          <p className="mt-2 text-sm text-slate-300">Manage shipments, delivery status and customer enquiries.</p>
        </div>
        <button onClick={onLogout} className="rounded-lg border border-white/30 px-4 py-2 text-sm font-semibold hover:bg-white/10">Sign out</button>
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}

      <NewShipmentForm token={token} onCreated={message => { setNotice(message); setRevision(value => value + 1); }} />

      <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-5">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Shipments</h2>
            <p className="mt-1 text-sm text-slate-600">{shipments.length} shipment{shipments.length === 1 ? '' : 's'} in the system.</p>
          </div>
          <button onClick={() => setRevision(value => value + 1)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50">Refresh</button>
        </div>
        {shipments.length === 0 ? <p className="p-6 text-sm text-slate-600">No shipments yet. Create one above to make it available for tracking.</p> : (
          <>
          <div className="divide-y divide-slate-100 md:hidden">
            {shipments.map(shipment => (
              <article key={shipment.tracking_number} className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <strong className="break-all text-slate-900">{shipment.tracking_number}</strong>
                    <p className="mt-1 break-words text-xs text-slate-600">{shipment.start_location} → {shipment.end_location}</p>
                  </div>
                  <span className="text-xs text-slate-500">{new Date(shipment.created_at).toLocaleDateString()}</span>
                </div>
                <label className="block text-xs font-medium text-slate-600">Shipment status
                  <select value={shipment.status} onChange={e => updateShipment(shipment.tracking_number, { status: e.target.value })} aria-label={`Status for ${shipment.tracking_number}`} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900">
                    {statuses.map(status => <option key={status}>{status}</option>)}
                  </select>
                </label>
                <p className="text-xs text-slate-600">{shipment.is_paused ? 'Progress paused' : 'Progress running'}{shipment.expected_delivery && ` · ETA ${new Date(shipment.expected_delivery).toLocaleString()}`}</p>
                <div className="flex flex-wrap gap-2">
                  <button disabled={busyId === shipment.tracking_number || shipment.status === 'Delivered'} onClick={() => updateShipment(shipment.tracking_number, { is_paused: !shipment.is_paused })} className="min-h-10 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-50">{shipment.is_paused ? 'Resume' : 'Pause'}</button>
                  <button disabled={busyId === shipment.tracking_number} onClick={() => deleteShipment(shipment.tracking_number)} className="min-h-10 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Delete</button>
                </div>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>{['Tracking / route','Created','Status','Progress controls','Actions'].map(label => <th key={label} className="px-4 py-3">{label}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shipments.map(shipment => (
                  <tr key={shipment.tracking_number}>
                    <td className="px-4 py-4">
                      <strong className="text-slate-900">{shipment.tracking_number}</strong>
                      <p className="mt-1 text-xs text-slate-600">{shipment.start_location} → {shipment.end_location}</p>
                    </td>
                    <td className="px-4 py-4 text-slate-600">{new Date(shipment.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-4">
                      <select value={shipment.status} onChange={e => updateShipment(shipment.tracking_number, { status: e.target.value })} aria-label={`Status for ${shipment.tracking_number}`} className="rounded-lg border border-slate-300 bg-white px-2 py-2">
                        {statuses.map(status => <option key={status}>{status}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-4 text-slate-600">{shipment.is_paused ? 'Paused' : 'Running'}{shipment.expected_delivery && <p className="mt-1 text-xs">ETA {new Date(shipment.expected_delivery).toLocaleString()}</p>}</td>
                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        <button disabled={busyId === shipment.tracking_number || shipment.status === 'Delivered'} onClick={() => updateShipment(shipment.tracking_number, { is_paused: !shipment.is_paused })} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-50">{shipment.is_paused ? 'Resume' : 'Pause'}</button>
                        <button disabled={busyId === shipment.tracking_number} onClick={() => deleteShipment(shipment.tracking_number)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-xl font-bold text-slate-900">Live support chats</h2>
          <p className="mt-1 text-sm text-slate-600">Open a shipment conversation to read and reply to customer messages. This list refreshes every 10 seconds.</p>
        </div>
        {chatSessions.length === 0 ? <p className="p-6 text-sm text-slate-600">No live chat conversations yet.</p> : (
          <ul className="divide-y divide-slate-100">
            {chatSessions.map(chat => (
              <li key={chat.tracking_number} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div><strong className="text-slate-900">{chat.tracking_number}</strong><p className="mt-1 text-xs text-slate-500">Latest message {new Date(chat.last_msg).toLocaleString()}</p></div>
                <button type="button" onClick={() => setSelectedChat(current => current === chat.tracking_number ? '' : chat.tracking_number)} className="rounded-lg border border-sky-200 px-3 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-50">{selectedChat === chat.tracking_number ? 'Close chat' : 'Open chat'}</button>
              </li>
            ))}
          </ul>
        )}
        {selectedChat && <div className="border-t border-slate-200 p-4"><ChatConversation key={selectedChat} trackingNumber={selectedChat} isAdmin token={token}/></div>}
      </section>

      <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-xl font-bold text-slate-900">Customer enquiries</h2>
          <p className="mt-1 text-sm text-slate-600">{messages.length} message{messages.length === 1 ? '' : 's'} submitted through the contact form.</p>
        </div>
        {messages.length === 0 ? <p className="p-6 text-sm text-slate-600">No enquiries yet.</p> : (
          <ul className="divide-y divide-slate-100">
            {messages.map(message => (
              <li key={message.id} className="p-5">
                <div className="flex flex-wrap justify-between gap-2">
                  <strong className="text-slate-900">{message.name}</strong>
                  <time className="text-xs text-slate-500">{new Date(message.created_at).toLocaleString()}</time>
                </div>
                <p className="mt-1 text-sm text-sky-800">{message.email}{message.phone ? ` · ${message.phone}` : ''}</p>
                {message.subject && <p className="mt-2 text-sm font-semibold text-slate-800">{message.subject}</p>}
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{message.message}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

export default function AdminPortal() {
  const [token, setToken] = useState(() => sessionStorage.getItem('korvane_admin_token') || '');
  const [admin, setAdmin] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('korvane_admin') || 'null');
    } catch {
      return null;
    }
  });

  function login(nextToken, nextAdmin) {
    sessionStorage.setItem('korvane_admin_token', nextToken);
    sessionStorage.setItem('korvane_admin', JSON.stringify(nextAdmin));
    setToken(nextToken);
    setAdmin(nextAdmin);
  }

  function logout() {
    sessionStorage.removeItem('korvane_admin_token');
    sessionStorage.removeItem('korvane_admin');
    setToken('');
    setAdmin(null);
  }

  if (!token || !admin) return <AdminLogin onLogin={login} />;
  return <AdminDashboard token={token} admin={admin} onLogout={logout} />;
}
