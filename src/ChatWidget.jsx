import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import './ChatWidget.css';

const apiOrigin = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const whatsappNumber = (import.meta.env.VITE_WHATSAPP_NUMBER || '12025550123').replace(/\D/g, '');
const assistantQuestions = [
  ['How do I track my shipment?', 'Enter your tracking number on the tracking page. You can see its latest status, estimated progress, route and arrival time.'],
  ['What services do you offer?', 'Korvane coordinates road, sea and air freight, warehousing, fulfilment, customs brokerage and last-mile delivery.'],
  ['How long does delivery take?', 'Transit time depends on route, service and customs. Air freight often takes 3–7 days and sea freight 18–40 days; your shipment estimate is shown in tracking.'],
  ['Can I pause or change a shipment?', 'Please message our operations team here with your tracking number and what needs to change. The team can review the shipment and advise on the next steps.'],
  ['How do I contact support?', 'You can chat with our live support team using the Live chat option or send us a message on WhatsApp.'],
];

export function ChatConversation({ trackingNumber, isAdmin = false, token, onBack }) {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('Connecting…');
  const [error, setError] = useState('');
  const listRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    const connection = io(apiOrigin || undefined, {
      auth: token ? { token } : {},
      timeout: 10000,
    });
    socketRef.current = connection;
    connection.on('connect', () => {
      setStatus('Loading conversation…');
      connection.emit('join_chat', { tracking_number: trackingNumber, isAdmin });
    });
    connection.on('connect_error', connectError => {
      setStatus('Connection unavailable');
      setError(connectError.message || 'Could not connect to live chat.');
    });
    connection.on('chat_history', history => {
      setMessages(history);
      setStatus('Connected');
      setError('');
    });
    connection.on('receive_message', nextMessage => {
      setMessages(current => current.some(item => item.id === nextMessage.id) ? current : [...current, nextMessage]);
    });
    connection.on('chat_error', chatError => {
      setStatus('Unable to open chat');
      setError(chatError.message || 'Unable to open this chat.');
    });
    connection.on('chat_send_error', chatError => {
      setError(chatError.message || 'Message could not be sent. Please try again.');
    });
    return () => {
      socketRef.current = null;
      connection.disconnect();
    };
  }, [trackingNumber, isAdmin, token]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  function send(event) {
    event.preventDefault();
    const text = message.trim();
    if (!text || !socketRef.current?.connected || status !== 'Connected') return;
    setError('');
    socketRef.current.emit('send_message', { tracking_number: trackingNumber, message: text });
    setMessage('');
  }

  return (
    <div className="chat-widget-view">
      <div className="chat-widget-subhead">
        {onBack && <button type="button" onClick={onBack} aria-label="Back to support options">←</button>}
        <div><strong>{isAdmin ? trackingNumber : 'Live support'}</strong><span>{status}</span></div>
      </div>
      {error && <p className="chat-widget-error" role="alert">{error}</p>}
      <div className="chat-widget-messages" ref={listRef} aria-live="polite">
        {messages.map(item => (
          <div key={item.id} className={`chat-widget-bubble ${item.sender === (isAdmin ? 'admin' : 'user') ? 'mine' : ''}`}>
            <span>{item.sender === 'admin' ? 'Korvane support' : item.sender === 'user' ? 'You' : item.sender}</span>
            <p>{item.message}</p>
            <time>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
          </div>
        ))}
        {status === 'Connected' && messages.length === 0 && <p className="chat-widget-empty">You’re connected. Send a message to start the conversation.</p>}
      </div>
      <form className="chat-widget-compose" onSubmit={send}>
        <input value={message} onChange={event => setMessage(event.target.value)} aria-label="Chat message" maxLength={2000} placeholder="Write a message…" disabled={status !== 'Connected'} />
        <button type="submit" disabled={!message.trim() || status !== 'Connected'} aria-label="Send message">Send</button>
      </form>
    </div>
  );
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState('menu');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [error, setError] = useState('');
  const [assistantAnswer, setAssistantAnswer] = useState('');

  useEffect(() => {
    const openFromNavigation = event => {
      setView(event.detail?.view === 'tracking' ? 'tracking' : 'menu');
      setIsOpen(true);
      setError('');
    };
    window.addEventListener('korvane:open-support', openFromNavigation);
    return () => window.removeEventListener('korvane:open-support', openFromNavigation);
  }, []);

  function close() {
    setIsOpen(false);
    setView('menu');
    setError('');
  }

  function startLiveChat(event) {
    event.preventDefault();
    const cleanNumber = trackingNumber.trim().toUpperCase();
    if (!cleanNumber) {
      setError('Enter the tracking number for your shipment.');
      return;
    }
    setTrackingNumber(cleanNumber);
    setError('');
    setView('live');
  }

  return (
    <div className="chat-widget">
      {isOpen && <section className="chat-widget-panel" aria-label="Korvane customer support">
        <header className="chat-widget-header">
          <div><strong>Korvane support</strong><span>How can we help?</span></div>
          <button type="button" onClick={close} aria-label="Close support chat">×</button>
        </header>
        {view === 'menu' && <div className="chat-widget-options">
          <button type="button" onClick={() => { setView('assistant'); setAssistantAnswer(''); }}>
            <span className="chat-widget-option-icon assistant-icon">✦</span><span><strong>AI assistant</strong><small>Quick answers to common questions</small></span><span aria-hidden="true">›</span>
          </button>
          <button type="button" onClick={() => { setView('tracking'); setError(''); }}>
            <span className="chat-widget-option-icon live-icon">●</span><span><strong>Live chat</strong><small>Chat with our operations team</small></span><span aria-hidden="true">›</span>
          </button>
          <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noreferrer">
            <span className="chat-widget-option-icon whatsapp-icon">◉</span><span><strong>WhatsApp</strong><small>Continue the conversation on WhatsApp</small></span><span aria-hidden="true">↗</span>
          </a>
        </div>}
        {view === 'assistant' && <div className="chat-widget-assistant">
          <p className="chat-widget-intro">Choose a question and I’ll point you in the right direction.</p>
          <div className="chat-widget-questions">
            {assistantQuestions.map(([question, answer]) => <button key={question} type="button" onClick={() => setAssistantAnswer(answer)}>{question}</button>)}
          </div>
          {assistantAnswer && <p className="chat-widget-answer" role="status">{assistantAnswer}</p>}
          <button className="chat-widget-back" type="button" onClick={() => setView('menu')}>← Support options</button>
        </div>}
        {view === 'tracking' && <form className="chat-widget-track" onSubmit={startLiveChat}>
          <p>Enter a valid shipment tracking number to open its support chat.</p>
          <label htmlFor="support-tracking-number">Tracking number</label>
          <input id="support-tracking-number" value={trackingNumber} onChange={event => setTrackingNumber(event.target.value)} maxLength={50} placeholder="e.g. KV-10482" />
          {error && <p className="chat-widget-error" role="alert">{error}</p>}
          <button type="submit">Continue to live chat</button>
          <button className="chat-widget-back" type="button" onClick={() => setView('menu')}>← Support options</button>
        </form>}
        {view === 'live' && <ChatConversation trackingNumber={trackingNumber} onBack={() => setView('tracking')} />}
      </section>}
      <button
        type="button"
        className="chat-widget-launcher"
        aria-label={isOpen ? 'Close customer support' : 'Open customer support'}
        aria-expanded={isOpen}
        onClick={() => setIsOpen(open => !open)}
      >
        {isOpen ? '×' : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-5 4v-4.2a2.5 2.5 0 0 1-2-2.3z" fill="currentColor"/><circle cx="8" cy="9.5" r="1" fill="#1e6ea7"/><circle cx="12" cy="9.5" r="1" fill="#1e6ea7"/><circle cx="16" cy="9.5" r="1" fill="#1e6ea7"/></svg>}
      </button>
    </div>
  );
}
