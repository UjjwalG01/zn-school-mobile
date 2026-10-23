import { choose, EMPTY_SELECTION, type PickExam, type PickItem, resolve, type Selection } from '../examFilterModel';

const item = (key: string, sectionId: string | null = null): PickItem => ({
  key,
  examSubjectId: key.split(':')[0]!,
  label: key,
  hint: null,
  sectionId,
  blocked: false,
  note: null,
});

const exam = (overrides: Partial<PickExam> & Pick<PickExam, 'examId'>): PickExam => ({
  sessionName: '2083',
  classId: 'c1',
  className: 'Class 1',
  sectionId: null,
  sectionName: null,
  sections: [],
  items: [],
  ...overrides,
});

const select = (partial: Partial<Selection>): Selection => ({ ...EMPTY_SELECTION, ...partial });

describe('resolve (the exam filters)', () => {
  it('lists the sessions, then the classes of the chosen session', () => {
    const exams = [
      exam({ examId: 'a', sessionName: '2083', classId: 'c1', className: 'Class 1' }),
      exam({ examId: 'b', sessionName: '2083', classId: 'c2', className: 'Class 2' }),
      exam({ examId: 'c', sessionName: '2082', classId: 'c3', className: 'Class 3' }),
    ];
    const none = resolve(exams, EMPTY_SELECTION);
    expect(none.sessions).toEqual(['2083', '2082']);
    expect(none.classes).toEqual([]);

    const view = resolve(exams, select({ session: '2083' }));
    expect(view.classes.map((entry) => entry.name)).toEqual(['Class 1', 'Class 2']);
    expect(view.exam).toBeNull();
  });

  it('chooses a lone session and a lone class itself', () => {
    const view = resolve([exam({ examId: 'a', items: [item('s1')] })], EMPTY_SELECTION);
    expect(view.session).toBe('2083');
    expect(view.classId).toBe('c1');
    expect(view.exam?.examId).toBe('a');
    expect(view.items.map((entry) => entry.key)).toEqual(['s1']);
  });

  it('ignores a stale choice that the lists no longer contain', () => {
    const exams = [exam({ examId: 'a' }), exam({ examId: 'b', sessionName: '2082', classId: 'c2', className: 'Class 2' })];
    const view = resolve(exams, select({ session: '1999', classId: 'gone' }));
    expect(view.session).toBeNull();
    expect(view.classId).toBeNull();
    // With only one session left to choose from, the stale choice gives way to it.
    expect(resolve([exams[0]!], select({ session: '1999' })).session).toBe('2083');
  });

  it('uses the one whole-class exam and offers its sections as an optional narrowing of the items', () => {
    const whole = exam({
      examId: 'w',
      sections: [
        { id: 'sa', name: 'A' },
        { id: 'sb', name: 'B' },
      ],
      items: [item('math:sa', 'sa'), item('math:sb', 'sb'), item('art', null)],
    });
    const all = resolve([whole], EMPTY_SELECTION);
    expect(all.sectionRequired).toBe(false);
    expect(all.sectionOptions.map((entry) => entry.name)).toEqual(['A', 'B']);
    expect(all.items).toHaveLength(3);

    const narrowed = resolve([whole], select({ sectionId: 'sb' }));
    expect(narrowed.sectionId).toBe('sb');
    expect(narrowed.items.map((entry) => entry.key)).toEqual(['math:sb', 'art']); // other sections' items drop, unscoped stay
    expect(resolve([whole], select({ sectionId: 'not-offered' })).sectionId).toBeNull();
  });

  it('asks for a section when a class has a separate exam per section, and knows the exam once chosen', () => {
    const a = exam({ examId: 'ea', sectionId: 'sa', sectionName: 'A', items: [item('x')] });
    const b = exam({ examId: 'eb', sectionId: 'sb', sectionName: 'B', items: [item('y')] });

    const before = resolve([a, b], EMPTY_SELECTION);
    expect(before.sectionRequired).toBe(true);
    expect(before.exam).toBeNull();
    expect(before.sectionOptions.map((entry) => entry.name)).toEqual(['A', 'B']);
    expect(before.items).toEqual([]);

    const after = resolve([a, b], select({ sectionId: 'sb' }));
    expect(after.sectionRequired).toBe(false);
    expect(after.exam?.examId).toBe('eb');
    expect(after.items.map((entry) => entry.key)).toEqual(['y']);
  });

  it('does not ask for a section when the class has one section exam', () => {
    const only = exam({ examId: 'ea', sectionId: 'sa', sectionName: 'A', items: [item('x')] });
    const view = resolve([only], EMPTY_SELECTION);
    expect(view.exam?.examId).toBe('ea');
    expect(view.sectionRequired).toBe(false);
    expect(view.sectionOptions).toEqual([]);
  });

  it('keeps the chosen item only while it is still on offer', () => {
    const e = exam({ examId: 'a', items: [item('s1'), item('s2')] });
    expect(resolve([e], select({ itemKey: 's2' })).item?.key).toBe('s2');
    expect(resolve([e], select({ itemKey: 'gone' })).item).toBeNull();
  });
});

describe('choose', () => {
  const full: Selection = { session: 's', classId: 'c', sectionId: 'x', itemKey: 'i' };

  it('drops everything below the level that changed, and nothing above', () => {
    expect(choose(full, 'session', 't')).toEqual({ session: 't', classId: null, sectionId: null, itemKey: null });
    expect(choose(full, 'classId', 'd')).toEqual({ session: 's', classId: 'd', sectionId: null, itemKey: null });
    expect(choose(full, 'sectionId', 'y')).toEqual({ session: 's', classId: 'c', sectionId: 'y', itemKey: null });
    expect(choose(full, 'itemKey', 'j')).toEqual({ ...full, itemKey: 'j' });
  });
});
