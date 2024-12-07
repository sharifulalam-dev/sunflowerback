const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// const uri = "mongodb://localhost:27017";
const username = process.env.MONGO_USERNAME;
const password = process.env.MONGO_PASSWORD;
const uri = `mongodb+srv://${username}:${password}@cluster0.ey46t.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    console.log("You successfully connected to MongoDB!");
  } finally {
  }
}
run().catch(console.dir);

app.get("/all-visas", async (req, res) => {
  try {
    const database = client.db("visahub");
    const collection = database.collection("visas");

    const data = await collection.find({}).toArray();
    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching visa data:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.get("/visa-details/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const database = client.db("visahub");
    const collection = database.collection("visas");

    const visa = await collection.findOne({ _id: new ObjectId(id) });

    if (!visa) {
      return res.status(404).json({ message: "Visa not found" });
    }

    res.status(200).json(visa);
  } catch (error) {
    console.error("Error fetching visa data:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.post("/addvisa", async (req, res) => {
  try {
    const database = client.db("visahub");
    const collection = database.collection("visas");

    const visaData = req.body;

    if (!visaData.userEmail) {
      return res.status(400).json({ message: "user email are required." });
    }

    const result = await collection.insertOne(visaData);

    res
      .status(201)
      .json({ message: "Visa added successfully", visaId: result.insertedId });
  } catch (error) {
    console.error("Error adding visa:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.post("/application", async (req, res) => {
  try {
    const database = client.db("visahub");
    const collection = database.collection("applications");

    const applicationData = req.body;

    const result = await collection.insertOne(applicationData);

    res.status(201).json({
      message: "Application added successfully",
      applicationId: result.insertedId,
    });
  } catch (error) {
    console.error("Error adding Application:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.get("/application", async (req, res) => {
  try {
    const { email } = req.query;

    const database = client.db("visahub");
    const collection = database.collection("applications");

    const applications = await collection.find({ email }).toArray();

    res.status(200).json(applications);
  } catch (error) {
    console.error("Error fetching applications:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.delete("/application/:id", async (req, res) => {
  const { id } = req.params;

  await client
    .db("visahub")
    .collection("applications")
    .deleteOne({ _id: new ObjectId(id) });
  res.sendStatus(200);
});

app.get("/myvisas", async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res
      .status(400)
      .json({ message: "Email query parameter is required" });
  }

  try {
    const database = client.db("visahub");
    const collection = database.collection("visas");

    const visas = await collection.find({ userEmail: email }).toArray();

    if (visas.length === 0) {
      return res.status(404).json({ message: "No visas found for this email" });
    }

    res.status(200).json(visas);
  } catch (error) {
    console.error("Error fetching visas:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.delete("/all-visas/:id", async (req, res) => {
  const database = client.db("visahub");
  const collection = database.collection("visas");
  await collection.deleteOne({ _id: new ObjectId(req.params.id) });
  res.status(200).json({ message: "Visa deleted successfully" });
});

app.patch("/all-visas/:id", async (req, res) => {
  const { id } = req.params;
  const { _id, ...updateFields } = req.body;

  const database = client.db("visahub");
  const collection = database.collection("visas");

  await collection.updateOne({ _id: new ObjectId(id) }, { $set: updateFields });

  res.json({ message: "Visa updated successfully" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
