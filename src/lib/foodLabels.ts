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
  'svíčková na smetaně': { name: 'Svíčková na smetaně s knedlíkem', gramsPerServing: 100, kcal: 214, protein: 7.7, carbs: 27, fat: 8.2, fiber: 1.5, sugar: 5.6, sodium: 350 },
  'kuřecí řízek': { name: 'Kuřecí řízek', gramsPerServing: 100, kcal: 175, protein: 23, carbs: 0, fat: 12, fiber: 0, sugar: 0, sodium: 350 },
  'hovězí guláš': { name: 'Hovězí guláš', gramsPerServing: 100, kcal: 103, protein: 6.03, carbs: 4.63, fat: 6.53, fiber: 1, sugar: 0.22, sodium: 200 },
  'houskový knedlík': { name: 'Houskový knedlík', gramsPerServing: 100, kcal: 245, protein: 7.8, carbs: 44, fat: 3.6, fiber: 2, sugar: 0.6, sodium: 400 },
  bramborák: { name: 'Bramborák', gramsPerServing: 100, kcal: 155, protein: 4, carbs: 18, fat: 7, fiber: 2, sugar: 2, sodium: 400 },
  palačinky: { name: 'Palačinky', gramsPerServing: 100, kcal: 285, protein: 7.8, carbs: 36.1, fat: 8.34, fiber: 1.63, sugar: 8.6, sodium: 150 },
  'kuře à la svíčková': { name: 'Kuře à la svíčková', gramsPerServing: 320, kcal: 368, protein: 32, carbs: 16, fat: 19, fiber: 7, sugar: 10, sodium: 650 },
  'schnitzel with potato salad': { name: 'Řízek s bramborem', gramsPerServing: 450, kcal: 654, protein: 49, carbs: 62, fat: 23, fiber: 3.8, sugar: 1.5, sodium: 310 },
  'pork goulash': { name: 'Vepřový guláš', gramsPerServing: 250, kcal: 132, protein: 9.4, carbs: 3.4, fat: 8.9, fiber: 0.5, sugar: 1.2, sodium: 340 },
  'mushroom omelette': { name: 'Vaječná omeleta se žampiony', gramsPerServing: 200, kcal: 303, protein: 16, carbs: 5.6, fat: 23.6, fiber: 3.1, sugar: 0.53, sodium: 196 },

  // ---- Czech dishes — estimated (not in the site's catalogue) ----
  'vepřo knedlo zelo (roast pork, dumpling, sauerkraut)': { name: 'Vepřo knedlo zelo', gramsPerServing: 400, kcal: 620, protein: 32, carbs: 55, fat: 30, fiber: 6, sugar: 6, sodium: 900 },
  'smažený sýr (fried cheese)': { name: 'Smažený sýr', gramsPerServing: 250, kcal: 650, protein: 24, carbs: 40, fat: 42, fiber: 2, sugar: 3, sodium: 900 },
  'trdelník': { name: 'Trdelník', gramsPerServing: 100, kcal: 350, protein: 6, carbs: 55, fat: 11, fiber: 1, sugar: 25, sodium: 150 },
  'tatarák (beef tartare)': { name: 'Tatarák', gramsPerServing: 150, kcal: 280, protein: 26, carbs: 20, fat: 10, fiber: 1, sugar: 2, sodium: 700 },
  buchty: { name: 'Buchty', gramsPerServing: 90, kcal: 270, protein: 6, carbs: 42, fat: 9, fiber: 2, sugar: 16, sodium: 120 },
  utopenci: { name: 'Utopenci', gramsPerServing: 100, kcal: 220, protein: 10, carbs: 4, fat: 18, fiber: 1, sugar: 2, sodium: 850 },

  // ---- International mains ----
  pizza: { name: 'Pizza', gramsPerServing: 100, kcal: 214, protein: 8.9, carbs: 25.7, fat: 8, fiber: 2, sugar: 3, sodium: 400 },
  cheeseburger: { name: 'Cheeseburger', gramsPerServing: 100, kcal: 263, protein: 13, carbs: 26.7, fat: 11.8, fiber: 1.1, sugar: 5, sodium: 650 },
  'hot dog': { name: 'Hot dog', gramsPerServing: 150, kcal: 340, protein: 12, carbs: 26, fat: 21, fiber: 1, sugar: 5, sodium: 970 },
  'french fries': { name: 'French fries', gramsPerServing: 150, kcal: 460, protein: 6, carbs: 58, fat: 22, fiber: 5, sugar: 1, sodium: 380 },
  sushi: { name: 'Sushi', gramsPerServing: 200, kcal: 300, protein: 12, carbs: 50, fat: 5, fiber: 2, sugar: 6, sodium: 600 },
  ramen: { name: 'Ramen', gramsPerServing: 550, kcal: 780, protein: 34, carbs: 88, fat: 30, fiber: 4, sugar: 5, sodium: 2100 },
  'pad thai': { name: 'Pad thai', gramsPerServing: 420, kcal: 690, protein: 24, carbs: 84, fat: 24, fiber: 3, sugar: 14, sodium: 1420 },
  burrito: { name: 'Burrito', gramsPerServing: 350, kcal: 550, protein: 24, carbs: 68, fat: 20, fiber: 8, sugar: 4, sodium: 1080 },
  tacos: { name: 'Tacos', gramsPerServing: 250, kcal: 450, protein: 22, carbs: 40, fat: 22, fiber: 6, sugar: 3, sodium: 800 },
  'fried chicken': { name: 'Fried chicken', gramsPerServing: 200, kcal: 540, protein: 34, carbs: 18, fat: 36, fiber: 1, sugar: 0, sodium: 900 },
  steak: { name: 'Steak', gramsPerServing: 250, kcal: 500, protein: 52, carbs: 0, fat: 32, fiber: 0, sugar: 0, sodium: 400 },
  'grilled salmon': { name: 'Grilled salmon', gramsPerServing: 280, kcal: 555, protein: 27.5, carbs: 30.5, fat: 35.5, fiber: 0.8, sugar: 28.5, sodium: 300 },
  'caesar salad': { name: 'Caesar salad with chicken', gramsPerServing: 350, kcal: 470, protein: 36, carbs: 14, fat: 30, fiber: 3, sugar: 3, sodium: 980 },
  'greek salad': { name: 'Greek salad + bread', gramsPerServing: 380, kcal: 410, protein: 14, carbs: 38, fat: 23, fiber: 6, sugar: 7, sodium: 760 },
  guacamole: { name: 'Guacamole', gramsPerServing: 100, kcal: 124, protein: 1.43, carbs: 4.86, fat: 11.04, fiber: 2.97, sugar: 1.25, sodium: 204 },
  hummus: { name: 'Hummus', gramsPerServing: 100, kcal: 240, protein: 8, carbs: 20, fat: 15, fiber: 6, sugar: 1, sodium: 320 },
  falafel: { name: 'Falafel wrap', gramsPerServing: 320, kcal: 550, protein: 17, carbs: 66, fat: 24, fiber: 9, sugar: 5, sodium: 890 },
  'spaghetti bolognese': { name: 'Spaghetti bolognese', gramsPerServing: 350, kcal: 480, protein: 24, carbs: 60, fat: 15, fiber: 5, sugar: 8, sodium: 700 },
  lasagna: { name: 'Lasagna', gramsPerServing: 300, kcal: 620, protein: 30, carbs: 50, fat: 32, fiber: 3, sugar: 6, sodium: 900 },
  carbonara: { name: 'Carbonara', gramsPerServing: 350, kcal: 620, protein: 24, carbs: 66, fat: 28, fiber: 3, sugar: 3, sodium: 850 },
  risotto: { name: 'Risotto', gramsPerServing: 300, kcal: 450, protein: 12, carbs: 60, fat: 16, fiber: 2, sugar: 2, sodium: 700 },
  paella: { name: 'Paella', gramsPerServing: 350, kcal: 500, protein: 28, carbs: 55, fat: 16, fiber: 3, sugar: 4, sodium: 800 },
  curry: { name: 'Curry', gramsPerServing: 350, kcal: 480, protein: 22, carbs: 40, fat: 26, fiber: 5, sugar: 8, sodium: 900 },
  biryani: { name: 'Biryani', gramsPerServing: 350, kcal: 550, protein: 22, carbs: 75, fat: 18, fiber: 3, sugar: 5, sodium: 850 },
  dumplings: { name: 'Dumplings', gramsPerServing: 200, kcal: 380, protein: 14, carbs: 48, fat: 14, fiber: 2, sugar: 2, sodium: 700 },
  'pho soup': { name: 'Pho', gramsPerServing: 500, kcal: 400, protein: 25, carbs: 55, fat: 8, fiber: 2, sugar: 4, sodium: 1600 },
  kebab: { name: 'Kebab', gramsPerServing: 350, kcal: 620, protein: 32, carbs: 55, fat: 30, fiber: 4, sugar: 5, sodium: 1200 },
  'mashed potatoes': { name: 'Bramborová kaše', gramsPerServing: 100, kcal: 115, protein: 3, carbs: 14, fat: 5, fiber: 2, sugar: 1, sodium: 300 },

  // ---- Breakfast / bakery ----
  pancakes: { name: 'Pancakes', gramsPerServing: 150, kcal: 300, protein: 8, carbs: 45, fat: 10, fiber: 1, sugar: 12, sodium: 400 },
  waffles: { name: 'Waffles', gramsPerServing: 150, kcal: 330, protein: 8, carbs: 42, fat: 15, fiber: 1, sugar: 13, sodium: 450 },
  omelette: { name: 'Omelette', gramsPerServing: 200, kcal: 280, protein: 18, carbs: 3, fat: 22, fiber: 0, sugar: 1, sodium: 400 },
  'scrambled eggs': { name: 'Scrambled eggs + toast', gramsPerServing: 220, kcal: 390, protein: 22, carbs: 28, fat: 20, fiber: 3, sugar: 3, sodium: 560 },
  oatmeal: { name: 'Oat bowl, banana', gramsPerServing: 350, kcal: 430, protein: 16, carbs: 68, fat: 11, fiber: 8, sugar: 22, sodium: 120 },
  croissant: { name: 'Croissant', gramsPerServing: 60, kcal: 240, protein: 5, carbs: 27, fat: 13, fiber: 1, sugar: 6, sodium: 260 },
  bagel: { name: 'Bagel', gramsPerServing: 100, kcal: 270, protein: 10, carbs: 53, fat: 2, fiber: 2, sugar: 6, sodium: 490 },
  donut: { name: 'Donut', gramsPerServing: 70, kcal: 280, protein: 4, carbs: 34, fat: 15, fiber: 1, sugar: 16, sodium: 260 },
  toast: { name: 'Peanut butter toast', gramsPerServing: 110, kcal: 340, protein: 12, carbs: 32, fat: 18, fiber: 4, sugar: 8, sodium: 300 },

  // ---- Desserts / sweets ----
  'ice cream': { name: 'Ice cream', gramsPerServing: 100, kcal: 210, protein: 4, carbs: 24, fat: 11, fiber: 0, sugar: 21, sodium: 80 },
  'chocolate cake': { name: 'Chocolate cake', gramsPerServing: 100, kcal: 370, protein: 5, carbs: 50, fat: 17, fiber: 3, sugar: 35, sodium: 300 },
  cheesecake: { name: 'Cheesecake', gramsPerServing: 100, kcal: 320, protein: 6, carbs: 26, fat: 22, fiber: 1, sugar: 20, sodium: 250 },
  'apple pie': { name: 'Apple pie', gramsPerServing: 125, kcal: 300, protein: 3, carbs: 42, fat: 14, fiber: 2, sugar: 22, sodium: 210 },

  // ---- Fruits — SOURCED (kaloricketabulky.cz) ----
  banana: { name: 'Banán', gramsPerServing: 100, kcal: 94, protein: 1.2, carbs: 22, fat: 0.2, fiber: 2, sugar: 19, sodium: 1 },
  orange: { name: 'Pomeranč', gramsPerServing: 100, kcal: 49.7, protein: 0.92, carbs: 11.04, fat: 0.22, fiber: 3.07, sugar: 7.3, sodium: 0 },
  strawberries: { name: 'Jahody', gramsPerServing: 100, kcal: 34.4, protein: 0.79, carbs: 6.16, fat: 0.37, fiber: 1.75, sugar: 4.29, sodium: 2 },
  apple: { name: 'Jablko', gramsPerServing: 100, kcal: 47.5, protein: 0.6, carbs: 10, fat: 0.4, fiber: 1.7, sugar: 8, sodium: 2 },
  pineapple: { name: 'Ananas', gramsPerServing: 100, kcal: 58, protein: 0.49, carbs: 12.7, fat: 0.19, fiber: 1.95, sugar: 10.12, sodium: 2 },

  // ---- Vegetables — SOURCED (kaloricketabulky.cz) ----
  broccoli: { name: 'Brokolice', gramsPerServing: 100, kcal: 43.4, protein: 3.3, carbs: 5.7, fat: 0.2, fiber: 3, sugar: 2.49, sodium: 30 },
  cauliflower: { name: 'Květák', gramsPerServing: 100, kcal: 35.3, protein: 2.45, carbs: 4.48, fat: 0.28, fiber: 2.68, sugar: 3.14, sodium: 20 },
  mushrooms: { name: 'Žampiony', gramsPerServing: 100, kcal: 27.9, protein: 2.79, carbs: 3, fat: 0.24, fiber: 1.4, sugar: 0.31, sodium: 5 },
  'bell pepper': { name: 'Paprika', gramsPerServing: 100, kcal: 30.6, protein: 1.09, carbs: 4.59, fat: 0.46, fiber: 2, sugar: 2.5, sodium: 4 },
  cucumber: { name: 'Okurka salátová', gramsPerServing: 100, kcal: 15.8, protein: 0.82, carbs: 2.28, fat: 0.18, fiber: 0.93, sugar: 1.47, sodium: 3 },
  'bean salad': { name: 'Fazolový salát', gramsPerServing: 150, kcal: 130, protein: 6, carbs: 16, fat: 5, fiber: 6, sugar: 2, sodium: 350 },

  // ---- Soups ----
  'chicken broth': { name: 'Slepičí vývar', gramsPerServing: 100, kcal: 29.3, protein: 1, carbs: 0.7, fat: 0.6, fiber: 0, sugar: 0, sodium: 400 },
  'a bowl of soup': { name: 'Soup', gramsPerServing: 300, kcal: 180, protein: 8, carbs: 20, fat: 7, fiber: 3, sugar: 4, sodium: 900 },

  // ---- Drinks ----
  'a cup of coffee': { name: 'Coffee', gramsPerServing: 200, kcal: 5, protein: 0.3, carbs: 0.5, fat: 0.1, fiber: 0, sugar: 0, sodium: 5 },
  'a glass of red wine': { name: 'Red wine', gramsPerServing: 150, kcal: 125, protein: 0, carbs: 4, fat: 0, fiber: 0, sugar: 1, sodium: 6 },
  'a protein shake': { name: 'Protein shake', gramsPerServing: 400, kcal: 210, protein: 30, carbs: 12, fat: 4, fiber: 2, sugar: 8, sodium: 210 },
};
