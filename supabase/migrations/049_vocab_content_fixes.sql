-- 049_vocab_content_fixes.sql
-- Vocabulary content fixes from the 9-language QA sweep (2026-07).
-- Scope: exercises table only. One UPDATE per verified defect, each filtered by exact id.
-- Sections:
--   1. Misspelled/nonexistent target words (ko 씨다 -> 씻다, zh 慰概 -> 大方)
--   2. Multiple-choice "mean in English" rows with target-language distractors -> English distractors
--      (12 QA-listed rows + 67 extras found via read-only pattern sweep)
--   3. Flat-wrong English translations (pt Boa tarde, es Buenas noches, ja 恥ずかしい / お風呂, de Entschuldigung)
--   4. Additive accepted_answers (ru feminine past forms, ru ё/е variants, plus per-language synonym appends)
-- All rows were SELECTed and confirmed to match the defect descriptions before these UPDATEs were written.
-- Every changed options array keeps exactly 4 options with the correct answer present.

-- ============================================================================
-- SECTION 1 — Misspelled/nonexistent target words (target-side fixes)
-- ============================================================================

-- Korean: 씨다 (nonexistent) -> 씻다 ("to wash").
-- Verified: 씨다 appears in correct_answer of 4 rows and in the prompt of the
-- translate_to_native and multiple_choice rows. No options arrays contain 씨다
-- (MC options are English).
UPDATE exercises SET correct_answer = '씻다' WHERE id = 'aabbccdd-7777-2003-0001-e00000000006'; -- sentence_construction
UPDATE exercises SET correct_answer = '씻다' WHERE id = 'aabbccdd-7777-2003-0002-e00000000005'; -- cloze_deletion
UPDATE exercises SET correct_answer = '씻다' WHERE id = 'aabbccdd-7777-2003-0003-e00000000004'; -- fill_blank
UPDATE exercises SET prompt = 'Translate to English: 씻다' WHERE id = 'aabbccdd-7777-2003-0004-e00000000003'; -- translate_to_native
UPDATE exercises SET correct_answer = '씻다' WHERE id = 'aabbccdd-7777-2003-0005-e00000000002'; -- translate_to_target
UPDATE exercises SET prompt = 'What does "씻다" mean in English?' WHERE id = 'aabbccdd-7777-2003-0006-e00000000001'; -- multiple_choice

-- Chinese: 慰概 (nonexistent) -> 大方 ("generous").
-- Verified: 慰概 in correct_answer of 4 rows and in the prompt of the MC row.
-- MC options are English; no options contain 慰概.
UPDATE exercises SET correct_answer = '大方' WHERE id = 'aabbccdd-8888-2004-0002-e00000000008'; -- translate_to_target
UPDATE exercises SET prompt = 'What does "大方" mean in English?' WHERE id = 'aabbccdd-8888-2004-0003-e00000000007'; -- multiple_choice
UPDATE exercises SET correct_answer = '大方' WHERE id = 'aabbccdd-8888-2004-0004-e00000000006'; -- sentence_construction
UPDATE exercises SET correct_answer = '大方' WHERE id = 'aabbccdd-8888-2004-0005-e00000000005'; -- cloze_deletion
UPDATE exercises SET correct_answer = '大方' WHERE id = 'aabbccdd-8888-2004-0006-e00000000004'; -- fill_blank

-- ============================================================================
-- SECTION 2 — MC distractors in target language -> English translations
-- ============================================================================

-- 2a. QA-listed rows (12)
UPDATE exercises SET options = ARRAY['Doctor','Office','To read','To cook'] WHERE id = 'aabbccdd-1111-1005-0002-e00000000001'; -- es Oficina/Leer/Cocinar
UPDATE exercises SET options = ARRAY['Festival','Tradition','Gift','Party'] WHERE id = 'aabbccdd-1111-2008-0005-e00000000007'; -- es Tradición/Regalo/Fiesta
UPDATE exercises SET options = ARRAY['Tradition','Gift','Party','To celebrate'] WHERE id = 'aabbccdd-2222-2008-0005-e00000000001'; -- fr Cadeau/Fête/Célébrer
UPDATE exercises SET options = ARRAY['Cousin','Nephew','Niece','Husband'] WHERE id = 'aabbccdd-2222-2001-0003-e00000000001'; -- fr Neveu/Nièce/Mari
UPDATE exercises SET options = ARRAY['Bank','Train','Ticket','Station'] WHERE id = 'aabbccdd-3333-1003-0005-e00000000005'; -- de Zug/Fahrkarte/Bahnhof
UPDATE exercises SET options = ARRAY['Bus','Train','Ticket','Station'] WHERE id = 'aabbccdd-3333-1003-0004-e00000000001'; -- de Zug/Fahrkarte/Bahnhof
UPDATE exercises SET options = ARRAY['Hand','Eye','Stomach','Sick'] WHERE id = 'aabbccdd-3333-1008-0002-e00000000001'; -- de Auge/Magen/Krank
UPDATE exercises SET options = ARRAY['Festival','Tradition','Gift','Party'] WHERE id = 'aabbccdd-4444-2008-0005-e00000000007'; -- it Tradizione/Regalo/Festa
UPDATE exercises SET options = ARRAY['Stress','Headache','Allergy','Prescription'] WHERE id = 'aabbccdd-4444-2002-0002-e00000000007'; -- it Mal di testa/Allergia/Ricetta
UPDATE exercises SET options = ARRAY['Costume','Gift','Party','To celebrate'] WHERE id = 'aabbccdd-4444-2008-0006-e00000000007'; -- it Regalo/Festa/Festeggiare
UPDATE exercises SET options = ARRAY['Hospital','Bus','Train','Ticket'] WHERE id = 'aabbccdd-5555-1003-0004-e00000000005'; -- pt Ônibus/Trem/Passagem
UPDATE exercises SET options = ARRAY['Festival','Tradition','Gift','Party'] WHERE id = 'aabbccdd-5555-2008-0005-e00000000007'; -- pt Tradição/Presente/Festa

