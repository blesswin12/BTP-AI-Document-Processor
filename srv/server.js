const cds = require('@sap/cds');
const multer = require('multer');
const FormData = require('form-data');
const axios = require('axios');

// ─────────────────────────────────────────────────────────────
// Credentials: local = default-env.json, CF = VCAP_SERVICES
// ─────────────────────────────────────────────────────────────
let DIEX_URL, TOKEN_URL, CLIENT_ID, CLIENT_SECRET;

if (process.env.VCAP_SERVICES) {
    console.log('🔧 Loading credentials from VCAP_SERVICES (CF)...');
    const vcap = JSON.parse(process.env.VCAP_SERVICES);
    const diexService = (
        vcap['document-information-extraction-trial'] ||
        vcap['document-information-extraction'] || []
    )[0];

    if (!diexService) throw new Error('❌ DIEx service not found in VCAP_SERVICES!');

    const creds   = diexService.credentials;
    DIEX_URL      = creds.url;
    TOKEN_URL     = creds.uaa.url + '/oauth/token';
    CLIENT_ID     = creds.uaa.clientid;
    CLIENT_SECRET = creds.uaa.clientsecret;
    console.log('✅ CF credentials loaded. DIEX_URL:', DIEX_URL);

} else {
    console.log('🔧 Loading credentials from default-env.json (local)...');
    const destinations = require('../default-env.json').destinations;
    const dest = destinations.find(d => d.name === 'doc-ai-destination');
    if (!dest) throw new Error('❌ "doc-ai-destination" not found in default-env.json!');

    DIEX_URL      = dest.url;
    TOKEN_URL     = dest.tokenServiceUrl;
    CLIENT_ID     = dest.clientId;
    CLIENT_SECRET = dest.clientSecret;
    console.log('✅ Local credentials loaded. DIEX_URL:', DIEX_URL);
}

console.log('   TOKEN_URL :', TOKEN_URL);
console.log('   CLIENT_ID :', CLIENT_ID);
console.log('   SECRET    :', CLIENT_SECRET ? '✅ present' : '❌ MISSING');

// ─────────────────────────────────────────────────────────────
// Document Type → DIEx Schema mapping
// ─────────────────────────────────────────────────────────────
const SCHEMA_MAP = {
    invoice:       'SAP_invoice_schema',
    purchaseOrder: 'SAP_purchase_order_schema',
    receipt:       'SAP_receipt_schema',
    bankStatement: 'SAP_bank_statement_schema'
};

// ─────────────────────────────────────────────────────────────
// Helper: fetch OAuth2 access token from UAA
// ─────────────────────────────────────────────────────────────
async function getAccessToken() {
    const response = await axios.post(
        TOKEN_URL,
        'grant_type=client_credentials',
        {
            auth: { username: CLIENT_ID, password: CLIENT_SECRET },
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }
    );
    return response.data.access_token;
}

// ─────────────────────────────────────────────────────────────
// Multer: PDFs only, max 10 MB, stored in memory
// ─────────────────────────────────────────────────────────────
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
            return cb(new Error('Only PDF files are accepted.'), false);
        }
        cb(null, true);
    }
});

// ─────────────────────────────────────────────────────────────
// CAP Bootstrap: register all custom Express routes
// ─────────────────────────────────────────────────────────────
cds.on('bootstrap', (app) => {

    // ── POST /api/uploadDocument ─────────────────────────────
    app.post('/api/uploadDocument', upload.single('file'), async (req, res) => {

        // STEP 1: Validate file
        if (!req.file) {
            console.warn('⚠️  No file in request.');
            return res.status(400).json({ error: 'No file uploaded. Please select a PDF.' });
        }
        console.log(`✅ STEP 1 OK — File: "${req.file.originalname}" | ${req.file.size} bytes | ${req.file.mimetype}`);

        const documentType = req.query.documentType || req.body.documentType || 'invoice';
        const schemaName   = SCHEMA_MAP[documentType] || SCHEMA_MAP['invoice'];
        console.log(`   Document type: ${documentType} | Schema: ${schemaName}`);

        // STEP 2: Build FormData
        let formData;
        try {
            formData = new FormData();
            formData.append('file', req.file.buffer, {
                filename:    req.file.originalname,
                contentType: 'application/pdf',
                knownLength: req.file.size
            });
            formData.append('options', JSON.stringify({
                clientId:      'default',
                schemaName:    schemaName,
                documentType:  documentType,
                extractAction: 'extraction'
            }));
            console.log('✅ STEP 2 OK — FormData ready.');
        } catch (err) {
            console.error('❌ STEP 2 FAILED:', err.message);
            return res.status(500).json({ error: 'Failed to build request payload.' });
        }

        // STEP 3: Get OAuth token
        let accessToken;
        try {
            console.log('⏳ STEP 3 — Fetching OAuth token from UAA...');
            accessToken = await getAccessToken();
            console.log('✅ STEP 3 OK — Token acquired.');
        } catch (err) {
            console.error('❌ STEP 3 FAILED:', err.message);
            if (err.response) {
                console.error('   HTTP status:', err.response.status);
                console.error('   HTTP body  :', JSON.stringify(err.response.data));
            }
            return res.status(500).json({
                error:    'Failed to get OAuth token from UAA.',
                details:  err.message,
                uaaError: err.response?.data
            });
        }

        // STEP 4: Call DIEx API
        let response;
        try {
            console.log('⏳ STEP 4 — Calling SAP DIEx API...');
            response = await axios.post(
                `${DIEX_URL}/document-information-extraction/v1/document/jobs`,
                formData,
                {
                    headers: {
                        ...formData.getHeaders(),
                        'Authorization': `Bearer ${accessToken}`
                    }
                }
            );
            console.log(`✅ STEP 4 OK — DIEx status: ${response.status}`);
        } catch (err) {
            console.error('❌ STEP 4 FAILED:', err.message);
            if (err.response) {
                console.error('   HTTP status:', err.response.status);
                console.error('   HTTP body  :', JSON.stringify(err.response.data, null, 2));
            }
            return res.status(err.response?.status || 500).json({
                error:        'SAP DIEx API returned an error.',
                httpStatus:   err.response?.status,
                serviceError: err.response?.data
            });
        }

        // STEP 5: Return job ID to frontend
        console.log('✅ STEP 5 OK — Sending result to frontend.');
        return res.status(200).json(response.data);
    });

    // ── GET /api/getJobResult?jobId=xxx ──────────────────────
    app.get('/api/getJobResult', async (req, res) => {
        const jobId = req.query.jobId;

        if (!jobId) {
            return res.status(400).json({ error: 'Missing jobId query parameter.' });
        }

        try {
            console.log('🔄 Polling DIEx for job:', jobId);
            const accessToken = await getAccessToken();

            const response = await axios.get(
                `${DIEX_URL}/document-information-extraction/v1/document/jobs/${jobId}`,
                { headers: { 'Authorization': `Bearer ${accessToken}` } }
            );

            console.log('   Job status:', response.data.status);
            return res.status(200).json(response.data);

        } catch (err) {
            console.error('❌ Poll error:', err.message);
            return res.status(err.response?.status || 500).json({
                error:        'Failed to poll job status.',
                serviceError: err.response?.data
            });
        }
    });

}); // ← END of cds.on('bootstrap')

module.exports = cds.server;
