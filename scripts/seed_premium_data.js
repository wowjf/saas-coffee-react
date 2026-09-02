import mongoose from 'mongoose';
import dotenv from 'dotenv';
import './src/server/models/Category.js';
import './src/server/models/Product.js';
import './src/server/models/Ingredient.js';
import './src/server/models/Table.js';
import './src/server/models/TableSession.js';

dotenv.config();

const categoriesData = [
  { name: "Kahveler", iconName: "Coffee", image: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&q=80&w=600" },
  { name: "Bitki Çayları & Çay", iconName: "Leaf", image: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&q=80&w=600" },
  { name: "Soğuk İçecekler", iconName: "CupSoda", image: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&q=80&w=600" },
  { name: "Fırından Taze", iconName: "Croissant", image: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&q=80&w=600" },
  { name: "Tuzlular & Tostlar", iconName: "Sandwich", image: "https://images.unsplash.com/photo-1541532713592-79a0317b6b77?auto=format&fit=crop&q=80&w=600" },
  { name: "Tatlılar", iconName: "Donut", image: "https://images.unsplash.com/photo-1524351199679-46cddf530c04?auto=format&fit=crop&q=80&w=600" }
];

const ingredientsData = [
  { name: "Gluten", iconName: "WheatOff" },
  { name: "Laktoz", iconName: "Milk" },
  { name: "Yumurta", iconName: "Egg" },
  { name: "Kuruyemiş", iconName: "Nut" },
  { name: "Kafein", iconName: "Bean" }
];

const productsData = [
  // 1. Kahveler
  {
    name: "Espresso Single",
    price: 75,
    category: "Kahveler",
    description: "Bancho Cafe imzalı, özenle seçilmiş %100 Arabica çekirdeklerinden taze çekilmiş yoğun Espresso.",
    image: "https://images.unsplash.com/photo-1510707577719-0d858292c441?auto=format&fit=crop&q=80&w=600",
    inStock: true,
    ingredients: ["Kafein"]
  },
  {
    name: "Espresso Double",
    price: 95,
    category: "Kahveler",
    description: "Çift shot yoğun kahve lezzeti sunan taze çekilmiş yoğun espresso keyfi.",
    image: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&q=80&w=600",
    inStock: true,
    ingredients: ["Kafein"]
  },
  {
    name: "Americano",
    price: 110,
    category: "Kahveler",
    description: "Double shot espresso üzerine eklenen sıcak su ile yumuşak içimli klasik İtalyan kahvesi.",
    image: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&q=80&w=600",
    inStock: true,
    ingredients: ["Kafein"]
  },
  {
    name: "Caffe Latte",
    price: 120,
    category: "Kahveler",
    description: "Tek shot espresso, buharla ısıtılmış kadifemsi süt ve ince süt köpüğünün harika birleşimi.",
    image: "https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&q=80&w=600",
    inStock: true,
    ingredients: ["Kafein", "Laktoz"]
  },
  {
    name: "Cappuccino",
    price: 125,
    category: "Kahveler",
    description: "Espresso lezzetinin, sıcak süt ve bol, kıvamlı süt köpüğü ile buluştuğu geleneksel lezzet.",
    image: "https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&q=80&w=600",
    inStock: true,
    ingredients: ["Kafein", "Laktoz"]
  },
  {
    name: "Flat White",
    price: 135,
    category: "Kahveler",
    description: "Double shot espresso ve mikro köpüklü pürüzsüz sıcak sütün yoğun aromalı uyumu.",
    image: "https://images.unsplash.com/photo-1577968897966-3d4325b36b61?auto=format&fit=crop&q=80&w=600",
    inStock: true,
    ingredients: ["Kafein", "Laktoz"]
  },
  {
    name: "Cortado",
    price: 120,
    category: "Kahveler",
    description: "Birebir oranda espresso ve sıcak sütün yoğun, kremamsı ve dengeli espresso aroması.",
    image: "https://images.unsplash.com/photo-1538587888044-79f13ddd7e49?auto=format&fit=crop&q=80&w=600",
    inStock: true,
    ingredients: ["Kafein", "Laktoz"]
  },
  {
    name: "Salted Caramel Mocha",
    price: 145,
    category: "Kahveler",
    description: "Espresso, çikolata sosu, tuzlu karamel şurubu ve buharda ısıtılmış sütün tatlı-tuzlu gurme deneyimi.",
    image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&q=80&w=600",
    inStock: true,
    ingredients: ["Kafein", "Laktoz"]
  },
  {
    name: "Filtre Kahve",
    price: 100,
    category: "Kahveler",
    description: "Günün seçkin yöresel çekirdeklerinden taze demlenmiş, yumuşak içimli ve dengeli filtre kahve.",
    image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&q=80&w=600",
    inStock: true,
    ingredients: ["Kafein"]
  },

  // 2. Çaylar
  {
    name: "Türk Çayı (Büyük)",
    price: 45,
    category: "Bitki Çayları & Çay",
    description: "Doğu Karadeniz'in en kaliteli çay yapraklarından taze demlenmiş tavşan kanı geleneksel Türk çayı.",
    image: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&q=80&w=600",
    inStock: true,
    ingredients: []
  },
  {
    name: "Yaseminli Yeşil Çay",
    price: 105,
    category: "Bitki Çayları & Çay",
    description: "Doğal yasemin çiçekleri ile harmanlanmış ferahlatıcı ve arındırıcı yeşil çay yaprakları.",
    image: "https://images.unsplash.com/photo-1563822249548-9a72b6353cd1?auto=format&fit=crop&q=80&w=600",
    inStock: true,
    ingredients: []
  },
  {
    name: "Ihlamur & Çubuk Tarçın",
    price: 115,
    category: "Bitki Çayları & Çay",
    description: "Taze elma dilimleri, limon ve çubuk tarçın eşliğinde servis edilen doğal kurutulmuş ıhlamur.",
    image: "https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?auto=format&fit=crop&q=80&w=600",
    inStock: true,
    ingredients: []
  },
  {
    name: "Şifalı Kış Çayı",
    price: 120,
    category: "Bitki Çayları & Çay",
    description: "Kuru zencefil, adaçayı, kuşburnu, karanfil ve elma parçacıkları içeren bağışıklık dostu kış çayı.",
    image: "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&q=80&w=600",
    inStock: true,
    ingredients: []
  },

  // 3. Soğuk İçecekler
  {
    name: "Iced Caffe Latte",
    price: 125,
    category: "Soğuk İçecekler",
    description: "Espresso, soğuk süt ve bol buz küplerinin ferahlatıcı ve pürüzsüz birlikteliği.",
    image: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&q=80&w=600",
    inStock: true,
    ingredients: ["Kafein", "Laktoz"]
  },
  {
    name: "Iced Americano",
    price: 115,
    category: "Soğuk İçecekler",
    description: "Buzlu soğuk su üzerine eklenen double shot taze demlenmiş aromatik espresso.",
    image: "https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&q=80&w=600",
    inStock: true,
    ingredients: ["Kafein"]
  },
  {
    name: "Nane & Çilekli Limonata",
    price: 130,
    category: "Soğuk İçecekler",
    description: "Taze sıkılmış ekşi limon suyu, çilek püresi ve taze nane yaprakları ile ferahlatıcı ev limonatası.",
    image: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&q=80&w=600",
    inStock: true,
    ingredients: []
  },
  {
    name: "Cold Brew",
    price: 135,
    category: "Soğuk İçecekler",
    description: "24 saat boyunca oda sıcaklığında soğuk damlatılarak demlenmiş pürüzsüz, hafif tatlımsı soğuk filtre kahve.",
    image: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&q=80&w=600",
    inStock: true,
    ingredients: ["Kafein"]
  },
  {
    name: "Belçika Çikolatalı Milkshake",
    price: 140,
    category: "Soğuk İçecekler",
    description: "İtalyan vanilyalı dondurma, eritilmiş yoğun Belçika çikolatası sosu ve soğuk süt.",
    image: "https://images.unsplash.com/photo-1579954115545-a95591f28bfc?auto=format&fit=crop&q=80&w=600",
    inStock: true,
    ingredients: ["Laktoz"]
  },

  // 4. Fırından Taze
  {
    name: "Tereyağlı Sade Kruvasan",
    price: 95,
    category: "Fırından Taze",
    description: "Gerçek Fransız tereyağı ile özenle hazırlanmış, dışı çıtır, içi tel tel dökülen taze kruvasan.",
    image: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&q=80&w=600",
    inStock: true,
    ingredients: ["Gluten", "Yumurta", "Laktoz"]
  },
  {
    name: "Çikolatalı Kruvasan",
    price: 120,
    category: "Fırından Taze",
    description: "Çıtır kruvasan hamuru arasında ve üzerinde akışkan bitter Belçika çikolatası dolgusu.",
    image: "https://images.unsplash.com/photo-1608686207856-001b95cf60ca?auto=format&fit=crop&q=80&w=600",
    inStock: true,
    ingredients: ["Gluten", "Yumurta", "Laktoz"]
  },
  {
    name: "Yaban Mersinli Muffin",
    price: 90,
    category: "Fırından Taze",
    description: "İçi taze yaban mersini taneleriyle doldurulmuş, fırından yeni çıkmış pofuduk muffin kek.",
    image: "https://images.unsplash.com/photo-1607958996333-41aef7caefaa?auto=format&fit=crop&q=80&w=600",
    inStock: true,
    ingredients: ["Gluten", "Yumurta", "Laktoz"]
  },
  {
    name: "Double Chocolate Cookie",
    price: 85,
    category: "Fırından Taze",
    description: "Dışı hafif kıtır, içi yumuşacık ve sakızımsı dokuda, bol sütlü ve bitter çikolata parçalı dev kurabiye.",
    image: "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&q=80&w=600",
    inStock: true,
    ingredients: ["Gluten", "Yumurta", "Laktoz"]
  },

  // 5. Tuzlular & Tostlar
  {
    name: "Avokadolu Ekşi Maya Ekmek",
    price: 175,
    category: "Tuzlular & Tostlar",
    description: "Kızarmış ekşi mayalı ekmek dilimi üzerinde avokado püresi, çeri domatesler, beyaz peynir ve çörek otu.",
    image: "https://images.unsplash.com/photo-1541532713592-79a0317b6b77?auto=format&fit=crop&q=80&w=600",
    inStock: true,
    ingredients: ["Gluten", "Laktoz"]
  },
  {
    name: "Füme Etli Kruvasan Sandviç",
    price: 185,
    category: "Tuzlular & Tostlar",
    description: "Taze kruvasan arasında dana füme eti, eritilmiş kaşar peyniri, kıvırcık ve kurutulmuş domates.",
    image: "https://images.unsplash.com/photo-1549880181-56a44cf4a9a1?auto=format&fit=crop&q=80&w=600",
    inStock: true,
    ingredients: ["Gluten", "Yumurta", "Laktoz"]
  },
  {
    name: "Ayvalık Tostu",
    price: 160,
    category: "Tuzlular & Tostlar",
    description: "Özel Ayvalık ekmeğinde ızgara sucuk, erimiş kaşar peyniri, kornişon turşu, domates ve hafif mayonez.",
    image: "https://images.unsplash.com/photo-1539252554453-80ab65ce3586?auto=format&fit=crop&q=80&w=600",
    inStock: true,
    ingredients: ["Gluten", "Laktoz"]
  },

  // 6. Tatlılar
  {
    name: "San Sebastian Cheesecake",
    price: 165,
    category: "Tatlılar",
    description: "İçi yumuşacık ve akışkan, üzeri karamelize Bask stili yanık cheesecake. Sıcak Belçika çikolatası ile.",
    image: "https://images.unsplash.com/photo-1524351199679-46cddf530c04?auto=format&fit=crop&q=80&w=600",
    inStock: true,
    ingredients: ["Gluten", "Yumurta", "Laktoz"]
  },
  {
    name: "Tiramisu",
    price: 150,
    category: "Tatlılar",
    description: "Gerçek İtalyan mascarpone peynirli krema ve espresso ile ıslatılmış savoyer bisküvilerinin eşsiz dengesi.",
    image: "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&q=80&w=600",
    inStock: true,
    ingredients: ["Gluten", "Yumurta", "Laktoz"]
  },
  {
    name: "Çikolatalı Sufle",
    price: 145,
    category: "Tatlılar",
    description: "İçi sıcak ve akışkan Belçika çikolatası dolu, fırından yeni çıkmış enfes sufle tatlısı.",
    image: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&q=80&w=600",
    inStock: true,
    ingredients: ["Gluten", "Yumurta", "Laktoz"]
  },
  {
    name: "Lotus Biscoff Cheesecake",
    price: 160,
    category: "Tatlılar",
    description: "Lotus bisküvi tabanlı, kremsi New York stili cheesecake üzerinde karamelize Lotus kreması.",
    image: "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&q=80&w=600",
    inStock: true,
    ingredients: ["Gluten", "Yumurta", "Laktoz"]
  }
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bancho-cafe');
  console.log("Connected to DB...");

  const Category = mongoose.model('Category');
  const Product = mongoose.model('Product');
  const Ingredient = mongoose.model('Ingredient');

  // Clear existing
  await Category.deleteMany({});
  await Product.deleteMany({});
  await Ingredient.deleteMany({});
  console.log("Database cleared (Categories, Products, Ingredients).");

  // Insert categories
  const insertedCategories = await Category.insertMany(categoriesData);
  console.log(`Inserted ${insertedCategories.length} categories.`);

  // Insert ingredients
  const insertedIngredients = await Ingredient.insertMany(ingredientsData);
  console.log(`Inserted ${insertedIngredients.length} ingredients.`);

  // Insert products
  const insertedProducts = await Product.insertMany(productsData);
  console.log(`Inserted ${insertedProducts.length} products.`);

  // Self-heal table sessions and tables just in case we changed active menu
  const Table = mongoose.model('Table');
  await Table.updateMany({}, { $set: { currentSessionId: "" } });
  
  const TableSession = mongoose.model('TableSession');
  await TableSession.deleteMany({});
  console.log("Table sessions cleared & tables self-healed.");

  await mongoose.disconnect();
  console.log("Database seed completed successfully!");
}

seed().catch(console.error);
