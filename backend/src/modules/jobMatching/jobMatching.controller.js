const jobMatchingService = require('./jobMatching.service');

const healthCheck = (req, res) => {
    const healthstatus = jobMatchingService.getHealthStatus();

    res.json(healthstatus);
};

const predict = async (req, res) => {
    try {
        const result = await jobMatchingService.predict(req.body);
        res.json(result);
    } catch (error) {
        console.error('Prediction Failed:', error.message);
        res.status(error.status === 422 ? 422 : 502).json({
            message: 'Prediction Failed',
            error: error.message
        });
    }
};

module.exports = {
    healthCheck,
    predict
};