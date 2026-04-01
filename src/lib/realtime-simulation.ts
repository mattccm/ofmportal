// Real-time Simulation Utilities
// Polling-based real-time updates without WebSockets

import {
  ReadReceipt,
  ReadReceiptWithUser,
  TypingIndicator,
  ViewReceipt,
  READ_RECEIPT_CONSTANTS,
} from "@/types/read-receipts";

// In-memory stores for simulation (in production, these would be in a database/Redis)
const readReceiptStore = new Map<string, ReadReceiptWithUser[]>();
const typingIndicatorStore = new Map<string, TypingIndicator[]>();
const viewReceiptStore = new Map<string, ViewReceipt[]>();

// Subscribers for real-time updates
type Subscriber<T> = (data: T) => void;
const readReceiptSubscribers = new Map<string, Set<Subscriber<ReadReceiptWithUser[]>>>();
const typingSubscribers = new Map<string, Set<Subscriber<TypingIndicator[]>>>();
const viewSubscribers = new Map<string, Set<Subscriber<ViewReceipt[]>>>();

// Generate unique IDs
let idCounter = 0;
export function generateId(prefix: string = "id"): string {
  return `${prefix}_${Date.now()}_${++idCounter}`;
}

// ============================================================================
// Read Receipt Functions
// ============================================================================

export function getReadReceiptKey(
  messageId?: string,
  requestId?: string,
  commentId?: string
): string {
  if (messageId) return `message:${messageId}`;
  if (requestId) return `request:${requestId}`;
  if (commentId) return `comment:${commentId}`;
  return "unknown";
}

export function addReadReceipt(receipt: ReadReceiptWithUser): void {
  const key = getReadReceiptKey(receipt.messageId, receipt.requestId, receipt.commentId);
  const existing = readReceiptStore.get(key) || [];

  // Check if user already has a receipt for this item
  const existingIndex = existing.findIndex((r) => r.userId === receipt.userId);
  if (existingIndex >= 0) {
    existing[existingIndex] = receipt;
  } else {
    existing.push(receipt);
  }

  readReceiptStore.set(key, existing);

  // Notify subscribers
  const subscribers = readReceiptSubscribers.get(key);
  if (subscribers) {
    subscribers.forEach((callback) => callback(existing));
  }
}

export function getReadReceipts(
  messageId?: string,
  requestId?: string,
  commentId?: string
): ReadReceiptWithUser[] {
  const key = getReadReceiptKey(messageId, requestId, commentId);
  return readReceiptStore.get(key) || [];
}

export function subscribeToReadReceipts(
  key: string,
  callback: Subscriber<ReadReceiptWithUser[]>
): () => void {
  if (!readReceiptSubscribers.has(key)) {
    readReceiptSubscribers.set(key, new Set());
  }
  readReceiptSubscribers.get(key)!.add(callback);

  // Return unsubscribe function
  return () => {
    readReceiptSubscribers.get(key)?.delete(callback);
  };
}

// ============================================================================
// Typing Indicator Functions
// ============================================================================

export function getTypingKey(conversationId?: string, requestId?: string): string {
  if (conversationId) return `conversation:${conversationId}`;
  if (requestId) return `request:${requestId}`;
  return "unknown";
}

export function setTypingStatus(indicator: TypingIndicator): void {
  const key = getTypingKey(indicator.conversationId, indicator.requestId);
  const existing = typingIndicatorStore.get(key) || [];

  if (indicator.isTyping) {
    // Add or update typing indicator
    const existingIndex = existing.findIndex((t) => t.userId === indicator.userId);
    if (existingIndex >= 0) {
      existing[existingIndex] = indicator;
    } else {
      existing.push(indicator);
    }
  } else {
    // Remove typing indicator
    const filtered = existing.filter((t) => t.userId !== indicator.userId);
    typingIndicatorStore.set(key, filtered);

    // Notify subscribers
    const subscribers = typingSubscribers.get(key);
    if (subscribers) {
      subscribers.forEach((callback) => callback(filtered));
    }
    return;
  }

  typingIndicatorStore.set(key, existing);

  // Notify subscribers
  const subscribers = typingSubscribers.get(key);
  if (subscribers) {
    subscribers.forEach((callback) => callback(existing));
  }
}

