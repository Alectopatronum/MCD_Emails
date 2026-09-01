require('dotenv').config();
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const csv = require('csv-parser');
const axios = require('axios');

// Load configurations
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_SUBJECT = process.env.EMAIL_SUBJECT || "MCD Senior Associate Deployments";
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || "Marketing & Communications Department - MEA";
const GOOGLE_SHEET_CSV_URL = process.env.GOOGLE_SHEET_CSV_URL;
const LOCAL_CSV_PATH = path.join(__dirname, 'recipients.csv');
const TEMPLATE_PATH = path.join(__dirname, 'template.html');

// Helper to resolve image path (prefer optimized jpeg/png if present)
function getImagePath(baseNameNoExt) {
    const optJpg = path.join(__dirname, 'Pubs', 'optimized', `${baseNameNoExt}.jpg`);
    const optPng = path.join(__dirname, 'Pubs', 'optimized', `${baseNameNoExt}.png`);
    const rawPng = path.join(__dirname, 'Pubs', `${baseNameNoExt}.png`);

    if (fs.existsSync(optJpg)) return optJpg;
    if (fs.existsSync(optPng)) return optPng;
    if (fs.existsSync(rawPng)) return rawPng;
    return null;
}

const IMAGE_CONFIGS = [
    { name: 'senior_assoc_deployments', cid: 'imgDeployments' },
    { name: 'senior_assoc_dates_1', cid: 'imgDates1' },
    { name: 'senior_assocs_dates_2', cid: 'imgDates2' },
    { name: 'senior_assoc_important_dates', cid: 'imgImportantDates' },
];

// Ensure essential env vars are set
if (!EMAIL_USER || !EMAIL_PASS) {
    console.error("❌ ERROR: EMAIL_USER and EMAIL_PASS must be set in .env");
    process.exit(1);
}

// Ensure the email template exists
if (!fs.existsSync(TEMPLATE_PATH)) {
    console.error("❌ ERROR: template.html not found.");
    process.exit(1);
}

const htmlTemplate = fs.readFileSync(TEMPLATE_PATH, 'utf-8');

// Configure Nodemailer Transport for Gmail
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
    }
});

/**
 * Returns a readable stream of the CSV data.
 */
async function getCsvStream() {
    if (GOOGLE_SHEET_CSV_URL) {
        console.log(`🌐 Fetching recipients from Google Sheet CSV URL...`);
        try {
            const response = await axios.get(GOOGLE_SHEET_CSV_URL, { responseType: 'stream' });
            return response.data;
        } catch (error) {
            console.error("❌ ERROR: Failed to fetch CSV from Google Sheet URL.");
            console.error(error.message);
            process.exit(1);
        }
    } else {
        console.log(`📁 Reading recipients from local file: ${LOCAL_CSV_PATH}`);
        if (!fs.existsSync(LOCAL_CSV_PATH)) {
            console.error("❌ ERROR: recipients.csv not found locally and GOOGLE_SHEET_CSV_URL is not set.");
            process.exit(1);
        }
        return fs.createReadStream(LOCAL_CSV_PATH);
    }
}

/**
 * Replaces placeholders like {{First name}} in the HTML template.
 */
function populateTemplate(template, row) {
    let populated = template;
    for (const [key, value] of Object.entries(row)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        populated = populated.replace(regex, value);
    }
    // Fallback if {{First name}} wasn't replaced
    if (populated.includes('{{First name}}')) {
        const nameVal = row['First name'] || row['First Name'] || row.name || row.Name || 'Associate';
        populated = populated.replace(/{{First name}}/g, nameVal);
    }
    return populated;
}

/**
 * Sends the email to a specific recipient.
 */
async function sendEmail(row) {
    let toEmail = row.email || row.Email || row.EMAIL || row['Email Account'];
    if (!toEmail) {
        const emailRegex = /[^\s@]+@[^\s@]+\.[^\s@]+/;
        for (const key in row) {
            if (row[key] && typeof row[key] === 'string') {
                const match = row[key].match(emailRegex);
                if (match) {
                    toEmail = match[0];
                    break;
                }
            }
        }
    }
    
    if (!toEmail) {
        console.warn(`⚠️ Warning: Skipping row without an email address: ${JSON.stringify(row)}`);
        return;
    }

    const htmlBody = populateTemplate(htmlTemplate, row);

    // Prepare attachments
    const attachments = [];
    for (const conf of IMAGE_CONFIGS) {
        const imgPath = getImagePath(conf.name);
        if (imgPath) {
            attachments.push({
                filename: path.basename(imgPath),
                path: imgPath,
                cid: conf.cid
            });
        } else {
            console.warn(`⚠️ Warning: Image file for '${conf.name}' not found.`);
        }
    }

    const mailOptions = {
        from: `"${EMAIL_FROM_NAME}" <${EMAIL_USER}>`,
        to: toEmail.trim(),
        subject: EMAIL_SUBJECT,
        html: htmlBody,
        attachments: attachments
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Sent to: ${toEmail} [Message ID: ${info.messageId}]`);
    } catch (error) {
        console.error(`❌ ERROR sending to ${toEmail}:`, error.message);
    }
}

/**
 * Main execution function
 */
async function main() {
    const isTestMode = process.argv.includes('--test');
    
    if (isTestMode) {
        console.log("🧪 TEST MODE: Sending test email ONLY to alec.nathan.rongo@student.ateneo.edu...");
        const testRow = {
            'Email Account': 'alec.nathan.rongo@student.ateneo.edu',
            'First name': 'Alec',
            'Last Name': 'Rongo'
        };
        await sendEmail(testRow);
        console.log("🎉 Test email process complete.");
        return;
    }

    console.log("🚀 Starting Email Sender...");
    
    const csvStream = await getCsvStream();
    const recipients = [];

    csvStream
        .pipe(csv())
        .on('data', (row) => {
            recipients.push(row);
        })
        .on('end', async () => {
            console.log(`📊 Found ${recipients.length} recipients to email.`);
            
            for (const row of recipients) {
                await sendEmail(row);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            console.log("🎉 Finished processing all recipients.");
        });
}

main();
