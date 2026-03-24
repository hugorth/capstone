const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  const falls = req.user.falls || [];
  
  res.json({
    success: true,
    data: {
      totalFalls: falls.length,
      lastFall: falls.length > 0 ? falls[falls.length - 1].date : null,
      fallsThisMonth: falls.filter(f => new Date(f.date).getMonth() === new Date().getMonth()).length,
      fallsThisYear: falls.filter(f => new Date(f.date).getFullYear() === new Date().getFullYear()).length,
      history: falls
    }
  });
});

router.post('/', async (req, res) => {
  try {
    const user = req.user;
    
    // Create new fall record
    const newFall = {
      date: new Date(),
      location: req.body.location || 'Position inconnue',
      severity: req.body.severity || 'Élevée'
    };
    
    // Add to user falls
    user.falls = user.falls || [];
    user.falls.push(newFall);
    
    await user.save({ validateModifiedOnly: true });
    
    res.json({ success: true, data: newFall });
  } catch (error) {
    console.error('Error saving fall:', error);
    res.status(500).json({ success: false, error: 'Failed to record fall' });
  }
});

module.exports = router;