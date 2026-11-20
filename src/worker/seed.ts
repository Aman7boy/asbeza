import type { Product } from '../lib/catalogue'

// Three demo traders with a morning's prices, used to seed an empty store so
// the board is never blank on first run. Sign in as any of them with the demo
// password below, or open a fresh trader account from /trader.
const morning = new Date()
morning.setHours(6, 15, 0, 0)
if (morning.getTime() > Date.now()) morning.setDate(morning.getDate() - 1)
export const SEEDED_AT = morning.toISOString()

export const DEMO_PASSWORD = 'asbeza'

export type SeedListing = Omit<Product, 'shopId' | 'updatedAt'>

export type SeedTrader = {
  id: string
  name: string
  location: string
  latitude?: number | null
  longitude?: number | null
  houseNumber: string
  phone: string
  hours: string
  currency: string
  paymentMethod?: string
  paymentAccount?: string
  listings: SeedListing[]
}

const T = (
  id: string,
  name: string,
  category: SeedListing['category'],
  emoji: string,
  unit: string,
  price: number,
  previousPrice: number | null,
  stock: SeedListing['stock'],
  note = '',
): SeedListing => ({ id, name, category, emoji, unit, price, previousPrice, stock, note })

export const DEMO_TRADERS: SeedTrader[] = [
  {
    id: 'shop-alem',
    name: 'Alem Spice & Grain',
    location: 'Merkato, Addis Ababa',
    latitude: 9.0358,
    longitude: 38.7469,
    houseNumber: '412',
    phone: '251911234567',
    hours: 'Mon–Sat, 6 am – 7 pm',
    currency: 'ETB',
    paymentMethod: 'Telebirr',
    paymentAccount: '+251 911 234 567',
    listings: [
      T('alem-berbere', 'Berbere በርበሬ', 'Chilli powder', '🌶️', 'kg', 480, 450, 'in', 'fresh batch'),
      T('alem-mitmita', 'Mitmita ሚጥሚጣ', 'Chilli powder', '🔥', 'kg', 620, 620, 'in'),
      T('alem-karia', 'Karia chilli powder', 'Chilli powder', '🌶️', 'kg', 380, 400, 'low'),
      T('alem-flakes', 'Chilli flakes', 'Chilli powder', '🌶️', 'kg', 390, 390, 'out', 'back Thursday'),
      T('alem-shiro', 'Shiro powder', 'Ingredients', '🥣', 'kg', 320, 320, 'in'),
      T('alem-teff-flour', 'Teff flour (white) የጤፍ ዱቄት', 'Ingredients', '🌾', 'kg', 145, 140, 'in'),
      T('alem-honey', 'White honey', 'Ingredients', '🍯', 'kg', 900, 850, 'in'),
      T('alem-netch-azmud', 'White cumin (netch azmud) ከሙን', 'Spices', '🫙', 'kg', 1250, 1200, 'in'),
      T('alem-tikur-azmud', 'Black cumin (tikur azmud)', 'Spices', '🫙', 'kg', 1450, 1400, 'in'),
      T('alem-korerima', 'Korerima (Ethiopian cardamom) ኮረሪማ', 'Spices', '🌰', 'kg', 3800, 3600, 'low'),
      T('alem-ird', 'Turmeric (ird) እርድ', 'Spices', '🟡', 'kg', 420, 420, 'in'),
      T('alem-ginger', 'Ginger ዝንጅብል', 'Spices', '🫚', 'kg', 210, 200, 'in'),
      T('alem-garlic-powder', 'Garlic powder የነጭ ሽንኩርት ዱቄት', 'Spices', '🧄', '100 g', 180, 175, 'in'),
      T('alem-cinnamon', 'Cinnamon ቀረፋ', 'Spices', '🍂', '100 g', 260, 250, 'in'),
      T('alem-black-pepper', 'Black pepper ቁንዶ በርበሬ', 'Spices', '🌶️', '100 g', 320, 300, 'in'),
      T('alem-coriander', 'Coriander ድንብላል', 'Spices', '🌿', '100 g', 140, 135, 'in'),
      T('alem-cumin', 'Cumin ከሙን', 'Spices', '🌿', '100 g', 160, 160, 'in'),
      T('alem-wheat', 'Wheat ስንዴ', 'Cereals', '🌾', 'kg', 62, 60, 'in'),
      T('alem-maize', 'Maize በቆሎ', 'Cereals', '🌽', 'kg', 48, 45, 'in'),
      T('alem-beans', 'Beans ባቄላ', 'Pulses', '🫘', 'kg', 95, 90, 'in'),
      T('alem-lentils', 'Lentils ምስር', 'Pulses', '🫘', 'kg', 145, 140, 'in'),
    ],
  },
  {
    id: 'shop-bekele',
    name: 'Bekele Fresh Produce',
    location: 'Atikilt Tera, Addis Ababa',
    latitude: 9.0337,
    longitude: 38.7502,
    houseNumber: '27',
    phone: '251922345678',
    hours: 'Open daily, 5 am – 8 pm',
    currency: 'ETB',
    paymentMethod: 'CBE',
    paymentAccount: '1000 2519 2234',
    listings: [
      T('bekele-tomato', 'Tomato ቲማቲም', 'Vegetable', '🍅', 'kg', 45, 52, 'in', 'plenty today'),
      T('bekele-onion', 'Onion (red) ሽንኩርት', 'Vegetable', '🧅', 'kg', 62, 58, 'in'),
      T('bekele-potato', 'Potato ድንች', 'Vegetable', '🥔', 'kg', 55, 55, 'in'),
      T('bekele-carrot', 'Carrot ካሮት', 'Vegetable', '🥕', 'kg', 70, 65, 'in'),
      T('bekele-cabbage', 'Cabbage ጎመን', 'Vegetable', '🥬', 'piece', 35, 30, 'in'),
      T('bekele-chilli', 'Green chilli ቃሪያ', 'Vegetable', '🌶️', 'kg', 90, 80, 'low'),
      T('bekele-avocado', 'Avocado አቮካዶ', 'Fruit', '🥑', 'kg', 120, 110, 'in', 'ripe'),
      T('bekele-banana', 'Banana ሙዝ', 'Fruit', '🍌', 'dozen', 95, 95, 'in'),
      T('bekele-papaya', 'Papaya ፓፓያ', 'Fruit', '🍈', 'kg', 60, 55, 'in'),
      T('bekele-spinach', 'Spinach (kosta) ቆስጣ', 'Herbs', '🥬', 'bunch', 30, 25, 'in'),
      T('bekele-coriander', 'Coriander ድንብላል', 'Herbs', '🌿', 'bunch', 25, 25, 'in'),
      T('bekele-basil', 'Basil (besobila) ቤሶቢላ', 'Herbs', '🍃', 'bunch', 35, 35, 'in'),
      T('bekele-teff', 'Teff (white, cleaned) ጤፍ', 'Cereals', '🌾', 'kg', 95, 90, 'in'),
      T('bekele-maize', 'Maize በቆሎ', 'Cereals', '🌽', 'kg', 46, 44, 'in'),
      T('bekele-chickpeas', 'Chickpeas ሽምብራ', 'Pulses', '🫘', 'kg', 160, 155, 'in'),
      T('bekele-peas', 'Peas አተር', 'Pulses', '🫛', 'kg', 85, 80, 'in'),
      T('bekele-soybeans', 'Soybeans አኩሪአተር', 'Pulses', '🫘', 'kg', 110, 105, 'in'),
      T('bekele-salt', 'Salt ጨው', 'Ingredients', '🧂', 'kg', 25, 25, 'in'),
      T('bekele-sugar', 'Sugar ስኳር', 'Ingredients', '🍬', 'kg', 78, 75, 'in'),
      T('bekele-flour', 'Flour ዱቄት', 'Ingredients', '🌾', 'kg', 68, 65, 'in'),
    ],
  },
  {
    id: 'shop-hana',
    name: 'Hana Greens & Herbs',
    location: 'Shola Market, Addis Ababa',
    latitude: 9.0107,
    longitude: 38.7925,
    houseNumber: '8',
    phone: '251933456789',
    hours: 'Mon–Sun, 7 am – 6 pm',
    currency: 'ETB',
    paymentMethod: 'Awash Bank',
    paymentAccount: '0132 4567 8901',
    listings: [
      T('hana-teff-white', 'Teff (white, cleaned) ጤፍ', 'Cereals', '🌾', 'quintal', 6500, 6800, 'in'),
      T('hana-teff-mixed', 'Teff (mixed) ጤፍ', 'Cereals', '🌾', 'quintal', 5900, 5900, 'in'),
      T('hana-maize', 'Maize በቆሎ', 'Cereals', '🌽', 'quintal', 3200, 3100, 'in'),
      T('hana-wheat', 'Wheat ስንዴ', 'Cereals', '🌾', 'quintal', 3600, 3500, 'in'),
      T('hana-barley', 'Barley ገብስ', 'Cereals', '🌾', 'quintal', 3000, 3000, 'in'),
      T('hana-sorghum', 'Sorghum ማሽላ', 'Cereals', '🌾', 'quintal', 3100, 3300, 'low'),
      T('hana-oats', 'Oats አጃ', 'Cereals', '🌾', 'kg', 75, 70, 'in'),
      T('hana-rice', 'Rice ሩዝ', 'Cereals', '🍚', 'kg', 120, 115, 'in'),
      T('hana-lentils', 'Red lentils (misir) ምስር', 'Pulses', '🫘', 'kg', 145, 140, 'in'),
      T('hana-chickpeas', 'Chickpeas (shimbra) ሽምብራ', 'Pulses', '🫘', 'kg', 160, 155, 'in'),
      T('hana-split-peas', 'Split peas ክክ', 'Pulses', '🫘', 'kg', 95, 90, 'in'),
      T('hana-coffee', 'Coffee beans (Yirgacheffe) ቡና', 'Ingredients', '☕', 'kg', 950, 900, 'low', 'this season'),
      T('hana-garlic', 'Garlic ነጭ ሽንኩርት', 'Ingredients', '🧄', 'kg', 180, 175, 'in'),
      T('hana-ginger', 'Ginger ዝንጅብል', 'Ingredients', '🫚', 'kg', 210, 200, 'in'),
      T('hana-cooking-oil', 'Cooking oil የምግብ ዘይት', 'Ingredients', '🫗', 'litre', 230, 225, 'in'),
      T('hana-tomato-paste', 'Tomato paste የቲማቲም ድልህ', 'Ingredients', '🍅', 'piece', 65, 60, 'in'),
      T('hana-vinegar', 'Vinegar ኮምጣጤ', 'Ingredients', '🫗', 'litre', 95, 90, 'in'),
      T('hana-baking-powder', 'Baking powder', 'Ingredients', '🧂', '100 g', 85, 80, 'in'),
      T('hana-yeast', 'Yeast እር Sharia', 'Ingredients', '🦠', '100 g', 75, 70, 'in'),
      T('hana-rosemary', 'Rosemary (siga metmet) ሮዝማሪ', 'Herbs', '🌿', 'bunch', 40, 40, 'in'),
      T('hana-basil', 'Basil (besobila) ቤሶቢላ', 'Herbs', '🍃', 'bunch', 35, 35, 'in'),
      T('hana-rue', 'Rue (tenadam) ጤናዳም', 'Herbs', '🌱', 'bunch', 30, 28, 'in'),
      T('hana-turmeric', 'Turmeric እርድ', 'Spices', '🟡', '100 g', 150, 145, 'in'),
      T('hana-cardamom', 'Cardamom ኮረሪማ', 'Spices', '🌿', '100 g', 420, 400, 'in'),
    ],
  },
]
