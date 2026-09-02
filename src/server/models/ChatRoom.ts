import mongoose from "mongoose";

const ChatMessageSchema = new mongoose.Schema(
  {
    senderId: { type: String, required: true },
    senderName: { type: String, required: true },
    senderRole: { type: String, enum: ["customer", "staff", "manager"], required: true },
    message: { type: String, required: true },
    timestamp: { type: String, required: true },
    attachments: [{ type: String }],
  },
  { _id: false },
);

const ChatRoomSchema = new mongoose.Schema(
  {
    customerId: { type: String, required: true, index: true },
    customerName: { type: String, required: true },
    status: { type: String, enum: ["active", "waiting", "resolved"], default: "waiting" },
    assignedTo: { type: String, default: "" },
    assignedToName: { type: String, default: "" },
    messages: [ChatMessageSchema],
    lastMessageAt: { type: String, required: true },
    closedAt: { type: String, default: "" },
  },
  { timestamps: true },
);

ChatRoomSchema.index({ customerId: 1, status: 1 });
ChatRoomSchema.index({ assignedTo: 1, status: 1 });

export type ChatRoomDocument = mongoose.InferSchemaType<typeof ChatRoomSchema> & mongoose.Document;

const ChatRoomModel =
  (mongoose.models.ChatRoom as mongoose.Model<ChatRoomDocument>) ||
  mongoose.model<ChatRoomDocument>("ChatRoom", ChatRoomSchema);

export default ChatRoomModel;
