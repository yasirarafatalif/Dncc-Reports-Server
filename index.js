const express = require('express')
const app = express()
const cors = require('cors')
const port = process.env.PORT || 3000
require('dotenv').config()


app.use(express.json())
app.use(cors())

const admin = require("firebase-admin");


const decoded = Buffer.from(process.env.FB_Token, 'base64').toString('utf8')
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});



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
// var admin = require("firebase-admin");

// try {
  // const decoded = Buffer.from(process.env.FB_Token, "base64").toString("utf8");
  // const serviceAccount = JSON.parse(decoded);
  

  // admin.initializeApp({
  //   credential: admin.credential.cert(serviceAccount),
  // });

  // console.log("Firebase admin initialized");
// } catch (error) {
//   console.error("Firebase init error:", error.message);
// }







// //firebase token
// var admin = require("firebase-admin");
// module.exports = app;


// // var serviceAccount = require("./dncckey.json");
// const decoded = Buffer.from(process.env.FB_Token, 'base64').toString('utf8')
// const serviceAccount = JSON.parse(decoded);

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount)
// });

// module.exports = admin;



// verifyFirebase Token
const verifyFbToken = async (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).send({ message: "Unauthoraize User" })
  }
  // try {
    const idToken = token.split(' ')[1];
    const decode = await admin.auth().verifyIdToken(idToken);
  
    req.decode_email = decode.email;
    next()

  // }
  //  catch (error) {
  //   return res.status(401).send({ message: "unthorize email" })

  // }

}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

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


    }

      // verify citizen 
    const verifyCitizen = async (req, res, next) => {
      const email = req.decode_email;
      const query = { email }
      const user = await userCollection.findOne(query)
      if (user?.role !== "citizen") {
        return res.status(403).send('forbiden access')

      }
      next()


    }
      // verify staff
    const verifyStaff = async (req, res, next) => {
      const email = req.decode_email;
      const query = { email }
      const user = await userCollection.findOne(query)
      if (user?.role !== "Field Staff") {
        return res.status(403).send('forbiden access')

      }
      next()


    }





    //latest reslove  issue
    app.get('/latest-issue', async (req, res) => {
      const result = await issueCollection
        .find({
          timeline: {
            $elemMatch: { status: "resolved" }
          }
        })
        .sort({ "timeline.dateTime": -1 }) 
        .limit(6)
        .toArray();

      res.send(result);
    });




    // admin crete user 


    app.post("/create-staff", verifyFbToken, verifyAdmin, async (req, res) => {
      const { name, email, password, phone, photo } = req.body;
      try {
        //  Create Firebase Auth user
        const userRecord = await admin.auth().createUser({
          email,
          password,
          displayName: name,
          photoURL: photo
        });

        //  Save staff in DB
        const staff = {
          uid: userRecord.uid,
          display_name: name,
          email,
          phoneNumber: phone,
          role: "Field Staff",
          status: "approved",
          staffStatus: 'approved',
          createdAt: new Date(),
          photoURL: photo
        };

        await userCollection.insertOne(staff);

        res.send({ success: true, message: "Staff created successfully" });

      } catch (error) {
        res.status(400).send({ success: false, message: error.message });
      }


    });


    // admin update staff data
    app.patch("/update-staff/:id", verifyFbToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const { name, phone, photo, status } = req.body;
      const updateData = {

        $set: {

          display_name: name,
          phoneNumber: phone,
          photoURL: photo,
          status,
          updatedAt: new Date(),
        },


      }


      const result = await userCollection.updateOne(
        { _id: new ObjectId(id) }, updateData);

      res.send({ success: true });

    });

    // delete admin staff data
    app.delete("/delete-staff/:id", verifyFbToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;

      const staff = await userCollection.findOne({
        _id: new ObjectId(id),
      });

      if (!staff) {
        return res.status(404).send({ success: false, message: "Staff not found" });
      }


      await admin.auth().deleteUser(staff.uid);

      await userCollection.deleteOne({ _id: new ObjectId(id) });

      res.send({ success: true });
    });






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
    app.get('/users',verifyFbToken, async (req, res) => {
      const result = await userCollection.find().toArray()
      res.send(result)
    })
    app.get("/users/:email/role",verifyFbToken, async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      if (!user) {
        return res.send("citizen");
      }
      res.send(user.role);

    });

    app.get("/users/:email",verifyFbToken, async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      res.send(user);

    });
    // user delete account
    app.delete("/users/:email",verifyFbToken, async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.deleteOne({ email: email });
      res.send(user);

    })

    // update profile
    app.patch('/users/:email',verifyFbToken, async (req, res) => {
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

    // app.patch('/apply-staff', async (req, res) => {
    //   const { email, fullName, nid, phone, about, role } = req.body
    //   const query = { email }
    //   if (!email) {
    //     return res.status(400).send({ success: false, message: "Email is required" });
    //   }
    //   const updatedata = {
    //     $set: {
    //       staffName: fullName,
    //       nidNumber: nid,
    //       staffPhoneNUmber: phone,
    //       staffStatus: "pending",
    //       staffAbout: about,
    //     }
    //   }
    //   const result = await userCollection.updateOne(query, updatedata)

    //   res.send(result)
    // })

    // issue api here

    app.post('/issue',verifyFbToken,verifyCitizen, async (req, res) => {
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
    app.get('/issue/:id',verifyFbToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await issueCollection.findOne(query)
      res.send(result)
    })

    // issue assigned staff update api
    app.patch("/issue/:id",verifyFbToken, async (req, res) => {
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


    app.patch('/update-issue/:id', verifyFbToken,async (req, res) => {
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


    app.patch('/issue/:id/status', verifyFbToken, async(req,res)=>{
      const {status} = req.query
      const id = req.params.id
      const query={_id: new ObjectId(id)}
      const findIssue = await issueCollection.findOne(query)
      const updateData ={
        $set:{
          status : status
        }
      }
      const result = await issueCollection.updateOne(query, updateData)
      
      res.send(result)
    })



app.get('/all-issues', async (req, res) => {
  const page = parseInt(req.query.page) || 1;  
  const limit = parseInt(req.query.limit) || 5;

  const skip = (page - 1) * limit;

  const totalIssues = await issueCollection.countDocuments();

  const issues = await issueCollection
    .find()
    .skip(skip)
    .limit(limit)
    .toArray();

  res.send({
    totalIssues,
    totalPages: Math.ceil(totalIssues / limit),
    currentPage: page,
    issues
  });
});

app.patch("/likes/:id", async (req, res) => {
  const id = req.params.id;
  const { likeEmail } = req.body;


  const issue = await issueCollection.findOne({
    _id: new ObjectId(id)
  });

  
  if (issue.likedBy?.includes(likeEmail)) {
    return res.send({ message: "Already liked" });
  }


  const result = await issueCollection.updateOne(
    { _id: new ObjectId(id) },
    {
      $inc: { likesCount: 1 },
      $push: { likedBy: likeEmail }
    }
  );

  res.send({ message: "Like added", result });
});







    // all issue api
    app.get('/all-issue',verifyFbToken,verifyAdmin, async (req, res) => {
      const query = {}
      if (query) {
        query.status = { $in: ['pending'] }
      }
      const result = await issueCollection.find(query).sort({ paidAt: -1 }).toArray();
      res.send(result)
    });
    // all resolved issue api
    app.get('/all-resoved-issue',verifyFbToken,verifyAdmin, async (req, res) => {
      const query = {}
      if (query) {
        query.status = { $in: ['resolved'] }
      }
      const result = await issueCollection.find(query).toArray();
      // const result = await issueCollection.find(query).sort({ paidAt: -1 }).toArray();
      res.send(result)
    });
    // all rejected issue api
    app.get('/all-rejected-issue',verifyFbToken,verifyAdmin, async (req, res) => {
      const query = {}
      if (query) {
        query.status = { $in: ['rejected'] }
      }
      const result = await issueCollection.find(query).toArray();
      // const result = await issueCollection.find(query).sort({ paidAt: -1 }).toArray();
      res.send(result)
    });

    // all issue api
    app.get('/all-issue/email',verifyFbToken, async (req, res) => {
      const { userEmail } = req.query;
      const query = {}
  
      if (userEmail) {
        query.staffEmail = userEmail
      }
   query.status = { $nin: ["resolved"] };


      const result = await issueCollection.find(query).toArray();
      res.send(result)
    });

    // staff resloved issue
    app.get('/resloved-issue/email', verifyFbToken,verifyStaff, async (req, res) => {
      const { userEmail,status } = req.query;
      const query = {}
      if (userEmail) {
        query.staffEmail = userEmail
      }
     query.status = { $in: ["resolved"] };
  

      const result = await issueCollection.find(query).toArray();
      res.send(result)
    });


    // staff accepet probelm 
    app.patch('/all-issue/:id',verifyFbToken,verifyStaff, async (req, res) => {
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
    app.get('/user/issue',verifyFbToken,verifyCitizen, async (req, res) => {
      const { email } = req.query;
      const query = { email }
      const result = await issueCollection.find(query).toArray()
      res.send(result)
    })

    // user delete find
    app.delete('/user/issue/:id',verifyFbToken, async (req, res) => {
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
    app.get('/user/cityzen',verifyFbToken,verifyAdmin, async (req, res) => {
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
    app.patch('/user/:id',verifyFbToken,verifyAdmin, async (req, res) => {
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
    app.patch('/staff/:id', verifyFbToken,verifyAdmin, async (req, res) => {
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






    // admin dashboard
    app.get('/admin-dashboard', verifyFbToken,verifyAdmin, async (req, res) => {
      const totalIssue = await issueCollection.countDocuments();
      const pendingIssue = await issueCollection.countDocuments({ status: "pending" });
      const resolvedIssue = await issueCollection.countDocuments({ status: "resolved" });
      const rejectedIssue = await issueCollection.countDocuments({ status: "rejected" });
      const totalUsers = await userCollection.countDocuments();
      const latestPayment = await paymentsCollection.find().sort({ paidAt: -1 }).limit(3).toArray()
      const latestUsers = await userCollection.find().sort({ createdAt: -1 }).limit(3).toArray()
      const latestIssue = await issueCollection.find().sort({ submitAt: -1 }).limit(3).toArray();
      const result = await paymentsCollection.aggregate([
        { $match: { payment_status: "paid" } },
        {
          $group: {
            _id: null,
            totalPayment: { $sum: "$amount" }
          }
        }
      ]).toArray();

      const totalPayment = result[0]?.totalPayment || 0;


      res.send({
        totalIssue,
        totalUsers,
        pendingIssue,
        resolvedIssue,
        rejectedIssue,
        latestPayment,
        latestUsers,
        latestIssue,
        totalPayment
      });



    })


    //citizen dashboard
    app.get('/citizen-dashboard', verifyFbToken,verifyCitizen, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        return res.status(400).send({ message: "Email is required" });
      }
      const totalIssues = await issueCollection.countDocuments({ email });
      const pendingIssues = await issueCollection.countDocuments({
        email,
        status: "pending"
      });
      const rejectedIssues = await issueCollection.countDocuments({
        email,
        status: "rejected"
      });
      const resolvedIssues = await issueCollection.countDocuments({
        email,
        status: "resolved"
      });
      const inProgressIssues = await issueCollection.countDocuments({
        email,
        status: { $in: ['assign_staff', 'in-progress', 'working'] }
      });

      const totalPayments = await paymentsCollection.countDocuments({
        paidEmail: email
      });

      const latestPayment = await paymentsCollection.find({ paidEmail: email }).sort({ paidAt: -1 }).limit(3).toArray()
      const latestIssue = await issueCollection.find({ email }).sort({ submitAt: -1 }).limit(3).toArray();
    
      

      const result = await paymentsCollection.aggregate([
        { $match: { payment_status: "paid", paidEmail: email } },
        {
          $group: {
            _id: null,
            totalPayment: { $sum: "$amount" }
          }
        }
      ]).toArray();

      const totalPayment = result[0]?.totalPayment || 0;

      res.send({

        totalIssues,
        pendingIssues,
        resolvedIssues,
        totalPayments,
        totalPayment,
        rejectedIssues,
        inProgressIssues,
        latestPayment,
        latestIssue


      });

    })


    // staff dashboard

    app.get('/staff-dashboard',verifyFbToken,verifyStaff, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        return res.status(400).send({ message: "Email is required" });
      }
      const totalAssignedIssues = await issueCollection.countDocuments({ staffEmail: email });
      const pendingIssues = await issueCollection.countDocuments({
        staffEmail: email,
        status: "pending"
      });
      const resolvedIssues = await issueCollection.countDocuments({
        staffEmail: email,
        status: "resolved"
      });

      const start = new Date();
      start.setHours(0, 0, 0, 0);

      const end = new Date();
      end.setHours(23, 59, 59, 999);

      const tasks = await issueCollection.find({
        "timeline": {
          $elemMatch: {
            status: { $in: ["assign_staff", "in-progress", "working", "resolved", 'pending'] },
            updatedBy: email,
            dateTime: { $gte: start, $lte: end }
          }
        }
      }).toArray();

      res.send({

        totalAssignedIssues,
        pendingIssues,
        resolvedIssues,
        tasks



      });

    })





    // payment section 

    app.post('/create-checkout-session',verifyFbToken,verifyCitizen, async (req, res) => {
      const paymentInfo = req.body;
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
          coustomerName: paymentInfo.customer_name,
          coustomerEmail: paymentInfo.customer_email,
          percelId: paymentInfo.percelId,
          percelName: paymentInfo.percelName
        },
        success_url: `${process.env.MY_DOMAIN}dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.MY_DOMAIN}dashboard/payment-canceled?session_id={CHECKOUT_SESSION_ID}`,

      })

      res.send({ url: session.url })
    })


    // verify payment check
    app.patch('/verify-payment-success',verifyFbToken,verifyCitizen, async (req, res) => {
      const sessionId = req.query.session_id;
      const trackingId = generateTrackingId()
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const userId = session.metadata.userId;
      const email = session.customer_details.email
      const transtionId = session.payment_intent;
      const findTranstionIdquery = { transtionId: transtionId };
      const paymentExits = await issueCollection.findOne(findTranstionIdquery)
      if (paymentExits) {
        return res.send({ massege: "alreday payment ", findTranstionIdquery })
      }


      if (session.payment_status !== 'paid') {
        return res.send({ message: "Payment not completed" });
      }

      const alreadyPaid = await paymentsCollection.findOne({ transtionId });
      if (alreadyPaid) {
        return res.send({ message: "Already payment verified", transtionId });
      }

      const paidAt = new Date();

      //  INSERT PAYMENT
      const paymentUpdateData = {

        trackingId,
        paymentType: "issue-bost",
        amount: session.amount_total / 100,
        currency: session.currency,
        userId,
        transtionId,
        product_name: 'user-by-subcriptions',
        subscription: "premium",
        paidEmail: email,
        payment_status: "paid",
        paidAt,
        createdAt: paidAt,

      }
      const payupdateData = await paymentsCollection.insertOne(paymentUpdateData);
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

      res.send({
        result,
        payupdateData,
        message: "Successfully Add"
      })
    })



    // user subcription

    app.post('/create-user-subcription',verifyFbToken,verifyCitizen, async (req, res) => {
      const paymentInfo = req.body;
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
          userId: paymentInfo.userId,
          coustomerName: paymentInfo.Name,
          percelName: paymentInfo.percelName
        },
        success_url: `${process.env.MY_DOMAIN}dashboard/user-subcription-payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.MY_DOMAIN}dashboard/payment-canceled?session_id={CHECKOUT_SESSION_ID}`,

      })


      res.send({ url: session.url })

    })



    app.patch('/verify-user-payment-success',verifyFbToken,verifyCitizen, async (req, res) => {
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
          product_name: 'user-by-subcriptions',
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

    app.get('/verify-session',verifyFbToken,verifyCitizen, async (req, res) => {
      const { session_id } = req.query;
      if (!session_id) {
        return res.status(400).json({ error: 'Missing session id' });
      }

      try {
        const session = await stripe.checkout.sessions.retrieve(session_id, {
          expand: ['payment_intent.charges.data'],
        });

        const paid = session.payment_status === 'paid';

        const userInfo = {
          email: session.customer_email,
          name: session.metadata?.coustomerName || null,
          phone: session.customer_details?.phone || null,
        };

        const paymentInfo = {
          amount: session.amount_total / 100,
          currency: session.currency,
          status: session.payment_status,
          transactionId: session.payment_intent?.id,
          createdAt: new Date(session.created * 1000),
          percelName: session.metadata?.percelName
        };



        res.send({
          success: true,
          paid,
          session,
          userInfo,
          paymentInfo,
          sessionId: session.id,
        });

      } catch (error) {
        res.status(500).send({ error: 'Could not verify session' });
      }
    });









    // all payments get api
    app.get("/all-payments",verifyFbToken,verifyAdmin, async (req, res) => {
      const result = await paymentsCollection.find().sort({ paidAt: -1 }).toArray()
      res.send(result)

    })
    // all payments get api
    app.get("/payments/:email",verifyFbToken, verifyCitizen, async (req, res) => {
      const {userEmail}= req.query;
      const query={paidEmail: userEmail}
      const result = await paymentsCollection.find(query).toArray()
      res.send(result)
    

    })




    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
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





