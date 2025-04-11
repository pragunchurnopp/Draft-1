const express = require('express');
const mongoose = require('mongoose');   
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cors = require('cors');
const dotenv = require('dotenv').config();
const { time } = require('console');
const churnCache = {};

const app = express();
app.use(express.json());
app.use(cors());

mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

const clientSchema = new mongoose.Schema({
    clientID:{ type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    subscriptionPlan: {type: String, enum: ['basic', 'premium', 'enterprise'], default: 'basic', required: true}
});
const Client = mongoose.model('Client', clientSchema);

const EventSchema = new mongoose.Schema({
    clientID: { type: String},
    userID: { type: String},
    event: { type: String },
    data: { type: Object },
    email: { type: String },
    timestamp: { type: Date, default: Date.now },
});
const Event = mongoose.model('Event', EventSchema);

const adminSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }
  });
  
  const Admin = mongoose.model('Admin', adminSchema);  

  const UserMapSchema = new mongoose.Schema({
    clientID: String,
    userID: String,
    email: String,
    lastSeen: { type: Date, default: Date.now }
  });
  const UserMap = mongoose.model('UserMap', UserMapSchema);
  

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Missing token' });

    jwt.verify(token, process.env.JWT_SECRET, (err, client) => {
        if (err) return res.status(403).json({ message: 'Invalid token' });
        req.client = client;
        next();
    });
}

app.post('/api/auth/login', async (req, res) => {
    const {email,password} = req.body;
    const client = await Client.findOne({email});
    if(!client || !bcrypt.compareSync(password, client.password)){
        return res.status(401).json({message: 'Invalid credentials'});
    }
    const token = jwt.sign({clientID: client.clientID, subscriptionPlan: client.subscriptionPlan}, process.env.JWT_SECRET, {expiresIn: '1h'});
    res.json({token});
});

