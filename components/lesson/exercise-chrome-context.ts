/**
 * What the surrounding ExerciseChrome has already said, so the exercise
 * inside it does not say it again.
 *
 * The hero block carries the type's instruction ("Choose the correct answer")
 * as its title, so an ExerciseCard rendered under the chrome skips its own
 * instruction label. An ExerciseCard rendered anywhere else — a preview, a
 * test, a future practice surface — still prints it: the default is
 * "nothing has been said".
 */
import { createContext, useContext } from 'react';

interface ExerciseChromeContextValue {
  /** The chrome's hero shows the exercise type's instruction label. */
  instructionInHero: boolean;
}

export const ExerciseChromeContext = createContext<ExerciseChromeContextValue>({ instructionInHero: false });

export function useExerciseChrome(): ExerciseChromeContextValue {
  return useContext(ExerciseChromeContext);
}
