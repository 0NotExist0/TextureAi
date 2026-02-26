import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const getAI = () => {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
};

export interface TextureMaps {
  albedo: string;
  normal?: string;
  height?: string;
  metallic?: string;
  ao?: string;
}

export const generateBaseTexture = async (prompt: string): Promise<string> => {
  const ai = getAI();
  const fullPrompt = `A high-quality, professional, seamless tileable texture of ${prompt}. 
  Top-down orthographic view, perfectly flat lighting, no shadows, no perspective distortion. 
  The texture must be perfectly tileable on all sides. 
  High detail, 4k resolution style.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [{ text: fullPrompt }],
    },
    config: {
      imageConfig: {
        aspectRatio: "1:1",
      },
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("No image generated");
};

export const generateMap = async (
  baseImageBase64: string,
  mapType: 'normal' | 'height' | 'metallic' | 'ao'
): Promise<string> => {
  const ai = getAI();
  
  const prompts = {
    normal: "Generate a high-quality PBR Normal map for this texture. Use standard purple/blue normal map color space. Ensure it is seamless and tileable, matching the input texture exactly.",
    height: "Generate a high-quality grayscale Height (displacement) map for this texture. White represents high areas, black represents low areas. Ensure it is seamless and tileable.",
    metallic: "Generate a high-quality grayscale Metallic map for this texture. White represents metallic surfaces, black represents non-metallic. Ensure it is seamless and tileable.",
    ao: "Generate a high-quality grayscale Ambient Occlusion (AO) map for this texture. Darker areas represent crevices and shadows. Ensure it is seamless and tileable."
  };

  const base64Data = baseImageBase64.split(',')[1];

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          inlineData: {
            data: base64Data,
            mimeType: "image/png",
          },
        },
        { text: prompts[mapType] },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: "1:1",
      },
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error(`No ${mapType} map generated`);
};