-- 2b. Pattern-sweep extras (same defect, found via read-only sweep:
--     type='multiple_choice', prompt LIKE '%mean in English%', options containing
--     non-ASCII characters OR known target-language words from the same course).
--     Verified individually; 67 rows.

-- Spanish (course aabbccdd-1111)
UPDATE exercises SET options = ARRAY['Hospital','Bus','Train','Ticket'] WHERE id = 'aabbccdd-1111-1003-0004-e00000000005'; -- Autobús/Tren/Billete
UPDATE exercises SET options = ARRAY['Debate','Opinion','I agree','I disagree'] WHERE id = 'aabbccdd-1111-3001-0001-e00000000010'; -- Opinión/Estoy de acuerdo/No estoy de acuerdo
UPDATE exercises SET options = ARRAY['Hotel','Reservation','Passport','Luggage'] WHERE id = 'aabbccdd-1111-3003-0003-e00000000001'; -- Reserva/Pasaporte/Equipaje
UPDATE exercises SET options = ARRAY['Hotel','Luggage','Boarding pass','Delay'] WHERE id = 'aabbccdd-1111-3003-0006-e00000000010'; -- Equipaje/Tarjeta de embarque/Retraso
UPDATE exercises SET options = ARRAY['Internet','Website','App','Password'] WHERE id = 'aabbccdd-1111-3005-0001-e00000000001'; -- Sitio web/Aplicación/Contraseña
UPDATE exercises SET options = ARRAY['Robot','Website','App','Password'] WHERE id = 'aabbccdd-1111-3005-0002-e00000000010'; -- Sitio web/Aplicación/Contraseña
UPDATE exercises SET options = ARRAY['Internet','Password','To download','To upload'] WHERE id = 'aabbccdd-1111-3005-0004-e00000000010'; -- Contraseña/Descargar/Subir
UPDATE exercises SET options = ARRAY['Formal','Dear Sir','Sincerely','Regards'] WHERE id = 'aabbccdd-1111-3008-0002-e00000000010'; -- Estimado señor/Atentamente/Saludos
UPDATE exercises SET options = ARRAY['Informal','Sincerely','Regards','Something like that'] WHERE id = 'aabbccdd-1111-3008-0003-e00000000010'; -- Atentamente/Saludos/Algo así

-- French (course aabbccdd-2222)
UPDATE exercises SET options = ARRAY['Train','Left','Right','Straight'] WHERE id = 'aabbccdd-2222-1003-0001-e00000000005'; -- Gauche/Droite/Tout droit
UPDATE exercises SET options = ARRAY['Bus','Train','Ticket','Station'] WHERE id = 'aabbccdd-2222-1003-0004-e00000000001'; -- Billet/Gare
UPDATE exercises SET options = ARRAY['Train','Ticket','Station','Hospital'] WHERE id = 'aabbccdd-2222-1003-0005-e00000000001'; -- Billet/Gare/Hôpital
UPDATE exercises SET options = ARRAY['Table','Bathroom','Bedroom','Door'] WHERE id = 'aabbccdd-2222-1007-0004-e00000000005'; -- Salle de bain/Chambre à coucher/Porte
UPDATE exercises SET options = ARRAY['Stress','Headache','Allergy','Prescription'] WHERE id = 'aabbccdd-2222-2002-0002-e00000000007'; -- Mal de tête/Allergie/Ordonnance
UPDATE exercises SET options = ARRAY['Patient','Excited','Shy','Brave'] WHERE id = 'aabbccdd-2222-2004-0005-e00000000007'; -- Excité/Timide/Courageux
UPDATE exercises SET options = ARRAY['Festival','Tradition','Gift','Party'] WHERE id = 'aabbccdd-2222-2008-0005-e00000000007'; -- Cadeau/Fête
UPDATE exercises SET options = ARRAY['Opinion','I agree','I disagree','I think that'] WHERE id = 'aabbccdd-2222-3001-0001-e00000000001'; -- Je suis d'accord/Je ne suis pas d'accord/Je pense que
UPDATE exercises SET options = ARRAY['Opinion','I think that','News','Society'] WHERE id = 'aabbccdd-2222-3001-0004-e00000000010'; -- Je pense que/Nouvelles/Société
UPDATE exercises SET options = ARRAY['Guide','Hotel','Reservation','Passport'] WHERE id = 'aabbccdd-2222-3003-0003-e00000000010'; -- Hôtel/Réservation/Passeport
UPDATE exercises SET options = ARRAY['Pollution','To recycle','Forest','Ocean'] WHERE id = 'aabbccdd-2222-3004-0002-e00000000001'; -- Recycler/Forêt/Océan
UPDATE exercises SET options = ARRAY['Pollution','Ocean','Endangered','Conservation'] WHERE id = 'aabbccdd-2222-3004-0005-e00000000010'; -- Océan/En danger
UPDATE exercises SET options = ARRAY['Internet','Website','App','Password'] WHERE id = 'aabbccdd-2222-3005-0001-e00000000001'; -- Site web/Application/Mot de passe
UPDATE exercises SET options = ARRAY['Robot','Website','App','Password'] WHERE id = 'aabbccdd-2222-3005-0002-e00000000010'; -- Site web/Application/Mot de passe
UPDATE exercises SET options = ARRAY['Internet','Password','To download','To upload'] WHERE id = 'aabbccdd-2222-3005-0004-e00000000010'; -- Mot de passe/Télécharger/Téléverser
UPDATE exercises SET options = ARRAY['Regret','Would','Could','Should'] WHERE id = 'aabbccdd-2222-3007-0002-e00000000010'; -- Ferait/Pourrait/Devrait
UPDATE exercises SET options = ARRAY['Justice','Purpose','Consciousness','Ethics'] WHERE id = 'aabbccdd-2222-4001-0002-e00000000001'; -- But/Conscience/Éthique
UPDATE exercises SET options = ARRAY['Justice','Ethics','Morality','Existence'] WHERE id = 'aabbccdd-2222-4001-0005-e00000000010'; -- Éthique/Moralité
UPDATE exercises SET options = ARRAY['Argument','To persuade','Evidence','Counterargument'] WHERE id = 'aabbccdd-2222-4002-0001-e00000000001'; -- Persuader/Preuve/Contre-argument
UPDATE exercises SET options = ARRAY['Argument','Counterargument','However','Nevertheless'] WHERE id = 'aabbccdd-2222-4002-0004-e00000000010'; -- Contre-argument/Cependant/Néanmoins
UPDATE exercises SET options = ARRAY['Budget','Stakeholder','Agenda','Minutes'] WHERE id = 'aabbccdd-2222-4003-0006-e00000000001'; -- Partie prenante/Ordre du jour/Compte rendu
UPDATE exercises SET options = ARRAY['Inspiration','Painting','Sculpture','Metaphor'] WHERE id = 'aabbccdd-2222-4004-0003-e00000000010'; -- Peinture/Métaphore
UPDATE exercises SET options = ARRAY['Sculpture','Metaphor','Symbolism','Genre'] WHERE id = 'aabbccdd-2222-4004-0004-e00000000001'; -- Métaphore/Symbolisme

