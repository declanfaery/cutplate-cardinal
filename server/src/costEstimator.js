const LOCATION_MULTIPLIERS = [
  { pattern: /\b(new york|nyc|manhattan|brooklyn|san francisco|sf|bay area|los angeles|la|seattle|boston|washington dc|dc)\b/i, multiplier: 1.24 },
  { pattern: /\b(california|ca|new jersey|nj|massachusetts|ma|washington|wa|oregon|or|colorado|co)\b/i, multiplier: 1.14 },
  { pattern: /\b(texas|tx|florida|fl|georgia|ga|arizona|az|north carolina|nc|south carolina|sc)\b/i, multiplier: 0.99 },
  { pattern: /\b(ohio|oh|michigan|mi|indiana|in|missouri|mo|wisconsin|wi|iowa|ia|kansas|ks)\b/i, multiplier: 0.94 }
];

const ZIP_MULTIPLIERS = [
  { pattern: /^(10|11|90|91|92|93|94|95|98|02|20)/, multiplier: 1.2 },
  { pattern: /^(80|81|97|01|03|04|05|06|07|08)/, multiplier: 1.1 },
  { pattern: /^(30|31|32|33|34|35|36|37|38|39|70|71|72|73|74|75|76|77|78|79|85)/, multiplier: 0.99 },
  { pattern: /^(40|41|42|43|44|45|46|47|48|49|50|51|52|53|54|55|56|57|58|59|60|61|62|63|64|65|66|67|68|69)/, multiplier: 0.94 }
];

