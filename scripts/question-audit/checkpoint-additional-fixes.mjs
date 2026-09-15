/** Further individually reviewed completions of open French checkpoint gaps.
 * These are not an exhaustive semantic grader; unchanged valid keys remain. */
export function checkpointAdditionalFixes({ row, update }) {
  const proposals = [
    ['09e1823b-0fac-42c0-ae83-0b25e9d97730', 'fr-C0003', ['impatients'], 'Les enfants sont impatients d’aller à la piscine: the plural adjective agrees and the de complement expresses eagerness.'],
    ['16006bc1-35ae-4abf-b64d-a99cd47cd062', 'fr-C0006', ['roman'], 'Je lis un roman avant de dormir: a novel is a valid masculine reading object, not restricted to the three stored categories.'],
    ['190072f9-8778-4daf-ab80-531a9f7be07c', 'fr-C0008', ['père', 'fils'], 'Mon père/fils s’appelle Marc: both masculine family relationships fit the unchanged name sentence.'],
    ['48cc4ed8-7e6d-4ba4-8dba-5df393e94776', 'fr-C0022', ['campagne'], 'Nous allons à la campagne: the feminine destination fits both the preposition and the good-weather context.'],
    ['4f4bc9b6-c3e9-462d-bfd5-c83b198229ed', 'fr-C0024', ['chez'], 'Nous nous sommes rencontrés chez un ami commun: meeting at a mutual friend’s home satisfies the unqualified completion prompt.'],
    ['5752c61c-78c7-42bf-a3fb-4553fc299235', 'fr-C0028', ['voulez'], 'Vous voulez me donner un coup de main ?: a grammatical question about willingness; the prompt does not require the verb pouvoir or the conditional.'],
    ['f03ec4a1-191f-458b-958c-d7415f849506', 'fr-C0065', ['piscine'], 'L’été, nous allons souvent à la piscine: an ordinary feminine summer destination fits à la.'],
    ['f8cecf8d-3809-4590-b1f4-d00c1e539501', 'fr-C0071', ['croissants'], 'Les croissants sont délicieux aujourd’hui: masculine plural agreement and food meaning are correct.'],
    ['fc26c409-e407-4dae-b637-0f6f58cfd04e', 'fr-C0072', ['plaît', 'va'], 'Cette robe plaît/va à ma mère: both third-person singular verbs take à and are compatible with her wearing the dress for a long time. Possession is not the only meaning licensed by the prompt.'],
  ];
  for (const [id, ref, answers, evidence] of proposals) {
    const item = row('checkpoint_items', id);
    if (item.strand !== 'reading' || item.language !== 'fr') throw new Error(`Unexpected checkpoint context: ${id}`);
    update('checkpoint_items', id, {
      accepted_answers: [...new Set([...item.accepted_answers, ...answers])],
    }, `${ref}: ${evidence} Add these confirmed valid responses without claiming all possible completions are enumerated.`);
  }
}
