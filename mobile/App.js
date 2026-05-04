import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  InputAccessoryView,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useRef, useState } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import {
  Check,
  CalendarPlus,
  Camera,
  ChevronLeft,
  Clock,
  DollarSign,
  ExternalLink,
  ImagePlus,
  MapPin,
  Plus,
  RefreshCw,
  ShoppingCart,
  Sparkles
} from 'lucide-react-native';

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  Platform.select({
    android: 'http://10.0.2.2:4000',
    default: 'http://localhost:4000'
  });

const COLORS = {
  ink: '#060606',
  muted: '#505050',
  pale: '#eeeeef',
  pale2: '#f7f7f4',
  green: '#55c51f',
  greenDark: '#37a90d',
  cardinal: '#c91f32',
  cardinalDark: '#7d1020',
  beak: '#f0ad2d',
  yellow: '#f7df73',
  line: '#dedede',
  white: '#ffffff'
};

const DAY_OPTIONS = [3, 5, 7, 10];
const PROTEIN_OPTIONS = ['Chicken', 'Turkey', 'Salmon', 'Shrimp', 'Beef', 'Eggs', 'Tofu', 'Greek yogurt'];
const ALLERGY_OPTIONS = [
  'Shellfish',
  'Fish',
  'Gluten',
  'Dairy',
  'Peanut',
  'Tree Nut',
  'Soy',
  'Egg',
  'Sesame',
  'Mustard',
  'Sulfite',
  'Nightshade'
];
const DIET_STYLES = ['Balanced', 'High protein', 'Low carb', 'Mediterranean'];
const SOURCE_OPTIONS = ['@roadtoaesthetics', '@noahperlofit', '@fairfiteats', '@nickazfit'];
const SERVING_OPTIONS = [
  { value: 1, title: '1 serving', subtitle: 'just for you' },
  { value: 2, title: '2 servings', subtitle: 'for two, or one with leftovers' },
  { value: 4, title: '4 servings', subtitle: 'for four, or two-three with leftovers' },
  { value: 6, title: '6 servings', subtitle: 'for a family of 5+' }
];
const MEAL_COUNT_OPTIONS = [
  { value: 1, title: '1 meal', subtitle: 'one recipe per day' },
  { value: 2, title: '2 meals', subtitle: 'lean and easy to prep' },
  { value: 3, title: '3 meals', subtitle: 'breakfast, lunch, dinner' },
  { value: 4, title: '4 meals', subtitle: 'adds a snack slot' }
];
const INITIAL_MEAL_SLOTS = [
  { type: 'Breakfast', time: '8:00 AM', enabled: true },
  { type: 'Lunch', time: '12:30 PM', enabled: true },
  { type: 'Dinner', time: '6:30 PM', enabled: true },
  { type: 'Snack', time: '3:30 PM', enabled: false }
];
const USER_STORAGE_KEY = 'cutplate:user:v1';
const CALENDAR_STORAGE_KEY = 'cutplate:calendar:v1';
const SHOPPING_LIST_STORAGE_KEY = 'cutplate:shopping-list:v1';
const KEYBOARD_ACCESSORY_ID = 'cutplate-keyboard-done';
const KEYBOARD_DISMISS_MODE = Platform.OS === 'ios' ? 'interactive' : 'on-drag';
const TEXT_INPUT_DONE_PROPS = Platform.OS === 'ios' ? { inputAccessoryViewID: KEYBOARD_ACCESSORY_ID } : {};
const ONBOARDING_SLIDES = [
  {
    title: 'Meal plans built around you.',
    body: 'Pick the days, meals, proteins, budget, and goals. CutPlate turns that into recipe options you actually want.'
  },
  {
    title: 'Shop smarter before you cook.',
    body: 'The grocery estimate updates as you build the menu, with pantry ingredients and package sizes considered.'
  },
  {
    title: 'Use what is already home.',
    body: 'Enter pantry or fridge ingredients and CutPlate can build meal ideas around those items plus small seasonings.'
  }
];

