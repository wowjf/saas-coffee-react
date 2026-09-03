// A2: envanter-sipariş entegrasyonu. Sipariş tamamlandığında ürün
// malzemeleri (Product.ingredients — malzeme adları) envanter kayıtlarıyla
// (InventoryItem.name) eşleştirilir ve stok atomik olarak düşürülür.
// Eşik altına inen malzemeler için personel bildirimi oluşturulur ve o
// malzemeye bağımlı ürünler stokta yok (inStock=false) işaretlenir.
import InventoryItemModel from "../models/InventoryItem";
import ProductModel from "../models/Product";
import OrderModel, { type OrderDocument } from "../models/Order";
import NotificationModel from "../models/Notification";

export type StockDecrementResult = {
  processed: boolean;
  decrementedItems: Array<{ id: string; name: string; amount: number; remainingStock: number }>;
  lowStockItems: Array<{ id: string; name: string; remainingStock: number; reorderPoint: number }>;
};

// Bir birim ürünün tükettiği malzeme miktarı — envanter kaydının birimi ne
// olursa olsun ürün başına 1 birim varsayılır (MVP: reçete sistemi yok).
const CONSUMPTION_PER_UNIT = 1;

async function createLowStockNotification(item: { name: string; remainingStock: number; reorderPoint: number }) {
  await NotificationModel.create({
    event: "staff_new_order",
    title: "Stok Uyarısı",
    message: `${item.name} stoku kritik seviyede: ${item.remainingStock} (yeniden sipariş noktası: ${item.reorderPoint}).`,
    type: "warning",
    targetRole: "staff",
    read: false,
    timestamp: new Date(),
  });
}

export async function decrementInventoryForOrder(order: OrderDocument): Promise<StockDecrementResult> {
  const emptyResult: StockDecrementResult = {
    processed: false,
    decrementedItems: [],
    lowStockItems: [],
  };

  if (!order.items || order.items.length < 1) {
    return emptyResult;
  }

  // Malzeme adı → toplam tüketim miktarı. Ürün belgesindeki ingredients
  // alanı malzeme ADLARINI taşır (Ingredient modeliyle aynı isim uzayı).
  const consumptionByName = new Map<string, number>();

  for (const item of order.items) {
    const ingredientNames: string[] = Array.isArray(item.product?.ingredients)
      ? item.product.ingredients
      : [];

    for (const ingredientName of ingredientNames) {
      const key = String(ingredientName).trim();
      if (!key) {
        continue;
      }
      consumptionByName.set(key, (consumptionByName.get(key) || 0) + item.quantity * CONSUMPTION_PER_UNIT);
    }
  }

  if (consumptionByName.size < 1) {
    return emptyResult;
  }

  const inventoryItems = await InventoryItemModel.find({
    name: { $in: Array.from(consumptionByName.keys()) },
  });

  if (inventoryItems.length < 1) {
    return emptyResult;
  }

  const result: StockDecrementResult = {
    processed: true,
    decrementedItems: [],
    lowStockItems: [],
  };

  for (const inventoryItem of inventoryItems) {
    const amount = consumptionByName.get(inventoryItem.name) || 0;
    if (amount < 1) {
      continue;
    }

    // MP-2.15: stok düşümü koşullu atomik — currentStock 0'ın altına
    // inemez (guard sorguda) ve eşzamanlı tamamlamalar çift düşmez.
    const updated = await InventoryItemModel.findOneAndUpdate(
      { _id: inventoryItem._id, currentStock: { $gte: amount } },
      { $inc: { currentStock: -amount } },
      { new: true },
    );

    if (!updated) {
      // Stok yetersiz ya da eşzamanlı değişim — kayıt 0'a sabitlenir,
      // sipariş tamamlama akışı bloklanmaz.
      await InventoryItemModel.updateOne(
        { _id: inventoryItem._id },
        { $set: { currentStock: 0 } },
      );
      continue;
    }

    updated.movements.push({
      type: "out",
      quantity: amount,
      reason: `Sipariş #${order._id.toString()} tamamlandı`,
      performedBy: "system",
      performedByName: "Sistem (sipariş tamamlama)",
      timestamp: new Date().toISOString(),
    } as any);
    await updated.save();

    result.decrementedItems.push({
      id: updated._id.toString(),
      name: updated.name,
      amount,
      remainingStock: updated.currentStock,
    });

    const reorderPoint = Number(updated.reorderPoint || 0);
    if (updated.currentStock <= reorderPoint) {
      result.lowStockItems.push({
        id: updated._id.toString(),
        name: updated.name,
        remainingStock: updated.currentStock,
        reorderPoint,
      });
      await createLowStockNotification({
        name: updated.name,
        remainingStock: updated.currentStock,
        reorderPoint,
      });
    }
  }

  return result;
}

// Eşik altındaki malzemelere bağımlı ürünlerin satışa açıklığını günceller:
// malzemesi tükenmiş (currentStock <= 0) ürünler inStock=false olur,
// malzemesi yeniden temin edilenler tekrar satışa açılır.
export async function syncProductStockFlags(ingredientNames?: string[]): Promise<number> {
  let namesFilter: string[] | null = null;

  if (ingredientNames && ingredientNames.length > 0) {
    namesFilter = ingredientNames;
  } else {
    const allItems = await InventoryItemModel.find({}).select({ name: 1 });
    namesFilter = allItems.map((item) => item.name);
  }

  if (!namesFilter || namesFilter.length < 1) {
    return 0;
  }

  // Tükenmiş malzeme adları
  const depleted = await InventoryItemModel.find({
    name: { $in: namesFilter },
    currentStock: { $lte: 0 },
  }).select({ name: 1 });
  const depletedNames = depleted.map((item) => item.name);

  // Bu malzemeleri içeren ürünler
  const affectedProducts = await ProductModel.find({
    ingredients: { $in: namesFilter },
  }).select({ name: 1, ingredients: 1, inStock: 1 });

  let updatedCount = 0;

  for (const product of affectedProducts) {
    const hasDepletedIngredient = (product.ingredients || []).some((ingredient) =>
      depletedNames.includes(ingredient),
    );

    if (hasDepletedIngredient && product.inStock) {
      await ProductModel.updateOne({ _id: product._id }, { $set: { inStock: false } });
      updatedCount += 1;
    }
  }

  return updatedCount;
}
