import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { ProgressBar } from '../ui/ProgressBar';
import { Button } from '../ui/Button';
import type { ProficiencyLevel, LanguageCode } from '../../types';

interface PlacementQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  level: ProficiencyLevel;
}

const PLACEMENT_QUESTIONS: Record<string, PlacementQuestion[]> = {
  es: [
    { question: 'What does "Hola" mean?', options: ['Goodbye', 'Hello', 'Please', 'Thank you'], correctIndex: 1, level: 'beginner' },
    { question: 'How do you say "water" in Spanish?', options: ['Leche', 'Jugo', 'Agua', 'Pan'], correctIndex: 2, level: 'beginner' },
    { question: 'Choose the correct sentence:', options: ['Yo soy feliz', 'Yo es feliz', 'Yo ser feliz', 'Yo estar feliz'], correctIndex: 0, level: 'elementary' },
    { question: '"Ayer fui al mercado" means:', options: ['I will go to the market', 'Yesterday I went to the market', 'I am at the market', 'I like the market'], correctIndex: 1, level: 'elementary' },
    { question: 'Complete: "Si yo ___ rico, viajaría por el mundo"', options: ['soy', 'fuera', 'era', 'seré'], correctIndex: 1, level: 'intermediate' },
    { question: 'What does "echar de menos" mean?', options: ['To throw away', 'To miss someone', 'To be less', 'To run out of'], correctIndex: 1, level: 'intermediate' },
    { question: 'Choose the correct subjunctive: "Espero que tú ___ bien"', options: ['estás', 'estés', 'estarás', 'estabas'], correctIndex: 1, level: 'upper_intermediate' },
    { question: '"No cabe duda de que..." means:', options: ['There is no room for...', 'There is no doubt that...', 'It does not fit...', 'Do not hesitate to...'], correctIndex: 1, level: 'upper_intermediate' },
    { question: '"Haber dado en el clavo" means:', options: ['To have nailed it', 'To have given a nail', 'To have built something', 'To have made a mistake'], correctIndex: 0, level: 'advanced' },
    { question: 'Choose the correct form: "Si hubiera sabido, no ___ venido"', options: ['habría', 'hubiera', 'habrá', 'haya'], correctIndex: 0, level: 'advanced' },
  ],
  fr: [
    { question: 'What does "Bonjour" mean?', options: ['Goodbye', 'Hello', 'Please', 'Sorry'], correctIndex: 1, level: 'beginner' },
    { question: 'How do you say "cat" in French?', options: ['Chien', 'Chat', 'Oiseau', 'Poisson'], correctIndex: 1, level: 'beginner' },
    { question: 'Choose the correct form: "Je ___ français"', options: ['suis', 'parle', 'parlent', 'es'], correctIndex: 1, level: 'elementary' },
    { question: '"Il fait beau" means:', options: ['He is handsome', 'The weather is nice', 'It is done', 'He is making'], correctIndex: 1, level: 'elementary' },
    { question: 'Complete: "Si j\'avais le temps, je ___ au cinéma"', options: ['vais', 'irais', 'irai', 'allais'], correctIndex: 1, level: 'intermediate' },
    { question: 'What does "avoir le cafard" mean?', options: ['To have a cockroach', 'To feel down', 'To drink coffee', 'To be scared'], correctIndex: 1, level: 'intermediate' },
    { question: 'Choose the correct subjunctive: "Il faut que tu ___ là"', options: ['es', 'sois', 'seras', 'étais'], correctIndex: 1, level: 'upper_intermediate' },
    { question: '"Quoi qu\'il en soit" means:', options: ['Whatever it is', 'Be that as it may', 'What is it about', 'Who is it'], correctIndex: 1, level: 'upper_intermediate' },
    { question: '"Avoir le beurre et l\'argent du beurre" means:', options: ['To want it all', 'To have your cake and eat it too', 'To be rich', 'To spend wisely'], correctIndex: 1, level: 'advanced' },
    { question: 'Complete: "Bien qu\'il ___ malade, il est venu"', options: ['était', 'fût', 'est', 'sera'], correctIndex: 1, level: 'advanced' },
  ],
  de: [
    { question: 'What does "Danke" mean?', options: ['Hello', 'Goodbye', 'Thank you', 'Please'], correctIndex: 2, level: 'beginner' },
    { question: 'How do you say "dog" in German?', options: ['Katze', 'Hund', 'Vogel', 'Fisch'], correctIndex: 1, level: 'beginner' },
    { question: 'Choose the correct article: "___ Buch ist gut"', options: ['Der', 'Die', 'Das', 'Den'], correctIndex: 2, level: 'elementary' },
    { question: '"Ich bin müde" means:', options: ['I am hungry', 'I am tired', 'I am happy', 'I am lost'], correctIndex: 1, level: 'elementary' },
    { question: 'Complete: "Wenn ich reich ___, würde ich reisen"', options: ['bin', 'wäre', 'war', 'sei'], correctIndex: 1, level: 'intermediate' },
    { question: 'What does "Ich drücke dir die Daumen" mean?', options: ['I push your thumbs', 'I cross my fingers for you', 'I give you a thumbs up', 'I shake your hand'], correctIndex: 1, level: 'intermediate' },
    { question: 'Choose the correct Konjunktiv II: "Er ___ gerne gekommen"', options: ['wäre', 'war', 'ist', 'wird'], correctIndex: 0, level: 'upper_intermediate' },
    { question: '"Es liegt mir auf der Zunge" means:', options: ['It lies on my tongue', 'It\'s on the tip of my tongue', 'I can taste it', 'I want to say something'], correctIndex: 1, level: 'upper_intermediate' },
    { question: '"Den Nagel auf den Kopf treffen" means:', options: ['To hit a nail on the head', 'To hit the nail on the head (be exactly right)', 'To hurt yourself', 'To build something'], correctIndex: 1, level: 'advanced' },
    { question: 'Complete: "Hätte ich das gewusst, ___ ich nicht gekommen"', options: ['wäre', 'hätte', 'bin', 'wurde'], correctIndex: 0, level: 'advanced' },
  ],
  it: [
    { question: 'What does "Grazie" mean?', options: ['Hello', 'Goodbye', 'Please', 'Thank you'], correctIndex: 3, level: 'beginner' },
    { question: 'How do you say "house" in Italian?', options: ['Cane', 'Casa', 'Gatto', 'Libro'], correctIndex: 1, level: 'beginner' },
    { question: 'Choose the correct form: "Io ___ italiano"', options: ['parla', 'parli', 'parlo', 'parlano'], correctIndex: 2, level: 'elementary' },
    { question: '"Fa freddo oggi" means:', options: ['It\'s hot today', 'It\'s cold today', 'It\'s raining today', 'It\'s windy today'], correctIndex: 1, level: 'elementary' },
    { question: 'Complete: "Se avessi tempo, ___ al cinema"', options: ['vado', 'andrei', 'andrò', 'andavo'], correctIndex: 1, level: 'intermediate' },
    { question: 'What does "in bocca al lupo" mean?', options: ['In the wolf\'s mouth', 'Good luck', 'Be careful', 'Watch out'], correctIndex: 1, level: 'intermediate' },
    { question: 'Choose the correct subjunctive: "Penso che lui ___ ragione"', options: ['ha', 'abbia', 'avrà', 'aveva'], correctIndex: 1, level: 'upper_intermediate' },
    { question: '"Non vedo l\'ora" means:', options: ['I can\'t see the time', 'I can\'t wait', 'I don\'t have time', 'I\'m running late'], correctIndex: 1, level: 'upper_intermediate' },
    { question: '"Acqua in bocca" means:', options: ['Water in the mouth', 'Keep it a secret', 'I\'m thirsty', 'Be quiet'], correctIndex: 1, level: 'advanced' },
    { question: 'Complete: "Se l\'avessi saputo, non ___ venuto"', options: ['sarei', 'fossi', 'ero', 'sarò'], correctIndex: 0, level: 'advanced' },
  ],
  pt: [
    { question: 'What does "Obrigado" mean?', options: ['Hello', 'Goodbye', 'Thank you', 'Please'], correctIndex: 2, level: 'beginner' },
    { question: 'How do you say "bread" in Portuguese?', options: ['Água', 'Pão', 'Leite', 'Arroz'], correctIndex: 1, level: 'beginner' },
    { question: 'Choose the correct form: "Eu ___ brasileiro"', options: ['sou', 'é', 'são', 'está'], correctIndex: 0, level: 'elementary' },
    { question: '"Está chovendo" means:', options: ['It\'s sunny', 'It\'s raining', 'It\'s cold', 'It\'s windy'], correctIndex: 1, level: 'elementary' },
    { question: 'Complete: "Se eu ___ dinheiro, viajaria o mundo"', options: ['tenho', 'tivesse', 'terei', 'tinha'], correctIndex: 1, level: 'intermediate' },
    { question: 'What does "matar saudade" mean?', options: ['To kill nostalgia', 'To reunite with someone you miss', 'To feel sad', 'To remember the past'], correctIndex: 1, level: 'intermediate' },
    { question: 'Choose the correct subjunctive: "Espero que você ___ bem"', options: ['está', 'esteja', 'estará', 'estava'], correctIndex: 1, level: 'upper_intermediate' },
    { question: '"Ficar de olho" means:', options: ['To stay with your eye', 'To keep an eye on', 'To look away', 'To close your eyes'], correctIndex: 1, level: 'upper_intermediate' },
    { question: '"Engolir sapo" means:', options: ['To swallow a frog', 'To put up with something unpleasant', 'To eat fast', 'To feel sick'], correctIndex: 1, level: 'advanced' },
    { question: 'Complete: "Se eu tivesse sabido, não ___ vindo"', options: ['teria', 'tinha', 'tenho', 'terei'], correctIndex: 0, level: 'advanced' },
  ],
  ja: [
    { question: 'What does "ありがとう" (arigatou) mean?', options: ['Hello', 'Goodbye', 'Thank you', 'Sorry'], correctIndex: 2, level: 'beginner' },
    { question: 'Which is the correct reading of "水"?', options: ['hi', 'mizu', 'kaze', 'tsuki'], correctIndex: 1, level: 'beginner' },
    { question: 'Choose the correct particle: "私_学生です"', options: ['を', 'は', 'に', 'で'], correctIndex: 1, level: 'elementary' },
    { question: '"昨日、映画を見ました" means:', options: ['I will watch a movie tomorrow', 'Yesterday I watched a movie', 'I like movies', 'I am watching a movie'], correctIndex: 1, level: 'elementary' },
    { question: 'What does "〜てもいいですか" express?', options: ['Must I...?', 'May I...?', 'Should I...?', 'Can I not...?'], correctIndex: 1, level: 'intermediate' },
    { question: '"猫の手も借りたい" literally means "want to borrow a cat\'s paw." What does it really mean?', options: ['I love cats', 'I\'m extremely busy', 'I need help', 'I\'m being lazy'], correctIndex: 1, level: 'intermediate' },
    { question: 'Choose the correct form: "雨が降る___、傘を持っていきます"', options: ['から', 'ので', 'かもしれないから', 'けど'], correctIndex: 2, level: 'upper_intermediate' },
    { question: 'What does "空気を読む" (kuuki wo yomu) mean?', options: ['To read the air', 'To read the room / sense the mood', 'To breathe deeply', 'To predict weather'], correctIndex: 1, level: 'upper_intermediate' },
    { question: '"七転び八起き" (nana korobi ya oki) means:', options: ['Seven falls, eight rises (never give up)', 'Lucky number seven', 'Practice makes perfect', 'Seven times is enough'], correctIndex: 0, level: 'advanced' },
    { question: 'Complete: "彼が来る___、パーティーは始まらない"', options: ['まで', 'までに', 'ために', 'ように'], correctIndex: 0, level: 'advanced' },
  ],
  ko: [
    { question: 'What does "감사합니다" (gamsahamnida) mean?', options: ['Hello', 'Goodbye', 'Thank you', 'Sorry'], correctIndex: 2, level: 'beginner' },
    { question: 'How do you say "water" in Korean?', options: ['밥 (bap)', '물 (mul)', '차 (cha)', '빵 (ppang)'], correctIndex: 1, level: 'beginner' },
    { question: 'Choose the correct particle: "나___ 학생이에요"', options: ['을', '는', '에', '와'], correctIndex: 1, level: 'elementary' },
    { question: '"어제 영화를 봤어요" means:', options: ['I will watch a movie', 'Yesterday I watched a movie', 'I like movies', 'I am watching'], correctIndex: 1, level: 'elementary' },
    { question: 'What does "~(으)면 좋겠다" express?', options: ['I must...', 'I wish / I hope...', 'I should...', 'I used to...'], correctIndex: 1, level: 'intermediate' },
    { question: '"식은 죽 먹기" (eating cold porridge) means:', options: ['Easy food', 'A piece of cake (very easy)', 'Bad cooking', 'Feeling cold'], correctIndex: 1, level: 'intermediate' },
    { question: 'Choose correct honorific: "선생님이 ___ 오셨어요"', options: ['벌써', '이미', '아직', '방금'], correctIndex: 0, level: 'upper_intermediate' },
    { question: '"눈치가 빠르다" means:', options: ['To have fast eyes', 'To be quick at reading situations', 'To run quickly', 'To be smart'], correctIndex: 1, level: 'upper_intermediate' },
    { question: '"소 잃고 외양간 고친다" means:', options: ['Fix the barn after losing the cow (too late)', 'Take care of animals', 'Prevention is better than cure', 'Work hard on the farm'], correctIndex: 0, level: 'advanced' },
    { question: 'What nuance does "~더라고요" convey?', options: ['I heard that...', 'I personally witnessed/experienced that...', 'Someone told me...', 'It is said that...'], correctIndex: 1, level: 'advanced' },
  ],
  zh: [
    { question: 'What does "你好" (nǐ hǎo) mean?', options: ['Goodbye', 'Hello', 'Thank you', 'Sorry'], correctIndex: 1, level: 'beginner' },
    { question: 'How do you say "water" in Chinese?', options: ['茶 (chá)', '水 (shuǐ)', '酒 (jiǔ)', '奶 (nǎi)'], correctIndex: 1, level: 'beginner' },
    { question: 'Choose the correct measure word: "一___书"', options: ['个', '本', '只', '条'], correctIndex: 1, level: 'elementary' },
    { question: '"我昨天去了商店" means:', options: ['I will go to the store', 'Yesterday I went to the store', 'I like the store', 'I am at the store'], correctIndex: 1, level: 'elementary' },
    { question: 'What does "虽然...但是..." express?', options: ['Because...so...', 'Although...but...', 'If...then...', 'Not only...but also...'], correctIndex: 1, level: 'intermediate' },
    { question: '"马马虎虎" (mǎmǎhūhū) means:', options: ['Horse and tiger', 'So-so / just okay', 'Very good', 'Confused'], correctIndex: 1, level: 'intermediate' },
    { question: 'Choose the correct complement: "他跑___很快"', options: ['了', '得', '的', '过'], correctIndex: 1, level: 'upper_intermediate' },
    { question: '"画蛇添足" (draw a snake, add feet) means:', options: ['To make art', 'To ruin something by overdoing it', 'To improve something', 'To make a mistake'], correctIndex: 1, level: 'upper_intermediate' },
    { question: '"塞翁失马" (the old man lost his horse) conveys:', options: ['A blessing in disguise', 'Bad luck never ends', 'Horses are valuable', 'Old people are wise'], correctIndex: 0, level: 'advanced' },
    { question: 'What does the 把 (bǎ) construction emphasize?', options: ['Passive voice', 'The action\'s effect on the object', 'Past tense', 'Comparison'], correctIndex: 1, level: 'advanced' },
  ],
};

