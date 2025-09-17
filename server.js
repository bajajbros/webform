// server.js
import express from 'express';
import dotenv from 'dotenv';
import { Resend } from 'resend';
import cors from 'cors';
// Google Sheets API is no longer used, so remove the import.
// import { google } from 'googleapis'; 

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

// --- REMOVED: All Google Sheets API code below this line ---
// Google Sheets configuration and authentication logic is removed.
// The `appendToSheet` function is also removed.
// --- END OF REMOVED CODE ---

// URL of your Google Apps Script Web App
const GOOGLE_APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxA55iXO7PW6pTEGRZ2NkmrwM1h0iL9XIAlazPEdwLlQE3vTyNE6X1bg-yRmsHXnlnA/exec';

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

    let emailSent = false;
    let sheetUpdated = false;

    // Send email using Resend
    try {
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

    // Save to Google Sheet using the Apps Script Web App
    try {
        console.log('📝 Attempting to post data to Google Apps Script.');
        
        // The Apps Script expects a 'message' key, so we map 'details' to 'message'.
        const response = await fetch(GOOGLE_APP_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: name,
                email: email,
                message: details
            }),
        });

        if (response.ok) {
            const result = await response.json();
            if (result.result === 'success') {
                sheetUpdated = true;
                console.log('✅ Data successfully added to Google Sheet via Apps Script.');
            } else {
                console.error('❌ Apps Script returned a non-success result:', result);
            }
        } else {
            console.error('❌ Failed to post data to Apps Script. Status:', response.status);
        }
    } catch (err) {
        console.error('Google Apps Script error:', err);
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
