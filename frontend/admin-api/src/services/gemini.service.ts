import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.GEMINI_API_KEY ?? '';

interface GeminiContentResult {
  suggestedName: string;
  shortDescription: string;
  longDescription: string;
  marketingPhrase: string;
}

export async function generateContent(
  imageBase64: string,
  categoryName: string
): Promise<GeminiContentResult> {
  if (!API_KEY || API_KEY === 'your_gemini_api_key_here') {
    console.warn('[Gemini] No API key configured. Returning placeholder content.');
    return getPlaceholderContent(categoryName);
  }

  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

    const prompt = `Eres un experto en descripcion de productos artesanales mexicanos.
Basado en la siguiente imagen de un mueble artesanal de la categoria "${categoryName}", genera:

1. suggestedName (maya): Nombre comercial en lengua maya que describa la esencia del producto.
   Ej: "K'aay" (cantar), "Oolal" (deseo). Incluye el significado en espanol entre parentesis.

2. shortDescription (max 2 oraciones): Descripcion corta y atractiva destacando materiales,
   diseno y uso ideal.

3. longDescription (Markdown): Descripcion detallada incluyendo:
   - Materiales y tecnicas artesanales
   - Colores y acabados disponibles
   - Opciones de personalizacion
   - Dimensiones aproximadas
   - Estilo y ambiente recomendado

4. marketingPhrase (1 frase): Frase corta que invite a comprar, evocando emociones.

Responde en espanol con un tono calido, autentico y profesional.
Formatea la respuesta como JSON valido con las claves: suggestedName, shortDescription, longDescription, marketingPhrase`;

    const result = await model.generateContent([
      { inlineData: { data: imageBase64, mimeType: 'image/jpeg' } },
      { text: prompt },
    ]);

    const text = result.response.text();
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    console.warn('[Gemini] Could not parse response as JSON. Returning placeholder.');
    return getPlaceholderContent(categoryName);
  } catch (error) {
    console.error('[Gemini] API error:', error);
    return getPlaceholderContent(categoryName);
  }
}

function getPlaceholderContent(categoryName: string): GeminiContentResult {
  return {
    suggestedName: `${categoryName} Artesanal`,
    shortDescription: `Hermoso mueble artesanal de la categoria ${categoryName}. Hecho a mano por artesanos mexicanos con materiales de la mas alta calidad.`,
    longDescription: `### Descripcion\n\nEste hermoso mueble de la categoria **${categoryName}** esta elaborado por artesanos mexicanos con tecnicas tradicionales.\n\n- **Materiales:** Fibras naturales y maderas sustentables\n- **Acabados:** Barniz mate transparente\n- **Personalizacion:** Consulta por opciones de color y tejido\n\n*Nota: Esta descripcion sera generada automaticamente por Gemini cuando se configure la API key.*`,
    marketingPhrase: `Descubre la belleza unica de la ${categoryName.toLowerCase()} artesanal mexicana.`,
  };
}
