import type { DatabaseFood } from './foodDatabase';

/**
 * Candidate labels for the CLIP zero-shot classifier (foodClassifier.ts).
 * Unlike a fixed-class model, recognizable variety here is bounded only by
 * this list — add a label with nutrition data and the camera can recognize
 * it. Keys are the exact strings passed as `candidate_labels` and returned
 * in `className`, lowercase, used as-is in the hypothesis template ("a
 * photo of {}, a type of food").
 *
 * SOURCED entries are real values read from individual pages on
 * kaloricketabulky.cz (their sitemap-listed /potraviny/ and /recepty/
 * pages, never their disallowed search endpoint) — see git history for
 * the extraction. Everything else is a reasonable typical-serving estimate.
 */
export const FOOD_LABEL_MAP: Record<string, DatabaseFood> = {
  // ---- Czech dishes — SOURCED (kaloricketabulky.cz) ----
  'svíčková na smetaně': { name: 'Svíčková na smetaně s knedlíkem', typicalGrams: 100, kcal: 214, protein: 7.7, carbs: 27, fat: 8.2, fiber: 1.5, sugar: 5.6, sodium: 350 },
  'kuřecí řízek': { name: 'Kuřecí řízek', typicalGrams: 100, kcal: 175, protein: 23, carbs: 0, fat: 12, fiber: 0, sugar: 0, sodium: 350 },
  'hovězí guláš': { name: 'Hovězí guláš', typicalGrams: 100, kcal: 103, protein: 6, carbs: 4.6, fat: 6.5, fiber: 1, sugar: 0.2, sodium: 200 },
  'houskový knedlík': { name: 'Houskový knedlík', typicalGrams: 100, kcal: 245, protein: 7.8, carbs: 44, fat: 3.6, fiber: 2, sugar: 0.6, sodium: 400 },
  bramborák: { name: 'Bramborák', typicalGrams: 100, kcal: 155, protein: 4, carbs: 18, fat: 7, fiber: 2, sugar: 2, sodium: 400 },
  palačinky: { name: 'Palačinky', typicalGrams: 100, kcal: 285, protein: 7.8, carbs: 36.1, fat: 8.3, fiber: 1.6, sugar: 8.6, sodium: 150 },
  'kuře à la svíčková': { name: 'Kuře à la svíčková', typicalGrams: 320, kcal: 115, protein: 10, carbs: 5, fat: 5.9, fiber: 2.2, sugar: 3.1, sodium: 203.1 },
  'schnitzel with potato salad': { name: 'Řízek s bramborem', typicalGrams: 450, kcal: 145.3, protein: 10.9, carbs: 13.8, fat: 5.1, fiber: 0.8, sugar: 0.3, sodium: 68.9 },
  'pork goulash': { name: 'Vepřový guláš', typicalGrams: 250, kcal: 52.8, protein: 3.8, carbs: 1.4, fat: 3.6, fiber: 0.2, sugar: 0.5, sodium: 136 },
  'mushroom omelette': { name: 'Vaječná omeleta se žampiony', typicalGrams: 200, kcal: 151.5, protein: 8, carbs: 2.8, fat: 11.8, fiber: 1.6, sugar: 0.3, sodium: 98 },

  // ---- Czech dishes — estimated (not in the site's catalogue) ----
  'vepřo knedlo zelo (roast pork, dumpling, sauerkraut)': { name: 'Vepřo knedlo zelo', typicalGrams: 400, kcal: 155, protein: 8, carbs: 13.8, fat: 7.5, fiber: 1.5, sugar: 1.5, sodium: 225 },
  'smažený sýr (fried cheese)': { name: 'Smažený sýr', typicalGrams: 250, kcal: 260, protein: 9.6, carbs: 16, fat: 16.8, fiber: 0.8, sugar: 1.2, sodium: 360 },
  'trdelník': { name: 'Trdelník', typicalGrams: 100, kcal: 350, protein: 6, carbs: 55, fat: 11, fiber: 1, sugar: 25, sodium: 150 },
  'tatarák (beef tartare)': { name: 'Tatarák', typicalGrams: 150, kcal: 186.7, protein: 17.3, carbs: 13.3, fat: 6.7, fiber: 0.7, sugar: 1.3, sodium: 466.7 },
  buchty: { name: 'Buchty', typicalGrams: 90, kcal: 300, protein: 6.7, carbs: 46.7, fat: 10, fiber: 2.2, sugar: 17.8, sodium: 133.3 },
  utopenci: { name: 'Utopenci', typicalGrams: 100, kcal: 220, protein: 10, carbs: 4, fat: 18, fiber: 1, sugar: 2, sodium: 850 },

  // ---- International mains ----
  pizza: { name: 'Pizza', typicalGrams: 100, kcal: 214, protein: 8.9, carbs: 25.7, fat: 8, fiber: 2, sugar: 3, sodium: 400 },
  cheeseburger: { name: 'Cheeseburger', typicalGrams: 100, kcal: 263, protein: 13, carbs: 26.7, fat: 11.8, fiber: 1.1, sugar: 5, sodium: 650 },
  'hot dog': { name: 'Hot dog', typicalGrams: 150, kcal: 226.7, protein: 8, carbs: 17.3, fat: 14, fiber: 0.7, sugar: 3.3, sodium: 646.7 },
  'french fries': { name: 'French fries', typicalGrams: 150, kcal: 306.7, protein: 4, carbs: 38.7, fat: 14.7, fiber: 3.3, sugar: 0.7, sodium: 253.3 },
  sushi: { name: 'Sushi', typicalGrams: 200, kcal: 150, protein: 6, carbs: 25, fat: 2.5, fiber: 1, sugar: 3, sodium: 300 },
  ramen: { name: 'Ramen', typicalGrams: 550, kcal: 141.8, protein: 6.2, carbs: 16, fat: 5.5, fiber: 0.7, sugar: 0.9, sodium: 381.8 },
  'pad thai': { name: 'Pad thai', typicalGrams: 420, kcal: 164.3, protein: 5.7, carbs: 20, fat: 5.7, fiber: 0.7, sugar: 3.3, sodium: 338.1 },
  burrito: { name: 'Burrito', typicalGrams: 350, kcal: 157.1, protein: 6.9, carbs: 19.4, fat: 5.7, fiber: 2.3, sugar: 1.1, sodium: 308.6 },
  tacos: { name: 'Tacos', typicalGrams: 250, kcal: 180, protein: 8.8, carbs: 16, fat: 8.8, fiber: 2.4, sugar: 1.2, sodium: 320 },
  'fried chicken': { name: 'Fried chicken', typicalGrams: 200, kcal: 270, protein: 17, carbs: 9, fat: 18, fiber: 0.5, sugar: 0, sodium: 450 },
  steak: { name: 'Steak', typicalGrams: 250, kcal: 200, protein: 20.8, carbs: 0, fat: 12.8, fiber: 0, sugar: 0, sodium: 160 },
  'grilled salmon': { name: 'Grilled salmon', typicalGrams: 280, kcal: 198.2, protein: 9.8, carbs: 10.9, fat: 12.7, fiber: 0.3, sugar: 10.2, sodium: 107.1 },
  'caesar salad': { name: 'Caesar salad with chicken', typicalGrams: 350, kcal: 134.3, protein: 10.3, carbs: 4, fat: 8.6, fiber: 0.9, sugar: 0.9, sodium: 280 },
  'greek salad': { name: 'Greek salad + bread', typicalGrams: 380, kcal: 107.9, protein: 3.7, carbs: 10, fat: 6.1, fiber: 1.6, sugar: 1.8, sodium: 200 },
  guacamole: { name: 'Guacamole', typicalGrams: 100, kcal: 124, protein: 1.4, carbs: 4.9, fat: 11, fiber: 3, sugar: 1.3, sodium: 204 },
  hummus: { name: 'Hummus', typicalGrams: 100, kcal: 240, protein: 8, carbs: 20, fat: 15, fiber: 6, sugar: 1, sodium: 320 },
  falafel: { name: 'Falafel wrap', typicalGrams: 320, kcal: 171.9, protein: 5.3, carbs: 20.6, fat: 7.5, fiber: 2.8, sugar: 1.6, sodium: 278.1 },
  'spaghetti bolognese': { name: 'Spaghetti bolognese', typicalGrams: 350, kcal: 137.1, protein: 6.9, carbs: 17.1, fat: 4.3, fiber: 1.4, sugar: 2.3, sodium: 200 },
  lasagna: { name: 'Lasagna', typicalGrams: 300, kcal: 206.7, protein: 10, carbs: 16.7, fat: 10.7, fiber: 1, sugar: 2, sodium: 300 },
  carbonara: { name: 'Carbonara', typicalGrams: 350, kcal: 177.1, protein: 6.9, carbs: 18.9, fat: 8, fiber: 0.9, sugar: 0.9, sodium: 242.9 },
  risotto: { name: 'Risotto', typicalGrams: 300, kcal: 150, protein: 4, carbs: 20, fat: 5.3, fiber: 0.7, sugar: 0.7, sodium: 233.3 },
  paella: { name: 'Paella', typicalGrams: 350, kcal: 142.9, protein: 8, carbs: 15.7, fat: 4.6, fiber: 0.9, sugar: 1.1, sodium: 228.6 },
  curry: { name: 'Curry', typicalGrams: 350, kcal: 137.1, protein: 6.3, carbs: 11.4, fat: 7.4, fiber: 1.4, sugar: 2.3, sodium: 257.1 },
  biryani: { name: 'Biryani', typicalGrams: 350, kcal: 157.1, protein: 6.3, carbs: 21.4, fat: 5.1, fiber: 0.9, sugar: 1.4, sodium: 242.9 },
  dumplings: { name: 'Dumplings', typicalGrams: 200, kcal: 190, protein: 7, carbs: 24, fat: 7, fiber: 1, sugar: 1, sodium: 350 },
  'pho soup': { name: 'Pho', typicalGrams: 500, kcal: 80, protein: 5, carbs: 11, fat: 1.6, fiber: 0.4, sugar: 0.8, sodium: 320 },
  kebab: { name: 'Kebab', typicalGrams: 350, kcal: 177.1, protein: 9.1, carbs: 15.7, fat: 8.6, fiber: 1.1, sugar: 1.4, sodium: 342.9 },
  'mashed potatoes': { name: 'Bramborová kaše', typicalGrams: 100, kcal: 115, protein: 3, carbs: 14, fat: 5, fiber: 2, sugar: 1, sodium: 300 },

  // ---- Breakfast / bakery ----
  pancakes: { name: 'Pancakes', typicalGrams: 150, kcal: 200, protein: 5.3, carbs: 30, fat: 6.7, fiber: 0.7, sugar: 8, sodium: 266.7 },
  waffles: { name: 'Waffles', typicalGrams: 150, kcal: 220, protein: 5.3, carbs: 28, fat: 10, fiber: 0.7, sugar: 8.7, sodium: 300 },
  omelette: { name: 'Omelette', typicalGrams: 200, kcal: 140, protein: 9, carbs: 1.5, fat: 11, fiber: 0, sugar: 0.5, sodium: 200 },
  'scrambled eggs': { name: 'Scrambled eggs + toast', typicalGrams: 220, kcal: 177.3, protein: 10, carbs: 12.7, fat: 9.1, fiber: 1.4, sugar: 1.4, sodium: 254.5 },
  oatmeal: { name: 'Oat bowl, banana', typicalGrams: 350, kcal: 122.9, protein: 4.6, carbs: 19.4, fat: 3.1, fiber: 2.3, sugar: 6.3, sodium: 34.3 },
  croissant: { name: 'Croissant', typicalGrams: 60, kcal: 400, protein: 8.3, carbs: 45, fat: 21.7, fiber: 1.7, sugar: 10, sodium: 433.3 },
  bagel: { name: 'Bagel', typicalGrams: 100, kcal: 270, protein: 10, carbs: 53, fat: 2, fiber: 2, sugar: 6, sodium: 490 },
  donut: { name: 'Donut', typicalGrams: 70, kcal: 400, protein: 5.7, carbs: 48.6, fat: 21.4, fiber: 1.4, sugar: 22.9, sodium: 371.4 },
  toast: { name: 'Peanut butter toast', typicalGrams: 110, kcal: 309.1, protein: 10.9, carbs: 29.1, fat: 16.4, fiber: 3.6, sugar: 7.3, sodium: 272.7 },

  // ---- Desserts / sweets ----
  'ice cream': { name: 'Ice cream', typicalGrams: 100, kcal: 210, protein: 4, carbs: 24, fat: 11, fiber: 0, sugar: 21, sodium: 80 },
  'chocolate cake': { name: 'Chocolate cake', typicalGrams: 100, kcal: 370, protein: 5, carbs: 50, fat: 17, fiber: 3, sugar: 35, sodium: 300 },
  cheesecake: { name: 'Cheesecake', typicalGrams: 100, kcal: 320, protein: 6, carbs: 26, fat: 22, fiber: 1, sugar: 20, sodium: 250 },
  'apple pie': { name: 'Apple pie', typicalGrams: 125, kcal: 240, protein: 2.4, carbs: 33.6, fat: 11.2, fiber: 1.6, sugar: 17.6, sodium: 168 },

  // ---- Fruits — SOURCED (kaloricketabulky.cz) ----
  banana: { name: 'Banán', typicalGrams: 100, kcal: 94, protein: 1.2, carbs: 22, fat: 0.2, fiber: 2, sugar: 19, sodium: 1 },
  orange: { name: 'Pomeranč', typicalGrams: 100, kcal: 49.7, protein: 0.9, carbs: 11, fat: 0.2, fiber: 3.1, sugar: 7.3, sodium: 0 },
  strawberries: { name: 'Jahody', typicalGrams: 100, kcal: 34.4, protein: 0.8, carbs: 6.2, fat: 0.4, fiber: 1.8, sugar: 4.3, sodium: 2 },
  apple: { name: 'Jablko', typicalGrams: 100, kcal: 47.5, protein: 0.6, carbs: 10, fat: 0.4, fiber: 1.7, sugar: 8, sodium: 2 },
  pineapple: { name: 'Ananas', typicalGrams: 100, kcal: 58, protein: 0.5, carbs: 12.7, fat: 0.2, fiber: 2, sugar: 10.1, sodium: 2 },

  // ---- Vegetables — SOURCED (kaloricketabulky.cz) ----
  broccoli: { name: 'Brokolice', typicalGrams: 100, kcal: 43.4, protein: 3.3, carbs: 5.7, fat: 0.2, fiber: 3, sugar: 2.5, sodium: 30 },
  cauliflower: { name: 'Květák', typicalGrams: 100, kcal: 35.3, protein: 2.5, carbs: 4.5, fat: 0.3, fiber: 2.7, sugar: 3.1, sodium: 20 },
  mushrooms: { name: 'Žampiony', typicalGrams: 100, kcal: 27.9, protein: 2.8, carbs: 3, fat: 0.2, fiber: 1.4, sugar: 0.3, sodium: 5 },
  'bell pepper': { name: 'Paprika', typicalGrams: 100, kcal: 30.6, protein: 1.1, carbs: 4.6, fat: 0.5, fiber: 2, sugar: 2.5, sodium: 4 },
  cucumber: { name: 'Okurka salátová', typicalGrams: 100, kcal: 15.8, protein: 0.8, carbs: 2.3, fat: 0.2, fiber: 0.9, sugar: 1.5, sodium: 3 },
  'bean salad': { name: 'Fazolový salát', typicalGrams: 150, kcal: 86.7, protein: 4, carbs: 10.7, fat: 3.3, fiber: 4, sugar: 1.3, sodium: 233.3 },

  // ---- Soups ----
  'chicken broth': { name: 'Slepičí vývar', typicalGrams: 100, kcal: 29.3, protein: 1, carbs: 0.7, fat: 0.6, fiber: 0, sugar: 0, sodium: 400 },
  'a bowl of soup': { name: 'Soup', typicalGrams: 300, kcal: 60, protein: 2.7, carbs: 6.7, fat: 2.3, fiber: 1, sugar: 1.3, sodium: 300 },

  // ---- Drinks ----
  'a cup of coffee': { name: 'Coffee', typicalGrams: 200, kcal: 2.5, protein: 0.2, carbs: 0.3, fat: 0.1, fiber: 0, sugar: 0, sodium: 2.5 },
  'a glass of red wine': { name: 'Red wine', typicalGrams: 150, kcal: 83.3, protein: 0, carbs: 2.7, fat: 0, fiber: 0, sugar: 0.7, sodium: 4 },
  'a protein shake': { name: 'Protein shake', typicalGrams: 400, kcal: 52.5, protein: 7.5, carbs: 3, fat: 1, fiber: 0.5, sugar: 2, sodium: 52.5 },
};
