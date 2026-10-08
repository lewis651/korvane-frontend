import { useEffect, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import AdminPortal from './AdminPortal.jsx';
import ChatWidget from './ChatWidget.jsx';
import { apiRequest } from './api.js';
import './App.css';
import 'leaflet/dist/leaflet.css';
const B = '#1e6ea7', D = '#0a2236';

const photos = {
  truck: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=1400&q=85',
  ship: 'https://images.unsplash.com/photo-1494412519320-aa613dfb7738?auto=format&fit=crop&w=1200&q=85',
  warehouse: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1000&q=85',
  aircraft: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1000&q=85',
  road: 'https://images.unsplash.com/photo-1519003722824-194d4455a60c?auto=format&fit=crop&w=1000&q=85',
  port: 'https://images.unsplash.com/photo-1494412519320-aa613dfb7738?auto=format&fit=crop&w=1200&q=85',
  delivery: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=1000&q=85',
};

const LogisticsPhoto = ({ src, alt, className = '', loading = 'lazy' }) => (
  <img
    src={src}
    alt={alt}
    className={`h-full w-full object-cover ${className}`}
    loading={loading}
    decoding="async"
  />
);
const mapIcon = (className, label) => L.divIcon({
  className: '',
  html: `<span class="${className}" role="img" aria-label="${label}"></span>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});
const originIcon = mapIcon('shipment-map-origin', 'Origin');
const destinationIcon = mapIcon('shipment-map-destination', 'Destination');
const currentIcon = mapIcon('shipment-map-current', 'Shipment location');
const pausedIcon = mapIcon('shipment-map-current is-paused', 'Paused shipment location');

function RouteBounds({ tracking }) {
  const map = useMap();
  const startLat = tracking?.start_lat;
  const startLng = tracking?.start_lng;
  const endLat = tracking?.end_lat;
  const endLng = tracking?.end_lng;
  useEffect(() => {
    if (startLat === undefined || startLng === undefined || endLat === undefined || endLng === undefined) return;
    const start = [Number(startLat), Number(startLng)];
    const end = [Number(endLat), Number(endLng)];
    if (![...start, ...end].every(Number.isFinite)) return;
    let frame = 0;
    const fitRoute = () => {
      map.invalidateSize({ pan: false });
      if (start[0] === end[0] && start[1] === end[1]) map.setView(start, 12);
      else map.fitBounds([start, end], { padding: [48, 48], maxZoom: 9 });
    };
    frame = window.requestAnimationFrame(fitRoute);
    return () => window.cancelAnimationFrame(frame);
  }, [map, startLat, startLng, endLat, endLng]);
  return null;
}

function WorldMap({ tracking }) {
  const startLat = tracking?.start_lat;
  const startLng = tracking?.start_lng;
  const endLat = tracking?.end_lat;
  const endLng = tracking?.end_lng;
  const startedAt = tracking?.started_at;
  const totalHours = tracking?.total_hours;
  const elapsedSeconds = tracking?.elapsed_seconds;
  const isPaused = tracking?.is_paused;
  const status = tracking?.status;
  const route = tracking
    ? [[Number(startLat), Number(startLng)], [Number(endLat), Number(endLng)]]
    : null;
  const current = tracking ? [Number(tracking.current_lat), Number(tracking.current_lng)] : null;
  const hasCoordinates = route && [...route[0], ...route[1], ...current].every(Number.isFinite);
  const [clock, setClock] = useState(null);
  useEffect(() => {
    if (!hasCoordinates || isPaused || status === 'Delivered') return undefined;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [hasCoordinates, isPaused, status, startedAt, totalHours]);
  const durationSeconds = Number(totalHours) * 3600;
  const initialElapsed = Number(elapsedSeconds);
  const startTime = new Date(startedAt).getTime();
  const movingElapsed = clock === null ? initialElapsed : Math.max((clock - startTime) / 1000, 0);
  const progress = status === 'Delivered'
    ? 1
    : Math.min((isPaused ? initialElapsed : movingElapsed) / durationSeconds, 1);
  const position = clock === null && current
    ? current
    : hasCoordinates && Number.isFinite(progress)
    ? [
      route[0][0] + (route[1][0] - route[0][0]) * progress,
      route[0][1] + (route[1][1] - route[0][1]) * progress,
    ]
    : current;
  return (
    <div className="shipment-map" role="region" aria-label="Shipment route map">
      <MapContainer center={[15, 0]} zoom={2} scrollWheelZoom style={{ height: 'min(68vh, 720px)', minHeight: '420px', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          eventHandlers={{
            tileerror: () => console.error('OpenStreetMap tile failed to load. Check network access or the tile service status.'),
          }}
        />
        {hasCoordinates && <>
          <RouteBounds tracking={tracking}/>
          <Polyline positions={route} pathOptions={{ color: '#1e6ea7', weight: 5, opacity: 0.8 }}/>
          <Marker position={route[0]} icon={originIcon}>
            <Popup>{tracking.start_location || 'Origin'}</Popup>
          </Marker>
          <Marker position={route[1]} icon={destinationIcon}>
            <Popup>{tracking.end_location || 'Destination'}</Popup>
          </Marker>
          {position && <Marker position={position} icon={tracking.is_paused ? pausedIcon : currentIcon}>
            <Popup>{tracking.is_paused ? 'Shipment paused' : tracking.is_moving ? 'Shipment in transit' : 'Shipment location'} · {tracking.progress}% complete</Popup>
          </Marker>}
        </>}
      </MapContainer>
    </div>
  );
}

function formatRemainingTime(seconds) {
  const remainingMinutes = Math.max(0, Math.ceil(Number(seconds) / 60));
  const days = Math.floor(remainingMinutes / 1440);
  const hours = Math.floor((remainingMinutes % 1440) / 60);
  const minutes = remainingMinutes % 60;
  return [days ? `${days}d` : '', hours ? `${hours}h` : '', minutes || (!days && !hours) ? `${minutes}m` : ''].filter(Boolean).join(' ');
}

function Tracker({ big, onTracking }) {
  const [id,setId]=useState(() => sessionStorage.getItem('korvane_pending_tracking') || '');
  const [tracking,setTracking]=useState(null);
  const [trackingNumber,setTrackingNumber]=useState('');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');

  useEffect(() => {
    if (!big) return;
    const pendingNumber = sessionStorage.getItem('korvane_pending_tracking');
    if (!pendingNumber) return;
    sessionStorage.removeItem('korvane_pending_tracking');
    let active = true;
    apiRequest(`/api/track/${encodeURIComponent(pendingNumber)}`).then(result => {
      if (!active) return;
      setTracking(result);
      setTrackingNumber(pendingNumber);
      setError('');
      onTracking?.(result);
    }).catch(requestError => {
      if (active) setError(requestError.message);
    });
    return () => { active = false; };
  }, [big, onTracking]);

  async function lookup(number, showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      const result = await apiRequest(`/api/track/${encodeURIComponent(number)}`);
      setTracking(result);
      setTrackingNumber(number);
      setError('');
      onTracking?.(result);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    if (!trackingNumber) return undefined;
    const timer = window.setInterval(async () => {
      try {
        const result = await apiRequest(`/api/track/${encodeURIComponent(trackingNumber)}`);
        setTracking(result);
        setError('');
        onTracking?.(result);
      } catch (requestError) {
        setError(requestError.message);
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [trackingNumber, onTracking]);

  useEffect(() => {
    const shipmentStartedAt = tracking?.started_at;
    const shipmentHours = tracking?.total_hours;
    const paused = tracking?.is_paused;
    const shipmentStatus = tracking?.status;
    if (!shipmentStartedAt || paused || shipmentStatus === 'Delivered') return undefined;
    const startedAt = new Date(shipmentStartedAt).getTime();
    const totalSeconds = Number(shipmentHours) * 3600;
    if (!Number.isFinite(startedAt) || !Number.isFinite(totalSeconds) || totalSeconds <= 0) return undefined;
    const timer = window.setInterval(() => {
      const elapsed = Math.min(Math.max((Date.now() - startedAt) / 1000, 0), totalSeconds);
      const progress = (elapsed / totalSeconds) * 100;
      const expectedDelivery = new Date(startedAt + totalSeconds * 1000).toISOString();
      setTracking(current => current ? {
        ...current,
        elapsed_seconds: elapsed,
        remaining_seconds: Math.max(totalSeconds - elapsed, 0),
        progress,
        current_lat: Number(current.start_lat) + (Number(current.end_lat) - Number(current.start_lat)) * (progress / 100),
        current_lng: Number(current.start_lng) + (Number(current.end_lng) - Number(current.start_lng)) * (progress / 100),
        expected_delivery: expectedDelivery,
      } : current);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [tracking?.started_at, tracking?.total_hours, tracking?.is_paused, tracking?.status]);

  function submit(event) {
    event.preventDefault();
    const requestedNumber = id.trim().toUpperCase();
    if (!requestedNumber) {
      setError('Enter a tracking number to look up your shipment.');
      return;
    }
    if (!big) {
      sessionStorage.setItem('korvane_pending_tracking', requestedNumber);
      window.location.hash = '#/tracking';
      return;
    }
    setError('');
    setTracking(null);
    setTrackingNumber('');
    onTracking?.(null);
    lookup(requestedNumber);
  }

  return (
    <div className={big?'':'rounded-2xl bg-white/70 backdrop-blur p-3 shadow-lg ring-1 ring-sky-200 max-w-md'}>
      <form onSubmit={submit} className="flex gap-2">
        <input value={id} onChange={e=>setId(e.target.value)} aria-label="Tracking ID" placeholder="Enter your shipment tracking number" className="flex-1 min-w-0 rounded-lg border border-sky-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-500"/>
        <button disabled={loading} className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60" style={{background:B}}>{loading?'Checking…':'Track'}</button>
      </form>
      {error && <p role="alert" className={`mt-3 text-sm ${big?'text-red-200':'text-red-700'}`}>{error}</p>}
      {tracking && <div className={`mt-4 rounded-xl p-4 text-sm ${big?'bg-white/10 text-white':'bg-white text-slate-800'}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <strong>{tracking.tracking_number}</strong>
          <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-900">{tracking.status}{tracking.is_paused?' · Paused':''}</span>
        </div>
        <p className={`mt-2 ${big?'text-sky-100':'text-slate-600'}`}>{tracking.start_location} → {tracking.end_location}</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-sky-600 transition-[width] duration-700" style={{width:`${tracking.progress}%`}}/></div>
        <p className={`mt-2 text-xs ${big?'text-sky-100':'text-slate-500'}`}>{tracking.progress.toFixed(1)}% estimated journey progress · {formatRemainingTime(tracking.remaining_seconds)} remaining{tracking.expected_delivery?` · Estimated arrival ${new Date(tracking.expected_delivery).toLocaleString()}`:''}</p>
        {!big && <p className="mt-2 text-xs text-slate-500">Updates automatically every 5 seconds while this page is open.</p>}
      </div>}
    </div>
  );
}

