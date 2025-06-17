console.log("");
console.log(`  ██╗    ██╗ ██████╗ ██████╗ ██╗  ██╗ ██████╗ ██╗   ██╗████████╗    ████████╗██╗███╗   ███╗███████╗██████╗ 
 ██║    ██║██╔═══██╗██╔══██╗██║ ██╔╝██╔═══██╗██║   ██║╚══██╔══╝    ╚══██╔══╝██║████╗ ████║██╔════╝██╔══██╗
 ██║ █╗ ██║██║   ██║██████╔╝█████╔╝ ██║   ██║██║   ██║   ██║          ██║   ██║██╔████╔██║█████╗  ██████╔╝
 ██║███╗██║██║   ██║██╔══██╗██╔═██╗ ██║   ██║██║   ██║   ██║          ██║   ██║██║╚██╔╝██║██╔══╝  ██╔══██╗
 ╚███╔███╔╝╚██████╔╝██║  ██║██║  ██╗╚██████╔╝╚██████╔╝   ██║          ██║   ██║██║ ╚═╝ ██║███████╗██║  ██║
  ╚══╝╚══╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝  ╚═════╝    ╚═╝          ╚═╝   ╚═╝╚═╝     ╚═╝╚══════╝╚═╝  ╚═╝`);
console.log("");
console.log("                                          Workout Timer Application                                          ");
console.log("                                              Developed by: Philip Ehrbright                                              ");
console.log("                                           Weight Training Timer - 2025                                     ");
console.log("");

const logger = require("./utils/logger.js");
logger.info("[WORKOUT-APP] Loading logger utility...");

const express = require('express');
logger.info("[WORKOUT-APP] Loading Express framework...");
const app = express();

const cookieParser = require('cookie-parser');
logger.info("[WORKOUT-APP] Loading cookie-parser middleware...");

const cors = require('cors');
logger.info("[WORKOUT-APP] Loading CORS middleware...");

const path = require('path');
logger.info("[WORKOUT-APP] Loading path utility...");

const database = require("./utils/database.js");
logger.info("[WORKOUT-APP] Loading database utility...");

const { DateTime } = require("luxon");
logger.info("[WORKOUT-APP] Loading Luxon date-time library...");

logger.info("[WORKOUT-APP] Finished loading all required packages and modules.");

const PORT = process.env.PORT || 3000;

app.use(cookieParser());
logger.info("[WORKOUT-APP] Loaded cookie parser");

app.use(express.json());
logger.info("[WORKOUT-APP] Loaded JSON parser");

app.use(express.urlencoded({ extended: true }));
logger.info("[WORKOUT-APP] Loaded URL parser");

app.use(cors({
    origin: [`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`, `https://workoutapp.com`],
    credentials: true,
    allowedHeaders: "Content-Type, Authorization, Content-Length, X-Requested-With, Accept",
    methods: ["GET", "POST", "PUT", "DELETE"],
}));
logger.info("[WORKOUT-APP] Loaded CORS");

app.set("trust proxy", 1);
logger.info("[WORKOUT-APP] Set trust proxy");

// Static assets
app.use("/assets", express.static("assets"));
logger.info("[WORKOUT-APP] Loaded static assets");

// API Routes
app.use("/api", require("./pages/api/index.js"));
logger.info("[WORKOUT-APP] Loaded API routes");

// Serve the main workout timer app
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "workout-timer.html"));
});
logger.info("[WORKOUT-APP] Loaded home page route");

// Health check endpoint
app.get("/health", (req, res) => {
    const now = DateTime.now().setZone("America/Phoenix").toISO();

    res.json({ 
        status: "OK", 
        timestamp: now,
        uptime: process.uptime(),
        service: "workout-timer"
    });
});
logger.info("[WORKOUT-APP] Loaded health check endpoint");

// Gym status endpoint (for checking if gym is open)
app.get("/gym-status", (req, res) => {
    const now = DateTime.now().setZone("America/Phoenix");
    const day = now.weekday; // 1 = Monday, 7 = Sunday
    const hour = now.hour;
    const minute = now.minute;
    const currentTime = hour * 60 + minute;

    let closingTime;
    if (day === 7 || day === 6) { // Weekend (Saturday = 6, Sunday = 7)
        closingTime = 20 * 60; // 8 PM
    } else { // Weekday
        closingTime = 22 * 60; // 10 PM
    }

    const oneHourBefore = closingTime - 60;
    const thirtyMinsBefore = closingTime - 30;

    let status, message;

    if (currentTime >= closingTime) {
        status = 'closed';
        message = 'Gym is closed. Plan tomorrow\'s session.';
    } else if (currentTime >= thirtyMinsBefore) {
        const minsLeft = Math.floor((closingTime - currentTime));
        status = 'closing-soon';
        message = `Gym closes in ${minsLeft} minutes! Get moving.`;
    } else if (currentTime >= oneHourBefore) {
        const minsLeft = Math.floor((closingTime - currentTime));
        status = 'closing-soon';
        message = `Gym closes in ${minsLeft} minutes.`;
    } else {
        const hoursLeft = Math.floor((closingTime - currentTime) / 60);
        const minsLeft = (closingTime - currentTime) % 60;
        status = 'open';
        message = `Gym open for ${hoursLeft}h ${minsLeft}m.`;
    }

    res.json({
        success: true,
        status,
        message,
        currentTime: now.toISO(),
        closingTime: closingTime
    });
});
logger.info("[WORKOUT-APP] Loaded gym status endpoint");

