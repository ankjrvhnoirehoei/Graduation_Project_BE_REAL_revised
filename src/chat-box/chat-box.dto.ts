import { ChatBox } from "./chat-box.schema";

export interface ChatBoxPagination {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface ChatBoxHistoryResponse {
  data: ChatBox[];
  pagination: ChatBoxPagination;
}