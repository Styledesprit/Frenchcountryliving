// The Luberon 7-day itinerary, rebuilt page by page from the original PDF.
// Coordinates are approximate starting points: use "Locate all" in the Places panel
// (or drag the pins) to confirm them.
import type { Block, ImageRef, Itinerary, Page, Route, Stop, TextStyle, Theme } from '../types';
import { uid } from '../lib/store';

export const DEFAULT_THEME: Theme = {
  displayFont: 'Cormorant Garamond',
  headingFont: 'Cormorant Garamond',
  bodyFont: 'Crimson Pro',
  bodySize: 11.5,
  ink: '#4a4644',
  accent: '#b48d84',
  soft: '#efd9d2',
  cream: '#fdf5f1',
  blush: '#dcbab1',
};

const CREAM = DEFAULT_THEME.cream;
const BLUSH = DEFAULT_THEME.blush;

// ---------- small builders ----------
const seed = (name: string, position?: string): ImageRef => ({ src: `seed/${name}.jpg`, position });
const gm = (q: string) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
/** highlighted, clickable place name */
const L = (text: string, where: string, url?: string) => `<a href="${url || gm(where)}">${text}</a>`;

const heading = (kind: 'display' | 'title' | 'subtitle' | 'eyebrow', html: string, style?: TextStyle): Block => ({
  id: uid(),
  type: 'heading',
  kind,
  html,
  style,
});
const text = (html: string, style?: TextStyle): Block => ({ id: uid(), type: 'text', html, style });
const time = (label: string, html: string): Block => ({ id: uid(), type: 'time', label, html });
const tip = (html: string): Block => ({ id: uid(), type: 'tip', html });
const images = (
  imgs: ImageRef[],
  layout: 'single' | 'row' | 'collage' | 'polaroids',
  height: number,
  frame = true,
): Block => ({ id: uid(), type: 'images', images: imgs, layout, height, frame });
const spacer = (height: number): Block => ({ id: uid(), type: 'spacer', height });

const page = (name: string, blocks: Block[], extra: Partial<Page> = {}): Page => ({
  id: uid(),
  name,
  layout: 'plain',
  background: CREAM,
  padding: 16,
  valign: 'top',
  blocks,
  ...extra,
});

const split = (name: string, image: ImageRef, blocks: Block[], extra: Partial<Page> = {}): Page =>
  page(name, blocks, {
    layout: 'split',
    side: { image, position: 'right', widthPct: 37, edge: true },
    ...extra,
  });

const stop = (name: string, address: string, lat: number, lng: number, extra: Partial<Stop> = {}): Stop => ({
  id: uid(),
  name,
  address,
  lat,
  lng,
  inRoute: true,
  verified: false,
  ...extra,
});

const route = (name: string, mode: Route['mode'], stops: Stop[], distanceLabel?: string): Route => ({
  id: uid(),
  name,
  mode,
  stops,
  distanceLabel,
});

const dayCover = (n: number, subtitle: string, imgs: ImageRef[]): Page =>
  page(
    `Day ${n} – cover`,
    [
      spacer(6),
      heading('display', `DAY ${n}`, { size: 96, align: 'center', color: '#fbeee9' }),
      heading('subtitle', subtitle, { align: 'center' }),
      spacer(10),
      images(imgs, 'collage', 190),
    ],
    { background: BLUSH },
  );

const addresses = (routeIds: string[], qrRouteId: string, title = "TODAY'S ADDRESSES"): Block => ({
  id: uid(),
  type: 'addresses',
  title,
  routeIds,
  showQr: true,
  qrRouteId,
});

const mapPage = (label: string, r: Route): Page =>
  page(
    `Map – ${label}`,
    [
      spacer(8),
      heading('display', 'MAP', { size: 60, align: 'center', color: '#d9cbc5', letterSpacing: 0.05 }),
      heading('title', label.toUpperCase(), { align: 'center', size: 26 }),
      spacer(6),
      { id: uid(), type: 'map', routeId: r.id, height: 150, showDistance: true, showLinks: true },
    ],
    { band: { color: BLUSH, fromPct: 46 } },
  );

const dayHead = (day: string, weekday: string, intro: string): Block[] => [
  heading('display', day, { size: 40 }),
  heading('eyebrow', weekday),
  text(intro, { weight: 600 }),
];

// ---------- routes / places ----------
const fontenille = () =>
  stop('Domaine de Fontenille', 'Route de Roquefraiche, 84360 Lauris', 43.7497, 5.3365, {
    url: 'https://www.domainesdefontenille.com/',
  });