const reviews = [
  ['Megan Rose','CEO, LogiBot','Korvane moved 40 pallets of electronics across three continents with zero damage. The live map let our team stop chasing updates.',5],
  ['Daniel Mbah','Operations Lead, Atlas Foods','Our cold-chain deliveries arrive on the quoted day, every week. Support answers in minutes, not days.',5],
  ['Sofia Lindqvist','Supply Chain Manager, Nordica','Customs paperwork used to cost us days. Korvane handles it end to end and we have not had a held container since.',5],
  ['Kwame Boateng','Founder, Accra Textiles','Switching to Korvane cut our freight cost by 18% and our delays by half. Pricing is clear from the first quote.',5],
  ['Priya Raman','Procurement Director, Helix Medical','Temperature logs, signed proof of delivery, insurance on every load. It is what a medical shipper needs.',5],
  ['Lucas Ferreira','Head of Logistics, Brava Retail','Peak season used to be chaos. This year Korvane scaled with us and every order landed before the deadline.',4],
];

const Stars=({n})=>(<div className="text-amber-400" aria-label={n+' out of 5 stars'}>{'★'.repeat(n)}<span className="text-slate-300">{'★'.repeat(5-n)}</span></div>);

const BGS={banner:photos.ship,cta:photos.port,head:photos.warehouse};
const bgStyle=k=>({backgroundImage:`linear-gradient(rgba(10,34,54,.72),rgba(10,34,54,.72)),url("${BGS[k]}")`,backgroundSize:'cover',backgroundPosition:'center'});
function FAQ(){const [o,setO]=useState(0);const q=[['How long does international shipping take?','Transit time depends on the route, service and customs requirements. Air freight typically takes 3 to 7 days, while sea freight usually takes 18 to 40 days. We include an estimated delivery window in your quote and keep you updated if plans change.'],['Do you handle customs clearance?','Yes. Our customs team helps prepare and file the required shipping documents at both ends of the journey. We monitor clearance milestones and share status updates, so you know when your cargo is ready to move on.'],['Is my cargo insured?','Every shipment includes basic cover, and you can request additional insurance based on the cargo value and type. Your freight specialist can explain the available options and what details are needed before your shipment is booked.'],['How accurate is live tracking?','Tracking information combines updates from carriers and shipment milestones, with new status information as it becomes available. You can check progress using your tracking ID and receive email or SMS alerts for important events along the route.']];return(<div className="mt-8 max-w-3xl mx-auto divide-y divide-slate-200 rounded-2xl ring-1 ring-slate-200 bg-white">{q.map((x,i)=>(<div key={i}><button onClick={()=>setO(o===i?-1:i)} aria-expanded={o===i} className="w-full flex justify-between gap-4 text-left px-5 py-4 font-semibold" style={{color:D}}>{x[0]}<span style={{color:B}}>{o===i?'−':'+'}</span></button>{o===i&&<p className="px-5 pb-4 text-sm text-slate-600">{x[1]}</p>}</div>))}</div>)}
const Hero=()=>(<><section id="home" className="grid md:grid-cols-2 gap-6 items-center px-5 md:px-10 pt-10 md:pt-16 pb-24" style={{background:"radial-gradient(900px 420px at 85% 10%,#cfe8f8,transparent),radial-gradient(600px 300px at 0% 100%,#e6f2fa,transparent)"}}>
        <div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05]" style={{color:D}}>We deliver your freight anywhere, on time.</h1>
          <p className="mt-5 text-lg font-medium">Quote it · Book it · Track it</p>
          <p className="mt-2 text-slate-600 max-w-md text-sm">Move goods by road, sea or air across more than 90 countries. One experienced team coordinates pickup, documentation, customs and final delivery, with shipment updates along the way.</p>
          <div className="mt-6"><Tracker/></div>
        </div>
        <div className="relative float mx-auto w-full max-w-2xl">
          <div className="aspect-[4/3] overflow-hidden rounded-3xl shadow-2xl ring-1 ring-sky-900/10">
            <LogisticsPhoto src={photos.truck} alt="Freight truck carrying cargo along a highway" loading="eager" className="object-center"/>
          </div>
          <div className="glass absolute -top-3 right-3 rounded-xl px-4 py-2 text-xs sm:right-6"><div className="font-bold f text-base" style={{color:B}}>98.7%</div>on-time delivery</div>
          <div className="glass absolute bottom-5 left-3 rounded-xl px-4 py-2 text-xs flex items-center gap-2 sm:bottom-7 sm:left-6"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500"/>Shipment KVN-48213907 in transit</div>
        </div>
      </section></>);
const Ribbon=()=>(<><div className="relative -mt-10 -mb-6 h-20 overflow-hidden" style={{transform:'rotate(-3deg) scale(1.05)'}} aria-hidden="true">
        <div className="absolute inset-0 flex items-center text-white" style={{background:B}}>
          <div className="ribbon flex whitespace-nowrap f text-xl tracking-widest" style={{width:'200%'}}>
            {Array.from({length:16}).map((_,i)=><span key={i} className="px-6">{words[i%4]} <span className="text-amber-300 px-3">•</span></span>)}
          </div>
        </div>
      </div></>);
const About=()=>(<><section id="about" className="grid md:grid-cols-2 gap-8 items-center px-5 md:px-10 py-20">
        <div className="order-2 md:order-1">
          <h2 className="text-3xl md:text-4xl font-bold" style={{color:D}}>Deliver your cargo <span style={{color:B}}>safely</span> and quickly</h2>
          <p className="mt-4 text-slate-600 max-w-md">From the first pickup to final delivery, Korvane coordinates the people and details that keep freight moving. We help manage handling, customs, insurance options and last-mile transport, while keeping your team informed at each important milestone.</p>
          <div className="mt-6 inline-flex items-center gap-3 rounded-full p-2 pr-3 text-white" style={{background:B}}>
            <div className="flex -space-x-2">{['#e8a87c','#c38d9e','#41b3a3','#e27d60'].map(c=><span key={c} className="h-8 w-8 rounded-full ring-2 ring-white" style={{background:c}}/>)}</div>
            <span className="text-sm font-semibold">500K+ parcels delivered in 2025</span>
          </div>
          <div className="mt-8 grid grid-cols-3 gap-4 max-w-md text-center">
            {[['98.7%','On-time delivery'],['90+','Countries served'],['24/7','Live support']].map(s=>(<div key={s[1]} className="rounded-xl bg-sky-50 p-3"><div className="f text-2xl font-bold" style={{color:B}}>{s[0]}</div><div className="text-xs text-slate-600">{s[1]}</div></div>))}
          </div>
        </div>
        <div className="order-1 md:order-2 relative mx-auto w-full max-w-xl">
          <div className="aspect-[4/3] overflow-hidden rounded-3xl shadow-xl ring-1 ring-slate-200">
            <LogisticsPhoto src={photos.ship} alt="Cargo containers aboard a ship at sea" />
          </div>
          <div className="absolute bottom-4 left-4 rounded-xl bg-white/90 px-4 py-3 shadow-lg backdrop-blur sm:bottom-6 sm:left-6">
            <div className="f font-bold" style={{color:D}}>End-to-end logistics</div>
            <div className="text-xs text-slate-600">One team, from pickup to delivery</div>
          </div>
        </div>
      </section></>);
