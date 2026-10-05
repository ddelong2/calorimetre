/** Shared types plus the prompt and JSON schema sent to AI_COMPLETE. */

export interface FoodItem {
  nom: string
  portion_g: number
  kcal: number
  proteines_g: number
  glucides_g: number
  lipides_g: number
}

export interface MealAnalysis {
  plat: string
  aliments: FoodItem[]
  total_kcal: number
  kcal_min: number
  kcal_max: number
  confiance: "faible" | "moyenne" | "elevee"
  incertitudes: string[]
}

export interface AnalyzeResponse {
  imagePath: string
  analysis: MealAnalysis
}

export interface Meal {
  id: string
  createdAt: string
  plat: string
  portionFactor: number
  kcal: number
  proteines: number
  glucides: number
  lipides: number
  confiance: string
}

export const ANALYSIS_PROMPT =
  "Tu es un nutritionniste. Identifie chaque aliment visible sur cette photo de repas, " +
  "estime la portion en grammes, les calories et les macronutriments. Tiens compte des " +
  "matières grasses de cuisson probables. Ne compte que ce qui est dans l'assiette principale. " +
  "Si la photo ne montre pas de nourriture, renvoie une liste d'aliments vide et total_kcal = 0. " +
  "Réponds en français."

/** Snowflake OBJECT literal for AI_COMPLETE's response_format argument. */
export const RESPONSE_FORMAT_SQL = `{
  'type': 'json',
  'schema': {'type': 'object', 'properties': {
    'plat': {'type': 'string'},
    'aliments': {'type': 'array', 'items': {'type': 'object', 'properties': {
      'nom': {'type': 'string'}, 'portion_g': {'type': 'number'}, 'kcal': {'type': 'number'},
      'proteines_g': {'type': 'number'}, 'glucides_g': {'type': 'number'}, 'lipides_g': {'type': 'number'}},
      'required': ['nom','portion_g','kcal','proteines_g','glucides_g','lipides_g']}},
    'total_kcal': {'type': 'number'}, 'kcal_min': {'type': 'number'}, 'kcal_max': {'type': 'number'},
    'confiance': {'type': 'string', 'enum': ['faible','moyenne','elevee']},
    'incertitudes': {'type': 'array', 'items': {'type': 'string'}}},
    'required': ['plat','aliments','total_kcal','kcal_min','kcal_max','confiance','incertitudes']}
}`

export function sumMacros(items: FoodItem[], factor = 1) {
  const sum = (k: keyof Omit<FoodItem, "nom">) =>
    Math.round(items.reduce((acc, i) => acc + (Number(i[k]) || 0), 0) * factor)
  return {
    kcal: sum("kcal"),
    proteines: sum("proteines_g"),
    glucides: sum("glucides_g"),
    lipides: sum("lipides_g"),
  }
}