-- German (course aabbccdd-3333)
UPDATE exercises SET options = ARRAY['Winter','Soccer','Hot','Cold'] WHERE id = 'aabbccdd-3333-1005-0006-e00000000005'; -- Fußball/Heiß/Kalt
UPDATE exercises SET options = ARRAY['Arm','Healthy','Medicine','Pain'] WHERE id = 'aabbccdd-3333-1008-0006-e00000000005'; -- Gesund/Medizin/Schmerz
UPDATE exercises SET options = ARRAY['Cousin','Nephew','Niece','Husband'] WHERE id = 'aabbccdd-3333-2001-0003-e00000000001'; -- Neffe/Nichte/Ehemann
UPDATE exercises SET options = ARRAY['Stress','Headache','Allergy','Prescription'] WHERE id = 'aabbccdd-3333-2002-0002-e00000000007'; -- Kopfschmerzen/Allergie/Rezept
UPDATE exercises SET options = ARRAY['Sofa','Shelf','Lamp','Carpet'] WHERE id = 'aabbccdd-3333-2003-0001-e00000000001'; -- Regal/Lampe/Teppich
UPDATE exercises SET options = ARRAY['Party','Holiday','Christmas','New Year'] WHERE id = 'aabbccdd-3333-2008-0001-e00000000007'; -- Feiertag/Weihnachten/Neujahr
UPDATE exercises SET options = ARRAY['Tradition','Gift','Party','To celebrate'] WHERE id = 'aabbccdd-3333-2008-0005-e00000000001'; -- Geschenk/Feiern
UPDATE exercises SET options = ARRAY['Festival','Tradition','Gift','Party'] WHERE id = 'aabbccdd-3333-2008-0005-e00000000007'; -- Geschenk
UPDATE exercises SET options = ARRAY['Tourist','Flight','Hotel','Reservation'] WHERE id = 'aabbccdd-3333-3003-0002-e00000000010'; -- Flug/Reservierung
UPDATE exercises SET options = ARRAY['Hotel','Reservation','Passport','Luggage'] WHERE id = 'aabbccdd-3333-3003-0003-e00000000001'; -- Reservierung/Reisepass/Gepäck
UPDATE exercises SET options = ARRAY['Hotel','Luggage','Boarding pass','Delay'] WHERE id = 'aabbccdd-3333-3003-0006-e00000000010'; -- Gepäck/Bordkarte/Verspätung
UPDATE exercises SET options = ARRAY['Internet','Website','App','Password'] WHERE id = 'aabbccdd-3333-3005-0001-e00000000001'; -- Webseite/Passwort
UPDATE exercises SET options = ARRAY['App','Password','To download','To upload'] WHERE id = 'aabbccdd-3333-3005-0003-e00000000001'; -- Passwort/Herunterladen/Hochladen
UPDATE exercises SET options = ARRAY['Internet','Password','To download','To upload'] WHERE id = 'aabbccdd-3333-3005-0004-e00000000010'; -- Passwort/Herunterladen/Hochladen
UPDATE exercises SET options = ARRAY['App','To upload','Screen','Keyboard'] WHERE id = 'aabbccdd-3333-3005-0006-e00000000010'; -- Hochladen/Bildschirm/Tastatur
UPDATE exercises SET options = ARRAY['Cool','Awesome','Whatever','No problem'] WHERE id = 'aabbccdd-3333-3008-0006-e00000000001'; -- Toll/Egal/Kein Problem
UPDATE exercises SET options = ARRAY['Argument','To persuade','Evidence','Counterargument'] WHERE id = 'aabbccdd-3333-4002-0001-e00000000001'; -- Überzeugen/Beweis/Gegenargument
UPDATE exercises SET options = ARRAY['Argument','Counterargument','However','Nevertheless'] WHERE id = 'aabbccdd-3333-4002-0004-e00000000010'; -- Gegenargument/Jedoch/Dennoch
UPDATE exercises SET options = ARRAY['Budget','Stakeholder','Agenda','Minutes'] WHERE id = 'aabbccdd-3333-4003-0006-e00000000001'; -- Interessengruppe/Tagesordnung/Protokoll
UPDATE exercises SET options = ARRAY['Inspiration','Painting','Sculpture','Metaphor'] WHERE id = 'aabbccdd-3333-4004-0003-e00000000010'; -- Gemälde/Skulptur/Metapher

