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

// User dashboard endpoint (optional - for viewing stats without the timer)
app.get("/dashboard", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});
logger.info("[WORKOUT-APP] Loaded dashboard route");

// Export workout data endpoint
app.get("/export/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const { format = 'json' } = req.query;
        
        logger.info(`[WORKOUT-APP] Exporting data for user: ${userId} in format: ${format}`);
        
        // Get all user data
        const [statsData, achievementsData] = await Promise.all([
            database.get(`user:${userId}:stats`),
            database.get(`user:${userId}:achievements`)
        ]);
        
        const stats = statsData ? JSON.parse(statsData) : {};
        const achievements = achievementsData ? JSON.parse(achievementsData) : [];
        
        // Get workout history
        const workoutIds = await database.zrevrange(`user:${userId}:workouts`, 0, -1);
        const workouts = [];
        
        for (const workoutId of workoutIds) {
            const workoutData = await database.get(`workout:${workoutId}`);
            if (workoutData) {
                workouts.push(JSON.parse(workoutData));
            }
        }
        
        const exportData = {
            userId,
            exportDate: new Date().toISOString(),
            stats,
            achievements,
            workouts,
            totalRecords: workouts.length
        };
        
        if (format === 'json') {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="workout-data-${userId}-${Date.now()}.json"`);
            res.json(exportData);
        } else {
            res.status(400).json({ success: false, error: 'Unsupported format. Use format=json' });
        }
        
    } catch (error) {
        logger.error(`[WORKOUT-APP] Error exporting data: ${error.message}`);
        res.status(500).json({ success: false, error: 'Failed to export data' });
    }
});
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
});

module.exports = app;