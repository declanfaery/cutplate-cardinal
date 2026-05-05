const DEFAULT_TIME = {
  Breakfast: '8:00 AM',
  Lunch: '12:30 PM',
  Dinner: '6:30 PM',
  Snack: '3:30 PM'
};

export const SAVED_RECIPES = [
  {
    id: 'saved-buffalo-chicken-hot-pockets',
    name: 'Buffalo Chicken Hot Pockets',
    mealTypes: ['Lunch', 'Dinner'],
    protein: 'Chicken Breast',
    sourceFolder: 'Buffalo Chicken Hot Pocket',
    description: 'Freezer-friendly buffalo chicken pockets with a high-protein dough and creamy buffalo filling.',
    macroRating: 'SUPER FIT',
    prepTime: '45 minutes',
    baseServings: 10,
    macros: { calories: 425, protein: 50, carbs: 44, fat: 4 },
    ingredients: [
      '500 g self-rising flour',
      '520 g plain nonfat Greek yogurt',
      '1 tbsp garlic salt',
      '1 tbsp Italian seasoning',
      '40 oz chicken breast',
      '1/2 tbsp garlic salt',
      '1/2 tbsp smoked paprika',
      '2 tbsp ranch seasoning',
      '1/2 tbsp black pepper',
      '4 tbsp tomato salsa',
      '1 cup diced white onion',
      '1/2 cup buffalo sauce for filling',
      '3 1/2 cups fat-free mozzarella',
      '10 g fresh chives',
      '1 1/2 cups low-fat cottage cheese',
      '2 oz 1/3-fat cream cheese',
      '1/2 tbsp garlic salt',
      '1/2 tbsp black pepper',
      '1/2 tbsp onion powder',
      '1/2 cup buffalo sauce for sauce',
      '1/4 cup fat-free milk'
    ],
    steps: [
      'Mix the flour, Greek yogurt, garlic salt, and Italian seasoning until a soft dough forms.',
      'Cook and shred the chicken breast, then season it with smoked paprika, ranch seasoning, black pepper, salsa, onion, buffalo sauce, mozzarella, and chives.',
      'Blend cottage cheese, cream cheese, garlic salt, black pepper, onion powder, buffalo sauce, and fat-free milk into a smooth high-protein buffalo sauce.',
      'Divide the dough into 10 portions, flatten each piece, fill with buffalo chicken, and seal tightly.',
      'Air fry at 375 F for 8-10 minutes, or bake at 400 F for 14-18 minutes, until browned and cooked through.',
      'Freeze wrapped portions for up to 1 month. Reheat from frozen by microwaving 3-4 minutes in a damp paper towel, then air fry or pan-toast until crisp.'
    ]
  },
  {
    id: 'saved-breakfast-burrito',
    name: 'High-Protein Breakfast Burrito',
    mealTypes: ['Breakfast'],
    protein: 'Eggs and Chicken Sausage',
    sourceFolder: 'Breakfast Burrito',
    description: 'A filling breakfast burrito with eggs, lean breakfast protein, potatoes, cheese, and salsa.',
    macroRating: 'FIT',
    prepTime: '30 minutes',
    baseServings: 4,
    macros: { calories: 520, protein: 42, carbs: 48, fat: 16 },
    ingredients: [
      '4 large high-fiber tortillas',
      '8 large eggs',
      '1 cup egg whites',
      '12 oz cooked chicken sausage or lean turkey sausage',
      '2 cups diced potatoes',
      '1 cup reduced-fat shredded cheddar',
      '1/2 cup salsa',
      '1/2 cup diced onion',
      '1/2 cup diced bell pepper',
      '1 tsp garlic powder',
      '1 tsp smoked paprika',
      '1/2 tsp kosher salt',
      '1/2 tsp black pepper'
    ],
    steps: [
      'Roast or air fry the diced potatoes at 400 F until tender and browned.',
      'Brown the sausage with onion and bell pepper in a skillet.',
      'Scramble the eggs and egg whites with garlic powder, smoked paprika, salt, and pepper.',
      'Fill each tortilla with potatoes, sausage, eggs, cheese, and salsa.',
      'Fold tightly and toast seam-side down in a skillet until crisp. Wrap and refrigerate for grab-and-go breakfasts.'
    ]
  },
  {
    id: 'saved-chicken-taco-bake',
    name: 'Chicken Taco Bake',
    mealTypes: ['Lunch', 'Dinner'],
    protein: 'Chicken Breast',
    sourceFolder: 'Chicken Tacos',
    description: 'A high-protein taco-style bake with chicken, tortillas, beans, salsa, and a light cheese finish.',
    macroRating: 'SUPER FIT',
    prepTime: '40 minutes',
    baseServings: 6,
    macros: { calories: 510, protein: 48, carbs: 42, fat: 14 },
    ingredients: [
      '2 lb chicken breast',
      '6 high-fiber tortillas, cut into strips',
      '1 can black beans, drained',
      '1 cup corn',
      '1 1/2 cups salsa',
      '1 cup reduced-fat Mexican cheese',
      '1 cup plain nonfat Greek yogurt',
      '2 tbsp taco seasoning',
      '1 tsp garlic powder',
      '1 tsp cumin',
      '1/2 tsp smoked paprika',
      '1/2 tsp kosher salt',
      '1/2 tsp black pepper'
    ],
    steps: [
      'Cook and shred the chicken breast, then season with taco seasoning, garlic powder, cumin, smoked paprika, salt, and pepper.',
      'Heat the oven to 375 F and spray a baking dish.',
      'Layer tortilla strips, seasoned chicken, beans, corn, salsa, Greek yogurt, and cheese.',
      'Bake for 20-25 minutes until bubbling and lightly browned.',
      'Rest 5 minutes before slicing into meal-prep portions.'
    ]
  },
  {
    id: 'saved-protein-crepes',
    name: 'Protein Crepes',
    mealTypes: ['Breakfast', 'Snack'],
    protein: 'Greek Yogurt',
    sourceFolder: 'Crepes',
    description: 'Thin protein crepes filled with yogurt and berries for a sweet high-protein breakfast.',
    macroRating: 'FIT',
    prepTime: '20 minutes',
    baseServings: 2,
    macros: { calories: 390, protein: 36, carbs: 42, fat: 8 },
    ingredients: [
      '1 cup egg whites',
      '1 scoop vanilla protein powder',
      '1/2 cup all-purpose flour',
      '1/2 cup unsweetened almond milk',
      '1 cup plain nonfat Greek yogurt',
      '1 cup berries',
      '1 tbsp honey',
      '1 tsp vanilla extract',
      '1/2 tsp cinnamon',
      '1/4 tsp kosher salt'
    ],
    steps: [
      'Whisk egg whites, protein powder, flour, almond milk, vanilla, cinnamon, and salt until smooth.',
      'Cook thin crepes in a lightly sprayed nonstick skillet over medium heat.',
      'Stir Greek yogurt with honey.',
      'Fill crepes with yogurt and berries, then fold or roll.',
      'Serve cold or warm gently in a pan for 30 seconds per side.'
    ]
  },
  {
    id: 'saved-garlic-pizza',
    name: 'Garlic Protein Pizza',
    mealTypes: ['Lunch', 'Dinner'],
    protein: 'Chicken Breast',
    sourceFolder: 'Garlic Pizza',
    description: 'A light garlic pizza with protein dough, chicken, reduced-fat cheese, and measured seasonings.',
    macroRating: 'FIT',
    prepTime: '35 minutes',
    baseServings: 2,
    macros: { calories: 500, protein: 45, carbs: 50, fat: 12 },
    ingredients: [
      '1 cup self-rising flour',
      '1 cup plain nonfat Greek yogurt',
      '8 oz cooked chicken breast, diced',
      '1 cup reduced-fat mozzarella',
      '2 tbsp grated parmesan',
      '2 tbsp light garlic butter or garlic sauce',
      '1 tsp minced garlic',
      '1 tsp Italian seasoning',
      '1/2 tsp garlic powder',
      '1/4 tsp kosher salt',
      '1/4 tsp black pepper'
    ],
    steps: [
      'Heat the oven to 425 F.',
      'Mix self-rising flour and Greek yogurt into a dough, then roll into a thin pizza crust.',
      'Par-bake the crust for 7 minutes.',
      'Spread garlic sauce over the crust and top with chicken, mozzarella, parmesan, minced garlic, Italian seasoning, garlic powder, salt, and pepper.',
      'Bake 10-12 minutes until the cheese melts and the crust is crisp.'
    ]
  },
  {
    id: 'saved-lemon-herb-chicken-pasta-bake',
    name: 'Lemon and Herb Chicken Pasta Bake',
    mealTypes: ['Dinner'],
    protein: 'Chicken Breast',
    sourceFolder: 'Lemon & Herb Chicken Pasta Bake',
    description: 'A bright chicken pasta bake with lemon, herbs, spinach, and a lighter creamy sauce.',
    macroRating: 'FIT',
    prepTime: '45 minutes',
    baseServings: 6,
    macros: { calories: 585, protein: 48, carbs: 62, fat: 14 },
    ingredients: [
      '1 1/2 lb chicken breast',
      '12 oz dry protein pasta',
      '2 cups spinach',
      '1 cup reduced-fat mozzarella',
      '1/2 cup plain nonfat Greek yogurt',
      '1/2 cup chicken broth',
      '2 tbsp lemon juice',
      '1 tbsp olive oil',
      '2 tsp minced garlic',
      '1 tsp dried parsley',
      '1 tsp Italian seasoning',
      '1/2 tsp kosher salt',
      '1/2 tsp black pepper'
    ],
    steps: [
      'Heat the oven to 375 F and cook pasta until just under al dente.',
      'Dice chicken and cook it in olive oil with garlic, parsley, Italian seasoning, salt, and pepper.',
      'Whisk Greek yogurt, chicken broth, and lemon juice into a light sauce.',
      'Toss pasta, chicken, spinach, sauce, and half the mozzarella in a baking dish.',
      'Top with remaining mozzarella and bake 18-22 minutes until hot and lightly browned.'
    ]
  },
  {
    id: 'saved-high-protein-yogurt-bowl',
    name: 'High-Protein Yogurt Bowl',
    mealTypes: ['Breakfast', 'Snack'],
    protein: 'Greek Yogurt',
    sourceFolder: 'High Protein Yogurt Bowl',
    description: 'A thick Greek yogurt bowl with berries, cereal crunch, honey, and cinnamon.',
    macroRating: 'SUPER FIT',
    prepTime: '5 minutes',
    baseServings: 1,
    macros: { calories: 350, protein: 38, carbs: 42, fat: 4 },
    ingredients: [
      '1 1/2 cups plain nonfat Greek yogurt',
      '1 scoop vanilla protein powder',
      '1 cup berries',
      '1/2 cup high-protein cereal',
      '1 tbsp honey',
      '1 tbsp powdered peanut butter',
      '1/2 tsp cinnamon',
      '1/4 tsp vanilla extract'
    ],
    steps: [
      'Stir Greek yogurt and protein powder until smooth.',
      'Top with berries, cereal, honey, powdered peanut butter, cinnamon, and vanilla.',
      'Serve immediately for crunch or refrigerate up to 24 hours.'
    ]
  },
  {
    id: 'saved-salmon-cucumber-salad',
    name: 'Salmon Cucumber Salad',
    mealTypes: ['Lunch', 'Dinner'],
    protein: 'Salmon',
    sourceFolder: 'Salmon Cucumber Salad',
    description: 'A chilled salmon salad with cucumber, rice, Greek yogurt dressing, lemon, and dill.',
    macroRating: 'FIT',
    prepTime: '25 minutes',
    baseServings: 2,
    macros: { calories: 430, protein: 40, carbs: 28, fat: 17 },
    ingredients: [
      '12 oz salmon fillets',
      '2 cups cucumber, sliced',
      '1 cup cooked rice',
      '1/2 cup plain nonfat Greek yogurt',
      '2 tbsp lemon juice',
      '1 tbsp low-sodium soy sauce',
      '1 tsp honey',
      '1 tsp dried dill',
      '1/2 tsp garlic powder',
      '1/4 tsp kosher salt',
      '1/4 tsp black pepper'
    ],
    steps: [
      'Season salmon with salt, pepper, and garlic powder.',
      'Bake at 400 F for 10-12 minutes, or air fry at 390 F until it flakes easily.',
      'Whisk Greek yogurt, lemon juice, soy sauce, honey, and dill into a dressing.',
      'Layer cucumber and rice, flake salmon over the top, and drizzle with dressing.',
      'Serve chilled or warm.'
    ]
  },
  {
    id: 'saved-protein-cinnamon-rolls',
    name: 'High-Protein Cinnamon Rolls',
    mealTypes: ['Breakfast', 'Snack'],
    protein: 'Greek Yogurt',
    sourceFolder: 'Protein CInnamon Buns',
    description: 'Soft cinnamon rolls made with Greek-yogurt dough and a lighter protein glaze.',
    macroRating: 'FIT',
    prepTime: '40 minutes',
    baseServings: 8,
    macros: { calories: 280, protein: 24, carbs: 36, fat: 6 },
    ingredients: [
      '2 cups self-rising flour',
      '2 cups plain nonfat Greek yogurt',
      '2 tbsp light butter, melted',
      '1/4 cup brown sugar substitute',
      '2 tbsp cinnamon',
      '1 scoop vanilla protein powder',
      '1/2 cup powdered sugar substitute',
      '3 tbsp unsweetened almond milk',
      '1 tsp vanilla extract',
      '1/4 tsp kosher salt'
    ],
    steps: [
      'Heat the oven to 375 F.',
      'Mix self-rising flour, Greek yogurt, and salt into a dough.',
      'Roll into a rectangle and brush with melted light butter.',
      'Sprinkle brown sugar substitute and cinnamon evenly over the dough, then roll and slice into 8 buns.',
      'Bake for 18-22 minutes until puffed and lightly golden.',
      'Whisk protein powder, powdered sugar substitute, almond milk, and vanilla into a glaze and spread over warm rolls.'
    ]
  },
  {
    id: 'saved-chocolate-mousse',
    name: 'High-Protein Chocolate Mousse',
    mealTypes: ['Snack'],
    protein: 'Greek Yogurt',
    sourceFolder: 'Chocolate Mousse',
    description: 'A thick chocolate mousse using Greek yogurt, protein powder, cocoa, and a little honey.',
    macroRating: 'SUPER FIT',
    prepTime: '10 minutes',
    baseServings: 2,
    macros: { calories: 240, protein: 30, carbs: 22, fat: 5 },
    ingredients: [
      '1 1/2 cups plain nonfat Greek yogurt',
      '1 scoop chocolate protein powder',
      '2 tbsp unsweetened cocoa powder',
      '1 tbsp honey',
      '1 tsp vanilla extract',
      '1/4 tsp kosher salt',
      '2 tbsp mini chocolate chips'
    ],
    steps: [
      'Whisk Greek yogurt, protein powder, cocoa powder, honey, vanilla, and salt until smooth.',
      'Chill for at least 20 minutes so the mousse thickens.',
      'Top with mini chocolate chips and serve cold.'
    ]
  },
  {
    id: 'saved-bacon-jam-slider',
    name: 'Bacon Jam Cheeseburger Slider',
    mealTypes: ['Lunch', 'Dinner'],
    protein: 'Lean Ground Beef',
    sourceFolder: 'CheeseBurger Slider',
    description: 'Mini cheeseburger sliders with lean beef, a measured bacon jam, and lighter cheese.',
    macroRating: 'FIT',
    prepTime: '30 minutes',
    baseServings: 4,
    macros: { calories: 430, protein: 35, carbs: 32, fat: 16 },
    ingredients: [
      '1 lb 96% lean ground beef',
      '4 slider buns',
      '4 slices reduced-fat cheddar',
      '4 tbsp bacon jam',
      '1/4 cup diced onion',
      '1 tbsp yellow mustard',
      '1 tbsp ketchup',
      '1 tsp Worcestershire sauce',
      '1/2 tsp garlic powder',
      '1/2 tsp kosher salt',
      '1/2 tsp black pepper'
    ],
    steps: [
      'Mix lean beef with onion, Worcestershire sauce, garlic powder, salt, and pepper.',
      'Form 4 slider patties and cook in a skillet or air fryer until they reach 160 F.',
      'Top each patty with cheddar during the final minute of cooking.',
      'Toast buns, spread mustard and ketchup, add patties, and finish each slider with 1 tbsp bacon jam.'
    ]
  },
  {
    id: 'saved-korean-fried-chicken-sandwich',
    name: 'Korean Fried Chicken Sandwich',
    mealTypes: ['Lunch', 'Dinner'],
    protein: 'Chicken Breast',
    sourceFolder: 'Korean Fried Chicken Sandwich',
    description: 'A crispy air-fried chicken sandwich with a measured honey-garlic-ginger Korean sauce.',
    macroRating: 'FIT',
    prepTime: '45 minutes',
    baseServings: 4,
    macros: { calories: 570, protein: 48, carbs: 60, fat: 12 },
    ingredients: [
      '2 lb chicken breast cutlets',
      '4 sandwich buns',
      '1 cup panko breadcrumbs',
      '1/2 cup flour',
      '1 cup egg whites',
      '1/2 cup shredded cabbage',
      '1/4 cup light mayo',
      '2 tbsp gochujang',
      '2 tbsp low-sodium soy sauce',
      '1 tbsp honey',
      '2 tsp minced garlic',
      '1 tbsp grated ginger',
      '1 tbsp rice vinegar',
      '1 tsp sesame oil',
      '1 tsp smoked paprika',
      '1/2 tsp kosher salt',
      '1/2 tsp black pepper'
    ],
    steps: [
      'Season chicken with smoked paprika, salt, and pepper.',
      'Dredge chicken in flour, egg whites, and panko.',
      'Air fry at 400 F for 12-15 minutes, flipping once, until chicken reaches 165 F.',
      'Simmer gochujang, soy sauce, honey, garlic, ginger, rice vinegar, and sesame oil for 2-3 minutes.',
      'Toss or brush the crispy chicken with sauce.',
      'Serve on buns with cabbage and light mayo.'
    ]
  },
  {
    id: 'saved-low-fat-chicken-tenders',
    name: 'Low-Fat Chicken Tenders',
    mealTypes: ['Lunch', 'Dinner'],
    protein: 'Chicken Breast',
    sourceFolder: 'Low Fat Chicken Tenders',
    description: 'Crispy baked or air-fried chicken tenders with a high-protein breading and measured spices.',
    macroRating: 'SUPER FIT',
    prepTime: '30 minutes',
    baseServings: 4,
    macros: { calories: 420, protein: 48, carbs: 36, fat: 8 },
    ingredients: [
      '2 lb chicken breast tenderloins',
      '1 cup cornflakes, crushed',
      '1/2 cup panko breadcrumbs',
      '1 cup egg whites',
      '1/2 cup flour',
      '1 tbsp ranch seasoning',
      '1 tsp garlic powder',
      '1 tsp smoked paprika',
      '1/2 tsp kosher salt',
      '1/2 tsp black pepper'
    ],
    steps: [
      'Heat the air fryer to 400 F or the oven to 425 F.',
      'Season flour with ranch seasoning, garlic powder, smoked paprika, salt, and pepper.',
      'Coat chicken in flour, egg whites, and crushed cornflake-panko mixture.',
      'Air fry for 10-12 minutes or bake for 16-20 minutes until crisp and 165 F inside.',
      'Serve with a measured light sauce or add to bowls, wraps, or salads.'
    ]
  },
  {
    id: 'saved-chicken-pesto-sandwich',
    name: 'Chicken Pesto Sandwich',
    mealTypes: ['Lunch'],
    protein: 'Chicken Breast',
    sourceFolder: 'Chicken Pesto Sandwich',
    description: 'A high-protein chicken pesto sandwich with light mozzarella, tomato, and basil.',
    macroRating: 'FIT',
    prepTime: '25 minutes',
    baseServings: 2,
    macros: { calories: 530, protein: 50, carbs: 44, fat: 16 },
    ingredients: [
      '1 lb chicken breast',
      '2 sandwich rolls',
      '2 tbsp light pesto',
      '1/2 cup reduced-fat mozzarella',
      '1 tomato, sliced',
      '1 cup spinach',
      '1 tbsp lemon juice',
      '1 tsp Italian seasoning',
      '1/2 tsp garlic powder',
      '1/2 tsp kosher salt',
      '1/2 tsp black pepper'
    ],
    steps: [
      'Season chicken with lemon juice, Italian seasoning, garlic powder, salt, and pepper.',
      'Grill, pan-sear, or air fry chicken until it reaches 165 F.',
      'Toast rolls, then spread each with 1 tbsp light pesto.',
      'Layer chicken, mozzarella, tomato, and spinach.',
      'Toast until the cheese melts and the bread is crisp.'
    ]
  },
  {
    id: 'saved-french-bread-pizza',
    name: 'French Bread Pizza',
    mealTypes: ['Lunch', 'Dinner'],
    protein: 'Chicken Breast',
    sourceFolder: 'Baguette Pizza',
    description: 'A crisp baguette pizza with marinara, chicken, vegetables, and reduced-fat cheese.',
    macroRating: 'FIT',
    prepTime: '25 minutes',
    baseServings: 2,
    macros: { calories: 450, protein: 35, carbs: 52, fat: 10 },
    ingredients: [
      '1 small baguette, split lengthwise',
      '8 oz cooked chicken breast, diced',
      '1/2 cup marinara sauce',
      '1 cup reduced-fat mozzarella',
      '1/2 cup sliced bell peppers',
      '1/4 cup diced onion',
      '1 tbsp grated parmesan',
      '1 tsp Italian seasoning',
      '1/2 tsp garlic powder',
      '1/4 tsp red pepper flakes'
    ],
    steps: [
      'Heat the oven to 425 F.',
      'Toast the split baguette for 4-5 minutes so it stays crisp.',
      'Spread marinara over the bread and top with chicken, mozzarella, peppers, onion, parmesan, Italian seasoning, garlic powder, and red pepper flakes.',
      'Bake for 10-12 minutes until the cheese melts and the edges are browned.',
      'Slice into portions and serve hot.'
    ]
  }
];

