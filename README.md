# Farman Connect - Wi-Fi Captive Portal

A complete Wi-Fi Captive Portal system for TP-Link Omada Controller with Azam Pay integration.

## Features

### Client Portal
- Bundle selection with multiple pricing plans (1hr, 2hr, 1day, 1week, 1month)
- Mobile network selection (Vodacom, Tigo, Airtel, Halotel)
- Azam Pay payment gateway integration
- Real-time payment confirmation via webhook

### Admin Panel
- **Dashboard** - Overview of active users, today's sales, recent transactions
- **Sites** - Manage Wi-Fi locations (Nungwi, Bububu, etc.)
- **Devices** - Monitor Access Points status
- **Bundles** - Create/Edit pricing plans
- **Portal** - Customize client-facing page
- **Analytics** - Usage patterns and graphs
- **Revenue** - Financial reports
- **Billing** - Transaction history
- **Profile** - Admin settings

## Tech Stack

- **Backend**: Node.js + Express
- **Database**: MySQL (with in-memory fallback for demo)
- **Frontend**: HTML5 + Tailwind CSS + Chart.js
- **Payment**: Azam Pay API
- **Captive Portal**: TP-Link Omada Controller API v2/v3

## Installation

1. **Install dependencies**:
```bash
npm install
```

2. **Configure environment**:
Edit `.env` file with your settings:
- Database credentials
- Omada Controller URL and API keys
- Azam Pay credentials
- Ngrok URL for webhook forwarding

3. **Set up database**:
```bash
mysql -u root -p < database/schema.sql
```

4. **Start the server**:
```bash
npm start
```

5. **Access the portal**:
- Client Portal: http://localhost:3000
- Admin Panel: http://localhost:3000/admin
- Admin Login: http://localhost:3000/admin/login

## Demo Credentials

- **Username**: admin
- **Password**: admin123

## Ngrok Setup

For payment webhooks to work in development:

1. Start ngrok:
```bash
ngrok http 3000
```

2. Update `.env` with your ngrok URL:
```
NGROK_URL=https://your-ngrok-url.ngrok-free.dev
```

3. Configure Azam Pay webhook URL to point to your ngrok URL + `/api/payment/webhook`

## Omada Controller Integration

The system integrates with TP-Link Omada Controller via the External Portal API:

1. Configure your Omada Controller to use external portal
2. Set the redirect URL to your Farman Connect portal
3. The system will authorize MAC addresses after successful payment

## API Endpoints

### Client APIs
- `GET /api/bundles` - Get available bundles
- `GET /api/networks` - Get mobile networks
- `POST /api/payment/initiate` - Initialize payment
- `POST /api/payment/webhook` - Payment callback
- `GET /api/client/status` - Check client status

### Admin APIs
- `POST /api/admin/login` - Admin login
- `GET /api/admin/dashboard` - Dashboard stats
- `GET/POST /api/admin/sites` - Manage sites
- `GET/POST /api/admin/bundles` - Manage bundles
- `GET /api/admin/devices` - List devices
- `GET /api/admin/transactions` - Transaction history
- `GET /api/admin/revenue` - Revenue reports
- `GET /api/admin/analytics` - Usage analytics

## File Structure

```
farman-connect/
├── package.json
├── server.js
├── .env
├── database/
│   └── schema.sql
├── public/
│   ├── index.html          # Client portal
│   ├── success.html        # Payment success
│   ├── error.html          # Payment error
│   └── admin/
│       ├── login.html       # Admin login
│       └── admin.html       # Admin panel
```

## License

MIT License - Farman Connect
