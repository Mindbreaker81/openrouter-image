# OpenRouter models con salida de imagen (output_modalities=image)

Fecha de extracción: 2026-02-07

Fuente (UI): https://openrouter.ai/models?fmt=cards&output_modalities=image

Cómo se obtuvo la lista:
- La página de modelos es una app Next.js y el HTML inicial no incluye de forma fiable los IDs/links de cada tarjeta.
- Para que el listado coincida con lo que muestra esa URL, se extrae desde el mismo endpoint que consume la UI:
	- https://openrouter.ai/api/frontend/models/find?fmt=cards&output_modalities=image

Notas:
- Este documento lista los modelos cuyo `output_modalities` incluye `"image"` en el endpoint usado por la UI.
- Los precios se copian tal cual aparecen en `endpoint.pricing` del **endpoint por defecto** (API verificada 2026-02-07).
- Si un modelo no trae `endpoint`/`pricing` en esta respuesta (o tiene múltiples endpoints), los precios pueden aparecer vacíos o variar.
- Este listado es para **salida** de imagen (no solo soporte de entrada).

Resumen (según el endpoint que usa la UI):
- Total modelos con `output_modalities=image`: 16

Apuntes rápidos:
- Modelo más económico (según `image_output` entre los que traen precio): `black-forest-labs/flux.2-klein-4b`.
- Probado en este repo vía MCP (`generate_image`) guardando PNG correctamente.

## Tabla de precios (API OpenRouter)

| id | name | provider | ctx | input | output | prompt | completion | image_output | image_token | free |
|---|---|---|---:|---|---|---:|---:|---:|---:|:---:|
| sourceful/riverflow-v2-pro-20260130 | Sourceful: Riverflow V2 Pro | Sourceful | 8192 | text,image | image | 0 | 0 | 0.00003593 | 0.00003593 | no |
| sourceful/riverflow-v2-fast-20260130 | Sourceful: Riverflow V2 Fast | Sourceful | 8192 | text,image | image | 0 | 0 | 0.00000479 | 0.00000479 | no |
| black-forest-labs/flux.2-klein-4b | Black Forest Labs: FLUX.2 Klein 4B | Black Forest Labs | 40960 | text,image | image | 0 | 0 | 0.00000342 | — | no |
| bytedance-seed/seedream-4.5-20251203 | ByteDance Seed: Seedream 4.5 | Seed | 4096 | image,text | image | 0 | 0 | 0.00000958 | 0.00000958 | no |
| black-forest-labs/flux.2-max | Black Forest Labs: FLUX.2 Max | Black Forest Labs | 46864 | text,image | image | 0 | 0 | 0.00001709 | — | no |
| sourceful/riverflow-v2-max-preview | Sourceful: Riverflow V2 Max Preview | Sourceful | 8192 | text,image | image | 0 | 0 | 0.00001796 | 0.00001796 | no |
| sourceful/riverflow-v2-standard-preview | Sourceful: Riverflow V2 Standard Preview | Sourceful | 8192 | text,image | image | 0 | 0 | 0.00000838 | 0.00000838 | no |
| sourceful/riverflow-v2-fast-preview | Sourceful: Riverflow V2 Fast Preview | Sourceful | 8192 | text,image | image | 0 | 0 | 0.00000719 | 0.00000719 | no |
| black-forest-labs/flux.2-flex | Black Forest Labs: FLUX.2 Flex | Black Forest Labs | 67344 | text,image | image | 0 | 0 | 0.00001465 | 0.00001465 | no |
| black-forest-labs/flux.2-pro | Black Forest Labs: FLUX.2 Pro | Black Forest Labs | 46864 | text,image | image | 0 | 0 | 0.00000732 | — | no |
| google/gemini-3-pro-image-preview-20251120 | Google: Nano Banana Pro (Gemini 3 Pro Image Preview) | Google AI Studio | 65536 | image,text | image,text | 0.000002 | 0.000012 | 0.00012 | — | no |
| openai/gpt-5-image-mini | OpenAI: GPT-5 Image Mini | OpenAI | 400000 | file,image,text | image,text | 0.0000025 | 0.000002 | 0.000008 | — | no |
| openai/gpt-5-image | OpenAI: GPT-5 Image | OpenAI | 400000 | image,text,file | image,text | 0.00001 | 0.00001 | 0.00004 | — | no |
| google/gemini-2.5-flash-image | Google: Gemini 2.5 Flash Image (Nano Banana) | Google AI Studio | 32768 | image,text | image,text | 0.0000003 | 0.0000025 | 0.00003 | — | no |
| google/gemini-2.5-flash-image-preview | Google: Gemini 2.5 Flash Image Preview (Nano Banana) | — | 32768 | image,text | image,text | — | — | — | — | — |
| openrouter/auto | Auto Router | — | 2000000 | text,image,audio,file,video | text,image | — | — | — | — | — |

