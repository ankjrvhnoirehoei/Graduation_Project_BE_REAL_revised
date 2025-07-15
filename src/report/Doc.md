# Report Module Documentation

## Overview
Report Module cung cấp API để người dùng báo cáo bài viết vi phạm và admin quản lý các báo cáo. Module này chỉ xử lý báo cáo cho Posts.

## Cấu trúc Module

```
src/report/
├── dto/
│   ├── create-report.dto.ts
│   ├── resolve-report.dto.ts
│   ├── report-query.dto.ts
│   ├── report-response.dto.ts
│   ├── bulk-resolve-reports.dto.ts
│   ├── report-analytics.dto.ts
│   └── index.ts
├── report.schema.ts
├── report.repository.ts
├── report.service.ts
├── report.controller.ts
├── admin-report.controller.ts
├── report.module.ts
├── report.constants.ts
├── report.indexes.ts
└── index.ts
```

## Tính năng

### Cho User thường:
- ✅ Báo cáo bài viết vi phạm với 8 lý do cụ thể
- ✅ Xem lịch sử báo cáo của mình với filter/pagination
- ✅ Xóa báo cáo pending
- ✅ Validation tránh báo cáo trùng lặp

### Cho Admin:
- ✅ Dashboard thống kê reports toàn diện
- ✅ Danh sách reports với filter nâng cao
- ✅ Chi tiết report với thông tin đầy đủ
- ✅ Xử lý report đơn lẻ (disable/delete/dismiss)
- ✅ Xử lý hàng loạt reports (bulk actions)
- ✅ Analytics chi tiết với trends
- ✅ Lọc và tìm kiếm reports

---

# API Documentation

## Authentication
Tất cả endpoints đều yêu cầu JWT token trong header:
```
Authorization: Bearer <jwt_token>
```

## User Endpoints

### 1. Tạo báo cáo mới
```http
POST /reports
Content-Type: application/json

{
  "targetId": "64f8a1b2c3d4e5f6a7b8c9d0",
  "reason": "Bạo lực, thù ghét hoặc bóc lột",
  "description": "Bài viết chứa nội dung bạo lực"
}
```

**Các lý do báo cáo có sẵn:**
- `Bắt nạt hoặc liên hệ theo cách không mong muốn`
- `Tự tử, tự gây thương tích hoặc chứng rối loạn ăn uống`
- `Bạo lực, thù ghét hoặc bóc lột`
- `Bán hoặc quảng cáo mặt hàng bị hạn chế`
- `Ảnh khỏa thân hoặc hoạt động tình dục`
- `Lừa đảo, gian lận hoặc spam`
- `Thông tin sai sự thật`
- `Quyền sở hữu trí tuệ`

**Độ ưu tiên tự động:**
- Dưới 3 báo cáo: `LOW`
- 3-4 báo cáo: `MEDIUM`
- 5-7 báo cáo: `HIGH`
- 8+ báo cáo: `CRITICAL`

**Response:**
```json
{
  "success": true,
  "message": "Báo cáo đã được gửi thành công",
  "data": {
    "_id": "64f8a1b2c3d4e5f6a7b8c9d1",
    "reporterId": "64f8a1b2c3d4e5f6a7b8c9d2",
    "targetId": "64f8a1b2c3d4e5f6a7b8c9d0",
    "reason": "Bạo lực, thù ghét hoặc bóc lột",
    "description": "Bài viết chứa nội dung bạo lực",
    "status": "pending",
    "priority": "low",
    "createdAt": "2023-09-06T10:30:00.000Z"
  }
}
```

### 2. Lấy báo cáo của tôi
```http
GET /reports/my?page=1&limit=20&status=pending&targetType=post
```

**Query Parameters:**
- `page` (optional): Số trang (default: 1)
- `limit` (optional): Số lượng mỗi trang (default: 20)
- `status` (optional): Trạng thái báo cáo (pending, reviewed, resolved, dismissed)
- `targetType` (optional): Loại đối tượng (chỉ post)

**Response:**
```json
{
  "success": true,
  "data": {
    "reports": [...],
    "total": 50,
    "page": 1,
    "limit": 20
  }
}
```

### 3. Xóa báo cáo của tôi
```http
DELETE /reports/:id
```

**Response:**
```json
{
  "success": true,
  "message": "Báo cáo đã được xóa"
}
```

## Admin Endpoints

### 1. Lấy danh sách tất cả báo cáo
```http
GET /admin/reports?page=1&limit=20&status=pending&priority=high&search=spam
```

**Query Parameters:**
- `page` (optional): Số trang
- `limit` (optional): Số lượng mỗi trang
- `status` (optional): Trạng thái
- `targetType` (optional): Loại đối tượng
- `priority` (optional): Độ ưu tiên
- `search` (optional): Tìm kiếm trong reason và description