-- Italian (course aabbccdd-4444)
UPDATE exercises SET options = ARRAY['Email','Meeting','Presentation','Salary'] WHERE id = 'aabbccdd-4444-3002-0003-e00000000010'; -- Riunione/Presentazione/Stipendio
UPDATE exercises SET options = ARRAY['Hotel','Reservation','Passport','Luggage'] WHERE id = 'aabbccdd-4444-3003-0003-e00000000001'; -- Prenotazione/Passaporto/Bagaglio
UPDATE exercises SET options = ARRAY['Hotel','Luggage','Boarding pass','Delay'] WHERE id = 'aabbccdd-4444-3003-0006-e00000000010'; -- Bagaglio/Carta d''imbarco/Ritardo
UPDATE exercises SET options = ARRAY['Internet','Website','App','Password'] WHERE id = 'aabbccdd-4444-3005-0001-e00000000001'; -- Sito web/Applicazione
UPDATE exercises SET options = ARRAY['Robot','Website','App','Password'] WHERE id = 'aabbccdd-4444-3005-0002-e00000000010'; -- Sito web/Applicazione
UPDATE exercises SET options = ARRAY['Password','To download','To upload','Screen'] WHERE id = 'aabbccdd-4444-3005-0004-e00000000001'; -- Scaricare/Caricare/Schermo
UPDATE exercises SET options = ARRAY['Internet','Password','To download','To upload'] WHERE id = 'aabbccdd-4444-3005-0004-e00000000010'; -- Scaricare/Caricare
UPDATE exercises SET options = ARRAY['Budget','Stakeholder','Agenda','Minutes'] WHERE id = 'aabbccdd-4444-4003-0006-e00000000001'; -- Parte interessata/Ordine del giorno/Verbale

-- Portuguese (course aabbccdd-5555)
UPDATE exercises SET options = ARRAY['Debate','Opinion','I agree','I disagree'] WHERE id = 'aabbccdd-5555-3001-0001-e00000000010'; -- Opinião/Eu concordo/Eu discordo
UPDATE exercises SET options = ARRAY['Hotel','Reservation','Passport','Luggage'] WHERE id = 'aabbccdd-5555-3003-0003-e00000000001'; -- Reserva/Passaporte/Bagagem
UPDATE exercises SET options = ARRAY['Hotel','Luggage','Boarding pass','Delay'] WHERE id = 'aabbccdd-5555-3003-0006-e00000000010'; -- Bagagem/Cartão de embarque/Atraso
UPDATE exercises SET options = ARRAY['Internet','Website','App','Password'] WHERE id = 'aabbccdd-5555-3005-0001-e00000000001'; -- Site/Aplicativo/Senha
UPDATE exercises SET options = ARRAY['Internet','Password','To download','To upload'] WHERE id = 'aabbccdd-5555-3005-0004-e00000000010'; -- Senha/Baixar/Carregar
UPDATE exercises SET options = ARRAY['Formal','Dear Sir','Sincerely','Regards'] WHERE id = 'aabbccdd-5555-3008-0002-e00000000010'; -- Prezado Senhor/Atenciosamente/Cumprimentos
UPDATE exercises SET options = ARRAY['Informal','Sincerely','Regards','So-so'] WHERE id = 'aabbccdd-5555-3008-0003-e00000000010'; -- Atenciosamente/Cumprimentos/Mais ou menos

-- Sweep notes: no defective rows of this pattern were found in the it/ja/ko/zh/ru
-- courses beyond those handled above (CJK/Cyrillic MC options are already English).
-- Rows whose options contain only English/cognate words (e.g. fr "Train", "Bus",
-- es "Hospital", de "Winter" as the CORRECT answer with English distractors)
-- were confirmed non-defective and left untouched.

-- ============================================================================
-- SECTION 3 — Flat-wrong translations (English-side fixes)
-- ============================================================================

-- pt "Boa tarde" = Good afternoon (was glossed Good evening)
UPDATE exercises SET prompt = 'Boa _____ (Good afternoon)', accepted_answers = '{}' WHERE id = 'aabbccdd-5555-1001-0001-e00000000004'; -- fill_blank: fix gloss, drop noite variants
UPDATE exercises SET correct_answer = 'Boa noite', accepted_answers = '{}' WHERE id = 'aabbccdd-5555-1001-0003-e00000000002'; -- t2t "Good evening": correct is Boa noite; Boa tarde no longer accepted
UPDATE exercises SET correct_answer = 'Good afternoon' WHERE id = 'aabbccdd-5555-1001-0002-e00000000003'; -- t2n Boa tarde -> Good afternoon

-- es Good evening cluster: "noches" variants are wrong for these rows
UPDATE exercises SET accepted_answers = '{}' WHERE id = 'aabbccdd-1111-1001-0001-e00000000004'; -- remove "noches","Buenas noches"
UPDATE exercises SET accepted_answers = '{}' WHERE id = 'aabbccdd-1111-1001-0003-e00000000002'; -- remove "Buenas noches"