const Services=()=>(<><section id="services" className="px-5 md:px-10 pb-20">
        <h2 className="text-3xl md:text-4xl font-bold text-center" style={{color:D}}>Shipping and logistics services</h2>
        <p className="text-center text-slate-600 mt-3 max-w-xl mx-auto text-sm">Choose the shipping mode that fits your cargo, schedule and budget. Our team can coordinate the paperwork, customs steps and handoffs between carriers, so you have one clear point of contact throughout the journey.</p>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[['Road freight','Flexible full- and part-load options for domestic routes, cross-border journeys and final-mile delivery. We coordinate collection times and route planning to help keep your goods moving between depots and destinations.',<LogisticsPhoto key="road" src={photos.road} alt="Heavy freight truck travelling on an open road"/>],['Sea freight','Ship full containers or share space for smaller consignments across major trade lanes. Our team coordinates port handling, shipment documents and connecting transport from origin to destination.',<LogisticsPhoto key="sea" src={photos.ship} alt="Cargo ship loaded with shipping containers"/>],['Air freight','Move urgent or high-priority cargo with scheduled air services and time-sensitive options. We help arrange collection, export documentation and onward delivery, with progress updates as your freight moves.',<LogisticsPhoto key="air" src={photos.aircraft} alt="Commercial aircraft flying above the clouds"/>],['Warehousing','Keep inventory close to customers with flexible storage and fulfilment support. Services include receiving, organised storage, pick-and-pack and inventory reporting to help you manage orders.',<LogisticsPhoto key="warehouse" src={photos.warehouse} alt="Organised warehouse storage and freight shelving"/>]].map(s=>(
            <div key={s[0]} className="rounded-2xl overflow-hidden ring-1 ring-slate-200 bg-white hover:-translate-y-1 hover:shadow-2xl transition duration-300">
              <div className="h-40">{s[2]}</div>
              <div className="p-5"><h3 className="font-bold text-lg" style={{color:D}}>{s[0]}</h3><p className="text-sm text-slate-600 mt-1">{s[1]}</p></div>
            </div>))}
        </div>
      </section></>);
const Gallery=()=>(<><section className="px-5 md:px-10 pb-20">
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 pb-12 f text-lg font-bold text-slate-400">{['NORDICA','ATLAS FOODS','HELIX MEDICAL','BRAVA','LOGIBOT'].map(n=><span key={n}>{n}</span>)}</div>
        <div className="grid md:grid-cols-3 gap-5">
          {[['Ports and terminals','Coordinate container handling and transfers through a broad network of major ports. Our operations team helps connect ocean freight with the next leg of its journey.',<LogisticsPhoto key="port" src={photos.port} alt="Container ship alongside a busy international port"/>],['Smart warehouses','Store goods with organised receiving, inventory handling and fulfilment support. Flexible warehouse services help businesses prepare orders and keep stock closer to the customers they serve.',<LogisticsPhoto key="warehouse" src={photos.warehouse} alt="High-ceiling warehouse with organised freight storage"/>],['Last-mile delivery','Connect freight hubs with homes, stores and business locations in cities around the world. Local delivery coordination helps complete the journey and provides a clear handoff at the destination.',<LogisticsPhoto key="delivery" src={photos.delivery} alt="Freight truck moving cargo for last-mile delivery"/>]].map(t=>(
            <div key={t[0]} className="group relative h-72 rounded-3xl overflow-hidden shadow-lg"><div className="absolute inset-0 transition duration-500 group-hover:scale-110">{t[2]}</div><div className="absolute inset-0 bg-gradient-to-t from-[#0a2236]/90 via-transparent to-transparent"/><div className="absolute bottom-0 p-6 text-white"><h3 className="f text-xl font-bold">{t[0]}</h3><p className="text-sm text-sky-100">{t[1]}</p></div></div>))}
        </div>
      </section></>);
const Tracking=()=>{
  const [tracking,setTracking]=useState(null);
  const detailClass = 'mt-1 text-sm text-slate-700 break-words';
  return (<><section id="tracking" className="px-5 md:px-10 py-16 text-white" style={{background:D}}>
        <div className="grid lg:grid-cols-5 gap-8 items-start">
          <div className="lg:col-span-2">
            <h2 className="text-3xl md:text-4xl font-bold">Live tracking, down to the port</h2>
            <p className="mt-3 text-sky-100/80 text-sm">Enter your tracking ID to see its current operations status, estimated journey progress and expected arrival. Shipment information refreshes automatically while this page is open.</p>
            <div className="mt-6"><Tracker big onTracking={setTracking}/></div>
          </div>
          {tracking && <div className="lg:col-span-3 rounded-2xl bg-white p-5 shadow-lg">
            <h3 className="text-lg font-bold text-slate-900">Shipment details</h3>
            <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <div><h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sender</h4><p className={detailClass}>{tracking.sender_name || 'Not provided'}</p><p className={detailClass}>{tracking.sender_address || 'Address not provided'}</p></div>
              <div><h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Receiver</h4><p className={detailClass}>{tracking.receiver_name || 'Not provided'}</p><p className={detailClass}>{tracking.receiver_address || 'Address not provided'}</p></div>
              <div><h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cargo</h4><p className={detailClass}>{tracking.package_type || 'Package type not provided'} · {tracking.weight || 'Weight not provided'}</p></div>
              <div><h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Transit estimate</h4><p className={detailClass}>{tracking.total_hours} hours total · {formatRemainingTime(tracking.remaining_seconds)} remaining</p></div>
              <div className="sm:col-span-2"><h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description / notes</h4><p className={`${detailClass} whitespace-pre-wrap`}>{tracking.description || 'No additional notes'}</p></div>
            </div>
          </div>}
          {tracking && <div className="lg:col-span-5 overflow-hidden rounded-2xl ring-1 ring-sky-400/30 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white px-5 py-3 text-slate-800">
              <div><strong>{tracking.tracking_number}</strong><span className="ml-3 rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-900">{tracking.status}{tracking.is_paused ? ' · Paused' : ''}</span></div>
              <p className="text-xs text-slate-600">{tracking.start_location} → {tracking.end_location} · ETA {new Date(tracking.expected_delivery).toLocaleString()}</p>
            </div>
            <WorldMap tracking={tracking}/>
            <div className="flex flex-wrap gap-x-5 gap-y-2 bg-white px-5 py-3 text-xs text-slate-700">
              <div className="flex items-center gap-2"><span className="shipment-map-origin"/><span>Sender</span></div>
              <div className="flex items-center gap-2"><span className="shipment-map-destination"/><span>Receiver</span></div>
              <div className="flex items-center gap-2"><span className={`shipment-map-current ${tracking.is_paused ? 'is-paused' : ''}`}/><span>{tracking.is_paused ? 'Paused' : tracking.is_moving ? 'Moving' : 'Current position'}</span></div>
              <p className="ml-auto text-slate-500">Estimated route position · updates every 5 seconds</p>
            </div>
          </div>}
        </div>
      </section></>);
};
const Banner=()=>(<><section className="px-5 md:px-10 py-16">
        <div className="rounded-3xl p-8 md:p-12 text-white grid md:grid-cols-2 gap-6 items-center" style={bgStyle('banner')}>
          <div>
            <h2 className="text-3xl font-bold">Effortless delivery with our logistics solutions</h2>
            <p className="mt-3 text-sky-100 text-sm max-w-md">Our support team is available around the clock to help with booking questions, shipment updates and delivery issues. If plans change along the way, we will help coordinate the next steps and keep your freight moving.</p>
            <a href="#/contact" className="inline-block mt-5 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold" style={{color:B}}>Quick response</a>
          </div>
          <div className="h-48 rounded-2xl overflow-hidden ring-4 ring-white/20 shadow-2xl"><LogisticsPhoto src={photos.port} alt="Cargo ship and containers at a seaport"/></div>
        </div>
      </section></>);
