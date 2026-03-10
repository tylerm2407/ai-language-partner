// Static course/lesson data - works without database setup
// Provides a "Foundations" course for every language

export type StaticLesson = {
  id: string
  title: string
  description: string
  type: 'vocabulary' | 'reading' | 'writing' | 'grammar' | 'conversation'
  sort_order: number
  xp_reward: number
  contents: StaticContent[]
}

export type StaticContent = {
  id: string
  content_type: 'text' | 'vocab_list' | 'writing_prompt'
  content: any
  sort_order: number
}

export type StaticCourse = {
  id: string
  title: string
  description: string
  sort_order: number
  lessons: StaticLesson[]
}

const COMMON_PHRASES: Record<string, { hello: string; thanks: string; please: string; yes: string; no: string; goodbye: string }> = {
  spanish: { hello: 'Hola', thanks: 'Gracias', please: 'Por favor', yes: 'Sí', no: 'No', goodbye: 'Adiós' },
  french: { hello: 'Bonjour', thanks: 'Merci', please: "S'il vous plaît", yes: 'Oui', no: 'Non', goodbye: 'Au revoir' },
  german: { hello: 'Hallo', thanks: 'Danke', please: 'Bitte', yes: 'Ja', no: 'Nein', goodbye: 'Auf Wiedersehen' },
  italian: { hello: 'Ciao', thanks: 'Grazie', please: 'Per favore', yes: 'Sì', no: 'No', goodbye: 'Arrivederci' },
  portuguese: { hello: 'Olá', thanks: 'Obrigado', please: 'Por favor', yes: 'Sim', no: 'Não', goodbye: 'Adeus' },
  dutch: { hello: 'Hallo', thanks: 'Dank u', please: 'Alstublieft', yes: 'Ja', no: 'Nee', goodbye: 'Tot ziens' },
  russian: { hello: 'Привет', thanks: 'Спасибо', please: 'Пожалуйста', yes: 'Да', no: 'Нет', goodbye: 'До свидания' },
  polish: { hello: 'Cześć', thanks: 'Dziękuję', please: 'Proszę', yes: 'Tak', no: 'Nie', goodbye: 'Do widzenia' },
  czech: { hello: 'Ahoj', thanks: 'Děkuji', please: 'Prosím', yes: 'Ano', no: 'Ne', goodbye: 'Na shledanou' },
  swedish: { hello: 'Hej', thanks: 'Tack', please: 'Snälla', yes: 'Ja', no: 'Nej', goodbye: 'Hej då' },
  norwegian: { hello: 'Hei', thanks: 'Takk', please: 'Vær så snill', yes: 'Ja', no: 'Nei', goodbye: 'Ha det' },
  danish: { hello: 'Hej', thanks: 'Tak', please: 'Vær så venlig', yes: 'Ja', no: 'Nej', goodbye: 'Farvel' },
  finnish: { hello: 'Hei', thanks: 'Kiitos', please: 'Ole hyvä', yes: 'Kyllä', no: 'Ei', goodbye: 'Näkemiin' },
  greek: { hello: 'Γεια σου', thanks: 'Ευχαριστώ', please: 'Παρακαλώ', yes: 'Ναι', no: 'Όχι', goodbye: 'Αντίο' },
  turkish: { hello: 'Merhaba', thanks: 'Teşekkürler', please: 'Lütfen', yes: 'Evet', no: 'Hayır', goodbye: 'Hoşça kal' },
  arabic: { hello: 'مرحبا', thanks: 'شكراً', please: 'من فضلك', yes: 'نعم', no: 'لا', goodbye: 'مع السلامة' },
  hebrew: { hello: 'שלום', thanks: 'תודה', please: 'בבקשה', yes: 'כן', no: 'לא', goodbye: 'להתראות' },
  persian: { hello: 'سلام', thanks: 'ممنون', please: 'لطفاً', yes: 'بله', no: 'نه', goodbye: 'خداحافظ' },
  hindi: { hello: 'नमस्ते', thanks: 'धन्यवाद', please: 'कृपया', yes: 'हाँ', no: 'नहीं', goodbye: 'अलविदा' },
  urdu: { hello: 'سلام', thanks: 'شکریہ', please: 'براہ کرم', yes: 'ہاں', no: 'نہیں', goodbye: 'خدا حافظ' },
  bengali: { hello: 'হ্যালো', thanks: 'ধন্যবাদ', please: 'দয়া করে', yes: 'হ্যাঁ', no: 'না', goodbye: 'বিদায়' },
  punjabi: { hello: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ', thanks: 'ਧੰਨਵਾਦ', please: 'ਕਿਰਪਾ ਕਰਕੇ', yes: 'ਹਾਂ', no: 'ਨਹੀਂ', goodbye: 'ਅਲਵਿਦਾ' },
  gujarati: { hello: 'હેલો', thanks: 'આભાર', please: 'કૃપા કરીને', yes: 'હા', no: 'ના', goodbye: 'આવજો' },
  marathi: { hello: 'नमस्कार', thanks: 'धन्यवाद', please: 'कृपया', yes: 'हो', no: 'नाही', goodbye: 'निरोप' },
  tamil: { hello: 'வணக்கம்', thanks: 'நன்றி', please: 'தயவுசெய்து', yes: 'ஆம்', no: 'இல்லை', goodbye: 'விடை' },
  telugu: { hello: 'హలో', thanks: 'ధన్యవాదాలు', please: 'దయచేసి', yes: 'అవును', no: 'లేదు', goodbye: 'వీడ్కోలు' },
  kannada: { hello: 'ಹಲೋ', thanks: 'ಧನ್ಯವಾದ', please: 'ದಯವಿಟ್ಟು', yes: 'ಹೌದು', no: 'ಇಲ್ಲ', goodbye: 'ವಿದಾಯ' },
  malayalam: { hello: 'ഹലോ', thanks: 'നന്ദി', please: 'ദയവായി', yes: 'അതെ', no: 'ഇല്ല', goodbye: 'വിട' },
  mandarin: { hello: '你好', thanks: '谢谢', please: '请', yes: '是', no: '不', goodbye: '再见' },
  cantonese: { hello: '你好', thanks: '唔該', please: '請', yes: '係', no: '唔係', goodbye: '再見' },
  japanese: { hello: 'こんにちは', thanks: 'ありがとう', please: 'おねがい', yes: 'はい', no: 'いいえ', goodbye: 'さようなら' },
  korean: { hello: '안녕하세요', thanks: '감사합니다', please: '부탁드립니다', yes: '네', no: '아니요', goodbye: '안녕히 계세요' },
  vietnamese: { hello: 'Xin chào', thanks: 'Cảm ơn', please: 'Làm ơn', yes: 'Có', no: 'Không', goodbye: 'Tạm biệt' },
  thai: { hello: 'สวัสดี', thanks: 'ขอบคุณ', please: 'กรุณา', yes: 'ใช่', no: 'ไม่', goodbye: 'ลาก่อน' },
  indonesian: { hello: 'Halo', thanks: 'Terima kasih', please: 'Tolong', yes: 'Ya', no: 'Tidak', goodbye: 'Selamat tinggal' },
  malay: { hello: 'Helo', thanks: 'Terima kasih', please: 'Sila', yes: 'Ya', no: 'Tidak', goodbye: 'Selamat tinggal' },
  tagalog: { hello: 'Kamusta', thanks: 'Salamat', please: 'Pakiusap', yes: 'Oo', no: 'Hindi', goodbye: 'Paalam' },
  swahili: { hello: 'Habari', thanks: 'Asante', please: 'Tafadhali', yes: 'Ndiyo', no: 'Hapana', goodbye: 'Kwaheri' },
  amharic: { hello: 'ሰላም', thanks: 'አመሰግናለሁ', please: 'እባክህ', yes: 'አዎ', no: 'አይ', goodbye: 'ደህና ሁን' },
  yoruba: { hello: 'E kaabo', thanks: 'E seun', please: 'Jowo', yes: 'Beeni', no: 'Rara', goodbye: 'O daabo' },
  igbo: { hello: 'Nnoo', thanks: 'Daalu', please: 'Biko', yes: 'Ee', no: 'Mba', goodbye: 'Ka o di' },
  hausa: { hello: 'Sannu', thanks: 'Na gode', please: 'Don Allah', yes: 'Ee', no: "A'a", goodbye: 'Sai anjima' },
  zulu: { hello: 'Sawubona', thanks: 'Ngiyabonga', please: 'Ngiyacela', yes: 'Yebo', no: 'Cha', goodbye: 'Sala kahle' },
  afrikaans: { hello: 'Hallo', thanks: 'Dankie', please: 'Asseblief', yes: 'Ja', no: 'Nee', goodbye: 'Totsiens' },
  ukrainian: { hello: 'Привіт', thanks: 'Дякую', please: 'Будь ласка', yes: 'Так', no: 'Ні', goodbye: 'До побачення' },
  romanian: { hello: 'Bună', thanks: 'Mulțumesc', please: 'Vă rog', yes: 'Da', no: 'Nu', goodbye: 'La revedere' },
  hungarian: { hello: 'Szia', thanks: 'Köszönöm', please: 'Kérem', yes: 'Igen', no: 'Nem', goodbye: 'Viszlát' },
  catalan: { hello: 'Hola', thanks: 'Gràcies', please: 'Si us plau', yes: 'Sí', no: 'No', goodbye: 'Adéu' },
  latin: { hello: 'Salve', thanks: 'Gratias', please: 'Quaeso', yes: 'Ita', no: 'Non', goodbye: 'Vale' },
  esperanto: { hello: 'Saluton', thanks: 'Dankon', please: 'Bonvolu', yes: 'Jes', no: 'Ne', goodbye: 'Ĝis' },
}

export function getStaticCourse(languageName: string, languageSlug: string): StaticCourse {
  const phrases = COMMON_PHRASES[languageSlug] || {
    hello: 'Hello', thanks: 'Thank you', please: 'Please', yes: 'Yes', no: 'No', goodbye: 'Goodbye'
  }
  const courseId = `static-${languageSlug}-foundations`
  return {
    id: courseId,
    title: 'Foundations',
    description: `Master the essentials of ${languageName} and start speaking from day one.`,
    sort_order: 1,
    lessons: [
      {
        id: `${courseId}-vocab`,
        title: 'First Words',
        description: 'Essential vocabulary to get started',
        type: 'vocabulary',
        sort_order: 1,
        xp_reward: 20,
        contents: [
          {
            id: `${courseId}-vocab-intro`,
            content_type: 'text',
            content: { text: `Welcome to ${languageName}! Let's start with the most essential words and phrases you'll use every day. Practice these until they feel natural.` },
            sort_order: 1,
          },
          {
            id: `${courseId}-vocab-list`,
            content_type: 'vocab_list',
            content: {
              words: [
                { target: phrases.hello, native: 'Hello / Hi', transliteration: '' },
                { target: phrases.thanks, native: 'Thank you', transliteration: '' },
                { target: phrases.please, native: 'Please', transliteration: '' },
                { target: phrases.yes, native: 'Yes', transliteration: '' },
                { target: phrases.no, native: 'No', transliteration: '' },
                { target: phrases.goodbye, native: 'Goodbye', transliteration: '' },
              ]
            },
            sort_order: 2,
          },
        ],
      },
      {
        id: `${courseId}-reading`,
        title: 'Reading Basics',
        description: 'Learn to read simple texts in ' + languageName,
        type: 'reading',
        sort_order: 2,
        xp_reward: 25,
        contents: [
          {
            id: `${courseId}-reading-text`,
            content_type: 'text',
            content: {
              text: `Reading in ${languageName} is a skill that unlocks a world of culture, literature, and connection. Start with simple texts and work your way up. Every word you recognize is progress!\n\nTip: Do not worry about understanding every word. Focus on getting the overall meaning, then use the translate button to check specific words.`
            },
            sort_order: 1,
          },
        ],
      },
      {
        id: `${courseId}-writing`,
        title: 'Writing Practice',
        description: 'Practice writing your first sentences',
        type: 'writing',
        sort_order: 3,
        xp_reward: 30,
        contents: [
          {
            id: `${courseId}-writing-prompt`,
            content_type: 'writing_prompt',
            content: {
              prompt: `Introduce yourself in ${languageName}. Include: your name, where you are from, and why you are learning ${languageName}. Use at least 3 sentences.`,
              min_words: 15,
            },
            sort_order: 1,
          },
        ],
      },
      {
        id: `${courseId}-grammar`,
        title: 'Grammar Foundations',
        description: 'Core grammar rules to build sentences',
        type: 'grammar',
        sort_order: 4,
        xp_reward: 25,
        contents: [
          {
            id: `${courseId}-grammar-text`,
            content_type: 'text',
            content: {
              text: `Understanding ${languageName} grammar gives you the tools to build any sentence. Start with the basics:\n\n1. Word order - How sentences are structured\n2. Nouns and gender - Whether nouns have masculine/feminine forms\n3. Verb conjugation - How verbs change based on subject\n4. Common patterns - The structures you will use most of the time\n\nThe best way to learn grammar is through practice. After this lesson, have a conversation with the AI tutor to put it into action!`
            },
            sort_order: 1,
          },
        ],
      },
      {
        id: `${courseId}-conversation`,
        title: 'First Conversation',
        description: 'Practice a real conversation with your AI tutor',
        type: 'conversation',
        sort_order: 5,
        xp_reward: 35,
        contents: [
          {
            id: `${courseId}-convo-text`,
            content_type: 'text',
            content: {
              text: `You have learned the basics - now it is time to use them! Head to the AI conversation partner and start a conversation in ${languageName}. Try to:\n\n- Greet your conversation partner\n- Introduce yourself\n- Ask a simple question\n- Use words from the First Words lesson\n\nDo not be afraid to make mistakes - that is how you learn!`
            },
            sort_order: 1,
          },
        ],
      },
    ],
  }
}

export function isStaticCourseId(id: string): boolean {
  return id.startsWith('static-')
}

export function getStaticLessonById(lessonId: string, languageName: string, languageSlug: string): StaticLesson | null {
  const course = getStaticCourse(languageName, languageSlug)
  return course.lessons.find(l => l.id === lessonId) || null
}