### 2. Thống kê báo cáo
```http
GET /admin/reports/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalReports": 1250,
    "pendingReports": 45,
    "resolvedReports": 1100,
    "dismissedReports": 105,
    "reportsByType": {
      "post": 1250
    },
    "reportsByPriority": {
      "low": 300,
      "medium": 600,
      "high": 250,
      "critical": 100
    }
  }
}
```

### 3. Analytics chi tiết
```http
GET /admin/reports/analytics
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalReports": 1250,
    "reportsThisWeek": 25,
    "reportsThisMonth": 120,
    "averageResolutionTime": 4.5,
    "statusBreakdown": {...},
    "priorityBreakdown": {...},
    "targetTypeBreakdown": {...},
    "topReasons": [
      {
        "reason": "Spam hoặc quảng cáo",
        "count": 150
      }
    ]
  }
}
```

### 4. Chi tiết báo cáo
```http
GET /admin/reports/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "64f8a1b2c3d4e5f6a7b8c9d1",
    "reporterId": "64f8a1b2c3d4e5f6a7b8c9d2",
    "targetType": "post",
    "targetId": "64f8a1b2c3d4e5f6a7b8c9d0",
    "reason": "Nội dung không phù hợp",
    "description": "Bài viết chứa nội dung bạo lực",
    "status": "pending",
    "priority": "high",
    "createdAt": "2023-09-06T10:30:00.000Z",
    "reporter": {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d2",
      "username": "user123",
      "handleName": "@user123",
      "profilePic": "https://example.com/avatar.jpg"
    },
    "target": {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
      "caption": "Nội dung bài viết...",
      "type": "post",
      "isEnable": true,
      "isFlagged": false
    }
  }
}
```

### 5. Xử lý báo cáo
```http
PATCH /admin/reports/:id/resolve
Content-Type: application/json

{
  "status": "resolved",
  "adminAction": "disable",
  "adminNote": "Đã xử lý vi phạm theo quy định"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Báo cáo đã được xử lý",
  "data": {
    // Updated report data
  }
}
```

### 6. Xử lý hàng loạt báo cáo
```http
PATCH /admin/reports/bulk-resolve
Content-Type: application/json

{
  "reportIds": [
    "64f8a1b2c3d4e5f6a7b8c9d1",
    "64f8a1b2c3d4e5f6a7b8c9d2"
  ],
  "status": "dismissed",
  "adminAction": "no_action",
  "adminNote": "Không vi phạm quy định"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Đã xử lý 2 báo cáo thành công, 0 báo cáo thất bại",
  "data": {
    "success": 2,
    "failed": 0,
    "errors": []
  }
}
```

### 7. Báo cáo đã xử lý bởi admin
```http
GET /admin/reports/my-handled
```

**Response:**
```json
{
  "success": true,
  "data": {
    "reports": [...],
    "stats": {
      "totalHandled": 150,
      "resolved": 120,
      "dismissed": 30,
      "averageResolutionTime": 3.2
    }
  }
}
```

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "targetType",
      "message": "targetType must be one of: post, story, user, comment"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Unauthorized access"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Access denied: Admins only"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Report not found"
}
```

## Data Models

### Report Schema
```typescript
{
  _id: ObjectId,
  reporterId: ObjectId,
  targetType: 'post' | 'story' | 'user' | 'comment',
  targetId: ObjectId,
  reason: string,
  description?: string,
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed',
  priority: 'low' | 'medium' | 'high' | 'critical',
  adminId?: ObjectId,
  adminAction?: 'disable' | 'delete' | 'warning' | 'no_action',
  adminNote?: string,
  createdAt: Date,
  resolvedAt?: Date
}
```

### Enums
```typescript
enum ReportTargetType {
  POST = 'post',
  STORY = 'story',
  USER = 'user',
  COMMENT = 'comment'
}

enum ReportStatus {
  PENDING = 'pending',
  REVIEWED = 'reviewed',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed'
}

enum ReportPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

