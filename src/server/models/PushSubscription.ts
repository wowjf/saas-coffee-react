import mongoose from 'mongoose';

const PushSubscriptionSchema = new mongoose.Schema(
  {
    endpoint: { type: String, required: true, unique: true, index: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    userId: { type: String, default: '', index: true },
    orderId: { type: String, default: '', index: true },
    role: { type: String, enum: ['customer', 'staff', 'manager'], default: 'customer', index: true },
    userAgent: { type: String, default: '' },
  },
  { timestamps: true },
);

export type PushSubscriptionDocument = mongoose.InferSchemaType<typeof PushSubscriptionSchema> & mongoose.Document;

const PushSubscriptionModel =
  (mongoose.models.PushSubscription as mongoose.Model<PushSubscriptionDocument>) ||
  mongoose.model<PushSubscriptionDocument>('PushSubscription', PushSubscriptionSchema);

export default PushSubscriptionModel;
