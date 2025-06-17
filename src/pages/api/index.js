// Add these routes to your existing pages/api/index.js file

const logger = require("../../utils/logger.js");
const database = require("../../utils/database.js");
const rateLimit = require("express-rate-limit");
const express = require("express");
const router = express.Router();

// Workout-specific rate limiter
const workoutLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // limit each IP to 30 requests per minute for workout operations
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip + '_workout',
    handler: (req, res, next, options) => {
        res.set('Retry-After', Math.ceil(options.windowMs / 1000));
        res.status(options.statusCode).json({ 
            success: false, 
            error: "Rate limit exceeded for workout operations.",
            retryAfter: Math.ceil(options.windowMs / 1000)
        });
    }
});

// Helper function to generate user ID from IP if not provided
function getUserId(req) {
    return req.body.userId || req.query.userId || `anon_${req.ip.replace(/\./g, '_')}`;
}

// Get user's workout history
router.get("/workouts/history/:userId", workoutLimiter, async function (req, res) {
    try {
        const { userId } = req.params;
        const { limit = 20, offset = 0 } = req.query;
        
        logger.info(`[WORKOUT-API] Getting workout history for user: ${userId}`);
        
        // Get all workout keys for this user using pattern matching
        const workoutKeys = await database.keys(`workout:${userId}_*`);
        
        if (!workoutKeys || workoutKeys.length === 0) {
            return res.json({ success: true, workouts: [] });
        }
        
        // Get workout details and sort by date
        const workouts = [];
        for (const workoutKey of workoutKeys) {
            const workoutData = await database.get(workoutKey);
            if (workoutData) {
                const workout = JSON.parse(workoutData);
                if (workout.status === 'completed') {
                    workouts.push(workout);
                }
            }
        }
        
        // Sort by end time (newest first)
        workouts.sort((a, b) => {
            const dateA = new Date(a.endTime || a.startTime);
            const dateB = new Date(b.endTime || b.startTime);
            return dateB - dateA;
        });
        
        // Apply limit and offset
        const paginatedWorkouts = workouts.slice(offset, offset + parseInt(limit));
        
        logger.info(`[WORKOUT-API] Retrieved ${paginatedWorkouts.length} workouts for user ${userId}`);
        res.json({ success: true, workouts: paginatedWorkouts });
        
    } catch (error) {
        logger.error(`[WORKOUT-API] Error getting workout history: ${error.message}`);
        res.status(500).json({ success: false, error: 'Failed to get workout history' });
    }
});

// Start a new workout
router.post("/workouts/start", workoutLimiter, async function (req, res) {
    try {
        const { userId: reqUserId, duration, startingWeight } = req.body;
        const userId = reqUserId || getUserId(req);
        
        if (!duration || !startingWeight) {
            return res.status(400).json({ success: false, error: 'Duration and starting weight are required' });
        }
        
        logger.info(`[WORKOUT-API] Starting workout for user: ${userId}, duration: ${duration}min, weight: ${startingWeight}lbs`);
        
        const workoutId = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const workout = {
            id: workoutId,
            userId,
            duration: parseInt(duration),
            startingWeight: parseInt(startingWeight),
            startTime: new Date().toISOString(),
            status: 'active',
            exercises: [],
            totalElapsed: 0
        };
        
        // Store workout data
        await database.set(`workout:${workoutId}`, JSON.stringify(workout));
        
        // Add to user's active workouts
        await database.set(`user:${userId}:active_workout`, workoutId);
        
        logger.info(`[WORKOUT-API] Started workout ${workoutId} for user ${userId}`);
        res.json({ success: true, workoutId, workout });
        
    } catch (error) {
        logger.error(`[WORKOUT-API] Error starting workout: ${error.message}`);
        res.status(500).json({ success: false, error: 'Failed to start workout' });
    }
});