const PRICE_RULES = [
  { pattern: /chicken thighs?/i, label: 'Chicken thighs', unit: 'oz', price: 3.49 / 16, measure: 'servingOunces', ouncesPerServing: 5, storePackage: fixedPackage(24, 7.49, 'tray', 'trays', '~1.5 lb') },
  { pattern: /chicken/i, label: 'Chicken breasts', unit: 'oz', price: 3.99 / 16, measure: 'servingOunces', ouncesPerServing: 6, storePackage: fixedPackage(24, 8.49, 'tray', 'trays', '~1.5 lb, 3-4 breasts') },
  { pattern: /tuna/i, label: 'Canned tuna', unit: 'oz', price: 1.39 / 5, measure: 'servingOunces', ouncesPerServing: 5, storePackage: fixedPackage(5, 1.39, 'can', 'cans', '5 oz') },
  { pattern: /salmon/i, label: 'Salmon fillets', unit: 'oz', price: 11.99 / 16, measure: 'servingOunces', ouncesPerServing: 6, storePackage: fixedPackage(16, 11.99, 'pack', 'packs', '~1 lb, 2-3 fillets') },
  { pattern: /steak|sirloin/i, label: 'Sirloin steak', unit: 'oz', price: 14.99 / 16, measure: 'servingOunces', ouncesPerServing: 6, storePackage: weightPackage(8, 4, 'steak pack') },
  { pattern: /turkey/i, label: '93% lean ground turkey', unit: 'oz', price: 5.49 / 16, measure: 'servingOunces', ouncesPerServing: 6, storePackage: fixedPackage(16, 5.49, 'pack', 'packs', '1 lb') },
  { pattern: /beef/i, label: 'Lean ground beef', unit: 'oz', price: 6.49 / 16, measure: 'servingOunces', ouncesPerServing: 6, storePackage: fixedPackage(16, 6.49, 'pack', 'packs', '1 lb') },
  { pattern: /shrimp/i, label: 'Shrimp', unit: 'oz', price: 8.99 / 16, measure: 'servingOunces', ouncesPerServing: 5, storePackage: fixedPackage(16, 8.99, 'bag', 'bags', '1 lb') },
  { pattern: /egg/i, label: 'Eggs and egg whites', unit: 'portion', price: 3.49 / 12, measure: 'portion', storePackage: fixedPackage(12, 3.49, 'dozen', 'dozens', '12 ct') },
  { pattern: /tofu/i, label: 'Extra-firm tofu', unit: 'oz', price: 2.49 / 14, measure: 'servingOunces', ouncesPerServing: 5, storePackage: fixedPackage(14, 2.49, 'block', 'blocks', '14 oz') },
  { pattern: /greek yogurt sauce/i, label: 'Greek yogurt sauce', unit: 'tbsp', price: 5.49 / 32, measure: 'spoon', storePackage: fixedPackage(32, 5.49, 'tub', 'tubs', '16 oz') },
  { pattern: /greek yogurt/i, label: 'Greek yogurt', unit: 'cup', price: 5.49 / 4, measure: 'cup', ouncesPerUnit: 8, defaultCups: 0.5, storePackage: fixedPackage(4, 5.49, 'tub', 'tubs', '32 oz') },
  { pattern: /cottage cheese/i, label: 'Cottage cheese', unit: 'cup', price: 3.29 / 2, measure: 'cup', ouncesPerUnit: 8, defaultCups: 0.5, storePackage: fixedPackage(2, 3.29, 'tub', 'tubs', '16 oz') },
  { pattern: /sweet potato/i, label: 'Sweet potatoes', unit: 'cup', price: 1.49 / 2.9, measure: 'cup', ouncesPerUnit: 5.5, defaultCups: 0.5, storePackage: fixedPackage(2.9, 1.49, 'lb', 'lb', '~1 lb') },
  { pattern: /broccoli/i, label: 'Broccoli', unit: 'cup', price: 2.49 / 3, measure: 'cup', ouncesPerUnit: 3, defaultCups: 1, storePackage: fixedPackage(3, 2.49, 'crown', 'crowns', '~3 cups') },
  { pattern: /spinach/i, label: 'Spinach', unit: 'cup', price: 3.49 / 5, measure: 'cup', ouncesPerUnit: 1, defaultCups: 1, storePackage: fixedPackage(5, 3.49, 'bag', 'bags', '5 oz') },
  { pattern: /avocado/i, label: 'Avocados', unit: 'each', singular: 'avocado', plural: 'avocados', price: 1.25, measure: 'each' },
  { pattern: /salsa/i, label: 'Salsa', unit: 'tbsp', price: 3.49 / 32, measure: 'spoon', storePackage: fixedPackage(32, 3.49, 'jar', 'jars', '16 oz') },
  { pattern: /rice cake|tortilla/i, label: 'Rice cakes or tortillas', unit: 'each', singular: 'piece', plural: 'pieces', price: 2.99 / 8, measure: 'each', storePackage: fixedPackage(8, 2.99, 'pack', 'packs', '8 ct') },
  { pattern: /lettuce|romaine/i, label: 'Lettuce or romaine', unit: 'cup', price: 3.49 / 6, measure: 'cup', ouncesPerUnit: 1.5, defaultCups: 1, storePackage: fixedPackage(6, 3.49, 'bag', 'bags', '~6 cups') },
  { pattern: /cucumber/i, label: 'Cucumber', unit: 'cup', price: 0.99 / 1.5, measure: 'cup', ouncesPerUnit: 4, defaultCups: 0.5, storePackage: fixedPackage(1.5, 0.99, 'cucumber', 'cucumbers', '~1 cucumber') },
  { pattern: /tomato/i, label: 'Tomatoes', unit: 'cup', price: 2.99 / 3.2, measure: 'cup', ouncesPerUnit: 5, defaultCups: 0.5, storePackage: fixedPackage(3.2, 2.99, 'lb', 'lb', '~1 lb') },
  { pattern: /black beans|beans/i, label: 'Beans', unit: 'cup', price: 1.39 / 1.5, measure: 'cup', ouncesPerUnit: 6, defaultCups: 0.5, storePackage: fixedPackage(1.5, 1.39, 'can', 'cans', '15 oz') },
  { pattern: /corn/i, label: 'Corn', unit: 'cup', price: 1.19 / 1.75, measure: 'cup', ouncesPerUnit: 5, defaultCups: 0.33, storePackage: fixedPackage(1.75, 1.19, 'can', 'cans', '15 oz') },
  { pattern: /cheese/i, label: 'Reduced-fat cheese', unit: 'cup', price: 3.49 / 2, measure: 'cup', ouncesPerUnit: 4, defaultCups: 0.06, storePackage: fixedPackage(2, 3.49, 'bag', 'bags', '8 oz') },
  { pattern: /zucchini|green beans|asparagus/i, label: 'Green vegetables', unit: 'cup', price: 3.49 / 4, measure: 'cup', ouncesPerUnit: 4, defaultCups: 1, storePackage: fixedPackage(4, 3.49, 'bag', 'bags', '1 lb') },
  { pattern: /cauliflower rice/i, label: 'Cauliflower rice', unit: 'cup', price: 2.49 / 3, measure: 'cup', ouncesPerUnit: 4, defaultCups: 1, storePackage: fixedPackage(3, 2.49, 'bag', 'bags', '12 oz') },
  { pattern: /mixed vegetables|peppers|onions/i, label: 'Mixed vegetables', unit: 'cup', price: 1.49 / 4, measure: 'cup', ouncesPerUnit: 4, defaultCups: 1, storePackage: fixedPackage(4, 1.49, 'bag', 'bags', '1 lb') },
  { pattern: /rice|farro|quinoa|pasta|potatoes|potato/i, label: 'Rice, pasta, grains, or potatoes', unit: 'cup', price: 2.29 / 6, measure: 'cup', ouncesPerUnit: 5.5, defaultCups: 0.5, storePackage: fixedPackage(6, 2.29, 'package', 'packages', '1 lb dry') },
  { pattern: /berries|apple|fruit/i, label: 'Fruit', unit: 'cup', price: 4.49 / 3, measure: 'cup', ouncesPerUnit: 5, defaultCups: 1, storePackage: fixedPackage(3, 4.49, 'pack', 'packs', '~1 lb') },
  { pattern: /lime juice/i, label: 'Limes', unit: 'tbsp', price: 0.69 / 2, measure: 'spoon', storePackage: fixedPackage(2, 0.69, 'lime', 'limes', '~2 tbsp juice') },
  { pattern: /lemon juice/i, label: 'Lemons', unit: 'tbsp', price: 0.79 / 3, measure: 'spoon', storePackage: fixedPackage(3, 0.79, 'lemon', 'lemons', '~3 tbsp juice') },
  { pattern: /hot sauce/i, label: 'Hot sauce', unit: 'tbsp', price: 3.49 / 32, measure: 'spoon', storePackage: fixedPackage(32, 3.49, 'bottle', 'bottles', '16 oz') },
  { pattern: /teriyaki/i, label: 'Teriyaki sauce', unit: 'tbsp', price: 3.99 / 32, measure: 'spoon', storePackage: fixedPackage(32, 3.99, 'bottle', 'bottles', '16 oz') },
  { pattern: /buffalo/i, label: 'Buffalo sauce', unit: 'tbsp', price: 3.49 / 32, measure: 'spoon', storePackage: fixedPackage(32, 3.49, 'bottle', 'bottles', '16 oz') },
  { pattern: /ranch|dressing/i, label: 'Light dressing', unit: 'tbsp', price: 3.99 / 32, measure: 'spoon', storePackage: fixedPackage(32, 3.99, 'bottle', 'bottles', '16 oz') },
  { pattern: /pesto/i, label: 'Light pesto', unit: 'tbsp', price: 4.49 / 12, measure: 'spoon', storePackage: fixedPackage(12, 4.49, 'jar', 'jars', '6 oz') },
  { pattern: /dip|syrup|light sauce/i, label: 'Light sauce or dip', unit: 'tbsp', price: 3.49 / 32, measure: 'spoon', storePackage: fixedPackage(32, 3.49, 'bottle', 'bottles', '16 oz') },
  { pattern: /chili powder/i, label: 'Chili powder', unit: 'tsp', price: 2.49 / 60, measure: 'spoon', storePackage: fixedPackage(60, 2.49, 'jar', 'jars', '~3 oz') },
  { pattern: /smoked paprika|paprika/i, label: 'Paprika', unit: 'tsp', price: 2.99 / 60, measure: 'spoon', storePackage: fixedPackage(60, 2.99, 'jar', 'jars', '~3 oz') },
  { pattern: /garlic powder/i, label: 'Garlic powder', unit: 'tsp', price: 2.49 / 70, measure: 'spoon', storePackage: fixedPackage(70, 2.49, 'jar', 'jars', '~3 oz') },
  { pattern: /onion powder/i, label: 'Onion powder', unit: 'tsp', price: 2.49 / 70, measure: 'spoon', storePackage: fixedPackage(70, 2.49, 'jar', 'jars', '~3 oz') },
  { pattern: /red pepper flakes/i, label: 'Red pepper flakes', unit: 'tsp', price: 2.99 / 60, measure: 'spoon', storePackage: fixedPackage(60, 2.99, 'jar', 'jars', '~2.5 oz') },
  { pattern: /italian seasoning/i, label: 'Italian seasoning', unit: 'tsp', price: 2.99 / 60, measure: 'spoon', storePackage: fixedPackage(60, 2.99, 'jar', 'jars', '~1 oz') },
  { pattern: /everything seasoning/i, label: 'Everything seasoning', unit: 'tsp', price: 3.49 / 60, measure: 'spoon', storePackage: fixedPackage(60, 3.49, 'jar', 'jars', '~3 oz') },
  { pattern: /dried parsley|parsley/i, label: 'Dried parsley', unit: 'tsp', price: 2.49 / 45, measure: 'spoon', storePackage: fixedPackage(45, 2.49, 'jar', 'jars', '~0.5 oz') },
  { pattern: /taco seasoning/i, label: 'Taco seasoning', unit: 'tsp', price: 0.89 / 6, measure: 'spoon', storePackage: fixedPackage(6, 0.89, 'packet', 'packets', '1 oz') },
  { pattern: /cinnamon/i, label: 'Cinnamon', unit: 'tsp', price: 2.49 / 70, measure: 'spoon', storePackage: fixedPackage(70, 2.49, 'jar', 'jars', '~2.5 oz') },
  { pattern: /black pepper|pepper/i, label: 'Black pepper', unit: 'tsp', price: 2.99 / 60, measure: 'spoon', storePackage: fixedPackage(60, 2.99, 'jar', 'jars', '~3 oz') },
  { pattern: /kosher salt|salt/i, label: 'Kosher salt', unit: 'tsp', price: 1.49 / 96, measure: 'spoon', storePackage: fixedPackage(96, 1.49, 'box', 'boxes', '26 oz') }
];

