export type DealRoomStatus = "active" | "pending" | "archived" | "closed";

export type DealRoomQuestionCategory =
  | "financial"
  | "legal"
  | "traction"
  | "market"
  | "product"
  | "team"
  | "compliance"
  | "operations"
  | "other";

export type DealRoomQuestionStatus = "open" | "resolved" | "clarification_requested";

export type DealRoomDocumentRequestType =
  | "financials"
  | "cap_table"
  | "legal_docs"
  | "customer_metrics"
  | "custom";

export type DealRoomDocumentRequestStatus =
  | "open"
  | "fulfilled"
  | "clarification_requested"
  | "cancelled";

export type DealRoomActivityType =
  | "room_created"
  | "room_viewed"
  | "room_status_changed"
  | "question_created"
  | "founder_responded"
  | "question_resolved"
  | "doc_requested"
  | "doc_fulfilled"
  | "follow_up_requested";