export function getTypingIndicators(
  conversationId?: string,
  requestId?: string
): TypingIndicator[] {
  const key = getTypingKey(conversationId, requestId);
  const indicators = typingIndicatorStore.get(key) || [];

  // Filter out stale typing indicators
  const now = Date.now();
  const active = indicators.filter(
    (t) => now - new Date(t.startedAt).getTime() < READ_RECEIPT_CONSTANTS.TYPING_TIMEOUT_MS
  );

  // Update store if any were filtered
  if (active.length !== indicators.length) {
    typingIndicatorStore.set(key, active);
  }

  return active;
}

export function subscribeToTypingIndicators(
  key: string,
  callback: Subscriber<TypingIndicator[]>
): () => void {
  if (!typingSubscribers.has(key)) {
    typingSubscribers.set(key, new Set());
  }
  typingSubscribers.get(key)!.add(callback);

  return () => {
    typingSubscribers.get(key)?.delete(callback);
  };
}

export function clearTypingIndicator(userId: string, conversationId?: string, requestId?: string): void {
  const key = getTypingKey(conversationId, requestId);
  const existing = typingIndicatorStore.get(key) || [];
  const filtered = existing.filter((t) => t.userId !== userId);
  typingIndicatorStore.set(key, filtered);

  // Notify subscribers
  const subscribers = typingSubscribers.get(key);
  if (subscribers) {
    subscribers.forEach((callback) => callback(filtered));
  }
}

// ============================================================================
// View Receipt Functions
// ============================================================================

export function getViewKey(resourceType: string, resourceId: string): string {
  return `${resourceType}:${resourceId}`;
}

export function addViewReceipt(view: ViewReceipt): void {
  const key = getViewKey(view.resourceType, view.resourceId);
  const existing = viewReceiptStore.get(key) || [];

  // Check if user already viewed this resource
  const existingIndex = existing.findIndex((v) => v.userId === view.userId);
  if (existingIndex >= 0) {
    // Update duration if this is a continued view
    const existingView = existing[existingIndex];
    if (view.duration) {
      existing[existingIndex] = {
        ...existingView,
        duration: (existingView.duration || 0) + view.duration,
        viewedAt: view.viewedAt,
      };
    } else {
      existing[existingIndex] = view;
    }
  } else {
    existing.push(view);
  }

  viewReceiptStore.set(key, existing);

  // Notify subscribers
  const subscribers = viewSubscribers.get(key);
  if (subscribers) {
    subscribers.forEach((callback) => callback(existing));
  }
}

export function getViewReceipts(resourceType: string, resourceId: string): ViewReceipt[] {
  const key = getViewKey(resourceType, resourceId);
  return viewReceiptStore.get(key) || [];
}

export function subscribeToViewReceipts(
  key: string,
  callback: Subscriber<ViewReceipt[]>
): () => void {
  if (!viewSubscribers.has(key)) {
    viewSubscribers.set(key, new Set());
  }
  viewSubscribers.get(key)!.add(callback);

  return () => {
    viewSubscribers.get(key)?.delete(callback);
  };
}

// ============================================================================
// Polling Manager
// ============================================================================

interface PollingConfig {
  interval: number;
  key: string;
  fetchFn: () => Promise<unknown>;
  onData: (data: unknown) => void;
}

class PollingManager {
  private polls = new Map<string, NodeJS.Timeout>();
  private abortControllers = new Map<string, AbortController>();

  start(config: PollingConfig): void {
    // Stop existing poll for this key
    this.stop(config.key);

    const controller = new AbortController();
    this.abortControllers.set(config.key, controller);

    const poll = async () => {
      if (controller.signal.aborted) return;

      try {
        const data = await config.fetchFn();
        if (!controller.signal.aborted) {
          config.onData(data);
        }
      } catch (error) {
        // Silently handle errors during polling
        if (process.env.NODE_ENV === "development") {
          console.error(`Polling error for ${config.key}:`, error);
        }
      }
    };

    // Initial fetch
    poll();

    // Start interval
    const intervalId = setInterval(poll, config.interval);
    this.polls.set(config.key, intervalId);
  }

