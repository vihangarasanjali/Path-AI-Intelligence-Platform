const express = require('express');
const cors = require('cors');

const jobMatchingRoutes = require('./modules/jobMatching/jobMatching.routes');
const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/job-matching', jobMatchingRoutes);

module.exports = app;