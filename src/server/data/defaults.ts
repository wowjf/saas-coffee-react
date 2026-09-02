export const defaultCategories = [
  { name: "Coffee", iconName: "Coffee" },
  { name: "Bakery", iconName: "Cookie" },
  { name: "Dessert", iconName: "Cake" },
  { name: "Cold Drinks", iconName: "Droplets" },
];

export const defaultIngredients = [
  { name: "Sut", iconName: "Milk" },
  { name: "Gluten", iconName: "Wheat" },
  { name: "Yumurta", iconName: "Egg" },
  { name: "Kuruyemis", iconName: "Bean" },
];

export const defaultProducts = [
  {
    name: "Caffe Latte",
    price: 85,
    category: "Coffee",
    inStock: true,
    ingredients: ["Sut", "Laktoz"],
  },
  {
    name: "Iced Americano",
    price: 75,
    category: "Coffee",
    inStock: true,
    ingredients: [],
  },
  {
    name: "Cappuccino",
    price: 80,
    category: "Coffee",
    inStock: true,
    ingredients: ["Sut", "Laktoz"],
  },
  {
    name: "Flat White",
    price: 90,
    category: "Coffee",
    inStock: true,
    ingredients: ["Sut", "Laktoz"],
  },
  {
    name: "Butter Croissant",
    price: 65,
    category: "Bakery",
    inStock: true,
    ingredients: ["Un", "Yumurta", "Sut", "Gluten"],
  },
  {
    name: "Chocolate Muffin",
    price: 70,
    category: "Bakery",
    inStock: true,
    ingredients: ["Un", "Yumurta", "Sut", "Gluten", "Seker"],
  },
  {
    name: "San Sebastian Cheesecake",
    price: 120,
    category: "Dessert",
    inStock: true,
    ingredients: ["Sut", "Yumurta", "Seker", "Laktoz"],
  },
];

export const defaultCampaigns = [
  {
    title: "Hos Geldin Hediyesi",
    description: "Ilk yuklemene ozel 50 TL hediye bakiye.",
    category: "financial",
    type: "fixed_bonus",
    value: 50,
    fixedGiftAmount: 50,
    active: true,
    expiryDate: "2026-12-31",
    image: "/seed/banner-welcome.webp",
  },
];

export const defaultStaffMembers = [
  {
    name: "Barista",
    surname: "Demo",
    email: "staff@coffeehub.local",
    role: "staff",
    status: "Vardiyada",
    perf: "100%",
  },
];
