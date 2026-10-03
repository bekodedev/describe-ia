# T07 - Product photos: does the model use what it sees?

Three real product photos, each generated twice: with the title only, and with the title plus the photo. Everything was run with `pnpm --filter api gen:try "<title>" "<category>" v2 --image <file>` against the real API (model `claude-haiku-4-5-20251001`, public prompt `generate-description.v2.md`, `OUTPUT_LANGUAGE=es`, 2026-10-03). The photos are not stored in this repository; the sources are below.

The API shrinks every photo before sending it: JPEG, longest side 1024 px, quality 80. The original is kept as uploaded.

## Photos

| Key      | Title / category sent   | Source (Wikimedia Commons)                                                                                           | Licence       | Author    |
| -------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------- | --------- |
| mug      | Mug / Home & Kitchen    | [Denby Azure coffee mug](https://commons.wikimedia.org/wiki/File:-2019-09-17_Denby_%CE%84Azure%CE%84_Coffee_mug.JPG) | CC BY-SA 4.0  | Kolforn   |
| backpack | Backpack / Sports       | [Quechua backpack - A](https://commons.wikimedia.org/wiki/File:Quechua_backpack_-_A.jpg)                             | CC0           | Fructibus |
| bag      | Small zip bag / Fashion | [Fossil bag](<https://commons.wikimedia.org/wiki/File:080909_Fossil_Man_Bag_(1).jpg>)                                | Public domain | Anusood   |

Photos were downloaded as 1920 px wide JPEG thumbnails (0.4 to 1.1 MB) and uploaded as such. The titles are deliberately plain and say nothing about colour or material, so anything of that kind in the output comes from the photo (or is invented).

What is really in each photo (my own reading, used to score the outputs):

- **mug**: A glazed ceramic mug on a wooden shelf in front of a white wall. The glaze goes from white/cream at the top to a pale blue-grey (slightly green-teal) towards the bottom; thin tan rim; a curved handle in the same blue-grey with a tan edge.
- **backpack**: A flat-lying backpack: dark grey/black fabric body with a brown lower section, orange/tan accents (cord pulls, buckles, stitching), front zip pocket, side compression straps, a drawcord/roll-top closure, a leather-look logo patch and the word "Quechua". The shoulder straps are not visible.
- **bag**: A small black woven-nylon pouch with two zipped compartments, a zipped front pocket under a flap, a wrist strap with an adjuster, silver zip pulls and a metal "FOSSIL" badge, on a reddish wooden table.

## Cost with and without the photo

Same prompt text in both columns (the first wording of the image rule, see "Prompt iterations"). Input tokens are what the model bills for the whole request.

| Product       | Sent to the model | Input tokens, title only | Input tokens, with photo | Photo adds | Cost title only | Cost with photo  |
| ------------- | ----------------- | ------------------------ | ------------------------ | ---------- | --------------- | ---------------- |
| Mug           | 1024 x 760 px     | 459                      | 1499                     | +1040      | $0.001769       | $0.002694 (+52%) |
| Backpack      | 768 x 1024 px     | 457                      | 1497                     | +1040      | $0.001927       | $0.003027 (+57%) |
| Small zip bag | 1024 x 623 px     | 457                      | 1312                     | +855       | $0.001767       | $0.002712 (+53%) |

The photo costs `ceil(width / 28) x ceil(height / 28)` tokens, as the vision documentation says: 1024 x 760 is 37 x 28 = 1036 (measured +1040), 768 x 1024 is 28 x 37 = 1036 (+1040), 1024 x 623 is 37 x 23 = 851 (+855). Without resizing, the 1920 px originals would have been downscaled by the API to its limit of about 1568 tokens each, so the 1024 px copy saves roughly a third of the image tokens and 70 to 85% of the upload size (mug 406 KB to 63 KB, backpack 1053 KB to 121 KB, bag 791 KB to 219 KB).

In money: about +$0.001 per description, +55% over a title-only call at Haiku 4.5 prices, i.e. roughly $1 more per 1,000 products. Output tokens barely change.

## Results with the final prompt (3 samples per photo)

### mug (Mug)

| Visible attribute     | Correct in | Note                                                                                      |
| --------------------- | ---------- | ----------------------------------------------------------------------------------------- |
| Ceramic               | 3/3        |                                                                                           |
| Handle                | 3/3        | The handle colour is wrong in 2/3 ("marron", "tostado": it is blue-grey with a tan edge). |
| Blue-grey colour      | 1/3        | Another sample says only "gris" and one says "tonos verdes".                              |
| Gradient from the top | 2/3        | One sample calls it "uniforme".                                                           |
| Tan rim               | 2/3        | Called "borde dorado".                                                                    |

Title only, for comparison (no colours, no details, nothing to check):

- [short] Taza funcional y versátil para bebidas calientes o frías, ideal para el hogar.
- [medium] Taza práctica para la cocina y el hogar. Perfecta para disfrutar de bebidas calientes como café o té, así como bebidas frías. Un accesorio esencial en cualquier casa que combina funcionalidad con diseño simple y cotidiano para el día a día.
- [seo] Taza para el hogar y la cocina, accesorio indispensable en cualquier casa. Esta taza es versátil y funcional, ideal para servir bebidas tanto calientes como frías. Perfecta para disfrutar de café, té u otras bebidas en la comodidad del hogar. La taza es un elemento básico de la cocina que forma parte de la vajilla diaria. Ya sea para desayunar, trabajar desde casa o relajarse, esta taza de cocina y hogar ofrece practicidad y utilidad. Un producto esencial para equipar adecuadamente tu espacio de cocina y hogar.
- _Usage: 459 input / 262 output tokens, $0.001769_

With the photo, sample 1:

- [short] Taza de cerámica en tonos verdes con asa decorativa y borde dorado.
- [medium] Taza de cerámica con un elegante acabado en tonos verdes que degradan desde el borde superior. Posee un asa curvada con detalles en tonos oscuros y dorados. Su forma cilíndrica la hace práctica para el uso diario. Perfecta para servir bebidas calientes o frías en el hogar.
- [seo] Taza de cerámica para el hogar con diseño elegante en tonos verdes. Esta taza de cocina presenta un acabado gradual de color que combina tonos claros en la parte superior con verdes más oscuros en la inferior. Cuenta con un asa funcional decorada con detalles en tonos oscuros y bordes dorados. Su forma cilíndrica tradicional la hace versátil para el uso diario en la cocina. Ideal para servir café, té u otras bebidas calientes. Una pieza práctica y decorativa para añadir a tu colección de menaje de hogar.
- _Usage: 1543 input / 270 output tokens, $0.002893_

With the photo, sample 2:

- [short] Taza de cerámica en tonos gris azulado con asa marrón y acabado brillante.
- [medium] Taza de cerámica con un elegante diseño en tonos gris azulado que degradan suavemente desde la parte superior. Cuenta con un asa funcional de color marrón y un borde superior con detalle dorado. Su acabado brillante y pulido la convierte en una opción perfecta para el hogar y la cocina.
- [seo] Taza de cerámica para el hogar y la cocina con un hermoso diseño en tonos gris azulado. Esta mug presenta un acabado brillante y pulido que le da un aspecto elegante y moderno. Cuenta con un asa práctica de color marrón y un borde superior con detalle dorado que añade un toque sofisticado. Perfecta para servir bebidas calientes o frías, esta taza es un complemento ideal para cualquier cocina. Su diseño versátil la hace compatible con diferentes estilos de decoración. Ideal como regalo o para uso personal en el hogar.
- _Usage: 1543 input / 274 output tokens, $0.002913_

With the photo, sample 3:

- [short] Taza de cerámica con acabado gris y asa decorativa de color tostado.
- [medium] Taza de cerámica elegante con un color gris suave y uniforme. Presenta un asa redondeada con detalle de tono tostado que contrasta con el cuerpo principal. Ideal para el hogar, combina funcionalidad con un diseño minimalista y refinado.
- [seo] Taza de cerámica para hogar y cocina con un elegante acabado gris. Este complemento de cocina destaca por su diseño minimalista y acabado uniforme en tonos grises. La taza cuenta con un asa redondeada de color tostado que proporciona confort al sostenerla. Perfecta para cualquier mesa de la cocina, esta taza de cerámica ofrece un estilo contemporáneo y versátil. Ideal para bebidas calientes, su diseño sofisticado la hace un accesorio indispensable en el hogar.
- _Usage: 1543 input / 247 output tokens, $0.002778_

### backpack (Backpack)

| Visible attribute                | Correct in | Note                                                         |
| -------------------------------- | ---------- | ------------------------------------------------------------ |
| Dark grey/black body with brown  | 3/3        |                                                              |
| Zips and pockets                 | 3/3        |                                                              |
| Cord closure / adjustable cords  | 2/3        |                                                              |
| Orange accents                   | 1/3        | The others say "detalles en marron" or "tonos calidos".      |
| Invented: padded shoulder straps | 1/3 wrong  | Not visible in the photo; it disappeared in samples 2 and 3. |

Title only, for comparison (no colours, no details, nothing to check):

- [short] Mochila versátil diseñada para actividades deportivas y uso diario.
- [medium] Mochila ideal para deportistas y entusiastas de actividades al aire libre. Este modelo práctico ofrece soluciones de almacenamiento versátiles para llevar tus pertenencias de forma segura y cómoda durante entrenamientos, excursiones o viajes. Su diseño funcional lo convierte en un accesorio imprescindible para cualquier actividad.
- [seo] Mochila deportiva perfecta para atletas, viajeros y amantes del deporte. Esta mochila combina funcionalidad y diseño práctico, ofreciendo un espacio amplio para organizar y transportar tus elementos esenciales. Ideal para entrenamientos, viajes, excursiones y actividades deportivas variadas. La mochila de deporte es un complemento versátil que se adapta a diferentes necesidades, ya sea para ir al gimnasio, practicar senderismo o realizar actividades al aire libre. Su estructura resistente y distribución inteligente de compartimentos hace que sea una opción confiable para quienes buscan un accesorio deportivo duradero y funcional.
- _Usage: 457 input / 294 output tokens, $0.001927_

With the photo, sample 1:

- [short] Mochila deportiva con diseño bicolor en gris y marrón, cierre de cordón y múltiples bolsillos.
- [medium] Mochila de deporte con estructura práctica y funcional. Presenta un cuerpo principal en gris oscuro con base en marrón, detalles en naranja y cierres de cremallera. Equipada con asas de transporte, cordones ajustables y varios bolsillos laterales para organizar tus objetos personales.
- [seo] Mochila deportiva versátil diseñada para actividades outdoor y entrenamientos. Esta mochila combina un cuerpo principal en gris oscuro con una base resistente en marrón, acentos en naranja y detalles funcionales. Cuenta con cierre de cordón ajustable, múltiples bolsillos de acceso rápido, asas de hombro acolchadas y cremalleras de calidad. Perfecta para deportistas y viajeros que buscan practicidad y comodidad. Ideal para guardar equipo deportivo, ropa y accesorios con organización eficiente.
- _Usage: 1541 input / 278 output tokens, $0.002931_

With the photo, sample 2:

- [short] Mochila deportiva de diseño práctico con compartimentos y correas ajustables para el transporte diario.
- [medium] Esta mochila deportiva presenta una estructura versátil con múltiples compartimentos y bolsillos laterales. Combina tonos grises y negros con detalles en marrón, incluyendo correas ajustables y cierres de cremallera. Su diseño funcional la hace ideal para actividades deportivas y uso cotidiano.
- [seo] Mochila deportiva práctica y funcional diseñada para actividades de deporte y uso diario. Este modelo destaca por su estructura versátil con compartimentos principales y bolsillos laterales de fácil acceso. La mochila presenta una combinación de colores en gris y negro con detalles en marrón, acompañados de correas ajustables que permiten un transporte cómodo. Incluye cierres de cremallera en la base y accesos adicionales para mantener tus pertenencias organizadas. Perfecta para quienes buscan una mochila deportiva confiable para entrenamientos, excursiones o transporte diario de equipo deportivo.
- _Usage: 1541 input / 285 output tokens, $0.002966_

With the photo, sample 3:

- [short] Mochila deportiva con diseño bicolor en gris y marrón, cierre superior con cordones y múltiples bolsillos laterales.
- [medium] Mochila versátil para actividades deportivas con estructura resistente en tonos grises y marrones. Cuenta con cierre superior tipo saco, bolsillos laterales con cremallera, asas ajustables y detalles en tonos cálidos. Diseño funcional con múltiples compartimentos para organizar tus pertenencias durante el entrenamiento o aventuras al aire libre.
- [seo] Mochila deportiva de diseño práctico y funcional, ideal para actividades deportivas y senderismo. Presenta una combinación de colores en gris y marrón con cierre superior tipo saco que permite fácil acceso al contenido. Equipada con bolsillos laterales con cremallera, asas ajustables y agarraderas laterales para mayor comodidad al transportar. Los detalles decorativos en tonos cálidos y el sistema de cordones la hacen versátil para diferentes deportes y actividades. Perfecta para quienes buscan una mochila resistente y organizada.
- _Usage: 1541 input / 292 output tokens, $0.003001_

### bag (Small zip bag)

| Visible attribute        | Correct in      | Note                                    |
| ------------------------ | --------------- | --------------------------------------- |
| Zipped compartments      | 3/3             |                                         |
| Carry/wrist strap        | 3/3             |                                         |
| Colour                   | 3/3 approximate | Always "gris oscuro"; the bag is black. |
| Fabric ("tela", "nylon") | 2/3             | Plausible from the weave.               |
| Silver details           | 1/3             |                                         |

Title only, for comparison (no colours, no details, nothing to check):

- [short] Bolsa pequeña con cierre de cremallera, perfecta para organizar y transportar tus accesorios diarios.
- [medium] Bolsa pequeña con cierre de cremallera ideal para guardar y llevar contigo tus pertenencias esenciales. Su tamaño compacto la hace perfecta para viajes cortos, uso diario o como complemento en tu bolso principal. Un accesorio de moda versátil y práctico.
- [seo] Descubre nuestra bolsa pequeña con cierre de cremallera, un accesorio de moda imprescindible para organizar tus pertenencias. Esta pequeña bolsa zip es perfecta para llevar contigo artículos esenciales en tu día a día. Su diseño compacto y funcional la convierte en un complemento versátil que combina con cualquier outfit. Ideal para viajes cortos, uso personal o como bolsa organizadora dentro de tu bolso principal. La bolsa pequeña con cremallera es un must-have en la categoría de moda y accesorios.
- _Usage: 457 input / 262 output tokens, $0.001767_

With the photo, sample 1:

- [short] Pequeña bolsa con cierre de cremallera, diseño práctico en color gris oscuro con múltiples compartimentos.
- [medium] Esta pequeña bolsa de cremallera ofrece una solución práctica para organizar y transportar tus pertenencias. Confeccionada en tela resistente de color gris oscuro, cuenta con varios compartimentos con cremalleras que te permiten mantener tus artículos organizados. Su diseño compacto incluye un asa de transporte para mayor comodidad y portabilidad.
- [seo] Pequeña bolsa con cremallera ideal para la moda y el uso diario. Este accesorio funcional presenta un diseño en color gris oscuro con múltiples compartimentos cerrados con cremalleras para mayor seguridad. La bolsa incluye un asa de transporte práctica y cómoda. Perfecta para llevar contigo tus objetos personales de forma organizada. El cierre de cremallera garantiza que tus pertenencias se mantengan seguras. Esta pequeña bolsa zip es un complemento versátil que combina estilo y utilidad, ideal para viajes, trabajo o uso casual diario.
- _Usage: 1356 input / 288 output tokens, $0.002796_

With the photo, sample 2:

- [short] Pequeño bolso con cierre de cremallera, diseño compacto en color gris oscuro con múltiples compartimentos.
- [medium] Bolso pequeño de moda con cierre de cremallera en tono gris oscuro. Cuenta con varios compartimentos zipados para organizar tus pertenencias. Incluye asa ajustable para llevar cómodo. Diseño funcional y práctico para uso diario.
- [seo] Bolso pequeño con cierre de cremallera perfecto para la moda diaria. Este accesorio compacto en color gris oscuro ofrece múltiples compartimentos zipados que facilitan la organización de tus objetos personales. Cuenta con un asa ajustable que permite llevarlo de forma cómoda. El diseño funcional y versátil de este pequeño bolso lo convierte en una opción práctica para cualquier ocasión. Ideal para complementar tu look con estilo mientras mantienes tus pertenencias organizadas y seguras.
- _Usage: 1356 input / 249 output tokens, $0.002601_

With the photo, sample 3:

- [short] Bolsa pequeña con cierre de cremallera en color gris oscuro con asa ajustable.
- [medium] Pequeña bolsa de viaje o almacenamiento con cierre de cremallera frontal. Diseño funcional en tono gris oscuro con múltiples compartimentos y bolsillos exteriores. Cuenta con asa de mano ajustable en nylon. Ideal para organizar accesorios y objetos personales de forma compacta y accesible.
- [seo] Bolsa pequeña con cierre de cremallera perfecta para viajes, trabajo o uso diario. Esta práctica bolsa zip bag presenta un diseño compacto en color gris oscuro con detalles en color plata. Cuenta con múltiples compartimentos y bolsillos exteriores que facilitan la organización de tus pertenencias. La asa ajustable de nylon permite llevarla cómodamente. Es una opción versátil de moda y accesorios para guardar artículos personales, documentos o viajero. Su construcción resistente y cierre seguro la hacen ideal para el día a día.
- _Usage: 1356 input / 280 output tokens, $0.002756_

## Prompt iterations

The task asked for a rule "describe only what is visible". Getting the model to both use the photo and not embellish took three wordings. Single samples are noisy, so these are observations and not measurements.

| Wording of the image rule                                                                                                                                     | What happened                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. "Use it for what is visible (colour, shape, style, finish). Describe only what is visible; do not invent measurements or materials that cannot be seen..." | Mug and backpack used the photo. The bag text ignored it (no colour, no features, same as title only). Invented "asas acolchadas" (padded handles) on the backpack. |
| B. "Use it: mention the colours, shapes, finish and visible details (pockets, zips, straps, stitching, patterns) that you can actually see..."                | All three used the photo. The backpack got worse: "asas acolchadas ajustables" and "estructura acolchada/reforzada", none visible.                                  |
| C (final). B plus "do not mention padding, lining, waterproofing, capacity or reinforcement unless you can clearly see it"                                    | The photo is used in 9/9 samples. Padded straps appear in 1 of 3 backpack samples instead of in every run; none in the mug and bag samples.                         |

## What this shows

- A photo makes the model write about things the title cannot give it (glaze gradient, two-tone body, zipped compartments, a carry strap), which is the point of the feature.
- It is not reliable on colour: the black bag was called dark grey in every sample, the blue-grey mug was green in one sample and plain grey in another. Descriptions generated from photos still need a human check before publishing.
- Negative instructions help but do not eliminate invention: "padded" was never visible and still appeared once after being explicitly forbidden.
- It costs about +1,000 input tokens per photo at this size, so the resize step matters more than the prompt for the bill.
- Samples are few (3 photos x 3 samples). Treat the counts above as an illustration, not as an accuracy figure.
