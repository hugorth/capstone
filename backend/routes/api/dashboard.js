const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      user: req.user.toSafeObject(),
      falls: req.user.falls || [],
      summary: {
        steps: req.user.dailySteps || 0,
        distance: parseFloat((((req.user.dailySteps || 0) * 0.7) / 1000).toFixed(2)),
        calories: Math.round((req.user.dailySteps || 0) * 0.04),
        heartRate: Math.round(65 + Math.random() * 15),
        battery: Math.round(70 + Math.random() * 20),
        alerts: Math.floor(Math.random() * 3)
      }
    }
  });
});

module.exports = router;