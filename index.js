require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const path = require('path');
const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://saaumedia:asNnp1iTshQqsQXp@cluster0.97ytcfh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
mongoose.connection.on('connected', () => {
  console.log('Connected to MongoDB');
});
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/gemini', require('./routes/gemini'));
app.use('/api/image-generation', require('./routes/image-generation'));
app.use('/api/linkedin', require('./routes/linkedin')); 

// // Serve static files from the React frontend build directory
// app.use(express.static(path.join(__dirname, '../frontend/build')));

// // All other GET requests not handled by API routes should return the React app
// app.get('*', (req, res) => {
//   res.sendFile(path.resolve(__dirname, '../frontend', 'build', 'index.html'));
// });

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 