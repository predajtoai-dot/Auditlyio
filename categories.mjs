// Bazoš.sk kategórie (category IDs)
// Source: https://www.bazos.sk

export const BAZOS_CATEGORIES = {
  // Elektronika
  PC: { id: 13, name: "PC", fullName: "Počítače" },
  MOBILY: { id: 14, name: "Mobily", fullName: "Mobilné telefóny" },
  FOTO: { id: 15, name: "Foto", fullName: "Foto" },
  ELEKTRO: { id: 16, name: "Elektro", fullName: "Elektro" },
  
  // Šport & hobby
  SPORT: { id: 17, name: "Šport", fullName: "Šport" },
  HUDBA: { id: 18, name: "Hudba", fullName: "Hudba" },
  
  // Dom & záhrada
  NABYTOK: { id: 19, name: "Nábytok", fullName: "Nábytok" },
  DOM: { id: 20, name: "Dom", fullName: "Dom a záhrada" },
  STROJE: { id: 21, name: "Stroje", fullName: "Stroje" },
  
  // Ostatné
  OBLECENIE: { id: 22, name: "Oblečenie", fullName: "Oblečenie" },
  KNIHY: { id: 23, name: "Knihy", fullName: "Knihy" },
  DETSKE: { id: 24, name: "Detské", fullName: "Detské" },
  ZVIERATA: { id: 25, name: "Zvieratá", fullName: "Zvieratá" },
  
  // Doprava (filtrujeme!)
  AUTO: { id: 26, name: "Auto", fullName: "Auto-moto" },
  
  // Nehnuteľnosti (filtrujeme!)
  NEHNUTELNOSTI: { id: 27, name: "Nehnuteľnosti", fullName: "Nehnuteľnosti" },
  
  // Služby (filtrujeme!)
  SLUZBY: { id: 28, name: "Služby", fullName: "Služby" },
  PRACA: { id: 29, name: "Práca", fullName: "Práca" },
};

// AI mapping - keywords to category
export const AI_CATEGORY_KEYWORDS = {
  // PC & komponenty
  PC: ["počítač", "notebook", "laptop", "macbook", "pc", "desktop", "imac", "monitor", "klávesnica", "myš", "grafická karta", "procesor", "ram", "ssd"],
  
  // Mobily & tablety
  MOBILY: ["mobil", "telefón", "smartphone", "iphone", "samsung", "xiaomi", "tablet", "ipad", "telefon"],
  
  // Foto & video
  FOTO: ["fotoaparát", "kamera", "objektív", "canon", "nikon", "sony alpha", "gopro", "dron"],
  
  // Elektro
  ELEKTRO: ["televízor", "tv", "reproduktor", "slúchadlá", "konzola", "playstation", "xbox", "nintendo", "kávovar", "mixér", "vysávač"],
  
  // Šport
  SPORT: ["bicykel", "bike", "trek", "kolobežka", "lyže", "snowboard", "fitness", "činky", "bežecký pás", "hodinky garmin", "hodinky polar", "golf", "golfové palice", "futbal", "lopta", "tenis"],
  
  // Hudba
  HUDBA: ["gitara", "klavír", "bicie", "saxofón", "husle", "mikrofón", "audio interface"],
  
  // Nábytok
  NABYTOK: ["gauč", "pohovka", "stôl", "stolička", "skriňa", "posteľ", "regál", "komoda"],
  
  // Dom & záhrada
  DOM: ["kosačka", "záhradný", "kvetináč", "plot", "brána", "zavlažovanie", "nábytok záhradný", "dymový", "vodopad", "kadidlo", "vonná dekorácia", "aromalampa", "keramická dekorácia", "fontána"],
  
  // Stroje & náradie
  STROJE: ["vŕtačka", "píla", "brúska", "kompresor", "traktor", "motorová píla"],
  
  // Oblečenie
  OBLECENIE: ["bundu", "kabát", "tričko", "rifle", "topánky", "obuv", "šaty"],
  
  // Knihy
  KNIHY: ["kniha", "román", "učebnica", "komiks"],
  
  // Detské
  DETSKE: ["kočík", "autosedačka", "hračka", "detská postieľka"],
};

// Get category from AI analysis
export function getCategoryFromKeywords(productName, description = "") {
  const text = `${productName} ${description}`.toLowerCase();
  
  // Check each category
  for (const [categoryKey, keywords] of Object.entries(AI_CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        return BAZOS_CATEGORIES[categoryKey];
      }
    }
  }
  
  // Default: Elektro (safest bet)
  return BAZOS_CATEGORIES.ELEKTRO;
}

// Get all selectable categories (excluding AUTO, NEHNUTELNOSTI, SLUZBY, PRACA)
export function getSelectableCategories() {
  return Object.entries(BAZOS_CATEGORIES)
    .filter(([key]) => !["AUTO", "NEHNUTELNOSTI", "SLUZBY", "PRACA", "ZVIERATA"].includes(key))
    .map(([key, cat]) => cat);
}

// Build Bazoš search URL with category
export function buildBazosSearchUrl(query, categoryId) {
  const q = encodeURIComponent(query);
  if (categoryId) {
    return `https://www.bazos.sk/search.php?hledat=${q}&rubriky=${categoryId}&hlokalita=&humkreis=25&cenaod=&cenado=&Submit=Hľadať`;
  }
  return `https://www.bazos.sk/search.php?hledat=${q}&rubriky=www&hlokalita=&humkreis=25&cenaod=&cenado=&Submit=Hľadať`;
}