const Process=()=>(<><section id="process" className="px-5 md:px-10 pb-20">
        <h2 className="text-3xl md:text-4xl font-bold text-center" style={{color:D}}>How shipping with Korvane works</h2>
        <div className="mt-10 grid md:grid-cols-4 gap-5 relative">
          {[['Request a quote','Share what you are shipping, the pickup and delivery locations, and your preferred dates. A freight specialist reviews the details and prepares a clear quote for the service that best fits your shipment.'],['Pickup and customs','Once your booking is confirmed, we coordinate collection and guide you through the documents needed for the journey. Our team follows the customs process and works with carriers at each handoff.'],['Track in transit','Use your tracking ID to follow shipment progress across the route. Check important events as they are recorded and use available email or SMS notifications to stay informed while your cargo is moving.'],['Delivered with proof','At the destination, the final delivery is coordinated with the receiving contact. Your shipment record can include delivery confirmation and supporting proof, helping your team close out the order.']].map((x,i)=>(
            <div key={i} className="rounded-3xl bg-white p-6 ring-1 ring-slate-200 shadow-md"><div className="h-10 w-10 rounded-full grid place-items-center text-white font-bold f" style={{background:B}}>{i+1}</div><h3 className="mt-4 font-bold text-lg" style={{color:D}}>{x[0]}</h3><p className="mt-1 text-sm text-slate-600">{x[1]}</p></div>))}
        </div>
      </section></>);
const Why=()=>(<><section className="px-5 md:px-10 pb-20">
        <div className="rounded-3xl p-8 md:p-12 bg-gradient-to-br from-sky-50 to-white ring-1 ring-sky-100">
          <h2 className="text-3xl md:text-4xl font-bold max-w-xl" style={{color:D}}>Why 2,300+ businesses ship with us</h2>
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[['Fixed, upfront pricing','See the expected freight charges before you book, with the key service details laid out clearly. Our team will explain any route or cargo requirements that could affect the final quote.'],['Customs experts in-house','Get guidance with shipment paperwork, customs declarations and clearance milestones. Our specialists help coordinate the information required at origin and destination.'],['Full-value insurance','Ask about additional cover based on your cargo and its declared value. We help you understand available protection options before the shipment is on its way.'],['Temperature-controlled fleet','Arrange transport for goods that need extra care, including food and pharmaceutical cargo. We can coordinate appropriate handling and temperature-controlled equipment for the planned route.'],['Carbon-reporting built in','Review shipment-related emissions information to support your sustainability reporting. Use the available data to better understand the transport footprint of your freight movements.'],['One accountable contact','Work with a named point of contact who can help coordinate bookings, answer questions and connect the different steps of your shipment across the network.']].map(f=>(
              <div key={f[0]} className="border-l-4 pl-4" style={{borderColor:B}}><h3 className="font-bold" style={{color:D}}>{f[0]}</h3><p className="text-sm text-slate-600 mt-1">{f[1]}</p></div>))}
          </div>
        </div>
      </section></>);
const Network=()=>(<><section className="px-5 md:px-10 pb-20 text-center">
        <h2 className="text-3xl md:text-4xl font-bold" style={{color:D}}>A network that spans the globe</h2>
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-5">
          {[['90+','countries'],['140','ports and airports'],['320','warehouses'],['12,000','vehicles']].map(x=>(<div key={x[1]} className="rounded-2xl p-6 text-white" style={{background:'linear-gradient(135deg,#1e6ea7,#0a2236)'}}><div className="f text-4xl font-bold">{x[0]}</div><div className="text-sm text-sky-100">{x[1]}</div></div>))}
        </div>
        <p className="mt-6 text-sm text-slate-500">Our network connects key freight gateways and regional teams, helping coordinate cargo between origin, transit hubs and final destinations. Hubs include Douala · Rotterdam · Dubai · Shenzhen · Houston · Singapore · Lagos · Hamburg.</p>
      </section></>);
const Reviews=()=>(<><section id="reviews" className="px-5 md:px-10 pb-20">
        <h2 className="text-3xl md:text-4xl font-bold" style={{color:D}}>What our customers say about us</h2>
        <p className="text-slate-600 text-sm mt-2">Rated 4.9 out of 5 from 2,300+ verified shipments. Read how customers use Korvane for dependable updates, cross-border freight and everyday delivery coordination.</p>
        <div className="mt-8 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {reviews.map(r=>(
            <figure key={r[0]} className="rounded-3xl bg-gradient-to-br from-sky-50 to-white p-6 ring-1 ring-sky-100 shadow-md hover:shadow-xl transition"><div className="f text-5xl leading-none" style={{color:B,opacity:.25}}>“</div>
              <Stars n={r[3]}/>
              <blockquote className="mt-3 text-sm text-slate-700">{r[2]}</blockquote>
              <figcaption className="mt-4 flex items-center gap-3">
                <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sky-100 text-sm font-bold text-sky-800 ring-2 ring-white shadow">{r[0].split(' ').map(part=>part[0]).join('')}</span>
                <span><span className="block font-semibold text-sm" style={{color:D}}>{r[0]}</span><span className="block text-xs text-slate-500">{r[1]}</span></span>
              </figcaption>
            </figure>))}
        </div>
      </section></>);
