const express = require('express')
const app = express()
const cors = require('cors')
const port = process.env.PORT || 3000
require('dotenv').config()


app.use(express.json())
app.use(cors())


// strip
const stripe = require('stripe')(process.env.STRIPE_KEY);
const YOUR_DOMAIN = `${process.env.MY_DOMAIN}`;

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



//traking id function

function generateTrackingId() {
  const timestamp = Date.now().toString(36); // current time ke base36 e
  const randomPart = Math.random().toString(36).substring(2, 8); // random 6 char
  const trackingId = `TRK-${timestamp}-${randomPart}`.toUpperCase();
  return trackingId;
}

// example use
const issueTrackingId = generateTrackingId();


//firebase token
var admin = require("firebase-admin");

var serviceAccount = require("./dncckey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});



// verifyFirebase Token
const verifyFbToken = async (req, res, next) => {
  const token = req.headers.authorization;
  // console.log(token);
  if (!token) {
    return res.status(401).send({ message: "Unauthoraize User" })
  }
  try {
    const idToken = token.split(' ')[1];
    const decode = await admin.auth().verifyIdToken(idToken);
    // console.log('object', decode);
    req.decode_email = decode.email;
    next()

  } catch (error) {
    return res.status(401).send({ message: "unthorize email" })

  }

}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // here you type code 
    const db = client.db("Dncc_Reports")
    const userCollection = db.collection('Dncc_User');
    const issueCollection = db.collection('Dncc_All_Issuse');
    const paymentsCollection = db.collection('Dncc_payments');



    // verify admin 
    const verifyAdmin = async (req, res, next) => {
      const email = req.decode_email;
      const query = { email }
      const user = await userCollection.findOne(query)
      if (user?.role !== "admin") {
        return res.status(403).send('forbiden access')

      }
      next()
      // res.send({success:true})

    }


    // user related api
    app.post('/users', async (req, res) => {
      const user = req.body
      user.role = 'citizen'
      user.status = 'unblock'
      user.issueCount = 0
      user.subscription = 'free'
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
    app.get("/users/:email/role", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      if (!user) {
        return res.send("citizen"); // default role
      }
      res.send(user.role);

    });

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      res.send(user);

    });
    // user delete account
    app.delete("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.deleteOne({ email: email });
      res.send(user);

    })

    // update profile
    app.patch('/users/:email', async (req, res) => {
      const email = req.params.email;
      const { display_name, age, phoneNumber, photoURl, district, nidNumber } = req.body;
      const updateData = {
        $set: {
          display_name: display_name,
          phoneNumber: phoneNumber,
          age: age,
          photoURl: photoURl,
          district: district,
          nidNumber: nidNumber
        }
      }
      const query = { email }
      const result = await userCollection.updateOne(query, updateData)
      res.send(result)
    })


    // citizen to staff api

    app.patch('/apply-staff', async (req, res) => {
      const { email, fullName, nid, phone, about, role } = req.body
      const query = { email }
      if (!email) {
        return res.status(400).send({ success: false, message: "Email is required" });
      }
      const updatedata = {
        $set: {
          staffName: fullName,
          nidNumber: nid,
          staffPhoneNUmber: phone,
          staffStatus: "pending",
          staffAbout: about,
        }
      }
      const result = await userCollection.updateOne(query, updatedata)

      res.send(result)
    })

    // issue api here

    app.post('/issue', async (req, res) => {
      const userIssue = req.body;
      const query = { email: userIssue.email }
      userIssue.priority = 'normal'
      userIssue.status = 'pending'
      const user = await userCollection.findOne(query);
      if (!user) {
        return res.status(404).send({ message: "User not found" });
      }

      if (user.subscription !== "premium" && user.issueCount >= 3) {
        return res.send({
          message: "Free users can report only 3 issues. Please upgrade to premium.",
          subscriptionRequired: true
        });
      }

      const result = await issueCollection.insertOne(userIssue)
      await userCollection.updateOne(
        query,
        { $inc: { issueCount: 1 } }
      );
      res.send(result);
    })

    // issue find api
    app.get('/issue/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await issueCollection.findOne(query)
      res.send(result)
    })

    // issue assigned staff update api
    app.patch("/issue/:id", async (req, res) => {
      const id = req.params.id;
      const { staffName, staffEmail, phoneNumber, staffId } = req.body;
      const query = { _id: new ObjectId(id) }
      const riderquery = { _id: new ObjectId(staffId) }
      const updateAssignStaff = {
        $set: {
          staffId: staffId,
          staffPhoneNumber: phoneNumber,
          staffEmail: staffEmail,
          staffName: staffName
        }
      }

      const staffUpdateData = {
        $set: {
          staffStatus: 'in_work'
        }
      }
      const result = await issueCollection.updateOne(query, updateAssignStaff)
      const staffresult = await userCollection.updateOne(riderquery, staffUpdateData)

      res.send({ result, staffresult })
    })


    app.patch('/update-issue/:id', async (req, res) => {
      const id = req.params.id;
      const { description, name, email, title, category } = req.body;
      const updateData = {
        $set: {
          name: name,
          email: email,
          title: title,
          category: category,
          description: description
        }
      }
      const query = { _id: new ObjectId(id) }
      const result = await issueCollection.updateOne(query, updateData)
      res.send(result)
    })




    // all issue api
    app.get('/all-issue', async (req, res) => {
      const query = {}
      if (query) {
        query.status = { $in: ['pending', 'resolved'] }
      }
      const result = await issueCollection.find(query).sort({ paidAt: -1 }).toArray();
      res.send(result)
    });

    // all issue api
    app.get('/all-issue/email', async (req, res) => {
      const { userEmail } = req.query;
      const query = {}
      if (userEmail) {
        query.staffEmail = userEmail
      }
      // console.log(issueTrackingId);
      const result = await issueCollection.find(query).toArray();
      res.send(result)
    });


    // staff accepet probelm 
    app.patch('/all-issue/:id', async (req, res) => {
      const id = req.params.id;
      const { status } = req.query;
      const { staffEmail, staffName } = req.body;
      const query = { _id: new ObjectId(id) };

      const findIssue = await issueCollection.findOne(query)
      if (!findIssue) {
        return res.status(404).send({ success: false, message: "Issue not found" });
      }

      const timelineMessage = {
        status: status,
        message: `Issue status updated to "${status}".`,
        updatedBy: staffEmail,
        dateTime: new Date(),

      };
      const issueUpdate = {
        $set: {
          status: status,
          trackingId: issueTrackingId,
          staffName: staffName,
          staffEmail: staffEmail,
        },
        $push: {
          timeline: timelineMessage,
        },
      };
      if (status === 'resolved') {

        const staffquery = {}

        if (staffEmail) {
          staffquery.email = staffEmail
        }
        const staffUpdate = {
          $set: {
            staffStatus: 'approved'

          }
        }
        const result1 = await userCollection.updateOne(staffquery, staffUpdate);


      }

      const result = await issueCollection.updateOne(query, issueUpdate)

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






    // citizen user api
    //admin show can pending staff api
    app.get('/user/cityzen', async (req, res) => {
      const { role, staffStatus } = req.query;
      const query = {}
      if (role) {
        query.role = role
      }
      if (role === 'citizen') {
        const result = await userCollection.find(query).toArray()
        return res.send(result)
      }
      if (staffStatus) {
        query.staffStatus = { $in: ['pending', 'approved'] }
      }
      const result = await userCollection.find(query).toArray()
      res.send(result)

    })

    // citizen status update api
    app.patch('/user/:id', async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;
      const query = { _id: new ObjectId(id) }
      const updateData = {
        $set: {
          status: status

        }
      }
      const result = await userCollection.updateOne(query, updateData)
      res.send(result)
    })


    //
    app.patch('/staff/:id', async (req, res) => {
      const id = req.params.id;
      const { staffStatus, role } = req.query;
      const query = { _id: new ObjectId(id) }
      const updateData = {
        $set: {
          staffStatus: staffStatus,
          role: role


        }
      }
      const result = await userCollection.updateOne(query, updateData)
      res.send(result)
    })




    // payment section 

    app.post('/create-checkout-session', async (req, res) => {
      const paymentInfo = req.body;
      console.log(paymentInfo);
      const amount = parseInt(paymentInfo?.cost) * 100
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "BDT",
              unit_amount: amount,
              product_data: {
                name: paymentInfo?.percelName
              }
            },

            quantity: 1,
          },
        ],
        mode: 'payment',
        customer_email: paymentInfo.customer_email,
        metadata: {
          percelId: paymentInfo.percelId,
          percelName: paymentInfo.percelName
        },
        success_url: `${process.env.MY_DOMAIN}dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.MY_DOMAIN}dashboard/payment-canceled?session_id={CHECKOUT_SESSION_ID}`,

      })

      res.send({ url: session.url })
    })


    // verify payment check
    app.patch('/verify-payment-success', async (req, res) => {
      const sessionId = req.query.session_id;
      // console.log(issueTrackingId);
      const trackingId = generateTrackingId()
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      // console.log(session);
      const email = session.customer_details.email
      const transtionId = session.payment_intent;
      const query = { transtionId: transtionId };
      const paymentExits = await issueCollection.findOne(query)
      if (paymentExits) {
        return res.send({ massege: "alreday payment ", transtionId })
      }
      if (session.payment_status == 'paid') {
        const id = session.metadata.percelId;
        const query = { _id: new ObjectId(id) };
        const update = {
          $set: {
            payment_status: 'paid',
            trackingId: trackingId,
            amount: session.amount_total / 100,
            currency: session.currency,
            percelId: session.metadata.percelId,
            transtionId: transtionId,
            trackingId: trackingId,
            priority: 'high',
            paidEmail: email,
            payment_status: session.payment_status,
            paidAt: new Date(),
          }
        }
        const result = await issueCollection.updateOne({ _id: new ObjectId(id) }, update)
        res.send(result)
      }
      res.send({ success: true })
    })



    // user subcription

    app.post('/create-user-subcription', async (req, res) => {
      const paymentInfo = req.body;
      console.log(paymentInfo);
      const amount = parseInt(paymentInfo?.cost) * 100
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "BDT",
              unit_amount: amount,
              product_data: {
                name: paymentInfo?.Name
              }
            },

            quantity: 1,
          },
        ],
        mode: 'payment',
        customer_email: paymentInfo.customer_email,
        metadata: {
          userId: paymentInfo.userId,
          userName: paymentInfo.Name
        },
        success_url: `${process.env.MY_DOMAIN}dashboard/user-subcription-payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.MY_DOMAIN}dashboard/user-subcription-payment-canceled?session_id={CHECKOUT_SESSION_ID}`,

      })
      console.log(session);

      res.send({ url: session.url })

    })



    app.patch('/verify-user-payment-success', async (req, res) => {
      try {
        const sessionId = req.query.session_id;
        if (!sessionId) {
          return res.status(400).send({ message: "session_id missing" });
        }

        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status !== 'paid') {
          return res.send({ message: "Payment not completed" });
        }

        const transtionId = session.payment_intent;
        const userId = session.metadata.userId;
        const email = session.customer_details.email;

        //  ONLY ONE CHECK (paymentsCollection)
        const alreadyPaid = await paymentsCollection.findOne({ transtionId });
        if (alreadyPaid) {
          return res.send({ message: "Already payment verified", transtionId });
        }

        const trackingId = generateTrackingId();
        const paidAt = new Date();

        //  INSERT PAYMENT
        const paymentUpdateData = {

          trackingId,
          paymentType: "premium",
          amount: session.amount_total / 100,
          currency: session.currency,
          userId,
          transtionId,
          subscription: "premium",
          paidEmail: email,
          payment_status: "paid",
          paidAt,
          createdAt: paidAt,

        }
        await paymentsCollection.insertOne(paymentUpdateData);

        //  UPDATE USER

        const userUpdateData = {
          $set: {
            trackingId: trackingId,
            amount: session.amount_total / 100,
            currency: session.currency,
            // userId: session.metadata.userId,
            transtionId: transtionId,
            subscription: "premium",
            paidEmail: email,
            payment_status: session.payment_status,
            paidAt: new Date(),
          }
        }
        await userCollection.updateOne(
          { _id: new ObjectId(userId) },
          userUpdateData
        );

        res.send({
          success: true,
          message: "Payment verified successfully",
          trackingId,
        });

      } catch (error) {
        if (error.code === 11000) {
          return res.send({ message: "Payment already exists" });
        }
        console.error(error);
        res.status(500).send({ message: "Payment verification failed" });
      }
    });



  





    // verify-session endpoint 
    app.get('/verify-session', async (req, res) => {
      const { session_id } = req.query;
      if (!session_id) return res.status(400).json({ error: 'Missing session id' });

      try {
        const session = await stripe.checkout.sessions.retrieve(session_id, {
          // expand: ['payment_intent'],
        });

        // session.payment_status typically 'paid' or 'unpaid'
        // const paid = session.payment_status === 'paid' || (session.payment_intent && session.payment_intent.status === 'succeeded');
        const paid = session.payment_status === 'paid'

        res.send({
          paid,
          session,
        });
      } catch (err) {

        res.status(500).send({ error: 'Could not verify session' });
      }
    });




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





