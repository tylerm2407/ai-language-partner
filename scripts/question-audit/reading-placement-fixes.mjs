/** Authored topic-to-existing-unit corrections, preserving every passage and
 * question. All 46 full passages were reread before these mappings were made.
 * New wording/placements remain pending independent remediation review. */
export function readingPlacementFixes({ snapshot, row, update }) {
  const languages = [
    ['1111', 'es'], ['2222', 'fr'], ['3333', 'de'], ['4444', 'it'], ['5555', 'pt'],
    ['6666', 'ja'], ['7777', 'ko'], ['8888', 'zh'], ['9999', 'ru'],
  ];
  const mappings = [
    ['B1', '3004', 'Environment & Nature', '3005', 'Technology & Media', 'The full passage concerns classroom devices, digital learning platforms and their educational benefits/limits, not the natural environment.'],
    ['B1', '3005', 'Technology & Media', '3004', 'Environment & Nature', 'The full passage concerns pollution, climate or environmental protection; technology is only an example of a response, not the teaching topic.'],
    ['B1', '3006', 'Storytelling', '3005', 'Technology & Media', 'The full passage describes social-media use, communication and risks, not narrative sequencing or storytelling.'],
    ['B1', '3007', 'Hypothetical Situations', '3003', 'Travel & Adventure', 'The full passage describes international cuisines, restaurants and cultural experiences. It contains no hypothetical-situation task. Culinary/cultural experiences fit the existing travel unit without lowering the reading level.'],
    ['B2', '4004', 'Literature & Arts', '4001', 'Abstract Ideas', 'The full passage examines AI ethics, responsibility, fairness and privacy, not literature or art. These are the existing Abstract Ideas unit’s philosophy, concepts and beliefs, including its ethics/morality lesson.'],
    ['B2', '4003', 'Professional Communication', '4002', 'Debate & Argumentation', 'This Spanish passage explicitly contrasts arguments for cultural homogenization with arguments for enriching exchange, then advances a balanced position. It does not present a professional communication task. Both reviews confirmed this specific placement defect; the other languages’ distinct globalization passages remain disputed and are not moved.', 'es'],
  ];
  for (const [prefix, language] of languages) for (const [level, from, oldTitle, to, newTitle, reason, onlyLanguage] of mappings) {
    if (onlyLanguage && onlyLanguage !== language) continue;
    const passageId = `aabbccdd-${prefix}-${from}-a001-000000000000`;
    const courseSuffix = `${level.toLowerCase()}0000000000`;
    const sourceUnitId = `aabbccdd-${prefix}-${from}-0000-${courseSuffix}`;
    const targetUnitId = `aabbccdd-${prefix}-${to}-0000-${courseSuffix}`;
    const passage = row('reading_passages', passageId);
    const source = row('units', sourceUnitId), target = row('units', targetUnitId);
    const course = row('courses', passage.course_id);
    if (passage.unit_id !== sourceUnitId || source.title !== oldTitle || target.title !== newTitle
      || source.course_id !== passage.course_id || target.course_id !== passage.course_id
      || course.target_language !== language || course.cefr_level !== level || passage.cefr_level !== level) {
      throw new Error(`Unexpected placement context: ${passageId}`);
    }
    const questionCount = snapshot.reading_questions.filter(q => q.passage_id === passageId).length;
    if (!questionCount) throw new Error(`No dependent questions: ${passageId}`);
    update('reading_passages', passageId, { unit_id: targetUnitId },
      `${language} ${level} reading placement (${questionCount} dependent questions): ${reason} Assign to the existing ${newTitle} unit in the same course. Preserve IDs, level, publication, content and question links. This does not fill the old unit’s separately identified practice gap.`);
  }
}
