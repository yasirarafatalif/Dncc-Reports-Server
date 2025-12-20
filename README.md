# 🛠️ Public Infrastructure Issue Reporting System – Backend

This is the **server-side (backend)** of the Public Infrastructure Issue Reporting System.  
It provides RESTful APIs for managing issues, users, roles, payments, upvotes, timelines, and authentication with secure role-based access.

---

## 🌐 Live Server URL
[https://nagorikserver.vercel.ap](https://nagorikserver.vercel.app/)

---

## 🔐 Admin Credentials (Demo)
- **Email:** testadmin@gmail.com  
- **Password:** 123123  

---

## 👤 Demo User Credentials

### Citizen
- **Email:** testuser1@gmail.com
- **Password:** 123123

### Staff
- **Email:** staff1@gmail.com  
- **Password:** 123123  

---

## 🚀 Backend Features

- RESTful API built with **Node.js & Express**
- MongoDB database with proper schema design
- Firebase Authentication integration
- JWT token-based authentication
- Role-based authorization (Admin, Staff, Citizen)
- Issue lifecycle management (Pending → In-Progress → Resolved → Closed)
- Timeline tracking for every important action
- Staff assignment system (Admin-only)
- Upvote system (prevent duplicate upvotes)
- Boost issue priority via payment record
- Premium subscription handling
- User blocking/unblocking system
- Pagination, search & filter APIs
- Secure environment variable usage
- PDF invoice data support for frontend
- Centralized error handling
- Clean & scalable folder structure

---

## 📂 API Modules Overview

### 🔑 Authentication
- User registration & login
- Google sign-in support
- JWT token verification

### 👥 User Management
- Get all users
- Block / Unblock users
- Assign roles (admin, staff, citizen)
- Premium subscription update

### 🧾 Issues
- Create issue
- Get all issues (with pagination, search & filter)
- Get single issue details
- Update issue (citizen – pending only)
- Delete issue
- Assign staff (admin only)
- Reject issue (admin only)
- Change issue status (staff only)
- Boost issue priority
- Upvote issue (one user one vote)

### 🧭 Issue Timeline
- Auto-create timeline on:
  - Issue creation
  - Staff assignment
  - Status change
  - Boost payment
  - Issue rejection
  - Issue closure
- Read-only timeline (audit history)

### 💳 Payments
- Boost issue payment (100৳)
- Premium subscription payment (1000৳)
- Get all payments (admin)
- User payment history
- Monthly payment aggregation (optional)

### 👨‍🔧 Staff
- Add staff (admin creates Firebase user)
- Update staff info
- Delete staff
- View assigned issues

---

## 🛠️ Technologies Used

- Node.js
- Express.js
- MongoDB
- Mongoose
- Firebase Admin SDK
- JSON Web Token (JWT)
- Stripe Payment Gateway
- dotenv
- CORS

---

## 🔒 Security & Best Practices

- JWT token verification middleware
- Role-based route protection
- Firebase & MongoDB secrets hidden using `.env`
- Prevent unauthorized access
- No sensitive data exposed in API responses
- Input validation & error handling

---

## 📁 Project Structure