export function attachGroceryEstimate(plan, preferences = plan.preferences || {}) {
  const normalizedPlan = normalizePlanNutrition(plan, preferences);
  const planWithMealCosts = attachMealCostEstimates(normalizedPlan, preferences);
  const groceryEstimate = estimateGroceryCost(planWithMealCosts, preferences);
  return {
    ...planWithMealCosts,
    preferences: {
      ...(planWithMealCosts.preferences || {}),
      ...preferences
    },
    groceryEstimate
  };
}

export function attachMealCostEstimates(plan, preferences = {}) {
  return {
    ...plan,
    days: (plan.days || []).map((day) => ({
      ...day,
      meals: (day.meals || []).map((meal) => ({
        ...meal,
        estimatedCost: estimateSingleMealCost(meal, preferences)
      }))
    })),
    recipeLibrary: (plan.recipeLibrary || []).map((meal) => ({
      ...meal,
      estimatedCost: estimateSingleMealCost(meal, preferences)
    }))
  };
}

export function buildSelectedMealPlan(plan, selectedMealIds = []) {
  const selected = new Set(selectedMealIds);
  const hasExplicitSelection = selected.size > 0;
  const days = (plan.days || [])
    .map((day) => {
      const meals = (day.meals || []).filter((meal) => !hasExplicitSelection || selected.has(meal.id));
      return {
        ...day,
        meals,
        totals: sumMacros(meals.map((meal) => meal.macros || {}))
      };
    })
    .filter((day) => day.meals.length > 0);

  const totals = sumMacros(days.flatMap((day) => day.meals.map((meal) => meal.macros || {})));
  const totalMeals = days.reduce((count, day) => count + day.meals.length, 0);
  const dayCount = Math.max(1, days.length);
  const shoppingMap = new Map();

  for (const day of days) {
    for (const meal of day.meals) {
      for (const ingredient of meal.ingredients || []) {
        shoppingMap.set(String(ingredient).toLowerCase(), ingredient);
      }
    }
  }

  return {
    ...plan,
    title: `${totalMeals}-Meal CutPlate Menu`,
    days,
    shoppingList: Array.from(shoppingMap.values()).slice(0, 80),
    summary: {
      ...(plan.summary || {}),
      days: days.length,
      mealsPerDay: Math.round((totalMeals / dayCount) * 10) / 10,
      totalMeals,
      averageCalories: Math.round(totals.calories / dayCount),
      averageProtein: Math.round(totals.protein / dayCount),
      averageCarbs: Math.round(totals.carbs / dayCount),
      averageFat: Math.round(totals.fat / dayCount)
    }
  };
}