// User dashboard endpoint
app.get("/dashboard", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});
logger.info("[WORKOUT-APP] Loaded dashboard route");

// Export workout data endpoint - Fixed to work with current API structure
app.get("/export/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const { format = 'json' } = req.query;
        
        logger.info(`[WORKOUT-APP] Exporting data for user: ${userId} in format: ${format}`);
        
        // Get user stats
        const statsData = await database.get(`user:${userId}:stats`);
        const stats = statsData ? JSON.parse(statsData) : {
            totalWorkouts: 0,
            totalTimeMinutes: 0,
            maxWeight: 0
        };
        
        // Get user achievements
        const achievementsData = await database.get(`user:${userId}:achievements`);
        const achievements = achievementsData ? JSON.parse(achievementsData) : [];
        
        // Get workout history using the same pattern as the API
        const workoutKeys = await database.keys(`workout:${userId}_*`);
        const workouts = [];
        
        if (workoutKeys && workoutKeys.length > 0) {
            for (const workoutKey of workoutKeys) {
                const workoutData = await database.get(workoutKey);
                if (workoutData) {
                    const workout = JSON.parse(workoutData);
                    if (workout.status === 'completed') {
                        workouts.push(workout);
                    }
                }
            }
            
            // Sort by end time (newest first) - same as API
            workouts.sort((a, b) => {
                const dateA = new Date(a.endTime || a.startTime);
                const dateB = new Date(b.endTime || b.startTime);
                return dateB - dateA;
            });
        }
        
        // Calculate current week and recommendations for progressive training
        const averageWorkoutsPerWeek = 3.5;
        const currentWeek = Math.floor(stats.totalWorkouts / averageWorkoutsPerWeek) + 1;
        
        const exportData = {
            userId,
            exportDate: new Date().toISOString(),
            progressiveTraining: {
                currentWeek: currentWeek,
                totalWorkouts: stats.totalWorkouts,
                phase: currentWeek <= 30 ? "1-5 lbs" : "6-10 lbs"
            },
            stats: {
                ...stats,
                averageWorkoutLength: stats.totalWorkouts > 0 ? Math.round(stats.totalTimeMinutes / stats.totalWorkouts) : 0,
                workoutsThisWeek: 0 // Could be calculated from recent workouts if needed
            },
            achievements: achievements,
            workouts: workouts,
            totalRecords: workouts.length,
            exportMetadata: {
                version: "2.0",
                type: "progressive-workout-data",
                compatibility: "workout-timer-app"
            }
        };
        
        // Calculate workouts this week if we have workout data
        if (workouts.length > 0) {
            const weekStart = getStartOfWeek();
            const weekEnd = weekStart + (7 * 24 * 60 * 60 * 1000);
            
            const thisWeekWorkouts = workouts.filter(workout => {
                const workoutTime = new Date(workout.endTime || workout.startTime).getTime();
                return workoutTime >= weekStart && workoutTime <= weekEnd;
            }).length;
            
            exportData.stats.workoutsThisWeek = thisWeekWorkouts;
        }
        
        if (format === 'json') {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="progressive-workout-data-${userId}-${Date.now()}.json"`);
            res.json(exportData);
        } else {
            res.status(400).json({ success: false, error: 'Unsupported format. Use format=json' });
        }
        
        logger.info(`[WORKOUT-APP] Successfully exported ${workouts.length} workouts for user ${userId}`);
        
    } catch (error) {
        logger.error(`[WORKOUT-APP] Error exporting data: ${error.message}`);
        res.status(500).json({ success: false, error: 'Failed to export data' });
    }
});

// Helper function for week calculation
function getStartOfWeek() {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    return startOfWeek.getTime();
}

logger.info("[WORKOUT-APP] Loaded data export endpoint");

// 404 handler
app.use((req, res) => {
    logger.warn(`[WORKOUT-APP] 404 - Route not found: ${req.method} ${req.path}`);
    res.status(404).json({ 
        success: false, 
        error: "Route not found",
        path: req.path,
        method: req.method
    });
});
logger.info("[WORKOUT-APP] Loaded 404 handler");

// Error handler
app.use((err, req, res, next) => {
    const errorCode = `WKT_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    logger.error(`[WORKOUT-APP ERROR] ${errorCode}: ${err.stack || err}`);
    
    res.status(500).json({
        success: false,
        error: "Internal server error",
        errorCode: errorCode,
        timestamp: new Date().toISOString()
    });
});
logger.info("[WORKOUT-APP] Loaded error handler");

// Graceful shutdown handling
process.on('SIGTERM', () => {
    logger.info('[WORKOUT-APP] SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('[WORKOUT-APP] SIGINT received, shutting down gracefully');
    process.exit(0);
});

// Start the server
app.listen(PORT, () => {
    logger.info(`[WORKOUT-APP] 🏋️ Workout Timer API listening on port ${PORT}`);
    logger.info(`[WORKOUT-APP] 🌐 Access the app at: http://localhost:${PORT}`);
    logger.info(`[WORKOUT-APP] 📊 Health check: http://localhost:${PORT}/health`);
    logger.info(`[WORKOUT-APP] 🏃‍♂️ Gym status: http://localhost:${PORT}/gym-status`);
    logger.info(`[WORKOUT-APP] 📋 Dashboard: http://localhost:${PORT}/dashboard`);
});

module.exports = app;