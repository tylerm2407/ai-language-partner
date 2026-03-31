#!/usr/bin/env python3
"""Generate comprehensive seed SQL for Fluenci — 4 CEFR levels x 8 languages.

Produces ~12,800 exercises and ~2,800 cards across A1/A2/B1/B2.
"""
import os, json, random
random.seed(42)

def esc(s):
    if s is None: return ""
    return str(s).replace("'", "''")

def jesc(obj):
    return esc(json.dumps(obj, ensure_ascii=False))

LEVELS = {
    "A1": {"units":8,"lpu":6,"epl":8,"xp":20,"mins":5,"idx":1,"sfx":"000000000000"},
    "A2": {"units":8,"lpu":6,"epl":8,"xp":25,"mins":7,"idx":2,"sfx":"a20000000000"},
    "B1": {"units":8,"lpu":6,"epl":10,"xp":30,"mins":10,"idx":3,"sfx":"b10000000000"},
    "B2": {"units":6,"lpu":6,"epl":10,"xp":40,"mins":12,"idx":4,"sfx":"b20000000000"},
}

EX_TYPES = {
    "A1": ["multiple_choice","translate_to_target","translate_to_native","fill_blank"],
    "A2": ["multiple_choice","translate_to_target","translate_to_native","fill_blank","cloze_deletion","sentence_construction"],
    "B1": ["multiple_choice","translate_to_target","translate_to_native","fill_blank","cloze_deletion","sentence_construction","error_correction","dictation","free_production"],
    "B2": ["multiple_choice","translate_to_target","translate_to_native","fill_blank","error_correction","dictation","free_production","cloze_deletion","sentence_construction"],
}

def mk_course(lc, sfx):
    return f"aabbccdd-{lc}-0000-0000-{sfx}"
def mk_unit(lc, li, ui, sfx):
    return f"aabbccdd-{lc}-{li}{ui:03d}-0000-{sfx}"
def mk_lesson(lc, li, ui, lsi, sfx):
    return f"aabbccdd-{lc}-{li}{ui:03d}-{lsi:04d}-{sfx}"
def mk_exercise(lc, li, ui, lsi, ei):
    return f"aabbccdd-{lc}-{li}{ui:03d}-{lsi:04d}-e{ei:011d}"
def mk_card(lc, li, ui, ci, sfx):
    return f"aabbccdd-{lc}-{li}{ui:03d}-c{ci:03d}-{sfx}"
def mk_reading(lc, li, ui, ri):
    return f"aabbccdd-{lc}-{li}{ui:03d}-r{ri:03d}-000000000000"
def mk_question(lc, li, ui, ri, qi):
    return f"aabbccdd-{lc}-{li}{ui:03d}-r{ri:03d}-q{qi:010d}"
def mk_writing(lc, li, ui, wi):
    return f"aabbccdd-{lc}-{li}{ui:03d}-w{wi:03d}-000000000000"


# ═══════════════════════════════════════════════════════════════
# LANGUAGE METADATA AND UNIT/LESSON STRUCTURE
# ═══════════════════════════════════════════════════════════════

LANG_META = {
    "es": ("1111", "Spanish"),
    "fr": ("2222", "French"),
    "de": ("3333", "German"),
    "it": ("4444", "Italian"),
    "pt": ("5555", "Portuguese"),
    "ja": ("6666", "Japanese"),
    "ko": ("7777", "Korean"),
    "zh": ("8888", "Chinese"),
}

UNIT_DEFS = {
    "A1": [
        ("Greetings & Basics", "Learn greetings, introductions, and polite expressions"),
        ("Food & Dining", "Order food and drinks at a restaurant"),
        ("Getting Around", "Ask for directions and use transportation"),
        ("Daily Life & Shopping", "Talk about routines and go shopping"),
        ("Work & Social", "Discuss jobs, hobbies, and make plans"),
        ("Family & Friends", "Talk about family and relationships"),
        ("Home & Rooms", "Describe your house and furniture"),
        ("Health & Body", "Body parts, health, and doctor visits"),
    ],
    "A2": [
        ("Family & Relationships", "Describe family, relationships, and ages"),
        ("Health & Wellness", "Symptoms, doctor visits, pharmacy, feelings"),
        ("At Home", "Furniture, chores, describing your home"),
        ("Emotions & Personality", "Adjectives for people, moods, character"),
        ("Past Tense Basics", "Yesterday, last week, simple past actions"),
        ("Future Plans", "Will, going to, plans, intentions"),
        ("Comparisons", "Bigger, smaller, better, more expensive"),
        ("Cultural Topics", "Holidays, traditions, celebrations"),
    ],
    "B1": [
        ("Opinions & Current Events", "Agree/disagree, news, society"),
        ("Work & Career", "Interviews, meetings, emails, presentations"),
        ("Travel & Adventure", "Booking, airports, hotels, experiences"),
        ("Environment & Nature", "Climate, animals, conservation"),
        ("Technology & Media", "Internet, social media, devices"),
        ("Storytelling", "Narrative tenses, sequencing, past continuous"),
        ("Hypothetical Situations", "Conditionals, would/could/should"),
        ("Formal vs. Informal", "Register, polite requests, slang"),
    ],
    "B2": [
        ("Abstract Ideas", "Philosophy, concepts, beliefs"),
        ("Debate & Argumentation", "Persuasion, counterarguments, rhetoric"),
        ("Professional Communication", "Formal writing, presentations, negotiations"),
        ("Literature & Arts", "Describing art, reviews, literary analysis"),
        ("Idiomatic Expressions", "Idioms, proverbs, collocations"),
        ("Complex Grammar", "Subjunctive, reported speech, passive voice"),
    ],
}

LESSON_TITLES = {
    "A1": [
        ["Core Vocabulary", "Phrases & Sentences", "Listening & Recognition", "Speaking Practice", "Reading Simple Texts", "Review & Test"],
        ["Restaurant Basics", "Common Foods", "Drinks & Beverages", "Describing Taste", "Full Meal Order", "Review & Test"],
        ["Asking Directions", "Transportation", "Places in Town", "Buying Tickets", "At the Airport", "Review & Test"],
        ["Daily Routine", "Shopping Basics", "Clothes & Colors", "Time & Schedule", "At the Market", "Review & Test"],
        ["Jobs & Professions", "Making Plans", "Hobbies & Interests", "Weather & Seasons", "Weekend Activities", "Review & Test"],
        ["Family Members", "Describing People", "Ages & Birthdays", "Pets & Animals", "Family Activities", "Review & Test"],
        ["Parts of the House", "Furniture", "In the Kitchen", "Bathroom & Bedroom", "Describing Your Home", "Review & Test"],
        ["Body Parts", "Feelings & Symptoms", "At the Doctor", "At the Pharmacy", "Healthy Habits", "Review & Test"],
    ],
    "A2": [
        ["Extended Family", "Describing Relationships", "Talking About Ages", "Life Events", "Family Traditions", "Review & Test"],
        ["Common Symptoms", "At the Doctor Office", "At the Pharmacy", "Mental Health", "Healthy Lifestyle", "Review & Test"],
        ["Rooms & Furniture", "Household Chores", "Moving & Housing", "Neighbors & Community", "Home Problems", "Review & Test"],
        ["Positive Emotions", "Negative Emotions", "Personality Traits", "Describing Character", "Emotional Reactions", "Review & Test"],
        ["What Happened Yesterday", "Last Weekend", "A Memorable Trip", "Childhood Memories", "Recent News", "Review & Test"],
        ["Plans for Tomorrow", "Next Vacation", "Life Goals", "Making Appointments", "Predictions", "Review & Test"],
        ["Comparing Things", "Comparing People", "Superlatives", "Prices & Quality", "Preferences", "Review & Test"],
        ["National Holidays", "Food Traditions", "Music & Dance", "Festivals", "Gift Giving", "Review & Test"],
    ],
    "B1": [
        ["Expressing Opinions", "Agreeing & Disagreeing", "Current Events", "Social Issues", "Giving Reasons", "Review & Test"],
        ["Job Interviews", "Office Communication", "Meetings", "Career Goals", "Work Problems", "Review & Test"],
        ["Booking Travel", "At the Airport", "Hotel Check-in", "Travel Experiences", "Travel Problems", "Review & Test"],
        ["Climate & Weather", "Wildlife", "Conservation", "Pollution", "Sustainable Living", "Review & Test"],
        ["Internet & Social Media", "Smartphones & Apps", "Digital Communication", "Tech Problems", "Future Technology", "Review & Test"],
        ["Telling a Story", "Sequencing Events", "Past Continuous", "Interruptions", "Describing Scenes", "Review & Test"],
        ["First Conditional", "Second Conditional", "Giving Advice", "Expressing Wishes", "Regrets", "Review & Test"],
        ["Formal Requests", "Informal Speech", "Writing Emails", "Phone Etiquette", "Adapting Register", "Review & Test"],
    ],
    "B2": [
        ["Philosophy of Life", "Beliefs & Values", "Abstract Concepts", "Critical Thinking", "Expressing Complex Ideas", "Review & Test"],
        ["Building Arguments", "Counterarguments", "Persuasive Language", "Logical Fallacies", "Formal Debate", "Review & Test"],
        ["Business Emails", "Presentations", "Negotiations", "Reports & Proposals", "Networking", "Review & Test"],
        ["Describing Art", "Book Reviews", "Film & Theater", "Music Appreciation", "Creative Writing", "Review & Test"],
        ["Common Idioms", "Proverbs", "Collocations", "Figurative Language", "Phrasal Verbs", "Review & Test"],
        ["Subjunctive Mood", "Reported Speech", "Passive Voice", "Complex Tenses", "Relative Clauses", "Review & Test"],
    ],
}


# ═══════════════════════════════════════════════════════════════
# VOCABULARY PER LANGUAGE, PER LEVEL, PER UNIT
# Each entry: list of (english, target) tuples
# ═══════════════════════════════════════════════════════════════

