import { io } from "socket.io-client";
import authService from "./authService";

class WebSocketService {
  constructor() {
    this.socket = null;
    this.socketUrl =
      import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
    this.eventListeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.connectionState = "disconnected";
    this.pendingEvents = [];
    this.messageQueue = [];
    this.processingQueue = false;
    this.boundSocketEvents = new Set();
  }

  /**
   * Initialize socket connection
   */
  initialize(namespace = "/test") {
    if (this.socket?.connected) return;

    if (this.socket && !this.socket.connected) {
      this.socket.removeAllListeners();
      this.socket = null;
      this.boundSocketEvents.clear();
    }

    const token = authService.getToken();

    this.socket = io(`${this.socketUrl}${namespace}`, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      auth: token ? { token } : undefined,
      query: {
        client: "web",
        version: "1.0.0",
        timestamp: Date.now(),
      },
    });

    this.setupBaseHandlers();
    this.bindAllRegisteredEvents();
    this.connectionState = "connecting";
  }

  bindSocketEvent(event) {
    if (!this.socket || this.boundSocketEvents.has(event)) {
      return;
    }

    this.socket.on(event, (data) => {
      this.emit(event, data);
    });

    this.boundSocketEvents.add(event);
  }

  bindAllRegisteredEvents() {
    this.eventListeners.forEach((_, event) => {
      this.bindSocketEvent(event);
    });
  }

  /**
   * Setup base socket handlers
   */
  setupBaseHandlers() {
    this.socket.on("connect", () => {
      console.log("Socket connected:", this.socket.id);
      this.connectionState = "connected";
      this.reconnectAttempts = 0;
      this.emit("connection-change", {
        state: "connected",
        socketId: this.socket.id,
      });

      // Process queued messages
      this.processMessageQueue();
    });

    this.socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
      this.connectionState = "disconnected";
      this.emit("connection-change", { state: "disconnected", reason });

      // Queue messages for later
      if (reason === "transport close" || reason === "ping timeout") {
        this.emit("reconnecting", {
          message: "Connection lost. Attempting to reconnect...",
          attempt: this.reconnectAttempts + 1,
        });
      }
    });

    this.socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
      this.connectionState = "error";
      this.emit("connection-error", { error: error.message });
    });

    this.socket.on("reconnect", (attemptNumber) => {
      console.log("Socket reconnected after", attemptNumber, "attempts");
      this.connectionState = "connected";
      this.emit("reconnected", { attemptNumber });
    });

    this.socket.on("reconnect_attempt", (attemptNumber) => {
      this.reconnectAttempts = attemptNumber;
      this.emit("reconnect-attempt", { attempt: attemptNumber });
    });

    this.socket.on("reconnect_error", (error) => {
      console.error("Reconnect error:", error);
      this.emit("reconnect-error", { error: error.message });
    });

    this.socket.on("reconnect_failed", () => {
      console.error(
        "Reconnect failed after",
        this.maxReconnectAttempts,
        "attempts",
      );
      this.connectionState = "failed";
      this.emit("reconnect-failed", {
        message: "Unable to reconnect. Please refresh the page.",
      });
    });

    this.socket.on("pong", (latency) => {
      this.emit("pong", { latency });
    });
  }

  /**
   * Register event handler
   */
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event).add(callback);

    this.bindSocketEvent(event);
  }

  /**
   * Remove event handler
   */
  off(event, callback) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).delete(callback);
    }
  }

  /**
   * Emit event to local listeners
   */
  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  /**
   * Send event to server
   */
  send(event, data, options = {}) {
    const message = {
      event,
      data,
      timestamp: Date.now(),
      id: this.generateMessageId(),
    };

    if (!this.isConnected()) {
      if (options.queue === false) {
        console.warn("Socket not connected, message dropped:", event);
        return false;
      }
      this.queueMessage(message);
      return false;
    }

    this.socket.emit(event, data, (ack) => {
      if (options.ackCallback) {
        options.ackCallback(ack);
      }
    });

    return true;
  }

  /**
   * Queue message for later sending
   */
  queueMessage(message) {
    this.messageQueue.push(message);
    this.emit("message-queued", {
      id: message.id,
      event: message.event,
      queueLength: this.messageQueue.length,
    });
  }

  /**
   * Process queued messages
   */
  async processMessageQueue() {
    if (
      this.processingQueue ||
      this.messageQueue.length === 0 ||
      !this.isConnected()
    ) {
      return;
    }

    this.processingQueue = true;

    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();

      this.socket.emit(message.event, message.data, () => {
        this.emit("message-sent", {
          id: message.id,
          event: message.event,
        });
      });

      // Small delay between messages
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.processingQueue = false;
  }

  /**
   * Join a room
   */
  joinRoom(room, data = {}) {
    return this.send("join-room", { room, ...data });
  }

  /**
   * Leave a room
   */
  leaveRoom(room) {
    return this.send("leave-room", { room });
  }

  /**
   * Ping server to check latency
   */
  ping() {
    const start = Date.now();
    this.send(
      "ping",
      {},
      {
        ackCallback: () => {
          const latency = Date.now() - start;
          this.emit("pong", { latency });
        },
      },
    );
  }

  /**
   * Check if socket is connected
   */
  isConnected() {
    return this.socket?.connected || false;
  }

  /**
   * Get connection state
   */
  getConnectionState() {
    return {
      state: this.connectionState,
      connected: this.isConnected(),
      socketId: this.socket?.id,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      queuedMessages: this.messageQueue.length,
    };
  }

  /**
   * Generate unique message ID
   */
  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Disconnect socket
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connectionState = "disconnected";
    this.eventListeners.clear();
    this.messageQueue = [];
    this.pendingEvents = [];
    this.boundSocketEvents.clear();
  }

  /**
   * Reconnect socket
   */
  reconnect() {
    if (this.socket && !this.isConnected()) {
      this.socket.connect();
    }
  }
}

export default new WebSocketService();
