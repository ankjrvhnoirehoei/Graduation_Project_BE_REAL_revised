import { ChatBox } from "./chat-box.schema";

export interface ChatBoxPaginationResult {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  data: ChatBox[];
}