VOCAB = {

"es": {
"A1": [
  [("Hello","Hola"),("Goodbye","Adi\u00f3s"),("Good morning","Buenos d\u00edas"),("Good evening","Buenas tardes"),("Good night","Buenas noches"),("Please","Por favor"),("Thank you","Gracias"),("Sorry","Lo siento"),("Excuse me","Disculpe"),("Yes","S\u00ed"),("No","No")],
  [("Water","Agua"),("Chicken","Pollo"),("Bread","Pan"),("Apple","Manzana"),("Milk","Leche"),("Coffee","Caf\u00e9"),("Cheese","Queso"),("Rice","Arroz"),("Fish","Pescado"),("Delicious","Delicioso"),("Menu","Men\u00fa")],
  [("Left","Izquierda"),("Right","Derecha"),("Straight","Derecho"),("Bus","Autob\u00fas"),("Train","Tren"),("Ticket","Billete"),("Station","Estaci\u00f3n"),("Hospital","Hospital"),("Bank","Banco"),("Pharmacy","Farmacia"),("Airport","Aeropuerto")],
  [("Breakfast","Desayuno"),("Expensive","Caro"),("Cheap","Barato"),("Red","Rojo"),("Blue","Azul"),("Shirt","Camisa"),("Shoes","Zapatos"),("To pay","Pagar"),("Time","Hora"),("Tomorrow","Ma\u00f1ana"),("Money","Dinero")],
  [("Teacher","Profesor"),("Doctor","Doctor"),("Office","Oficina"),("To read","Leer"),("To cook","Cocinar"),("Soccer","F\u00fatbol"),("Hot","Caliente"),("Cold","Fr\u00edo"),("Summer","Verano"),("Winter","Invierno"),("Friend","Amigo")],
  [("Mother","Madre"),("Father","Padre"),("Sister","Hermana"),("Brother","Hermano"),("Daughter","Hija"),("Son","Hijo"),("Grandmother","Abuela"),("Grandfather","Abuelo"),("Family","Familia"),("Dog","Perro"),("Cat","Gato")],
  [("House","Casa"),("Room","Habitaci\u00f3n"),("Kitchen","Cocina"),("Bathroom","Ba\u00f1o"),("Bedroom","Dormitorio"),("Door","Puerta"),("Window","Ventana"),("Table","Mesa"),("Chair","Silla"),("Bed","Cama"),("Garden","Jard\u00edn")],
  [("Head","Cabeza"),("Hand","Mano"),("Eye","Ojo"),("Stomach","Est\u00f3mago"),("Sick","Enfermo"),("Healthy","Sano"),("Medicine","Medicina"),("Pain","Dolor"),("Fever","Fiebre"),("Arm","Brazo"),("Leg","Pierna")],
],
"A2": [
  [("Uncle","T\u00edo"),("Aunt","T\u00eda"),("Cousin","Primo"),("Nephew","Sobrino"),("Niece","Sobrina"),("Husband","Esposo"),("Wife","Esposa"),("Boyfriend","Novio"),("Girlfriend","Novia"),("Neighbor","Vecino"),("Wedding","Boda"),("Married","Casado")],
  [("Cough","Tos"),("Headache","Dolor de cabeza"),("Allergy","Alergia"),("Prescription","Receta"),("Appointment","Cita"),("Nurse","Enfermera"),("Dentist","Dentista"),("Stress","Estr\u00e9s"),("Tired","Cansado"),("To rest","Descansar"),("Diet","Dieta"),("Exercise","Ejercicio")],
  [("Sofa","Sof\u00e1"),("Shelf","Estante"),("Lamp","L\u00e1mpara"),("Carpet","Alfombra"),("To clean","Limpiar"),("To wash","Lavar"),("To sweep","Barrer"),("To cook","Cocinar"),("Rent","Alquiler"),("To move","Mudarse"),("Apartment","Apartamento"),("Balcony","Balc\u00f3n")],
  [("Happy","Feliz"),("Sad","Triste"),("Angry","Enfadado"),("Worried","Preocupado"),("Excited","Emocionado"),("Shy","T\u00edmido"),("Brave","Valiente"),("Kind","Amable"),("Generous","Generoso"),("Lazy","Perezoso"),("Patient","Paciente"),("Proud","Orgulloso")],
  [("Yesterday","Ayer"),("Last week","La semana pasada"),("I went","Fui"),("I ate","Com\u00ed"),("I saw","Vi"),("I bought","Compr\u00e9"),("I traveled","Viaj\u00e9"),("I studied","Estudi\u00e9"),("I played","Jugu\u00e9"),("I worked","Trabaj\u00e9"),("I spoke","Habl\u00e9"),("I wrote","Escrib\u00ed")],
  [("Tomorrow","Ma\u00f1ana"),("Next week","La pr\u00f3xima semana"),("I will go","Ir\u00e9"),("I will eat","Comer\u00e9"),("I will study","Estudiar\u00e9"),("I will travel","Viajar\u00e9"),("I will work","Trabajar\u00e9"),("Vacation","Vacaciones"),("Goal","Meta"),("Dream","Sue\u00f1o"),("To plan","Planear"),("Appointment","Cita")],
  [("Bigger","M\u00e1s grande"),("Smaller","M\u00e1s peque\u00f1o"),("Better","Mejor"),("Worse","Peor"),("Cheaper","M\u00e1s barato"),("More expensive","M\u00e1s caro"),("Taller","M\u00e1s alto"),("Shorter","M\u00e1s bajo"),("Faster","M\u00e1s r\u00e1pido"),("Slower","M\u00e1s lento"),("The best","El mejor"),("The worst","El peor")],
  [("Holiday","D\u00eda festivo"),("Christmas","Navidad"),("New Year","A\u00f1o Nuevo"),("Birthday","Cumplea\u00f1os"),("Tradition","Tradici\u00f3n"),("Gift","Regalo"),("Party","Fiesta"),("To celebrate","Celebrar"),("Music","M\u00fasica"),("Dance","Baile"),("Festival","Festival"),("Costume","Disfraz")],
],
"B1": [
  [("Opinion","Opini\u00f3n"),("I agree","Estoy de acuerdo"),("I disagree","No estoy de acuerdo"),("I think that","Creo que"),("News","Noticias"),("Society","Sociedad"),("Politics","Pol\u00edtica"),("Economy","Econom\u00eda"),("To argue","Argumentar"),("Debate","Debate"),("Reason","Raz\u00f3n"),("Therefore","Por lo tanto")],
  [("Interview","Entrevista"),("Resume","Curr\u00edculum"),("Meeting","Reuni\u00f3n"),("Presentation","Presentaci\u00f3n"),("Salary","Salario"),("To hire","Contratar"),("To fire","Despedir"),("Colleague","Colega"),("Manager","Gerente"),("Deadline","Fecha l\u00edmite"),("Project","Proyecto"),("Email","Correo electr\u00f3nico")],
  [("To book","Reservar"),("Flight","Vuelo"),("Hotel","Hotel"),("Reservation","Reserva"),("Passport","Pasaporte"),("Luggage","Equipaje"),("Boarding pass","Tarjeta de embarque"),("Delay","Retraso"),("To cancel","Cancelar"),("Adventure","Aventura"),("Tourist","Turista"),("Guide","Gu\u00eda")],
  [("Climate","Clima"),("Pollution","Contaminaci\u00f3n"),("To recycle","Reciclar"),("Forest","Bosque"),("Ocean","Oc\u00e9ano"),("Endangered","En peligro"),("Conservation","Conservaci\u00f3n"),("Energy","Energ\u00eda"),("Solar","Solar"),("Carbon","Carbono"),("Wildlife","Vida silvestre"),("Sustainable","Sostenible")],
  [("Internet","Internet"),("Website","Sitio web"),("App","Aplicaci\u00f3n"),("Password","Contrase\u00f1a"),("To download","Descargar"),("To upload","Subir"),("Screen","Pantalla"),("Keyboard","Teclado"),("Social media","Redes sociales"),("Artificial intelligence","Inteligencia artificial"),("Robot","Robot"),("Data","Datos")],
  [("Once upon a time","\u00c9rase una vez"),("Then","Entonces"),("Suddenly","De repente"),("While","Mientras"),("First","Primero"),("Next","Luego"),("Finally","Finalmente"),("Meanwhile","Mientras tanto"),("Character","Personaje"),("Plot","Trama"),("Beginning","Comienzo"),("Ending","Final")],
  [("If","Si"),("Would","Har\u00eda"),("Could","Podr\u00eda"),("Should","Deber\u00eda"),("I wish","Desear\u00eda"),("Perhaps","Quiz\u00e1s"),("Imagine","Imagina"),("Suppose","Supongamos"),("Instead","En vez de"),("Otherwise","De lo contrario"),("Regret","Arrepentimiento"),("Consequence","Consecuencia")],
  [("Would you mind","Le importar\u00eda"),("Dear Sir","Estimado se\u00f1or"),("Sincerely","Atentamente"),("Regards","Saludos"),("Kind of","Algo as\u00ed"),("Cool","Genial"),("Awesome","Incre\u00edble"),("Whatever","Lo que sea"),("No worries","No te preocupes"),("Dude","T\u00edo"),("Formal","Formal"),("Informal","Informal")],
],
"B2": [
  [("Freedom","Libertad"),("Justice","Justicia"),("Purpose","Prop\u00f3sito"),("Consciousness","Conciencia"),("Ethics","\u00c9tica"),("Morality","Moralidad"),("Existence","Existencia"),("Equality","Igualdad"),("Truth","Verdad"),("Wisdom","Sabidur\u00eda"),("Belief","Creencia"),("Doubt","Duda")],
  [("Argument","Argumento"),("To persuade","Persuadir"),("Evidence","Evidencia"),("Counterargument","Contraargumento"),("However","Sin embargo"),("Nevertheless","No obstante"),("Furthermore","Adem\u00e1s"),("To refute","Refutar"),("Claim","Afirmaci\u00f3n"),("Fallacy","Falacia"),("Rhetoric","Ret\u00f3rica"),("Bias","Sesgo")],
  [("Negotiation","Negociaci\u00f3n"),("Proposal","Propuesta"),("Contract","Contrato"),("To implement","Implementar"),("Strategy","Estrategia"),("Budget","Presupuesto"),("Stakeholder","Parte interesada"),("Agenda","Agenda"),("Minutes","Acta"),("To delegate","Delegar"),("Efficiency","Eficiencia"),("Deadline","Plazo")],
  [("Novel","Novela"),("Poem","Poema"),("Painting","Pintura"),("Sculpture","Escultura"),("Metaphor","Met\u00e1fora"),("Symbolism","Simbolismo"),("Genre","G\u00e9nero"),("Protagonist","Protagonista"),("Plot twist","Giro argumental"),("Review","Rese\u00f1a"),("Masterpiece","Obra maestra"),("Inspiration","Inspiraci\u00f3n")],
  [("To break the ice","Romper el hielo"),("To hit the nail on the head","Dar en el clavo"),("A piece of cake","Pan comido"),("To cost an arm and a leg","Costar un ojo de la cara"),("Better late than never","M\u00e1s vale tarde que nunca"),("To be on cloud nine","Estar en las nubes"),("To pull someones leg","Tomar el pelo"),("Once in a blue moon","De higos a brevas"),("To let the cat out of the bag","Descubrir el pastel"),("To kill two birds with one stone","Matar dos p\u00e1jaros de un tiro"),("The ball is in your court","La pelota est\u00e1 en tu tejado"),("Bite off more than you can chew","Quien mucho abarca poco aprieta")],
  [("Subjunctive","Subjuntivo"),("Reported speech","Estilo indirecto"),("Passive voice","Voz pasiva"),("Conditional","Condicional"),("Gerund","Gerundio"),("Infinitive","Infinitivo"),("Clause","Cl\u00e1usula"),("Conjunction","Conjunci\u00f3n"),("Pronoun","Pronombre"),("Preposition","Preposici\u00f3n"),("Tense","Tiempo verbal"),("Agreement","Concordancia")],
],
},
"fr": {
"A1": [
  [("Hello","Bonjour"),("Goodbye","Au revoir"),("Good morning","Bon matin"),("Good evening","Bonsoir"),("Good night","Bonne nuit"),("Please","S\u0027il vous pla\u00eet"),("Thank you","Merci"),("Sorry","D\u00e9sol\u00e9"),("Excuse me","Excusez-moi"),("Yes","Oui"),("No","Non")],
  [("Water","Eau"),("Chicken","Poulet"),("Bread","Pain"),("Apple","Pomme"),("Milk","Lait"),("Coffee","Caf\u00e9"),("Cheese","Fromage"),("Rice","Riz"),("Fish","Poisson"),("Delicious","D\u00e9licieux"),("Menu","Menu")],
  [("Left","Gauche"),("Right","Droite"),("Straight","Tout droit"),("Bus","Bus"),("Train","Train"),("Ticket","Billet"),("Station","Gare"),("Hospital","H\u00f4pital"),("Bank","Banque"),("Pharmacy","Pharmacie"),("Airport","A\u00e9roport")],
  [("Breakfast","Petit d\u00e9jeuner"),("Expensive","Cher"),("Cheap","Bon march\u00e9"),("Red","Rouge"),("Blue","Bleu"),("Shirt","Chemise"),("Shoes","Chaussures"),("To pay","Payer"),("Time","Heure"),("Tomorrow","Demain"),("Money","Argent")],
  [("Teacher","Professeur"),("Doctor","M\u00e9decin"),("Office","Bureau"),("To read","Lire"),("To cook","Cuisiner"),("Soccer","Football"),("Hot","Chaud"),("Cold","Froid"),("Summer","\u00c9t\u00e9"),("Winter","Hiver"),("Friend","Ami")],
  [("Mother","M\u00e8re"),("Father","P\u00e8re"),("Sister","S\u0153ur"),("Brother","Fr\u00e8re"),("Daughter","Fille"),("Son","Fils"),("Grandmother","Grand-m\u00e8re"),("Grandfather","Grand-p\u00e8re"),("Family","Famille"),("Dog","Chien"),("Cat","Chat")],
  [("House","Maison"),("Room","Chambre"),("Kitchen","Cuisine"),("Bathroom","Salle de bain"),("Bedroom","Chambre \u00e0 coucher"),("Door","Porte"),("Window","Fen\u00eatre"),("Table","Table"),("Chair","Chaise"),("Bed","Lit"),("Garden","Jardin")],
  [("Head","T\u00eate"),("Hand","Main"),("Eye","\u0152il"),("Stomach","Estomac"),("Sick","Malade"),("Healthy","En bonne sant\u00e9"),("Medicine","M\u00e9dicament"),("Pain","Douleur"),("Fever","Fi\u00e8vre"),("Arm","Bras"),("Leg","Jambe")],
],
"A2": [
  [("Uncle","Oncle"),("Aunt","Tante"),("Cousin","Cousin"),("Nephew","Neveu"),("Niece","Ni\u00e8ce"),("Husband","Mari"),("Wife","Femme"),("Boyfriend","Petit ami"),("Girlfriend","Petite amie"),("Neighbor","Voisin"),("Wedding","Mariage"),("Married","Mari\u00e9")],
  [("Cough","Toux"),("Headache","Mal de t\u00eate"),("Allergy","Allergie"),("Prescription","Ordonnance"),("Appointment","Rendez-vous"),("Nurse","Infirmi\u00e8re"),("Dentist","Dentiste"),("Stress","Stress"),("Tired","Fatigu\u00e9"),("To rest","Se reposer"),("Diet","R\u00e9gime"),("Exercise","Exercice")],
  [("Sofa","Canap\u00e9"),("Shelf","\u00c9tag\u00e8re"),("Lamp","Lampe"),("Carpet","Tapis"),("To clean","Nettoyer"),("To wash","Laver"),("To sweep","Balayer"),("To cook","Cuisiner"),("Rent","Loyer"),("To move","D\u00e9m\u00e9nager"),("Apartment","Appartement"),("Balcony","Balcon")],
  [("Happy","Heureux"),("Sad","Triste"),("Angry","En col\u00e8re"),("Worried","Inquiet"),("Excited","Excit\u00e9"),("Shy","Timide"),("Brave","Courageux"),("Kind","Gentil"),("Generous","G\u00e9n\u00e9reux"),("Lazy","Paresseux"),("Patient","Patient"),("Proud","Fier")],
  [("Yesterday","Hier"),("Last week","La semaine derni\u00e8re"),("I went","Je suis all\u00e9"),("I ate","J\u0027ai mang\u00e9"),("I saw","J\u0027ai vu"),("I bought","J\u0027ai achet\u00e9"),("I traveled","J\u0027ai voyag\u00e9"),("I studied","J\u0027ai \u00e9tudi\u00e9"),("I played","J\u0027ai jou\u00e9"),("I worked","J\u0027ai travaill\u00e9"),("I spoke","J\u0027ai parl\u00e9"),("I wrote","J\u0027ai \u00e9crit")],
  [("Tomorrow","Demain"),("Next week","La semaine prochaine"),("I will go","J\u0027irai"),("I will eat","Je mangerai"),("I will study","J\u0027\u00e9tudierai"),("I will travel","Je voyagerai"),("I will work","Je travaillerai"),("Vacation","Vacances"),("Goal","Objectif"),("Dream","R\u00eave"),("To plan","Planifier"),("Appointment","Rendez-vous")],
  [("Bigger","Plus grand"),("Smaller","Plus petit"),("Better","Meilleur"),("Worse","Pire"),("Cheaper","Moins cher"),("More expensive","Plus cher"),("Taller","Plus grand"),("Shorter","Plus petit"),("Faster","Plus rapide"),("Slower","Plus lent"),("The best","Le meilleur"),("The worst","Le pire")],
  [("Holiday","Jour f\u00e9ri\u00e9"),("Christmas","No\u00ebl"),("New Year","Nouvel An"),("Birthday","Anniversaire"),("Tradition","Tradition"),("Gift","Cadeau"),("Party","F\u00eate"),("To celebrate","C\u00e9l\u00e9brer"),("Music","Musique"),("Dance","Danse"),("Festival","Festival"),("Costume","D\u00e9guisement")],
],
"B1": [
  [("Opinion","Opinion"),("I agree","Je suis d\u0027accord"),("I disagree","Je ne suis pas d\u0027accord"),("I think that","Je pense que"),("News","Nouvelles"),("Society","Soci\u00e9t\u00e9"),("Politics","Politique"),("Economy","\u00c9conomie"),("To argue","Argumenter"),("Debate","D\u00e9bat"),("Reason","Raison"),("Therefore","Par cons\u00e9quent")],
  [("Interview","Entretien"),("Resume","CV"),("Meeting","R\u00e9union"),("Presentation","Pr\u00e9sentation"),("Salary","Salaire"),("To hire","Embaucher"),("To fire","Licencier"),("Colleague","Coll\u00e8gue"),("Manager","Directeur"),("Deadline","Date limite"),("Project","Projet"),("Email","Courriel")],
  [("To book","R\u00e9server"),("Flight","Vol"),("Hotel","H\u00f4tel"),("Reservation","R\u00e9servation"),("Passport","Passeport"),("Luggage","Bagages"),("Boarding pass","Carte d\u0027embarquement"),("Delay","Retard"),("To cancel","Annuler"),("Adventure","Aventure"),("Tourist","Touriste"),("Guide","Guide")],
  [("Climate","Climat"),("Pollution","Pollution"),("To recycle","Recycler"),("Forest","For\u00eat"),("Ocean","Oc\u00e9an"),("Endangered","En danger"),("Conservation","Conservation"),("Energy","\u00c9nergie"),("Solar","Solaire"),("Carbon","Carbone"),("Wildlife","Faune sauvage"),("Sustainable","Durable")],
  [("Internet","Internet"),("Website","Site web"),("App","Application"),("Password","Mot de passe"),("To download","T\u00e9l\u00e9charger"),("To upload","T\u00e9l\u00e9verser"),("Screen","\u00c9cran"),("Keyboard","Clavier"),("Social media","R\u00e9seaux sociaux"),("Artificial intelligence","Intelligence artificielle"),("Robot","Robot"),("Data","Donn\u00e9es")],
  [("Once upon a time","Il \u00e9tait une fois"),("Then","Puis"),("Suddenly","Soudain"),("While","Pendant que"),("First","D\u0027abord"),("Next","Ensuite"),("Finally","Enfin"),("Meanwhile","Pendant ce temps"),("Character","Personnage"),("Plot","Intrigue"),("Beginning","D\u00e9but"),("Ending","Fin")],
  [("If","Si"),("Would","Ferait"),("Could","Pourrait"),("Should","Devrait"),("I wish","Je souhaiterais"),("Perhaps","Peut-\u00eatre"),("Imagine","Imagine"),("Suppose","Supposons"),("Instead","Au lieu de"),("Otherwise","Autrement"),("Regret","Regret"),("Consequence","Cons\u00e9quence")],
  [("Would you mind","Cela vous d\u00e9rangerait-il"),("Dear Sir","Cher Monsieur"),("Sincerely","Sinc\u00e8rement"),("Regards","Cordialement"),("Kind of","En quelque sorte"),("Cool","G\u00e9nial"),("Awesome","Super"),("Whatever","Peu importe"),("No worries","Pas de souci"),("Dude","Mec"),("Formal","Formel"),("Informal","Informel")],
],
"B2": [
  [("Freedom","Libert\u00e9"),("Justice","Justice"),("Purpose","But"),("Consciousness","Conscience"),("Ethics","\u00c9thique"),("Morality","Moralit\u00e9"),("Existence","Existence"),("Equality","\u00c9galit\u00e9"),("Truth","V\u00e9rit\u00e9"),("Wisdom","Sagesse"),("Belief","Croyance"),("Doubt","Doute")],
  [("Argument","Argument"),("To persuade","Persuader"),("Evidence","Preuve"),("Counterargument","Contre-argument"),("However","Cependant"),("Nevertheless","N\u00e9anmoins"),("Furthermore","De plus"),("To refute","R\u00e9futer"),("Claim","Affirmation"),("Fallacy","Sophisme"),("Rhetoric","Rh\u00e9torique"),("Bias","Pr\u00e9jug\u00e9")],
  [("Negotiation","N\u00e9gociation"),("Proposal","Proposition"),("Contract","Contrat"),("To implement","Mettre en \u0153uvre"),("Strategy","Strat\u00e9gie"),("Budget","Budget"),("Stakeholder","Partie prenante"),("Agenda","Ordre du jour"),("Minutes","Compte rendu"),("To delegate","D\u00e9l\u00e9guer"),("Efficiency","Efficacit\u00e9"),("Deadline","\u00c9ch\u00e9ance")],
  [("Novel","Roman"),("Poem","Po\u00e8me"),("Painting","Peinture"),("Sculpture","Sculpture"),("Metaphor","M\u00e9taphore"),("Symbolism","Symbolisme"),("Genre","Genre"),("Protagonist","Protagoniste"),("Plot twist","Rebondissement"),("Review","Critique"),("Masterpiece","Chef-d\u0027\u0153uvre"),("Inspiration","Inspiration")],
  [("To break the ice","Briser la glace"),("To hit the nail on the head","Mettre le doigt dessus"),("A piece of cake","C\u0027est du g\u00e2teau"),("To cost an arm and a leg","Co\u00fbter les yeux de la t\u00eate"),("Better late than never","Mieux vaut tard que jamais"),("To be on cloud nine","\u00catre aux anges"),("To pull someones leg","Faire marcher quelqu\u0027un"),("Once in a blue moon","Tous les trente-six du mois"),("To let the cat out of the bag","Vendre la m\u00e8che"),("To kill two birds with one stone","Faire d\u0027une pierre deux coups"),("The ball is in your court","La balle est dans ton camp"),("Bite off more than you can chew","Avoir les yeux plus gros que le ventre")],
  [("Subjunctive","Subjonctif"),("Reported speech","Discours indirect"),("Passive voice","Voix passive"),("Conditional","Conditionnel"),("Gerund","G\u00e9rondif"),("Infinitive","Infinitif"),("Clause","Proposition"),("Conjunction","Conjonction"),("Pronoun","Pronom"),("Preposition","Pr\u00e9position"),("Tense","Temps"),("Agreement","Accord")],
],
},
"de": {
"A1": [
  [("Hello","Hallo"),("Goodbye","Auf Wiedersehen"),("Good morning","Guten Morgen"),("Good evening","Guten Abend"),("Good night","Gute Nacht"),("Please","Bitte"),("Thank you","Danke"),("Sorry","Entschuldigung"),("Excuse me","Entschuldigen Sie"),("Yes","Ja"),("No","Nein")],
  [("Water","Wasser"),("Chicken","H\u00e4hnchen"),("Bread","Brot"),("Apple","Apfel"),("Milk","Milch"),("Coffee","Kaffee"),("Cheese","K\u00e4se"),("Rice","Reis"),("Fish","Fisch"),("Delicious","Lecker"),("Menu","Speisekarte")],
  [("Left","Links"),("Right","Rechts"),("Straight","Geradeaus"),("Bus","Bus"),("Train","Zug"),("Ticket","Fahrkarte"),("Station","Bahnhof"),("Hospital","Krankenhaus"),("Bank","Bank"),("Pharmacy","Apotheke"),("Airport","Flughafen")],
  [("Breakfast","Fr\u00fchst\u00fcck"),("Expensive","Teuer"),("Cheap","Billig"),("Red","Rot"),("Blue","Blau"),("Shirt","Hemd"),("Shoes","Schuhe"),("To pay","Bezahlen"),("Time","Zeit"),("Tomorrow","Morgen"),("Money","Geld")],
  [("Teacher","Lehrer"),("Doctor","Arzt"),("Office","B\u00fcro"),("To read","Lesen"),("To cook","Kochen"),("Soccer","Fu\u00dfball"),("Hot","Hei\u00df"),("Cold","Kalt"),("Summer","Sommer"),("Winter","Winter"),("Friend","Freund")],
  [("Mother","Mutter"),("Father","Vater"),("Sister","Schwester"),("Brother","Bruder"),("Daughter","Tochter"),("Son","Sohn"),("Grandmother","Gro\u00dfmutter"),("Grandfather","Gro\u00dfvater"),("Family","Familie"),("Dog","Hund"),("Cat","Katze")],
  [("House","Haus"),("Room","Zimmer"),("Kitchen","K\u00fcche"),("Bathroom","Badezimmer"),("Bedroom","Schlafzimmer"),("Door","T\u00fcr"),("Window","Fenster"),("Table","Tisch"),("Chair","Stuhl"),("Bed","Bett"),("Garden","Garten")],
  [("Head","Kopf"),("Hand","Hand"),("Eye","Auge"),("Stomach","Magen"),("Sick","Krank"),("Healthy","Gesund"),("Medicine","Medizin"),("Pain","Schmerz"),("Fever","Fieber"),("Arm","Arm"),("Leg","Bein")],
],
"A2": [
  [("Uncle","Onkel"),("Aunt","Tante"),("Cousin","Cousin"),("Nephew","Neffe"),("Niece","Nichte"),("Husband","Ehemann"),("Wife","Ehefrau"),("Boyfriend","Freund"),("Girlfriend","Freundin"),("Neighbor","Nachbar"),("Wedding","Hochzeit"),("Married","Verheiratet")],
  [("Cough","Husten"),("Headache","Kopfschmerzen"),("Allergy","Allergie"),("Prescription","Rezept"),("Appointment","Termin"),("Nurse","Krankenschwester"),("Dentist","Zahnarzt"),("Stress","Stress"),("Tired","M\u00fcde"),("To rest","Sich ausruhen"),("Diet","Di\u00e4t"),("Exercise","\u00dcbung")],
  [("Sofa","Sofa"),("Shelf","Regal"),("Lamp","Lampe"),("Carpet","Teppich"),("To clean","Putzen"),("To wash","Waschen"),("To sweep","Kehren"),("To cook","Kochen"),("Rent","Miete"),("To move","Umziehen"),("Apartment","Wohnung"),("Balcony","Balkon")],
  [("Happy","Gl\u00fccklich"),("Sad","Traurig"),("Angry","W\u00fctend"),("Worried","Besorgt"),("Excited","Aufgeregt"),("Shy","Sch\u00fcchtern"),("Brave","Mutig"),("Kind","Nett"),("Generous","Gro\u00dfz\u00fcgig"),("Lazy","Faul"),("Patient","Geduldig"),("Proud","Stolz")],
  [("Yesterday","Gestern"),("Last week","Letzte Woche"),("I went","Ich bin gegangen"),("I ate","Ich habe gegessen"),("I saw","Ich habe gesehen"),("I bought","Ich habe gekauft"),("I traveled","Ich bin gereist"),("I studied","Ich habe gelernt"),("I played","Ich habe gespielt"),("I worked","Ich habe gearbeitet"),("I spoke","Ich habe gesprochen"),("I wrote","Ich habe geschrieben")],
  [("Tomorrow","Morgen"),("Next week","N\u00e4chste Woche"),("I will go","Ich werde gehen"),("I will eat","Ich werde essen"),("I will study","Ich werde lernen"),("I will travel","Ich werde reisen"),("I will work","Ich werde arbeiten"),("Vacation","Urlaub"),("Goal","Ziel"),("Dream","Traum"),("To plan","Planen"),("Appointment","Termin")],
  [("Bigger","Gr\u00f6\u00dfer"),("Smaller","Kleiner"),("Better","Besser"),("Worse","Schlechter"),("Cheaper","Billiger"),("More expensive","Teurer"),("Taller","Gr\u00f6\u00dfer"),("Shorter","Kleiner"),("Faster","Schneller"),("Slower","Langsamer"),("The best","Der Beste"),("The worst","Der Schlechteste")],
  [("Holiday","Feiertag"),("Christmas","Weihnachten"),("New Year","Neujahr"),("Birthday","Geburtstag"),("Tradition","Tradition"),("Gift","Geschenk"),("Party","Party"),("To celebrate","Feiern"),("Music","Musik"),("Dance","Tanz"),("Festival","Festival"),("Costume","Kost\u00fcm")],
],
"B1": [
  [("Opinion","Meinung"),("I agree","Ich stimme zu"),("I disagree","Ich stimme nicht zu"),("I think that","Ich denke, dass"),("News","Nachrichten"),("Society","Gesellschaft"),("Politics","Politik"),("Economy","Wirtschaft"),("To argue","Argumentieren"),("Debate","Debatte"),("Reason","Grund"),("Therefore","Deshalb")],
  [("Interview","Vorstellungsgespr\u00e4ch"),("Resume","Lebenslauf"),("Meeting","Besprechung"),("Presentation","Pr\u00e4sentation"),("Salary","Gehalt"),("To hire","Einstellen"),("To fire","Entlassen"),("Colleague","Kollege"),("Manager","Manager"),("Deadline","Frist"),("Project","Projekt"),("Email","E-Mail")],
  [("To book","Buchen"),("Flight","Flug"),("Hotel","Hotel"),("Reservation","Reservierung"),("Passport","Reisepass"),("Luggage","Gep\u00e4ck"),("Boarding pass","Bordkarte"),("Delay","Versp\u00e4tung"),("To cancel","Stornieren"),("Adventure","Abenteuer"),("Tourist","Tourist"),("Guide","Reisef\u00fchrer")],
  [("Climate","Klima"),("Pollution","Verschmutzung"),("To recycle","Recyceln"),("Forest","Wald"),("Ocean","Ozean"),("Endangered","Gef\u00e4hrdet"),("Conservation","Naturschutz"),("Energy","Energie"),("Solar","Solar"),("Carbon","Kohlenstoff"),("Wildlife","Tierwelt"),("Sustainable","Nachhaltig")],
  [("Internet","Internet"),("Website","Webseite"),("App","App"),("Password","Passwort"),("To download","Herunterladen"),("To upload","Hochladen"),("Screen","Bildschirm"),("Keyboard","Tastatur"),("Social media","Soziale Medien"),("Artificial intelligence","K\u00fcnstliche Intelligenz"),("Robot","Roboter"),("Data","Daten")],
  [("Once upon a time","Es war einmal"),("Then","Dann"),("Suddenly","Pl\u00f6tzlich"),("While","W\u00e4hrend"),("First","Zuerst"),("Next","Dann"),("Finally","Schlie\u00dflich"),("Meanwhile","Inzwischen"),("Character","Charakter"),("Plot","Handlung"),("Beginning","Anfang"),("Ending","Ende")],
  [("If","Wenn"),("Would","W\u00fcrde"),("Could","K\u00f6nnte"),("Should","Sollte"),("I wish","Ich w\u00fcnschte"),("Perhaps","Vielleicht"),("Imagine","Stell dir vor"),("Suppose","Angenommen"),("Instead","Stattdessen"),("Otherwise","Andernfalls"),("Regret","Bedauern"),("Consequence","Konsequenz")],
  [("Would you mind","W\u00fcrden Sie bitte"),("Dear Sir","Sehr geehrter Herr"),("Sincerely","Mit freundlichen Gr\u00fc\u00dfen"),("Regards","Gr\u00fc\u00dfe"),("Kind of","Irgendwie"),("Cool","Cool"),("Awesome","Toll"),("Whatever","Egal"),("No worries","Kein Problem"),("Dude","Alter"),("Formal","Formell"),("Informal","Informell")],
],
"B2": [
  [("Freedom","Freiheit"),("Justice","Gerechtigkeit"),("Purpose","Zweck"),("Consciousness","Bewusstsein"),("Ethics","Ethik"),("Morality","Moral"),("Existence","Existenz"),("Equality","Gleichheit"),("Truth","Wahrheit"),("Wisdom","Weisheit"),("Belief","Glaube"),("Doubt","Zweifel")],
  [("Argument","Argument"),("To persuade","\u00dcberzeugen"),("Evidence","Beweis"),("Counterargument","Gegenargument"),("However","Jedoch"),("Nevertheless","Dennoch"),("Furthermore","Dar\u00fcber hinaus"),("To refute","Widerlegen"),("Claim","Behauptung"),("Fallacy","Trugschluss"),("Rhetoric","Rhetorik"),("Bias","Voreingenommenheit")],
  [("Negotiation","Verhandlung"),("Proposal","Vorschlag"),("Contract","Vertrag"),("To implement","Umsetzen"),("Strategy","Strategie"),("Budget","Budget"),("Stakeholder","Interessengruppe"),("Agenda","Tagesordnung"),("Minutes","Protokoll"),("To delegate","Delegieren"),("Efficiency","Effizienz"),("Deadline","Frist")],
  [("Novel","Roman"),("Poem","Gedicht"),("Painting","Gem\u00e4lde"),("Sculpture","Skulptur"),("Metaphor","Metapher"),("Symbolism","Symbolik"),("Genre","Genre"),("Protagonist","Protagonist"),("Plot twist","Wendepunkt"),("Review","Rezension"),("Masterpiece","Meisterwerk"),("Inspiration","Inspiration")],
  [("To break the ice","Das Eis brechen"),("To hit the nail on the head","Den Nagel auf den Kopf treffen"),("A piece of cake","Ein Kinderspiel"),("To cost an arm and a leg","Ein Verm\u00f6gen kosten"),("Better late than never","Besser sp\u00e4t als nie"),("To be on cloud nine","Auf Wolke sieben sein"),("To pull someones leg","Jemanden auf den Arm nehmen"),("Once in a blue moon","Alle Jubeljahre"),("To let the cat out of the bag","Die Katze aus dem Sack lassen"),("To kill two birds with one stone","Zwei Fliegen mit einer Klappe schlagen"),("The ball is in your court","Der Ball liegt bei dir"),("Bite off more than you can chew","Sich zu viel vornehmen")],
  [("Subjunctive","Konjunktiv"),("Reported speech","Indirekte Rede"),("Passive voice","Passiv"),("Conditional","Konditional"),("Gerund","Gerundium"),("Infinitive","Infinitiv"),("Clause","Satz"),("Conjunction","Konjunktion"),("Pronoun","Pronomen"),("Preposition","Pr\u00e4position"),("Tense","Zeitform"),("Agreement","Kongruenz")],
],
},
"it": {
"A1": [
  [("Hello","Ciao"),("Goodbye","Arrivederci"),("Good morning","Buongiorno"),("Good evening","Buonasera"),("Good night","Buonanotte"),("Please","Per favore"),("Thank you","Grazie"),("Sorry","Mi dispiace"),("Excuse me","Scusi"),("Yes","S\u00ec"),("No","No")],
  [("Water","Acqua"),("Chicken","Pollo"),("Bread","Pane"),("Apple","Mela"),("Milk","Latte"),("Coffee","Caff\u00e8"),("Cheese","Formaggio"),("Rice","Riso"),("Fish","Pesce"),("Delicious","Delizioso"),("Menu","Menu")],
  [("Left","Sinistra"),("Right","Destra"),("Straight","Dritto"),("Bus","Autobus"),("Train","Treno"),("Ticket","Biglietto"),("Station","Stazione"),("Hospital","Ospedale"),("Bank","Banca"),("Pharmacy","Farmacia"),("Airport","Aeroporto")],
  [("Breakfast","Colazione"),("Expensive","Costoso"),("Cheap","Economico"),("Red","Rosso"),("Blue","Blu"),("Shirt","Camicia"),("Shoes","Scarpe"),("To pay","Pagare"),("Time","Ora"),("Tomorrow","Domani"),("Money","Soldi")],
  [("Teacher","Insegnante"),("Doctor","Dottore"),("Office","Ufficio"),("To read","Leggere"),("To cook","Cucinare"),("Soccer","Calcio"),("Hot","Caldo"),("Cold","Freddo"),("Summer","Estate"),("Winter","Inverno"),("Friend","Amico")],
  [("Mother","Madre"),("Father","Padre"),("Sister","Sorella"),("Brother","Fratello"),("Daughter","Figlia"),("Son","Figlio"),("Grandmother","Nonna"),("Grandfather","Nonno"),("Family","Famiglia"),("Dog","Cane"),("Cat","Gatto")],
  [("House","Casa"),("Room","Stanza"),("Kitchen","Cucina"),("Bathroom","Bagno"),("Bedroom","Camera da letto"),("Door","Porta"),("Window","Finestra"),("Table","Tavolo"),("Chair","Sedia"),("Bed","Letto"),("Garden","Giardino")],
  [("Head","Testa"),("Hand","Mano"),("Eye","Occhio"),("Stomach","Stomaco"),("Sick","Malato"),("Healthy","Sano"),("Medicine","Medicina"),("Pain","Dolore"),("Fever","Febbre"),("Arm","Braccio"),("Leg","Gamba")],
],
"A2": [
  [("Uncle","Zio"),("Aunt","Zia"),("Cousin","Cugino"),("Nephew","Nipote"),("Niece","Nipote"),("Husband","Marito"),("Wife","Moglie"),("Boyfriend","Ragazzo"),("Girlfriend","Ragazza"),("Neighbor","Vicino"),("Wedding","Matrimonio"),("Married","Sposato")],
  [("Cough","Tosse"),("Headache","Mal di testa"),("Allergy","Allergia"),("Prescription","Ricetta"),("Appointment","Appuntamento"),("Nurse","Infermiera"),("Dentist","Dentista"),("Stress","Stress"),("Tired","Stanco"),("To rest","Riposare"),("Diet","Dieta"),("Exercise","Esercizio")],
  [("Sofa","Divano"),("Shelf","Scaffale"),("Lamp","Lampada"),("Carpet","Tappeto"),("To clean","Pulire"),("To wash","Lavare"),("To sweep","Spazzare"),("To cook","Cucinare"),("Rent","Affitto"),("To move","Trasferirsi"),("Apartment","Appartamento"),("Balcony","Balcone")],
  [("Happy","Felice"),("Sad","Triste"),("Angry","Arrabbiato"),("Worried","Preoccupato"),("Excited","Entusiasta"),("Shy","Timido"),("Brave","Coraggioso"),("Kind","Gentile"),("Generous","Generoso"),("Lazy","Pigro"),("Patient","Paziente"),("Proud","Orgoglioso")],
  [("Yesterday","Ieri"),("Last week","La settimana scorsa"),("I went","Sono andato"),("I ate","Ho mangiato"),("I saw","Ho visto"),("I bought","Ho comprato"),("I traveled","Ho viaggiato"),("I studied","Ho studiato"),("I played","Ho giocato"),("I worked","Ho lavorato"),("I spoke","Ho parlato"),("I wrote","Ho scritto")],
  [("Tomorrow","Domani"),("Next week","La prossima settimana"),("I will go","Andr\u00f2"),("I will eat","Manger\u00f2"),("I will study","Studier\u00f2"),("I will travel","Viagger\u00f2"),("I will work","Lavorer\u00f2"),("Vacation","Vacanza"),("Goal","Obiettivo"),("Dream","Sogno"),("To plan","Pianificare"),("Appointment","Appuntamento")],
  [("Bigger","Pi\u00f9 grande"),("Smaller","Pi\u00f9 piccolo"),("Better","Migliore"),("Worse","Peggiore"),("Cheaper","Meno caro"),("More expensive","Pi\u00f9 caro"),("Taller","Pi\u00f9 alto"),("Shorter","Pi\u00f9 basso"),("Faster","Pi\u00f9 veloce"),("Slower","Pi\u00f9 lento"),("The best","Il migliore"),("The worst","Il peggiore")],
  [("Holiday","Festa"),("Christmas","Natale"),("New Year","Capodanno"),("Birthday","Compleanno"),("Tradition","Tradizione"),("Gift","Regalo"),("Party","Festa"),("To celebrate","Festeggiare"),("Music","Musica"),("Dance","Danza"),("Festival","Festival"),("Costume","Costume")],
],
"B1": [
  [("Opinion","Opinione"),("I agree","Sono d\u0027accordo"),("I disagree","Non sono d\u0027accordo"),("I think that","Penso che"),("News","Notizie"),("Society","Societ\u00e0"),("Politics","Politica"),("Economy","Economia"),("To argue","Argomentare"),("Debate","Dibattito"),("Reason","Ragione"),("Therefore","Quindi")],
  [("Interview","Colloquio"),("Resume","Curriculum"),("Meeting","Riunione"),("Presentation","Presentazione"),("Salary","Stipendio"),("To hire","Assumere"),("To fire","Licenziare"),("Colleague","Collega"),("Manager","Direttore"),("Deadline","Scadenza"),("Project","Progetto"),("Email","Email")],
  [("To book","Prenotare"),("Flight","Volo"),("Hotel","Hotel"),("Reservation","Prenotazione"),("Passport","Passaporto"),("Luggage","Bagaglio"),("Boarding pass","Carta d\u0027imbarco"),("Delay","Ritardo"),("To cancel","Cancellare"),("Adventure","Avventura"),("Tourist","Turista"),("Guide","Guida")],
  [("Climate","Clima"),("Pollution","Inquinamento"),("To recycle","Riciclare"),("Forest","Foresta"),("Ocean","Oceano"),("Endangered","In pericolo"),("Conservation","Conservazione"),("Energy","Energia"),("Solar","Solare"),("Carbon","Carbonio"),("Wildlife","Fauna selvatica"),("Sustainable","Sostenibile")],
  [("Internet","Internet"),("Website","Sito web"),("App","Applicazione"),("Password","Password"),("To download","Scaricare"),("To upload","Caricare"),("Screen","Schermo"),("Keyboard","Tastiera"),("Social media","Social media"),("Artificial intelligence","Intelligenza artificiale"),("Robot","Robot"),("Data","Dati")],
  [("Once upon a time","C\u0027era una volta"),("Then","Poi"),("Suddenly","All\u0027improvviso"),("While","Mentre"),("First","Prima"),("Next","Dopo"),("Finally","Infine"),("Meanwhile","Nel frattempo"),("Character","Personaggio"),("Plot","Trama"),("Beginning","Inizio"),("Ending","Fine")],
  [("If","Se"),("Would","Farebbe"),("Could","Potrebbe"),("Should","Dovrebbe"),("I wish","Vorrei"),("Perhaps","Forse"),("Imagine","Immagina"),("Suppose","Supponiamo"),("Instead","Invece"),("Otherwise","Altrimenti"),("Regret","Rimpianto"),("Consequence","Conseguenza")],
  [("Would you mind","Le dispiacerebbe"),("Dear Sir","Gentile Signore"),("Sincerely","Cordialmente"),("Regards","Saluti"),("Kind of","Una specie di"),("Cool","Figo"),("Awesome","Fantastico"),("Whatever","Qualsiasi cosa"),("No worries","Non preoccuparti"),("Dude","Amico"),("Formal","Formale"),("Informal","Informale")],
],
"B2": [
  [("Freedom","Libert\u00e0"),("Justice","Giustizia"),("Purpose","Scopo"),("Consciousness","Coscienza"),("Ethics","Etica"),("Morality","Moralit\u00e0"),("Existence","Esistenza"),("Equality","Uguaglianza"),("Truth","Verit\u00e0"),("Wisdom","Saggezza"),("Belief","Credenza"),("Doubt","Dubbio")],
  [("Argument","Argomento"),("To persuade","Persuadere"),("Evidence","Prova"),("Counterargument","Controargomento"),("However","Tuttavia"),("Nevertheless","Nondimeno"),("Furthermore","Inoltre"),("To refute","Confutare"),("Claim","Affermazione"),("Fallacy","Fallacia"),("Rhetoric","Retorica"),("Bias","Pregiudizio")],
  [("Negotiation","Negoziazione"),("Proposal","Proposta"),("Contract","Contratto"),("To implement","Implementare"),("Strategy","Strategia"),("Budget","Budget"),("Stakeholder","Parte interessata"),("Agenda","Ordine del giorno"),("Minutes","Verbale"),("To delegate","Delegare"),("Efficiency","Efficienza"),("Deadline","Scadenza")],
  [("Novel","Romanzo"),("Poem","Poesia"),("Painting","Dipinto"),("Sculpture","Scultura"),("Metaphor","Metafora"),("Symbolism","Simbolismo"),("Genre","Genere"),("Protagonist","Protagonista"),("Plot twist","Colpo di scena"),("Review","Recensione"),("Masterpiece","Capolavoro"),("Inspiration","Ispirazione")],
  [("To break the ice","Rompere il ghiaccio"),("To hit the nail on the head","Colpire nel segno"),("A piece of cake","Un gioco da ragazzi"),("To cost an arm and a leg","Costare un occhio della testa"),("Better late than never","Meglio tardi che mai"),("To be on cloud nine","Essere al settimo cielo"),("To pull someones leg","Prendere in giro"),("Once in a blue moon","Una volta ogni morte di papa"),("To let the cat out of the bag","Vuotare il sacco"),("To kill two birds with one stone","Prendere due piccioni con una fava"),("The ball is in your court","La palla \u00e8 nel tuo campo"),("Bite off more than you can chew","Fare il passo pi\u00f9 lungo della gamba")],
  [("Subjunctive","Congiuntivo"),("Reported speech","Discorso indiretto"),("Passive voice","Voce passiva"),("Conditional","Condizionale"),("Gerund","Gerundio"),("Infinitive","Infinito"),("Clause","Proposizione"),("Conjunction","Congiunzione"),("Pronoun","Pronome"),("Preposition","Preposizione"),("Tense","Tempo verbale"),("Agreement","Concordanza")],
],
},"pt": {
"A1": [
  [("Hello","Ol\u00e1"),("Goodbye","Adeus"),("Good morning","Bom dia"),("Good evening","Boa tarde"),("Good night","Boa noite"),("Please","Por favor"),("Thank you","Obrigado"),("Sorry","Desculpe"),("Excuse me","Com licen\u00e7a"),("Yes","Sim"),("No","N\u00e3o")],
  [("Water","\u00c1gua"),("Chicken","Frango"),("Bread","P\u00e3o"),("Apple","Ma\u00e7\u00e3"),("Milk","Leite"),("Coffee","Caf\u00e9"),("Cheese","Queijo"),("Rice","Arroz"),("Fish","Peixe"),("Delicious","Delicioso"),("Menu","Card\u00e1pio")],
  [("Left","Esquerda"),("Right","Direita"),("Straight","Em frente"),("Bus","\u00d4nibus"),("Train","Trem"),("Ticket","Passagem"),("Station","Esta\u00e7\u00e3o"),("Hospital","Hospital"),("Bank","Banco"),("Pharmacy","Farm\u00e1cia"),("Airport","Aeroporto")],
  [("Breakfast","Caf\u00e9 da manh\u00e3"),("Expensive","Caro"),("Cheap","Barato"),("Red","Vermelho"),("Blue","Azul"),("Shirt","Camisa"),("Shoes","Sapatos"),("To pay","Pagar"),("Time","Hora"),("Tomorrow","Amanh\u00e3"),("Money","Dinheiro")],
  [("Teacher","Professor"),("Doctor","M\u00e9dico"),("Office","Escrit\u00f3rio"),("To read","Ler"),("To cook","Cozinhar"),("Soccer","Futebol"),("Hot","Quente"),("Cold","Frio"),("Summer","Ver\u00e3o"),("Winter","Inverno"),("Friend","Amigo")],
  [("Mother","M\u00e3e"),("Father","Pai"),("Sister","Irm\u00e3"),("Brother","Irm\u00e3o"),("Daughter","Filha"),("Son","Filho"),("Grandmother","Av\u00f3"),("Grandfather","Av\u00f4"),("Family","Fam\u00edlia"),("Dog","Cachorro"),("Cat","Gato")],
  [("House","Casa"),("Room","Quarto"),("Kitchen","Cozinha"),("Bathroom","Banheiro"),("Bedroom","Quarto de dormir"),("Door","Porta"),("Window","Janela"),("Table","Mesa"),("Chair","Cadeira"),("Bed","Cama"),("Garden","Jardim")],
  [("Head","Cabe\u00e7a"),("Hand","M\u00e3o"),("Eye","Olho"),("Stomach","Est\u00f4mago"),("Sick","Doente"),("Healthy","Saud\u00e1vel"),("Medicine","Rem\u00e9dio"),("Pain","Dor"),("Fever","Febre"),("Arm","Bra\u00e7o"),("Leg","Perna")],
],
"A2": [
  [("Uncle","Tio"),("Aunt","Tia"),("Cousin","Primo"),("Nephew","Sobrinho"),("Niece","Sobrinha"),("Husband","Marido"),("Wife","Esposa"),("Boyfriend","Namorado"),("Girlfriend","Namorada"),("Neighbor","Vizinho"),("Wedding","Casamento"),("Married","Casado")],
  [("Cough","Tosse"),("Headache","Dor de cabe\u00e7a"),("Allergy","Alergia"),("Prescription","Receita"),("Appointment","Consulta"),("Nurse","Enfermeira"),("Dentist","Dentista"),("Stress","Estresse"),("Tired","Cansado"),("To rest","Descansar"),("Diet","Dieta"),("Exercise","Exerc\u00edcio")],
  [("Sofa","Sof\u00e1"),("Shelf","Prateleira"),("Lamp","L\u00e2mpada"),("Carpet","Tapete"),("To clean","Limpar"),("To wash","Lavar"),("To sweep","Varrer"),("To cook","Cozinhar"),("Rent","Aluguel"),("To move","Mudar-se"),("Apartment","Apartamento"),("Balcony","Varanda")],
  [("Happy","Feliz"),("Sad","Triste"),("Angry","Bravo"),("Worried","Preocupado"),("Excited","Animado"),("Shy","T\u00edmido"),("Brave","Corajoso"),("Kind","Gentil"),("Generous","Generoso"),("Lazy","Pregui\u00e7oso"),("Patient","Paciente"),("Proud","Orgulhoso")],
  [("Yesterday","Ontem"),("Last week","Semana passada"),("I went","Eu fui"),("I ate","Eu comi"),("I saw","Eu vi"),("I bought","Eu comprei"),("I traveled","Eu viajei"),("I studied","Eu estudei"),("I played","Eu joguei"),("I worked","Eu trabalhei"),("I spoke","Eu falei"),("I wrote","Eu escrevi")],
  [("Tomorrow","Amanh\u00e3"),("Next week","Pr\u00f3xima semana"),("I will go","Eu irei"),("I will eat","Eu comerei"),("I will study","Eu estudarei"),("I will travel","Eu viajarei"),("I will work","Eu trabalharei"),("Vacation","F\u00e9rias"),("Goal","Meta"),("Dream","Sonho"),("To plan","Planejar"),("Appointment","Consulta")],
  [("Bigger","Maior"),("Smaller","Menor"),("Better","Melhor"),("Worse","Pior"),("Cheaper","Mais barato"),("More expensive","Mais caro"),("Taller","Mais alto"),("Shorter","Mais baixo"),("Faster","Mais r\u00e1pido"),("Slower","Mais lento"),("The best","O melhor"),("The worst","O pior")],
  [("Holiday","Feriado"),("Christmas","Natal"),("New Year","Ano Novo"),("Birthday","Anivers\u00e1rio"),("Tradition","Tradi\u00e7\u00e3o"),("Gift","Presente"),("Party","Festa"),("To celebrate","Celebrar"),("Music","M\u00fasica"),("Dance","Dan\u00e7a"),("Festival","Festival"),("Costume","Fantasia")],
],
"B1": [
  [("Opinion","Opini\u00e3o"),("I agree","Eu concordo"),("I disagree","Eu discordo"),("I think that","Eu acho que"),("News","Not\u00edcias"),("Society","Sociedade"),("Politics","Pol\u00edtica"),("Economy","Economia"),("To argue","Argumentar"),("Debate","Debate"),("Reason","Raz\u00e3o"),("Therefore","Portanto")],
  [("Interview","Entrevista"),("Resume","Curr\u00edculo"),("Meeting","Reuni\u00e3o"),("Presentation","Apresenta\u00e7\u00e3o"),("Salary","Sal\u00e1rio"),("To hire","Contratar"),("To fire","Demitir"),("Colleague","Colega"),("Manager","Gerente"),("Deadline","Prazo"),("Project","Projeto"),("Email","E-mail")],
  [("To book","Reservar"),("Flight","Voo"),("Hotel","Hotel"),("Reservation","Reserva"),("Passport","Passaporte"),("Luggage","Bagagem"),("Boarding pass","Cart\u00e3o de embarque"),("Delay","Atraso"),("To cancel","Cancelar"),("Adventure","Aventura"),("Tourist","Turista"),("Guide","Guia")],
  [("Climate","Clima"),("Pollution","Polui\u00e7\u00e3o"),("To recycle","Reciclar"),("Forest","Floresta"),("Ocean","Oceano"),("Endangered","Em perigo"),("Conservation","Conserva\u00e7\u00e3o"),("Energy","Energia"),("Solar","Solar"),("Carbon","Carbono"),("Wildlife","Vida selvagem"),("Sustainable","Sustent\u00e1vel")],
  [("Internet","Internet"),("Website","Site"),("App","Aplicativo"),("Password","Senha"),("To download","Baixar"),("To upload","Carregar"),("Screen","Tela"),("Keyboard","Teclado"),("Social media","Redes sociais"),("Artificial intelligence","Intelig\u00eancia artificial"),("Robot","Rob\u00f4"),("Data","Dados")],
  [("Once upon a time","Era uma vez"),("Then","Ent\u00e3o"),("Suddenly","De repente"),("While","Enquanto"),("First","Primeiro"),("Next","Depois"),("Finally","Finalmente"),("Meanwhile","Enquanto isso"),("Character","Personagem"),("Plot","Enredo"),("Beginning","Come\u00e7o"),("Ending","Final")],
  [("If","Se"),("Would","Faria"),("Could","Poderia"),("Should","Deveria"),("I wish","Eu gostaria"),("Perhaps","Talvez"),("Imagine","Imagine"),("Suppose","Suponha"),("Instead","Em vez de"),("Otherwise","Caso contr\u00e1rio"),("Regret","Arrependimento"),("Consequence","Consequ\u00eancia")],
  [("Would you mind","Voc\u00ea se importaria"),("Dear Sir","Prezado Senhor"),("Sincerely","Atenciosamente"),("Regards","Cumprimentos"),("Kind of","Mais ou menos"),("Cool","Legal"),("Awesome","Incr\u00edvel"),("Whatever","Tanto faz"),("No worries","Sem problemas"),("Dude","Cara"),("Formal","Formal"),("Informal","Informal")],
],
"B2": [
  [("Freedom","Liberdade"),("Justice","Justi\u00e7a"),("Purpose","Prop\u00f3sito"),("Consciousness","Consci\u00eancia"),("Ethics","\u00c9tica"),("Morality","Moralidade"),("Existence","Exist\u00eancia"),("Equality","Igualdade"),("Truth","Verdade"),("Wisdom","Sabedoria"),("Belief","Cren\u00e7a"),("Doubt","D\u00favida")],
  [("Argument","Argumento"),("To persuade","Persuadir"),("Evidence","Evid\u00eancia"),("Counterargument","Contra-argumento"),("However","No entanto"),("Nevertheless","Todavia"),("Furthermore","Al\u00e9m disso"),("To refute","Refutar"),("Claim","Afirma\u00e7\u00e3o"),("Fallacy","Fal\u00e1cia"),("Rhetoric","Ret\u00f3rica"),("Bias","Vi\u00e9s")],
  [("Negotiation","Negocia\u00e7\u00e3o"),("Proposal","Proposta"),("Contract","Contrato"),("To implement","Implementar"),("Strategy","Estrat\u00e9gia"),("Budget","Or\u00e7amento"),("Stakeholder","Parte interessada"),("Agenda","Pauta"),("Minutes","Ata"),("To delegate","Delegar"),("Efficiency","Efici\u00eancia"),("Deadline","Prazo")],
  [("Novel","Romance"),("Poem","Poema"),("Painting","Pintura"),("Sculpture","Escultura"),("Metaphor","Met\u00e1fora"),("Symbolism","Simbolismo"),("Genre","G\u00eanero"),("Protagonist","Protagonista"),("Plot twist","Reviravolta"),("Review","Resenha"),("Masterpiece","Obra-prima"),("Inspiration","Inspira\u00e7\u00e3o")],
  [("To break the ice","Quebrar o gelo"),("To hit the nail on the head","Acertar em cheio"),("A piece of cake","Moleza"),("To cost an arm and a leg","Custar os olhos da cara"),("Better late than never","Antes tarde do que nunca"),("To be on cloud nine","Estar nas nuvens"),("To pull someones leg","Puxar a perna de algu\u00e9m"),("Once in a blue moon","De vez em quando"),("To let the cat out of the bag","Dar com a l\u00edngua nos dentes"),("To kill two birds with one stone","Matar dois coelhos com uma cajadada"),("The ball is in your court","A bola est\u00e1 com voc\u00ea"),("Bite off more than you can chew","Dar um passo maior que a perna")],
  [("Subjunctive","Subjuntivo"),("Reported speech","Discurso indireto"),("Passive voice","Voz passiva"),("Conditional","Condicional"),("Gerund","Ger\u00fandio"),("Infinitive","Infinitivo"),("Clause","Ora\u00e7\u00e3o"),("Conjunction","Conjun\u00e7\u00e3o"),("Pronoun","Pronome"),("Preposition","Preposi\u00e7\u00e3o"),("Tense","Tempo verbal"),("Agreement","Concord\u00e2ncia")],
],
},
"ja": {
"A1": [
  [("Hello","\u3053\u3093\u306b\u3061\u306f"),("Goodbye","\u3055\u3088\u3046\u306a\u3089"),("Good morning","\u304a\u306f\u3088\u3046\u3054\u3056\u3044\u307e\u3059"),("Good evening","\u3053\u3093\u3070\u3093\u306f"),("Good night","\u304a\u3084\u3059\u307f\u306a\u3055\u3044"),("Please","\u304a\u9858\u3044\u3057\u307e\u3059"),("Thank you","\u3042\u308a\u304c\u3068\u3046\u3054\u3056\u3044\u307e\u3059"),("Sorry","\u3059\u307f\u307e\u305b\u3093"),("Excuse me","\u3059\u307f\u307e\u305b\u3093"),("Yes","\u306f\u3044"),("No","\u3044\u3044\u3048")],
  [("Water","\u6c34"),("Chicken","\u9d8f\u8089"),("Bread","\u30d1\u30f3"),("Apple","\u308a\u3093\u3054"),("Milk","\u725b\u4e73"),("Coffee","\u30b3\u30fc\u30d2\u30fc"),("Cheese","\u30c1\u30fc\u30ba"),("Rice","\u3054\u98ef"),("Fish","\u9b5a"),("Delicious","\u304a\u3044\u3057\u3044"),("Menu","\u30e1\u30cb\u30e5\u30fc")],
  [("Left","\u5de6"),("Right","\u53f3"),("Straight","\u307e\u3063\u3059\u3050"),("Bus","\u30d0\u30b9"),("Train","\u96fb\u8eca"),("Ticket","\u5207\u7b26"),("Station","\u99c5"),("Hospital","\u75c5\u9662"),("Bank","\u9280\u884c"),("Pharmacy","\u85ac\u5c40"),("Airport","\u7a7a\u6e2f")],
  [("Breakfast","\u671d\u3054\u98ef"),("Expensive","\u9ad8\u3044"),("Cheap","\u5b89\u3044"),("Red","\u8d64\u3044"),("Blue","\u9752\u3044"),("Shirt","\u30b7\u30e3\u30c4"),("Shoes","\u9774"),("To pay","\u6255\u3046"),("Time","\u6642\u9593"),("Tomorrow","\u660e\u65e5"),("Money","\u304a\u91d1")],
  [("Teacher","\u5148\u751f"),("Doctor","\u533b\u8005"),("Office","\u4e8b\u52d9\u6240"),("To read","\u8aad\u3080"),("To cook","\u6599\u7406\u3059\u308b"),("Soccer","\u30b5\u30c3\u30ab\u30fc"),("Hot","\u6691\u3044"),("Cold","\u5bd2\u3044"),("Summer","\u590f"),("Winter","\u51ac"),("Friend","\u53cb\u9054")],
  [("Mother","\u6bcd"),("Father","\u7236"),("Sister","\u59c9\u59b9"),("Brother","\u5144\u5f1f"),("Daughter","\u5a18"),("Son","\u606f\u5b50"),("Grandmother","\u304a\u3070\u3042\u3055\u3093"),("Grandfather","\u304a\u3058\u3044\u3055\u3093"),("Family","\u5bb6\u65cf"),("Dog","\u72ac"),("Cat","\u732b")],
  [("House","\u5bb6"),("Room","\u90e8\u5c4b"),("Kitchen","\u53f0\u6240"),("Bathroom","\u304a\u98a8\u5442"),("Bedroom","\u5bdd\u5ba4"),("Door","\u30c9\u30a2"),("Window","\u7a93"),("Table","\u30c6\u30fc\u30d6\u30eb"),("Chair","\u6905\u5b50"),("Bed","\u30d9\u30c3\u30c9"),("Garden","\u5ead")],
  [("Head","\u982d"),("Hand","\u624b"),("Eye","\u76ee"),("Stomach","\u304a\u8179"),("Sick","\u75c5\u6c17"),("Healthy","\u5065\u5eb7"),("Medicine","\u85ac"),("Pain","\u75db\u307f"),("Fever","\u71b1"),("Arm","\u8155"),("Leg","\u8db3")],
],
"A2": [
  [("Uncle","\u304a\u3058\u3055\u3093"),("Aunt","\u304a\u3070\u3055\u3093"),("Cousin","\u3044\u3068\u3053"),("Nephew","\u7525"),("Niece","\u59ea"),("Husband","\u592b"),("Wife","\u59bb"),("Boyfriend","\u5f7c\u6c0f"),("Girlfriend","\u5f7c\u5973"),("Neighbor","\u96a3\u4eba"),("Wedding","\u7d50\u5a5a\u5f0f"),("Married","\u7d50\u5a5a\u3057\u3066\u3044\u308b")],
  [("Cough","\u54b3"),("Headache","\u982d\u75db"),("Allergy","\u30a2\u30ec\u30eb\u30ae\u30fc"),("Prescription","\u51e6\u65b9\u7b8b"),("Appointment","\u4e88\u7d04"),("Nurse","\u770b\u8b77\u5e2b"),("Dentist","\u6b6f\u533b\u8005"),("Stress","\u30b9\u30c8\u30ec\u30b9"),("Tired","\u75b2\u308c\u305f"),("To rest","\u4f11\u3080"),("Diet","\u30c0\u30a4\u30a8\u30c3\u30c8"),("Exercise","\u904b\u52d5")],
  [("Sofa","\u30bd\u30d5\u30a1"),("Shelf","\u68da"),("Lamp","\u30e9\u30f3\u30d7"),("Carpet","\u30ab\u30fc\u30da\u30c3\u30c8"),("To clean","\u6383\u9664\u3059\u308b"),("To wash","\u6d17\u3046"),("To sweep","\u6383\u304f"),("To cook","\u6599\u7406\u3059\u308b"),("Rent","\u5bb6\u8cc3"),("To move","\u5f15\u3063\u8d8a\u3059"),("Apartment","\u30a2\u30d1\u30fc\u30c8"),("Balcony","\u30d0\u30eb\u30b3\u30cb\u30fc")],
  [("Happy","\u5b09\u3057\u3044"),("Sad","\u60b2\u3057\u3044"),("Angry","\u6012\u3063\u3066\u3044\u308b"),("Worried","\u5fc3\u914d"),("Excited","\u30ef\u30af\u30ef\u30af\u3059\u308b"),("Shy","\u6065\u305a\u304b\u3057\u3044"),("Brave","\u52c7\u6562"),("Kind","\u512a\u3057\u3044"),("Generous","\u5bdb\u5927"),("Lazy","\u6020\u3051\u308b"),("Patient","\u5fcd\u8010\u5f37\u3044"),("Proud","\u8a87\u308a\u306b\u601d\u3046")],
  [("Yesterday","\u6628\u65e5"),("Last week","\u5148\u9031"),("I went","\u884c\u304d\u307e\u3057\u305f"),("I ate","\u98df\u3079\u307e\u3057\u305f"),("I saw","\u898b\u307e\u3057\u305f"),("I bought","\u8cb7\u3044\u307e\u3057\u305f"),("I traveled","\u65c5\u884c\u3057\u307e\u3057\u305f"),("I studied","\u52c9\u5f37\u3057\u307e\u3057\u305f"),("I played","\u904a\u3073\u307e\u3057\u305f"),("I worked","\u50cd\u304d\u307e\u3057\u305f"),("I spoke","\u8a71\u3057\u307e\u3057\u305f"),("I wrote","\u66f8\u304d\u307e\u3057\u305f")],
  [("Tomorrow","\u660e\u65e5"),("Next week","\u6765\u9031"),("I will go","\u884c\u304d\u307e\u3059"),("I will eat","\u98df\u3079\u307e\u3059"),("I will study","\u52c9\u5f37\u3057\u307e\u3059"),("I will travel","\u65c5\u884c\u3057\u307e\u3059"),("I will work","\u50cd\u304d\u307e\u3059"),("Vacation","\u4f11\u307f"),("Goal","\u76ee\u6a19"),("Dream","\u5922"),("To plan","\u8a08\u753b\u3059\u308b"),("Appointment","\u4e88\u7d04")],
  [("Bigger","\u3082\u3063\u3068\u5927\u304d\u3044"),("Smaller","\u3082\u3063\u3068\u5c0f\u3055\u3044"),("Better","\u3082\u3063\u3068\u826f\u3044"),("Worse","\u3082\u3063\u3068\u60aa\u3044"),("Cheaper","\u3082\u3063\u3068\u5b89\u3044"),("More expensive","\u3082\u3063\u3068\u9ad8\u3044"),("Taller","\u3082\u3063\u3068\u80cc\u304c\u9ad8\u3044"),("Shorter","\u3082\u3063\u3068\u80cc\u304c\u4f4e\u3044"),("Faster","\u3082\u3063\u3068\u901f\u3044"),("Slower","\u3082\u3063\u3068\u9045\u3044"),("The best","\u4e00\u756a\u826f\u3044"),("The worst","\u4e00\u756a\u60aa\u3044")],
  [("Holiday","\u795d\u65e5"),("Christmas","\u30af\u30ea\u30b9\u30de\u30b9"),("New Year","\u304a\u6b63\u6708"),("Birthday","\u8a95\u751f\u65e5"),("Tradition","\u4f1d\u7d71"),("Gift","\u30d7\u30ec\u30bc\u30f3\u30c8"),("Party","\u30d1\u30fc\u30c6\u30a3\u30fc"),("To celebrate","\u304a\u795d\u3044\u3059\u308b"),("Music","\u97f3\u697d"),("Dance","\u30c0\u30f3\u30b9"),("Festival","\u304a\u796d\u308a"),("Costume","\u30b3\u30b9\u30c1\u30e5\u30fc\u30e0")],
],
"B1": [
  [("Opinion","\u610f\u898b"),("I agree","\u8cdb\u6210\u3067\u3059"),("I disagree","\u53cd\u5bfe\u3067\u3059"),("I think that","\u79c1\u306f\u3053\u3046\u601d\u3044\u307e\u3059"),("News","\u30cb\u30e5\u30fc\u30b9"),("Society","\u793e\u4f1a"),("Politics","\u653f\u6cbb"),("Economy","\u7d4c\u6e08"),("To argue","\u8b70\u8ad6\u3059\u308b"),("Debate","\u8a0e\u8ad6"),("Reason","\u7406\u7531"),("Therefore","\u3057\u305f\u304c\u3063\u3066")],
  [("Interview","\u9762\u63a5"),("Resume","\u5c65\u6b74\u66f8"),("Meeting","\u4f1a\u8b70"),("Presentation","\u30d7\u30ec\u30bc\u30f3"),("Salary","\u7d66\u6599"),("To hire","\u96c7\u3046"),("To fire","\u89e3\u96c7\u3059\u308b"),("Colleague","\u540c\u50da"),("Manager","\u30de\u30cd\u30fc\u30b8\u30e3\u30fc"),("Deadline","\u7de0\u3081\u5207\u308a"),("Project","\u30d7\u30ed\u30b8\u30a7\u30af\u30c8"),("Email","\u30e1\u30fc\u30eb")],
  [("To book","\u4e88\u7d04\u3059\u308b"),("Flight","\u30d5\u30e9\u30a4\u30c8"),("Hotel","\u30db\u30c6\u30eb"),("Reservation","\u4e88\u7d04"),("Passport","\u30d1\u30b9\u30dd\u30fc\u30c8"),("Luggage","\u8377\u7269"),("Boarding pass","\u642d\u4e57\u5238"),("Delay","\u9045\u5ef6"),("To cancel","\u30ad\u30e3\u30f3\u30bb\u30eb\u3059\u308b"),("Adventure","\u5192\u967a"),("Tourist","\u89b3\u5149\u5ba2"),("Guide","\u30ac\u30a4\u30c9")],
  [("Climate","\u6c17\u5019"),("Pollution","\u6c5a\u67d3"),("To recycle","\u30ea\u30b5\u30a4\u30af\u30eb\u3059\u308b"),("Forest","\u68ee"),("Ocean","\u6d77"),("Endangered","\u7d76\u6ec5\u5371\u60e7"),("Conservation","\u4fdd\u5168"),("Energy","\u30a8\u30cd\u30eb\u30ae\u30fc"),("Solar","\u592a\u967d\u306e"),("Carbon","\u70ad\u7d20"),("Wildlife","\u91ce\u751f\u52d5\u7269"),("Sustainable","\u6301\u7d9a\u53ef\u80fd\u306a")],
  [("Internet","\u30a4\u30f3\u30bf\u30fc\u30cd\u30c3\u30c8"),("Website","\u30a6\u30a7\u30d6\u30b5\u30a4\u30c8"),("App","\u30a2\u30d7\u30ea"),("Password","\u30d1\u30b9\u30ef\u30fc\u30c9"),("To download","\u30c0\u30a6\u30f3\u30ed\u30fc\u30c9\u3059\u308b"),("To upload","\u30a2\u30c3\u30d7\u30ed\u30fc\u30c9\u3059\u308b"),("Screen","\u753b\u9762"),("Keyboard","\u30ad\u30fc\u30dc\u30fc\u30c9"),("Social media","SNS"),("Artificial intelligence","\u4eba\u5de5\u77e5\u80fd"),("Robot","\u30ed\u30dc\u30c3\u30c8"),("Data","\u30c7\u30fc\u30bf")],
  [("Once upon a time","\u6614\u3005"),("Then","\u305d\u308c\u304b\u3089"),("Suddenly","\u7a81\u7136"),("While","\u306e\u9593\u306b"),("First","\u307e\u305a"),("Next","\u6b21\u306b"),("Finally","\u6700\u5f8c\u306b"),("Meanwhile","\u305d\u306e\u9593\u306b"),("Character","\u767b\u5834\u4eba\u7269"),("Plot","\u7b4b"),("Beginning","\u59cb\u307e\u308a"),("Ending","\u7d42\u308f\u308a")],
  [("If","\u3082\u3057"),("Would","\u3060\u308d\u3046"),("Could","\u3067\u304d\u308b\u3060\u308d\u3046"),("Should","\u3059\u3079\u304d"),("I wish","\u3057\u305f\u3044"),("Perhaps","\u305f\u3076\u3093"),("Imagine","\u60f3\u50cf\u3057\u3066"),("Suppose","\u4eee\u306b"),("Instead","\u305d\u306e\u4ee3\u308f\u308a\u306b"),("Otherwise","\u305d\u3046\u3067\u306a\u3044\u3068"),("Regret","\u5f8c\u6094"),("Consequence","\u7d50\u679c")],
  [("Would you mind","\u3088\u308d\u3057\u3044\u3067\u3059\u304b"),("Dear Sir","\u62dd\u5553"),("Sincerely","\u656c\u5177"),("Regards","\u3088\u308d\u3057\u304f\u304a\u9858\u3044\u3057\u307e\u3059"),("Kind of","\u3061\u3087\u3063\u3068"),("Cool","\u304b\u3063\u3053\u3044\u3044"),("Awesome","\u3059\u3054\u3044"),("Whatever","\u4f55\u3067\u3082"),("No worries","\u5927\u4e08\u592b"),("Dude","\u304a\u3044"),("Formal","\u4e01\u5be7\u8a9e"),("Informal","\u30bf\u30e1\u53e3")],
],
"B2": [
  [("Freedom","\u81ea\u7531"),("Justice","\u6b63\u7fa9"),("Purpose","\u76ee\u7684"),("Consciousness","\u610f\u8b58"),("Ethics","\u502b\u7406"),("Morality","\u9053\u5fb3"),("Existence","\u5b58\u5728"),("Equality","\u5e73\u7b49"),("Truth","\u771f\u5b9f"),("Wisdom","\u77e5\u6075"),("Belief","\u4fe1\u5ff5"),("Doubt","\u7591\u3044")],
  [("Argument","\u8b70\u8ad6"),("To persuade","\u8aac\u5f97\u3059\u308b"),("Evidence","\u8a3c\u62e0"),("Counterargument","\u53cd\u8ad6"),("However","\u3057\u304b\u3057"),("Nevertheless","\u305d\u308c\u3067\u3082"),("Furthermore","\u3055\u3089\u306b"),("To refute","\u53cd\u99c1\u3059\u308b"),("Claim","\u4e3b\u5f35"),("Fallacy","\u8a24\u5f01"),("Rhetoric","\u4fee\u8f9e\u5b66"),("Bias","\u504f\u898b")],
  [("Negotiation","\u4ea4\u6e09"),("Proposal","\u63d0\u6848"),("Contract","\u5951\u7d04"),("To implement","\u5b9f\u65bd\u3059\u308b"),("Strategy","\u6226\u7565"),("Budget","\u4e88\u7b97"),("Stakeholder","\u5229\u5bb3\u95a2\u4fc2\u8005"),("Agenda","\u8b70\u984c"),("Minutes","\u8b70\u4e8b\u9332"),("To delegate","\u59d4\u4efb\u3059\u308b"),("Efficiency","\u52b9\u7387"),("Deadline","\u7de0\u3081\u5207\u308a")],
  [("Novel","\u5c0f\u8aac"),("Poem","\u8a69"),("Painting","\u7d75\u753b"),("Sculpture","\u5f6b\u523b"),("Metaphor","\u6bd4\u55a9"),("Symbolism","\u8c61\u5fb4\u4e3b\u7fa9"),("Genre","\u30b8\u30e3\u30f3\u30eb"),("Protagonist","\u4e3b\u4eba\u516c"),("Plot twist","\u3069\u3093\u3067\u3093\u8fd4\u3057"),("Review","\u30ec\u30d3\u30e5\u30fc"),("Masterpiece","\u5091\u4f5c"),("Inspiration","\u30a4\u30f3\u30b9\u30d4\u30ec\u30fc\u30b7\u30e7\u30f3")],
  [("To break the ice","\u6c37\u3092\u7834\u308b"),("To hit the nail on the head","\u7684\u3092\u5c04\u308b"),("A piece of cake","\u671d\u98ef\u524d"),("To cost an arm and a leg","\u76ee\u306e\u7389\u304c\u98db\u3073\u51fa\u308b"),("Better late than never","\u9045\u304f\u3066\u3082\u3057\u306a\u3044\u3088\u308a\u307e\u3057"),("To be on cloud nine","\u5929\u306b\u3082\u6607\u308b\u6c17\u6301\u3061"),("To pull someones leg","\u304b\u3089\u304b\u3046"),("Once in a blue moon","\u3081\u3063\u305f\u306b"),("To let the cat out of the bag","\u53e3\u3092\u6ed1\u3089\u3059"),("To kill two birds with one stone","\u4e00\u77f3\u4e8c\u9ce5"),("The ball is in your court","\u3042\u306a\u305f\u6b21\u7b2c"),("Bite off more than you can chew","\u80fd\u529b\u4ee5\u4e0a\u306e\u3053\u3068\u3092\u3059\u308b")],
  [("Subjunctive","\u4eee\u5b9a\u6cd5"),("Reported speech","\u9593\u63a5\u8a71\u6cd5"),("Passive voice","\u53d7\u8eab"),("Conditional","\u6761\u4ef6\u5f62"),("Gerund","\u52d5\u540d\u8a5e"),("Infinitive","\u4e0d\u5b9a\u8a5e"),("Clause","\u7bc0"),("Conjunction","\u63a5\u7d9a\u8a5e"),("Pronoun","\u4ee3\u540d\u8a5e"),("Preposition","\u524d\u7f6e\u8a5e"),("Tense","\u6642\u5236"),("Agreement","\u4e00\u81f4")],
],
},
"ko": {
"A1": [
  [("Hello","\uc548\ub155\ud558\uc138\uc694"),("Goodbye","\uc548\ub155\ud788 \uac00\uc138\uc694"),("Good morning","\uc88b\uc740 \uc544\uce68\uc774\uc5d0\uc694"),("Good evening","\uc88b\uc740 \uc800\ub141\uc774\uc5d0\uc694"),("Good night","\uc798 \uc790\uc694"),("Please","\uc8fc\uc138\uc694"),("Thank you","\uac10\uc0ac\ud569\ub2c8\ub2e4"),("Sorry","\uc8c4\uc1a1\ud569\ub2c8\ub2e4"),("Excuse me","\uc2e4\ub840\ud569\ub2c8\ub2e4"),("Yes","\ub124"),("No","\uc544\ub2c8\uc694")],
  [("Water","\ubb3c"),("Chicken","\ub2ed\uace0\uae30"),("Bread","\ube75"),("Apple","\uc0ac\uacfc"),("Milk","\uc6b0\uc720"),("Coffee","\ucee4\ud53c"),("Cheese","\uce58\uc988"),("Rice","\ubc25"),("Fish","\uc0dd\uc120"),("Delicious","\ub9db\uc788\uc5b4\uc694"),("Menu","\uba54\ub274")],
  [("Left","\uc67c\ucabd"),("Right","\uc624\ub978\ucabd"),("Straight","\uc9c1\uc9c4"),("Bus","\ubc84\uc2a4"),("Train","\uae30\ucc28"),("Ticket","\ud45c"),("Station","\uc5ed"),("Hospital","\ubcd1\uc6d0"),("Bank","\uc740\ud589"),("Pharmacy","\uc57d\uad6d"),("Airport","\uacf5\ud56d")],
  [("Breakfast","\uc544\uce68 \uc2dd\uc0ac"),("Expensive","\ube44\uc2f8\uc694"),("Cheap","\uc2f8\uc694"),("Red","\ube68\uac04\uc0c9"),("Blue","\ud30c\ub780\uc0c9"),("Shirt","\uc154\uce20"),("Shoes","\uc2e0\ubc1c"),("To pay","\uacc4\uc0b0\ud558\ub2e4"),("Time","\uc2dc\uac04"),("Tomorrow","\ub0b4\uc77c"),("Money","\ub3c8")],
  [("Teacher","\uc120\uc0dd\ub2d8"),("Doctor","\uc758\uc0ac"),("Office","\uc0ac\ubb34\uc2e4"),("To read","\uc77d\ub2e4"),("To cook","\uc694\ub9ac\ud558\ub2e4"),("Soccer","\ucd95\uad6c"),("Hot","\ub354\uc6cc\uc694"),("Cold","\ucd94\uc6cc\uc694"),("Summer","\uc5ec\ub984"),("Winter","\uaca8\uc6b8"),("Friend","\uce5c\uad6c")],
  [("Mother","\uc5b4\uba38\ub2c8"),("Father","\uc544\ubc84\uc9c0"),("Sister","\uc5b8\ub2c8"),("Brother","\ud615"),("Daughter","\ub538"),("Son","\uc544\ub4e4"),("Grandmother","\ud560\uba38\ub2c8"),("Grandfather","\ud560\uc544\ubc84\uc9c0"),("Family","\uac00\uc871"),("Dog","\uac1c"),("Cat","\uace0\uc591\uc774")],
  [("House","\uc9d1"),("Room","\ubc29"),("Kitchen","\ubd80\uc5cc"),("Bathroom","\ud654\uc7a5\uc2e4"),("Bedroom","\uce68\uc2e4"),("Door","\ubb38"),("Window","\ucc3d\ubb38"),("Table","\ud14c\uc774\ube14"),("Chair","\uc758\uc790"),("Bed","\uce68\ub300"),("Garden","\uc815\uc6d0")],
  [("Head","\uba38\ub9ac"),("Hand","\uc190"),("Eye","\ub208"),("Stomach","\ubc30"),("Sick","\uc544\ud504\ub2e4"),("Healthy","\uac74\uac15\ud55c"),("Medicine","\uc57d"),("Pain","\ud1b5\uc99d"),("Fever","\uc5f4"),("Arm","\ud314"),("Leg","\ub2e4\ub9ac")],
],
"A2": [
  [("Uncle","\uc0bc\ucd0c"),("Aunt","\uc774\ubaa8"),("Cousin","\uc0ac\ucd0c"),("Nephew","\uc870\uce74"),("Niece","\uc870\uce74\ub538"),("Husband","\ub0a8\ud3b8"),("Wife","\uc544\ub0b4"),("Boyfriend","\ub0a8\uc790\uce5c\uad6c"),("Girlfriend","\uc5ec\uc790\uce5c\uad6c"),("Neighbor","\uc774\uc6c3"),("Wedding","\uacb0\ud63c\uc2dd"),("Married","\uacb0\ud63c\ud55c")],
  [("Cough","\uae30\uce68"),("Headache","\ub450\ud1b5"),("Allergy","\uc54c\ub808\ub974\uae30"),("Prescription","\ucc98\ubc29\uc804"),("Appointment","\uc608\uc57d"),("Nurse","\uac04\ud638\uc0ac"),("Dentist","\uce58\uacfc\uc758\uc0ac"),("Stress","\uc2a4\ud2b8\ub808\uc2a4"),("Tired","\ud53c\uace4\ud55c"),("To rest","\uc26c\ub2e4"),("Diet","\ub2e4\uc774\uc5b4\ud2b8"),("Exercise","\uc6b4\ub3d9")],
  [("Sofa","\uc18c\ud30c"),("Shelf","\uc120\ubc18"),("Lamp","\ub7a8\ud504"),("Carpet","\uce74\ud3ab"),("To clean","\uccad\uc18c\ud558\ub2e4"),("To wash","\uc528\ub2e4"),("To sweep","\uc4f8\ub2e4"),("To cook","\uc694\ub9ac\ud558\ub2e4"),("Rent","\uc6d4\uc138"),("To move","\uc774\uc0ac\ud558\ub2e4"),("Apartment","\uc544\ud30c\ud2b8"),("Balcony","\ubc1c\ucf54\ub2c8")],
  [("Happy","\ud589\ubcf5\ud55c"),("Sad","\uc2ac\ud508"),("Angry","\ud654\ub09c"),("Worried","\uac71\uc815\ub418\ub294"),("Excited","\uc2e0\ub098\ub294"),("Shy","\ubd80\ub044\ub7ec\uc6b4"),("Brave","\uc6a9\uac10\ud55c"),("Kind","\uce5c\uc808\ud55c"),("Generous","\ub108\uadf8\ub7ec\uc6b4"),("Lazy","\uac8c\uc73c\ub978"),("Patient","\uc778\ub0b4\uc2ec \uc788\ub294"),("Proud","\uc790\ub791\uc2a4\ub7ec\uc6b4")],
  [("Yesterday","\uc5b4\uc81c"),("Last week","\uc9c0\ub09c\uc8fc"),("I went","\uac14\uc5b4\uc694"),("I ate","\uba39\uc5c8\uc5b4\uc694"),("I saw","\ubd24\uc5b4\uc694"),("I bought","\uc0c0\uc5b4\uc694"),("I traveled","\uc5ec\ud589\ud588\uc5b4\uc694"),("I studied","\uacf5\ubd80\ud588\uc5b4\uc694"),("I played","\ub180\uc558\uc5b4\uc694"),("I worked","\uc77c\ud588\uc5b4\uc694"),("I spoke","\ub9d0\ud588\uc5b4\uc694"),("I wrote","\uc37c\uc5b4\uc694")],
  [("Tomorrow","\ub0b4\uc77c"),("Next week","\ub2e4\uc74c \uc8fc"),("I will go","\uac08 \uac70\uc608\uc694"),("I will eat","\uba39\uc744 \uac70\uc608\uc694"),("I will study","\uacf5\ubd80\ud560 \uac70\uc608\uc694"),("I will travel","\uc5ec\ud589\ud560 \uac70\uc608\uc694"),("I will work","\uc77c\ud560 \uac70\uc608\uc694"),("Vacation","\ud734\uac00"),("Goal","\ubaa9\ud45c"),("Dream","\uafc8"),("To plan","\uacc4\ud68d\ud558\ub2e4"),("Appointment","\uc608\uc57d")],
  [("Bigger","\ub354 \ud070"),("Smaller","\ub354 \uc791\uc740"),("Better","\ub354 \uc88b\uc740"),("Worse","\ub354 \ub098\uc05c"),("Cheaper","\ub354 \uc2f8\ub2e4"),("More expensive","\ub354 \ube44\uc2f8\ub2e4"),("Taller","\ub354 \ud0a4\uac00 \ud06c\ub2e4"),("Shorter","\ub354 \ud0a4\uac00 \uc791\ub2e4"),("Faster","\ub354 \ube60\ub978"),("Slower","\ub354 \ub290\ub9b0"),("The best","\uac00\uc7a5 \uc88b\uc740"),("The worst","\uac00\uc7a5 \ub098\uc05c")],
  [("Holiday","\uacf5\ud734\uc77c"),("Christmas","\ud06c\ub9ac\uc2a4\ub9c8\uc2a4"),("New Year","\uc0c8\ud574"),("Birthday","\uc0dd\uc77c"),("Tradition","\uc804\ud1b5"),("Gift","\uc120\ubb3c"),("Party","\ud30c\ud2f0"),("To celebrate","\ucd95\ud558\ud558\ub2e4"),("Music","\uc74c\uc545"),("Dance","\ucda4"),("Festival","\ucd95\uc81c"),("Costume","\uc758\uc0c1")],
],
"B1": [
  [("Opinion","\uc758\uacac"),("I agree","\ub3d9\uc758\ud569\ub2c8\ub2e4"),("I disagree","\ub3d9\uc758\ud558\uc9c0 \uc54a\uc2b5\ub2c8\ub2e4"),("I think that","\uc800\ub294 \uc0dd\uac01\ud569\ub2c8\ub2e4"),("News","\ub274\uc2a4"),("Society","\uc0ac\ud68c"),("Politics","\uc815\uce58"),("Economy","\uacbd\uc81c"),("To argue","\ub17c\uc7c1\ud558\ub2e4"),("Debate","\ud1a0\ub860"),("Reason","\uc774\uc720"),("Therefore","\uadf8\ub7ec\ubbc0\ub85c")],
  [("Interview","\uba74\uc811"),("Resume","\uc774\ub825\uc11c"),("Meeting","\ud68c\uc758"),("Presentation","\ud504\ub808\uc820\ud14c\uc774\uc158"),("Salary","\uae09\uc5ec"),("To hire","\uace0\uc6a9\ud558\ub2e4"),("To fire","\ud574\uace0\ud558\ub2e4"),("Colleague","\ub3d9\ub8cc"),("Manager","\ub9e4\ub2c8\uc800"),("Deadline","\ub9c8\uac10\uc77c"),("Project","\ud504\ub85c\uc81d\ud2b8"),("Email","\uc774\uba54\uc77c")],
  [("To book","\uc608\uc57d\ud558\ub2e4"),("Flight","\ud56d\uacf5\ud3b8"),("Hotel","\ud638\ud154"),("Reservation","\uc608\uc57d"),("Passport","\uc5ec\uad8c"),("Luggage","\uc9d0"),("Boarding pass","\ud0d1\uc2b9\uad8c"),("Delay","\uc9c0\uc5f0"),("To cancel","\ucde8\uc18c\ud558\ub2e4"),("Adventure","\ubaa8\ud5d8"),("Tourist","\uad00\uad11\uac1d"),("Guide","\uac00\uc774\ub4dc")],
  [("Climate","\uae30\ud6c4"),("Pollution","\uc624\uc5fc"),("To recycle","\uc7ac\ud65c\uc6a9\ud558\ub2e4"),("Forest","\uc232"),("Ocean","\ubc14\ub2e4"),("Endangered","\uba78\uc885\uc704\uae30"),("Conservation","\ubcf4\uc804"),("Energy","\uc5d0\ub108\uc9c0"),("Solar","\ud0dc\uc591\uc758"),("Carbon","\ud0c4\uc18c"),("Wildlife","\uc57c\uc0dd\ub3d9\ubb3c"),("Sustainable","\uc9c0\uc18d\uac00\ub2a5\ud55c")],
  [("Internet","\uc778\ud130\ub137"),("Website","\uc6f9\uc0ac\uc774\ud2b8"),("App","\uc571"),("Password","\ube44\ubc00\ubc88\ud638"),("To download","\ub2e4\uc6b4\ub85c\ub4dc\ud558\ub2e4"),("To upload","\uc5c5\ub85c\ub4dc\ud558\ub2e4"),("Screen","\ud654\uba74"),("Keyboard","\ud0a4\ubcf4\ub4dc"),("Social media","SNS"),("Artificial intelligence","\uc778\uacf5\uc9c0\ub2a5"),("Robot","\ub85c\ubd07"),("Data","\ub370\uc774\ud130")],
  [("Once upon a time","\uc61b\ub0a0\uc5d0"),("Then","\uadf8\ub7ec\uace0 \ub098\uc11c"),("Suddenly","\uac11\uc790\uae30"),("While","\ud558\ub294 \ub3d9\uc548"),("First","\uba3c\uc800"),("Next","\ub2e4\uc74c\uc5d0"),("Finally","\ub9c8\uce68\ub0b4"),("Meanwhile","\uadf8 \uc0ac\uc774\uc5d0"),("Character","\ub4f1\uc7a5\uc778\ubb3c"),("Plot","\uc904\uac70\ub9ac"),("Beginning","\uc2dc\uc791"),("Ending","\ub05d")],
  [("If","\ub9cc\uc57d"),("Would","\ud560 \uac83\uc774\ub2e4"),("Could","\ud560 \uc218 \uc788\ub2e4"),("Should","\ud574\uc57c \ud55c\ub2e4"),("I wish","\ubc14\ub780\ub2e4"),("Perhaps","\uc544\ub9c8"),("Imagine","\uc0c1\uc0c1\ud558\ub2e4"),("Suppose","\uac00\uc815\ud558\ub2e4"),("Instead","\ub300\uc2e0\uc5d0"),("Otherwise","\uadf8\ub807\uc9c0 \uc54a\uc73c\uba74"),("Regret","\ud6c4\ud68c"),("Consequence","\uacb0\uacfc")],
  [("Would you mind","\uad1c\ucc2e\uc73c\uc2dc\uaca0\uc2b5\ub2c8\uae4c"),("Dear Sir","\uc874\uacbd\ud558\ub294"),("Sincerely","\uc9c4\uc2ec\uc73c\ub85c"),("Regards","\uc548\ubd80 \uc804\ud574\uc8fc\uc138\uc694"),("Kind of","\uc57d\uac04"),("Cool","\uba4b\uc838\uc694"),("Awesome","\ub300\ubc15"),("Whatever","\uc0c1\uad00\uc5c6\uc5b4"),("No worries","\uac71\uc815\ub9c8"),("Dude","\uc57c"),("Formal","\uacf5\uc2dd\uc801"),("Informal","\ube44\uacf5\uc2dd\uc801")],
],
"B2": [
  [("Freedom","\uc790\uc720"),("Justice","\uc815\uc758"),("Purpose","\ubaa9\uc801"),("Consciousness","\uc758\uc2dd"),("Ethics","\uc724\ub9ac"),("Morality","\ub3c4\ub355"),("Existence","\uc874\uc7ac"),("Equality","\ud3c9\ub4f1"),("Truth","\uc9c4\uc2e4"),("Wisdom","\uc9c0\ud61c"),("Belief","\uc2e0\ub150"),("Doubt","\uc758\uc2ec")],
  [("Argument","\ub17c\uc7c1"),("To persuade","\uc124\ub4dd\ud558\ub2e4"),("Evidence","\uc99d\uac70"),("Counterargument","\ubc18\ub860"),("However","\uadf8\ub7ec\ub098"),("Nevertheless","\uadf8\ub7fc\uc5d0\ub3c4 \ubd88\uad6c\ud558\uace0"),("Furthermore","\ub354\uc6b1\uc774"),("To refute","\ubc18\ubc15\ud558\ub2e4"),("Claim","\uc8fc\uc7a5"),("Fallacy","\uc624\ub958"),("Rhetoric","\uc218\uc0ac\ud559"),("Bias","\ud3b8\uacac")],
  [("Negotiation","\ud611\uc0c1"),("Proposal","\uc81c\uc548"),("Contract","\uacc4\uc57d"),("To implement","\uc2e4\ud589\ud558\ub2e4"),("Strategy","\uc804\ub7b5"),("Budget","\uc608\uc0b0"),("Stakeholder","\uc774\ud574\uad00\uacc4\uc790"),("Agenda","\uc548\uac74"),("Minutes","\ud68c\uc758\ub85d"),("To delegate","\uc704\uc784\ud558\ub2e4"),("Efficiency","\ud6a8\uc728"),("Deadline","\ub9c8\uac10\uc77c")],
  [("Novel","\uc18c\uc124"),("Poem","\uc2dc"),("Painting","\uadf8\ub9bc"),("Sculpture","\uc870\uac01"),("Metaphor","\uc740\uc720"),("Symbolism","\uc0c1\uc9d5\uc8fc\uc758"),("Genre","\uc7a5\ub974"),("Protagonist","\uc8fc\uc778\uacf5"),("Plot twist","\ubc18\uc804"),("Review","\ub9ac\ubdf0"),("Masterpiece","\uac78\uc791"),("Inspiration","\uc601\uac10")],
  [("To break the ice","\uc5bc\uc74c\uc744 \uae68\ub2e4"),("To hit the nail on the head","\uc815\uacf1\uc744 \ucc0c\ub974\ub2e4"),("A piece of cake","\uc2dd\uc740 \uc8c4 \uba39\uae30"),("To cost an arm and a leg","\ub208\uc774 \ud718\ub465\uadf8\ub808\uc9c0\ub2e4"),("Better late than never","\ub2a6\uc5b4\ub3c4 \uc548 \ud558\ub294 \uac83\ubcf4\ub2e4 \ub0ab\ub2e4"),("To be on cloud nine","\uad6c\ub984 \uc704\uc5d0 \ub5a0\uc788\ub2e4"),("To pull someones leg","\ub204\uad70\uac00\ub97c \ub180\ub9ac\ub2e4"),("Once in a blue moon","\uac00\ubb3c\uc5d0"),("To let the cat out of the bag","\ube44\ubc00\uc744 \ub204\uc124\ud558\ub2e4"),("To kill two birds with one stone","\uc77c\uc11d\uc774\uc870"),("The ball is in your court","\uacf5\uc740 \ub2f9\uc2e0\uc5d0\uac8c \uc788\ub2e4"),("Bite off more than you can chew","\uac10\ub2f9\ud560 \uc218 \uc5c6\ub294 \uc77c\uc744 \ud558\ub2e4")],
  [("Subjunctive","\uac00\uc815\ubc95"),("Reported speech","\uac04\uc811\ud654\ubc95"),("Passive voice","\ud53c\ub3d9\ud0dc"),("Conditional","\uc870\uac74\ud615"),("Gerund","\ub3d9\uba85\uc0ac"),("Infinitive","\ubd80\uc815\uc0ac"),("Clause","\uc808"),("Conjunction","\uc811\uc18d\uc0ac"),("Pronoun","\ub300\uba85\uc0ac"),("Preposition","\uc804\uce58\uc0ac"),("Tense","\uc2dc\uc81c"),("Agreement","\uc77c\uce58")],
],
},
"zh": {
"A1": [
  [("Hello","\u4f60\u597d"),("Goodbye","\u518d\u89c1"),("Good morning","\u65e9\u4e0a\u597d"),("Good evening","\u665a\u4e0a\u597d"),("Good night","\u665a\u5b89"),("Please","\u8bf7"),("Thank you","\u8c22\u8c22"),("Sorry","\u5bf9\u4e0d\u8d77"),("Excuse me","\u4e0d\u597d\u610f\u601d"),("Yes","\u662f"),("No","\u4e0d\u662f")],
  [("Water","\u6c34"),("Chicken","\u9e21\u8089"),("Bread","\u9762\u5305"),("Apple","\u82f9\u679c"),("Milk","\u725b\u5976"),("Coffee","\u5496\u5561"),("Cheese","\u5976\u916a"),("Rice","\u7c73\u996d"),("Fish","\u9c7c"),("Delicious","\u597d\u5403"),("Menu","\u83dc\u5355")],
  [("Left","\u5de6"),("Right","\u53f3"),("Straight","\u76f4\u8d70"),("Bus","\u516c\u5171\u6c7d\u8f66"),("Train","\u706b\u8f66"),("Ticket","\u7968"),("Station","\u8f66\u7ad9"),("Hospital","\u533b\u9662"),("Bank","\u94f6\u884c"),("Pharmacy","\u836f\u5e97"),("Airport","\u673a\u573a")],
  [("Breakfast","\u65e9\u9910"),("Expensive","\u8d35"),("Cheap","\u4fbf\u5b9c"),("Red","\u7ea2\u8272"),("Blue","\u84dd\u8272"),("Shirt","\u886c\u886b"),("Shoes","\u978b\u5b50"),("To pay","\u4ed8\u94b1"),("Time","\u65f6\u95f4"),("Tomorrow","\u660e\u5929"),("Money","\u94b1")],
  [("Teacher","\u8001\u5e08"),("Doctor","\u533b\u751f"),("Office","\u529e\u516c\u5ba4"),("To read","\u8bfb\u4e66"),("To cook","\u505a\u996d"),("Soccer","\u8db3\u7403"),("Hot","\u70ed"),("Cold","\u51b7"),("Summer","\u590f\u5929"),("Winter","\u51ac\u5929"),("Friend","\u670b\u53cb")],
  [("Mother","\u5988\u5988"),("Father","\u7238\u7238"),("Sister","\u59d0\u59b9"),("Brother","\u5144\u5f1f"),("Daughter","\u5973\u513f"),("Son","\u513f\u5b50"),("Grandmother","\u5976\u5976"),("Grandfather","\u7237\u7237"),("Family","\u5bb6\u5ead"),("Dog","\u72d7"),("Cat","\u732b")],
  [("House","\u623f\u5b50"),("Room","\u623f\u95f4"),("Kitchen","\u53a8\u623f"),("Bathroom","\u6d17\u624b\u95f4"),("Bedroom","\u5367\u5ba4"),("Door","\u95e8"),("Window","\u7a97\u6237"),("Table","\u684c\u5b50"),("Chair","\u6905\u5b50"),("Bed","\u5e8a"),("Garden","\u82b1\u56ed")],
  [("Head","\u5934"),("Hand","\u624b"),("Eye","\u773c\u775b"),("Stomach","\u80c3"),("Sick","\u751f\u75c5"),("Healthy","\u5065\u5eb7"),("Medicine","\u836f"),("Pain","\u75bc\u75db"),("Fever","\u53d1\u70e7"),("Arm","\u80f3\u818a"),("Leg","\u817f")],
],
"A2": [
  [("Uncle","\u53d4\u53d4"),("Aunt","\u963f\u59e8"),("Cousin","\u8868\u5144\u5f1f"),("Nephew","\u4f84\u5b50"),("Niece","\u4f84\u5973"),("Husband","\u4e08\u592b"),("Wife","\u59bb\u5b50"),("Boyfriend","\u7537\u670b\u53cb"),("Girlfriend","\u5973\u670b\u53cb"),("Neighbor","\u90bb\u5c45"),("Wedding","\u5a5a\u793c"),("Married","\u7ed3\u5a5a\u4e86")],
  [("Cough","\u54b3\u55fd"),("Headache","\u5934\u75bc"),("Allergy","\u8fc7\u654f"),("Prescription","\u5904\u65b9"),("Appointment","\u9884\u7ea6"),("Nurse","\u62a4\u58eb"),("Dentist","\u7259\u533b"),("Stress","\u538b\u529b"),("Tired","\u7d2f"),("To rest","\u4f11\u606f"),("Diet","\u996e\u98df"),("Exercise","\u8fd0\u52a8")],
  [("Sofa","\u6c99\u53d1"),("Shelf","\u4e66\u67b6"),("Lamp","\u706f"),("Carpet","\u5730\u6bef"),("To clean","\u6253\u626b"),("To wash","\u6d17"),("To sweep","\u626b"),("To cook","\u505a\u996d"),("Rent","\u79df\u91d1"),("To move","\u642c\u5bb6"),("Apartment","\u516c\u5bd3"),("Balcony","\u9633\u53f0")],
  [("Happy","\u5feb\u4e50"),("Sad","\u4f24\u5fc3"),("Angry","\u751f\u6c14"),("Worried","\u62c5\u5fc3"),("Excited","\u5174\u594b"),("Shy","\u5bb3\u7f9e"),("Brave","\u52c7\u6562"),("Kind","\u5584\u826f"),("Generous","\u6170\u6982"),("Lazy","\u61d2"),("Patient","\u6709\u8010\u5fc3"),("Proud","\u81ea\u8c6a")],
  [("Yesterday","\u6628\u5929"),("Last week","\u4e0a\u5468"),("I went","\u6211\u53bb\u4e86"),("I ate","\u6211\u5403\u4e86"),("I saw","\u6211\u770b\u4e86"),("I bought","\u6211\u4e70\u4e86"),("I traveled","\u6211\u65c5\u884c\u4e86"),("I studied","\u6211\u5b66\u4e60\u4e86"),("I played","\u6211\u73a9\u4e86"),("I worked","\u6211\u5de5\u4f5c\u4e86"),("I spoke","\u6211\u8bf4\u4e86"),("I wrote","\u6211\u5199\u4e86")],
  [("Tomorrow","\u660e\u5929"),("Next week","\u4e0b\u5468"),("I will go","\u6211\u4f1a\u53bb"),("I will eat","\u6211\u4f1a\u5403"),("I will study","\u6211\u4f1a\u5b66\u4e60"),("I will travel","\u6211\u4f1a\u65c5\u884c"),("I will work","\u6211\u4f1a\u5de5\u4f5c"),("Vacation","\u5047\u671f"),("Goal","\u76ee\u6807"),("Dream","\u68a6\u60f3"),("To plan","\u8ba1\u5212"),("Appointment","\u9884\u7ea6")],
  [("Bigger","\u66f4\u5927"),("Smaller","\u66f4\u5c0f"),("Better","\u66f4\u597d"),("Worse","\u66f4\u5dee"),("Cheaper","\u66f4\u4fbf\u5b9c"),("More expensive","\u66f4\u8d35"),("Taller","\u66f4\u9ad8"),("Shorter","\u66f4\u77ee"),("Faster","\u66f4\u5feb"),("Slower","\u66f4\u6162"),("The best","\u6700\u597d"),("The worst","\u6700\u5dee")],
  [("Holiday","\u8282\u65e5"),("Christmas","\u5723\u8bde\u8282"),("New Year","\u65b0\u5e74"),("Birthday","\u751f\u65e5"),("Tradition","\u4f20\u7edf"),("Gift","\u793c\u7269"),("Party","\u6d3e\u5bf9"),("To celebrate","\u5e86\u795d"),("Music","\u97f3\u4e50"),("Dance","\u8df3\u821e"),("Festival","\u8282\u65e5"),("Costume","\u670d\u88c5")],
],
"B1": [
  [("Opinion","\u610f\u89c1"),("I agree","\u6211\u540c\u610f"),("I disagree","\u6211\u4e0d\u540c\u610f"),("I think that","\u6211\u8ba4\u4e3a"),("News","\u65b0\u95fb"),("Society","\u793e\u4f1a"),("Politics","\u653f\u6cbb"),("Economy","\u7ecf\u6d4e"),("To argue","\u8fa9\u8bba"),("Debate","\u8ba8\u8bba"),("Reason","\u7406\u7531"),("Therefore","\u56e0\u6b64")],
  [("Interview","\u9762\u8bd5"),("Resume","\u7b80\u5386"),("Meeting","\u4f1a\u8bae"),("Presentation","\u6f14\u793a"),("Salary","\u5de5\u8d44"),("To hire","\u96c7\u7528"),("To fire","\u89e3\u96c7"),("Colleague","\u540c\u4e8b"),("Manager","\u7ecf\u7406"),("Deadline","\u622a\u6b62\u65e5\u671f"),("Project","\u9879\u76ee"),("Email","\u7535\u5b50\u90ae\u4ef6")],
  [("To book","\u9884\u8ba2"),("Flight","\u822a\u73ed"),("Hotel","\u9152\u5e97"),("Reservation","\u9884\u7ea6"),("Passport","\u62a4\u7167"),("Luggage","\u884c\u674e"),("Boarding pass","\u767b\u673a\u724c"),("Delay","\u5ef6\u8bef"),("To cancel","\u53d6\u6d88"),("Adventure","\u5192\u9669"),("Tourist","\u6e38\u5ba2"),("Guide","\u5bfc\u6e38")],
  [("Climate","\u6c14\u5019"),("Pollution","\u6c61\u67d3"),("To recycle","\u56de\u6536"),("Forest","\u68ee\u6797"),("Ocean","\u6d77\u6d0b"),("Endangered","\u6fd2\u5371"),("Conservation","\u4fdd\u62a4"),("Energy","\u80fd\u6e90"),("Solar","\u592a\u9633\u80fd"),("Carbon","\u78b3"),("Wildlife","\u91ce\u751f\u52a8\u7269"),("Sustainable","\u53ef\u6301\u7eed\u7684")],
  [("Internet","\u4e92\u8054\u7f51"),("Website","\u7f51\u7ad9"),("App","\u5e94\u7528"),("Password","\u5bc6\u7801"),("To download","\u4e0b\u8f7d"),("To upload","\u4e0a\u4f20"),("Screen","\u5c4f\u5e55"),("Keyboard","\u952e\u76d8"),("Social media","\u793e\u4ea4\u5a92\u4f53"),("Artificial intelligence","\u4eba\u5de5\u667a\u80fd"),("Robot","\u673a\u5668\u4eba"),("Data","\u6570\u636e")],
  [("Once upon a time","\u4ece\u524d"),("Then","\u7136\u540e"),("Suddenly","\u7a81\u7136"),("While","\u5f53\u65f6"),("First","\u9996\u5148"),("Next","\u63a5\u4e0b\u6765"),("Finally","\u6700\u540e"),("Meanwhile","\u4e0e\u6b64\u540c\u65f6"),("Character","\u4eba\u7269"),("Plot","\u60c5\u8282"),("Beginning","\u5f00\u5934"),("Ending","\u7ed3\u5c3e")],
  [("If","\u5982\u679c"),("Would","\u4f1a"),("Could","\u80fd\u591f"),("Should","\u5e94\u8be5"),("I wish","\u6211\u5e0c\u671b"),("Perhaps","\u4e5f\u8bb8"),("Imagine","\u60f3\u8c61"),("Suppose","\u5047\u8bbe"),("Instead","\u4ee3\u66ff"),("Otherwise","\u5426\u5219"),("Regret","\u540e\u6094"),("Consequence","\u540e\u679c")],
  [("Would you mind","\u60a8\u4ecb\u610f\u5417"),("Dear Sir","\u5c0a\u656c\u7684\u5148\u751f"),("Sincerely","\u6b64\u81f4\u656c\u793c"),("Regards","\u95ee\u5019"),("Kind of","\u6709\u70b9"),("Cool","\u9177"),("Awesome","\u592a\u68d2\u4e86"),("Whatever","\u968f\u4fbf"),("No worries","\u6ca1\u5173\u7cfb"),("Dude","\u54e5\u4eec"),("Formal","\u6b63\u5f0f"),("Informal","\u975e\u6b63\u5f0f")],
],
"B2": [
  [("Freedom","\u81ea\u7531"),("Justice","\u6b63\u4e49"),("Purpose","\u76ee\u7684"),("Consciousness","\u610f\u8bc6"),("Ethics","\u4f26\u7406"),("Morality","\u9053\u5fb7"),("Existence","\u5b58\u5728"),("Equality","\u5e73\u7b49"),("Truth","\u771f\u7406"),("Wisdom","\u667a\u6167"),("Belief","\u4fe1\u4ef0"),("Doubt","\u7591\u60d1")],
  [("Argument","\u8bba\u70b9"),("To persuade","\u8bf4\u670d"),("Evidence","\u8bc1\u636e"),("Counterargument","\u53cd\u9a73"),("However","\u7136\u800c"),("Nevertheless","\u5c3d\u7ba1\u5982\u6b64"),("Furthermore","\u6b64\u5916"),("To refute","\u53cd\u9a73"),("Claim","\u58f0\u660e"),("Fallacy","\u8c2c\u8bef"),("Rhetoric","\u4fee\u8f9e"),("Bias","\u504f\u89c1")],
  [("Negotiation","\u8c08\u5224"),("Proposal","\u63d0\u6848"),("Contract","\u5408\u540c"),("To implement","\u5b9e\u65bd"),("Strategy","\u7b56\u7565"),("Budget","\u9884\u7b97"),("Stakeholder","\u5229\u76ca\u76f8\u5173\u8005"),("Agenda","\u8bae\u7a0b"),("Minutes","\u4f1a\u8bae\u8bb0\u5f55"),("To delegate","\u59d4\u6d3e"),("Efficiency","\u6548\u7387"),("Deadline","\u622a\u6b62\u65e5\u671f")],
  [("Novel","\u5c0f\u8bf4"),("Poem","\u8bd7"),("Painting","\u7ed8\u753b"),("Sculpture","\u96d5\u5851"),("Metaphor","\u6bd4\u55bb"),("Symbolism","\u8c61\u5f81\u4e3b\u4e49"),("Genre","\u4f53\u88c1"),("Protagonist","\u4e3b\u89d2"),("Plot twist","\u60c5\u8282\u8f6c\u6298"),("Review","\u8bc4\u8bba"),("Masterpiece","\u6770\u4f5c"),("Inspiration","\u7075\u611f")],
  [("To break the ice","\u6253\u7834\u50f5\u5c40"),("To hit the nail on the head","\u4e00\u9488\u89c1\u8840"),("A piece of cake","\u5c0f\u83dc\u4e00\u789f"),("To cost an arm and a leg","\u4ef7\u683c\u4e0d\u83f2"),("Better late than never","\u8fdf\u5230\u603b\u6bd4\u4e0d\u5230\u597d"),("To be on cloud nine","\u6b23\u559c\u82e5\u72c2"),("To pull someones leg","\u5f00\u73a9\u7b11"),("Once in a blue moon","\u5343\u8f7d\u96be\u9022"),("To let the cat out of the bag","\u8bf4\u6f0f\u5634"),("To kill two birds with one stone","\u4e00\u77f3\u4e8c\u9e1f"),("The ball is in your court","\u7403\u5728\u4f60\u624b\u4e0a"),("Bite off more than you can chew","\u8d2a\u591a\u56bc\u4e0d\u70c2")],
  [("Subjunctive","\u865a\u62df\u8bed\u6c14"),("Reported speech","\u95f4\u63a5\u5f15\u8bed"),("Passive voice","\u88ab\u52a8\u8bed\u6001"),("Conditional","\u6761\u4ef6\u53e5"),("Gerund","\u52a8\u540d\u8bcd"),("Infinitive","\u4e0d\u5b9a\u5f0f"),("Clause","\u4ece\u53e5"),("Conjunction","\u8fde\u8bcd"),("Pronoun","\u4ee3\u8bcd"),("Preposition","\u4ecb\u8bcd"),("Tense","\u65f6\u6001"),("Agreement","\u4e00\u81f4")],
],
},
}


