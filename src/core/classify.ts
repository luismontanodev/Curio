// Clasificador de tema por palabras clave, para fuentes que no clasifican (The Conversation,
// artículos destacados de Wikipedia). Reglas visibles y probadas, igual que el scorer.

import { normalize } from './scorer.ts';
import type { Topic } from './types.ts';

/** Frases ya normalizadas (minúsculas, sin acentos). Se comparan con límites de palabra. */
const KEYWORDS: Partial<Record<Topic, string[]>> = {
  tecnologia: [
    // es / pt
    'tecnologia', 'tecnologias', 'tecnologico', 'tecnologica', 'inteligencia artificial', 'ia', 'algoritmo',
    'algoritmos', 'software', 'ordenador', 'ordenadores', 'computadora', 'computador', 'computacion',
    'informatica', 'internet', 'ciberseguridad', 'ciberataque', 'hacker', 'robot', 'robots', 'robotica',
    'chip', 'chips', 'semiconductor', 'semiconductores', 'digital', 'digitales', 'redes sociales', 'app',
    'aplicacion', 'aplicaciones', 'smartphone', 'movil', 'videojuego', 'videojuegos', 'programacion',
    'chatgpt', 'openai', 'aprendizaje automatico', 'computacion cuantica', 'blockchain', 'criptomoneda',
    'datos personales', 'privacidad', 'ingenieria', 'microchip', 'bateria', 'baterias', 'energia solar',
    // en
    'technology', 'technologies', 'artificial intelligence', 'ai', 'algorithm', 'algorithms', 'computer',
    'computers', 'computing', 'cyber', 'cybersecurity', 'machine learning', 'chatbot', 'semiconductors',
    'engineering', 'quantum computer', 'social media', 'smartphones', 'video game', 'video games',
    // fr
    'technologie', 'intelligence artificielle', 'numerique', 'logiciel', 'ordinateur', 'informatique',
  ],
  espacio: [
    'espacio', 'espacial', 'astronomia', 'astronomo', 'astronomos', 'astrofisica', 'planeta', 'planetas',
    'planeta enano', 'galaxia', 'galaxias', 'nasa', 'telescopio', 'estrella', 'estrellas', 'universo',
    'cosmos', 'cosmico', 'marte', 'jupiter', 'saturno', 'luna', 'asteroide', 'cometa', 'satelite', 'orbita',
    'agujero negro', 'nebulosa', 'astronauta', 'sistema solar', 'exoplaneta',
    'space', 'astronomy', 'astronomer', 'planet', 'planets', 'galaxy', 'telescope', 'star', 'stars',
    'universe', 'mars', 'moon', 'asteroid', 'comet', 'black hole', 'nebula', 'astronaut', 'solar system',
    'espace', 'astronomie', 'planete', 'galaxie', 'etoile', 'univers',
  ],
  naturaleza: [
    'naturaleza', 'animal', 'animales', 'especie', 'especies', 'planta', 'plantas', 'bosque', 'bosques',
    'oceano', 'oceanos', 'ecosistema', 'ecosistemas', 'biodiversidad', 'aves', 'insecto', 'insectos',
    'medio ambiente', 'fauna', 'flora', 'selva', 'arrecife', 'mamifero', 'mamiferos', 'reptil', 'algas',
    'nature', 'species', 'wildlife', 'forest', 'ocean', 'ecosystem', 'biodiversity', 'birds', 'insects',
    'environnement', 'especes', 'foret',
  ],
  musica: [
    'musica', 'musical', 'cancion', 'canciones', 'album', 'sinfonia', 'opera', 'compositor', 'banda',
    'cantante', 'concierto', 'music', 'song', 'symphony', 'composer', 'singer', 'musique', 'chanson',
  ],
};

const regexCache = new Map<string, RegExp>();
function phraseRegex(phrase: string): RegExp {
  let re = regexCache.get(phrase);
  if (!re) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    re = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, 'u');
    regexCache.set(phrase, re);
  }
  return re;
}

/** Puntos por tema: cada palabra clave cuenta una vez; en el título vale doble. */
export function topicScores(title: string, text = ''): Partial<Record<Topic, number>> {
  const t = normalize(title);
  const body = normalize(text);
  const scores: Partial<Record<Topic, number>> = {};
  for (const [topic, words] of Object.entries(KEYWORDS) as [Topic, string[]][]) {
    let s = 0;
    for (const w of words) {
      if (phraseRegex(w).test(t)) s += 2;
      else if (phraseRegex(w).test(body)) s += 1;
    }
    if (s > 0) scores[topic] = s;
  }
  return scores;
}

/**
 * Elige el tema con más puntos si llega al mínimo (2: una mención en el título o dos en el texto);
 * si no, el de la fuente. Empate: gana el que va primero en KEYWORDS.
 */
export function classifyTopic(title: string, text: string, fallback: Topic, min = 2): Topic {
  let best: Topic = fallback;
  let bestScore = min - 1;
  for (const [topic, s] of Object.entries(topicScores(title, text)) as [Topic, number][]) {
    if (s > bestScore) {
      best = topic;
      bestScore = s;
    }
  }
  return best;
}
