// server.js
import express from 'express';
import dotenv from 'dotenv';
import { Resend } from 'resend';
import cors from 'cors';

dotenv.config();

const app = express();
const PORT = 5050; // 🔄 changed from 5000

// ✅ CORS fix: Allow all origins for testing (safe only in dev)
app.use(cors()); // You can later restrict origin here
app.use(express.json());

const resend = new Resend(process.env.RESEND_API_KEY);
const toEmail = process.env.TO_EMAIL;
const fromEmail = process.env.FROM_EMAIL;

// ✅ Handle preflight (OPTIONS) requests explicitly
app.options('/api/submit-form', cors());

app.post('/api/submit-form', async (req, res) => {
    const { name, email, details } = req.body;

    if (!name || !email || !details) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!toEmail || !fromEmail) {
        return res.status(500).json({ error: 'Server configuration error' });
    }

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
            console.error(error);
            return res.status(500).json({ error: 'Email failed to send' });
        }

        res.status(200).json({ message: 'Success!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Backend running at http://localhost:${PORT}`);
});
