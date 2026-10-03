import type { Category } from '@describe-ia/shared';

// Five products that look like the product of a real session: already "generated", written by
// hand, so that the history is not empty and no model is needed. Descriptions follow the rules of
// prompt v2: only what the title (or the photo) says, no invented specifications.

interface Texts {
  short: string;
  medium: string;
  seo: string;
}

export interface DemoProduct {
  title: string;
  category: Category;
  photo?: string; // a file in apps/api/demo/photos
  en: Texts;
  es: Texts;
}

export const DEMO_PRODUCTS: DemoProduct[] = [
  {
    title: 'Urban hiking backpack',
    category: 'Sports',
    photo: 'backpack.jpg',
    en: {
      short:
        'A dark grey and brown backpack with orange details, ready for city walks and day hikes.',
      medium:
        'This urban hiking backpack combines a dark grey body with a brown base and orange accents. It has a zipped front pocket, adjustable side straps and a drawcord closure at the top, so you can carry your things on the way to work or on a short trail.',
      seo: 'Urban hiking backpack in dark grey and brown with orange details. A practical choice if you are looking for a backpack for sports, city walks and day trips. The zipped front pocket keeps small items within reach, the side straps let you adjust the load and the drawcord closure at the top makes it easy to open and close. Its two-tone design looks good in the city and on the trail. Check the product page for sizes and materials before you buy, and choose the backpack that fits your routine.',
    },
    es: {
      short:
        'Una mochila gris oscuro y marrón con detalles naranjas, lista para pasear por la ciudad y hacer rutas de un día.',
      medium:
        'Esta mochila de senderismo urbano combina un cuerpo gris oscuro con la base marrón y acentos naranjas. Tiene un bolsillo frontal con cremallera, correas laterales ajustables y un cierre de cordón en la parte superior, para llevar tus cosas de camino al trabajo o en un sendero corto.',
      seo: 'Mochila de senderismo urbano en gris oscuro y marrón con detalles naranjas. Una opción práctica si buscas una mochila para hacer deporte, pasear por la ciudad o salir de excursión por el día. El bolsillo frontal con cremallera mantiene a mano los objetos pequeños, las correas laterales permiten ajustar la carga y el cierre de cordón de la parte superior facilita abrirla y cerrarla. Su diseño bicolor queda bien en la ciudad y en el sendero. Consulta la ficha del producto para ver tamaños y materiales antes de comprar y elige la mochila que encaja con tu rutina.',
    },
  },
  {
    title: 'Small zip travel pouch',
    category: 'Fashion',
    photo: 'bag.jpg',
    en: {
      short:
        'A black zip pouch with several compartments and a wrist strap, easy to carry anywhere.',
      medium:
        'This small black pouch is made of a woven fabric and closes with zips. It has more than one compartment, a zipped pocket on the front and a wrist strap, so your small things stay organised and within reach when you travel or move around the city.',
      seo: 'Small black zip pouch for travel and everyday use. If you need a compact bag to keep your small items organised, this pouch has several zipped compartments and a zipped pocket on the front under a flap. The wrist strap makes it easy to carry and the silver zip pulls add a clean finish. Use it as a travel organiser, to hold accessories, or inside a larger bag. Check the product page for exact measurements and materials before you buy.',
    },
    es: {
      short:
        'Un neceser negro con cremalleras, varios compartimentos y una correa de muñeca, fácil de llevar a cualquier sitio.',
      medium:
        'Este neceser pequeño es negro, de tejido y se cierra con cremalleras. Tiene más de un compartimento, un bolsillo con cremallera en la parte delantera y una correa de muñeca, para que tus cosas pequeñas estén ordenadas y a mano cuando viajas o te mueves por la ciudad.',
      seo: 'Neceser pequeño negro con cremallera para viajar y para el día a día. Si necesitas una bolsa compacta para mantener ordenados tus objetos pequeños, este neceser tiene varios compartimentos con cremallera y un bolsillo con cremallera en la parte delantera, bajo una solapa. La correa de muñeca facilita llevarlo y los tiradores plateados de las cremalleras le dan un acabado limpio. Úsalo como organizador de viaje, para guardar accesorios o dentro de un bolso más grande. Consulta la ficha del producto para ver las medidas y los materiales exactos antes de comprar.',
    },
  },
  {
    title: 'Ceramic pour-over coffee dripper',
    category: 'Home & Kitchen',
    en: {
      short: 'A ceramic dripper for making pour-over coffee by hand at home.',
      medium:
        'Make filter coffee the slow way with this ceramic pour-over dripper. You pour the hot water over the ground coffee yourself, so you control the pace and the result in the cup. A simple tool for people who enjoy the ritual of coffee at home.',
      seo: 'Ceramic pour-over coffee dripper for the kitchen. Pour-over is a manual way of brewing coffee in which you pour hot water over the ground coffee and let it drip into your cup or jug, and this ceramic dripper is made for it. It suits anyone who likes to control how their coffee is made and enjoys the process as much as the result. A practical accessory for your home kitchen and a good gift for coffee lovers. Check the product page for the size and the compatible filters before you buy.',
    },
    es: {
      short: 'Un gotero de cerámica para preparar café de filtro a mano en casa.',
      medium:
        'Prepara el café de filtro de la manera lenta con este gotero de cerámica. Tú mismo viertes el agua caliente sobre el café molido, así que controlas el ritmo y el resultado en la taza. Una herramienta sencilla para quien disfruta del ritual del café en casa.',
      seo: 'Gotero de cerámica para café de filtro, para la cocina. El café de filtro a mano consiste en verter agua caliente sobre el café molido y dejar que gotee en tu taza o jarra, y este gotero de cerámica está hecho para ello. Es ideal para quien quiere controlar cómo se prepara su café y disfruta tanto del proceso como del resultado. Un accesorio práctico para tu cocina y un buen regalo para los amantes del café. Consulta la ficha del producto para ver el tamaño y los filtros compatibles antes de comprar.',
    },
  },
  {
    title: 'Vitamin C brightening face serum 30 ml',
    category: 'Beauty',
    en: {
      short:
        'A 30 ml face serum with vitamin C, made for a brighter-looking daily skincare routine.',
      medium:
        'This 30 ml face serum contains vitamin C and is designed to be part of your daily skincare routine. It is a simple step for people who want their skin to look fresh and bright, in a bottle that is easy to keep in the bathroom or take with you.',
      seo: 'Vitamin C brightening face serum, 30 ml. If you are looking for a face serum with vitamin C to include in your daily routine, this 30 ml bottle is a simple way to start. It is designed to give skin a brighter look and fits easily into a morning or an evening skincare routine. Check the product page for the full list of ingredients and the instructions for use before using it, and choose the skincare that suits you best.',
    },
    es: {
      short:
        'Un sérum facial de 30 ml con vitamina C, pensado para una rutina de cuidado diaria que aporta luminosidad.',
      medium:
        'Este sérum facial de 30 ml contiene vitamina C y está pensado para formar parte de tu rutina diaria de cuidado de la piel. Es un paso sencillo para quien quiere que su piel se vea fresca y luminosa, en un frasco fácil de guardar en el baño o de llevar contigo.',
      seo: 'Sérum facial iluminador con vitamina C, 30 ml. Si buscas un sérum facial con vitamina C para incluir en tu rutina diaria, este frasco de 30 ml es una manera sencilla de empezar. Está pensado para dar un aspecto más luminoso a la piel y encaja fácilmente en una rutina de cuidado de la mañana o de la noche. Consulta la ficha del producto para ver la lista completa de ingredientes y las instrucciones de uso antes de utilizarlo, y elige el cuidado de la piel que mejor te convenga.',
    },
  },
  {
    title: 'Wireless noise-cancelling headphones X200',
    category: 'Electronics',
    en: {
      short: 'Wireless headphones with noise cancelling, so your music and your calls come first.',
      medium:
        'The X200 are wireless headphones with noise cancelling. They let you listen without cables and help you leave the noise around you outside, whether you are working, travelling or relaxing at home.',
      seo: 'X200 wireless noise-cancelling headphones for everyday listening. Being wireless, they give you the freedom to move, and noise cancelling helps you concentrate on your music, podcasts and calls in busy places. Use them to work with focus, to travel or to relax at home. If you are looking for wireless headphones with noise cancelling, the X200 is a clear option to compare. Check the product page for the full specifications before you buy.',
    },
    es: {
      short:
        'Auriculares inalámbricos con cancelación de ruido, para que tu música y tus llamadas sean lo primero.',
      medium:
        'Los X200 son auriculares inalámbricos con cancelación de ruido. Te permiten escuchar sin cables y ayudan a dejar fuera el ruido que te rodea, ya sea mientras trabajas, viajas o te relajas en casa.',
      seo: 'Auriculares inalámbricos con cancelación de ruido X200 para escuchar a diario. Al ser inalámbricos te dan libertad de movimiento, y la cancelación de ruido te ayuda a concentrarte en tu música, tus pódcast y tus llamadas en lugares con mucho ruido. Úsalos para trabajar con concentración, para viajar o para relajarte en casa. Si buscas auriculares inalámbricos con cancelación de ruido, los X200 son una opción clara para comparar. Consulta la ficha del producto para ver todas las especificaciones antes de comprar.',
    },
  },
];