-- ja 恥ずかしい = Embarrassed (was "Shy")
UPDATE exercises SET prompt = 'Translate to Japanese: Embarrassed' WHERE id = 'aabbccdd-6666-2004-0005-e00000000002'; -- translate_to_target
UPDATE exercises SET correct_answer = 'Embarrassed', accepted_answers = array_append(accepted_answers, 'Ashamed') WHERE id = 'aabbccdd-6666-2004-0004-e00000000003'; -- translate_to_native
UPDATE exercises SET correct_answer = 'Embarrassed', options = ARRAY['Sad','Lazy','Embarrassed','Patient'] WHERE id = 'aabbccdd-6666-2004-0006-e00000000001'; -- multiple_choice
UPDATE exercises SET prompt = 'Arrange the words to translate: Embarrassed' WHERE id = 'aabbccdd-6666-2004-0001-e00000000006'; -- sentence_construction
UPDATE exercises SET prompt = '恥ず_____ (Embarrassed)' WHERE id = 'aabbccdd-6666-2004-0003-e00000000004'; -- fill_blank
UPDATE exercises SET prompt = 'Fill in the missing word: _____ means Embarrassed' WHERE id = 'aabbccdd-6666-2004-0002-e00000000005'; -- cloze_deletion

-- ja お風呂 = Bath (was "Bathroom")
UPDATE exercises SET correct_answer = 'Bath', options = ARRAY['Bed','House','Bath','Table'] WHERE id = 'aabbccdd-6666-1007-0004-e00000000001'; -- multiple_choice
UPDATE exercises SET correct_answer = 'Bath', accepted_answers = array_append(accepted_answers, 'Bathtub') WHERE id = 'aabbccdd-6666-1007-0002-e00000000003'; -- translate_to_native
UPDATE exercises SET prompt = 'Translate to Japanese: Bath' WHERE id = 'aabbccdd-6666-1007-0003-e00000000002'; -- translate_to_target
UPDATE exercises SET prompt = '_____ (Bath)' WHERE id = 'aabbccdd-6666-1007-0001-e00000000004'; -- fill_blank

-- de Entschuldigung: primary gloss "Excuse me", keep "Sorry" accepted where free-typed
-- MC row: "Excuse me" was already an option alongside "Sorry"; making "Excuse me"
-- correct requires removing the now-also-correct "Sorry" distractor -> replaced with "Please".
UPDATE exercises SET correct_answer = 'Excuse me', options = ARRAY['Please','Hello','Excuse me','Yes'] WHERE id = 'aabbccdd-3333-1001-0004-e00000000005'; -- multiple_choice
UPDATE exercises SET correct_answer = 'Excuse me', accepted_answers = array_append(accepted_answers, 'Sorry') WHERE id = 'aabbccdd-3333-1001-0006-e00000000003'; -- translate_to_native
UPDATE exercises SET correct_answer = 'Excuse me', accepted_answers = array_append(accepted_answers, 'Sorry') WHERE id = 'aabbccdd-3333-1001-0002-e00000000007'; -- translate_to_native
-- fill_blank rows: answer is the suffix "ldigung", so only the English gloss in the
-- prompt changes; appending "Sorry" to accepted_answers is not applicable here.
UPDATE exercises SET prompt = 'Entschu_____ (Excuse me)' WHERE id = 'aabbccdd-3333-1001-0001-e00000000008'; -- fill_blank
UPDATE exercises SET prompt = 'Entschu_____ (Excuse me)' WHERE id = 'aabbccdd-3333-1001-0005-e00000000004'; -- fill_blank

-- ============================================================================
-- SECTION 4 — Additive accepted_answers (append only; no removals)
-- ============================================================================

-- Russian feminine past-tense forms (course aabbccdd-9999, unit 2005)
UPDATE exercises SET accepted_answers = array_append(accepted_answers, 'Я увидела') WHERE id = 'aabbccdd-9999-2005-0004-e00000000002'; -- t2t I saw
UPDATE exercises SET accepted_answers = accepted_answers || ARRAY['Я пошла','Я пошел'] WHERE id = 'aabbccdd-9999-2005-0002-e00000000002'; -- t2t I went (feminine + е-variant of пошёл)
UPDATE exercises SET accepted_answers = array_append(accepted_answers, 'Я поела') WHERE id = 'aabbccdd-9999-2005-0003-e00000000002'; -- t2t I ate
UPDATE exercises SET accepted_answers = array_append(accepted_answers, 'Я говорила') WHERE id = 'aabbccdd-9999-2005-0004-e00000000008'; -- t2t I spoke
UPDATE exercises SET accepted_answers = array_append(accepted_answers, 'Я писала') WHERE id = 'aabbccdd-9999-2005-0005-e00000000008'; -- t2t I wrote
UPDATE exercises SET accepted_answers = array_append(accepted_answers, 'Я работала') WHERE id = 'aabbccdd-9999-2005-0003-e00000000008'; -- t2t I worked
UPDATE exercises SET accepted_answers = array_append(accepted_answers, 'Я училась') WHERE id = 'aabbccdd-9999-2005-0003-e00000000006'; -- sc I studied
UPDATE exercises SET accepted_answers = array_append(accepted_answers, 'Я играла') WHERE id = 'aabbccdd-9999-2005-0004-e00000000006'; -- sc I played
UPDATE exercises SET accepted_answers = array_append(accepted_answers, 'Я путешествовала') WHERE id = 'aabbccdd-9999-2005-0002-e00000000006'; -- sc I traveled
-- fill_blank rows: answers are word suffixes, so append the feminine suffix variant
UPDATE exercises SET accepted_answers = array_append(accepted_answers, 'упила') WHERE id = 'aabbccdd-9999-2005-0003-e00000000004'; -- "Я к___" (упил -> упила)
UPDATE exercises SET accepted_answers = array_append(accepted_answers, 'ествовала') WHERE id = 'aabbccdd-9999-2005-0004-e00000000004'; -- "Я путеш___"
UPDATE exercises SET accepted_answers = array_append(accepted_answers, 'идела') WHERE id = 'aabbccdd-9999-2005-0002-e00000000004'; -- "Я ув___"
UPDATE exercises SET accepted_answers = array_append(accepted_answers, 'илась') WHERE id = 'aabbccdd-9999-2005-0005-e00000000004'; -- "Я уч___"
UPDATE exercises SET accepted_answers = array_append(accepted_answers, 'грала') WHERE id = 'aabbccdd-9999-2005-0006-e00000000004'; -- "Я и___"
UPDATE exercises SET accepted_answers = array_append(accepted_answers, 'оела') WHERE id = 'aabbccdd-9999-2005-0001-e00000000004'; -- "Я п___"
-- cloze rows
UPDATE exercises SET accepted_answers = array_append(accepted_answers, 'Я путешествовала') WHERE id = 'aabbccdd-9999-2005-0003-e00000000005'; -- cloze I traveled
UPDATE exercises SET accepted_answers = array_append(accepted_answers, 'Я купила') WHERE id = 'aabbccdd-9999-2005-0002-e00000000005'; -- cloze I bought

