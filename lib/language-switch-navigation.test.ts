import {
  languageSwitchNavigationActions,
  type NavigationStateLike,
} from './language-switch-navigation';

/** The tab tree this app actually builds: root slot → (app) tabs → per-tab stacks. */
function tree(options: {
  /** Which tab is selected. */
  tab?: string;
  /** Routes pushed on the learn stack, beyond its index. */
  learnStack?: string[];
  /** Routes pushed on the profile stack, beyond its index. */
  profileStack?: string[];
}): NavigationStateLike {
  const tabs = ['index', 'learn', 'tutor', 'chat', 'profile'];
  const selected = options.tab ?? 'index';
  return {
    key: 'root',
    type: 'stack',
    index: 0,
    routes: [
      {
        name: '(app)',
        key: 'app-route',
        state: {
          key: 'tabs',
          type: 'tab',
          index: tabs.indexOf(selected),
          routes: tabs.map((name) => ({
            name,
            key: `${name}-route`,
            state:
              name === 'learn'
                ? {
                    key: 'learn-stack',
                    type: 'stack',
                    index: options.learnStack?.length ?? 0,
                    routes: [
                      { name: 'index', key: 'learn-index' },
                      ...(options.learnStack ?? []).map((r) => ({ name: r, key: `learn-${r}` })),
                    ],
                  }
                : name === 'profile'
                  ? {
                      key: 'profile-stack',
                      type: 'stack',
                      index: options.profileStack?.length ?? 0,
                      routes: [
                        { name: 'index', key: 'profile-index' },
                        ...(options.profileStack ?? []).map((r) => ({
                          name: r,
                          key: `profile-${r}`,
                        })),
                      ],
                    }
                  : undefined,
          })),
        },
      },
    ],
  };
}

describe('languageSwitchNavigationActions', () => {
  it('pops the lesson the learner was in — the bug this exists for', () => {
    // Mid-Russian-lesson, tapped Home, switched to Spanish. Without the pop,
    // the next tap on Learn goes back into the Russian lesson.
    const actions = languageSwitchNavigationActions(tree({ learnStack: ['[lessonId]'] }));

    expect(actions).toContainEqual({ type: 'POP_TO_TOP', target: 'learn-stack' });
  });

  it('pops every stack that has history, not only the one in the visible tab', () => {
    const actions = languageSwitchNavigationActions(
      tree({ tab: 'profile', learnStack: ['[lessonId]'], profileStack: ['settings'] }),
    );

    expect(actions).toContainEqual({ type: 'POP_TO_TOP', target: 'learn-stack' });
    expect(actions).toContainEqual({ type: 'POP_TO_TOP', target: 'profile-stack' });
  });

  it('jumps back to Home when the switch was made from another tab', () => {
    const actions = languageSwitchNavigationActions(tree({ tab: 'profile', profileStack: ['settings'] }));

    expect(actions).toContainEqual({
      type: 'JUMP_TO',
      payload: { name: 'index' },
      target: 'tabs',
    });
  });

  it('pops a stack before jumping away from its tab', () => {
    // Jumping first would leave the popped screen to unmount off-screen, which
    // is the ordering that made the old bug invisible in testing.
    const actions = languageSwitchNavigationActions(tree({ tab: 'profile', profileStack: ['settings'] }));
    const pop = actions.findIndex((a) => a.type === 'POP_TO_TOP');
    const jump = actions.findIndex((a) => a.type === 'JUMP_TO');

    expect(pop).toBeGreaterThanOrEqual(0);
    expect(pop).toBeLessThan(jump);
  });

  it('dispatches nothing when the learner is already at rest on Home', () => {
    expect(languageSwitchNavigationActions(tree({}))).toEqual([]);
  });

  it('leaves a second tab navigator alone — the teacher area is not the learner app', () => {
    const state: NavigationStateLike = {
      key: 'root',
      type: 'stack',
      index: 0,
      routes: [
        {
          name: '(teacher)',
          key: 'teacher-route',
          state: {
            key: 'teacher-tabs',
            type: 'tab',
            index: 1,
            routes: [{ name: 'index' }, { name: 'classes' }],
          },
        },
      ],
    };

    expect(languageSwitchNavigationActions(state)).toEqual([]);
  });

  it('survives a tree with no navigators mounted yet', () => {
    expect(languageSwitchNavigationActions(undefined)).toEqual([]);
    expect(languageSwitchNavigationActions({ key: 'root', routes: [] })).toEqual([]);
  });
});