# ═══════════════════════════════════════════════════════════════
# READING PASSAGES (B1/B2 only) - per language
# ═══════════════════════════════════════════════════════════════

READING_PASSAGES = {
    "es": {
        "B1": [
            ("El cambio climatico", "El cambio climatico es uno de los problemas mas importantes de nuestro tiempo. Las temperaturas globales estan subiendo, los glaciares se derriten y el nivel del mar aumenta. Los cientificos dicen que debemos reducir las emisiones de carbono para proteger nuestro planeta. Muchos paises estan adoptando energias renovables como la solar y la eolica. Cada persona puede contribuir reciclando, usando transporte publico y ahorrando energia en casa.", 150,
             [("What is one of the most important problems?", "Climate change", "multiple_choice", '{"Climate change","Unemployment","Education","Technology"}'),
              ("What are scientists recommending?", "Reduce carbon emissions", "short_answer", None),
              ("Name one renewable energy mentioned.", "Solar or wind", "short_answer", None)]),
            ("La entrevista de trabajo", "Maria tiene una entrevista de trabajo manana. Ella ha preparado su curriculum y ha investigado sobre la empresa. Se siente nerviosa pero emocionada. Su amiga le aconseja que llegue temprano, vista de manera profesional y sea honesta con sus respuestas. Maria practica respondiendo preguntas comunes como: Cuales son sus fortalezas? y Por que quiere trabajar aqui? Ella espera conseguir el puesto.", 120,
             [("What has Maria prepared?", "Her resume", "multiple_choice", '{"Her resume","Her lunch","Her car","Her house"}'),
              ("What advice does her friend give?", "Arrive early, dress professionally, be honest", "short_answer", None)]),
            ("Viaje a Barcelona", "El verano pasado, mi familia y yo viajamos a Barcelona. Reservamos un hotel cerca de la playa y visitamos la Sagrada Familia, el Parque Guell y Las Ramblas. La comida fue increible, especialmente la paella y las tapas. Tambien aprendimos algunas palabras en catalan. El viaje duro una semana y fue una experiencia inolvidable. Espero volver el proximo ano.", 100,
             [("Where did the family travel?", "Barcelona", "multiple_choice", '{"Madrid","Barcelona","Sevilla","Valencia"}'),
              ("How long was the trip?", "One week", "short_answer", None)]),
            ("La tecnologia en la educacion", "Hoy en dia, la tecnologia juega un papel importante en la educacion. Los estudiantes usan tablets y computadoras en clase. Las aplicaciones de aprendizaje hacen que estudiar sea mas interactivo y divertido. Sin embargo, algunos expertos se preocupan por el tiempo excesivo frente a las pantallas. Es importante encontrar un equilibrio entre la tecnologia y los metodos tradicionales de ensenanza.", 110,
             [("What do students use in class?", "Tablets and computers", "multiple_choice", '{"Books only","Tablets and computers","Nothing","Phones only"}'),
              ("What concerns do some experts have?", "Excessive screen time", "short_answer", None)]),
            ("El medio ambiente", "La contaminacion es un problema serio en muchas ciudades. El aire sucio causa problemas de salud, especialmente para los ninos y las personas mayores. Para combatir la contaminacion, algunas ciudades han implementado zonas sin coches y promueven el uso de bicicletas. Tambien es importante plantar mas arboles y reducir el uso de plastico. Todos debemos hacer nuestra parte para proteger el medio ambiente.", 110,
             [("Who is especially affected by dirty air?", "Children and elderly people", "short_answer", None),
              ("What have some cities implemented?", "Car-free zones", "multiple_choice", '{"Car-free zones","More factories","Bigger roads","More parking"}')]),
            ("Las redes sociales", "Las redes sociales han cambiado la forma en que nos comunicamos. Podemos conectar con personas de todo el mundo, compartir fotos y noticias al instante. Sin embargo, tambien hay desventajas como la desinformacion, el ciberacoso y la adiccion. Es importante usar las redes sociales de manera responsable y verificar la informacion antes de compartirla.", 100,
             [("What has social media changed?", "The way we communicate", "short_answer", None),
              ("Name one disadvantage mentioned.", "Misinformation, cyberbullying, or addiction", "short_answer", None)]),
            ("Cocina internacional", "La comida es una parte importante de la cultura. Cada pais tiene sus platos tipicos. En Espana, la paella es famosa. En Italia, la pasta y la pizza. En Japon, el sushi y el ramen. Probar comida de otros paises es una manera deliciosa de aprender sobre diferentes culturas. Hoy en dia, es facil encontrar restaurantes internacionales en casi cualquier ciudad.", 100,
             [("What is famous in Spain?", "Paella", "multiple_choice", '{"Sushi","Paella","Pizza","Tacos"}'),
              ("How can we learn about different cultures through food?", "By trying food from other countries", "short_answer", None)]),
            ("El deporte y la salud", "Hacer ejercicio regularmente es esencial para mantener una buena salud. Los expertos recomiendan al menos treinta minutos de actividad fisica al dia. Caminar, nadar, correr o andar en bicicleta son opciones excelentes. El ejercicio no solo mejora la salud fisica, sino tambien la salud mental. Reduce el estres, mejora el sueno y aumenta la energia.", 100,
             [("How many minutes of exercise do experts recommend daily?", "Thirty minutes", "multiple_choice", '{"Ten minutes","Thirty minutes","One hour","Two hours"}'),
              ("What does exercise improve besides physical health?", "Mental health", "short_answer", None)]),
        ],
        "B2": [
            ("La inteligencia artificial y el futuro del trabajo", "La inteligencia artificial esta transformando rapidamente el mercado laboral. Muchos trabajos rutinarios estan siendo automatizados, lo que genera preocupacion sobre el desempleo tecnologico. Sin embargo, tambien se estan creando nuevas profesiones que requieren habilidades en programacion, analisis de datos y gestion de sistemas de IA. Los expertos sugieren que la educacion debe adaptarse para preparar a las futuras generaciones. La clave sera la capacidad de trabajar junto a las maquinas, combinando la creatividad humana con la eficiencia de la tecnologia. Las empresas que adopten esta perspectiva hibrida tendran una ventaja competitiva significativa.", 200,
             [("What is happening to routine jobs?", "They are being automated", "short_answer", None),
              ("What new skills are in demand?", "Programming, data analysis, AI management", "short_answer", None),
              ("What is the key according to the text?", "Working alongside machines, combining human creativity with technology", "short_answer", None),
              ("True or false: The text suggests education needs to change.", "True", "true_false", None)]),
            ("El arte como forma de protesta", "A lo largo de la historia, el arte ha sido una herramienta poderosa de protesta social. Desde los murales de Diego Rivera en Mexico hasta el arte callejero de Banksy en el Reino Unido, los artistas han utilizado su creatividad para denunciar injusticias. La literatura, la musica y el cine tambien han servido como vehiculos de cambio social. En la era digital, las redes sociales han amplificado el alcance del arte protestante, permitiendo que mensajes lleguen a audiencias globales en cuestion de segundos.", 180,
             [("Who is mentioned as a Mexican muralist?", "Diego Rivera", "multiple_choice", '{"Frida Kahlo","Diego Rivera","Pablo Picasso","Salvador Dali"}'),
              ("How has the digital era affected protest art?", "Social media has amplified its reach globally", "short_answer", None),
              ("What forms of art are mentioned as vehicles for social change?", "Literature, music, and film", "short_answer", None)]),
            ("La globalizacion y la identidad cultural", "La globalizacion ha conectado al mundo de maneras sin precedentes. Podemos comunicarnos instantaneamente con personas en cualquier continente y acceder a productos de todo el mundo. Sin embargo, esta interconexion ha generado un debate sobre la preservacion de las identidades culturales locales. Algunos argumentan que la globalizacion homogeniza las culturas, mientras que otros creen que facilita un intercambio enriquecedor. La realidad probablemente se encuentra en un punto intermedio: las culturas se influyen mutuamente sin perder necesariamente su esencia unica.", 200,
             [("What debate has globalization generated?", "Preservation of local cultural identities", "short_answer", None),
              ("What do some people argue about globalization?", "It homogenizes cultures", "short_answer", None),
              ("Where does the author suggest the reality lies?", "In a middle point", "multiple_choice", '{"Globalization is purely positive","Globalization is purely negative","In a middle point","There is no effect"}')]),
            ("Etica de la inteligencia artificial", "El desarrollo de la inteligencia artificial plantea cuestiones eticas fundamentales. Quien es responsable cuando un coche autonomo causa un accidente? Como garantizamos que los algoritmos no perpetuen sesgos raciales o de genero? Estas preguntas no tienen respuestas sencillas, pero es crucial que la sociedad las aborde antes de que la tecnologia avance mas alla de nuestra capacidad de regularla. Necesitamos marcos eticos solidos que equilibren la innovacion con la proteccion de los derechos humanos.", 180,
             [("What example of ethical dilemma is mentioned?", "Autonomous car accidents", "short_answer", None),
              ("What kind of biases might algorithms perpetuate?", "Racial or gender biases", "short_answer", None),
              ("What does the author say we need?", "Solid ethical frameworks", "short_answer", None),
              ("True or false: The author says these questions have simple answers.", "False", "true_false", None)]),
            ("El poder de la narrativa", "Las historias son fundamentales para la experiencia humana. Desde las pinturas rupestres hasta las series de streaming, los seres humanos siempre han necesitado contar y escuchar historias. Las narrativas nos ayudan a dar sentido al mundo, a desarrollar empatia y a transmitir valores entre generaciones. En el ambito empresarial, el storytelling se ha convertido en una herramienta esencial para conectar con los consumidores a un nivel emocional.", 170,
             [("What is fundamental to the human experience?", "Stories", "multiple_choice", '{"Technology","Stories","Money","Science"}'),
              ("What does storytelling help develop?", "Empathy and transmit values", "short_answer", None),
              ("In what field has storytelling become essential?", "Business", "short_answer", None)]),
            ("Idiomas y cerebro", "Aprender un segundo idioma tiene beneficios cognitivos significativos. Las investigaciones muestran que las personas bilingues tienen mejor memoria, mayor capacidad de concentracion y son mas hábiles en la resolucion de problemas. Ademas, el bilingualismo puede retrasar la aparicion de enfermedades neurodegenerativas como el Alzheimer. El cerebro bilingue esta constantemente ejercitandose al alternar entre dos sistemas linguisticos, lo que fortalece las conexiones neuronales.", 160,
             [("What cognitive benefits does bilingualism have?", "Better memory, concentration, and problem-solving", "short_answer", None),
              ("What disease can bilingualism help delay?", "Alzheimer", "multiple_choice", '{"Cancer","Diabetes","Alzheimer","Heart disease"}'),
              ("Why is the bilingual brain constantly exercising?", "It alternates between two linguistic systems", "short_answer", None)]),
        ],
    },
}