interface PlacementTestProps {
  targetLanguage: LanguageCode;
  onComplete: (suggestedLevel: ProficiencyLevel) => void;
  onSkip: () => void;
}

function scoreToLevel(correct: number): ProficiencyLevel {
  if (correct <= 2) return 'beginner';
  if (correct <= 4) return 'elementary';
  if (correct <= 6) return 'intermediate';
  if (correct <= 8) return 'upper_intermediate';
  return 'advanced';
}

const LEVEL_LABELS: Record<ProficiencyLevel, string> = {
  beginner: 'Beginner',
  elementary: 'Elementary',
  intermediate: 'Intermediate',
  upper_intermediate: 'Upper Intermediate',
  advanced: 'Advanced',
};

export function PlacementTest({ targetLanguage, onComplete, onSkip }: PlacementTestProps) {
  const questions = PLACEMENT_QUESTIONS[targetLanguage] ?? PLACEMENT_QUESTIONS.es;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [finished, setFinished] = useState(false);

  const question = questions[currentIndex];
  const progress = currentIndex / questions.length;

  const handleSelect = (optionIndex: number) => {
    if (selectedOption !== null) return;
    setSelectedOption(optionIndex);

    const isCorrect = optionIndex === question.correctIndex;
    if (isCorrect) setCorrectCount((c) => c + 1);
    setShowResult(true);
  };

  const handleNext = () => {
    if (currentIndex + 1 >= questions.length) {
      setFinished(true);
    } else {
      setCurrentIndex((i) => i + 1);
      setSelectedOption(null);
      setShowResult(false);
    }
  };

  if (finished) {
    const suggestedLevel = scoreToLevel(correctCount);
    return (
      <View className="flex-1">
        <View className="items-center justify-center flex-1 px-4">
          <View className="w-[100px] h-[100px] rounded-full bg-primary-tint items-center justify-center mb-6">
            <Text className="text-[32px] font-bold text-primary">{correctCount}</Text>
          </View>
          <Text className="text-[28px] font-bold text-text-primary mb-2 text-center">
            Test Complete!
          </Text>
          <Text className="text-base text-text-secondary mb-2 text-center">
            You got {correctCount} out of {questions.length} correct
          </Text>
          <Text className="text-lg font-semibold text-primary mb-8 text-center">
            We suggest: {LEVEL_LABELS[suggestedLevel]}
          </Text>
          <Button label={`Start as ${LEVEL_LABELS[suggestedLevel]}`} onPress={() => onComplete(suggestedLevel)} />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-3">
        <Pressable onPress={onSkip} accessibilityRole="button" accessibilityLabel="Skip placement test">
          <Text className="text-primary text-base font-semibold">Skip</Text>
        </Pressable>
        <Text className="text-text-secondary text-sm">
          {currentIndex + 1} / {questions.length}
        </Text>
      </View>
      <ProgressBar progress={progress} />

      {/* Question */}
      <Text className="text-xl font-bold text-text-primary mt-6 mb-6">
        {question.question}
      </Text>

      {/* Options */}
      {question.options.map((option, idx) => {
        let optionStyle = 'bg-dark-card border-2 border-transparent';
        if (showResult) {
          if (idx === question.correctIndex) {
            optionStyle = 'bg-success-bg border-2 border-success';
          } else if (idx === selectedOption && idx !== question.correctIndex) {
            optionStyle = 'bg-error-bg border-2 border-error';
          }
        } else if (idx === selectedOption) {
          optionStyle = 'bg-primary-tint border-2 border-primary';
        }

        return (
          <Pressable
            key={idx}
            className={`p-4 rounded-2xl mb-3 ${optionStyle}`}
            onPress={() => handleSelect(idx)}
            disabled={selectedOption !== null}
            accessibilityRole="button"
            accessibilityLabel={option}
          >
            <Text className="text-base font-medium text-text-primary">{option}</Text>
          </Pressable>
        );
      })}

      {/* Next button */}
      {showResult && (
        <View className="mt-4">
          <Button label={currentIndex + 1 >= questions.length ? 'See Results' : 'Next'} onPress={handleNext} />
        </View>
      )}
    </View>
  );
}