const FaqSec=()=>(<><section className="px-5 md:px-10 pb-20"><h2 className="text-3xl md:text-4xl font-bold text-center" style={{color:D}}>Frequently asked questions</h2><p className="mx-auto mt-3 max-w-2xl text-center text-sm text-slate-600">Find practical details about delivery times, customs, cargo protection and tracking. If you need help with a specific route or shipment, our team can talk through the options with you.</p><FAQ/></section></>);
const CTA=()=>(<><section className="px-5 md:px-10 pb-16"><div className="rounded-3xl p-10 text-center text-white" style={bgStyle('cta')}><h2 className="text-3xl font-bold">Ready to move your next shipment?</h2><p className="mt-2 text-sky-100 text-sm">Tell us where your cargo is going and when it needs to arrive. We will help you compare suitable freight options and prepare a clear quote for your next move.</p><a href="#/contact" className="inline-block mt-5 rounded-lg bg-white px-6 py-3 font-semibold" style={{color:B}}>Request a quote</a></div></section></>);
function Footer(){
  const [em,setEm]=useState('');const [ok,setOk]=useState(false);
  const col=(t,items)=>(<div><div className="text-white font-semibold mb-4">{t}</div><ul className="space-y-2.5">{items.map(i=><li key={i[0]}><a href={i[1]} className="hover:text-white transition">{i[0]}</a></li>)}</ul></div>);
  return (
  <footer className="relative text-sky-100/75 text-sm" style={{background:D}}>
    <svg viewBox="0 0 1440 60" preserveAspectRatio="none" className="absolute -top-px left-0 w-full h-8 md:h-12" aria-hidden="true"><path d="M0 0h1440v20C1200 70 900 0 600 30S200 60 0 20z" fill="#fff"/></svg>
    <div className="px-5 md:px-10 pt-20 md:pt-28">
      <div className="rounded-3xl p-6 md:p-10 grid md:grid-cols-2 gap-6 items-center ring-1 ring-white/10" style={{background:'linear-gradient(120deg,#1e6ea7,#12456b)'}}>
        <div><h3 className="f text-2xl md:text-3xl font-bold text-white">Get shipping updates and rate alerts</h3><p className="mt-2 text-sky-100">Monthly freight market news, port delay notices and special lane rates. No spam.</p></div>
        {ok?<p className="text-white font-semibold">Thanks, you are subscribed.</p>:<form onSubmit={e=>{e.preventDefault();setOk(true)}} className="flex gap-2"><input required type="email" value={em} onChange={e=>setEm(e.target.value)} aria-label="Email address" placeholder="Your work email" className="flex-1 min-w-0 rounded-lg px-4 py-3 text-slate-900 outline-none focus:ring-2 focus:ring-amber-300"/><button className="rounded-lg bg-amber-300 px-5 py-3 font-semibold text-slate-900 hover:bg-amber-200">Subscribe</button></form>}
      </div>
      <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="lg:col-span-2 xl:col-span-2">
          <div className="flex items-center gap-2 f font-bold text-2xl text-white"><svg width="30" height="30" viewBox="0 0 28 28"><path d="M4 4h6v8l8-8h7L15 14l10 10h-7l-8-8v8H4z" fill="#5fb0e8"/></svg>KORVANE</div>
          <p className="mt-4 max-w-xs leading-relaxed">Freight forwarding, warehousing and last-mile delivery across 90+ countries, with live tracking on every shipment.</p>
        </div>
        {col('Services',[['All solutions','#/solutions'],['Road freight','#/solution-road'],['Sea freight','#/solution-sea'],['Air freight','#/solution-air'],['Warehousing','#/solution-warehousing'],['Customs brokerage','#/solution-customs']])}
        {col('Company',[['About us','#/about'],['Customer reviews','#/reviews'],['Careers','#/careers'],['Press','#/press'],['Sustainability','#/sustainability']])}
        {col('Support',[['Track a shipment','#/tracking'],['Request a quote','#/contact'],['FAQ & shipping guides','#/guides'],['Claims & shipment support','#/claims'],['Service areas','#/locations']])}
        <div><div className="text-white font-semibold mb-4">Contact</div><ul className="space-y-2.5"><li><a href="#/locations" className="hover:text-white">12 Port Road, Bonanjo, Douala</a></li><li><a href="tel:+15550142290" className="hover:text-white">+1 (555) 014 2290</a></li><li><a href="mailto:hello@korvane.example" className="hover:text-white">hello@korvane.example</a></li><li className="pt-2 text-white">Support: open 24 hours, 7 days</li></ul></div>
      </div>
      <div className="mt-12 flex flex-wrap items-center gap-3 border-t border-white/10 pt-8"><span className="text-xs mr-2">Certified and insured:</span>{['ISO 9001','IATA','FIATA','C-TPAT','ISO 14001'].map(x=><span key={x} className="rounded-full border border-sky-300/30 px-3 py-1 text-xs text-sky-100">{x}</span>)}</div>
      <div className="mt-8 py-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs"><span>© 2026 Korvane Logistics. All rights reserved.</span><span className="flex gap-5"><a href="#/privacy" className="hover:text-white">Privacy</a><a href="#/terms" className="hover:text-white">Terms & conditions</a><a href="#/cookies" className="hover:text-white">Cookies</a></span><div className="flex items-center gap-3"><a href="#/admin" aria-label="Open admin portal" title="Admin portal" className="text-sky-100 opacity-40 transition-opacity hover:opacity-100 focus-visible:opacity-100"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15.5" r="1"/></svg></a><a href="#top" onClick={e=>{e.preventDefault();window.scrollTo({top:0,behavior:'smooth'})}} className="rounded-full bg-white/10 px-4 py-2 text-white hover:bg-white/20">Back to top ↑</a></div></div>
    </div>
  </footer>);
}
const words=['BUYING','SHIPPING','TRACKING','DELIVERY'];
const PageHead=({t,s})=>(<section className="px-5 md:px-10 py-14 text-white" style={bgStyle('head')}><div className="text-xs text-sky-200">Home / {t}</div><h1 className="mt-2 text-4xl md:text-5xl font-bold">{t}</h1><p className="mt-3 max-w-xl text-sky-100">{s}</p></section>);
const Story=()=>(<section className="px-5 md:px-10 py-16"><h2 className="text-3xl md:text-4xl font-bold" style={{color:D}}>Our story</h2><p className="mt-3 max-w-2xl text-slate-600">Korvane started with two trucks and one promise: tell customers the truth about where their cargo is. Today we run a global network, and that promise still guides every decision.</p><div className="mt-8 grid md:grid-cols-4 gap-5">{[['2012','Founded in Douala with two trucks'],['2016','First sea lane to Rotterdam'],['2020','Launched live shipment tracking'],['2025','Passed 500,000 parcels a year']].map(x=>(<div key={x[0]} className="border-t-4 pt-3" style={{borderColor:B}}><div className="f text-2xl font-bold" style={{color:B}}>{x[0]}</div><p className="text-sm text-slate-600">{x[1]}</p></div>))}</div></section>);
const Special=()=>(<section className="px-5 md:px-10 pb-20"><h2 className="text-3xl font-bold" style={{color:D}}>Specialised solutions</h2><div className="mt-6 grid md:grid-cols-2 gap-5">{[['Cold chain','Refrigerated trucks, reefer containers and temperature logs for food and pharma.'],['Project cargo','Oversized and heavy loads planned, permitted and escorted end to end.'],['E-commerce fulfilment','Warehousing, pick-and-pack and same-day dispatch for online sellers.'],['Customs brokerage','Classification, duties and clearance handled by licensed brokers.']].map(x=>(<div key={x[0]} className="rounded-2xl bg-sky-50 p-6 ring-1 ring-sky-100"><h3 className="font-bold text-lg" style={{color:D}}>{x[0]}</h3><p className="mt-1 text-sm text-slate-600">{x[1]}</p></div>))}</div></section>);
function ContactBody() {
  const [sent, setSent] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fieldClass = 'w-full rounded-lg border border-sky-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-500';

  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const details = [
      `Pickup: ${values.get('origin') || 'Not provided'}`,
      `Delivery: ${values.get('destination') || 'Not provided'}`,
      `Cargo details: ${values.get('details') || 'Not provided'}`,
    ].join('\n');
    setBusy(true);
    setError('');
    try {
      const result = await apiRequest('/api/contact', {
        method: 'POST',
        body: {
          name: values.get('name'),
          email: values.get('email'),
          phone: values.get('phone'),
          subject: values.get('service'),
          message: details,
        },
      });
      setSent(result.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-10 px-5 py-16 md:px-10 lg:grid-cols-5">
      <div className="rounded-3xl bg-sky-50 p-6 ring-1 ring-sky-100 md:p-8 lg:col-span-3">
        {sent ? (
          <div className="py-16 text-center">
            <h2 className="text-2xl font-bold" style={{color:D}}>Request received</h2>
            <p role="status" className="mt-2 text-slate-600">{sent}</p>
          </div>
        ) : (
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <h2 className="text-2xl font-bold sm:col-span-2" style={{color:D}}>Request a quote</h2>
            <input required name="name" maxLength="255" aria-label="Full name" placeholder="Full name" className={fieldClass}/>
            <input required name="email" type="email" maxLength="255" aria-label="Email" placeholder="Email" className={fieldClass}/>
            <input name="phone" maxLength="50" aria-label="Phone" placeholder="Phone" className={fieldClass}/>
            <select name="service" aria-label="Service" className={fieldClass}>
              <option>Road freight</option><option>Sea freight</option><option>Air freight</option><option>Warehousing</option>
            </select>
            <input name="origin" maxLength="255" aria-label="Origin" placeholder="Pickup city" className={fieldClass}/>
            <input name="destination" maxLength="255" aria-label="Destination" placeholder="Delivery city" className={fieldClass}/>
            <textarea name="details" maxLength="5000" aria-label="Details" rows="4" placeholder="Cargo type, weight and dates" className={`${fieldClass} sm:col-span-2`}/>
            {error && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{error}</p>}
            <button disabled={busy} className="rounded-lg py-3 font-semibold text-white disabled:opacity-60 sm:col-span-2" style={{background:B}}>{busy?'Sending…':'Send request'}</button>
          </form>
        )}
      </div>
      <div className="space-y-4 lg:col-span-2">
        {[['Douala, headquarters','12 Port Road, Bonanjo'],['Rotterdam','Waalhaven Zuidzijde 20'],['Dubai','Jebel Ali Free Zone, Gate 4'],['Houston','8800 Bay Area Blvd']].map(location=><div key={location[0]} className="rounded-2xl p-5 ring-1 ring-slate-200"><div className="font-bold" style={{color:D}}>{location[0]}</div><div className="text-sm text-slate-600">{location[1]}</div></div>)}
        <div className="rounded-2xl p-5 text-white" style={{background:D}}><div className="font-bold">24/7 support</div><div className="text-sm text-sky-100">+1 (555) 014 2290 · hello@korvane.example</div></div>
      </div>
    </section>
  );
}

const serviceSolutions = [
  { key: 'road', title: 'Road freight', description: 'Coordinate full-load, part-load, cross-border and final-mile road movements.', detail: 'Share collection and delivery locations, cargo size and target dates. The operations team can help assess routing, handoffs and the documentation needed for the requested lane.' },
  { key: 'sea', title: 'Sea freight', description: 'Plan full-container and shared-container movements with port handling and onward transport.', detail: 'Tell us whether you need a full container or shared space, plus cargo dimensions and ports or inland addresses. Transit estimates depend on sailing schedules, port handling and customs.' },
  { key: 'air', title: 'Air freight', description: 'Explore scheduled air cargo options for shipments where transit time matters.', detail: 'Provide dimensions, weight, commodity details and preferred dates. Acceptance, routing, transit time and handling requirements vary by carrier, destination and cargo type.' },
  { key: 'warehousing', title: 'Warehousing', description: 'Ask about storage, receiving, order preparation and fulfilment coordination.', detail: 'Share expected inventory volumes, storage needs, handling requirements and delivery destinations so the team can confirm suitable facility and service availability.' },
  { key: 'customs', title: 'Customs brokerage', description: 'Get help understanding shipment documents and customs coordination.', detail: 'Customs requirements differ between countries and commodities. Provide the route, goods description and available documents so a specialist can advise what may be required.' },
];

function SolutionsPage() {
  return <>
    <PageHead t="Shipping solutions" s="Compare freight modes and specialist logistics support. Service availability, routing, handling and transit estimates are confirmed for each shipment."/>
    <section className="px-5 py-14 md:px-10">
      <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-2 lg:grid-cols-3">
        {serviceSolutions.map(solution => <a key={solution.key} href={`#/solution-${solution.key}`} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-1 hover:shadow-lg">
          <h2 className="text-xl font-bold" style={{color:D}}>{solution.title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{solution.description}</p>
          <span className="mt-4 inline-block text-sm font-semibold" style={{color:B}}>Explore solution →</span>
        </a>)}
      </div>
      <div className="mx-auto mt-10 max-w-6xl"><Special/></div>
    </section>
    <CTA/>
  </>;
}

function SolutionPage({ solution }) {
  return <>
    <PageHead t={solution.title} s={solution.description}/>
    <section className="mx-auto max-w-4xl space-y-8 px-5 py-14 md:px-10">
      <div className="rounded-2xl bg-sky-50 p-6 ring-1 ring-sky-100 md:p-8">
        <h2 className="text-2xl font-bold" style={{color:D}}>Plan a shipment</h2>
        <p className="mt-3 leading-7 text-slate-600">{solution.detail}</p>
        <a href="#/contact" className="mt-5 inline-block rounded-lg px-5 py-3 text-sm font-semibold text-white" style={{background:B}}>Ask about {solution.title.toLowerCase()}</a>
      </div>
      <div><h2 className="text-2xl font-bold" style={{color:D}}>What to prepare</h2>
        <ul className="mt-4 list-disc space-y-2 pl-6 text-sm leading-6 text-slate-600">
          <li>Collection and delivery addresses, including country and postal code where available.</li>
          <li>Goods description, package type, number of pieces, dimensions and gross weight.</li>
          <li>Preferred collection and delivery dates, plus any handling or temperature requirements.</li>
          <li>Commercial invoices, packing lists, permits or other documents relevant to the shipment.</li>
        </ul>
      </div>
    </section>
    <FaqSec/>
  </>;
}

function GuidesPage() {
  const guides = [
    ['Prepare your cargo', 'Use packaging that protects goods through lifting, stacking and transfers. Mark handling needs clearly and confirm any special packaging or dangerous-goods requirements with the carrier before booking.'],
    ['Gather shipment documents', 'Common documents include a commercial invoice, packing list and transport document. Exact requirements depend on the commodity, route, origin, destination and applicable regulations; ask a specialist before dispatch.'],
    ['Plan customs information', 'Prepare an accurate goods description, quantities, values, origin details and any required permits or certificates. Incorrect or incomplete paperwork can cause clearance delays or additional costs.'],
    ['Understand tracking updates', 'Use the tracking number supplied for the shipment. Status and map position are planning estimates and may not represent continuous GPS data or the carrier’s latest scan. Contact support if an update needs clarification.'],
    ['Protect your cargo', 'Discuss cargo insurance options and exclusions before shipment. Keep shipment records, photographs and supporting documents in case you need to report damage or loss.'],
  ];
  return <>
    <PageHead t="Shipping guides & FAQ" s="Practical preparation notes for freight bookings, paperwork, customs and shipment updates. Requirements vary by cargo and route; confirm details with your logistics specialist."/>
    <section className="mx-auto max-w-5xl space-y-8 px-5 py-14 md:px-10">
      <div className="grid gap-5 md:grid-cols-2">
        {guides.map((guide, index) => <article key={guide[0]} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{color:B}}>Guide {index + 1}</span>
          <h2 className="mt-2 text-xl font-bold" style={{color:D}}>{guide[0]}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{guide[1]}</p>
        </article>)}
      </div>
      <div id="faq"><h2 className="text-3xl font-bold text-center" style={{color:D}}>Frequently asked questions</h2><FAQ/></div>
      <p className="text-center text-sm text-slate-600">Need help with a specific shipment? <a href="#/claims" className="font-semibold underline" style={{color:B}}>Get shipment support</a> or <a href="#/contact" className="font-semibold underline" style={{color:B}}>contact our team</a>.</p>
    </section>
  </>;
}

function LocationsPage() {
  const locations = [
    ['Douala', '12 Port Road, Bonanjo'],
    ['Rotterdam', 'Waalhaven Zuidzijde 20'],
    ['Dubai', 'Jebel Ali Free Zone, Gate 4'],
    ['Houston', '8800 Bay Area Blvd'],
  ];
  return <>
    <PageHead t="Service areas & locations" s="Explore the locations listed by Korvane and ask our team to confirm pickup, delivery and service availability for your exact route."/>
    <section className="mx-auto max-w-6xl px-5 py-14 md:px-10">
      <p className="max-w-3xl text-sm leading-6 text-slate-600">A location listing does not guarantee that every freight service is available in every area. Route coverage depends on the origin, destination, cargo type, carrier capacity and applicable regulations. Contact us with your route to confirm options and obtain a quote.</p>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {locations.map(location => <article key={location[0]} className="rounded-2xl bg-sky-50 p-6 ring-1 ring-sky-100">
          <h2 className="text-xl font-bold" style={{color:D}}>{location[0]}</h2>
          <p className="mt-2 text-sm text-slate-600">{location[1]}</p>
          <a className="mt-4 inline-block text-sm font-semibold underline" style={{color:B}} href="#/contact">Ask about service here</a>
        </article>)}
      </div>
      <div className="mt-10 rounded-2xl bg-slate-900 p-6 text-white md:p-8">
        <h2 className="text-2xl font-bold">Check your route</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-sky-100">Send us your collection and delivery locations, cargo details and preferred dates. We’ll confirm whether a suitable service can be arranged.</p>
        <a href="#/contact" className="mt-5 inline-block rounded-lg bg-white px-5 py-3 text-sm font-semibold" style={{color:B}}>Contact Korvane</a>
      </div>
    </section>
  </>;
}

function ClaimsPage() {
  const [sent, setSent] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fieldClass = 'w-full rounded-lg border border-sky-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-sky-500';

  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const detailText = [
      `Tracking number: ${values.get('tracking_number')}`,
      `Issue type: ${values.get('issue_type')}`,
      `Incident date: ${values.get('incident_date') || 'Not provided'}`,
      `Description: ${values.get('details')}`,
    ].join('\n');
    setBusy(true);
    setError('');
    try {
      const result = await apiRequest('/api/contact', {
        method: 'POST',
        body: {
          name: values.get('name'),
          email: values.get('email'),
          phone: values.get('phone'),
          subject: `Shipment claim / support - ${values.get('tracking_number')}`,
          message: detailText,
        },
      });
      setSent(result.message);
      form.reset();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return <>
    <PageHead t="Claims & shipment support" s="Report a shipment issue or ask for help with a delay, damage or missing cargo. Sending this form contacts the support team; it does not itself determine claim eligibility."/>
    <section className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:px-10 lg:grid-cols-5">
      <div className="space-y-6 lg:col-span-2">
        <h2 className="text-2xl font-bold" style={{color:D}}>Before you submit</h2>
        <ol className="list-decimal space-y-3 pl-5 text-sm leading-6 text-slate-600">
          <li>Keep the tracking number and booking documents available.</li>
          <li>Describe what happened, when it happened and which packages are affected.</li>
          <li>For damage or shortage, retain packaging and take clear photographs where possible.</li>
          <li>Do not send payment card details or sensitive identity documents in this form.</li>
        </ol>
        <p className="text-sm leading-6 text-slate-600">Claim time limits, evidence requirements and available remedies can depend on the shipment contract, carrier and governing law. The support team will advise what information is needed next.</p>
      </div>
      <div className="rounded-3xl bg-sky-50 p-6 ring-1 ring-sky-100 md:p-8 lg:col-span-3">
        {sent ? <div className="py-12 text-center"><h2 className="text-2xl font-bold" style={{color:D}}>Request received</h2><p className="mt-2 text-sm text-slate-600">{sent}</p></div> : (
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <h2 className="text-2xl font-bold sm:col-span-2" style={{color:D}}>Shipment issue form</h2>
            <label className="text-sm font-medium text-slate-700">Your name<input className={`${fieldClass} mt-1.5`} required name="name" maxLength="255"/></label>
            <label className="text-sm font-medium text-slate-700">Email<input className={`${fieldClass} mt-1.5`} required name="email" type="email" maxLength="255"/></label>
            <label className="text-sm font-medium text-slate-700">Phone (optional)<input className={`${fieldClass} mt-1.5`} name="phone" maxLength="50"/></label>
            <label className="text-sm font-medium text-slate-700">Tracking number<input className={`${fieldClass} mt-1.5`} required name="tracking_number" maxLength="50"/></label>
            <label className="text-sm font-medium text-slate-700">Issue type<select className={`${fieldClass} mt-1.5`} name="issue_type"><option>Delay</option><option>Damage</option><option>Missing cargo</option><option>Other shipment support</option></select></label>
            <label className="text-sm font-medium text-slate-700">Incident date (optional)<input className={`${fieldClass} mt-1.5`} name="incident_date" type="date"/></label>
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">What happened?<textarea className={`${fieldClass} mt-1.5`} required name="details" maxLength="5000" rows="5" placeholder="Include affected packages and relevant dates."/></label>
            {error && <p className="text-sm text-red-700 sm:col-span-2" role="alert">{error}</p>}
            <button disabled={busy} className="rounded-lg py-3 font-semibold text-white disabled:opacity-60 sm:col-span-2" style={{background:B}}>{busy ? 'Sending…' : 'Submit support request'}</button>
          </form>
        )}
      </div>
    </section>
  </>;
}

function PolicyPage({ title, intro, sections }) {
  return <>
    <PageHead t={title} s={intro}/>
    <article className="mx-auto max-w-4xl space-y-7 px-5 py-14 md:px-10">
      {sections.map(section => <section key={section[0]}>
        <h2 className="text-xl font-bold" style={{color:D}}>{section[0]}</h2>
        <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-600">{section[1]}</p>
      </section>)}
      <p className="border-t border-slate-200 pt-5 text-sm text-slate-600">Questions? <a href="#/contact" className="font-semibold underline" style={{color:B}}>Contact Korvane</a>.</p>
    </article>
  </>;
}

function CompanyInfoPage({ title, intro, points }) {
  return <>
    <PageHead t={title} s={intro}/>
    <section className="mx-auto max-w-4xl px-5 py-14 md:px-10">
      <div className="rounded-2xl bg-sky-50 p-6 ring-1 ring-sky-100 md:p-8">
        <ul className="space-y-4 text-sm leading-6 text-slate-700">
          {points.map(point => <li key={point[0]}><strong className="text-slate-900">{point[0]}.</strong> {point[1]}</li>)}
        </ul>
        <a href="#/contact" className="mt-6 inline-block rounded-lg px-5 py-3 text-sm font-semibold text-white" style={{background:B}}>Contact Korvane</a>
      </div>
    </section>
  </>;
}

const pages={
'':()=><><Hero/><Ribbon/><About/><Services/><Tracking/><Process/><Gallery/><Banner/><Reviews/><FaqSec/><CTA/></>,
about:()=><><PageHead t="About us" s="Learn about the people, network and customer-first approach behind Korvane. Since our first routes from Douala, we have focused on clear shipment updates and dependable coordination from pickup through delivery."/><About/><Story/><Why/><Network/><CTA/></>,
services:()=><><PageHead t="Services" s="Explore road, sea and air freight alongside warehousing, fulfilment and customs support. We help match each shipment to a practical route and coordinate its key handoffs."/><Services/><Special/><Process/><Gallery/><FaqSec/><CTA/></>,
solutions:()=><SolutionsPage/>,
...Object.fromEntries(serviceSolutions.map(solution => [`solution-${solution.key}`, () => <SolutionPage solution={solution}/>])),
tracking:()=><><PageHead t="Track a shipment" s="Use your tracking ID to check the latest available status and follow important milestones. From pickup and transit to arrival, see the information you need to plan what comes next."/><Tracking/><Process/><FaqSec/></>,
guides:()=><GuidesPage/>,
locations:()=><LocationsPage/>,
claims:()=><ClaimsPage/>,
reviews:()=><><PageHead t="Customer reviews" s="Hear from businesses that rely on Korvane to coordinate freight, manage cross-border details and keep their teams informed as shipments move."/><div className="pt-12"><Reviews/></div><Banner/><CTA/></>,
contact:()=><><PageHead t="Contact" s="Tell us about your cargo, route and timing, or get in touch with a freight specialist. We can help with a quote, service questions and shipment support."/><ContactBody/><FaqSec/></>,
privacy:()=><PolicyPage title="Privacy notice" intro="How information is handled when you use Korvane’s website, tracking and support features." sections={[
  ['Information you provide', 'The contact form collects your name, email address, optional phone number and message. Shipment records include sender and receiver names and addresses, route, cargo details and tracking progress. The live chat stores messages with the associated tracking number.'],
  ['Tracking and shipment information', 'Anyone with a valid tracking number can use the public tracking page. It displays sender and receiver details, cargo information, route coordinates, shipment status and estimated progress. Keep tracking numbers private and share them only with intended recipients.'],
  ['How information is used', 'Information is used to provide shipment tracking, respond to enquiries, operate shipment support and maintain the logistics service. The website sends contact form submissions and tracking chat messages to the configured Korvane backend.'],
  ['Service providers and external links', 'Address geocoding uses OpenStreetMap Nominatim; shipment addresses entered by an administrator are sent to that service to obtain map coordinates. OpenStreetMap tiles are loaded by your browser when a tracking map is shown. WhatsApp links open the WhatsApp service. Those services have their own privacy terms.'],
  ['Storage and security', 'Website information is stored by the configured backend and database. The admin sign-in token and a pending tracking number are held in browser session storage for the current tab session. No specific retention period or security measure is promised here; these depend on the deployed service configuration and applicable law.'],
  ['Your choices and questions', 'Do not submit sensitive information that is not needed for shipment handling. To ask about personal information or request assistance, contact Korvane through the contact page. Applicable rights and response processes depend on the relevant jurisdiction and should be confirmed with the service operator.'],
]}/>,
terms:()=><PolicyPage title="Terms and conditions" intro="General website-use terms for the Korvane Logistics site. Shipment-specific agreements and carrier terms may also apply." sections={[
  ['Website information', 'Website descriptions, service areas and general guidance are provided for informational purposes. They do not constitute a confirmed booking, binding offer, or guarantee that a particular service or route is available. A shipment is accepted only when confirmed under the applicable booking and service agreement.'],
  ['Quotes, transit times and tracking', 'Quotes and transit times may depend on the shipment details, carrier schedules, customs processing and other events outside the website’s control. Public tracking estimates are schedule-based and are not a continuous GPS feed or proof of delivery. Pause controls or tracking status shown on the site reflect data entered into the shipment system.'],
  ['User responsibilities', 'Provide accurate shipment and contact information, protect your tracking number and account credentials, and use the site lawfully. Do not attempt to access another person’s admin account, disrupt the service, or submit unlawful or harmful content.'],
  ['Shipment claims', 'Submitting a support or claim enquiry does not determine liability, claim eligibility or entitlement to compensation. Deadlines, evidence, exclusions and remedies are governed by applicable shipment agreements, carrier conditions and law. Retain booking documents and follow the instructions given by the responsible service provider.'],
  ['Third-party services', 'Maps, address lookup and messaging may rely on third-party services, including OpenStreetMap and WhatsApp. Their services are governed by their own terms and availability. Korvane cannot guarantee the availability or accuracy of external services.'],
  ['Applicable agreement and updates', 'These general website terms do not replace a signed contract, bill of lading, carrier conditions or other shipment-specific agreement. Have these terms reviewed and completed for the operating legal entity and jurisdiction before relying on them. Updated terms will be published on this page with an effective date once established by the service operator.'],
]}/>,
cookies:()=><PolicyPage title="Cookie and browser storage notice" intro="A plain-language explanation of browser storage and third-party services used by the current website." sections={[
  ['Cookies used by this site', 'The current frontend does not intentionally set its own analytics or advertising cookies. Hosting, backend, authentication or future deployment integrations may introduce cookies, so review the live production configuration before making a final compliance statement.'],
  ['Session storage', 'The browser stores a signed-in admin token for the current tab session and may temporarily retain a tracking number while moving from the homepage tracker to the tracking page. This is browser session storage, not a persistent cookie; closing the tab normally clears session storage.'],
  ['External services', 'The tracking map loads tiles from OpenStreetMap in the browser, and WhatsApp links open the WhatsApp service. External providers may process connection data or use their own storage under their privacy and cookie notices. Shipment address geocoding is requested by the backend from OpenStreetMap Nominatim.'],
  ['Managing storage', 'You can clear site data through your browser settings. Clearing session storage may sign you out of the admin portal or remove a tracking number saved during page navigation. If analytics, advertising or consent tools are added later, this notice and any required consent controls should be updated before launch.'],
]}/>,
careers:()=><CompanyInfoPage title="Careers" intro="Interested in working with Korvane? Contact the team to ask about opportunities." points={[
  ['Current openings', 'No live vacancy listings are published on this website at this time.'],
  ['Get in touch', 'Use the contact form to introduce yourself and mention the kind of role or location you are interested in. Avoid sending sensitive personal documents until requested through an appropriate channel.'],
]}/>,
press:()=><CompanyInfoPage title="Press enquiries" intro="For media questions or requests for company information, contact Korvane directly." points={[
  ['Media requests', 'Send your publication, deadline, topic and preferred contact details through the contact page so the request can be routed to the right person.'],
  ['Company information', 'Please confirm any statistics, service details, certifications or operational claims with Korvane before publication.'],
]}/>,
sustainability:()=><CompanyInfoPage title="Sustainability" intro="Ask about the environmental practices and shipment options relevant to your route." points={[
  ['Route-specific information', 'Transport mode, carrier, route and cargo details affect shipment emissions and operational impacts. Ask for information relevant to a specific booking.'],
  ['Avoid unsupported claims', 'No emissions reductions, offsets, certifications or environmental performance data are represented on this page. Request documentation from the service team before relying on any sustainability claim.'],
]}/>,
admin:()=><AdminPortal/>};
const nav=[
  {label:'Home',href:'#/',route:'',items:[['Overview','#/'],['Shipping solutions','#/solutions'],['Request a quote','#/contact']]},
  {label:'About',href:'#/about',route:'about',items:[['Our story','#/about'],['Service areas','#/locations'],['Sustainability','#/sustainability'],['Careers','#/careers'],['Press','#/press']]},
  {label:'Services',href:'#/solutions',route:'solutions',items:[['All solutions','#/solutions'],['Road freight','#/solution-road'],['Sea freight','#/solution-sea'],['Air freight','#/solution-air'],['Warehousing','#/solution-warehousing'],['Customs brokerage','#/solution-customs']]},
  {label:'Tracking',href:'#/tracking',route:'tracking',items:[['Track a shipment','#/tracking'],['Shipping guides & FAQ','#/guides'],['Claims & shipment support','#/claims']]},
  {label:'Reviews',href:'#/reviews',route:'reviews'},
  {label:'Contact',href:'#/contact',route:'contact',items:[['Contact us','#/contact'],['Request a quote','#/contact'],['Live chat','support:live'],['WhatsApp','support:whatsapp']]},
];
const routeMetadata = {
  '': ['Freight forwarding and shipment tracking', 'Coordinate road, sea and air freight with Korvane Logistics. Explore shipping solutions, prepare your shipment and follow progress with shipment tracking.'],
  about: ['About Korvane Logistics', 'Learn about Korvane Logistics, our freight services, operating approach and the locations listed on our site.'],
  services: ['Logistics services', 'Explore road freight, sea freight, air freight, warehousing, fulfilment and customs support from Korvane Logistics.'],
  solutions: ['Shipping solutions', 'Compare road, sea and air freight, warehousing and customs support for your shipment.'],
  tracking: ['Track a shipment', 'Check shipment status, route, estimated transit progress and estimated arrival using your Korvane tracking number.'],
  guides: ['Shipping guides and FAQs', 'Prepare freight, understand common shipping documents, customs information and shipment tracking updates.'],
  locations: ['Service areas and locations', 'View Korvane locations and contact our team to confirm service availability for your route.'],
  claims: ['Claims and shipment support', 'Contact Korvane support about shipment delays, damage, missing cargo or other shipment issues.'],
  reviews: ['Customer reviews', 'Read customer feedback about freight coordination, shipment updates and logistics support.'],
  contact: ['Contact Korvane Logistics', 'Contact Korvane Logistics about freight services, shipment support and route-specific questions.'],
  privacy: ['Privacy notice', 'Learn how shipment, contact and live chat information is handled on the Korvane Logistics website.'],
  terms: ['Terms and conditions', 'Read the general website terms for Korvane Logistics and information about shipment-specific agreements.'],
  cookies: ['Cookie and browser storage notice', 'Learn about browser session storage and third-party services used by the Korvane Logistics website.'],
  careers: ['Careers at Korvane', 'Contact Korvane Logistics to ask about potential career opportunities.'],
  press: ['Press enquiries', 'Contact Korvane Logistics with media enquiries and requests for company information.'],
  sustainability: ['Sustainability enquiries', 'Ask Korvane Logistics for route-specific information about freight options and environmental impacts.'],
};
function App(){
  const [open,setOpen]=useState(false);
  const [mobileSubmenu,setMobileSubmenu]=useState('');
  const get=()=>location.hash.replace(/^#\/?/,'');
  const [r,setR]=useState(get());
  useEffect(()=>{const h=()=>{setR(get());setOpen(false);setMobileSubmenu('');window.scrollTo(0,0)};window.addEventListener('hashchange',h);return()=>window.removeEventListener('hashchange',h)},[]);
  useEffect(() => {
    const solution = serviceSolutions.find(item => `solution-${item.key}` === r);
    const [pageTitle, description] = solution
      ? [solution.title, solution.description]
      : routeMetadata[r] || routeMetadata[''];
    const title = `${pageTitle} | Korvane Logistics`;
    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', title);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', description);
    document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', title);
    document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', description);
    document.querySelector('meta[name="robots"]')?.setAttribute('content', r === 'admin' ? 'noindex,nofollow' : 'index,follow');
  }, [r]);
  function openSupport(view) {
    window.dispatchEvent(new CustomEvent('korvane:open-support', { detail: { view } }));
  }
  function menuLink(link, onNavigate) {
    if (link[1] === 'support:live') {
      return <button key={link[0]} type="button" onClick={() => { openSupport('tracking'); onNavigate?.(); }} className="nav-dropdown-link">{link[0]}</button>;
    }
    if (link[1] === 'support:whatsapp') {
      const whatsappNumber = (import.meta.env.VITE_WHATSAPP_NUMBER || '12025550123').replace(/\D/g, '');
      return <a key={link[0]} href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noreferrer" onClick={onNavigate} className="nav-dropdown-link">{link[0]}</a>;
    }
    return <a key={link[0]} href={link[1]} onClick={onNavigate} className="nav-dropdown-link">{link[0]}</a>;
  }
  const Page=pages[r]||pages[''];
  return (
    <div className="w-full bg-white overflow-hidden">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="flex items-center justify-between px-5 md:px-10 py-4">
          <a href="#/" className="flex items-center gap-2 f font-bold text-xl" style={{color:D}}><svg width="28" height="28" viewBox="0 0 28 28"><path d="M4 4h6v8l8-8h7L15 14l10 10h-7l-8-8v8H4z" fill={B}/></svg>KORVANE</a>
          <nav aria-label="Main navigation" className="hidden lg:flex items-center gap-5 text-sm font-medium">{nav.map(item=><div key={item.label} className="nav-dropdown group">
            <a href={item.href} aria-haspopup={item.items ? 'true' : undefined} className={`nav-dropdown-trigger border-b-2 ${r===item.route?'border-sky-600 text-sky-700':'border-transparent hover:text-sky-700'}`}>
              {item.label}
            </a>
            {item.items && <div className="nav-dropdown-menu" role="group" aria-label={`${item.label} pages`}>
              {item.items.map(link => menuLink(link))}
            </div>}
          </div>)}</nav>
          <a href="#/contact" className="hidden lg:inline rounded-full px-5 py-2 text-sm font-medium text-white" style={{background:B}}>Get a quote</a>
          <button className="lg:hidden rounded-lg p-2 text-xl text-slate-800 hover:bg-sky-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-600" aria-label="Menu" aria-expanded={open} onClick={()=>setOpen(!open)}>☰</button>
        </div>
        {open&&<nav aria-label="Mobile navigation" className="lg:hidden max-h-[calc(100dvh-4.5rem)] overflow-y-auto border-t border-slate-100 px-5 pb-4 text-sm">
          {nav.map(item=><div key={item.label} className="mobile-nav-item">
            <div className="flex items-center justify-between gap-3">
              <a href={item.href} className={`py-2 font-medium ${r===item.route?'text-sky-700':'text-slate-800'}`}>{item.label}</a>
              {item.items && <button type="button" aria-label={`Toggle ${item.label} submenu`} aria-expanded={mobileSubmenu===item.label} onClick={() => setMobileSubmenu(current => current===item.label?'':item.label)} className="px-3 py-2 text-sm text-slate-600">{mobileSubmenu===item.label?'Close':'More'}</button>}
            </div>
            {item.items && mobileSubmenu===item.label && <div className="mobile-nav-submenu">{item.items.map(link => menuLink(link, () => {setOpen(false);setMobileSubmenu('');}))}</div>}
          </div>)}
        </nav>}
      </header>
      <main><Page/></main>
      <Footer/>
      <ChatWidget/>
    </div>
  );
}
export default App;