export const REPORT_REASONS = {
    SPAM: 'Spam hoặc quảng cáo',
    HARASSMENT: 'Quấy rối hoặc bắt nạt',
    HATE_SPEECH: 'Ngôn từ thù địch',
    VIOLENCE: 'Bạo lực hoặc nội dung có hại',
    NUDITY: 'Khỏa thân hoặc hoạt động tình dục',
    FALSE_INFO: 'Thông tin sai lệch',
    INTELLECTUAL_PROPERTY: 'Vi phạm bản quyền',
    SELF_HARM: 'Tự làm hại bản thân',
    OTHER: 'Khác'
} as const;

export const REPORT_PRIORITIES = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
} as const;

export const REPORT_STATUSES = {
    PENDING: 'pending',
    REVIEWED: 'reviewed',
    RESOLVED: 'resolved',
    DISMISSED: 'dismissed'
} as const;

export const ADMIN_ACTIONS = {
    DISABLE: 'disable',
    DELETE: 'delete',
    WARNING: 'warning',
    NO_ACTION: 'no_action'
} as const;