  stop(key: string): void {
    const intervalId = this.polls.get(key);
    if (intervalId) {
      clearInterval(intervalId);
      this.polls.delete(key);
    }

    const controller = this.abortControllers.get(key);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(key);
    }
  }

  stopAll(): void {
    this.polls.forEach((_, key) => this.stop(key));
  }

  isPolling(key: string): boolean {
    return this.polls.has(key);
  }
}

export const pollingManager = new PollingManager();

// ============================================================================
// Optimistic UI Helpers
// ============================================================================

export interface OptimisticUpdate<T> {
  id: string;
  data: T;
  timestamp: number;
  confirmed: boolean;
}

class OptimisticStore<T> {
  private updates = new Map<string, OptimisticUpdate<T>>();
  private confirmTimeout = 5000; // 5 seconds to confirm

  add(id: string, data: T): void {
    this.updates.set(id, {
      id,
      data,
      timestamp: Date.now(),
      confirmed: false,
    });

    // Auto-remove unconfirmed updates after timeout
    setTimeout(() => {
      const update = this.updates.get(id);
      if (update && !update.confirmed) {
        this.updates.delete(id);
      }
    }, this.confirmTimeout);
  }

  confirm(id: string): void {
    const update = this.updates.get(id);
    if (update) {
      update.confirmed = true;
    }
  }

  remove(id: string): void {
    this.updates.delete(id);
  }

  get(id: string): OptimisticUpdate<T> | undefined {
    return this.updates.get(id);
  }

  getAll(): OptimisticUpdate<T>[] {
    return Array.from(this.updates.values());
  }

  getPending(): OptimisticUpdate<T>[] {
    return this.getAll().filter((u) => !u.confirmed);
  }
}

export const optimisticReadReceipts = new OptimisticStore<ReadReceipt>();
export const optimisticTypingIndicators = new OptimisticStore<TypingIndicator>();
export const optimisticViewReceipts = new OptimisticStore<ViewReceipt>();

// ============================================================================
// Batch Processing
// ============================================================================

interface BatchConfig<T> {
  maxSize: number;
  maxWait: number;
  processFn: (items: T[]) => Promise<void>;
}

class BatchProcessor<T> {
  private queue: T[] = [];
  private timeoutId: NodeJS.Timeout | null = null;
  private config: BatchConfig<T>;

  constructor(config: BatchConfig<T>) {
    this.config = config;
  }

  add(item: T): void {
    this.queue.push(item);

    if (this.queue.length >= this.config.maxSize) {
      this.flush();
    } else if (!this.timeoutId) {
      this.timeoutId = setTimeout(() => this.flush(), this.config.maxWait);
    }
  }

  async flush(): Promise<void> {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    if (this.queue.length === 0) return;

    const items = [...this.queue];
    this.queue = [];

    try {
      await this.config.processFn(items);
    } catch (error) {
      console.error("Batch processing error:", error);
      // Re-queue failed items
      this.queue = [...items, ...this.queue];
    }
  }

  getQueueSize(): number {
    return this.queue.length;
  }
}

// Create batch processors for different operations
export const readReceiptBatch = new BatchProcessor<ReadReceipt>({
  maxSize: 10,
  maxWait: 1000,
  processFn: async (receipts) => {
    // In production, this would send to API
    receipts.forEach((receipt) => {
      addReadReceipt({
        ...receipt,
        userName: "User",
      });
    });
  },
});

export const viewReceiptBatch = new BatchProcessor<ViewReceipt>({
  maxSize: 5,
  maxWait: 2000,
  processFn: async (views) => {
    // In production, this would send to API
    views.forEach((view) => addViewReceipt(view));
  },
});

// ============================================================================
// Utility Functions
// ============================================================================

export function formatTypingText(typingUsers: TypingIndicator[]): string {
  if (typingUsers.length === 0) return "";
  if (typingUsers.length === 1) return `${typingUsers[0].userName} is typing...`;
  if (typingUsers.length === 2) {
    return `${typingUsers[0].userName} and ${typingUsers[1].userName} are typing...`;
  }
  return `${typingUsers[0].userName} and ${typingUsers.length - 1} others are typing...`;
}

