const express = require('express');
const { getInvoices } = require('./mail'); // Import the function from mail.js
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
dotenv.config();
const app = express();

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

async function dbConnection() {
    try {
        await client.connect();
        console.log("Succesvol verbonden met MongoDB");
    } catch (err) {
        console.error("Kon niet verbinden met MongoDB.", err);
    }
}

app.get('/api/facturen', async (req, res) => {
    try {
        const results = await getInvoices(); // Fetch and parse the emails
        console.log(results); // Log the results to the server console
        res.json(results); // Send the results as JSON response to the client
    } catch (error) {
        console.error('Error bij het ophalen van emails:', error);
        res.status(500).send('Error bij het ophalen van emails');
    }
});

async function serverStart() {
    await dbConnection();
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server actief op http://localhost:${PORT}`);
    });
}

serverStart();
