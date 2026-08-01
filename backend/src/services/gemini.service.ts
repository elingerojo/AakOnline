import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { promptCache } from './prompt-cache.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_KEY = process.env.GEMINI_API_KEY ?? '';

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface GeminiContentResult {
  suggestedNames: string[];
  shortDescription: string;
  longDescription: string;
  marketingPhrase: string;
}

export class GeminiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public statusText: string
  ) {
    super(message);
    this.name = 'GeminiError';
  }
}

// ── Few-shot (desde JSON estático) ────────────────────────────────────────────

interface FewShotExample {
  suggestedName: string;
  shortDescription: string;
  longDescription: string;
  marketingPhrase: string;
}

let fewShotExamples: FewShotExample[] = [];

function loadFewShotExamples(): FewShotExample[] {
  if (fewShotExamples.length > 0) return fewShotExamples;

  const path = resolve(__dirname, '..', '..', 'shared', 'data', 'few-shot.json');
  if (!existsSync(path)) {
    console.warn('[Gemini] few-shot.json not found at', path);
    fewShotExamples = [];
    return fewShotExamples;
  }

  try {
    fewShotExamples = JSON.parse(readFileSync(path, 'utf-8'));
    console.log(`[Gemini] Loaded ${fewShotExamples.length} few-shot examples`);
  } catch (error) {
    console.error('[Gemini] Error loading few-shot.json:', error);
    fewShotExamples = [];
  }

  return fewShotExamples;
}

function buildFewShotText(categoryName: string): string {
  const allExamples = loadFewShotExamples();

  // Buscar el ejemplo correspondiente a esta categoría por coincidencia en el nombre
  const categoryKeywords: Record<string, string> = {
    'salas': 'sala',
    'comedores': 'comedor',
    'recibidores': 'recibidor',
    'sillones': 'sillon',
    'mecedoras': 'mecedora',
    'sillas': 'silla',
    'columpios': 'columpio',
    'pantallas': 'pantalla',
    'marcos': 'marco',
    'accesorios': 'cesto',
  };

  const keyword = categoryKeywords[categoryName.toLowerCase()] ?? '';
  const example = allExamples.find(e =>
    e.shortDescription.toLowerCase().includes(keyword)
  );

  if (!example) return '';

  return [
    '',
    '[EJEMPLOS DE REFERENCIA]',
    `A continuacion te muestro un ejemplo de como redactamos los productos en la categoria: "${categoryName}".`,
    'Usalo unicamente como referencia de estilo, tono y vocabulario.',
    'Estos son ejemplos de estilo para tu respuesta.',
    '',
    '### INICIO EJEMPLO DE REFERENCIA ###',
    `Nombre: ${example.suggestedName}`,
    `Descripcion Corta: ${example.shortDescription}`,
    `Descripcion Larga: ${example.longDescription}`,
    `Frase de Marketing: ${example.marketingPhrase}`,
    '### FIN EJEMPLO DE REFERENCIA ###',
    '',
  ].join('\n');
}

// ── System Instructions ──────────────────────────────────────────────────────

function buildSystemInstructions(categoryName: string): string {
  return [
    `Eres un experto en descripcion de productos artesanales mexicanos.`,
    `Basado en la siguiente imagen de un mueble artesanal de la categoria "${categoryName}", genera:`,
    '',
    '1. suggestedNames: Genera EXACTAMENTE 3 opciones de nombre comercial en lengua maya',
    '   que describan la esencia del producto.',
    `   El producto pertenece a la categoria "${categoryName}".`,
    '   IMPORTANTE: cada opcion debe comenzar con esa categoria en SU forma SINGULAR,',
    '   seguida del nombre en maya y su significado en espanol entre parentesis.',
    '   Ej: ["Sala K\'aay (cantar)", "Sala Oolal (deseo)", "Sala Yuum (creador)"].',
    '   Incluye el significado en espanol entre parentesis para cada opcion.',
    '',
    '2. shortDescription (max 2 oraciones): Descripcion corta y atractiva destacando materiales,',
    '   diseno y uso ideal.',
    '',
    '3. longDescription (Markdown): Descripcion detallada incluyendo:',
    '   - Materiales y tecnicas artesanales',
    '   - Colores y acabados disponibles',
    '   - Opciones de personalizacion',
    '   - Dimensiones aproximadas',
    '   - Estilo y ambiente recomendado',
    '',
    '4. marketingPhrase (1 frase): Frase corta que invite a comprar, evocando emociones.',
    '',
    'Responde en espanol con un tono calido, autentico y profesional.',
    'Las claves del JSON deben ser: suggestedNames (array de 3 strings), shortDescription, longDescription, marketingPhrase',
  ].join('\n');
}