# Copy reading passages structure for other languages (using English-language passages with translated titles)
# In production, these would be in the target language. For seed data, we provide the same structure.
for lang in ["fr", "de", "it", "pt", "ja", "ko", "zh"]:
    READING_PASSAGES[lang] = READING_PASSAGES["es"]

# ═══════════════════════════════════════════════════════════════
# WRITING PROMPTS (B1/B2 only)
# ═══════════════════════════════════════════════════════════════

WRITING_PROMPTS = {
    "B1": [
        ("guided", "Write about your daily routine. Include: what time you wake up, what you eat for breakfast, how you get to work or school, and what you do in the evening. Use at least 80 words.", 80, 150),
        ("guided", "Describe your ideal vacation. Where would you go? Who would you travel with? What activities would you do? Write at least 80 words.", 80, 150),
        ("guided", "Write an email to a friend inviting them to visit your city. Recommend places to see and things to do. Use formal greetings and closings.", 80, 150),
        ("guided", "Describe a memorable experience from your childhood. What happened? How did you feel? Why is it memorable? Use past tenses.", 80, 150),
        ("guided", "Write about the advantages and disadvantages of social media. Give at least two of each. Express your personal opinion.", 80, 150),
        ("guided", "Describe your favorite book or movie. What is it about? Why do you like it? Would you recommend it? Explain why.", 80, 150),
        ("guided", "Write about what you would do if you won the lottery. Use conditional tenses. Mention at least three things.", 80, 150),
        ("guided", "Write a letter of complaint to a hotel about a bad experience during your stay. Be polite but firm. Describe the problems and request a solution.", 80, 150),
    ],
    "B2": [
        ("free", "Discuss the impact of artificial intelligence on modern society. Consider both benefits and risks. Support your arguments with examples. Write at least 150 words.", 150, 400),
        ("free", "Some people believe that university education should be free for everyone. Others disagree. Discuss both sides and give your opinion. Write at least 150 words.", 150, 400),
        ("free", "Write a critical review of a recent film, book, or TV series. Analyze the plot, characters, themes, and your overall impression. Write at least 150 words.", 150, 400),
        ("free", "Discuss how globalization has affected local cultures. Is it a positive or negative development? Use specific examples to support your argument.", 150, 400),
        ("free", "Write an essay about the importance of environmental conservation. What actions can individuals and governments take? Include specific proposals.", 150, 400),
        ("free", "Analyze the role of social media in shaping public opinion. Discuss its influence on politics, culture, and personal relationships. Write at least 150 words.", 150, 400),
    ],
}


