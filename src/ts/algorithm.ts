export interface Media {
  _id: string;
  postID: string;
  videoUrl: string;
  tags: any[];
  __v: number;
}

export interface UserInfo {
  _id: string;
  username: string;
  handleName: string;
  profilePic: string;
}

export interface PostItem {
  _id: string;
  userID: string;
  type: string;
  caption?: string;
  isFlagged: boolean;
  nsfw: boolean;
  isEnable: boolean;
  viewCount: number;
  share: number;
  createdAt: string; // ISO date string
  updatedAt: string;
  isFollow: boolean; // đã follow creator chưa
  media: Media[];
  user: UserInfo;
  likeCount: number;
  commentCount: number;
  isLike: boolean; // đã like chưa
  isBookmarked: boolean;
}

// Kiểu pagination
export interface Pagination {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// Kết quả trả về
export interface PagedResult {
  items: PostItem[];
  pagination: Pagination;
}

/**
 * Chạy thuật toán phân trang + ưu tiên trên mảng posts.
 */
export function runPagedAggregation(
  posts: PostItem[],
  page: number = 1,
  limit: number = 20,
): PagedResult {
  // 1) Gán priority cho mỗi post:
  //    0 = chưa like && đã follow
  //    1 = chưa like && chưa follow
  //    2 = đã like
  const withPriority = posts.map((post) => {
    let priority: number;
    if (!post.isLike && post.isFollow) priority = 0;
    else if (!post.isLike && !post.isFollow) priority = 1;
    else priority = 2;
    return { post, priority };
  });

  // 2) Sort toàn bộ theo (priority ASC, createdAt DESC)
  withPriority.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    // parse date string thành timestamp để so sánh
    const ta = new Date(a.post.createdAt).getTime();
    const tb = new Date(b.post.createdAt).getTime();
    return tb - ta;
  });

  // 3) Lấy đúng page & limit
  const totalCount = withPriority.length;
  const totalPages = Math.ceil(totalCount / limit);
  const startIdx = (page - 1) * limit;
  const paged = withPriority
    .slice(startIdx, startIdx + limit)
    .map((wp) => wp.post);

  // 4) Trả về kết quả
  return {
    items: paged,
    pagination: {
      currentPage: page,
      totalPages,
      totalCount,
      limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}