// Update workout progress
router.put("/workouts/update/:workoutId", workoutLimiter, async function (req, res) {
    try {
        const { workoutId } = req.params;
        const { currentExercise, currentWeight, totalElapsed, exerciseData } = req.body;
        
        logger.info(`[WORKOUT-API] Updating workout: ${workoutId}`);
        
        const workoutData = await database.get(`workout:${workoutId}`);
        if (!workoutData) {
            return res.status(404).json({ success: false, error: 'Workout not found' });
        }
        
        const workout = JSON.parse(workoutData);
        
        // Update workout fields
        if (currentExercise !== undefined) workout.currentExercise = currentExercise;
        if (currentWeight !== undefined) workout.currentWeight = currentWeight;
        if (totalElapsed !== undefined) workout.totalElapsed = totalElapsed;
        if (exerciseData) workout.exercises.push(exerciseData);
        
        workout.lastUpdated = new Date().toISOString();
        
        await database.set(`workout:${workoutId}`, JSON.stringify(workout));
        
        logger.info(`[WORKOUT-API] Updated workout ${workoutId}`);
        res.json({ success: true, workout });
        
    } catch (error) {
        logger.error(`[WORKOUT-API] Error updating workout: ${error.message}`);
        res.status(500).json({ success: false, error: 'Failed to update workout' });
    }
});

// Complete a workout
router.post("/workouts/complete/:workoutId", workoutLimiter, async function (req, res) {
    try {
        const { workoutId } = req.params;
        const { actualTime, maxWeight, completed = true } = req.body;
        
        logger.info(`[WORKOUT-API] Completing workout: ${workoutId}`);
        
        const workoutData = await database.get(`workout:${workoutId}`);
        if (!workoutData) {
            return res.status(404).json({ success: false, error: 'Workout not found' });
        }
        
        const workout = JSON.parse(workoutData);
        
        // Update completion data
        workout.status = 'completed';
        workout.actualTime = parseInt(actualTime);
        workout.maxWeight = parseInt(maxWeight);
        workout.completed = completed;
        workout.endTime = new Date().toISOString();
        
        // Save completed workout
        await database.set(`workout:${workoutId}`, JSON.stringify(workout));
        
        // Update user stats
        await updateUserStats(workout.userId, {
            totalWorkouts: 1,
            totalTimeMinutes: workout.actualTime,
            maxWeight: workout.maxWeight
        });
        
        logger.info(`[WORKOUT-API] Completed workout ${workoutId} for user ${workout.userId}`);
        res.json({ success: true, workout });
        
    } catch (error) {
        logger.error(`[WORKOUT-API] Error completing workout: ${error.message}`);
        res.status(500).json({ success: false, error: 'Failed to complete workout' });
    }
});

// Get user statistics
router.get("/workouts/stats/:userId", workoutLimiter, async function (req, res) {
    try {
        const { userId } = req.params;
        
        logger.info(`[WORKOUT-API] Getting stats for user: ${userId}`);
        
        // Get basic stats
        const statsData = await database.get(`user:${userId}:stats`);
        const stats = statsData ? JSON.parse(statsData) : {
            totalWorkouts: 0,
            totalTimeMinutes: 0,
            maxWeight: 0
        };
        
        // Calculate weekly stats by checking completed workouts this week
        const weekStart = getStartOfWeek();
        const weekEnd = weekStart + (7 * 24 * 60 * 60 * 1000);
        
        // Get all workout keys for this user
        const workoutKeys = await database.keys(`workout:${userId}_*`);
        let thisWeekCount = 0;
        
        for (const workoutKey of workoutKeys) {
            const workoutData = await database.get(workoutKey);
            if (workoutData) {
                const workout = JSON.parse(workoutData);
                if (workout.status === 'completed' && workout.endTime) {
                    const workoutTime = new Date(workout.endTime).getTime();
                    if (workoutTime >= weekStart && workoutTime <= weekEnd) {
                        thisWeekCount++;
                    }
                }
            }
        }
        
        // Calculate current streak
        const streak = await calculateCurrentStreak(userId);
        
        const response = {
            success: true,
            totalWorkouts: stats.totalWorkouts,
            totalTimeMinutes: stats.totalTimeMinutes,
            maxWeight: stats.maxWeight,
            thisWeekWorkouts: thisWeekCount,
            currentStreak: streak,
            weeklyProgress: `${thisWeekCount}/7`
        };
        
        logger.info(`[WORKOUT-API] Retrieved stats for user ${userId}`);
        res.json(response);
        
    } catch (error) {
        logger.error(`[WORKOUT-API] Error getting stats: ${error.message}`);
        res.status(500).json({ success: false, error: 'Failed to get user statistics' });
    }
});

