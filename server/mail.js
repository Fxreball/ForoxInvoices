const Imap = require('imap');
const { simpleParser } = require('mailparser');
const xml2js = require('xml2js');
const dotenv = require('dotenv');

dotenv.config();

var imap = new Imap({
    user: process.env.IMAP_USER,
    password: process.env.IMAP_PASS,
    host: process.env.IMAP_HOST,
    port: process.env.IMAP_PORT,
    tls: true
});

// Function to open inbox
function openInbox(cb) {
    imap.openBox('INBOX', false, cb);
}

// Check if attachment is supported
function isXml(attachment) {
    return attachment.contentType && attachment.contentType.toLowerCase().includes('xml'); // Check if XML
}

// Helper function to flatten the result
function flattenXmlResult(result) {
    // Recursively flatten all arrays that only have one item
    const flatten = (obj) => {
        for (const key in obj) {
            if (Array.isArray(obj[key]) && obj[key].length === 1) {
                obj[key] = obj[key][0]; // Replace array with its single value
            }
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                flatten(obj[key]); // Recursively flatten nested objects
            }
        }
    };
    
    flatten(result);
    return result;
}

// Modify the parseXmlToJson function to use this helper
function parseXmlToJson(xmlContent) {
    const parser = new xml2js.Parser();
    return new Promise((resolve, reject) => {
        parser.parseString(xmlContent, (err, result) => {
            if (err) {
                reject('Error bij het verwerken van het XML-bestand:', err);
            } else {
                const flattenedResult = flattenXmlResult(result);
                resolve(flattenedResult);
            }
        });
    });
}

// In the getInvoices function
async function getInvoices() {
    return new Promise((resolve, reject) => {
        const invoiceData = [];

        imap.once('ready', function () {
            openInbox(function (err, box) {
                if (err) {
                    reject('Error tijdens het openen van inbox:', err);
                    return;
                }

                console.log('Zoeken naar emails...');

                // Search for unseen emails
                imap.search(['UNSEEN'], function (err, results) {
                    if (err) {
                        reject('Error tijdens het zoeken naar emails:', err);
                        return imap.end();
                    }

                    if (results && results.length > 0) {
                        // Mark found emails as read
                        imap.setFlags(results, ['\\Seen'], function (err) {
                            if (!err) {
                                console.log("Gevonden emails gemarkeerd als gelezen.");
                            } else {
                                console.log('Error tijdens het markeren als gelezen:', JSON.stringify(err, null, 2));
                            }
                        });

                        // Fetch each email one at a time (do not call this multiple times)
                        const processEmailsSequentially = async () => {
                            for (const seqno of results) {
                                await new Promise((resolveEmail) => {
                                    const fetch = imap.fetch([seqno], { bodies: '' });

                                    fetch.on('message', (msg) => {
                                        msg.on('body', (stream) => {
                                            simpleParser(stream, async (err, parsed) => {
                                                if (err) {
                                                    console.error('Error bij het verwerken van de email:', err);
                                                    resolveEmail(); // Ensure we move to next email
                                                    return;
                                                }

                                                if (parsed.attachments && parsed.attachments.length > 0) {
                                                    console.log(`Bijlage gevonden in email ${seqno}`);

                                                    for (const attachment of parsed.attachments) {
                                                        if (isXml(attachment)) {
                                                            console.log(`XML-bestand: ${attachment.filename}`);
                                                            try {
                                                                const jsonData = await parseXmlToJson(attachment.content);
                                                                invoiceData.push(jsonData); // Add parsed data to invoiceData
                                                            } catch (parseError) {
                                                                console.error('Fout bij het parsen van XML:', parseError);
                                                            }
                                                        } else {
                                                            console.log(`Overbodige bestanden overgeslagen: ${attachment.filename}`);
                                                        }
                                                    }
                                                } else {
                                                    console.log(`Geen bijlage gevonden in email ${seqno}.`);
                                                }

                                                resolveEmail(); // Ensure we move to the next email after processing
                                            });
                                        });
                                    });
                                });
                            }

                            resolve(invoiceData); // Return the results once all emails are processed
                            imap.end(); // End connection after processing all emails
                        };

                        processEmailsSequentially(); // Start processing emails one by one

                    } else {
                        console.log('Geen e-mails gevonden.');
                        resolve([]); // Return empty array if no emails found
                        imap.end(); // End connection if no emails found
                    }
                });
            });
        });

        imap.once('error', function (err) {
            console.log('Error:', err);
            reject('Error tijdens IMAP connectie:', err);
        });

        imap.once('end', function () {
            console.log('Connectie beëindigd.');
        });

        // Connect to the IMAP server
        imap.connect();
    });
}

module.exports = { getInvoices };
