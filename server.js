/**
 * Farman Connect - Wi-Fi Captive Portal Server
 * TP-Link Omada Controller Integration with Azam Pay
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const path = require('path');
const axios = require('axios');

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3000;

// Helmet configuration with custom CSP to allow Tailwind CDN
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://cdnjs.cloudflare.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https:", "data:"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https:"],
            frameAncestors: ["'self'"],
            upgradeInsecureRequests: []
        }
    }
}));
app.use(cors());
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Database (using simple in-memory for demo, replace with MySQL in production)
const db = {
    admins: [],
    sites: [
        { id: 1, name: 'Nungwi', location: 'Nungwi Beach', description: 'Nungwi Beach Wi-Fi Zone', omada_site_id: 'site_nungwi', is_active: true },
        { id: 2, name: 'Bububu', location: 'Bububu Town', description: 'Bububu Town Wi-Fi', omada_site_id: 'site_bububu', is_active: true }
    ],
    bundles: [
        { id: 1, name: '1 Hour', description: '1 Hour unlimited access', duration_hours: 1, price: 500, currency: 'TZS', is_active: true },
        { id: 2, name: '2 Hours', description: '2 Hours unlimited access', duration_hours: 2, price: 900, currency: 'TZS', is_active: true },
        { id: 3, name: '1 Day', description: '24 Hours unlimited access', duration_hours: 24, price: 2000, currency: 'TZS', is_active: true },
        { id: 4, name: '1 Week', description: '7 Days unlimited access', duration_hours: 168, price: 10000, currency: 'TZS', is_active: true },
        { id: 5, name: '1 Month', description: '30 Days unlimited access', duration_hours: 720, price: 35000, currency: 'TZS', is_active: true }
    ],
    devices: [],
    clients: [],
    transactions: [],
    portalConfig: {
        title: 'Farman Connect',
        subtitle: 'Welcome to Farman Connect Wi-Fi',
        primaryColor: '#2563eb',
        backgroundColor: '#1e3a8a',
        logoUrl: ''
    }
};

// Default admin (password: admin123)
db.admins.push({
    id: 1,
    username: 'admin',
    email: 'abdulrahmankhatiba@gmail.com',
    password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // admin123
    fullName: 'System Administrator',
    role: 'super_admin'
});

// ==================== CLIENT PORTAL ROUTES ====================

// Get available bundles
app.get('/api/bundles', (req, res) => {
    const activeBundles = db.bundles.filter(b => b.is_active).sort((a, b) => a.sort_order - b.sort_order);
    res.json({
        success: true,
        data: activeBundles
    });
});

// Get portal configuration
app.get('/api/config', (req, res) => {
    res.json({
        success: true,
        data: db.portalConfig
    });
});

// Get sites
app.get('/api/sites', (req, res) => {
    res.json({
        success: true,
        data: db.sites.filter(s => s.is_active)
    });
});

// Mobile networks
const MOBILE_NETWORKS = [
    { id: 'vodacom', name: 'Vodacom', color: '#e60000' },
    { id: 'tigo', name: 'Tigo', color: '#ff6600' },
    { id: 'airtel', name: 'Airtel', color: '#ff0000' },
    { id: 'halotel', name: 'Halotel', color: '#00a651' }
];

app.get('/api/networks', (req, res) => {
    res.json({
        success: true,
        data: MOBILE_NETWORKS
    });
});

// Initialize payment with Azam Pay
app.post('/api/payment/initiate', async (req, res) => {
    try {
        const { bundleId, network, phone, mac } = req.body;
        
        const bundle = db.bundles.find(b => b.id === parseInt(bundleId));
        if (!bundle) {
            return res.status(400).json({ success: false, message: 'Invalid bundle' });
        }

        const clientId = 'CLIENT-' + Math.random().toString(36).substring(2, 10).toUpperCase();
        
        // Create pending transaction
        const transaction = {
            id: db.transactions.length + 1,
            transaction_id: 'TXN-' + Date.now(),
            client_id: clientId,
            bundle_id: bundle.id,
            amount: bundle.price,
            currency: bundle.currency,
            network: network,
            phone: phone,
            mac_address: mac,
            status: 'pending',
            payment_method: 'mobile',
            created_at: new Date()
        };
        
        db.transactions.push(transaction);

        // In production, this would call Azam Pay API
        // For demo, we'll simulate the payment flow
        const paymentResponse = {
            success: true,
            data: {
                transaction_id: transaction.transaction_id,
                client_id: clientId,
                amount: bundle.price,
                currency: bundle.currency,
                network: network,
                checkout_url: `${process.env.APP_URL || 'http://localhost:3000'}/payment.html?txn=${transaction.transaction_id}&client=${clientId}`,
                expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
            }
        };

        res.json(paymentResponse);
    } catch (error) {
        console.error('Payment initiation error:', error);
        res.status(500).json({ success: false, message: 'Payment initialization failed' });
    }
});

// Payment webhook (Azam Pay callback)
app.post('/api/payment/webhook', async (req, res) => {
    try {
        const { transactionId, status, reference, amount } = req.body;
        
        console.log('Payment webhook received:', req.body);
        
        // Find transaction
        const transaction = db.transactions.find(t => t.transaction_id === transactionId);
        if (!transaction) {
            return res.status(404).json({ success: false, message: 'Transaction not found' });
        }

        if (status === 'SUCCESS' || status === 'completed') {
            transaction.status = 'completed';
            transaction.azampay_ref = reference;
            
            const bundle = db.bundles.find(b => b.id === transaction.bundle_id);
            
            // Create client session
            const client = {
                id: db.clients.length + 1,
                client_id: transaction.client_id,
                mac_address: transaction.mac_address,
                bundle_id: transaction.bundle_id,
                site_id: 1,
                phone: transaction.phone,
                network: transaction.network,
                authorized_at: new Date(),
                expires_at: new Date(Date.now() + bundle.duration_hours * 60 * 60 * 1000),
                is_active: true
            };
            
            db.clients.push(client);
            
            // Call Omada Controller API to authorize MAC
            await authorizeMacOnOmada(transaction.mac_address, bundle.duration_hours);
            
            res.json({ success: true, message: 'Payment confirmed, client authorized' });
        } else {
            transaction.status = 'failed';
            res.json({ success: false, message: 'Payment not successful' });
        }
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ success: false, message: 'Webhook processing failed' });
    }
});

// Check client status
app.get('/api/client/status', (req, res) => {
    const { clientId } = req.query;
    
    const client = db.clients.find(c => c.client_id === clientId);
    if (!client) {
        return res.json({ success: false, message: 'Client not found' });
    }
    
    const isActive = client.is_active && new Date(client.expires_at) > new Date();
    
    res.json({
        success: true,
        data: {
            client_id: client.client_id,
            is_active: isActive,
            expires_at: client.expires_at,
            remaining_seconds: Math.max(0, Math.floor((new Date(client.expires_at) - new Date()) / 1000))
        }
    });
});

// ==================== OMADA CONTROLLER INTEGRATION ====================

async function authorizeMacOnOmada(macAddress, durationHours) {
    try {
        const omadaUrl = process.env.OMADA_BASE_URL;
        const siteId = process.env.OMADA_SITE_ID || 'default';
        
        // Omada Controller API v2/v3 for MAC authorization
        // Note: This is a simplified example - actual API depends on your Omada version
        
        console.log(`Authorizing MAC ${macAddress} on Omada Controller for ${durationHours} hours`);
        
        // In production, you would make actual API call:
        // const response = await axios.post(`${omadaUrl}/api/v2/sites/${siteId}/portal/authorize`, {
        //     mac: macAddress,
        //     duration: durationHours * 3600
        // });
        
        return { success: true, message: 'MAC authorized on Omada' };
    } catch (error) {
        console.error('Omada authorization error:', error);
        // Continue even if Omada fails - we have local record
        return { success: false, message: 'Omada authorization failed' };
    }
}

// Verify MAC on Omada
app.get('/api/omada/verify', async (req, res) => {
    const { mac } = req.query;
    
    // Check if client exists in our database
    const client = db.clients.find(c => c.mac_address === mac && c.is_active);
    
    if (client && new Date(client.expires_at) > new Date()) {
        return res.json({
            success: true,
            authorized: true,
            expires_at: client.expires_at
        });
    }
    
    res.json({
        success: true,
        authorized: false
    });
});

// ==================== ADMIN ROUTES ====================

// Admin login
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    
    const admin = db.admins.find(a => a.username === username);
    if (!admin) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    // Simple password check (in production, use bcrypt)
    // For demo: admin123
    if (password !== 'admin123') {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    // Generate simple token (in production, use JWT)
    const token = Buffer.from(`${admin.id}:${admin.username}`).toString('base64');
    
    res.json({
        success: true,
        data: {
            token: token,
            admin: {
                id: admin.id,
                username: admin.username,
                fullName: admin.fullName,
                role: admin.role
            }
        }
    });
});

// Admin middleware
const adminAuth = (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    next();
};

// Dashboard stats
app.get('/api/admin/dashboard', adminAuth, (req, res) => {
    const today = new Date().toDateString();
    const todayTransactions = db.transactions.filter(t => 
        new Date(t.created_at).toDateString() === today && t.status === 'completed'
    );
    
    const todayRevenue = todayTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const activeClients = db.clients.filter(c => c.is_active && new Date(c.expires_at) > new Date()).length;
    
    res.json({
        success: true,
        data: {
            today_sales: todayRevenue,
            today_transactions: todayTransactions.length,
            active_users: activeClients,
            total_sites: db.sites.filter(s => s.is_active).length,
            total_bundles: db.bundles.filter(b => b.is_active).length,
            recent_transactions: db.transactions.slice(-10).reverse()
        }
    });
});

// Get sites
app.get('/api/admin/sites', adminAuth, (req, res) => {
    res.json({ success: true, data: db.sites });
});

// Create site
app.post('/api/admin/sites', adminAuth, (req, res) => {
    const { name, location, description, omada_site_id } = req.body;
    const site = {
        id: db.sites.length + 1,
        name,
        location,
        description,
        omada_site_id,
        is_active: true,
        created_at: new Date()
    };
    db.sites.push(site);
    res.json({ success: true, data: site });
});

// Get bundles
app.get('/api/admin/bundles', adminAuth, (req, res) => {
    res.json({ success: true, data: db.bundles });
});

// Create bundle
app.post('/api/admin/bundles', adminAuth, (req, res) => {
    const { name, description, duration_hours, price, sort_order } = req.body;
    const bundle = {
        id: db.bundles.length + 1,
        name,
        description,
        duration_hours,
        price,
        currency: 'TZS',
        is_active: true,
        sort_order: sort_order || db.bundles.length + 1,
        created_at: new Date()
    };
    db.bundles.push(bundle);
    res.json({ success: true, data: bundle });
});

// Update bundle
app.put('/api/admin/bundles/:id', adminAuth, (req, res) => {
    const id = parseInt(req.params.id);
    const index = db.bundles.findIndex(b => b.id === id);
    if (index === -1) {
        return res.status(404).json({ success: false, message: 'Bundle not found' });
    }
    db.bundles[index] = { ...db.bundles[index], ...req.body };
    res.json({ success: true, data: db.bundles[index] });
});

// Delete bundle
app.delete('/api/admin/bundles/:id', adminAuth, (req, res) => {
    const id = parseInt(req.params.id);
    const index = db.bundles.findIndex(b => b.id === id);
    if (index === -1) {
        return res.status(404).json({ success: false, message: 'Bundle not found' });
    }
    db.bundles.splice(index, 1);
    res.json({ success: true, message: 'Bundle deleted' });
});

// Get devices
app.get('/api/admin/devices', adminAuth, (req, res) => {
    res.json({ success: true, data: db.devices });
});

// Get portal config
app.get('/api/admin/portal-config', adminAuth, (req, res) => {
    res.json({ success: true, data: db.portalConfig });
});

app.put('/api/admin/portal-config', adminAuth, (req, res) => {
    db.portalConfig = { ...db.portalConfig, ...req.body };
    res.json({ success: true, data: db.portalConfig });
});

// Get profile
app.get('/api/admin/profile', adminAuth, (req, res) => {
    // Get admin from token (simplified)
    res.json({ success: true, data: db.admins[0] });
});

app.put('/api/admin/profile', adminAuth, (req, res) => {
    const { fullName, email } = req.body;
    db.admins[0].fullName = fullName || db.admins[0].fullName;
    db.admins[0].email = email || db.admins[0].email;
    res.json({ success: true, data: db.admins[0] });
});
app.get('/api/admin/transactions', adminAuth, (req, res) => {
    const { page = 1, limit = 20, status, network } = req.query;
    let filtered = [...db.transactions];
    
    if (status) filtered = filtered.filter(t => t.status === status);
    if (network) filtered = filtered.filter(t => t.network === network);
    
    const start = (page - 1) * limit;
    const paginated = filtered.slice(start, start + parseInt(limit));
    
    res.json({
        success: true,
        data: {
            transactions: paginated,
            total: filtered.length,
            page: parseInt(page),
            total_pages: Math.ceil(filtered.length / limit)
        }
    });
});

// Revenue report
app.get('/api/admin/revenue', adminAuth, (req, res) => {
    const { period = 'daily' } = req.query;
    const completed = db.transactions.filter(t => t.status === 'completed');
    
    // Group by date
    const revenueByDate = {};
    completed.forEach(t => {
        const date = new Date(t.created_at).toDateString();
        if (!revenueByDate[date]) {
            revenueByDate[date] = { amount: 0, count: 0 };
        }
        revenueByDate[date].amount += parseFloat(t.amount);
        revenueByDate[date].count += 1;
    });
    
    const totalRevenue = completed.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    res.json({
        success: true,
        data: {
            total_revenue: totalRevenue,
            total_transactions: completed.length,
            by_date: revenueByDate
        }
    });
});

// Analytics
app.get('/api/admin/analytics', adminAuth, (req, res) => {
    const { period = '7days' } = req.query;
    
    // Generate sample analytics data
    const analytics = {
        active_clients: db.clients.filter(c => c.is_active && new Date(c.expires_at) > new Date()).length,
        peak_hours: [
            { hour: '08:00', clients: 45 },
            { hour: '12:00', clients: 78 },
            { hour: '18:00', clients: 92 },
            { hour: '21:00', clients: 65 }
        ],
        top_sites: db.sites.map(s => ({ name: s.name, clients: Math.floor(Math.random() * 50) + 10 })),
        network_usage: MOBILE_NETWORKS.map(n => ({ 
            network: n.name, 
            percentage: Math.floor(Math.random() * 40) + 10 
        }))
    };
    
    res.json({ success: true, data: analytics });
});

// Portal settings
app.get('/api/admin/portal-config', adminAuth, (req, res) => {
    res.json({ success: true, data: db.portalConfig });
});

app.put('/api/admin/portal-config', adminAuth, (req, res) => {
    db.portalConfig = { ...db.portalConfig, ...req.body };
    res.json({ success: true, data: db.portalConfig });
});

// Profile
app.get('/api/admin/profile', adminAuth, (req, res) => {
    // Get admin from token (simplified)
    res.json({ success: true, data: db.admins[0] });
});

app.put('/api/admin/profile', adminAuth, (req, res) => {
    const { fullName, email } = req.body;
    db.admins[0].fullName = fullName || db.admins[0].fullName;
    db.admins[0].email = email || db.admins[0].email;
    res.json({ success: true, data: db.admins[0] });
});

// ==================== FRONTEND ROUTES ====================

// Serve client portal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve admin pages
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'admin.html'));
});

app.get('/admin/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'login.html'));
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Farman Connect server running on port ${PORT}`);
    console.log(`Client portal: http://localhost:${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin`);
});

module.exports = app;
