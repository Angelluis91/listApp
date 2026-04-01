// Datos estáticos: categorías de productos, emojis para listas, precios aproximados y tienda por defecto
export const MAIN_DATA = [
  { id: 'perritas',    icon: '🐶', name: 'Perritas',              items: ['Comida perritas', 'Premio perritas', 'Palitos dientes perritas', 'Bolsa caca perritas'] },
  { id: 'panaderia',   icon: '🍞', name: 'Panadería',             items: ['Pan sandwich', 'Tortillas trigo', 'Pan tostado', 'Picoteo trabajo', 'Pan hamburguesa', 'Pan perrito'] },
  { id: 'charcuteria', icon: '🥓', name: 'Charcutería & Lácteos', items: ['Jamón', 'Lomo de cerdo', 'Bacon', 'Queso', 'Queso rayado/polvo', 'Salmón', 'Mantequilla', 'Jamón ibérico', 'Tacos jamón', 'Queso burgos/mozarella', 'Queso untar', 'Cottage', 'Guacamole', 'Salchichas'] },
  { id: 'refrigerados', icon: '🥚', name: 'Refrigerados',         items: ['Postrecito', 'Yogurt', 'Zumo', 'Vitamina C', 'Huevos', 'Pechuga', 'Filete', 'Carne picada', 'Pescado/langostinos'] },
  { id: 'congelados',  icon: '❄️', name: 'Congelados',            items: ['Guisantes', 'Croquetas/palitos queso/nuggets', 'Patatas congeladas bolsa', 'Helados'] },
  { id: 'frutas',      icon: '🍎', name: 'Frutas & Verduras',     items: ['Cebolla', 'Arándanos', 'Pimientos de padrón', 'Tomates', 'Lechuga', 'Rúcula', 'Limones/limas', 'Manzanas', 'Ajos', 'Patatas/batata', 'Zanahorias', 'Champiñones/setas', 'Mazorca', 'Pimiento', 'Calabaza/calabacín', 'Pepino', 'Cilantro/cebollino/albahaca', 'Espinacas', 'Brócoli', 'Otra verdura', 'Verdura congelada', 'Remolacha', 'Aguacate'] },
  { id: 'bebidas',     icon: '🥛', name: 'Bebidas',               items: ['Leche x2', 'Vino blanco/rosado', 'Vino tinto'] },
  { id: 'despensa',    icon: '🫙', name: 'Despensa & Pasta',      items: ['Pasta corta', 'Noodles', 'Fideos', 'Spaguetti', 'Arroz', 'Garbanzos', 'Lentejas', 'Judías'] },
  { id: 'harinas',     icon: '🌾', name: 'Harinas & Repostería',  items: ['Harina pan', 'Harina de fuerza', 'Maicena', 'Levadura', 'Pan rallado/panko', 'Azúcar/moreno', 'Stevia', 'Miel', 'Mermelada', 'Chocolate negro'] },
  { id: 'especias',    icon: '🧂', name: 'Especias & Condimentos', items: ['Sal/gorda', 'Orégano polvo', 'Perejil polvo', 'Ajo polvo/cebolla polvo', 'Albahaca polvo', 'Canela polvo', 'Comino polvo', 'Pimienta', 'Pimentón/colorante', 'Cubitos (carne/pollo)'] },
  { id: 'salsas',      icon: '🍅', name: 'Salsas & Conservas',    items: ['Salsa tomate triturado', 'Ketchup', 'BBQ', 'Tabasco', 'Salsa Perrins', 'Mayonesa', 'Soja', 'Teriyaki', 'Mostaza', 'Maíz lata', 'Atún', 'Pimiento asado', 'Aceitunas/negras', 'Pepinillos'] },
  { id: 'desayuno',    icon: '☕', name: 'Desayuno & Snacks',     items: ['Café molido', 'Café instantáneo', 'Colacao', 'Manzanilla/té', 'Cereales', 'Galletas', 'Anacardos/nueces/cacahuetes', 'Nata cocinar'] },
  { id: 'aceites',     icon: '🫒', name: 'Aceites & Vinagres',    items: ['Aceite oliva trufa', 'Aceite oliva cocinar', 'Aceite girasol', 'Vinagre/frambuesa/módena'] },
  { id: 'higiene',     icon: '🧴', name: 'Higiene Personal',      items: ['Champú/seco', 'Gel ducha/manos', 'Exfoliante', 'Contorno de ojos', 'Crema celulitis', 'Pastillas essix', 'Bastoncillos', 'Gel íntimo', 'Desodorante', 'Alcohol/agua ox', 'Suero fisiológico', 'Tiritas', 'Enjuague bucal', 'Seda dental', 'Productos pelo', 'Desmaquillante/discos algodón', 'Acetona rosa', 'Tampones', 'Compresas'] },
  { id: 'hogar',       icon: '🧻', name: 'Hogar & Papel',         items: ['Papel baño', 'Papel cocina', 'Servilletas', 'Pañuelos coche', 'Clinex', 'Toallitas váter'] },
  { id: 'limpieza',    icon: '🧹', name: 'Limpieza',              items: ['Estropajo/metal', 'Trapo amarillo/polvo/cristales/baño', 'Pestosin baño/salón', 'Cillit Bang', 'Mokito WC', 'Limpiador WC', 'Lavavajillas', 'Desatascador', 'Pronto', 'Quita grasas/limpia cocina', 'Limpia cristales', 'Friega suelos', 'Limpia lavadoras', 'Lejía', 'Jabón ropa', 'Suavizante'] },
  { id: 'bolsas',      icon: '🛍️', name: 'Bolsas & Papel Cocina', items: ['Bolsas basura 10L', 'Bolsas basura 30L', 'Bolsas basura orgánica', 'Bolsas zip', 'Papel film', 'Papel aluminio', 'Papel horno'] },
];