export default function App() {
  const [hasBooted, setHasBooted] = useState(false);
  const [viewer, setViewer] = useState(null);
  const [onboardingIndex, setOnboardingIndex] = useState(0);
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupError, setSignupError] = useState('');
  const [signupNotice, setSignupNotice] = useState('');
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [calendarMeals, setCalendarMeals] = useState([]);
  const [latestShoppingPlan, setLatestShoppingPlan] = useState(null);
  const [appMode, setAppMode] = useState('home');
  const [step, setStep] = useState(0);
  const [days, setDays] = useState(5);
  const [weekdaysOnly, setWeekdaysOnly] = useState(false);
  const [selectedProteins, setSelectedProteins] = useState(['Chicken', 'Turkey', 'Salmon']);
  const [customProtein, setCustomProtein] = useState('');
  const [mealSlots, setMealSlots] = useState(INITIAL_MEAL_SLOTS);
  const [allergies, setAllergies] = useState([]);
  const [servingsPerMeal, setServingsPerMeal] = useState(2);
  const [dietStyle, setDietStyle] = useState('High protein');
  const [calorieTarget, setCalorieTarget] = useState('600');
  const [avoidIngredients, setAvoidIngredients] = useState('');
  const [pantryIngredients, setPantryIngredients] = useState('');
  const [shoppingLocation, setShoppingLocation] = useState('');
  const [sourceHandles, setSourceHandles] = useState(SOURCE_OPTIONS);
  const [plan, setPlan] = useState(null);
  const [planStage, setPlanStage] = useState('menu');
  const [selectedMealIds, setSelectedMealIds] = useState([]);
  const [selectedMenuPlan, setSelectedMenuPlan] = useState(null);
  const [budgetTarget, setBudgetTarget] = useState('75');
  const [warnings, setWarnings] = useState([]);
  const [selectedDay, setSelectedDay] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isEstimating, setIsEstimating] = useState(false);
  const [menuPricing, setMenuPricing] = useState({ selectedTotal: 0, marginalCosts: {} });
  const [cachedRecipes, setCachedRecipes] = useState([]);
  const [pantryMealType, setPantryMealType] = useState('Dinner');
  const [pantryProteinInput, setPantryProteinInput] = useState('');
  const [pantryPhotoUri, setPantryPhotoUri] = useState('');
  const [pantryDetectedIngredients, setPantryDetectedIngredients] = useState([]);
  const [pantryRecipes, setPantryRecipes] = useState([]);
  const [isAnalyzingPantryPhoto, setIsAnalyzingPantryPhoto] = useState(false);
  const [isPantrySearching, setIsPantrySearching] = useState(false);
  const [pantrySearchError, setPantrySearchError] = useState('');
  const [pantrySearchNote, setPantrySearchNote] = useState('');
  const [error, setError] = useState('');
  const pricingRequestId = useRef(0);

  const enabledSlots = useMemo(() => mealSlots.filter((slot) => slot.enabled), [mealSlots]);
  const stepCount = 11;
  const atLastStep = step === stepCount - 1;
  const activeResultPlan = selectedMenuPlan || plan;
  const activeDay = activeResultPlan?.days?.[selectedDay] || activeResultPlan?.days?.[0];
  const targetSlots = useMemo(() => getTargetSlots(plan), [plan]);
  const mealOptions = useMemo(() => getMealOptions(plan, cachedRecipes, pantryIngredients), [cachedRecipes, pantryIngredients, plan]);
  const selectedMeals = useMemo(() => getSelectedMealOptions(mealOptions, selectedMealIds), [mealOptions, selectedMealIds]);
  const mealTypeRequirements = useMemo(() => getMealTypeRequirements(targetSlots), [targetSlots]);
  const selectedCounts = useMemo(() => getSelectedMealCounts(selectedMeals), [selectedMeals]);
  const assignedMeals = useMemo(
    () => buildAssignmentsFromSelected(targetSlots, selectedMeals),
    [selectedMeals, targetSlots]
  );
  const selectedMealCount = selectedMeals.length;
  const fallbackMenuEstimate = useMemo(
    () => selectedMeals.reduce((total, meal) => total + Number(meal.estimatedCost || 0), 0),
    [selectedMeals]
  );
  const liveMenuEstimate = selectedMealCount > 0
    ? Number(menuPricing.selectedTotal || fallbackMenuEstimate || 0)
    : 0;
  const budgetAmount = Number(budgetTarget || 0);
  const budgetRemaining = Math.round((budgetAmount - liveMenuEstimate) * 100) / 100;

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      const [storedViewer, storedCalendarMeals, storedShoppingPlan] = await Promise.all([
        loadStoredJson(USER_STORAGE_KEY, null),
        loadStoredJson(CALENDAR_STORAGE_KEY, []),
        loadStoredJson(SHOPPING_LIST_STORAGE_KEY, null)
      ]);

      if (cancelled) return;
      setViewer(storedViewer);
      setCalendarMeals(Array.isArray(storedCalendarMeals) ? storedCalendarMeals : []);
      setLatestShoppingPlan(storedShoppingPlan && typeof storedShoppingPlan === 'object' ? storedShoppingPlan : null);
      setSignupName(storedViewer?.name || '');
      setSignupEmail(storedViewer?.email || '');
      setHasBooted(true);
    };

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedAvoids = useMemo(() => {
    return [...allergies, avoidIngredients]
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .join(', ');
  }, [allergies, avoidIngredients]);

  const canContinue = useMemo(() => {
    if (step === 1) return selectedProteins.length > 0;
    if (step === 3) return enabledSlots.length > 0;
    if (step === 8) return Number(budgetTarget || 0) > 0;
    return true;
  }, [budgetTarget, enabledSlots.length, selectedProteins.length, step]);

  const startGuidedPlan = () => {
    setError('');
    setPlan(null);
    setSelectedMenuPlan(null);
    setSelectedMealIds([]);
    setStep(0);
    setAppMode('wizard');
  };

  const startPantryFinder = () => {
    setError('');
    setPlan(null);
    setSelectedMenuPlan(null);
    setSelectedMealIds([]);
    setPantryRecipes([]);
    setPantrySearchError('');
    setPantrySearchNote('');
    setPantryPhotoUri('');
    setPantryDetectedIngredients([]);
    setAppMode('pantry');
  };

  const submitSignup = async () => {
    const name = signupName.trim();
    const email = signupEmail.trim().toLowerCase();

    setSignupError('');
    setSignupNotice('');

    if (!name) {
      setSignupError('Enter your name.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setSignupError('Enter a valid email address.');
      return;
    }

    setIsSigningUp(true);

    try {
      const response = await fetchWithRetry(`${API_URL}/api/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email })
      }, 1);

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const data = await response.json();
      const profile = {
        id: data.user?.id,
        name,
        email,
        confirmationPending: !data.user?.confirmedAt,
        savedAt: new Date().toISOString()
      };

      await saveStoredJson(USER_STORAGE_KEY, profile);
      setViewer(profile);
      setSignupNotice(data.emailSent ? 'Confirmation email sent.' : 'Confirmation link created for local testing.');
    } catch (requestError) {
      setSignupError(formatApiFailure('Could not send the confirmation email', requestError));
    } finally {
      setIsSigningUp(false);
    }
  };

  const handleAddPlanToCalendar = async (calendarPlan) => {
    const meals = buildCalendarMeals(calendarPlan);
    const shoppingPlan = buildStoredShoppingPlan(calendarPlan);
    setCalendarMeals(meals);
    setLatestShoppingPlan(shoppingPlan);
    await Promise.all([
      saveStoredJson(CALENDAR_STORAGE_KEY, meals),
      saveStoredJson(SHOPPING_LIST_STORAGE_KEY, shoppingPlan)
    ]);
    setPlan(null);
    setSelectedMenuPlan(null);
    setSelectedMealIds([]);
    setPlanStage('menu');
    setSelectedDay(0);
    setWarnings([]);
    setError('');
    setAppMode('home');
  };

  const viewShoppingList = () => {
    setError('');
    setAppMode('shopping');
  };

  const updatePantryFinderIngredients = (value) => {
    setPantryIngredients(value);
    setPantryRecipes([]);
    setPantrySearchError('');
    setPantrySearchNote('');
  };

  const updatePantryFinderMealType = (mealType) => {
    setPantryMealType(mealType);
    setPantryRecipes([]);
    setPantrySearchError('');
    setPantrySearchNote('');
  };

  const updatePantryFinderProtein = (value) => {
    setPantryProteinInput(value);
    setPantryRecipes([]);
    setPantrySearchError('');
    setPantrySearchNote('');
  };

  const pickPantryPhoto = async () => {
    setPantrySearchError('');
    setPantrySearchNote('');

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPantrySearchError('Photo library permission is needed to choose a pantry photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.55,
      base64: true
    });

    await analyzePantryPhotoResult(result);
  };

  const takePantryPhoto = async () => {
    setPantrySearchError('');
    setPantrySearchNote('');

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setPantrySearchError('Camera permission is needed to snap a pantry photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.55,
      base64: true
    });

    await analyzePantryPhotoResult(result);
  };

  const analyzePantryPhotoResult = async (result) => {
    if (result?.canceled) return;

    const asset = result?.assets?.[0];
    if (!asset?.base64) {
      setPantrySearchError('Could not read that photo. Try another image.');
      return;
    }

    setIsAnalyzingPantryPhoto(true);
    setPantryPhotoUri(asset.uri || '');
    setPantryDetectedIngredients([]);

    try {
      const response = await fetchWithRetry(`${API_URL}/api/analyze-pantry-photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: asset.base64,
          mimeType: asset.mimeType || 'image/jpeg'
        })
      }, 1);

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const data = await response.json();
      const detected = Array.isArray(data.ingredients) ? data.ingredients : [];
      const ingredientNames = detected.map((ingredient) => ingredient.name).filter(Boolean);
      const proteins = Array.isArray(data.proteins) ? data.proteins : [];

      setPantryDetectedIngredients(detected);
      setPantryIngredients((current) => mergeIngredientText(current, ingredientNames));
      if (!pantryProteinInput.trim() && proteins.length) {
        setPantryProteinInput(proteins.join(', '));
      }
      setPantrySearchNote(data.note || (ingredientNames.length ? 'I found ingredients from the photo. Edit anything I missed before finding meals.' : 'I could not spot many ingredients. Add what you know is there.'));
    } catch (requestError) {
      setPantrySearchError(formatApiFailure('Could not analyze the pantry photo', requestError));
    } finally {
      setIsAnalyzingPantryPhoto(false);
    }
  };

  const findPantryRecipes = async () => {
    const ingredients = mergeIngredientText(pantryIngredients, splitRawIngredients(pantryProteinInput)).trim();

    setPantrySearchError('');
    setPantrySearchNote('');

    if (!ingredients) {
      setPantrySearchError('Enter what you have first.');
      return;
    }

    setIsPantrySearching(true);

    try {
      const response = await fetchWithRetry(`${API_URL}/api/pantry-recipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredients,
          pantryProtein: pantryProteinInput,
          mealType: pantryMealType,
          allergies,
          dietStyle,
          calorieTarget: Number(calorieTarget),
          calorieTargetBasis: 'per_meal_per_serving',
          dailyCalorieTarget: getDailyCalorieTarget(calorieTarget, 1),
          cookedDailyCalorieTarget: getCookedDailyCalorieTarget(calorieTarget, 1, 1),
          sourceHandles
        })
      }, 1);

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const data = await response.json();
      setPantryRecipes(Array.isArray(data.recipes) ? data.recipes : []);
      setPantrySearchNote(data.note || '');
    } catch (requestError) {
      setPantrySearchError(formatApiFailure('Could not build pantry meals', requestError));
    } finally {
      setIsPantrySearching(false);
    }
  };

  const deleteAccount = async () => {
    const email = viewer?.email;

    try {
      if (email) {
        await fetchWithRetry(`${API_URL}/api/delete-account`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        }, 1);
      }
    } catch {
      // Local deletion still lets the user remove app data from this device.
    }

    await AsyncStorage.multiRemove([USER_STORAGE_KEY, CALENDAR_STORAGE_KEY, SHOPPING_LIST_STORAGE_KEY]);
    setViewer(null);
    setCalendarMeals([]);
    setLatestShoppingPlan(null);
    setPlan(null);
    setSelectedMenuPlan(null);
    setSelectedMealIds([]);
    setOnboardingIndex(0);
    setSignupName('');
    setSignupEmail('');
    setSignupError('');
    setSignupNotice('');
    setAppMode('home');
  };

  const goBack = () => {
    setError('');
    if (plan) {
      if (planStage === 'recipes') {
        setPlanStage('menu');
        return;
      }
      if (planStage === 'menu') {
        setPlan(null);
        setSelectedMenuPlan(null);
        setSelectedMealIds([]);
        return;
      }
      setPlan(null);
      setSelectedMenuPlan(null);
      setSelectedMealIds([]);
      return;
    }
    if (appMode === 'pantry') {
      setAppMode('home');
      return;
    }
    if (appMode === 'shopping') {
      setAppMode('home');
      return;
    }
    if (appMode === 'wizard' && step === 0) {
      setAppMode('home');
      return;
    }
    setStep((current) => Math.max(0, current - 1));
  };

  const goNext = () => {
    setError('');

    if (!canContinue) {
      setError(step === 1 ? 'Choose at least one protein.' : 'Choose at least one meal.');
      return;
    }

    if (atLastStep) {
      generatePlan();
      return;
    }

    setStep((current) => Math.min(stepCount - 1, current + 1));
  };

  const toggleProtein = (protein) => {
    setSelectedProteins((current) =>
      current.includes(protein) ? current.filter((item) => item !== protein) : [...current, protein]
    );
  };

  const addCustomProtein = () => {
    const value = customProtein.trim();
    if (!value) return;
    setSelectedProteins((current) => (current.includes(value) ? current : [...current, value]));
    setCustomProtein('');
  };

  const toggleAllergy = (allergy) => {
    setAllergies((current) =>
      current.includes(allergy) ? current.filter((item) => item !== allergy) : [...current, allergy]
    );
  };

  const setSocialSourcesEnabled = (enabled) => {
    setSourceHandles(enabled ? SOURCE_OPTIONS : []);
  };

  const updateMealSlot = (type, patch) => {
    setMealSlots((current) => current.map((slot) => (slot.type === type ? { ...slot, ...patch } : slot)));
  };

  const setMealsPerDay = (count) => {
    setMealSlots((current) => current.map((slot, index) => ({ ...slot, enabled: index < count })));
  };

  useEffect(() => {
    if (!plan || planStage !== 'menu' || mealOptions.length === 0) {
      setMenuPricing({ selectedTotal: 0, marginalCosts: {} });
      return;
    }

    const requestId = pricingRequestId.current + 1;
    pricingRequestId.current = requestId;

    const refreshMenuPricing = async () => {
      try {
        const response = await fetchWithRetry(`${API_URL}/api/menu-costs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            selectedMeals,
            optionMeals: mealOptions,
            preferences: {
              servingsPerMeal,
              location: shoppingLocation
            }
          })
        }, 1);

        if (!response.ok) return;

        const data = await response.json();
        if (pricingRequestId.current === requestId) {
          setMenuPricing({
            selectedTotal: Number(data.selectedTotal || 0),
            selectedEstimate: data.selectedEstimate,
            marginalCosts: data.marginalCosts || {}
          });
        }
      } catch {
        if (pricingRequestId.current === requestId) {
          setMenuPricing((current) => ({
            ...current,
            selectedTotal: fallbackMenuEstimate
          }));
        }
      }
    };

    refreshMenuPricing();
  }, [fallbackMenuEstimate, mealOptions, plan, planStage, selectedMeals, servingsPerMeal, shoppingLocation]);

  useEffect(() => {
    let cancelled = false;

    const loadCachedRecipes = async () => {
      try {
        const query = pantryIngredients.trim()
          ? `?ingredients=${encodeURIComponent(pantryIngredients)}&limit=100`
          : '?limit=100';
        const response = await fetchWithRetry(`${API_URL}/api/cached-recipes${query}`, {}, 1);
        if (!response.ok) return;

        const data = await response.json();
        if (!cancelled) {
          setCachedRecipes(Array.isArray(data.recipes) ? data.recipes : []);
        }
      } catch {
        if (!cancelled) setCachedRecipes([]);
      }
    };

    loadCachedRecipes();

    return () => {
      cancelled = true;
    };
  }, [pantryIngredients]);

  const generatePlan = async () => {
    setError('');
    setWarnings([]);

    if (selectedProteins.length === 0) {
      setError('Choose at least one protein.');
      setStep(1);
      return;
    }

    if (enabledSlots.length === 0) {
      setError('Choose at least one meal.');
      setStep(3);
      return;
    }

    if (Number(budgetTarget || 0) <= 0) {
      setError('Enter a grocery budget.');
      setStep(8);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetchWithRetry(`${API_URL}/api/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          days,
          weekdaysOnly,
          proteins: selectedProteins,
          mealSlots: enabledSlots.map(({ type, time }) => ({ type, time })),
          servingsPerMeal,
          allergies,
          dietStyle,
          calorieTarget: Number(calorieTarget),
          calorieTargetBasis: 'per_meal_per_serving',
          dailyCalorieTarget: getDailyCalorieTarget(calorieTarget, enabledSlots.length),
          cookedDailyCalorieTarget: getCookedDailyCalorieTarget(calorieTarget, enabledSlots.length, servingsPerMeal),
          groceryBudget: Number(budgetTarget),
          avoidIngredients: selectedAvoids,
          pantryIngredients,
          location: shoppingLocation,
          sourceHandles
        })
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const data = await response.json();
      setPlan(data.plan);
      setSelectedMenuPlan(null);
      setSelectedMealIds([]);
      setPlanStage('menu');
      setWarnings(data.warnings || []);
      setSelectedDay(0);
    } catch (requestError) {
      setError(formatApiFailure('Plan generation failed', requestError));
    } finally {
      setIsLoading(false);
    }
  };

  const toggleLibraryMeal = (meal) => {
    setSelectedMealIds((current) => {
      if (current.includes(meal.optionKey)) {
        return current.filter((id) => id !== meal.optionKey);
      }

      const typeRequirement = mealTypeRequirements[meal.mealType] || 0;
      const currentTypeCount = mealOptions.filter(
        (option) => current.includes(option.optionKey) && option.mealType === meal.mealType
      ).length;

      if (currentTypeCount >= typeRequirement) {
        return current;
      }

      return [...current, meal.optionKey];
    });
  };

  const estimateAssignedMenu = async () => {
    if (!plan || !areMealRequirementsMet(mealTypeRequirements, selectedCounts)) {
      setError('Pick at least one recipe, then I can fit the selected meals into days.');
      return;
    }

    setError('');
    setIsEstimating(true);

    try {
      const response = await fetchWithRetry(`${API_URL}/api/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          assignedMeals,
          preferences: {
            servingsPerMeal,
            location: shoppingLocation
          }
        })
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const data = await response.json();
      setSelectedMenuPlan(data.plan);
      setSelectedDay(0);
      setPlanStage('recipes');
    } catch (requestError) {
      setError(formatApiFailure('Could not estimate the selected menu', requestError));
    } finally {
      setIsEstimating(false);
    }
  };

  const swapMeal = async (dayNumber, mealId) => {
    const currentPlan = selectedMenuPlan || plan;
    if (!currentPlan) return;

    const currentDay = (currentPlan.days || []).find((day) => Number(day.dayNumber) === Number(dayNumber));
    const currentMeal = currentDay?.meals?.find((meal) => meal.id === mealId);
    if (!currentMeal) return;

    const currentNames = new Set(
      (currentPlan.days || []).flatMap((day) => day.meals || []).map((meal) => normalizeRecipeName(meal.name))
    );
    const candidates = mealOptions.filter(
      (meal) =>
        meal.mealType === currentMeal.mealType &&
        normalizeRecipeName(meal.name) !== normalizeRecipeName(currentMeal.name) &&
        !currentNames.has(normalizeRecipeName(meal.name))
    );

    if (!candidates.length) {
      setError('No swap options match that meal slot yet.');
      return;
    }

    const replacement = candidates[0];
    const updatedPlan = {
      ...currentPlan,
      days: currentPlan.days.map((day) => {
        if (Number(day.dayNumber) !== Number(dayNumber)) return day;

        return {
          ...day,
          meals: day.meals.map((meal) =>
            meal.id === mealId
              ? {
                  ...replacement,
                  id: meal.id,
                  mealType: meal.mealType,
                  time: meal.time
                }
              : meal
          )
        };
      })
    };

    setError('');
    setIsEstimating(true);

    try {
      const response = await fetchWithRetry(`${API_URL}/api/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: updatedPlan,
          assignedMeals: buildAssignmentsFromPlan(updatedPlan),
          preferences: {
            servingsPerMeal,
            location: shoppingLocation
          }
        })
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const data = await response.json();
      setSelectedMenuPlan(data.plan);
    } catch (requestError) {
      setSelectedMenuPlan(updatedPlan);
      setError(formatApiFailure('Could not reprice the swapped menu', requestError));
    } finally {
      setIsEstimating(false);
    }
  };

  if (!hasBooted) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.phoneFrame}>
          <TopNav showBack={false} progress={0.04} />
          <View style={styles.loadingScreen}>
            <ActivityIndicator color={COLORS.cardinal} />
            <Text style={styles.loadingText}>Opening CutPlate Cardinal</Text>
          </View>
        </View>
        <KeyboardDoneAccessory />
      </SafeAreaView>
    );
  }

  if (!viewer) {
    const onboardingProgress = Math.min(1, (onboardingIndex + 1) / (ONBOARDING_SLIDES.length + 1));

    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.phoneFrame}>
          <TopNav
            showBack={onboardingIndex > 0}
            onBack={() => setOnboardingIndex((current) => Math.max(0, current - 1))}
            progress={onboardingProgress}
          />
          <OnboardingScreen
            slideIndex={onboardingIndex}
            setSlideIndex={setOnboardingIndex}
            name={signupName}
            setName={setSignupName}
            email={signupEmail}
            setEmail={setSignupEmail}
            onSubmit={submitSignup}
            isSubmitting={isSigningUp}
            error={signupError}
            notice={signupNotice}
          />
        </View>
        <KeyboardDoneAccessory />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.phoneFrame}>
        <TopNav
          showBack={Boolean(plan) || appMode !== 'home'}
          onBack={goBack}
          progress={plan ? 1 : appMode === 'wizard' ? (step + 1) / stepCount : 0.08}
        />

        {plan ? (
          <>
            {planStage === 'menu' ? (
              <MenuBuilderScreen
                plan={plan}
                warnings={warnings}
                targetSlots={targetSlots}
                mealOptions={mealOptions}
                selectedMealIds={selectedMealIds}
                selectedCounts={selectedCounts}
                mealTypeRequirements={mealTypeRequirements}
                toggleLibraryMeal={toggleLibraryMeal}
                selectedMealCount={selectedMealCount}
                liveMenuEstimate={liveMenuEstimate}
                menuPricing={menuPricing}
                budgetAmount={budgetAmount}
                budgetRemaining={budgetRemaining}
                onContinue={estimateAssignedMenu}
                isEstimating={isEstimating}
                error={error}
              />
            ) : null}
            {planStage === 'recipes' ? (
              <ResultScreen
                plan={selectedMenuPlan || plan}
                warnings={warnings}
                activeDay={activeDay}
                selectedDay={selectedDay}
                setSelectedDay={setSelectedDay}
                onRegenerate={generatePlan}
                onSwapMeal={swapMeal}
                onAddToCalendar={handleAddPlanToCalendar}
                isLoading={isLoading}
                isEstimating={isEstimating}
                error={error}
              />
            ) : null}
          </>
        ) : appMode === 'home' ? (
          <HomeScreen
            viewer={viewer}
            calendarMeals={calendarMeals}
            latestShoppingPlan={latestShoppingPlan}
            onViewShoppingList={viewShoppingList}
            onStartGuided={startGuidedPlan}
            onStartPantry={startPantryFinder}
            onDeleteAccount={deleteAccount}
          />
        ) : appMode === 'shopping' ? (
          <ShoppingListScreen
            latestShoppingPlan={latestShoppingPlan}
            onStartGuided={startGuidedPlan}
          />
        ) : appMode === 'pantry' ? (
          <PantryFinderScreen
            pantryIngredients={pantryIngredients}
            setPantryIngredients={updatePantryFinderIngredients}
            pantryProteinInput={pantryProteinInput}
            setPantryProteinInput={updatePantryFinderProtein}
            pantryPhotoUri={pantryPhotoUri}
            pantryDetectedIngredients={pantryDetectedIngredients}
            pantryMealType={pantryMealType}
            setPantryMealType={updatePantryFinderMealType}
            pantryRecipes={pantryRecipes}
            onFindRecipes={findPantryRecipes}
            onPickPhoto={pickPantryPhoto}
            onTakePhoto={takePantryPhoto}
            isAnalyzingPhoto={isAnalyzingPantryPhoto}
            isLoading={isPantrySearching}
            error={pantrySearchError}
            note={pantrySearchNote}
          />
        ) : (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={KEYBOARD_DISMISS_MODE}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.stepScroll}
          >
            <View style={styles.stepHeader}>
              <Text style={styles.question}>{getQuestion(step)}</Text>
            </View>
            <GuidePrompt step={step} active={isLoading || step === 10} />

            {step === 0 ? (
              <DaysStep
                days={days}
                setDays={setDays}
                weekdaysOnly={weekdaysOnly}
                setWeekdaysOnly={setWeekdaysOnly}
              />
            ) : null}
            {step === 1 ? (
              <ProteinStep
                selectedProteins={selectedProteins}
                toggleProtein={toggleProtein}
                customProtein={customProtein}
                setCustomProtein={setCustomProtein}
                addCustomProtein={addCustomProtein}
              />
            ) : null}
            {step === 2 ? (
              <MealCountStep mealCount={enabledSlots.length} setMealsPerDay={setMealsPerDay} />
            ) : null}
            {step === 3 ? <MealsStep mealSlots={mealSlots} updateMealSlot={updateMealSlot} /> : null}
            {step === 4 ? <AllergiesStep allergies={allergies} toggleAllergy={toggleAllergy} /> : null}
            {step === 5 ? (
              <ServingsStep servingsPerMeal={servingsPerMeal} setServingsPerMeal={setServingsPerMeal} />
            ) : null}
            {step === 6 ? (
              <GoalStep
                dietStyle={dietStyle}
                setDietStyle={setDietStyle}
                calorieTarget={calorieTarget}
                setCalorieTarget={setCalorieTarget}
                enabledSlots={enabledSlots}
                servingsPerMeal={servingsPerMeal}
                avoidIngredients={avoidIngredients}
                setAvoidIngredients={setAvoidIngredients}
                pantryIngredients={pantryIngredients}
                setPantryIngredients={setPantryIngredients}
              />
            ) : null}
            {step === 7 ? (
              <LocationStep shoppingLocation={shoppingLocation} setShoppingLocation={setShoppingLocation} />
            ) : null}
            {step === 8 ? <BudgetPreferenceStep budgetTarget={budgetTarget} setBudgetTarget={setBudgetTarget} /> : null}
            {step === 9 ? (
              <SourcesStep
                socialSourcesEnabled={sourceHandles.length > 0}
                setSocialSourcesEnabled={setSocialSourcesEnabled}
              />
            ) : null}
            {step === 10 ? (
              <ReviewStep
                days={days}
                weekdaysOnly={weekdaysOnly}
                selectedProteins={selectedProteins}
                enabledSlots={enabledSlots}
                allergies={allergies}
                servingsPerMeal={servingsPerMeal}
                dietStyle={dietStyle}
                calorieTarget={calorieTarget}
                pantryIngredients={pantryIngredients}
                budgetTarget={budgetTarget}
                shoppingLocation={shoppingLocation}
                sourceHandles={sourceHandles}
              />
            ) : null}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </ScrollView>
        )}

        {!plan && appMode === 'wizard' ? (
          <BottomAction
            label={atLastStep ? 'Generate plan' : 'Continue'}
            onPress={goNext}
            isLoading={isLoading}
            disabled={!canContinue || isLoading}
          />
        ) : null}
      </View>
      <KeyboardDoneAccessory />
    </SafeAreaView>
  );
}

function getQuestion(step) {
  const questions = [
    'How many days should we plan?',
    'What protein do you want?',
    'How many meals per day?',
    'When do you want to eat?',
    'Any allergies?',
    'How many servings per meal?',
    'What goal should this follow?',
    'Where do you shop?',
    'What is your grocery budget?',
    'Would you like to source some recipes from social media?',
    'Ready for your plan?'
  ];

  return questions[step] || questions[0];
}

function getGuideText(step) {
  const lines = [
    'Start with the plan length. Weekdays only skips weekends when the calendar is built.',
    'Pick proteins you actually want to eat this week.',
    'Choose the number of meal slots. You can still turn specific meals off next.',
    'Set the meal times so the menu feels like your real day.',
    'Tap any allergy so I keep it out of the plan.',
    'Servings drive both recipe amounts and grocery cost.',
    'Give me the nutrition lane, avoids, and anything already in your kitchen.',
    'A ZIP or city helps me estimate groceries closer to your area.',
    'Set the budget now so the recipe options can match it.',
    'Social media can guide recipe discovery and style without copying posts.',
    'I will generate budget-aware recipe options, then you pick the menu.'
  ];

  return lines[step] || lines[0];
}

function getTargetSlots(plan) {
  const days = Number(plan?.preferences?.days || plan?.summary?.days || 0);
  const mealSlots = Array.isArray(plan?.preferences?.mealSlots) ? plan.preferences.mealSlots : [];

  if (days > 0 && mealSlots.length > 0) {
    return Array.from({ length: days }, (_, dayIndex) =>
      mealSlots.map((slot, slotIndex) => ({
        key: `${dayIndex + 1}-${slot.type}-${slotIndex}`,
        dayNumber: dayIndex + 1,
        dayLabel: `Day ${dayIndex + 1}`,
        mealType: slot.type,
        time: slot.time
      }))
    ).flat();
  }

  return (plan?.days || []).flatMap((day) =>
    (day.meals || []).map((meal, index) => ({
      key: `${day.dayNumber}-${meal.mealType}-${index}`,
      dayNumber: day.dayNumber,
      dayLabel: day.label || `Day ${day.dayNumber}`,
      mealType: meal.mealType,
      time: meal.time
    }))
  );
}

async function readApiError(response) {
  try {
    const data = await response.json();
    return data?.error || data?.message || `API returned ${response.status}`;
  } catch {
    return `API returned ${response.status}`;
  }
}

async function fetchWithRetry(url, options = {}, retries = 2) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetch(url, options);
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      await wait(700 * (attempt + 1));
    }
  }

  throw lastError;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function dismissKeyboard() {
  if (Platform.OS !== 'web') {
    Keyboard.dismiss();
  }
}

function KeyboardDoneAccessory() {
  if (Platform.OS !== 'ios') return null;

  return (
    <InputAccessoryView nativeID={KEYBOARD_ACCESSORY_ID}>
      <View style={styles.keyboardAccessory}>
        <Pressable onPress={dismissKeyboard} style={styles.keyboardDoneButton}>
          <Text style={styles.keyboardDoneText}>Done</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

async function loadStoredJson(key, fallback) {
  try {
    const value = await AsyncStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

async function saveStoredJson(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local persistence should never block the meal plan flow.
  }
}

function formatApiFailure(prefix, error) {
  const message = String(error?.message || error || '').trim();
  const networkFailure = /failed to fetch|network request failed|load failed/i.test(message);

  if (networkFailure) {
    return `Could not reach the API at ${API_URL}. Start the server and try again.`;
  }

  return `${prefix}: ${message || 'unknown API error'}.`;
}

function getMealOptions(plan, cachedRecipes = [], pantryIngredients = '') {
  const options = [];

  if (Array.isArray(plan?.recipeLibrary) && plan.recipeLibrary.length > 0) {
    options.push(...plan.recipeLibrary.map((meal, index) => ({
      ...meal,
      optionKey: meal.optionKey || meal.id || `library-${index}`
    })));
  } else {
    options.push(...(plan?.days || []).flatMap((day) =>
      (day.meals || []).map((meal) => ({
        ...meal,
        optionKey: `${day.dayNumber}-${meal.id}`
      }))
    ));
  }

  const allowedTypes = new Set(getTargetSlots(plan).map((slot) => slot.mealType));
  const pantryList = splitIngredientList(pantryIngredients);
  const merged = new Map();

  for (const meal of options) {
    merged.set(normalizeRecipeName(`${meal.mealType}-${meal.name}`), meal);
  }

  for (const meal of cachedRecipes) {
    if (allowedTypes.size && !allowedTypes.has(meal.mealType)) continue;

    const key = normalizeRecipeName(`${meal.mealType}-${meal.name}`);
    if (!merged.has(key)) {
      merged.set(key, {
        ...meal,
        optionKey: meal.optionKey || meal.id || `cached-${key}`,
        cached: true
      });
    }
  }

  return Array.from(merged.values()).sort((a, b) => {
    const pantryDelta = scoreRecipeForIngredients(b, pantryList) - scoreRecipeForIngredients(a, pantryList);
    if (pantryDelta !== 0) return pantryDelta;
    if (a.cached !== b.cached) return a.cached ? 1 : -1;
    return 0;
  });
}

function getSelectedMealOptions(mealOptions, selectedMealIds) {
  const optionsById = new Map(mealOptions.map((meal) => [meal.optionKey, meal]));
  return selectedMealIds.map((id) => optionsById.get(id)).filter(Boolean);
}

function getSelectedMealCounts(selectedMeals) {
  return selectedMeals.reduce((counts, meal) => {
    counts[meal.mealType] = (counts[meal.mealType] || 0) + 1;
    return counts;
  }, {});
}

function getMealTypeRequirements(targetSlots) {
  return targetSlots.reduce((requirements, slot) => {
    requirements[slot.mealType] = (requirements[slot.mealType] || 0) + 1;
    return requirements;
  }, {});
}

function sortMealTypes(a, b) {
  const order = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
  return order.indexOf(a) - order.indexOf(b);
}

function areMealRequirementsMet(requirements, selectedCounts) {
  const totalSelected = Object.values(selectedCounts).reduce((total, count) => total + count, 0);
  if (totalSelected <= 0) return false;

  return Object.entries(selectedCounts).every(([mealType, count]) => count <= (requirements[mealType] || 0));
}

function buildAssignmentsFromSelected(targetSlots, selectedMeals) {
  const mealsByType = selectedMeals.reduce((groups, meal, index) => {
    const next = groups.get(meal.mealType) || [];
    next.push({ meal, index });
    groups.set(meal.mealType, next);
    return groups;
  }, new Map());

  const dayProteinCounts = new Map();

  return targetSlots
    .map((slot) => {
      const pool = mealsByType.get(slot.mealType) || [];
      if (!pool.length) return null;

      const dayProteins = dayProteinCounts.get(slot.dayNumber) || new Map();
      const bestIndex = getBestMealIndexForSlot(pool, dayProteins);
      const [{ meal }] = pool.splice(bestIndex, 1);
      const proteinKey = normalizeProteinKey(meal.protein || meal.name);
      dayProteins.set(proteinKey, (dayProteins.get(proteinKey) || 0) + 1);
      dayProteinCounts.set(slot.dayNumber, dayProteins);

      return {
        slotKey: slot.key,
        dayNumber: slot.dayNumber,
        mealType: slot.mealType,
        time: slot.time,
        meal
      };
    })
    .filter(Boolean);
}

function buildAssignmentsFromPlan(plan) {
  return (plan?.days || []).flatMap((day) =>
    (day.meals || []).map((meal, index) => ({
      slotKey: `${day.dayNumber}-${meal.mealType}-${index}`,
      dayNumber: day.dayNumber,
      mealType: meal.mealType,
      time: meal.time,
      meal
    }))
  );
}

function getBestMealIndexForSlot(pool, dayProteins) {
  let bestIndex = 0;
  let bestScore = Number.POSITIVE_INFINITY;

  pool.forEach((entry, index) => {
    const proteinKey = normalizeProteinKey(entry.meal.protein || entry.meal.name);
    const sameProteinCount = dayProteins.get(proteinKey) || 0;
    const score = sameProteinCount * 1000 + entry.index;

    if (score < bestScore) {
      bestIndex = index;
      bestScore = score;
    }
  });

  return bestIndex;
}

function normalizeProteinKey(value = '') {
  const text = String(value || '').toLowerCase();
  if (text.includes('chicken')) return 'chicken';
  if (text.includes('turkey')) return 'turkey';
  if (text.includes('salmon')) return 'salmon';
  if (text.includes('shrimp')) return 'shrimp';
  if (text.includes('beef')) return 'beef';
  if (text.includes('egg')) return 'egg';
  if (text.includes('tofu')) return 'tofu';
  if (text.includes('yogurt')) return 'yogurt';
  if (text.includes('cottage')) return 'cottage-cheese';
  return text.trim() || 'protein';
}

function normalizeRecipeName(value = '') {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function splitIngredientList(value = '') {
  return String(value || '')
    .split(',')
    .map((ingredient) => normalizeRecipeName(ingredient))
    .filter(Boolean);
}

function splitRawIngredients(value = '') {
  return String(value || '')
    .split(',')
    .map((ingredient) => ingredient.trim())
    .filter(Boolean);
}

function mergeIngredientText(current = '', additions = []) {
  const merged = [];
  const seen = new Set();

  for (const ingredient of [...splitRawIngredients(current), ...additions]) {
    const value = String(ingredient || '').trim();
    if (!value) continue;

    const key = normalizeRecipeName(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(value);
  }

  return merged.join(', ');
}

function getDailyCalorieTarget(calorieTarget, mealCount) {
  const perMeal = Number(calorieTarget || 0);
  const meals = Math.max(1, Number(mealCount || 1));
  return Number.isFinite(perMeal) && perMeal > 0 ? Math.round(perMeal * meals) : 0;
}

function getCookedDailyCalorieTarget(calorieTarget, mealCount, servingsPerMeal) {
  const daily = getDailyCalorieTarget(calorieTarget, mealCount);
  const servings = Math.max(1, Number(servingsPerMeal || 1));
  return daily > 0 ? Math.round(daily * servings) : 0;
}

function formatCalorieTargetSummary(calorieTarget, mealCount, servingsPerMeal) {
  const perMeal = Number(calorieTarget || 0);
  if (!Number.isFinite(perMeal) || perMeal <= 0) return 'no calorie target';

  const daily = getDailyCalorieTarget(perMeal, mealCount);
  const cookedDaily = getCookedDailyCalorieTarget(perMeal, mealCount, servingsPerMeal);
  return `${Math.round(perMeal)} cals/meal/serving, ${daily} daily per serving, ${cookedDaily} cooked daily total`;
}

function scoreRecipeForIngredients(recipe, ingredients = []) {
  if (!ingredients.length) return Number(recipe.pantryScore || 0);

  const searchable = normalizeRecipeName([
    recipe.name,
    recipe.protein,
    recipe.description,
    ...(recipe.ingredients || [])
  ].join(' '));

  return ingredients.reduce((score, ingredient) => score + (searchable.includes(ingredient) ? 1 : 0), 0);
}

function formatSourceLabel(value = '') {
  return String(value || '')
    .replace(/^@+/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
}

function formatMenuCostLabel(meal, selected, costInfo) {
  if (selected) return 'In cart';

  const addCost = Number(costInfo?.addCost);
  if (Number.isFinite(addCost)) {
    return addCost < 0.01 ? 'Uses cart' : `Adds $${addCost.toFixed(2)}`;
  }

  return `Adds $${Number(meal.estimatedCost || 0).toFixed(2)}`;
}

function getScheduledDates(count, weekdaysOnly) {
  const dates = [];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() + 1);
  cursor.setHours(0, 0, 0, 0);

  while (dates.length < count) {
    const day = cursor.getDay();
    const isWeekday = day >= 1 && day <= 5;

    if (!weekdaysOnly || isWeekday) {
      dates.push(new Date(cursor));
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function buildCalendarMeals(plan) {
  const dates = getScheduledDates(plan.days.length, Boolean(plan.preferences?.weekdaysOnly));

  return (plan.days || []).flatMap((day, dayIndex) =>
    (day.meals || []).map((meal, mealIndex) => {
      const start = withMealTime(dates[dayIndex], meal.time);

      return {
        id: `${plan.id || 'cutplate'}-${day.dayNumber}-${meal.id || mealIndex}`,
        date: dates[dayIndex]?.toISOString(),
        start: start.toISOString(),
        dayNumber: day.dayNumber,
        dayLabel: day.label || `Day ${day.dayNumber}`,
        mealType: meal.mealType,
        time: meal.time,
        name: meal.name,
        calories: meal.macros?.calories || 0,
        protein: meal.macros?.protein || 0
      };
    })
  );
}

function buildStoredShoppingPlan(plan = {}) {
  return {
    savedAt: new Date().toISOString(),
    id: plan.id || `shopping-${Date.now()}`,
    summary: plan.summary || null,
    preferences: plan.preferences || null,
    groceryEstimate: plan.groceryEstimate || null,
    shoppingList: Array.isArray(plan.shoppingList) ? plan.shoppingList : [],
    safetyNote: plan.safetyNote || ''
  };
}

function hasShoppingPlan(plan) {
  const lineItems = plan?.groceryEstimate?.lineItems;
  const shoppingList = plan?.shoppingList;
  return (Array.isArray(lineItems) && lineItems.length > 0) || (Array.isArray(shoppingList) && shoppingList.length > 0);
}

function addPlanToCalendar(plan) {
  const dates = getScheduledDates(plan.days.length, Boolean(plan.preferences?.weekdaysOnly));
  const calendar = buildCalendarFile(plan, dates);
  const fileName = `cutplate-${Date.now()}.ics`;

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const blob = new Blob([calendar], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    return;
  }

  Linking.openURL(`data:text/calendar;charset=utf8,${encodeURIComponent(calendar)}`);
}

function buildCalendarFile(plan, dates) {
  const now = formatCalendarDateTime(new Date());
  const events = (plan.days || []).flatMap((day, dayIndex) =>
    (day.meals || []).map((meal, mealIndex) => {
      const start = withMealTime(dates[dayIndex], meal.time);
      const end = new Date(start.getTime() + 45 * 60 * 1000);
      const description = [
        meal.description,
        '',
        'Ingredients:',
        ...(meal.ingredients || []).map((ingredient) => `- ${ingredient}`)
      ].join('\\n');

      return [
        'BEGIN:VEVENT',
        `UID:${plan.id || 'cutplate'}-${day.dayNumber}-${mealIndex}@cutplate`,
        `DTSTAMP:${now}`,
        `DTSTART:${formatCalendarDateTime(start)}`,
        `DTEND:${formatCalendarDateTime(end)}`,
        `SUMMARY:${escapeCalendarText(`${meal.mealType}: ${meal.name}`)}`,
        `DESCRIPTION:${escapeCalendarText(description)}`,
        'END:VEVENT'
      ].join('\\r\\n');
    })
  );

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CutPlate Cardinal//Meal Plan//EN',
    'CALSCALE:GREGORIAN',
    ...events,
    'END:VCALENDAR'
  ].join('\\r\\n');
}

function withMealTime(date, time = '') {
  const next = new Date(date);
  const parsed = String(time || '').match(/(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm)?/i);
  let hours = parsed ? Number(parsed[1]) : 12;
  const minutes = parsed?.[2] ? Number(parsed[2]) : 0;
  const period = parsed?.[3]?.toLowerCase();

  if (period === 'pm' && hours < 12) hours += 12;
  if (period === 'am' && hours === 12) hours = 0;

  next.setHours(hours, minutes, 0, 0);
  return next;
}

function formatCalendarDateTime(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\\.\\d{3}Z$/, 'Z');
}

function escapeCalendarText(value = '') {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\\r?\\n/g, '\\n');
}

function formatShortDate(date) {
  if (!date) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatLongDate(date) {
  if (!date) return '';
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function TopNav({ showBack, onBack, progress }) {
  return (
    <View style={styles.topNav}>
      <View style={styles.backRow}>
        {showBack ? (
          <Pressable onPress={onBack} style={styles.backButton}>
            <ChevronLeft color={COLORS.greenDark} size={32} strokeWidth={3} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        ) : (
          <View style={styles.brandRow}>
            <SmallCardinal />
            <Text style={styles.brandText}>CutPlate Cardinal</Text>
          </View>
        )}
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
    </View>
  );
}

function GuidePrompt({ step, active }) {
  return (
    <View style={[styles.guidePrompt, step % 2 === 1 && styles.guidePromptAlt]}>
      <CardinalMascot active={active} compact />
      <View style={styles.guideBubble}>
        <Text style={styles.guideText}>{getGuideText(step)}</Text>
      </View>
    </View>
  );
}

function OnboardingScreen({
  slideIndex,
  setSlideIndex,
  name,
  setName,
  email,
  setEmail,
  onSubmit,
  isSubmitting,
  error,
  notice
}) {
  const isSignup = slideIndex >= ONBOARDING_SLIDES.length;
  const slide = ONBOARDING_SLIDES[Math.min(slideIndex, ONBOARDING_SLIDES.length - 1)];

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={KEYBOARD_DISMISS_MODE}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.onboardingScroll}
    >
      <View style={styles.onboardingHero}>
        <CardinalMascot active compact />
        <Text style={styles.homeTitle}>{isSignup ? 'Create your account.' : slide.title}</Text>
        <Text style={styles.homeSubtitle}>
          {isSignup
            ? 'Enter your name and email. We will send a confirmation email before this goes live in the store.'
            : slide.body}
        </Text>
      </View>

      {!isSignup ? (
        <>
          <View style={styles.onboardingDots}>
            {ONBOARDING_SLIDES.map((item, index) => (
              <View
                key={item.title}
                style={[styles.onboardingDot, index === slideIndex && styles.onboardingDotActive]}
              />
            ))}
          </View>
          <Pressable onPress={() => setSlideIndex((current) => current + 1)} style={styles.homePlanButton}>
            <Text style={styles.homePlanButtonText}>{slideIndex === ONBOARDING_SLIDES.length - 1 ? 'Set up account' : 'Continue'}</Text>
          </Pressable>
        </>
      ) : (
        <View style={styles.signupModule}>
          <Field label="Name">
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor="#999999"
              autoCapitalize="words"
              style={styles.cleanInput}
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={dismissKeyboard}
              {...TEXT_INPUT_DONE_PROPS}
            />
          </Field>
          <Field label="Email">
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#999999"
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.cleanInput}
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={dismissKeyboard}
              {...TEXT_INPUT_DONE_PROPS}
            />
          </Field>
          {notice ? <Text style={styles.successText}>{notice}</Text> : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <Pressable onPress={onSubmit} disabled={isSubmitting} style={[styles.homePlanButton, isSubmitting && styles.continueDisabled]}>
            {isSubmitting ? <ActivityIndicator color={COLORS.white} /> : null}
            <Text style={styles.homePlanButtonText}>{isSubmitting ? 'Sending' : 'Send confirmation email'}</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

function HomeScreen({
  viewer,
  calendarMeals,
  latestShoppingPlan,
  onViewShoppingList,
  onStartGuided,
  onStartPantry,
  onDeleteAccount
}) {
  const [deleteArmed, setDeleteArmed] = useState(false);

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={KEYBOARD_DISMISS_MODE}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.homeScroll}
    >
      <View style={styles.homeHero}>
        <CardinalMascot compact active />
        <Text style={styles.homeTitle}>What are we cooking?</Text>
        <Text style={styles.homeSubtitle}>
          {viewer?.name ? `Hi ${viewer.name}. ` : ''}Build a week from scratch, or start with what is already sitting in your kitchen.
        </Text>
      </View>

      <View style={styles.homeActionStack}>
        <Pressable onPress={onStartGuided} style={styles.homeActionPrimary}>
          <View style={styles.homeActionIcon}>
            <Sparkles color={COLORS.cardinal} size={24} />
          </View>
          <View style={styles.homeActionText}>
            <Text style={styles.homeActionTitle}>Build a meal plan</Text>
            <Text style={styles.homeActionSub}>Guided setup for days, meals, budget, macros, and grocery list.</Text>
          </View>
        </Pressable>

        <Pressable onPress={onStartPantry} style={styles.homeActionSecondary}>
          <View style={styles.homeActionIcon}>
            <UtensilsIcon />
          </View>
          <View style={styles.homeActionText}>
            <Text style={styles.homeActionTitle}>Find recipes from my pantry</Text>
            <Text style={styles.homeActionSub}>Enter what you have, then build meal ideas around those ingredients.</Text>
          </View>
        </Pressable>
      </View>

      <HomeCalendar
        meals={calendarMeals}
        latestShoppingPlan={latestShoppingPlan}
        onViewShoppingList={onViewShoppingList}
      />

      <Pressable
        onPress={() => (deleteArmed ? onDeleteAccount?.() : setDeleteArmed(true))}
        style={styles.deleteAccountButton}
      >
        <Text style={styles.deleteAccountText}>
          {deleteArmed ? 'Tap again to delete account' : 'Delete account'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function HomeCalendar({ meals = [], latestShoppingPlan, onViewShoppingList }) {
  if (!meals.length) return null;
  const hasShoppingList = hasShoppingPlan(latestShoppingPlan);

  const groups = meals.reduce((map, meal) => {
    const key = meal.date || meal.start || 'planned';
    const dateKey = key.slice(0, 10);
    if (!map.has(dateKey)) map.set(dateKey, []);
    map.get(dateKey).push(meal);
    return map;
  }, new Map());

  return (
    <View style={styles.homeCalendar}>
      <View style={styles.homeCalendarHeader}>
        <Text style={styles.cachedHomeTitle}>Meal calendar</Text>
        {hasShoppingList ? (
          <Pressable
            onPress={onViewShoppingList}
            accessibilityRole="button"
            accessibilityLabel="View shopping list"
            style={styles.homeShoppingButton}
          >
            <ShoppingCart color={COLORS.cardinal} size={17} strokeWidth={2.8} />
            <Text style={styles.homeShoppingButtonText}>List</Text>
          </Pressable>
        ) : (
          <CalendarPlus color={COLORS.cardinal} size={20} strokeWidth={2.6} />
        )}
      </View>
      {Array.from(groups.entries()).map(([dateKey, dayMeals]) => {
        const date = new Date(`${dateKey}T12:00:00`);
        const sortedMeals = [...dayMeals].sort((a, b) => String(a.start || '').localeCompare(String(b.start || '')));

        return (
          <View key={dateKey} style={styles.homeCalendarDay}>
            <Text style={styles.homeCalendarDate}>{formatLongDate(date)}</Text>
            {sortedMeals.map((meal) => (
              <View key={meal.id} style={styles.homeCalendarMeal}>
                <View style={styles.homeCalendarTime}>
                  <Text style={styles.homeCalendarTimeText}>{meal.time}</Text>
                </View>
                <View style={styles.homeCalendarText}>
                  <Text style={styles.homeCalendarMealName}>{meal.name}</Text>
                  <Text style={styles.homeCalendarMeta}>
                    {meal.mealType} - {meal.calories} cals, {meal.protein}g protein
                  </Text>
                </View>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

function ShoppingListScreen({ latestShoppingPlan, onStartGuided }) {
  const hasList = hasShoppingPlan(latestShoppingPlan);

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={KEYBOARD_DISMISS_MODE}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.homeScroll}
    >
      <View style={styles.homeHero}>
        <CardinalMascot compact active={false} />
        <Text style={styles.homeTitle}>Shopping list</Text>
        <Text style={styles.homeSubtitle}>
          {hasList ? 'Latest saved grocery list from your meal calendar.' : 'Build a meal plan to save a grocery list here.'}
        </Text>
      </View>

      {hasList ? (
        <ShoppingListModule plan={latestShoppingPlan} />
      ) : (
        <Pressable onPress={onStartGuided} style={styles.homeActionPrimary}>
          <View style={styles.homeActionIcon}>
            <Sparkles color={COLORS.cardinal} size={24} />
          </View>
          <View style={styles.homeActionText}>
            <Text style={styles.homeActionTitle}>Build a meal plan</Text>
            <Text style={styles.homeActionSub}>Pick meals first, then the grocery list will save here.</Text>
          </View>
        </Pressable>
      )}
    </ScrollView>
  );
}

function PantryFinderScreen({
  pantryIngredients,
  setPantryIngredients,
  pantryProteinInput,
  setPantryProteinInput,
  pantryPhotoUri,
  pantryDetectedIngredients,
  pantryMealType,
  setPantryMealType,
  pantryRecipes,
  onFindRecipes,
  onPickPhoto,
  onTakePhoto,
  isAnalyzingPhoto,
  isLoading,
  error,
  note
}) {
  const hasIngredients = mergeIngredientText(pantryIngredients, splitRawIngredients(pantryProteinInput)).trim().length > 0;

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={KEYBOARD_DISMISS_MODE}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.homeScroll}
    >
      <View style={styles.homeHero}>
        <View style={styles.menuGuideRow}>
          <CardinalMascot compact active={false} />
          <View style={styles.guideBubble}>
            <Text style={styles.guideText}>Tell me what you already have. I will build meals from those items plus small seasonings or sauces.</Text>
          </View>
        </View>
        <Text style={styles.homeTitle}>What is in your pantry?</Text>
      </View>

      <View style={styles.photoActionRow}>
        <Pressable
          onPress={onTakePhoto}
          disabled={isAnalyzingPhoto || isLoading}
          style={[styles.photoActionButton, (isAnalyzingPhoto || isLoading) && styles.continueDisabled]}
        >
          <Camera color={COLORS.cardinal} size={22} strokeWidth={2.8} />
          <Text style={styles.photoActionText}>Snap pantry</Text>
        </Pressable>
        <Pressable
          onPress={onPickPhoto}
          disabled={isAnalyzingPhoto || isLoading}
          style={[styles.photoActionButton, (isAnalyzingPhoto || isLoading) && styles.continueDisabled]}
        >
          <ImagePlus color={COLORS.cardinal} size={22} strokeWidth={2.8} />
          <Text style={styles.photoActionText}>Choose photo</Text>
        </Pressable>
      </View>

      {pantryPhotoUri ? (
        <View style={styles.pantryPhotoPanel}>
          <Image source={{ uri: pantryPhotoUri }} style={styles.pantryPhotoPreview} />
          <View style={styles.pantryPhotoText}>
            <Text style={styles.cachedHomeTitle}>{isAnalyzingPhoto ? 'Reading your pantry' : 'Photo scanned'}</Text>
            <Text style={styles.cachedEmpty}>
              {isAnalyzingPhoto ? 'I am identifying visible ingredients.' : 'Review the ingredients below before finding meals.'}
            </Text>
          </View>
        </View>
      ) : null}

      {pantryDetectedIngredients.length ? (
        <View style={styles.detectedIngredientPanel}>
          <Text style={styles.cachedHomeTitle}>Detected ingredients</Text>
          <View style={styles.detectedIngredientList}>
            {pantryDetectedIngredients.map((ingredient) => (
              <Text key={`${ingredient.name}-${ingredient.category}`} style={styles.detectedIngredientPill}>
                {ingredient.name}
              </Text>
            ))}
          </View>
        </View>
      ) : null}

      <Field label="Pantry or fridge ingredients">
        <TextInput
          value={pantryIngredients}
          onChangeText={setPantryIngredients}
          placeholder="Example: chicken, rice, broccoli, salsa"
          placeholderTextColor="#999999"
          style={styles.cleanInput}
          returnKeyType="done"
          blurOnSubmit
          onSubmitEditing={dismissKeyboard}
          {...TEXT_INPUT_DONE_PROPS}
        />
      </Field>

      <Field label="Protein to include">
        <TextInput
          value={pantryProteinInput}
          onChangeText={setPantryProteinInput}
          placeholder="Example: chicken breast, steak, tofu, eggs"
          placeholderTextColor="#999999"
          style={styles.cleanInput}
          returnKeyType="done"
          blurOnSubmit
          onSubmitEditing={dismissKeyboard}
          {...TEXT_INPUT_DONE_PROPS}
        />
      </Field>

      <View style={styles.pantryTypeRow}>
        {['Breakfast', 'Lunch', 'Dinner', 'Snack'].map((mealType) => (
          <PillOption
            key={mealType}
            label={mealType}
            selected={pantryMealType === mealType}
            onPress={() => setPantryMealType(mealType)}
          />
        ))}
      </View>

      <Pressable
        onPress={onFindRecipes}
        disabled={!hasIngredients || isLoading || isAnalyzingPhoto}
        style={[styles.homePlanButton, (!hasIngredients || isLoading || isAnalyzingPhoto) && styles.continueDisabled]}
      >
        {isLoading ? <ActivityIndicator color={COLORS.white} /> : null}
        <Text style={styles.homePlanButtonText}>
          {isLoading ? 'Building meals' : isAnalyzingPhoto ? 'Reading photo' : 'Find meals from pantry'}
        </Text>
      </Pressable>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {note && pantryRecipes.length ? <Text style={styles.pantryNote}>{note}</Text> : null}

      <PantryRecipeResults
        hasIngredients={hasIngredients}
        recipes={pantryRecipes}
        isLoading={isLoading}
      />
    </ScrollView>
  );
}

function PantryRecipeResults({ hasIngredients, recipes = [], isLoading }) {
  if (!hasIngredients) {
    return (
      <View style={styles.pantryEmptyPanel}>
        <Text style={styles.cachedHomeTitle}>Start with ingredients</Text>
        <Text style={styles.cachedEmpty}>Example: chicken breast, rice, broccoli, salsa.</Text>
      </View>
    );
  }

  if (isLoading) return null;

  if (!recipes.length) {
    return (
      <View style={styles.pantryEmptyPanel}>
        <Text style={styles.cachedHomeTitle}>No pantry meals yet</Text>
        <Text style={styles.cachedEmpty}>Tap Find meals from pantry and I will build options from what you entered.</Text>
      </View>
    );
  }

  return (
    <View style={styles.pantryResults}>
      <Text style={styles.cachedHomeTitle}>Pantry meals</Text>
      {recipes.map((recipe) => (
        <View key={recipe.id || recipe.name} style={styles.pantryRecipeCard}>
          <View style={styles.recipeTop}>
            <View style={styles.recipeTitleBlock}>
              <Text style={styles.recipeType}>{recipe.mealType}</Text>
              <Text style={styles.pantryRecipeName}>{recipe.name}</Text>
            </View>
            <Text style={styles.ratingPill}>{recipe.macroRating || 'FIT'}</Text>
          </View>
          <Text style={styles.recipeDescription}>{recipe.description}</Text>
          <View style={styles.macroRow}>
            <Macro label="Cals" value={recipe.macros?.calories || 0} />
            <Macro label="P" value={`${recipe.macros?.protein || 0}g`} />
            <Macro label="C" value={`${recipe.macros?.carbs || 0}g`} />
            <Macro label="F" value={`${recipe.macros?.fat || 0}g`} />
          </View>
          <Text style={styles.moduleTitle}>Ingredients</Text>
          {(recipe.ingredients || []).map((ingredient) => (
            <Text key={ingredient} style={styles.recipeText}>{ingredient}</Text>
          ))}
          <Text style={styles.moduleTitle}>Steps</Text>
          {(recipe.steps || []).map((step, index) => (
            <Text key={step} style={styles.recipeText}>{index + 1}. {step}</Text>
          ))}
          {recipe.sources?.length ? (
            <View style={styles.sourceRow}>
              {recipe.sources.map((source) => (
                <Pressable key={source.url || source.label} onPress={() => source.url && Linking.openURL(source.url)} style={styles.sourcePill}>
                  <Text style={styles.sourceText}>{formatSourceLabel(source.label)}</Text>
                  <ExternalLink color={COLORS.cardinal} size={13} />
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function DaysStep({ days, setDays, weekdaysOnly, setWeekdaysOnly }) {
  return (
    <View style={styles.stack}>
      <View style={styles.segmentRow}>
        <Pressable
          onPress={() => setWeekdaysOnly(false)}
          style={[styles.segmentButton, !weekdaysOnly && styles.segmentSelected]}
        >
          <Text style={[styles.segmentText, !weekdaysOnly && styles.segmentTextSelected]}>Any days</Text>
        </Pressable>
        <Pressable
          onPress={() => setWeekdaysOnly(true)}
          style={[styles.segmentButton, weekdaysOnly && styles.segmentSelected]}
        >
          <Text style={[styles.segmentText, weekdaysOnly && styles.segmentTextSelected]}>Weekdays only</Text>
        </Pressable>
      </View>
      <View style={styles.choiceGrid}>
        {DAY_OPTIONS.map((option) => (
          <PillOption
            key={option}
            label={`${option} days`}
            selected={days === option}
            onPress={() => setDays(option)}
          />
        ))}
      </View>
    </View>
  );
}

function ProteinStep({ selectedProteins, toggleProtein, customProtein, setCustomProtein, addCustomProtein }) {
  return (
    <View style={styles.stack}>
      <View style={styles.choiceGrid}>
        {PROTEIN_OPTIONS.map((protein) => (
          <PillOption
            key={protein}
            label={protein}
            selected={selectedProteins.includes(protein)}
            onPress={() => toggleProtein(protein)}
          />
        ))}
      </View>
      <View style={styles.inputRow}>
        <TextInput
          value={customProtein}
          onChangeText={setCustomProtein}
          placeholder="Add your own"
          placeholderTextColor="#999999"
          style={styles.cleanInput}
          returnKeyType="done"
          blurOnSubmit
          onSubmitEditing={() => {
            addCustomProtein();
            dismissKeyboard();
          }}
          {...TEXT_INPUT_DONE_PROPS}
        />
        <Pressable onPress={addCustomProtein} style={styles.plusButton}>
          <Plus color={COLORS.white} size={22} strokeWidth={3} />
        </Pressable>
      </View>
    </View>
  );
}

function MealCountStep({ mealCount, setMealsPerDay }) {
  return (
    <View style={styles.largeChoiceStack}>
      {MEAL_COUNT_OPTIONS.map((option) => (
        <Pressable
          key={option.value}
          onPress={() => setMealsPerDay(option.value)}
          style={[styles.largeChoice, mealCount === option.value && styles.largeChoiceSelected]}
        >
          <Text style={styles.largeChoiceTitle}>{option.title} per day</Text>
          <Text style={styles.largeChoiceSub}>{option.subtitle}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function MealsStep({ mealSlots, updateMealSlot }) {
  return (
    <View style={styles.stack}>
      <View style={styles.sourceIntro}>
        <UtensilsIcon />
        <Text style={styles.sourceIntroText}>Turn meals on or off here. The plan, grocery list, and cost estimate update from these choices.</Text>
      </View>
      {mealSlots.map((slot) => (
        <View key={slot.type} style={[styles.mealRow, slot.enabled && styles.mealRowSelected]}>
          <Pressable
            onPress={() => updateMealSlot(slot.type, { enabled: !slot.enabled })}
            style={[styles.roundCheck, slot.enabled && styles.roundCheckSelected]}
          >
            {slot.enabled ? <Check color={COLORS.white} size={18} strokeWidth={3} /> : null}
          </Pressable>
          <View style={styles.mealNameBlock}>
            <Text style={styles.mealName}>{slot.type}</Text>
            <View style={styles.miniMetaRow}>
              <Clock color="#707070" size={14} />
              <TextInput
                value={slot.time}
                onChangeText={(time) => updateMealSlot(slot.type, { time })}
                placeholder="Time"
                placeholderTextColor="#777777"
                style={styles.timeInput}
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={dismissKeyboard}
                {...TEXT_INPUT_DONE_PROPS}
              />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

function AllergiesStep({ allergies, toggleAllergy }) {
  return (
    <View style={styles.choiceGrid}>
      {ALLERGY_OPTIONS.map((allergy) => (
        <PillOption
          key={allergy}
          label={allergy}
          selected={allergies.includes(allergy)}
          onPress={() => toggleAllergy(allergy)}
        />
      ))}
    </View>
  );
}

function ServingsStep({ servingsPerMeal, setServingsPerMeal }) {
  return (
    <View style={styles.largeChoiceStack}>
      {SERVING_OPTIONS.map((option) => (
        <Pressable
          key={option.value}
          onPress={() => setServingsPerMeal(option.value)}
          style={[styles.largeChoice, servingsPerMeal === option.value && styles.largeChoiceSelected]}
        >
          <Text style={styles.largeChoiceTitle}>{option.title}</Text>
          <Text style={styles.largeChoiceSub}>{option.subtitle}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function GoalStep({
  dietStyle,
  setDietStyle,
  calorieTarget,
  setCalorieTarget,
  enabledSlots,
  servingsPerMeal,
  avoidIngredients,
  setAvoidIngredients,
  pantryIngredients,
  setPantryIngredients
}) {
  const dailyTarget = getDailyCalorieTarget(calorieTarget, enabledSlots.length);
  const cookedTarget = getCookedDailyCalorieTarget(calorieTarget, enabledSlots.length, servingsPerMeal);

  return (
    <View style={styles.stack}>
      <View style={styles.choiceGrid}>
        {DIET_STYLES.map((style) => (
          <PillOption key={style} label={style} selected={dietStyle === style} onPress={() => setDietStyle(style)} />
        ))}
      </View>
      <Field label="Cals per meal, 1 serving">
        <TextInput
          value={calorieTarget}
          onChangeText={setCalorieTarget}
          keyboardType="number-pad"
          placeholder="600"
          placeholderTextColor="#999999"
          style={styles.cleanInput}
          returnKeyType="done"
          blurOnSubmit
          onSubmitEditing={dismissKeyboard}
          {...TEXT_INPUT_DONE_PROPS}
        />
      </Field>
      <Text style={styles.calorieTargetHint}>
        {dailyTarget > 0
          ? `${dailyTarget} cals/day per serving, ${cookedTarget} cals/day cooked for ${servingsPerMeal} serving${servingsPerMeal === 1 ? '' : 's'}.`
          : 'Enter a target for each meal serving.'}
      </Text>
      <Field label="Extra avoids">
        <TextInput
          value={avoidIngredients}
          onChangeText={setAvoidIngredients}
          placeholder="Example: mushrooms, cilantro"
          placeholderTextColor="#999999"
          style={styles.cleanInput}
          returnKeyType="done"
          blurOnSubmit
          onSubmitEditing={dismissKeyboard}
          {...TEXT_INPUT_DONE_PROPS}
        />
      </Field>
      <Field label="Already in your pantry or fridge">
        <TextInput
          value={pantryIngredients}
          onChangeText={setPantryIngredients}
          placeholder="Example: rice, broccoli, salsa, Greek yogurt"
          placeholderTextColor="#999999"
          style={styles.cleanInput}
          returnKeyType="done"
          blurOnSubmit
          onSubmitEditing={dismissKeyboard}
          {...TEXT_INPUT_DONE_PROPS}
        />
      </Field>
    </View>
  );
}

function LocationStep({ shoppingLocation, setShoppingLocation }) {
  return (
    <View style={styles.stack}>
      <View style={styles.sourceIntro}>
        <MapPin color={COLORS.cardinal} size={22} strokeWidth={2.6} />
        <Text style={styles.sourceIntroText}>Use a ZIP code or city/state for a grocery cost estimate. Leave it blank for a national average.</Text>
      </View>
      <TextInput
        value={shoppingLocation}
        onChangeText={setShoppingLocation}
        placeholder="ZIP or city, state"
        placeholderTextColor="#999999"
        style={styles.cleanInput}
        autoCapitalize="words"
        returnKeyType="done"
        blurOnSubmit
        onSubmitEditing={dismissKeyboard}
        {...TEXT_INPUT_DONE_PROPS}
      />
      <View style={styles.estimateHint}>
        <DollarSign color={COLORS.greenDark} size={20} strokeWidth={2.6} />
        <Text style={styles.estimateHintText}>The estimate is built from selected meals, servings, ingredients, and regional pricing.</Text>
      </View>
    </View>
  );
}

function BudgetPreferenceStep({ budgetTarget, setBudgetTarget }) {
  const budget = Number(budgetTarget || 0);

  return (
    <View style={styles.stack}>
      <View style={styles.estimateHint}>
        <DollarSign color={COLORS.greenDark} size={20} strokeWidth={2.6} />
        <Text style={styles.estimateHintText}>
          Lower budgets favor cheaper staples. Higher budgets allow more premium proteins.
        </Text>
      </View>
      <Field label="Grocery budget">
        <TextInput
          value={budgetTarget}
          onChangeText={setBudgetTarget}
          keyboardType="number-pad"
          placeholder="75"
          placeholderTextColor="#999999"
          style={styles.cleanInput}
          returnKeyType="done"
          blurOnSubmit
          onSubmitEditing={dismissKeyboard}
          {...TEXT_INPUT_DONE_PROPS}
        />
      </Field>
      <View style={styles.budgetStatus}>
        <Text style={styles.budgetStatusText}>
          {Number.isFinite(budget) && budget > 0 ? `$${budget.toFixed(2)} target` : 'Enter a budget to continue'}
        </Text>
      </View>
      <View style={styles.quickBudgetRow}>
        {[50, 75, 100, 150].map((amount) => (
          <Pressable key={amount} onPress={() => setBudgetTarget(String(amount))} style={styles.quickBudget}>
            <Text style={styles.quickBudgetText}>${amount}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function SourcesStep({ socialSourcesEnabled, setSocialSourcesEnabled }) {
  return (
    <View style={styles.stack}>
      <View style={styles.sourceIntro}>
        <Sparkles color={COLORS.cardinal} size={20} />
        <Text style={styles.sourceIntroText}>Use public social recipe inspiration for discovery and style, not copied posts.</Text>
      </View>
      <View style={styles.choiceGrid}>
        <PillOption
          label="Yes, use social recipes"
          selected={socialSourcesEnabled}
          onPress={() => setSocialSourcesEnabled(true)}
        />
        <PillOption
          label="No, keep it general"
          selected={!socialSourcesEnabled}
          onPress={() => setSocialSourcesEnabled(false)}
        />
      </View>
    </View>
  );
}

function ReviewStep({
  days,
  weekdaysOnly,
  selectedProteins,
  enabledSlots,
  allergies,
  servingsPerMeal,
  dietStyle,
  calorieTarget,
  pantryIngredients,
  budgetTarget,
  shoppingLocation,
  sourceHandles
}) {
  return (
    <View style={styles.reviewStack}>
      <SummaryLine label="Length" value={`${days} days${weekdaysOnly ? ', weekdays only' : ''}`} />
      <SummaryLine label="Proteins" value={selectedProteins.join(', ')} />
      <SummaryLine label="Meals" value={enabledSlots.map((slot) => `${slot.type} ${slot.time}`).join(', ')} />
      <SummaryLine label="Servings" value={`${servingsPerMeal} per meal`} />
      <SummaryLine label="Allergies" value={allergies.length ? allergies.join(', ') : 'None selected'} />
      <SummaryLine
        label="Goal"
        value={`${dietStyle}, ${formatCalorieTargetSummary(calorieTarget, enabledSlots.length, servingsPerMeal)}`}
      />
      <SummaryLine label="Pantry/fridge" value={pantryIngredients.trim() || 'Nothing entered'} />
      <SummaryLine label="Budget" value={`$${Number(budgetTarget || 0).toFixed(2)}`} />
      <SummaryLine label="Location" value={shoppingLocation || 'National average'} />
      <SummaryLine
        label="Social recipes"
        value={sourceHandles.length ? 'Yes, include social media inspiration' : 'No, keep it general'}
      />
    </View>
  );
}

function UtensilsIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path d="M7 2 V10 M4 2 V10 M10 2 V10 M4 10 C4 12 5.3 13.5 7 13.5 C8.7 13.5 10 12 10 10 M7 13.5 V22" stroke={COLORS.cardinal} strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <Path d="M16 2 C19 4 20 7 19 11 C18.5 13 17.3 14.2 15.8 14.8 V22 M16 2 V22" stroke={COLORS.cardinal} strokeWidth="2.4" strokeLinecap="round" fill="none" />
    </Svg>
  );
}

function PillOption({ label, selected, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.pillOption, selected && styles.pillSelected]}>
      <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function Field({ label, children }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function SummaryLine({ label, value }) {
  return (
    <View style={styles.summaryLine}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function BottomAction({ label, onPress, isLoading, disabled }) {
  return (
    <View style={styles.bottomBar}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.continueButton,
          pressed && !disabled && styles.continuePressed,
          disabled && styles.continueDisabled
        ]}
      >
        {isLoading ? <ActivityIndicator color={COLORS.white} /> : null}
        <Text style={styles.continueText}>{isLoading ? 'Chirping...' : label}</Text>
      </Pressable>
    </View>
  );
}

function MenuBuilderScreen({
  plan,
  warnings,
  targetSlots,
  mealOptions,
  selectedMealIds,
  selectedCounts,
  mealTypeRequirements,
  toggleLibraryMeal,
  selectedMealCount,
  liveMenuEstimate,
  menuPricing,
  budgetAmount,
  budgetRemaining,
  onContinue,
  isEstimating,
  error
}) {
  const mealTypes = Object.keys(mealTypeRequirements).sort(sortMealTypes);
  const allRequirementsMet = areMealRequirementsMet(mealTypeRequirements, selectedCounts);
  const isOverBudget = budgetAmount > 0 && budgetRemaining < 0;
  const marginalCosts = menuPricing?.marginalCosts || {};
  const budgetLabel = budgetAmount > 0
    ? `$${Math.abs(budgetRemaining || 0).toFixed(2)} ${isOverBudget ? 'over' : 'left'}`
    : 'Set a budget';

  return (
    <View style={styles.menuShell}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={KEYBOARD_DISMISS_MODE}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.menuScroll}
      >
        <View style={styles.menuHero}>
          <View style={styles.menuGuideRow}>
            <CardinalMascot active={isEstimating} compact />
            <View style={styles.guideBubble}>
              <Text style={styles.guideText}>These options were shaped around your budget. Pick what sounds good, then I will fit it into days.</Text>
            </View>
          </View>
          <Text style={styles.resultTitle}>Build your menu.</Text>
          <Text style={styles.resultSubtitle}>
            {selectedMealCount} of {targetSlots.length} recipes selected from {mealOptions.length} options.
          </Text>
        </View>

        <View style={[styles.budgetMeter, isOverBudget && styles.budgetMeterOver]}>
          <View>
            <Text style={styles.budgetMeterLabel}>Budget left</Text>
            <Text style={styles.budgetMeterValue}>{budgetLabel}</Text>
          </View>
          <View style={styles.budgetMeterRight}>
            <Text style={styles.budgetMeterMeta}>Used ${liveMenuEstimate.toFixed(2)}</Text>
            <Text style={styles.budgetMeterMeta}>Budget ${budgetAmount || 0}</Text>
          </View>
        </View>

        {warnings.map((warning) => (
          <Text key={warning} style={styles.warningText}>
            {warning}
          </Text>
        ))}

        <View style={styles.menuCards}>
          {mealTypes.map((mealType) => {
            const required = mealTypeRequirements[mealType] || 0;
            const selectedForType = selectedCounts[mealType] || 0;
            const optionsForType = mealOptions.filter((meal) => meal.mealType === mealType);

            return (
              <View key={mealType} style={styles.menuDay}>
                <View style={styles.categoryHeader}>
                  <Text style={styles.menuDayTitle}>{mealType}</Text>
                  <Text style={styles.categoryCount}>
                    {selectedForType}/{required} max
                  </Text>
                </View>
                <View style={styles.optionStack}>
                  {optionsForType.map((meal) => {
                    const selected = selectedMealIds.includes(meal.optionKey);
                    const capped = !selected && selectedForType >= required;
                    const costInfo = marginalCosts[meal.optionKey];

                    return (
                      <Pressable
                        key={meal.optionKey}
                        onPress={() => toggleLibraryMeal(meal)}
                        disabled={capped}
                        style={[
                          styles.menuMealCard,
                          selected && styles.menuMealCardSelected,
                          capped && styles.menuMealCardDisabled
                        ]}
                      >
                        <View style={[styles.menuCheck, selected && styles.menuCheckSelected]}>
                          {selected ? <Check color={COLORS.white} size={17} strokeWidth={3} /> : null}
                        </View>
                        <View style={styles.menuMealBody}>
                          <Text style={styles.menuMealName}>{meal.name}</Text>
                          <Text style={styles.menuMealDesc} numberOfLines={2}>
                            {meal.description}
                          </Text>
                          <View style={styles.mealCostRow}>
                            <Text style={styles.menuMealMacros}>
                              {meal.macros?.calories || 0} cals, {meal.macros?.protein || 0}g protein
                            </Text>
                            <Text style={styles.mealCost}>{formatMenuCostLabel(meal, selected, costInfo)}</Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>
      <View style={styles.bottomBar}>
        <Pressable
          onPress={onContinue}
          disabled={!allRequirementsMet || isEstimating}
          style={[styles.continueButton, (!allRequirementsMet || isEstimating) && styles.continueDisabled]}
        >
          {isEstimating ? <ActivityIndicator color={COLORS.white} /> : null}
          <Text style={styles.continueText}>{isEstimating ? 'Fitting menu' : 'Fit into days'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ResultScreen({
  plan,
  warnings,
  activeDay,
  selectedDay,
  setSelectedDay,
  onRegenerate,
  onSwapMeal,
  onAddToCalendar,
  isLoading,
  isEstimating,
  error
}) {
  const groceryEstimate = plan.groceryEstimate;
  const scheduledDates = getScheduledDates(plan.days.length, Boolean(plan.preferences?.weekdaysOnly));
  const activeDate = scheduledDates[selectedDay];

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={KEYBOARD_DISMISS_MODE}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.resultScroll}
    >
      <View style={styles.resultHero}>
        <View style={styles.menuGuideRow}>
          <CardinalMascot active={isLoading} compact />
          <View style={styles.guideBubble}>
            <Text style={styles.guideText}>Nice. Your selected menu is set, and these recipes match the grocery estimate.</Text>
          </View>
        </View>
        <Text style={styles.resultTitle}>Your plan is ready.</Text>
        <Text style={styles.resultSubtitle}>
          {plan.summary.totalMeals} meals, {plan.preferences?.servingsPerMeal || 2} servings each.
        </Text>
      </View>

      <View style={styles.metricRow}>
        <Metric label="Avg cals" value={plan.summary.averageCalories} />
        <Metric label="Protein" value={`${plan.summary.averageProtein}g`} />
        <Metric label="Groceries" value={groceryEstimate ? `$${Math.round(groceryEstimate.estimatedTotal)}` : 'TBD'} />
      </View>

      <Pressable onPress={() => onAddToCalendar?.(plan)} style={styles.calendarButton}>
        <CalendarPlus color={COLORS.white} size={20} strokeWidth={2.8} />
        <Text style={styles.calendarButtonText}>Add to calendar</Text>
      </Pressable>

      <ShoppingListModule plan={plan} />

      {warnings.map((warning) => (
        <Text key={warning} style={styles.warningText}>
          {warning}
        </Text>
      ))}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayTabs}>
        {plan.days.map((day, index) => (
          <Pressable
            key={day.dayNumber}
            onPress={() => setSelectedDay(index)}
            style={[styles.dayTab, selectedDay === index && styles.dayTabSelected]}
          >
            <Text style={[styles.dayTabText, selectedDay === index && styles.dayTabTextSelected]}>
              Day {day.dayNumber}
            </Text>
            <Text style={[styles.dayTabDate, selectedDay === index && styles.dayTabTextSelected]}>
              {formatShortDate(scheduledDates[index])}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {activeDay ? (
        <View style={styles.dayModule}>
          <View style={styles.dayHeader}>
            <Text style={styles.dayTitle}>{activeDay.label}</Text>
            {activeDate ? <Text style={styles.dayDate}>{formatLongDate(activeDate)}</Text> : null}
            <Text style={styles.dayMacros}>
              {activeDay.totals.calories} cals, {activeDay.totals.protein}g protein
            </Text>
          </View>
          {activeDay.meals.map((meal) => (
            <RecipeModule
              key={meal.id}
              meal={meal}
              onSwap={() => onSwapMeal?.(activeDay.dayNumber, meal.id)}
              isSwapping={isEstimating}
            />
          ))}
        </View>
      ) : null}

      <Text style={styles.safetyText}>{plan.safetyNote}</Text>
      <Pressable onPress={onRegenerate} disabled={isLoading} style={styles.regenerateButton}>
        {isLoading ? <ActivityIndicator color={COLORS.cardinal} /> : <RefreshCw color={COLORS.cardinal} size={18} />}
        <Text style={styles.regenerateText}>Regenerate</Text>
      </Pressable>
    </ScrollView>
  );
}

function ShoppingListModule({ plan }) {
  const groceryEstimate = plan?.groceryEstimate;
  const shoppingList = Array.isArray(plan?.shoppingList) ? plan.shoppingList : [];
  const lineItems = Array.isArray(groceryEstimate?.lineItems) ? groceryEstimate.lineItems : [];

  if (!lineItems.length && !shoppingList.length) return null;

  return (
    <View style={styles.shoppingModule}>
      <View style={styles.shoppingHeader}>
        <View style={styles.shoppingHeaderText}>
          <Text style={styles.moduleTitle}>Shopping list</Text>
          {groceryEstimate ? (
            <Text style={styles.estimateRange}>
              {groceryEstimate.location}: ${groceryEstimate.rangeLow} - ${groceryEstimate.rangeHigh}
            </Text>
          ) : null}
        </View>
        {groceryEstimate ? (
          <Text style={styles.estimateTotal}>${groceryEstimate.estimatedTotal}</Text>
        ) : null}
      </View>
      {lineItems.length ? (
        <View style={styles.costList}>
          {lineItems.map((item, index) => (
            <View key={`${item.name || 'item'}-${index}`} style={styles.costItem}>
              <View style={styles.costItemText}>
                <Text style={styles.costName}>{item.name}</Text>
                <Text style={styles.costQuantity}>{item.quantityLabel}</Text>
              </View>
              <Text style={styles.costPrice}>${item.estimatedCost}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.shoppingList}>
          {shoppingList.slice(0, 22).map((item, index) => (
            <Text key={`${item}-${index}`} style={styles.shoppingItem}>
              {item}
            </Text>
          ))}
        </View>
      )}
      {groceryEstimate?.note ? <Text style={styles.estimateNote}>{groceryEstimate.note}</Text> : null}
    </View>
  );
}

function Metric({ label, value }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function RecipeModule({ meal, onSwap, isSwapping }) {
  return (
    <View style={styles.recipeModule}>
      <View style={styles.recipeTop}>
        <View style={styles.recipeTitleBlock}>
          <Text style={styles.recipeType}>
            {meal.mealType} at {meal.time}
          </Text>
          <Text style={styles.recipeName}>{meal.name}</Text>
        </View>
        <Text style={styles.ratingPill}>{meal.macroRating}</Text>
      </View>
      <Text style={styles.recipeDescription}>{meal.description}</Text>
      <View style={styles.macroRow}>
        <Macro label="Cals" value={meal.macros.calories} />
        <Macro label="P" value={`${meal.macros.protein}g`} />
        <Macro label="C" value={`${meal.macros.carbs}g`} />
        <Macro label="F" value={`${meal.macros.fat}g`} />
      </View>
      <Text style={styles.moduleTitle}>Ingredients</Text>
      {(meal.ingredients || []).map((ingredient) => (
        <Text key={ingredient} style={styles.recipeText}>
          {ingredient}
        </Text>
      ))}
      <Text style={styles.moduleTitle}>Steps</Text>
      {(meal.steps || []).map((step, index) => (
        <Text key={step} style={styles.recipeText}>
          {index + 1}. {step}
        </Text>
      ))}
      <View style={styles.sourceRow}>
        {(meal.sources || []).map((source) => (
          <Pressable key={source.url} onPress={() => Linking.openURL(source.url)} style={styles.sourcePill}>
            <Text style={styles.sourceText}>{formatSourceLabel(source.label)}</Text>
            <ExternalLink color={COLORS.cardinal} size={13} />
          </Pressable>
        ))}
      </View>
      {onSwap ? (
        <Pressable onPress={onSwap} disabled={isSwapping} style={styles.swapButton}>
          {isSwapping ? <ActivityIndicator color={COLORS.cardinal} /> : <RefreshCw color={COLORS.cardinal} size={16} />}
          <Text style={styles.swapButtonText}>Sub out recipe</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Macro({ label, value }) {
  return (
    <View style={styles.macro}>
      <Text style={styles.macroValue}>{value}</Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

function CardinalMascot({ active = false, compact = false }) {
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: 1,
          duration: active ? 420 : 850,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: active ? 420 : 850,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true
        })
      ])
    );

    bobLoop.start();
    return () => {
      bobLoop.stop();
    };
  }, [active, bob]);

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -7] });
  const translateX = bob.interpolate({ inputRange: [0, 1], outputRange: [0, active ? 7 : 3] });
  const rotate = bob.interpolate({ inputRange: [0, 1], outputRange: ['-2deg', '3deg'] });
  const size = compact ? 76 : 104;

  return (
    <View style={[styles.cardinalWrap, compact && styles.cardinalWrapCompact]}>
      <Animated.View
        style={{
          transform: [{ translateX }, { translateY }, { rotate }]
        }}
      >
        <Svg width={size * 1.24} height={size * 0.92} viewBox="0 0 180 132">
          <Path d="M107 77 C126 76 148 79 170 89 C146 100 124 98 102 88 Z" fill={COLORS.cardinalDark} />
          <Path d="M104 83 C124 83 145 85 160 91 C139 94 121 93 100 89 Z" fill="#df2637" />
          <Path d="M51 64 C51 38 72 22 95 29 C119 36 130 61 119 84 C107 110 73 113 57 92 C52 85 50 75 51 64 Z" fill={COLORS.cardinal} />
          <Path d="M63 32 L58 3 L76 25 L82 4 L88 31 C79 25 70 25 63 32 Z" fill={COLORS.cardinal} />
          <Path d="M54 50 C63 35 82 34 94 45 C84 47 76 55 72 68 C61 66 54 60 54 50 Z" fill="#211817" />
          <Path d="M55 57 L11 69 L56 79 Z" fill={COLORS.beak} />
          <Path d="M52 70 L11 69 L55 76 Z" fill="#cc7c17" />
          <Circle cx="76" cy="45" r="7" fill={COLORS.white} />
          <Circle cx="75" cy="46" r="3.5" fill={COLORS.ink} />
          <Circle cx="73.8" cy="44.3" r="1.1" fill={COLORS.white} />
          <Path d="M79 67 C93 64 105 72 112 84 C100 95 78 98 62 88 C66 79 71 71 79 67 Z" fill="#ec3747" />
          <Path d="M83 78 C94 82 103 82 112 77 M78 88 C91 92 103 90 114 83" stroke="#a91625" strokeWidth="3" strokeLinecap="round" fill="none" />
          <Path d="M72 103 L65 127 M91 104 L93 127" stroke="#9b5b28" strokeWidth="4.5" strokeLinecap="round" />
          <Path d="M63 127 L53 130 M65 127 L75 127 M93 127 L84 130 M94 127 L105 127" stroke="#9b5b28" strokeWidth="3.8" strokeLinecap="round" />
        </Svg>
      </Animated.View>
    </View>
  );
}

function SmallCardinal() {
  return (
    <Svg width={36} height={28} viewBox="0 0 90 66">
      <Path d="M53 38 C62 38 74 40 84 45 C72 50 61 48 51 43 Z" fill={COLORS.cardinalDark} />
      <Path d="M25 33 C25 20 36 12 48 15 C60 18 66 31 60 43 C54 56 37 57 29 47 C26 43 25 38 25 33 Z" fill={COLORS.cardinal} />
      <Path d="M31 17 L29 3 L38 14 L42 3 L45 17 C40 14 35 14 31 17 Z" fill={COLORS.cardinal} />
      <Path d="M27 26 C32 18 42 18 49 24 C43 25 39 29 37 36 C31 35 27 31 27 26 Z" fill="#211817" />
      <Path d="M28 30 L6 36 L29 41 Z" fill={COLORS.beak} />
      <Circle cx="39" cy="24" r="3.2" fill={COLORS.white} />
      <Circle cx="38.5" cy="24.4" r="1.7" fill={COLORS.ink} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white
  },
  phoneFrame: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    backgroundColor: COLORS.white
  },
  topNav: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 10
  },
  backRow: {
    minHeight: 44,
    justifyContent: 'center'
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginLeft: -7
  },
  backText: {
    color: COLORS.greenDark,
    fontSize: 28,
    fontWeight: '500',
    marginLeft: -6
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  brandText: {
    color: COLORS.ink,
    fontSize: 18,
    fontWeight: '800'
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#f2f2f2',
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 6
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.cardinal,
    borderRadius: 999
  },
  stepScroll: {
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 132
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 22
  },
  loadingText: {
    color: COLORS.muted,
    fontSize: 16,
    fontWeight: '800'
  },
  onboardingScroll: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 86
  },
  onboardingHero: {
    marginBottom: 22
  },
  onboardingDots: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18
  },
  onboardingDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: COLORS.pale
  },
  onboardingDotActive: {
    width: 30,
    backgroundColor: COLORS.cardinal
  },
  signupModule: {
    gap: 14
  },
  homeScroll: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 64
  },
  homeHero: {
    marginBottom: 18
  },
  homeTitle: {
    color: COLORS.ink,
    fontSize: 43,
    lineHeight: 50,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 8
  },
  homeSubtitle: {
    color: COLORS.muted,
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '700',
    marginTop: 8
  },
  homeActionStack: {
    gap: 12,
    marginBottom: 18
  },
  homeActionPrimary: {
    minHeight: 118,
    borderRadius: 20,
    backgroundColor: '#fff8df',
    borderWidth: 2,
    borderColor: '#f1df9b',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18
  },
  homeActionSecondary: {
    minHeight: 118,
    borderRadius: 20,
    backgroundColor: COLORS.pale,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18
  },
  homeActionIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center'
  },
  homeActionText: {
    flex: 1
  },
  homeActionTitle: {
    color: COLORS.ink,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900'
  },
  homeActionSub: {
    color: COLORS.muted,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
    marginTop: 4
  },
  homePlanButton: {
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 16
  },
  homePlanButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '900'
  },
  homeCalendar: {
    backgroundColor: COLORS.pale2,
    borderRadius: 20,
    padding: 16,
    gap: 14,
    marginTop: 4
  },
  homeCalendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  homeShoppingButton: {
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  homeShoppingButtonText: {
    color: COLORS.cardinal,
    fontSize: 13,
    fontWeight: '900'
  },
  homeCalendarDay: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 12,
    gap: 10
  },
  homeCalendarDate: {
    color: COLORS.cardinal,
    fontSize: 14,
    fontWeight: '900'
  },
  homeCalendarMeal: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start'
  },
  homeCalendarTime: {
    minWidth: 76,
    borderRadius: 12,
    backgroundColor: '#fff2f4',
    paddingHorizontal: 8,
    paddingVertical: 7,
    alignItems: 'center'
  },
  homeCalendarTimeText: {
    color: COLORS.cardinalDark,
    fontSize: 12,
    fontWeight: '900'
  },
  homeCalendarText: {
    flex: 1
  },
  homeCalendarMealName: {
    color: COLORS.ink,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900'
  },
  homeCalendarMeta: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    marginTop: 2
  },
  deleteAccountButton: {
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 8
  },
  deleteAccountText: {
    color: COLORS.cardinal,
    fontSize: 14,
    fontWeight: '800'
  },
  photoActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16
  },
  photoActionButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: COLORS.pale,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 10
  },
  photoActionText: {
    color: COLORS.cardinalDark,
    fontSize: 15,
    fontWeight: '900'
  },
  pantryPhotoPanel: {
    borderRadius: 20,
    backgroundColor: COLORS.pale2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    marginBottom: 16
  },
  pantryPhotoPreview: {
    width: 78,
    height: 78,
    borderRadius: 16,
    backgroundColor: COLORS.pale
  },
  pantryPhotoText: {
    flex: 1,
    gap: 4
  },
  detectedIngredientPanel: {
    backgroundColor: COLORS.pale2,
    borderRadius: 20,
    padding: 16,
    gap: 10,
    marginBottom: 16
  },
  detectedIngredientList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  detectedIngredientPill: {
    color: COLORS.ink,
    backgroundColor: COLORS.white,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: '800'
  },
  pantryTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
    marginBottom: 16
  },
  pantryNote: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    marginTop: 14
  },
  pantryEmptyPanel: {
    backgroundColor: COLORS.pale2,
    borderRadius: 20,
    padding: 16,
    marginTop: 16
  },
  pantryResults: {
    backgroundColor: COLORS.pale2,
    borderRadius: 20,
    padding: 16,
    gap: 12,
    marginTop: 16
  },
  pantryRecipeCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    gap: 11
  },
  pantryRecipeName: {
    color: COLORS.ink,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '900',
    marginTop: 3,
    flexShrink: 1
  },
  stepHeader: {
    marginBottom: 26
  },
  question: {
    color: COLORS.ink,
    fontSize: 43,
    lineHeight: 50,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 12
  },
  cardinalWrap: {
    width: 144,
    height: 104,
    justifyContent: 'center',
    alignItems: 'center'
  },
  cardinalWrapCompact: {
    width: 106,
    height: 80,
    alignSelf: 'center'
  },
  guidePrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 22,
    marginTop: -8
  },
  guidePromptAlt: {
    flexDirection: 'row-reverse'
  },
  guideBubble: {
    flex: 1,
    backgroundColor: '#fff8df',
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: '#f1df9b'
  },
  guideText: {
    color: '#3d3420',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700'
  },
  choiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  pillOption: {
    minHeight: 62,
    minWidth: 112,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.pale,
    borderRadius: 18,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: COLORS.pale
  },
  pillSelected: {
    backgroundColor: '#ffe9eb',
    borderColor: COLORS.cardinal
  },
  pillText: {
    color: COLORS.ink,
    fontSize: 23,
    lineHeight: 28,
    fontWeight: '700',
    textAlign: 'center'
  },
  pillTextSelected: {
    color: COLORS.cardinalDark
  },
  stack: {
    gap: 16
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  cleanInput: {
    flex: 1,
    minHeight: 58,
    borderRadius: 16,
    backgroundColor: COLORS.pale,
    color: COLORS.ink,
    fontSize: 21,
    fontWeight: '700',
    paddingHorizontal: 18,
    borderWidth: 0
  },
  calorieTargetHint: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
    marginTop: -8
  },
  keyboardAccessory: {
    minHeight: 44,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 14
  },
  keyboardDoneButton: {
    minHeight: 34,
    minWidth: 68,
    borderRadius: 12,
    backgroundColor: COLORS.cardinal,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14
  },
  keyboardDoneText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '900'
  },
  plusButton: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.cardinal
  },
  mealRow: {
    minHeight: 90,
    borderRadius: 20,
    backgroundColor: COLORS.pale,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 18,
    borderWidth: 2,
    borderColor: COLORS.pale
  },
  mealRowSelected: {
    backgroundColor: '#fff6d7',
    borderColor: COLORS.yellow
  },
  roundCheck: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: '#d8d8d8',
    alignItems: 'center',
    justifyContent: 'center'
  },
  roundCheckSelected: {
    backgroundColor: COLORS.cardinal
  },
  mealNameBlock: {
    flex: 1,
    gap: 8
  },
  mealName: {
    color: COLORS.ink,
    fontSize: 25,
    fontWeight: '800'
  },
  miniMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7
  },
  timeInput: {
    flex: 1,
    color: COLORS.muted,
    fontSize: 19,
    fontWeight: '600',
    padding: 0,
    minHeight: 28
  },
  largeChoiceStack: {
    gap: 18
  },
  largeChoice: {
    minHeight: 104,
    borderRadius: 20,
    backgroundColor: COLORS.pale,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderWidth: 2,
    borderColor: COLORS.pale
  },
  largeChoiceSelected: {
    backgroundColor: COLORS.yellow,
    borderColor: COLORS.yellow
  },
  largeChoiceTitle: {
    color: COLORS.ink,
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 8
  },
  largeChoiceSub: {
    color: '#424242',
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '500'
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: COLORS.pale,
    borderRadius: 18,
    padding: 6
  },
  segmentButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10
  },
  segmentSelected: {
    backgroundColor: COLORS.white
  },
  segmentText: {
    color: COLORS.muted,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center'
  },
  segmentTextSelected: {
    color: COLORS.cardinal
  },
  cachedHome: {
    backgroundColor: COLORS.pale2,
    borderRadius: 18,
    padding: 16,
    gap: 10
  },
  cachedHomeTitle: {
    color: COLORS.ink,
    fontSize: 16,
    fontWeight: '900'
  },
  cachedHomeItem: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  cachedHomeName: {
    color: COLORS.ink,
    fontSize: 15,
    fontWeight: '900'
  },
  cachedHomeMeta: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2
  },
  cachedHomeIngredients: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    marginTop: 6
  },
  cachedEmpty: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700'
  },
  field: {
    gap: 8
  },
  fieldLabel: {
    color: COLORS.ink,
    fontSize: 18,
    fontWeight: '800'
  },
  sourceIntro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.pale2,
    borderRadius: 16,
    padding: 16
  },
  sourceIntroText: {
    flex: 1,
    color: COLORS.muted,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600'
  },
  estimateHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#eff9eb',
    borderRadius: 16,
    padding: 16
  },
  estimateHintText: {
    flex: 1,
    color: '#2f5d22',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700'
  },
  reviewStack: {
    gap: 10
  },
  summaryLine: {
    backgroundColor: COLORS.pale,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16
  },
  summaryLabel: {
    color: COLORS.cardinal,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 5
  },
  summaryValue: {
    color: COLORS.ink,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700'
  },
  errorText: {
    color: COLORS.cardinal,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
    marginTop: 18
  },
  successText: {
    color: COLORS.greenDark,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
    marginTop: 8
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 26
  },
  continueButton: {
    width: 286,
    maxWidth: '100%',
    minHeight: 68,
    borderRadius: 20,
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    shadowColor: COLORS.green,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 8
  },
  continuePressed: {
    transform: [{ translateY: 1 }]
  },
  continueDisabled: {
    opacity: 0.45
  },
  continueText: {
    color: COLORS.white,
    fontSize: 25,
    fontWeight: '800'
  },
  menuShell: {
    flex: 1
  },
  menuScroll: {
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 132
  },
  menuHero: {
    marginBottom: 18
  },
  menuGuideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14
  },
  menuCards: {
    gap: 16
  },
  budgetMeter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: '#eff9eb',
    borderColor: '#cdeebe',
    borderWidth: 1,
    borderRadius: 18,
    padding: 15,
    marginBottom: 16
  },
  budgetMeterOver: {
    backgroundColor: '#ffe9eb',
    borderColor: '#f4b9c1'
  },
  budgetMeterLabel: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  budgetMeterValue: {
    color: COLORS.ink,
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '900',
    marginTop: 2
  },
  budgetMeterRight: {
    alignItems: 'flex-end',
    justifyContent: 'center'
  },
  budgetMeterMeta: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: '800'
  },
  menuDay: {
    gap: 12
  },
  menuDayTitle: {
    color: COLORS.ink,
    fontSize: 24,
    fontWeight: '900'
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12
  },
  categoryCount: {
    color: COLORS.cardinal,
    fontSize: 14,
    fontWeight: '900'
  },
  menuSlot: {
    backgroundColor: COLORS.pale,
    borderRadius: 20,
    padding: 14,
    gap: 12
  },
  menuSlotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12
  },
  menuSlotTitle: {
    color: COLORS.ink,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '900',
    marginTop: 2
  },
  clearSlotButton: {
    minHeight: 34,
    borderRadius: 13,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12
  },
  clearSlotText: {
    color: COLORS.cardinal,
    fontSize: 13,
    fontWeight: '900'
  },
  optionStack: {
    gap: 9
  },
  menuMealCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: COLORS.pale2,
    borderWidth: 2,
    borderColor: '#eeeeea',
    borderRadius: 20,
    padding: 16
  },
  menuMealCardSelected: {
    backgroundColor: '#fff6d7',
    borderColor: COLORS.yellow
  },
  menuMealCardDisabled: {
    opacity: 0.45
  },
  menuCheck: {
    width: 31,
    height: 31,
    borderRadius: 999,
    backgroundColor: '#d8d8d8',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2
  },
  menuCheckSelected: {
    backgroundColor: COLORS.cardinal
  },
  menuMealBody: {
    flex: 1
  },
  menuMealName: {
    color: COLORS.ink,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '900',
    marginTop: 3
  },
  menuMealDesc: {
    color: COLORS.muted,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
    marginTop: 6
  },
  menuMealMacros: {
    color: COLORS.ink,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 8
  },
  mealCostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10
  },
  mealCost: {
    color: COLORS.greenDark,
    fontSize: 15,
    fontWeight: '900',
    marginTop: 8
  },
  costHero: {
    backgroundColor: COLORS.pale,
    borderRadius: 22,
    padding: 20,
    marginTop: 18,
    marginBottom: 16
  },
  costHeroLabel: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  costHeroValue: {
    color: COLORS.greenDark,
    fontSize: 48,
    lineHeight: 54,
    fontWeight: '900',
    marginTop: 4
  },
  budgetStatus: {
    backgroundColor: '#eff9eb',
    borderRadius: 16,
    padding: 14,
    marginTop: 12
  },
  budgetStatusOver: {
    backgroundColor: '#ffe9eb'
  },
  budgetStatusText: {
    color: COLORS.ink,
    fontSize: 18,
    fontWeight: '900'
  },
  quickBudgetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12
  },
  quickBudget: {
    minHeight: 44,
    borderRadius: 16,
    backgroundColor: COLORS.pale,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16
  },
  quickBudgetText: {
    color: COLORS.ink,
    fontSize: 16,
    fontWeight: '800'
  },
  editMenuButton: {
    minHeight: 40,
    borderRadius: 14,
    backgroundColor: '#ffe9eb',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 13
  },
  editMenuText: {
    color: COLORS.cardinal,
    fontSize: 14,
    fontWeight: '900'
  },
  resultScroll: {
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 54
  },
  resultHero: {
    alignItems: 'center',
    marginBottom: 18
  },
  resultTitle: {
    color: COLORS.ink,
    fontSize: 38,
    lineHeight: 44,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 10
  },
  resultSubtitle: {
    color: COLORS.muted,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16
  },
  metric: {
    flex: 1,
    minHeight: 82,
    borderRadius: 18,
    backgroundColor: COLORS.pale,
    justifyContent: 'center',
    padding: 12
  },
  metricValue: {
    color: COLORS.ink,
    fontSize: 24,
    fontWeight: '900'
  },
  metricLabel: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginTop: 3
  },
  warningText: {
    color: '#7a4d00',
    backgroundColor: '#fff4d5',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700'
  },
  dayTabs: {
    gap: 8,
    paddingBottom: 16
  },
  dayTab: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: COLORS.pale,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 8
  },
  dayTabSelected: {
    backgroundColor: COLORS.cardinal
  },
  dayTabText: {
    color: COLORS.ink,
    fontSize: 16,
    fontWeight: '800'
  },
  dayTabTextSelected: {
    color: COLORS.white
  },
  dayTabDate: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2
  },
  dayDate: {
    color: COLORS.cardinal,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2
  },
  calendarButton: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: COLORS.green,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16
  },
  calendarButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '900'
  },
  dayModule: {
    gap: 12
  },
  dayHeader: {
    marginBottom: 2
  },
  dayTitle: {
    color: COLORS.ink,
    fontSize: 28,
    fontWeight: '900'
  },
  dayMacros: {
    color: COLORS.muted,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2
  },
  recipeModule: {
    backgroundColor: COLORS.pale2,
    borderRadius: 20,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: '#eeeeea'
  },
  recipeTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12
  },
  recipeTitleBlock: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4
  },
  recipeType: {
    color: COLORS.cardinal,
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  recipeName: {
    color: COLORS.ink,
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '900',
    marginTop: 3,
    flexShrink: 1
  },
  ratingPill: {
    color: COLORS.cardinalDark,
    backgroundColor: '#ffe9eb',
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    fontWeight: '900',
    alignSelf: 'flex-start',
    flexShrink: 0,
    maxWidth: 96,
    textAlign: 'center'
  },
  recipeDescription: {
    color: COLORS.muted,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '600'
  },
  macroRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  macro: {
    minWidth: 72,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  macroValue: {
    color: COLORS.ink,
    fontSize: 17,
    fontWeight: '900'
  },
  macroLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  moduleTitle: {
    color: COLORS.ink,
    fontSize: 17,
    fontWeight: '900',
    marginTop: 4
  },
  recipeText: {
    color: COLORS.muted,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '600'
  },
  sourceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  sourcePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.white,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 8
  },
  sourceText: {
    color: COLORS.cardinal,
    fontSize: 13,
    fontWeight: '900'
  },
  swapButton: {
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ffd8dd',
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 2
  },
  swapButtonText: {
    color: COLORS.cardinal,
    fontSize: 14,
    fontWeight: '900'
  },
  shoppingModule: {
    backgroundColor: COLORS.pale,
    borderRadius: 20,
    padding: 18,
    marginTop: 16,
    gap: 12
  },
  shoppingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 14
  },
  shoppingHeaderText: {
    flex: 1
  },
  estimateRange: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    marginTop: 5
  },
  estimateTotal: {
    color: COLORS.greenDark,
    fontSize: 28,
    fontWeight: '900'
  },
  costList: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 12,
    gap: 8
  },
  costItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee'
  },
  costItemText: {
    flex: 1
  },
  costName: {
    color: COLORS.ink,
    fontSize: 15,
    fontWeight: '800'
  },
  costQuantity: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2
  },
  costPrice: {
    color: COLORS.ink,
    fontSize: 15,
    fontWeight: '900'
  },
  shoppingList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  shoppingItem: {
    color: COLORS.ink,
    backgroundColor: COLORS.white,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: '700'
  },
  estimateNote: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600'
  },
  safetyText: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    marginTop: 16
  },
  regenerateButton: {
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#ffe0e4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18
  },
  regenerateText: {
    color: COLORS.cardinal,
    fontSize: 18,
    fontWeight: '900'
  }
});