export function buildAssignedMealPlan(plan, assignments = []) {
  const daysByNumber = new Map();

  for (const assignment of assignments) {
    if (!assignment?.meal || !assignment.dayNumber) continue;

    const dayNumber = Number(assignment.dayNumber);
    const existing = daysByNumber.get(dayNumber) || {
      dayNumber,
      label: `Day ${dayNumber}`,
      meals: []
    };

    existing.meals.push({
      ...assignment.meal,
      id: `${dayNumber}-${assignment.slotKey || assignment.meal.id}`,
      mealType: assignment.mealType || assignment.meal.mealType,
      time: assignment.time || assignment.meal.time
    });
    daysByNumber.set(dayNumber, existing);
  }

  const days = Array.from(daysByNumber.values())
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .map((day) => ({
      ...day,
      totals: sumMacros(day.meals.map((meal) => meal.macros || {}))
    }));

  const totals = sumMacros(days.flatMap((day) => day.meals.map((meal) => meal.macros || {})));
  const totalMeals = days.reduce((count, day) => count + day.meals.length, 0);
  const dayCount = Math.max(1, days.length);
  const shoppingMap = new Map();

  for (const day of days) {
    for (const meal of day.meals) {
      for (const ingredient of meal.ingredients || []) {
        shoppingMap.set(String(ingredient).toLowerCase(), ingredient);
      }
    }
  }

  return {
    ...plan,
    title: `${totalMeals}-Meal CutPlate Menu`,
    days,
    shoppingList: Array.from(shoppingMap.values()).slice(0, 80),
    summary: {
      ...(plan.summary || {}),
      days: days.length,
      mealsPerDay: Math.round((totalMeals / dayCount) * 10) / 10,
      totalMeals,
      averageCalories: Math.round(totals.calories / dayCount),
      averageProtein: Math.round(totals.protein / dayCount),
      averageCarbs: Math.round(totals.carbs / dayCount),
      averageFat: Math.round(totals.fat / dayCount)
    }
  };
}

