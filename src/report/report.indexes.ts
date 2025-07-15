// MongoDB indexes for Report collection
// Run these commands in MongoDB shell or use MongoDB Compass

/*
// Index for finding reports by reporter
db.reports.createIndex({ "reporterId": 1, "createdAt": -1 })

// Index for finding reports by target
db.reports.createIndex({ "targetType": 1, "targetId": 1 })

// Index for admin queries
db.reports.createIndex({ "status": 1, "priority": -1, "createdAt": -1 })

// Index for admin filtering
db.reports.createIndex({ "status": 1, "targetType": 1, "createdAt": -1 })

// Index for admin search
db.reports.createIndex({ "reason": "text", "description": "text" })

// Compound index for efficient queries
db.reports.createIndex({ 
  "status": 1, 
  "priority": -1, 
  "targetType": 1, 
  "createdAt": -1 
})
*/

export const REPORT_INDEXES = [
    { reporterId: 1, createdAt: -1 },
    { targetType: 1, targetId: 1 },
    { status: 1, priority: -1, createdAt: -1 },
    { status: 1, targetType: 1, createdAt: -1 },
    { reason: 'text', description: 'text' },
    { status: 1, priority: -1, targetType: 1, createdAt: -1 }
];