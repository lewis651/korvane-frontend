# Korvane Logistics Frontend

React and Vite frontend for the Korvane Logistics website.

## Local development

1. Start the API from `backend` with `npm run dev`.
2. Start this app from `frontend` with `npm run dev`.
3. Vite proxies `/api` to `http://localhost:5000` during development.
4. Use the tracking form to look up a shipment ID created by an admin. Tracking progress is estimated from the shipment's planned route and duration; it is not a live GPS feed.
5. Open `#/admin` or choose **Admin portal** in the footer to sign in and manage shipments and contact enquiries. Create the initial admin from the backend using its private `SEED_SECRET`.
6. The floating support button offers a five-question FAQ assistant, WhatsApp and shipment-specific live chat. Admins can view and answer live chat conversations from the admin portal. Copy `.env.example` to `.env` and replace `VITE_WHATSAPP_NUMBER` with your WhatsApp number in international format (digits only). The included number is a temporary example. For deployment, configure the same variables in the frontend build environment; set `VITE_API_URL` to the backend origin so Socket.IO can connect to it.

Live chat and message history require the backend and its PostgreSQL database to be running.

The footer links to service solution pages, shipping guides and FAQs, service areas, shipment claims/support, and the Privacy, Terms and Cookie notices. The legal pages are general templates and should be reviewed for the operating company and jurisdictions before production use. Claims and support requests are submitted to the existing contact-message API and appear in the admin portal.

The frontend sets page titles and descriptions as users navigate and includes social-sharing metadata in the HTML entry point. Pages use hash-based routes (`#/...`), which limits how reliably search engines can index each page separately. For stronger per-page organic SEO, migrate to server-backed routes with a production fallback or add prerendering/SSR, and configure the production domain and canonical URLs.

## Commands

- `npm run dev` — start the development server
- `npm run build` — create the production bundle
- `npm run lint` — run Oxlint
- `npm run preview` — preview the production bundle