export function buildSavedRecipePlan(preferences = {}) {
  const recipeLibrary = getSavedRecipesForPreferences(preferences, { limit: 80 });
  const mealTypes = getPreferenceMealTypes(preferences);
  const totalMeals = Number(preferences.days || 0) * Math.max(1, mealTypes.length);

  return {
    id: `saved-recipes-${Date.now()}`,
    title: 'Saved Repeat Recipe Options',
    generatedAt: new Date().toISOString(),
    generatedBy: 'saved-recipe-library',
    preferences,
    summary: {
      days: Number(preferences.days || 0),
      mealsPerDay: mealTypes.length,
      totalMeals,
      averageCalories: averageMacro(recipeLibrary, 'calories'),
      averageProtein: averageMacro(recipeLibrary, 'protein'),
      averageCarbs: averageMacro(recipeLibrary, 'carbs'),
      averageFat: averageMacro(recipeLibrary, 'fat')
    },
    days: [],
    recipeLibrary,
    shoppingList: [],
    sourceNotes: ['Saved server recipes are based on your proofread recipe folders.'],
    safetyNote:
      'Recipes and macros are planning estimates. Confirm labels, allergies, and cook chicken/turkey to 165 F and ground beef to 160 F.'
  };
}

export function getSavedRecipesForPreferences(preferences = {}, { limit = 80 } = {}) {
  const mealTypes = getPreferenceMealTypes(preferences);
  const selectedProteins = normalizeList(preferences.proteins);
  const avoidTerms = normalizeList([
    ...(Array.isArray(preferences.allergies) ? preferences.allergies : []),
    ...String(preferences.avoidIngredients || '').split(',')
  ]);

  const expanded = [];

  for (const recipe of SAVED_RECIPES) {
    for (const mealType of mealTypes) {
      if (!recipe.mealTypes.includes(mealType)) continue;

      const normalized = toPlanRecipe(recipe, mealType);
      if (hasAvoidedTerm(normalized, avoidTerms)) continue;
      expanded.push(normalized);
    }
  }

  const scored = expanded.map((recipe, index) => ({
    recipe,
    index,
    score: scoreSavedRecipe(recipe, selectedProteins)
  }));

  const proteinMatches = scored.filter((entry) => entry.score > 0);
  const pool = proteinMatches.length >= Math.min(6, expanded.length) ? proteinMatches : scored;

  return uniqueRecipes(pool
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.recipe))
    .slice(0, limit);
}

