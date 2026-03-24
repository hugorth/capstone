const express = require('express');
const router = express.Router();

// Generate simulated activity data
function generateActivityData() {
  const variance = (base, range) => base + (Math.random() - 0.5) * range;
  
  return {
    steps: Math.round(variance(3847, 500)),
    distance: +(variance(2.89, 0.5)).toFixed(2),
    calories: Math.round(variance(187, 30)),
    activeMinutes: Math.round(variance(142, 20)),
    cadence: Math.round(variance(112, 10)),
    gaitSpeed: +(variance(1.2, 0.2)).toFixed(2),
    strideLength: +(variance(0.65, 0.1)).toFixed(2),
    symmetry: Math.round(variance(87, 5)),
    stability: Math.round(variance(82, 5))
  };
}

// Generate weekly activity data
function generateWeeklyActivity() {
  return Array.from({ length: 7 }, (_, i) => ({
    day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
    steps: Math.round(3000 + Math.random() * 3000),
    distance: +(2 + Math.random() * 2).toFixed(2),
    calories: Math.round(150 + Math.random() * 100)
  }));
}

// Generate heatmap data
function generateHeatmapData() {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  return days.map(day => ({
    day,
    data: hours.map(hour => ({
      hour,
      value: Math.round(Math.random() * 100)
    }))
  }));
}

/**
 * @route   GET /api/activity
 * @desc    Get current activity data
 * @access  Private
 */
router.get('/', (req, res) => {
  try {
    const activityData = generateActivityData();
    activityData.steps = req.user.dailySteps || 0;
    activityData.distance = parseFloat((activityData.steps * 0.7 / 1000).toFixed(2));
    activityData.calories = Math.round(activityData.steps * 0.04);
    
    res.json({
      success: true,
      data: activityData
    });
  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get activity data'
    });
  }
});

/**
 * @route   GET /api/activity/weekly
 * @desc    Get weekly activity data
 * @access  Private
 */
router.get('/weekly', (req, res) => {
  try {
    const weeklyData = generateWeeklyActivity();
    
    res.json({
      success: true,
      data: weeklyData
    });
  } catch (error) {
    console.error('Get weekly activity error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get weekly activity data'
    });
  }
});

/**
 * @route   GET /api/activity/heatmap
 * @desc    Get activity heatmap data
 * @access  Private
 */
router.get('/heatmap', (req, res) => {
  try {
    const heatmapData = generateHeatmapData();
    
    res.json({
      success: true,
      data: heatmapData
    });
  } catch (error) {
    console.error('Get heatmap error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get heatmap data'
    });
  }
});

/**
 * @route   POST /api/activity/sync-steps
 * @desc    Add un-synced user steps
 * @access  Private
 */
router.post('/sync-steps', async (req, res) => {
  try {
    const user = req.user;
    const stepsToAdd = req.body.steps || 0;
    
    if (stepsToAdd > 0) {
      user.dailySteps = (user.dailySteps || 0) + stepsToAdd;
      await user.save({ validateModifiedOnly: true });
    }
    
    res.json({ success: true, dailySteps: user.dailySteps });
  } catch (error) {
    console.error('Sync steps error:', error);
    res.status(500).json({ success: false, error: 'Failed to sync steps' });
  }
});

module.exports = router;