// Get user achievements
router.get("/workouts/achievements/:userId", workoutLimiter, async function (req, res) {
    try {
        const { userId } = req.params;
        
        logger.info(`[WORKOUT-API] Getting achievements for user: ${userId}`);
        
        const achievementsData = await database.get(`user:${userId}:achievements`);
        const achievements = achievementsData ? JSON.parse(achievementsData) : [];
        
        logger.info(`[WORKOUT-API] Retrieved ${achievements.length} achievements for user ${userId}`);
        res.json({ success: true, achievements });
        
    } catch (error) {
        logger.error(`[WORKOUT-API] Error getting achievements: ${error.message}`);
        res.status(500).json({ success: false, error: 'Failed to get achievements' });
    }
});

// Check and award achievements
router.post("/workouts/achievements/check/:userId", workoutLimiter, async function (req, res) {
    try {
        const { userId } = req.params;
        
        logger.info(`[WORKOUT-API] Checking achievements for user: ${userId}`);
        
        // Get current stats and achievements
        const statsData = await database.get(`user:${userId}:stats`);
        const stats = statsData ? JSON.parse(statsData) : { totalWorkouts: 0, totalTimeMinutes: 0, maxWeight: 0 };
        
        const achievementsData = await database.get(`user:${userId}:achievements`);
        const currentAchievements = achievementsData ? JSON.parse(achievementsData) : [];
        
        // Get workout keys for additional checks
        const workoutKeys = await database.keys(`workout:${userId}_*`);
        
        const newAchievements = [];
        
        // Achievement checks
        const achievementChecks = [
            { id: 'first-workout', condition: stats.totalWorkouts >= 1, name: 'First Step' },
            { id: 'dedication', condition: stats.totalWorkouts >= 5, name: 'Dedicated' },
            { id: 'ten-workouts', condition: stats.totalWorkouts >= 10, name: 'Consistent' },
            { id: 'consistency', condition: stats.totalWorkouts >= 20, name: 'Committed' },
            { id: 'two-pounds', condition: stats.maxWeight >= 2, name: '2 Pound Club' },
            { id: 'five-pounds', condition: stats.maxWeight >= 5, name: '5 Pound Club' },
            { id: 'heavy-lifter', condition: stats.maxWeight >= 6, name: 'Heavy Lifter' },
            { id: 'serious-lifter', condition: stats.maxWeight >= 8, name: 'Serious Lifter' }
        ];
        
        for (const check of achievementChecks) {
            if (check.condition && !currentAchievements.includes(check.id)) {
                newAchievements.push({ id: check.id, name: check.name });
                currentAchievements.push(check.id);
            }
        }
        
        // Check streak achievement
        const streak = await calculateCurrentStreak(userId);
        if (streak >= 7 && !currentAchievements.includes('week-streak')) {
            newAchievements.push({ id: 'week-streak', name: '7-Day Streak' });
            currentAchievements.push('week-streak');
        }
        
        if (streak >= 30 && !currentAchievements.includes('month-streak')) {
            newAchievements.push({ id: 'month-streak', name: '30-Day Streak' });
            currentAchievements.push('month-streak');
        }
        
        // Check for monthly-master achievement (20 workouts in a single month)
        if (!currentAchievements.includes('monthly-master')) {
            const now = new Date();
            const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            
            let monthlyWorkouts = 0;
            
            // Count workouts in the current month
            for (const workoutKey of workoutKeys) {
                const workoutData = await database.get(workoutKey);
                if (workoutData) {
                    const workout = JSON.parse(workoutData);
                    if (workout.status === 'completed' && workout.endTime) {
                        const workoutDate = new Date(workout.endTime);
                        if (workoutDate >= firstDayOfMonth && workoutDate <= lastDayOfMonth) {
                            monthlyWorkouts++;
                        }
                    }
                }
            }
            
            if (monthlyWorkouts >= 20) {
                newAchievements.push({ id: 'monthly-master', name: 'Monthly Master' });
                currentAchievements.push('monthly-master');
            }
        }
        
        // Save updated achievements
        if (newAchievements.length > 0) {
            await database.set(`user:${userId}:achievements`, JSON.stringify(currentAchievements));
            
            // Log achievement awards (using a simple counter since lpush isn't available)
            for (const achievement of newAchievements) {
                const logKey = `user:${userId}:achievement_log:${Date.now()}`;
                await database.set(logKey, JSON.stringify({
                    ...achievement,
                    awardedAt: new Date().toISOString()
                }));
            }
        }
        
        logger.info(`[WORKOUT-API] Awarded ${newAchievements.length} new achievements to user ${userId}`);
        res.json({ success: true, newAchievements });
        
    } catch (error) {
        logger.error(`[WORKOUT-API] Error checking achievements: ${error.message}`);
        res.status(500).json({ success: false, error: 'Failed to check achievements' });
    }
});