function toPlanRecipe(recipe, mealType) {
  return {
    id: `${recipe.id}-${mealType.toLowerCase()}`,
    optionKey: `${recipe.id}-${mealType.toLowerCase()}`,
    mealType,
    time: DEFAULT_TIME[mealType] || '6:30 PM',
    name: recipe.name,
    protein: recipe.protein,
    description: recipe.description,
    macroRating: recipe.macroRating,
    prepTime: recipe.prepTime,
    baseServings: recipe.baseServings,
    macros: recipe.macros,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    sources: [
      {
        label: recipe.sourceFolder,
        url: '',
        platform: 'saved-folder'
      }
    ],
    sourceFolder: recipe.sourceFolder,
    savedRecipe: true,
    ingredientScale: 'batch'
  };
}

function getPreferenceMealTypes(preferences = {}) {
  const mealTypes = (preferences.mealSlots || [])
    .map((slot) => normalizeMealType(slot.type || slot.mealType))
    .filter(Boolean);
  return [...new Set(mealTypes.length ? mealTypes : ['Lunch', 'Dinner'])];
}

function normalizeMealType(value = '') {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'breakfast') return 'Breakfast';
  if (text === 'lunch') return 'Lunch';
  if (text === 'snack') return 'Snack';
  return 'Dinner';
}