export function buildLuberon(): Itinerary {
  const day1 = route('Day 1', 'walking', [
    stop('Cours Mirabeau', '13100 Aix-en-Provence', 43.5265, 5.4469),
    stop('La Fontaine de la Rotonde', 'Place du Général de Gaulle, 13100 Aix-en-Provence', 43.5262, 5.4442),
    stop("L'Incontournable", '14 Rue de Montigny, 13100 Aix-en-Provence', 43.5296, 5.4486),
    stop('Fontaine des Quatre Dauphins', 'Place des 4 Dauphins, 13100 Aix-en-Provence', 43.5248, 5.4497),
    stop('Hôtel de Gallifet', '52 Rue Cardinale, 13100 Aix-en-Provence', 43.5249, 5.4522, {
      url: 'https://www.hoteldegallifet.com/fr',
    }),
    stop('Église Saint-Jean-de-Malte', "24 Rue d'Italie, 13100 Aix-en-Provence", 43.5256, 5.4530),
    stop('Musée Granet', 'Place Saint-Jean de Malte, 13100 Aix-en-Provence', 43.5254, 5.4536, {
      url: 'https://www.museegranet-aixenprovence.fr/',
    }),
    { ...fontenille(), inRoute: false },
  ], '2 MILES / 3.2KM');

  const day2 = route('Day 2', 'driving', [
    fontenille(),
    stop('Château de Gordes', 'Place Genty Pantaly, 84220 Gordes', 43.9116, 5.2003),
    stop('Église Saint-Firmin', '84220 Gordes', 43.9112, 5.1993),
    stop('La Bastide de Gordes', '61 Rue de la Combe, 84220 Gordes', 43.9105, 5.2008),
    stop('Église Saint-Michel', 'Village haut, 84220 Roussillon', 43.9024, 5.2929),
    stop('Sentier des Ocres', '84220 Roussillon', 43.8996, 5.2958),
    stop('Le Bouchon', '9 Rue du Grand Pré, 84160 Lourmarin', 43.7636, 5.3626),
  ], '44 MILES / 71KM');

  const day3 = route('Day 3', 'driving', [
    fontenille(),
    stop('Château Val Joanis', '2404 Route de Villelaure, 84120 Pertuis', 43.6978, 5.4589, {
      url: 'https://www.val-joanis.com/',
    }),
    stop('Château La Coste', '2750 Route de la Cride, 13610 Le Puy-Sainte-Réparade', 43.6382, 5.4267, {
      url: 'https://chateau-la-coste.com/',
    }),
    { ...fontenille(), name: 'Domaine de Fontenille (return)' },
  ], '34.5 MILES / 55.5KM');

  const day4 = route('Day 4', 'driving', [
    fontenille(),
    stop('Maison de la Truffe et du Vin du Luberon', "Place de l'Horloge, 84560 Ménerbes", 43.8326, 5.2061),
    stop('Oppède le Vieux', '84580 Oppède', 43.8283, 5.1600),
    stop('La Bastide de Marie', '64 Chemin des Peirelles, 84560 Ménerbes', 43.8162, 5.1915),
    stop('Moulin de Jérusalem', 'Rue du Jeu de Paume, 84220 Goult', 43.8633, 5.2440),
    stop('Edith Mézard', "Château de l'Ange, 84220 Goult", 43.8573, 5.2340),
    stop('La Petite Maison de Cucuron', "Place de l'Étang, 84160 Cucuron", 43.7727, 5.4391),
  ], '56 MILES / 90KM');

  const day5 = route('Day 5', 'driving', [
    stop('Château de Lourmarin', '2 Avenue Laurent Vibert, 84160 Lourmarin', 43.7656, 5.3597),
    stop('Église Saint-André et Saint-Trophime', '84160 Lourmarin', 43.7641, 5.3627),
    stop('Le Moulin de Lourmarin', 'Avenue Raoul Dautry, 84160 Lourmarin', 43.7630, 5.3615, {
      url: 'https://www.beaumier.com/fr/proprietes/hotel-le-moulin/',
      inRoute: false,
    }),
    stop('Capelongue', 'Les Claparèdes, 550 Chemin des Cabanes, 84480 Bonnieux', 43.8193, 5.3024),
    stop('Musée de la Boulangerie', '12 Rue de la République, 84480 Bonnieux', 43.8237, 5.3081),
    stop('Musée de la Vieille Église', '84480 Bonnieux', 43.8254, 5.3071),
    stop("Au Détour d'une Promenade", 'Route de la Gare, 84480 Bonnieux', 43.8229, 5.3086),
    stop('Saint-Paul de Mausole Monastery', '2 VC des Carrières, 13210 Saint-Rémy-de-Provence', 43.7783, 4.8331),
    stop('Restaurant de Tourrel', '5 Rue Carnot, 13210 Saint-Rémy-de-Provence', 43.7893, 4.8318),
    stop('Chapeau de Paille', '29 Boulevard Mirabeau, 13210 Saint-Rémy-de-Provence', 43.7889, 4.8335),
  ], '40 MILES / 65KM');

  const day6a = route('Day 6 – Option 1', 'walking', [
    stop('Les Halles', '18 Place Pie, 84000 Avignon', 43.9480, 4.8077),
    stop('Palais des Papes', 'Place du Palais, 84000 Avignon', 43.9507, 4.8075),
    stop('La Mirande', '4 Place de la Mirande, 84000 Avignon', 43.9512, 4.8063, { inRoute: false }),
    stop("Pont d'Avignon", 'Boulevard de la Ligne, 84000 Avignon', 43.9539, 4.8049),
  ], '1.7 MILES / 2.8KM');

  const day6b = route('Day 6 – Option 2', 'driving', [
    stop('Fort Saint-André', 'Rue Montée du Fort, 30400 Villeneuve-lès-Avignon', 43.9655, 4.7958),
    stop("L'Annexe", '7 Place Saint-Marc, 30400 Villeneuve-lès-Avignon', 43.9644, 4.7967),
    stop('Atelier Vime', '4 Quai du Rhône, 30300 Vallabrègues', 43.8545, 4.6283),
    stop('Carrières de Lumières', 'Route de Maillane, 13520 Les Baux-de-Provence', 43.7469, 4.7951, {
      url: 'https://www.carrieres-lumieres.com/',
    }),
  ], '48 MILES / 78KM');

  const day7a = route('Day 7 – Option 1', 'driving', [
    stop('Village des Antiquaires de la Gare', "2 Avenue de l'Égalité, 84800 L'Isle-sur-la-Sorgue", 43.9178, 5.0466),
    stop('Chez Paulette', '130 Rue de la République, 13810 Eygalières', 43.7609, 4.9493),
    stop('Maison Hache', '30 Rue de la République, 13810 Eygalières', 43.7606, 4.9501),
  ], '16.3 MILES / 26.2KM');

  const day7b = route('Day 7 – Option 2', 'driving', [
    stop('Brocante Parking des Platanes', '84200 Carpentras', 44.0566, 5.0466),
    stop('Moulin Rive Gauche', 'Route de la Roque, 84210 Althen-des-Paluds', 44.0019, 4.9601),
    stop('Château et Jardin de Brantes', '157 Chemin de Brantes, 84700 Sorgues', 44.0189, 4.8826),
  ], '14.3 MILES / 23KM');

  const routes = [day1, day2, day3, day4, day5, day6a, day6b, day7a, day7b];

  const pages: Page[] = [
    // 1 — cover
    page(
      'Cover',
      [
        heading('eyebrow', 'MF<br>CH', { font: 'Cormorant Garamond', size: 22, color: '#fbeee9', letterSpacing: 0.02 }),
        heading('display', 'T R A V E L', { size: 64, color: '#fbeee9' }),
        images([seed('cover-house'), seed('cover-lavender')], 'collage', 175),
        heading('title', 'A WEEK IN<br>PROVENCE', { color: '#5a5654', weight: 600, letterSpacing: 0.12, size: 30 }),
        heading('eyebrow', '7-DAY ITINERARY', { color: '#fbeee9', size: 14 }),
      ],
      { background: '#d6b5ad' },
    ),

    // 2 — welcome
    split(
      'Bienvenue',
      seed('intro-street'),
      [
        heading('title', 'BIENVENUE!', { color: '#e0b5aa', size: 34 }),
        text(
          `The Luberon, in the heart of France’s ${L('Provence-Alpes-Côte d’Azur', 'Provence-Alpes-Côte d’Azur')} region, generally refers to the area within and around the ${L('Luberon Mountains', 'Massif du Luberon')} and is renowned for its hilltop villages, stunning natural beauty and fascinating mediaeval heritage. With so much ground to cover, it’s hard to know how best to plan. No worries – we’ve mapped out a 7-day travel guide to help you make the most of this exceptional area!`,
          { align: 'justify' },
        ),
        text(
          'This MFCH Itinerary will take you through some of the most scenic landscapes in France, touring rolling stretches of countryside, forested valleys, olive groves and lavender fields and jagged cliffs perched with ancient towns (several of which grace the coveted “Les Plus Beaux Villages de France,” or “Most Beautiful Villages of France,” list).',
          { align: 'justify' },
        ),
        images([seed('intro-gordes', '50% 40%')], 'single', 58),
        text(
          'From hilltop village hopping to antiquing at Provencal markets to stunning chateaux and garden visits – you can trust our guide’s got you covered with all the best things to see and do and places to stay and eat along the way.',
          { align: 'justify' },
        ),
        text(
          'Note we’ve taken daily French culture (like a traditional weekly marché) into account and outlined our recommendations by day of the week to align with the days that antique markets happen, but feel free to start on any day you wish, and of course, mix and match at your leisure.',
          { align: 'justify' },
        ),
        text(
          'Brimming with all the charm, beauty and rich history you’d expect from this unique part of the South of France – a week in the Luberon is one you’ll never forget. It’s time to slow down and immerse yourself in the charms of authentic French living!',
          { align: 'justify' },
        ),
      ],
      { band: { color: '#e8cfc8', fromPct: 49 }, side: { image: seed('intro-street'), position: 'left', widthPct: 40, edge: false } },
    ),

    // 3 — accommodation
    page('Overview – Accommodation', [
      heading('title', 'ITINERARY OVERVIEW', { align: 'center', color: '#e0b5aa', size: 34 }),
      heading('subtitle', 'ACCOMMODATION', { align: 'center' }),
      text(
        `Here at MFCH, we are proud to partner with the luxury hotel collection ${L('Domaines de Fontenille.', '', 'https://www.domainesdefontenille.com/')} Featuring stunning locations in the most beautiful regions in France, we can confidently ensure you’ll be in good hands.`,
        { align: 'center' },
      ),
      heading('subtitle', `<b>${L('Domaine de Fontenille', '', 'https://www.domainesdefontenille.com/')}</b>`, {
        align: 'center',
        font: 'Crimson Pro',
        size: 13,
      }),
      text(
        "In the heart of the Luberon region, Domaine de Fontenille offers an immersion in the heart of Provence to savor the beauty and benefits of the surrounding nature. The ground floor lounges and each of the 21 bright, unique rooms overlook the gardens designed by Lafourcade. The cuisine at Fontenille, led by Chef Meilleur Ouvrier de France, Guillaume Goupil, features regional produce in its gastronomic restaurant and bistro, with fruits and vegetables sourced from the Domaine's permaculture garden. Dinners are complete with wine that is produced from their own certified organic vineyards.",
        { align: 'center' },
      ),
      heading('subtitle', '<b>**SPECIAL OFFER**</b>', { align: 'center', font: 'Crimson Pro', size: 13, color: '#111111' }),
      text(
        `If you choose to make ${L('Domaine de Fontenille', '', 'https://www.domainesdefontenille.com/')} your home base in Provence, make a note in your reservation that you were referred through ${L('My French Country Home', '', 'https://www.myfrenchcountryhomemagazine.com/')} and you and a guest will be treated to a special aperitif complete with Champagne and small bites either in the hotel’s private Roseraie (in the summer) or by the roaring fireplace in their Alphonse Salon (in the winter).`,
        { align: 'center' },
      ),
      images([seed('fontenille')], 'single', 72, false),
    ]),

    // 4 — arrival & overview table
    page('Overview – Arrival', [
      heading('title', 'ITINERARY OVERVIEW', { align: 'center', color: '#e0b5aa', size: 34 }),
      heading('subtitle', 'ARRIVAL', { align: 'center' }),
      text(
        `Plan to fly into ${L('Marseille', 'Marseille Provence Airport')} airport or arrive from ${L('Paris', 'Paris')} via train. Either option is an easy journey to the first destination on our Itinerary – ${L('Aix-en-Provence', 'Aix-en-Provence')}.`,
        { align: 'center' },
      ),
      text(
        `This week-long Itinerary includes multiple stops and covers quite a bit of ground – as such, we’d suggest renting a car – which will offer you the luxury of exploring at your own pace – or hiring a private driver (we’re happy to recommend ${L('Sahn Drive', 'Sahn Drive')}, the official chauffeur company of our ${L('MFCH Tours', '', 'https://www.mfchtravel.com/')}, offering drivers who are kind, helpful and bilingual).`,
        { align: 'center' },
      ),
      heading('subtitle', 'GOOD TO KNOW', { align: 'center' }),
      text(
        'Make sure to book restaurant reservations as soon as possible. For cultural activities, check where tickets are available for purchase online to guarantee your spot.<br>Please note that this Itinerary was designed to mostly be done on foot, so be sure to pack comfortable walking shoes!',
        { align: 'center' },
      ),
      {
        id: uid(),
        type: 'table',
        header: ['DAY', 'CITIES'],
        rows: [
          ['DAY 1 (Monday)', 'ARRIVE AND EXPLORE AIX-EN-PROVENCE'],
          ['DAY 2 (Tuesday)', 'HILLTOP TOUR DAY: GORDES AND ROUSSILLON'],
          ['DAY 3 (Wednesday)', 'ART, ARCHITECTURE AND WINE!'],
          ['DAY 4 (Thursday)', 'HILLTOP TOUR DAY 2: MÉNERBES, OPPÈDE LE VIEUX AND GOULT'],
          ['DAY 5 (Friday)', 'LOURMARIN AND BONNIEUX'],
          ['DAY 6 (Saturday)', 'VILLENEUVE LES AVIGNON + AVIGNON'],
          ['DAY 7 (Sunday)', "L'ISLE-SUR-LA-SORGUE OR CARPENTRAS"],
        ],
      },
      {
        id: uid(),
        type: 'note',
        html: `For local market days, visit: <a href="https://www.jours-de-marche.fr/">joursdemarche.fr</a><br><br>For local brocante and antique fairs, visit: <a href="http://videgrenier.org/">videgrenier.org</a>`,
      },
    ]),

    // ---------------- DAY 1 ----------------
    dayCover(1, 'Arrive and Explore Aix-en-Provence', [seed('d1-facade'), seed('d1-bike'), seed('d1-fountain')]),
    split('Day 1 – page 1', seed('d1-courtyard'), [
      ...dayHead(
        'DAY 1:',
        'MONDAY',
        `${L('Aix-en-Provence', 'Aix-en-Provence')} is an elegant and quintessential Provençal town, perfect for starting out your Itinerary. Set against a spectacular backdrop of vineyards, lavender fields and mountains, it’s filled with beautifully winding streets, charming shops, wonderful restaurants and ancient fountains. Wherever you’re coming from, plan to arrive early to make the most of your first day!`,
      ),
      time(
        '9AM',
        `Arrive in ${L('Aix', 'Aix-en-Provence')} and start your trip off on the iconic, tree-lined ${L('Cours Mirabeau', 'Cours Mirabeau, Aix-en-Provence')}: a lively, historic boulevard lined with bustling cafés and charming shops – the perfect place to sit with a coffee and people watch, or get to some serious shopping.`,
      ),
      time(
        '10AM',
        `If you are looking for more shopping, continue onto the rue Thiers, and wander to one of our favorite shops, ${L('Rose et Marius', 'Rose et Marius, Aix-en-Provence')}: a Maison de Haute Parfumerie offering sumptuous fragrances in the form of perfumes, candles, diffusers and beyond.`,
      ),
      tip('TIP: You can even book a perfume-making lesson.'),
      text(
        `To continue exploring scents of the South of France, follow this visit up with a stop at ${L('Fragonard', 'Fragonard, Aix-en-Provence')}, another exceptional parfumeur that also sells pretty clothing and home décor. And ${L('Franc 1884', 'Franc 1884, Aix-en-Provence')}, the haute couture of lavender wand creators.`,
      ),
      time(
        '11AM',
        `After you’ve had your fill of shopping, head over to the ${L('Atelier de Cézanne', 'Atelier de Cézanne, Aix-en-Provence')}, the former studio of post-impressionist painter Paul Cézanne, where he worked from 1902 until his death in 1906.<span style="color:var(--accent)">...(continued onto next page)</span>`,
      ),
    ]),
    split('Day 1 – page 2', seed('d1-artmarket'), [
      text(
        'Tranquil, full of pastel-colored charm and – from paints to canvases to smocks – left shockingly untouched – it is a rare and intimate look into the processes and surroundings of a man who painted some of the most renowned masterpieces in the world.',
      ),
      time(
        '12PM',
        `Next, walk over to the ${L('Musée Granet', 'Musée Granet, Aix-en-Provence')}: a prestigious art museum situated inside a magnificent historic building. Known for its diverse collection that spans centuries, Granet showcases over 12,000 works by world-famous artists such as Monet, Picasso and Van Gogh. It also features an extensive exhibit dedicated entirely to Provençal art, shining a spotlight on the cultural heritage of the region. Browse at your leisure or opt for a tour or audio guide!`,
      ),
      tip(
        'TIP: When you exit, poke your head into the 13th-century Église Saint-Jean-de-Malte, which shares a garden with the museum – it was the first Gothic Roman Catholic Church ever constructed in Provence!',
      ),
      time(
        '1PM',
        `By now, you’ll have worked up an appetite… Luckily you have options for lunch! Take a short walk to ${L('L’Incontournable', "L'Incontournable, 14 Rue de Montigny, Aix-en-Provence")} and enjoy an excellent meal in the shade of the trees on the ${L('rue de Montigny', 'Rue de Montigny, Aix-en-Provence')}. Alternatively, wander 5 minutes to Hôtel de Gallifet – passing by one of the city’s most famous fountains: the ${L('Fontaine des Quatre Dauphins', 'Fontaine des Quatre Dauphins, Aix-en-Provence')} (“Fountain of the Four Dolphins”) – a private 18th-century mansion turned contemporary art haven (have a look around before or after you eat, as you wish).`,
      ),
      text(
        `Relax under a canopy of chestnut trees in the courtyard of ${L('Gallifet Kitchen', '', 'https://www.hoteldegallifet.com/fr')}, the summer restaurant (open May - October), where you’ll be treated to simple yet refined Mediterranean-inspired cuisine made with only the freshest of local fare. Delightful in any season, if you’re there between November - April, you’ll dine in the “Winter Lounge:” a charming tearoom serving mixed plates, homemade cakes and cozy refreshments.`,
      ),
    ]),
    split(
      'Day 1 – page 3',
      seed('d1-terrace'),
      [
        time(
          '3PM',
          `After lunch, take some time to discover ${L('Vieil Aix', 'Vieil Aix, Aix-en-Provence')} (the city’s fascinating “Old Town”), which boasts many cultural sites and historic markets. Lose yourself down the many winding, narrow streets and hidden squares, marveling at the ancient bubbling fountains, old stone homes and ornate architecture.`,
        ),
        time(
          '7PM',
          `Once you’ve had your fix exploring Aix-en-Provence check in to your hotel for the week: ${L('Domaine de Fontenille.', '', 'https://www.domainesdefontenille.com/')} Have dinner at the hotel’s gastronomic restaurant, ${L('Le Champ des Lunes', 'Le Champ des Lunes, Lauris')}, or its bistro ${L('La Cuisine d’Amélie', "La Cuisine d'Amélie, Lauris")}, led by Chef and Meilleur Ouvrier de France, Guillaume Goupil. Fruits and vegetables used in the dishes come from the Domaine's permaculture garden, while the wine served there is produced from their own certified organic vineyard.`,
        ),
        spacer(52),
        addresses([day1.id], day1.id),
      ],
      { band: { color: BLUSH, fromPct: 58 } },
    ),
    mapPage('Day 1', day1),

    // ---------------- DAY 2 ----------------
    dayCover(2, 'Hilltop Tour Day: Gordes and Roussillon', [seed('d2-gordes'), seed('d2-senanque'), seed('d2-cloister')]),
    split('Day 2 – page 1', seed('d2-alley'), [
      ...dayHead(
        'DAY 2',
        'TUESDAY',
        'Today is our first hilltop tour, where you’ll discover two of the very charming “Most Beautiful Villages” in France – Gordes and Roussillon – with a luxurious lunch at an 18th century domaine in between. We offer up an option for a hike or walk, so make sure to dress or pack accordingly, if that’s your fancy, and this evening, you’ll be rewarded with an exquisite dinner in the nearby town of Lourmarin.',
      ),
      time(
        '9AM',
        `Have breakfast at your hotel, then drive about 50 minutes to ${L('Gordes', 'Gordes')}, an ancient hilltop village, complete with medieval ramparts and a Renaissance-style castle. Overlooking the Vaucluse Plateau, its perched position offers breathtaking panoramas of the surrounding countryside and mountains.`,
      ),
      tip('TIP: We suggest beginning your visit in the upper part of the town; parking can be found on the plateau, just north.'),
      text(
        'Start by walking along the road towards the city center – as you wind your way into the lower part of the village, take the time to wander down all the cobblestoned alleyways and picturesque streets admiring the quaint architecture, traditional stone homes and unique views.',
      ),
      tip("TIP: We especially love Rue Pavé d'Amour, Rue Fontaine Basse and Rue Jean Deyrolle."),
      time(
        '10AM',
        `Visit the ${L('Château de Gordes', 'Château de Gordes')}, an immaculately restored 11th-century castle with both medieval and Renaissance features. Explore the captivating collection of artwork and artifacts, and when you exit into Place Genty Pantaly, spot the historic fountain (the village’s sole source of drinking water in ancient times!).`,
      ),
      tip('TIP: the tourist office is also housed inside its imposing stone walls and towers, if you’d like to grab a map.'),
    ]),
    split('Day 2 – page 2', seed('d2-gordes-sky'), [
      time(
        '12PM',
        `Next, visit the 12th-century, Romanesque-style church in the heart of the village: the serene ${L('Eglise Saint-Firmin', 'Église Saint-Firmin, Gordes')} (dedicated to the town’s patron saint, Saint Firmin).`,
      ),
      text(
        "Nearby, you can also see La Porte de Savoie: the historic gate that was the original entrance to the city – a reminder of the village's rich history, as well as a glimpse into its medieval past.",
      ),
      time(
        '1PM',
        `For lunch in the lap of luxury, walk over to ${L('La Bastide de Gordes', 'La Bastide de Gordes')}, in the heart of the historic village. The property – with its ethereal atmosphere (thanks to its romantic 18th-century décor, including antiques handpicked in L’Isle-sur-la-Sorgue), terraced gardens and stunning panoramas of the Luberon Valley – features four different gourmet restaurants. Choose your own adventure: at this 5-star bastide, you can’t go wrong.`,
      ),
      time(
        '3PM',
        `After lunch, drive on to your second hilltop village: the charming ${L('Roussillon', 'Roussillon, Vaucluse')}, known for its signature red cliffs, ochre quarries and vibrant atmosphere. Stroll through the twisting maze of streets, taking in all the colorful buildings (the natural pigment ochre is used in the sun-soaked houses to offset heat, while also providing a pretty contrast to the plethora of cypress trees). Once you experience this town’s unique beauty for yourself, it’s easy to understand how it inspired so many French creatives, famously Jean Cocteau.`,
      ),
      tip('TIP: Parking is limited in the center, we suggest parking before the entrance to the village.'),
      text(
        `Explore the myriad art galleries, boutiques and local shops, all of which do a fine job highlighting Provence’s rich cultural heritage. Be sure to visit the ${L('Église Saint-Michel', 'Église Saint-Michel, Roussillon')}, with its distinctive bell tower and intriguing interiors.`,
      ),
    ]),
    split(
      'Day 2 – page 3',
      seed('d2-roussillon'),
      [
        time(
          '5PM',
          'After exploring, take a pause to lean into leisurely French living at the Place de la Mairie (the village’s central square) – a popular gathering place, mingle among the locals and relax with an aperitif on the terrace of one of the many charming cafes or restaurants.',
        ),
        time(
          '6PM',
          `Drive back to your hotel to refresh before dinner. Alternately, nature enthusiasts, take note: thanks to its position atop a ridge with a deep canyon below, Roussillon offers some of the most scenic hiking trails in the region – the ${L('Sentier des Ocres', 'Sentier des Ocres, Roussillon')} (“Ochre Trail”) is an easy and popular path that is less than a mile (takes about 20 minutes) and winds through the former open-air ochre quarries (this natural pigment is what lends the village its signature yellow and orange palette).`,
        ),
        time(
          '8PM',
          `For this evening, we’re happy to recommend ${L('Le Bouchon', 'Le Bouchon, 9 Rue du Grand Pré, Lourmarin')} – in the village of Lourmarin (which we’ll explore later this week!) – a small yet elegant restaurant with a truly warm welcome and a good selection of local wines. The menu offers an array of tapas style dishes, allowing you to enjoy as much or as little as you wish.`,
        ),
        spacer(8),
        addresses([day2.id], day2.id),
      ],
      { band: { color: BLUSH, fromPct: 61 } },
    ),
    mapPage('Day 2', day2),

    // ---------------- DAY 3 ----------------
    dayCover(3, 'Wine & Culture Day', [seed('d3-vineyard'), seed('d3-sculpture'), seed('d3-interior')]),
    split('Day 3 – page 1', seed('d3-dish'), [
      ...dayHead(
        'DAY 3',
        'WEDNESDAY',
        'Today, we’ve planned an exciting day of culture with visits to two incredibly unique estates – Château Val Joanis and Château La Coste – where wine, art, architecture and nature exist in perfect harmony… This will call for a bit of walking, so be sure to wear comfortable walking shoes!',
      ),
      time(
        '9AM',
        `Have breakfast at your hotel, and then drive to ${L('Château Val Joanis', '', 'https://www.val-joanis.com/')}, an historic estate and vineyard known for its traditional winemaking methods and exceptionally beautiful French gardens – a delightful, immersive experience for lovers of vin and nature, alike.`,
      ),
      text(
        'In addition to wine tastings and castle and garden tours, Château Val Joanis often hosts events, exhibitions and concerts – be sure to check the calendar for when you’re visiting, as it’s a great way to experience the local culture. Spend the morning visiting the gardens with the option of wine tasting too.',
      ),
      time(
        '12PM',
        `When you’re finished, drive around 20 minutes to ${L('Château La Coste', '', 'https://chateau-la-coste.com/')}, a truly magnificent wine estate with an enviable collection of art and architecture close to the village of Puy-Sainte-Réparade.`,
      ),
      text(
        'Not only does this breathtaking, 500-acre domaine produce and sell some of the best wines in the region, it’s home to one of the most outstanding outdoor museums (and one of the most gorgeous hotels) in France.',
      ),
      text(
        'Start your visit with a decadent, well-deserved lunch at one of the five restaurants on the grounds. From casual café fare to wood-fired pizzas to fine dining at the Michelin-starred restaurant… Each eatery at La Coste is a curated culinary experience in a spectacular setting.',
      ),
    ]),
    split(
      'Day 3 – page 2',
      seed('d3-vines'),
      [
        time(
          '2PM',
          'After lunch we highly recommend their “Art and Architecture Walk,” which will take you through some 40 installations created by different artists and beautifully integrated into the surrounding nature.',
        ),
        tip('TIP: We definitely suggest booking a guided tour (they have bilingual guides and options for transport) – plan for this to take around 2 hours.'),
        time(
          '4PM',
          'Next, consider a “Tasting Workshop”. Note, you’ll need to reserve ahead of time - you can also book a tour of the domaine’s legendary wine cellar, where you can try the estate’s organic wines and learn about the unique expressions of the Provençal terroir.',
        ),
        text(
          'On your way out, be sure to stop at the property Caveau, a 19th-century farmhouse turned shop, where you can purchase your favorite bottles along with other regional delicacies, such as olive oil and honey.',
        ),
        time(
          '6PM',
          'Drive back to your hotel. After an action-packed day, we recommend relaxing and dining at one of the restaurants at Domaine de Fontenille. Tomorrow will be your second day of hilltop touring…',
        ),
        spacer(20),
        addresses([day3.id], day3.id),
      ],
      { band: { color: BLUSH, fromPct: 70 } },
    ),
    mapPage('Day 3', day3),

    // ---------------- DAY 4 ----------------
    dayCover(4, 'Hilltop Day: Ménerbes, Oppède le Vieux and Goult', [
      seed('d4-oppede'),
      seed('d4-windmill'),
      seed('d4-chateau'),
    ]),
    split('Day 4 – page 1', seed('d4-garden'), [
      ...dayHead(
        'DAY 4',
        'THURSDAY',
        'Welcome to your second day of hilltop hopping – we’re taking you to Ménerbes, Oppède le Vieux and Goult, three of the most picturesque villages in the region, each with its own distinct character and breathtaking views. Get ready to immerse yourself in the ancient charm and natural beauty…',
      ),
      time(
        '9AM',
        `Have breakfast at the hotel, then drive to ${L('Ménerbes', 'Ménerbes')}, a picturesque perched village that presents sprawling views of the surrounding vineyards and countryside. Another listed “Most Beautiful Village in France,” it may be on the smaller side, but you’ll soon see its charm is well worth the trip.`,
      ),
      tip('TIP: It is easiest to park below and enter through the historic part of town.'),
      text(
        'Start by taking a stroll along the ramparts, admiring the stunning vistas. Wander into the center through one of the narrow streets, all flanked by beautiful stone homes that date back to the 1500s, coming across centuries-old churches and quaint squares and the town’s famous campanile – a wrought-iron laced clocktower.',
      ),
      text(
        `Explore all the little shops and galleries, often showcasing works by local artists. You could also visit ${L('Maison de la Truffe et du Vin du Luberon', 'Maison de la Truffe et du Vin du Luberon, Ménerbes')}, to learn about the region’s truffle and wine industries. Stop for a coffee and enjoy the views from the café and restaurant ${L('le Café Progrès', 'Café du Progrès, Ménerbes')}.`,
      ),
      time(
        '11AM',
        `When you’re through with all Ménerbes has to offer, drive to ${L('Oppède le Vieux', 'Oppède le Vieux')}, a surprising medieval village.`,
      ),
      tip('TIP: As you drive towards the village, slow down to enjoy the view over the old stone walls.'),
    ]),
    split('Day 4 – page 2', seed('d4-house'), [
      text(
        'Wander the village’s cobblestoned streets, taking in the architecture and enjoying the breathtaking views along the way. There are several options here for a coffee or snack.',
      ),
      tip(
        'TIP: Incredibly rich in history, much of Oppède le Vieux has remained untouched by modern renovation, so it’s an ideal destination to experience nearly entirely unspoiled medieval architecture.',
      ),
      time(
        '1PM',
        `After this morning’s hilltop excursions, we made sure to carve in some luxury for lunch… drive 10 minutes to ${L('La Bastide de Marie', 'La Bastide de Marie, Ménerbes')}, a stunning 18th-century property with a farmhouse nestled inside 65 acres of lavender fields, vineyards and olive groves.`,
      ),
      text(
        'This bucolic domaine is a gastronomic haven that also produces many of its own wines; start with a tasting, then dine at the property’s gourmet restaurant (lounge on the terrace, weather permitting!), which highlights the flavors of Provence with a menu crafted from only the freshest, locally sourced ingredients.',
      ),
      time(
        '3PM',
        `Drive to your final destination on today’s tour - ${L('Goult', 'Goult')}, a hilltop village tucked away in the tranquil Luberon countryside. This lesser-known gem is known for its gastronomy and also features an impressive medieval center with wonderfully preserved Provençal architecture. Look out for arched passageways, stone fountains, hidden squares!`,
      ),
      text(
        `Now’s a good moment to try some regional specialities at the town’s weekly farmers' market, where you can sample and take away cheeses and preserves, fresh produce and local wines. Be sure also to stop at ${L('Gatti', 'Gatti brocante, Goult')}, a little brocante store.`,
      ),
      text(
        `After you’ve stocked up on some goodies, visit the 12th-century castle and one of the town’s largest draws – the ${L('Moulin de Jérusalem', 'Moulin de Jérusalem, Goult')}, an ancient windmill turned contemporary art gallery.`,
      ),
    ]),
    split(
      'Day 4 – page 3',
      seed('d4-windmill2'),
      [
        text(
          `As you leave Goult, stop off at the amazing artisan, ${L('Edith Mézard', 'Edith Mézard, Château de l’Ange, Lumières')}: an embroiderer and homewares designer who’s set up a beautiful shop inside the former stables of her 18th-century château. Offering stylish linens for the bedroom, kitchen, bathroom and beyond, taking home a piece of the Luberon has never been more chic.`,
        ),
        time(
          '7PM',
          `For tonight’s dinner, you’re in for decadence. Drive to ${L('La Petite Maison de Cucuron', 'La Petite Maison de Cucuron')}, where the Le Cordon Bleu-trained chef serves up elevated dishes using fresh, locally sourced ingredients (including truffles, with an entire truffle menu each winter).`,
        ),
        text(
          'If the Michelin-starred cuisine alone isn’t enough to impress you, the elegant dining room – with its old-fashioned woodwork, Renaissance tapestries, and period tiling – will. An ever-popular establishment, be sure to make a reservation well in advance!',
        ),
        spacer(28),
        addresses([day4.id], day4.id),
      ],
      { band: { color: BLUSH, fromPct: 60 } },
    ),
    mapPage('Day 4', day4),

    // ---------------- DAY 5 ----------------
    dayCover(5, 'Lourmarin and Bonnieux', [seed('d5-lane'), seed('d5-arch'), seed('d5-street')]),
    split('Day 5 – page 1', seed('d5-cafe'), [
      ...dayHead(
        'DAY 5',
        'FRIDAY',
        'Today, you’ll be getting a quintessential Luberon experience with the Provençal market in the delightful village of Lourmarin, plus a visit to Bonnieux (we’ve thrown in a few cultural stops, as well). Your treasure hunting will be rewarded with a gorgeous lunch at a Michelin starred restaurant. Then, if you’re up for it, you’ll head on down to Saint-Rémy-de-Provence.',
      ),
      time(
        '9AM',
        `Have a last breakfast at your hotel before checking out. Drive to ${L('Lourmarin', 'Lourmarin')}, another “Most Beautiful Village in France.”`,
      ),
      tip('TIP: There are two parking areas, to the north and in the town center; we suggest entering via Place Henri Barthélémy, which is also where the tourist office is located.'),
      text(
        'Thanks to its inspiring natural beauty and engaging culture, Lourmarin has long had a reputation for attracting creatives, from Pablo Picasso to Albert Camus (the latter of whom is buried in the town cemetery). Snuggled in a valley surrounded by rolling hills, the village’s narrow streets – lined with hundred-year-old stone homes adorned with colorful shutters and balconies tumbling with flowers – are a wonderful representation of the beauty of authentic Provence.',
      ),
      time(
        '11AM',
        `Head for Lourmarin market first, which takes place on Fridays in the town center. This popular and lively marché is a fun experience for food enthusiasts, art lovers, knick knack hunters, and those simply seeking an authentic taste of Provence. Be sure to explore the cobblestoned pedestrian streets; there are many smaller, specialty shops knitted into the fabric of the village, nestled among pâtisseries, fromageries and more. If you love French antiques, don’t miss ${L('La Boutique de l’Antiquaire', "La Boutique de l'Antiquaire, Lourmarin")}.`,
      ),
      text(
        `If you have the time, you can visit the ${L('Château de Lourmarin', 'Château de Lourmarin')}, a magnificent Renaissance castle overlooking the village.`,
      ),
    ]),
    split('Day 5 – page 2', seed('d5-church'), [
      time(
        '12PM',
        `When you have done with shopping in Lourmarin, drive around 20 minutes to Bonnieux, where we suggest you enjoy lunch at ${L('Capelongue', 'Capelongue, Bonnieux')}. Aim to reserve at the Michelin starred 'restaurant gastronomique', and request a table on the terrace with the view over the gardens. Your meal will be a gourmet experience from start to finish. Savor exceptional cuisine while taking in incredibly picturesque panoramas.`,
      ),
      text(
        "After lunch, if you want to stretch your legs, you'll enjoy walking through the old village of Bonnieux, the last (but certainly not least) stop on our hilltop tour. Perfectly perched, it offers some of the most outstanding views of the valley, countryside and neighboring hilltop towns.",
      ),
      text(
        `For history and culture buffs, Bonnieux has a few museums worth visiting: the ${L('Musée de la Boulangerie', 'Musée de la Boulangerie, Bonnieux')} provides insight into the history and techniques of bread-making in the region, and the Musée de la Vieille Église showcases religious art and artifacts from the area. It also has an historic impressive Old Town at the top of the hill. As you wind up through the stone streets, enjoy the little boutiques, and be sure to stop at antique dealer ${L("Au Détour D'une Promenade", "Au Détour d'une Promenade, Bonnieux")}.`,
      ),
      time(
        '3PM',
        `Drive about an hour to ${L('Saint-Rémy-de-Provence', 'Saint-Rémy-de-Provence')}. If you’re up for it, you could explore the pretty town, including visiting the ${L('Saint-Paul de Mausole Monastery', 'Saint-Paul de Mausole, Saint-Rémy-de-Provence')}, where Van Gogh spent his asylum days (you can see his room and beautiful gardens). There’s also the “Van Gogh Walking Trail,” which will take you to different spots around town that inspired his most famous paintings. Don't miss the picturesque Place Favier and Place de la République.`,
      ),
      tip('TIP: Grab a map from the tourist office.'),
    ]),
    split(
      'Day 5 – page 3',
      seed('d5-courtyard'),
      [
        time(
          '7PM',
          `Saint-Rémy is known for its cuisine, so you’ll be in good hands for dinner – we’re happy to suggest the Michelin-starred ${L('Restaurant de Tourrel', 'Restaurant de Tourrel, Saint-Rémy-de-Provence')}, which offers creative dishes in its chic, retro-style Art Deco dining room or the option of the Chef’s table adjacent to the kitchens for a truly culinary experience.`,
        ),
        text(
          `If you prefer something more relaxed, try the ${L('Chapeau de Paille', 'Chapeau de Paille, Saint-Rémy-de-Provence')}, a colorful bistrot Provençal with a charming “flea market ambience.”`,
        ),
        text(
          `Alternatively, if you can’t get enough of Lourmarin, stay there and get dinner at ${L('Le Moulin at Lourmarin', '', 'https://www.beaumier.com/fr/proprietes/hotel-le-moulin/')}. You can choose between dining inside or in their patio garden; be sure to check the website for other special weekly events, like aperitifs and jazz night.`,
        ),
        text('Wherever you choose, enjoy your evening soaking up the beautiful surroundings!'),
        spacer(8),
        addresses([day5.id], day5.id),
      ],
      { band: { color: BLUSH, fromPct: 58 } },
    ),
    mapPage('Day 5', day5),

    // ---------------- DAY 6 ----------------
    dayCover(6, 'Villeneuve Les Avignon + Avignon', [seed('d6-garden'), seed('d6-palais'), seed('d6-square')]),
    split('Day 6 – page 1', seed('d6-market'), [
      ...dayHead(
        'DAY 6',
        'SATURDAY',
        'Today, we’re taking you to the towns of Avignon and Villeneuve-Les-Avignon. Antique buffs will enjoy the brocante fair at Villeneuve, and can certainly spend the whole morning there. If antiques aren’t your thing, then we suggest concentrating on the city of Avignon.',
      ),
      time(
        'MORNING',
        `<b>OPTION 1: AVIGNON</b><br>Rise early and drive an hour to ${L('Avignon', 'Avignon')} to enjoy the weekly food market.`,
      ),
      text(
        `Around the famous ${L('Les Halles', 'Les Halles, Avignon')} – the market is a bustling event where locals and visitors alike immerse themselves in the sights, sounds and flavors of Provence. You’re guaranteed a colorful array of seasonal fruits and vegetables, all from local farms. Cheese lovers will delight at the abundance of regional specialities available, along with cured meats, jams, honeys, spices, olives, baked goods and beyond. There’s also street food stalls and artisans selling linens, pottery and other goods unique to the region, like lavender soaps and sachets.`,
      ),
      text("Don't hesitate to break away from the main market and explore the narrow side streets, which house hidden gems!"),
      tip('TIP: Try socca, a thin chickpea pancake, and bring cash!'),
      text(
        `After the market, continue to explore the city center, which is enclosed by ancient walls and consists of narrow streets filled with charming cafés, shops and boutiques, where you can discover local Provençal crafts and souvenirs. You could visit the ${L('Palais des Papes', 'Palais des Papes, Avignon')}, a Gothic masterpiece and UNESCO World Heritage site where the Pope lived in the 14th century. Explore the palace's grand halls and beautiful chapels and courtyards, learning about its rich history. Another famous landmark is the ${L("Pont d'Avignon", "Pont d'Avignon")}, a medieval bridge that spans the Rhône River.`,
      ),
      text(
        `The ${L('Musée du Petit Palais', 'Musée du Petit Palais, Avignon')} displays a remarkable collection of medieval and Renaissance art, and the ${L('Musée Calvet', 'Musée Calvet, Avignon')} has impressive exhibitions in fine art and archaeology. The ${L('Cathédrale Notre-Dame des Doms', 'Cathédrale Notre-Dame des Doms, Avignon')} also holds significant architectural treasures.`,
      ),
    ]),
    split('Day 6 – page 2', seed('d6-plates'), [
      time(
        'MORNING',
        `<b>OPTION 2: VILLENEUVE-LES-AVIGNON</b><br>This is your first big antiquing opportunity, with the weekly brocante fair at ${L('Villeneuve-Les-Avignon', 'Place Charles David, Villeneuve-lès-Avignon')}.`,
      ),
      text(
        'The market is made up of about 100 vendors, who take over Place Charles David every Saturday morning. This is the cream of the local antique dealers, who pack into their vans the best wares for the week. Some specialise in textiles, others in paintings, others in provencal ceramics. Get to the fair early and wander around at your own pace but bear in mind that they will pack up around 1pm.',
      ),
      time(
        '1PM',
        `When you’ve worked up an appetite, walk 5 minutes to ${L('L’Annexe', "L'Annexe, Villeneuve-lès-Avignon")}, a simple but popular restaurant known for its inviting atmosphere and delicious food. Friendly service and a terrace in the shade for your lazy lunch.`,
      ),
      text(
        `After, you could visit one of the town’s esteemed historical sites, such as the ${L('Fort Saint-André', 'Fort Saint-André, Villeneuve-lès-Avignon')}, a medieval abbey with a garden that is worth the visit. If you are there in April, you’ll find Banksy roses tumbling down tall cedars, and rows of tall irises. Enjoy the view across the river onto the city of Avignon.`,
      ),
      time(
        '3PM',
        `After lunch, you can explore more of Avignon or drive to ${L('Atelier Vime', 'Atelier Vime, Vallabrègues')}, a workshop and showroom in the nearby town of Vallabrègues. Vime is passionate about creating and restoring traditional rattan and wicker decor using century old techniques and designs. You may be invited to visit the interior of their home as well as the boutique/showroom.`,
      ),
      tip('TIP: You’ll need to make an appointment ahead of time.'),
      text(
        `You could also plan to carve out a few hours for a cooking class at the renowned cooking school, ${L('La Mirande', 'La Mirande, Avignon')}.`,
      ),
    ]),
    split(
      'Day 6 – page 3',
      seed('d6-avignon'),
      [
        time(
          '4PM',
          `You’ll end your afternoon with a dose of culture at ${L('Carrières de Lumières', '', 'https://www.carrieres-lumieres.com/')} (“Quarries of Light”) in Les Baux-de-Provence. A dynamic art installation set up inside a former limestone quarry, large-scale projections of famous artworks are displayed on the walls, floors and ceilings with accompanying music, carefully choreographed to bring the visuals and artwork to life, while creating an entirely immersive experience. There’s also a smaller space where visitors can learn more about the history of the quarry.`,
        ),
        text(
          'Every year focuses on a new theme or artist (past exhibits have featured Van Gogh, Monet and Picasso) – be sure to check the website for the time of your visit.',
        ),
        tip('TIP: And book tickets in advance - this exhibit is extremely popular, and for good reason!'),
        time(
          '5PM',
          'Drive back to your hotel and refresh before a pre-dinner aperitif on the terrace. Settle in to relax and dine at the hotel tonight, or if you haven’t yet, go into Saint-Rémy, to one of our previously mentioned suggestions.',
        ),
        addresses([day6a.id, day6b.id], day6b.id),
      ],
      { band: { color: BLUSH, fromPct: 56 } },
    ),
    mapPage('Day 6 - Option 1', day6a),
    mapPage('Day 6 - Option 2', day6b),

    // ---------------- DAY 7 ----------------
    dayCover(7, "L'Isle-sur-la-Sorgue or Carpentras", [seed('d7-sorgue'), seed('d7-brocante'), seed('d7-shop')]),
    split('Day 7 – page 1', seed('d7-house'), [
      ...dayHead(
        'DAY 7',
        'SUNDAY',
        'Bon Dimanche ! For your last day we give you two options. L’Isle-sur-la-Sorgue, an antiques mecca known as the “Venice of Provence” (you’ll see for yourself why!) – a uniquely laid-out town that has a vintage treasure for everyone. Lunch will be in the charming village of Eygalières. If a whole town of antiques feels overwhelming, we give you a second smaller option at the Carpentras brocante and a visit to an amazing château and gardens.',
      ),
      time(
        '8AM',
        `<b>OPTION 1: L’ISLE-SUR-LA-SORGUE AND EYGALIÈRES</b><br>Rise early, and enjoy breakfast at the hotel (or save yourself for a café and croissant in town).`,
      ),
      text(
        `Drive 45 minutes to ${L("L'Isle-sur-la-Sorgue", "L'Isle-sur-la-Sorgue")}. Crisscrossed by bridges and woven through with canals studded with majestic water wheels (ancient relics of the town’s 18th century success in crafting silk, wool and paper) this “inland island” is a haven for art and antiques and is beloved for its wealth of vintage shops and weekend markets, attracting hundreds of thousands of hopeful hunters each year.`,
      ),
      text('Head to the town center and be met with a food market, flea market and antiques market, all rolled in one.'),
      tip('TIP: For the best picks, we suggest getting there as early as 8am; you can stroll along the river, see the town church, or stop for some coffee, while you wait.'),
      text(
        `Among our favorite parts of town to shop in are:<br>• ${L('Village des Antiquaires de la Gare', "Village des Antiquaires de la Gare, L'Isle-sur-la-Sorgue")} – don’t miss the silver selection at Kate Dickinson’s store<br>• ${L('Hôtel Dongier', "Hôtel Dongier, L'Isle-sur-la-Sorgue")} where you’ll find some great stores including several specializing in paintings<br>• ${L('L’Île aux Brocantes', "L'Île aux Brocantes, L'Isle-sur-la-Sorgue")} – warning, you’ll want everything here!`,
      ),
    ]),
    split('Day 7 – page 2', seed('d7-chateau'), [
      time(
        '1PM',
        `For lunch, drive to ${L('Eygalières', 'Eygalières')}, a charming village in the Alpilles. Feel free to stroll leisurely about and grab a table at one of the local restaurants or cafés, we love ${L('Chez Paulette', 'Chez Paulette, Eygalières')}!`,
      ),
      text(
        `We also recommend ${L('Maison Hache', 'Maison Hache, Eygalières')}, which is headed by the former chef of the Hôtel de Crillon in Paris and boasts a Michelin star. Super food in a village setting.`,
      ),
      time('3PM', 'After lunch, take some time to explore Eygalières.'),
      text('If you’d like, you could plan for a walk or hike, as there are several trails with beautiful countryside and vineyard views.'),
      tip('TIP: The Sentier des Peintres (“Painters\' Trail”) is a popular option, highlighting landscapes that inspired famous artists. There’s also the option to rent bicycles.'),
      text('Please note that if you are in Eygalières for the last Sunday of the month there is a charming brocante fair running through the village.'),
    ]),
    page('Day 7 – page 3', [
      heading('display', 'DAY 7', { size: 40 }),
      time(
        '8AM',
        `<b>OPTION 2: CARPENTRAS & CHÂTEAU DE BRANTES</b><br>Rise early, and enjoy breakfast at the hotel. Cafés are limited in Carpentras on a Sunday morning, so it’s best to leave the hotel fully fueled!`,
      ),
      text(
        `Take the one hour drive to ${L('Carpentras', 'Carpentras')}, whose ${L('Parking des Platanes', 'Parking des Platanes, Carpentras')} center plays host to a lively brocante (flea market) every weekend, attracting locals, tourists and vintage hunters from around the world interested in digging out diamonds in the rough.`,
      ),
      text(
        'It’s worthwhile getting here for the start of selling at 8am. Try to park close to the fair, so you don’t have to carry your purchases too far back to the car. Expect a bustling atmosphere and wide range of vendors selling everything from antique furniture to jewelry, to old books, decor and artwork.',
      ),
      time(
        '12PM',
        `For lunch you will take a twenty minute drive to Althen-des-Paluds where we recommend ${L('Le Moulin Rive Gauche', 'Moulin Rive Gauche, Althen-des-Paluds')}. This family run restaurant attracts a local clientele which is always a good sign.`,
      ),
      text(
        `For the late afternoon, drive on to the ${L('Château and Jardin de Brantes', 'Château de Brantes, Sorgues')}, a 17th-century castle and gardens just outside the village.`,
      ),
      text(
        'Take the guided tour to learn in-depth about the intriguing families who once lived there or explore the grand estate, with its elegant period furnishings and artifacts, on your own. Afterwards, head out to admire the grounds, a classified “Remarkable Gardens of France” with its lovingly manicured lawns and terraced gardens filled with different paths and trees, flowers and herbs. Be sure to visit the orangery, filled with fragrant citrus trees.',
      ),
    ]),
    split(
      'Day 7 – page 4',
      seed('d7-villa'),
      [
        time('5PM', 'Return to the hotel for some downtime, and relax by the pool or ask for refreshments to be served in the garden.'),
        time(
          '7PM',
          'For your last night, we suggest indulging in your slowest, South of France meal yet at Domaine de Fontenille – reminiscing on all of the wonderful memories made the past week!',
        ),
        spacer(36),
        addresses([day7a.id, day7b.id], day7a.id),
      ],
      { band: { color: BLUSH, fromPct: 52 } },
    ),
    mapPage('Day 7 - Option 1', day7a),
    mapPage('Day 7 - Option 2', day7b),

    // closing
    page(
      'Merci',
      [
        heading('display', 'MERCI !', { size: 64, align: 'center', color: '#c9a39a' }),
        text(
          'Thank you for trusting us with your vacation plans.<br>We hope you enjoyed following this MFCH Itinerary;<br>we welcome any feedback and would love to hear how your trip went!',
          { align: 'center', size: 14 },
        ),
        text('Share your experience and tag <b>@mfchtravel</b> to be featured!', { align: 'center', size: 14 }),
        spacer(10),
        text(
          `E M A I L : <a href="mailto:travel@myfrenchcountryhome.com">travel@myfrenchcountryhome.com</a><br><a href="https://www.mfchtravel.com">www.mfchtravel.com</a><br><a href="https://www.myfrenchcountryhomemagazine.com">www.myfrenchcountryhomemagazine.com</a><br><a href="https://www.myfrenchcountryhomebox.com">www.myfrenchcountryhomebox.com</a><br><a href="https://www.sharonsantoni.com">www.sharonsantoni.com</a>`,
          { align: 'center', size: 13 },
        ),
      ],
      { valign: 'center', background: '#e9d3cc' },
    ),
    page('Terms of service', [
      heading('title', 'MFCH ITINERARIES<br>TERMS OF SERVICE', { align: 'center', size: 22 }),
      text(
        '<b>Intellectual Property Rights</b><br>We are the owner or licensee of all intellectual property rights in our Services including all website designs, audio, video, text, photographs and graphics in the Services (collectively the "Contents”) as well as the trademarks, service marks and logos contained therein (the “Marks”).<br>Our Content and Marks are protected by copyrights and trademark laws applicable in the United States and around the world.',
        { size: 9.5 },
      ),
      text(
        '<b>Use of our Services</b><br>Subject to your compliance with these legal terms included in the prohibited activity section below we grant you a non-exclusive non-transferable revocable license to: access to the Services, and download or print a copy of any portion of the content to which you have properly gained access, solely for your personal non-commercial use or internal business purpose.',
        { size: 9.5 },
      ),
      text(
        '<b>Prohibited Activity</b><br>You may not access or use the Services for any purpose other than that for which we make the Services available. You may not make any unauthorized use of the Services including as part of any effort to compete with us or otherwise use the Content or Marks for any revenue-generating endeavor or commercial enterprise.<br>No part of the Services and no Content or Marks may be copied, reproduced, aggregated, republished, uploaded, posted, publicly displayed, encoded, translated, transmitted, distributed, sold, licensed, or otherwise exploited for any commercial purpose whatsoever without our express prior written permission.<br>If we ever grant you the permission to post, reproduce, or publicly display any part of our services or Content you must identify us as the owners or licensees of the Services, Content, or Marks and ensure that any copyright or proprietary notice appears or is visible on posting, reproducing or displaying our Content.<br>Any breach of these intellectual property rights will constitute a material breach of our legal terms and your right to use our services will terminate immediately.',
        { size: 9.5 },
      ),
      text(
        '<b>Modifications and Interruptions</b><br>We reserve the right to change, modify or remove the Contents of the Services at any time or for any reason at our sole discretion without notice. However, we have no obligation to update any information on our services. We will not be liable to you or any third party for any modification, price change, suspension, or discontinuation of the services.<br>We cannot guarantee the services will be available at all times. We may experience hardware, software or other problems or need to perform maintenance related to the services resulting in interruptions, delays or errors. We reserve the right to change, revise, update, suspend, discontinue, or otherwise modify the Services at any time or for any reason without notice to you. You agree that we have no liability whatsoever for any loss, damage or inconvenience caused by your inability to access or use the Service during any downtime or discontinuation of the services.',
        { size: 9.5 },
      ),
    ]),
  ];

  return {
    id: uid(),
    title: 'The Luberon – 7-Day Itinerary',
    theme: { ...DEFAULT_THEME },
    pages,
    routes,
    updatedAt: Date.now(),
  };
}

/** An empty starting point for a brand-new itinerary */
export function buildBlank(title = 'New itinerary'): Itinerary {
  const r = route('Day 1', 'driving', []);
  return {
    id: uid(),
    title,
    theme: { ...DEFAULT_THEME },
    routes: [r],
    pages: [
      page(
        'Cover',
        [
          heading('display', 'T R A V E L', { size: 64, color: '#fbeee9' }),
          images([], 'collage', 175),
          heading('title', 'A WEEK IN<br>SOMEWHERE', { color: '#5a5654', weight: 600, letterSpacing: 0.12, size: 30 }),
          heading('eyebrow', '7-DAY ITINERARY', { color: '#fbeee9', size: 14 }),
        ],
        { background: '#d6b5ad' },
      ),
      dayCover(1, 'Subtitle for the day', []),
      split('Day 1 – page 1', { src: '' }, [
        ...dayHead('DAY 1:', 'MONDAY', 'Introduction to the day…'),
        time('9AM', 'What to do first…'),
        tip('TIP: A useful tip.'),
      ]),
      mapPage('Day 1', r),
    ],
    updatedAt: Date.now(),
  };
}
