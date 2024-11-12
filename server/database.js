import { MongoClient } from "mongodb"
import dotenv from "dotenv"
dotenv.config()

const uri = process.env.MONGO_URI

async function dbConnection() {
    const client = new MongoClient(uri)

    try {
        await client.connect();
        console.log("MongoDB connected successfully.");

    } catch(err) {
        console.error(err);
        console.error("Failed to connect to MongoDB.", err);
    } finally {
        await client.close();
    }
}

dbConnection().catch(console.error);