export const EMOJIS = ['📝', '🛒', '💊', '✈️', '🏖️', '🎉', '🏠', '🐾', '💪', '🎁', '🍳', '🧳', '📦', '🌿', '🎓'];

// Precios aproximados por producto en euros (2024-2025, marca blanca Mercadona/Alcampo)
export const PRICES = {
  'Comida perritas': 12.50, 'Premio perritas': 3.20, 'Palitos dientes perritas': 4.50, 'Bolsa caca perritas': 2.90,
  'Pan sandwich': 1.50, 'Tortillas trigo': 1.90, 'Pan tostado': 1.85, 'Picoteo trabajo': 1.20, 'Pan hamburguesa': 1.55, 'Pan perrito': 1.45,
  'Jamón': 2.50, 'Lomo de cerdo': 2.80, 'Bacon': 2.20, 'Queso': 2.90, 'Queso rayado/polvo': 2.10, 'Salmón': 4.50,
  'Mantequilla': 2.30, 'Jamón ibérico': 4.20, 'Tacos jamón': 1.90, 'Queso burgos/mozarella': 1.80,
  'Queso untar': 1.95, 'Cottage': 1.60, 'Guacamole': 2.50, 'Salchichas': 2.10,
  'Postrecito': 2.20, 'Yogurt': 2.40, 'Zumo': 2.50, 'Vitamina C': 4.90, 'Huevos': 2.80,
  'Pechuga': 6.50, 'Filete': 8.00, 'Carne picada': 4.50, 'Pescado/langostinos': 7.50,
  'Guisantes': 1.50, 'Croquetas/palitos queso/nuggets': 3.20, 'Patatas congeladas bolsa': 2.50, 'Helados': 3.80,
  'Cebolla': 1.20, 'Arándanos': 3.50, 'Pimientos de padrón': 2.00, 'Tomates': 2.20, 'Lechuga': 1.10,
  'Rúcula': 1.80, 'Limones/limas': 1.50, 'Manzanas': 2.00, 'Ajos': 0.90, 'Patatas/batata': 1.80,
  'Zanahorias': 1.10, 'Champiñones/setas': 2.20, 'Mazorca': 1.40, 'Pimiento': 1.80, 'Calabaza/calabacín': 1.60,
  'Pepino': 0.90, 'Cilantro/cebollino/albahaca': 1.50, 'Espinacas': 1.90, 'Brócoli': 1.50,
  'Otra verdura': 2.00, 'Verdura congelada': 2.00, 'Remolacha': 1.80, 'Aguacate': 2.00,
  'Leche x2': 2.80, 'Vino blanco/rosado': 4.50, 'Vino tinto': 4.50,
  'Pasta corta': 0.95, 'Noodles': 1.80, 'Fideos': 0.90, 'Spaguetti': 0.95, 'Arroz': 1.40,
  'Garbanzos': 1.10, 'Lentejas': 1.10, 'Judías': 1.10,
  'Harina pan': 1.20, 'Harina de fuerza': 1.40, 'Maicena': 1.50, 'Levadura': 0.80,
  'Pan rallado/panko': 1.30, 'Azúcar/moreno': 1.20, 'Stevia': 3.50, 'Miel': 3.90, 'Mermelada': 1.80, 'Chocolate negro': 1.50,
  'Sal/gorda': 0.80, 'Orégano polvo': 0.85, 'Perejil polvo': 0.85, 'Ajo polvo/cebolla polvo': 0.90,
  'Albahaca polvo': 0.85, 'Canela polvo': 0.90, 'Comino polvo': 0.90, 'Pimienta': 0.95,
  'Pimentón/colorante': 0.90, 'Cubitos (carne/pollo)': 1.20,
  'Salsa tomate triturado': 0.85, 'Ketchup': 1.60, 'BBQ': 1.90, 'Tabasco': 2.80, 'Salsa Perrins': 2.50,
  'Mayonesa': 1.90, 'Soja': 1.80, 'Teriyaki': 2.50, 'Mostaza': 1.50, 'Maíz lata': 0.90,
  'Atún': 1.10, 'Pimiento asado': 1.50, 'Aceitunas/negras': 1.60, 'Pepinillos': 1.60,
  'Café molido': 3.90, 'Café instantáneo': 4.20, 'Colacao': 4.50, 'Manzanilla/té': 1.50,
  'Cereales': 2.80, 'Galletas': 1.70, 'Anacardos/nueces/cacahuetes': 3.50, 'Nata cocinar': 1.10,
  'Aceite oliva trufa': 8.50, 'Aceite oliva cocinar': 5.90, 'Aceite girasol': 2.20, 'Vinagre/frambuesa/módena': 2.50,
  'Champú/seco': 4.50, 'Gel ducha/manos': 2.20, 'Exfoliante': 5.90, 'Contorno de ojos': 9.90,
  'Crema celulitis': 8.50, 'Pastillas essix': 3.20, 'Bastoncillos': 1.50, 'Gel íntimo': 3.50,
  'Desodorante': 3.50, 'Alcohol/agua ox': 1.80, 'Suero fisiológico': 3.20, 'Tiritas': 2.50,
  'Enjuague bucal': 3.20, 'Seda dental': 2.50, 'Productos pelo': 5.00,
  'Desmaquillante/discos algodón': 3.80, 'Acetona rosa': 2.50, 'Tampones': 4.50, 'Compresas': 3.80,
  'Papel baño': 5.90, 'Papel cocina': 3.50, 'Servilletas': 2.20, 'Pañuelos coche': 1.80, 'Clinex': 2.90, 'Toallitas váter': 3.50,
  'Estropajo/metal': 1.50, 'Trapo amarillo/polvo/cristales/baño': 3.50, 'Pestosin baño/salón': 3.20,
  'Cillit Bang': 3.90, 'Mokito WC': 3.50, 'Limpiador WC': 2.50, 'Lavavajillas': 4.50,
  'Desatascador': 3.90, 'Pronto': 4.20, 'Quita grasas/limpia cocina': 3.50, 'Limpia cristales': 2.80,
  'Friega suelos': 3.20, 'Limpia lavadoras': 3.90, 'Lejía': 1.80, 'Jabón ropa': 8.90, 'Suavizante': 4.50,
  'Bolsas basura 10L': 2.20, 'Bolsas basura 30L': 2.80, 'Bolsas basura orgánica': 2.50,
  'Bolsas zip': 2.20, 'Papel film': 1.80, 'Papel aluminio': 2.20, 'Papel horno': 1.90,
};

// Tienda por defecto de cada producto según hábito de compra inicial
// Los que estaban marcados al migrar pertenecen a mercadona, el resto a alcampo
export const DEFAULT_STORE = 'alcampo';