-- Russian ё/е spelling variants
UPDATE exercises SET accepted_answers = array_append(accepted_answers, 'вер') WHERE id = 'aabbccdd-9999-2003-0001-e00000000004'; -- Ковёр suffix (вёр -> вер)
UPDATE exercises SET accepted_answers = array_append(accepted_answers, 'Дешевый') WHERE id = 'aabbccdd-9999-1004-0002-e00000000002'; -- Дешёвый
-- (Я пошел handled together with the feminine append above)

-- Russian Рука = Hand or Arm
UPDATE exercises SET accepted_answers = array_append(accepted_answers, 'Hand') WHERE id = 'aabbccdd-9999-1008-0004-e00000000007'; -- translate_to_native
-- SKIP aabbccdd-9999-1008-0006-e00000000005 (multiple_choice "Рука"): verified options
-- are {Arm, Stomach, Healthy, Fever} — "Hand" is not among them, so the MC row is
-- unambiguous as-is and left unchanged per instructions.

-- Russian married (Женатый is masculine-only; accept feminine forms)
UPDATE exercises SET accepted_answers = accepted_answers || ARRAY['Замужем','Замужняя'] WHERE id = 'aabbccdd-9999-2001-0005-e00000000008';

-- Russian cousin (accept feminine cousin)
UPDATE exercises SET accepted_answers = array_append(accepted_answers, 'Двоюродная сестра') WHERE id = 'aabbccdd-9999-2001-0002-e00000000002';

-- pt Obrigada (feminine speaker) — read-only sweep of courses aabbccdd-5555-% for
-- translate_to_target/fill_blank with correct_answer='Obrigado' found exactly these ids:
--   aabbccdd-5555-1001-0002-e00000000006 (translate_to_target "Thank you")
--   aabbccdd-5555-1001-0006-e00000000002 (translate_to_target "Thank you")
UPDATE exercises SET accepted_answers = array_append(accepted_answers, 'Obrigada') WHERE id = 'aabbccdd-5555-1001-0002-e00000000006';
UPDATE exercises SET accepted_answers = array_append(accepted_answers, 'Obrigada') WHERE id = 'aabbccdd-5555-1001-0006-e00000000002';

-- Spanish
UPDATE exercises SET accepted_answers = array_append(accepted_answers, 'Enojado') WHERE id = 'aabbccdd-1111-2004-0002-e00000000002'; -- Angry: Enfadado + Enojado
UPDATE exercises SET accepted_answers = array_append(accepted_answers, 'Tiempo') WHERE id = 'aabbccdd-1111-1004-0004-e00000000006'; -- Time: Hora + Tiempo
UPDATE exercises SET accepted_answers = array_append(accepted_answers, 'Straight ahead') WHERE id = 'aabbccdd-1111-1003-0001-e00000000003'; -- Derecho -> Straight / Straight ahead

-- French
UPDATE exercises SET accepted_answers = array_append(accepted_answers, 'Woman') WHERE id = 'aabbccdd-2222-2001-0005-e00000000003'; -- Femme: Wife + Woman
UPDATE exercises SET accepted_answers = array_append(accepted_answers, 'Straight ahead') WHERE id = 'aabbccdd-2222-1003-0001-e00000000003'; -- Tout droit
UPDATE exercises SET accepted_answers = array_append(accepted_answers, 'Bigger') WHERE id = 'aabbccdd-2222-2007-0005-e00000000003'; -- Plus grand: Taller + Bigger
UPDATE exercises SET accepted_answers = array_append(accepted_answers, 'Smaller') WHERE id = 'aabbccdd-2222-2007-0006-e00000000003'; -- Plus petit: Shorter + Smaller

-- German
UPDATE exercises SET accepted_answers = array_append(accepted_answers, 'Smaller') WHERE id = 'aabbccdd-3333-2007-0006-e00000000003'; -- Kleiner
UPDATE exercises SET accepted_answers = array_append(accepted_answers, 'Bigger') WHERE id = 'aabbccdd-3333-2007-0005-e00000000003'; -- Größer
UPDATE exercises SET accepted_answers = array_append(accepted_answers, 'Morning') WHERE id = 'aabbccdd-3333-1004-0004-e00000000007'; -- Morgen: Tomorrow + Morning
UPDATE exercises SET accepted_answers = array_append(accepted_answers, 'Friend') WHERE id = 'aabbccdd-3333-2001-0006-e00000000003'; -- Freund: Boyfriend + Friend
UPDATE exercises SET correct_answer = 'I will learn', accepted_answers = array_append(accepted_answers, 'I will study') WHERE id = 'aabbccdd-3333-2006-0003-e00000000003'; -- Ich werde lernen