export function estimateGroceryCost(plan, preferences = {}) {
  const servings = clamp(Number(preferences.servingsPerMeal || plan.preferences?.servingsPerMeal || 2), 1, 12);
  const location = String(preferences.location || plan.preferences?.location || '').trim();
  const multiplier = getLocationMultiplier(location);
  const items = collectPricedItems(plan, servings);
  const lineItems = buildLineItems(items, multiplier);

  const subtotal = lineItems.reduce((total, item) => total + item.estimatedCost, 0);
  const pantryBuffer = subtotal > 0 ? Math.max(3, subtotal * 0.07) : 0;
  const estimatedTotal = roundMoney(subtotal + pantryBuffer);

  return {
    location: location || 'national average',
    regionalMultiplier: Math.round(multiplier * 100) / 100,
    estimatedTotal,
    rangeLow: roundMoney(estimatedTotal * 0.85),
    rangeHigh: roundMoney(estimatedTotal * 1.18),
    pantryBuffer: roundMoney(pantryBuffer),
    lineItems,
    note:
      'Estimated from generated ingredients, servings, store-style package sizes, and a regional grocery multiplier. Exact prices vary by store, brand, season, and sale pricing.'
  };
}

export function estimateSelectionPricing({ selectedMeals = [], optionMeals = [], preferences = {} } = {}) {
  const selectedPlan = buildSelectionPricingPlan(selectedMeals, preferences);
  const selectedEstimate = estimateGroceryCost(selectedPlan, preferences);
  const selectedTotal = roundMoney(selectedMeals.length > 0 ? selectedEstimate.estimatedTotal : 0);
  const selectedKeys = new Set(selectedMeals.map((meal) => getMealOptionKey(meal)));
  const marginalCosts = {};

  for (const meal of optionMeals) {
    const optionKey = getMealOptionKey(meal);
    if (!optionKey) continue;

    if (selectedKeys.has(optionKey)) {
      marginalCosts[optionKey] = {
        selected: true,
        addCost: 0,
        totalIfSelected: selectedTotal
      };
      continue;
    }

    const optionEstimate = estimateGroceryCost(
      buildSelectionPricingPlan([...selectedMeals, meal], preferences),
      preferences
    );
    const totalIfSelected = roundMoney(optionEstimate.estimatedTotal);

    marginalCosts[optionKey] = {
      selected: false,
      addCost: Math.max(0, roundMoney(totalIfSelected - selectedTotal)),
      totalIfSelected
    };
  }

  return {
    selectedTotal,
    selectedEstimate: {
      ...selectedEstimate,
      estimatedTotal: selectedTotal
    },
    marginalCosts
  };
}

function buildSelectionPricingPlan(meals, preferences) {
  return {
    preferences,
    days: [
      {
        dayNumber: 1,
        label: 'Selected menu',
        meals: meals.map((meal, index) => ({
          ...meal,
          id: getMealOptionKey(meal) || `selected-${index}`
        }))
      }
    ]
  };
}

function getMealOptionKey(meal = {}) {
  return meal.optionKey || meal.id || '';
}

function collectPricedItems(plan, servings) {
  const items = new Map();

  for (const day of plan.days || []) {
    for (const meal of day.meals || []) {
      for (const ingredient of meal.ingredients || []) {
        for (const pricedIngredient of expandIngredientForPricing(ingredient)) {
          const rule = findPriceRule(pricedIngredient);
          const key = rule.label.toLowerCase();
          const current = items.get(key) || {
            name: rule.label,
            unit: rule.unit,
            singular: rule.singular,
            plural: rule.plural,
            ouncesPerUnit: rule.ouncesPerUnit,
            price: rule.price,
            storePackage: rule.storePackage,
            quantity: 0,
            ounces: 0,
            costUnits: 0
          };
          const measurement = measureIngredient(pricedIngredient, rule, servings);

          current.quantity += measurement.quantity;
          current.ounces += measurement.ounces;
          current.costUnits += measurement.costUnits;
          items.set(key, current);
        }
      }
    }
  }

  return items;
}

function buildLineItems(items, multiplier) {
  return Array.from(items.values())
    .map((item) => finalizeLineItem(item, multiplier))
    .sort((a, b) => b.estimatedCost - a.estimatedCost);
}