app.post('/api/admin/login', async (req, res) => {
    const { email, password } = req.body;
  
    const admin = await Admin.findOne({ email });
    if (!admin || !bcrypt.compareSync(password, admin.password)) {
      return res.status(401).json({ message: 'Invalid admin credentials' });
    }
  
    const token = jwt.sign({ role: 'admin', email }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  });  

  app.post('/api/events', async (req, res) => {
    try {
      const { clientID, userID, event, data } = req.body;
      const client = await Client.findOne({ clientID });
      if (!client) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
  
      const allowedEvents = {
        basic: ['sessionDuration', 'interaction', 'scrollDepth'],
        premium: ['cartAbandonment', 'checkoutProgress', 'userActive', 'userInactive', 'sessionDuration', 'interaction', 'scrollDepth'],
        enterprise: ['cartAbandonment', 'checkoutProgress', 'userActive', 'userInactive', 'sessionDuration', 'interaction', 'scrollDepth', 'rageClick', 'helpCenterVisit', 'exitIntent', 'deviceInfo']
      };
  
      if (!allowedEvents[client.subscriptionPlan].includes(event)) {
        return res.status(403).json({ message: 'Event not allowed for your subscription plan' });
      }
  
      const newEvent = new Event({ clientID, userID, event, data, email: data?.email || null });
      await newEvent.save();

      if (email) {
        await UserMap.findOneAndUpdate(
          { clientID, userID },
          { email, lastSeen: new Date() },
          { upsert: true }
        );
      }
      

      res.status(201).json({ message: 'Event saved successfully' });
    } catch (err) {
      console.error('Error processing /api/events:', err);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });
  

app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
    const clientID = req.client.clientID;
    const { eventType, userID, startDate, endDate } = req.query;

    const match = { clientID };

    if (eventType) match.event = eventType;
    if (userID) match.userID = userID;
    if (startDate || endDate) {
        match.timestamp = {};
        if (startDate) match.timestamp.$gte = new Date(startDate);
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            match.timestamp.$lte = end;
        }
    }

    try {
        const pipeline = [
            { $match: match },
            {
                $facet: {
                    totalEvents: [ { $count: 'count' } ],
                    totalSessions: [ { $match: { event: 'sessionDuration' } }, { $count: 'count' } ],
                    avgSessionDuration: [
                        { $match: { event: 'sessionDuration' } },
                        { $group: { _id: null, avg: { $avg: "$data.duration" } } }
                    ],
                    avgScrollDepth: [
                        { $match: { event: 'scrollDepth' } },
                        { $group: { _id: null, avg: { $avg: "$data.depth" } } }
                    ],
                    eventCounts: [
                        { $group: { _id: "$event", count: { $sum: 1 } } }
                    ],
                    topUsers: [
                        { $group: { _id: "$userID", count: { $sum: 1 } } },
                        { $sort: { count: -1 } },
                        { $limit: 5 }
                    ]
                }
            }
        ];

        const [results] = await Event.aggregate(pipeline);

        res.json({
            totalEvents: results.totalEvents[0]?.count || 0,
            totalSessions: results.totalSessions[0]?.count || 0,
            avgSessionDuration: Math.round(results.avgSessionDuration[0]?.avg || 0),
            avgScrollDepth: Math.round(results.avgScrollDepth[0]?.avg || 0),
            eventCounts: Object.fromEntries(results.eventCounts.map(e => [e._id, e.count])),
            topUsers: results.topUsers.map(u => ({ userID: u._id, eventCount: u.count }))
        });

    } catch (err) {
        console.error("Stats aggregation error:", err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


app.get('/api/dashboard/overview', authenticateToken, async (req, res) => {
    const clientID = req.client.clientID;
    const { eventType, userID, startDate, endDate } = req.query;

    const match = { clientID };

    if (eventType) match.event = eventType;
    if (userID) match.userID = userID;
    if (startDate || endDate) {
        match.timestamp = {};
        if (startDate) match.timestamp.$gte = new Date(startDate);
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            match.timestamp.$lte = end;
        }
    }

    try {
        const events = await Event.find(match).sort({ timestamp: -1 }).limit(100);
        res.json(events);
    } catch (err) {
        console.error("Event overview error:", err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Middleware to restrict access to admin routes 
const adminAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'Missing token' });
  
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.role !== 'admin') throw new Error();
      next();
    } catch {
      res.status(403).json({ message: 'Invalid or expired token' });
    }
  };
  
  
  // GET all clients
  app.get('/api/admin/clients', adminAuth, async (req, res) => {
    const clients = await Client.find({}, '-password'); // Exclude password
    res.json(clients);
  });
  
  // POST create a new client
  app.post('/api/admin/clients', adminAuth, async (req, res) => {
    const { email, password, subscriptionPlan } = req.body;
  
    if (!email || !password || !subscriptionPlan) {
      return res.status(400).json({ message: 'Missing fields' });
    }
  
    const hashedPassword = bcrypt.hashSync(password, 10);
    const clientID = `client_${Math.random().toString(36).substr(2, 9)}`;
  
    const newClient = new Client({
      clientID,
      email,
      password: hashedPassword,
      subscriptionPlan,
    });
  
    try {
      await newClient.save();
      res.status(201).json({ message: 'Client created', clientID });
    } catch (err) {
      res.status(500).json({ message: 'Error creating client', error: err.message });
    }
  });
  
  // DELETE a client by ID
  app.delete('/api/admin/clients/:id', adminAuth, async (req, res) => {
    try {
      await Client.findByIdAndDelete(req.params.id);
      res.json({ message: 'Client deleted' });
    } catch (err) {
      res.status(500).json({ message: 'Error deleting client', error: err.message });
    }
  });
  
  // PUT update client (plan/email)
  app.put('/api/admin/clients/:id', adminAuth, async (req, res) => {
    const updates = req.body;
    try {
      const updatedClient = await Client.findByIdAndUpdate(req.params.id, updates, { new: true });
      res.json(updatedClient);
    } catch (err) {
      res.status(500).json({ message: 'Error updating client', error: err.message });
    }
  });

  app.get('/api/admin/analytics', adminAuth, async (req, res) => {
    try {
      const total = await Client.countDocuments();
      const byPlan = await Client.aggregate([
        { $group: { _id: "$subscriptionPlan", count: { $sum: 1 } } }
      ]);
      const recent = await Client.find().sort({ _id: -1 }).limit(3).select('email subscriptionPlan clientID');
  
      res.json({
        totalClients: total,
        clientsByPlan: Object.fromEntries(byPlan.map(p => [p._id, p.count])),
        recentClients: recent
      });
    } catch (err) {
      res.status(500).json({ message: 'Failed to load analytics' });
    }
  });  


app.get('/api/churn/:userId', authenticateToken, async (req, res) => {
  const { userId } = req.params;
  const clientID = req.client.clientID; // Extracted from the JWT via authenticateToken
  const cacheKey = `${clientID}_${userId}`;

  // Check cache
  if (churnCache[cacheKey] && (Date.now() - churnCache[cacheKey].timestamp < 3600000)) {
    return res.json({ churnScore: churnCache[cacheKey].score });
  }

  try {
    const events = await Event.find({ userID: userId, clientID });

    if (events.length === 0) {
      churnCache[cacheKey] = { score: 1, timestamp: Date.now() };
      return res.json({ churnScore: 1 });
    }

    const now = Date.now();
    const lastEvent = Math.max(...events.map(e => new Date(e.timestamp).getTime()));
    const lastActiveDays = (now - lastEvent) / (1000 * 60 * 60 * 24);

    const scrollEvents = events.filter(e => e.event === 'scrollDepth');
    const maxScroll = Math.max(...scrollEvents.map(e => e.data?.depth || 0), 0);

    const rageClicks = events.filter(e => e.event === 'rageClick').length;
    const cartEvents = events.some(e => e.event === 'cartAbandonment');
    const helpVisits = events.some(e => e.event === 'helpCenterVisit');

    const sessionEvents = events.filter(e => e.event === 'sessionDuration');
    const totalSessionTime = sessionEvents.reduce((sum, e) => sum + (e.data?.duration || 0), 0) / 1000;
    const avgSessionTime = totalSessionTime / (sessionEvents.length || 1);

    // Logic-based churn score
    let score = 0;
    if (lastActiveDays > 7) score += 0.25;
    if (maxScroll < 25) score += 0.15;
    if (rageClicks > 3) score += 0.15;
    if (!cartEvents) score += 0.10;
    if (!helpVisits) score += 0.05;
    if (avgSessionTime < 30) score += 0.15;
    if (totalSessionTime < 300) score += 0.15;

    const sendChurnEmail = require('./utils/sendEmail');

    const finalScore = Math.min(score, 1).toFixed(2);
    churnCache[cacheKey] = { score: finalScore, timestamp: Date.now() };
    if (parseFloat(finalScore) > 0.5) {
      sendChurnEmail(userId, clientID, finalScore); // async fire-and-forget
    }

    res.json({ churnScore: finalScore });
  } catch (err) {
    console.error("Churn calculation error:", err);
    res.status(500).json({ error: "Churn score calculation failed." });
  }
});


  app.get('/api/dashboard/churn-users', authenticateToken, async (req, res) => {
    const clientID = req.client.clientID;
    try {
      const users = await Event.aggregate([
        { $match: { clientID } },
        { $group: { _id: "$userID" } }
      ]);
  
      const scores = [];
      for (const user of users) {
        const response = await fetch(`http://localhost:5000/api/churn/${user._id}`);
        const result = await response.json();
        scores.push({ userID: user._id, churnScore: result.churnScore });
      }
  
      scores.sort((a, b) => b.churnScore - a.churnScore);
      res.json(scores);
  
    } catch (err) {
      console.error("Churn user list error:", err);
      res.status(500).json({ message: "Failed to load churn users" });
    }
  });
  
  


const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server running on port ${port}`));
