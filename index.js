const express = require('express')
const app = express()
const cors = require('cors')
const port = process.env.PORT || 3000
require('dotenv').config()


app.use(express.json())
app.use(cors())


//mongobd here
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.zgnatwl.mongodb.net/?appName=Cluster0`;
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.zgnatwl.mongodb.net/?appName=Cluster0`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // here you type code 
    const db = client.db("Dncc_Reports")
    const userCollection = db.collection('Dncc_User');
    const issueCollection = db.collection('Dncc_All_Issuse');


    // user related api
    app.post('/users', async (req, res) => {
      const user = req.body
      user.role = 'citizen'
      const email = user.email
      const userExits = await userCollection.findOne({ email })
      if (userExits) {
        return res.send({ massege: "user alreday added" })
      }
      const result = await userCollection.insertOne(user);
      res.send(result)
    })


    //user get related api
    app.get('/users', async (req, res) => {
      const result = await userCollection.find().toArray()
      res.send(result)
    })

    // issue api here

    app.post('/issue', async (req, res) => {
      const userIssue = req.body
      userIssue.priority = 'normal'
      userIssue.status = 'pending'
      const result = await issueCollection.insertOne(userIssue)
      res.send(result)
    })

    // issue find api
    app.get('/issue/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { _id: new ObjectId(id) }
      const result = await issueCollection.findOne(query)
      res.send(result)
    })

    // user all user find
    app.get('/user/issue', async (req, res) => {
      const { email } = req.query;
      const query = { email }
      const result = await issueCollection.find(query).toArray()
      res.send(result)
    })

    // user delete find
    app.delete('/user/issue/:id', async (req, res) => {
      const id = req.params.id;
      const userEmail = req.query.email;
      const query = { _id: new ObjectId(id) };

      if (!userEmail) {
        return res.status(400).send({ success: false, message: "Email is required" });
      }
      const issue = await issueCollection.findOne(query);
      if (!issue) {
        return res.status(404).send({ success: false, message: "Issue not found" });
      }

      if (issue.email !== userEmail) {
        return res.status(403).send({
          success: false,
          message: "Unauthorized! You cannot delete this issue.",
        });
      }

      const result = await issueCollection.deleteOne(query);

      res.send({
        success: true,
        message: "Issue deleted successfully",
        result,
      });

    })







    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})