function finalizeLineItem(item, multiplier) {
  const roundedItem = {
    ...item,
    quantity: Math.round(item.quantity * 10) / 10,
    ounces: Math.round(item.ounces * 10) / 10,
    costUnits: Math.round(item.costUnits * 10) / 10
  };
  const packaged = priceStorePackage(roundedItem, multiplier);

  return {
    ...roundedItem,
    purchaseQuantity: packaged.purchaseQuantity,
    quantityLabel: packaged.quantityLabel,
    estimatedCost: packaged.estimatedCost
  };
}

function findPriceRule(ingredient = '') {
  return PRICE_RULES.find((rule) => rule.pattern.test(ingredient)) || {
    label: normalizeFallbackName(ingredient),
    unit: 'item',
    price: 0.45,
    measure: 'portion'
  };
}

function expandIngredientForPricing(ingredient = '') {
  const text = String(ingredient || '').trim();
  const lower = text.toLowerCase();
  const expanded = [];

  if (/lime/.test(lower) && !/lime juice/.test(lower)) expanded.push('1 tbsp lime juice');
  if (/lemon/.test(lower) && !/lemon juice/.test(lower)) expanded.push('1 tbsp lemon juice');
  if (/chili/.test(lower) && !/chili powder/.test(lower)) expanded.push('1/2 tsp chili powder');
  if (/smoked paprika|paprika/.test(lower) && !/^\d/.test(lower)) expanded.push('1/2 tsp paprika');
  if (/garlic/.test(lower) && !/garlic powder/.test(lower)) expanded.push('1/2 tsp garlic powder');
  if (/onion powder/.test(lower) && !/^\d/.test(lower)) expanded.push('1/2 tsp onion powder');
  if (/red pepper/.test(lower) && !/^\d/.test(lower)) expanded.push('1/4 tsp red pepper flakes');
  if (/black pepper|pepper/.test(lower) && !/^\d/.test(lower)) expanded.push('1/4 tsp black pepper');
  if (/salt/.test(lower) && !/^\d/.test(lower)) expanded.push('1/4 tsp kosher salt');
  if (/cinnamon/.test(lower) && !/^\d/.test(lower)) expanded.push('1/2 tsp cinnamon');
  if (/hot sauce/.test(lower) && !/^\d/.test(lower)) expanded.push('1 tbsp hot sauce');
  if (/pico/.test(lower) && !/^\d/.test(lower)) expanded.push('1 tbsp salsa');
  if (/everything seasoning/.test(lower) && !/^\d/.test(lower)) expanded.push('1/2 tsp everything seasoning');

  return expanded.length ? expanded : [text];
}

function measureIngredient(ingredient, rule, servings) {
  const parsed = parseIngredientAmount(ingredient);
  const amount = parsed.amount || 1;

  if (rule.measure === 'servingEach') {
    if (parsed.unit === 'oz' || parsed.unit === 'lb') {
      const ounces = parsed.unit === 'lb' ? amount * 16 : amount;
      const quantity = ounces / Number(rule.ouncesPerUnit || 1);
      return {
        quantity,
        ounces,
        costUnits: quantity
      };
    }

    const quantity = amount * servings;
    return {
      quantity,
      ounces: quantity * Number(rule.ouncesPerUnit || 0),
      costUnits: quantity
    };
  }

  if (rule.measure === 'servingOunces') {
    if (parsed.unit === 'oz' || parsed.unit === 'lb') {
      const quantity = parsed.unit === 'lb' ? amount * 16 : amount;
      return {
        quantity,
        ounces: quantity,
        costUnits: quantity
      };
    }

    const quantity = amount * servings * Number(rule.ouncesPerServing || 6);
    return {
      quantity,
      ounces: quantity,
      costUnits: quantity
    };
  }

  if (rule.measure === 'cup') {
    const quantity = convertToCups(amount, parsed.unit, rule.defaultCups || 1) * servings;
    return {
      quantity,
      ounces: quantity * Number(rule.ouncesPerUnit || 0),
      costUnits: quantity
    };
  }

  if (rule.measure === 'spoon') {
    const quantity = convertToSpoons(amount, parsed.unit, rule.unit) * servings;
    return {
      quantity,
      ounces: 0,
      costUnits: quantity
    };
  }

  if (rule.measure === 'each') {
    const quantity = amount * servings;
    return {
      quantity,
      ounces: quantity * Number(rule.ouncesPerUnit || 0),
      costUnits: quantity
    };
  }

  if (rule.measure === 'recipeUse') {
    return {
      quantity: 1,
      ounces: 0,
      costUnits: servings
    };
  }

  const quantity = amount * servings;
  return {
    quantity,
    ounces: 0,
    costUnits: quantity
  };
}

