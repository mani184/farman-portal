require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));

// Package definitions
const packages = [
    { id: 'day_1', name: 'Siku 1', duration: '1 Day', price: 1100, validity: 1440 },
    { id: 'day_2', name: 'Siku 2', duration: '2 Days', price: 1700, validity: 2880 },
    { id: 'week_1', name: 'Wiki 1', duration: '1 Week', price: 5500, validity: 10080 },
    { id: 'month_1', name: 'Mwezi 1', duration: '1 Month', price: 20000, validity: 43200 }
];

// Store pending transactions
const pendingTransactions = new Map();

// ==================== AZAMPAY INTEGRATION ====================

// Get AzamPay OAuth token
async function getAzamPayToken() {
    try {
        const credentials = Buffer.from(
            `${process.env.AZAMPAY_CLIENT_ID}:${process.env.AZAMPAY_CLIENT_SECRET}`
        ).toString('base64');

        const response = await axios.post(
            `${process.env.AZAMPAY_BASE_URL}/auth/realms/tpp/protocol/openid-connect/token`,
            new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: process.env.AZAMPAY_CLIENT_ID,
                client_secret: process.env.AZAMPAY_CLIENT_SECRET
            }),
            {
                headers: {
                    'Authorization': `Basic ${credentials}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        return response.data.access_token;
    } catch (error) {
        console.error('AzamPay Token Error:', error.response?.data || error.message);
        throw error;
    }
}

// Generate AzamPay payment link
async function createAzamPayPayment(phone, amount, packageId, transactionId) {
    try {
        const token = await getAzamPayToken();
        
        const payload = {
            amount: amount,
            currency: 'TZS',
            provider: 'TIGOPESA',
            phone_number: phone.replace(/^255/, ''),
            external_reference: transactionId,
            callback_url: `${process.env.BASE_URL}/payment/callback`,
            remark: `WiFi Package - ${packageId}`
        };

        const response = await axios.post(
            `${process.env.AZAMPAY_BASE_URL}/v1/Payments/StkPush`,
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Client-Id': process.env.AZAMPAY_CLIENT_ID,
                    'X-Client-Secret': process.env.AZAMPAY_CLIENT_SECRET,
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data;
    } catch (error) {
        console.error('AzamPay Error:', error.response?.data || error.message);
        throw error;
    }
}

// Verify AzamPay payment status
async function verifyAzamPayment(externalReference) {
    try {
        const token = await getAzamPayToken();
        
        const response = await axios.get(
            `${process.env.AZAMPAY_BASE_URL}/v1/Payments/query`, 
            {
                params: { external_reference: externalReference },
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Client-Id': process.env.AZAMPAY_CLIENT_ID,
                    'X-Client-Secret': process.env.AZAMPAY_CLIENT_SECRET
                }
            }
        );
        return response.data;
    } catch (error) {
        console.error('AzamPay Verify Error:', error.response?.data || error.message);
        throw error;
    }
}

// ==================== OMADA API INTEGRATION ====================

// Get available vouchers from Omada
async function getOmadaVouchers() {
    try {
        const response = await axios.get(
            `${process.env.OMADA_BASE_URL}/api/v2/hotspot/vouchers`,
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OMADA_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                params: {
                    site: process.env.OMADA_SITE_ID
                }
            }
        );
        return response.data;
    } catch (error) {
        console.error('Omada Get Vouchers Error:', error.response?.data || error.message);
        throw error;
    }
}

// Find unused voucher matching price
async function findVoucherByPrice(price) {
    try {
        const vouchers = await getOmadaVouchers();
        
        // Filter unused vouchers matching the price
        const validVouchers = vouchers.data.filter(v => 
            v.status === 'AVAILABLE' && 
            v.time_limit === price
        );

        if (validVouchers.length === 0) {
            throw new Error('Hakuna vocha inayopatikana kwa bei hii');
        }

        // Return the first available voucher
        return validVouchers[0];
    } catch (error) {
        console.error('Find Voucher Error:', error.message);
        throw error;
    }
}

// Authorize user with voucher in Omada
async function authorizeUserWithVoucher(username, password, packageDuration) {
    try {
        const response = await axios.post(
            `${process.env.OMADA_BASE_URL}/api/v2/hotspot/authorize`,
            {
                user_agent: 'ExternalPortal/1.0',
                username: username,
                password: password,
                session_timeout: packageDuration,
                site: process.env.OMADA_SITE_ID
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OMADA_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        return response.data;
    } catch (error) {
        console.error('Omada Authorize Error:', error.response?.data || error.message);
        throw error;
    }
}

// Use voucher in Omada
async function useVoucher(voucherCode) {
    try {
        const response = await axios.post(
            `${process.env.OMADA_BASE_URL}/api/v2/hotspot/vouchers/use`,
            {
                code: voucherCode,
                site: process.env.OMADA_SITE_ID
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OMADA_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        return response.data;
    } catch (error) {
        console.error('Omada Use Voucher Error:', error.response?.data || error.message);
        throw error;
    }
}

// ==================== ROUTES ====================

// Main page
app.get('/', (req, res) => {
    res.render('index', { 
        packages: packages,
        error: null,
        success: null 
    });
});

// Initiate payment
app.post('/buy', async (req, res) => {
    try {
        const { packageId, phone } = req.body;
        
        // Find selected package
        const selectedPackage = packages.find(p => p.id === packageId);
        if (!selectedPackage) {
            return res.render('index', { 
                packages: packages,
                error: 'Tafadhali chagua kifurushi',
                success: null
            });
        }

        // Validate phone number
        const cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length < 9) {
            return res.render('index', { 
                packages: packages,
                error: 'Namba ya simu si sahihi',
                success: null
            });
        }

        // Create transaction ID
        const transactionId = uuidv4();

        // Store pending transaction
        pendingTransactions.set(transactionId, {
            packageId: selectedPackage.id,
            phone: phone,
            amount: selectedPackage.price,
            createdAt: new Date()
        });

        // Create AzamPay payment
        const payment = await createAzamPayPayment(
            phone,
            selectedPackage.price,
            selectedPackage.id,
            transactionId
        );

        // Render payment pending page with payment URL
        res.render('index', {
            packages: packages,
            error: null,
            success: null,
            showPayment: true,
            paymentUrl: payment.data.checkout_url,
            transactionId: transactionId,
            amount: selectedPackage.price,
            phone: phone
        });

    } catch (error) {
        console.error('Buy Error:', error);
        res.render('index', { 
            packages: packages,
            error: 'Hitilafu imetokea. Jaribu tena.',
            success: null
        });
    }
});

// Check payment status
app.get('/check-payment/:transactionId', async (req, res) => {
    try {
        const { transactionId } = req.params;
        const transaction = pendingTransactions.get(transactionId);

        if (!transaction) {
            return res.json({ status: 'not_found' });
        }

        // Check if transaction is expired (10 minutes)
        const now = new Date();
        const createdAt = new Date(transaction.createdAt);
        const diffMinutes = (now - createdAt) / (1000 * 60);

        if (diffMinutes > 10) {
            pendingTransactions.delete(transactionId);
            return res.json({ status: 'expired' });
        }

        // Verify payment with AzamPay
        const paymentStatus = await verifyAzamPayment(transactionId);

        if (paymentStatus.status === 'COMPLETED') {
            // Payment confirmed - find and use voucher
            const selectedPackage = packages.find(p => p.id === transaction.packageId);
            
            try {
                // Find voucher matching price
                const voucher = await findVoucherByPrice(transaction.amount);
                
                // Use the voucher
                await useVoucher(voucher.code);

                // Delete transaction
                pendingTransactions.delete(transactionId);

                return res.json({ 
                    status: 'success',
                    voucherCode: voucher.code,
                    packageName: selectedPackage.name,
                    packageDuration: selectedPackage.validity
                });
            } catch (voucherError) {
                return res.json({ 
                    status: 'voucher_error',
                    message: voucherError.message
                });
            }
        }

        return res.json({ status: 'pending' });

    } catch (error) {
        console.error('Check Payment Error:', error);
        res.json({ status: 'error' });
    }
});

// Manual voucher login
app.post('/login', async (req, res) => {
    try {
        const { voucherCode } = req.body;

        if (!voucherCode || voucherCode.trim() === '') {
            return res.render('index', { 
                packages: packages,
                error: 'Tafadhali ingiza namba ya vocha',
                success: null
            });
        }

        // Try to authorize with the voucher
        const selectedPackage = packages.find(p => p.id === 'hour_1'); // Default
        await authorizeUserWithVoucher(voucherCode, voucherCode, 60);

        res.render('index', {
            packages: packages,
            error: null,
            success: `Umefanikiwa kuingia! Vocha yako imeunganishwa.`,
            showLoginSuccess: true,
            voucherCode: voucherCode
        });

    } catch (error) {
        console.error('Login Error:', error);
        res.render('index', { 
            packages: packages,
            error: 'Vocha si sahihi au imekwisha tumika',
            success: null
        });
    }
});

// Payment callback from AzamPay
app.post('/payment/callback', async (req, res) => {
    try {
        const { external_reference, status } = req.body;

        if (status === 'COMPLETED') {
            console.log(`Payment completed for transaction: ${external_reference}`);
        }

        res.status(200).json({ received: true });
    } catch (error) {
        console.error('Callback Error:', error);
        res.status(500).json({ error: 'Callback failed' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