-- Italian
UPDATE exercises SET accepted_answers = accepted_answers || ARRAY['Goodbye','Bye'] WHERE id = 'aabbccdd-4444-1001-0006-e00000000007'; -- Ciao: Hello + Goodbye/Bye
UPDATE exercises SET accepted_answers = accepted_answers || ARRAY['Niece','Grandchild'] WHERE id = 'aabbccdd-4444-2001-0002-e00000000003'; -- Nipote: Nephew + Niece/Grandchild

-- Chinese
UPDATE exercises SET correct_answer = 'Go straight', accepted_answers = array_append(accepted_answers, 'Straight') WHERE id = 'aabbccdd-8888-1003-0001-e00000000003'; -- 直走
UPDATE exercises SET accepted_answers = array_append(accepted_answers, 'Is not') WHERE id = 'aabbccdd-8888-1001-0005-e00000000007'; -- 不是: No + Is not

-- Japanese 足 (leg/foot):
-- SKIP aabbccdd-6666-1008-0004-e00000000008 (fill_blank, answer is 足) and
-- SKIP aabbccdd-6666-1008-0006-e00000000006 (translate_to_target Leg -> 足):
-- appending 脚 target-side is risky (kanji not taught in this unit); left unchanged.
-- Instead, the translate_to_native row for 足 accepts "Foot":
UPDATE exercises SET accepted_answers = array_append(accepted_answers, 'Foot') WHERE id = 'aabbccdd-6666-1008-0005-e00000000007'; -- t2n 足: Leg + Foot

-- Korean formatting: space before blank
UPDATE exercises SET prompt = '아침 _____ (Breakfast)' WHERE id = 'aabbccdd-7777-1004-0005-e00000000008';