## Coste aproximado por imagen generada

Estimación para una imagen típica (~1 MP o 1024×1024 px). Los modelos basados en tokens usan ~1024 tokens/imagen como referencia. Los costes reales dependen del tamaño de salida y del proveedor.

| id | name | coste/imagen aprox. | notas |
|---|---|---:|---|
| openai/gpt-5-image-mini | OpenAI: GPT-5 Image Mini | **~$0.008** | ~1024 tokens × $0.000008/token |
| black-forest-labs/flux.2-klein-4b | Black Forest Labs: FLUX.2 Klein 4B | **$0.014** | 1.ª MP: $0.014; +$0.001/MP |
| sourceful/riverflow-v2-fast-20260130 | Sourceful: Riverflow V2 Fast | **$0.02** | 2¢ (1K), 4¢ (2K) |
| black-forest-labs/flux.2-pro | Black Forest Labs: FLUX.2 Pro | **$0.03** | $0.03/MP |
| sourceful/riverflow-v2-fast-preview | Sourceful: Riverflow V2 Fast Preview | **$0.03** | 3¢/imagen |
| sourceful/riverflow-v2-standard-preview | Sourceful: Riverflow V2 Standard Preview | **$0.035** | 3.5¢/imagen |
| google/gemini-2.5-flash-image | Google: Gemini 2.5 Flash Image | **~$0.03** | ~1024 tokens × $0.00003/token |
| bytedance-seed/seedream-4.5-20251203 | ByteDance Seed: Seedream 4.5 | **$0.04** | tarifa fija por imagen |
| openai/gpt-5-image | OpenAI: GPT-5 Image | **~$0.04** | ~1024 tokens × $0.00004/token |
| black-forest-labs/flux.2-flex | Black Forest Labs: FLUX.2 Flex | **$0.06** | $0.06/MP |
| black-forest-labs/flux.2-max | Black Forest Labs: FLUX.2 Max | **$0.07** | 1.ª MP: $0.07; +$0.03/MP |
| sourceful/riverflow-v2-max-preview | Sourceful: Riverflow V2 Max Preview | **$0.075** | 7.5¢/imagen |
| sourceful/riverflow-v2-pro-20260130 | Sourceful: Riverflow V2 Pro | **$0.15** | 15¢ (1K/2K), 33¢ (4K) |
| google/gemini-3-pro-image-preview-20251120 | Google: Nano Banana Pro | **~$0.12** | ~1024 tokens × $0.00012/token |
| google/gemini-2.5-flash-image-preview | Google: Gemini 2.5 Flash Image Preview | — | sin precio en API |
| openrouter/auto | Auto Router | variable | enrutado según disponibilidad |

**Ordenados de menor a mayor coste estimado.** Los modelos más baratos para uso habitual: GPT-5 Image Mini (~$0.008), FLUX.2 Klein 4B (~$0.014) y Riverflow V2 Fast ($0.02).