function scoreSavedRecipe(recipe, selectedProteins = []) {
  if (!selectedProteins.length) return 1;
  const searchable = normalizeText([
    recipe.name,
    recipe.protein,
    recipe.description,
    ...(recipe.ingredients || [])
  ].join(' '));

  return selectedProteins.reduce((score, protein) => score + (searchable.includes(protein) ? 4 : 0), 0);
}

function hasAvoidedTerm(recipe, avoidTerms = []) {
  if (!avoidTerms.length) return false;
  const searchable = normalizeText([
    recipe.name,
    recipe.protein,
    recipe.description,
    ...(recipe.ingredients || [])
  ].join(' '));

  return avoidTerms.some((term) => term && searchable.includes(term));
}

function averageMacro(recipes, key) {
  if (!recipes.length) return 0;
  return Math.round(recipes.reduce((total, recipe) => total + Number(recipe.macros?.[key] || 0), 0) / recipes.length);
}

function uniqueRecipes(recipes = []) {
  const seen = new Set();
  const unique = [];

  for (const recipe of recipes) {
    const key = `${recipe.mealType}-${recipe.name}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(recipe);
  }

  return unique;
}

function normalizeList(values = []) {
  return values.map((value) => normalizeText(value)).filter(Boolean);
}

function normalizeText(value = '') {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
