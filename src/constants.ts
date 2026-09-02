import { Product } from './types';

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'Caffè Latte',
    price: 85,
    category: 'Coffee',
    inStock: true,
    ingredients: ['Süt', 'Laktoz']
  },
  {
    id: '2',
    name: 'Iced Americano',
    price: 75,
    category: 'Coffee',
    inStock: true,
    ingredients: []
  },
  {
    id: '3',
    name: 'Cappuccino',
    price: 80,
    category: 'Coffee',
    inStock: true,
    ingredients: ['Süt', 'Laktoz']
  },
  {
    id: '4',
    name: 'Flat White',
    price: 90,
    category: 'Coffee',
    inStock: true,
    ingredients: ['Süt', 'Laktoz']
  },
  {
    id: '5',
    name: 'Butter Croissant',
    price: 65,
    category: 'Bakery',
    inStock: true,
    ingredients: ['Un', 'Yumurta', 'Süt', 'Gluten']
  },
  {
    id: '6',
    name: 'Chocolate Muffin',
    price: 70,
    category: 'Bakery',
    inStock: true,
    ingredients: ['Un', 'Yumurta', 'Süt', 'Gluten', 'Şeker']
  },
  {
    id: '7',
    name: 'San Sebastian Cheesecake',
    price: 120,
    category: 'Dessert',
    inStock: true,
    ingredients: ['Süt', 'Yumurta', 'Şeker', 'Laktoz']
  },
];