// Helper functions
async function updateUserStats(userId, increments) {
    try {
        const statsData = await database.get(`user:${userId}:stats`);
        const stats = statsData ? JSON.parse(statsData) : {
            totalWorkouts: 0,
            totalTimeMinutes: 0,
            maxWeight: 0
        };
        
        if (increments.totalWorkouts) {
            stats.totalWorkouts += increments.totalWorkouts;
        }
        
        if (increments.totalTimeMinutes) {
            stats.totalTimeMinutes += increments.totalTimeMinutes;
        }
        
        if (increments.maxWeight && increments.maxWeight > stats.maxWeight) {
            stats.maxWeight = increments.maxWeight;
        }
        
        await database.set(`user:${userId}:stats`, JSON.stringify(stats));
        
    } catch (error) {
        logger.error(`[WORKOUT-API] Error updating user stats: ${error.message}`);
    }
}

function getStartOfWeek() {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    return startOfWeek.getTime();
}

async function calculateCurrentStreak(userId) {
    try {
        let streak = 0;
        const today = new Date();
        
        // Get all workout keys for this user
        const workoutKeys = await database.keys(`workout:${userId}_*`);
        const completedWorkouts = [];
        
        // Get all completed workouts with dates
        for (const workoutKey of workoutKeys) {
            const workoutData = await database.get(workoutKey);
            if (workoutData) {
                const workout = JSON.parse(workoutData);
                if (workout.status === 'completed' && workout.endTime) {
                    completedWorkouts.push(new Date(workout.endTime));
                }
            }
        }
        
        // Sort workouts by date (newest first)
        completedWorkouts.sort((a, b) => b - a);
        
        // Check consecutive days starting from today
        for (let i = 0; i < 30; i++) {
            const checkDate = new Date(today);
            checkDate.setDate(today.getDate() - i);
            checkDate.setHours(0, 0, 0, 0);
            
            const dayEnd = new Date(checkDate);
            dayEnd.setHours(23, 59, 59, 999);
            
            // Check if there's a workout on this day
            const hasWorkout = completedWorkouts.some(workoutDate => 
                workoutDate >= checkDate && workoutDate <= dayEnd
            );
            
            if (hasWorkout) {
                streak++;
            } else {
                break;
            }
        }
        
        return streak;
    } catch (error) {
        logger.error(`[WORKOUT-API] Error calculating streak: ${error.message}`);
        return 0;
    }
}

// Add workout routes logging
logger.info("[API] Loaded workout timer API routes");

module.exports = router;