function parseIngredientAmount(ingredient = '') {
  const text = String(ingredient || '').trim().toLowerCase();
  const mixed = text.match(/^(\d+)\s+(\d+)\/(\d+)\s+(.+)$/);
  if (mixed) {
    return {
      amount: Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]),
      unit: parseUnit(mixed[4])
    };
  }

  const fraction = text.match(/^(\d+)\/(\d+)\s+(.+)$/);
  if (fraction) {
    return {
      amount: Number(fraction[1]) / Number(fraction[2]),
      unit: parseUnit(fraction[3])
    };
  }

  const decimal = text.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
  if (decimal) {
    return {
      amount: Number(decimal[1]),
      unit: parseUnit(decimal[2])
    };
  }

  return { amount: 1, unit: parseUnit(text) };
}

function parseUnit(text = '') {
  if (/snack serving|serving/.test(text)) return 'serving';
  if (/\bcups?\b/.test(text)) return 'cup';
  if (/\btbsp\b|tablespoons?/.test(text)) return 'tbsp';
  if (/\btsp\b|teaspoons?/.test(text)) return 'tsp';
  if (/\boz\b|ounces?/.test(text)) return 'oz';
  if (/\blb\b|pounds?/.test(text)) return 'lb';
  return 'each';
}

function convertToCups(amount, unit, defaultCups) {
  if (unit === 'cup') return amount;
  if (unit === 'tbsp') return amount / 16;
  if (unit === 'tsp') return amount / 48;
  if (unit === 'oz') return amount / 8;
  if (unit === 'lb') return amount * 2;
  if (unit === 'serving') return amount * defaultCups;
  return amount * defaultCups;
}

function convertToSpoons(amount, unit, targetUnit) {
  const teaspoons = unit === 'cup'
    ? amount * 48
    : unit === 'tbsp'
      ? amount * 3
      : unit === 'oz'
        ? amount * 6
        : unit === 'tsp'
          ? amount
          : amount;

  return targetUnit === 'tbsp' ? teaspoons / 3 : teaspoons;
}

function priceStorePackage(item, multiplier) {
  const storePackage = item.storePackage;
  if (!storePackage) {
    return {
      purchaseQuantity: item.quantity,
      quantityLabel: formatQuantityLabel(item),
      estimatedCost: roundMoney(item.costUnits * Number(item.price || 0) * multiplier)
    };
  }

  if (storePackage.type === 'weight') {
    const needed = Math.max(0, Number(item.costUnits || item.quantity || 0));
    const purchaseQuantity = roundUpTo(Math.max(needed, storePackage.min || 0), storePackage.increment || 1);
    return {
      purchaseQuantity,
      quantityLabel: `${formatNeededAmount({ ...item, costUnits: purchaseQuantity })} ${storePackage.label || 'package'} (need ${formatNeededAmount(item)})`,
      estimatedCost: roundMoney(purchaseQuantity * Number(item.price || 0) * multiplier)
    };
  }

  const needed = Math.max(0, Number(item.costUnits || item.quantity || 0));
  const packageCount = Math.max(1, Math.ceil(needed / Number(storePackage.size || 1)));
  const container = packageCount === 1 ? storePackage.singular : storePackage.plural;
  const size = storePackage.sizeLabel ? `${storePackage.sizeLabel}; ` : '';

  return {
    purchaseQuantity: packageCount,
    quantityLabel: `${packageCount} ${container} (${size}need ${formatNeededAmount(item)})`,
    estimatedCost: roundMoney(packageCount * Number(storePackage.price || 0) * multiplier)
  };
}

function formatQuantityLabel(item) {
  const quantity = item.quantity;
  const rounded = formatNumber(quantity);

  if (item.unit === 'each') {
    const displayQuantity = Math.ceil(quantity);
    const unit = displayQuantity === 1 ? item.singular || 'item' : item.plural || pluralize(item.singular || 'item', displayQuantity);
    const ounces = item.ounces > 0 ? ` (~${formatNumber(item.ounces)} oz)` : '';
    return `${displayQuantity} ${unit}${ounces}`;
  }

  if (item.unit === 'oz') {
    const pounds = quantity >= 16 ? ` (${formatNumber(quantity / 16)} lb)` : '';
    return `${rounded} oz${pounds}`;
  }

  if (item.unit === 'cup') {
    const ounces = item.ounces > 0 ? ` (~${formatNumber(item.ounces)} oz)` : '';
    return `${rounded} ${pluralize('cup', quantity)}${ounces}`;
  }

  if (item.unit === 'tbsp' || item.unit === 'tsp') {
    return `${rounded} ${item.unit}`;
  }

  if (item.unit === 'use') {
    return `${rounded} recipe ${pluralize('use', quantity)}`;
  }

  return `${rounded} ${pluralize(item.unit, quantity)}`;
}