-- ============================================================================
-- VERIFICATION — count of affected ids (expected: 152)
-- ============================================================================
SELECT count(*) AS affected_rows_present FROM exercises WHERE id IN (
  -- Section 1 (11)
  'aabbccdd-7777-2003-0001-e00000000006','aabbccdd-7777-2003-0002-e00000000005','aabbccdd-7777-2003-0003-e00000000004',
  'aabbccdd-7777-2003-0004-e00000000003','aabbccdd-7777-2003-0005-e00000000002','aabbccdd-7777-2003-0006-e00000000001',
  'aabbccdd-8888-2004-0002-e00000000008','aabbccdd-8888-2004-0003-e00000000007','aabbccdd-8888-2004-0004-e00000000006',
  'aabbccdd-8888-2004-0005-e00000000005','aabbccdd-8888-2004-0006-e00000000004',
  -- Section 2a (12)
  'aabbccdd-1111-1005-0002-e00000000001','aabbccdd-1111-2008-0005-e00000000007','aabbccdd-2222-2008-0005-e00000000001',
  'aabbccdd-2222-2001-0003-e00000000001','aabbccdd-3333-1003-0005-e00000000005','aabbccdd-3333-1003-0004-e00000000001',
  'aabbccdd-3333-1008-0002-e00000000001','aabbccdd-4444-2008-0005-e00000000007','aabbccdd-4444-2002-0002-e00000000007',
  'aabbccdd-4444-2008-0006-e00000000007','aabbccdd-5555-1003-0004-e00000000005','aabbccdd-5555-2008-0005-e00000000007',
  -- Section 2b (67)
  'aabbccdd-1111-1003-0004-e00000000005','aabbccdd-1111-3001-0001-e00000000010','aabbccdd-1111-3003-0003-e00000000001',
  'aabbccdd-1111-3003-0006-e00000000010','aabbccdd-1111-3005-0001-e00000000001','aabbccdd-1111-3005-0002-e00000000010',
  'aabbccdd-1111-3005-0004-e00000000010','aabbccdd-1111-3008-0002-e00000000010','aabbccdd-1111-3008-0003-e00000000010',
  'aabbccdd-2222-1003-0001-e00000000005','aabbccdd-2222-1003-0004-e00000000001','aabbccdd-2222-1003-0005-e00000000001',
  'aabbccdd-2222-1007-0004-e00000000005','aabbccdd-2222-2002-0002-e00000000007','aabbccdd-2222-2004-0005-e00000000007',
  'aabbccdd-2222-2008-0005-e00000000007','aabbccdd-2222-3001-0001-e00000000001','aabbccdd-2222-3001-0004-e00000000010',
  'aabbccdd-2222-3003-0003-e00000000010','aabbccdd-2222-3004-0002-e00000000001','aabbccdd-2222-3004-0005-e00000000010',
  'aabbccdd-2222-3005-0001-e00000000001','aabbccdd-2222-3005-0002-e00000000010','aabbccdd-2222-3005-0004-e00000000010',
  'aabbccdd-2222-3007-0002-e00000000010','aabbccdd-2222-4001-0002-e00000000001','aabbccdd-2222-4001-0005-e00000000010',
  'aabbccdd-2222-4002-0001-e00000000001','aabbccdd-2222-4002-0004-e00000000010','aabbccdd-2222-4003-0006-e00000000001',
  'aabbccdd-2222-4004-0003-e00000000010','aabbccdd-2222-4004-0004-e00000000001',
  'aabbccdd-3333-1005-0006-e00000000005','aabbccdd-3333-1008-0006-e00000000005','aabbccdd-3333-2001-0003-e00000000001',
  'aabbccdd-3333-2002-0002-e00000000007','aabbccdd-3333-2003-0001-e00000000001','aabbccdd-3333-2008-0001-e00000000007',
  'aabbccdd-3333-2008-0005-e00000000001','aabbccdd-3333-2008-0005-e00000000007','aabbccdd-3333-3003-0002-e00000000010',
  'aabbccdd-3333-3003-0003-e00000000001','aabbccdd-3333-3003-0006-e00000000010','aabbccdd-3333-3005-0001-e00000000001',
  'aabbccdd-3333-3005-0003-e00000000001','aabbccdd-3333-3005-0004-e00000000010','aabbccdd-3333-3005-0006-e00000000010',
  'aabbccdd-3333-3008-0006-e00000000001','aabbccdd-3333-4002-0001-e00000000001','aabbccdd-3333-4002-0004-e00000000010',
  'aabbccdd-3333-4003-0006-e00000000001','aabbccdd-3333-4004-0003-e00000000010',
  'aabbccdd-4444-3002-0003-e00000000010','aabbccdd-4444-3003-0003-e00000000001','aabbccdd-4444-3003-0006-e00000000010',
  'aabbccdd-4444-3005-0001-e00000000001','aabbccdd-4444-3005-0002-e00000000010','aabbccdd-4444-3005-0004-e00000000001',
  'aabbccdd-4444-3005-0004-e00000000010','aabbccdd-4444-4003-0006-e00000000001',
  'aabbccdd-5555-3001-0001-e00000000010','aabbccdd-5555-3003-0003-e00000000001','aabbccdd-5555-3003-0006-e00000000010',
  'aabbccdd-5555-3005-0001-e00000000001','aabbccdd-5555-3005-0004-e00000000010','aabbccdd-5555-3008-0002-e00000000010',
  'aabbccdd-5555-3008-0003-e00000000010',
  -- Section 3 (20)
  'aabbccdd-5555-1001-0001-e00000000004','aabbccdd-5555-1001-0003-e00000000002','aabbccdd-5555-1001-0002-e00000000003',
  'aabbccdd-1111-1001-0001-e00000000004','aabbccdd-1111-1001-0003-e00000000002',
  'aabbccdd-6666-2004-0005-e00000000002','aabbccdd-6666-2004-0004-e00000000003','aabbccdd-6666-2004-0006-e00000000001',
  'aabbccdd-6666-2004-0001-e00000000006','aabbccdd-6666-2004-0003-e00000000004','aabbccdd-6666-2004-0002-e00000000005',
  'aabbccdd-6666-1007-0004-e00000000001','aabbccdd-6666-1007-0002-e00000000003','aabbccdd-6666-1007-0003-e00000000002',
  'aabbccdd-6666-1007-0001-e00000000004',
  'aabbccdd-3333-1001-0004-e00000000005','aabbccdd-3333-1001-0006-e00000000003','aabbccdd-3333-1001-0002-e00000000007',
  'aabbccdd-3333-1001-0001-e00000000008','aabbccdd-3333-1001-0005-e00000000004',
  -- Section 4 (42)
  'aabbccdd-9999-2005-0004-e00000000002','aabbccdd-9999-2005-0002-e00000000002','aabbccdd-9999-2005-0003-e00000000002',
  'aabbccdd-9999-2005-0004-e00000000008','aabbccdd-9999-2005-0005-e00000000008','aabbccdd-9999-2005-0003-e00000000008',
  'aabbccdd-9999-2005-0003-e00000000006','aabbccdd-9999-2005-0004-e00000000006','aabbccdd-9999-2005-0002-e00000000006',
  'aabbccdd-9999-2005-0003-e00000000004','aabbccdd-9999-2005-0004-e00000000004','aabbccdd-9999-2005-0002-e00000000004',
  'aabbccdd-9999-2005-0005-e00000000004','aabbccdd-9999-2005-0006-e00000000004','aabbccdd-9999-2005-0001-e00000000004',
  'aabbccdd-9999-2005-0003-e00000000005','aabbccdd-9999-2005-0002-e00000000005',
  'aabbccdd-9999-2003-0001-e00000000004','aabbccdd-9999-1004-0002-e00000000002','aabbccdd-9999-1008-0004-e00000000007',
  'aabbccdd-9999-2001-0005-e00000000008','aabbccdd-9999-2001-0002-e00000000002',
  'aabbccdd-5555-1001-0002-e00000000006','aabbccdd-5555-1001-0006-e00000000002',
  'aabbccdd-1111-2004-0002-e00000000002','aabbccdd-1111-1004-0004-e00000000006','aabbccdd-1111-1003-0001-e00000000003',
  'aabbccdd-2222-2001-0005-e00000000003','aabbccdd-2222-1003-0001-e00000000003','aabbccdd-2222-2007-0005-e00000000003',
  'aabbccdd-2222-2007-0006-e00000000003',
  'aabbccdd-3333-2007-0006-e00000000003','aabbccdd-3333-2007-0005-e00000000003','aabbccdd-3333-1004-0004-e00000000007',
  'aabbccdd-3333-2001-0006-e00000000003','aabbccdd-3333-2006-0003-e00000000003',
  'aabbccdd-4444-1001-0006-e00000000007','aabbccdd-4444-2001-0002-e00000000003',
  'aabbccdd-8888-1003-0001-e00000000003','aabbccdd-8888-1001-0005-e00000000007',
  'aabbccdd-6666-1008-0005-e00000000007',
  'aabbccdd-7777-1004-0005-e00000000008'
);
