/** Individually inspected Spanish passages; no vocabulary/style rewrites. */
const editsByPassage = {
  '3001': [['climatico', 'climático'], ['mas', 'más'], ['estan', 'están', 2], ['cientificos', 'científicos'], ['paises', 'países'], ['energias', 'energías'], ['eolica', 'eólica'], ['publico', 'público'], ['energia', 'energía']],
  '3002': [['Maria', 'María', 2], ['manana', 'mañana'], ['curriculum', 'currículum'], ['Cuales son sus fortalezas?', '¿Cuáles son sus fortalezas?'], ['Por que quiere trabajar aqui?', '¿Por qué quiere trabajar aquí?']],
  '3003': [['Guell', 'Güell'], ['increible', 'increíble'], ['Tambien', 'También'], ['catalan', 'catalán'], ['duro', 'duró'], ['proximo', 'próximo'], ['ano', 'año']],
  '3004': [['dia', 'día'], ['tecnologia', 'tecnología', 2], ['educacion', 'educación'], ['mas', 'más'], ['metodos', 'métodos'], ['ensenanza', 'enseñanza']],
  '3005': [['contaminacion', 'contaminación', 2], ['ninos', 'niños'], ['Tambien', 'También'], ['mas', 'más'], ['arboles', 'árboles'], ['plastico', 'plástico']],
  '3006': [['tambien', 'también'], ['desinformacion', 'desinformación'], ['adiccion', 'adicción'], ['informacion', 'información']],
  '3007': [['pais', 'país'], ['tipicos', 'típicos'], ['Espana', 'España'], ['Japon', 'Japón'], ['paises', 'países'], ['dia', 'día'], ['facil', 'fácil']],
  '3008': [['fisica', 'física', 2], ['dia', 'día'], ['tambien', 'también'], ['estres', 'estrés'], ['sueno', 'sueño'], ['energia', 'energía']],
  '4001': [['artificial esta', 'artificial está'], ['rapidamente', 'rápidamente'], ['estan', 'están', 2], ['preocupacion', 'preocupación'], ['tecnologico', 'tecnológico'], ['tambien', 'también'], ['programacion', 'programación'], ['analisis', 'análisis'], ['gestion', 'gestión'], ['educacion', 'educación'], ['sera', 'será'], ['maquinas', 'máquinas'], ['tecnologia', 'tecnología'], ['hibrida', 'híbrida'], ['tendran', 'tendrán']],
  '4002': [['Mexico', 'México'], ['musica', 'música'], ['tambien', 'también'], ['vehiculos', 'vehículos'], ['cuestion', 'cuestión']],
  '4003': [['globalizacion', 'globalización', 2], ['instantaneamente', 'instantáneamente'], ['interconexion', 'interconexión'], ['preservacion', 'preservación'], ['unica', 'única']],
  '4004': [['eticas', 'éticas'], ['Quien es', '¿Quién es'], ['autonomo', 'autónomo'], ['Como garantizamos', '¿Cómo garantizamos'], ['perpetuen', 'perpetúen'], ['genero', 'género'], ['tecnologia', 'tecnología'], ['mas', 'más'], ['alla', 'allá'], ['eticos', 'éticos'], ['solidos', 'sólidos'], ['innovacion', 'innovación'], ['proteccion', 'protección']],
  '4005': [['empatia', 'empatía'], ['ambito', 'ámbito']],
  '4006': [['bilingues', 'bilingües'], ['concentracion', 'concentración'], ['mas', 'más'], ['resolucion', 'resolución'], ['Ademas', 'Además'], ['bilingualismo', 'bilingüismo'], ['aparicion', 'aparición'], ['bilingue', 'bilingüe'], ['esta', 'está'], ['ejercitandose', 'ejercitándose'], ['linguisticos', 'lingüísticos']],
};
const titles = {
  '3001': 'El cambio climático', '3004': 'La tecnología en la educación',
  '4003': 'La globalización y la identidad cultural', '4004': 'Ética de la inteligencia artificial',
};

export function spanishReadingOrthography({ row, update }) {
  for (const [part, edits] of Object.entries(editsByPassage)) {
    const id = `aabbccdd-1111-${part}-a001-000000000000`;
    let content = row('reading_passages', id).content;
    for (const [before, after, count = 1] of edits) {
      // Unicode word boundaries prevent ano from changing verano, and mas from
      // changing problemas. Each occurrence count was read in this passage.
      const escaped = before.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'gu');
      const matches = [...content.matchAll(pattern)];
      if (matches.length !== count) throw new Error(`${id}: expected ${count} occurrences of ${before}, found ${matches.length}`);
      content = content.replace(pattern, () => after);
    }
    update('reading_passages', id, { content, ...(titles[part] ? { title: titles[part] } : {}) },
      'Spanish reading: restore required written accents, ñ, ü and opening question marks in the individually reviewed passage. Correct bilingualismo to bilingüismo. Preserve valid homogeniza and the dictionary sense of protestante meaning que protesta; scientific claims require separate review.',
      part === '4003' ? ['https://dle.rae.es/homogenizar'] : part === '4002' ? ['https://dle.rae.es/protestante'] : []);
  }
}