function formatNeededAmount(item) {
  const unit = item.unit;
  const value = Number(item.costUnits || item.quantity || 0);

  if (unit === 'oz') {
    if (value >= 16) return `~${formatNumber(value / 16)} lb`;
    return `~${formatNumber(value)} oz`;
  }

  if (unit === 'cup') return `${formatNumber(value)} ${pluralize('cup', value)}`;
  if (unit === 'tbsp' || unit === 'tsp') return `${formatNumber(value)} ${unit}`;
  if (unit === 'portion') return `${formatNumber(value)} ${pluralize('portion', value)}`;
  if (unit === 'each') return `${formatNumber(value)} ${pluralize('item', value)}`;

  return `${formatNumber(value)} ${pluralize(unit || 'unit', value)}`;
}

function fixedPackage(size, price, singular, plural, sizeLabel) {
  return {
    type: 'fixed',
    size,
    price,
    singular,
    plural,
    sizeLabel
  };
}

function weightPackage(min, increment, label) {
  return {
    type: 'weight',
    min,
    increment,
    label
  };
}

function roundUpTo(value, increment) {
  const normalizedIncrement = Number(increment || 1);
  return Math.ceil(Number(value || 0) / normalizedIncrement) * normalizedIncrement;
}

function formatNumber(value) {
  const rounded = Math.round(Number(value || 0) * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function getLocationMultiplier(location) {
  const normalized = String(location || '').trim();
  const zip = normalized.match(/\b\d{5}\b/)?.[0];
  if (zip) {
    const zipMatch = ZIP_MULTIPLIERS.find((entry) => entry.pattern.test(zip));
    if (zipMatch) return zipMatch.multiplier;
  }

  const locationMatch = LOCATION_MULTIPLIERS.find((entry) => entry.pattern.test(normalized));
  return locationMatch?.multiplier || 1;
}

function normalizeFallbackName(value) {
  return String(value || 'Pantry item')
    .replace(/^\d+(\.\d+)?\s*/g, '')
    .replace(/^(\/\d+|cup|cups|tbsp|tsp|serving|snack serving|light)\s+/i, '')
    .trim() || 'Pantry item';
}

function pluralize(unit, count) {
  if (Math.abs(count - 1) < 0.01) return unit;
  if (unit.endsWith('s')) return unit;
  return `${unit}s`;
}

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function estimateSingleMealCost(meal, preferences = {}) {
  const servings = clamp(Number(preferences.servingsPerMeal || 2), 1, 12);
  const location = String(preferences.location || '').trim();
  const multiplier = getLocationMultiplier(location);
  const items = collectPricedItems({ days: [{ meals: [meal] }] }, servings);
  const subtotal = buildLineItems(items, multiplier).reduce((total, item) => total + item.estimatedCost, 0);

  return roundMoney(subtotal);
}

function normalizePlanNutrition(plan, preferences = {}) {
  return {
    ...plan,
    days: (plan.days || []).map((day) => {
      const meals = (day.meals || []).map((meal) => normalizeMealNutrition(meal, preferences));
      return {
        ...day,
        meals,
        totals: sumMacros(meals.map((meal) => meal.macros || {}))
      };
    }),
    recipeLibrary: (plan.recipeLibrary || []).map((meal) => normalizeMealNutrition(meal, preferences))
  };
}

function normalizeMealNutrition(meal, preferences = {}) {
  const macros = meal.macros || {};
  const calories = Number(macros.calories || 0);
  if (!calories) return meal;

  const servings = clamp(Number(preferences.servingsPerMeal || 1), 1, 12);
  const maxByType = {
    Breakfast: 650,
    Lunch: 750,
    Dinner: 820,
    Snack: 380
  };
  const max = maxByType[meal.mealType] || 750;
  const looksLikeRecipeTotal = servings > 1 && calories > max;
  const divisor = looksLikeRecipeTotal ? servings : 1;
  const divided = {
    calories: Math.round(Number(macros.calories || 0) / divisor),
    protein: Math.round(Number(macros.protein || 0) / divisor),
    carbs: Math.round(Number(macros.carbs || 0) / divisor),
    fat: Math.round(Number(macros.fat || 0) / divisor)
  };

  if (divided.calories <= max * 1.15) {
    return {
      ...meal,
      macros: divided
    };
  }

  const scale = max / divided.calories;
  return {
    ...meal,
    macros: {
      calories: Math.round(divided.calories * scale),
      protein: Math.max(1, Math.round(divided.protein * scale)),
      carbs: Math.max(0, Math.round(divided.carbs * scale)),
      fat: Math.max(0, Math.round(divided.fat * scale))
    }
  };
}

function sumMacros(macrosList) {
  return macrosList.reduce(
    (total, macros) => ({
      calories: total.calories + Number(macros.calories || 0),
      protein: total.protein + Number(macros.protein || 0),
      carbs: total.carbs + Number(macros.carbs || 0),
      fat: total.fat + Number(macros.fat || 0)
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}