// ── Placeholder ──────────────────────────────────────────────────────────────

function getPlaceholderContent(categoryName: string): GeminiContentResult {
  return {
    suggestedNames: [`${categoryName} Artesanal`],
    shortDescription: `Hermoso mueble artesanal de la categoria ${categoryName}. Hecho a mano por artesanos mexicanos con materiales de la mas alta calidad.`,
    longDescription: `### Descripcion\n\nEste hermoso mueble de la categoria **${categoryName}** esta elaborado por artesanos mexicanos con tecnicas tradicionales.\n\n- **Materiales:** Fibras naturales y maderas sustentables\n- **Acabados:** Barniz mate transparente\n- **Personalizacion:** Consulta por opciones de color y tejido\n\n*Nota: Esta descripcion sera generada automaticamente por Gemini cuando se configure la API key.*`,
    marketingPhrase: `Descubre la belleza unica de la ${categoryName.toLowerCase()} artesanal mexicana.`,
  };
}

// ── Content Generation ───────────────────────────────────────────────────────

export async function generateContent(
  imageBase64: string,
  categoryName: string,
  categoryId: number
): Promise<GeminiContentResult> {
  if (!API_KEY || API_KEY === 'your_gemini_api_key_here') {
    console.warn('[Gemini] No API key configured. Returning placeholder content.');
    return getPlaceholderContent(categoryName);
  }

  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash-lite' });

    // Construir prompt en 3 partes
    const systemText = buildSystemInstructions(categoryName);
    const exclusionText = promptCache.getExclusionText(categoryId, categoryName);
    const fewShotText = buildFewShotText(categoryName);

    const prompt = `${systemText}\n${exclusionText}\n${fewShotText}`;

    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { data: imageBase64, mimeType: 'image/jpeg' } },
          { text: prompt },
        ],
      }],
      generationConfig: {
        temperature: 0.2,
        // Fuerza consistencia y apego a los ejemplos (few-shot)
        responseMimeType: 'application/json',
        // Obliga a Gemini a responder siempre con JSON válido
      },
    });

    // Con responseMimeType: "application/json", Gemini siempre devuelve JSON válido
    const text = result.response.text();
    const parsed: GeminiContentResult = JSON.parse(text);

    // Validar que suggestedNames sea un array
    if (!Array.isArray(parsed.suggestedNames) || parsed.suggestedNames.length === 0) {
      console.warn('[Gemini] Response missing suggestedNames array. Using placeholder.');
      return getPlaceholderContent(categoryName);
    }

    // Actualizar caché con el resultado exitoso
    promptCache.onProductSaved({
      categoryId,
      name: parsed.suggestedNames[0],
      shortDescription: parsed.shortDescription,
      longDescription: parsed.longDescription,
      marketingPhrase: parsed.marketingPhrase,
    });

    return parsed;
  } catch (error: any) {
    // Extraer código HTTP del error de Gemini
    // El SDK de Google puede devolver error en formato { error: { code, message, status } }
    const status = error?.error?.code ?? error?.status ?? error?.response?.status ?? 500;
    const statusText = error?.error?.status ?? error?.statusText ?? error?.error?.message ?? error?.message ?? 'Unknown error';
    const errorMessage = error?.error?.message ?? error?.message ?? '';

    console.error(`[Gemini] Error ${status}: ${statusText} — ${errorMessage}`);

    // Helper para incluir el mensaje técnico de Google en todos los errores
    const detail = errorMessage ? `\n\nDetalle: ${errorMessage}` : '';

    // Mapear a errores conocidos
    if (status === 401 || status === 403) {
      throw new GeminiError(
        `La API key de Gemini no es valida o no tiene permisos.${detail}`,
        status, statusText
      );
    }
    if (status === 404) {
      throw new GeminiError(
        `El modelo de Gemini configurado no esta disponible.${detail}`,
        status, statusText
      );
    }
    if (status === 429) {
      throw new GeminiError(
        `Has excedido el limite de solicitudes a Gemini (60/min).${detail}`,
        status, statusText
      );
    }
    if (status === 503) {
      throw new GeminiError(
        `El servicio de Gemini no esta disponible en este momento.${detail}`,
        status, statusText
      );
    }

    // Catch-all para errores no mapeados
    throw new GeminiError(
      `Ocurrio un error inesperado al contactar Gemini.${detail}`,
      status, statusText
    );
  }
}
