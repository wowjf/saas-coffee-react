import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
  {
    userId: { type: String, default: "", index: true },
    targetRole: { type: String, enum: ["customer", "staff", "manager", ""], default: "", index: true },
    event: {
      type: String,
      enum: ["order_preparing", "order_ready", "order_cancelled", "staff_new_order", ""],
      default: "",
      index: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ["info", "success", "warning", "error"], default: "info" },
    timestamp: { type: Date, default: Date.now, index: true },
    read: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// MP-2.12: Notification en çok okunan koleksiyon (5 sn polling). (userId, event)
// ve (targetRole, event) bileşik indexleri hedef+kategori okumalarını karşılar.
NotificationSchema.index({ userId: 1, event: 1 });
NotificationSchema.index({ targetRole: 1, event: 1 });

export type NotificationDocument = mongoose.InferSchemaType<typeof NotificationSchema> & mongoose.Document;

const NotificationModel =
  (mongoose.models.Notification as mongoose.Model<NotificationDocument>) ||
  mongoose.model<NotificationDocument>("Notification", NotificationSchema);

export default NotificationModel;