# ═══════════════════════════════════════════════════════════════
# EXERCISE GENERATION ENGINE
# ═══════════════════════════════════════════════════════════════

def generate_exercises_for_lesson(vocab_pairs, level, lesson_idx, num_exercises, lang_name):
    """Generate exercise tuples from vocabulary pairs for a lesson.

    Returns list of (type, prompt, answer, options_str_or_None, metadata_dict_or_None)
    """
    exercises = []
    types = EX_TYPES[level]
    n = len(vocab_pairs)
    if n == 0:
        return exercises

    for ei in range(num_exercises):
        pair_idx = ei % n
        eng, tgt = vocab_pairs[pair_idx]
        # Rotate through exercise types
        ex_type = types[ei % len(types)]

        if ex_type == "multiple_choice":
            # Pick 3 distractors from other vocab in unit
            distractors = [p[1] for i, p in enumerate(vocab_pairs) if i != pair_idx][:3]
            while len(distractors) < 3:
                distractors.append("---")
            opts = [tgt] + distractors[:3]
            opts_str = "{" + ",".join(f'"{esc(o)}"' for o in opts) + "}"
            prompt = f'What does "{esc(tgt)}" mean in English?'
            exercises.append((ex_type, prompt, eng, opts_str, None))

        elif ex_type == "translate_to_target":
            prompt = f"Translate to {lang_name}: {eng}"
            exercises.append((ex_type, prompt, tgt, None, None))

        elif ex_type == "translate_to_native":
            prompt = f"Translate to English: {tgt}"
            exercises.append((ex_type, prompt, eng, None, None))

        elif ex_type == "fill_blank":
            if len(tgt) > 3:
                blank_word = tgt[len(tgt)//2:]
                shown = tgt[:len(tgt)//2]
                prompt = f"{shown}_____ ({eng})"
            else:
                prompt = f"_____ ({eng})"
                blank_word = tgt
            exercises.append((ex_type, prompt, blank_word, None, None))

        elif ex_type == "cloze_deletion":
            prompt = f"Fill in the missing word: _____ means {eng}"
            exercises.append((ex_type, prompt, tgt, None, None))

        elif ex_type == "sentence_construction":
            words = tgt.split()
            if len(words) >= 2:
                tiles = words[:]
                distractors_sc = [p[1].split()[0] for p in vocab_pairs if p != (eng, tgt)][:2]
                meta = {"tiles": tiles, "distractors": distractors_sc}
            else:
                meta = {"tiles": [tgt], "distractors": []}
            prompt = f"Arrange the words to translate: {eng}"
            exercises.append((ex_type, prompt, tgt, None, meta))

        elif ex_type == "error_correction":
            # Create a sentence with an error
            if len(tgt) > 4:
                error_sent = tgt[:2] + "x" + tgt[3:]
            else:
                error_sent = tgt + "x"
            meta = {"error_sentence": error_sent}
            prompt = f"Find and correct the error: {error_sent}"
            exercises.append((ex_type, prompt, tgt, None, meta))

        elif ex_type == "dictation":
            prompt = f"Listen and type what you hear (write the translation of: {eng})"
            exercises.append((ex_type, prompt, tgt, None, None))

        elif ex_type == "free_production":
            prompt = f"Write a sentence using the word: {tgt} ({eng})"
            exercises.append((ex_type, prompt, tgt, None, None))

        else:
            # Fallback to multiple choice
            prompt = f'What is "{esc(eng)}" in {lang_name}?'
            exercises.append(("multiple_choice", prompt, tgt, None, None))

    return exercises


# ═══════════════════════════════════════════════════════════════
# SQL GENERATION
# ═══════════════════════════════════════════════════════════════

def generate_course(lang_key, level, lines):
    """Generate all SQL for one language + level combination."""
    code, lang_name = LANG_META[lang_key]
    cfg = LEVELS[level]
    li = cfg["idx"]
    sfx = cfg["sfx"]
    num_units = cfg["units"]
    lpu = cfg["lpu"]
    epl = cfg["epl"]
    xp = cfg["xp"]
    est_min = cfg["mins"]

    course_id = mk_course(code, sfx)
    unit_defs = UNIT_DEFS[level]
    lesson_titles = LESSON_TITLES[level]
    vocab_data = VOCAB.get(lang_key, {}).get(level, [])

    lines.append(f"\n-- {lang_name} {level}")
    lines.append(f"INSERT INTO courses (id, source_language, target_language, title, description, total_units, is_published, cefr_level)")
    lines.append(f"VALUES ('{course_id}', 'en', '{lang_key}', '{esc(lang_name)} {level}', '{esc(lang_name)} course - CEFR {level}', {num_units}, true, '{level}');")

    for ui in range(num_units):
        if ui >= len(unit_defs):
            break
        utitle, udesc = unit_defs[ui]
        unit_id = mk_unit(code, li, ui + 1, sfx)

        lines.append(f"\nINSERT INTO units (id, course_id, title, description, order_index, total_lessons)")
        lines.append(f"VALUES ('{unit_id}', '{course_id}', '{esc(utitle)}', '{esc(udesc)}', {ui}, {lpu});")

        # Lessons
        ltitles = lesson_titles[ui] if ui < len(lesson_titles) else [f"Lesson {j+1}" for j in range(lpu)]
        lines.append(f"INSERT INTO lessons (id, unit_id, title, description, order_index, estimated_minutes, xp_reward) VALUES")
        lrows = []
        for lsi in range(lpu):
            lesson_id = mk_lesson(code, li, ui + 1, lsi + 1, sfx)
            lt = ltitles[lsi] if lsi < len(ltitles) else f"Lesson {lsi+1}"
            lrows.append(f"  ('{lesson_id}', '{unit_id}', '{esc(lt)}', '{esc(lt)}', {lsi}, {est_min}, {xp})")
        lines.append(",\n".join(lrows) + ";")

        # Vocab for this unit
        unit_vocab = vocab_data[ui] if ui < len(vocab_data) else []

        # Exercises for each lesson
        for lsi in range(lpu):
            lesson_id = mk_lesson(code, li, ui + 1, lsi + 1, sfx)
            # Rotate vocab slightly per lesson
            rotated = unit_vocab[lsi % max(1, len(unit_vocab)):] + unit_vocab[:lsi % max(1, len(unit_vocab))]
            exs = generate_exercises_for_lesson(rotated, level, lsi, epl, lang_name)

            if exs:
                lines.append(f"INSERT INTO exercises (id, lesson_id, type, prompt, correct_answer, options, accepted_answers, order_index, metadata) VALUES")
                erows = []
                for ei, (etype, prompt, answer, opts, meta) in enumerate(exs):
                    ex_id = mk_exercise(code, li, ui + 1, lsi + 1, ei + 1)
                    opts_sql = f"'{opts}'" if opts else "NULL"
                    meta_sql = f"'{jesc(meta)}'" if meta else "'{}'"
                    erows.append(f"  ('{ex_id}', '{lesson_id}', '{etype}', '{esc(prompt)}', '{esc(answer)}', {opts_sql}, '{{}}', {ei}, {meta_sql})")
                lines.append(",\n".join(erows) + ";")

        # Cards for this unit
        if unit_vocab:
            lines.append(f"INSERT INTO cards (id, course_id, unit_id, native_text, target_text, part_of_speech, tags) VALUES")
            crows = []
            for ci, (eng, tgt) in enumerate(unit_vocab):
                card_id = mk_card(code, li, ui + 1, ci + 1, sfx)
                tag_str = '{' + f'"{level}"' + '}'
                crows.append(f"  ('{card_id}', '{course_id}', '{unit_id}', '{esc(eng)}', '{esc(tgt)}', 'word', '{tag_str}')")
            lines.append(",\n".join(crows) + ";")

    # Reading passages (B1/B2 only)
    if level in ("B1", "B2") and lang_key in READING_PASSAGES:
        passages = READING_PASSAGES[lang_key].get(level, [])
        for pi, (title, content, wc, questions) in enumerate(passages):
            if pi >= num_units:
                break
            unit_id = mk_unit(code, li, pi + 1, sfx)
            passage_id = mk_reading(code, li, pi + 1, 1)
            lines.append(f"INSERT INTO reading_passages (id, course_id, unit_id, cefr_level, title, content, word_count, is_published)")
            lines.append(f"VALUES ('{passage_id}', '{course_id}', '{unit_id}', '{level}', '{esc(title)}', '{esc(content)}', {wc}, true);")

            if questions:
                lines.append(f"INSERT INTO reading_questions (id, passage_id, order_index, question_text, question_type, correct_answer, accepted_answers, options) VALUES")
                qrows = []
                for qi, (qt, qa, qtype, qopts) in enumerate(questions):
                    q_id = mk_question(code, li, pi + 1, 1, qi + 1)
                    qopts_sql = f"'{qopts}'" if qopts else "NULL"
                    qrows.append(f"  ('{q_id}', '{passage_id}', {qi}, '{esc(qt)}', '{qtype}', '{esc(qa)}', '{{}}', {qopts_sql})")
                lines.append(",\n".join(qrows) + ";")

    # Writing prompts (B1/B2 only)
    if level in ("B1", "B2"):
        prompts = WRITING_PROMPTS.get(level, [])
        for wi, (ptype, ptext, minw, maxw) in enumerate(prompts):
            if wi >= num_units:
                break
            unit_id = mk_unit(code, li, wi + 1, sfx)
            w_id = mk_writing(code, li, wi + 1, 1)
            lines.append(f"INSERT INTO writing_prompts (id, course_id, unit_id, cefr_level, prompt_text, prompt_type, min_words, max_words)")
            lines.append(f"VALUES ('{w_id}', '{course_id}', '{unit_id}', '{level}', '{esc(ptext)}', '{ptype}', {minw}, {maxw});")


def main():
    output = []
    output.append("-- Fluenci Seed Data: 8 Languages x 4 CEFR Levels")
    output.append("-- Auto-generated. Do not edit manually.")
    output.append("")

    # Clean all existing data
    output.append("-- Clear existing seed data")
    output.append("DELETE FROM reading_questions WHERE passage_id IN (SELECT id FROM reading_passages WHERE course_id IN (SELECT id FROM courses WHERE source_language = 'en'));")
    output.append("DELETE FROM reading_passages WHERE course_id IN (SELECT id FROM courses WHERE source_language = 'en');")
    output.append("DELETE FROM writing_prompts WHERE course_id IN (SELECT id FROM courses WHERE source_language = 'en');")
    output.append("DELETE FROM exercises WHERE lesson_id IN (SELECT id FROM lessons WHERE unit_id IN (SELECT id FROM units WHERE course_id IN (SELECT id FROM courses WHERE source_language = 'en')));")
    output.append("DELETE FROM cards WHERE course_id IN (SELECT id FROM courses WHERE source_language = 'en');")
    output.append("DELETE FROM lessons WHERE unit_id IN (SELECT id FROM units WHERE course_id IN (SELECT id FROM courses WHERE source_language = 'en'));")
    output.append("DELETE FROM units WHERE course_id IN (SELECT id FROM courses WHERE source_language = 'en');")
    output.append("DELETE FROM courses WHERE source_language = 'en';")
    output.append("")

    for lang_key in ["es", "fr", "de", "it", "pt", "ja", "ko", "zh"]:
        code, name = LANG_META[lang_key]
        output.append(f"\n-- {'=' * 60}")
        output.append(f"-- {name.upper()} ({lang_key})")
        output.append(f"-- {'=' * 60}")
        for level in ["A1", "A2", "B1", "B2"]:
            generate_course(lang_key, level, output)

    output.append("\n-- End of seed data")

    seed_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "seed.sql")
    with open(seed_path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(output))

    print(f"Generated seed.sql at {seed_path}")
    text = "\n".join(output)
    print(f"Lines: {text.count(chr(10))}")
    for table in ["courses", "units", "lessons", "exercises", "cards", "reading_passages", "reading_questions", "writing_prompts"]:
        print(f"  INSERT INTO {table}: {text.count(f'INSERT INTO {table}')}")


if __name__ == "__main__":
    main()
