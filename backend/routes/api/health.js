const express = require('express');
const router = express.Router();

function generateHealthData() {
  const variance = (base, range) => base + (Math.random() - 0.5) * range;
  
  return {
    heartRate: Math.round(variance(72, 10)),
    bloodPressure: {
      systolic: Math.round(variance(120, 10)),
      diastolic: Math.round(variance(80, 5))
    },
    bloodOxygen: Math.round(variance(98, 2)),
    temperature: +(variance(36.8, 0.5)).toFixed(1),
    stressLevel: ['low', 'moderate', 'high'][Math.floor(Math.random() * 3)],
    lastUpdate: new Date()
  };
}

router.get('/', (req, res) => {
  const data = generateHealthData();
  data.steps = req.user.dailySteps || 0;
  res.json({ success: true, data });
});

router.get('/heartrate/history', (req, res) => {
  const history = Array.from({ length: 24 }, (_, i) => ({
    time: new Date(Date.now() - (23 - i) * 3600000).toISOString(),
    value: Math.round(65 + Math.random() * 20)
  }));
  res.json({ success: true, data: history });
});

module.exports = router;