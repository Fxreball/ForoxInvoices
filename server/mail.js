const Imap = require('imap');
const { simpleParser } = require('mailparser');
const xml2js = require('xml2js');
const dotenv = require('dotenv');

dotenv.config();

const imap = new Imap({
    user: process.env.IMAP_USER,
    password: process.env.IMAP_PASS,
    host: process.env.IMAP_HOST,
    port: process.env.IMAP_PORT,
    tls: true
});

// Open de inbox
function openInbox() {
    return new Promise((resolve, reject) => {
        imap.openBox('INBOX', false, (err, box) => {
            if (err) reject(`Error tijdens het openen van inbox: ${err}`);
            else resolve(box);
        });
    });
}

// Controleer of de bijlage een XML-bestand is
function isXml(attachment) {
    return attachment.contentType && attachment.contentType.toLowerCase().includes('xml');
}

// Helper om het XML-resultaat te "flattenen"
function flattenXmlResult(result) {
    const flatten = (obj) => {
        for (const key in obj) {
            if (Array.isArray(obj[key]) && obj[key].length === 1) {
                obj[key] = obj[key][0];
            }
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                flatten(obj[key]);
            }
        }
    };
    flatten(result);
    return result;
}

// Parse XML naar JSON en "flatten"
function parseXmlToJson(xmlContent) {
    return new Promise((resolve, reject) => {
        const parser = new xml2js.Parser();
        parser.parseString(xmlContent, (err, result) => {
            if (err) {
                reject(`Fout bij het verwerken van het XML-bestand: ${err}`);
            } else {
                resolve(flattenXmlResult(result));
            }
        });
    });
}

// Ophalen van facturen
async function getInvoices() {
    return new Promise((resolve, reject) => {
        const invoiceData = [];

        imap.once('ready', async () => {
            try {
                await openInbox();
                console.log('Zoeken naar emails...');
                
                imap.search(['UNSEEN'], (err, results) => {
                    if (err) {
                        reject(`Error tijdens het zoeken naar emails: ${err}`);
                        imap.end();
                        return;
                    }
                    
                    if (results.length > 0) {
                        imap.setFlags(results, ['\\Seen'], (err) => {
                            if (err) {
                                console.log(`Error tijdens het markeren als gelezen: ${err}`);
                            } else {
                                console.log("Gevonden emails gemarkeerd als gelezen.");
                            }
                        });

                        // Process emails sequentially
                        const processEmailsSequentially = async () => {
                            for (const seqno of results) {
                                await new Promise((resolveEmail) => {
                                    const fetch = imap.fetch([seqno], { bodies: '' });
                                    fetch.on('message', (msg) => {
                                        msg.on('body', (stream) => {
                                            simpleParser(stream, async (err, parsed) => {
                                                if (err) {
                                                    console.error(`Error bij het verwerken van de email: ${err}`);
                                                    resolveEmail();
                                                    return;
                                                }

                                                if (parsed.attachments && parsed.attachments.length > 0) {
                                                    console.log(`Bijlage gevonden in email ${seqno}`);
                                                    for (const attachment of parsed.attachments) {
                                                        if (isXml(attachment)) {
                                                            console.log(`XML-bestand: ${attachment.filename}`);
                                                            try {
                                                                const jsonData = await parseXmlToJson(attachment.content);
                                                                invoiceData.push(jsonData);
                                                            } catch (parseError) {
                                                                console.error(`Fout bij het parsen van XML: ${parseError}`);
                                                            }
                                                        } else {
                                                            console.log(`Overbodige bestanden overgeslagen: ${attachment.filename}`);
                                                        }
                                                    }
                                                } else {
                                                    console.log(`Geen bijlage gevonden in email ${seqno}.`);
                                                }
                                                resolveEmail();
                                            });
                                        });
                                    });
                                });
                            }
                            resolve(invoiceData);
                            imap.end();
                        };

                        processEmailsSequentially();

                    } else {
                        console.log('Geen e-mails gevonden.');
                        resolve([]);
                        imap.end();
                    }
                });

            } catch (err) {
                reject(`Fout tijdens het openen van de inbox: ${err}`);
                imap.end();
            }
        });

        imap.once('error', (err) => {
            console.log(`IMAP Error: ${err}`);
            reject(`Error tijdens IMAP connectie: ${err}`);
        });

        imap.once('end', () => {
            console.log('Connectie beëindigd.');
        });

        imap.connect();
    });
}

module.exports = { getInvoices };