enum AdminAction {
  DISABLE = 'disable',
  DELETE = 'delete',
  WARNING = 'warning',
  NO_ACTION = 'no_action'
}
```

---

# Usage Examples

## Cách sử dụng

### Tạo báo cáo mới
```typescript
POST /reports
{
  "targetType": "post", // post | story | user | comment
  "targetId": "64f8a1b2c3d4e5f6a7b8c9d0",
  "reason": "Nội dung không phù hợp",
  "description": "Bài viết chứa nội dung bạo lực",
  "priority": "high" // low | medium | high | critical
}
```

### Xử lý báo cáo (Admin)
```typescript
PATCH /admin/reports/:id/resolve
{
  "status": "resolved", // pending | reviewed | resolved | dismissed
  "adminAction": "disable", // disable | delete | warning | no_action
  "adminNote": "Đã xử lý vi phạm"
}
```

### Xử lý hàng loạt (Admin)
```typescript
PATCH /admin/reports/bulk-resolve
{
  "reportIds": ["id1", "id2", "id3"],
  "status": "dismissed",
  "adminAction": "no_action",
  "adminNote": "Không vi phạm quy định"
}
```

## Schema

### Report Schema
- `reporterId`: ID người báo cáo
- `targetType`: Loại đối tượng báo cáo (post/story/user/comment)
- `targetId`: ID đối tượng bị báo cáo
- `reason`: Lý do báo cáo
- `description`: Mô tả chi tiết (optional)
- `status`: Trạng thái (pending/reviewed/resolved/dismissed)
- `priority`: Độ ưu tiên (low/medium/high/critical)
- `adminId`: ID admin xử lý (optional)
- `adminAction`: Hành động admin thực hiện (optional)
- `adminNote`: Ghi chú của admin (optional)
- `createdAt`: Thời gian tạo
- `resolvedAt`: Thời gian xử lý (optional)

## Database Performance

### Indexes được tối ưu:
- `{ reporterId: 1, createdAt: -1 }` - Tìm reports của user
- `{ targetType: 1, targetId: 1 }` - Tìm reports theo target
- `{ status: 1, priority: -1, createdAt: -1 }` - Admin queries
- `{ reason: "text", description: "text" }` - Text search

## Integration

Module này đã được tích hợp với:
- ✅ PostModule: Để disable/flag posts
- ✅ UserModule: Để disable users  
- ✅ StoryModule: Để archive stories
- ✅ CommentModule: Để delete comments
- ✅ AdminModule: Để kiểm tra quyền admin

## Security & Validation

- ✅ JWT Authentication required cho tất cả endpoints
- ✅ Admin role validation cho admin endpoints
- ✅ Input validation với class-validator
- ✅ Report ownership validation
- ✅ Duplicate report prevention

---

# Changelog

## [1.0.0] - 2024-01-15

### Added
- ✅ Initial Report Module implementation
- ✅ Report Schema with full validation
- ✅ User endpoints for creating and managing reports
- ✅ Admin endpoints for report management
- ✅ Report statistics and analytics
- ✅ Bulk operations for admin
- ✅ Integration with Post, User, Story, Comment modules
- ✅ Report notification system (foundation)
- ✅ Audit middleware for logging admin actions
- ✅ Ownership guards and validation decorators
- ✅ Comprehensive API documentation
- ✅ Database indexes for performance optimization

### Features
- **User Features:**
  - Create reports for posts, stories, users, comments
  - View personal report history with filtering
  - Delete pending reports
  - Duplicate report prevention

- **Admin Features:**
  - View all reports with advanced filtering
  - Detailed report analytics and statistics
  - Individual and bulk report resolution
  - Admin performance tracking
  - Audit logging for all admin actions

- **System Features:**
  - Automatic target validation
  - Flexible admin actions (disable, delete, warning, no action)
  - Comprehensive error handling
  - Performance optimized with database indexes
  - Extensible notification system

### Technical Details
- Built with NestJS framework
- MongoDB with Mongoose ODM
- JWT authentication integration
- Class-validator for input validation
- Abstract repository pattern
- Comprehensive TypeScript typing

### Database Schema
- Reports collection with proper indexing
- Relationships with Users, Posts, Stories, Comments
- Optimized queries for admin dashboard
- Audit trail for all report actions

### API Endpoints
- `POST /reports` - Create new report
- `GET /reports/my` - Get user's reports
- `DELETE /reports/:id` - Delete user's report
- `GET /admin/reports` - Get all reports (admin)
- `GET /admin/reports/stats` - Report statistics (admin)
- `GET /admin/reports/analytics` - Detailed analytics (admin)
- `GET /admin/reports/:id` - Get report details (admin)
- `PATCH /admin/reports/:id/resolve` - Resolve report (admin)
- `PATCH /admin/reports/bulk-resolve` - Bulk resolve (admin)
- `GET /admin/reports/my-handled` - Admin's handled reports

### Security
- JWT authentication required for all endpoints
- Admin role validation for admin endpoints
- Input sanitization and validation
- Report ownership validation for user operations
- Audit logging for sensitive operations

### Performance
- Database indexes for efficient queries
- Pagination support for large datasets
- Optimized aggregation pipelines
- Lean queries for better performance

### Future Enhancements
- [ ] Real-time notifications via WebSocket
- [ ] Email notifications for critical reports
- [ ] Advanced ML-based content analysis
- [ ] Report templates and categories
- [ ] Automated moderation rules
- [ ] Report escalation system
- [ ] Integration with external moderation services
- [ ] Mobile push notifications
- [ ] Report appeal system
- [ ] Advanced analytics dashboard

## Sẵn sàng mở rộng

- Notification system (WebSocket, Email, Push)
- ML-based content analysis
- Automated moderation rules
- Report appeal system
- Advanced analytics dashboard