export function formatReadByText(readers: ReadReceiptWithUser[], totalRecipients?: number): string {
  if (readers.length === 0) return "Not read yet";
  if (readers.length === 1) return `Read by ${readers[0].userName}`;
  if (totalRecipients && readers.length === totalRecipients) {
    return `Read by all ${totalRecipients} recipients`;
  }
  if (readers.length === 2) {
    return `Read by ${readers[0].userName} and ${readers[1].userName}`;
  }
  return `Read by ${readers[0].userName} and ${readers.length - 1} others`;
}

export function formatViewDuration(durationMs: number): string {
  if (durationMs < 1000) return "< 1 second";

  const seconds = Math.floor(durationMs / 1000);
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) return `${hours} hour${hours === 1 ? "" : "s"}`;
  return `${hours}h ${remainingMinutes}m`;
}

export function getDeviceType(): "desktop" | "mobile" | "tablet" {
  if (typeof window === "undefined") return "desktop";

  const ua = navigator.userAgent.toLowerCase();

  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return "tablet";
  }

  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) {
    return "mobile";
  }

  return "desktop";
}

// ============================================================================
// Debounce Utility for Typing Indicators
// ============================================================================

export function createDebouncedTyping(
  sendTyping: (isTyping: boolean) => void,
  timeout: number = READ_RECEIPT_CONSTANTS.TYPING_TIMEOUT_MS
) {
  let typingTimeout: NodeJS.Timeout | null = null;
  let isCurrentlyTyping = false;

  return {
    startTyping: () => {
      if (!isCurrentlyTyping) {
        isCurrentlyTyping = true;
        sendTyping(true);
      }

      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }

      typingTimeout = setTimeout(() => {
        isCurrentlyTyping = false;
        sendTyping(false);
        typingTimeout = null;
      }, timeout);
    },

    stopTyping: () => {
      if (typingTimeout) {
        clearTimeout(typingTimeout);
        typingTimeout = null;
      }

      if (isCurrentlyTyping) {
        isCurrentlyTyping = false;
        sendTyping(false);
      }
    },

    isTyping: () => isCurrentlyTyping,
  };
}

// ============================================================================
// Mock Data for Development
// ============================================================================

export const mockUsers = [
  { id: "user1", name: "Alice Johnson", avatar: "/avatars/alice.jpg", email: "alice@example.com" },
  { id: "user2", name: "Bob Smith", avatar: "/avatars/bob.jpg", email: "bob@example.com" },
  { id: "user3", name: "Carol Williams", avatar: "/avatars/carol.jpg", email: "carol@example.com" },
  { id: "user4", name: "David Brown", avatar: "/avatars/david.jpg", email: "david@example.com" },
];

export function createMockReadReceipt(
  messageId: string,
  userId: string = mockUsers[0].id
): ReadReceiptWithUser {
  const user = mockUsers.find((u) => u.id === userId) || mockUsers[0];
  return {
    id: generateId("receipt"),
    messageId,
    userId: user.id,
    userName: user.name,
    userAvatar: user.avatar,
    userEmail: user.email,
    readAt: new Date(),
    deviceType: getDeviceType(),
  };
}

export function createMockTypingIndicator(
  conversationId: string,
  userId: string = mockUsers[0].id
): TypingIndicator {
  const user = mockUsers.find((u) => u.id === userId) || mockUsers[0];
  return {
    conversationId,
    userId: user.id,
    userName: user.name,
    userAvatar: user.avatar,
    isTyping: true,
    startedAt: new Date(),
  };
}

export function createMockViewReceipt(
  resourceType: ViewReceipt["resourceType"],
  resourceId: string,
  userId: string = mockUsers[0].id
): ViewReceipt {
  const user = mockUsers.find((u) => u.id === userId) || mockUsers[0];
  return {
    resourceType,
    resourceId,
    userId: user.id,
    userName: user.name,
    viewedAt: new Date(),
    duration: Math.floor(Math.random() * 120000) + 1000, // 1 second to 2 minutes
  };
}
