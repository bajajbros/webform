// server.js
import express from 'express';
import dotenv from 'dotenv';
import { Resend } from 'resend';
import cors from 'cors';
import { google } from 'googleapis';

dotenv.config();

const app = express();
const PORT = 5050;

// CORS configuration
app.use(cors());
app.use(express.json());

// Resend configuration
const resend = new Resend(process.env.RESEND_API_KEY);
const toEmail = process.env.TO_EMAIL;
const fromEmail = process.env.FROM_EMAIL;

// Google Sheets configuration
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const SHEET_NAME = process.env.GOOGLE_SHEET_NAME || 'Form Submissions';

// Configure Google Sheets authentication
let auth;

if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64) {
    // For production (Render) - using Base64 encoded credentials
    try {
        const decodedKey = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf8');
        const credentials = JSON.parse(decodedKey);
        console.log('🔑 Using Base64 credentials');
        auth = new google.auth.GoogleAuth({
            credentials: credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
    } catch (error) {
        console.error('❌ Error parsing Base64 credentials:', error);
    }
} else if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE) {
    // For local development - using key file path
    console.log('🔑 Using local key file');
    auth = new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
} else {
    console.error('❌ Google Sheets authentication not configured');
}

const sheets = google.sheets({ version: 'v4', auth });

// Function to append data to Google Sheet
async function appendToSheet(name, email, details) {
    try {
        console.log('📝 Attempting to append data to sheet:', SPREADSHEET_ID);

        const timestamp = new Date().toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        const values = [[timestamp, name, email, details]];

        console.log('📊 Data to append:', values);

        const response = await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A:D`,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values,
            },
        });

        console.log('✅ Data successfully added to Google Sheet:', response.data);
        return true;
    } catch (error) {
        console.error('❌ Error adding data to Google Sheet:');
        console.error('Error message:', error.message);
        console.error('Error details:', error.response?.data || error);
        return false;
    }
}

// Handle preflight (OPTIONS) requests
app.options('/api/submit-form', cors());

app.post('/api/submit-form', async (req, res) => {
    const { name, email, details } = req.body;

    // Validate required fields
    if (!name || !email || !details) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!toEmail || !fromEmail) {
        return res.status(500).json({ error: 'Server configuration error' });
    }

    if (!SPREADSHEET_ID) {
        return res.status(500).json({ error: 'Google Sheets not configured' });
    }

    let emailSent = false;
    let sheetUpdated = false;

    try {
        // Send email using Resend
        const { error } = await resend.emails.send({
            from: `Website Inquiry <${fromEmail}>`,
            to: [toEmail],
            subject: `New Project Inquiry from ${name}`,
            replyTo: email,
            html: `
        <h1>New Project Inquiry</h1>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
        <h3>Project Details:</h3>
        <p>${details}</p>
      `,
        });

        if (error) {
            console.error('Email error:', error);
        } else {
            emailSent = true;
            console.log('✅ Email sent successfully');
        }
    } catch (err) {
        console.error('Email sending error:', err);
    }

    try {
        // Save to Google Sheet
        sheetUpdated = await appendToSheet(name, email, details);
    } catch (err) {
        console.error('Google Sheet error:', err);
    }

    // Return response based on what succeeded
    if (emailSent && sheetUpdated) {
        res.status(200).json({
            message: 'Success! Data saved and email sent.',
            email: true,
            sheet: true
        });
    } else if (emailSent) {
        res.status(200).json({
            message: 'Email sent but failed to save to sheet.',
            email: true,
            sheet: false
        });
    } else if (sheetUpdated) {
        res.status(200).json({
            message: 'Data saved to sheet but email failed to send.',
            email: false,
            sheet: true
        });
    } else {
        res.status(500).json({
            error: 'Both email and sheet operations failed.',
            email: false,
            sheet: false
        });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Backend running at http://localhost:${PORT}`);
});