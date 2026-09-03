import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const AddressSchema = new mongoose.Schema(
  {
    id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    title: { type: String, required: true },
    details: { type: String, required: true },
  },
  { _id: false },
);

const PaymentMethodSchema = new mongoose.Schema(
  {
    id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    type: { type: String, default: "card" },
    last4: { type: String, default: "" },
    brand: { type: String, default: "" },
  },
  { _id: false },
);

const UserSettingsSchema = new mongoose.Schema(
  {
    language: { type: String, enum: ["tr", "en", "de", "fr", "es", "it", "ru"], default: "tr" },
    theme: { type: String, enum: ["light", "dark"], default: "light" },
    currency: { type: String, enum: ["TRY", "USD", "EUR", "GBP"], default: "TRY" },
  },
  { _id: false },
);

const ActivePointRewardSchema = new mongoose.Schema(
  {
    redemptionId: { type: String, required: true },
    campaignId: { type: String, required: true },
    campaignTitle: { type: String, required: true },
    campaignType: {
      type: String,
      enum: ["points_free_product", "points_discount_product"],
      required: true,
    },
    targetCategory: { type: String, default: "" },
    targetProductId: { type: String, default: "" },
    targetProductName: { type: String, default: "" },
    pointsCost: { type: Number, default: 0 },
    discountPercent: { type: Number, default: 0 },
    usageLimit: { type: Number, default: 1 },
    remainingUses: { type: Number, default: 0 },
    redeemedAt: { type: String, required: true },
    expiresAt: { type: String, required: true },
    autoOrderId: { type: String, default: "" },
  },
  { _id: false },
);

const SelectedCampaignSchema = new mongoose.Schema(
  {
    campaignId: { type: String, required: true },
    campaignTitle: { type: String, required: true },
    campaignType: { type: String, required: true },
    category: { type: String, required: true },
    selectedAt: { type: String, required: true },
    expiresAt: { type: String, required: true },
    targetCategory: { type: String, default: "" },
    targetProductId: { type: String, default: "" },
  },
  { _id: false },
);

const UserSocialLinksSchema = new mongoose.Schema(
  {
    instagram: { type: String, default: "" },
    twitter: { type: String, default: "" },
    linkedin: { type: String, default: "" },
    github: { type: String, default: "" },
    website: { type: String, default: "" },
    tiktok: { type: String, default: "" },
    youtube: { type: String, default: "" },
  },
  { _id: false },
);

const UserPrivacySchema = new mongoose.Schema(
  {
    isProfilePrivate: { type: Boolean, default: false },
    showKp: { type: Boolean, default: true },
    showSocials: { type: Boolean, default: true },
    showAge: { type: Boolean, default: true },
    showGender: { type: Boolean, default: true },
    showJoinDate: { type: Boolean, default: true },
  },
  { _id: false },
);

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    surname: { type: String, required: true },
    username: { type: String, sparse: true, unique: true, trim: true, lowercase: true, index: true, default: undefined },
    bio: { type: String, default: "" },
    gender: { type: String, enum: ["female", "male"], default: undefined },
    email: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },
    // MP-2.14: telefon formati — route katmani rakamlari ayiklayip kaydeder;
    // serif yalnizca normalize edilmis TR mobil numaralarini kabul eder.
    phone: {
      type: String,
      default: "",
      validate: {
        validator: (v: string) =>
          v === "" ||
          (/^\d+$/.test(v) &&
            ((v.length === 10 && v.startsWith("5")) ||
              (v.length === 11 && v.startsWith("05")) ||
              (v.length === 12 && v.startsWith("905")))),
        message: "Telefon numarasi gecerli bir TR mobil numarasi olmalidir (orn. 05051234567)",
      },
    },
    birthDate: { type: String, default: "" },
    role: { type: String, enum: ["customer", "staff", "manager"], default: "customer" },
    sessionRole: { type: String, enum: ["customer", "staff", "manager"], default: null },
    // MP-2.1: token iptal versiyonu. JWT'ye gomulur; parola degisikligi,
    // logout ve rol dususunde arttirilarak eski token'lar gecersiz kilinir.
    // Default 0 eski belgelerle ve eski token'larla geriye donuk uyumludur.
    tokenVersion: { type: Number, default: 0 },
    // MP-1.1: hesap bazli brute-force kilidi. 5 basarisiz giris sonrasi
    // lockUntil dolana kadar giris reddedilir; basarili giris sayaci sifirlar.
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    leaderboardOptedIn: { type: Boolean, default: true },
    leaderboardOptedOutAt: { type: Date, default: null },
    balance: {
      type: Number,
      default: 0,
      min: [0, "Bakiye negatif olamaz"],
    },
    // MP-2.14: sadakat puani alt siniri — negatif puan new-save'lerde reddedilir.
    points: { type: Number, default: 0, min: [0, "Puan negatif olamaz"] },
    // Damga (stamp_card) sadakati: secili damga kampanyasindaki ilerleme ve
    // kazanilan ucretsiz urun haklari. Serializer bunlari ayiklar ve
    // LoyaltySummary uzerinden (stampStatus/pointsRewardCredits) tasir.
    loyaltyStampProgress: { type: Number, default: 0, min: 0 },
    loyaltyRewardCredits: { type: Number, default: 0, min: 0 },
    avatar: { type: String, default: "" },
    favorites: [{ type: String }],
    addresses: [AddressSchema],
    paymentMethods: [PaymentMethodSchema],
    socialLinks: { type: UserSocialLinksSchema, default: () => ({}) },
    privacy: {
      type: UserPrivacySchema,
      default: () => ({
        isProfilePrivate: false,
        showKp: true,
        showSocials: true,
        showAge: true,
        showGender: true,
        showJoinDate: true,
      }),
    },
    followers: [{ type: String }],
    following: [{ type: String }],
    settings: { type: UserSettingsSchema, default: () => ({ language: "tr", theme: "light", currency: "TRY" }) },
    selectedCampaign: { type: SelectedCampaignSchema, default: null },
    activePointReward: { type: ActivePointRewardSchema, default: null },
    subscriptionId: { type: String, default: "" },
    friends: [{ type: String }], // Array of friend user IDs
  },
  { timestamps: true },
);

UserSchema.pre("save", async function save() {
  if (!this.isModified("password")) {
    return;
  }

  this.password = await bcrypt.hash(this.password, 10);
});

export type UserDocument = mongoose.InferSchemaType<typeof UserSchema> &
  mongoose.Document & {
    comparePassword(candidatePassword: string): Promise<boolean>;
  };

UserSchema.methods.comparePassword = function comparePassword(candidatePassword: string) {
  return bcrypt.compare(candidatePassword, this.password);
};

const UserModel =
  (mongoose.models.User as mongoose.Model<UserDocument>) ||
  mongoose.model<UserDocument>("User", UserSchema);

export default UserModel;
